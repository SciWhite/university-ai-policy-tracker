import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('maintenance_sync',ROOT/'scripts/record-maintenance-sync.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class MaintenanceSync(unittest.TestCase):
    def test_no_change_scan_has_bound_private_event_without_public_release(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            (root/'source-health.json').write_text(json.dumps({'runId':'test','rows':[]}))
            event=json.loads(m.record(root,'scan').read_text())
            self.assertFalse(event['publicationApproved'])
            self.assertEqual(event['surfaces']['inventory']['status'],'updated')
            self.assertEqual(event['surfaces']['changes']['status'],'not_required_with_reason')
            self.assertNotIn('syncContractVersion',event)

    def test_missing_or_changed_source_evidence_rejects_completion(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            (root/'source-health.json').write_text(json.dumps({'rows':[{'sourceEvidence':[
                {'path':'missing','sha256':'0'*64}]}]}))
            with self.assertRaisesRegex(ValueError,'source evidence'):m.record(root,'scan')
            self.assertEqual(list(root.glob('sync-events/*/event.json')),[])

    def test_review_event_cannot_claim_semantic_approval(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            (root/'review-results.json').write_text(json.dumps({'runId':'test','results':[{'classification':'valid_artifact'}]}))
            event=json.loads(m.record(root,'review').read_text())
            self.assertFalse(event['publicationApproved'])
            self.assertEqual(event['surfaces']['review_cache']['status'],'updated')
            self.assertEqual(event['surfaces']['public_data']['status'],'not_required_with_reason')

if __name__=='__main__':unittest.main()
