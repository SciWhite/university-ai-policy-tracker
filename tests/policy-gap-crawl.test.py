import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("crawl", Path(__file__).parents[1] / "scripts/policy-gap-crawl.py")
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)


class CrawlSafety(unittest.TestCase):
    def test_local_origins_and_url_credentials_are_excluded(self):
        for url in ["file:///etc/passwd", "http://localhost/x", "https://u:p@example.com/x", "http://school.local/x", "http://example.com:3100/x"]:
            with self.assertRaises(ValueError): m.public_address(url)

    def test_private_dns_answers_fail_closed(self):
        with patch.object(m.socket, "getaddrinfo", return_value=[(2, 1, 6, '', ('127.0.0.1', 443))]):
            with self.assertRaises(ValueError): m.public_address("https://example.edu/x")

    def test_robots_failure_prevents_body_request(self):
        with tempfile.TemporaryDirectory() as d, patch.object(m, "transport", return_value=({"exitCode": 0, "http_code": 403}, b"Denied")) as fetch:
            row = m.Collector(d).fetch("https://example.edu/policy")
            self.assertEqual(row['status'], 'robots_unresolved_no_fetch'); self.assertEqual(fetch.call_count, 1)

    def test_robot_disallow_is_respected(self):
        with tempfile.TemporaryDirectory() as d, patch.object(m, "transport", return_value=({"exitCode": 0, "http_code": 200}, b"User-agent: *\nDisallow: /policy\n")) as fetch:
            row = m.Collector(d).fetch("https://example.edu/policy")
            self.assertEqual(row['status'], 'robots_disallowed'); self.assertEqual(fetch.call_count, 1)

    def test_cross_origin_redirect_gets_its_own_robots_check(self):
        replies=[({'exitCode':0,'http_code':404},b''),({'exitCode':0,'http_code':301,'redirect_url':'https://other.edu/policy'},b''),({'exitCode':0,'http_code':403},b'Denied')]
        with tempfile.TemporaryDirectory() as d, patch.object(m, 'transport', side_effect=replies) as fetch:
            row=m.Collector(d).fetch('https://example.edu/policy')
            self.assertEqual(row['status'],'robots_unresolved_no_fetch');self.assertEqual(fetch.call_count,3)

    def test_current_success_never_grants_policy_or_pdf_review(self):
        replies=[({'exitCode':0,'http_code':404},b''),({'exitCode':0,'http_code':200,'content_type':'application/pdf'},b'%PDF-1.7 data')]
        with tempfile.TemporaryDirectory() as d, patch.object(m,'transport',side_effect=replies):
            row=m.Collector(d).fetch('https://example.edu/policy.pdf')
            self.assertEqual(row['status'],'retrieved');self.assertFalse(row['semanticReviewed']);self.assertFalse(row['pdfActualPageVerified'])

    def test_cannot_resume_a_frozen_run(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);m.inv.write(root/'q.json',[]);(root/'run').mkdir();m.inv.write(root/'run/manifest.json',{})
            with self.assertRaisesRegex(ValueError,'Frozen runs'):m.run(root/'q.json',root/'run',resume=True)

    def test_resume_rejects_unknown_url_before_network(self):
        with tempfile.TemporaryDirectory() as d, patch.object(m,'transport') as fetch:
            root=Path(d);m.inv.write(root/'q.json',[]);(root/'run').mkdir();(root/'run/url-receipts.jsonl').write_text('{"sourceUrl":"https://other.edu/","chain":[]}\n')
            with self.assertRaisesRegex(ValueError,'outside the frozen queue'):m.run(root/'q.json',root/'run',resume=True)
            fetch.assert_not_called()

    def test_resume_rejects_missing_raw_object_before_network(self):
        with tempfile.TemporaryDirectory() as d, patch.object(m,'transport') as fetch:
            root=Path(d);m.inv.write(root/'q.json',[{'sourceLevelId':'a','sourceUrl':'https://example.edu/'}]);(root/'run').mkdir();(root/'run/url-receipts.jsonl').write_text('{"sourceUrl":"https://example.edu/","chain":[{"bodyArtifactId":"'+'0'*64+'"}]}\n')
            with self.assertRaises(FileNotFoundError):m.run(root/'q.json',root/'run',resume=True)
            fetch.assert_not_called()


if __name__ == '__main__': unittest.main()
