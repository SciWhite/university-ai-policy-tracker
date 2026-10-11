import importlib.util
from pathlib import Path
import tempfile
import unittest
import shutil
import subprocess
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from datetime import datetime, timedelta, timezone

spec = importlib.util.spec_from_file_location("inventory", Path(__file__).parents[1] / "scripts/policy-inventory.py")
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)


class TypedSync(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name)
        m.write(self.root/'basis.json',{'releaseId':'test'});self.basis=m.sha((self.root/'basis.json').read_bytes())
        m.write(self.root/'scope.json',{'schemaVersion':'uapt-policy-sync-scope-v1','universities':[{'slug':'school','publicClaimIds':['c1','c2']}],'changedUrls':['https://eduaipolicy.org/universities/school']})
        m.write(self.root/'data.json',[{'entitySlug':'school','claims':[{'id':'c1'},{'id':'c2'}]}]);self.datahash=m.sha((self.root/'data.json').read_bytes())
        names=['inventory','knowledge','review_cache','public_data','tools','student_snapshot','mcp','search_coverage','pages','runtime_content','changes','sitemap','notifications','public_readback','candidate_readback']
        self.event={'eventId':'fixture','eventType':'policy_release','generatedAt':m.now(),'requirementsVersion':'1.0.0','syncContractVersion':'2.0.0','basisSha256':self.basis,'basisArtifact':{'path':'basis.json','sha256':self.basis},'scopeArtifact':{'path':'scope.json','sha256':m.sha((self.root/'scope.json').read_bytes()),'basisSha256':self.basis},'surfaces':{n:{'status':'not_required_with_reason','reason':'Not affected in fixture'} for n in names}}
        checks={
            'public_data':['schemaValidated','privateFieldsExcluded','recordCountsValidated','claimFingerprintsValidated'],
            'mcp':['remainingClaimIdsEmpty','publishedOnly','scopePreserved'],
            'changes':['universityChanges','history','latestDiff','changesIndex','recentChanges','rss'],
            'pages':['affectedLocalesReadBack','unchangedControlsReadBack'],
            'runtime_content':['contentHashMatched','dataCompatibilityValidated','affectedRoutesReadBack'],
            'public_readback':['affectedRoutesReadBack','artifactIdentityMatched'],
            'candidate_readback':['affectedRoutesReadBack','artifactIdentityMatched'],
            'student_snapshot':['basisFingerprintsValidated','heldReviewsPreserved'],
        }
        for name,required in checks.items():
            receipt={'schemaVersion':'uapt-policy-surface-receipt-v1','surface':name,'basisSha256':self.basis,'checkedAt':m.now(),'checkedSlugs':['school'],'checks':{c:True for c in required},'observedClaimIdsBySlug':{'school':['c1','c2']},'remainingClaimIds':[],'dataBasisSha256':self.datahash,'expectedContentHash':'1'*64,'observedContentHash':'1'*64,'expectedDataHash':self.datahash,'observedDataHash':self.datahash,'snapshotDispositions':{'school':{'basisFingerprint':'2'*64,'expectedBasisFingerprint':'2'*64,'reviewState':'needs_review','effectiveStatus':'needs_review','displayEligible':False}},'dataArtifact':{'path':'data.json','sha256':self.datahash}}
            self.save(name,receipt)

    def save(self,name,receipt):
        path=self.root/(name+'.json');m.write(path,receipt)
        self.event['surfaces'][name]={'status':'updated','evidence':[{'path':path.name,'sha256':m.sha(path.read_bytes()),'basisSha256':self.basis}]}

    def change(self,name,**fields):
        receipt=m.load(self.root/(name+'.json'));receipt.update(fields);self.save(name,receipt)

    def test_complete_typed_scope_with_held_snapshot_can_pass_without_approval(self):
        self.assertTrue(m.sync_gate(self.event,self.root,'complete'))

    def test_missing_changes_surface_and_missing_rss_check_are_rejected(self):
        receipt=m.load(self.root/'changes.json');receipt['checks']['rss']=False;self.save('changes',receipt)
        with self.assertRaisesRegex(ValueError,'Incomplete synchronization checks'):m.sync_gate(self.event,self.root)

    def test_incomplete_mcp_ids_or_remaining_ids_are_rejected(self):
        self.change('mcp',observedClaimIdsBySlug={'school':['c1']})
        with self.assertRaisesRegex(ValueError,'Claim ID coverage'):m.sync_gate(self.event,self.root)
        self.change('mcp',observedClaimIdsBySlug={'school':['c1','c2']},remainingClaimIds=['c3'])
        with self.assertRaisesRegex(ValueError,'remaining Claim IDs'):m.sync_gate(self.event,self.root)

    def test_old_mcp_snapshot_and_runtime_data_bases_are_rejected(self):
        for name in ['mcp','student_snapshot','runtime_content']:
            receipt=m.load(self.root/(name+'.json'));self.change(name,dataBasisSha256='0'*64)
            with self.assertRaisesRegex(ValueError,'Stale public data basis'):m.sync_gate(self.event,self.root)
            self.save(name,receipt)

    def test_mismatched_runtime_hash_is_rejected(self):
        self.change('runtime_content',observedContentHash='0'*64)
        with self.assertRaisesRegex(ValueError,'Runtime artifact/data hash mismatch'):m.sync_gate(self.event,self.root)

    def test_snapshot_fingerprint_mismatch_cannot_become_strong(self):
        self.change('student_snapshot',snapshotDispositions={'school':{'basisFingerprint':'2'*64,'expectedBasisFingerprint':'3'*64,'reviewState':'dual_agent_reviewed','effectiveStatus':'strong','displayEligible':True}})
        with self.assertRaisesRegex(ValueError,'Stale/held snapshot'):m.sync_gate(self.event,self.root)

    def test_expired_or_future_receipt_is_rejected(self):
        for delta in [timedelta(days=-4),timedelta(hours=1)]:
            self.change('mcp',checkedAt=(datetime.now(timezone.utc)+delta).isoformat())
            with self.assertRaisesRegex(ValueError,'stale or future'):m.sync_gate(self.event,self.root)

    def test_rehashed_public_artifact_cannot_omit_claims(self):
        m.write(self.root/'data.json',[{'entitySlug':'school','claims':[{'id':'c1'}]}]);self.datahash=m.sha((self.root/'data.json').read_bytes())
        self.change('public_data',dataArtifact={'path':'data.json','sha256':self.datahash})
        with self.assertRaisesRegex(ValueError,'full declared Claim ID scope'):m.sync_gate(self.event,self.root)

    def test_legacy_mutation_adapter_binds_entry_and_leaves_completion_pending(self):
        repo=Path(__file__).parents[1];tsx=repo/'node_modules/.bin/tsx'
        if not tsx.exists():self.skipTest('tsx unavailable')
        (self.root/'scripts').mkdir();shutil.copyfile(repo/'scripts/policy-inventory.py',self.root/'scripts/policy-inventory.py')
        entry=self.root/'entry.mjs';entry.write_text("import fs from 'node:fs';fs.writeFileSync('marker','local fixture only');\n")
        scope=m.load(self.root/'scope.json');scope['mutationEntry']={'sha256':'0'*64,'runner':'node'}
        m.write(self.root/'scope.json',scope);self.event['scopeArtifact']['sha256']=m.sha((self.root/'scope.json').read_bytes());m.write(self.root/'event.json',self.event)
        command=[str(tsx),str(repo/'scripts/run-synchronized-policy-mutation.ts'),'--confirm','--entry','entry.mjs','--runner','node','--basis','basis.json','--sync-ledger','event.json','--receipt','mutation-receipt.json']
        result=subprocess.run(command,cwd=self.root,capture_output=True)
        self.assertNotEqual(result.returncode,0);self.assertFalse((self.root/'marker').exists());self.assertFalse((self.root/'mutation-receipt.json').exists())
        scope['mutationEntry']['sha256']=m.sha(entry.read_bytes());m.write(self.root/'scope.json',scope);self.event['scopeArtifact']['sha256']=m.sha((self.root/'scope.json').read_bytes());m.write(self.root/'event.json',self.event)
        result=subprocess.run(command,cwd=self.root,capture_output=True)
        self.assertEqual(result.returncode,0,result.stderr.decode());self.assertTrue((self.root/'marker').exists())
        self.assertEqual(m.load(self.root/'mutation-receipt.json')['status'],'mutation_executed_completion_pending')

    def indexnow_command(self,url,endpoint=None):
        repo=Path(__file__).parents[1];m.write(self.root/'event.json',self.event)
        command=[str(repo/'node_modules/.bin/tsx'),'--tsconfig',str(repo/'apps/web/tsconfig.json'),str(repo/'scripts/submit-indexnow.ts'),'--urls',url,'--sync-ledger',str(self.root/'event.json')]
        if endpoint:command+=['--endpoint',endpoint]
        preload=self.root/'offline-sitemap.mjs'
        preload.write_text("""const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url === 'https://eduaipolicy.org/sitemap.xml') return new Response('<urlset><url><loc>https://eduaipolicy.org/universities/school</loc></url></urlset>', {status:200});
  if (new URL(url).hostname !== '127.0.0.1') throw new Error('External network forbidden in fixture');
  return realFetch(input, init);
};
""")
        return subprocess.run(command,cwd=repo,env={**os.environ,'UAPT_PUBLIC_RELEASE_MANIFEST':str(self.root/'basis.json'),
            'NODE_OPTIONS':os.environ.get('NODE_OPTIONS','')+' --import '+preload.as_uri()},capture_output=True,text=True)

    def test_live_notification_cannot_exceed_frozen_url_scope(self):
        result=self.indexnow_command('https://eduaipolicy.org/forbidden')
        self.assertNotEqual(result.returncode,0);self.assertIn('exceed the frozen',result.stderr)
        self.assertFalse(list(self.root.glob('notification-*.json')))

    def test_loopback_notification_receipt_does_not_claim_search_indexing(self):
        captured=[]
        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                captured.append(self.rfile.read(int(self.headers['Content-Length'])));self.send_response(200);self.end_headers();self.wfile.write(b'Accepted fixture')
            def log_message(self,*args):pass
        server=ThreadingHTTPServer(('127.0.0.1',0),Handler);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:result=self.indexnow_command('https://eduaipolicy.org/universities/school',f'http://127.0.0.1:{server.server_port}/indexnow')
        finally:server.shutdown();server.server_close();thread.join()
        self.assertEqual(result.returncode,0,result.stderr);self.assertEqual(len(captured),1)
        receipts=list(self.root.glob('notification-*.json'));self.assertEqual(len(receipts),1)
        self.assertFalse(m.load(receipts[0])['indexingConfirmed'])
        completed=list(self.root.glob('completion-indexnow-*.json'));self.assertEqual(len(completed),1)
        self.assertTrue(m.sync_gate(m.load(completed[0]),self.root,'complete'))


if __name__=='__main__':unittest.main()
