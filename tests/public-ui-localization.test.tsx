import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AgentMethods } from "../apps/web/components/agent-methods";
import { OrganizationIdentity } from "../apps/web/components/organization-identity";
import { ToolRecordFields } from "../apps/web/components/tool-record-fields";
import { AnalysisStatusLabel } from "../apps/web/components/analysis-status-label";
import { SourceHealthLabel } from "../apps/web/components/source-health-label";
import { ChangeEventContent } from "../apps/web/components/change-event-content";
import { localizePublicSurfaceTree, publicSurfaceNodeTextSources } from "../apps/web/lib/surface-localization-server";
import { getProjectCopy } from "../apps/web/lib/project-copy";
import { changeCountsText } from "../apps/web/lib/change-counts-copy";
import { formatDiscoveryLocation } from "../apps/web/lib/discovery-location";
import { buildEventHistories } from "../apps/web/lib/change-events";
import { fixtureInput } from "./fixtures/change-event-fixture";
import type { UniversityToolRecord } from "@uapt/shared";
import { buildSeedPublicEntitySummary, seedUniversities } from "@uapt/shared";
import { createHash } from "node:crypto";
import { translatedDirectorySummary } from "../apps/web/lib/reading-directory-summaries";
import { readingSummaryBasis, type ReadingTranslationBundle } from "../apps/web/lib/reading-translations";

// The source tsconfig preserves JSX for Next. Node's source test runner uses
// the classic JSX transform when rendering those components directly.
Object.assign(globalThis, { React });

test("public server components receive reading copy without translating original tool fields", () => {
  const project = getProjectCopy("en");
  const record: UniversityToolRecord = {
    universitySlug: "school", universityName: "School", tool: "chatgpt", rawToolName: "ChatGPT",
    availability: "allowed", endorsementType: "third_party_service", reviewState: "agent_reviewed",
    description: "Original tool description", howToObtain: "Original access instructions",
    evidence: [{ sourceUrl: "https://school.example/tool", evidenceSnippet: "Original evidence", snapshotHash: "a".repeat(64), reviewState: "agent_reviewed" }]
  };
  const before = JSON.stringify(record);
  const uiText = {
    [project.agentsTitle]: "調査方法", [project.organizationTitle]: "運営者",
    About: "概要", Access: "アクセス", Review: "確認", Sources: "出典", Source: "出典",
    "Agent reviewed": "エージェント確認済み", Allowed: "許可", "Browser verified": "ブラウザー確認済み",
    "Original tool description": "THIS MUST NOT REPLACE THE ORIGINAL"
  };
  const page = localizePublicSurfaceTree(<main><AgentMethods locale="en" /><OrganizationIdentity locale="en" /><ToolRecordFields record={record} /><AnalysisStatusLabel prefix="" status="allowed" /><SourceHealthLabel status="browser_verified" /></main>, "ja", uiText);
  const html = renderToStaticMarkup(page);
  for (const label of ["調査方法", "運営者", "概要", "アクセス", "許可", "ブラウザー確認済み"]) assert(html.includes(label), label);
  assert(html.includes("Original tool description"));
  assert(!html.includes("THIS MUST NOT REPLACE THE ORIGINAL"));
  assert(html.includes('href="https://school.example/tool"'));
  assert.equal(JSON.stringify(record), before);
});

test("history labels and links localize while recorded old/new text remains intact", () => {
  const event = buildEventHistories(fixtureInput()).school.events[0];
  const oldText = event.items[0].oldText!;
  const newText = event.items[0].newText!;
  const before = JSON.stringify(event);
  const html = renderToStaticMarkup(localizePublicSurfaceTree(<ChangeEventContent event={event} locale="en" />, "ja", {
    "Old text": "以前の文章", "New text": "新しい文章", "Official source": "公式出典",
    "Open revision history": "履歴を開く", [oldText]: "DO NOT TRANSLATE OLD RECORD", [newText]: "DO NOT TRANSLATE NEW RECORD"
  }));
  assert(html.includes("以前の文章")); assert(html.includes("新しい文章")); assert(html.includes("公式出典"));
  assert(html.includes(`/ja${event.url}`));
  assert(!html.includes("DO NOT TRANSLATE"));
  assert.equal(JSON.stringify(event), before);
});

test("translated display locations and count templates retain canonical data inputs", () => {
  assert.equal(formatDiscoveryLocation("Cambridge,", "United States of America", { "United States": "アメリカ合衆国" }), "Cambridge, アメリカ合衆国");
  const counts = { affected: 3, modified: 2, added: 1, held: 0 };
  assert.equal(changeCountsText(counts, "en", { "Records involved: {n}": "対象 {n} 件", "{n} corrected / adjusted": "修正 {n} 件", "{n} added": "追加 {n} 件" }), "対象 3 件 (修正 2 件 · 追加 1 件)");
});

test("directory summaries require the exact record, evidence and summary-field binding", () => {
  const summary = buildSeedPublicEntitySummary(seedUniversities[0], "http://localhost:3000");
  const basis = readingSummaryBasis(summary);
  const sourceHash = createHash("sha256").update(summary.summary).digest("hex");
  const school: ReadingTranslationBundle = {
    schemaVersion: "uapt-reading-translations-v1", locale: "ja", slug: summary.entity.slug,
    sourceSha256: "a".repeat(64), ...basis, protectedClaimIds: [], requiredSourceHashes: [sourceHash],
    review: { status: "accepted", receiptSha256: "b".repeat(64) },
    strings: { [sourceHash]: { source: summary.summary, sourceSha256: sourceHash, translation: "翻訳された概要" } },
    sourceFieldUses: { [sourceHash]: ["/public/summary"] }
  };
  const ready = { state: "ready" as const, revision: "fixture", school, shared: { ...school, slug: "_shared" } };
  assert.equal(translatedDirectorySummary(summary, ready), "翻訳された概要");
  assert.equal(translatedDirectorySummary({ ...summary, summary: "Changed summary" }, ready), undefined);
  assert.equal(translatedDirectorySummary(summary, { ...ready, school: { ...school, originalEvidenceSha256: "c".repeat(64) } }), undefined);
  assert.equal(translatedDirectorySummary(summary, { ...ready, school: { ...school, sourceFieldUses: { [sourceHash]: ["/public/claims/claim-a/claimText"] } } }), undefined);
});

test("rendered developer UI is selected for translation while original evidence and embed code are preserved", () => {
  const node = <main><h1>Embeddable read-only policy status cards</h1><p>New visible description</p><pre>{'<script src="https://example.test/embed.js"></script>'}</pre><blockquote data-i18n="preserve">Original evidence quote</blockquote></main>;
  const sources = publicSurfaceNodeTextSources(node);
  assert(sources.includes("Embeddable read-only policy status cards"));
  assert(sources.includes("New visible description"));
  assert(!sources.some(source => source.includes("<script") || source.includes("Original evidence")));
  const html = renderToStaticMarkup(localizePublicSurfaceTree(node, "ja", { "Embeddable read-only policy status cards": "埋め込みカード", 'Original evidence quote': 'MUST NOT TRANSLATE', '<script src="https://example.test/embed.js"></script>': 'MUST NOT TRANSLATE' }));
  assert(html.includes("埋め込みカード"));
  assert(!html.includes("MUST NOT TRANSLATE"));
});
