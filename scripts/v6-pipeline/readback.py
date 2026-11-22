#!/usr/bin/env python3
"""S6/S8 HTTP readback of a running server (local candidate or public site) for a V6 content release.

  python3 scripts/v6-pipeline/readback.py --workspace <dir> <base-url> <out.json> <contentId> <manifestSha256> <metadata.json> <scope.json> [workers]

Public readback uses 1 worker (2 concurrent requests trip nginx 503 on /api/public/v1). Reads en and zh for every school
in scope, fr/es/de for four sampled schools, the API record of every school and batch.json readback.controls (default:
unchanged controls). Errors: non-200, application errors, missing V6 layout, source-metadata or Claim ID mismatch.
"""
import json, re, sys, hashlib, html, random, urllib.request, concurrent.futures as cf, datetime, pathlib
from urllib.parse import urlsplit
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import v6batch as Bt  # noqa: E402
WS, ARGS = Bt.workspace_from_argv()
BATCH = Bt.load(WS)
BASE, OUT, CID, MSHA = ARGS[0].rstrip("/"), ARGS[1], ARGS[2], ARGS[3]
W = int(ARGS[6]) if len(ARGS) > 6 else 1
meta = json.load(open(ARGS[4]))
scope = {u["slug"]: u["publicClaimIds"] for u in json.load(open(ARGS[5]))["universities"]}
slugs = sorted(scope)
def key(u):
    s = urlsplit(html.unescape(u).strip()); return s.netloc.lower().removeprefix("www.") + s.path.rstrip("/") + (("?" + s.query) if s.query else "")
def get(path, extra=""):
    req = urllib.request.Request(BASE + path + extra, headers={"User-Agent": "uapt-readback"})
    try:
        with urllib.request.urlopen(req, timeout=300) as r: return r.status, r.read()
    except urllib.error.HTTPError as e: return e.code, b""
    except Exception as e: return 0, str(e).encode()
rng = random.Random(11)
pages = [f"{'' if l == 'en' else '/' + l}/universities/{s}" for s in slugs for l in ("en", "zh")]
pages += [f"/{l}/universities/{s}" for l in ("fr", "es", "de") for s in rng.sample(slugs, min(4, len(slugs)))]
apis = [f"/api/public/v1/universities/{s}.json" for s in slugs]
controls = BATCH.get("readback", {}).get("controls") or ["/", "/universities", "/changes", "/sitemap.xml", "/llms.txt", "/universities/harvard-university", "/zh/universities/rice-university", "/universities/university-of-bristol", "/api/public/v1/universities/harvard-university.json"]
def page(p):
    st, b = get(p, "?uapt_readback=" + BATCH["batchId"] if BASE.startswith("https") else ""); h = b.decode("utf-8", "replace"); slug = p.rsplit("/", 1)[1]
    hrefs = list(dict.fromkeys(re.findall(r'<a href="([^"]+)" target="_blank" rel="noopener noreferrer" data-analytics-entity-slug', h)))
    expected = {key(d["url"]) for d in meta["schools"].get(slug, [])}
    lang = (re.search(r'<html[^>]* lang="([^"]+)"', h) or [None, None])[1]
    canon = (re.search(r'<link rel="canonical" href="([^"]+)"', h) or [None, None])[1]
    return p, {"status": st, "sha256": hashlib.sha256(b).hexdigest(), "lang": lang, "canonical": canon, "sourceCards": len(hrefs),
               "expectedSourceMetadata": sum(1 for x in hrefs if key(x) in expected), "renderedSourceMetadata": h.count('class="policy-v6-sourceMeta"'), "v6Layout": 'data-ui-experience="compact-evidence"' in h or "policy-v6" in h,
               "applicationError": "Application error" in h or "__next_error__" in h}
def api(p):
    st, b = get(p); slug = p.rsplit("/", 1)[1][:-5]
    try: d = json.loads(b); ids = sorted(c["id"] for c in d.get("data", d)["claims"]); docs = len(d.get("sourceMetadata", {}).get("documents", []))
    except Exception: ids, docs = None, -1
    return p, {"status": st, "sha256": hashlib.sha256(b).hexdigest(), "claimIds": ids, "claimIdsMatchScope": ids == sorted(scope[slug]), "sourceMetadataDocuments": docs, "expectedSourceMetadataDocuments": len(meta["schools"].get(slug, []))}
def ctrl(p):
    st, b = get(p); return p, {"status": st, "sha256": hashlib.sha256(b).hexdigest(), "bytes": len(b)}
rows = {}
with cf.ThreadPoolExecutor(W) as ex:
    for f, items in ((page, pages), (api, apis), (ctrl, controls)):
        for p, r in ex.map(f, items): rows[p] = r
errors = [p for p, r in rows.items() if r["status"] != 200 or r.get("applicationError") or r.get("v6Layout") is False or ("renderedSourceMetadata" in r and (r["renderedSourceMetadata"] != r["expectedSourceMetadata"] or (not r["expectedSourceMetadata"] and meta["schools"].get(p.rsplit("/", 1)[1])))) or ("claimIdsMatchScope" in r and (not r["claimIdsMatchScope"] or (r["sourceMetadataDocuments"] not in (r["expectedSourceMetadataDocuments"], 0))))]
out = {"contentId": CID, "manifestSha256": MSHA, "base": BASE, "checkedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "rows": rows, "errors": errors}
json.dump(out, open(OUT, "w"), indent=1)
print(json.dumps({"rows": len(rows), "pages": len(pages), "apis": len(apis), "controls": len(controls), "errors": errors[:10], "errorCount": len(errors)}))
