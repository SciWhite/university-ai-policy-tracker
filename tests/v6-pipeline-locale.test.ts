import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pagesZhProblems, releaseZhReadingLookups, zhCoverageProblems } from "../scripts/v6-pipeline/locale-gate";

const KEYS = ["coursework", "exams"];
function view(overrides: Record<string, unknown> = {}) {
  const labels: Record<string, { en: string; zh: string }> = {};
  const summaries: Record<string, { en: string; zh: string }> = {};
  for (const k of KEYS) {
    labels[k] = { en: "Coursework", zh: "课程作业" };
    labels[`${k}:status`] = { en: "Allowed", zh: "允许" };
    summaries[k] = { en: "Summary", zh: "摘要" };
  }
  return {
    school: { topics: KEYS.map(key => ({ key })), additionalTopics: [] },
    topicLabels: labels, topicSummaries: summaries, topicScopes: structuredClone(summaries),
    hero: { title: { en: "Using AI", zh: "AI 使用指引" }, scope: { en: "Scope", zh: "范围" } },
    studentActions: {
      do: [{ en: "Ask first", zh: "先询问", claimIds: ["coursework:a"] }],
      dont: [{ en: "Do not paste data", zh: "不要粘贴数据", claimIds: ["privacy:b"] }],
      procedures: { appeal: ["academic_integrity:c"] },
      claims: { "coursework:a": { summaryZh: "课程规定" }, "privacy:b": { summaryZh: "隐私规定" }, "academic_integrity:c": { summaryZh: "申诉" } },
    },
    tools: [{ rawToolName: "Microsoft Copilot", description: "Licensed for students" }],
    toolDisplayCopy: { zh: { "Microsoft Copilot": { description: "学校提供" } } },
    ...overrides,
  };
}

test("a fully translated view passes", () => {
  assert.deepEqual(zhCoverageProblems(view()), []);
});

test("an evidence row linked from an action or procedure without summaryZh fails (batches 1-2)", () => {
  const v = view();
  delete (v.studentActions.claims as Record<string, { summaryZh?: string }>)["academic_integrity:c"].summaryZh;
  (v.studentActions.claims as Record<string, { summaryZh?: string }>)["privacy:b"].summaryZh = "Do not paste data";
  assert.deepEqual(zhCoverageProblems(v), [
    "evidence row without summaryZh (English on /zh/): academic_integrity:c",
    "evidence row without summaryZh (English on /zh/): privacy:b",
  ]);
});

test("missing topic, hero, action and tool Chinese are each reported", () => {
  const v = view({ hero: { title: { en: "x", zh: "" }, scope: { en: "y", zh: "范围" } }, toolDisplayCopy: { zh: {} } });
  v.topicSummaries.exams.zh = "";
  v.studentActions.do[0].zh = "";
  assert.deepEqual(zhCoverageProblems(v).sort(), ["hero.title.zh", "studentActions.do[0].zh", "toolDisplayCopy.zh: Microsoft Copilot", "topicSummaries.exams.zh"].sort());
});

test("pages check exempts only declared English-only schools", () => {
  const bad = view(); bad.hero.title.zh = "";
  const pages = { slugs: ["a", "b", "c"], englishOnlySlugs: ["b"], locales: { zh: { views: { a: view(), b: bad, c: bad } } } };
  assert.deepEqual(Object.keys(pagesZhProblems(pages)), ["c"]);
  assert.deepEqual(pagesZhProblems(pages, ["a"]), {});
});

test("the hero is not required where the page never renders it (v6_presentation_integration)", () => {
  const v = view({ hero: { title: { en: "Alpha University", zh: "Alpha University" }, scope: { en: "", zh: "" } } });
  assert.deepEqual(zhCoverageProblems(v).sort(), ["hero.scope.zh", "hero.title.zh"]);
  assert.deepEqual(zhCoverageProblems({ ...v, publication: { kind: "v6_presentation_integration" } }), []);
  assert.deepEqual(zhCoverageProblems({ ...v, publication: { kind: "scoped_record_correction" } }).sort(), ["hero.scope.zh", "hero.title.zh"]);
});

test("a topic without a view entry is covered by a Chinese school topic text, never by English", () => {
  const v = view();
  delete (v.topicScopes as Record<string, unknown>).exams;
  v.school.topics[1] = { key: "exams", scope: "全校考核；以任课教师规则为准。" } as never;
  assert.deepEqual(zhCoverageProblems(v), []);
  v.school.topics[1] = { key: "exams", scope: "University-wide assessment" } as never;
  assert.deepEqual(zhCoverageProblems(v), ["topicScopes.exams.zh"]);
});

test("tools: no prose needs no copy; historical_discovery ignores toolDisplayCopy and needs Chinese prose", () => {
  const prose = { rawToolName: "Microsoft Copilot", description: "Licensed for students", howToObtain: "Sign in", costToUser: "Free" };
  assert.deepEqual(zhCoverageProblems(view({ tools: [{ rawToolName: "Microsoft Copilot" }], toolDisplayCopy: { zh: {} } })), []);
  assert.deepEqual(zhCoverageProblems(view({ tools: [prose], toolDisplayCopy: { zh: {} } })), ["toolDisplayCopy.zh: Microsoft Copilot"]);
  const historical = view({ tools: [prose], toolDisplayMode: "historical_discovery" });
  assert.deepEqual(zhCoverageProblems(historical), ["tool discovery prose without Chinese (historical_discovery): Microsoft Copilot"]);
  const all = new Set([prose.description, prose.howToObtain, prose.costToUser]);
  assert.deepEqual(zhCoverageProblems(historical, s => all.has(s)), []);
  assert.deepEqual(zhCoverageProblems(historical, s => s === prose.description), ["tool discovery prose without Chinese (historical_discovery): Microsoft Copilot"]);
});

test("a reading-package translation covers English rows; without one the strict check is unchanged", () => {
  const v = view({ tools: [{ rawToolName: "Microsoft Copilot", description: "Licensed for students" }], toolDisplayCopy: { zh: {} } });
  const claims = v.studentActions.claims as Record<string, { text?: string; summaryZh?: string }>;
  claims["privacy:b"] = { text: "Do not upload personal data." };
  v.studentActions.do[0] = { en: "Ask first", zh: "", claimIds: ["coursework:a"] };
  const strict = ["evidence row without summaryZh (English on /zh/): privacy:b", "studentActions.do[0].zh", "toolDisplayCopy.zh: Microsoft Copilot"];
  assert.deepEqual(zhCoverageProblems(v).sort(), strict.sort());
  const accepted = new Set(["Do not upload personal data.", "Ask first", "Licensed for students"]);
  assert.deepEqual(zhCoverageProblems(v, s => accepted.has(s)), []);
  assert.deepEqual(zhCoverageProblems(v, s => s === "Ask first").sort(), strict.filter(p => !p.startsWith("studentActions")).sort());
});

test("pages audit lists slugs without any V6 page view; assemble (default) still fails them", () => {
  const pages = { slugs: ["a", "v5", "nozh"], locales: { en: { views: { a: view(), nozh: view() } }, zh: { views: { a: view() } } } };
  assert.deepEqual(pagesZhProblems(pages), { v5: ["no zh view"], nozh: ["no zh view"] });
  const listed: string[] = [];
  assert.deepEqual(pagesZhProblems(pages, undefined, { listSlugsWithoutViews: listed }), { nozh: ["no zh view"] });
  assert.deepEqual(listed, ["v5"]);
});

test("release reading lookups: hash-checked files, record basis, pinned record deltas", () => {
  const root = mkdtempSync(path.join(tmpdir(), "zh-reading-"));
  try {
    const sha = (v: string) => createHash("sha256").update(v).digest("hex");
    const put = (rel: string, value: unknown) => { const raw = JSON.stringify(value); mkdirSync(path.dirname(path.join(root, "translations", rel)), { recursive: true }); writeFileSync(path.join(root, "translations", rel), raw); return { path: rel, sha256: sha(raw) }; };
    const unit = (source: string, translation: string) => ({ [sha(source)]: { source, translation } });
    const basis = (n: string) => ({ recordSha256: n.repeat(64), originalEvidenceSha256: "e".repeat(64) });
    const shared = put("zh/_shared.json", { strings: unit("Shared label", "共享标签") });
    const a = put("zh/a.json", { slug: "a", ...basis("1"), strings: unit("Alpha row", "阿尔法行") });
    const b = put("zh/b.json", { slug: "b", ...basis("2"), strings: unit("Beta row", "贝塔行") });
    const bDelta = put("deltas/zh/b.json", { slug: "b", strings: unit("Beta new row", "贝塔新行") });
    const selection = { publicationApproved: true, shared: { zh: shared }, schools: { a: { zh: a }, b: { zh: b }, c: { zh: a } },
      supplemental: { recordDeltas: [{ receipt: { path: "deltas/review.json", sha256: "f".repeat(64) }, schools: { b: { parent: basis("2"), record: basis("3"), locales: { zh: bDelta } } } }] } };
    writeFileSync(path.join(root, "translations/current.json"), JSON.stringify(put("selection.json", selection)));
    const records = { a: "1".repeat(64), b: "3".repeat(64), c: "1".repeat(64), d: "4".repeat(64) };
    const unpinned = releaseZhReadingLookups(root, records);
    assert.deepEqual([unpinned.info.basisMismatch.sort(), unpinned.info.missing], [["b", "c"], ["d"]]);
    assert.equal(unpinned.lookups.a("Alpha row"), true);
    assert.equal(unpinned.lookups.a("Shared label"), true);
    assert.equal(unpinned.lookups.a("Beta row"), false);
    const pinned = releaseZhReadingLookups(root, records, ["f".repeat(64)]);
    assert.deepEqual(pinned.info.viaRecordDelta, ["b"]);
    assert.equal(pinned.lookups.b("Beta new row") && pinned.lookups.b("Beta row"), true);
    writeFileSync(path.join(root, "translations/zh/a.json"), "{}");
    assert.throws(() => releaseZhReadingLookups(root, records), /hash mismatch/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
