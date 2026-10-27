#!/usr/bin/env python3
"""Export only public ranking fields. Never imports migration/identity/mark review data."""
import argparse, hashlib, json
from pathlib import Path

EDITIONS = [
 ('qs-2026','qs','2026','qs-world-university-rankings-2026-top-1000.json',False),
 ('qs-2027','qs','2027','qs-world-university-rankings-2027-full.json',True),
 ('the-2026','the','2026','the-world-university-rankings-2026-top-1000.json',False),
 ('the-2027','the','2027','the-world-university-rankings-2027-full.json',True),
 ('arwu-2025','arwu','2025','arwu-world-university-rankings-2025-top-1000.json',False),
 ('arwu-2026','arwu','2026','arwu-world-university-rankings-2026-top-1000.json',True),
 ('usnews-2025-2026','usnews','2025-2026','usnews-best-global-universities-2025-2026-top-1000.json',False),
 ('usnews-2026-2027','usnews','2026-2027','usnews-best-global-universities-2026-2027-full.json',True),
 ('cwts-leiden-2025','cwts','2025','cwts-leiden-ranking-2025-top-1000.json',False),
]
def export(candidate, repo):
 manifest=json.loads((candidate/'manifest.json').read_text())
 for item in manifest['files']:
  if item['path'].startswith('rankings/'):
   assert hashlib.sha256((candidate/item['path']).read_bytes()).hexdigest()==item['sha256'], item['path']
 output=repo/'data/ranking-browser';output.mkdir(exist_ok=True)
 for edition,system,year,filename,new in EDITIONS:
  source=(candidate/'rankings' if new else repo/'data/rankings')/filename
  doc=json.loads(source.read_text())
  rows=[]
  for row in doc['universities']:
   specific=row.get('sourceSpecific',{})
   profile=specific.get('profileUrl') or specific.get('institutionUrl')
   if not profile and specific.get('profilePath'):profile='https://www.timeshighereducation.com'+specific['profilePath']
   rows.append(dict(id=f"{edition}:{row['rowNumber']}",name=row['name'],country=row.get('countryOrRegion') or '',region=row.get('city') or '',rankText=row['rankText'],rankNumber=row.get('rankNumber'),rowNumber=row['rowNumber'],sourceId=str(specific.get('qsCoreId') or specific.get('qsId') or specific.get('theId') or specific.get('usNewsId') or specific.get('arwuSlug') or ''),sourceUrl=profile or doc['source']['url']))
  result=dict(schemaVersion='uapt-ranking-browser-v1',edition=edition,systemId=system,year=year,sourceUrl=doc['source']['url'],sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),rankType='derived_metric_order' if system=='cwts' else 'official_ordinal',rows=rows)
  if edition=='the-2027':result['unrankedCount']=849
  if edition=='usnews-2026-2027':result['unrankedCount']=354
  (output/f'{edition}.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
  print(edition,len(rows))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--candidate',required=True,type=Path);p.add_argument('--repo',type=Path,default=Path.cwd());a=p.parse_args();export(a.candidate,a.repo)
