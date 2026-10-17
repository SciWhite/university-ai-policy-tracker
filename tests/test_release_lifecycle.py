import unittest, importlib.util, tempfile, json
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('lifecycle',Path(__file__).parents[1]/'scripts/uapt-release-lifecycle.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class LifecycleTests(unittest.TestCase):
 def setUp(self):
  self.policy={'_sha256':'abc','activeUnits':['main','shared','mcp'],'legacyUnits':['legacy'],'candidateSlots':['candidate','candidate-mcp'],'candidatePeakMaxBytes':300,'hostReserveBytes':500,'uaptPeakMaxBytes':1000}
  self.observed={'units':{x:{'MemoryCurrent':'50','MemoryHigh':'100','MemoryMax':'200'}for x in ['main','shared','mcp','legacy']},'memory':{'MemAvailable':1000},'uaptMemoryBytes':200}
  self.plan={'schemaVersion':'uapt-release-lifecycle-plan-v1','policySha256':'abc','expiresAt':(m.datetime.datetime.now(m.datetime.timezone.utc)+m.datetime.timedelta(hours=2)).isoformat(),'candidateUnits':['candidate','candidate-mcp'],'candidatePeakBytes':200,'candidateEndpoints':{'candidate':['127.0.0.1:3163'],'candidate-mcp':['127.0.0.1:3116']},'retireUnits':['shared','mcp'],'keepActiveUnits':['main'],'staticArchiveReceipt':{'path':'proof'},'publicChecks':[{}],'candidateChecks':[{}],'routingFiles':[{}],'retiredEndpoints':['127.0.0.1:3159']}
 def test_valid_fixed_slots(self):self.assertTrue(m.validate_plan(self.plan,self.policy,self.observed))
 def test_reject_accumulation(self):
  self.observed['units']['unregistered']={}
  with self.assertRaisesRegex(ValueError,'Unregistered'):m.validate_plan(self.plan,self.policy,self.observed)
 def test_reject_low_headroom(self):
  self.observed['memory']['MemAvailable']=650
  with self.assertRaisesRegex(ValueError,'reserve'):m.validate_plan(self.plan,self.policy,self.observed)
 def test_reject_expiry_and_infinite_limits(self):
  self.plan['expiresAt']='2000'
  with self.assertRaisesRegex(ValueError,'expired'):m.validate_plan(self.plan,self.policy,self.observed)
  self.plan['expiresAt']=(m.datetime.datetime.now(m.datetime.timezone.utc)+m.datetime.timedelta(hours=2)).isoformat();self.observed['units']['main']['MemoryMax']='infinity'
  with self.assertRaisesRegex(ValueError,'limits'):m.validate_plan(self.plan,self.policy,self.observed)
 def test_retirement_is_mandatory(self):
  self.plan['retireUnits']=[]
  with self.assertRaisesRegex(ValueError,'retire'):m.validate_plan(self.plan,self.policy,self.observed)
 def test_recover_after_partial_route_write_restores_files_and_policy(self):
  with tempfile.TemporaryDirectory()as d:
   root=Path(d);target=root/'route';backup=root/'backup';backup.write_text('old accepted routing');target.write_text('partially selected routing');policy=root/'policy.json';m.write(policy,{'activeUnits':['new']});tx={'retireUnits':['old'],'files':[{'target':str(target),'backup':str(backup),'beforeSha256':m.digest(backup)}],'beforePolicy':{'activeUnits':['old']},'plan':{'candidateUnits':['new'],'candidateEndpoints':{'new':['127.0.0.1:9999']}}}
   with patch.object(m,'STATE',root),patch.object(m,'POLICY',policy),patch.object(m,'run',return_value='')as run:m.recover(tx,False)
   self.assertEqual(target.read_text(),'old accepted routing');self.assertEqual(json.loads(policy.read_text())['activeUnits'],['old']);self.assertEqual(json.loads((root/'transaction.json').read_text())['stage'],'rolled_back');self.assertEqual(run.call_args_list[0].args,('systemctl','enable','--now','old'));self.assertIn(('systemctl','disable','--now','new'),[c.args for c in run.call_args_list])

class CapacityPhaseTests(unittest.TestCase):
 def test_provisional_budget_never_satisfies_cutover(self):
  plan={'candidatePeakBytes':100};provisional={'schemaVersion':'uapt-prebuild-budget-v1','measured':False,'buildScope':'uapt-build.scope','buildMemoryMaxBytes':100}
  m.validate_capacity(plan,provisional,True)
  with self.assertRaisesRegex(ValueError,'Measured'):m.validate_capacity(plan,provisional)
  with self.assertRaisesRegex(ValueError,'budget'):m.validate_capacity(plan,{**provisional,'buildMemoryMaxBytes':101},True)
 def test_actual_measurements_are_required_in_all_stages(self):
  plan={'candidatePeakBytes':100};measured={'peakBytesByStage':{'build':90,'startup':10,'cold_history':80,'steady':20}}
  m.validate_capacity(plan,measured)
  with self.assertRaisesRegex(ValueError,'understates'):m.validate_capacity({'candidatePeakBytes':50},measured)


class ReadbackPropagationTests(unittest.TestCase):
 def test_identical_check_retries_previous_worker_and_records_it(self):
  with patch.object(m.subprocess,'check_output',side_effect=[b'old release',b'accepted release']),patch.object(m.time,'sleep')as sleep:
   result=m.check_urls([{'url':'https://eduaipolicy.org/target','contains':['accepted release']}])
   self.assertEqual(len(result[0]['previousAttempts']),1);sleep.assert_called_once_with(1)
 def test_persistent_semantic_failure_still_rejects(self):
  with patch.object(m.subprocess,'check_output',return_value=b'wrong release')as fetch,patch.object(m.time,'sleep'):
   with self.assertRaisesRegex(ValueError,'missing required'):m.check_urls([{'url':'https://eduaipolicy.org/target','contains':['accepted release']}])
   self.assertEqual(fetch.call_count,4)

class CandidateIdentityTests(unittest.TestCase):
 def setUp(self):
  self.td = tempfile.TemporaryDirectory()
  self.root = Path(self.td.name)
  self.release = self.root / 'release-r3'
  self.release.mkdir(parents=True)

  # Set up Next build directory and BUILD_ID
  next_dir = self.release / 'apps/tulsa-zone/.next'
  next_dir.mkdir(parents=True)
  (next_dir / 'BUILD_ID').write_text('build-r3-xyz\n')

  # Set up data pointers
  for sub, rev in [('data/public-v6-pages', 'rev-pages.json'), ('data/public-v6-records', 'rev-records.json'), ('data/public-v6-history', 'rev-history.json')]:
   d = self.release / sub
   (d / 'revisions').mkdir(parents=True)
   rev_file = d / 'revisions' / rev
   rev_file.write_text(f'{{"revision": "{rev}"}}\n')
   rev_hash = m.digest(rev_file)
   (d / 'current.json').write_text(json.dumps({'path': f'revisions/{rev}', 'sha256': rev_hash}) + '\n')

  # Source manifest
  tracked = self.release / 'tracked.txt'
  tracked.write_text('hello\n')
  tracked_hash = m.digest(tracked)
  source_manifest = {
   'codeSha': 'sha-r3-1234567890abcdef1234567890abcdef1234',
   'files': [{'path': 'tracked.txt', 'kind': 'file', 'sha256': tracked_hash}]
  }
  sm_path = self.release / 'source-manifest.json'
  sm_path.write_text(json.dumps(source_manifest) + '\n')
  self.source_manifest_hash = m.digest(sm_path)

  # Build manifest
  bm_path = self.release / 'build-artifact-manifest.json'
  bm_path.write_text(json.dumps({'BUILD_ID': 'build-r3-xyz', 'files': {'BUILD_ID': 'abc'}}) + '\n')
  self.bm_hash = m.digest(bm_path)

  # MCP catalog
  mcp_path = self.release / 'mcp-catalog.json'
  mcp_path.write_text('{"catalog": "r3"}\n')
  self.mcp_hash = m.digest(mcp_path)

  # Basis file
  self.basis = {
   'schemaVersion': 'uapt-policy-zone-release-basis-v1',
   'codeSha': 'sha-r3-1234567890abcdef1234567890abcdef1234',
   'BUILD_ID': 'build-r3-xyz',
   'release': str(self.release),
   'pagePointer': {'path': 'revisions/rev-pages.json', 'sha256': m.digest(self.release / 'data/public-v6-pages/revisions/rev-pages.json')},
   'recordPointer': {'path': 'revisions/rev-records.json', 'sha256': m.digest(self.release / 'data/public-v6-records/revisions/rev-records.json')},
   'historyPointer': {'path': 'revisions/rev-history.json', 'sha256': m.digest(self.release / 'data/public-v6-history/revisions/rev-history.json')},
   'sourceManifestSha256': self.source_manifest_hash,
   'buildArtifactSha256': self.bm_hash,
   'mcpCatalogSha256': self.mcp_hash
  }
  self.basis_path = self.root / 'basis.json'
  self.basis_path.write_text(json.dumps(self.basis) + '\n')

  self.plan = {
   'candidateUnits': ['candidate-web', 'candidate-mcp'],
   'basis': {'path': str(self.basis_path), 'sha256': m.digest(self.basis_path)}
  }

 def tearDown(self):
  self.td.cleanup()

 def test_valid_identity_passes(self):
  with patch.object(m, 'state', side_effect=lambda u: {
   'ActiveState': 'active', 'MainPID': '4321', 'InvocationID': 'inv-123', 'WorkingDirectory': str(self.release)
  }):
   self.assertTrue(m.validate_candidate_identity(self.plan, self.basis, prebuild=False))
   self.assertTrue(m.validate_candidate_identity(self.plan, self.basis, prebuild=True))

 def test_reject_r2_credentials_with_r3_artifact(self):
  # 1. R2 credentials have old BUILD_ID; candidate artifact has R3 BUILD_ID
  r2_basis = dict(self.basis, BUILD_ID='build-r2-old-id')
  with patch.object(m, 'state', side_effect=lambda u: {
   'ActiveState': 'active', 'MainPID': '4321', 'InvocationID': 'inv-123', 'WorkingDirectory': str(self.release)
  }):
   with self.assertRaisesRegex(ValueError, 'BUILD_ID'):
    m.validate_candidate_identity(self.plan, r2_basis, prebuild=False)

  # 2. R2 credentials have old pagePointer
  r2_basis_pointer = dict(self.basis, pagePointer={'path': 'revisions/old.json', 'sha256': '00000000'})
  with patch.object(m, 'state', side_effect=lambda u: {
   'ActiveState': 'active', 'MainPID': '4321', 'InvocationID': 'inv-123', 'WorkingDirectory': str(self.release)
  }):
   with self.assertRaisesRegex(ValueError, 'Pointer pagePointer in current.json differs from basis'):
    m.validate_candidate_identity(self.plan, r2_basis_pointer, prebuild=False)

  # 3. R2 credentials have old codeSha / sourceManifest
  r2_basis_code = dict(self.basis, codeSha='sha-r2-old', sourceManifestSha256='000000000000')
  with patch.object(m, 'state', side_effect=lambda u: {
   'ActiveState': 'active', 'MainPID': '4321', 'InvocationID': 'inv-123', 'WorkingDirectory': str(self.release)
  }):
   with self.assertRaisesRegex(ValueError, 'Source manifest missing or hash does not match'):
    m.validate_candidate_identity(self.plan, r2_basis_code, prebuild=False)

  # 4. Candidate service running from wrong working directory
  with patch.object(m, 'state', side_effect=lambda u: {
   'ActiveState': 'active', 'MainPID': '4321', 'InvocationID': 'inv-123', 'WorkingDirectory': '/srv/uapt/releases/wrong-release'
  }):
   with self.assertRaisesRegex(ValueError, 'WorkingDirectory'):
    m.validate_candidate_identity(self.plan, self.basis, prebuild=False)

  # 5. Candidate service inactive or missing MainPID
  with patch.object(m, 'state', side_effect=lambda u: {
   'ActiveState': 'inactive', 'MainPID': '0', 'InvocationID': '', 'WorkingDirectory': str(self.release)
  }):
   with self.assertRaisesRegex(ValueError, 'not active'):
    m.validate_candidate_identity(self.plan, self.basis, prebuild=False)

  # 6. Capacity receipt bound to changed BUILD_ID or InvocationID
  capacity = {
   'peakBytesByStage': {'build': 100, 'startup': 50, 'cold_history': 80, 'steady': 60},
   'BUILD_ID': 'build-r2-old-id',
   'invocationIds': {'candidate-web': 'inv-123'},
   'mainPids': {'candidate-web': 4321}
  }
  with self.assertRaisesRegex(ValueError, 'Capacity receipt BUILD_ID'):
   m.validate_capacity({'candidatePeakBytes': 200, 'candidateUnits': ['candidate-web']}, capacity, basis=self.basis)

  capacity_diff_inv = {
   'peakBytesByStage': {'build': 100, 'startup': 50, 'cold_history': 80, 'steady': 60},
   'BUILD_ID': 'build-r3-xyz',
   'invocationIds': {'candidate-web': 'inv-different'},
   'mainPids': {'candidate-web': 4321}
  }
  with patch.object(m, 'state', return_value={'InvocationID': 'inv-123', 'MainPID': '4321'}):
   with self.assertRaisesRegex(ValueError, 'InvocationID changed since sampling'):
    m.validate_capacity({'candidatePeakBytes': 200, 'candidateUnits': ['candidate-web']}, capacity_diff_inv, basis=self.basis)

if __name__=='__main__':unittest.main()
