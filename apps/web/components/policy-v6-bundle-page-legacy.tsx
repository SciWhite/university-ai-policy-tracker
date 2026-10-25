import {PolicyV6Changes} from "./policy-v6-changes";
import {UniversityHomepageMark} from '@/components/university-homepage-mark';
import {PolicyV6HeldRecords} from "./policy-v6-held-records";
import {PolicyV6RecordLinks} from "./policy-v6-record-links";
import React from "react";
import type { SupportedLocale } from "@/lib/i18n";
import type { PolicyV6Data } from "@/lib/policy-v6";
import { getLocalV6BundleScene, type LocalV6Bundle } from "@/lib/policy-v6-bundle";
import type { RelatedUniversityRef } from "@/lib/related-universities";
import { groupReviewedClaimsByClaimType } from "@/lib/university-claims-organization";
import { translatePolicyReferenceUi as translate } from "@/lib/policy-reference-ui";
import { EntityHeader } from "./entity-header";
import { getPolicyV6UniversityTitle } from "@/lib/policy-v6-university-title";
import { UniversityMark } from "./university-mark";
import { PolicyV6HeaderLocation } from "./policy-v6-header-location";
import { PolicyReferenceLayout, PolicyReferenceHero } from "./policy-reference-layout";
import { PolicyReferenceInteractions } from "./policy-reference-interactions";
import { PolicyV6Provider, PolicyV6Actions, PolicyV6Intro, PolicyV6BeforeTools, PolicyV6ChecklistFaq, PolicyV6Faq } from "./policy-v6";
import { PolicyV6RecordTopics } from "./policy-v6-record-topics";
import { UniversityAiTools } from "./university-ai-tools";
import { PolicyV6ClaimGroups } from "./policy-v6-claim-groups";
import { PolicyV6Sources } from "./policy-v6-sources";
import { RelatedUniversities } from "./related-universities";

/** One composition for normalized local crawl bundles, rather than one layout per school. */
export function PolicyV6BundlePageLegacy({ university, data, view, locale, relatedUniversities }: {
  university: { slug: string; name: string; region: string; country: string };
  data: PolicyV6Data; view: LocalV6Bundle; locale: SupportedLocale; relatedUniversities: RelatedUniversityRef[];
}) {
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
      <PolicyReferenceHero uiLab scene={getLocalV6BundleScene(view, locale)} locale={locale} localizedActions={locale === "zh"} tools />
      <PolicyV6RecordTopics data={data} />
      <PolicyV6BeforeTools />
      <UniversityAiTools records={onlyScopedTools ? scopedTools : unscopedTools} locale={locale} uiLab scopeNote={onlyScopedTools ? scopeNote : undefined} scopedTools={!onlyScopedTools && scopedTools.length ? <>
        <p>{locale === "zh" ? "以下工具限特定对象、模式或用途；不代表全体学生获得使用许可。" : "These tools have audience, mode or purpose limits; access is not established for all students."}</p>
        <UniversityAiTools records={scopedTools} locale={locale} uiLab standalone sectionId="university-ai-tools-scoped" />
      </> : undefined} />
      <PolicyV6ChecklistFaq includeFaq={false} />
      <PolicyReferenceInteractions />
      <PolicyV6Changes slug={university.slug} recordSha256={view.school.fingerprint} locale={locale}/>
      <section id="claims" className="student-record-section student-record-section--compact"><div className="section-heading"><h2>{t("Reviewed claims")}</h2><p>{view.claims.length}</p></div>
        <PolicyV6ClaimGroups entitySlug={university.slug} groups={groupReviewedClaimsByClaimType(view.claims)} locale={locale} claimScopes={view.claimScopes} />
      </section>
      <PolicyV6HeldRecords slug={university.slug} locale={locale}/><section id="sources" className="student-record-section student-record-section--compact"><h2>{t("Official sources")}</h2><PolicyV6Sources sources={view.sources} slug={university.slug} locale={locale} /></section>
      <RelatedUniversities universities={relatedUniversities} locale={locale} localizeUi uiLab />
      <section id="record-info" className="student-record-info"><details><summary>{t("Record information, JSON & citation")}</summary>
        <PolicyV6RecordLinks slug={university.slug} locale={locale}/>
        <p>{locale === "zh" ? (view.publication ? "已发布的范围限定规则修订；当前 JSON 与 MCP 使用同一已审核记录，旧基线另存历史。整校审计仍为 PARTIAL。" : "本地资料预览；公开 JSON 仍为原发布基线。整校审计仍为 PARTIAL。") : (view.publication ? "Published scoped record correction; current JSON and MCP use the same reviewed record, while the previous baseline is retained in history. Institution-wide audit remains PARTIAL." : "Local evidence preview; public JSON retains its published baseline. Institution-wide audit remains PARTIAL.")}</p>
        <ul>{view.gaps.map((gap) => <li key={gap} data-i18n="preserve" lang="en">{gap}</li>)}</ul>
        <ul>{view.remainingRecordKeys.map((key) => <li key={key} data-i18n="preserve">{key}</li>)}</ul>
        <ul>{view.heldDraftIds?.map((key) => <li key={key} data-i18n="preserve">{key} — {locale === "zh" ? "暂缓，未作为已核实结论展示" : "Held; excluded from verified conclusions"}</li>)}</ul>
        <ul>{view.auditCoverage?.excludedClaims?.map((claim) => <li key={claim.id} data-i18n="preserve">{claim.id} — {claim.auditStatus}</li>)}</ul>
        <a href={`/api/public/v1/universities/${university.slug}.json`}>{locale === "zh" ? "当前已审核 JSON" : "Current reviewed JSON"}</a>
      </details></section>
      <PolicyV6Faq />
    </PolicyReferenceLayout></PolicyV6Provider>
  </main>;
}
