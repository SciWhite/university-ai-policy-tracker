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
if __name__=='__main__':unittest.main()
