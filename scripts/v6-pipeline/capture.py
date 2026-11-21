#!/usr/bin/env python3
"""S2 capture: fetch each queued source once over plain HTTPS (curl): raw bytes + SHA256, line-numbered text for
evidence selectors (pdftotext for PDF, paragraph text for DOCX, block text for HTML). No challenge solving: a bot-check
page is recorded with status "challenge" (an access gap, never evidence). Same-host spacing of at least 4 s.

  python3 scripts/v6-pipeline/capture.py --workspace <dir> [rows.tsv]     (default sources.tsv; rows: abbr, key, language, url)

Pages a normal browser gets but plain HTTP is refused can be re-captured by render_capture.py (kind html_rendered).
"""
import collections, hashlib, io, json, re, subprocess, sys, threading, time, urllib.parse, zipfile, html as _html
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v6batch as B  # noqa: E402

CHALLENGE = re.compile(r"anubis|making sure you.?re not a bot|just a moment|verify you are human|captcha|cf-chl|attention required", re.I)
UA = 'Mozilla/5.0 (compatible; UAPT-policy-capture/1.0; +https://eduaipolicy.org)'


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


def html_lines(b: bytes) -> str:
    h = HTML(); h.feed(b.decode('utf-8', 'replace'))
    return '\n'.join(l for l in (re.sub(r'\s+', ' ', p).strip() for p in ''.join(h.parts).splitlines()) if l) + '\n'


def docx_lines(b: bytes):
    z = zipfile.ZipFile(io.BytesIO(b))
    if 'word/document.xml' not in z.namelist():
        return None
    xml = z.read('word/document.xml').decode('utf-8', 'replace')
    paras = [''.join(re.findall(r'<w:t(?: [^>]*)?>([^<]*)</w:t>', para)) for para in re.findall(r'<w:p[ >].*?</w:p>', xml, re.S)]
    return '\n'.join(l for l in (re.sub(r'\s+', ' ', _html.unescape(x)).strip() for x in paras) if l) + '\n'


def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()


locks = collections.defaultdict(threading.Lock); last = collections.defaultdict(float)


def capture(ws, line):
    s, k, l, u = line.split('\t')[:4]
    d = ws / 'captures' / s; d.mkdir(parents=True, exist_ok=True); r = d / (k + '.json')
    if r.exists():
        return
    host = urllib.parse.urlsplit(u).hostname or ''
    raw = d / (k + '.body'); txt = d / (k + '.txt')
    with locks[host]:
        wait = 4 - (time.time() - last[host])
        if wait > 0: time.sleep(wait)
        x = subprocess.run(['curl', '--silent', '--show-error', '--location', '--max-time', '45', '--proto', '=https', '--proto-redir', '=https', '-A', UA,
                            '--write-out', '%{http_code}\t%{content_type}\t%{url_effective}', '--output', str(raw), u], capture_output=True, text=True)
        last[host] = time.time()
    status, content, final = (x.stdout.split('\t') + ['', '', ''])[:3]
    meta = {'key': k, 'url': u, 'language': l, 'status': status, 'contentType': content, 'finalUrl': final,
            'retrievedAt': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'), 'error': x.stderr.strip()}
    if raw.exists():
        meta['rawSha256'] = sha(raw)
        if status == '200':
            b = raw.read_bytes()
            if b.startswith(b'%PDF-'):
                subprocess.run(['pdftotext', str(raw), str(txt)], capture_output=True, check=True); meta['kind'] = 'pdf'
            elif b.startswith(b'PK'):
                meta['kind'] = 'office_archive'
                try:
                    text = docx_lines(b)
                    if text is not None: txt.write_text(text); meta['kind'] = 'docx'
                except zipfile.BadZipFile:
                    pass
            elif 'html' in content or b.lstrip()[:1] == b'<':
                txt.write_text(html_lines(b)); meta['kind'] = 'html'
            if txt.exists():
                meta['textSha256'] = sha(txt); meta['textChars'] = len(txt.read_text(errors='replace'))
                if CHALLENGE.search(txt.read_text(errors='replace')[:4000]) and meta['textChars'] < 4000:
                    meta['status'] = 'challenge'  # bot-check page: an access gap, never evidence; not bypassed
    r.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + '\n')
    print(s, k, meta['status'], meta.get('kind'), meta.get('textChars', 0), u[:90], flush=True)


def main():
    ws, args = B.workspace_from_argv()
    B.load(ws)
    rows = [l for l in (ws / (args[0] if args else 'sources.tsv')).read_text().splitlines() if l.strip()]
    with ThreadPoolExecutor(max_workers=12) as ex:
        list(ex.map(lambda line: capture(ws, line), rows))


if __name__ == '__main__':
    main()
