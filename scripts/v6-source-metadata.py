#!/usr/bin/env python3
"""V6 source-metadata pipeline: document type, dates, issuer and approver for official sources.

Deterministic steps only. The model steps (two independent extraction runs, one
stronger verify run, an optional audit sample) read the batch files this script
writes and return JSON that matches scripts/v6-source-metadata/record.schema.json;
docs/policy-v6-integration-guide.md ("来源元数据") has the full procedure.

  targets   official sources to process: from `pnpm validate:v6-source-metadata --targets`
            (published V6 schools) and/or --view <local V6 view.json> (new schools)
  fetch     plain HTTPS capture, raw bytes by sha256, text (pdftotext for PDF); no challenge solving
  batch     extraction batch files run/extract/bNNN.txt plus prompts
  merge     quote gate + two-run agreement over run/extract/{A,B}/bNNN.json -> verify batches
  finalize  quote gate again over run/verify/out/vNNN.json, post-rules, displayDate -> run/candidate.json
  sample    audit batch files for a random sample of the candidate
  publish   merge the candidate into a copy of data/public-v6-source-metadata.json (other schools untouched)

No step changes data/, a content pointer or anything public; `publish` writes a new file only.
Python 3.9+, curl and pdftotext (poppler) on PATH.
"""
from __future__ import annotations

import argparse
import collections
import datetime
import hashlib
import html
import json
import pathlib
import random
import re
import subprocess
import sys
import time
import urllib.parse
from html.parser import HTMLParser

HERE = pathlib.Path(__file__).resolve().parent
PROMPTS = HERE / "v6-source-metadata"
UA = "Mozilla/5.0 (compatible; UAPT-source-metadata/1.0; +https://eduaipolicy.org)"
CHALLENGE = re.compile(r"just a moment|cf-chl|cf_chl|attention required|incapsula|request unsuccessful|captcha|are you a robot|"
                       r"verify you are human|enable javascript and cookies to continue|bot protection|ddos protection", re.I)
MAX_TEXT = 120_000
DATE_KINDS = ["effective", "approved", "adopted", "issued_or_published", "revised", "reviewed", "last_updated_page", "next_review"]
DISPLAY_ORDER = ["effective", "approved", "adopted", "issued_or_published", "revised", "reviewed", "last_updated_page"]
LATER = ("revised", "reviewed", "last_updated_page")
ACADEMIC = re.compile(r"\b(19|20)\d\d\s*[/–-]\s*\d\d\b|\b(fall|spring|summer|winter|autumn|semester|term|trimester|AY)\b", re.I)
BOILERPLATE_ISSUER = re.compile(r"^(authori[sz]ed by:?\s*)?(the\s+)?(executive\s+)?director,?\s*(of\s+)?(marketing|web|communications)\s*$", re.I)


def norm(text: str | None) -> str:
    return re.sub(r"\s+", " ", text or "").strip().lower()


def url_key(url: str) -> str:
    """Same key as v6SourceUrlKey in packages/shared/src/v6-source-metadata.ts."""
    try:
        p = urllib.parse.urlsplit(url.strip())
        return f"{p.hostname.lower().removeprefix('www.') if p.hostname else ''}{p.path.rstrip('/')}{('?' + p.query) if p.query else ''}"
    except ValueError:
        return url.strip()


def today() -> str:
    return datetime.datetime.now(datetime.timezone.utc).date().isoformat()


def read_json(path: pathlib.Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: pathlib.Path, value, new_only: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if new_only and path.exists():
        sys.exit(f"Refusing to overwrite {path}")
    path.write_text(json.dumps(value, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


# ---------------------------------------------------------------- targets
def cmd_targets(a) -> None:
    rows: dict[tuple[str, str], dict] = {}
    for f in a.gate or []:
        for t in read_json(pathlib.Path(f))["targets"]:
            rows[(t["slug"], url_key(t["url"]))] = {"slug": t["slug"], "url": t["url"], "reason": t["reason"]}
    for f in a.view or []:
        view = read_json(pathlib.Path(f))
        view = view.get("target") or view.get("candidate") or view  # review packets wrap the view
        slug = view["school"]["slug"]
        for s in view.get("sources", []):
            if s.get("official") and s.get("sourceUrl"):
                rows.setdefault((slug, url_key(s["sourceUrl"])), {"slug": slug, "url": s["sourceUrl"], "reason": "new_school"})
    out = sorted(rows.values(), key=lambda r: (r["slug"], r["url"]))
    write_json(pathlib.Path(a.run) / "targets.json", {"schemaVersion": "uapt-v6-source-metadata-targets-v1", "targets": out}, new_only=True)
    print(json.dumps({"targets": len(out), "schools": len({r["slug"] for r in out})}))


# ---------------------------------------------------------------- fetch
class _Text(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.out: list[str] = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript", "svg", "template"):
            self.skip += 1
        if tag in ("p", "br", "div", "li", "h1", "h2", "h3", "h4", "h5", "tr", "section", "article", "header", "footer", "dd", "dt"):
            self.out.append("\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript", "svg", "template") and self.skip:
            self.skip -= 1

    def handle_data(self, data):
        if not self.skip:
            self.out.append(data)


def html_text(raw: bytes) -> str:
    parser = _Text()
    parser.feed(raw.decode("utf-8", "replace"))
    return re.sub(r"\n\s*\n+", "\n", re.sub(r"[ \t\r\f\v]+", " ", html.unescape("".join(parser.out)))).strip()


def text_of(raw: bytes) -> tuple[str, str]:
    if raw[:5] == b"%PDF-":
        r = subprocess.run(["pdftotext", "-layout", "-enc", "UTF-8", "-", "-"], input=raw, capture_output=True, timeout=180)
        return r.stdout.decode("utf-8", "replace").strip(), "pdf"
    return html_text(raw), "html"


def cmd_fetch(a) -> None:
    run = pathlib.Path(a.run)
    objects = run / "objects"
    objects.mkdir(parents=True, exist_ok=True)
    targets = read_json(run / "targets.json")["targets"]
    monitor = {}
    if a.monitor_export:  # optional reuse of source-monitor captures: {"ok": [{url, text, rawSha256, hashKind?}]}
        for x in read_json(pathlib.Path(a.monitor_export)).get("ok", []):
            monitor[url_key(x["url"])] = x
    by_url: dict[str, list[dict]] = collections.defaultdict(list)
    for t in targets:
        by_url[url_key(t["url"])].append(t)
    last: dict[str, float] = collections.defaultdict(float)
    docs, failed = [], []
    for i, (key, group) in enumerate(sorted(by_url.items())):
        url = group[0]["url"]
        slugs = sorted({t["slug"] for t in group})
        doc = {"docId": f"d{i + 1:04d}", "url": url, "slugs": slugs, "checkedOn": today()}
        if key in monitor and len(monitor[key].get("text", "")) >= 200:
            m = monitor[key]
            (objects / f"{m['rawSha256']}.txt").write_text(m["text"], encoding="utf-8")
            docs.append({**doc, "rawSha256": m["rawSha256"], "hashKind": m.get("hashKind", "raw_captured_bytes"), "kind": "monitor", "textFile": f"objects/{m['rawSha256']}.txt"})
            continue
        host = urllib.parse.urlsplit(url).hostname or ""
        wait = a.delay - (time.time() - last[host])
        if wait > 0:
            time.sleep(wait)
        last[host] = time.time()
        body = run / "body.tmp"
        cmd = ["curl", "-sS", "-L", "--max-redirs", "8", "--compressed", "--max-time", "60", "--max-filesize", "30000000", "-A", UA,
               "-H", "Accept: text/html,application/xhtml+xml,application/pdf,*/*;q=0.8", "-o", str(body), "-w", "%{http_code} %{url_effective}", url]
        r = subprocess.run(cmd, capture_output=True, text=True)
        detail = None
        try:
            code, _, final = r.stdout.partition(" ")
            raw = body.read_bytes() if body.exists() else b""
            status = int(code or 0)
            if status != 200 or not raw:
                detail = f"HTTP {status}" if status else f"network error: {r.stderr.strip()[:160]}"
            else:
                text, kind = text_of(raw)
                if CHALLENGE.search(text[:4000]) and len(text) < 3000:
                    detail = "bot challenge page; not bypassed"
                elif len(text) < 200:
                    detail = "empty page or script-only shell (needs a rendered capture)"
                else:
                    digest = sha256(raw)
                    (objects / digest).write_bytes(raw)
                    (objects / f"{digest}.txt").write_text(text, encoding="utf-8")
                    docs.append({**doc, "finalUrl": final, "rawSha256": digest, "hashKind": "raw_captured_bytes", "kind": kind, "textFile": f"objects/{digest}.txt"})
        finally:
            body.unlink(missing_ok=True)
        if detail:
            failed.append({**doc, "detail": detail})
        print(i, detail or "ok", url[:100], flush=True)
    write_json(run / "docs.json", {"docs": docs, "failed": failed}, new_only=True)
    print(json.dumps({"docs": len(docs), "failed": len(failed)}))


def doc_text(run: pathlib.Path, d: dict) -> str:
    return (run / d["textFile"]).read_text(encoding="utf-8")[:MAX_TEXT]


def doc_block(run: pathlib.Path, d: dict, records: list[tuple[str, dict | None]]) -> str:
    parts = [f"===== DOC {d['docId']} =====", f"URL: {d['url']}"]
    for label, rec in records:
        parts.append(f"{label}: {json.dumps(rec, ensure_ascii=False)}")
    parts += ["TEXT:", doc_text(run, d), f"----- TEXT END {d['docId']} -----", ""]
    return "\n".join(parts)


def render_prompt(name: str, file: pathlib.Path) -> str:
    rules = (PROMPTS / "rules.md").read_text(encoding="utf-8")
    return (PROMPTS / f"{name}.md").read_text(encoding="utf-8").replace("{file}", str(file)).replace("{rules}", rules)


def write_batches(run: pathlib.Path, stage: str, prefix: str, blocks: list[tuple[str, str]], size: int) -> int:
    folder = run / stage
    folder.mkdir(parents=True, exist_ok=True)
    manifest = []
    for n, start in enumerate(range(0, len(blocks), size)):
        chunk = blocks[start:start + size]
        path = folder / f"{prefix}{n:03d}.txt"
        path.write_text("\n".join(b for _, b in chunk), encoding="utf-8")
        manifest.append({"file": path.name, "docIds": [d for d, _ in chunk]})
    write_json(folder / "manifest.json", {"batches": manifest})
    return len(manifest)


# ---------------------------------------------------------------- batch
def cmd_batch(a) -> None:
    run = pathlib.Path(a.run)
    docs = read_json(run / "docs.json")["docs"]
    n = write_batches(run, "extract", "b", [(d["docId"], doc_block(run, d, [])) for d in docs], a.size)
    (run / "extract" / "prompt.md").write_text(render_prompt("extract", run / "extract" / "bNNN.txt"), encoding="utf-8")
    print(json.dumps({"batches": n, "docs": len(docs), "next": "run two independent extraction passes; save run/extract/A/bNNN.json and run/extract/B/bNNN.json"}))


# ---------------------------------------------------------------- quote gate
def gate(rec: dict | None, text: str, stats: collections.Counter) -> dict | None:
    """Keep only values whose quote is a verbatim substring of the text; dates must also carry their year in the quote."""
    if not rec:
        return None
    t = norm(text)

    def ok(q):
        good = bool(q) and norm(q) in t
        stats["fields"] += 1
        stats["dropped_quote"] += not good
        return good

    out = {"docType": rec.get("docType"), "stage": rec.get("stage") or "unknown"}
    for k in ("issuer", "approvedBy", "version", "scope"):
        v = rec.get(k)
        out[k] = v if v and ok(v.get("quote")) else None
    out["dates"] = []
    for d in rec.get("dates") or []:
        value = d.get("value", "")
        shape = re.fullmatch(r"\d{4}(-\d\d){0,2}", value) and d.get("kind") in DATE_KINDS and \
            len(value.split("-")) == {"year": 1, "month": 2, "day": 3}.get(d.get("precision"), 0)
        if shape and ok(d.get("quote")) and value[:4] in (d.get("quote") or ""):
            out["dates"].append({k: d[k] for k in ("kind", "value", "precision", "quote")})
        else:
            stats["dropped_date"] += 1
    return out


def load_outputs(folder: pathlib.Path) -> dict[str, dict]:
    out = {}
    for f in sorted(folder.glob("*.json")):
        for r in read_json(f).get("records", []):
            out[r["docId"]] = r
    return out


def name_key(s: str | None) -> str:
    return re.sub(r"\(.*?\)|\buniversity of\b|[^a-z0-9À-￿]+", " ", norm(s)).strip()


# ---------------------------------------------------------------- merge
def cmd_merge(a) -> None:
    run = pathlib.Path(a.run)
    docs = read_json(run / "docs.json")["docs"]
    A, B = load_outputs(run / "extract" / "A"), load_outputs(run / "extract" / "B")
    stats = collections.Counter()
    blocks, agreement = [], {}
    for d in docs:
        text = doc_text(run, d)
        ca, cb = gate(A.get(d["docId"]), text, stats), gate(B.get(d["docId"]), text, stats)
        stats["docs"] += 1
        stats["missing_run"] += (ca is None) + (cb is None)
        same = bool(ca and cb) and {x["value"] for x in ca["dates"]} == {x["value"] for x in cb["dates"]} and \
            name_key((ca["issuer"] or {}).get("name")) == name_key((cb["issuer"] or {}).get("name")) and ca["docType"] == cb["docType"]
        stats["agreed" if same else "disagreed"] += 1
        agreement[d["docId"]] = same
        blocks.append((d["docId"], doc_block(run, d, [("CANDIDATE A", ca), ("CANDIDATE B", cb)])))
    n = write_batches(run, "verify", "v", blocks, a.size)
    write_json(run / "verify" / "agreement.json", agreement)
    (run / "verify" / "prompt.md").write_text(render_prompt("verify", run / "verify" / "vNNN.txt"), encoding="utf-8")
    print(json.dumps({**stats, "verifyBatches": n, "next": "run the stronger verify model over every vNNN.txt; save run/verify/out/vNNN.json"}))


# ---------------------------------------------------------------- finalize
def post_rules(rec: dict, stats: collections.Counter) -> dict:
    for k in ("issuer", "approvedBy"):
        v = rec.get(k)
        if v and (BOILERPLATE_ISSUER.search(v["name"].strip()) or BOILERPLATE_ISSUER.search((v.get("quote") or "").strip())):
            rec[k] = None
            stats[f"post_drop_{k}"] += 1
    kept = []
    for d in rec["dates"]:
        if d["kind"] == "effective" and d["precision"] in ("year", "month") and ACADEMIC.search(d["quote"]):
            stats["post_drop_academic_year"] += 1
        else:
            kept.append(d)
    rec["dates"] = kept
    iss = rec.get("issuer")
    if not rec.get("approvedBy") and iss and iss.get("role") == "approver":
        rec["approvedBy"] = {"name": iss["name"], "quote": iss["quote"]}
    return rec


def shown_dates(dates: list[dict], checked_on: str) -> tuple[dict, dict | None]:
    best = None
    for kind in DISPLAY_ORDER:
        c = sorted((d for d in dates if d["kind"] == kind), key=lambda d: d["value"], reverse=True)
        if c:
            best = {"kind": kind, "value": c[0]["value"], "precision": c[0]["precision"]}
            break
    display = best or {"kind": "verified", "value": checked_on, "precision": "day"}
    later = sorted((d for d in dates if best and d["kind"] in LATER and d["value"] > best["value"]), key=lambda d: d["value"], reverse=True)
    latest = {"kind": later[0]["kind"], "value": later[0]["value"], "precision": later[0]["precision"]} if later else None
    return display, latest


def cmd_finalize(a) -> None:
    run = pathlib.Path(a.run)
    data = read_json(run / "docs.json")
    final = load_outputs(run / "verify" / "out")
    stats = collections.Counter()
    records, missing = [], []
    for d in data["docs"]:
        f = final.get(d["docId"])
        if not f:
            missing.append(d["docId"])
            continue
        rec = post_rules(gate(f, doc_text(run, d), stats), stats)
        if rec["docType"] is None:
            missing.append(d["docId"])
            continue
        display, latest = shown_dates(rec["dates"], d["checkedOn"])
        records.append({"docId": d["docId"], "url": d["url"], "slugs": d["slugs"], **rec, "displayDate": display, "latestUpdate": latest,
                        "lastVerifiedOn": d["checkedOn"], "capture": {"sha256": d["rawSha256"], "hashKind": {"firecrawl_rendered": "rendered_markdown"}.get(d["hashKind"], d["hashKind"])},
                        "verificationNote": f.get("changes")})
        stats["display_" + display["kind"]] += 1
        stats["with_issuer"] += bool(rec["issuer"])
        stats["with_approvedBy"] += bool(rec["approvedBy"])
    if missing:
        sys.exit(f"Verify output missing or invalid for {len(missing)} docs: {', '.join(missing[:20])}. Re-run those batches; nothing written.")
    candidate = {"schemaVersion": "uapt-v6-source-metadata-candidate-v1", "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                 "reviewPolicy": "agent review only; no human review step (AGENTS.md Review Policy)",
                 "records": records, "failed": data["failed"]}
    write_json(run / "candidate.json", candidate, new_only=True)
    print(json.dumps({"records": len(records), "failed": len(data["failed"]), **stats}))


# ---------------------------------------------------------------- sample (audit)
def cmd_sample(a) -> None:
    run = pathlib.Path(a.run)
    cand = read_json(run / "candidate.json")["records"]
    docs = {d["docId"]: d for d in read_json(run / "docs.json")["docs"]}
    rng = random.Random(a.seed)
    pick = sorted(rng.sample(cand, min(a.n, len(cand))), key=lambda r: r["docId"])
    blocks = [(r["docId"], doc_block(run, docs[r["docId"]], [("FINAL", {k: r[k] for k in ("docType", "stage", "issuer", "approvedBy", "dates", "displayDate", "latestUpdate", "version")})])) for r in pick]
    n = write_batches(run, "audit", "a", blocks, a.size)
    (run / "audit" / "prompt.md").write_text(render_prompt("audit", run / "audit" / "aNNN.txt"), encoding="utf-8")
    print(json.dumps({"sampled": len(pick), "batches": n, "seed": a.seed}))


# ---------------------------------------------------------------- publish
def cmd_publish(a) -> None:
    run = pathlib.Path(a.run)
    cand_bytes = (run / "candidate.json").read_bytes()
    cand = json.loads(cand_bytes)
    current = read_json(pathlib.Path(a.metadata))
    schools = {slug: list(docs) for slug, docs in current["schools"].items()}
    gaps = {slug: list(g) for slug, g in (current.get("gaps") or {}).items()}
    touched = collections.Counter()
    for r in cand["records"]:
        doc = {k: r[k] for k in ("url", "docType", "stage", "issuer", "approvedBy", "dates", "displayDate", "latestUpdate", "version", "scope", "lastVerifiedOn", "capture")}
        for slug in r["slugs"]:
            key = url_key(r["url"])
            schools[slug] = [d for d in schools.get(slug, []) if url_key(d["url"]) != key] + [doc]
            gaps[slug] = [g for g in gaps.get(slug, []) if url_key(g["url"]) != key]
            touched["documents"] += 1
    for f in cand["failed"]:
        for slug in f["slugs"]:
            key = url_key(f["url"])
            if any(url_key(d["url"]) == key for d in schools.get(slug, [])):
                continue  # an earlier successful record stays; a failed re-check does not erase it
            gaps[slug] = [g for g in gaps.get(slug, []) if url_key(g["url"]) != key] + [{"url": f["url"], "reason": "fetch_failed", "detail": f["detail"][:500], "checkedOn": f["checkedOn"]}]
            touched["fetch_failed"] += 1
    out = {**{k: v for k, v in current.items() if k not in ("schools", "gaps", "generatedAt", "basis")},
           "generatedAt": datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
           "basis": {"contentId": a.content_id, "candidateSha256": sha256(cand_bytes), "schools": len([s for s in schools if schools[s]])},
           "schools": {s: sorted(d, key=lambda x: x["url"]) for s, d in sorted(schools.items()) if d}}
    gaps = {s: sorted(g, key=lambda x: x["url"]) for s, g in sorted(gaps.items()) if g}
    if gaps:
        out["gaps"] = gaps
    target = pathlib.Path(a.out)
    if target.exists():
        sys.exit(f"Refusing to overwrite {target}")
    target.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({**touched, "schools": out["basis"]["schools"], "sha256": sha256(target.read_bytes()), "out": str(target),
                      "next": "pnpm validate:v6-source-metadata --metadata <out>; remove processed pairs from scripts/content-release/v6-source-metadata-legacy-unprocessed.json"}))


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("targets"); s.add_argument("--run", required=True); s.add_argument("--gate", action="append"); s.add_argument("--view", action="append")
    s = sub.add_parser("fetch"); s.add_argument("--run", required=True); s.add_argument("--delay", type=float, default=4.0); s.add_argument("--monitor-export")
    s = sub.add_parser("batch"); s.add_argument("--run", required=True); s.add_argument("--size", type=int, default=15)
    s = sub.add_parser("merge"); s.add_argument("--run", required=True); s.add_argument("--size", type=int, default=15)
    s = sub.add_parser("finalize"); s.add_argument("--run", required=True)
    s = sub.add_parser("sample"); s.add_argument("--run", required=True); s.add_argument("--n", type=int, default=30); s.add_argument("--seed", type=int, default=20261119); s.add_argument("--size", type=int, default=10)
    s = sub.add_parser("publish"); s.add_argument("--run", required=True); s.add_argument("--metadata", required=True); s.add_argument("--out", required=True); s.add_argument("--content-id", required=True)
    a = p.parse_args()
    if a.cmd == "targets" and not (a.gate or a.view):
        p.error("targets needs --gate and/or --view")
    {"targets": cmd_targets, "fetch": cmd_fetch, "batch": cmd_batch, "merge": cmd_merge, "finalize": cmd_finalize, "sample": cmd_sample, "publish": cmd_publish}[a.cmd](a)


if __name__ == "__main__":
    main()
