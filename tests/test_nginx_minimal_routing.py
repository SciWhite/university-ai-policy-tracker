import subprocess, sys, tempfile, unittest
from pathlib import Path

ROOT = Path(__file__).parents[1]
DUMP = """# configuration file /etc/nginx/snippets/uapt-eea1eb21-detail-routes.conf:
location ~ ^/changes/[^/] { proxy_pass http://127.0.0.1:3101; }

# configuration file /etc/nginx/snippets/uapt-proxy-locations.conf:
set_real_ip_from 173.245.48.0/20;
real_ip_header CF-Connecting-IP;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header X-Frame-Options "SAMEORIGIN" always;
location ^~ /_next/static/ { alias /srv/uapt/static/x/_next/static/; }
location = /universities/old { return 308 /universities/new$is_args$args; }
location = /universities/a { proxy_pass http://127.0.0.1:3101; }
location / { include /etc/nginx/snippets/uapt-proxy-common.conf; }
"""


def generate(*flags):
    with tempfile.TemporaryDirectory() as tmp:
        dump, out = Path(tmp) / 'dump.txt', Path(tmp) / 'out.conf'
        dump.write_text(DUMP)
        subprocess.run([sys.executable, str(ROOT / 'scripts/nginx-minimal-routing.py'), str(dump), str(out), 'uapt_next_backend', *flags], check=True, capture_output=True)
        return out.read_text()


class MinimalRoutingTests(unittest.TestCase):
    def test_default_output_has_no_html_cache_and_streams(self):
        text = generate()
        self.assertNotIn('proxy_cache uapt_html', text)
        self.assertIn('proxy_buffering off;', text)
        self.assertIn('location = /universities/old { return 308', text)
        self.assertNotIn('location = /universities/a', text)

    def test_html_cache_mode_buffers_and_keeps_security_headers(self):
        text = generate('--html-cache')
        app = text[text.index('location / {'):]
        self.assertIn('proxy_cache uapt_html;', app)
        self.assertIn('proxy_buffering on;', app)  # nginx cannot cache an unbuffered response
        self.assertIn('$uapt_html_cache_epoch', app)
        self.assertIn('proxy_cache_bypass $uapt_html_cache_skip $http_authorization;', app)
        for header in ('X-Content-Type-Options', 'Referrer-Policy', 'X-Frame-Options'):
            self.assertIn(f'add_header {header}', app, header)


if __name__ == '__main__':
    unittest.main()
