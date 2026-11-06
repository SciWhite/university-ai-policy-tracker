"""Build a minimal eduaipolicy.org location set from the live nginx -T dump.
Keeps verbatim: static aliases, pure returns (redirects/404s), proxies to non-app ports (MCP),
the cached prefix blocks and robots. Every app proxy location collapses into one `location /`."""
import re,sys,json,collections
args=[a for a in sys.argv[1:] if not a.startswith("--")]; html_cache="--html-cache" in sys.argv
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
cache=("""    # Disk HTML cache (infra/nginx/uapt-html-cache.conf): survives app restarts.
    proxy_cache uapt_html;
    proxy_cache_key "$uapt_html_cache_epoch|$scheme|$host|$request_uri|rsc=$http_rsc";
    proxy_cache_valid 200 301 308 6h;
    proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
    proxy_cache_background_update on;
    proxy_cache_lock on;
    proxy_cache_lock_timeout 30s;
    proxy_ignore_headers Cache-Control Expires;
    proxy_cache_bypass $uapt_html_cache_skip $http_authorization;
    proxy_no_cache $uapt_html_cache_skip $http_authorization;
    add_header X-UAPT-Origin-Cache $upstream_cache_status always;
    # A location-level add_header stops inheritance of the server-level ones: repeat them.
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
""" if html_cache else "")
app=f"""
location / {{
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host eduaipolicy.org;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header CF-IPCountry $http_cf_ipcountry;
    proxy_buffering {'on' if html_cache else 'off'};
    proxy_connect_timeout 10s;
    proxy_send_timeout 60s;
    proxy_read_timeout 180s;
{cache}    proxy_pass http://{port};
}}
"""
body=head+server_level+"\n\n"+"\n".join(k.replace('http://127.0.0.1:3101','http://'+port).replace('http://uapt_next_backend','http://'+port) for k in keep)+"\n"+app
body=re.sub(r'[ \t]*include /etc/nginx/snippets/clb-pro-[a-z-]+\.conf;\n?','',body)  # another site\'s headers leaked into old static snippets
open(out,'w').write(body)
print(json.dumps({'kept':stats,'dropped':dropped,'lines':body.count('\n')}))
