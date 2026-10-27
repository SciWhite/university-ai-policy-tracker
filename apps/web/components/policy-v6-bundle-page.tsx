import { bindPolicyV6ReadingEvidence } from "@/lib/policy-v6-reading-evidence";
import {currentReferenceClaims} from "@/lib/policy-v6-claim-disposition";
import {PolicyV6PublicClaimDisposition} from "./policy-v6-public-claim-disposition";
import {PolicyV6PublicClaimGuide} from "./policy-v6-public-claim-guide";
import {PolicyV6PublicToolContext} from "./policy-v6-public-tool-context";
import {PolicyV6BundlePageLegacy} from "./policy-v6-bundle-page-legacy";
import {PolicyV6PrivateContext} from "./policy-v6-private-context";
import {PolicyV6Changes} from "./policy-v6-changes";
import {UniversityHomepageMark} from '@/components/university-homepage-mark';
import {PolicyV6HeldRecords} from "./policy-v6-held-records";
import {PolicyV6RecordLinks} from "./policy-v6-record-links";
import React from "react";
import type { SupportedLocale } from "@/lib/i18n";
import type { PolicyV6Data } from "@/lib/policy-v6";
import { type LocalV6Bundle } from "@/lib/policy-v6-bundle";
import type { RelatedUniversityRef } from "@/lib/related-universities";
import { groupReviewedClaimsByClaimType } from "@/lib/university-claims-organization";
import { translatePolicyReferenceUi as translate } from "@/lib/policy-reference-ui";
import { EntityHeader } from "./entity-header";
import { getPolicyV6UniversityTitle } from "@/lib/policy-v6-university-title";
import { UniversityMark } from "./university-mark";
import { PolicyV6HeaderLocation } from "./policy-v6-header-location";
import { PolicyReferenceLayout } from "./policy-reference-layout";
import { PolicyReferenceInteractions } from "./policy-reference-interactions";
import { PolicyV6Provider, PolicyV6Actions, PolicyV6Intro, PolicyV6BeforeTools, PolicyV6ChecklistFaq, PolicyV6Faq } from "./policy-v6";
import { PolicyV6RecordTopics } from "./policy-v6-record-topics";
import { UniversityAiTools } from "./university-ai-tools";
import { PolicyV6ClaimGroups } from "./policy-v6-claim-groups";
import { PolicyV6Sources } from "./policy-v6-sources";
import { RelatedUniversities } from "./related-universities";

/** One composition for normalized local crawl bundles, rather than one layout per school. */
export function PolicyV6BundlePage({ university, data, view, locale, relatedUniversities }: {
  university: { slug: string; name: string; region: string; country: string };
  data: PolicyV6Data; view: LocalV6Bundle; locale: SupportedLocale; relatedUniversities: RelatedUniversityRef[];
}) {
  if (view.publication && view.publication.kind !== "v6_presentation_integration") return <PolicyV6BundlePageLegacy university={university} data={data} view={view} locale={locale} relatedUniversities={relatedUniversities} />;
  data = bindPolicyV6ReadingEvidence(data, view.claims);
  const t = (s: string) => translate(s, locale);
  const scopedNames = new Set(view.scopedToolNames ?? []);
  const scopedTools = view.tools.filter((tool) => scopedNames.has(tool.rawToolName));
  const unscopedTools = view.tools.filter((tool) => !scopedNames.has(tool.rawToolName));
  const onlyScopedTools = scopedTools.length > 0 && unscopedTools.length === 0;
  const scopeNote = locale === "zh" ? "以下工具限特定对象、账户、模式或用途；不代表全体学生获得使用许可，也不代表考核许可。请核对每项获取条件。" : "These tools have audience, account, mode or purpose limits; access is not established for all students and does not grant assessment permission. Check each access condition.";
  return <main className="page-shell page-shell--wide policy-reference" data-policy-layout="v6" data-ui-experience="compact-evidence" data-v6-basis={view.school.fingerprint}>
    <PolicyV6Provider data={data}><PolicyReferenceLayout changes enabled uiLab studentActions={Boolean(data.studentActionsPilot)} locale={locale} tools>
      <EntityHeader leading={<UniversityHomepageMark slug={university.slug} name={university.name} locale={locale} />} title={<span data-i18n="preserve">{getPolicyV6UniversityTitle(university.slug, university.name)}</span>}
        eyebrow={<PolicyV6HeaderLocation region={university.region} country={university.country} checkedAt={view.school.checkedAt} locale={locale} />}
        actions={<div id="v6-header-actions"><PolicyV6Actions /></div>} />
      <PolicyV6Intro />
      <PolicyV6RecordTopics data={data} />
      {!view.studentActions && (view.publicReferenceGuide || view.localReferenceGuide) ? <PolicyV6PublicClaimGuide view={view} locale={locale} /> : <PolicyV6BeforeTools />}
      {view.toolDisplayMode === "historical_discovery" ? <PolicyV6PublicToolContext view={view} locale={locale} /> : <UniversityAiTools displayCopy={locale === "zh" ? view.toolDisplayCopy?.zh : undefined} draftPreview={!view.publication} records={onlyScopedTools ? scopedTools : unscopedTools} locale={locale} uiLab scopeNote={onlyScopedTools ? scopeNote : undefined} scopedTools={!onlyScopedTools && scopedTools.length ? <>
        <p>{locale === "zh" ? "以下工具限特定对象、模式或用途；不代表全体学生获得使用许可。" : "These tools have audience, mode or purpose limits; access is not established for all students."}</p>
        <UniversityAiTools displayCopy={locale === "zh" ? view.toolDisplayCopy?.zh : undefined} draftPreview={!view.publication} records={scopedTools} locale={locale} uiLab standalone sectionId="university-ai-tools-scoped" />
      </> : undefined} />}
      <PolicyV6PrivateContext view={view} locale={locale} kind="tool" />
      <PolicyReferenceInteractions />
      <PolicyV6Changes slug={university.slug} recordSha256={view.school.fingerprint} locale={locale}/>
      {!view.publication && view.localChangeProposals?.length ? <details className="student-record-info" id="v6-proposed-changes"><summary>{locale === "zh" ? "待审核修复建议（未应用）" : "Proposed repairs — pending, not applied"}</summary>{view.localChangeProposals.map(proposal => <article key={proposal.changeId}><h3>{proposal.changeId}</h3><p>{proposal.category} · {proposal.status}</p><p lang={proposal.repairZh ? "zh" : "en"} data-i18n="preserve">{proposal.repairZh ?? proposal.suggestedNewText}</p><ul>{proposal.recordKeysImpacted?.map(key => <li key={key}>{key}</li>)}</ul></article>)}</details> : null}
      <section id="claims" className="student-record-section student-record-section--compact"><div className="section-heading"><h2>{t("Reviewed claims")}</h2><p>{currentReferenceClaims(view).length}</p></div>
        <PolicyV6ClaimGroups entitySlug={university.slug} groups={groupReviewedClaimsByClaimType(currentReferenceClaims(view))} locale={locale} claimScopes={view.claimScopes} />
      </section>
      <PolicyV6PublicClaimDisposition view={view} locale={locale} /><PolicyV6PrivateContext view={view} locale={locale} kind="claim" />
      <PolicyV6HeldRecords slug={university.slug} locale={locale}/><section id="sources" className="student-record-section student-record-section--compact"><h2>{t("Official sources")}</h2><PolicyV6Sources sources={view.sources} slug={university.slug} locale={locale} /></section>
      <RelatedUniversities universities={relatedUniversities} locale={locale} localizeUi uiLab />
      <section id="record-info" className="student-record-info"><details><summary>{t("Record information, JSON & citation")}</summary>
        <PolicyV6RecordLinks slug={university.slug} locale={locale} publicTraceability={Boolean(view.claimDispositions)}/>
        <p>{locale === "zh" ? (view.publication && !view.candidateOnly ? "已发布 V6 展示；JSON 与 MCP 保留原公开记录。补充引文及范围提示待核实；本地候选更正、工具和学生摘要未获公开批准。整校审计仍为 PARTIAL。" : "本地资料预览；公开 JSON 仍为原发布基线。整校审计仍为 PARTIAL。") : (view.publication && !view.candidateOnly ? "Published V6 presentation; JSON and MCP retain the existing public record. Supplementary quotations and scope notes remain pending review. Local candidate corrections, tools and student summaries are not approved for publication. Institution-wide audit remains PARTIAL." : "Local evidence preview; public JSON retains its published baseline. Institution-wide audit remains PARTIAL.")}</p>
        {(!view.publication || view.candidateOnly) && view.analysisProjection ? <details id="v6-local-analysis"><summary>{locale === "zh" ? "Analysis：本地范围映射，待审核" : "Analysis: local scoped projection, pending review"}</summary><p>{locale === "zh" ? "本地机器候选；不代表学生摘要批准或全校语义签收。" : "Local machine candidate; not an approved student snapshot or institution-wide semantic signoff."}</p><a href={`/api/policy-v6/local/${university.slug}/analysis`}>JSON</a>{view.analysisProjection.profile.dimensions.map(d => <article key={d.key} data-local-analysis-dimension={d.key}><h4>{d.label} · {d.status}</h4><p lang="en" data-i18n="preserve">{d.summary}</p><p>{d.evidenceClaimIds.join(" · ")}</p></article>)}</details> : null}
        <ul>{view.gaps.map((gap) => <li key={gap} data-i18n="preserve" lang="en">{gap}</li>)}</ul>
        <ul>{view.remainingRecordKeys.map((key) => <li key={key} data-i18n="preserve">{key}</li>)}</ul>
        <ul>{view.heldDraftIds?.map((key) => <li key={key} data-i18n="preserve">{key} — {locale === "zh" ? "暂缓，未作为已核实结论展示" : "Held; excluded from verified conclusions"}</li>)}</ul>
        <ul>{view.auditCoverage?.excludedClaims?.map((claim) => <li key={claim.id} data-i18n="preserve">{claim.id} — {claim.auditStatus}</li>)}</ul>
        <a href={`/api/public/v1/universities/${university.slug}.json`}>{locale === "zh" ? "当前已审核 JSON" : "Current reviewed JSON"}</a>
      </details></section>
      {!view.studentActions && (view.publicReferenceGuide || view.localReferenceGuide) ? <PolicyV6PublicClaimGuide view={view} locale={locale} faq /> : <PolicyV6Faq />}
    </PolicyReferenceLayout></PolicyV6Provider>
  </main>;
}
