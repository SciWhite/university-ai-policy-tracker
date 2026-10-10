import sys, pathlib, json, subprocess, re, hashlib, datetime, copy
# Requires beautifulsoup4 and pypdf in the selected Python environment.
from bs4 import BeautifulSoup
from pypdf import PdfReader
root=pathlib.Path(__file__).resolve().parents[1]
out=root/'data/public-record-repairs/mit-20261010';out.mkdir(parents=True,exist_ok=True)
raw=root/'.local/mit-repair-evidence';raw.mkdir(parents=True,exist_ok=True)
now=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
slug='massachusetts-institute-of-technology';prefix='clm-'+slug+'-'
urls={
 'eo':'https://www.whitehouse.gov/presidential-actions/2025/01/removing-barriers-to-american-leadership-in-artificial-intelligence/',
 'guidance':'https://ist.mit.edu/ai-guidance','tools':'https://ist.mit.edu/ai-tools',
 'library':'https://libguides.mit.edu/cite-AI-tools','chair':'https://facultygovernance.mit.edu/communications-chair',
 'tll':'https://tll.mit.edu/teaching-resources/course-design/ai-in-teaching-learning/gen-ai-your-course/',
 'report':'https://sites.mit.edu/ai-use/ai-committee-final-report-aug-13/',
 'couhes':'https://couhes.mit.edu/researchers/guidelines/artificial-intelligence-ai-research',
 'cod11':'https://cod.mit.edu/rules/section11/','cod12':'https://cod.mit.edu/rules/section12/','support':'https://cod.mit.edu/resources/'}
texts={};soups={};atts={};sources=[]
norm=lambda s:re.sub(r'\s+',' ',s).strip()
for key,url in urls.items():
 ext='pdf' if key=='report' else 'html';p=raw/(key+'.'+ext)
 subprocess.run(['curl','-fLsS','--max-time','45',url,'-o',str(p)],check=True)
 b=p.read_bytes()
 if key=='report':
  reader=PdfReader(p);t='\n'.join('PDF page '+str(i+1)+'\n'+norm(pg.extract_text() or '') for i,pg in enumerate(reader.pages));title="Report of MIT's Ad Hoc Committee on AI Use, August 13, 2026"
 else:
  soup=BeautifulSoup(b,'html.parser');soups[key]=soup;title=soup.title.get_text(' ',strip=True) if soup.title else url
  for x in soup(['script','style','nav','header','footer']):x.decompose()
  t='\n'.join(norm(s) for s in soup.get_text('\n',strip=True).splitlines() if norm(s))
 texts[key]=t;(raw/(key+'.txt')).write_text(t)
 h=hashlib.sha256(t.encode()).hexdigest()
 atts[key]={'id':'mit-current-'+key+'-'+h[:12],'sourceUrl':url,'finalUrl':url,'citationTitle':title,'publisher':'The White House' if key=='eo' else 'Massachusetts Institute of Technology','retrievedAt':now,'trackerCheckedAt':now,'snapshotHash':h,'sourceType':'official_pdf' if key=='report' else 'official_guidance','official':True,'sourceRights':'Tracker metadata is open licensed. Official source documents, page text, PDFs, and other source materials retain their original rights and terms.'}
 sources.append({'key':key,'sourceUrl':url,'retrievedAt':now,'rawSha256':hashlib.sha256(b).hexdigest(),'normalizedTextSha256':h,'normalization':'HTML textContent, whitespace normalization; PDF extracted text with actual page markers','rawBytes':len(b)})
baseline=json.load(open(out/'baseline.json'));record=copy.deepcopy(baseline);claims=record['claims'];byid={c['id']:c for c in claims}
def evidence(key,quote,location,identifier):
 t=texts[key];q=norm(quote)
 assert q in norm(t),(key,q)
 # Quotes use only contiguous words present in the source, not generated prose.
 if len(q)>700:q=q[:690].rsplit(' ',1)[0]
 assert 0<len(q)<=700
 start=norm(t).index(q);cursor=0;startline=1;endline=1
 for i,s in enumerate(t.splitlines()):
  length=len(norm(s))
  if cursor<=start<cursor+length+1:startline=i+1
  if cursor<=start+len(q)-1<cursor+length+1:endline=i+1
  cursor+=length+1
 line=startline
 return {'id':'mit-20261010-'+identifier,'sourceUrl':urls[key],'sourceLanguage':'en','sourceSnapshotHash':atts[key]['snapshotHash'],'evidenceSnippet':q,'snippetLocation':location+'; normalized text lines '+str(startline)+'-'+str(endline),'retrievedAt':now,'attribution':copy.deepcopy(atts[key])}
def quote(key,needle):
 t=norm(texts[key]);start=t.index(needle);tail=t[start:];return tail.split('. ')[0]+('.' if not tail.split('. ')[0].endswith('.') else '')
def update(id,text,type,key,q,loc,value=None):
 c=byid[id];c.update(claimText=text,claimType=type,reviewState='agent_reviewed',lastCheckedAt=now,lastChangedAt=now,confidence=0.95,evidence=[evidence(key,q,loc,id[-40:])]);
 if value is not None:c['claimValue']=json.dumps(value,separators=(',',':'),ensure_ascii=False)
def add(suffix,text,type,key,q,loc):
 id=prefix+suffix;c={'id':id,'entitySlug':slug,'entityType':'university','claimType':type,'claimText':text,'confidence':0.95,'reviewState':'agent_reviewed','lastCheckedAt':now,'lastChangedAt':now,'evidence':[evidence(key,q,loc,suffix)]};claims.append(c);byid[id]=c
q=quote('guidance','Do not use high-risk information')
update(prefix+'high-risk-prohibition','MIT does not permit Medium Risk data in publicly available GenAI tools. High Risk MIT information must not be used with any GenAI tool, including MIT enterprise tools; report an existing high-risk disclosure to security@mit.edu immediately. Public tools are not recommended for Low Risk MIT data.','privacy','guidance',q,'Determine the Risk Level of Your Data Before Using AI Tools, risk matrix and ** footnote')
byid[prefix+'high-risk-prohibition']['evidence'].append(evidence('guidance','Medium Risk Data Not allowed Allowed','Risk matrix: public tool versus MIT-licensed tool','medium-risk-matrix'))
byid[prefix+'high-risk-prohibition']['evidence'].append(evidence('guidance','Low Risk Data Not recommended* Allowed','Risk matrix: public tool versus MIT-licensed tool','low-risk-matrix'))
update(prefix+'compliance','MIT guidance requires GenAI use to comply with applicable law, Institute policies, Information Protection guidelines, WISP, and applicable DLCI policies. The linked IS&T page still mentions EO 14110; that revoked order is not presented here as a current legal obligation.','other','guidance',quote('guidance','As with any use of information technology at MIT'),'Compliance with Federal and State Laws and Orders')
byid[prefix+'compliance']['evidence'].append(evidence('guidance',"Information Protection , the Institute's Written Information Security Program (WISP), and complies with any additional policies established by your department, lab, center, or institute (DLCI).",'Compliance with Federal and State Laws and Orders, closing clause','compliance-institute'))
byid[prefix+'compliance']['evidence'].append(evidence('eo','the revoked Executive Order 14110 of October 30, 2023 (Safe, Secure, and Trustworthy Development and Use of Artificial Intelligence).','January 23, 2025 order, §5(a)','eo-revocation'))
update(prefix+'disclosure','MIT Libraries advises citing or acknowledging AI contributions in academic papers and consulting the applicable school, class, and publication policies. This is citation guidance, not a universal assessment-use permission or a new university-wide mandatory disclosure rule.','academic_integrity','library',quote('library','If AI is used in the creation'),'Can AI be an author? / Important!')
byid[prefix+'disclosure']['evidence'].append(evidence('library','Know the AI use and citation policy for the school, class, and/or publication for which you are writing.','Important!','citation-scope'))
update(prefix+'accuracy-responsibility','MIT Libraries states that authors are responsible for their work and advises verifying information provided by generative AI. Scope: academic and research writing guidance.','research','library','Authors are responsible for all content in their work.','Can AI be an author?')
byid[prefix+'accuracy-responsibility']['evidence'].append(evidence('library',quote('library','Be sure to verify information'),'Note about the accuracy AI tools’ outputs','accuracy-check'))
update(prefix+'ai-procurement-review',"Purchasing new GenAI tools at MIT requires the VPF procurement process. For a tool not on IS&T's list, request an assessment from ai-guidance@mit.edu before use or purchase.",'procurement','guidance',quote('guidance','If you wish to purchase new Generative AI tools'),'Generative AI Tools Licensed by MIT, final paragraph')
update(prefix+'approved-tools-list',"IS&T lists MIT-licensed GenAI tools approved for low- and medium-risk information. Tools not listed require an assessment before use or purchase; no GenAI tool is approved for High Risk MIT information. Tool access does not authorize coursework or exam use.",'security_review','tools',quote('tools','If a tool or service you wish to use'),'Opening assessment requirement and approved-tools heading')
byid[prefix+'approved-tools-list']['evidence'].append(evidence('tools','The following tools are approved for use with low- and medium-risk information','Available through IS&T for use by MIT','approved-tools-risk'))
for suffix in ['risk-assessment-uses','existing-tool-review']:
 c=byid[prefix+suffix];c['claimValue']=json.dumps({'auditStatus':'STALE','historicalClaimText':c['claimText'],'currentApplicability':'unverified','auditRevision':'mit-20261010'})
 c['claimText']='Historical IS&T guidance captured on May 6, 2026: '+c['claimText']+' This specific provision is not reproduced on the current guidance page; its current applicability has not been confirmed.'
 c['claimType']='source_status';c['reviewState']='needs_review';c['lastChangedAt']=now
 for e in c['evidence']:e['attribution']['sourceType']='archived_official_source'
for c in claims[:]:
 if c['claimType']!='ai_tool_treatment':continue
 value=json.loads(c['claimValue']);name=value['rawToolName'];row=next(tr for tr in soups['tools'].select('tr') if tr.find_all(['td','th']) and norm(tr.find_all(['td','th'])[0].get_text(' ',strip=True))==name)
 cells=[norm(td.get_text(' ',strip=True)) for td in row.find_all('td')];assert len(cells)==5
 q=' '.join(cells);q=q[:700] if len(q)>700 else q
 value.update(description=cells[1],availableTo=cells[2],costToUser=cells[3],howToObtain=cells[4],dataCondition='MIT-licensed access only; low/medium-risk information; no High Risk information',assessmentPermission='not_established_by_tool_access')
 text=f"{name} is listed by MIT IS&T for {cells[2]}. Cost: {cells[3]}. Institutional access and data restrictions do not establish assessment permission."
 update(c['id'],text,'ai_tool_treatment','tools',q,'Generative AI tools table: '+name+' row, all five columns',value)
add('course-policy-framework','For Fall 2026, MIT faculty guidance states that there are no Institute-wide requirements for setting classroom AI-use policies. Instructors are encouraged to publish clear course policies; sample policy menus are not adopted rules for every course.','teaching','chair','For Fall 2026, as in previous years, there are no Institute-wide requirements for setting policies on AI use in classes.','Generative AI Use Policies, first paragraph')
add('detector-output-not-sufficient',"MIT's August 13, 2026 committee report states that COD does not consider AI-detector output alone sufficient for an AI-related academic integrity case. This records the committee's description of COD practice, not a blanket detector ban.",'academic_integrity','report','the COD itself does not consider AI detector output alone sufficient.','PDF actual page 19 (printed page 17), §3.1.9, Preparing our disciplinary system')
add('tll-detector-recommendation','MIT TLL strongly recommends against using AI-detection tools. This is teaching guidance, not a university-wide statutory prohibition.','teaching','tll','Please note that TLL strongly recommends against the use of AI detection tools for the reasons described in the articles above.','Define Acceptable Use, AI-detection resources')
add('thesis-ai-acknowledgment',"MIT's August 2026 committee report recommends AI-use statements in all theses and says AI should not be listed as a co-author. Researchers should also check journal and conference requirements. This is a committee recommendation; a new mandatory thesis rule has not been established by this source.",'research','report','All theses should include a statement about how AI was used in the production of the thesis. AI should never be listed as a co-author.','PDF actual page 24 (printed page 22), §3.2.6')
add('human-subject-ai-consent','For applicable AI human-subjects research applications, COUHES guidance requires available Data Cards and adequate consent transparency. Model Cards are recommended when developing or further developing a model; this does not apply to all coursework.','research','couhes','Investigators must include a Data Card when available for the particular research project.','When appropriate, submitting a new application involving AI')
byid[prefix+'human-subject-ai-consent']['evidence'].append(evidence('couhes','In addition to the Data and Model Cards, investigators must ensure the Consent provides adequate information for subjects to make a fully informed decision and transparency in the use of AI and study purpose is paramount.','Consent paragraph','human-subject-consent'))
byid[prefix+'human-subject-ai-consent']['evidence'].append(evidence('couhes','If the purpose of the research is to develop a new AI model or further develop an existing AI model, investigators should include a Model Card','Model Card recommendation','human-subject-model-card'))
add('cod-disability-accommodations','Students needing disability accommodations to participate in a COD process are directed to Disability and Access Services. This is a general disciplinary procedure resource, not an AI-specific sanction.','academic_integrity','support','If you have a disability and need an accommodation to participate in any part of the COD process, please contact Disability and Access Services','Student Disability and Access Services')
add('suspension-return-limits','Permission to return to MIT after suspension does not guarantee return to the same department, degree program, lab group, or related position. This is a general COD sanction condition, not an AI-specific penalty.','academic_integrity','cod11','Students allowed to return to the Institute after being suspended are not guaranteed to be able to return to the department, specific degree program, lab group, or any related position that they were in prior to their suspension.','§XI.D, paragraph after permission to return')
record['officialSources']=list({(e['sourceUrl'],e['sourceSnapshotHash']):e['attribution'] for c in claims for e in c['evidence']}.values())
record.update(lastCheckedAt=now,lastChangedAt=now,reviewState='needs_review',confidence=0.95)
record['summary']=f"MIT's record was corrected against official sources on October 10, 2026. It includes {len(claims)-2} current reviewed claims and 2 explicitly held historical provisions. Course-specific permission remains separate from tool access."
record['entity']['summary']=record['summary'];record['limitations']+=['Scoped published repair: mit-20261010. The global dataset release ID is unchanged; this record revision is identified by its own hash.','Two historical provisions remain needs_review. Current sources were recaptured; historical snippet authenticity remains a separate audit question.','Confidence is an extraction/review signal, not a calibrated factual accuracy rate.'];record.pop('policySnapshot',None)
record['suggestedCitation']='University AI Policy Tracker. MIT AI policy record. Scoped repair mit-20261010. Last checked October 10, 2026. '+record['canonicalUrl']
def write(path,value):path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
write(out/'record.json',record);write(out/'baseline.json',baseline);write(out/'source-provenance.json',sources)
print(json.dumps({'claims':len(claims),'reviewed':len(claims)-2,'sources':len(record['officialSources']),'retrievedAt':now}))
