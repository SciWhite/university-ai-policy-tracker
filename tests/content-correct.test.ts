import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { checkDecisions, jsha, resolvePreviousRevision, resolvePublishedAt, type CorrectionDecisions } from "../scripts/content-release/correction-apply";
import { isGenericCountSummary, lintCorrection, placeholderScope, resolveLint, unsupportedSentences, zhFactGaps } from "../scripts/content-release/correction-lint";
import { checkReview, finalizeCorrection, MergedTree, prepareCorrection } from "../scripts/content-release/correct";
import { checkRecordRevisions, staleCatalogRecords, staleLocaleIndexEntries } from "../scripts/content-release/validate";
import { resetContentRuntimeForTests } from "../apps/web/lib/content-runtime";

const repoRoot = process.cwd();
const HASH = "bbac849b9594a8b457ebd0c8224ec47bebaf0c91521ec2c599bf202c7faeff14";
const URL_ = "https://poorvucenter.yale.edu/teaching/teaching-resource-library/ai-guidance-for-teachers/ai-course-assignment-design/academic";

/** A local-only test correction of one published V6 school (never published). */
function decisions(overrides: Partial<CorrectionDecisions> = {}): CorrectionDecisions {
  return {
    schemaVersion: "uapt-content-correction-v1", revision: "v6-test-correction-yale", author: "author-run",
    changeSummary: { en: "Test correction of one Yale claim (local test only).", zh: "测试更正一项耶鲁声明（仅本地测试）。" },
    approval: { publication: "LOCAL TEST ONLY - never published" },
    captures: { poorvu: { sourceUrl: URL_, snapshotHash: HASH, retrievedAt: "2026-11-01T10:00:00.000Z", citationTitle: "Academic Integrity and Detection", publisher: "Yale University", sourceType: "official_guidance", verification: "test binding" } },
    schools: { "yale-university": { claims: [
      { action: "correct", id: "yale-claim-7", claimType: "academic_integrity", confidence: 0.97, claimValue: "ai_text_without_attribution_violation",
        claimText: "Yale's Poorvu Center guidance says that inserting AI-generated text into an assignment without proper attribution violates academic integrity.",
        evidence: [{ sourceUrl: URL_, snapshotHash: HASH, quote: "Inserting AI-generated text into an assignment without proper attribution is a violation of academic integrity", location: "Academic Integrity and Detection" }] },
      { action: "add", id: "yale-claim-test-unauthorized-use", claimType: "academic_integrity", confidence: 0.9, claimValue: "unauthorized_ai_use", insertAfter: "yale-claim-7", topics: ["disclosure"],
        claimText: "Yale's Poorvu Center guidance adds that using AI tools in a way the instructor did not authorize may also be an academic integrity violation.",
        evidence: [{ capture: "poorvu", quote: "using AI tools in a manner that was not authorized by your instructor may also be co", location: "Academic Integrity and Detection" }] }
    ] } },
    ...overrides
  };
}

test("decisions are checked before anything is built", () => {
  assert.deepEqual(checkDecisions(decisions()), []);
  const bad = decisions({ captures: {} });
  assert.ok(checkDecisions(bad).some(p => /no capture declared/.test(p)));
  const noApproval = { ...decisions(), approval: { publication: "" } };
  assert.ok(checkDecisions(noApproval).some(p => /approval.publication/.test(p)));
  const noEvidence = decisions(); noEvidence.schools["yale-university"].claims[0].evidence = [];
  assert.ok(checkDecisions(noEvidence).some(p => /evidence quotes are required/.test(p)));
});

test("publishedAt defaults to build time and is never in the future or before the parent", () => {
  const now = new Date("2026-11-06T09:00:00.000Z");
  assert.equal(resolvePublishedAt(undefined, now), now.toISOString());
  assert.equal(resolvePublishedAt("2026-11-06T08:00:00Z", now), "2026-11-06T08:00:00.000Z");
  assert.throws(() => resolvePublishedAt("2026-11-06T09:00:01Z", now), /in the future/);
  assert.throws(() => resolvePublishedAt("2026-10-01T00:00:00Z", now, "2026-10-28T00:00:00Z"), /before the parent revision/);
});

test("previousRevisionId must read back the parent record", () => {
  const parent = { entity: { slug: "cmu" }, claims: [] };
  const at = (revision: string) => revision === "v6-parent" ? parent : revision === "v6-other" ? { ...parent, claims: [{ id: "x" }] } : undefined;
  // CMU and Edinburgh pinned a dataset release id; the parent revision holds the identical record.
  assert.equal(resolvePreviousRevision("cmu", ["public-release-20260924-002", "v6-parent"], jsha(parent), at), "v6-parent");
  assert.equal(resolvePreviousRevision("cmu", ["v6-parent"], jsha(parent), at), "v6-parent");
  assert.throws(() => resolvePreviousRevision("cmu", ["v6-other", "public-release-x"], jsha(parent), at), /no readable V6 revision/);
});

test("lint: generic count summaries, zh fact gaps, placeholders and unsupported sentences", () => {
  const uq = "The University of Queensland: 16 current source-backed claims and 10 official source attributions, with course, assessment, research, data and institutional-tool scopes distinguished. The institution audit remains PARTIAL; held decisions, remaining coverage gaps and source representation limits are retained. No public student snapshot is approved by this update.";
  assert.equal(isGenericCountSummary(uq, "The University of Queensland"), true);
  assert.equal(isGenericCountSummary("Stanford's BCA guidance adopted on October 15, 2026 sets a default course AI policy: practice and surface-level editing are allowed without disclosure; deliverables are not.", "Stanford University"), false);
  assert.deepEqual(zhFactGaps("ChatGPT Edu Plus is available to students from 1 March 2027.", "学生自 2027 年 3 月 1 日起可使用 ChatGPT Edu Plus。"), []);
  const gaps = zhFactGaps("ChatGPT Edu Plus is available to students from 1 March 2027 under the UQ licence, with data kept in Australia and no training on prompts.", "学生可以使用。");
  assert.ok(gaps.some(g => /numbers missing/.test(g)) && gaps.some(g => /names missing/.test(g)) && gaps.some(g => /much shorter/.test(g)));
  assert.match(placeholderScope("TBD", "en") ?? "", /placeholder/);
  assert.match(placeholderScope("Applies to coursework in all faculties.", "zh", "Applies to coursework in all faculties.") ?? "", /no Chinese text|en text/);
  assert.equal(placeholderScope("适用于所有学院的课程作业，以课程说明为准。", "zh", "Applies to coursework in all faculties."), undefined);
  const evidence = "Assessment tasks are classified as secure or open from Semester 2, 2026. Secure assessment counts for at least 50% of the course.";
  assert.deepEqual(unsupportedSentences("UQ classifies tasks as secure or open from Semester 2, 2026.", evidence, ["UQ"]), []);
  assert.equal(unsupportedSentences("UQ classifies tasks as secure or open from Semester 2, 2026.", evidence).length, 1);
  assert.equal(unsupportedSentences("Secure assessment counts for at least 60% of the course.", evidence).length, 1);
});

test("lint: no claim left in no topic, checked dates follow evidence, acknowledgements only for review findings", () => {
  const claim = (id: string, checked: string, retrieved: string) => ({ id, claimText: `Claim ${id}`, lastCheckedAt: checked, evidence: [{ retrievedAt: retrieved, evidenceSnippet: "q" }] });
  const school = (ids: string[]) => ({ slug: "s", checkedAt: "2026-11-01T00:00:00Z", topics: [{ key: "coursework", title: "Coursework", claims: ids.map(id => ({ id, text: `Claim ${id}`, evidence: [] })) }], additionalTopics: [] });
  const pages = (ids: string[]) => ({ locales: { en: { schools: [school(ids)], views: {}, entities: {} } } });
  const records = (claims: unknown[]) => ({ summaries: [{ entity: { slug: "s", name: "S" }, summary: "", claims, lastCheckedAt: "2026-11-01T00:00:00Z" }] });
  const findings = lintCorrection({
    slugs: ["s"], touched: { s: ["a", "new"] }, presentation: { s: {} },
    parent: { records: records([claim("a", "2026-10-01T00:00:00Z", "2026-10-01T00:00:00Z"), claim("b", "2026-10-01T00:00:00Z", "2026-10-01T00:00:00Z")]), pages: pages(["a", "b"]) },
    next: { records: records([claim("a", "2026-10-01T00:00:00Z", "2026-11-02T00:00:00Z"), claim("b", "2026-10-01T00:00:00Z", "2026-10-01T00:00:00Z"), claim("new", "2026-11-01T00:00:00Z", "2026-11-01T00:00:00Z")]), pages: pages(["a"]) }
  });
  const codes = findings.map(f => `${f.code}:${f.target}`);
  assert.ok(codes.includes("claim-without-topic:claims/new"), "an added claim needs a topic");
  assert.ok(codes.includes("claim-without-topic:claims/b"), "a claim that had a topic keeps one");
  assert.ok(codes.includes("checked-at-before-evidence:claims/a"));
  assert.ok(codes.includes("checked-at-before-evidence:record/lastCheckedAt"));
  const review = { code: "zh-missing-facts", severity: "review" as const, slug: "s", target: "topicSummaries/exams", message: "numbers missing in zh: 50" };
  const resolved = resolveLint([...findings, review], [
    { code: "zh-missing-facts", slug: "s", target: "topicSummaries/exams", reason: "zh states the half as 一半; reviewed" },
    { code: "claim-without-topic", slug: "s", target: "claims/new", reason: "hard findings cannot be waived" }
  ]);
  assert.equal(resolved.acknowledged.length, 1);
  assert.ok(resolved.blocking.some(f => f.target === "claims/new"));
});

test("the review binds the exact candidate and is not the author's", () => {
  const report = { revision: "v6-x", author: "author-run", preparedAt: "2026-11-06T08:00:00.000Z", candidateSha256: { records: "1", pages: "2", history: "3" } };
  const review = { schemaVersion: "uapt-content-correction-review-v1", revision: "v6-x", candidateSha256: { records: "1", pages: "2", history: "3" }, decision: "accepted", reviewer: "reviewer-run", reviewedAt: "2026-11-06T08:30:00.000Z", scope: "presentation_only" };
  const now = new Date("2026-11-06T09:00:00.000Z");
  assert.deepEqual(checkReview(review, report, now), []);
  assert.ok(checkReview({ ...review, reviewer: "author-run" }, report, now).some(p => /must not be the author/.test(p)));
  assert.ok(checkReview({ ...review, candidateSha256: { ...review.candidateSha256, pages: "9" } }, report, now).some(p => /exact candidate/.test(p)));
  assert.ok(checkReview({ ...review, reviewedAt: "2026-11-06T10:00:00.000Z" }, report, now).some(p => /future/.test(p)));
  assert.ok(checkReview({ ...review, decision: "pending" }, report, now).some(p => /not accepted/.test(p)));
});

test("validator: stale MCP catalog and locale-index entries are refused", () => {
  const pins = { yale: "new", mit: "same" }, parentPins = { yale: "old", mit: "same" };
  assert.deepEqual(staleCatalogRecords([{ summary: { entity: { slug: "mit" } }, recordSha256: "same" }], pins), []);
  assert.match(staleCatalogRecords([{ summary: { entity: { slug: "yale" } }, recordSha256: "old" }], pins)[0], /stale for yale/);
  assert.match(staleLocaleIndexEntries({ schools: { yale: { recordSha256: "old" }, mit: { recordSha256: "same" } } }, pins, parentPins)[0], /still binds yale/);
  assert.deepEqual(staleLocaleIndexEntries({ schools: { yale: { recordSha256: "new" } } }, pins, parentPins), []);
});

test("content:correct prepares and finalizes a real one-school correction as a content overlay", { timeout: 300_000 }, async () => {
  const work = mkdtempSync(path.join(tmpdir(), "uapt-content-correct-"));
  const saved = process.env.UAPT_CONTENT_ROOT;
  delete process.env.UAPT_CONTENT_ROOT;
  try {
    const file = path.join(work, "decisions.json");
    // A future publishedAt is refused before anything is written.
    writeFileSync(file, JSON.stringify(decisions({ publishedAt: "2099-01-01T00:00:00.000Z" })));
    await assert.rejects(prepareCorrection({ decisionsFile: file, out: path.join(work, "future"), source: { root: repoRoot } }), /in the future/);
    // An added claim shown in no topic is blocked by lint; the report and review packet are still written.
    const orphan = decisions(); delete orphan.schools["yale-university"].claims[1].topics;
    writeFileSync(file, JSON.stringify(orphan));
    const blocked = await prepareCorrection({ decisionsFile: file, out: path.join(work, "orphan"), source: { root: repoRoot } });
    assert.equal(blocked.ready, false);
    assert.ok(JSON.parse(readFileSync(path.join(work, "orphan/prepare-report.json"), "utf8")).lint.blocking.some((f: { code: string }) => f.code === "claim-without-topic"));
    await assert.rejects(finalizeCorrection({ candidate: path.join(work, "orphan"), reviewFile: file, out: path.join(work, "orphan-final") }), /did not pass prepare/);

    writeFileSync(file, JSON.stringify(decisions()));
    const prepared = await prepareCorrection({ decisionsFile: file, out: path.join(work, "prepare"), source: { root: repoRoot } });
    assert.equal(prepared.ready, true, JSON.stringify(prepared));
    const report = JSON.parse(readFileSync(path.join(work, "prepare/prepare-report.json"), "utf8"));
    assert.deepEqual(report.schools["yale-university"].addedClaimIds, ["yale-claim-test-unauthorized-use"]);
    assert.match(report.schools["yale-university"].previousRevisionId, /^qs|^v6-/);
    const template = JSON.parse(readFileSync(path.join(work, "prepare/review-template.json"), "utf8"));
    writeFileSync(path.join(work, "review.json"), JSON.stringify({ ...template, decision: "accepted", reviewer: "reviewer-run", reviewedAt: new Date().toISOString() }));
    const policy = path.join(work, "policy.json");
    writeFileSync(policy, JSON.stringify({ schemaVersion: "uapt-university-locale-index-policy-v1", sourceSha256: "1".repeat(64), globalCitationExceptions: {},
      schools: { "yale-university": { recordSha256: report.schools["yale-university"].previousRecordSha256, locales: ["en", "zh"], evidence: [] } } }));
    const finalized = await finalizeCorrection({ candidate: path.join(work, "prepare"), reviewFile: path.join(work, "review.json"), out: path.join(work, "final"), localeIndexPolicy: policy });
    const out = path.join(work, "final");
    for (const rel of ["overlay/data/public-v6-records/current.json", "overlay/data/public-change-history/current.json", "overlay/data/public-v6-change-overviews/current.json", "mcp/catalog.json", "decisions.json", "content-build.sh.txt"]) assert.ok(existsSync(path.join(out, rel)), rel);
    const finalReport = JSON.parse(readFileSync(path.join(out, "finalize-report.json"), "utf8"));
    const newRecord = finalReport.events[0] ? report.schools["yale-university"].recordSha256 : "";
    assert.equal(JSON.parse(readFileSync(path.join(out, "locale-index-policy.json"), "utf8")).schools["yale-university"].recordSha256, newRecord, "the locale-index entry moves with the record");
    assert.deepEqual(JSON.parse(readFileSync(path.join(out, "decisions.json"), "utf8")).correctedClaimIds, { "yale-university": ["yale-claim-7"] });
    assert.equal(finalized.revision, "v6-test-correction-yale");
    // The validator's revision checks pass on the finalized tree and catch a release built before publication.
    const tree = MergedTree.create(repoRoot, path.join(work, "tree"), path.join(out, "overlay"));
    try {
      tree.select();
      assert.deepEqual(checkRecordRevisions({ createdAt: new Date().toISOString() }), []);
      assert.ok(checkRecordRevisions({ createdAt: "2026-01-01T00:00:00.000Z" }).some(e => /after the release was built/.test(e)));
    } finally { tree.remove(); }
  } finally {
    if (saved !== undefined) process.env.UAPT_CONTENT_ROOT = saved;
    resetContentRuntimeForTests();
    rmSync(work, { recursive: true, force: true });
  }
});
