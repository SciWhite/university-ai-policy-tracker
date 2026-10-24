import importlib.util
from pathlib import Path
import json,subprocess,unittest
spec=importlib.util.spec_from_file_location('sync_v2',Path(__file__).with_name('policy-sync-v2.test.py'))
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
m=base.m

class EventSync(unittest.TestCase):
    save=base.TypedSync.save
    change=base.TypedSync.change
    def setUp(self):
        base.TypedSync.setUp(self)
        repo=Path(__file__).parents[1]
        result=subprocess.run([str(repo/'node_modules/.bin/tsx'),'--tsconfig',str(repo/'apps/web/tsconfig.json'),str(repo/'tests/fixtures/change-event-fixture.ts'),str(self.root),self.basis],cwd=repo,capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
        self.event['syncContractVersion']='2.1.0'
        self.event['scopeArtifact']['sha256']=m.sha((self.root/'scope.json').read_bytes())
        self.datahash=m.sha((self.root/'data.json').read_bytes())
        for name,surface in self.event['surfaces'].items():
            if surface['status']!='updated':continue
            receipt=m.load(self.root/(name+'.json'))
            if name in ['public_data','mcp','student_snapshot','runtime_content']:
                receipt['dataBasisSha256']=self.datahash
                receipt['dataArtifact']['sha256']=self.datahash
                receipt['expectedDataHash']=self.datahash;receipt['observedDataHash']=self.datahash
            self.save(name,receipt)
    def test_v2_receipt_cannot_downgrade_to_20(self):
        self.event['syncContractVersion']='2.0.0'
        with self.assertRaisesRegex(ValueError,'downgrade refused'):m.sync_gate(self.event,self.root)
    def test_selected_v2_requires_21_even_without_projection_receipt(self):
        self.event['syncContractVersion']='2.0.0'
        receipt=m.load(self.root/'changes.json');del receipt['projectionArtifact'];del receipt['overviewArtifact'];self.save('changes',receipt)
        target=self.root/'public-change-history';target.mkdir()
        manifest={'schemaVersion':'uapt-public-change-history-v2'};m.write(target/'manifest.json',manifest)
        m.write(target/'current.json',{'path':'manifest.json','sha256':m.sha((target/'manifest.json').read_bytes())})
        with self.assertRaisesRegex(ValueError,'downgrade refused'):m.sync_gate(self.event,self.root)
    def test_node_entrypoints_cannot_downgrade_incoming_v2_to_20(self):
        repo=Path(__file__).parents[1];event=self.root/'event.json'
        self.event['syncContractVersion']='2.0.0';m.write(event,self.event)
        commands=[['node',str(repo/'scripts/uapt-release.mjs'),'verify-sync',str(event),str(self.root/'basis.json'),'candidate'],
          [str(repo/'node_modules/.bin/tsx'),'--tsconfig',str(repo/'apps/web/tsconfig.json'),str(repo/'tests/fixtures/check-policy-sync.ts'),str(event),str(self.root/'basis.json')]]
        for command in commands:
            result=subprocess.run(command,cwd=repo,capture_output=True,text=True)
            self.assertNotEqual(result.returncode,0);self.assertIn('downgrade refused',result.stderr)
    def test_21_runs_all_v2_checks_and_checks_real_event_artifacts(self):
        self.assertTrue(m.sync_gate(self.event,self.root))
        receipt=m.load(self.root/'mcp.json');receipt['remainingClaimIds']=['c1'];self.save('mcp',receipt)
        with self.assertRaisesRegex(ValueError,'remaining Claim IDs'):m.sync_gate(self.event,self.root)
    def test_unknown_contract_fails_before_legacy_or_typed_checks(self):
        with self.assertRaisesRegex(ValueError,'Unknown synchronization contract'):m.sync_gate({'syncContractVersion':'9.9.9'},self.root)
    def test_21_cannot_pass_with_only_v2_boolean_receipts(self):
        receipt=m.load(self.root/'changes.json');del receipt['projectionArtifact'];self.save('changes',receipt)
        with self.assertRaisesRegex(ValueError,'Event projection gate rejected'):m.sync_gate(self.event,self.root)
    def test_stale_rss_content_even_with_rehashed_evidence_is_rejected(self):
        r=m.load(self.root/'rss-events.json');r['eventIds']=[];m.write(self.root/'rss-events.json',r)
        receipt=m.load(self.root/'changes.json');receipt['eventSurfaces']['rss']['sha256']=m.sha((self.root/'rss-events.json').read_bytes());self.save('changes',receipt)
        with self.assertRaisesRegex(ValueError,'Stale, duplicate or missing event surface'):m.sync_gate(self.event,self.root)
    def test_wrong_projection_basis_is_rejected(self):
        receipt=m.load(self.root/'changes.json');receipt['inputBasisSha256']='0'*64;self.save('changes',receipt)
        with self.assertRaisesRegex(ValueError,'basis mismatch'):m.sync_gate(self.event,self.root)
    def test_shared_node_entrypoints_accept_21_and_refuse_unknown_versions(self):
        repo=Path(__file__).parents[1];event=self.root/'event.json';m.write(event,self.event)
        commands=[['node',str(repo/'scripts/uapt-release.mjs'),'verify-sync',str(event),str(self.root/'basis.json'),'candidate'],
          [str(repo/'node_modules/.bin/tsx'),'--tsconfig',str(repo/'apps/web/tsconfig.json'),str(repo/'tests/fixtures/check-policy-sync.ts'),str(event),str(self.root/'basis.json')]]
        for command in commands:
            result=subprocess.run(command,cwd=repo,capture_output=True,text=True);self.assertEqual(result.returncode,0,result.stderr)
        self.event['syncContractVersion']='9.9.9';m.write(event,self.event)
        for command in commands:
            result=subprocess.run(command,cwd=repo,capture_output=True,text=True);self.assertNotEqual(result.returncode,0)

if __name__=='__main__':unittest.main()
