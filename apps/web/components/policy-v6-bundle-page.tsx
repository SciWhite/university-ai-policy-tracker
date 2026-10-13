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
import { PolicyV6Provider, PolicyV6Actions, PolicyV6Intro, PolicyV6ChecklistFaq, PolicyV6Faq } from "./policy-v6";
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
  const t = (s: string) => translate(s, locale);
  const scopedNames = new Set(view.scopedToolNames ?? []);
  const scopedTools = view.tools.filter((tool) => scopedNames.has(tool.rawToolName));
  return <main className="page-shell page-shell--wide policy-reference" data-policy-layout="v6" data-v6-basis={view.sourceBundleSha256}>
    <PolicyV6Provider data={data}><PolicyReferenceLayout enabled uiLab locale={locale} tools>
      <EntityHeader leading={<UniversityMark slug={university.slug} size="hero" />} title={<span data-i18n="preserve">{getPolicyV6UniversityTitle(university.slug, university.name)}</span>}
        eyebrow={<PolicyV6HeaderLocation region={university.region} country={university.country} checkedAt={view.school.checkedAt} locale={locale} />}
        actions={<div id="v6-header-actions"><PolicyV6Actions /></div>} />
      <PolicyV6Intro />
      <PolicyReferenceHero uiLab scene={getLocalV6BundleScene(view, locale)} locale={locale} localizedActions={locale === "zh"} tools />
      <PolicyV6RecordTopics data={data} />
      <UniversityAiTools records={view.tools.filter((tool) => !scopedNames.has(tool.rawToolName))} locale={locale} uiLab scopedTools={scopedTools.length ? <>
        <p>{locale === "zh" ? "以下工具限特定对象、模式或用途；不代表全体学生获得使用许可。" : "These tools have audience, mode or purpose limits; access is not established for all students."}</p>
        <UniversityAiTools records={scopedTools} locale={locale} uiLab standalone sectionId="university-ai-tools-scoped" />
      </> : undefined} />
      <PolicyV6ChecklistFaq includeFaq={false} />
      <PolicyReferenceInteractions />
      <section id="claims" className="student-record-section student-record-section--compact"><div className="section-heading"><h2>{t("Reviewed claims")}</h2><p>{view.claims.length}</p></div>
        <PolicyV6ClaimGroups entitySlug={university.slug} groups={groupReviewedClaimsByClaimType(view.claims)} locale={locale} claimScopes={view.claimScopes} />
      </section>
      <section id="sources" className="student-record-section student-record-section--compact"><h2>{t("Official sources")}</h2><PolicyV6Sources sources={view.sources} slug={university.slug} locale={locale} /></section>
      <RelatedUniversities universities={relatedUniversities} locale={locale} localizeUi uiLab />
      <section id="record-info" className="student-record-info"><details><summary>{t("Record information, JSON & citation")}</summary>
        <p>{view.school.revision}</p>
        <p>{locale === "zh" ? (view.publication ? "已发布的页面补充资料；canonical JSON 保留数据发布基线。整校审计仍为 PARTIAL。" : "本地资料预览；公开 JSON 仍为原发布基线。整校审计仍为 PARTIAL。") : (view.publication ? "Published page supplement; canonical JSON retains the dataset release baseline. Institution-wide audit remains PARTIAL." : "Local evidence preview; public JSON retains its published baseline. Institution-wide audit remains PARTIAL.")}</p>
        <ul>{view.gaps.map((gap) => <li key={gap} data-i18n="preserve" lang="en">{gap}</li>)}</ul>
        <ul>{view.remainingRecordKeys.map((key) => <li key={key} data-i18n="preserve">{key}</li>)}</ul>
        <ul>{view.heldDraftIds?.map((key) => <li key={key} data-i18n="preserve">{key} — {locale === "zh" ? "暂缓，未作为已核实结论展示" : "Held; excluded from verified conclusions"}</li>)}</ul>
        <ul>{view.auditCoverage?.excludedClaims?.map((claim) => <li key={claim.id} data-i18n="preserve">{claim.id} — {claim.auditStatus}</li>)}</ul>
        <a href={`/api/public/v1/universities/${university.slug}.json`}>{locale === "zh" ? "原公开基线 JSON" : "Published baseline JSON"}</a>
      </details></section>
      <PolicyV6Faq />
    </PolicyReferenceLayout></PolicyV6Provider>
  </main>;
}
