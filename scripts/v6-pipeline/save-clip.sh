#!/bin/zsh
# save-clip.sh <workspace> <abbr>: write the clipboard (ChatGPT "copy file content" on the file preview) to
# <workspace>/chatgpt-audit/<abbr>.json after JSON validation. Downloads do not reach ~/Downloads from the automated
# browser; this is the path that works (docs/v6-pipeline.md, S1c).
set -euo pipefail
ws=${1:?workspace}; a=${2:?abbr}; N=$ws/chatgpt-audit; mkdir -p $N
LC_ALL=en_US.UTF-8 pbpaste > $N/$a.json.tmp
python3 -c "
import json,sys;d=json.load(open(sys.argv[1]));assert isinstance(d,dict) and 'documents' in d, list(d)[:5]
print(sys.argv[2], d.get('university'), 'docs',len(d['documents']),'omissions',len(d.get('omissions',[])),'claimReview',len(d.get('claimReview',[])),'gaps',len(d.get('gaps',[])))" $N/$a.json.tmp $a && mv $N/$a.json.tmp $N/$a.json && wc -c < $N/$a.json
