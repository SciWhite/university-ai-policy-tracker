"""Offline tests for scripts/v6-source-metadata.py: quote gate, merge, finalize, publish (no network, no model)."""
import importlib.util
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "v6-source-metadata.py"
spec = importlib.util.spec_from_file_location("v6sm", SCRIPT)
v6sm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v6sm)

TEXT = """Centre for Teaching and Learning
Generative AI in assessment
Approved by: Academic Board, 10 December 2024
Effective from 1 January 2025
This guidance applies to all coursework in 2025/26.
Authorised by: Director, Marketing
Last updated 3 March 2025
"""


def rec(doc_id, **over):
    base = {"docId": doc_id, "docType": "guideline", "stage": "issued",
            "issuer": {"name": "Centre for Teaching and Learning", "role": "publisher_unit", "category": "teaching_learning_centre", "quote": "Centre for Teaching and Learning"},
            "approvedBy": {"name": "Academic Board", "quote": "Approved by: Academic Board"},
            "dates": [{"kind": "approved", "value": "2024-12-10", "precision": "day", "quote": "Approved by: Academic Board, 10 December 2024"},
                      {"kind": "effective", "value": "2025-01-01", "precision": "day", "quote": "Effective from 1 January 2025"},
                      {"kind": "last_updated_page", "value": "2025-03-03", "precision": "day", "quote": "Last updated 3 March 2025"}],
            "version": None, "scope": {"en": "All coursework", "quote": "applies to all coursework"}, "changes": "none"}
    base.update(over)
    return base


def run(*args):
    return subprocess.run([sys.executable, str(SCRIPT), *args], capture_output=True, text=True, check=True)


class Pipeline(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.run = pathlib.Path(self.tmp.name) / "run"
        (self.run / "objects").mkdir(parents=True)
        (self.run / "objects" / ("a" * 64 + ".txt")).write_text(TEXT, encoding="utf-8")
        docs = [{"docId": "d0001", "url": "https://www.example.edu/ai/", "slugs": ["example-university"], "checkedOn": "2026-11-19",
                 "rawSha256": "a" * 64, "hashKind": "raw_captured_bytes", "kind": "html", "textFile": f"objects/{'a' * 64}.txt"}]
        failed = [{"docId": "d0002", "url": "https://example.edu/gone", "slugs": ["example-university"], "checkedOn": "2026-11-19", "detail": "HTTP 404"}]
        (self.run / "docs.json").write_text(json.dumps({"docs": docs, "failed": failed}))

    def tearDown(self):
        self.tmp.cleanup()

    def test_gate_drops_unquoted_and_inconsistent_values(self):
        stats = v6sm.collections.Counter()
        out = v6sm.gate(rec("d0001", issuer={"name": "Office of the Provost", "role": "owner", "category": "provost_academic_affairs", "quote": "Office of the Provost"},
                            dates=[{"kind": "revised", "value": "2023-05-01", "precision": "day", "quote": "Last updated 3 March 2025"},
                                   {"kind": "effective", "value": "2025-01", "precision": "day", "quote": "Effective from 1 January 2025"}]), TEXT, stats)
        self.assertIsNone(out["issuer"])  # quote not in the text
        self.assertEqual(out["dates"], [])  # year not in quote; precision does not match value

    def test_merge_finalize_publish(self):
        for side in ("A", "B"):
            (self.run / "extract" / side).mkdir(parents=True)
            (self.run / "extract" / side / "b000.json").write_text(json.dumps({"records": [rec("d0001")]}))
        merged = json.loads(run("merge", "--run", str(self.run)).stdout)
        self.assertEqual(merged["agreed"], 1)
        batch = (self.run / "verify" / "v000.txt").read_text()
        self.assertIn("CANDIDATE A", batch)
        self.assertIn("Approved by: Academic Board", batch)
        self.assertIn("- approvedBy:", (self.run / "verify" / "prompt.md").read_text())  # shared rules are inlined

        final = rec("d0001", issuer={"name": "Director, Marketing", "role": "owner", "category": "other", "quote": "Authorised by: Director, Marketing"},
                    dates=rec("d0001")["dates"] + [{"kind": "effective", "value": "2025", "precision": "year", "quote": "all coursework in 2025/26"}])
        (self.run / "verify" / "out").mkdir()
        (self.run / "verify" / "out" / "v000.json").write_text(json.dumps({"records": [final]}))
        run("finalize", "--run", str(self.run))
        cand = json.loads((self.run / "candidate.json").read_text())
        r = cand["records"][0]
        self.assertIsNone(r["issuer"])  # site footer authorisation line is not the issuer
        self.assertNotIn("2025", [d["value"] for d in r["dates"]])  # academic-year label is not an effective date
        self.assertEqual(r["displayDate"], {"kind": "effective", "value": "2025-01-01", "precision": "day"})
        self.assertEqual(r["latestUpdate"], {"kind": "last_updated_page", "value": "2025-03-03", "precision": "day"})

        current = {"schemaVersion": "uapt-v6-source-metadata-v1", "generatedAt": "2026-11-18T00:00:00Z", "reviewState": "agent_reviewed",
                   "method": "m", "dateRule": "r", "basis": {"contentId": "c-old", "candidateSha256": "b" * 64, "schools": 1},
                   "schools": {"other-university": [{"url": "https://other.edu/p"}]}}
        cur = pathlib.Path(self.tmp.name) / "current.json"
        cur.write_text(json.dumps(current))
        out = pathlib.Path(self.tmp.name) / "next.json"
        run("publish", "--run", str(self.run), "--metadata", str(cur), "--out", str(out), "--content-id", "c-new")
        pub = json.loads(out.read_text())
        self.assertEqual(pub["schools"]["other-university"], current["schools"]["other-university"])  # other schools untouched
        self.assertEqual([d["url"] for d in pub["schools"]["example-university"]], ["https://www.example.edu/ai/"])
        self.assertEqual(pub["gaps"]["example-university"][0]["reason"], "fetch_failed")
        self.assertEqual(pub["basis"]["contentId"], "c-new")
        self.assertNotIn("docId", pub["schools"]["example-university"][0])
        with self.assertRaises(subprocess.CalledProcessError):
            run("publish", "--run", str(self.run), "--metadata", str(cur), "--out", str(out), "--content-id", "c-new")

    def test_finalize_refuses_missing_verify_output(self):
        (self.run / "verify" / "out").mkdir(parents=True)
        with self.assertRaises(subprocess.CalledProcessError):
            run("finalize", "--run", str(self.run))
        self.assertFalse((self.run / "candidate.json").exists())

    def test_url_key_matches_shared(self):
        self.assertEqual(v6sm.url_key("https://WWW.Example.edu/a/b/?x=1"), "example.edu/a/b?x=1")
        self.assertEqual(v6sm.url_key("https://example.edu/"), "example.edu")


if __name__ == "__main__":
    unittest.main()
