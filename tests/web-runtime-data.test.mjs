import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm, symlink} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
import {prepareWebRuntimeData} from "../scripts/prepare-web-runtime-data.mjs";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("isolated production loaders preserve canonical records, repairs and frozen history without source fallback", {timeout:180000}, async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "uapt-runtime-package-"));
  try {
    const app = path.join(root, "apps/web"), target = path.join(app, ".runtime-data");
    await mkdir(app, {recursive:true});
    // V6 shard stores intentionally remain outside the legacy runtime-data root.
    await symlink(path.join(repo, "data"), path.join(root, "data"), "dir");
    const result = await prepareWebRuntimeData({repoRoot:repo,targetRoot:target});
    assert.ok(result.publishedManifests > 1);
    const run = spawnSync(process.execPath, [path.join(repo,"node_modules/tsx/dist/cli.mjs"),"--tsconfig",path.join(repo,"apps/web/tsconfig.json"),path.join(repo,"scripts/validate-web-runtime-data.ts"),"--app-root",app], {cwd:repo,encoding:"utf8",env:{...process.env,NODE_ENV:"production",CATALOG_API_BASE_URL:"http://127.0.0.1:1/unreachable"},timeout:150000});
    assert.equal(run.status,0,run.stdout+run.stderr);
    const receipt = JSON.parse(run.stdout.trim().split("\n").at(-1));
    t.diagnostic(JSON.stringify(receipt));
    assert.equal(receipt.status,"PASS");assert.equal(receipt.liveFetchDisabled,true);
    assert.ok(receipt.analysisControls.includes("massachusetts-institute-of-technology"));
    assert.equal(receipt.atomFeed.publishedIndexMatched,true);
    assert.ok(receipt.atomFeed.records > 0 && receipt.atomFeed.records <= 30);
    assert.ok(receipt.atomFeed.milliseconds < 120000);
  } finally {await rm(root,{recursive:true,force:true});}
});

for (const unsafe of ["staging/uapt-runs/../../.local/secrets","/staging/uapt-runs/private"]) {
  test(`unsafe published artifact path cannot replace a complete runtime: ${unsafe}`, async () => {
    const root=await mkdtemp(path.join(tmpdir(),"uapt-runtime-reject-"));
    try {
      const history=path.join(root,"data/public-releases/history"),target=path.join(root,"runtime");await mkdir(history,{recursive:true});await mkdir(target);
      await writeFile(path.join(target,"keep"),"previous complete package");
      await writeFile(path.join(root,"data/public-releases/current.json"),JSON.stringify({schemaVersion:"uapt-public-release-manifest-v1",candidateOnly:false,includeStagedArtifactDirectories:[unsafe]}));
      await assert.rejects(prepareWebRuntimeData({repoRoot:root,targetRoot:target}),/Unsafe public artifact/);
      assert.equal(await readFile(path.join(target,"keep"),"utf8"),"previous complete package");
    } finally {await rm(root,{recursive:true,force:true});}
  });
}

test("missing public repair directory preserves the previous complete runtime", async () => {
  const root=await mkdtemp(path.join(tmpdir(),"uapt-runtime-missing-"));
  try {
    const target=path.join(root,"runtime");await mkdir(path.join(root,"data/public-releases/history"),{recursive:true});await mkdir(target);await writeFile(path.join(target,"keep"),"previous complete package");
    await mkdir(path.join(root,"data/rankings"));await mkdir(path.join(root,"data/policy-snapshots"));
    await writeFile(path.join(root,"data/public-releases/current.json"),JSON.stringify({schemaVersion:"uapt-public-release-manifest-v1",candidateOnly:false,includeStagedArtifactDirectories:[]}));
    await assert.rejects(prepareWebRuntimeData({repoRoot:root,targetRoot:target}), error => error.code === "ENOENT" && error.path.includes("public-record-repairs"));
    assert.equal(await readFile(path.join(target,"keep"),"utf8"),"previous complete package");
  } finally {await rm(root,{recursive:true,force:true});}
});

test("a manifest symlink cannot import private inventory into the runtime", async () => {
  const root=await mkdtemp(path.join(tmpdir(),"uapt-runtime-symlink-"));
  try {
    const history=path.join(root,"data/public-releases/history"),target=path.join(root,"runtime");
    await mkdir(history,{recursive:true});await mkdir(target);await mkdir(path.join(root,".local"));
    await writeFile(path.join(target,"keep"),"previous complete package");
    await writeFile(path.join(root,"data/public-releases/current.json"),JSON.stringify({schemaVersion:"uapt-public-release-manifest-v1",candidateOnly:false,includeStagedArtifactDirectories:[]}));
    await writeFile(path.join(root,".local/secrets.json"),JSON.stringify({private:"do-not-copy"}));
    await symlink(path.join(root,".local/secrets.json"),path.join(history,"private.json"));
    await assert.rejects(prepareWebRuntimeData({repoRoot:root,targetRoot:target}),/manifest is a symlink/);
    assert.equal(await readFile(path.join(target,"keep"),"utf8"),"previous complete package");
  } finally {await rm(root,{recursive:true,force:true});}
});
