"""Reconciliation must not manufacture original text, scope or authority."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("reconcile", Path(__file__).parents[1] / "scripts/policy-evidence-reconcile.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class Reconciliation(unittest.TestCase):
    def test_newline_hash_is_distinct_from_raw_and_reproducible(self):
        variants = dict(m.versions(b"Policy must be followed.\n"))
        self.assertNotEqual(m.inv.sha(variants["raw_bytes"]), m.inv.sha(variants["utf8_without_single_final_lf_v1"]))
        self.assertEqual(variants["raw_bytes"], b"Policy must be followed.\n")
        self.assertEqual(variants["utf8_without_single_final_lf_v1"], b"Policy must be followed.")

    def test_only_one_newline_removed_not_all_structure(self):
        variants = dict(m.versions(b"A\nB\n\n"))
        self.assertEqual(variants["utf8_without_single_final_lf_v1"], b"A\nB\n")

    def test_binary_is_not_lossily_converted_to_text_hash(self):
        self.assertNotIn("utf8_strip_outer_whitespace_v1", dict(m.versions(b"\xff\x00")))

    def test_layout_match_records_original_character_range_and_lines(self):
        text = "Context\nThe student must submit\nthe appeal within ten days.\nException"
        quote = "The student must submit the appeal within ten days."
        result = m.quote_position(text, quote)
        self.assertEqual(result["matchMethod"], "whitespace_only_layout_diagnostic_v1")
        self.assertEqual((result["lineStart"], result["lineEnd"]), (2, 3))
        self.assertEqual(text[result["startCharacter"]:result["endCharacter"]], "The student must submit\nthe appeal within ten days.")
        self.assertFalse(result["pdfActualPageVerified"])

    def test_negation_and_modal_verbs_cannot_disappear(self):
        for quote in ["Use is allowed.", "You must disclose use."]:
            text = "Use is not allowed. You should disclose use."
            self.assertEqual(m.quote_position(text, quote)["status"], "quote_not_located")

    def test_distant_fragments_are_not_a_contiguous_quote(self):
        self.assertEqual(m.quote_position("A special exception.\nUnrelated text.\nB applies.", "A special exception. B applies.")["status"], "quote_not_located")

    def test_exact_quote_keeps_exact_status(self):
        self.assertEqual(m.quote_position("Before\nYou may use AI.\nAfter", "You may use AI.")["matchMethod"], "exact_original")

    def test_crlf_offsets_refer_to_original_bytes_decoded_without_newline_rewrite(self):
        text = b"Before\r\nYou may\r\nuse AI.\r\nAfter".decode()
        result = m.quote_position(text,"You may use AI.")
        self.assertEqual(text[result["startCharacter"]:result["endCharacter"]], "You may\r\nuse AI.")
        self.assertEqual(result["startCharacter"],8)

    def test_status_200_antibot_shell_is_not_a_policy(self):
        body = b'<html><script src="/_Incapsula_Resource?x=1"></script><body></body></html>'
        self.assertEqual(m.response_kind(body,"text/html"), "access_shell_not_policy")

    def test_client_redirect_and_empty_body_are_not_policy_content(self):
        self.assertEqual(m.response_kind(b'<meta http-equiv="refresh" content="0; URL=x" />',"text/html"), "client_redirect_not_policy")
        self.assertEqual(m.response_kind(b' \n',"text/html"), "empty_body_not_policy")

    def test_content_comparison_ignores_confidence_but_keeps_conditions(self):
        a = {"statement": "AI allowed", "conditions": "Instructor permission", "confidence": .9}
        b = {**a, "confidence": .1}
        self.assertEqual(m.content(a), m.content(b))
        self.assertNotEqual(m.content(a), m.content({**b, "conditions": "No permission needed"}))

    def test_overlay_cannot_bind_wrong_parent(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d) / "base";root.mkdir();(root / "manifest.json").write_text('{}\n')
            review = Path(d) / "review";review.mkdir()
            m.inv.write(review / "manifest.json", {"parentInventoryManifestSha256": "0" * 64, "files": {}})
            with self.assertRaises(ValueError):m.validate(root, review)

    def fixture_bundle(self, root):
        root=Path(root)
        raw=b"Before\r\nYou may\r\nuse AI.\r\nAfter"
        h=m.inv.sha(raw);p=m.inv.object_path(root,h);p.parent.mkdir(parents=True);p.write_bytes(raw)
        claim={"id":"claim-a","claimText":"You may use AI.","evidence":[{"evidenceSnippet":"You may use AI.","sourceSnapshotHash":h}]}
        rows=[{"recordKey":"published:a","id":"claim-a","state":"published","record":claim},{"recordKey":"student:a","id":"summary-a","state":"held","record":{}}]
        m.inv.write(root/"records.json",rows)
        m.inv.write(root/"public-records.json",[{"claims":[claim]}])
        m.inv.write(root/"record-reconciliation.json",[{"recordKey":r["recordKey"]} for r in rows])
        candidate={"artifactId":h,"hashKind":"raw_bytes",**m.quote_position(raw.decode(),"You may use AI.")}
        m.inv.write(root/"evidence-reconciliation.json",[{"recordKey":"published:a","evidenceKey":"published:a:evidence:0","declaredSnapshotHash":h,"candidates":[candidate]}])
        self.repin_fixture(root)

    def repin_fixture(self, root):
        root=Path(root)
        m.inv.write(root/"manifest.json",{"slug":"school-a","recordKeys":["published:a","student:a"],"publicClaimIds":["claim-a"],"files":{str(p.relative_to(root)):m.inv.sha(p.read_bytes()) for p in root.rglob('*') if p.is_file() and p!=root/'manifest.json'}})

    def test_portable_bundle_checks_copied_bytes_and_all_snapshot_objects(self):
        with tempfile.TemporaryDirectory() as d:
            self.fixture_bundle(d)
            self.assertTrue(m.validate_bundle(d))
            m.inv.write(Path(d)/"record-reconciliation.json",[{"recordKey":"published:a"}]);self.repin_fixture(d)
            with self.assertRaisesRegex(ValueError,"Incomplete bundle record"):m.validate_bundle(d)

    def test_complete_manifest_does_not_hide_missing_evidence(self):
        with tempfile.TemporaryDirectory() as d:
            self.fixture_bundle(d)
            m.inv.write(Path(d)/"evidence-reconciliation.json",[]);self.repin_fixture(d)
            with self.assertRaisesRegex(ValueError,"Incomplete bundle evidence"):m.validate_bundle(d)

    def test_manifest_record_set_cannot_hide_missing_snapshot(self):
        with tempfile.TemporaryDirectory() as d:
            self.fixture_bundle(d)
            m.inv.write(Path(d)/"records.json",m.inv.load(Path(d)/"records.json")[:1]);self.repin_fixture(d)
            with self.assertRaisesRegex(ValueError,"bundle record set"):m.validate_bundle(d)

    def test_duplicate_bundle_record_cannot_pass_set_coverage(self):
        with tempfile.TemporaryDirectory() as d:
            self.fixture_bundle(d)
            rows=m.inv.load(Path(d)/"records.json");m.inv.write(Path(d)/"records.json",rows+[rows[0]]);self.repin_fixture(d)
            with self.assertRaisesRegex(ValueError,"bundle record set"):m.validate_bundle(d)

    def test_rehashed_manifest_does_not_validate_invented_character_location(self):
        with tempfile.TemporaryDirectory() as d:
            self.fixture_bundle(d)
            evidence=m.inv.load(Path(d)/"evidence-reconciliation.json");evidence[0]['candidates'][0]['startCharacter']=0
            m.inv.write(Path(d)/"evidence-reconciliation.json",evidence);self.repin_fixture(d)
            with self.assertRaisesRegex(ValueError,"quote location"):m.validate_bundle(d)

    def test_rehashed_file_list_cannot_change_raw_object_identity(self):
        with tempfile.TemporaryDirectory() as d:
            self.fixture_bundle(d)
            evidence=m.inv.load(Path(d)/"evidence-reconciliation.json");candidate=evidence[0]['candidates'][0]
            original=m.inv.object_path(Path(d),candidate['artifactId']);fake=m.inv.object_path(Path(d),'0'*64)
            fake.parent.mkdir(parents=True,exist_ok=True);fake.write_bytes(original.read_bytes());candidate['artifactId']='0'*64
            m.inv.write(Path(d)/"evidence-reconciliation.json",evidence);self.repin_fixture(d)
            with self.assertRaisesRegex(ValueError,"raw object identity"):m.validate_bundle(d)


if __name__ == "__main__":
    unittest.main()
