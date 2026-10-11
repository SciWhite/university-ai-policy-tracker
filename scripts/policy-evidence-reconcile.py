#!/usr/bin/env python3
"""Read-only reconciliation overlays for frozen private inventories."""
import argparse
import collections
import concurrent.futures
import importlib.util
import json
from pathlib import Path
import re
import shutil
import sqlite3
import subprocess
import tempfile
import urllib.parse
import urllib.robotparser

spec = importlib.util.spec_from_file_location("inventory", Path(__file__).with_name("policy-inventory.py"))
inv = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inv)

TEXT = {".txt", ".md", ".html"}
CONTENT_FIELDS = ["claimText", "statement", "scope", "appliesToAI", "modality", "conditions", "exceptions", "deadlines", "claimValue", "normalizedValue"]


def versions(raw):
    """Explicit derived hashes; raw bytes are never rewritten."""
    yield "raw_bytes", raw
    if raw.endswith(b"\n"):
        yield "utf8_without_single_final_lf_v1", raw[:-1]
    try:
        text = raw.decode("utf-8")
        yield "utf8_strip_outer_whitespace_v1", text.strip().encode()
    except UnicodeDecodeError:
        return


def quote_position(text, quote):
    if not quote:
        return {"status": "quote_missing"}
    at = text.find(quote)
    method = "exact_original"
    end = at + len(quote)
    if at < 0:
        parts = re.split(r"\s+", quote.strip())
        match = re.search(r"\s+".join(re.escape(p) for p in parts), text) if parts else None
        if not match:
            return {"status": "quote_not_located"}
        at, end = match.span()
        method = "whitespace_only_layout_diagnostic_v1"
    return {"status": "quote_located", "matchMethod": method, "startCharacter": at, "endCharacter": end, "lineStart": text.count("\n", 0, at) + 1, "lineEnd": text.count("\n", 0, end) + 1, "pdfActualPageVerified": False}


def walk(value):
    stack = [("$", value)]
    while stack:
        location, item = stack.pop()
        if isinstance(item, dict):
            yield location, item
            stack.extend((location + "/" + str(k), v) for k, v in item.items() if isinstance(v, (dict, list)))
        elif isinstance(item, list):
            stack.extend((location + "/" + str(i), v) for i, v in enumerate(item) if isinstance(v, (dict, list)))


def content(value):
    return {k: value[k] for k in CONTENT_FIELDS if k in value}


def response_kind(raw, content_type):
    text = raw[:5000].decode(errors="replace").lower()
    if any(x in text for x in ["just a moment...", "verify you are human", "access denied", "enable javascript and cookies", "_incapsula_resource"]):
        return "access_shell_not_policy"
    if re.search(r"<meta\b[^>]*http-equiv=[\"']?refresh", text):
        return "client_redirect_not_policy"
    if not raw.strip():
        return "empty_body_not_policy"
    return "retrieved"


def analyze(root, output):
    implementation_bytes = Path(__file__).read_bytes()
    root = Path(root).resolve()
    inv.validate_inventory(root)
    output = Path(output)
    if output.exists():
        raise ValueError("New reconciliation directory required")
    output.mkdir(parents=True)
    rows = inv.load(root / "records.json")
    archive = inv.load(root / "archive.json")
    needed = {e.get("sourceSnapshotHash", e.get("snapshotHash")) for r in rows for e in inv.evidence_of(r["record"])} - {None}
    by_object = collections.defaultdict(list)
    for locator, a in archive.items():
        by_object[a["sha256"]].append(locator)
    hashes = collections.defaultdict(list)
    for h, locators in by_object.items():
        if not any(archive[loc]["suffix"] in TEXT for loc in locators):
            continue
        raw = inv.object_path(root, h).read_bytes()
        for kind, value in versions(raw):
            derived = inv.sha(value)
            if derived in needed:
                item = {"artifactId": h, "hashKind": kind, "computedSnapshotHash": derived}
                if item not in hashes[derived]:
                    hashes[derived].append(item)

    # Full JSON scan is recorded, including parse failures, rather than silently
    # dropping unknown schema versions. A citation alone cannot establish a fetch.
    metadata = collections.defaultdict(list)
    parse_failures = []
    parsed = 0
    for h, locators in by_object.items():
        if not any(archive[loc]["suffix"] == ".json" for loc in locators):
            continue
        try:
            value = inv.load(inv.object_path(root, h))
        except (ValueError, UnicodeDecodeError) as error:
            parse_failures.append({"artifactId": h, "locators": locators, "errorType": type(error).__name__})
            continue
        parsed += 1
        for pointer, item in walk(value):
            source = item.get("sourceUrl")
            declared = item.get("sourceSnapshotHash", item.get("snapshotHash", item.get("contentHash", item.get("publicSnapshotHash"))))
            if not isinstance(source, str) or not isinstance(declared, str) or declared not in needed:
                continue
            storage = {k: item[k] for k in ["normalizedTextStorageKey", "normalizedTextPath", "snapshotPath", "rawArtifactPaths"] if item.get(k)}
            metadata[(source, declared)].append({"artifactId": h, "jsonPointer": pointer, "artifactType": item.get("artifactType", "metadata_or_citation"), "storageReferences": storage, "fetchStatus": item.get("fetchStatus", item.get("outcome")), "httpStatus": item.get("httpStatus"), "finalUrl": item.get("finalUrl"), "retrievedAt": item.get("retrievedAt", item.get("fetchedAt"))})

    evidence = []
    record_results = []
    cache = {}
    for r in rows:
        links = []
        for index, e in enumerate(inv.evidence_of(r["record"])):
            declared = e.get("sourceSnapshotHash", e.get("snapshotHash"))
            url = e.get("sourceUrl")
            quote_field, quote = inv.original_quote(e)
            candidates = []
            for obj in hashes.get(declared, []):
                h = obj["artifactId"]
                if h not in cache:
                    cache[h] = inv.object_path(root, h).read_bytes().decode(errors="replace")
                position = quote_position(cache[h], quote)
                candidates.append({**obj, **position})
            located = [c for c in candidates if c["status"] == "quote_located"]
            exact = [c for c in located if c["hashKind"] == "raw_bytes" and c["matchMethod"] == "exact_original"]
            status = "raw_object_exact_quote" if exact else "derived_or_layout_binding" if located else "quote_missing" if candidates and not quote else "quote_not_located" if candidates else "source_object_unresolved"
            key = r["recordKey"] + ":evidence:" + str(index)
            links.append(key)
            refs = metadata.get((url, declared), [])
            evidence.append({"evidenceKey": key, "recordKey": r["recordKey"], "slug": r["slug"], "layer": r["layer"], "recordState": r["state"], "evidenceId": e.get("id", e.get("evidenceId")), "sourceUrl": url, "declaredSnapshotHash": declared, "quoteField": quote_field, "status": status, "candidates": candidates, "sourceVersionId": inv.digest({"url": url, "snapshotHash": declared}), "sourceMetadataRefCount": len(refs), "sourceProvenance": "metadata_present_not_semantic_verification" if refs else "not_independently_resolved", "semanticVeracity": "not_checked", "temporalValidity": "not_checked"})
        record_results.append({"recordKey": r["recordKey"], "slug": r["slug"], "state": r["state"], "evidenceKeys": links, "status": "evidence_objects_registered" if links else "no_embedded_evidence_registered", "semanticVeracity": "not_checked", "temporalValidity": "not_checked", "originalAxesUnchanged": True})
    # Two independent namespaces are compared without merging publication states.
    groups = collections.defaultdict(list)
    for r in rows:
        groups[(r["slug"], r["id"])].append(r)
    representations = []
    for (slug, identifier), group in groups.items():
        if len(group) < 2:
            continue
        variants = collections.defaultdict(list)
        for r in group:
            variants[inv.digest(content(r["record"]))].append(r["recordKey"])
        keys = set().union(*(content(r["record"]).keys() for r in group))
        differences = [k for k in sorted(keys) if len({inv.digest(r["record"].get(k)) for r in group}) > 1]
        representations.append({"slug": slug, "id": identifier, "recordKeys": [r["recordKey"] for r in group], "status": "same_content_multiple_representations" if len(variants) == 1 else "content_difference_requires_scope_review", "changedFields": differences, "variants": dict(variants), "autoMerged": False})

    identities = []
    identity_sources = [(loc, a) for loc, a in archive.items() if loc.endswith("/identity-crosswalk.json")]
    if identity_sources:
        identity = inv.load(inv.object_path(root, identity_sources[0][1]["sha256"]))
        summaries = {s["entity"]["slug"]: s for s in inv.load(root / "sources.json")}
        for section, items in identity.items():
            if not isinstance(items, list):
                continue
            for item in items:
                if not isinstance(item, dict):
                    continue
                alias = item.get("alias", item.get("aliasSlug"))
                canonical = item.get("canonicalSlug")
                identities.append({"section": section, "mapping": item, "aliasHasFrozenPublicEntity": alias in summaries, "canonicalHasFrozenPublicEntity": canonical in summaries, "status": "local_mapping_requires_identity_and_scope_review", "publicMergeApplied": False, "policyInheritanceApplied": False})

    sources = []
    for (url, h), refs in metadata.items():
        sources.append({"sourceId": inv.digest({"url": url, "snapshotHash": h}), "sourceUrl": url, "snapshotHash": h, "objectCandidates": hashes.get(h, []), "metadataRefs": refs})
    summary = {"schemaVersion": "uapt-evidence-reconciliation-v1", "generatedAt": inv.now(), "inventoryManifestSha256": inv.sha((root / "manifest.json").read_bytes()), "implementationSha256": inv.sha(implementation_bytes), "recordsCovered": len(record_results), "evidenceCovered": len(evidence), "bindingStates": dict(collections.Counter(e["status"] for e in evidence)), "historicalSupersededEvidence": sum(e["recordState"] == "superseded_baseline" for e in evidence), "derivedHashKinds": dict(collections.Counter(c["hashKind"] for e in evidence for c in e["candidates"])), "representationGroups": len(representations), "representationStates": dict(collections.Counter(r["status"] for r in representations)), "identityMappings": len(identities), "jsonObjectsScanned": parsed, "jsonParseFailures": len(parse_failures), "publicationApproved": False, "boundary": "Source-object, character-location and representation reconciliation; no new university policy verdicts or release approvals"}
    for name, value in [("summary.json", summary), ("record-coverage.json", record_results), ("evidence-reconciliation.json", evidence), ("source-version-index.json", sources), ("representation-relations.json", representations), ("identity-review.json", identities), ("json-scan-failures.json", parse_failures)]:
        inv.write(output / name, value)
    c = sqlite3.connect(output / "reconciliation.sqlite")
    c.execute("CREATE TABLE records(record_key TEXT PRIMARY KEY,slug TEXT,payload TEXT)")
    c.execute("CREATE TABLE evidence(evidence_key TEXT PRIMARY KEY,record_key TEXT,source_url TEXT,snapshot_hash TEXT,status TEXT,payload TEXT)")
    c.execute("CREATE INDEX source_version ON evidence(source_url,snapshot_hash)")
    c.executemany("INSERT INTO records VALUES(?,?,?)", [(r["recordKey"], r["slug"], json.dumps(r)) for r in record_results])
    c.executemany("INSERT INTO evidence VALUES(?,?,?,?,?,?)", [(e["evidenceKey"], e["recordKey"], e["sourceUrl"], e["declaredSnapshotHash"], e["status"], json.dumps(e)) for e in evidence])
    c.commit(); c.close()
    (output / "implementation.py").write_bytes(implementation_bytes)
    freeze(output, summary["inventoryManifestSha256"])
    print(json.dumps(summary))


def freeze(output, parent):
    output = Path(output)
    inv.write(output / "manifest.json", {"schemaVersion": "uapt-private-reconciliation-manifest-v1", "parentInventoryManifestSha256": parent, "private": True, "publicationApproved": False, "files": {str(p.relative_to(output)): inv.sha(p.read_bytes()) for p in output.rglob("*") if p.is_file() and p != output / "manifest.json"}})


def validate(root, review):
    root, review = Path(root).resolve(), Path(review).resolve()
    manifest = inv.load(review / "manifest.json")
    if manifest["parentInventoryManifestSha256"] != inv.sha((root / "manifest.json").read_bytes()):
        raise ValueError("Wrong parent inventory")
    for name, h in manifest["files"].items():
        if inv.sha(inv.safe_path(review, name).read_bytes()) != h:
            raise ValueError("Reconciliation artifact changed")
    records = inv.load(root / "records.json")
    coverage = inv.load(review / "record-coverage.json")
    if len(coverage) != len(records) or {r["recordKey"] for r in records} != {r["recordKey"] for r in coverage}:
        raise ValueError("Incomplete record reconciliation")
    actual = inv.load(review / "evidence-reconciliation.json")
    expected = {r["recordKey"] + ":evidence:" + str(i) for r in records for i, e in enumerate(inv.evidence_of(r["record"]))}
    if len(actual) != len(expected) or {e["evidenceKey"] for e in actual} != expected:
        raise ValueError("Incomplete evidence reconciliation")
    checked = set()
    record_map = {r["recordKey"]: r for r in records}
    for row in actual:
        evidence_index = int(row["evidenceKey"].rsplit(":evidence:",1)[1])
        original = inv.evidence_of(record_map[row["recordKey"]]["record"])[evidence_index]
        quote = inv.original_quote(original)[1]
        for candidate in row["candidates"]:
            raw = inv.object_path(root, candidate["artifactId"]).read_bytes()
            key = (candidate["artifactId"],candidate["hashKind"],row["declaredSnapshotHash"])
            if key not in checked:
                values = dict(versions(raw))
                if candidate["hashKind"] not in values or inv.sha(values[candidate["hashKind"]]) != row["declaredSnapshotHash"]:
                    raise ValueError("Derived hash not reproducible")
                checked.add(key)
            expected_position = quote_position(raw.decode(errors="replace"),quote)
            for field, value in expected_position.items():
                if candidate.get(field) != value:
                    raise ValueError("Quote location not reproducible")
    return True


def augment_bundle(root, review, base, output, snapshot_report=None):
    root,review,base,output = map(Path,[root,review,base,output])
    validate(root,review)
    original_manifest=inv.load(base/"manifest.json")
    report={"slug":original_manifest["slug"],"bundleManifestSha256":inv.sha((base/"manifest.json").read_bytes()),"status":"PARTIAL","results":[],"remainingRecordKeys":original_manifest["recordKeys"]}
    inv.validate_audit(base,report)
    if output.exists():raise ValueError("New augmented bundle required")
    shutil.copytree(base,output)
    keys=set(original_manifest["recordKeys"])
    evidence=[r for r in inv.load(review/"evidence-reconciliation.json") if r["recordKey"] in keys]
    inv.write(output/"evidence-reconciliation.json",evidence)
    coverage=[r for r in inv.load(review/"record-coverage.json") if r["recordKey"] in keys]
    registered={r["recordKey"] for r in coverage}
    for r in inv.load(base/"records.json"):
        if r["recordKey"] not in registered:
            coverage.append({"recordKey":r["recordKey"],"slug":r["slug"],"state":r["state"],"layer":r["layer"],"status":"saved_student_summary_version_basis_review_separate","evidenceKeys":[],"semanticVeracity":"not_checked","temporalValidity":"not_checked","originalAxesUnchanged":True})
    inv.write(output/"record-reconciliation.json",coverage)
    inv.write(output/"representation-relations.json",[r for r in inv.load(review/"representation-relations.json") if set(r["recordKeys"])&keys])
    source_ids={r["sourceVersionId"] for r in evidence}
    sources=[r for r in inv.load(review/"source-version-index.json") if r["sourceId"] in source_ids]
    inv.write(output/"source-version-index.json",sources)
    if snapshot_report:
        inv.write(output/"student-summary-basis-review.json",[r for r in inv.load(snapshot_report)["results"] if r["recordKey"] in keys])
    for h in {c["artifactId"] for r in evidence for c in r["candidates"]}:
        p=inv.object_path(output,h);p.parent.mkdir(parents=True,exist_ok=True)
        if not p.exists():shutil.copyfile(inv.object_path(root,h),p)
    manifest={**original_manifest,"reconciliationManifestSha256":inv.sha((review/"manifest.json").read_bytes()),"sourceObjectGaps":sum(e["status"]=="source_object_unresolved" for e in evidence),"metadataReferenceBoundary":"Metadata parents may remain in the inventory; their complete JSON bodies are not silently exported. Source character locations and copied raw object hashes can be checked inside this package.","files":{str(p.relative_to(output)):inv.sha(p.read_bytes()) for p in output.rglob("*") if p.is_file() and p!=output/"manifest.json"}}
    inv.write(output/"manifest.json",manifest)
    inv.validate_audit(output,{**report,"bundleManifestSha256":inv.sha((output/"manifest.json").read_bytes())})
    validate_bundle(output)
    print(json.dumps({"slug":manifest["slug"],"publicClaims":len(manifest["publicClaimIds"]),"recordKeys":len(keys),"evidenceReferences":len(evidence),"sourceObjectGaps":manifest["sourceObjectGaps"]}))


def validate_bundle(package):
    package=Path(package)
    manifest=inv.load(package/"manifest.json")
    inv.validate_audit(package,{"slug":manifest["slug"],"bundleManifestSha256":inv.sha((package/"manifest.json").read_bytes()),"status":"PARTIAL","results":[],"remainingRecordKeys":manifest["recordKeys"]})
    rows=inv.load(package/"records.json");record_map={r["recordKey"]:r for r in rows}
    if len(record_map)!=len(rows) or len(manifest["recordKeys"])!=len(set(manifest["recordKeys"])) or set(record_map)!=set(manifest["recordKeys"]):
        raise ValueError("Incomplete/duplicate bundle record set")
    coverage=inv.load(package/"record-reconciliation.json")
    if len(coverage)!=len(rows) or {r["recordKey"] for r in coverage}!=set(record_map):
        raise ValueError("Incomplete bundle record reconciliation")
    public_ids={c["id"] for s in inv.load(package/"public-records.json") for c in s["claims"]}
    if public_ids!=set(manifest["publicClaimIds"]) or public_ids!={r["id"] for r in rows if r["state"]=="published"}:
        raise ValueError("Incomplete bundle public claim coverage")
    evidence=inv.load(package/"evidence-reconciliation.json")
    expected={r["recordKey"]+":evidence:"+str(i) for r in rows for i,e in enumerate(inv.evidence_of(r["record"]))}
    if len(evidence)!=len(expected) or {r["evidenceKey"] for r in evidence}!=expected:
        raise ValueError("Incomplete bundle evidence coverage")
    for row in evidence:
        index=int(row["evidenceKey"].rsplit(":evidence:",1)[1]);original=inv.evidence_of(record_map[row["recordKey"]]["record"])[index];quote=inv.original_quote(original)[1]
        for candidate in row["candidates"]:
            raw=inv.object_path(package,candidate["artifactId"]).read_bytes();values=dict(versions(raw))
            if inv.sha(raw)!=candidate["artifactId"]:
                raise ValueError("Bundle raw object identity mismatch")
            if candidate["hashKind"] not in values or inv.sha(values[candidate["hashKind"]])!=row["declaredSnapshotHash"]:
                raise ValueError("Bundle derived hash not reproducible")
            for k,v in quote_position(raw.decode(errors="replace"),quote).items():
                if candidate.get(k)!=v:raise ValueError("Bundle quote location not reproducible")
    return True


def transport(url):
    if urllib.parse.urlsplit(url).scheme not in ["http", "https"]:
        raise ValueError("Unsupported source scheme")
    with tempfile.TemporaryDirectory() as d:
        body = Path(d) / "body"
        p = subprocess.run(["curl", "-sS", "--max-time", "25", "--max-filesize", "10485760", "--proto", "=http,https", "--output", str(body), "--write-out", "%{json}", url], capture_output=True)
        try:
            meta = json.loads(p.stdout)
        except ValueError:
            meta = {}
        fields = {k: meta.get(k) for k in ["http_code", "url_effective", "redirect_url", "content_type", "time_total", "ssl_verify_result"]}
        return {"url": url, "exitCode": p.returncode, **fields}, body.read_bytes() if body.exists() else b""


def fetch_collisions(root, output):
    """Bounded source-health investigation; no policy edits or rule verdicts."""
    root, output = Path(root).resolve(), Path(output)
    if output.exists():
        raise ValueError("New source-health output required")
    output.mkdir(parents=True)
    groups = inv.load(root / "source-hash-investigations.json")
    urls = sorted({s["sourceUrl"] for g in groups for s in g["sources"]})
    hosts = sorted({urllib.parse.urlsplit(u).scheme + "://" + urllib.parse.urlsplit(u).netloc for u in urls})
    robots = {}
    def store(raw):
        h = inv.sha(raw); p = inv.object_path(output, h)
        p.parent.mkdir(parents=True, exist_ok=True)
        if not p.exists(): p.write_bytes(raw)
        return h
    def robot(origin):
        meta, raw = transport(origin + "/robots.txt")
        return origin, meta, raw
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        robot_results = list(pool.map(robot, hosts))
    for origin, meta, raw in robot_results:
        h = store(raw)
        parser = urllib.robotparser.RobotFileParser()
        code = meta.get("http_code")
        allowed = meta["exitCode"] == 0 and code in [200, 404, 410]
        if code == 200: parser.parse(raw.decode(errors="replace").splitlines())
        robots[origin] = {"receipt": {**meta, "bodyArtifactId": h, "status": "rules_available" if allowed and code == 200 else "no_rules_file" if allowed else "unresolved_no_fetch"}, "parser": parser, "available": allowed, "noRules": code in [404, 410]}
    def request(url):
        chain = []
        current = url
        for step in range(6):
            parsed = urllib.parse.urlsplit(current);origin = parsed.scheme + "://" + parsed.netloc
            if origin not in robots:
                meta, raw = transport(origin + "/robots.txt")
                parser = urllib.robotparser.RobotFileParser();parser.parse(raw.decode(errors="replace").splitlines())
                code = meta.get("http_code")
                robots[origin] = {"receipt": {**meta, "bodyArtifactId": store(raw)}, "parser": parser, "available": meta["exitCode"] == 0 and code in [200,404,410], "noRules": code in [404,410]}
            policy = robots[origin]
            if not policy["available"]:
                return {"sourceUrl":url,"status":"robots_unresolved_no_fetch","chain":chain,"blockedUrl":current}
            if not policy["noRules"] and not policy["parser"].can_fetch("UniversityPolicyEvidenceAudit",current):
                return {"sourceUrl":url,"status":"robots_disallowed","chain":chain,"blockedUrl":current}
            meta, raw = transport(current)
            receipt = {**meta,"bodyArtifactId":store(raw),"fetchedAt":inv.now()};chain.append(receipt)
            code = meta.get("http_code",0)
            if meta["exitCode"]:
                return {"sourceUrl":url,"status":"retrieval_failed","chain":chain}
            if code in [301,302,303,307,308] and meta.get("redirect_url"):
                current = urllib.parse.urljoin(current,meta["redirect_url"]);continue
            status = "retrieved" if code == 200 else "http_error"
            if status == "retrieved":
                status = response_kind(raw,meta.get("content_type"))
            title = re.search(r"<title[^>]*>(.*?)</title>",raw.decode(errors="replace"),re.I|re.S)
            return {"sourceUrl":url,"finalUrl":current,"status":status,"title":re.sub(r"\s+"," ",title.group(1)).strip() if title else None,"chain":chain}
        return {"sourceUrl":url,"status":"redirect_limit","chain":chain}
    # Sequential groups keep investigation scope visible; each group's URLs may fetch concurrently.
    results = []; groups_out = []
    for group in groups:
        group_urls = list(dict.fromkeys(s["sourceUrl"] for s in group["sources"]))
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            receipts = list(pool.map(request,group_urls))
        results.extend(receipts)
        good = [r for r in receipts if r["status"] == "retrieved"]
        current_hashes = {r["chain"][-1]["bodyArtifactId"] for r in good}
        final_urls = {r["finalUrl"] for r in good}
        outcome = "unresolved_access_or_partial" if len(good)!=len(receipts) else "current_redirects_converge" if len(final_urls)==1 else "current_sources_distinct_raw_bodies" if len(current_hashes)>1 else "same_current_raw_body_requires_content_review"
        groups_out.append({**group,"status":"investigated", "outcome":outcome,"currentReceipts":receipts,"historicalSnapshotReproduced":False,"autoMerged":False,"semanticVerdictsChanged":False})
        inv.write(output/"progress.json",{"groupsInvestigated":len(groups_out),"totalGroups":len(groups)})
    inv.write(output/"robots-receipts.json",{origin:v["receipt"] for origin,v in robots.items()})
    inv.write(output/"url-receipts.json",results)
    inv.write(output/"collision-findings.json",groups_out)
    summary={"generatedAt":inv.now(),"groupsInvestigated":len(groups_out),"urlsAttempted":len(results),"outcomes":dict(collections.Counter(g["outcome"] for g in groups_out)),"sourceStatuses":dict(collections.Counter(r["status"] for r in results)),"scope":"source health and current URL relationship only; historical hash not inferred from current bytes","publicationApproved":False}
    inv.write(output/"summary.json",summary)
    freeze(output,inv.sha((root/"manifest.json").read_bytes()))
    print(json.dumps(summary))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest="command", required=True)
    a = sub.add_parser("analyze"); a.add_argument("inventory"); a.add_argument("--output", required=True)
    v = sub.add_parser("validate"); v.add_argument("inventory"); v.add_argument("reconciliation")
    f = sub.add_parser("fetch-collisions"); f.add_argument("inventory"); f.add_argument("--output", required=True)
    b=sub.add_parser("augment-bundle");b.add_argument("inventory");b.add_argument("reconciliation");b.add_argument("base");b.add_argument("--output",required=True);b.add_argument("--snapshot-report")
    q=sub.add_parser("validate-bundle");q.add_argument("package")
    args = p.parse_args()
    if args.command == "analyze":
        analyze(args.inventory, args.output)
    elif args.command == "fetch-collisions":
        fetch_collisions(args.inventory,args.output)
    elif args.command == "augment-bundle":
        augment_bundle(args.inventory,args.reconciliation,args.base,args.output,args.snapshot_report)
    elif args.command == "validate-bundle":
        validate_bundle(args.package);print("Portable bundle object/hash/character-location coverage verified; policy review remains separate")
    else:
        validate(args.inventory, args.reconciliation); print("Reconciliation coverage and derived hashes verified")


if __name__ == "__main__":
    main()
