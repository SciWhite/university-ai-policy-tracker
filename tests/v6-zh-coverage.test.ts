import assert from "node:assert/strict";
import test from "node:test";
import { zhCoverageProblems } from "../apps/web/lib/v6-zh-coverage";

const view = (): any => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
  publication: { kind: "v6_presentation_integration" },
  school: { topics: [{ key: "exams", summary: "Exams are covered.", scope: "All courses" }], additionalTopics: [] },
  topicLabels: { exams: { en: "Exams", zh: "考试" }, "exams:status": { en: "Required", zh: "必须" } },
  topicSummaries: { exams: { en: "Exams are covered.", zh: "考试适用本规定。" } },
  topicScopes: { exams: { en: "All courses", zh: "所有课程" } },
  studentActions: { scope: { en: "Students", zh: "学生" }, do: [{ en: "Ask", zh: "先询问任课教师", claimIds: ["c1"] }], dont: [], procedures: {}, claims: { c1: { text: "Ask first.", summaryZh: "应先询问。" } } },
  tools: [{ rawToolName: "Copilot", description: "Chat tool" }], toolDisplayCopy: { zh: { Copilot: { description: "使用 Microsoft Copilot 聊天" } } },
});

test("a view with its own Chinese passes", () => assert.deepEqual(zhCoverageProblems(view()), []));

const broken: Array<[string, (v: any) => void, string]> = [ // eslint-disable-line @typescript-eslint/no-explicit-any
  ["no topics", v => { v.school.topics = []; }, "no topics"],
  ["no studentActions", v => { delete v.studentActions; }, "no studentActions"],
  ["English guide scope", v => { v.studentActions.scope.zh = "Students"; }, "studentActions.scope.zh"],
  ["English tool copy", v => { v.toolDisplayCopy.zh.Copilot.description = "Chat tool"; }, "toolDisplayCopy.zh: Copilot"],
  ["English prose with one Chinese name", v => { v.topicSummaries.exams.zh = "Students of 清华 must always ask the course instructor before using any generative tool in an exam."; }, "topicSummaries.exams.zh"],
  ["English evidence row", v => { v.studentActions.claims.c1.summaryZh = "Ask first."; }, "evidence row without summaryZh (English on /zh/): c1"],
];
for (const [name, change, problem] of broken) test(`fails: ${name}`, () => { const v = view(); change(v); assert.deepEqual(zhCoverageProblems(v), [problem]); });

test("Chinese that quotes product and official names is Chinese", () => {
  for (const label of ["Copilot Chat 与 Cogniti", "NaviGator AI 与 UF Copilot", "Chat AI 与 TUD:AI", "Adobe Firefly 与 Photoshop", "ChatGPT、Claude、Gemini、Copilot、Perplexity、Grok、Midjourney 等工具",
    "适用六类：No Assistance、Simple Editing Assistance、Planning or Design Assistance、Assistance with Attribution 和 Not Applicable，改用 Can't Use AI、Can Use AI 和 Must Use AI 三种模式，具体许可由各项考核的说明决定。",
    "学生可向本科生院院长（Dean of the College）申诉，也可向普林斯顿大学社区理事会（Council of the Princeton University Community）的司法委员会申诉。"]) {
    const v = view(); v.topicLabels["exams:status"].zh = label; v.toolDisplayCopy.zh.Copilot.description = label;
    assert.deepEqual(zhCoverageProblems(v), [], label);
  }
});

test("an empty studentActions is not a guide", () => {
  const v = view(); v.studentActions = {};
  assert.ok(zhCoverageProblems(v).includes("no studentActions"));
});

test("a reading package may supply studentActions and scope", () => {
  const v = view(); delete v.studentActions;
  assert.deepEqual(zhCoverageProblems(v, () => true), []);
});
