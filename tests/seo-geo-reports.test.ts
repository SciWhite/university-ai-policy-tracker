import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { loadSeoGeoReport } from "../apps/web/lib/seo-geo-reports";
const sha = (v: string) => createHash("sha256").update(v).digest("hex");

async function fixture() {
  const dir = await mkdtemp(path.join(tmpdir(), "uapt-seo-geo-"));
  const raw = { url: "https://eduaipolicy.org/universities/ucl", timestamp: "2026-10-28T12:00:00Z", score: 69, score_version: 2, error: null as string | null, checks: { meta_tags: { score: 11, max: 11, details: { canonical: "https://eduaipolicy.org/universities/ucl" } } }, recommendations: ["Untrusted <script>alert(1)</script>"] };
  const spec = { schemaVersion: "uapt-seo-geo-report-v1", runId: "baseline-1", tool: { name: "geo-optimizer", version: "4.19.8", rulesVersion: "2", sourceCommit: "a".repeat(40) }, completedAt: "2026-10-28T12:00:00Z", target: "public", device: "http", config: { path: "config.json", sha256: sha("{}") }, pages: [{ requestedUrl: raw.url, finalUrl: raw.url, locale: "en", template: "v6-bundle", codeSha: "b".repeat(40), content: { path: "page.html", sha256: sha("<html>actual</html>") }, raw: { path: "raw.json", sha256: "" }, issues: [] as unknown[] }] };
  await writeFile(path.join(dir, "config.json"), "{}");
  await writeFile(path.join(dir, "page.html"), "<html>actual</html>");
  async function save() {
    const value = JSON.stringify(raw);
    await writeFile(path.join(dir, "raw.json"), value);
    spec.pages[0].raw.sha256 = sha(value);
    await writeFile(path.join(dir, "geo.json"), JSON.stringify(spec));
  }
  return { dir, raw, spec, save, close: () => rm(dir, { recursive: true, force: true }) };
}
test("unconfigured, not-run, unknown-version and corrupt provenance remain distinct", async () => {
  assert.equal((await loadSeoGeoReport(undefined, "geo.json", "geo-optimizer")).state, "not_configured");
  const f = await fixture();
  try {
    assert.equal((await loadSeoGeoReport(f.dir, "geo.json", "geo-optimizer")).state, "not_run");
    await f.save();
    const report = await loadSeoGeoReport(f.dir, "geo.json", "geo-optimizer");
    assert.equal(report.state, "ready");
    assert.equal(report.pages[0].scores.readiness, 69);
    assert.equal(report.pages[0].recommendations[0], f.raw.recommendations[0]);
    assert(!JSON.stringify(report).includes(f.dir));
    f.spec.tool.rulesVersion = "999"; await f.save();
    assert.equal((await loadSeoGeoReport(f.dir, "geo.json", "geo-optimizer")).state, "unsupported_version");
    f.spec.tool.rulesVersion = "2"; await f.save();
    await writeFile(path.join(f.dir, "raw.json"), "{}");
    assert.equal((await loadSeoGeoReport(f.dir, "geo.json", "geo-optimizer")).state, "missing_provenance");
    await rm(path.join(f.dir, "raw.json"));
    assert.equal((await loadSeoGeoReport(f.dir, "geo.json", "geo-optimizer")).state, "missing_provenance");
  } finally { await f.close(); }
});
test("upstream retrieval failure never appears as a zero readiness score", async () => {
  const f = await fixture();
  try {
    f.raw.error = "HTTP 503"; f.raw.score = 0; await f.save();
    const report = await loadSeoGeoReport(f.dir, "geo.json", "geo-optimizer");
    assert.equal(report.pages[0].state, "failed");
    assert.deepEqual(report.pages[0].scores, {});
    assert.deepEqual(report.pages[0].checks, []);
    assert.deepEqual(report.pages[0].recommendations, []);
  } finally { await f.close(); }
});
test("artifacts cannot escape the private report root via traversal or symlinks", async () => {
  const f = await fixture();
  try {
    f.spec.pages[0].raw.path = "../raw.json"; await f.save();
    assert.equal((await loadSeoGeoReport(f.dir, "geo.json", "geo-optimizer")).state, "invalid_report");
    await symlink(path.join(f.dir, "../"), path.join(f.dir, "outside"));
    f.spec.pages[0].raw.path = "outside/raw.json"; await f.save();
    assert.notEqual((await loadSeoGeoReport(f.dir, "geo.json", "geo-optimizer")).state, "ready");
  } finally { await f.close(); }
});
test("URL mismatch, missing code basis and unverified fixes are rejected", async () => {
  const f = await fixture();
  try {
    f.spec.pages[0].requestedUrl += "-other"; await f.save();
    assert.equal((await loadSeoGeoReport(f.dir, "geo.json", "geo-optimizer")).state, "missing_provenance");
    f.spec.pages[0].requestedUrl = f.raw.url; f.spec.pages[0].codeSha = ""; await f.save();
    assert.equal((await loadSeoGeoReport(f.dir, "geo.json", "geo-optimizer")).state, "missing_provenance");
    f.spec.pages[0].codeSha = "b".repeat(40);
    f.spec.pages[0].issues = [{ checkId: "meta_tags", source: "apps/web/lib/university-policy-seo.ts", priority: "P2", status: "verified", evidence: "actual", expected: "expected" }]; await f.save();
    assert.equal((await loadSeoGeoReport(f.dir, "geo.json", "geo-optimizer")).state, "invalid_report");
  } finally { await f.close(); }
});
test("citation samples count provider sources, never answer-prose links", async () => {
  const f = await fixture();
  try {
    const raw = JSON.stringify({ promptId: "disclosure-ucl", locale: "en", model: "model-version", answeredAt: "2026-10-28T12:00:00Z", answer: "See https://eduaipolicy.org/universities/ucl", mention: true, providerSources: [] });
    await writeFile(path.join(f.dir, "answer.json"), raw);
    await writeFile(path.join(f.dir, "citations.json"), JSON.stringify({ ...f.spec, tool: { name: "elmo", version: "a8885744", rulesVersion: "uapt-citation-experiment-v1", sourceCommit: "a".repeat(40) }, pages: [], experiments: [{ raw: { path: "answer.json", sha256: sha(raw) } }] }));
    const report = await loadSeoGeoReport(f.dir, "citations.json", "elmo");
    assert.equal(report.state, "ready"); assert.equal(report.experiments.length, 1); assert.deepEqual(report.experiments[0].citedUrls, []);
  } finally { await f.close(); }
});
