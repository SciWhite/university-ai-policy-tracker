import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { READING_LOCALES } from "../apps/web/lib/language-catalog";
import { CONTENT_LOCALES } from "../apps/web/lib/content-locales";
import { buildBundle, changedUrls, deltaObjects, isrExpiryRequest } from "../scripts/content-release/bundle";

const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

test("ISR expiry covers every reading locale of each changed school plus the content-language change listings", () => {
  const request = isrExpiryRequest("c-new", ["alpha-university", "beta-university"], "v6-rev");
  assert.deepEqual(request.tags, ["school:alpha-university", "school:beta-university", "sitemap", "changes", "changes:v6-rev"]);
  assert.equal(request.paths.length, 2 + (CONTENT_LOCALES.length - 1) + 2 * (1 + READING_LOCALES.length));
  assert.ok(request.paths.includes("/zh/changes"));
  assert.ok(!request.paths.includes("/fr/changes"), "/<uiLocale>/changes is a constant 301");
  assert.ok(request.paths.includes("/universities/alpha-university"));
  assert.ok(request.paths.includes("/zh-Hant/universities/beta-university"));
  assert.ok(request.paths.includes("/sitemaps/changes.xml"));
  assert.ok(!request.paths.includes("/en/universities/alpha-university"), "English is unprefixed");
});

test("changed URLs put the en/zh readback pages first and add the API records", () => {
  const request = isrExpiryRequest("c-new", ["alpha-university"], "v6-rev");
  const urls = changedUrls("c-new", ["alpha-university"], request);
  assert.deepEqual(urls.paths.slice(0, 2), ["/universities/alpha-university", "/zh/universities/alpha-university"]);
  assert.equal(urls.paths.at(-1), "/api/public/v1/universities/alpha-university.json");
  assert.equal(new Set(urls.paths).size, urls.paths.length);
});

test("delta objects are the objects the parent does not have", () => {
  const delta = deltaObjects({ files: [["a", "1".repeat(64), 3], ["b", "2".repeat(64), 4]] }, { files: [["a", "1".repeat(64), 3]] });
  assert.deepEqual([...delta], [["2".repeat(64), 4]]);
});

test("buildBundle writes the delta, a dehydrated sync package and a bound bundle.json", () => {
  const root = mkdtempSync(path.join(tmpdir(), "uapt-bundle-"));
  try {
    const store = path.join(root, "content");
    const put = (bytes: Buffer) => { const d = sha(bytes); mkdirSync(path.join(store, "objects", d.slice(0, 2)), { recursive: true }); writeFileSync(path.join(store, "objects", d.slice(0, 2), d), bytes); return d; };
    const shared = Buffer.from('{"x":1}\n'), old = Buffer.from('{"a":1}\n'), next = Buffer.from('{"a":2}\n');
    const parent = { schemaVersion: "uapt-content-release-v1", contentId: "c-parent", parentContentId: null, requiredSyncContract: "2.1.0",
      files: [["data/a.json", put(old), old.length], ["data/public-change-history/objects/x.json", put(shared), shared.length]] };
    const manifest = { ...parent, contentId: "c-new", parentContentId: "c-parent", files: [["data/a.json", put(next), next.length], parent.files[1]] };
    for (const m of [parent, manifest]) { mkdirSync(path.join(store, "releases", m.contentId), { recursive: true }); writeFileSync(path.join(store, "releases", m.contentId, "manifest.json"), JSON.stringify(m)); }
    const manifestBytes = readFileSync(path.join(store, "releases/c-new/manifest.json"));
    const syncDir = path.join(root, "sync");
    mkdirSync(path.join(syncDir, "proof/public-change-history/objects"), { recursive: true });
    writeFileSync(path.join(syncDir, "basis.json"), manifestBytes);
    writeFileSync(path.join(syncDir, "event.json"), JSON.stringify({ basisSha256: sha(manifestBytes), syncContractVersion: "2.1.0", phase: "candidate" }));
    writeFileSync(path.join(syncDir, "proof/public-change-history/objects/x.json"), shared);
    const out = path.join(root, "op");
    const result = buildBundle({ contentRoot: store, contentId: "c-new", opId: "content-new", syncDir, schools: ["alpha-university"], changesRevision: "v6-rev",
      authorization: 'User: "publish"', holdReason: "test", out });
    assert.equal(result.objects, 1);
    const bundleRaw = readFileSync(path.join(out, "bundle.json"));
    assert.equal(result.bundleSha256, sha(bundleRaw));
    const bundle = JSON.parse(bundleRaw.toString());
    assert.equal(bundle.manifestSha256, sha(manifestBytes));
    assert.equal(bundle.parentManifestSha256, sha(readFileSync(path.join(store, "releases/c-parent/manifest.json"))));
    assert.ok(existsSync(path.join(out, "objects", sha(next).slice(0, 2), sha(next))));
    assert.ok(!existsSync(path.join(out, "objects", sha(shared).slice(0, 2), sha(shared))), "unchanged objects stay on the host");
    assert.ok(!existsSync(path.join(out, "sync/content-candidate/proof")), "proofs travel as a hash manifest");
    assert.ok(existsSync(path.join(syncDir, "proof/public-change-history/objects/x.json")), "the local sync package is untouched");
    const proof = JSON.parse(readFileSync(path.join(out, "sync/content-candidate/proof-manifest.json"), "utf8"));
    assert.deepEqual(proof.files, [["proof/public-change-history/objects/x.json", sha(shared), shared.length]]);
    assert.ok(statSync(path.join(out, "sync/content-candidate/basis.json")).nlink > 1, "hard links, no copies");
    assert.throws(() => buildBundle({ contentRoot: store, contentId: "c-new", opId: "content-new", syncDir, schools: ["alpha-university"], changesRevision: "v6-rev", authorization: "x", holdReason: "y", out }), /written once/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
