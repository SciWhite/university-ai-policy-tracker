"""Build a minimal eduaipolicy.org location set from the live nginx -T dump.
Keeps verbatim: static aliases, pure returns (redirects/404s), proxies to non-app ports (MCP),
the cached prefix blocks and robots. Every app proxy location collapses into one `location /`."""
import re,sys,json,collections,importlib.util
from pathlib import Path
# Flags: --html-cache (disk cache in `location /`), --page-store (render-once page store, implies
# --html-cache; docs/render-once.md), --page-tree <root> (pre-rendered tree first, needs
# --page-store), --page-tree-cache-control <value>.
def _opt(name):
    if name not in sys.argv: return None
    i=sys.argv.index(name)
    if i+1>=len(sys.argv) or sys.argv[i+1].startswith("--"): sys.exit(f"{name} needs a value")
    return sys.argv[i+1]
page_tree=_opt("--page-tree"); tree_cache_control=_opt("--page-tree-cache-control")
_values={v for v in (page_tree,tree_cache_control) if v is not None}
args=[a for a in sys.argv[1:] if not a.startswith("--") and a not in _values]
page_store="--page-store" in sys.argv; html_cache="--html-cache" in sys.argv or page_store
if page_tree and not page_store: sys.exit("--page-tree needs --page-store")
_spec=importlib.util.spec_from_file_location("render_once",Path(__file__).resolve().parent/"release"/"render-once.py")
render_once=importlib.util.module_from_spec(_spec); _spec.loader.exec_module(render_once)
dump=open(args[0]).read(); out=args[1]; port=args[2]
parts=re.split(r'^# configuration file (\S+):\n',dump,flags=re.M)
files={parts[i]:parts[i+1] for i in range(1,len(parts),2)}
order=[]
def walk(path):
    body=files[path]
    for line in body.splitlines():
        m=re.match(r'\s*include\s+(\S+);',line)
        if m and m.group(1) in files and '/snippets/uapt-' in m.group(1) and 'proxy-common' not in m.group(1): walk(m.group(1))
    order.append(path)
walk('/etc/nginx/snippets/uapt-eea1eb21-detail-routes.conf'); walk('/etc/nginx/snippets/uapt-proxy-locations.conf')
LOC=re.compile(r'^[ \t]*location\s+(=|\^~|~\*|~)?\s*(\S+)\s*\{((?:[^{}]|\{[^{}]*\})*)\}',re.M)
APP={'127.0.0.1:3101','127.0.0.1:3102','uapt_next_backend'}
keep=[];seen=set();stats=collections.Counter();dropped=collections.Counter()
for f in order:
    for m in LOC.finditer(files[f]):
        op,path,b=m.groups(); op=op or ''
        key=(op,path)
        if key in seen: stats['dup']+=1; continue
        targets=set(re.findall(r'proxy_pass\s+http://([^;/]+)',b))
        proxied=bool(targets) or 'proxy-common' in b or '@uapt_discovery_main' in b
        pure_return=not proxied and re.search(r'\breturn\s+\d+',b)
        alias=not proxied and ('alias ' in b or 'try_files' in b or 'root ' in b)
        if path in ('/','@uapt_discovery_main'): dropped['catchall']+=1; continue
        if path=='/robots.txt' or (op=='^~' and path in ('/api/public/v1/','/feeds/','/datasets','/sources','/search')):
            reason='cached-prefix'
        elif alias: reason='static'
        elif pure_return: reason='return'
        elif targets and not targets<=APP: reason='other-port'
        else: dropped['app-proxy' if proxied else 'other']+=1; continue
        seen.add(key); stats[reason]+=1
        keep.append(m.group(0).strip())
head=f"""# Generated {__import__('datetime').datetime.now(__import__('datetime').timezone.utc).strftime('%Y-%m-%dT%H:%M:%S')}Z by nginx-min/gen.py from the live nginx -T.
# One app upstream; exact per-page proxy locations removed. Kept verbatim: static aliases,
# pure returns (redirects and retired-prefix 404s), proxies to non-app ports, cached prefix blocks.
"""
server_level=re.search(r'(set_real_ip_from[\s\S]*?add_header X-Frame-Options "SAMEORIGIN" always;)',files['/etc/nginx/snippets/uapt-proxy-locations.conf']).group(1)
SECURITY='''    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
'''
generic_key='"$uapt_html_cache_epoch|$uapt_html_content_generation|$scheme|$host|$uapt_html_cache_uri|rsc=$http_rsc"' if page_store else '"$uapt_html_cache_epoch|$scheme|$host|$uapt_html_cache_uri|rsc=$http_rsc"'
refresh=' $uapt_page_store_refresh' if page_store else ''
cache=(f"""    # Disk HTML cache (infra/nginx/{'uapt-page-store.conf' if page_store else 'uapt-html-cache.conf'}): survives app restarts.
    proxy_cache uapt_html;
    proxy_cache_key {generic_key};
    proxy_cache_valid 200 301 308 6h;
    proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
    proxy_cache_background_update on;
    proxy_cache_lock on;
    proxy_cache_lock_timeout 30s;
    proxy_ignore_headers Cache-Control Expires;
    proxy_cache_bypass $uapt_html_cache_skip $http_authorization{refresh};
    proxy_no_cache $uapt_html_cache_skip $http_authorization;
""" + ('    proxy_set_header X-UAPT-Refresh "";\n' if page_store else '') + """    add_header X-UAPT-Origin-Cache $upstream_cache_status always;
    # A location-level add_header stops inheritance of the server-level ones: repeat them.
""" + SECURITY if html_cache else "")
def proxy_common(buffering):
    return f"""    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host eduaipolicy.org;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header CF-IPCountry $http_cf_ipcountry;
    proxy_buffering {buffering};
    proxy_connect_timeout 10s;
    proxy_send_timeout 60s;
    proxy_read_timeout 180s;
"""
app=f"""
location / {{
{proxy_common('on' if html_cache else 'off')}{cache}    proxy_pass http://{port};
}}
"""
store=""
if page_store:
    # One pattern location (not per page): school and changes pages in every reading locale.
    # Kept `=` and `^~` locations still win over it; kept regex locations come first in the file.
    store_proxy=proxy_common('on')+f"""    # Render-once page store (docs/render-once.md): kept until a release replaces it.
    proxy_cache uapt_html;
    proxy_cache_key "$uapt_html_cache_epoch|$host|$uri|$uapt_page_store_variant|ae=$uapt_page_store_encoding";
    proxy_cache_valid 200 301 308 30d;
    proxy_cache_valid 404 410 10m;
    proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
    proxy_cache_background_update on;
    proxy_cache_lock on;
    proxy_cache_lock_timeout 30s;
    proxy_ignore_headers Cache-Control Expires Vary X-Accel-Expires;
    proxy_cache_bypass $http_authorization $uapt_page_store_refresh;
    proxy_no_cache $http_authorization;
    proxy_set_header Accept-Encoding $uapt_page_store_upstream_encoding;
    proxy_set_header X-UAPT-Refresh "";
    add_header X-UAPT-Origin-Cache $upstream_cache_status always;
"""+SECURITY+f"""    proxy_pass http://{port};
"""
    if page_tree:
        cc=tree_cache_control or render_once.TREE_CACHE_CONTROL
        if '"' in cc or '\n' in cc: sys.exit("bad --page-tree-cache-control")
        root=page_tree.rstrip('/')
        store=f"""
location ~ {render_once.PAGE_STORE_LOCATION} {{
    # Pre-rendered tree first (render-once.py capture/activate): gzip objects, hardlinked.
    root {root}/current;
    try_files /$uapt_page_tree_kind$uri/index.$uapt_page_tree_kind @uapt_page_store;
    gzip_static always;
    gunzip on;
    types {{ text/html html; text/x-component rsc; }}
    add_header X-UAPT-Origin-Cache STATIC always;
    add_header Cache-Control "{cc}" always;
    add_header Vary "RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch, Accept-Encoding" always;
{SECURITY}}}

location @uapt_page_store {{
{store_proxy}}}
"""
    else:
        store=f"""
location ~ {render_once.PAGE_STORE_LOCATION} {{
{store_proxy}}}
"""
    shadowed=[k for k in keep if (lambda m: m and m.group(1) in ('',None) and render_once.page_store_path(m.group(2).rstrip('/')+'/x'))(re.match(r'location\s+(=|\^~|~\*|~)?\s*(\S+)',k))]
    shadowed=[k.splitlines()[0] for k in shadowed if re.match(r'location\s+/',k)]
    if shadowed:
        print(json.dumps({'error':'kept prefix locations would be shadowed by the page-store regex','locations':shadowed[:20]})); sys.exit(2)
body=head+server_level+"\n\n"+"\n".join(k.replace('http://127.0.0.1:3101','http://'+port).replace('http://uapt_next_backend','http://'+port) for k in keep)+"\n"+store+app
body=re.sub(r'[ \t]*include /etc/nginx/snippets/clb-pro-[a-z-]+\.conf;\n?','',body)  # another site\'s headers leaked into old static snippets
open(out,'w').write(body)
print(json.dumps({'kept':stats,'dropped':dropped,'lines':body.count('\n'),'pageStore':page_store,'pageTree':bool(page_tree)}))
