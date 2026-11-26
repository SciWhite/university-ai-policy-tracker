import test from "node:test";
import assert from "node:assert/strict";
import { applyClaims, checkDecisions, updateView, type CorrectionDecisions, type PageContext } from "../scripts/content-release/correction-apply";

/** Wording-only corrections (V6 quality recheck, 2026-11-26): keep quotes, move the change date, keep curated tool cards. */
const old = { id: "c1", entitySlug: "x", entityType: "university", claimType: "ai_tool_treatment", claimText: "Tool A is listed. Derived availability: allowed. Derived endorsement type: officially endorsed.",
  confidence: 0.9, reviewState: "agent_reviewed", lastCheckedAt: "2026-10-01T00:00:00Z", lastChangedAt: "2026-10-01T00:00:00Z",
  evidence: [{ evidenceSnippet: "Tool A", sourceUrl: "https://x.example/a", retrievedAt: "2026-09-30T00:00:00Z" }, { evidenceSnippet: "Tool A again", sourceUrl: "https://x.example/b" }] };
const decisions = (claim: Record<string, unknown>): CorrectionDecisions => ({ schemaVersion: "uapt-content-correction-v1", revision: "v6-test-wording", author: "a",
  changeSummary: { en: "e", zh: "z" }, approval: { publication: "LOCAL TEST ONLY" }, captures: {}, schools: { x: { claims: [claim as never] } } } as CorrectionDecisions);

test("a wording-only correction keeps every quote, moves lastChangedAt and keeps a checked date", () => {
  const summary = { claims: [structuredClone(old)], officialSources: [], summary: "s", entity: {}, lastCheckedAt: "2026-09-01T00:00:00Z" };
  const d = decisions({ action: "correct", id: "c1", claimType: "ai_tool_treatment", claimText: "Tool A is listed.", confidence: 0.9, evidence: [], keepAllEvidence: true });
  assert.deepEqual(checkDecisions(d), []);
  applyClaims(d, "x", summary, "2026-11-26T00:00:00.000Z");
  const next = summary.claims[0];
  assert.equal(next.claimText, "Tool A is listed.");
  assert.deepEqual(next.evidence, old.evidence, "quotes unchanged");
  assert.equal(next.lastChangedAt, "2026-11-26T00:00:00.000Z");
  assert.equal(next.lastCheckedAt, "2026-09-30T00:00:00Z", "checked date = newest capture time");
  assert.equal(summary.lastCheckedAt, "2026-09-30T00:00:00Z", "record not checked before its evidence");
  const noTimes = { ...structuredClone(old), evidence: [{ evidenceSnippet: "Tool A", sourceUrl: "https://x.example/a" }] };
  const s2 = { claims: [noTimes], officialSources: [], summary: "s", entity: {} };
  applyClaims(d, "x", s2, "2026-11-26T00:00:00.000Z");
  assert.equal(s2.claims[0].lastCheckedAt, old.lastCheckedAt, "evidence without capture times keeps the checked date");
  assert.notEqual(checkDecisions(decisions({ action: "correct", id: "c1", claimType: "t", claimText: "x", confidence: 1, keepAllEvidence: true })).length, 0, "missing evidence array is reported, not thrown");
});

test("tool cards: kept unless a tool decision names them; an empty view gets the record's tools", () => {
  const recordTools = [{ rawToolName: "A", description: "record A" }, { rawToolName: "B", description: "record B" }];
  const ctx = (touched: string[]): PageContext => ({ slug: "x", revision: "r", summary: { claims: [], officialSources: [] }, tools: recordTools, changed: new Set(), added: [], renamed: {}, ps: {},
    toolsTouched: touched.length > 0, touchedTools: new Set(touched) });
  const view = () => ({ tools: [{ rawToolName: "A", description: "curated A", relationship: "listed" }], school: {}, claims: [] });
  const kept = view(); updateView(ctx([]), kept, {}, "f");
  assert.deepEqual(kept.tools, view().tools);
  const touched = view(); updateView(ctx(["A"]), touched, {}, "f");
  assert.deepEqual(touched.tools, [{ rawToolName: "A", description: "record A", relationship: "listed" }]);
  const empty = { tools: [], school: {}, claims: [] }; updateView(ctx([]), empty, {}, "f");
  assert.equal(empty.tools.length, 2);
});
