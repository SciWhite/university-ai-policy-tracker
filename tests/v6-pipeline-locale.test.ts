import test from "node:test";
import assert from "node:assert/strict";
import { pagesZhProblems, zhCoverageProblems } from "../scripts/v6-pipeline/locale-gate";

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
    tools: [{ rawToolName: "Microsoft Copilot" }],
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
