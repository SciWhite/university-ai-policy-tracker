import importlib.util
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('maintenance_access',ROOT/'scripts/policy-maintenance-access.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class MaintenanceAccess(unittest.TestCase):
    def test_disallowed_policy_never_fetches_policy_body_and_preserves_robots(self):
        with tempfile.TemporaryDirectory() as d, patch.object(m.gap,'public_address'), patch.object(m.gap,'transport',return_value=({'exitCode':0,'http_code':200,'content_type':'text/plain'},b'User-agent: *\nDisallow: /policy\n')) as fetch:
            result=m.check('https://example.edu/policy',Path(d))
            self.assertEqual(result['status'],'robots_disallowed')
            self.assertEqual(fetch.call_count,1)
            self.assertEqual(fetch.call_args.args[0],'https://example.edu/robots.txt')
            proof=result['sourceEvidence'][0]
            self.assertEqual(m.gap.inv.sha((Path(d)/proof['path']).read_bytes()),proof['sha256'])

    def test_unresolved_rules_do_not_grant_access(self):
        with tempfile.TemporaryDirectory() as d, patch.object(m.gap,'public_address'), patch.object(m.gap,'transport',return_value=({'exitCode':0,'http_code':503},b'Unavailable')) as fetch:
            result=m.check('https://example.edu/policy',Path(d))
            self.assertEqual(result['status'],'robots_unresolved_no_fetch')
            self.assertEqual(fetch.call_count,1)

if __name__=='__main__':unittest.main()
