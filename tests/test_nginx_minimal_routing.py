import importlib.util, re, shutil, subprocess, sys, tempfile, unittest
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


def generate(*flags, dump_text=DUMP, check=True):
    with tempfile.TemporaryDirectory() as tmp:
        dump, out = Path(tmp) / 'dump.txt', Path(tmp) / 'out.conf'
        dump.write_text(dump_text)
        result = subprocess.run([sys.executable, str(ROOT / 'scripts/nginx-minimal-routing.py'), str(dump), str(out), 'uapt_next_backend', *flags], check=check, capture_output=True, text=True)
        return out.read_text() if result.returncode == 0 else result


def block(text, opener):
    """The body of the location starting with `opener` (braces balanced)."""
    start = text.index(opener); depth = 0
    # The location pattern itself may contain braces ({0,2}); count from the block's own brace.
    for i in range(text.index(' {\n', start) + 1, len(text)):
        if text[i] == '{': depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0: return text[start:i + 1]
    raise AssertionError('unbalanced ' + opener)


spec = importlib.util.spec_from_file_location('render_once', ROOT / 'scripts/release/render-once.py')
render_once = importlib.util.module_from_spec(spec); spec.loader.exec_module(render_once)


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


class PageStoreTests(unittest.TestCase):
    """Render-once page store (docs/render-once.md, audit 2026-11-21 phase 2.2)."""

    def test_html_cache_mode_is_unchanged_without_page_store(self):
        text = generate('--html-cache')
        self.assertNotIn('$uapt_html_content_generation', text)
        self.assertNotIn('location ~ "^/', text)
        self.assertNotIn('X-UAPT-Refresh', text)

    def test_store_location_is_one_pattern_before_the_catch_all(self):
        text = generate('--page-store')
        opener = 'location ~ ' + render_once.PAGE_STORE_LOCATION + ' {'
        self.assertEqual(text.count(opener), 1)
        self.assertLess(text.index(opener), text.index('\nlocation / {'))
        # Kept exact entries still exist (and win over any regex in nginx).
        self.assertIn('location = /universities/old { return 308', text)
        self.assertEqual(text.count('location ='), 1)

    def test_store_key_ignores_the_query_for_documents_and_keeps_epoch(self):
        store = block(generate('--page-store'), 'location ~ "^/')
        key = re.search(r'proxy_cache_key "([^"]+)";', store).group(1)
        self.assertEqual(key, '$uapt_html_cache_epoch|$host|$uri|$uapt_page_store_variant|ae=$uapt_page_store_encoding')
        self.assertNotIn('$request_uri', key); self.assertNotIn('$args', key); self.assertNotIn('$scheme', key)
        self.assertIn('proxy_cache_valid 200 301 308 30d;', store)
        self.assertIn('proxy_cache_valid 404 410 10m;', store)  # a refresh can replace a removed page
        self.assertIn('proxy_ignore_headers Cache-Control Expires Vary X-Accel-Expires;', store)
        self.assertIn('proxy_set_header Accept-Encoding $uapt_page_store_upstream_encoding;', store)

    def test_refresh_bypasses_and_overwrites_but_never_reaches_the_app(self):
        text = generate('--page-store')
        store = block(text, 'location ~ "^/')
        self.assertIn('proxy_cache_bypass $http_authorization $uapt_page_store_refresh;', store)
        self.assertIn('proxy_no_cache $http_authorization;', store)  # the bypassed response is stored
        self.assertNotIn('$uapt_page_store_refresh', re.search(r'proxy_no_cache[^;]*;', store).group(0))
        self.assertIn('proxy_set_header X-UAPT-Refresh "";', store)
        generic = block(text, '\nlocation / {')
        self.assertIn('$uapt_page_store_refresh', generic)
        self.assertIn('"$uapt_html_cache_epoch|$uapt_html_content_generation|$scheme|$host|$request_uri|rsc=$http_rsc"', generic)
        for header in ('X-Content-Type-Options', 'Referrer-Policy', 'X-Frame-Options'):
            self.assertIn(f'add_header {header}', store, header)

    def test_page_tree_serves_static_first_then_the_store(self):
        text = generate('--page-store', '--page-tree', '/srv/uapt/page-tree')
        tree = block(text, 'location ~ "^/')
        self.assertIn('root /srv/uapt/page-tree/current;', tree)
        self.assertIn('try_files /$uapt_page_tree_kind$uri/index.$uapt_page_tree_kind @uapt_page_store;', tree)
        self.assertIn('gzip_static always;', tree)
        self.assertNotIn('proxy_pass', tree)
        self.assertIn(f'add_header Cache-Control "{render_once.TREE_CACHE_CONTROL}" always;', tree)
        named = block(text, 'location @uapt_page_store {')
        self.assertIn('proxy_cache_key "$uapt_html_cache_epoch|$host|$uri|', named)
        self.assertIn('proxy_pass http://uapt_next_backend;', named)

    def test_page_tree_needs_page_store(self):
        result = generate('--page-tree', '/srv/x', check=False)
        self.assertNotEqual(result.returncode, 0)

    def test_refuses_kept_prefix_locations_the_pattern_would_shadow(self):
        dump = DUMP.replace('location / {', 'location /universities/ { alias /srv/old/; }\nlocation / {')
        result = generate('--page-store', dump_text=dump, check=False)
        self.assertEqual(result.returncode, 2)
        self.assertIn('shadowed', result.stdout)

    def test_pattern_covers_school_and_changes_pages_in_every_locale_only(self):
        yes = ['/universities/ghent-university', '/de/universities/ghent-university', '/zh-Hant/universities/mit',
               '/changes', '/fr/changes', '/changes/mit', '/changes/r-20261121/mit', '/zh/changes/2026-11-21.r2/mit']
        no = ['/universities', '/de/universities', '/universities/mit/', '/universities/mit/opengraph-image', '/xx/universities/mit',
              '/universities/MIT', '/changes/a/b/c', '/api/public/v1/universities/mit', '/search', '/', '/zh']
        for path in yes: self.assertTrue(render_once.page_store_path(path), path)
        for path in no: self.assertFalse(render_once.page_store_path(path), path)

    @unittest.skipUnless(shutil.which('nginx'), 'nginx not installed here; the rollout runs this on the host (docs/render-once.md §5)')
    def test_nginx_accepts_the_generated_config(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            (tmp / 'conf.d').mkdir(); (tmp / 'logs').mkdir()
            for name in ('uapt-html-cache-epoch.inc', 'uapt-html-content-generation.inc'):
                (tmp / 'conf.d' / name).write_text((ROOT / 'infra/nginx' / name).read_text())
            http_conf = (ROOT / 'infra/nginx/uapt-page-store.conf').read_text().replace('/etc/nginx/conf.d/', str(tmp / 'conf.d') + '/').replace('/var/cache/nginx/uapt-html', str(tmp / 'cache'))
            (tmp / 'conf.d' / 'store.conf').write_text(http_conf)
            (tmp / 'server.conf').write_text(generate('--page-store', '--page-tree', str(tmp / 'tree')))
            (tmp / 'nginx.conf').write_text(f"""pid {tmp}/nginx.pid; error_log {tmp}/logs/error.log;
events {{}}
http {{
  access_log off;
  upstream uapt_next_backend {{ server 127.0.0.1:3101; }}
  include {tmp}/conf.d/store.conf;
  server {{ listen 127.0.0.1:18089; server_name eduaipolicy.org; include {tmp}/server.conf; }}
}}
""")
            result = subprocess.run(['nginx', '-t', '-p', str(tmp), '-c', str(tmp / 'nginx.conf')], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == '__main__':
    unittest.main()
