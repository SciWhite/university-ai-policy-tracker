#!/usr/bin/env python3
"""Normalize a hash-verified private r4 evidence bundle, without publishing or selecting it.

Mapping is explicit and reviewable. The input bundle and its original evidence stay unchanged.
No network, model calls, source rewriting, policy approval or public-loader mutation.
"""
import argparse
import hashlib
import json
from pathlib import Path


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def prepare(root, mapping):
    root = root.resolve()
    manifest_path = (root / "outputs/manifest.json") if (root / "outputs/manifest.json").exists() else (root / "manifest.json")
    manifest_raw = manifest_path.read_bytes()
    manifest = json.loads(manifest_raw)
    for name, meta in manifest["files"].items():
        path = (root / name).resolve()
        assert path.is_relative_to(root) and path.is_file(), name
        raw = path.read_bytes()
        assert digest(raw) == meta["sha256"] and len(raw) == meta["bytes"], name
    bundle_raw = (root / "outputs/bundle.json").read_bytes()
    bundle = json.loads(bundle_raw)
    assert bundle["schemaVersion"] == "uapt-private-repaired-evidence-bundle-v1"
    assert bundle["slug"] == mapping["slug"] and bundle["publicationApproved"] is False
    fingerprint = digest(bundle_raw)
    assert mapping["sourceBundleSha256"] == fingerprint
    assert bundle["agentReviewStatus"] == "agent_reviewed"
    sources = {s["sourceId"]: {**s, "title": s.get("title") or mapping["sourceTitles"][s["sourceId"]]} for s in bundle["sources"]}
    bindings = {b["evidenceId"]: b for b in bundle["evidenceBindings"]}
    for b in mapping.get("additionalBindings", []):
        bindings[b["evidenceId"]] = b
    for b in bindings.values():
        assert b["sourceId"] in sources and digest(b["quote"].encode()) == b["quoteSha256"]

    def source_file(s, kind):
        for name in [s.get(kind + "File"), s.get(kind + "Path")]:
            if not name: continue
            for path in [root / name, root / "outputs" / name]:
                path = path.resolve()
                if path.is_relative_to(root) and path.is_file(): return path
        raise ValueError("Missing frozen " + kind + " source: " + s["sourceId"])

    for s in sources.values():
        for kind in ["raw", "text"]:
            assert digest(source_file(s, kind).read_bytes()) == s[kind + "Sha256"], s["sourceId"]
    for b in bindings.values():
        s = sources[b["sourceId"]]
        assert b["quote"] in source_file(s, "text").read_text(), "Evidence/source mismatch requires explicit review: " + b["evidenceId"]
        assert b["sourceUrl"] == s["url"], "Evidence URL mismatch: " + b["evidenceId"]

    def source(sid):
        s = sources[sid]
        result = {"id": sid, "sourceUrl": s["url"], "citationTitle": s["title"], "snapshotHash": s["rawSha256"], "sourceType": "official_pdf" if s.get("documentKind") == "pdf" or s.get("isPdf") else "official_guidance", "official": True}
        if s.get("publisher"): result["publisher"] = s["publisher"]
        if s.get("retrievedAt"): result["retrievedAt"] = s["retrievedAt"].replace("+00:00", "Z")
        return result

    def evidence(eid):
        b = bindings[eid]
        s = sources[b["sourceId"]]
        location = mapping.get("evidenceLocations", {}).get(eid) or b.get("location", "")
        result = {"id": eid, "sourceUrl": b["sourceUrl"], "sourceLanguage": s.get("language") or "en", "sourceSnapshotHash": s["rawSha256"], "evidenceSnippet": b["quote"], "snippetLocation": (location + "; " if location else "") + "Extracted text SHA256 %s; original binding lines %s–%s; characters %s–%s" % (s["textSha256"], b["lineStart"], b["lineEnd"], b["charStart"], b["charEnd"]), "attribution": source(b["sourceId"])}
        if s.get("retrievedAt"): result["retrievedAt"] = s["retrievedAt"].replace("+00:00", "Z")
        return result

    def evidence_parts(eid):
        item = evidence(eid)
        quote = item["evidenceSnippet"]
        # Preserve all text. The public primitive limits each continuous excerpt to 700 chars.
        return [{**item, "id": eid if len(quote) <= 700 else f"{eid}:part-{start // 700 + 1}",
                 "evidenceSnippet": quote[start:start + 700],
                 "snippetLocation": item["snippetLocation"] + f"; excerpt offset {start}–{min(start + 700, len(quote))}"}
                for start in range(0, len(quote), 700)]

    claims = []
    originals = {o["originalRecord"].get("id"): o["originalRecord"] for o in bundle["originalObjects"] if isinstance(o.get("originalRecord"), dict)}
    allowed = {"VERIFIED", "OVERSTATED", "UNDERSTATED"}
    claim_text_overrides = mapping.get("claimTextOverrides", {})
    extra_evidence_map = mapping.get("additionalEvidenceIdsByClaim", {})
    decisions = []
    for c in bundle["publicClaims"]:
        if c["auditStatus"] not in allowed:
            continue
        correction = c.get("suggestedClaimEn") if c["auditStatus"] != "VERIFIED" or c.get("useReviewedReplacement") else None
        assert c["auditStatus"] == "VERIFIED" or correction, c["claimId"]
        claim_text = claim_text_overrides.get(c["claimId"]) or correction or c["originalClaimText"]
        evidence_list = [part for eid in c["evidenceIds"] for part in evidence_parts(eid)]
        if c["claimId"] in extra_evidence_map:
            for extra_eid in extra_evidence_map[c["claimId"]]:
                evidence_list.extend(evidence_parts(extra_eid))
        claims.append({"id": c["claimId"], "entitySlug": mapping["slug"], "entityType": "university", "claimType": c["claimType"], "claimText": claim_text, "confidence": originals.get(c["claimId"], {}).get("confidence", 0), "reviewState": "agent_reviewed", "lastCheckedAt": c["checkedAt"].replace("+00:00", "Z"), "evidence": evidence_list})
        decisions.append({"id": c["claimId"], "auditStatus": c["auditStatus"], "usesReviewedCorrection": bool(correction), "publicPromotion": False})
    source_held = bundle.get("heldDraftIds", [])
    extra_held = mapping.get("heldDraftIds", [])
    held_draft_ids = sorted(set(source_held).union(extra_held))
    for c in bundle["draftRules"]:
        if c["auditStatus"] != "VERIFIED" or c["draftId"] in held_draft_ids:
            continue
        claim_text = claim_text_overrides.get(c["draftId"]) or c["statement"]
        evidence_list = [part for eid in c["evidenceIds"] for part in evidence_parts(eid)]
        if c["draftId"] in extra_evidence_map:
            for extra_eid in extra_evidence_map[c["draftId"]]:
                evidence_list.extend(evidence_parts(extra_eid))
        claims.append({"id": c["draftId"], "entitySlug": mapping["slug"], "entityType": "university", "claimType": mapping["claimTypes"][c.get("topic") or c["category"]], "claimText": claim_text, "confidence": 0, "reviewState": c["reviewState"], "evidence": evidence_list})
    assert len({c["id"] for c in claims}) == len(claims)

    def topic(d, key):
        m = mapping["topics"][key]
        assert d["status"] == m["sourceStatus"], "unreviewed status mapping " + key
        raw_ids = mapping.get("topicEvidenceIds", {}).get(key) or d.get("evidenceIds") or d["basis"]["evidenceIds"]
        ids = list(dict.fromkeys(raw_ids))
        assert ids and all(eid in bindings for eid in ids)
        grouped = {}
        for eid in ids:
            b = bindings[eid]
            grouped.setdefault(b["sourceId"], []).append(eid)
        # These are source-excerpt display groups, not newly invented public Claim IDs.
        quote_groups = [{"id": sid, "text": sources[sid]["title"], "evidence": [{"quote": bindings[eid]["quote"], "url": bindings[eid]["sourceUrl"], "title": sources[sid]["title"], "language": sources[sid].get("language") or "en", "location": evidence(eid)["snippetLocation"], **({"retrievedAt": sources[sid]["retrievedAt"]} if sources[sid].get("retrievedAt") else {})} for eid in eids]} for sid, eids in grouped.items()]
        actions = d.get("actions", [])
        summary_val = mapping.get("topicSummaries", {}).get(key)
        if isinstance(summary_val, dict):
            summary = summary_val.get("en") or d.get("summaryEn") or d.get("summary", "")
        else:
            summary = summary_val or d.get("summaryEn") or d.get("summary", "")
        scope_val = mapping.get("topicScopes", {}).get(key)
        if isinstance(scope_val, dict):
            scope = scope_val.get("en") or d.get("scope", "")
        else:
            scope = scope_val or d.get("scope", "")
        return {"key": key, "title": m["title"]["en"], "status": m["displayStatus"], "statusLabel": m["statusLabel"]["en"], "summary": summary, "scope": scope, "basisKind": "local_reviewed_bundle", "actions": actions if isinstance(actions, list) else actions.get("do", []), "sources": [{"url": sources[sid]["url"], "hash": sources[sid]["textSha256"]} for sid in grouped], "claims": quote_groups}

    canonical_order = ["coursework", "exams", "disclosure", "privacy_data", "approved_tools", "research_publication"]
    dim_map = {d["key"]: d for d in bundle["studentDimensions"]}
    topics = [topic(dim_map[key], key) for key in canonical_order if key in dim_map]
    additional = [topic(d, d["key"]) for d in bundle["analysisDimensions"] if d["key"] in mapping["additionalTopicKeys"]]
    tools = []
    for tool, tm in zip(bundle["tools"], mapping["tools"]):
        raw_name = tool.get("rawProductName") or tool["rawToolName"]
        assert raw_name == tm["rawToolName"]
        code = tm.get("tool") or tool.get("tool") or tool.get("canonicalTool") or "proposed:" + tool.get("proposedSlug", "")
        availability = tm.get("availability", tool.get("availability"))
        endorsement = tm.get("endorsementType") or tool.get("endorsementType")
        if endorsement == "not_endorsed":
            endorsement = "explicitly_not_endorsed"
        assert endorsement, "Explicit tool endorsement mapping required"
        description = tm.get("description", tool.get("description", ""))
        how_to_obtain = tm.get("howToObtain", tool.get("howToObtain", ""))
        cost_to_user = tm.get("costToUser", tool.get("costToUser", "Not verified in the reviewed evidence."))
        tool_evidence = [{"sourceUrl": part["sourceUrl"], "evidenceSnippet": part["evidenceSnippet"], "snapshotHash": part["sourceSnapshotHash"], "reviewState": "agent_reviewed"} for eid in tool["evidenceIds"] for part in evidence_parts(eid)]
        for claim_key, extra_eids in extra_evidence_map.items():
            if code == "microsoft_copilot" and "microsoft-copilot" in claim_key:
                for extra_eid in extra_eids:
                    tool_evidence.extend([{"sourceUrl": part["sourceUrl"], "evidenceSnippet": part["evidenceSnippet"], "snapshotHash": part["sourceSnapshotHash"], "reviewState": "agent_reviewed"} for part in evidence_parts(extra_eid)])
        tools.append({"universitySlug": mapping["slug"], "universityName": mapping["name"], "tool": code, "rawToolName": raw_name, "availability": availability, "endorsementType": endorsement, "reviewState": "agent_reviewed", "description": description, "howToObtain": how_to_obtain, "costToUser": cost_to_user, "sourceLanguage": "en", "evidence": tool_evidence})
    assert len(tools) == len(bundle["tools"]) == len(mapping["tools"])
    labels = {}
    for key, tm in mapping["topics"].items():
        labels[key] = tm["title"]
        labels[key + ":status"] = tm["statusLabel"]
    hero = mapping["hero"]
    if isinstance(hero.get("images"), list):
        imgs = hero["images"]
        hero = {**hero, "images": {"hero": imgs[0]["src"], "do": imgs[1]["src"], "dont": imgs[2]["src"]}}
    elif isinstance(hero.get("images"), dict):
        imgs = hero["images"]
        hero_img = imgs.get("hero") or imgs.get("comic") or ""
        hero = {**hero, "images": {"hero": hero_img, "do": imgs.get("do", ""), "dont": imgs.get("dont", "")}}
    gaps = [mapping.get("gapDescriptions", {}).get(g.get("gapId") or g.get("id"), g["description"]) for g in bundle["gaps"]]
    if "extraGaps" in mapping:
        gaps.extend(mapping["extraGaps"])
    held_claims_list = mapping.get("heldClaimIds")
    if held_claims_list is None:
        held_claims_list = [k for k in bundle["remainingRecordKeys"] if not k.startswith("gap-") and not k.startswith("draft-")]
    return {"schemaVersion": "uapt-v6-local-view-v1", "publicationApproved": False, "sourceBundleSha256": fingerprint,
            "school": {"slug": mapping["slug"], "name": mapping["name"], "checkedAt": mapping["checkedAt"], "fingerprint": fingerprint, "revision": mapping["revision"], "snapshotStatus": "local_reviewed_bundle_not_public_snapshot", "newReviewPending": bool(bundle["remainingRecordKeys"]), "reviewedClaimCount": len(claims), "heldClaims": [{"id": key, "text": "Retained for separate review; not promoted."} for key in held_claims_list], "topics": topics, "additionalTopics": additional},
            "claims": claims, "sources": [source(sid) for sid in sources], "tools": tools,
            "gaps": gaps, "remainingRecordKeys": bundle["remainingRecordKeys"], "heldDraftIds": held_draft_ids, "workflowHolds": bundle.get("workflowHolds", []), "topicLabels": labels, "topicSummaries": mapping.get("topicSummaries", {}), "topicScopes": mapping.get("topicScopes", {}), "hero": hero,
            "claimScopes": {c["claimId"]: c.get("scope", "") for c in bundle["publicClaims"]} | {c["draftId"]: c.get("scope", "") for c in bundle["draftRules"]},
            "auditCoverage": {"publicClaimIds": [c["claimId"] for c in bundle["publicClaims"]], "excludedClaims": [{"id": c["claimId"], "auditStatus": c["auditStatus"]} for c in bundle["publicClaims"] if c["auditStatus"] not in allowed], "originalObjectCount": len(bundle["originalObjects"]), "analysisDimensionKeys": [d["key"] for d in bundle["analysisDimensions"]], "institutionAuditStatus": bundle.get("fullInstitutionAuditStatus", "PARTIAL")},
            "scopedToolNames": mapping.get("scopedToolNames", []),
            "privatePreparation": {"sourceManifestSha256": digest(manifest_raw), "mappingSha256": digest(json.dumps(mapping, sort_keys=True).encode()), "claimDecisions": decisions}}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle-root", type=Path, required=True)
    parser.add_argument("--mapping", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    assert not args.output.exists(), "Use a new immutable output; do not overwrite accepted views"
    result = prepare(args.bundle_root, json.loads(args.mapping.read_text()))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"output": str(args.output), "sha256": digest(args.output.read_bytes()), "sourceBundleSha256": result["sourceBundleSha256"], "claims": len(result["claims"]), "tools": len(result["tools"]), "publicationApproved": False}))
