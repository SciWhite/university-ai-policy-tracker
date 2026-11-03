import { test } from "node:test";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, copyFileSync, chmodSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { buildSteps, parseBuildArguments, runBuildPipeline, verifyBuildDependencies, verifyCompiledSource, verifyFrozenSource, verifyPublicGeneratedAssets } from "../scripts/release-build-pipeline.mjs";

const sha = "a".repeat(40);
const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const options = (scope = "full") => parseBuildArguments([scope, sha, "--webpack"]);
function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "uapt-fixed-build-")));
  for (const app of ["web", "tulsa-zone"]) {
    mkdirSync(join(root, "apps", app), { recursive: true });
    writeFileSync(join(root, "apps", app, "package.json"), JSON.stringify({ name: "@uapt/" + app }));
  }
  return root;
}
function packageAt(root, app, name, version) {
  const directory = join(root, "apps", app, "node_modules", name);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "package.json"), JSON.stringify({ name, version }));
}
function dependencies(root) {
  for (const app of ["web", "tulsa-zone"]) {
    for (const [name, version] of [["react", "19.2.9"], ["@types/react", "19.2.14"], ["react-dom", "19.2.9"], ["@types/react-dom", "19.2.3"], ["next", "16.4.2"]]) packageAt(root, app, name, version);
  }
}
function execution(root, overrides = {}) {
  const calls = [], prepared = [], logs = [];
  const config = { root, options: options(), platform: "linux", env: { NODE_ENV: "production" }, log: message => logs.push(message),
    prepare: async value => prepared.push(value),
    spawn(command, args, spawnOptions) {
      calls.push({ command, args, ...spawnOptions });
      if (command === "git") return { status: 0, stdout: args.includes("status") ? "" : sha + "\n" };
      if (args.includes("next") && args.includes("build")) {
        const app = args.includes("@uapt/tulsa-zone") ? "tulsa-zone" : "web";
        mkdirSync(join(root, "apps", app, ".next"), { recursive: true });
        writeFileSync(join(root, "apps", app, ".next", "BUILD_ID"), "actual-fixture-build\n");
      }
      return { status: 0 };
    }, ...overrides };
  return { config, calls, prepared, logs };
}

for (const scope of ["full", "zone"]) {
  test(`${scope}: frozen dev dependencies, one Prisma, early tsc, one selected Next; never recursive or package build`, async () => {
    const root = fixture();
    try {
      dependencies(root);
      const run = execution(root); run.config.options = options(scope);
      const result = await runBuildPipeline(run.config);
      const commands = run.calls.filter(c => c.command !== "git");
      assert.equal(commands.filter(c => c.args.includes("install")).length, 1);
      const installation = commands[0].args;
      for (const value of ["university-ai-policy-tracker", "@uapt/web...", "@uapt/tulsa-zone...", "--prod=false", "--frozen-lockfile"]) assert.ok(installation.includes(value));
      assert.equal(commands.filter(c => c.args.includes("generate")).length, 1);
      const types = commands.findIndex(c => c.args.includes("tsc"));
      const validation = commands.findIndex(c => c.args.includes("scripts/validate-web-runtime-data.ts"));
      const next = commands.filter(c => c.args.includes("next") && c.args.includes("build"));
      assert.equal(next.length, 1); assert.ok(types >= 0 && types < validation);
      assert.deepEqual(commands[types].args.slice(-5), ["--noEmit", "--incremental", "false", "-p", "tsconfig.json"]);
      assert.deepEqual(next[0].args, ["--filter", scope === "full" ? "@uapt/web" : "@uapt/tulsa-zone", "exec", "next", "build", "--webpack"]);
      assert.ok(!commands.some(c => c.args.includes("-r") || c.args.some((arg, i) => arg === "build" && c.args[i - 1] !== "next")));
      assert.equal(run.prepared.length, 1);
      assert.equal(run.prepared[0].targetRoot, join(root, "apps", scope === "full" ? "web" : "tulsa-zone", ".runtime-data"));
      assert.equal(result.status, "COMPILED_NOT_ACCEPTED"); assert.equal(result.routesChanged, false); assert.equal(result.candidateStarted, false);
      assert.ok(commands.every(c => !["systemctl", "nginx", "python3"].includes(c.command)));
      assert.equal(commands.filter(c => c.args.includes("scripts/validate-web-build-scope.mjs")).length, scope === "full" ? 1 : 0);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}

test("type failure stops before runtime preparation and Next, preserving diagnostic failure", async () => {
  const root = fixture();
  try {
    dependencies(root); const run = execution(root); const spawn = run.config.spawn;
    run.config.spawn = (command, args, opts) => args.includes("tsc") ? (run.calls.push({ command, args }), { status: 2 }) : spawn(command, args, opts);
    await assert.rejects(runBuildPipeline(run.config), /failed \(2\).*build stopped/);
    assert.equal(run.prepared.length, 0); assert.ok(!run.calls.some(c => c.args.includes("next")));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("runtime source/data validation failure prevents Next", async () => {
  const root = fixture();
  try {
    dependencies(root); const run = execution(root); const spawn = run.config.spawn;
    run.config.spawn = (command, args, opts) => args.includes("scripts/validate-web-runtime-data.ts") ? { status: 1 } : spawn(command, args, opts);
    await assert.rejects(runBuildPipeline(run.config), /failed/); assert.equal(run.prepared.length, 1); assert.ok(!run.calls.some(c => c.args.includes("next")));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Next error is never retried or followed by candidate/routing operations", async () => {
  const root = fixture();
  try {
    dependencies(root); const run = execution(root); const spawn = run.config.spawn;
    run.config.spawn = (command, args, opts) => args.includes("next") ? (run.calls.push({ command, args }), { status: 1 }) : spawn(command, args, opts);
    await assert.rejects(runBuildPipeline(run.config), /failed/); assert.equal(run.calls.filter(c => c.args.includes("next")).length, 1);
    assert.ok(!run.calls.some(c => ["systemctl", "nginx"].includes(c.command)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

for (const kind of ["existing-output", "dangling-output-link"]) {
  test(`${kind} rejects production reuse before installation and preserves original`, async () => {
    const root = fixture(), output = join(root, "apps/web/.next");
    try {
      if (kind === "existing-output") { mkdirSync(output); writeFileSync(join(output, "keep"), "failed build evidence"); }
      else symlinkSync(join(root, "missing"), output);
      const run = execution(root);
      await assert.rejects(runBuildPipeline(run.config), /already exists/); assert.ok(run.calls.every(c => c.command === "git"));
      if (kind === "existing-output") assert.equal(readFileSync(join(output, "keep"), "utf8"), "failed build evidence");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}

for (const failure of ["head", "origin", "dirty", "git-error"]) {
  test(`frozen source ${failure} fails before dependency mutation`, async () => {
    const root = fixture();
    try {
      const run = execution(root);
      run.config.spawn = (command, args) => { run.calls.push({ command, args }); return { status: failure === "git-error" ? 128 : 0,
        stdout: args.includes("status") ? (failure === "dirty" ? " M package.json\n" : "") : ((failure === "head" && args.includes("HEAD")) || (failure === "origin" && args.includes("origin/main"))) ? "b".repeat(40) : sha }; };
      await assert.rejects(runBuildPipeline(run.config), /identity|differs|modified/); assert.ok(run.calls.every(c => c.command === "git"));
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}

test("source mutation during preparation stops before Next", async () => {
  const root = fixture();
  try {
    dependencies(root); const run = execution(root); const spawn = run.config.spawn; let prepared = false;
    run.config.prepare = async () => { prepared = true; };
    run.config.spawn = (command, args, opts) => prepared && command === "git" && args.includes("status") ? { status: 0, stdout: " M data/current.json\n" } : spawn(command, args, opts);
    await assert.rejects(runBuildPipeline(run.config), /modified/); assert.ok(!run.calls.some(c => c.args.includes("next")));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("the demonstrated missing Tulsa React dependency fails directly after install", async () => {
  const root = fixture();
  try {
    for (const [name, version] of [["react", "19.2.9"], ["@types/react", "19.2.14"], ["react-dom", "19.2.9"], ["@types/react-dom", "19.2.3"], ["next", "16.4.2"]]) packageAt(root, "web", name, version);
    const run = execution(root); await assert.rejects(runBuildPipeline(run.config), /Missing react.*tulsa-zone/);
    assert.equal(run.calls.filter(c => c.command !== "git").length, 1); assert.equal(run.prepared.length, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("release dependencies cannot be borrowed from a different build tree", () => {
  const root = fixture(), other = fixture();
  try {
    dependencies(other);
    for (const app of ["web", "tulsa-zone"]) symlinkSync(join(other, "apps", app, "node_modules"), join(root, "apps", app, "node_modules"), "dir");
    assert.throws(() => verifyBuildDependencies(root), /outside/);
    assert.equal(verifyBuildDependencies(root, { ownRelease: false }).web.react, "19.2.9");
  } finally { rmSync(root, { recursive: true, force: true }); rmSync(other, { recursive: true, force: true }); }
});

test("incompatible React type identities reject the shared source build", () => {
  const root = fixture();
  try { dependencies(root); packageAt(root, "tulsa-zone", "@types/react", "18.0.0"); assert.throws(() => verifyBuildDependencies(root), /incompatible @types\/react/); }
  finally { rmSync(root, { recursive: true, force: true }); }
});

test("production cannot silently use a Mac or an unloaded production env", async () => {
  const root = fixture();
  try {
    const run = execution(root, { platform: "darwin" }); await assert.rejects(runBuildPipeline(run.config), /Linux OCI/); assert.equal(run.calls.length, 0);
    run.config.platform = "linux"; run.config.env = {}; await assert.rejects(runBuildPipeline(run.config), /environment/); assert.equal(run.calls.length, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("explicit local debug preserves the same stages and never asserts a release", async () => {
  const root = fixture();
  try {
    dependencies(root); const run = execution(root, { options: parseBuildArguments(["full", "--debug", "--webpack"]), platform: "darwin", env: {} });
    const result = await runBuildPipeline(run.config); assert.equal(result.status, "DEBUG_BUILD_ONLY_NOT_RELEASE_ACCEPTANCE"); assert.equal(result.codeSha, null); assert.ok(run.calls.every(c => c.command !== "git"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("caller build environment stays intact and secrets are never included in stage logs", async () => {
  const root = fixture();
  try {
    dependencies(root); const env = { NODE_ENV: "production", NODE_OPTIONS: "--max-old-space-size=6144", PRIVATE_TOKEN: "private-sentinel" }; const run = execution(root, { env }); await runBuildPipeline(run.config);
    assert.equal(env.PRIVATE_TOKEN, "private-sentinel"); assert.ok(run.calls.filter(c => c.command !== "git").every(c => c.env.NODE_OPTIONS === env.NODE_OPTIONS)); assert.ok(!run.logs.join("\n").includes(env.PRIVATE_TOKEN));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("explicit scopes and narrow options reject recursive, unknown and skip-validation arguments", () => {
  for (const args of [[], ["all", sha], ["full"], ["zone", "bad"], ["full", sha, "--ignore-build-errors"], ["full", sha, "--experimental-build-mode=compile"], ["full", sha, "--debug"], ["full", sha, "--webpack", "--webpack"]]) assert.throws(() => parseBuildArguments(args));
  assert.equal(buildSteps(repository, options("zone")).filter(step => step.name === "next").length, 1);
});

test("root/web build scripts share the entry point and help never launches a build", () => {
  const root = JSON.parse(readFileSync(join(repository, "package.json"))), app = JSON.parse(readFileSync(join(repository, "apps/web/package.json")));
  assert.equal(root.scripts.build, "node scripts/uapt-release.mjs build full"); assert.equal(root.scripts["build:zone"], "node scripts/uapt-release.mjs build zone"); assert.equal(app.scripts.build, "node ../../scripts/uapt-release.mjs build full");
  const result = spawnSync(process.execPath, [join(repository, "scripts/uapt-release.mjs"), "--help"], { encoding: "utf8" });
  assert.equal(result.status, 0); assert.match(result.stdout, /build <full\|zone>/); assert.match(result.stdout, /no service, cutover or policy approval/);
});

const devNextEnv = '/// <reference types="next" />\nimport "./.next/dev/types/routes.d.ts";\nimport "./.next/dev/types/root-params.d.ts";\n';
const compiledNextEnv = devNextEnv.replaceAll("./.next/dev/types/", "./.next/types/");
function gitFixture({ cli = false } = {}) {
  const root = fixture();
  writeFileSync(join(root, ".gitignore"), "node_modules/\n.next/\n.runtime-data/\n");
  writeFileSync(join(root, "apps/web/next-env.d.ts"), devNextEnv);
  writeFileSync(join(root, "apps/web/source.ts"), "export const accepted = true;\n");
  writeFileSync(join(root, "apps/tulsa-zone/next-env.d.ts"), devNextEnv);
  if (cli) {
    mkdirSync(join(root, "scripts"));
    for (const filename of ["uapt-release.mjs", "release-build-pipeline.mjs", "prepare-web-runtime-data.mjs"]) writeFileSync(join(root, "scripts", filename), readFileSync(join(repository, "scripts", filename)));
    writeFileSync(join(root, "package.json"), JSON.stringify({ packageManager: "pnpm@10.0.0" }));
    writeFileSync(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    writeFileSync(join(root, "apps/web/next.config.ts"), "export default {};\n");
    const manifest = JSON.stringify({ releaseId: "frozen-public-release" });
    for (const folder of ["data/public-releases", "apps/web/.runtime-data/data/public-releases"]) { mkdirSync(join(root, folder), { recursive: true }); writeFileSync(join(root, folder, "current.json"), manifest); }
    mkdirSync(join(root, "apps/web/.next")); writeFileSync(join(root, "apps/web/.next/BUILD_ID"), "actual-compiled-fixture\n");
  }
  function git(...args) {
    const result = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
  }
  git("init", "-q"); git("config", "user.name", "Isolated test fixture"); git("config", "user.email", "fixture@invalid.example"); git("config", "core.filemode", "true"); git("add", "."); git("commit", "-qm", "isolated fixture");
  const expected = git("rev-parse", "HEAD"); git("update-ref", "refs/remotes/origin/main", expected);
  return { root, git, expected };
}

test("compiled source accepts only the exact original Git-byte Next path rewrite; prebuild stays strict", () => {
  const f = gitFixture();
  try {
    assert.equal(verifyCompiledSource(f.root, f.expected).allowedNextEnvTransform, null);
    writeFileSync(join(f.root, "apps/web/next-env.d.ts"), compiledNextEnv);
    assert.equal(verifyCompiledSource(f.root, f.expected).allowedNextEnvTransform, "apps/web/next-env.d.ts");
    assert.throws(() => verifyFrozenSource(f.root, f.expected), /modified/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

for (const mutation of ["other-source", "extra-byte", "partial-transform", "staged-transform", "other-target", "file-mode"]) {
  test(`compiled source rejects ${mutation} alongside or instead of the exact target rewrite`, () => {
    const f = gitFixture();
    try {
      const file = join(f.root, "apps/web/next-env.d.ts"); writeFileSync(file, compiledNextEnv);
      if (mutation === "other-source") writeFileSync(join(f.root, "apps/web/source.ts"), "export const accepted = false;\n");
      if (mutation === "extra-byte") writeFileSync(file, compiledNextEnv + "// unexpected\n");
      if (mutation === "partial-transform") writeFileSync(file, devNextEnv.replace("./.next/dev/types/", "./.next/types/"));
      if (mutation === "staged-transform") f.git("add", "apps/web/next-env.d.ts");
      if (mutation === "other-target") { writeFileSync(file, devNextEnv); writeFileSync(join(f.root, "apps/tulsa-zone/next-env.d.ts"), compiledNextEnv); }
      if (mutation === "file-mode") f.git("update-index", "--chmod=+x", "apps/web/next-env.d.ts");
      assert.throws(() => verifyCompiledSource(f.root, f.expected), /unapproved|beyond|mode/);
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });
}

test("zone compiled-source exception is limited to that target's original Git file", () => {
  const f = gitFixture();
  try {
    writeFileSync(join(f.root, "apps/tulsa-zone/next-env.d.ts"), compiledNextEnv);
    assert.equal(verifyCompiledSource(f.root, f.expected, "zone").allowedNextEnvTransform, "apps/tulsa-zone/next-env.d.ts");
    assert.throws(() => verifyCompiledSource(f.root, f.expected, "full"), /unapproved/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("real inspect command uses compiled verification and still rejects unrelated tracked mutation", () => {
  const f = gitFixture({ cli: true });
  try {
    writeFileSync(join(f.root, "apps/web/next-env.d.ts"), compiledNextEnv);
    const inspect = () => spawnSync(process.execPath, [join(f.root, "scripts/uapt-release.mjs"), "inspect", f.expected], { encoding: "utf8" });
    const accepted = inspect(); assert.equal(accepted.status, 0, accepted.stderr); const value = JSON.parse(accepted.stdout);
    assert.equal(value.compiledSource.allowedNextEnvTransform, "apps/web/next-env.d.ts"); assert.equal(value.acceptance, "not_asserted_by_identity_check");
    writeFileSync(join(f.root, "apps/web/source.ts"), "unreviewed source\n"); const rejected = inspect(); assert.equal(rejected.status, 1); assert.match(rejected.stderr, /unapproved source/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("successful Next exit still rejects a later unapproved source mutation before returning COMPILED", async () => {
  const root = fixture();
  try {
    dependencies(root); const run = execution(root); const spawn = run.config.spawn; let built = false;
    run.config.spawn = (command, args, opts) => {
      if (built && command === "git" && args.includes("--porcelain=v1")) return { status: 0, stdout: " M apps/web/source.ts\0" };
      const result = spawn(command, args, opts); if (args.includes("next") && args.includes("build")) built = true; return result;
    };
    await assert.rejects(runBuildPipeline(run.config), /unapproved source/);
    assert.equal(run.calls.filter(c => c.args.includes("next")).length, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

for (const name of ["react-dom", "@types/react-dom"]) {
  test(`${name} missing, foreign or version-mismatched dependency is rejected for either shared app`, () => {
    for (const issue of ["missing", "foreign", "mismatch", "valid"]) {
      const root = fixture(), foreign = fixture();
      try {
        dependencies(root); dependencies(foreign); const directory = join(root, "apps/tulsa-zone/node_modules", name);
        if (issue === "missing") { rmSync(directory, { recursive: true }); assert.throws(() => verifyBuildDependencies(root), new RegExp(`Missing ${name}`)); }
        if (issue === "foreign") { rmSync(directory, { recursive: true }); symlinkSync(join(foreign, "apps/tulsa-zone/node_modules", name), directory, "dir"); assert.throws(() => verifyBuildDependencies(root), /outside/); }
        if (issue === "mismatch") { packageAt(root, "tulsa-zone", name, "0.0.0"); assert.throws(() => verifyBuildDependencies(root), new RegExp(`incompatible ${name}`)); }
        if (issue === "valid") { const actual = verifyBuildDependencies(root); assert.equal(actual.web[name], actual["tulsa-zone"][name]); assert.equal(actual.canonicalPaths["tulsa-zone"][name], realpathSync(join(directory, "package.json"))); }
      } finally { rmSync(root, { recursive: true, force: true }); rmSync(foreign, { recursive: true, force: true }); }
    }
  });
}

function marksFixture(count = 3, cli = false) {
  const f = gitFixture({ cli });
  const assetPrefix = "/assets/university-marks/fixture-compact", sourcePrefix = `apps/tulsa-zone/public${assetPrefix}`, targetPrefix = `apps/web/public${assetPrefix}`;
  const entries = {}, names = [];
  mkdirSync(join(f.root, sourcePrefix), { recursive: true }); mkdirSync(join(f.root, "apps/web/lib"), { recursive: true });
  for (let i = 0; i < count; i++) {
    const bytes = Buffer.from(`RIFF simplified published mark fixture ${i}`), filename = createHash("sha256").update(bytes).digest("hex") + ".webp";
    names.push(filename); entries[`school-${i}`] = { file: filename, role: "compact", publicationApproved: false, publicUseReviewRequired: true };
    writeFileSync(join(f.root, sourcePrefix, filename), bytes);
  }
  writeFileSync(join(f.root, "apps/web/lib/university-marks-published.json"), JSON.stringify({ schema: "uapt-published-compact-marks-v1", assetPrefix, entries }));
  f.git("add", "apps/web/lib/university-marks-published.json", sourcePrefix); f.git("commit", "-qm", "frozen published marks fixture");
  f.expected = f.git("rev-parse", "HEAD"); f.git("update-ref", "refs/remotes/origin/main", f.expected);
  mkdirSync(join(f.root, targetPrefix), { recursive: true });
  for (const name of names) copyFileSync(join(f.root, sourcePrefix, name), join(f.root, targetPrefix, name));
  return { ...f, sourcePrefix, targetPrefix, names, paths: names.map(name => `${targetPrefix}/${name}`) };
}

test("304 exact derived public marks pass real-Git prebuild and compiled/inspect identity without ignoring a directory", () => {
  const f = marksFixture(304, true);
  try {
    assert.equal(verifyFrozenSource(f.root, f.expected).publicGeneratedAssets.filesVerified, 304);
    writeFileSync(join(f.root, "apps/web/next-env.d.ts"), compiledNextEnv);
    const value = verifyCompiledSource(f.root, f.expected); assert.equal(value.publicGeneratedAssets.filesVerified, 304); assert.equal(value.allowedNextEnvTransform, "apps/web/next-env.d.ts");
    const inspect = spawnSync(process.execPath, [join(f.root, "scripts/uapt-release.mjs"), "inspect", f.expected], { encoding: "utf8" });
    assert.equal(inspect.status, 0, inspect.stderr); assert.equal(JSON.parse(inspect.stdout).compiledSource.publicGeneratedAssets.filesVerified, 304);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

for (const issue of ["extra-file", "wrong-bytes", "target-link", "extra-empty-directory", "executable-target", "mismatched-mode", "missing-file", "dirty-tracked-source", "dirty-registry", "other-untracked"]) {
  test(`derived public marks reject ${issue} in both prebuild and compiled identity`, () => {
    const f = marksFixture();
    try {
      const target = join(f.root, f.targetPrefix, f.names[0]);
      if (issue === "extra-file") { const bytes = Buffer.from("not listed by published registry"); writeFileSync(join(f.root, f.targetPrefix, createHash("sha256").update(bytes).digest("hex") + ".webp"), bytes); }
      if (issue === "wrong-bytes") writeFileSync(target, "wrong public mark bytes");
      if (issue === "target-link") { rmSync(target); symlinkSync(join(f.root, f.sourcePrefix, f.names[0]), target); }
      if (issue === "extra-empty-directory") mkdirSync(join(f.root, f.targetPrefix, "unexpected-empty"));
      if (issue === "executable-target") chmodSync(target, 0o755);
      if (issue === "mismatched-mode") chmodSync(target, 0o400);
      if (issue === "missing-file") rmSync(target);
      if (issue === "dirty-tracked-source") writeFileSync(join(f.root, f.sourcePrefix, f.names[0]), "altered tracked original");
      if (issue === "dirty-registry") writeFileSync(join(f.root, "apps/web/lib/university-marks-published.json"), "{}");
      if (issue === "other-untracked") writeFileSync(join(f.root, "unreviewed.json"), "private unreviewed material");
      assert.throws(() => verifyFrozenSource(f.root, f.expected)); assert.throws(() => verifyCompiledSource(f.root, f.expected));
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });
}

for (const owner of ["source", "target"]) {
  test(`derived public mark ${owner} ancestor symlink is rejected even when exact file bytes match`, () => {
    const f = marksFixture(); const outside = fixture();
    try {
      const prefix = owner === "source" ? f.sourcePrefix : f.targetPrefix, original = join(f.root, prefix);
      const moved = join(outside, "same-byte-marks");
      // Move fixture files outside the expected root; the leaf files remain regular.
      mkdirSync(moved); for (const name of f.names) copyFileSync(join(original, name), join(moved, name));
      rmSync(original, { recursive: true }); symlinkSync(moved, original, "dir");
      assert.throws(() => verifyPublicGeneratedAssets(f.root, f.paths), /symlink/);
    } finally { rmSync(f.root, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }); }
  });
}
