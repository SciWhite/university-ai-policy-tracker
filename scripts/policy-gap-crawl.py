#!/usr/bin/env python3
"""One finite, resumable pass over explicit private evidence gaps; no policy promotion."""
import argparse
import collections
import concurrent.futures
import importlib.util
import ipaddress
import json
from pathlib import Path
import socket
import subprocess
import tempfile
import threading
import time
import urllib.parse
import urllib.robotparser

spec = importlib.util.spec_from_file_location("reconciliation", Path(__file__).with_name("policy-evidence-reconcile.py"))
rec = importlib.util.module_from_spec(spec); spec.loader.exec_module(rec)
inv = rec.inv
AGENT = "UniversityPolicyEvidenceAudit"


def public_address(url):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme not in ["http", "https"] or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Only credential-free public HTTP(S) URLs are eligible")
    if parsed.port not in [None, 80, 443] or parsed.hostname.lower().endswith((".local", ".localhost")) or parsed.hostname.lower() == "localhost":
        raise ValueError("Non-public origin is excluded")
    addresses = {r[4][0] for r in socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)}
    if not addresses or any(not ipaddress.ip_address(a).is_global for a in addresses):
        raise ValueError("Origin does not resolve exclusively to public addresses")
    return parsed, sorted(addresses, key=lambda a: (":" in a, a))[0]


def transport(url):
    try:
        parsed, address = public_address(url)
    except (ValueError, OSError) as exc:
        return {"url": url, "status": "invalid_or_unresolved_origin", "error": str(exc), "exitCode": None}, b""
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    resolved = f"[{address}]" if ":" in address else address
    with tempfile.TemporaryDirectory() as d:
        body = Path(d) / "body"
        result = subprocess.run(["curl", "-sS", "--connect-timeout", "6", "--max-time", "18", "--max-filesize", "10485760", "--proto", "=http,https", "--resolve", f"{parsed.hostname}:{port}:{resolved}", "--user-agent", AGENT + "/1.0", "--output", str(body), "--write-out", "%{json}", url], capture_output=True)
        try: meta = json.loads(result.stdout)
        except ValueError: meta = {}
        return {"url": url, "exitCode": result.returncode, "fetchedAt": inv.now(), **{k: meta.get(k) for k in ["http_code", "content_type", "redirect_url", "ssl_verify_result", "time_total"]}}, body.read_bytes() if body.exists() else b""


def origin(url):
    p = urllib.parse.urlsplit(url)
    return p.scheme + "://" + p.netloc


class Collector:
    def __init__(self, output):
        self.output = Path(output)
        self.lock = threading.RLock()
        self.origins = {}
        self.robot_cache = {}
        self.last_access = {}

    def store(self, raw):
        h = inv.sha(raw); p = inv.object_path(self.output, h)
        with self.lock:
            p.parent.mkdir(parents=True, exist_ok=True)
            if not p.exists(): p.write_bytes(raw)
        return h

    def origin_lock(self, host):
        with self.lock: return self.origins.setdefault(host, threading.RLock())

    def rules(self, host):
        with self.origin_lock(host):
            if host in self.robot_cache: return self.robot_cache[host]
            url = host + "/robots.txt"; chain = []
            for _ in range(5):
                meta, raw = transport(url); chain.append({**meta, "bodyArtifactId": self.store(raw)})
                if meta.get("exitCode") != 0: break
                if meta.get("http_code") in [301, 302, 303, 307, 308] and meta.get("redirect_url"):
                    url = urllib.parse.urljoin(url, meta["redirect_url"]); continue
                break
            code = meta.get("http_code"); parser = urllib.robotparser.RobotFileParser()
            text = raw.decode(errors="replace")
            available = meta.get("exitCode") == 0 and code in [200, 404, 410]
            if code == 200:
                if rec.response_kind(raw, meta.get("content_type")) != "retrieved" or "<html" in text[:1000].lower(): available = False
                parser.parse(text.splitlines())
            delay = parser.crawl_delay(AGENT) or 0
            rate = parser.request_rate(AGENT)
            if rate and rate.requests: delay = max(delay, rate.seconds / rate.requests)
            policy = {"available": available, "noRules": code in [404, 410], "parser": parser, "delay": max(0.2, delay), "receipt": {"origin": host, "chain": chain, "available": available}}
            receipt_bytes = (json.dumps(policy["receipt"], ensure_ascii=False, sort_keys=True) + "\n").encode()
            with self.lock:
                receipts = self.output / "robots-history"; receipts.mkdir(exist_ok=True)
                (receipts / (inv.sha(receipt_bytes) + ".json")).write_bytes(receipt_bytes)
            self.robot_cache[host] = policy
            return policy

    def fetch(self, url):
        current = url; chain = []
        for _ in range(6):
            host = origin(current)
            rules = self.rules(host)
            if not rules["available"]: return {"sourceUrl": url, "status": "robots_unresolved_no_fetch", "blockedUrl": current, "chain": chain}
            if not rules["noRules"] and not rules["parser"].can_fetch(AGENT, current):
                return {"sourceUrl": url, "status": "robots_disallowed", "blockedUrl": current, "chain": chain}
            if rules["delay"] > 30: return {"sourceUrl": url, "status": "robots_delay_requires_manual", "chain": chain}
            with self.origin_lock(host):
                wait = rules["delay"] - (time.monotonic() - self.last_access.get(host, 0))
                if wait > 0: time.sleep(wait)
                meta, raw = transport(current); self.last_access[host] = time.monotonic()
            chain.append({**meta, "bodyArtifactId": self.store(raw)})
            if meta.get("exitCode") != 0: return {"sourceUrl": url, "status": "retrieval_failed", "chain": chain}
            code = meta.get("http_code")
            if code in [301, 302, 303, 307, 308] and meta.get("redirect_url"):
                current = urllib.parse.urljoin(current, meta["redirect_url"]); continue
            status = rec.response_kind(raw, meta.get("content_type")) if code == 200 else "http_error"
            if status == "retrieved" and "text/html" not in (meta.get("content_type") or "").lower() and not raw.startswith(b"%PDF") and not (meta.get("content_type") or "").lower().startswith("text/"):
                status = "non_policy_format_requires_review"
            return {"sourceUrl": url, "finalUrl": current, "status": status, "chain": chain, "semanticReviewed": False, "pdfActualPageVerified": False}
        return {"sourceUrl": url, "status": "redirect_limit", "chain": chain}


def run(queue_path, output, workers=8, resume=False):
    implementation_bytes = Path(__file__).read_bytes()
    queue_path, output = Path(queue_path), Path(output)
    queue = inv.load(queue_path); queue_hash = inv.sha(queue_path.read_bytes())
    if len({r["sourceLevelId"] for r in queue}) != len(queue): raise ValueError("Duplicate source-level queue IDs")
    if output.exists() and not resume: raise ValueError("New crawl output required; resume must be explicit")
    if (output / "manifest.json").exists(): raise ValueError("Frozen runs cannot resume")
    output.mkdir(parents=True, exist_ok=True)
    config = {"schemaVersion": "uapt-private-gap-crawl-v1", "queueSha256": queue_hash, "groups": len(queue), "uniqueUrls": len({r["sourceUrl"] for r in queue}), "workers": workers, "publicationApproved": False}
    if (output / "config.json").exists() and inv.load(output / "config.json") != config: raise ValueError("Resume configuration changed")
    inv.write(output / "config.json", config); (output / "queue.json").write_bytes(queue_path.read_bytes())
    collector = Collector(output); rows = []
    if (output / "url-receipts.jsonl").exists():
        rows = [json.loads(line) for line in (output / "url-receipts.jsonl").read_text().splitlines()]
    done = {r["sourceUrl"] for r in rows}
    if len(done) != len(rows): raise ValueError("Duplicate resumed URL receipts")
    if not done <= {r["sourceUrl"] for r in queue}: raise ValueError("Resumed receipt is outside the frozen queue")
    for receipt in rows:
        for hop in receipt.get("chain", []):
            raw = inv.object_path(output, hop["bodyArtifactId"]).read_bytes()
            if inv.sha(raw) != hop["bodyArtifactId"]: raise ValueError("Resumed raw object identity mismatch")
    pending = sorted({r["sourceUrl"] for r in queue} - done)
    with (output / "url-receipts.jsonl").open("a") as stream, concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(collector.fetch, url): url for url in pending}
        for future in concurrent.futures.as_completed(futures):
            try: receipt = future.result()
            except Exception as exc: receipt = {"sourceUrl": futures[future], "status": "collector_error", "error": str(exc), "chain": []}
            rows.append(receipt); stream.write(json.dumps(receipt, ensure_ascii=False) + "\n"); stream.flush()
            inv.write(output / "progress.json", {"urlsProcessed": len(rows), "totalUrls": config["uniqueUrls"], "statuses": dict(collections.Counter(r["status"] for r in rows)), "updatedAt": inv.now()})
            if len(rows) % 100 == 0: print(f"Processed {len(rows)}/{config['uniqueUrls']} explicit URLs", flush=True)
    robots = {host: r["receipt"] for host, r in collector.robot_cache.items()}
    if (output / "robots-receipts.json").exists(): robots = {**inv.load(output / "robots-receipts.json"), **robots}
    inv.write(output / "robots-receipts.json", robots)
    by_url = {r["sourceUrl"]: r for r in rows}; groups = []
    for group in queue:
        receipt = by_url[group["sourceUrl"]]
        raw_id = receipt["chain"][-1]["bodyArtifactId"] if receipt["chain"] else None
        groups.append({**group, "currentRetrievalStatus": receipt["status"], "currentBodyArtifactId": raw_id, "historicalRawHashReproduced": bool(receipt["status"] == "retrieved" and raw_id == group["declaredSnapshotHash"]), "historicalGapClosed": False, "policyVerdict": "UNVERIFIED_not_absent", "temporalReview": "not_checked"})
    inv.write(output / "group-results.json", groups)
    inv.write(output / "summary.json", {**config, "generatedAt": inv.now(), "sourceLevelGroupsProcessed": len(groups), "urlStatuses": dict(collections.Counter(r["status"] for r in rows)), "historicalRawHashesReproduced": sum(g["historicalRawHashReproduced"] for g in groups), "policyVerdictsChanged": 0, "boundary": "Current raw source retrieval only; no quote, semantic, scope, PDF-page, temporal or approval verdict implied."})
    (output / "implementation.py").write_bytes(implementation_bytes)
    (output / "reconciliation-implementation.py").write_bytes(Path(__file__).with_name("policy-evidence-reconcile.py").read_bytes())
    inv.write(output / "manifest.json", {"schemaVersion": "uapt-private-gap-crawl-manifest-v1", "queueSha256": queue_hash, "private": True, "publicationApproved": False, "files": {str(p.relative_to(output)): inv.sha(p.read_bytes()) for p in output.rglob("*") if p.is_file() and p != output / "manifest.json"}})
    print(json.dumps(inv.load(output / "summary.json")), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument("queue"); parser.add_argument("--output", required=True); parser.add_argument("--workers", type=int, default=8); parser.add_argument("--resume", action="store_true"); args = parser.parse_args()
    if not 1 <= args.workers <= 8: parser.error("workers must be 1..8")
    run(args.queue, args.output, args.workers, args.resume)
