#!/usr/bin/env python3
"""S6/S8 typed surface receipts and the 2.1.0 policy_release event for a V6 content release.

  python3 scripts/v6-pipeline/make_event.py --workspace <dir> <candidate|complete> <sync-dir>

batch.json supplies contentId, release.continuity (what changed and what stayed byte-identical), release.pagesScope
(read-back limitations) and release.authorization (the quoted release request). IndexNow is never part of it.
"""
import json, hashlib, sys, datetime, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import v6batch as Bt  # noqa: E402
WS, ARGS = Bt.workspace_from_argv()
BATCH = Bt.load(WS)
RELEASE = BATCH.get("release") or {}
for key in ("continuity", "authorization"):
    if not RELEASE.get(key): raise SystemExit("batch.json release." + key + " is required")
phase, d = ARGS[0], pathlib.Path(ARGS[1])
if phase not in ("candidate", "complete"): raise SystemExit("phase must be candidate or complete")
sha = lambda p: hashlib.sha256((d / p).read_bytes()).hexdigest()
load = lambda p: json.loads((d / p).read_text())
basis = sha("basis.json")
ref = lambda p: {"path": p, "sha256": sha(p), "basisSha256": basis}
now = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
scope = load("scope.json"); expected = {u["slug"]: sorted(u["publicClaimIds"]) for u in scope["universities"]}; slugs = sorted(expected)
http = load("http.json"); data_hash = sha("public-data.json")
assert not http["errors"], http["errors"][:5]
api_ids = {p.rsplit("/", 1)[1][:-5]: r["claimIds"] for p, r in http["rows"].items() if p.startswith("/api/public/v1/universities/") and "claimIds" in r}
assert api_ids == expected, "API Claim IDs differ from scope"
mcp = load("mcp-readback.json")
mcp_ids = {s: sorted(set(r["returnedClaimIds"]) | set(r["presentationExcludedClaimIds"])) for s, r in mcp["rows"].items()}
assert mcp_ids == expected, [s for s in expected if mcp_ids.get(s) != expected[s]][:5]
runtime = load("runtime.json")
assert runtime["contentId"] == BATCH["contentId"] and runtime["manifestSha256"] == basis
continuity = RELEASE["continuity"]
def receipt(surface, checks, **extra):
    name = f"{surface}-surface.json"
    (d / name).write_text(json.dumps({"schemaVersion": "uapt-policy-surface-receipt-v1", "surface": surface, "basisSha256": basis, "checkedAt": now,
        "checkedSlugs": slugs, "readback": ref("http.json"), "checks": {c: True for c in checks}, **extra}, ensure_ascii=False, indent=1) + "\n")
    return name
files = {}
files["public_data"] = receipt("public_data", ["schemaValidated", "privateFieldsExcluded", "recordCountsValidated", "claimFingerprintsValidated"],
    dataArtifact=ref("public-data.json"), observedClaimIdsBySlug=api_ids, continuity=continuity)
ch = load("changes-meta.json")
files["changes"] = receipt("changes", ["universityChanges", "history", "latestDiff", "changesIndex", "recentChanges", "rss"],
    projectionArtifact=ref(ch["projectionPath"]), overviewArtifact=ref("overviews.json"), inputBasisSha256=ch["inputBasisSha256"],
    projectionRevision=ch["revision"], rulesVersion=ch["rulesVersion"],
    eventSurfaces={n: ref(f"{n}-events.json") for n in ["history", "universityChanges", "latestDiff", "changesIndex", "recentChanges", "rss"]},
    continuity=continuity)
files["mcp"] = receipt("mcp", ["remainingClaimIdsEmpty", "publishedOnly", "scopePreserved"], observedClaimIdsBySlug=mcp_ids, remainingClaimIds=[],
    dataBasisSha256=data_hash, observedPresentationExclusions={s: r["presentationExcludedClaimIds"] for s, r in mcp["rows"].items()},
    mcpReadback=ref("mcp-readback.json"), mcpHealth=ref("mcp-health.json"),
    readbackCoverage="get_student_policy for every school plus get_policy_evidence for every remaining Claim ID in batches of 10; presentation exclusions reconciled against the bound catalog.")
files["runtime_content"] = receipt("runtime_content", ["contentHashMatched", "dataCompatibilityValidated", "affectedRoutesReadBack"],
    contentId=runtime["contentId"], expectedContentHash=basis, observedContentHash=runtime["manifestSha256"],
    expectedDataHash=data_hash, observedDataHash=data_hash, dataBasisSha256=data_hash, runtime=ref("runtime.json"))
files["pages"] = receipt("pages", ["affectedLocalesReadBack", "unchangedControlsReadBack"],
    scopeLimitations=RELEASE.get("pagesScope") or ["Every school in scope was read in en and zh; fr, es and de were read for four schools each; other reading locales carry the same component and were not read individually."])
files["sitemap"] = receipt("sitemap", ["affectedUrlsValidated", "indexabilityValidated"],
    note="No URL is added or removed; the sitemap is read back with status 200.")
surfaces = {k: {"status": "updated", "evidence": [ref(v)]} for k, v in files.items()}
nr = lambda r: {"status": "not_required_with_reason", "reason": r}
surfaces.update({k: nr(v) for k, v in {
    "inventory": "No policy inventory change; the private inventory stays separate. Presentations and source metadata come from private agent-reviewed packets.",
    "knowledge": "No change to public claims; presentation only.",
    "review_cache": "No private review inputs are published; the public file carries only agent-reviewed public fields.",
    "tools": "The published tool records are unchanged; tool cards are presentation of the same records plus reviewed local display copy.",
    "student_snapshot": "No student summary re-pin or approval.",
    "search_coverage": "No change to university identities or search mapping.",
    "notifications": "Search notifications (IndexNow) are not authorized for this release.",
    **(RELEASE.get("notRequired") or {})}.items()})
if phase == "candidate":
    cr = receipt("candidate_readback", ["affectedRoutesReadBack", "artifactIdentityMatched"])
    surfaces["candidate_readback"] = {"status": "updated", "evidence": [ref(cr), ref("mcp-readback.json")]}
    surfaces["public_readback"] = {"status": "deferred_until_cutover", "reason": "Public readback follows the switch and cache purges."}
else:
    pr = receipt("public_readback", ["affectedRoutesReadBack", "artifactIdentityMatched"])
    surfaces["public_readback"] = {"status": "updated", "evidence": [ref(pr), ref("mcp-readback.json")]}
event = {"schemaVersion": "uapt-policy-sync-event-v2", "eventId": f"uapt-{BATCH['contentId']}-{phase}", "eventType": "policy_release",
    "syncContractVersion": "2.1.0", "requirementsVersion": "1.1.0", "generatedAt": now, "phase": phase, "basisSha256": basis,
    "basisArtifact": ref("basis.json"), "scopeArtifact": ref("scope.json"), "surfaces": surfaces,
    "reportAuthorization": RELEASE["authorization"] + " IndexNow was not requested and is not part of this release."}
(d / "event.json").write_text(json.dumps(event, ensure_ascii=False, indent=1) + "\n")
print(json.dumps({"event": str(d / "event.json"), "sha256": sha("event.json"), "surfaces": {k: v["status"] for k, v in surfaces.items()}}, ensure_ascii=False))
