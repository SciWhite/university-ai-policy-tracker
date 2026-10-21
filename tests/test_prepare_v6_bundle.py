#!/usr/bin/env python3
"""Regression test for prepare-v6-local-bundle.py.

Verifies:
1. Source holds and mapping holds are unioned; mapping cannot silently clear source holds.
2. Invalid or unmapped tool endorsement fails closed.
3. Explicit heldClaimIds mapping controls public school.heldClaims while preserving remainingRecordKeys.
"""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

# Dynamically import prepare from scripts/prepare-v6-local-bundle.py
spec = importlib.util.spec_from_file_location(
    "prepare_v6_local_bundle",
    Path(__file__).resolve().parent.parent / "scripts/prepare-v6-local-bundle.py"
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
prepare = mod.prepare
digest = mod.digest


class TestPrepareV6LocalBundle(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        outputs = self.root / "outputs"
        outputs.mkdir(parents=True)

        # Create dummy raw and text files for a source
        raw_file = self.root / "src.html"
        raw_bytes = b"<html>Source text with a test quote.</html>"
        raw_file.write_bytes(raw_bytes)

        txt_file = self.root / "src.txt"
        txt_bytes = b"Source text with a test quote."
        txt_file.write_bytes(txt_bytes)

        quote = "a test quote"
        quote_bytes = quote.encode("utf-8")

        self.source_id = "src-01"
        self.evidence_id = "ev-01"

        self.bundle_data = {
            "schemaVersion": "uapt-private-repaired-evidence-bundle-v1",
            "slug": "test-uni",
            "publicationApproved": False,
            "agentReviewStatus": "agent_reviewed",
            "sources": [
                {
                    "sourceId": self.source_id,
                    "title": "Test Source",
                    "url": "https://example.edu/policy",
                    "rawFile": "src.html",
                    "rawSha256": digest(raw_bytes),
                    "textFile": "src.txt",
                    "textSha256": digest(txt_bytes),
                    "sourceType": "official_guidance",
                    "official": True,
                }
            ],
            "evidenceBindings": [
                {
                    "evidenceId": self.evidence_id,
                    "sourceId": self.source_id,
                    "sourceUrl": "https://example.edu/policy",
                    "location": "Page 1",
                    "lineStart": 1,
                    "lineEnd": 1,
                    "charStart": 17,
                    "charEnd": 29,
                    "quote": quote,
                    "quoteSha256": digest(quote_bytes),
                    "startOffset": 17,
                    "endOffset": 29,
                }
            ],
            "publicClaims": [
                {
                    "claimId": "cl-01",
                    "claimType": "general",
                    "originalClaimText": "Baseline test claim",
                    "auditStatus": "VERIFIED",
                    "checkedAt": "2026-10-21T00:00:00Z",
                    "evidenceIds": [self.evidence_id],
                }
            ],
            "draftRules": [
                {
                    "draftId": "draft-01",
                    "category": "general",
                    "statement": "Draft test claim",
                    "auditStatus": "VERIFIED",
                    "reviewState": "agent_reviewed",
                    "evidenceIds": [self.evidence_id],
                }
            ],
            "studentDimensions": [
                {"key": "coursework", "status": "permitted_with_conditions", "summaryEn": "Coursework summary", "scope": "all", "evidenceIds": [self.evidence_id]},
                {"key": "exams", "status": "permitted_with_conditions", "summaryEn": "Exams summary", "scope": "all", "evidenceIds": [self.evidence_id]},
                {"key": "disclosure", "status": "permitted_with_conditions", "summaryEn": "Disclosure summary", "scope": "all", "evidenceIds": [self.evidence_id]},
                {"key": "privacy_data", "status": "permitted_with_conditions", "summaryEn": "Privacy summary", "scope": "all", "evidenceIds": [self.evidence_id]},
                {"key": "approved_tools", "status": "permitted_with_conditions", "summaryEn": "Tools summary", "scope": "all", "evidenceIds": [self.evidence_id]},
                {"key": "research_publication", "status": "permitted_with_conditions", "summaryEn": "Research summary", "scope": "all", "evidenceIds": [self.evidence_id]},
            ],
            "analysisDimensions": [],
            "tools": [
                {
                    "rawProductName": "Test Copilot",
                    "tool": "microsoft_copilot",
                    "endorsementType": "institutionally_licensed_or_procured",
                    "availability": "available",
                    "evidenceIds": [self.evidence_id],
                }
            ],
            "gaps": [],
            "remainingRecordKeys": ["held-from-bundle"],
            "heldDraftIds": ["source-hold-draft-01"],
            "originalObjects": [{"id": "cl-01"}],
        }

        bundle_bytes = json.dumps(self.bundle_data).encode("utf-8")
        (outputs / "bundle.json").write_bytes(bundle_bytes)

        manifest_data = {
            "files": {
                "outputs/bundle.json": {"sha256": digest(bundle_bytes), "bytes": len(bundle_bytes)},
                "src.html": {"sha256": digest(raw_bytes), "bytes": len(raw_bytes)},
                "src.txt": {"sha256": digest(txt_bytes), "bytes": len(txt_bytes)},
            }
        }
        (outputs / "manifest.json").write_bytes(json.dumps(manifest_data).encode("utf-8"))

        self.base_mapping = {
            "slug": "test-uni",
            "name": "Test University",
            "checkedAt": "2026-10-21T00:00:00Z",
            "revision": "test-v1",
            "sourceBundleSha256": digest(bundle_bytes),
            "sourceTitles": {},
            "claimTypes": {"general": "general"},
            "displayStatuses": {
                "coursework": "permitted_with_conditions",
                "exams": "prohibited",
                "disclosure": "required",
                "privacy_data": "restricted",
                "approved_tools": "institutionally_procured",
                "research_publication": "permitted_with_conditions",
            },
            "topics": {
                k: {"title": {"en": k.title(), "zh": k.title()}, "sourceStatus": "permitted_with_conditions", "displayStatus": "permitted_with_conditions", "statusLabel": {"en": "Permitted", "zh": "允许"}}
                for k in ["coursework", "exams", "disclosure", "privacy_data", "approved_tools", "research_publication"]
            },
            "additionalTopicKeys": [],
            "tools": [
                {
                    "rawToolName": "Test Copilot",
                    "tool": "microsoft_copilot",
                    "availability": "available",
                    "endorsementType": "institutionally_licensed_or_procured",
                }
            ],
            "hero": {
                "title": {"en": "Hero", "zh": "Hero"},
                "scope": {"en": "Scope", "zh": "Scope"},
                "images": {"hero": "", "do": "", "dont": ""},
                "actions": {"do": [], "dont": []},
            },
        }

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_held_draft_ids_union_and_no_silent_clearance(self):
        # 1. Mapping specifies additional hold; result must contain both source hold and mapping hold
        mapping = dict(self.base_mapping)
        mapping["heldDraftIds"] = ["coordinator-hold-draft-02"]
        res = prepare(self.root, mapping)
        self.assertEqual(res["heldDraftIds"], ["coordinator-hold-draft-02", "source-hold-draft-01"])

        # 2. Mapping specifies empty list; source hold must NOT be silently cleared
        mapping_empty = dict(self.base_mapping)
        mapping_empty["heldDraftIds"] = []
        res2 = prepare(self.root, mapping_empty)
        self.assertEqual(res2["heldDraftIds"], ["source-hold-draft-01"])

    def test_held_claim_ids_filtering(self):
        # Explicit heldClaimIds overrides remainingRecordKeys for public school.heldClaims
        mapping = dict(self.base_mapping)
        mapping["heldClaimIds"] = []
        res = prepare(self.root, mapping)
        self.assertEqual(res["school"]["heldClaims"], [])
        self.assertEqual(res["remainingRecordKeys"], ["held-from-bundle"])

    def test_tool_endorsement_fail_closed(self):
        # Mismatched tool raw name fails assertion
        mapping = dict(self.base_mapping)
        mapping["tools"] = [
            {
                "rawToolName": "Unmatched Invented Product",
                "tool": "microsoft_copilot",
                "availability": "available",
                "endorsementType": "institutionally_licensed_or_procured",
            }
        ]
        with self.assertRaises(AssertionError):
            prepare(self.root, mapping)


if __name__ == "__main__":
    unittest.main()
