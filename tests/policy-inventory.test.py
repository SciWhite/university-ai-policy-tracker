"""Contract tests for private integration; no production or network actions."""
import importlib.util
import json
from pathlib import Path
import tempfile
import subprocess
import shutil
import unittest

spec = importlib.util.spec_from_file_location("inventory", Path(__file__).parents[1] / "scripts/policy-inventory.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class Contracts(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.addCleanup(self.tmp.cleanup)
        (self.root / "basis.json").write_text('{"releaseId":"test-next","candidateOnly":true,"includeStagedArtifactDirectories":[]}\n')
        (self.root / "receipt.json").write_text('{"checked":true}\n')

    def test_paths_cannot_escape_package(self):
        with tempfile.TemporaryDirectory() as d:
            for rel in ["../escape", "/tmp/absolute"]:
                with self.assertRaises(ValueError):
                    m.safe_path(d, rel)

    def test_hash_object_paths_are_constrained(self):
        for value in ["../../x", "abc", "F" * 64]:
            with self.assertRaises(ValueError):
                m.object_path("/tmp", value)

    def test_reviewed_metadata_does_not_become_semantic_pass(self):
        a = m.axes({"reviewState": "agent_reviewed"}, published=True)
        self.assertEqual(a["semantic_veracity"]["status"], "not_checked_in_this_run")
        self.assertEqual(a["temporal_validity"]["status"], "not_checked_in_this_run")

    def test_hold_is_not_lost(self):
        self.assertEqual(m.axes({}, held=True)["display_eligible"]["status"], "held")

    def test_legacy_quote_contract_preserves_original_not_translation(self):
        e = {"evidenceSnippet": "You must disclose use.", "evidenceSnippetDisplay": "You may disclose use."}
        self.assertEqual(m.original_quote(e), ("evidenceSnippet", "You must disclose use."))
        self.assertEqual(m.original_quote({"evidenceSnippetDisplay": "summary"}), (None, None))

    def event(self):
        names = ["inventory", "knowledge", "review_cache", "public_data", "tools", "student_snapshot", "mcp", "search_coverage", "pages", "runtime_content", "changes", "sitemap", "notifications", "public_readback"]
        h = m.sha((self.root / "basis.json").read_bytes())
        proof = {"path": "receipt.json", "sha256": m.sha((self.root / "receipt.json").read_bytes()), "basisSha256": h}
        return {"eventId": "test-release", "eventType": "policy_release", "basisSha256": h, "basisArtifact": {"path": "basis.json", "sha256": h}, "requirementsVersion": "1.0.0", "surfaces": {n: {"status": "updated", "evidence": [dict(proof)]} for n in names}}

    def test_policy_release_requires_changes_and_readback(self):
        for n in ["changes", "public_readback"]:
            event = self.event()
            event["surfaces"][n] = {"status": "not_required_with_reason", "reason": "omitted"}
            with self.assertRaises(ValueError):
                m.sync_gate(event, self.root)

    def test_missing_mcp_or_unfinished_snapshot_blocks_completion(self):
        event = self.event()
        del event["surfaces"]["mcp"]
        with self.assertRaises(ValueError):
            m.sync_gate(event, self.root)
        event = self.event()
        event["surfaces"]["student_snapshot"] = {"status": "pending"}
        with self.assertRaises(ValueError):
            m.sync_gate(event, self.root)

    def test_no_change_crawl_does_not_force_fake_changes(self):
        event = self.event()
        event["eventType"] = "crawl_check"
        event["surfaces"]["changes"] = {"status": "not_required_with_reason", "reason": "No policy or public metadata change confirmed"}
        self.assertTrue(m.sync_gate(event, self.root))

    def test_receipt_must_exist_match_and_bind_this_basis(self):
        for change in ["path", "sha256", "basisSha256"]:
            event = self.event()
            event["surfaces"]["mcp"]["evidence"][0][change] = "missing.json" if change == "path" else "0" * 64
            with self.assertRaises((ValueError, FileNotFoundError)):
                m.sync_gate(event, self.root)

    def test_candidate_deferral_requires_candidate_readback(self):
        event = self.event()
        for name in ["public_readback", "notifications"]:
            event["surfaces"][name] = {"status": "deferred_until_cutover", "reason": "Run after authorized cutover"}
        with self.assertRaises(ValueError):
            m.sync_gate(event, self.root, "candidate")
        event["surfaces"]["candidate_readback"] = event["surfaces"]["pages"]
        self.assertTrue(m.sync_gate(event, self.root, "candidate"))
        with self.assertRaises(ValueError):
            m.sync_gate(event, self.root, "complete")

    def test_actual_promoter_rejects_before_writing_manifest(self):
        repo = Path(__file__).parents[1]
        tsx = repo / "node_modules/.bin/tsx"
        if not tsx.exists():
            self.skipTest("tsx unavailable")
        script = repo / "scripts/promote-maintenance-release-candidate.ts"
        (self.root / "scripts").mkdir()
        shutil.copyfile(repo / "scripts/policy-inventory.py", self.root / "scripts/policy-inventory.py")
        current = self.root / "data/public-releases/current.json"
        current.parent.mkdir(parents=True)
        current.write_text('{"releaseId":"test-current"}\n')
        original_current = current.read_bytes()
        cases = [[], ["--sync-ledger", "event.json"]]
        event = self.event()
        event["surfaces"]["changes"]["evidence"][0]["sha256"] = "0" * 64
        m.write(self.root / "event.json", event)
        for flags in cases:
            result = subprocess.run([str(tsx), str(script), "--candidate", "basis.json", "--confirm", *flags], cwd=self.root, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(current.read_bytes(), original_current)
            self.assertFalse((self.root / "data/public-releases/history").exists())

    def test_duplicate_remaining_or_unknown_completion_rejected(self):
        for state, remaining in [("DONE", ["b"]), ("PARTIAL", ["b", "b"])]:
            report = self.report(self.root)
            report.update(status=state, remainingRecordKeys=remaining)
            with self.assertRaises(ValueError):
                m.validate_audit(self.root, report)

    def report(self, root):
        m.write(Path(root) / "records.json", [])
        m.write(Path(root) / "manifest.json", {"slug": "mit", "recordKeys": ["a", "b"], "files": {"records.json": m.sha((Path(root) / "records.json").read_bytes())}})
        return {"slug": "mit", "bundleManifestSha256": m.sha((Path(root) / "manifest.json").read_bytes()), "status": "PARTIAL", "results": [{"recordKey": "a", "status": "UNVERIFIED"}], "remainingRecordKeys": ["b"]}

    def test_partial_report_keeps_explicit_remaining_objects(self):
        with tempfile.TemporaryDirectory() as d:
            report = self.report(d)
            self.assertTrue(m.validate_audit(d, report))
            report["status"] = "COMPLETED"
            report["independentWebVerification"] = True
            with self.assertRaises(ValueError):
                m.validate_audit(d, report)

    def test_extra_missing_duplicate_or_wrong_basis_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            report = self.report(d)
            report["remainingRecordKeys"] = []
            with self.assertRaises(ValueError):
                m.validate_audit(d, report)
            report = self.report(d)
            report["bundleManifestSha256"] = "wrong"
            with self.assertRaises(ValueError):
                m.validate_audit(d, report)

    def test_verified_needs_current_semantic_evidence(self):
        with tempfile.TemporaryDirectory() as d:
            report = self.report(d)
            report["results"][0]["status"] = "VERIFIED"
            with self.assertRaises(ValueError):
                m.validate_audit(d, report)

    def test_portable_location_preserves_original_domain_urls(self):
        value = {"path": "/private/work/a.json", "sourceUrl": "https://official.edu/policy?x=1#scope"}
        result = m.normalize_locator(value, {"scene": Path("/private/work")})
        self.assertEqual(result["path"], "workspace://scene/a.json")
        self.assertEqual(result["sourceUrl"], value["sourceUrl"])


if __name__ == "__main__":
    unittest.main()
