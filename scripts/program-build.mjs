#!/usr/bin/env node
/**
 * Content-free program build and artifact packaging (R1-d).
 *
 *   node scripts/program-build.mjs build   --sha <40-hex> [--local]
 *   node scripts/program-build.mjs package --sha <40-hex> --out <dir> --markers-from <dir> [--local]
 *
 * `build` runs `next build` for apps/web with UAPT_PROGRAM_BUILD=1: standalone
 * output, no content traced, and any content read during prerendering aborts
 * that render (lib/content-runtime.ts). `package` removes every prerendered
 * page/route body so all routes render on demand from the runtime content
 * release, checks that nothing private or content-derived is left, and writes
 * a tarball with its SHA256 and a build manifest. Neither step needs secrets,
 * starts a service or touches a server. See docs/program-release.md.
 *
 * `build` also bundles the MCP server (apps/mcp/src/server.ts) into one ESM file,
 * apps/mcp/dist/server.mjs, which `package` ships as apps/mcp/server.mjs. It reads
 * the same runtime content release as the web app (UAPT_CONTENT_ROOT) and
 * hot-reloads its catalog on a content switch.
 *
 * --local is a diagnostic mode for a dirty checkout; its artifact is marked
 * `diagnostic: true` and the server installer refuses it.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createReadStream, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, rmSync, cpSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ARTIFACT_SCHEMA = "uapt-program-artifact-v1";
export const FILE_LIST_SCHEMA = "uapt-program-file-list-v1";
/** Plan §5.1 target: a program release directory stays under 1 GiB. */
export const MAX_UNPACKED_BYTES = 1024 ** 3;
/** Checkout directories that hold content; frozen builds run without them. */
export const HELD_OUT_CONTENT = ["data", "staging"];
/** Framework pages that never read content; everything else is pruned. */
export const KEPT_PRERENDERS = new Set(["/_not-found", "/_global-error"]);
const GLOBAL_NOT_FOUND_TITLE = "Page not found | University AI Policy Tracker";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDir = "apps/web";
export const MCP_SOURCE = "apps/mcp/src/server.ts";
/** Bundled MCP server, relative to the checkout (build) and to the artifact root (package). */
export const MCP_BUNDLE = "apps/mcp/dist/server.mjs";
export const MCP_ENTRY = "apps/mcp/server.mjs";

// Path rules for anything inside the artifact. Top-level checkout directories
// that hold content, evidence or tooling must never be traced in.
const FORBIDDEN_TOP = new Set(["data", "staging", "knowledge", "content", "docs", "tests", "scripts", "infra", "examples", "plugins", ".local", ".git", ".github", ".claude"]);
const FORBIDDEN_ANYWHERE = new Set([".local", ".git", ".runtime-data", "policy-inventory", "review-cache", "screenshots", "private-bundles", "candidates"]);
const FORBIDDEN_FILE = [/^\.env(?:\..*)?$/, /\.pem$/, /\.key$/, /^id_(?:rsa|ed25519|ecdsa)/, /service-account.*\.json$/i, /\.(?:sqlite3?|db)$/];
const PRERENDER_FILE = /\.(?:html|rsc|meta|body)$/;

export function forbiddenPath(relative) {
  const parts = relative.split("/");
  if (FORBIDDEN_TOP.has(parts[0])) return `top-level ${parts[0]}/`;
  if (parts[0] === "apps" && parts[2] === "data") return "app data/ directory";
  const segment = parts.find(part => FORBIDDEN_ANYWHERE.has(part));
  if (segment) return `${segment}/ path`;
  const name = parts.at(-1);
  if (FORBIDDEN_FILE.some(pattern => pattern.test(name))) return `private file type (${name})`;
  return null;
}

function sha256File(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(file).on("data", chunk => hash.update(chunk)).on("error", reject).on("end", () => resolve(hash.digest("hex")));
  });
}

/**
 * Remove the build-time body of every prerendered route except the framework
 * pages. The prerender manifest keeps each route registered for ISR, so the
 * first request renders it from the active content release and caches it.
 */
export function prunePrerenderedContent(distDir) {
  const manifest = JSON.parse(readFileSync(path.join(distDir, "prerender-manifest.json"), "utf8"));
  const serverApp = path.join(distDir, "server", "app");
  const pruned = [], kept = [];
  for (const [route, info] of Object.entries(manifest.routes ?? {})) {
    const base = route === "/" ? "/index" : route;
    if (KEPT_PRERENDERS.has(route)) { kept.push(route); continue; }
    const targets = [".html", ".rsc", ".meta", ".body", ".segments"].map(suffix => `${base}${suffix}`);
    for (const extra of [info.dataRoute, info.prefetchDataRoute]) if (typeof extra === "string") targets.push(extra);
    for (const target of targets) {
      const file = path.join(serverApp, target);
      if (!file.startsWith(serverApp + path.sep)) throw new Error(`Prerender path escapes server/app: ${target}`);
      rmSync(file, { recursive: true, force: true });
    }
    pruned.push(route);
  }
  // The kept 404s must be the content-free global page, not a content render.
  for (const notFound of [path.join(serverApp, "_not-found.html"), path.join(distDir, "server/pages/404.html")]) {
    if (existsSync(notFound) && !readFileSync(notFound, "utf8").includes(GLOBAL_NOT_FOUND_TITLE)) {
      throw new Error(`${path.relative(distDir, notFound)} is not the content-free global not-found page`);
    }
  }
  const keptBases = new Set([...kept].map(route => route.slice(1)));
  const residue = [];
  const walk = (directory, relative) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const rel = relative ? `${relative}/${entry.name}` : entry.name;
      const stem = rel.replace(/\.(?:html|rsc|meta|body|segments)$/, "");
      if (keptBases.has(stem)) continue;
      if (entry.isDirectory()) {
        if (entry.name.endsWith(".segments")) residue.push(rel); else walk(path.join(directory, entry.name), rel);
      } else if (PRERENDER_FILE.test(entry.name)) residue.push(rel);
    }
  };
  if (existsSync(serverApp)) walk(serverApp, "");
  // Pages-router fallbacks Next emits beside the app router: the global 404
  // (checked above) and its built-in 500 page. Nothing else may remain.
  const pagesDir = path.join(distDir, "server", "pages");
  if (existsSync(pagesDir)) {
    for (const name of readdirSync(pagesDir)) {
      if (PRERENDER_FILE.test(name) && !["404.html", "500.html"].includes(name)) residue.push(`server/pages/${name}`);
    }
  }
  if (residue.length) throw new Error(`Prerendered output left after pruning: ${residue.slice(0, 10).join(", ")}`);
  return { pruned: pruned.sort(), kept: kept.sort() };
}

/** Walk the artifact tree: regular files and in-tree relative symlinks only. */
export async function scanArtifactTree(root) {
  const files = [], symlinks = [], problems = [];
  let bytes = 0;
  const walk = async (directory, relative) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const rel = relative ? `${relative}/${entry.name}` : entry.name;
      const full = path.join(directory, entry.name);
      const reason = forbiddenPath(rel);
      if (reason) { problems.push(`${rel}: ${reason}`); continue; }
      const info = lstatSync(full);
      if (info.isSymbolicLink()) {
        const target = readlinkSync(full);
        const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(rel), target));
        if (path.isAbsolute(target) || resolved === ".." || resolved.startsWith("../")) problems.push(`${rel}: symlink leaves the artifact (${target})`);
        else symlinks.push([rel, target]);
      } else if (info.isDirectory()) {
        await walk(full, rel);
      } else if (info.isFile()) {
        if (info.mode & 0o6000) problems.push(`${rel}: setuid/setgid bit`);
        bytes += info.size;
        files.push([rel, await sha256File(full), info.size, info.mode & 0o777]);
      } else {
        problems.push(`${rel}: not a regular file, directory or symlink`);
      }
    }
  };
  await walk(root, "");
  return { files, symlinks, bytes, problems };
}

/** Stable digest of the file list: one line per entry, sorted by path. */
export function fileListDigest({ files, symlinks }) {
  const lines = [
    ...files.map(([rel, sha, size, mode]) => `F\t${rel}\t${sha}\t${size}\t${mode.toString(8)}`),
    ...symlinks.map(([rel, target]) => `L\t${rel}\t${target}`)
  ].sort();
  return createHash("sha256").update(lines.join("\n") + "\n").digest("hex");
}

/**
 * Identity strings of the checkout's content pointers. A program artifact that
 * contains one of them carries content; the scan only runs where the checkout
 * has data/ (CI and local), never on the server.
 */
export function contentMarkers(root) {
  const markers = new Set();
  for (const file of ["data/public-releases/current.json", "data/public-v6-pages/current.json", "data/public-v6-records/current.json", "data/public-v6-history/current.json", "data/public-change-history/current.json"]) {
    const full = path.join(root, file);
    if (!existsSync(full)) continue;
    const pointer = JSON.parse(readFileSync(full, "utf8"));
    for (const key of ["releaseId", "revision", "revisionId", "sha256", "contentHash"]) {
      const value = pointer[key];
      if (typeof value === "string" && value.length >= 12) markers.add(value);
    }
  }
  return [...markers];
}

function findMarkers(root, files, markers) {
  if (!markers.length) return [];
  const hits = [];
  for (const [rel, , size] of files) {
    if (size > 8 * 1024 * 1024 || !/\.(?:js|mjs|cjs|json|html|rsc|txt|body|meta|map)$/.test(rel)) continue;
    const text = readFileSync(path.join(root, rel), "utf8");
    for (const marker of markers) if (text.includes(marker)) hits.push(`${rel}: ${marker.slice(0, 16)}…`);
  }
  return hits;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: repoRoot, encoding: "utf8", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed (${result.status ?? result.signal})${result.stderr ? `: ${result.stderr.trim().slice(-400)}` : ""}`);
  return (result.stdout ?? "").trim();
}

// `next build` rewrites the dev type paths in this tracked file (the same
// transformation scripts/release-build-pipeline.mjs accepts); nothing else may change.
const NEXT_ENV = `${appDir}/next-env.d.ts`;
function onlyNextEnvTransform(rows) {
  if (rows.length !== 1 || rows[0] !== ` M ${NEXT_ENV}`) return false;
  const original = run("git", ["show", `HEAD:${NEXT_ENV}`]);
  return readFileSync(path.join(repoRoot, NEXT_ENV), "utf8").trim() === original.replaceAll("./.next/dev/types/", "./.next/types/");
}

function checkout(sha, local) {
  if (!/^[0-9a-f]{40}$/.test(sha ?? "")) throw new Error("--sha must be a full 40-character commit SHA");
  const head = run("git", ["rev-parse", "HEAD"]);
  const status = spawnSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=no"], { cwd: repoRoot, encoding: "utf8" });
  if (status.status !== 0) throw new Error("git status failed");
  const rows = status.stdout.split("\0").filter(Boolean);
  const dirty = rows.length > 0 && !onlyNextEnvTransform(rows);
  if (!local && head !== sha) throw new Error(`Checkout ${head} is not the frozen SHA ${sha}`);
  if (!local && dirty) throw new Error("Frozen program builds need an unmodified checkout");
  return { head, dirty };
}

export function programBuildEnv(base = process.env) {
  const env = { ...base };
  for (const key of Object.keys(env)) if (key.startsWith("NEXT_PUBLIC_") || key.startsWith("UAPT_CONTENT_")) delete env[key];
  const publicEnv = JSON.parse(readFileSync(path.join(repoRoot, appDir, "program-build.public-env.json"), "utf8"));
  for (const [key, value] of Object.entries(publicEnv)) {
    if (!key.startsWith("NEXT_PUBLIC_") || typeof value !== "string") throw new Error(`Invalid public build variable ${key}`);
  }
  return { env: { ...env, ...publicEnv, NODE_ENV: "production", UAPT_PROGRAM_BUILD: "1", NEXT_TELEMETRY_DISABLED: "1" }, publicEnv };
}

/**
 * One self-contained ESM file for the MCP server: its SDK, zod and @uapt/shared
 * are inlined, so the artifact needs no extra node_modules or tsx at runtime.
 * CommonJS dependencies inside the bundle get a real `require` for Node builtins.
 */
export async function bundleMcp({ root = repoRoot, outfile = path.join(root, MCP_BUNDLE) } = {}) {
  const { build: esbuild } = await import("esbuild");
  rmSync(outfile, { force: true });
  const result = await esbuild({
    entryPoints: [path.join(root, MCP_SOURCE)], outfile, bundle: true, platform: "node", format: "esm", target: "node22",
    minify: false, sourcemap: false, legalComments: "none", logLevel: "silent", metafile: true,
    banner: { js: 'import { createRequire as __uaptCreateRequire } from "node:module"; const require = __uaptCreateRequire(import.meta.url);' }
  });
  if (result.errors.length) throw new Error(`MCP bundle failed: ${result.errors.map(e => e.text).join("; ")}`);
  const inputs = Object.keys(result.metafile.inputs);
  // Content must come from the runtime release, never from the checkout.
  const content = inputs.filter(file => HELD_OUT_CONTENT.some(dir => file.startsWith(`${dir}/`)) || /(^|\/)\.runtime-data\//.test(file) || file.endsWith(".json") && !file.includes("node_modules/"));
  if (content.length) throw new Error(`MCP bundle would include checkout content: ${content.slice(0, 5).join(", ")}`);
  return { outfile, inputs: inputs.length, bytes: lstatSync(outfile).size };
}

async function build({ sha, local }) {
  checkout(sha, local);
  // The workflow's sparse checkout omits content, so a build that still needed
  // it fails here rather than baking it in (--local may keep data/ in place).
  const present = HELD_OUT_CONTENT.filter(name => existsSync(path.join(repoRoot, name)));
  if (!local && present.length) throw new Error(`Frozen program builds run without checkout content; remove ${present.join(", ")} (sparse checkout)`);
  const dist = path.join(repoRoot, appDir, ".next");
  if (existsSync(dist)) throw new Error(`${appDir}/.next exists; program builds start from empty output`);
  const { env } = programBuildEnv();
  const result = spawnSync("pnpm", ["--filter", "@uapt/web", "exec", "next", "build"], { cwd: repoRoot, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`next build failed (${result.status ?? result.signal}); no artifact`);
  if (!existsSync(path.join(dist, "standalone", appDir, "server.js"))) throw new Error("Standalone server missing; check output: standalone");
  const mcp = await bundleMcp();
  console.log(JSON.stringify({ status: "BUILT", codeSha: sha, BUILD_ID: readFileSync(path.join(dist, "BUILD_ID"), "utf8").trim(), mcpBundleBytes: mcp.bytes }));
}

async function packageArtifact({ sha, out, local, markersFrom }) {
  const { head, dirty } = checkout(sha, local);
  if (!out) throw new Error("--out <dir> required");
  const markerRoot = markersFrom ? path.resolve(markersFrom) : local ? repoRoot : undefined;
  const markers = markerRoot ? contentMarkers(markerRoot) : [];
  if (!markers.length) throw new Error("--markers-from <dir> must hold the frozen SHA's content pointers (data/public-*/current.json)");
  const contentHeldOut = HELD_OUT_CONTENT.every(name => !existsSync(path.join(repoRoot, name)));
  const dist = path.join(repoRoot, appDir, ".next");
  const standalone = path.join(dist, "standalone");
  const buildId = readFileSync(path.join(dist, "BUILD_ID"), "utf8").trim();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(buildId)) throw new Error("Missing or invalid BUILD_ID");
  const appDist = path.join(standalone, appDir, ".next");
  if (readFileSync(path.join(appDist, "BUILD_ID"), "utf8").trim() !== buildId) throw new Error("Standalone BUILD_ID differs from the build");

  const prerender = prunePrerenderedContent(appDist);
  // server.js serves static files and public/ from the app directory.
  cpSync(path.join(dist, "static"), path.join(appDist, "static"), { recursive: true });
  cpSync(path.join(repoRoot, appDir, "public"), path.join(standalone, appDir, "public"), { recursive: true });
  rmSync(path.join(appDist, "cache"), { recursive: true, force: true });
  const mcpBundle = path.join(repoRoot, MCP_BUNDLE);
  if (!existsSync(mcpBundle)) throw new Error(`${MCP_BUNDLE} missing; run the build step first`);
  mkdirSync(path.join(standalone, path.dirname(MCP_ENTRY)), { recursive: true });
  cpSync(mcpBundle, path.join(standalone, MCP_ENTRY));
  // Written below; a repeated package run must not list the previous copies.
  for (const name of ["source-manifest.json", "build-artifact-manifest.json"]) rmSync(path.join(standalone, name), { force: true });

  const { publicEnv } = programBuildEnv();
  const scan = await scanArtifactTree(standalone);
  if (scan.problems.length) throw new Error(`Artifact contains excluded paths:\n${scan.problems.slice(0, 20).join("\n")}`);
  if (scan.bytes > MAX_UNPACKED_BYTES) throw new Error(`Artifact is ${scan.bytes} bytes; the program package limit is ${MAX_UNPACKED_BYTES}`);
  const markerHits = findMarkers(standalone, scan.files, markers);
  if (markerHits.length) throw new Error(`Content identities found in the program artifact:\n${markerHits.slice(0, 10).join("\n")}`);

  const fileList = { schemaVersion: FILE_LIST_SCHEMA, codeSha: head, files: scan.files.map(([p, sha256, bytes, mode]) => ({ path: p, sha256, bytes, mode: mode.toString(8) })), symlinks: scan.symlinks.map(([p, target]) => ({ path: p, target })) };
  // Named for the lifecycle controller's basis.sourceManifestSha256 lookup.
  writeFileSync(path.join(standalone, "source-manifest.json"), JSON.stringify(fileList) + "\n");
  const nextVersion = JSON.parse(readFileSync(path.join(repoRoot, appDir, "node_modules/next/package.json"), "utf8")).version;
  const glibc = process.report?.getReport?.().header?.glibcVersionRuntime ?? null;
  const manifest = {
    schemaVersion: ARTIFACT_SCHEMA,
    codeSha: head,
    BUILD_ID: buildId,
    diagnostic: local || dirty || undefined,
    builtAt: new Date().toISOString(),
    builder: { node: process.version, pnpm: run("pnpm", ["--version"]), next: nextVersion, platform: process.platform, arch: process.arch, glibc },
    lockfileSha256: createHash("sha256").update(readFileSync(path.join(repoRoot, "pnpm-lock.yaml"))).digest("hex"),
    nextConfigSha256: createHash("sha256").update(readFileSync(path.join(repoRoot, appDir, "next.config.ts"))).digest("hex"),
    publicBuildEnv: publicEnv,
    contentFree: { checkoutContentHeldOut: contentHeldOut, prunedPrerenders: prerender.pruned.length, keptFrameworkPrerenders: prerender.kept, contentMarkersChecked: markers.length },
    entry: { workingDirectory: appDir, command: "node server.js" },
    entries: {
      web: { workingDirectory: appDir, command: "node server.js" },
      mcp: { workingDirectory: path.dirname(MCP_ENTRY), command: `node ${path.basename(MCP_ENTRY)}`, path: MCP_ENTRY, sha256: createHash("sha256").update(readFileSync(path.join(standalone, MCP_ENTRY))).digest("hex") }
    },
    files: { count: scan.files.length, symlinks: scan.symlinks.length, bytes: scan.bytes, listSha256: fileListDigest(scan), sourceManifestSha256: createHash("sha256").update(JSON.stringify(fileList) + "\n").digest("hex") }
  };
  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  writeFileSync(path.join(standalone, "build-artifact-manifest.json"), manifestText);

  const outDir = path.resolve(out);
  mkdirSync(outDir, { recursive: true });
  const name = `uapt-program-${head.slice(0, 12)}-${buildId}`;
  const tarball = path.join(outDir, `${name}.tar.gz`);
  run("tar", ["-czf", tarball, "-C", standalone, "."], { env: { ...process.env, COPYFILE_DISABLE: "1" } });
  const tarSha = await sha256File(tarball);
  writeFileSync(`${tarball}.sha256`, `${tarSha}  ${path.basename(tarball)}\n`);
  const summary = { ...manifest, artifact: { name, file: path.basename(tarball), sha256: tarSha, bytes: lstatSync(tarball).size, buildArtifactManifestSha256: createHash("sha256").update(manifestText).digest("hex") } };
  writeFileSync(path.join(outDir, "artifact.json"), JSON.stringify(summary, null, 2) + "\n");
  console.log(JSON.stringify({ status: local ? "DIAGNOSTIC_ARTIFACT" : "PACKAGED_NOT_ACCEPTED", ...summary.artifact, unpackedBytes: scan.bytes, files: scan.files.length, prunedPrerenders: prerender.pruned.length }));
}

function parse(argv) {
  const [command, ...rest] = argv;
  const options = { command, local: false };
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--local") options.local = true;
    else if (arg === "--sha" || arg === "--out") options[arg.slice(2)] = rest[++i];
    else if (arg === "--markers-from") options.markersFrom = rest[++i];
    else throw new Error(`Unknown argument ${arg}`);
  }
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parse(process.argv.slice(2));
    if (options.command === "build") await build(options);
    else if (options.command === "package") await packageArtifact(options);
    else throw new Error("Usage: program-build.mjs <build|package> --sha <40-hex> [--out <dir> --markers-from <dir>] [--local]");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
