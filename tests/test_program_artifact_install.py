import unittest, importlib.util, tempfile, json, hashlib, io, os, shutil, subprocess, sys, tarfile, zipfile
from pathlib import Path
spec = importlib.util.spec_from_file_location('installer', Path(__file__).parents[1] / 'scripts/program-artifact-install.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

SHA = 'a' * 40
BUILD_ID = 'Bld_0123456789'
NAME = f'uapt-program-{SHA[:12]}-{BUILD_ID}'
# Same fixture and digest as tests/program-build.test.mjs: both sides must agree.
FIXTURE_LIST = {'files': [{'path': 'apps/web/server.js', 'sha256': '0' * 64, 'bytes': 3, 'mode': '644'}], 'symlinks': [{'path': 'node_modules/next', 'target': '.pnpm/next/node_modules/next'}]}
FIXTURE_DIGEST = '427ae6b2014151748edabcdb024c20e33c845da83ca94be325c84aa701143312'


def node_version():
    return subprocess.run(['node', '--version'], capture_output=True, text=True, check=True).stdout.strip()


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp)
        (self.tmp / 'srv/releases').mkdir(parents=True)
        self.policy = self.tmp / 'policy.json'
        self.write_policy(reserve=1024)

    def write_policy(self, reserve):
        self.policy.write_text(json.dumps({'diskCapacity': {'root': str(self.tmp / 'srv'), 'reserveBytes': reserve, 'reserveInodes': 10,
                                                            'projectMaxBytes': 50 * 1024 ** 3, 'artifactMaxBytesByRole': {'main': 12 * 1024 ** 3}}}))

    def make_artifact(self, *, diagnostic=False, tamper=False, bad_sha=False, traversal=False, public_env=None, mcp=None):
        tree = self.tmp / 'build-tree'
        shutil.rmtree(tree, ignore_errors=True)
        files = {'apps/web/server.js': b'require("next")\n', 'apps/web/.next/BUILD_ID': BUILD_ID.encode(), 'node_modules/.pnpm/next/node_modules/next/index.js': b'module.exports = 1\n'}
        if mcp:
            files['apps/mcp/server.mjs'] = b'console.log("mcp")\n'
        for rel, data in files.items():
            (tree / rel).parent.mkdir(parents=True, exist_ok=True)
            (tree / rel).write_bytes(data)
        os.symlink('.pnpm/next/node_modules/next', tree / 'node_modules/next')
        file_list = {'schemaVersion': m.FILE_LIST_SCHEMA, 'codeSha': SHA,
                     'files': [{'path': rel, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'mode': '644'} for rel, data in sorted(files.items())],
                     'symlinks': [{'path': 'node_modules/next', 'target': '.pnpm/next/node_modules/next'}]}
        list_text = json.dumps(file_list) + '\n'
        (tree / 'source-manifest.json').write_text(list_text)
        manifest = {'schemaVersion': m.ARTIFACT_SCHEMA, 'codeSha': SHA, 'BUILD_ID': BUILD_ID, 'builtAt': '2026-11-04T00:00:00Z',
                    'builder': {'node': node_version(), 'pnpm': '10.0.0', 'next': '16.4.2', 'platform': sys.platform, 'arch': m.host_arch(), 'glibc': None},
                    'publicBuildEnv': public_env or {'NEXT_PUBLIC_SITE_URL': 'https://eduaipolicy.org'},
                    'files': {'count': len(files), 'symlinks': 1, 'bytes': sum(map(len, files.values())), 'listSha256': m.file_list_digest(file_list),
                              'sourceManifestSha256': hashlib.sha256(list_text.encode()).hexdigest()}}
        if mcp:
            listed = hashlib.sha256(files['apps/mcp/server.mjs']).hexdigest()
            manifest['entries'] = {'web': {'workingDirectory': 'apps/web', 'command': 'node server.js'},
                                   'mcp': {'workingDirectory': 'apps/mcp', 'command': 'node server.mjs', 'path': 'apps/mcp/server.mjs',
                                           'sha256': listed if mcp == 'ok' else '0' * 64}}
        if diagnostic:
            manifest['diagnostic'] = True
        manifest_text = json.dumps(manifest, indent=2) + '\n'
        (tree / 'build-artifact-manifest.json').write_text(manifest_text)
        if tamper:
            (tree / 'apps/web/server.js').write_bytes(b'require("evil")\n')
        out = self.tmp / 'out'
        shutil.rmtree(out, ignore_errors=True); out.mkdir()
        tarball = out / f'{NAME}.tar.gz'
        with tarfile.open(tarball, 'w:gz') as archive:
            archive.add(tree, arcname='.')
            if traversal:
                info = tarfile.TarInfo('../escape.txt'); info.size = 1
                archive.addfile(info, io.BytesIO(b'x'))
        digest = m.sha256_file(tarball)
        (out / f'{NAME}.tar.gz.sha256').write_text(f'{"0" * 64 if bad_sha else digest}  {tarball.name}\n')
        summary = dict(manifest, artifact={'name': NAME, 'file': tarball.name, 'sha256': digest, 'bytes': tarball.stat().st_size,
                                           'buildArtifactManifestSha256': hashlib.sha256(manifest_text.encode()).hexdigest()})
        (out / 'artifact.json').write_text(json.dumps(summary))
        zip_path = self.tmp / 'artifact.zip'
        with zipfile.ZipFile(zip_path, 'w') as archive:
            for item in out.iterdir():
                archive.write(item, item.name)
        return zip_path

    def run_install(self, zip_path, *extra):
        return m.main(['--sha', SHA, '--zip', str(zip_path), '--policy', str(self.policy), '--releases-root', str(self.tmp / 'srv/releases'),
                       '--receipt-dir', str(self.tmp / 'srv/receipts'), '--lock', str(self.tmp / 'lock'), *extra])

    def staging(self):
        builds = self.tmp / 'srv/builds'
        return sorted(builds.iterdir()) if builds.exists() else []

    def test_file_list_digest_matches_the_packager(self):
        self.assertEqual(m.file_list_digest(FIXTURE_LIST), FIXTURE_DIGEST)

    def test_installs_verified_tree_without_starting_anything(self):
        self.assertEqual(self.run_install(self.make_artifact()), 0)
        release = self.tmp / 'srv/releases' / NAME
        self.assertEqual((release / 'apps/web/.next/BUILD_ID').read_text(), BUILD_ID)
        self.assertTrue((release / 'node_modules/next').is_symlink())
        receipt = json.loads((self.tmp / 'srv/receipts' / f'{NAME}.json').read_text())
        self.assertEqual((receipt['started'], receipt['routed']), (False, False))
        self.assertEqual(receipt['basis']['BUILD_ID'], BUILD_ID)
        self.assertEqual(receipt['retentionEntry'], {'name': NAME, 'disposition': 'candidate', 'reason': receipt['retentionEntry']['reason']})
        self.assertEqual(self.staging(), [], 'only its own staging copy is removed')

    def test_mcp_entry_must_be_the_listed_bundle(self):
        self.assertEqual(self.run_install(self.make_artifact(mcp='ok')), 0)
        release = self.tmp / 'srv/releases' / NAME
        self.assertTrue((release / 'apps/mcp/server.mjs').is_file())
        shutil.rmtree(release)
        (self.tmp / 'srv/receipts' / f'{NAME}.json').unlink()
        err = io.StringIO()
        with __import__('contextlib').redirect_stderr(err):
            self.assertEqual(self.run_install(self.make_artifact(mcp='mismatch')), 1)
        self.assertIn('MCP entry', err.getvalue())
        self.assertFalse(release.exists())

    def test_existing_release_is_never_replaced(self):
        zip_path = self.make_artifact()
        self.assertEqual(self.run_install(zip_path), 0)
        (self.tmp / 'srv/receipts' / f'{NAME}.json').unlink()
        self.assertEqual(self.run_install(zip_path), 1)
        self.assertEqual(len(self.staging()), 1, 'a failed run keeps its staging for review')

    def test_refuses_changed_files_hashes_and_unsafe_members(self):
        for kwargs in [{'tamper': True}, {'bad_sha': True}, {'traversal': True}, {'diagnostic': True}]:
            with self.subTest(**kwargs):
                self.assertEqual(self.run_install(self.make_artifact(**kwargs)), 1)
                self.assertFalse((self.tmp / 'srv/releases' / NAME).exists())
        self.assertFalse((self.tmp / 'escape.txt').exists())

    def test_disk_admission_runs_before_download(self):
        self.write_policy(reserve=10 ** 18)
        self.assertEqual(self.run_install(self.make_artifact()), 1)
        self.assertEqual(self.staging(), [], 'nothing is downloaded or unpacked without headroom')
        self.policy.write_text(json.dumps({}))
        self.assertEqual(self.run_install(self.make_artifact()), 1)

    def test_public_build_env_must_match_production(self):
        env = self.tmp / 'production.env'
        env.write_text('NEXT_PUBLIC_SITE_URL=https://staging.example.org\nUAPT_V6_PUBLISHED_PAGES=1\n')
        self.assertEqual(self.run_install(self.make_artifact(), '--production-env', str(env)), 1)
        env.write_text('export NEXT_PUBLIC_SITE_URL="https://eduaipolicy.org"\n')
        self.assertEqual(self.run_install(self.make_artifact(), '--production-env', str(env)), 0)

    def test_release_lock_is_exclusive(self):
        import fcntl
        with open(self.tmp / 'lock', 'w') as held:
            fcntl.flock(held, fcntl.LOCK_EX)
            self.assertEqual(self.run_install(self.make_artifact()), 1)


class LinkContainmentTests(unittest.TestCase):
    def test_deep_relative_pnpm_link_passes_and_escape_is_refused(self):
        with tempfile.TemporaryDirectory() as d:
            tree = Path(d) / 'tree'
            target = tree / 'node_modules/.pnpm/@prisma+client@7/node_modules/@prisma/client'
            target.mkdir(parents=True)
            link_dir = tree / 'apps/web/.next/node_modules/@prisma'
            link_dir.mkdir(parents=True)
            # The Next standalone layout: five levels up from the link's own directory.
            (link_dir / 'client-abc').symlink_to('../../../../../node_modules/.pnpm/@prisma+client@7/node_modules/@prisma/client')
            m.links_stay_inside(tree)
            (link_dir / 'escape').symlink_to('../../../../../../outside')
            with self.assertRaisesRegex(m.Refused, 'Symlink leaves the release'):
                m.links_stay_inside(tree)


if __name__ == '__main__':
    unittest.main()
