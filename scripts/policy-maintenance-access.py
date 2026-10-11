#!/usr/bin/env python3
"""Reuse the evidence collector's public-origin and robots checks, without fetching policy bodies."""
import argparse
import importlib.util
import json
import os
from pathlib import Path

ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('gap_access',ROOT/'policy-gap-crawl.py')
gap=importlib.util.module_from_spec(spec);spec.loader.exec_module(gap)

def check(url, output):
    gap.public_address(url)
    collector=gap.Collector(output)
    rules=collector.rules(gap.origin(url))
    status='allowed'
    if not rules['available']:status='robots_unresolved_no_fetch'
    elif not rules['noRules'] and not rules['parser'].can_fetch(gap.AGENT,url):status='robots_disallowed'
    elif rules['delay']>30:status='robots_delay_requires_manual'
    proofs=[]
    for hop in rules['receipt']['chain']:
        h=hop['bodyArtifactId']
        proofs.append({'path':str(gap.inv.object_path(Path(output),h).relative_to(Path(output))),
                       'sha256':h,'representation':'robots_response_entity','truncated':False})
    return {'status':status,'delay':rules['delay'],'sourceUrl':url,'sourceEvidence':proofs}

if __name__=='__main__':
    os.umask(0o077)
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('url');p.add_argument('output',type=Path);args=p.parse_args()
    args.output.mkdir(parents=True,exist_ok=True,mode=0o700)
    try:result=check(args.url,args.output)
    except Exception as exc:result={'status':'robots_unresolved_no_fetch','error':str(exc),'sourceEvidence':[]}
    print(json.dumps(result))
