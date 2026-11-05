#!/usr/bin/env python3
"""Install a content-free program artifact into a new release directory (R1-d).

Downloads the GitHub Actions artifact built by .github/workflows/program-build.yml
for one frozen SHA (or takes an operator-copied zip), verifies the tarball
SHA256, the build manifest and every file against its file list, and unpacks
it into <releases-root>/<name>. It never starts a service, routes traffic,
switches content or deletes a release: the lifecycle controller
(uapt-release-lifecycle.py) admits and starts the candidate later.

Disk admission follows docs/release-storage-policy.md: the policy's
diskCapacity (reserve bytes/inodes, project ceiling, per-role artifact cap) is
checked before the download and again before unpacking, under the release lock.
The only files it removes are its own staging copy of the download, after the
release directory verified; a failed run keeps it and says where it is (a
`builds/*` temporary artifact that must be registered or reviewed).

Usage (on the host, as the release operator):
  GH_TOKEN=<read-only actions token> program-artifact-install.py --sha <40-hex> --run-id <id>
  program-artifact-install.py --sha <40-hex> --zip <downloaded artifact .zip>
"""
import argparse, datetime, fcntl, hashlib, json, os, platform, re, shutil, subprocess, sys, tarfile, tempfile, urllib.request, zipfile
from pathlib import Path, PurePosixPath

ARTIFACT_SCHEMA = 'uapt-program-artifact-v1'
FILE_LIST_SCHEMA = 'uapt-program-file-list-v1'
RECEIPT_SCHEMA = 'uapt-program-install-receipt-v1'
MAX_UNPACKED_BYTES = 1024 ** 3
WORKFLOW_PATH = '.github/workflows/program-build.yml'
DEFAULT_REPO = 'SciWhite/university-ai-policy-tracker'
POLICY = Path('/srv/uapt/operations/release-lifecycle/policy.json')
LOCK = Path('/run/lock/uapt-release.lock')
MANIFEST_FILES = ('source-manifest.json', 'build-artifact-manifest.json')
SHA = re.compile(r'^[0-9a-f]{40}$')
HEX64 = re.compile(r'^[0-9a-f]{64}$')
NAME = re.compile(r'^uapt-program-[0-9a-f]{12}-[A-Za-z0-9_-]{8,64}$')


class Refused(Exception):
    pass


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b''):
            digest.update(chunk)
    return digest.hexdigest()


def now():
    return datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0)


def host_arch():
    machine = platform.machine().lower()
    return {'x86_64': 'x64', 'amd64': 'x64', 'aarch64': 'arm64', 'arm64': 'arm64'}.get(machine, machine)


def node_major(node_bin):
    version = subprocess.run([node_bin, '--version'], capture_output=True, text=True, check=True).stdout.strip()
    return version.lstrip('v').split('.')[0]


def project_bytes(root):
    for args in (['du', '-sx', '-B1', str(root)], ['du', '-sxk', str(root)]):
        result = subprocess.run(args, capture_output=True, text=True)
        if result.returncode == 0:
            value = int(result.stdout.split()[0])
            return value if '-B1' in args else value * 1024
    raise Refused('Cannot measure project disk usage')


def disk_admission(policy, role, additional_bytes, artifact_bytes):
    """Same live checks as the controller's validate_disk_budget, for this step's peak."""
    guard = policy.get('diskCapacity')
    if not guard:
        raise Refused('Policy has no diskCapacity; new releases require the installed disk admission')
    root = Path(guard['root']).resolve()
    fs = os.statvfs(root)
    free, inodes, used = fs.f_bavail * fs.f_frsize, fs.f_favail, project_bytes(root)
    caps = guard.get('artifactMaxBytesByRole', {})
    if role not in caps:
        raise Refused('Unknown artifact role: ' + role)
    if artifact_bytes > caps[role]:
        raise Refused('Program artifact exceeds the per-role artifact cap')
    if free - additional_bytes < guard['reserveBytes']:
        raise Refused('Insufficient disk reserve for this download/unpack peak')
    if inodes < guard['reserveInodes']:
        raise Refused('Insufficient free inodes')
    if used + additional_bytes > guard['projectMaxBytes']:
        raise Refused('UAPT disk budget exceeded; archive before installing')
    return {'root': str(root), 'freeBytes': free, 'availableInodes': inodes, 'projectBytes': used, 'additionalBytes': additional_bytes}


def github_json(url, token):
    request = urllib.request.Request(url, headers={'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'})
    request.add_unredirected_header('Authorization', 'Bearer ' + token)
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def locate_artifact(repo, run_id, sha, token):
    run = github_json(f'https://api.github.com/repos/{repo}/actions/runs/{run_id}', token)
    expected = {'head_sha': sha, 'path': WORKFLOW_PATH, 'event': 'workflow_dispatch', 'status': 'completed', 'conclusion': 'success'}
    for key, value in expected.items():
        if run.get(key) != value:
            raise Refused(f'Workflow run {run_id} {key}={run.get(key)!r}, expected {value!r}')
    if run.get('repository', {}).get('full_name') != repo:
        raise Refused('Workflow run belongs to another repository')
    listing = github_json(f'https://api.github.com/repos/{repo}/actions/runs/{run_id}/artifacts?name=uapt-program-{sha}', token)
    artifacts = [item for item in listing.get('artifacts', []) if item.get('name') == f'uapt-program-{sha}' and not item.get('expired')]
    if len(artifacts) != 1:
        raise Refused('Expected exactly one unexpired artifact uapt-program-' + sha)
    return artifacts[0]


def download(url, token, destination, max_bytes):
    request = urllib.request.Request(url)
    # The archive URL redirects to signed storage, which must not receive the token.
    request.add_unredirected_header('Authorization', 'Bearer ' + token)
    written = 0
    with urllib.request.urlopen(request, timeout=300) as response, open(destination, 'wb') as handle:
        for chunk in iter(lambda: response.read(1 << 20), b''):
            written += len(chunk)
            if written > max_bytes:
                raise Refused('Download exceeds the announced artifact size')
            handle.write(chunk)
    return written


def read_artifact_zip(zip_path, out_dir):
    with zipfile.ZipFile(zip_path) as archive:
        names = archive.namelist()
        tarballs = [n for n in names if n.endswith('.tar.gz')]
        if len(tarballs) != 1 or set(names) != {tarballs[0], tarballs[0] + '.sha256', 'artifact.json'}:
            raise Refused('Artifact zip must hold exactly the tarball, its .sha256 and artifact.json')
        for name in names:
            if '/' in name or name.startswith('.'):
                raise Refused('Unsafe artifact member ' + name)
            archive.extract(name, out_dir)
    return Path(out_dir) / tarballs[0], Path(out_dir) / 'artifact.json'


def verify_summary(summary, tarball, sha, node_bin, production_env):
    if summary.get('schemaVersion') != ARTIFACT_SCHEMA:
        raise Refused('Unknown artifact schema')
    if summary.get('codeSha') != sha:
        raise Refused('Artifact codeSha differs from the frozen SHA')
    if summary.get('diagnostic'):
        raise Refused('Diagnostic (--local) artifacts cannot be installed')
    artifact = summary.get('artifact', {})
    name = artifact.get('name', '')
    if not NAME.match(name) or name != f'uapt-program-{sha[:12]}-{summary.get("BUILD_ID")}' or artifact.get('file') != name + '.tar.gz' or tarball.name != artifact['file']:
        raise Refused('Artifact name does not match its SHA and BUILD_ID')
    actual = sha256_file(tarball)
    declared = (tarball.parent / (tarball.name + '.sha256')).read_text().split()
    if not HEX64.match(artifact.get('sha256', '')) or actual != artifact['sha256'] or declared != [actual, tarball.name] or tarball.stat().st_size != artifact.get('bytes'):
        raise Refused('Tarball SHA256 or size mismatch')
    builder = summary.get('builder', {})
    if builder.get('platform') != sys.platform or builder.get('arch') != host_arch():
        raise Refused(f'Artifact built for {builder.get("platform")}-{builder.get("arch")}, host is {sys.platform}-{host_arch()}')
    if str(builder.get('node', '')).lstrip('v').split('.')[0] != node_major(node_bin):
        raise Refused('Artifact Node major differs from the host Node used to run it')
    files = summary.get('files', {})
    if type(files.get('bytes')) is not int or files['bytes'] > MAX_UNPACKED_BYTES:
        raise Refused('Unpacked size missing or above the 1 GiB program package limit')
    if production_env:
        public = {}
        for line in Path(production_env).read_text().splitlines():
            match = re.match(r'^\s*(?:export\s+)?(NEXT_PUBLIC_[A-Z0-9_]+)=(.*)$', line)
            if match:
                public[match.group(1)] = match.group(2).strip().strip('"\'')
        if public != summary.get('publicBuildEnv'):
            raise Refused('Build-time NEXT_PUBLIC_* values differ from the production environment file')
    return name


def safe_members(archive, max_bytes):
    members, total = [], 0
    for member in archive.getmembers():
        path = PurePosixPath(member.name)
        parts = [p for p in path.parts if p != '.']
        if path.is_absolute() or '..' in parts:
            raise Refused('Unsafe path in tarball: ' + member.name)
        if member.issym():
            target = PurePosixPath(member.linkname)
            resolved = os.path.normpath(os.path.join(os.path.dirname('/'.join(parts)), member.linkname))
            if target.is_absolute() or resolved == '..' or resolved.startswith('../'):
                raise Refused('Symlink leaves the release: ' + member.name)
        elif not (member.isfile() or member.isdir()):
            raise Refused('Unsupported tar member type: ' + member.name)
        if member.mode & 0o7000:
            raise Refused('setuid/setgid/sticky bit in tarball: ' + member.name)
        total += member.size if member.isfile() else 0
        members.append(member)
    if total > max_bytes:
        raise Refused('Tarball expands beyond the declared size')
    return members


def file_list_digest(file_list):
    lines = [f'F\t{f["path"]}\t{f["sha256"]}\t{f["bytes"]}\t{f["mode"]}' for f in file_list['files']]
    lines += [f'L\t{s["path"]}\t{s["target"]}' for s in file_list['symlinks']]
    return hashlib.sha256(('\n'.join(sorted(lines)) + '\n').encode()).hexdigest()


def verify_tree(tree, summary):
    manifest_bytes = (tree / 'build-artifact-manifest.json').read_bytes()
    if hashlib.sha256(manifest_bytes).hexdigest() != summary['artifact']['buildArtifactManifestSha256']:
        raise Refused('Build manifest differs from artifact.json')
    inner = json.loads(manifest_bytes)
    if inner != {k: v for k, v in summary.items() if k != 'artifact'}:
        raise Refused('Build manifest content differs from artifact.json')
    list_bytes = (tree / 'source-manifest.json').read_bytes()
    if hashlib.sha256(list_bytes).hexdigest() != inner['files']['sourceManifestSha256']:
        raise Refused('File list hash mismatch')
    file_list = json.loads(list_bytes)
    if file_list.get('schemaVersion') != FILE_LIST_SCHEMA or file_list.get('codeSha') != inner['codeSha']:
        raise Refused('Unknown file list')
    if file_list_digest(file_list) != inner['files']['listSha256'] or len(file_list['files']) != inner['files']['count'] or sum(f['bytes'] for f in file_list['files']) != inner['files']['bytes']:
        raise Refused('File list digest/count/bytes mismatch')
    expected_files = {f['path']: f for f in file_list['files']}
    expected_links = {s['path']: s['target'] for s in file_list['symlinks']}
    seen_files, seen_links = set(), set()
    for directory, dirnames, filenames in os.walk(tree):
        for name in dirnames + filenames:
            full = Path(directory) / name
            rel = full.relative_to(tree).as_posix()
            if full.is_symlink():
                if expected_links.get(rel) != os.readlink(full):
                    raise Refused('Unexpected or changed symlink: ' + rel)
                seen_links.add(rel)
            elif full.is_file():
                if rel in MANIFEST_FILES:
                    continue
                entry = expected_files.get(rel)
                if not entry or full.stat().st_size != entry['bytes'] or sha256_file(full) != entry['sha256']:
                    raise Refused('Unexpected or changed file: ' + rel)
                seen_files.add(rel)
        dirnames[:] = [d for d in dirnames if not (Path(directory) / d).is_symlink()]
    if seen_files != set(expected_files) or seen_links != set(expected_links):
        raise Refused('Release tree is missing listed files')
    build_id = (tree / 'apps/web/.next/BUILD_ID').read_text().strip()
    if build_id != inner['BUILD_ID']:
        raise Refused('BUILD_ID in the tree differs from the manifest')
    return inner


def install(args):
    if not SHA.match(args.sha):
        raise Refused('--sha must be a full 40-character commit SHA')
    policy_path = Path(args.policy)
    if not policy_path.is_file():
        raise Refused(f'Lifecycle policy {policy_path} not found')
    policy = json.loads(policy_path.read_text())
    guard = policy.get('diskCapacity') or {}
    releases_root = Path(args.releases_root).resolve()
    staging_root = Path(args.staging_root or Path(guard.get('root', '/srv/uapt')) / 'builds').resolve()
    receipt_dir = Path(args.receipt_dir)
    args.lock.parent.mkdir(parents=True, exist_ok=True)
    with args.lock.open('w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise Refused('Another release operation holds ' + str(args.lock))
        token = None
        if args.zip:
            zip_bytes = Path(args.zip).stat().st_size
        else:
            token = os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN')
            if not token:
                raise Refused('Set GH_TOKEN (read-only actions token) or pass --zip')
            remote = locate_artifact(args.repo, args.run_id, args.sha, token)
            zip_bytes = int(remote['size_in_bytes'])
        # Before downloading: zip + extracted tarball + the largest allowed tree.
        admission = [disk_admission(policy, args.role, 2 * zip_bytes + MAX_UNPACKED_BYTES, 0)]
        staging_root.mkdir(parents=True, exist_ok=True)
        staging = Path(tempfile.mkdtemp(prefix=f'program-{args.sha[:12]}.', dir=staging_root))
        try:
            zip_path = Path(args.zip) if args.zip else staging / 'artifact.zip'
            if not args.zip:
                download(remote['archive_download_url'], token, zip_path, zip_bytes)
            files_dir = staging / 'files'
            files_dir.mkdir()
            tarball, summary_path = read_artifact_zip(zip_path, files_dir)
            summary = json.loads(summary_path.read_text())
            name = verify_summary(summary, tarball, args.sha, args.node_bin, args.production_env)
            target = releases_root / name
            if target.exists() or target.is_symlink():
                raise Refused(f'Release directory {target} already exists; releases are immutable')
            unpacked = summary['files']['bytes']
            admission.append(disk_admission(policy, args.role, unpacked, unpacked))
            tree = staging / 'tree'
            tree.mkdir()
            with tarfile.open(tarball, 'r:gz') as archive:
                members = safe_members(archive, unpacked + 64 * 1024 * 1024)
                if hasattr(tarfile, 'data_filter'):
                    archive.extractall(tree, members=members, filter='data')
                else:
                    archive.extractall(tree, members=members)
            inner = verify_tree(tree, summary)
            releases_root.mkdir(parents=True, exist_ok=True)
            if os.stat(tree).st_dev != os.stat(releases_root).st_dev:
                raise Refused('Staging and releases must share a filesystem for an atomic rename')
            os.rename(tree, target)
        except BaseException:
            print(json.dumps({'status': 'FAILED', 'stagingKept': str(staging), 'action': 'register as a temporary artifact or review and remove'}), file=sys.stderr)
            raise
        # Only this run's own staging copy is removed; nothing else is touched.
        shutil.rmtree(staging)
        installed = now()
        receipt = {
            'schemaVersion': RECEIPT_SCHEMA,
            'installedAt': installed.isoformat(),
            'release': str(target),
            'codeSha': inner['codeSha'],
            'BUILD_ID': inner['BUILD_ID'],
            'source': {'zip': str(Path(args.zip).resolve())} if args.zip else {'repository': args.repo, 'runId': args.run_id, 'artifactId': remote['id']},
            'artifact': summary['artifact'],
            'files': inner['files'],
            'diskAdmission': admission,
            # Fields the lifecycle plan's basis binds (validate_candidate_identity).
            # The plan adds `contentRelease` (root, contentId, manifestSha256) for the
            # synchronized content pointer the candidate will read.
            'basis': {'schemaVersion': 'uapt-program-release-basis-v1',
                      'release': str(target), 'codeSha': inner['codeSha'], 'BUILD_ID': inner['BUILD_ID'],
                      'sourceManifestSha256': inner['files']['sourceManifestSha256'],
                      'buildArtifactSha256': summary['artifact']['buildArtifactManifestSha256']},
            # A new release root: add it to the retention receipt (uapt-release-retention-v1
            # `entries`) before the next gate. If it is not admitted, it becomes a bounded
            # `held` entry with heldSince/reviewBefore/nextAction, never an unexplained root.
            'retentionEntry': {'name': name, 'disposition': 'candidate',
                               'reason': f'Program artifact {inner["codeSha"][:12]} {inner["BUILD_ID"]} installed {installed.isoformat()}, not started'},
            'started': False, 'routed': False,
        }
        receipt_dir.mkdir(parents=True, exist_ok=True)
        receipt_path = receipt_dir / f'{name}.json'
        if receipt_path.exists():
            raise Refused('Receipt already exists: ' + str(receipt_path))
        receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')
        receipt['receipt'] = {'path': str(receipt_path), 'sha256': sha256_file(receipt_path)}
        return receipt


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--sha', required=True)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--run-id', type=int)
    source.add_argument('--zip')
    parser.add_argument('--repo', default=DEFAULT_REPO)
    parser.add_argument('--role', default='main')
    parser.add_argument('--releases-root', default='/srv/uapt/releases')
    parser.add_argument('--staging-root', help='default: <diskCapacity.root>/builds')
    parser.add_argument('--receipt-dir', default='/srv/uapt/operations/program-artifacts')
    parser.add_argument('--policy', default=str(POLICY))
    parser.add_argument('--lock', type=Path, default=LOCK)
    parser.add_argument('--node-bin', default='node', help='Node that will run the release (e.g. /opt/node-v22/bin/node)')
    parser.add_argument('--production-env', help='compare NEXT_PUBLIC_* with the production env file')
    args = parser.parse_args(argv)
    try:
        receipt = install(args)
    except (Refused, ValueError, OSError, tarfile.TarError, zipfile.BadZipFile) as error:
        print('Refused: ' + str(error), file=sys.stderr)
        return 1
    print(json.dumps({'status': 'INSTALLED_NOT_STARTED', **{k: receipt[k] for k in ('release', 'codeSha', 'BUILD_ID', 'basis', 'retentionEntry', 'receipt')}}, indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main())
