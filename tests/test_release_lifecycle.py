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
 def test_immediate_cutover_gate_rechecks_actual_release_root_set(self):
  with tempfile.TemporaryDirectory() as d:
   receipt=Path(d)/'retention.json'
   receipt.write_text(json.dumps({'schemaVersion':'uapt-release-retention-v1','basisSha256':'frozen','checkedAt':m.now(),'entries':[{'name':'accepted','disposition':'active','reason':'Current tested runtime'}]}))
   self.policy['diskCapacity']={'root':'/srv/uapt','reserveBytes':100,'reserveInodes':10,'projectMaxBytes':1000,'artifactMaxBytesByRole':{'shared-web':300}}
   self.observed['disk']={'root':'/srv/uapt','freeBytes':500,'availableInodes':100,'projectBytes':500,'releaseRoots':['accepted']}
   self.plan.update(basis={'sha256':'frozen'},retentionReceipt={'path':str(receipt),'sha256':m.digest(receipt)},diskBudget={'schemaVersion':'uapt-release-disk-budget-v1','basisSha256':'frozen','role':'shared-web','artifactMaxBytes':300,'peakAdditionalBytesByStage':{s:200 for s in ['download','unpack','dependencies','build','candidate','archive','finalization']}})
   self.assertTrue(m.validate_plan(self.plan,self.policy,self.observed))
   self.observed['disk']['releaseRoots'].append('unexplained-new-directory')
   with self.assertRaisesRegex(ValueError,'Unclassified'):m.validate_plan(self.plan,self.policy,self.observed)
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

class DiskAdmissionTests(unittest.TestCase):
 def setUp(self):
  self.policy={'diskCapacity':{'root':'/srv/uapt','reserveBytes':100,'reserveInodes':10,'projectMaxBytes':1000,'artifactMaxBytesByRole':{'shared-web':300}}}
  self.observed={'disk':{'root':'/srv/uapt','freeBytes':500,'availableInodes':100,'projectBytes':500,'releaseRoots':['accepted']}}
  self.plan={'basis':{'sha256':'frozen'},'diskBudget':{'schemaVersion':'uapt-release-disk-budget-v1','basisSha256':'frozen','role':'shared-web','artifactMaxBytes':300,'peakAdditionalBytesByStage':{s:200 for s in ['download','unpack','dependencies','build','candidate','archive','finalization']}}}
 def test_full_peak_and_role_budget_pass(self):m.validate_disk_budget(self.plan,self.policy,self.observed)
 def test_low_free_disk_and_inode_capacity_refuse(self):
  self.observed['disk']['freeBytes']=299
  with self.assertRaisesRegex(ValueError,'disk reserve'):m.validate_disk_budget(self.plan,self.policy,self.observed)
  self.observed['disk']['freeBytes']=500;self.observed['disk']['availableInodes']=9
  with self.assertRaisesRegex(ValueError,'inodes'):m.validate_disk_budget(self.plan,self.policy,self.observed)
 def test_understated_stages_changed_basis_and_oversize_refuse(self):
  del self.plan['diskBudget']['peakAdditionalBytesByStage']['archive']
  with self.assertRaisesRegex(ValueError,'peak estimates'):m.validate_disk_budget(self.plan,self.policy,self.observed)
  self.plan['diskBudget']['peakAdditionalBytesByStage']['archive']=200;self.plan['diskBudget']['basisSha256']='other'
  with self.assertRaisesRegex(ValueError,'unbound'):m.validate_disk_budget(self.plan,self.policy,self.observed)
  self.plan['diskBudget']['basisSha256']='frozen';self.plan['diskBudget']['artifactMaxBytes']=301
  with self.assertRaisesRegex(ValueError,'per-role'):m.validate_disk_budget(self.plan,self.policy,self.observed)
 def test_project_accumulation_refuses_even_with_free_host_disk(self):
  self.observed['disk']['projectBytes']=801
  with self.assertRaisesRegex(ValueError,'UAPT disk budget'):m.validate_disk_budget(self.plan,self.policy,self.observed)
 def test_retention_must_cover_actual_roots_and_resolve_archive_debt(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'receipt.json'
   def save(entries):
    m.write(p,{'schemaVersion':'uapt-release-retention-v1','basisSha256':'frozen','checkedAt':m.now(),'entries':entries});self.plan['retentionReceipt']={'path':str(p),'sha256':m.digest(p)}
   save([{'name':'accepted','disposition':'rollback','reason':'Exact previous accepted role artifact'}]);m.validate_retention_receipt(self.plan,self.observed)
   self.observed['disk']['releaseRoots'].append('orphan')
   with self.assertRaisesRegex(ValueError,'Unclassified'):m.validate_retention_receipt(self.plan,self.observed)
   save([{'name':n,'disposition':'archive_pending','reason':'Not yet offloaded'} for n in self.observed['disk']['releaseRoots']])
   with self.assertRaisesRegex(ValueError,'archive debt'):m.validate_retention_receipt(self.plan,self.observed)
 def test_old_receipt_and_rehashed_foreign_basis_refuse(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'receipt.json';v={'schemaVersion':'uapt-release-retention-v1','basisSha256':'frozen','checkedAt':'2000-01-01T00:00:00Z','entries':[]};m.write(p,v);self.plan['retentionReceipt']={'path':str(p),'sha256':m.digest(p)}
   with self.assertRaisesRegex(ValueError,'stale'):m.validate_retention_receipt(self.plan,self.observed)
   v.update(checkedAt=m.now(),basisSha256='other');m.write(p,v);self.plan['retentionReceipt']['sha256']=m.digest(p)
   with self.assertRaisesRegex(ValueError,'basis mismatch'):m.validate_retention_receipt(self.plan,self.observed)

class RetentionDeadlineTests(unittest.TestCase):
 def setUp(self):
  self.time=m.datetime.datetime.now(m.datetime.timezone.utc)
  self.held={'name':'failed','disposition':'held','reason':'Failed immutable candidate','heldSince':(self.time-m.datetime.timedelta(hours=1)).isoformat(),'reviewBefore':(self.time+m.datetime.timedelta(hours=1)).isoformat(),'nextAction':'Archive outside server, verify and remove exact inactive root'}
  self.receipt={'checkedAt':self.time.isoformat(),'entries':[dict(self.held)],'temporaryArtifacts':[]}
  self.observed={'disk':{'root':'/srv/uapt','temporaryPaths':[]},'units':{}}
  self.policy={'retentionEnforcement':{'maxHoldHours':24}}
  self.registered={'entries':[dict(self.held)]}
 def validate(self):m.validate_retention_deadlines(self.receipt,self.observed,self.policy,self.registered)
 def test_bounded_hold_with_action_passes(self):self.validate()
 def seven_day_window(self, age_hours=30):
  self.policy['retentionEnforcement'].update(maxHoldHours=168,blockAfterHours=168)
  entry={**self.held,'heldSince':(self.time-m.datetime.timedelta(hours=age_hours)).isoformat(),'reviewBefore':(self.time-m.datetime.timedelta(hours=age_hours-24)).isoformat()}
  self.receipt['entries']=[dict(entry)];self.registered['entries']=[dict(entry)]
 def test_overdue_review_inside_seven_days_passes_without_resetting_clock(self):
  self.seven_day_window();before=json.dumps(self.registered);self.validate();self.assertEqual(before,json.dumps(self.registered))
 def test_seven_day_window_still_blocks_after_original_first_hold(self):
  self.seven_day_window(169)
  with self.assertRaisesRegex(ValueError,'Expired registered hold'):self.validate()
 def test_seven_day_window_cannot_be_renewed_by_receipt(self):
  self.seven_day_window();self.receipt['entries'][0]['heldSince']=(self.time-m.datetime.timedelta(hours=29)).isoformat()
  with self.assertRaisesRegex(ValueError,'cannot be renewed'):self.validate()
 def test_seven_day_window_cannot_relabel_failed_artifact_rollback(self):
  self.seven_day_window();self.receipt['entries'][0]['disposition']='rollback'
  with self.assertRaisesRegex(ValueError,'reclassified'):self.validate()
 def test_seven_day_window_covers_temporary_materials(self):
  self.seven_day_window();entry={**self.receipt['entries'][0],'path':'/srv/uapt/builds/failed'};entry.pop('name')
  self.receipt['temporaryArtifacts']=[entry];self.registered['temporaryArtifacts']=[dict(entry)];self.observed['disk']['temporaryPaths']=[entry['path']];self.validate()
 def test_new_seven_day_deadline_passes_but_longer_hold_refuses(self):
  self.seven_day_window(1);entry=self.receipt['entries'][0];entry['reviewBefore']=(m.retention_timestamp(entry['heldSince'],'heldSince')+m.datetime.timedelta(hours=168)).isoformat();self.registered['entries']=[dict(entry)];self.validate()
  entry['reviewBefore']=(self.time+m.datetime.timedelta(days=8)).isoformat()
  with self.assertRaisesRegex(ValueError,'unbounded'):self.validate()
 def test_invalid_blocking_window_refuses(self):
  for value in [-1,169,'168',True]:
   self.seven_day_window();self.policy['retentionEnforcement']['blockAfterHours']=value
   with self.assertRaisesRegex(ValueError,'blocking window'):self.validate()
 def deferral(self):
  old=(self.time-m.datetime.timedelta(minutes=1)).isoformat()
  self.receipt['entries'][0]['reviewBefore']=old;self.registered['entries'][0]['reviewBefore']=old
  self.receipt['basisSha256']='exact-release'
  self.policy['retentionEnforcement']['releaseDeferral']={'schemaVersion':'uapt-retention-release-deferral-v1','basisSha256':'exact-release','approvedAt':self.time.isoformat(),'expiresAt':(self.time+m.datetime.timedelta(hours=4)).isoformat(),'authorization':'Explicit human instruction to relax release restriction','nextAction':'Review named old dependencies after this exact release; preserve original clocks','holds':[dict(self.registered['entries'][0])]}
 def test_explicit_exact_basis_deferral_keeps_original_clock(self):
  self.deferral();before=json.dumps(self.registered);self.validate();self.assertEqual(json.dumps(self.registered),before)
 def test_deferral_cannot_cover_different_release(self):
  self.deferral();self.receipt['basisSha256']='different'
  with self.assertRaisesRegex(ValueError,'Expired registered hold'):self.validate()
 def test_deferral_cannot_cover_another_hold(self):
  self.deferral();self.policy['retentionEnforcement']['releaseDeferral']['holds']=[]
  with self.assertRaisesRegex(ValueError,'Expired registered hold'):self.validate()
 def test_deferral_does_not_renew_clock(self):
  self.deferral();self.receipt['entries'][0]['reviewBefore']=(self.time+m.datetime.timedelta(hours=1)).isoformat()
  with self.assertRaisesRegex(ValueError,'cannot be renewed'):self.validate()
 def test_expired_or_unbounded_deferral_refuses(self):
  for hours in [-1,25]:
   self.deferral();self.policy['retentionEnforcement']['releaseDeferral']['expiresAt']=(self.time+m.datetime.timedelta(hours=hours)).isoformat()
   with self.assertRaisesRegex(ValueError,'deferral'):self.validate()
 def test_expired_hold_refuses_even_after_receipt_timestamp_refresh(self):
  self.registered['entries'][0]['reviewBefore']=(self.time-m.datetime.timedelta(seconds=1)).isoformat()
  with self.assertRaisesRegex(ValueError,'Expired registered hold'):self.validate()
 def test_fresh_receipt_cannot_extend_existing_deadline(self):
  self.receipt['entries'][0]['reviewBefore']=(self.time+m.datetime.timedelta(hours=2)).isoformat()
  with self.assertRaisesRegex(ValueError,'cannot be renewed'):self.validate()
 def test_fresh_receipt_cannot_reset_original_hold_clock(self):
  self.receipt['entries'][0]['heldSince']=(self.time-m.datetime.timedelta(minutes=30)).isoformat()
  with self.assertRaisesRegex(ValueError,'cannot be renewed'):self.validate()
 def test_missing_deadline_timezone_or_action_refuses(self):
  for field,value in [('reviewBefore',None),('reviewBefore','2026-10-26T00:00:00'),('nextAction','')]:
   with self.subTest(field=field,value=value):
    self.receipt['entries']=[{**self.held,field:value}]
    with self.assertRaises(ValueError):self.validate()
 def test_hold_longer_than_one_day_refuses(self):
  self.receipt['entries'][0]['reviewBefore']=(self.time+m.datetime.timedelta(days=7)).isoformat()
  with self.assertRaisesRegex(ValueError,'unbounded'):self.validate()
 def test_failed_artifact_cannot_be_disguised_as_rollback(self):
  self.receipt['entries'][0]['disposition']='rollback'
  with self.assertRaisesRegex(ValueError,'reclassified'):self.validate()
 def test_active_runtime_transition_needs_actual_runtime(self):
  self.receipt['entries'][0]['disposition']='active'
  with self.assertRaisesRegex(ValueError,'reclassified'):self.validate()
  self.observed['units']['shared']={'WorkingDirectory':'/srv/uapt/releases/failed/apps/tulsa-zone'};self.validate()
 def test_unclassified_temporary_archive_refuses(self):
  self.observed['disk']['temporaryPaths']=['/srv/uapt/operations/attempt/source.tar.gz']
  with self.assertRaisesRegex(ValueError,'temporary artifacts'):self.validate()
 def test_temporary_payload_hold_and_removed_offloaded_payload(self):
  entry={**self.held,'path':'/srv/uapt/operations/attempt/source.tar.gz'};entry.pop('name')
  self.receipt['temporaryArtifacts']=[entry];self.observed['disk']['temporaryPaths']=[entry['path']];self.registered['temporaryArtifacts']=[dict(entry)];self.validate()
  self.receipt['temporaryArtifacts']=[];self.observed['disk']['temporaryPaths']=[];self.validate()
 def test_receipt_validator_reads_authoritative_register_not_just_new_receipt(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);register=root/'current.json';fresh=root/'fresh.json'
   old={**self.receipt,'schemaVersion':'uapt-release-retention-v1','basisSha256':'basis'};m.write(register,old)
   proposed=json.loads(json.dumps(old));proposed['entries'][0]['reviewBefore']=(self.time+m.datetime.timedelta(hours=2)).isoformat();m.write(fresh,proposed)
   plan={'basis':{'sha256':'basis'},'retentionReceipt':{'path':str(fresh),'sha256':m.digest(fresh)}}
   policy={**self.policy,'retentionRegister':str(register)};observed={**self.observed,'disk':{**self.observed['disk'],'releaseRoots':['failed']}}
   with self.assertRaisesRegex(ValueError,'cannot be renewed'):m.validate_retention_receipt(plan,observed,policy)
 def test_separate_clock_survives_mutable_register_deadline_reset(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'clocks.json';m.write(p,{'schemaVersion':'uapt-retention-clocks-v1','entries':[self.held],'temporaryArtifacts':[]})
   policy={**self.policy,'retentionEnforcement':{**self.policy['retentionEnforcement'],'clockRegister':str(p)}}
   refreshed=json.loads(json.dumps(self.registered));refreshed['entries'][0]['reviewBefore']=(self.time+m.datetime.timedelta(hours=2)).isoformat()
   self.receipt['entries'][0]=dict(refreshed['entries'][0])
   with self.assertRaisesRegex(ValueError,'cannot be renewed'):m.validate_retention_deadlines(self.receipt,self.observed,policy,m.retention_with_clocks(refreshed,policy))
 def test_checkpoint_records_new_hold_without_replacing_first_clock(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'clocks.json';m.write(p,{'schemaVersion':'uapt-retention-clocks-v1','entries':[],'temporaryArtifacts':[]})
   policy={'retentionEnforcement':{'clockRegister':str(p)}};m.checkpoint_hold_clocks(self.receipt,policy)
   first=json.loads(p.read_text())['entries'];m.checkpoint_hold_clocks(self.receipt,policy);self.assertEqual(json.loads(p.read_text())['entries'],first)
   self.receipt['entries'][0]['reviewBefore']=(self.time+m.datetime.timedelta(hours=2)).isoformat()
   with self.assertRaisesRegex(ValueError,'cannot be overwritten'):m.checkpoint_hold_clocks(self.receipt,policy)
 def test_missing_clock_register_fails_closed(self):
  with tempfile.TemporaryDirectory() as d:
   with self.assertRaisesRegex(ValueError,'register missing'):m.retention_with_clocks(self.registered,{'retentionEnforcement':{'clockRegister':str(Path(d)/'missing.json')}})
 def test_temporary_discovery_skips_runtime_symlinks_and_rejects_escape(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);(root/'builds').mkdir();(root/'builds/failed').mkdir();(root/'builds/current').symlink_to(root/'builds/failed',target_is_directory=True)
   self.assertEqual(m.temporary_paths(root,{'temporaryGlobs':['builds/*']}),[str((root/'builds/failed').resolve())])
   with self.assertRaisesRegex(ValueError,'Unsafe'):m.temporary_paths(root,{'temporaryGlobs':['../*']})

if __name__=='__main__':unittest.main()
