import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { isAbsolute, relative, resolve } from "node:path";
import { prepareWebRuntimeData } from "./prepare-web-runtime-data.mjs";

const packages = { full: "@uapt/web", zone: "@uapt/tulsa-zone" };
const directories = { full: "apps/web", zone: "apps/tulsa-zone" };

export function parseBuildArguments(args) {
  const [scope, ...rest] = args;
  if (!Object.hasOwn(packages, scope)) throw new Error("Choose build full or build zone explicitly; no recursive workspace build is supported");
  const debug = rest.includes("--debug");
  const webpack = rest.includes("--webpack");
  const positional = rest.filter(value => !value.startsWith("--"));
  if (rest.some(value => value.startsWith("--") && !["--debug", "--webpack"].includes(value)) ||
      rest.filter(value => value === "--debug").length > 1 || rest.filter(value => value === "--webpack").length > 1 ||
      (debug ? positional.length !== 0 : positional.length !== 1 || !/^[0-9a-f]{40}$/.test(positional[0]))) {
    throw new Error("Use build <full|zone> <frozen-40-character-SHA> [--webpack], or build <full|zone> --debug [--webpack]");
  }
  return { scope, sha: debug ? null : positional[0], debug, webpack };
}

export function buildSteps(root, options) {
  const app = directories[options.scope];
  const target = packages[options.scope];
  if (!app || !target) throw new Error("Unknown build scope");
  return [
    // Both runtimes import source from the other app. pnpm cannot infer those
    // relative imports from workspace package dependencies.
    { name: "dependencies", command: "pnpm", args: ["--filter", "university-ai-policy-tracker", "--filter", "@uapt/web...", "--filter", "@uapt/tulsa-zone...", "install", "--prod=false", "--frozen-lockfile", "--prefer-offline"] },
    ...(options.scope === "full" ? [{ name: "build-scope", command: process.execPath, args: ["scripts/validate-web-build-scope.mjs"] }] : []),
    { name: "prisma", command: "pnpm", args: ["--filter", "@uapt/db", "generate"] },
    { name: "source-types", command: "pnpm", args: ["--filter", target, "exec", "tsc", "--noEmit", "--incremental", "false", "-p", "tsconfig.json"] },
    { name: "runtime-data", targetRoot: resolve(root, app, ".runtime-data") },
    { name: "runtime-validation", command: "pnpm", args: ["exec", "tsx", "--tsconfig", `${app}/tsconfig.json`, "scripts/validate-web-runtime-data.ts", "--app-root", resolve(root, app)] },
    // Execute Next directly. Calling the package build script here would repeat
    // preparation (or recurse back into this entry point).
    { name: "next", command: "pnpm", args: ["--filter", target, "exec", "next", "build", ...(options.webpack ? ["--webpack"] : [])] }
  ];
}

function runCommand(command, args, root, env, spawn) {
  const result = spawn(command, args, { cwd: root, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status ?? result.signal}); build stopped, no candidate start or routing action`);
}

export function verifyPublicGeneratedAssets(root, untrackedPaths, spawn = spawnSync) {
  if (!untrackedPaths.length) return null;
  root = realpathSync(root);
  const git = (...args) => {
    const result = spawn("git", ["-C", root, ...args], { encoding: "utf8" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error("Cannot verify tracked public mark sources");
    return result.stdout;
  };
  const registryPath = "apps/web/lib/university-marks-published.json";
  function regularBytes(filename) {
    const path = resolve(root, filename), before = lstatSync(path);
    if (!before.isFile() || realpathSync(path) !== path || before.mode & 0o111) throw new Error("Public generated mark has a symlink, non-regular or executable path");
    const bytes = readFileSync(path), after = lstatSync(path);
    if (realpathSync(path) !== path || ["dev", "ino", "size", "mode", "mtimeMs", "ctimeMs"].some(key => before[key] !== after[key])) throw new Error("Public generated mark changed while reading");
    return { bytes, mode: after.mode & 0o7777 };
  }
  const registryBytes = regularBytes(registryPath).bytes;
  if (!registryBytes.equals(Buffer.from(git("show", `HEAD:${registryPath}`)))) throw new Error("Published marks registry differs from frozen Git source");
  const registry = JSON.parse(registryBytes);
  if (registry.schema !== "uapt-published-compact-marks-v1" || !/^\/assets\/university-marks\/[a-z0-9-]+$/.test(registry.assetPrefix) || !registry.entries || Array.isArray(registry.entries)) throw new Error("Invalid published compact-mark registry");
  const files = new Set(Object.values(registry.entries).map(entry => entry.file));
  if (!files.size || [...files].some(name => !/^[a-f0-9]{64}\.webp$/.test(name))) throw new Error("Unsafe published compact-mark filename");
  const sourcePrefix = `apps/tulsa-zone/public${registry.assetPrefix}`, targetPrefix = `apps/web/public${registry.assetPrefix}`;
  const allowed = new Set([...files].map(name => `${targetPrefix}/${name}`));
  if (untrackedPaths.some(path => !allowed.has(path)) || untrackedPaths.length !== new Set(untrackedPaths).size) throw new Error("Unapproved untracked source outside exact published generated marks");
  const target = resolve(root, targetPrefix);
  if (!lstatSync(target).isDirectory() || realpathSync(target) !== target) throw new Error("Generated public mark directory has a symlink ancestor");
  const actual = readdirSync(target, { withFileTypes: true });
  if (actual.length !== files.size || actual.some(entry => !entry.isFile() || !files.has(entry.name))) throw new Error("Extra, missing or non-regular file/directory in generated public marks");
  const tracked = new Map();
  for (const line of git("ls-tree", "-r", "-z", "HEAD", "--", sourcePrefix).split("\0").filter(Boolean)) {
    const item = /^(100644) blob ([a-f0-9]{40})\t(.+)$/.exec(line);
    if (!item) throw new Error("Tracked public mark source has an unsupported type/mode");
    tracked.set(item[3], item[2]);
  }
  for (const name of files) {
    const sourcePath = `${sourcePrefix}/${name}`, source = regularBytes(sourcePath), destination = regularBytes(`${targetPrefix}/${name}`);
    const hash = createHash("sha256").update(source.bytes).digest("hex");
    const gitBlob = createHash("sha1").update(`blob ${source.bytes.length}\0`).update(source.bytes).digest("hex");
    if (tracked.get(sourcePath) !== gitBlob || hash !== name.slice(0, -5) || !source.bytes.equals(destination.bytes) || source.mode !== destination.mode) throw new Error("Generated public mark bytes/mode differ from filename and frozen tracked Tulsa source");
  }
  return { registryPath, registrySha256: createHash("sha256").update(registryBytes).digest("hex"), sourcePrefix, targetPrefix, filesVerified: files.size };
}

export function verifyFrozenSource(root, sha, spawn = spawnSync) {
  const git = (...args) => {
    const result = spawn("git", ["-C", root, ...args], { encoding: "utf8" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error("Cannot verify frozen checkout identity");
    return result.stdout;
  };
  if (git("rev-parse", "HEAD").trim() !== sha || git("rev-parse", "origin/main").trim() !== sha) throw new Error("Checkout/origin-main differs from frozen release SHA");
  const changed = git("status", "--porcelain=v1", "-z", "--untracked-files=all").split("\0").filter(Boolean);
  if (changed.some(row => !row.startsWith("?? "))) throw new Error("Frozen release checkout has modified source files");
  return { publicGeneratedAssets: verifyPublicGeneratedAssets(root, changed.map(row => row.slice(3)), spawn) };
}

export function verifyCompiledSource(root, sha, scope = "full", spawn = spawnSync) {
  const app = directories[scope];
  if (!app || !/^[0-9a-f]{40}$/.test(sha ?? "")) throw new Error("Compiled source requires an exact target and frozen SHA");
  const git = (...args) => {
    const result = spawn("git", ["-C", root, ...args], { encoding: "utf8" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error("Cannot verify compiled source against Git HEAD");
    return result.stdout;
  };
  if (git("rev-parse", "HEAD").trim() !== sha) throw new Error("Compiled checkout SHA differs from frozen release SHA");
  const status = git("status", "--porcelain=v1", "-z", "--untracked-files=all").split("\0").filter(Boolean);
  const changed = status.filter(row => !row.startsWith("?? "));
  const filename = `${app}/next-env.d.ts`;
  if (changed.length) {
    if (changed.length !== 1 || changed[0] !== ` M ${filename}`) throw new Error("Compiled checkout contains an unapproved source change");
    const file = resolve(root, filename);
    if (!lstatSync(file).isFile() || git("diff", "--summary", "--", filename).trim()) throw new Error("Compiled next-env file type or mode changed");
    const original = git("show", `HEAD:${filename}`);
    const expected = original.replaceAll("./.next/dev/types/", "./.next/types/");
    if (original === expected || !readFileSync(file).equals(Buffer.from(expected))) throw new Error("Compiled next-env bytes differ beyond the exact Next dev-to-build type path transformation");
  }
  const publicGeneratedAssets = verifyPublicGeneratedAssets(root, status.filter(row => row.startsWith("?? ")).map(row => row.slice(3)), spawn);
  return { codeSha: sha, target: app, publicGeneratedAssets, allowedNextEnvTransform: changed.length ? filename : null,
    transformation: changed.length ? "./.next/dev/types/ -> ./.next/types/" : null };
}

export function verifyBuildDependencies(root, { ownRelease = true } = {}) {
  root = realpathSync(root);
  const versions = {}, canonicalPaths = {};
  for (const app of ["web", "tulsa-zone"]) {
    const require = createRequire(resolve(root, "apps", app, "package.json"));
    versions[app] = {};
    canonicalPaths[app] = {};
    for (const name of ["react", "@types/react", "react-dom", "@types/react-dom", "next"]) {
      let file;
      try { file = realpathSync(require.resolve(`${name}/package.json`)); }
      catch { throw new Error(`Missing ${name} dependency from apps/${app}; install the web and Tulsa closures with dev dependencies`); }
      const rel = relative(root, file);
      if (ownRelease && (rel === ".." || rel.startsWith("../") || isAbsolute(rel))) throw new Error(`apps/${app} ${name} resolves outside this isolated release`);
      canonicalPaths[app][name] = file;
      versions[app][name] = JSON.parse(readFileSync(file, "utf8")).version;
      if (typeof versions[app][name] !== "string") throw new Error(`Missing ${name} package version in apps/${app}`);
    }
  }
  for (const name of ["react", "@types/react", "react-dom", "@types/react-dom", "next"]) {
    if (versions.web[name] !== versions["tulsa-zone"][name]) throw new Error(`Shared web/Tulsa source resolves incompatible ${name} versions`);
  }
  return { ...versions, canonicalPaths };
}

function outputAbsent(path) {
  try { lstatSync(path); }
  catch (error) { if (error.code === "ENOENT") return; throw error; }
  throw new Error("Target .next already exists; preserve failed/accepted output and use a new release directory");
}

export async function runBuildPipeline({ root, options, spawn = spawnSync, prepare = prepareWebRuntimeData,
  verifyDependencies = verifyBuildDependencies, platform = process.platform, env = process.env, log = console.log }) {
  root = realpathSync(root);
  const app = directories[options.scope];
  if (!app) throw new Error("Unknown build scope");
  const target = resolve(root, app);
  if (options.debug) {
    if (root === "/srv/uapt" || root.startsWith("/srv/uapt/")) throw new Error("Debug builds cannot run in production UAPT directories");
    log("Diagnostic build only: no frozen release identity or candidate/public acceptance is asserted.");
  } else {
    if (platform !== "linux") throw new Error("Frozen release builds run on Linux OCI; use explicit --debug only for a local diagnostic build");
    if (!/^[0-9a-f]{40}$/.test(options.sha ?? "")) throw new Error("Frozen full release SHA required");
    if (env.NODE_ENV !== "production") throw new Error("Production build environment must be loaded by the admitted server operator");
    verifyFrozenSource(root, options.sha, spawn);
    outputAbsent(resolve(target, ".next"));
  }
  const buildEnv = { ...env, NODE_ENV: "production" };
  for (const step of buildSteps(root, options)) {
    log(`Release build stage: ${step.name}`);
    if (step.name === "runtime-data") {
      await prepare({ repoRoot: root, targetRoot: step.targetRoot });
    } else {
      if (step.name === "next" && !options.debug) {
        verifyFrozenSource(root, options.sha, spawn);
        outputAbsent(resolve(target, ".next"));
      }
      runCommand(step.command, step.args, root, buildEnv, spawn);
      if (step.name === "dependencies") verifyDependencies(root, { ownRelease: !options.debug });
    }
  }
  const buildId = readFileSync(resolve(target, ".next/BUILD_ID"), "utf8").trim();
  if (!buildId) throw new Error("Next exited without a valid BUILD_ID; no accepted artifact exists");
  const compiledSource = options.debug ? null : verifyCompiledSource(root, options.sha, options.scope, spawn);
  return { status: options.debug ? "DEBUG_BUILD_ONLY_NOT_RELEASE_ACCEPTANCE" : "COMPILED_NOT_ACCEPTED",
    scope: options.scope, codeSha: options.sha, BUILD_ID: buildId, compiledSource, candidateStarted: false, routesChanged: false };
}
