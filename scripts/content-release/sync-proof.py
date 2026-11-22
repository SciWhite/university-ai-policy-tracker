#!/usr/bin/env python3
"""Synchronization proofs as a hash manifest (docs/content-release.md §5.3, contract 2.1.0 unchanged).

A 2.1.0 `changes` surface receipt points at a frozen copy of the release's change projection
(`proof/public-change-history/...`) inside the receipt package, and the gate re-reads every
object of it. Until 2026-11-21 that copy was a full byte copy: 1.16 GB per phase, twice per
content release, uploaded and kept in every operation directory (`/srv/uapt/operations`
reached 34.5 GB). Every one of those files is also an object of the content release itself.

This tool keeps the contract and the gate exactly as they are and changes only how the bytes
get there:

  dehydrate <sync-dir>             write proof-manifest.json ([path, sha256, bytes] of every file
                                   under proof/), then delete the proof files. Upload only this.
  materialize <sync-dir> --store <objects-dir> [--store <objects-dir> ...]
                                   recreate every listed file as a hard link to the content-addressed
                                   object <store>/<sha[:2]>/<sha> (first store that has it), verify
                                   size and SHA256, refuse anything else. Zero extra bytes.
  verify <sync-dir>                every listed file present with its size and SHA256.

The gate reads the same paths with the same hashes, so receipts, events and the 2.1.0 checks
are byte-identical to a full copy. Python 3.10, standard library only (runs on the host).
"""
import argparse, hashlib, json, os, sys
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = 'uapt-sync-proof-manifest-v1'
MANIFEST = 'proof-manifest.json'
PROOF_DIR = 'proof'
HEX64 = set('0123456789abcdef')


class ProofError(Exception):
    pass


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def _safe_rel(rel):
    parts = rel.split('/')
    if not rel or rel.startswith('/') or any(p in ('', '.', '..') for p in parts) or parts[0] != PROOF_DIR:
        raise ProofError('Unsafe proof path: ' + repr(rel))
    return rel


def _is_sha(value):
    return isinstance(value, str) and len(value) == 64 and set(value) <= HEX64


def read_manifest(sync_dir):
    path = Path(sync_dir) / MANIFEST
    if not path.is_file():
        raise ProofError('No ' + MANIFEST + ' in ' + str(sync_dir))
    data = json.loads(path.read_text())
    if data.get('schemaVersion') != SCHEMA or not isinstance(data.get('files'), list):
        raise ProofError('Invalid proof manifest: ' + str(path))
    seen = set()
    for row in data['files']:
        if not (isinstance(row, list) and len(row) == 3 and isinstance(row[0], str) and _is_sha(row[1]) and isinstance(row[2], int) and row[2] >= 0):
            raise ProofError('Invalid proof manifest row: ' + repr(row)[:200])
        _safe_rel(row[0])
        if row[0] in seen:
            raise ProofError('Duplicate proof path: ' + row[0])
        seen.add(row[0])
    if data.get('totalBytes') != sum(r[2] for r in data['files']):
        raise ProofError('Proof manifest totalBytes does not match its rows')
    return data


def build_manifest(sync_dir):
    root = Path(sync_dir)
    proof = root / PROOF_DIR
    if not proof.is_dir():
        raise ProofError('No proof/ directory in ' + str(sync_dir))
    rows = []
    for path in sorted(p for p in proof.rglob('*')):
        if path.is_symlink():
            raise ProofError('Symlink in proof tree: ' + str(path))
        if path.is_file():
            rel = path.relative_to(root).as_posix()
            rows.append([_safe_rel(rel), sha256_file(path), path.stat().st_size])
    if not rows:
        raise ProofError('Empty proof tree: ' + str(proof))
    return {'schemaVersion': SCHEMA, 'createdAt': datetime.now(timezone.utc).isoformat(),
            'note': 'Files under proof/ are content-addressed objects of the release; materialize them with sync-proof.py before the sync gate.',
            'files': rows, 'totalBytes': sum(r[2] for r in rows)}


def dehydrate(sync_dir, dry_run=False):
    root = Path(sync_dir)
    manifest = build_manifest(root)
    existing = root / MANIFEST
    if existing.exists():
        prior = read_manifest(root)
        if prior['files'] != manifest['files']:
            raise ProofError('A different proof manifest already exists: ' + str(existing))
        manifest = prior
    if dry_run:
        return {'files': len(manifest['files']), 'bytes': manifest['totalBytes'], 'written': False}
    tmp = root / (MANIFEST + '.tmp')
    tmp.write_text(json.dumps(manifest, indent=1) + '\n')
    os.replace(tmp, existing)
    for rel, _, _ in manifest['files']:
        (root / rel).unlink()
    for directory in sorted((p for p in (root / PROOF_DIR).rglob('*') if p.is_dir()), key=lambda p: -len(p.parts)):
        directory.rmdir()
    (root / PROOF_DIR).rmdir()
    return {'files': len(manifest['files']), 'bytes': manifest['totalBytes'], 'written': True, 'manifest': str(existing)}


def _store_object(stores, digest, size):
    for store in stores:
        candidate = Path(store) / digest[:2] / digest
        if candidate.is_file() and not candidate.is_symlink() and candidate.stat().st_size == size:
            return candidate
    return None


def materialize(sync_dir, stores, copy=False):
    """Hard-link (or copy, across filesystems) every listed file from the object stores."""
    root = Path(sync_dir)
    manifest = read_manifest(root)
    linked = present = copied = 0
    missing = []
    for rel, digest, size in manifest['files']:
        target = root / rel
        if target.is_symlink():
            raise ProofError('Symlink at proof path: ' + rel)
        if target.exists():
            if target.stat().st_size != size or sha256_file(target) != digest:
                raise ProofError('Existing proof file differs from the manifest: ' + rel)
            present += 1
            continue
        source = _store_object(stores, digest, size)
        if source is None:
            missing.append(rel)
            continue
        if sha256_file(source) != digest:
            raise ProofError('Object store file does not match its name: ' + str(source))
        target.parent.mkdir(parents=True, exist_ok=True)
        if copy:
            tmp = target.with_name(target.name + '.tmp')
            with open(source, 'rb') as src, open(tmp, 'wb') as dst:
                for chunk in iter(lambda: src.read(1 << 20), b''):
                    dst.write(chunk)
            os.replace(tmp, target)
            copied += 1
        else:
            os.link(source, target)
            linked += 1
        if sha256_file(target) != digest:
            raise ProofError('Materialized proof file does not match: ' + rel)
    if missing:
        raise ProofError(f'{len(missing)} proof objects are in no object store (first: {missing[0]}); upload them with the operation objects')
    return {'files': len(manifest['files']), 'linked': linked, 'copied': copied, 'alreadyPresent': present, 'bytes': manifest['totalBytes']}


def verify(sync_dir):
    root = Path(sync_dir)
    manifest = read_manifest(root)
    bad = [rel for rel, digest, size in manifest['files']
           if not (root / rel).is_file() or (root / rel).stat().st_size != size or sha256_file(root / rel) != digest]
    if bad:
        raise ProofError(f'{len(bad)} proof files missing or changed (first: {bad[0]})')
    return {'files': len(manifest['files']), 'bytes': manifest['totalBytes'], 'verified': True}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest='command', required=True)
    d = sub.add_parser('dehydrate'); d.add_argument('sync_dir'); d.add_argument('--dry-run', action='store_true')
    m = sub.add_parser('materialize'); m.add_argument('sync_dir'); m.add_argument('--store', action='append', required=True)
    m.add_argument('--copy', action='store_true', help='copy instead of hard-linking (different filesystems)')
    v = sub.add_parser('verify'); v.add_argument('sync_dir')
    args = parser.parse_args(argv)
    if args.command == 'dehydrate': result = dehydrate(args.sync_dir, args.dry_run)
    elif args.command == 'materialize': result = materialize(args.sync_dir, args.store, args.copy)
    else: result = verify(args.sync_dir)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except ProofError as error:
        print('sync-proof refused: ' + str(error), file=sys.stderr)
        sys.exit(2)
