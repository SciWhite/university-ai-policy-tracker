#!/usr/bin/env python3
"""One command for the mechanical V6 stages up to the discovery gate (docs/v6-pipeline.md §2.1).

  pnpm v6:run --workspace <dir> [--until <stage>] [--skip <stage>[,<stage>]]
  python3 scripts/v6-pipeline/run.py --workspace <dir> ...

Stages, in order: 1 discover (Crawl4AI) → 2 firecrawl → 3 select (sources.tsv, --append) → 4 firecrawl-sources →
5 chatgpt-sources (only when chatgpt-audit/<abbr>.json exist) → 6 capture (every queue file) → 7 render-capture
(challenge / refused rows) → 8 g1 (gates.py discovery). Default --until g1.

Why (2026-11-22, batch 4): an agent drove each stage by hand (179 turns in one turn) and then waited 1.5 h on a
detached capture that had died. This driver runs everything in one process, never detaches, and prints one short JSON
summary on stdout (also run/summary.json): per-school counts, gaps and the next manual step. Stage output goes to
run/stage-<n>/log.txt and run/run.log; the agent reads only the summary.

Resume: every stage works out what is still missing (schools without discovery or Firecrawl output, queued rows
without a receipt, refused rows without a render attempt) and does only that; select / firecrawl-sources /
chatgpt-sources only append. Each stage writes run/stage-<n>/receipt.json. A rerun after a crash or a fix continues
where the last one stopped. One run per workspace at a time (run/lock).

Exit 0: every stage that ran finished (a failing G1 is a normal outcome; the summary names the next step).
Exit 1: a stage failed (a missing tool, a crawl or Firecrawl run that produced no output, capture errors, a timeout);
later stages still run, so a rerun after the fix has less to do. Exit 2: usage, batch.json, G0 inputs or lock.
"""
import fcntl, json, os, shutil, signal, subprocess, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v6batch as B  # noqa: E402
import capture as C  # noqa: E402
import gates as G  # noqa: E402

PIPE = Path(__file__).resolve().parent
STAGES = ['discover', 'firecrawl', 'select', 'firecrawl-sources', 'chatgpt-sources', 'capture', 'render-capture', 'g1']
ALIASES = {'gate': 'g1', 'discovery': 'g1', 'crawl': 'discover', 'render': 'render-capture'}
# Plain-HTTP outcomes a headless browser may still get past (no challenge solving; robots.txt respected).
RENDERABLE = {'challenge', '000', '', '401', '403', '406', '429', '503'}
NOT_RENDERABLE_SUFFIX = ('.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip')
DEFAULT_TIMEOUT_MIN = {'discover': 90, 'firecrawl': 60, 'capture': 240, 'render-capture': 90}
POLL = float(os.environ.get('UAPT_V6_RUN_POLL', '2'))


def crawl4ai_python():
    return os.environ.get('UAPT_CRAWL4AI_PYTHON') or sys.executable


def importable(python, module):
    try:
        return subprocess.run([python, '-c', f'import {module}'], capture_output=True, timeout=120).returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


class Run:
    def __init__(self, ws, batch):
        self.ws, self.batch = ws, batch
        self.dir = ws / 'run'; self.dir.mkdir(exist_ok=True)
        self.gaps = G._json(ws / 'discovery-gaps.json', {})
        self.gate = None
        timeouts = (batch.get('run') or {}).get('timeoutMinutes') or {}
        self.timeout = {k: 60 * float(timeouts.get(k, v)) for k, v in DEFAULT_TIMEOUT_MIN.items()}

    # -- plumbing -------------------------------------------------------------------------------------------------
    def log(self, message):
        with (self.dir / 'run.log').open('a') as f:
            f.write(f'{B.now()} {message}\n')

    def stage_dir(self, n):
        d = self.dir / f'stage-{n}'; d.mkdir(exist_ok=True); return d

    def call(self, n, name, cmd, progress=None):
        """Run one stage command in the foreground (own process group), output to run/stage-<n>/log.txt.
        Returns (returncode, timedOut). A hung tool is killed at the stage timeout, never waited on forever."""
        log_path = self.stage_dir(n) / 'log.txt'
        timeout = self.timeout.get(name, 3600)
        with log_path.open('a') as out:
            out.write(f'\n# {B.now()} {" ".join(str(c) for c in cmd)}\n'); out.flush()
            proc = subprocess.Popen([str(c) for c in cmd], stdout=out, stderr=subprocess.STDOUT, cwd=str(B.REPO), start_new_session=True)
            start = last_note = time.time()
            while proc.poll() is None:
                time.sleep(POLL)
                if progress and time.time() - last_note >= 30:
                    last_note = time.time(); note = progress()
                    if note: self.log(f'stage {n} {name}: {note}')
                if time.time() - start > timeout:
                    self.log(f'stage {n} {name}: timeout after {int(timeout)} s, stopping the process group')
                    for sig in (signal.SIGTERM, signal.SIGKILL):
                        try: os.killpg(proc.pid, sig)
                        except ProcessLookupError: break
                        try: proc.wait(15); break
                        except subprocess.TimeoutExpired: continue
                    return proc.wait(), True
        return proc.returncode, False

    def py(self, script):
        return [sys.executable, PIPE / script, '--workspace', self.ws]

    # -- stages ---------------------------------------------------------------------------------------------------
    def has_gap(self, abbr, layer):
        return bool((self.gaps.get(abbr) or {}).get(layer))

    def s_discover(self, n):
        todo = [s['abbr'] for s in self.batch['schools'] if not (self.ws / 'discovery' / f"{s['abbr']}.json").is_file() and not self.has_gap(s['abbr'], 'crawl')]
        if not todo:
            return {'status': 'done', 'ran': [], 'note': 'every school has discovery output or a crawl gap'}
        python = crawl4ai_python()
        if not importable(python, 'crawl4ai'):
            return {'status': 'failed', 'todo': todo, 'note': f'Crawl4AI is not importable by {python}: set UAPT_CRAWL4AI_PYTHON, or record a crawl gap in discovery-gaps.json'}
        code, timed_out = self.call(n, 'discover', [python, PIPE / 'discover.py', '--workspace', self.ws, *todo])
        missing = [a for a in todo if not (self.ws / 'discovery' / f'{a}.json').is_file()]
        if missing or code or timed_out:
            return {'status': 'failed', 'ran': todo, 'missing': missing, 'note': ('timeout; ' if timed_out else '') + f'no discovery output for {missing or "-"}; see run/stage-{n}/log.txt'}
        return {'status': 'done', 'ran': todo}

    def s_firecrawl(self, n):
        gaps, todo = [], []
        for s in self.batch['schools']:
            a = s['abbr']; cfg = s.get('firecrawl') or {}
            if self.has_gap(a, 'firecrawl') or (self.ws / 'firecrawl' / a / 'map.json').is_file():
                continue
            if not cfg.get('domain') or not cfg.get('queries'):
                if not (self.ws / 'firecrawl' / a).is_dir():
                    gaps.append(f'{a}: no firecrawl config in batch.json (add one, or record a firecrawl gap)')
                continue
            todo.append(a)
        if not todo:
            return {'status': 'done', 'ran': [], 'gaps': gaps}
        cli = os.environ.get('FIRECRAWL_BIN', str(Path.home() / '.local/bin/firecrawl'))
        if not (os.path.isfile(cli) and os.access(cli, os.X_OK)):
            return {'status': 'failed', 'todo': todo, 'gaps': gaps, 'note': f'firecrawl CLI not found at {cli} (FIRECRAWL_BIN)'}
        code, timed_out = self.call(n, 'firecrawl', self.py('firecrawl_discover.py') + todo)
        missing = [a for a in todo if not (self.ws / 'firecrawl' / a / 'map.json').is_file()]
        if missing or code or timed_out:
            return {'status': 'failed', 'ran': todo, 'missing': missing, 'gaps': gaps,
                    'note': ('timeout; ' if timed_out else '') + f'no Firecrawl map for {missing or "-"}; see firecrawl/<abbr>/err.log (credits, key, CLI login)'}
        return {'status': 'done', 'ran': todo, 'gaps': gaps}

    def rows_added(self, name, fn):
        path = self.ws / name
        before = len([l for l in path.read_text().splitlines() if l.strip()]) if path.is_file() else 0
        result = fn()
        after = len([l for l in path.read_text().splitlines() if l.strip()]) if path.is_file() else 0
        return result, after - before

    def s_select(self, n):
        (code, timed_out), added = self.rows_added('sources.tsv', lambda: self.call(n, 'select', self.py('select_sources.py') + ['--append']))
        if code or timed_out:
            return {'status': 'failed', 'note': f'select_sources.py exit {code}; see run/stage-{n}/log.txt'}
        return {'status': 'done', 'rowsAdded': added}

    def s_firecrawl_sources(self, n):
        if not any((self.ws / 'firecrawl' / s['abbr']).is_dir() for s in self.batch['schools']):
            return {'status': 'skipped', 'note': 'no Firecrawl output yet'}
        cap = int((self.batch.get('discovery') or {}).get('firecrawlCap', 25))
        (code, timed_out), added = self.rows_added('firecrawl-sources.tsv', lambda: self.call(n, 'firecrawl-sources', self.py('firecrawl_sources.py') + ['--cap', str(cap)]))
        if code or timed_out:
            return {'status': 'failed', 'note': f'firecrawl_sources.py exit {code}; see run/stage-{n}/log.txt'}
        return {'status': 'done', 'rowsAdded': added}

    def s_chatgpt_sources(self, n):
        audits = [s['abbr'] for s in self.batch['schools'] if (self.ws / 'chatgpt-audit' / f"{s['abbr']}.json").is_file()]
        if not audits:
            return {'status': 'skipped', 'note': 'no chatgpt-audit/<abbr>.json yet; G1 reports the ChatGPT layer as missing'}
        (code, timed_out), added = self.rows_added('chatgpt-sources.tsv', lambda: self.call(n, 'chatgpt-sources', self.py('chatgpt_sources.py') + audits))
        if code or timed_out:
            return {'status': 'failed', 'note': f'chatgpt_sources.py exit {code}; see run/stage-{n}/log.txt'}
        return {'status': 'done', 'ran': audits, 'rowsAdded': added}

    def s_capture(self, n):
        files = [q for q in B.QUEUE_FILES if (self.ws / q).is_file()]
        rows = C.read_rows(self.ws, files) if files else []
        todo = [r for r in rows if not (self.ws / 'captures' / r.split('\t')[0] / (r.split('\t')[1] + '.json')).is_file()]
        if not todo:
            return {'status': 'done', 'queued': len(rows), 'fetched': 0}
        if not shutil.which('pdftotext'):
            return {'status': 'failed', 'todo': len(todo), 'note': 'pdftotext (poppler) is not on PATH'}
        log_path = self.ws / 'logs' / 'capture.jsonl'
        offset = log_path.stat().st_size if log_path.is_file() else 0

        def events():
            if not log_path.is_file(): return []
            with log_path.open() as f:
                f.seek(offset); return [json.loads(l) for l in f if l.strip()]

        def progress():
            done = [e for e in events() if e.get('event') == 'row']
            return f'{len(done)}/{len(todo)} rows' if done else None
        code, timed_out = self.call(n, 'capture', self.py('capture.py') + files, progress)
        end = next((e for e in reversed(events()) if e.get('event') == 'end'), {})
        counts = {k: end.get(k) for k in ('fetched', 'skipped', 'textErrors', 'errors', 'conflicts')} if end else {}
        result = {'queued': len(rows), 'todo': len(todo), **counts}
        if timed_out or code or not end:
            left = sum(1 for r in todo if not (self.ws / 'captures' / r.split('\t')[0] / (r.split('\t')[1] + '.json')).is_file())
            return {'status': 'failed', **result, 'withoutReceipt': left,
                    'note': ('timeout; ' if timed_out else '') + f'capture exit {code}: {counts.get("errors") or 0} errors, {counts.get("conflicts") or 0} key conflicts; rows without a receipt are retried on rerun (logs/capture.jsonl)'}
        return {'status': 'done', **result}

    def render_candidates(self):
        out = []
        for s in self.batch['schools']:
            for p in sorted((self.ws / 'captures' / s['abbr']).glob('*.json')):
                r = json.loads(p.read_text())
                if (str(r.get('status', '')) in RENDERABLE and not r.get('renderAttempt') and r.get('hashKind') != 'rendered_dom'
                        and not r.get('url', '').lower().split('?')[0].endswith(NOT_RENDERABLE_SUFFIX)):
                    out.append(f"{s['abbr']}:{p.stem}")
        return out

    def s_render_capture(self, n):
        todo = self.render_candidates()
        if not todo:
            return {'status': 'done', 'ran': []}
        python = crawl4ai_python()
        if not importable(python, 'crawl4ai'):
            return {'status': 'skipped', 'todo': len(todo), 'gaps': [f'renderer unavailable ({python} has no crawl4ai): {len(todo)} refused/challenge rows stay access gaps'],
                    'note': 'set UAPT_CRAWL4AI_PYTHON and rerun to try them in a browser'}
        code, timed_out = self.call(n, 'render-capture', [python, PIPE / 'render_capture.py', '--workspace', self.ws, *todo])
        rendered = sum(1 for item in todo if json.loads((self.ws / 'captures' / item.split(':')[0] / (item.split(':')[1] + '.json')).read_text()).get('hashKind') == 'rendered_dom')
        result = {'ran': len(todo), 'rendered': rendered, 'stillGaps': len(todo) - rendered}
        if code or timed_out:
            return {'status': 'failed', **result, 'note': ('timeout; ' if timed_out else '') + f'render_capture.py exit {code}; see run/stage-{n}/log.txt'}
        return {'status': 'done', **result}

    def s_g1(self, n):
        try:
            gate = G.run_gate('discovery', self.ws, self.batch)
        except B.BatchError as e:
            return {'status': 'failed', 'note': f'gate error: {e}'}
        self.gate = gate
        return {'status': 'done', 'gate': gate['status'], 'failureCount': len(gate['failures'])}

    # -- driver ---------------------------------------------------------------------------------------------------
    def stage(self, n, name, skip):
        started = B.now(); t0 = time.time()
        self.log(f'stage {n} {name}: start')
        if name in skip:
            result = {'status': 'skipped', 'note': 'operator --skip'}
        else:
            try:
                result = getattr(self, 's_' + name.replace('-', '_'))(n)
            except Exception as e:  # noqa: BLE001 — record it and keep going; the rerun resumes
                result = {'status': 'failed', 'note': f'{type(e).__name__}: {e}'[:400]}
        receipt = {'schemaVersion': 'uapt-v6-run-stage-v1', 'batchId': self.batch['batchId'], 'stage': n, 'name': name,
                   'startedAt': started, 'finishedAt': B.now(), 'seconds': round(time.time() - t0, 1), **result,
                   'log': f'run/stage-{n}/log.txt' if (self.dir / f'stage-{n}' / 'log.txt').is_file() else None}
        B.write_json(self.stage_dir(n) / 'receipt.json', receipt)
        self.log(f'stage {n} {name}: {result["status"]} {result.get("note", "")}'.rstrip())
        return receipt


def school_rows(ws, batch, gate):
    queued = {}
    for name in B.QUEUE_FILES:
        path = ws / name
        for line in path.read_text().splitlines() if path.is_file() else []:
            parts = line.split('\t')
            if len(parts) >= 4: queued.setdefault(parts[0], set()).add(parts[1])
    out = {}
    for s in batch['schools']:
        a = s['abbr']
        keys = queued.get(a, set())
        receipts = {p.stem for p in (ws / 'captures' / a).glob('*.json')}
        row = {'queued': len(keys), 'pendingCapture': len(keys - receipts)}
        g = ((gate or {}).get('schools') or {}).get(a)
        if g:
            row.update(layers={k: ('done' if v == 'done' else 'gap') for k, v in g['layers'].items()},
                       missingLayers=sorted(set(G.LAYERS) - set(g['layers'])),
                       **{k: g.get(k, 0) for k in ('captures', 'leads', 'captured', 'accessGap', 'textGap', 'disposed')},
                       problems=len(g['problems']))
            if g['problems']: row['firstProblems'] = [p[:160] for p in g['problems'][:2]]
        out[a] = row
    return out


def next_step(ws, receipts, gate, until, schools):
    failed = [r for r in receipts if r['status'] == 'failed']
    cmd = f'pnpm v6:run --workspace {ws}'
    if failed:
        r = failed[0]
        return f"Fix stage {r['stage']} {r['name']}: {r.get('note', 'see its receipt')}. Then rerun `{cmd}` (finished work is kept)."
    if until != 'g1':
        return f'Stopped after {until} (--until). Rerun `{cmd}` to continue to G1.'
    if gate and gate['status'] == 'pass':
        return ('G1 passed. S3 drafting: one Sonnet subagent per school with prompts/DRAFT-BRIEF.md + prompts/INPUT-SPEC.md '
                'and that school\'s captures only; then v6:build-view and v6:finalize; review via ChatGPT, at most two rounds.')
    no_chatgpt = [a for a, r in schools.items() if 'chatgpt' in r.get('missingLayers', [])]
    total = sum(r.get('problems', 0) for r in schools.values())
    if no_chatgpt:
        return (f'S1c ChatGPT audit for {", ".join(no_chatgpt)} (prompts/CHATGPT-AUDIT.txt, then save-clip.sh <ws> <abbr>), '
                f'or a chatgpt gap in discovery-gaps.json; then rerun `{cmd}`. G1 has {total} open problems (gates/discovery.json).')
    return (f'Resolve the {total} open G1 problems in gates/discovery.json: capture or dispose each lead '
            f'(discovery-dispositions.json), record typed gaps (discovery-gaps.json), then rerun `{cmd}`.')


def parse(argv):
    ws, args = B.workspace_from_argv(argv)
    until, skip = 'g1', set()
    while args:
        flag = args.pop(0)
        if flag == '--':
            continue  # `pnpm v6:run -- --until capture`
        if flag in ('--until', '--skip') and args:
            values = [ALIASES.get(v, v) for v in args.pop(0).split(',') if v]
            bad = [v for v in values if v not in STAGES]
            if bad: raise B.BatchError(f'unknown stage {bad}; stages: {", ".join(STAGES)}')
            if flag == '--until':
                if len(values) != 1: raise B.BatchError('--until takes one stage')
                until = values[0]
            else:
                skip |= set(values)
        else:
            raise B.BatchError(f'unknown argument {flag}; usage: run.py --workspace <dir> [--until <stage>] [--skip <stage>[,<stage>]]')
    return ws, until, skip


def main(argv=None):
    ws, until, skip = parse(argv)
    batch = B.load(ws)
    missing = [f"{s['slug']}/public.json" for s in batch['schools'] if not (ws / s['slug'] / 'public.json').is_file()]
    if missing:
        raise B.BatchError('G0 inputs missing (status.py --init, then the live API record per school): ' + ', '.join(missing))
    (ws / 'run').mkdir(exist_ok=True)
    lock = (ws / 'run' / 'lock').open('w')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        raise B.BatchError('another v6:run is active on this workspace (run/lock); wait for it, do not start a second one')
    lock.write(str(os.getpid())); lock.flush()
    run = Run(ws, batch)
    run.log(f'run start until={until} skip={sorted(skip)} pid={os.getpid()}')
    receipts = []
    for n, name in enumerate(STAGES[:STAGES.index(until) + 1], 1):
        receipts.append(run.stage(n, name, skip))
    gate = run.gate
    schools = school_rows(ws, batch, run.gate)
    gaps = [g for r in receipts for g in r.get('gaps', [])]
    summary = {
        'schemaVersion': 'uapt-v6-run-summary-v1', 'batchId': batch['batchId'], 'finishedAt': B.now(),
        'status': 'failed' if any(r['status'] == 'failed' for r in receipts) else 'ok',
        'stages': {f"{r['stage']}-{r['name']}": r['status'] + (f" ({r['note']})" if r.get('note') and r['status'] != 'done' else '') for r in receipts},
        'g1': {'status': gate['status'], 'failureCount': len(gate['failures'])} if gate else None,
        'schools': schools, 'gaps': gaps,
        'next': next_step(ws, receipts, gate, until, schools),
        'details': 'run/stage-<n>/receipt.json, gates/discovery.json, run/run.log',
    }
    B.write_json(ws / 'run' / 'summary.json', summary)
    run.log(f'run end status={summary["status"]}')
    print(json.dumps(summary, ensure_ascii=False, indent=1))
    return 1 if summary['status'] == 'failed' else 0


if __name__ == '__main__':
    try: sys.exit(main())
    except B.BatchError as error:
        print('v6:run error: ' + str(error), file=sys.stderr); sys.exit(2)
