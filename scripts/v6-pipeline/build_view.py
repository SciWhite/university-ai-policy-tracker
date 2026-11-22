#!/usr/bin/env python3
"""S3 build each school's local V6 view from inputs/<abbr>.json (docs/v6-pipeline.md; INPUT-SPEC in scripts/v6-pipeline/prompts).

  python3 scripts/v6-pipeline/build_view.py --workspace <dir> [abbr ...]

Refuses unless the discovery gate (G1) passed on the current captures: drafting starts only after discovery is complete.
Evidence selectors are [captureKey, firstLine, lastLine] (1-based, inclusive, lines of captures/<abbr>/<key>.txt);
a string instead of a line number selects the first line containing it. Every quote is re-checked against the
captured text; public Claim IDs, historical records and tools are each given an explicit disposition.
Output per school: bundle/, mapping.json, view-adapted.json, view-prehash.json, audit.json.
"""
import json, hashlib, copy, os, sys, subprocess
from pathlib import Path
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v6batch as Bt  # noqa: E402
import gates  # noqa: E402

P, args = Bt.workspace_from_argv()
BATCH = Bt.load(P)
W = Bt.REPO
override = os.environ.get('UAPT_V6_DRAFT_WITHOUT_DISCOVERY_GATE', '').strip()
if override:
    print('WARNING: discovery gate skipped; reason recorded in audit.json: ' + override, file=sys.stderr)
else:
    gates.require(P, BATCH, 'discovery')
NOW = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
def get(p): return json.loads(p.read_text())
def put(p, d): p.parent.mkdir(parents=True, exist_ok=True); p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
def h(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def sha(s): return hashlib.sha256(s.encode()).hexdigest()
def bl(s): return {'en': s, 'zh': ''}
keys = ['coursework', 'exams', 'disclosure', 'privacy_data', 'approved_tools', 'research_publication', 'academic_integrity', 'teaching_guidance', 'security_procurement']
titles = ['Coursework', 'Exams and assessments', 'Disclosure and citation', 'Privacy and data', 'Tools and access', 'Research and publication', 'Academic integrity', 'Teaching guidance', 'Security and tool approval']
STATUSES = {'allowed', 'conditionally_allowed', 'restricted', 'blocked', 'required', 'recommended', 'not_mentioned', 'unclear', 'insufficient_public_evidence'}
REVISION = BATCH['revision']
EDITION = BATCH.get('rankingEdition', 'QS 2026')
LOCAL_PREFIX = BATCH.get('localRevisionPrefix', 'qs2026')

for school in Bt.schools(BATCH, args):
    slug, rank, abbr = school['slug'], str(school['rank']), school['abbr']
    cfg = get(P / 'inputs' / f'{abbr}.json')
    d = P / slug; bundle = d / 'bundle'; out = bundle / 'outputs'
    if out.exists():
        sys.exit(f'{out} exists; remove the school directory outputs explicitly before rebuilding')
    public = get(d / 'public.json')['data']; name = public['entity']['name']
    assert public['entity']['slug'] == slug and (not EDITION or any((EDITION + ' ' + rank) in a for a in public['entity']['aliases'])), (slug, 'rank alias missing')
    history = get(d / 'historical-inventory.json'); old = history['records']; bypublic = {r['id']: r for r in old if r['layer'] == 'basic'}
    current = public['claims']
    assert [c['id'] for c in current] == [c['claimId'] for c in cfg['claims']], 'inputs.claims must follow public order with claimId'
    assert set(bypublic) == {c['id'] for c in current}, 'Historic and live public IDs diverged'
    captures = P / 'captures' / abbr
    source_data = {f.stem: get(f) for f in sorted(captures.glob('*.json'))}
    source_map = {}; bindings = {}

    def source(k):
        if k in source_map: return source_map[k]
        m = source_data[k]; raw = captures / (k + '.body'); txt = captures / (k + '.txt')
        assert m['status'] == '200' and raw.exists() and txt.exists(), (abbr, k, m.get('status'))
        assert h(raw) == m['rawSha256'] and h(txt) == m['textSha256'], (abbr, k)
        sid = 'source-' + sha(m['url'])[:16]
        rawrel = 'sources/' + raw.name; textrel = 'sources/' + txt.name
        (bundle / 'sources').mkdir(parents=True, exist_ok=True)
        for r, rel in [(raw, rawrel), (txt, textrel)]:
            dest = bundle / rel
            if not dest.exists(): dest.hardlink_to(r)
        s = dict(sourceId=sid, url=m['url'], title=cfg['titles'].get(k, k), rawFile=rawrel, textFile=textrel, rawSha256=h(raw), textSha256=h(txt),
                 language=m['language'], retrievedAt=m['retrievedAt'], publisher=name, documentKind=m['kind'])
        source_map[k] = s
        return s

    def bind(e):
        e = tuple(e if len(e) == 3 else (e[0], e[1], e[1]))
        if e in bindings: return bindings[e]['evidenceId']
        k, i, j = e; src = source(k); meta = source_data[k]
        txt = (bundle / src['textFile']).read_text(); lines = txt.split('\n')
        def resolve(x, start=0):
            if isinstance(x, int): return x - 1
            result = [n for n in range(start, len(lines)) if x in lines[n]]
            assert result, (abbr, k, x)
            return result[0]
        first = resolve(i); last = resolve(j, first)
        assert 0 <= first <= last < len(lines), (abbr, e)
        start = sum(len(l) + 1 for l in lines[:first]); full = '\n'.join(lines[first:last + 1])
        left = len(full) - len(full.lstrip()); quote = full.strip(); start += left
        assert quote and txt[start:start + len(quote)] == quote, (abbr, e)
        if meta['kind'] == 'pdf':
            page1 = txt.count('\f', 0, start) + 1; page2 = txt.count('\f', 0, start + len(quote)) + 1
            location = f'Physical PDF page {page1}' if page1 == page2 else f'Physical PDF pages {page1}–{page2}'
        elif meta['kind'] == 'docx':
            location = 'Official DOCX template; extracted paragraph text'
        else:
            location = 'Official web page'
        eid = 'ev-' + abbr + '-' + k + '-' + str(first + 1) + '-' + str(last + 1)
        bindings[e] = dict(evidenceId=eid, sourceId=src['sourceId'], sourceUrl=src['url'], quote=quote, quoteSha256=sha(quote), charStart=start,
                           charEnd=start + len(quote), lineStart=first + 1, lineEnd=last + 1, location=location)
        return eid

    def ids(seq): return list(dict.fromkeys(bind(e) for e in seq))
    publicclaims = []; facts = []; record_audit = {}; project = {}; decisions = {}; held = []
    for idx, (c, ci) in enumerate(zip(current, cfg['claims'], strict=True), 1):
        rid = c['id']; obj = bypublic[rid]; key = obj['recordKey']; ee = ids(ci.get('evidence', []))
        status = ci['status']; new = ci['text']; scope = ci.get('scope') or cfg['scope']
        audit = dict(recordKey=key, originalId=rid, status=status, originalStatement=c['claimText'], localStatement=new, scope=scope,
                     reason=ci.get('reason') or 'Meaning and scope checked against the captured official sources.', evidenceIds=ee, publicationApproved=False)
        record_audit[key] = audit; decisions[rid] = audit
        project['p' + str(idx)] = (rid, scope, ee)
        display = 'VERIFIED' if ee and status not in ['UNVERIFIED', 'BROKEN_SOURCE', 'STALE', 'CONTRADICTED'] else 'UNVERIFIED'
        if display == 'UNVERIFIED': held.append(rid)
        publicclaims.append(dict(claimId=rid, claimType=c['claimType'], auditStatus=display, sourceAuditStatus=status, useReviewedReplacement=True,
                                 originalClaimText=c['claimText'], suggestedClaimEn=new, evidenceIds=ee, scope=scope, checkedAt=NOW))
    for k, f in cfg.get('facts', {}).items():
        rid = 'local-' + abbr + '-v6-' + k; ee = ids(f['evidence']); project[k] = (rid, f['scope'], ee)
        facts.append(dict(draftId=rid, statement=f['text'], auditStatus='VERIFIED', reviewState='agent_reviewed', topic=f['topic'], scope=f['scope'], evidenceIds=ee))
    tools = []; toolbasis = {}
    for t0 in cfg.get('tools', []):
        t = copy.deepcopy(t0); key = t.pop('key'); t['evidenceIds'] = ids(t.pop('evidence')); toolbasis[key] = t; tools.append(t)
    tool_audit = []
    for t in get(d / 'public-tools.json'):
        n = t['rawToolName']; target, status, reason = cfg['toolmap'][n]
        tool_audit.append(dict(originalName=n, originalCode=t['tool'], originalAvailability=t['availability'], localName=toolbasis[target]['rawToolName'] if target else None,
                               status=status, reason=reason, evidenceIds=toolbasis[target]['evidenceIds'] if target else [], publicationApproved=False))
    for r in old:
        rk = r['recordKey']; oldrow = r['record']
        if rk in record_audit: continue
        if r['layer'] in ('tools', 'specialist_tools', 'specialist-tools'):
            n = oldrow.get('rawToolName') or oldrow.get('rawProductName') or oldrow.get('product')
            if n in cfg['toolmap'] and cfg['toolmap'][n][0]:
                target, status, reason = cfg['toolmap'][n]
                record_audit[rk] = dict(recordKey=rk, status=status, scope='Product identity and source scope only', reason=reason,
                                        evidenceIds=toolbasis[target]['evidenceIds'], localTool=toolbasis[target]['rawToolName'], publicationApproved=False)
                continue
        marker = next((suffix for suffix in cfg.get('historical', {}) if (r.get('id') or '').endswith(suffix)), None)
        mapped = cfg.get('historical', {}).get(marker)
        if mapped:
            if mapped.startswith('tool:'):
                t = toolbasis[mapped.split(':')[1]]; ee = t['evidenceIds']; rid = t['rawToolName']; scope = 'Named service and source scope'
            else:
                rid, scope, ee = project[mapped]
            record_audit[rk] = dict(recordKey=rk, status='HISTORICAL_CONTEXT', scope=scope, reason='Original record retained; mapped to separately rechecked current local facts. Unmapped details do not enter the view.',
                                    localProjection=rid, evidenceIds=ee, publicationApproved=False)
        else:
            record_audit[rk] = dict(recordKey=rk, status='HELD', scope=r['layer'], reason='Historical object lacks a sufficiently exact current-source mapping for local promotion.', evidenceIds=[], publicationApproved=False)
    assert len(record_audit) == len(old)
    dims = []; ml = {}; summaries = {}; scopes = {}
    assert [t['key'] for t in cfg['topics']] == keys, 'topics must be the nine keys in order'
    for key, title, t in zip(keys, titles, cfg['topics'], strict=True):
        assert t['status'] in STATUSES, (abbr, key, t['status'])
        dims.append(dict(key=key, status=t['status'], summaryEn=t['summary'], scope=t['scope'], evidenceIds=ids(t['evidence']), actions=[]))
        ml[key] = dict(sourceStatus=t['status'], displayStatus=t['status'], title=bl(title), statusLabel=bl(t['label']))
        summaries[key] = bl(t['summary']); scopes[key] = bl(t['scope'])
    workflow_holds = [r['recordKey'] for r in record_audit.values() if r['status'] == 'HELD']
    gaps = list(cfg['gaps'])
    archive_gaps = sum(x['status'] == 'source_object_not_resolved' for x in history['evidenceBindings'])
    if archive_gaps: gaps.append('Some older tracker records cite earlier versions of sources that could not be matched to the current pages; they stay in the record history and are not shown here.')
    if workflow_holds: gaps.append('Historical material requiring separate review is retained in the audit manifest.')  # packets.ts rewords this line for the public page
    rawbundle = dict(schemaVersion='uapt-private-repaired-evidence-bundle-v1', slug=slug, name=name, publicationApproved=False, agentReviewStatus='agent_reviewed', fullInstitutionAuditStatus='PARTIAL', language='en', createdAt=NOW,
                     sources=list(source_map.values()), evidenceBindings=list(bindings.values()), publicClaims=publicclaims, draftRules=facts,
                     originalObjects=[dict(recordKey=r['recordKey'], originalRecord=r['record']) for r in old], studentDimensions=dims[:6], analysisDimensions=dims[6:], tools=tools,
                     remainingRecordKeys=workflow_holds, heldDraftIds=[], workflowHolds=workflow_holds, gaps=[dict(id='gap-' + str(i), description=g) for i, g in enumerate(gaps)])
    put(out / 'bundle.json', rawbundle)
    put(out / 'manifest.json', dict(schemaVersion='uapt-private-audit-repaired-candidate-v1', files={str(f.relative_to(bundle)): dict(sha256=h(f), bytes=f.stat().st_size) for f in sorted(bundle.rglob('*')) if f.is_file()}))
    rev = LOCAL_PREFIX + '-' + abbr + '-local-' + BATCH['batchId']
    mapping = dict(slug=slug, name=name, revision=rev, checkedAt=NOW, sourceBundleSha256=h(out / 'bundle.json'), claimTypes={t: t for t in ['academic_integrity', 'privacy', 'research', 'teaching']},
                   additionalTopicKeys=keys[6:], topics=ml, topicSummaries=summaries, topicScopes=scopes, sourceTitles={}, tools=tools,
                   hero=dict(title=bl('Using AI at ' + name), scope=bl(cfg['scope']), images={'hero': '', 'do': '', 'dont': ''}, actions={'do': [], 'dont': []}), heldClaimIds=held)
    put(d / 'mapping.json', mapping)
    subprocess.run(['python3', str(W / 'scripts/prepare-v6-local-bundle.py'), '--bundle-root', str(bundle), '--mapping', str(d / 'mapping.json'), '--output', str(d / 'view-adapted.json')], check=True)
    view = get(d / 'view-adapted.json'); view['localPreviewLanguage'] = 'en'; view['candidateOnly'] = True
    for topic in view['school']['topics'] + view['school']['additionalTopics']:
        for group in topic['claims']:
            group['checkedAt'] = NOW
            for e in group['evidence']:
                s = next(s for s in source_map.values() if s['sourceId'] == group['id'])
                assert e['quote'] in (bundle / s['textFile']).read_text() and s['url'] == e['url']
                e['hash'] = s['rawSha256']
        topic['sources'] = [dict(url=s['url'], hash=s['rawSha256']) for g in topic['claims'] for s in source_map.values() if s['sourceId'] == g['id']]
    byid = {c['id']: c for c in view['claims']}
    def make(side): return [dict(en=a['text'], zh='', kind=a['kind'], claimIds=[project[x][0] for x in a['refs']]) for a in cfg[side]]
    locact = dict(slug=slug, name=name, experience='compact_evidence', presentationRevision=rev, recordSha256='set-by-node', schoolFingerprint=view['school']['fingerprint'], universityRevisionId=rev,
                  topics={k: dict(en=summaries[k]['en'], zh='', meaningEn=scopes[k]['en'], meaningZh='') for k in keys}, scope=mapping['hero']['scope'], images=[],
                  do=make('do'), dont=make('dont'), procedures={k: [project[x][0] for x in cfg.get('procedures', {}).get(k, [])] for k in ['investigation', 'outcomes', 'appeal']},
                  claims={cid: dict(id=cid, text=c['claimText'], claimType=c['claimType'], scope=view['claimScopes'][cid], evidence=[dict(quote=e['evidenceSnippet'], url=e['sourceUrl'], language=e['sourceLanguage'], hash=e['sourceSnapshotHash'], location=e['snippetLocation']) for e in c['evidence']]) for cid, c in byid.items()})
    view['studentActions'] = locact
    topic_of = {}  # evidence quote -> first topic that shows it
    for t in view['school']['topics'] + view['school']['additionalTopics']:
        for g in t['claims']:
            for e in g['evidence']: topic_of.setdefault(e['quote'], t['key'])
    def akey(a):  # topic of the first linked claim whose evidence a topic shows; coursework only as a last resort
        for c in a['claimIds']:
            for e in locact['claims'].get(c, {}).get('evidence', []):
                if e['quote'] in topic_of: return topic_of[e['quote']]
        return keys[0]
    for side in ['do', 'dont']: view['hero']['actions'][side] = [dict(key=akey(a), en=a['en'], zh='') for a in locact[side]]
    put(d / 'view-prehash.json', view)
    put(d / 'audit.json', dict(schemaVersion='uapt-private-v6-school-audit-v1', slug=slug, name=name, rankYear=2026, rank=rank, language='en', institutionAuditStatus='PARTIAL', publicationApproved=False, verifiedOn=NOW,
                               basis=dict(publicRecordSha256=h(d / 'public.json'), publicToolsSha256=h(d / 'public-tools.json'), historicManifestSha256=history['parentManifestSha256'], historicSubsetSha256=h(d / 'historical-inventory.json'), registrySha256=h(W / 'docs/policy-audit-requirements-v1.1.json')),
                               historicalSourceObjectGaps=archive_gaps, publicClaimIds=list(decisions), preservedRecordKeys=list(record_audit), recordAudit=list(record_audit.values()), publicToolAudit=tool_audit,
                               verifiedNamedLocalTools=[t['rawToolName'] for t in tools], unresolvedHistoricalRecordKeys=workflow_holds, excludedClaimIds=held, sourceReadbacks=list(source_data.values()), gaps=gaps,
                               discoveryGate=(Bt.read_gate(P, 'discovery') or {}).get('inputsSha256'), discoveryGateOverride=override or None))
    print(abbr, 'ready; public IDs', len(current), 'records', len(old), 'tools', len(tools), 'quotes', len(bindings), 'held', len(workflow_holds) + len(held), flush=True)
