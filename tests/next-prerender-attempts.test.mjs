import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const version = require("next/package.json").version;

function worker(render) {
  assert.equal(version, "16.4.2", "Review these framework-behavior fixtures when Next changes");
  const filename = require.resolve("next/dist/export/worker.js");
  const exports = {};
  const dependencies = {
    "../build/swc/install-bindings": { installBindings: async () => {} },
    "../server/lib/install-code-frame": { installCodeFrameSupport() {} },
    "../server/node-environment-extensions/global-behaviors": { installGlobalBehaviors() {} },
    "./helpers/create-incremental-cache": { createIncrementalCache: async () => ({}) },
    "../lib/needs-experimental-react": { needsExperimentalReact: () => false }
  };
  const context = vm.createContext({
    exports, module: { exports },
    require: name => dependencies[name] ?? {},
    process: { env: {}, on() {}, exit() { throw new Error("Unexpected worker process exit"); } },
    console: { info() {}, error() {} },
    // Rendering resolves immediately; leave the unused timeout promise pending
    // without a timer handle. No build, file writes or native binding is started.
    setTimeout() {},
    __render: render
  });
  // Run the installed worker's real retry/concurrency code. Replace only its
  // expensive render boundary in this isolated VM, never a disk/.next file.
  vm.runInContext(`${readFileSync(filename, "utf8")}\nexportPage = __render;`, context, { filename });
  return exports.exportPages;
}

async function run(attempts, render) {
  return worker(render)({
    exportPaths: [{ page: "/_global-error", path: "/_global-error", _isAppDir: true }],
    renderOpts: { experimental: {} },
    nextConfig: { staticPageGenerationTimeout: 180, experimental: {
      staticGenerationRetryCount: attempts,
      staticGenerationMaxConcurrency: 1,
      prerenderEarlyExit: false
    } },
    options: { buildExport: true }
  });
}

test("installed Next zero attempts skip rendering and leave no HTML result", async () => {
  let calls = 0;
  const result = await run(0, async () => { calls++; return { htmlSize: 42 }; });
  assert.equal(calls, 0);
  assert.equal(result.length, 1);
  assert.equal(result[0].result, undefined);
});

test("installed Next one ordinary attempt produces HTML and does not retry a non-timeout failure", async () => {
  let calls = 0;
  const success = await run(1, async () => { calls++; return { htmlSize: 42 }; });
  assert.equal(calls, 1);
  assert.equal(success[0].result.htmlSize, 42);
  calls = 0;
  const failure = await run(1, async () => { calls++; return { error: true }; });
  assert.equal(calls, 1);
  assert.equal(failure[0].result.error, true);
});

test("installed Next still calls child generators after an empty locale parent", async () => {
  const filename = require.resolve("next/dist/build/static-paths/app.js");
  const text = readFileSync(filename, "utf8");
  const file = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true);
  const fn = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "generateRouteStaticParams");
  assert(fn, "Review the installed Next parameter collection implementation");
  const context = vm.createContext({
    _implicittags: { getImplicitTags: async () => [] },
    callGenerateStaticParams: async (_page, generate, params) => generate({ params })
  });
  vm.runInContext(`${fn.getText(file)}\nglobalThis.collect = generateRouteStaticParams;`, context, { filename });
  let childCalls = 0;
  const output = await context.collect([
    { generateStaticParams: async () => [] },
    { generateStaticParams: async ({ params }) => {
      childCalls++;
      assert.equal(Object.keys(params).length, 0);
      return [{ slug: "one" }, { slug: "two" }];
    } }
  ], { page: "/[locale]/themes/[slug]" }, false, [], false);
  assert.equal(childCalls, 1);
  assert.equal(JSON.stringify(output), JSON.stringify([{ slug: "one" }, { slug: "two" }]));
});
