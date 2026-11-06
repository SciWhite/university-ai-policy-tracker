import re,sys,random,json,hashlib,ssl,http.client,concurrent.futures,collections
dump=open('/tmp/ngT.txt').read()
parts=re.split(r'^# configuration file (\S+):\n',dump,flags=re.M)
files={parts[i]:parts[i+1] for i in range(1,len(parts),2)}
LOC=re.compile(r'^[ \t]*location\s+(=|\^~)\s*(\S+)\s*\{((?:[^{}]|\{[^{}]*\})*)\}',re.M)
app=[];other=[]
for f,b in files.items():
    if '/snippets/uapt-' not in f or 'candidate' in f: continue
    for op,p,body in LOC.findall(b):
        if not p.startswith('/'): continue
        if op=='^~': p=p+'x-probe' if p.endswith('/') else p
        (other if ('alias ' in body or re.search(r'\breturn\s+\d',body)) and 'proxy' not in body else app).append(p)
random.seed(7)
app=sorted(set(app)); other=sorted(set(other))
sample=other+random.sample(app,min(int(sys.argv[1]),len(app)))+['/','/zh','/universities/mit','/changes/x-missing','/no-such-page','/sitemap.xml','/mcp','/api/mcp','/feeds/changes.xml','/search?q=ai']
ctx=ssl._create_unverified_context()
def get(kind,path,rsc=False):
    c=http.client.HTTPSConnection('127.0.0.1',443,context=ctx,timeout=200) if kind=='old' else http.client.HTTPConnection('127.0.0.1',18080,timeout=200)
    h={'Host':'eduaipolicy.org','User-Agent':'uapt-routing-compare'}
    c.request('GET',path,headers=h); r=c.getresponse(); body=r.read()
    ct=(r.getheader('content-type') or '').split(';')[0]
    loc=r.getheader('location') or ''
    loc=loc.replace('https://eduaipolicy.org','').replace('http://eduaipolicy.org','')
    sig=hashlib.sha256(body).hexdigest()[:12] if not ct.startswith('text/html') else len(body)//2000
    return (r.status,loc,ct,sig)
def one(p):
    try: return p,get('old',p),get('new',p)
    except Exception as e: return p,('ERR',str(e)[:80]),None
res=collections.Counter(); diffs=[]
with concurrent.futures.ThreadPoolExecutor(4) as ex:
    for p,o,n in ex.map(one,sample):
        if o==n: res['same']+=1
        else: res['diff']+=1; diffs.append((p,o,n))
print(json.dumps({'tested':len(sample),'static_or_return':len(other),**res}))
for d in diffs[:80]: print(d)
