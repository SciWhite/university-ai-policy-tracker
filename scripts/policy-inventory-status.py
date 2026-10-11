#!/usr/bin/env python3
"""Read-only pointer/cache/requirements freshness; never asserts current policy accuracy."""
import argparse
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path

spec=importlib.util.spec_from_file_location("inventory",Path(__file__).with_name("policy-inventory.py"))
inv=importlib.util.module_from_spec(spec);spec.loader.exec_module(inv)


def inspect(pointer, registry, knowledge, max_age_hours=168):
    pointer=Path(pointer);root=pointer.parent;value=inv.load(pointer);manifests={}
    for key in ["index","reconciliation","phaseB","phaseC","sourceInvestigation","gapCrawl"]:
        if key+"Path" not in value:continue
        p=inv.safe_path(root,value[key+"Path"])
        if inv.sha(p.read_bytes())!=value.get(key+"Sha256"):raise ValueError("Pointer artifact mismatch: "+key)
        manifests[key]=(p.parent,inv.load(p))
    if "index" not in manifests:raise ValueError("Missing inventory index")
    caches=[]
    for key,name in [("index","inventory.sqlite"),("reconciliation","reconciliation.sqlite")]:
        if key not in manifests:continue
        parent,manifest=manifests[key]
        if inv.sha((parent/name).read_bytes())!=manifest['files'].get(name):raise ValueError("Private cache differs from frozen index")
        caches.append(name)
    if 'gapCachePath' in value:
        cache=inv.safe_path(root,value['gapCachePath'])
        if inv.sha(cache.read_bytes())!=value.get('gapCacheSha256'):raise ValueError('Current-source cache differs from pointer')
        caches.append(str(cache.relative_to(root.resolve())) if root.is_absolute() else value['gapCachePath'])
    inventory=manifests['index'][0]
    frozen=inv.load(inventory/'requirements.json');current=inv.load(registry)
    if frozen!=current:raise ValueError("Requirements changed; new requirements need explicit coverage registration")
    expected_knowledge=value.get('knowledgeSnapshotSha256')
    if not expected_knowledge and 'phaseB' in manifests:
        expected_knowledge=manifests['phaseB'][1]['files'].get('implementation-and-docs/knowledge/policy-inventory/current.md')
    if not expected_knowledge or inv.sha(Path(knowledge).read_bytes())!=expected_knowledge:raise ValueError("Knowledge entry differs from current frozen phase")
    try:age=(datetime.now(timezone.utc)-datetime.fromisoformat(value['updatedAt'].replace('Z','+00:00'))).total_seconds()/3600
    except (ValueError,TypeError):raise ValueError("Invalid timezone-aware inventory timestamp")
    if not -1/12 <= age <= max_age_hours:raise ValueError("Material entry is stale/future-dated; refresh diagnostics without rewriting historical evidence")
    return {'checkedAt':inv.now(),'pointerSha256':inv.sha(pointer.read_bytes()),'checkedManifestKeys':list(manifests),'verifiedCaches':caches,'requirementsVersion':current['version'],'materialPointerAgeHours':round(age,3),'materialEntryAgeLimitHours':max_age_hours,'knowledgeMatchesFrozenPhase':True,'policyCurrentness':'not_established_by_inventory','sourceSemanticReview':'not_asserted'}


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--pointer',default='.local/policy-inventory/current.json');p.add_argument('--registry',default='docs/policy-audit-requirements-v1.json');p.add_argument('--knowledge',default='knowledge/policy-inventory/current.md');p.add_argument('--max-age-hours',type=float,default=168);args=p.parse_args()
    if args.max_age_hours<=0:p.error('max-age-hours must be positive')
    print(json.dumps(inspect(args.pointer,args.registry,args.knowledge,args.max_age_hours),ensure_ascii=False,indent=2))
