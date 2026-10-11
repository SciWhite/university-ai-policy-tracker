#!/usr/bin/env python3
"""Update the existing unprivileged OpenClaw adapter; no timers or jobs are started."""
import argparse
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

def replace_once(text, old, new):
    if text.count(old) != 1:
        raise ValueError('Unexpected adapter layout; refusing an unreviewed patch')
    return text.replace(old, new, 1)

def render(repo, bin_dir):
    launcher = (bin_dir/'uapt-light-review-user.ts').read_text()
    upstream = (repo/'scripts/start-lightweight-maintenance-review.ts').read_text()
    start, end = '\nfunction prompt(', '\nfunction parseArgs('
    launcher = launcher[:launcher.index(start)] + upstream[upstream.index(start):upstream.index(end)] + launcher[launcher.index(end):]
    launcher = replace_once(launcher, '    options.repo,\n    "staging",\n    "uapt-runs",', '    options.maintenanceRoot,\n    "artifact-runs",')
    launcher = replace_once(launcher, '    ensureDir(notes);', '    ensureDir(notes);\n    mkdirSync(path.join(runRoot, "review-coverage"), { recursive: true, mode: 0o700 });\n    mkdirSync(path.join(runRoot, "source-evidence"), { recursive: true, mode: 0o700 });')
    launcher = replace_once(launcher, '          model: options.model,', '          model: options.model,\n          prompt: prompt(target, artifactDir, noteFile, options),')
    batch = (bin_dir/'uapt-review-batch').read_text()
    batch = replace_once(batch, 'set -euo pipefail', 'set -euo pipefail\numask 077')
    batch = replace_once(batch, 'root=/home/openclaw/workspace/staging/uapt-maintenance', 'root=/home/openclaw/workspace/staging/uapt-maintenance\ntest -s "$repo/docs/openclaw-policy-maintenance-contract.md"\ntest -s "$repo/scripts/record-maintenance-sync.py"')
    batch = replace_once(batch, 'for p in (note, artifacts):', 'private_artifacts = os.path.join(os.path.dirname(base), "artifact-runs",\n                                     "uapt-maintenance-light-" + run + "-" + iid, "artifacts.json")\n    for p in (note, artifacts, private_artifacts):')
    batch = replace_once(batch, '"$root" "$repo/staging/uapt-runs"', '"$root" "$root/artifact-runs"')
    return {'uapt-light-review-user.ts': launcher, 'uapt-review-batch': batch}

if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--repo',type=Path,required=True)
    p.add_argument('--bin-dir',type=Path,required=True)
    p.add_argument('--apply',action='store_true')
    args=p.parse_args()
    outputs=render(args.repo,args.bin_dir)
    stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    backup=args.bin_dir/'backups'/('policy-evidence-'+stamp)
    if args.apply:
        backup.mkdir(parents=True,mode=0o700)
        for name,text in outputs.items():
            source=args.bin_dir/name
            shutil.copy2(source,backup/name)
            temp=args.bin_dir/(name+'.new-'+stamp)
            temp.write_text(text);temp.chmod(source.stat().st_mode & 0o777)
            temp.replace(source)
    print(json.dumps({'applied':args.apply,'backup':str(backup) if args.apply else None,
        'sha256':{name:hashlib.sha256(text.encode()).hexdigest() for name,text in outputs.items()}},indent=2))
