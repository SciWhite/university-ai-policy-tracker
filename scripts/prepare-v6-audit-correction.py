#!/usr/bin/env python3
"""Prepare a bounded, immutable ten-school correction from the published V6 package.
Preparation is local. Candidate semantic acceptance and sync gates precede cutover.
"""
from pathlib import Path
from copy import deepcopy
import json, hashlib, datetime, re
ROOT=Path(__file__).resolve().parents[1]
TASK=ROOT/'.local/v6-audit-fix';AUDIT=ROOT/'.local/v6-merged-audit-20261013'
REV='v6-audit-fix-20261014';NOW=datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z')
load=lambda p:json.loads(p.read_text());sha=lambda b:hashlib.sha256(b).hexdigest()
def canonical(o):return json.dumps(o,ensure_ascii=False,separators=(',',':'))
def write(p,o):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(o,ensure_ascii=False,indent=2)+'\n')
parent=ROOT/'data/public-v6-pages/revisions/v6-pages-20261013.json';assert sha(parent.read_bytes())=='22f5065b047e0b7c730bc3cb023f92e7cda61bfde974949b6ef026127d338bfa';old=load(parent);p=deepcopy(old);p.update(releaseId=REV,canonicalDatasetChanged=True,publicationKind='scoped_record_correction',publishedAt=NOW)
lookup={x['path']:x for x in load(AUDIT/'tracker-readback.json')['routes']}
baselines={s:load(AUDIT/lookup['/api/public/v1/universities/'+s+'.json']['file'])['data']for s in p['slugs']}
snapshotlookup={x['path'].split('/')[-1][:-5]:x for x in load(AUDIT/'snapshot-readback.json')}
records=[];historical={};tools={};changed={};snapshots={};revisions={};before={};held={}
# This is a retained indexed official-page representation, not a direct HTML/PDF fetch.
indexed=(TASK/'mpls-indexed-tool-result.txt').read_text();idxhash=sha(indexed.encode());mpls='https://www.mpls.ox.ac.uk/graduate-school/information-for-postgraduate-research-students/generative-ai'
localquote='The use of local editing tools—such as grammar assistants, code debuggers, and spell-checkers—is permitted and need not be declared.'
backgroundquote='The use of AI tools for background research, language translation, creation of bibliography indices and general subject understanding is allowed and does not have to be declared.'
for q in [localquote,backgroundquote]:
 assert q in indexed, 'Required official indexed quote not retained'
for slug in p['slugs']:
 base=deepcopy(baselines[slug]);historical[slug]={'baseline':deepcopy(base),'snapshot':None,'heldClaims':[]};src=old['locales']['en'];view=src['views'].get(slug);local=src['localEvidence'].get(slug)
 record=deepcopy(local['record']if local else base);record['claims']=deepcopy(view['claims']if view else record['claims']);record['officialSources']=deepcopy(view['sources']if view else record['officialSources']);record.pop('policySnapshot',None)
 for c in list(record['claims']):
  if c['reviewState']not in ['agent_reviewed','human_reviewed'] or c['id']=='draft-nus-statute6-disciplinary-appeals':
   historical[slug]['heldClaims'].append(deepcopy(c));record['claims'].remove(c)
 for c in base['claims']:
  if c['id']not in [x['id']for x in record['claims']] and c['id']not in [x['id']for x in historical[slug]['heldClaims']]:historical[slug]['heldClaims'].append(deepcopy(c))
 for c in record['claims']:
  if c['id']=='claim-stanford-university-maintenance-20260604-3':c['claimType']='other';c['lastChangedAt']=NOW
  if slug=='california-institute-of-technology'and c['id'].startswith('cc-caltech-admissions-ethics-')and not c['id'].endswith('-5'):c['claimType']='other';c['lastChangedAt']=NOW
  if slug=='california-institute-of-technology'and c['id']=='cl-california-institute-of-technology-microsoft-copilot-for-m365-59':
   c['claimText']='Caltech IMSS lists its Windows 11 Copilot service as available and free. The official table labels that entry “Microsoft 365 Copilot for Windows 11”; this is kept as the source’s original label and does not establish availability of the separate Microsoft 365 Copilot for Education service.';c['lastChangedAt']=NOW
  if slug=='university-of-oxford':
   c['evidence']=[e for e in c['evidence']if '[wordlim:'not in e['evidenceSnippet']and 'Crawled:'not in e['evidenceSnippet']]
   if c['id']=='clm-university-of-oxford-ai-pgr-permitted-uses':
    template=deepcopy(c['evidence'][0]);attr=deepcopy(template['attribution']);attr.update(id='ss-mpls-indexed-'+idxhash[:12],snapshotHash=idxhash,retrievedAt=NOW,trackerCheckedAt=NOW,sourceType='official_guidance');attr['sourceRights']+=' Snapshot hash identifies the retained indexed official-page text representation; direct HTTP retrieval was restricted.'
    for n,q in enumerate([localquote,backgroundquote]):
     e=deepcopy(template);e.update(id='ev-mpls-permitted-indexed-'+str(n),evidenceSnippet=q,sourceSnapshotHash=idxhash,retrievedAt=NOW,snippetLocation='Permissible use; indexed official-page text (index last crawled the previous month), retrieved '+NOW+'; direct HTTP fetch restricted',attribution=deepcopy(attr));e.pop('evidenceSnippetDisplay',None);c['evidence'].append(e)
    c['lastChangedAt']=NOW;c['lastCheckedAt']=NOW
  for e in c['evidence']:
   e['attribution']['citationTitle']=re.sub(r'Email:(?:Phone:)?Back to top','',e['attribution']['citationTitle']).strip()
  assert c['evidence']
 for source in record['officialSources']:source['citationTitle']=re.sub(r'Email:(?:Phone:)?Back to top','',source['citationTitle']).strip()
 for c in record['claims']:
  for e in c['evidence']:
   if not any(s['sourceUrl']==e['attribution']['sourceUrl']and s['snapshotHash']==e['attribution']['snapshotHash']for s in record['officialSources']):record['officialSources'].append(deepcopy(e['attribution']))
 if slug=='ucl':record['entity']['name']='University College London (UCL)';record['entity']['aliases']=list(dict.fromkeys(record['entity'].get('aliases',[])+['UCL','University College London','University College London (UCL)','伦敦大学学院','伦敦大学学院（UCL）','伦敦大学學院']))
 if slug=='eth-zurich':record['entity']['name']='ETH Zurich (Swiss Federal Institute of Technology Zurich)';record['entity']['aliases']=list(dict.fromkeys(record['entity'].get('aliases',[])+['ETH Zurich','Swiss Federal Institute of Technology Zurich','苏黎世联邦理工学院']))
 record.update(lastChangedAt=NOW,reviewState='agent_reviewed',summary=f"{record['entity']['name']}: {len(record['claims'])} reviewed current record claims in scoped correction {REV}. Unit, course, publisher and data-use conditions remain distinct; recorded gaps and held historical material are preserved.")
 record['canonicalUrl']='https://eduaipolicy.org/universities/'+slug;record['publicPageUrl']=record['canonicalUrl'];record['apiUrl']='https://eduaipolicy.org/api/public/v1/universities/'+slug+'.json';record['entity']['canonicalUrl']=record['canonicalUrl'];record['citationTitle']=record['entity']['name']+' AI Policy Tracker record'
 record['lastCheckedAt']=max([c.get('lastCheckedAt','')for c in record['claims']]+[base.get('lastCheckedAt','')])
 limits=[x for x in record.get('limitations',[])if not any(w in x for w in ['machine-candidate snapshot','publicationApproved=false','new dual-agent','Candidate Repair'])]
 record['limitations']=list(dict.fromkeys(limits+['Scoped record correction '+REV+'; global dataset release remains public-release-20260924-002. Record revision and checked/source dates are separate.','Historical and held records are retained in the revision history and are not current permission conclusions.','The record claims are agent-reviewed; a student snapshot requires its own matching-basis review.','Confidence describes extraction/review metadata, not a calibrated probability of factual accuracy.']))
 if slug=='university-of-oxford':record['limitations'].append('MPLS evidence includes retained indexed official text. Direct page access was restricted; no live HTML/PDF hash or full currentness verification is claimed for that representation.')
 record['suggestedCitation']=f"University AI Policy Tracker. {record['citationTitle']}. Record revision {REV}. Evidence checked {record['lastCheckedAt'][:10]}; record correction published {NOW[:10]}. {record['canonicalUrl']}"
 recordhash=sha(canonical(record).encode());revisions[slug]={'universityRevisionId':REV,'datasetReleaseId':'public-release-20260924-002','recordSha256':recordhash,'publishedAt':NOW};before[slug]={'hash':sha(canonical(base).encode()),'claimIds':[c['id']for c in base['claims']]};changed[slug]={'addedClaimIds':[c['id']for c in record['claims']if c['id']not in before[slug]['claimIds']],'updatedClaimIds':[c['id']for c in record['claims']if any(b['id']==c['id']and canonical(b)!=canonical(c)for b in base['claims'])],'heldClaimIds':[c['id']for c in historical[slug]['heldClaims']]};held[slug]=historical[slug]['heldClaims'];records.append(record)
 tools[slug]=deepcopy(view['tools']if view else local['tools']if local else [])
 if local:
  for row in local['hmsTools']:
   tools[slug].append({'universitySlug':slug,'universityName':record['entity']['name'],'rawToolName':row['name']+' (HMS)','tool':'institutional_ai_service','description':'HMS only. '+row['useCases']+'. Data level: '+row['dataLevel']+'. Eligible users: '+row['eligibility']+'. Required training: '+row['trainingRequired']+'. Access does not establish course or assessment permission.','howToObtain':'Check HMS IT eligibility and required training: '+row['sourceUrl'],'costToUser':row['cost'],'availability':'conditionally_allowed','endorsementType':'institutionally_licensed_or_procured','reviewState':'agent_reviewed','sourceLanguage':'en','evidence':[{'sourceUrl':row['sourceUrl'],'evidenceSnippet':row['originalTableRow'],'snapshotHash':row['sourceTextSha256'],'reviewState':'agent_reviewed'}]})
 if not tools[slug]:
  prior=load(AUDIT/'8f25f5dccdd76b72.json');tools[slug]=[t for t in prior['data']['records']if t['universitySlug']==slug]
 for t in tools[slug]:
  t['universityName']=record['entity']['name']
  if t.get('tool','').startswith('proposed:'):t['tool']='institutional_ai_service'
  if slug=='california-institute-of-technology'and 'Windows 11'in t['rawToolName']:t['tool']='microsoft_copilot'
  for e in t['evidence']:
   if 'citationTitle'in e:e['citationTitle']=re.sub(r'Email:(?:Phone:)?Back to top','',e['citationTitle']).strip()
 # All new public presentation representations reference the reviewed current records.
 for locale,d in p['locales'].items():
  school=next(s for s in d['schools']if s['slug']==slug);school.update(fingerprint=recordhash,revision=REV,reviewedClaimCount=len(record['claims']),v6ReviewState='agent_reviewed',snapshotStatus='needs_review'if slug in snapshotlookup and snapshotlookup[slug]['status']=='200'else'not_published');school['heldClaims']=[{'id':c['id'],'text':c['claimText']}for c in held[slug]]
  for topic in school['topics']+school['additionalTopics']:
   if slug=='california-institute-of-technology'and topic['key']=='coursework':topic['summary']=topic['summary'].replace('HSS courses require prior written instructor permission','HSS courses permit AI only in ways explicitly allowed by the instructor in the course materials')
   if slug=='university-of-oxford'and topic['key']=='approved_tools':topic['summary']='The former public AI Competency Centre guide lists institutional SSO tools and data ratings, but is no longer maintained and points to successor guidance. Access is not assessment permission; current detailed tool approvals must be checked in the successor service.'
   if re.fullmatch(r'[a-z]+(?:_[a-z]+)+',topic['scope']):topic['scope']='University teaching and learning; the course instructor’s assessment rules apply.'if locale!='zh'else'全校教学与学习；具体考核须遵守任课教师规则。'
   topic['claims']=[c for c in topic['claims']if c['id']!='draft-nus-statute6-disciplinary-appeals'and not(topic['key']=='teaching_guidance'and c['id']=='claim-stanford-university-maintenance-20260604-3')]
   for c in topic['claims']:
    rc=next((x for x in record['claims']if x['id']==c['id']),None)
    if rc:c['text']=rc['claimText'];c['checkedAt']=rc.get('lastCheckedAt');c['evidence']=[{'quote':e['evidenceSnippet'],'url':e['sourceUrl'],'title':e['attribution']['citationTitle'],'language':e.get('sourceLanguage','en'),'location':e.get('snippetLocation'),'retrievedAt':e.get('retrievedAt',e['attribution'].get('retrievedAt'))}for e in rc['evidence']]
    else:
     # Bundle topic groups are source objects, not individual Claims.
     c['basisObjectType']='source'
     for e in c['evidence']:
      e['title']=re.sub(r'Email:(?:Phone:)?Back to top','',e['title']).strip()
      if '[wordlim:'in e['quote']or 'Crawled:'in e['quote']:e['quote']=localquote+'\n\n'+backgroundquote;e['location']='Permissible use; indexed official-page excerpts; direct HTTP restricted';e['retrievedAt']=NOW
  if slug in d['views']:
   v=d['views'][slug];v['school']=deepcopy(school);v['claims']=deepcopy(record['claims']);v['sources']=deepcopy(record['officialSources']);v['tools']=deepcopy(tools[slug]);v['publication']={'releaseId':REV,'kind':'scoped_record_correction','publishedAt':NOW};v['heldDraftIds']=list(dict.fromkeys(v.get('heldDraftIds',[])+[c['id']for c in held[slug]if c['id']not in [x['id']for x in record['claims']]]));v['gaps']=[g.replace('held pending authorized publication','not a published strong student snapshot')for g in v['gaps']]
  if slug in d['localEvidence']:
   e=d['localEvidence'][slug];e['record']=deepcopy(record);e['fingerprint']=recordhash;e['revision']=REV;e['tools']=deepcopy([t for t in tools[slug]if t['rawToolName']not in [h['name']+' (HMS)'for h in e['hmsTools']]]);e['publication']={'releaseId':REV,'kind':'scoped_record_correction','publishedAt':NOW}
  d['entities'][slug]['recordRevision']=REV
 snapinfo=snapshotlookup.get(slug)
 if snapinfo and snapinfo['status']=='200':historical[slug]['snapshot']=load(AUDIT/snapinfo['file']).get('data');snapshots[slug]=deepcopy(historical[slug]['snapshot'])
# Snapshot regeneration is completed by the shared schema/fingerprint validator in TS.
write(TASK/'prepared-records.json',{'schemaVersion':'uapt-v6-effective-records-v1','revision':REV,'publishedAt':NOW,'datasetReleaseId':'public-release-20260924-002','publicationApproved':True,'summaries':records,'historical':historical,'heldBySlug':held,'toolsBySlug':tools,'recordRevisions':revisions,'changesBySlug':changed,'snapshotInputs':snapshots,'aliasesBySlug':{r['entity']['slug']:r['entity'].get('aliases',[])for r in records}})
write(TASK/'prepared-pages.json',p);write(TASK/'preparation.json',{'revision':REV,'preparedAt':NOW,'parentPagePackageSha256':pointer['sha256'],'currentClaimCount':sum(len(r['claims'])for r in records),'currentClaimIdsBySlug':{r['entity']['slug']:[c['id']for c in r['claims']]for r in records},'historicalIdsBySlug':{s:[c['id']for c in v]for s,v in held.items()},'originalClaimsRetained':all(all(c['id']in [r['id']for r in next(x for x in records if x['entity']['slug']==s)['claims']]+[h['id']for h in held[s]]for c in b['claims'])for s,b in baselines.items())})
print('Prepared',len(records),'schools',sum(len(r['claims'])for r in records),'current claims; source pointers unchanged')
