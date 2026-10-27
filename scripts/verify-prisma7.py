#!/usr/bin/env python3
"""Repeatable local acceptance on a NEW PostgreSQL16 cluster. Never touches a live DB."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent.parent
BASELINE = "2e1a00521e92ead92c31541398522fadd672a771"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pg-bin", required=True, type=Path, help="Existing PostgreSQL16 bin directory; installs/upgrades nothing")
    parser.add_argument("--node-bin", type=Path, help="Optional Node bin directory, e.g. Node22.22.3 matching production")
    args = parser.parse_args()
    pg = args.pg_bin.resolve()
    if " 16." not in subprocess.check_output([pg / "postgres", "--version"], text=True):
        raise SystemExit("Use PostgreSQL16, matching the repository infrastructure baseline")
    env = {k: v for k, v in os.environ.items() if not k.startswith(("DATABASE_", "DIRECT_DATABASE_", "SUPABASE_", "PG"))}
    if args.node_bin:
        env["PATH"] = str(args.node_bin.resolve()) + os.pathsep + env["PATH"]
    runs = ROOT / ".local/prisma7/runs"
    runs.mkdir(parents=True, exist_ok=True)
    run = Path(tempfile.mkdtemp(prefix=datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ-"), dir=runs))
    evidence = run / "evidence"
    evidence.mkdir()
    legacy = run / "legacy"
    legacy.mkdir()

    def command(name, argv, *, cwd=ROOT, command_env=None):
        with (evidence / (name + ".log")).open("w") as log:
            result = subprocess.run([str(x) for x in argv], cwd=cwd, env=command_env or env, stdout=log, stderr=subprocess.STDOUT)
        if result.returncode:
            raise RuntimeError(f"{name} failed; see {evidence / (name + '.log')}")
        print(f"PASS {name}", flush=True)

    # Freeze original v6 sources and migrations; do not copy any workspace env/data.
    names = subprocess.check_output(["git", "ls-tree", "-r", "--name-only", BASELINE, "packages/db/src", "packages/db/prisma"], cwd=ROOT, text=True).splitlines()
    for name in names:
        target = legacy / Path(name).relative_to("packages/db")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(subprocess.check_output(["git", "show", BASELINE + ":" + name], cwd=ROOT))
    schema = legacy / "prisma/schema.prisma"
    schema.write_text(schema.read_text().replace('provider = "prisma-client-js"', 'provider = "prisma-client-js"\n  output = "../generated"'))
    for path in (legacy / "src").glob("*.ts"):
        if path.suffixes != [".d", ".ts"]:
            path.write_text(path.read_text().replace('"@prisma/client"', '"../generated/index.js"'))
    (legacy / "package.json").write_text(json.dumps({"private": True, "type": "module", "dependencies": {"prisma": "6.19.3", "@prisma/client": "6.19.3"}}))
    command("install-v6", ["npm", "install", "--prefix", legacy, "--no-audit", "--no-fund"])
    (legacy / "node_modules/@uapt").mkdir(exist_ok=True)
    (legacy / "node_modules/@uapt/shared").symlink_to(ROOT / "packages/shared", target_is_directory=True)
    command("generate-v6", ["node", legacy / "node_modules/prisma/build/index.js", "generate", "--schema", schema])
    command("generate-v7", ["pnpm", "db:generate"])
    command("unit", ["pnpm", "--filter", "@uapt/db", "test"])
    command("test-types", ["pnpm", "--filter", "@uapt/db", "typecheck:test"])
    data = run / "pgdata"
    command("initdb", [pg / "initdb", "-D", data, "--locale=C", "-E", "UTF8", "-A", "trust", "-U", "uapt_test"])
    command("certificate", ["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", data / "server.key", "-out", data / "server.crt", "-days", "3", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1"])
    (data / "server.key").chmod(0o600)
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    # TCP only avoids macOS Unix-socket path limits in long worktree directories.
    with (data / "postgresql.conf").open("a") as config:
        config.write(f"\nlisten_addresses='127.0.0.1'\nport={port}\nunix_socket_directories=''\nssl=on\nshared_buffers='32MB'\nmax_connections=35\n")
    env.update({"DATABASE_URL": f"postgresql://uapt_test@127.0.0.1:{port}/uapt_prisma7_test?schema=public&sslmode=disable", "DATABASE_TLS_MODE": "disable", "UAPT_PRISMA_TEST": "1", "UAPT_PRISMA6_BASELINE": str(legacy), "UAPT_TEST_CA_FILE": str(data / "server.crt"), "UAPT_TEST_REPORT": str(evidence / "integration.json")})
    started = False
    try:
        command("postgres-start", [pg / "pg_ctl", "-D", data, "-l", evidence / "postgres.log", "start"])
        started = True
        command("createdb", [pg / "createdb", "-h", "127.0.0.1", "-p", port, "-U", "uapt_test", "uapt_prisma7_test"])
        command("migrate-v6", ["node", legacy / "node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", schema])
        dump = [pg / "pg_dump", "-h", "127.0.0.1", "-p", port, "-U", "uapt_test", "-d", "uapt_prisma7_test", "--schema-only", "--no-owner", "--no-privileges"]
        command("schema-before", dump)
        command("db-integration", ["pnpm", "--filter", "@uapt/db", "test:integration"])
        command("api-integration", ["pnpm", "exec", "tsx", "--tsconfig", "apps/api/tsconfig.json", "apps/api/test/prisma7.integration.ts"])
        command("web-worker", ["pnpm", "exec", "tsx", "--tsconfig", "apps/web/tsconfig.json", "scripts/prisma7-web-worker-smoke.ts"])
        command("migrate-v7", ["pnpm", "--filter", "@uapt/db", "exec", "prisma", "migrate", "deploy"])
        command("schema-after", dump)
        normalize = lambda path: "\n".join(line for line in path.read_text().splitlines() if not line.startswith(("\\restrict", "\\unrestrict")))
        before, after = (normalize(evidence / (f"schema-{stage}.log")) for stage in ("before", "after"))
        if before != after:
            raise RuntimeError("Unexpected database structure change")
        report = {"status": "PASS", "baselineSha": BASELINE, "node": subprocess.check_output(["node", "--version"], env=env, text=True).strip(), "postgres": subprocess.check_output([pg / "postgres", "--version"], text=True).strip(), "normalizedSchemaSha256": hashlib.sha256(after.encode()).hexdigest(), "productionTouched": False}
        (evidence / "result.json").write_text(json.dumps(report, indent=2))
        print(f"Acceptance evidence: {evidence}")
    finally:
        if started:
            command("postgres-stop", [pg / "pg_ctl", "-D", data, "-m", "fast", "stop"])


if __name__ == "__main__":
    main()
