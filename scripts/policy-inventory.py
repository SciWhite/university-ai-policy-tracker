#!/usr/bin/env python3
"""Private, offline evidence inventory. No promotion, crawl, build or deployment."""
import argparse
import collections
import concurrent.futures
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import subprocess
import tempfile

VERSION = "uapt-evidence-inventory-v1"
AXES = ["evidence_binding", "semantic_veracity", "temporal_validity", "display_eligible", "release_approved"]
SKIP = {".git", ".next", "node_modules", "secrets", "browser-profiles", "dev-cache-before-restart", "__pycache__", "policy-inventory"}
EXTENSIONS = {".json", ".md", ".txt", ".html", ".pdf", ".csv", ".png"}
SENSITIVE = re.compile(r"(^\.env|credential|service-account|oauth|token|cookie|session|browser-profile)", re.I)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def digest(value):
    return sha(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode())


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def load(path):
    return json.loads(Path(path).read_text())


def write(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def artifacts(value):
    if isinstance(value, list):
        return [x for x in value if isinstance(x, dict)]
    if isinstance(value, dict):
        return value.get("artifacts", [value])
    return []


def safe_path(root, relative):
    if Path(relative).is_absolute():
        raise ValueError("Absolute package path")
    path = (Path(root) / relative).resolve()
    path.relative_to(Path(root).resolve())
    return path


def object_path(root, hash_value):
    if not re.fullmatch(r"[0-9a-f]{64}", hash_value):
        raise ValueError("Invalid object hash")
    return Path(root) / "objects" / hash_value[:2] / hash_value


def normalize_locator(value, roots):
    if isinstance(value, str):
        for key, path in sorted(roots.items(), key=lambda x: -len(str(x[1]))):
            value = value.replace(str(path), "workspace://" + key)
        return value
    if isinstance(value, list):
        return [normalize_locator(x, roots) for x in value]
    if isinstance(value, dict):
        return {normalize_locator(k, roots): normalize_locator(v, roots) for k, v in value.items()}
    return value


def axes(record, published=False, held=False):
    # Historical metadata is retained, never converted to a new semantic pass.
    result = {x: {"status": "not_checked_in_this_run"} for x in AXES}
    result["release_approved"] = {"status": "published_record_pin" if published else "not_approved_by_inventory"}
    if held:
        result["display_eligible"] = {"status": "held"}
    return result


def evidence_of(record):
    return record.get("evidence", record.get("evidences", []))


def original_quote(evidence):
    # Legacy public contracts use evidenceSnippet; never use translated/display text.
    for field in ["evidenceSnippetOriginal", "quote", "snippetOriginal", "evidenceSnippet"]:
        if evidence.get(field):
            return field, evidence[field]
    return None, None


def public_get(slug):
    url = "https://eduaipolicy.org/api/public/v1/universities/" + slug + ".json"
    p = subprocess.run(["curl", "-fLsS", "--max-time", "30", url], capture_output=True)
    if p.returncode:
        return {"slug": slug, "url": url, "status": "retrieval_failed", "exitCode": p.returncode}
    try:
        value = json.loads(p.stdout)
        data = value.get("data", value)
        if data.get("entity", {}).get("slug", data.get("entitySlug")) != slug:
            raise ValueError("Wrong entity")
        return {"slug": slug, "url": url, "status": "retrieved", "retrievedAt": now(), "responseSha256": sha(p.stdout), "data": data, "rawResponse": p.stdout}
    except (ValueError, KeyError):
        return {"slug": slug, "url": url, "status": "invalid_response"}


def build(config_path, output, readback=False):
    implementation_bytes = Path(__file__).read_bytes()
    config = load(config_path)
    roots = {k: Path(v).resolve() for k, v in config["workspaces"].items()}
    output = Path(output).resolve()
    for root in roots.values():
        if not root.is_dir():
            raise ValueError("Missing workspace " + str(root))
    baseline = roots["scene"] / config["baseline"]
    if output.exists() or output == baseline or baseline in output.parents:
        raise ValueError("Output must be new and outside baseline")
    output.parent.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp(prefix=".inventory-building-", dir=output.parent))
    try:
        archive = {}

        def capture(key, file):
            file = Path(file)
            if file.is_symlink():
                return None
            relative = file.relative_to(roots[key]).as_posix()
            if any(x in SKIP for x in file.parts) or SENSITIVE.search(file.name):
                return None
            locator = "workspace://" + key + "/" + relative
            if locator in archive:
                return archive[locator]["sha256"]
            content = file.read_bytes()
            h = sha(content)
            p = object_path(tmp, h)
            if not p.exists():
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_bytes(content)
            archive[locator] = {"artifactId": h, "sha256": h, "bytes": len(content), "suffix": file.suffix, "hashKind": "raw_bytes", "object": str(p.relative_to(tmp))}
            return h

        def frozen(key, file):
            h = capture(key, file)
            if h is None:
                raise ValueError("Excluded structured input")
            return load(object_path(tmp, h))

        # Preserve the exact historical output set; changed inputs are separate versions.
        parent = load(baseline / "final-index.json")
        for name, entry in parent["files"].items():
            path = safe_path(baseline, name)
            if sha(path.read_bytes()) != entry["sha256"]:
                raise ValueError("Baseline output mismatch: " + name)
            capture("scene", path)
        parent_sha = capture("scene", baseline / "final-index.json")
        old_pins = load(baseline / "input-hashes.json")
        drift = []
        for path, expected in old_pins.items():
            p = Path(path)
            key = next((k for k, r in roots.items() if p.is_relative_to(r)), None)
            if not p.exists():
                drift.append({"locator": normalize_locator(path, roots), "status": "missing", "expectedSha256": expected})
            elif key:
                actual = capture(key, p)
                if actual != expected:
                    drift.append({"locator": normalize_locator(path, roots), "status": "changed", "expectedSha256": expected, "actualSha256": actual})
            else:
                drift.append({"locator": path, "status": "unmapped_workspace", "expectedSha256": expected})

        # Register all material files across configured workspaces; compiled output and
        # credentials are excluded. Physical copies share storage, not source identity.
        for key, root in roots.items():
            for relative in config["materialRoots"].get(key, []):
                folder = safe_path(root, relative)
                if not folder.exists():
                    continue
                for path, dirs, files in os.walk(folder, followlinks=False):
                    dirs[:] = sorted(d for d in dirs if d not in SKIP and not (Path(path) / d).is_symlink())
                    for name in sorted(files):
                        p = Path(path) / name
                        if p.suffix.lower() in EXTENSIONS:
                            capture(key, p)

        records = {}
        events = []

        def add(key, slug, layer, value, origin, state="candidate", extra=None):
            if key in records and digest(records[key]["record"]) != digest(value):
                events.append({"operation": "conflict", "recordKey": key, "existingHash": digest(records[key]["record"]), "incomingHash": digest(value)})
                key += ":variant:" + digest(value)[:16]
            normalized = normalize_locator(value, roots)
            record = {"recordKey": key, "slug": slug, "layer": layer, "id": value.get("id", value.get("claimId")), "record": normalized, "inputRecordSha256": digest(value), "recordSha256": digest(normalized), "origin": normalize_locator(origin, roots), "state": state, "axes": axes(value, state == "published", state == "held")}
            if extra:
                record.update(normalize_locator(extra, roots))
            records[key] = record
            return record

        old_records = frozen("scene", baseline / "final-records.json")
        for r in old_records:
            held = r.get("group") == "heldFacts" or r.get("reviewState") == "held"
            add(r["recordKey"], r["slug"], r["layer"], r["record"], r.get("origin", "baseline:final-records.json"), "held" if held else "historical_baseline", {"historicalMetadata": {k: v for k, v in r.items() if k != "record"}})

        summaries = {s["entity"]["slug"]: s for s in frozen("scene", baseline / "inputs/public.json")}
        repairs = roots["repair"] / "data/public-record-repairs"
        journal = frozen("repair", repairs / "change-log.json")
        for pin_name in ["current.json", "imperial-current.json"]:
            pin = frozen("repair", repairs / pin_name)
            revision = pin.get("revision", pin.get("revisionId"))
            # current.json for MIT may encode the path rather than a generic revision.
            if not revision:
                revision = "mit-20261010" if pin_name == "current.json" else None
            current = frozen("repair", repairs / revision / "record.json")
            slug = current["entity"]["slug"]
            rawhash = capture("repair", repairs / revision / "record.json")
            if pin.get("publicationApproved") is not True or pin.get("recordSha256") != rawhash:
                raise ValueError("Invalid published repair pin")
            entries = [e for e in journal["entries"] if e.get("revision") == revision]
            if not entries or entries[0].get("recordSha256") != rawhash:
                raise ValueError("Repair missing changes binding")
            summaries[slug] = current
            prior = {r["id"]: r for r in records.values() if r["slug"] == slug and r["layer"] == "basic"}
            for r in records.values():
                if r["slug"] == slug and r["layer"] == "basic":
                    r["state"] = "superseded_baseline"
                    events.append({"operation": "supersede", "recordKey": r["recordKey"], "reason": "Published repair pin replaces historical basic representation", "replacementRevision": revision})
                if r["slug"] == slug and r["layer"] in ["tools", "specialist_tools"]:
                    r["reconciliation"] = "requires_comparison_to_published_repair"
            for c in current["claims"]:
                old = prior.get(c["id"])
                item = add("published:" + revision + ":" + c["id"], slug, "basic", c, str(repairs / revision / "record.json"), "published", {"publishedRevision": revision, "recordObject": rawhash})
                if c.get("reviewState") == "needs_review":
                    item["axes"]["display_eligible"] = {"status": "review_hold_retained"}
                events.append({"operation": "add" if old is None else "revise" if digest(old["record"]) != digest(c) else "publication_update", "recordKey": item["recordKey"], "previousRecordKey": old["recordKey"] if old else None})

        # Private revised claim candidates stay separate from the published repair.
        approved = roots["approved"]
        bindings = frozen("approved", approved / ".local/combined-bing-openclaw-20261008/openclaw-bindings.json")
        candidate_claim_ids = set()
        for entry in bindings["entries"]:
            folder = safe_path(approved, entry["path"])
            for file in sorted(folder.rglob("*.json")):
                values = artifacts(frozen("approved", file))
                proofs = {a.get("evidenceId"): a for a in values if a.get("artifactType") == "evidence_candidate"}
                for a in values:
                    if a.get("artifactType") == "claim_candidate":
                        slug = a["entitySlug"]
                        candidate_claim_ids.add((slug, a["claimId"]))
                        enriched = {**a, "evidence": [proofs[i] for i in a.get("evidenceIds", []) if i in proofs]}
                        item = add("candidate-claim:" + a["runId"] + ":" + a["claimId"], slug, "candidate_claim", enriched, str(file), extra={"package": entry["item"], "unresolvedEvidenceIds": [i for i in a.get("evidenceIds", []) if i not in proofs]})
                        events.append({"operation": "add", "recordKey": item["recordKey"], "layer": "candidate_claim", "reason": "Registered private reviewed candidate; not promoted"})

        scene = roots["scene"]
        for file in [scene / "apps/web/lib/enforcement-v4-refresh-data.json", approved / "apps/web/lib/enforcement-v4-refresh-data.json"]:
            if not file.exists():
                continue
            workspace = "scene" if file.is_relative_to(scene) else "approved"
            for slug, facts in frozen(workspace, file).items():
                for fact in facts:
                    previous = [r for r in records.values() if r["slug"] == slug and r["layer"] == "enforcement" and r["id"] == fact["id"]]
                    item = add("display:" + workspace + ":" + slug + ":" + fact["id"], slug, "supplementary_display", fact, str(file), extra={"publication": "not_inferred_from_display", "historicalFactRefs": [r["recordKey"] for r in previous]})
                    same = any(r["recordSha256"] == item["recordSha256"] for r in previous)
                    events.append({"operation": "duplicate_representation" if same else "display_update" if previous else "add", "recordKey": item["recordKey"], "previousRecordKeys": [r["recordKey"] for r in previous], "reason": "Saved display namespace, publication not inferred"})

        # All saved batches and their review/freeze metadata are discoverable even
        # when schemas differ; opaque schemas are explicitly counted, not silently omitted.
        batch_register = []
        for folder in sorted((scene / ".local").glob("bing-v5-*execution-*")):
            candidates = [p for p in folder.glob("*.json") if any(x in p.name for x in ["manifest", "index", "review", "acceptance", "summary-counts"])]
            batch_register.append({"batch": folder.name, "artifacts": [{"locator": "workspace://scene/" + str(p.relative_to(scene)), "artifactId": capture("scene", p)} for p in sorted(candidates)], "publicationApprovalInferred": False})

        readbacks = []
        if readback:
            slugs = sorted({s for s, _ in candidate_claim_ids} | {"massachusetts-institute-of-technology", "imperial-college-london"})
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
                readbacks = list(pool.map(public_get, slugs))
            for b in readbacks:
                raw = b.pop("rawResponse", None)
                if raw is not None:
                    h = sha(raw)
                    p = object_path(tmp, h)
                    p.parent.mkdir(parents=True, exist_ok=True)
                    if not p.exists():
                        p.write_bytes(raw)
                    archive[b["url"]] = {"artifactId": h, "sha256": h, "bytes": len(raw), "suffix": ".json", "hashKind": "raw_bytes", "object": str(p.relative_to(tmp))}
                    b["responseArtifactId"] = h
                if b["status"] != "retrieved":
                    continue
                current = {c["id"]: c for c in b["data"]["claims"]}
                b["candidateComparison"] = []
                for r in records.values():
                    if r["slug"] == b["slug"] and r["layer"] == "candidate_claim":
                        c = current.get(r["id"])
                        status = "id_not_present" if c is None else "same_claim_text" if c.get("claimText") == r["record"].get("claimText") else "different_claim_text"
                        b["candidateComparison"].append({"recordKey": r["recordKey"], "status": status})
                        r["publicReadback"] = status
                if b["slug"] in ["massachusetts-institute-of-technology", "imperial-college-london"]:
                    expected = summaries[b["slug"]]
                    b["claimsMatchPublishedPin"] = digest(b["data"]["claims"]) == digest(expected["claims"])
                    if not b["claimsMatchPublishedPin"]:
                        raise ValueError("Live correction does not match pinned claims")

        hash_sources = collections.defaultdict(list)
        for slug, summary in summaries.items():
            for s in summary["officialSources"]:
                hash_sources[s["snapshotHash"]].append({"slug": slug, "sourceUrl": s["sourceUrl"], "finalUrl": s.get("finalUrl"), "retrievedAt": s.get("retrievedAt")})
        collisions = [{"snapshotHash": h, "status": "needs_investigation", "sources": sources} for h, sources in sorted(hash_sources.items()) if len({s["sourceUrl"] for s in sources}) > 1]

        registry_path = safe_path(roots["primary"], config.get("requirementsRegistry", "docs/policy-audit-requirements-v1.json"))
        registry = frozen("primary", registry_path)
        if not registry.get("version") or len(registry["requirements"]) != len({r["id"] for r in registry["requirements"]}):
            raise ValueError("Invalid requirements registry version or IDs")
        schools = normalize_locator(frozen("scene", baseline / "schools.json"), roots)
        school_slugs = {s["slug"] for s in schools} | {r["slug"] for r in records.values()}
        requirement_coverage = [{"slug": slug, "requirementsVersion": registry["version"], "items": [{"requirementId": r["id"], "status": "not_checked_in_this_run"} for r in registry["requirements"]]} for slug in sorted(school_slugs)]
        text_objects = collections.defaultdict(list)
        for locator, a in archive.items():
            if a["suffix"] in [".txt", ".md", ".html"]:
                text_objects[a["sha256"]].append(locator)
        bindings_report = []
        for r in records.values():
            if r["state"] == "superseded_baseline":
                continue
            for e in evidence_of(r["record"]):
                h = e.get("sourceSnapshotHash", e.get("snapshotHash"))
                field, quote = original_quote(e)
                binding = {"recordKey": r["recordKey"], "slug": r["slug"], "evidenceId": e.get("id", e.get("evidenceId")), "sourceUrl": e.get("sourceUrl"), "snapshotHash": h, "quoteField": field, "status": "source_object_not_resolved"}
                if h in text_objects:
                    content = object_path(tmp, h).read_text(errors="replace")
                    binding["status"] = "quote_missing" if not quote else "quote_in_exact_hash_object" if quote in content else "quote_not_in_exact_hash_object"
                    binding["artifactId"] = h
                bindings_report.append(binding)
        gaps = {}
        for binding in bindings_report:
            if binding["status"] == "quote_in_exact_hash_object":
                continue
            key = digest({k: binding.get(k) for k in ["sourceUrl", "snapshotHash", "status"]})
            item = gaps.setdefault(key, {"gapId": key, "sourceUrl": binding["sourceUrl"], "snapshotHash": binding["snapshotHash"], "reason": binding["status"], "recordKeys": [], "slugs": [], "action": "Resolve saved original/version/hash kind before targeted retrieval; semantic review remains separate"})
            item["recordKeys"].append(binding["recordKey"])
            item["slugs"].append(binding["slug"])
        for gap in gaps.values():
            gap["recordKeys"] = sorted(set(gap["recordKeys"]))
            gap["slugs"] = sorted(set(gap["slugs"]))
        summary = {"schemaVersion": VERSION, "generatedAt": now(), "parentIndexSha256": parent_sha, "implementationSha256": sha(implementation_bytes), "requirementsVersion": registry["version"], "publicationApproved": False, "productionLoaderConnected": False, "records": len(records), "recordLayers": dict(collections.Counter(r["layer"] for r in records.values())), "universitiesWithRecords": len({r["slug"] for r in records.values()}), "declaredSchoolKeys": len(school_slugs), "archivedFileReferences": len(archive), "uniqueObjects": len({a["sha256"] for a in archive.values()}), "baselineInputs": len(old_pins), "inputDrift": len(drift), "batches": len(batch_register), "candidateClaims": len(candidate_claim_ids), "sourceGapGroups": len(gaps), "sourceHashInvestigations": len(collisions), "evidenceBindings": dict(collections.Counter(x["status"] for x in bindings_report)), "coverageBoundary": "Material registration and deterministic checks only; new semantic and temporal review not performed."}
        for name, value in [("records.json", list(records.values())), ("schools.json", schools), ("sources.json", list(summaries.values())), ("archive.json", archive), ("delta.json", events), ("input-drift.json", drift), ("batches.json", batch_register), ("public-readback.json", readbacks), ("source-hash-investigations.json", collisions), ("evidence-bindings.json", bindings_report), ("source-gap-queue.json", list(gaps.values())), ("requirements.json", registry), ("requirements-coverage.json", requirement_coverage), ("summary.json", summary)]:
            write(tmp / name, value)
        c = sqlite3.connect(tmp / "inventory.sqlite")
        c.execute("CREATE TABLE records(record_key TEXT PRIMARY KEY, slug TEXT, layer TEXT, state TEXT, payload TEXT)")
        c.execute("CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT)")
        c.executemany("INSERT INTO records VALUES(?,?,?,?,?)", [(r["recordKey"], r["slug"], r["layer"], r["state"], json.dumps(r, ensure_ascii=False)) for r in records.values()])
        c.executemany("INSERT INTO metadata VALUES(?,?)", [("generatedAt", summary["generatedAt"]), ("parentIndexSha256", parent_sha), ("requirementsVersion", registry["version"])])
        c.commit()
        c.close()
        readme = "# 统一证据库存\n\n" + "本快照为私有材料登记与确定性对账，不是新政策审核或发布批准。\n\n" + "```json\n" + json.dumps(summary, ensure_ascii=False, indent=2) + "\n```\n\n" + "查看 delta.json、input-drift.json、batches.json、source-hash-investigations.json、evidence-bindings.json 与 requirements-coverage.json。未解析证据不得计为核查通过。来源对象以 archive.json 定位；同字节只复用存储，来源关系保留。\n"
        (tmp / "README.md").write_text(readme)
        (tmp / "implementation.py").write_bytes(implementation_bytes)
        manifest = {"schemaVersion": VERSION, "generatedAt": summary["generatedAt"], "parentIndexSha256": parent_sha, "private": True, "publicationApproved": False, "files": {p.name: sha(p.read_bytes()) for p in tmp.iterdir() if p.is_file()}}
        write(tmp / "manifest.json", manifest)
        validate_inventory(tmp)
        os.replace(tmp, output)
        print(json.dumps(summary, ensure_ascii=False))
    except BaseException:
        shutil.rmtree(tmp, ignore_errors=True)
        raise


def validate_inventory(root):
    root = Path(root).resolve()
    manifest = load(root / "manifest.json")
    for name, h in manifest["files"].items():
        if sha(safe_path(root, name).read_bytes()) != h:
            raise ValueError("Inventory file mismatch: " + name)
    checked = set()
    for a in load(root / "archive.json").values():
        p = safe_path(root, a["object"])
        if a["sha256"] not in checked and sha(p.read_bytes()) != a["sha256"]:
            raise ValueError("Archive object mismatch")
        if p != object_path(root, a["sha256"]):
            raise ValueError("Noncanonical archive object path")
        checked.add(a["sha256"])
    rows = load(root / "records.json")
    if len(rows) != len({r["recordKey"] for r in rows}):
        raise ValueError("Duplicate record keys")
    for r in rows:
        if "inputRecordSha256" in r and digest(r["record"]) != r["recordSha256"]:
            raise ValueError("Normalized record hash mismatch")
    for slug in ["massachusetts-institute-of-technology", "imperial-college-london"]:
        # Read expected counts from frozen published records, not constants.
        sources = next(s for s in load(root / "sources.json") if s["entity"]["slug"] == slug)
        actual = [r for r in rows if r["slug"] == slug and r["layer"] == "basic" and r["state"] == "published"]
        if {c["id"] for c in sources["claims"]} != {r["id"] for r in actual}:
            raise ValueError("Incomplete published repair claims")
    return manifest


def bundle(root, slug, output):
    root = Path(root).resolve()
    validate_inventory(root)
    output = Path(output).resolve()
    if output.exists() or not re.fullmatch(r"[a-z0-9-]+", slug):
        raise ValueError("Invalid or existing bundle output")
    rows = [r for r in load(root / "records.json") if r["slug"] == slug]
    if not rows:
        raise ValueError("Unknown school")
    archive = load(root / "archive.json")
    # Explicit audit objects for each saved student-summary version. Never choose
    # a winner from workspace name, overallStatus, mtime or file presence.
    snapshots = {}
    for locator, a in archive.items():
        if locator.endswith("/data/policy-snapshots/v1/universities/" + slug + ".json"):
            h = a["sha256"]
            if h not in snapshots:
                value = load(object_path(root, h))
                held = value.get("overallStatus") == "needs_review" or value.get("review", {}).get("reviewState") in ["needs_review", "pending"]
                snapshots[h] = {"recordKey": "student_snapshot:" + slug + ":" + h, "slug": slug, "layer": "student_snapshot", "id": slug + ":" + h, "record": value, "recordSha256": digest(value), "recordObject": h, "origin": [], "state": "held" if held else "saved_version_unreconciled", "axes": axes(value, held=held)}
            snapshots[h]["origin"].append(locator)
    rows.extend(snapshots.values())
    output.mkdir(parents=True)
    # Portable package contains selected records and source objects, never env/logs.
    write(output / "records.json", rows)
    summaries = [s for s in load(root / "sources.json") if s["entity"]["slug"] == slug]
    write(output / "public-records.json", summaries)
    write(output / "requirements.json", load(root / "requirements.json"))
    write(output / "coverage.json", [r for r in load(root / "requirements-coverage.json") if r["slug"] == slug])
    bindings = [r for r in load(root / "evidence-bindings.json") if any(x["recordKey"] == r["recordKey"] for x in rows)]
    write(output / "evidence-bindings.json", bindings)
    write(output / "source-gap-queue.json", [{**g, "recordKeys": [k for k in g["recordKeys"] if k in {r["recordKey"] for r in rows}]} for g in load(root / "source-gap-queue.json") if slug in g["slugs"]])
    objects = {r["artifactId"] for r in bindings if r.get("artifactId")} | {r["recordObject"] for r in rows if r.get("recordObject")}
    # Include exact input record/provenance objects whose logical paths identify this school.
    selected_archive = {}
    for locator, a in archive.items():
        if slug in locator and a["suffix"] in [".json", ".txt", ".md", ".html", ".pdf"]:
            objects.add(a["sha256"])
    selected_archive = {locator: a for locator, a in archive.items() if a["sha256"] in objects}
    write(output / "archive.json", selected_archive)
    (output / "README.md").write_text("# 单校独立审计包\n\n这是私有资料包。public-records.json 是冻结公开依据；records.json 分开保留历史、工具、展示、候选和学生摘要版本。manifest.json 列出全部公开 Claim ID 与审计对象键。sourceObjectGaps 不等于没有政策。必须独立联网核实当前官网；字节和覆盖校验不会自动批准政策、摘要或发布。\n")
    for h in objects:
        p = object_path(output, h)
        p.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(object_path(root, h), p)
    public_ids = sorted({c["id"] for s in summaries for c in s["claims"]})
    manifest = {"schemaVersion": "uapt-university-audit-bundle-v1", "slug": slug, "inventoryManifestSha256": sha((root / "manifest.json").read_bytes()), "publicClaimIds": public_ids, "recordKeys": sorted(r["recordKey"] for r in rows), "private": True, "publicationApproved": False, "files": {str(p.relative_to(output)): sha(p.read_bytes()) for p in output.rglob("*") if p.is_file()}, "sourceObjectGaps": sum(x["status"] == "source_object_not_resolved" for x in bindings)}
    write(output / "manifest.json", manifest)
    print(json.dumps({"slug": slug, "records": len(rows), "publicClaims": len(public_ids), "objects": len(objects), "unresolvedSourceBindings": manifest["sourceObjectGaps"]}))


def validate_audit(package, report):
    package = Path(package)
    manifest = load(package / "manifest.json")
    for name, h in manifest["files"].items():
        if sha(safe_path(package, name).read_bytes()) != h:
            raise ValueError("Audit package changed")
    if report.get("bundleManifestSha256") != sha((package / "manifest.json").read_bytes()) or report.get("slug") != manifest["slug"]:
        raise ValueError("Wrong audit basis")
    results = report.get("results", [])
    if report.get("status") not in ["PARTIAL", "COMPLETED"]:
        raise ValueError("Invalid audit completion state")
    keys = [r["recordKey"] for r in results]
    remaining = report.get("remainingRecordKeys", [])
    if len(remaining) != len(set(remaining)) or len(keys) != len(set(keys)) or set(keys) | set(remaining) != set(manifest["recordKeys"]):
        raise ValueError("Incomplete/duplicate audit coverage")
    if set(keys) & set(report.get("remainingRecordKeys", [])):
        raise ValueError("Reviewed and remaining overlap")
    states = {"VERIFIED", "OVERSTATED", "UNDERSTATED", "STALE", "CONTRADICTED", "BROKEN_SOURCE", "UNVERIFIED"}
    for r in results:
        if r.get("status") not in states or r.get("severity") not in [None, "P0", "P1", "P2"]:
            raise ValueError("Invalid audit classification")
        if r["status"] == "VERIFIED" and (not r.get("officialEvidence") or not r.get("scope") or not r.get("temporalBasis")):
            raise ValueError("Verified without semantic/current evidence")
    if report.get("status") == "COMPLETED" and (report.get("remainingRecordKeys") or report.get("independentWebVerification") is not True):
        raise ValueError("Cannot complete partial/non-web audit")
    return True


def sync_gate_v2(event, root, phase):
    """Machine-readable coverage and freshness checks; no semantic policy approval."""
    from datetime import datetime, timezone
    required_checks = {
        "public_data": ["schemaValidated", "privateFieldsExcluded", "recordCountsValidated", "claimFingerprintsValidated"],
        "changes": ["universityChanges", "history", "latestDiff", "changesIndex", "recentChanges", "rss"],
        "mcp": ["remainingClaimIdsEmpty", "publishedOnly", "scopePreserved"],
        "student_snapshot": ["basisFingerprintsValidated", "heldReviewsPreserved"],
        "runtime_content": ["contentHashMatched", "dataCompatibilityValidated", "affectedRoutesReadBack"],
        "pages": ["affectedLocalesReadBack", "unchangedControlsReadBack"],
        "search_coverage": ["universityMappingValidated", "rankingMappingValidated", "affectedSearchReadBack"],
        "sitemap": ["affectedUrlsValidated", "indexabilityValidated"],
        "candidate_readback": ["affectedRoutesReadBack", "artifactIdentityMatched"],
        "public_readback": ["affectedRoutesReadBack", "artifactIdentityMatched"],
        "notifications": ["requestRecorded", "responsesRecorded", "indexingNotAssumed"],
    }
    def fresh(value):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            age = (datetime.now(timezone.utc) - parsed).total_seconds()
        except (ValueError, TypeError, AttributeError):
            raise ValueError("Missing valid timezone-aware synchronization timestamp")
        if not -300 <= age <= 72 * 3600: raise ValueError("Synchronization evidence is stale or future-dated")
    fresh(event.get("generatedAt"))
    scope_proof = event.get("scopeArtifact", {})
    if scope_proof.get("basisSha256") != event["basisSha256"] or not scope_proof.get("path"):
        raise ValueError("Missing bound synchronization scope artifact")
    scope_path = safe_path(root, scope_proof["path"])
    if sha(scope_path.read_bytes()) != scope_proof.get("sha256"): raise ValueError("Synchronization scope changed")
    scope = load(scope_path)
    if scope.get("schemaVersion") != "uapt-policy-sync-scope-v1" or not scope.get("universities"):
        raise ValueError("Missing complete affected university scope")
    expected = {}
    for item in scope["universities"]:
        slug = item.get("slug"); ids = item.get("publicClaimIds", [])
        if not slug or slug in expected or not ids or len(ids) != len(set(ids)):
            raise ValueError("Invalid/duplicate synchronization university or Claim ID scope")
        expected[slug] = sorted(ids)
    surfaces = event["surfaces"]
    data_hash = None
    def typed_receipt(name):
        receipts = [load(safe_path(root, p["path"])) for p in surfaces.get(name, {}).get("evidence", []) if p["path"].endswith(".json")]
        found = [r for r in receipts if isinstance(r, dict) and r.get("schemaVersion") == "uapt-policy-surface-receipt-v1" and r.get("surface") == name and r.get("basisSha256") == event["basisSha256"]]
        if len(found) != 1: raise ValueError("Require exactly one typed synchronization receipt: " + name)
        return found[0]
    if surfaces.get("public_data", {}).get("status") == "updated":
        data_receipt = typed_receipt("public_data")
        data_proof = data_receipt.get("dataArtifact", {})
        if not data_proof.get("path"): raise ValueError("Missing frozen public data artifact")
        data_path = safe_path(root, data_proof["path"]); data_hash = sha(data_path.read_bytes())
        if data_hash != data_proof.get("sha256"): raise ValueError("Public data artifact changed")
        summaries = load(data_path)
        if not isinstance(summaries, list): raise ValueError("Public data artifact must contain affected public summaries")
        actual = {}
        for summary in summaries:
            slug = summary.get("entitySlug") or summary.get("entity", {}).get("slug")
            ids = [c["id"] for c in summary.get("claims", [])]
            if slug in actual or len(ids) != len(set(ids)): raise ValueError("Duplicate public data scope/Claim ID")
            actual[slug] = sorted(ids)
        if actual != expected: raise ValueError("Frozen public data does not cover full declared Claim ID scope")
    if event["eventType"] == "policy_release":
        for name in ["public_data", "changes", "mcp", "pages", "runtime_content"]:
            if surfaces[name]["status"] != "updated": raise ValueError("Policy release requires checked surface: " + name)
    for name, checks in required_checks.items():
        surface = surfaces.get(name, {})
        if surface.get("status") != "updated": continue
        receipt = typed_receipt(name); fresh(receipt.get("checkedAt"))
        if any(receipt.get("checks", {}).get(check) is not True for check in checks):
            raise ValueError("Incomplete synchronization checks: " + name)
        checked_slugs = receipt.get("checkedSlugs", [])
        if len(checked_slugs) != len(set(checked_slugs)) or set(checked_slugs) != set(expected):
            raise ValueError("Incomplete university coverage: " + name)
        if name in ["public_data", "mcp"]:
            observed = receipt.get("observedClaimIdsBySlug", {})
            if set(observed) != set(expected) or any(not isinstance(ids, list) or len(ids) != len(set(ids)) or sorted(ids) != expected[s] for s, ids in observed.items()):
                raise ValueError("Incomplete public Claim ID coverage: " + name)
            if name == "mcp" and receipt.get("remainingClaimIds") != []: raise ValueError("MCP still has remaining Claim IDs")
        if name in ["mcp", "student_snapshot", "runtime_content"] and (not data_hash or receipt.get("dataBasisSha256") != data_hash):
            raise ValueError("Stale public data basis: " + name)
        if name == "student_snapshot":
            dispositions = receipt.get("snapshotDispositions", {})
            if set(dispositions) != set(expected): raise ValueError("Missing snapshot basis disposition")
            for value in dispositions.values():
                stored, wanted = value.get("basisFingerprint"), value.get("expectedBasisFingerprint")
                if not all(isinstance(h, str) and re.fullmatch(r"[0-9a-f]{64}", h) for h in [stored, wanted]):
                    raise ValueError("Invalid snapshot basis fingerprints")
                if stored != wanted or value.get("reviewState") == "needs_review":
                    if value.get("effectiveStatus") != "needs_review" or value.get("displayEligible") is not False:
                        raise ValueError("Stale/held snapshot cannot be approved by synchronization")
        if name == "runtime_content":
            for kind in ["Content", "Data"]:
                wanted, actual = receipt.get("expected" + kind + "Hash"), receipt.get("observed" + kind + "Hash")
                if not isinstance(wanted, str) or not re.fullmatch(r"[0-9a-f]{64}", wanted) or actual != wanted:
                    raise ValueError("Runtime artifact/data hash mismatch")
            if receipt["observedDataHash"] != data_hash: raise ValueError("Runtime uses a different public data artifact")


def sync_gate_v21(event, root):
    """v2.0 typed receipts plus deterministic event/input/overview and surface checks."""
    import subprocess
    changes = event["surfaces"].get("changes", {})
    if changes.get("status") != "updated":
        raise ValueError("Contract 2.1.0 requires event projection evidence")
    def receipt(name):
        found = [(safe_path(root, p["path"]), load(safe_path(root, p["path"]))) for p in event["surfaces"][name].get("evidence", []) if p["path"].endswith(".json")]
        found = [(p, r) for p, r in found if isinstance(r, dict) and r.get("schemaVersion") == "uapt-policy-surface-receipt-v1" and r.get("surface") == name]
        if len(found) != 1: raise ValueError("Missing unique event/public-data receipt")
        return found[0]
    changes_path, change_receipt = receipt("changes")
    data_path, data_receipt = receipt("public_data")
    repo = Path(__file__).resolve().parent.parent
    command = ["node", str(repo / "node_modules/tsx/dist/cli.mjs"), "--tsconfig", str(repo / "apps/web/tsconfig.json"), str(repo / "scripts/validate-change-event-projection.ts"), str(changes_path), str(safe_path(root, event["scopeArtifact"]["path"])), str(safe_path(root, data_receipt["dataArtifact"]["path"])), event["basisSha256"], str(root)]
    result = subprocess.run(command, cwd=repo, capture_output=True, text=True, timeout=120)
    if result.returncode != 0: raise ValueError("Event projection gate rejected: " + result.stderr[-4000:])


def event_projection_selected(package_root):
    """Inspect selected artifacts, never an operator-supplied 'events enabled' flag."""
    for data_root in [package_root, package_root / "data", package_root / "apps/web/.runtime-data", package_root / "apps/web/.runtime-data/data"]:
        pointer = data_root / "public-change-history/current.json"
        if pointer.exists():
            ref = load(pointer)
            manifest = safe_path(pointer.parent, ref["path"])
            if sha(manifest.read_bytes()) != ref.get("sha256"): raise ValueError("Selected change projection hash mismatch")
            schema = load(manifest).get("schemaVersion")
            if schema == "uapt-public-change-history-v2": return True
            if schema != "uapt-public-change-history-v1": raise ValueError("Unknown selected change projection")
        for file in [data_root / "public-v6-change-overviews/current.json", data_root / "public-v6-change-overviews/sharded/index.json"]:
            if file.exists(): return True
    return False


def require_event_contract(event, root):
    if event.get("eventType") not in ["policy_release", "index_notification"]: return
    repo = Path(__file__).resolve().parent.parent
    basis_ref = event.get("basisArtifact", {}).get("path")
    basis = load(safe_path(root, basis_ref)) if basis_ref else {}
    incoming = isinstance(basis, dict) and (basis.get("changeProjection") or basis.get("changeOverviews"))
    for proof in event.get("surfaces", {}).get("changes", {}).get("evidence", []):
        value = load(safe_path(root, proof["path"]))
        if isinstance(value, dict) and (value.get("projectionArtifact") or value.get("overviewArtifact")): incoming = True
    if (incoming or any(event_projection_selected(path) for path in [repo, root])) and event.get("syncContractVersion") != "2.1.0":
        raise ValueError("Selected or incoming Changes v2 requires synchronization contract 2.1.0; downgrade refused")


def sync_gate(event, root=None, phase="complete"):
    """Verify frozen artifact receipts. Semantic acceptance is still an operator task."""
    version = event.get("syncContractVersion")
    if version not in [None, "2.0.0", "2.1.0"]:
        raise ValueError("Unknown synchronization contract version")
    root = Path(root or ".").resolve()
    if phase not in ["candidate", "complete"]:
        raise ValueError("Invalid synchronization phase")
    required = ["inventory", "knowledge", "review_cache", "public_data", "tools", "student_snapshot", "mcp", "search_coverage", "pages", "runtime_content", "changes", "sitemap", "notifications", "public_readback"]
    if event.get("eventType") not in ["inventory_update", "crawl_check", "source_health", "audit", "policy_release", "index_notification"] or not event.get("eventId") or not re.fullmatch(r"[0-9a-f]{64}", event.get("basisSha256", "")) or not event.get("requirementsVersion"):
        raise ValueError("Missing event identity/basis")
    basis = event.get("basisArtifact", {})
    if basis.get("sha256") != event["basisSha256"] or not basis.get("path") or sha(safe_path(root, basis["path"]).read_bytes()) != event["basisSha256"]:
        raise ValueError("Missing or changed event basis artifact")
    require_event_contract(event, root)

    def updated(name, surface):
        proofs = surface.get("evidence", [])
        if not isinstance(proofs, list) or not proofs:
            raise ValueError("Updated surface lacks artifact evidence: " + name)
        for proof in proofs:
            if proof.get("basisSha256") != event["basisSha256"] or not re.fullmatch(r"[0-9a-f]{64}", proof.get("sha256", "")) or not proof.get("path"):
                raise ValueError("Unbound synchronization artifact: " + name)
            if sha(safe_path(root, proof["path"]).read_bytes()) != proof["sha256"]:
                raise ValueError("Synchronization artifact changed: " + name)

    for name in required:
        s = event.get("surfaces", {}).get(name, {})
        if s.get("status") == "updated":
            updated(name, s)
        elif s.get("status") == "not_required_with_reason":
            if not s.get("reason"):
                raise ValueError("Missing exclusion reason: " + name)
        elif phase == "candidate" and name in ["public_readback", "notifications"] and s.get("status") == "deferred_until_cutover" and s.get("reason"):
            pass
        else:
            raise ValueError("Unfinished synchronization: " + name)
    if event.get("eventType") == "policy_release":
        for name in ["changes", "public_data"] + (["public_readback"] if phase == "complete" else []):
            if event["surfaces"][name]["status"] != "updated":
                raise ValueError("Published policy requires " + name)
        if phase == "candidate":
            s = event.get("surfaces", {}).get("candidate_readback", {})
            if s.get("status") != "updated":
                raise ValueError("Candidate policy requires candidate readback")
            updated("candidate_readback", s)
    if version in ["2.0.0", "2.1.0"]: sync_gate_v2(event, root, phase)
    if version == "2.1.0": sync_gate_v21(event, root)
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    b = sub.add_parser("build"); b.add_argument("--config", required=True); b.add_argument("--output", required=True); b.add_argument("--readback", action="store_true")
    v = sub.add_parser("validate"); v.add_argument("inventory")
    a = sub.add_parser("bundle"); a.add_argument("inventory"); a.add_argument("slug"); a.add_argument("--output", required=True)
    q = sub.add_parser("validate-audit"); q.add_argument("package"); q.add_argument("report")
    g = sub.add_parser("sync-gate"); g.add_argument("event"); g.add_argument("--phase", choices=["candidate", "complete"], default="complete")
    args = parser.parse_args()
    if args.command == "build": build(args.config, args.output, args.readback)
    elif args.command == "validate": validate_inventory(args.inventory); print("Inventory verified")
    elif args.command == "bundle": bundle(args.inventory, args.slug, args.output)
    elif args.command == "validate-audit": validate_audit(args.package, load(args.report)); print("Audit coverage verified; publication remains separate")
    elif args.command == "sync-gate": sync_gate(load(args.event), Path(args.event).resolve().parent, args.phase); print("Synchronization artifact receipts verified; semantic acceptance remains separate")


if __name__ == "__main__":
    main()
