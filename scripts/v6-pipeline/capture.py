#!/usr/bin/env python3
"""S2 capture: fetch each queued source once over plain HTTPS (curl): raw bytes + SHA256, line-numbered text for
evidence selectors (pdftotext for PDF, paragraph text for DOCX, block text for HTML). No challenge solving: a bot-check
page is recorded with status "challenge" (an access gap, never evidence). Same-host spacing of at least 4 s.

  python3 scripts/v6-pipeline/capture.py --workspace <dir> [rows.tsv ...]   (default sources.tsv; rows: abbr, key, language, url)

One source never stops the queue (2026-11-22: pdftotext exit 99 under check=True aborted batch 4's whole pool):
- a text extraction failure (pdftotext error or timeout, unreadable or non-Word office archive) keeps the receipt and
  records `textError` {type, detail}: a typed text gap, never evidence;
- any other exception is logged and leaves no receipt, so a rerun retries that row; the exit code is then 1.
A receipt that already exists is never refetched; a receipt whose URL differs from its row's URL is a key conflict
(exit 1), never overwritten. Workers: batch.json capture.workers (default 12); rows are interleaved by host so the
per-host lock does not idle the pool. Progress: one JSON line per row in <workspace>/logs/capture.jsonl.

Pages a normal browser gets but plain HTTP is refused can be re-captured by render_capture.py (kind html_rendered).
"""
import collections, hashlib, io, json, os, re, shutil, subprocess, sys, threading, time, urllib.parse, zipfile, html as _html
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v6batch as B  # noqa: E402

CHALLENGE = re.compile(r"anubis|making sure you.?re not a bot|just a moment|verify you are human|captcha|cf-chl|attention required", re.I)
UA = 'Mozilla/5.0 (compatible; UAPT-policy-capture/1.0; +https://eduaipolicy.org)'
HOST_SPACING = 4.0  # seconds between two requests to the same host; not configurable downwards
DEFAULT_WORKERS = 12
PDFTOTEXT_TIMEOUT = 120


class HTML(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True); self.skip = 0; self.parts = []
    def handle_starttag(self, t, a):
        if t in ['script', 'style', 'svg', 'template', 'noscript']: self.skip += 1
        elif not self.skip and t in ['br', 'p', 'li', 'td', 'tr', 'div', 'section', 'h1', 'h2', 'h3', 'h4', 'h5', 'blockquote', 'dt', 'dd', 'article', 'header', 'footer']: self.parts.append('\n')
    def handle_endtag(self, t):
        if t in ['script', 'style', 'svg', 'template', 'noscript']: self.skip = max(0, self.skip - 1)
        elif not self.skip and t in ['p', 'li', 'td', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'title', 'blockquote']: self.parts.append('\n')
    def handle_data(self, t):
        if not self.skip: self.parts.append(t)


# Cloudflare Email Address Obfuscation on an official site replaces each address with "[email protected]" plus a
# data-cfemail (or /cdn-cgi/l/email-protection#<hex>) XOR encoding that only the browser's script decodes. Without this,
# the literal placeholder became evidence text (ASU, Berkeley, Caltech, 2026-11-26). Decode it before extraction.
CF_EMAIL_ELEMENT = re.compile(r'<(a|span)\b[^>]*\bdata-cfemail="([0-9a-fA-F]+)"[^>]*>.*?</\1>', re.I | re.S)
CF_EMAIL_HREF = re.compile(r'(href=")/cdn-cgi/l/email-protection#([0-9a-fA-F]+)(")', re.I)
CF_EMAIL_PLACEHOLDER = re.compile(r'\[email(?:\s|&#160;|&nbsp;|\xa0)+protected\]', re.I)


def cf_decode(hexed: str):
    """Cloudflare's encoding: first byte is the key, each following byte XOR key. None when malformed."""
    try:
        data = bytes.fromhex(hexed)
        if len(data) < 2: return None
        text = bytes(b ^ data[0] for b in data[1:]).decode('utf-8')
    except (ValueError, UnicodeDecodeError):
        return None
    return text if re.fullmatch(r'[^\s@<>"]+@[^\s@<>"]+', text) else None


def decode_cf_emails(html: str) -> str:
    def element(m):
        email = cf_decode(m.group(2))
        return _html.escape(email) if email else m.group(0)
    def href(m):
        email = cf_decode(m.group(2))
        return f'{m.group(1)}mailto:{_html.escape(email)}{m.group(3)}' if email else m.group(0)
    return CF_EMAIL_HREF.sub(href, CF_EMAIL_ELEMENT.sub(element, html))


def html_lines(b: bytes) -> str:
    h = HTML(); h.feed(decode_cf_emails(b.decode('utf-8', 'replace')))
    return '\n'.join(l for l in (re.sub(r'\s+', ' ', p).strip() for p in ''.join(h.parts).splitlines()) if l) + '\n'


def docx_lines(b: bytes):
    z = zipfile.ZipFile(io.BytesIO(b))
    if 'word/document.xml' not in z.namelist():
        return None
    xml = z.read('word/document.xml').decode('utf-8', 'replace')
    paras = [''.join(re.findall(r'<w:t(?: [^>]*)?>([^<]*)</w:t>', para)) for para in re.findall(r'<w:p[ >].*?</w:p>', xml, re.S)]
    return '\n'.join(l for l in (re.sub(r'\s+', ' ', _html.unescape(x)).strip() for x in paras) if l) + '\n'


def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def now(): return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


locks = collections.defaultdict(threading.Lock); last = collections.defaultdict(float)


class KeyConflict(Exception):
    """A receipt exists for this abbr/key but for another URL (e.g. sources.tsv regenerated after capture)."""


def pdf_text(raw, txt):
    """pdftotext into txt; returns None or a textError dict. A partial txt from a failed run is removed."""
    try:
        x = subprocess.run(['pdftotext', str(raw), str(txt)], capture_output=True, text=True, timeout=PDFTOTEXT_TIMEOUT)
    except subprocess.TimeoutExpired:
        txt.unlink(missing_ok=True)
        return {'type': 'pdftotext_timeout', 'detail': f'no result within {PDFTOTEXT_TIMEOUT} s'}
    if x.returncode != 0:
        txt.unlink(missing_ok=True)
        return {'type': 'pdftotext_failed', 'exitCode': x.returncode, 'detail': (x.stderr or '').strip()[-300:]}
    return None


def extract(meta, raw, txt, content):
    """Text for a 200 response. Sets meta kind / textError; never raises for a bad document."""
    b = raw.read_bytes()
    if b.startswith(b'%PDF-'):
        meta['kind'] = 'pdf'
        error = pdf_text(raw, txt)
        if error: meta['textError'] = error
    elif b.startswith(b'PK'):
        meta['kind'] = 'office_archive'
        try:
            text = docx_lines(b)
        except (zipfile.BadZipFile, KeyError, ValueError, OSError) as e:
            meta['textError'] = {'type': 'docx_unreadable', 'detail': f'{type(e).__name__}: {e}'[:300]}
        else:
            if text is None:
                meta['textError'] = {'type': 'office_archive_not_docx', 'detail': 'no word/document.xml (xlsx, pptx or other archive)'}
            else:
                txt.write_text(text); meta['kind'] = 'docx'
    elif 'html' in content or b.lstrip()[:1] == b'<':
        txt.write_text(html_lines(b)); meta['kind'] = 'html'


def write_receipt(path, meta):
    tmp = path.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + '\n')
    os.replace(tmp, path)  # a killed run never leaves a half-written receipt


def capture(ws, line):
    """Capture one row. Returns 'skipped' | the receipt status. Raises KeyConflict on a key/URL mismatch."""
    s, k, l, u = line.split('\t')[:4]
    d = ws / 'captures' / s; d.mkdir(parents=True, exist_ok=True); r = d / (k + '.json')
    if r.exists():
        old = json.loads(r.read_text()).get('url', '')
        if B.norm(old) != B.norm(u):
            raise KeyConflict(f'{s}/{k}: receipt is for {old}, row asks for {u}')
        return 'skipped'
    host = urllib.parse.urlsplit(u).hostname or ''
    raw = d / (k + '.body'); txt = d / (k + '.txt')
    txt.unlink(missing_ok=True)
    with locks[host]:
        wait = HOST_SPACING - (time.time() - last[host])
        if wait > 0: time.sleep(wait)
        try:
            x = subprocess.run(['curl', '--silent', '--show-error', '--location', '--max-time', '45', '--proto', '=https', '--proto-redir', '=https', '-A', UA,
                                '--write-out', '%{http_code}\t%{content_type}\t%{url_effective}', '--output', str(raw), u], capture_output=True, text=True, timeout=90)
        finally:
            last[host] = time.time()
    status, content, final = (x.stdout.split('\t') + ['', '', ''])[:3]
    meta = {'key': k, 'url': u, 'language': l, 'status': status, 'contentType': content, 'finalUrl': final,
            'retrievedAt': now(), 'error': x.stderr.strip()}
    if raw.exists():
        meta['rawSha256'] = sha(raw)
        if status == '200':
            extract(meta, raw, txt, content)
            if txt.exists():
                meta['textSha256'] = sha(txt); meta['textChars'] = len(txt.read_text(errors='replace'))
                if CHALLENGE.search(txt.read_text(errors='replace')[:4000]) and meta['textChars'] < 4000:
                    meta['status'] = 'challenge'  # bot-check page: an access gap, never evidence; not bypassed
    write_receipt(r, meta)
    return meta


def interleave_by_host(rows):
    """Round-robin over hosts so workers spread across hosts instead of queueing on one host lock."""
    queues = collections.OrderedDict()
    for line in rows:
        host = urllib.parse.urlsplit(line.split('\t')[3]).hostname or ''
        queues.setdefault(host, collections.deque()).append(line)
    out = []
    while queues:
        for host in list(queues):
            out.append(queues[host].popleft())
            if not queues[host]: del queues[host]
    return out


def read_rows(ws, files):
    """Rows of every queue file; a repeated row is read once, one abbr/key queued for two URLs is refused."""
    rows, urls = [], {}
    for name in files:
        path = Path(name) if Path(name).is_absolute() else ws / name
        for line in path.read_text().splitlines():
            if not line.strip(): continue
            parts = line.split('\t')
            if len(parts) < 4: raise B.BatchError(f'{path.name}: row needs abbr, key, language, url: {line[:120]}')
            ident = (parts[0], parts[1])
            if ident in urls:
                if B.norm(urls[ident]) != B.norm(parts[3]):
                    raise B.BatchError(f'{parts[0]}/{parts[1]} is queued for two URLs ({urls[ident]} and {parts[3]}); give one a new key')
                continue
            urls[ident] = parts[3]; rows.append(line)
    return rows


def run(ws, rows, workers=DEFAULT_WORKERS, log_path=None, one=None):
    """Capture every row; never stops on one row. Returns counts {total, fetched, skipped, textErrors, errors, conflicts}."""
    one = one or capture
    log_path = Path(log_path or ws / 'logs' / 'capture.jsonl'); log_path.parent.mkdir(parents=True, exist_ok=True)
    rows = interleave_by_host(rows)
    counts = collections.Counter(total=len(rows))
    log_lock = threading.Lock()

    def log(entry):
        with log_lock, log_path.open('a') as f:
            f.write(json.dumps({'at': now(), **entry}, ensure_ascii=False) + '\n')

    log({'event': 'start', 'total': len(rows), 'workers': workers})

    def task(line):
        abbr, key, _, url = line.split('\t')[:4]
        entry = {'event': 'row', 'abbr': abbr, 'key': key, 'url': url[:200]}
        try:
            result = one(ws, line)
        except KeyConflict as e:
            entry.update(outcome='key_conflict', error=str(e)[:300])
        except Exception as e:  # noqa: BLE001 — one source must never stop the queue
            entry.update(outcome='error', error=f'{type(e).__name__}: {e}'[:300])
        else:
            if result == 'skipped':
                entry['outcome'] = 'skipped'
            else:
                entry.update(outcome='fetched', status=result.get('status'), kind=result.get('kind'), textChars=result.get('textChars', 0))
                if result.get('textError'): entry['textError'] = result['textError']['type']
        with log_lock:
            counts['done'] += 1
            counts[{'fetched': 'fetched', 'skipped': 'skipped', 'error': 'errors', 'key_conflict': 'conflicts'}[entry['outcome']]] += 1
            if entry.get('textError'): counts['textErrors'] += 1
            entry['done'] = counts['done']
        log(entry)
        if entry['outcome'] != 'skipped':
            print(abbr, key, entry.get('status', entry['outcome']), entry.get('kind'), entry.get('textError', ''), entry.get('textChars', ''), url[:90], flush=True)

    with ThreadPoolExecutor(max_workers=max(1, int(workers))) as ex:
        for future in [ex.submit(task, line) for line in rows]:
            future.result()  # task() catches everything; this only surfaces a bug in the logging itself
    result = {k: counts[k] for k in ('total', 'fetched', 'skipped', 'textErrors', 'errors', 'conflicts')}
    log({'event': 'end', **result})
    return result


def workers_for(batch):
    value = (batch.get('capture') or {}).get('workers', DEFAULT_WORKERS)
    if not isinstance(value, int) or not 1 <= value <= 32:
        raise B.BatchError('batch.json capture.workers must be an integer from 1 to 32')
    return value


def main():
    ws, args = B.workspace_from_argv()
    batch = B.load(ws)
    if not shutil.which('pdftotext'):
        raise B.BatchError('pdftotext is not on PATH (poppler); without it every PDF would become a text gap')
    rows = read_rows(ws, args or ['sources.tsv'])
    result = run(ws, rows, workers_for(batch))
    print(json.dumps(result), flush=True)
    return 1 if result['errors'] or result['conflicts'] else 0


if __name__ == '__main__':
    try: sys.exit(main())
    except B.BatchError as error:
        print('capture error: ' + str(error), file=sys.stderr); sys.exit(2)
