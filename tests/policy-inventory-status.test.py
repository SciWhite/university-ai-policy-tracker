import importlib.util
from pathlib import Path
import tempfile
import unittest
from datetime import datetime,timedelta,timezone

spec=importlib.util.spec_from_file_location('status',Path(__file__).parents[1]/'scripts/policy-inventory-status.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)


class Freshness(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name)
        (self.root/'index').mkdir();(self.root/'index/inventory.sqlite').write_bytes(b'cache')
        m.inv.write(self.root/'registry.json',{'version':'1.0.0','requirements':[{'id':'a'}]});(self.root/'index/requirements.json').write_bytes((self.root/'registry.json').read_bytes())
        m.inv.write(self.root/'index/manifest.json',{'files':{'inventory.sqlite':m.inv.sha(b'cache')}})
        (self.root/'knowledge.md').write_text('current knowledge\n')
        m.inv.write(self.root/'current.json',{'updatedAt':m.inv.now(),'indexPath':'index/manifest.json','indexSha256':m.inv.sha((self.root/'index/manifest.json').read_bytes()),'knowledgeSnapshotSha256':m.inv.sha((self.root/'knowledge.md').read_bytes())})
    def inspect(self):return m.inspect(self.root/'current.json',self.root/'registry.json',self.root/'knowledge.md')
    def test_fresh_inventory_does_not_assert_policy_currentness(self):
        self.assertEqual(self.inspect()['policyCurrentness'],'not_established_by_inventory')
    def test_stale_knowledge_or_cache_is_rejected(self):
        (self.root/'knowledge.md').write_text('drift')
        with self.assertRaisesRegex(ValueError,'Knowledge entry'):self.inspect()
        (self.root/'knowledge.md').write_text('current knowledge\n');(self.root/'index/inventory.sqlite').write_bytes(b'drift')
        with self.assertRaisesRegex(ValueError,'cache differs'):self.inspect()
    def test_new_requirement_is_not_inherited(self):
        m.inv.write(self.root/'registry.json',{'version':'1.1.0','requirements':[{'id':'a'},{'id':'b'}]})
        with self.assertRaisesRegex(ValueError,'Requirements changed'):self.inspect()
    def test_old_pointer_requires_refresh(self):
        p=m.inv.load(self.root/'current.json');p['updatedAt']=(datetime.now(timezone.utc)-timedelta(days=8)).isoformat();m.inv.write(self.root/'current.json',p)
        with self.assertRaisesRegex(ValueError,'entry is stale'):self.inspect()


if __name__=='__main__':unittest.main()
