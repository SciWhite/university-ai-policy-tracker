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

class StaticMigrationTests(unittest.TestCase):
 def test_static_snippet_allows_only_manifest_alias_targets(self):
  asset={'sourcePath':'/srv/uapt/releases/uapt-policy-0a468b3/a.js','plannedDestination':'/srv/uapt/static/controlled/uapt-held-static-20261102/uapt-policy-0a468b3/a.js','urlPath':'/policy/a.js','locationModifier':'='}
  before='location = /policy/a.js {\n alias '+asset['sourcePath']+';\n add_header Cache-Control "public, max-age=3600" always;\n}\nlocation = /legacy.js { alias /srv/uapt/static/old/legacy.js; add_header X-Archive "kept" always; }\n'
  after=before.replace(asset['sourcePath'],asset['plannedDestination'])
  m._validate_static_snippet(before,after,[asset],'/etc/nginx/snippets/uapt-two-0a468b3-static.conf')
  with self.assertRaisesRegex(ValueError,'Non-alias'):
   m._validate_static_snippet(before,after.replace('max-age=3600','max-age=1'),[asset],'/etc/nginx/snippets/uapt-two-0a468b3-static.conf')
  with self.assertRaisesRegex(ValueError,'mapping'):
   m._validate_static_snippet(before,after.replace(asset['plannedDestination'],'/tmp/wrong'),[asset],'/etc/nginx/snippets/uapt-two-0a468b3-static.conf')

 def test_expires_ttl_compares_date_relative_duration(self):
  old={'date':'Sun, 02 Nov 2026 10:00:00 GMT','expires':'Sun, 02 Nov 2026 11:00:00 GMT'}
  new={'date':'Sun, 02 Nov 2026 12:00:00 GMT','expires':'Sun, 02 Nov 2026 13:00:00 GMT'}
  self.assertEqual(m._expires_ttl(old),3600)
  self.assertEqual(m._expires_ttl(old),m._expires_ttl(new))

 def test_static_readback_keeps_etag_and_relative_expires_checks(self):
  asset={'urlPath':'/a.js','sourceBytes':3,'sourceSha256':m.hashlib.sha256(b'abc').hexdigest()}
  row={'status':200,'bodyBytes':3,'bodySha256':asset['sourceSha256'],'noTransform':True,'expiresTtlSeconds':3600,
       'headers':{'content-type':'text/javascript','cache-control':'public, max-age=3600','etag':'"abc"','last-modified':'Sun, 02 Nov 2026 10:00:00 GMT','content-encoding':None,'vary':None,'x-content-type-options':'nosniff'}}
  baseline={'/a.js':row}
  with patch.object(m,'_fetch_static',return_value={**row,'url':'http://127.0.0.1/a.js'}):
   self.assertEqual(m._static_readback([asset],'preview',baseline,'http://127.0.0.1')['status'],'PASS')
  changed={**row,'headers':{**row['headers'],'etag':'"changed"'},'expiresTtlSeconds':3598}
  with patch.object(m,'_fetch_static',return_value={**changed,'url':'https://eduaipolicy.org/a.js'}):
   receipt=m._static_readback([asset],'public-after',baseline)
  self.assertEqual(receipt['status'],'BLOCKED')
  fields=[failure.get('field') for failure in receipt['failures']]
  self.assertIn('etag',fields); self.assertIn('expiresTtlSeconds',fields)

 def test_static_recovery_restores_configs_without_touching_policy_or_units(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d); policy=root/'policy.json'; policy.write_text('{"activeUnits":["main"]}\n')
   files=[]
   for i in range(7):
    target=root/('snippet-'+str(i)+'.conf'); backup=root/('backup-'+str(i)+'.conf')
    backup.write_text('original '+str(i)+'\n'); target.write_text('changed '+str(i)+'\n')
    files.append({'target':str(target),'backup':str(backup),'beforeSha256':m.digest(backup)})
   original_policy=policy.read_bytes()
   tx={'kind':'static','stage':'config_written','files':files,'retireUnits':[],
       'plan':{'candidateUnits':[]},'beforePolicy':{'activeUnits':['main']}}
   with patch.object(m,'STATE',root),patch.object(m,'POLICY',policy),patch.object(m,'run',return_value='') as run:
    m.recover(tx)
   for i in range(7): self.assertEqual((root/('snippet-'+str(i)+'.conf')).read_text(),'original '+str(i)+'\n')
   self.assertEqual(policy.read_bytes(),original_policy)
   self.assertEqual([call.args for call in run.call_args_list],[('nginx','-t'),('systemctl','reload','nginx')])
   self.assertEqual(json.loads((root/'transaction.json').read_text())['stage'],'rolled_back')

 def test_static_copy_refuses_collision_and_verifies_bytes(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d); source=root/'source'; source.write_bytes(b'asset')
   dest=root/'dest'; dest.write_bytes(b'occupied')
   asset={'sourcePath':str(source),'plannedDestination':str(dest),'sourceSha256':m.hashlib.sha256(b'asset').hexdigest(),'sourceBytes':5,'sourceMode':'0644','sourceMtimeNs':source.stat().st_mtime_ns}
   with patch.object(m,'_reject_symlink_components'):
    with self.assertRaisesRegex(ValueError,'appeared'):
     m._copy_static_asset(asset)
    dest.unlink()
    self.assertEqual(m._copy_static_asset(asset)['sha256'],asset['sourceSha256'])

 def test_static_public_after_failure_restores_exact_snippet_and_keeps_receipts(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d); state=root/'state'; plans=state/'static-migration-plans'; plans.mkdir(parents=True)
   txdir=state/'transactions'; txdir.mkdir()
   policy=state/'policy.json'; policy.write_text('{"activeUnits":["main"],"candidateSlots":[]}\n')
   source=root/'source.js'; source.write_bytes(b'public asset')
   dest=root/'controlled'/'root'/'source.js'; dest.parent.mkdir(parents=True)
   target=root/'snippet.conf'; target.write_text('location = /a.js { alias '+str(source)+'; }\n')
   staged=root/'staged.conf'; staged.write_text('location = /a.js { alias '+str(dest)+'; }\n')
   plan={'id':'static-r5-test','expiresAt':(m.datetime.datetime.now(m.datetime.timezone.utc)+m.datetime.timedelta(hours=1)).isoformat(),'stagedConfigs':[{'target':str(target),'beforeSha256':m.digest(target),'path':str(staged),'sha256':m.digest(staged)}]}
   plan_path=plans/'plan.json'; plan_path.write_text(json.dumps(plan))
   stat=source.stat(); asset={'sourcePath':str(source),'plannedDestination':str(dest),'sourceSha256':m.digest(source),'sourceBytes':source.stat().st_size,'sourceMode':format(stat.st_mode&0o777,'04o'),'sourceMtimeNs':stat.st_mtime_ns,'urlPath':'/a.js'}
   manifest={'assets':[asset]}
   def readback(assets,phase,baseline=None,origin='https://eduaipolicy.org'):
    return {'phase':phase,'status':'BLOCKED' if phase=='public-after' else 'PASS','responses':[{'urlPath':'/a.js'}],'failures':([] if phase!='public-after' else [{'kind':'header mismatch'}])}
   with patch.object(m,'STATE',state),patch.object(m,'POLICY',policy),patch.object(m,'audit',return_value={'disk':{}}),patch.object(m,'_validate_static_plan',return_value=manifest),patch.object(m,'_static_origin_context',return_value=None),patch.object(m,'_validate_static_capacity'),patch.object(m,'_reject_symlink_components'),patch.object(m,'_static_readback',side_effect=readback),patch.object(m,'_static_preview',return_value={'phase':'preview','status':'PASS','responses':[],'failures':[]}),patch.object(m,'run',return_value='') as run:
    with self.assertRaisesRegex(ValueError,'public-after'):
     m.static_migrate(plan_path,state/'transaction.json')
   self.assertEqual(target.read_text(),'location = /a.js { alias '+str(source)+'; }\n')
   self.assertEqual(policy.read_text(),'{"activeUnits":["main"],"candidateSlots":[]}\n')
   tx=json.loads((state/'transaction.json').read_text())
   self.assertEqual(tx['stage'],'rolled_back')
   self.assertEqual(tx['staticReceipts']['publicAfter']['sha256'],m.digest(tx['staticReceipts']['publicAfter']['path']))
   self.assertEqual(len([call for call in run.call_args_list if call.args==('systemctl','reload','nginx')]),2)
   self.assertEqual(tx['retireUnits'],[])
   self.assertEqual(tx['plan']['id'],'static-r5-test')

 def test_static_expire_uses_shared_journal_and_returns_after_recovery(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d); (root/'transaction.json').write_text(json.dumps({'kind':'static','stage':'reloaded','plan':{'expiresAt':(m.datetime.datetime.now(m.datetime.timezone.utc)-m.datetime.timedelta(seconds=1)).isoformat()}}))
   with patch.object(m,'STATE',root),patch.object(m,'LOCK',root/'lock'/'release.lock'),patch.object(m,'recover') as recover,patch.object(m.sys,'argv',['uapt-release-lifecycle.py','expire']):
    m.main()
   recover.assert_called_once()

 def test_static_boot_recovery_restores_snippet_without_reload(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d); target=root/'snippet.conf'; backup=root/'backup.conf'
   backup.write_text('before\n'); target.write_text('after\n')
   tx={'kind':'static','stage':'reloaded','files':[{'target':str(target),'backup':str(backup),'beforeSha256':m.digest(backup)}],
       'retireUnits':[],'plan':{'candidateUnits':[]},'beforePolicy':{'unchanged':True}}
   with patch.object(m,'STATE',root),patch.object(m,'run',return_value='') as run:
    m.recover(tx,reload_nginx=False)
   self.assertEqual(target.read_text(),'before\n')
   self.assertEqual([call.args for call in run.call_args_list],[('nginx','-t')])
   self.assertEqual(json.loads((root/'transaction.json').read_text())['stage'],'rolled_back')

 def test_static_recovery_fsyncs_target_dir_before_rolled_back_and_retries_after_fault(self):
  import stat
  with tempfile.TemporaryDirectory() as d:
   root=Path(d); target=root/'snippet.conf'; backup=root/'backup.conf'
   backup.write_text('before\n'); target.write_text('after\n')
   tx={'kind':'static','stage':'reloaded','files':[{'target':str(target),'backup':str(backup),'beforeSha256':m.digest(backup)}],
       'retireUnits':[],'plan':{'candidateUnits':[]},'beforePolicy':{'unchanged':True}}
   events=[]; replaced={'value':False}; faulted={'value':False}
   real_replace=m.os.replace; real_fsync=m.os.fsync; real_write=m.write
   def replace(src,dst):
    result=real_replace(src,dst)
    if Path(dst)==target: events.append('target_replace'); replaced['value']=True
    return result
   def fsync(fd):
    if stat.S_ISDIR(m.os.fstat(fd).st_mode):
     events.append('dir_fsync')
     if replaced['value'] and not faulted['value']:
      faulted['value']=True; raise OSError('simulated power-loss durability barrier failure')
    return real_fsync(fd)
   def write(path,value):
    if value.get('stage')=='rolled_back': events.append('rolled_back_journal')
    return real_write(path,value)
   with patch.object(m,'STATE',root),patch.object(m,'run',return_value=''),patch.object(m,'write',side_effect=write),patch.object(m.os,'replace',side_effect=replace),patch.object(m.os,'fsync',side_effect=fsync):
    with self.assertRaisesRegex(OSError,'durability barrier'):
     m.recover(tx)
   replace_index=events.index('target_replace')
   target_dir_fsync_index=next(i for i,event in enumerate(events) if i>replace_index and event=='dir_fsync')
   self.assertLess(replace_index,target_dir_fsync_index)
   self.assertNotIn('rolled_back_journal',events)
   self.assertEqual(json.loads((root/'transaction.json').read_text())['stage'],'reloaded')
   with patch.object(m,'STATE',root),patch.object(m,'run',return_value=''):
    m.recover(tx)
   self.assertEqual(target.read_text(),'before\n')
   self.assertEqual(json.loads((root/'transaction.json').read_text())['stage'],'rolled_back')

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


class SeparateBuildRuntimeBudgetTests(unittest.TestCase):
 def setUp(self):
  LifecycleTests.setUp(self)
  self.policy.update(buildPeakMaxBytes=800,uaptPeakMaxBytes=1400)
  self.plan['buildPeakBytes']=800
  self.observed['memory']['MemAvailable']=1400
  self.measured={'peakBytesByStage':{'build':700,'startup':150,'cold_history':190,'steady':100}}
 def test_real_profile_admits_build8_and_keeps_runtime4(self):
  g=1024**3
  self.policy.update(buildPeakMaxBytes=8*g,candidatePeakMaxBytes=4*g,hostReserveBytes=3*g,uaptPeakMaxBytes=16*g)
  self.plan.update(buildPeakBytes=8*g,candidatePeakBytes=4*g)
  self.observed.update(memory={'MemAvailable':12536430592},uaptMemoryBytes=7*g)
  self.assertTrue(m.validate_plan(self.plan,self.policy,self.observed,prebuild=True))
  self.assertTrue(m.validate_plan(self.plan,self.policy,self.observed))
  m.validate_capacity(self.plan,{'peakBytesByStage':{'build':int(7.5*g),'startup':2*g,'cold_history':int(3.5*g),'steady':3*g}})
 def test_build_and_runtime_measured_peaks_have_independent_limits(self):
  before=json.loads(json.dumps(self.measured))
  m.validate_capacity(self.plan,self.measured)
  self.assertEqual(self.measured,before,'Never drop or lower the actual build peak')
  with self.assertRaisesRegex(ValueError,'Build budget understates'):
   m.validate_capacity(self.plan,{'peakBytesByStage':{**before['peakBytesByStage'],'build':801}})
  for stage in ['startup','cold_history','steady']:
   with self.subTest(stage=stage),self.assertRaisesRegex(ValueError,'runtime peak'):
    m.validate_capacity(self.plan,{'peakBytesByStage':{**before['peakBytesByStage'],stage:201}})
 def test_json_phase_flags_cannot_make_runtime_admission_charge_build(self):
  self.plan.update(prebuild=True,phase='prebuild',capacityPhase='build')
  self.observed['memory']['MemAvailable']=700
  self.assertTrue(m.validate_plan(self.plan,self.policy,self.observed))
  with self.assertRaisesRegex(ValueError,'build peak'):
   m.validate_plan(self.plan,self.policy,self.observed,prebuild=True)
 def test_provisional_receipt_and_build_id_do_not_satisfy_runtime_gate(self):
  self.plan.update(prebuild=True,phase='prebuild')
  provisional={'schemaVersion':'uapt-prebuild-budget-v1','measured':False,'buildScope':'uapt-build.scope','buildMemoryMaxBytes':800,'BUILD_ID':'written-before-build-failed'}
  m.validate_capacity(self.plan,provisional,prebuild=True)
  with self.assertRaisesRegex(ValueError,'Measured'):
   m.validate_capacity(self.plan,provisional)
 def test_build_admission_reserves_full_peak_and_requires_cold_slots(self):
  self.observed['units']['candidate']={'MemoryCurrent':'50','MemoryHigh':'100','MemoryMax':'200'}
  self.observed['uaptMemoryBytes']=250
  self.assertTrue(m.validate_plan(self.plan,self.policy,self.observed))
  with self.assertRaisesRegex(ValueError,'cold candidate'):
   m.validate_plan(self.plan,self.policy,self.observed,prebuild=True)
 def test_separate_build_budget_is_required_and_policy_bounded(self):
  for value in [None,0,-1,True,801]:
   with self.subTest(value=value):
    self.plan['buildPeakBytes']=value
    with self.assertRaisesRegex(ValueError,'build peak budget'):
     m.validate_plan(self.plan,self.policy,self.observed,prebuild=True)
  self.plan['buildPeakBytes']=800
  with self.assertRaisesRegex(ValueError,'build budget'):
   m.validate_capacity(self.plan,{'schemaVersion':'uapt-prebuild-budget-v1','measured':False,'buildScope':'uapt-build.scope','buildMemoryMaxBytes':801},prebuild=True)
 def test_build_and_runtime_both_keep_host_and_aggregate_guards(self):
  for prebuild,available,used,pattern in [(True,1000,200,'reserve'),(True,1400,700,'aggregate'),(False,650,200,'reserve'),(False,1400,1300,'aggregate')]:
   with self.subTest(prebuild=prebuild,pattern=pattern):
    self.observed.update(memory={'MemAvailable':available},uaptMemoryBytes=used)
    with self.assertRaisesRegex(ValueError,pattern):m.validate_plan(self.plan,self.policy,self.observed,prebuild=prebuild)
 def test_legacy_policy_cannot_silently_enable_separate_build_budget(self):
  del self.policy['buildPeakMaxBytes']
  with self.assertRaisesRegex(ValueError,'policy buildPeakMaxBytes'):
   m.validate_plan(self.plan,self.policy,self.observed)
  del self.plan['buildPeakBytes']
  self.assertTrue(m.validate_plan(self.plan,self.policy,self.observed,prebuild=True))
  with self.assertRaisesRegex(ValueError,'Build budget understates'):
   m.validate_capacity(self.plan,self.measured)
 def test_load_plan_gets_phase_from_command_not_plan_json(self):
  class Captured(Exception): pass
  with tempfile.TemporaryDirectory()as d:
   root=Path(d);policy=root/'policy.json';policy.write_text(json.dumps(self.policy));plan=root/'plan.json';plan.write_text(json.dumps({**self.plan,'prebuild':True,'phase':'prebuild'}))
   with patch.object(m,'POLICY',policy),patch.object(m,'audit',return_value=self.observed),patch.object(m,'validate_plan',side_effect=Captured)as validate:
    with self.assertRaises(Captured):m.load_plan(plan,prebuild=True)
    self.assertTrue(validate.call_args.kwargs['prebuild'])
    with self.assertRaises(Captured):m.load_plan(plan)
    self.assertIs(validate.call_args.kwargs['prebuild'],False)


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
