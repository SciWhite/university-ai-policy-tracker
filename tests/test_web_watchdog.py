import datetime, importlib.util, io, json, tempfile, unittest, urllib.error
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('watchdog', Path(__file__).parents[1] / 'scripts/release/uapt-web-watchdog.py')
w = importlib.util.module_from_spec(spec); spec.loader.exec_module(w)

UPSTREAM = 'upstream uapt_next_backend {\n    server 127.0.0.1:3101 max_fails=3 fail_timeout=15s;\n    keepalive 32;\n}\nserver { listen 127.0.0.1:3199; }\n'
CONFIG = dict(w.DEFAULTS)
AT = datetime.datetime(2026, 11, 21, 18, 0, tzinfo=datetime.timezone.utc)


def unit(invocation='inv-1', started=100.0, active='active'):
    return {'ActiveState': active, 'InvocationID': invocation, 'MainPID': '42', 'ActiveEnterTimestampMonotonic': str(int(started * 1e6)), 'ControlGroup': '/system.slice/x.service'}


class Response(io.BytesIO):
    def __init__(self, status=200):
        super().__init__(b'{}'); self.status = status
    def __enter__(self): return self
    def __exit__(self, *a): return False


class DecideTests(unittest.TestCase):
    def decide(self, ok, previous=None, *, pending=False, u=None, at=AT, uptime=10_000.0, warmed=True, memory=('memory.current near memory.max',), **config):
        return w.decide({'probe': {'ok': ok}}, config={**CONFIG, **config}, pending=pending, unit=u or unit(), previous=previous or {}, at=at, uptime=uptime,
                        warmed=warmed, memory=memory)

    def test_restarts_only_after_consecutive_failures(self):
        action, state = self.decide(False); self.assertEqual((action, state['failures']), ('fail', 1))
        action, state = self.decide(False, state); self.assertEqual((action, state['failures']), ('fail', 2))
        action, state = self.decide(True, state); self.assertEqual((action, state['failures']), ('ok', 0))
        for _ in range(2): action, state = self.decide(False, state)
        action, state = self.decide(False, state)
        self.assertEqual(action, 'restart'); self.assertEqual(state['restarts'], [AT.isoformat()]); self.assertEqual(state['failures'], 0)

    def test_never_acts_during_a_transaction_start_up_or_when_inactive(self):
        failing = {'invocation': 'inv-1', 'failures': 5, 'memoryFailures': 5}
        self.assertEqual(self.decide(False, failing, pending=True)[0], 'skip:lifecycle-transaction')
        self.assertEqual(self.decide(False, failing, uptime=100.0 + 60)[0], 'skip:start-up-grace')
        # The grace lasts until the warm-up line, at most max_grace.
        self.assertEqual(self.decide(False, failing, uptime=100.0 + 2000, warmed=False)[0], 'skip:start-up-grace')
        self.assertEqual(self.decide(False, failing, uptime=100.0 + 2000, warmed=True)[0], 'restart')
        self.assertEqual(self.decide(False, failing, uptime=100.0 + 3700, warmed=False)[0], 'restart')
        self.assertEqual(self.decide(False, failing, u=unit(active='activating'))[0], 'skip:unit-not-active')
        self.assertEqual(self.decide(False, failing, pending=True)[1]['failures'], 0)
        self.assertEqual(w.decide({'probe': {'ok': False}}, config=CONFIG, pending=False, unit=unit(), previous=failing, at=AT, uptime=10_000.0, locked=True)[0], 'skip:release-lock-held')

    def test_a_new_invocation_resets_failures_but_keeps_restart_history(self):
        previous = {'invocation': 'inv-1', 'failures': 2, 'memoryFailures': 2, 'restarts': [(AT - datetime.timedelta(minutes=10)).isoformat()]}
        action, state = self.decide(False, previous, u=unit('inv-2'))
        self.assertEqual((action, state['failures'], state['invocation']), ('fail', 1, 'inv-2')); self.assertEqual(len(state['restarts']), 1)

    def test_without_memory_evidence_it_takes_ten_failures(self):
        state = {}
        for i in range(9):
            action, state = self.decide(False, state, memory=())
            self.assertEqual(action, 'fail', i)
        action, state = self.decide(False, state, memory=())
        self.assertEqual(action, 'restart'); self.assertIn('without memory evidence', state['restartReason'])
        # Memory evidence must be consecutive: one failure without it resets that count.
        state = {}
        for memory in [('x',), ('x',), (), ('x',), ('x',)]:
            action, state = self.decide(False, state, memory=memory)
        self.assertEqual(action, 'fail')
        self.assertEqual(self.decide(False, state, memory=('x',))[0], 'restart')

    def test_memory_evidence(self):
        self.assertEqual(w.memory_evidence({'memory.current': '6300000000', 'memory.max': '6442450944'}), ['memory.current near memory.max'])
        self.assertEqual(w.memory_evidence({'memory.current': '4000000000', 'memory.max': '6442450944'}), [])
        self.assertEqual(w.memory_evidence({'memory.pressure': 'some avg10=90.00 avg60=80.00 avg300=1 total=1\nfull avg10=88.00 avg60=60.50 avg300=1 total=1'}), ['memory.pressure full avg60 60.50'])
        self.assertEqual(w.memory_evidence({'process': {'State': 'D (disk sleep)'}}), ['process in D state'])
        self.assertEqual(w.memory_evidence({'memory.max': 'max', 'memory.current': '1'}), [])

    def test_cooldown_and_daily_limit_suppress_restarts(self):
        recent = {'invocation': 'inv-1', 'failures': 2, 'memoryFailures': 2, 'restarts': [(AT - datetime.timedelta(minutes=10)).isoformat()]}
        self.assertEqual(self.decide(False, recent)[0], 'suppressed:cooldown')
        many = {'invocation': 'inv-1', 'failures': 2, 'memoryFailures': 2, 'restarts': [(AT - datetime.timedelta(hours=h)).isoformat() for h in (2, 5, 9)]}
        self.assertEqual(self.decide(False, many)[0], 'suppressed:daily-limit')
        old = {'invocation': 'inv-1', 'failures': 2, 'memoryFailures': 2, 'restarts': [(AT - datetime.timedelta(hours=h)).isoformat() for h in (25, 30, 40)]}
        action, state = self.decide(False, old)
        self.assertEqual(action, 'restart'); self.assertEqual(state['restarts'], [AT.isoformat()])


class PartsTests(unittest.TestCase):
    def test_routed_port_reads_the_single_upstream_server(self):
        self.assertEqual(w.routed_port(UPSTREAM), 3101)
        with self.assertRaises(ValueError): w.routed_port(UPSTREAM.replace('keepalive', 'server 127.0.0.1:3102;\n keepalive'))
        with self.assertRaises(ValueError): w.routed_port('server { listen 127.0.0.1:3199; }')

    def test_probe_reports_status_and_errors(self):
        self.assertTrue(w.probe(3101, 1, lambda req, timeout: Response(200))['ok'])
        self.assertFalse(w.probe(3101, 1, lambda req, timeout: Response(503))['ok'])
        def slow(req, timeout): raise TimeoutError('timed out')
        result = w.probe(3101, 1, slow); self.assertEqual((result['ok'], result['status']), (False, 0)); self.assertIn('TimeoutError', result['error'])
        def failing(req, timeout): raise urllib.error.HTTPError(req.full_url, 504, 'Gateway', {}, None)
        self.assertEqual(w.probe(3101, 1, failing)['status'], 504)

    def test_release_lock_is_read_from_proc_locks_without_locking(self):
        import fcntl, os
        with tempfile.TemporaryDirectory() as d:
            lock = Path(d) / 'uapt-release.lock'
            self.assertFalse(w.lock_held(lock, ''))
            lock.write_text('')
            info = os.stat(lock); key = f'{os.major(info.st_dev):02x}:{os.minor(info.st_dev):02x}:{info.st_ino}'
            self.assertFalse(w.lock_held(lock, '1: FLOCK  ADVISORY  WRITE 912 00:1b:1468 0 EOF\n'))
            self.assertTrue(w.lock_held(lock, f'2: FLOCK  ADVISORY  WRITE 4242 {key} 0 EOF\n'))
            self.assertTrue(w.lock_held(lock, f'2: -> FLOCK  ADVISORY  WRITE 4243 {key} 0 EOF\n'))

    def test_transaction_pending(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / 'transaction.json'
            self.assertFalse(w.transaction_pending(path))
            path.write_text(json.dumps({'stage': 'complete'})); self.assertFalse(w.transaction_pending(path))
            path.write_text(json.dumps({'stage': 'selected_pending_acceptance'})); self.assertTrue(w.transaction_pending(path))
            path.write_text('{broken'); self.assertTrue(w.transaction_pending(path))


class MainTests(unittest.TestCase):
    def setUp(self):
        self.td = tempfile.TemporaryDirectory(); self.root = Path(self.td.name)
        (self.root / 'upstream.conf').write_text(UPSTREAM)
        self.calls = []

    def tearDown(self): self.td.cleanup()

    def run_main(self, ok, *extra):
        def run(args, **kwargs):
            self.calls.append(args)
            class Done: returncode = 0; stderr = ''; stdout = '\n'.join(f'{k}={v}' for k, v in unit().items())
            if args[0] == 'journalctl': Done.stdout = 'x\n{"message":"Runtime warm-up finished","requests":4021}\n'
            return Done()
        opener = (lambda req, timeout: Response(200)) if ok else (lambda req, timeout: (_ for _ in ()).throw(TimeoutError('timed out')))
        near_max = {'memory.current': '6400000000', 'memory.max': '6442450944'}
        with patch.object(w, 'uptime_seconds', return_value=10_000.0), patch.object(w, 'evidence', return_value=near_max), patch('builtins.print'):
            return w.main(list(extra), run=run, opener=opener, state_path=self.root / 'run/state.json', receipts=self.root / 'receipts',
                          upstream=self.root / 'upstream.conf', transaction=self.root / 'transaction.json', release_lock=self.root / 'no-lock')

    def test_three_failures_restart_once_with_a_receipt(self):
        for _ in range(3): self.run_main(False)
        restarts = [c for c in self.calls if c[:2] == ['systemctl', 'restart']]
        self.assertEqual(restarts, [['systemctl', 'restart', 'uapt-mcp-v6-candidate.service']])
        receipts = list((self.root / 'receipts').glob('restart-*.json'))
        self.assertEqual(len(receipts), 1)
        receipt = json.loads(receipts[0].read_text())
        self.assertEqual(receipt['action'], 'restart'); self.assertIn('evidence', receipt); self.assertIn('after', receipt)
        self.assertIn('memory.current near memory.max', receipt['reason'])
        self.assertEqual(len([c for c in self.calls if c[0] == 'journalctl']), 1)  # warm-up found once, then remembered
        events = [json.loads(l) for l in (self.root / 'receipts/events.jsonl').read_text().splitlines()]
        self.assertEqual([e['action'] for e in events], ['fail', 'fail', 'restart'])
        # Within the cooldown further failures only leave receipts.
        for _ in range(3): self.run_main(False)
        self.assertEqual(len([c for c in self.calls if c[:2] == ['systemctl', 'restart']]), 1)
        self.assertEqual(json.loads((self.root / 'run/state.json').read_text())['lastAction'], 'suppressed:cooldown')

    def test_a_restart_killed_midway_still_counts_for_the_cooldown(self):
        for _ in range(2): self.run_main(False)
        real = self.run_main
        def run_killed():
            near_max = {'memory.current': '6400000000', 'memory.max': '6442450944'}
            def run(args, **kwargs):
                if args[:2] == ['systemctl', 'restart']: raise KeyboardInterrupt('TimeoutStartSec')
                class Done: returncode = 0; stderr = ''; stdout = '\n'.join(f'{k}={v}' for k, v in unit().items())
                if args[0] == 'journalctl': Done.stdout = 'Runtime warm-up finished'
                return Done()
            with patch.object(w, 'uptime_seconds', return_value=10_000.0), patch.object(w, 'evidence', return_value=near_max), patch('builtins.print'):
                w.main([], run=run, opener=lambda req, timeout: (_ for _ in ()).throw(TimeoutError('t')), state_path=self.root / 'run/state.json',
                       receipts=self.root / 'receipts', upstream=self.root / 'upstream.conf', transaction=self.root / 'transaction.json', release_lock=self.root / 'no-lock')
        with self.assertRaises(KeyboardInterrupt): run_killed()
        state = json.loads((self.root / 'run/state.json').read_text())
        self.assertEqual((state['lastAction'], len(state['restarts'])), ('restart-started', 1))
        for _ in range(3): real(False)
        self.assertFalse([c for c in self.calls if c[:2] == ['systemctl', 'restart']])

    def test_healthy_runs_write_no_events_and_dry_run_writes_nothing(self):
        self.run_main(True); self.run_main(True)
        self.assertFalse((self.root / 'receipts/events.jsonl').exists())
        self.run_main(False, '--dry-run', '--failures', '1')
        self.assertFalse([c for c in self.calls if c[:2] == ['systemctl', 'restart']])
        self.assertEqual(json.loads((self.root / 'run/state.json').read_text())['lastAction'], 'ok')

    def test_pending_transaction_blocks_any_restart(self):
        (self.root / 'transaction.json').write_text(json.dumps({'stage': 'prepared'}))
        for _ in range(5): self.run_main(False)
        self.assertFalse([c for c in self.calls if c[:2] == ['systemctl', 'restart']])


if __name__ == '__main__':
    unittest.main()
