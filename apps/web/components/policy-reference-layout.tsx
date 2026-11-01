import {v6ChangesCopy} from "@/lib/v6-changes-copy";
import { policyV6Copy } from '@/lib/policy-v6-copy';
import { translatePolicyReferenceUi as translate } from "@/lib/policy-reference-ui";
import { withLocalePrefix, type SupportedLocale } from "@/lib/i18n";
import { universityToolsUi } from "@/lib/university-tools-ui";
import { v5Display, v5Ui } from "@/lib/enforcement-v5-ui";
import { PolicySummaryEmphasis, sampleActionPhrases } from "@/components/policy-summary-emphasis";
import Image from "next/image";
import type { PolicyScenePilot } from "@/lib/policy-scene-pilot";
import React, { type ReactNode } from "react";
import {publishedV6Enabled} from '@/lib/policy-v6-published-gate';

export function PolicyReferenceReview({ state, locale, sharedUiText }: { state: string; locale: SupportedLocale; sharedUiText?: Record<string, string> }) {
  if (state === "agent_reviewed") return <a href={withLocalePrefix("/methodology", locale)} title={localized("Review method", locale, sharedUiText)}>{localized("AI-assisted review", locale, sharedUiText)}</a>;
  return <>{localized(state.replaceAll("_", " "), locale, sharedUiText)}</>;
}

type NavigationOptions = { locale?: SupportedLocale; sharedUiText?: Record<string, string>; claimsOnly?: boolean; enforcement?: boolean; tools?: boolean; supplements?: boolean; uiLab?: boolean; studentActions?: boolean; changes?: boolean };
const localized = (value: string, locale: SupportedLocale, sharedUiText: Record<string, string> = {}) => sharedUiText[value] ?? translate(value, locale);

export function PolicyReferenceLayout({ enabled, children, locale = "en", sharedUiText, claimsOnly = false, enforcement = false, tools = false, supplements = false, uiLab = false, studentActions = false, changes = false }: NavigationOptions & { enabled: boolean; children: ReactNode }) {
  if (!enabled) return <>{children}</>;
  return <div className="policy-reference-body"><PolicyReferenceNavigation locale={locale} sharedUiText={sharedUiText} claimsOnly={claimsOnly} enforcement={enforcement} tools={tools} supplements={supplements} uiLab={uiLab} studentActions={studentActions} changes={changes} /><div className="policy-reference-content">{children}</div></div>;
}

export function PolicyReferenceNavigation({ inline = false, locale = "en", sharedUiText, claimsOnly = false, enforcement = false, tools = false, supplements = false, uiLab = false, studentActions = false, changes = false }: NavigationOptions & { inline?: boolean }) {
  const t = (value: string) => localized(value, locale, sharedUiText);
  return <nav className={`policy-reference-nav policy-reference-nav--${inline ? "inline" : "rail"}`} aria-label={t("On this page")}>
    <p>{t("On this page")}</p>
    <a href="#quick-guide">{t("At a glance")}</a>
    {studentActions?<><a href="#v6-ai-use-guidance">{locale==='zh'?'AI 使用指引':locale==='en'?t("AI use guide"):t("Student guide")}</a><a href="#v6-ai-concerns">{locale==='zh'?'收到 AI 使用疑虑？':locale==='en'?t("AI use questioned?"):t("Academic integrity")}</a></>:null}
    {claimsOnly ? null : <>
    <a href="#snapshot-coursework">{t("Coursework")}</a>
    <a href="#snapshot-exams">{t("Exams")}</a>
    <a href="#snapshot-disclosure">{t("Disclosure")}</a>
    <a href="#snapshot-privacy_data">{t("Data safety")}</a>
    <a href="#snapshot-approved_tools">{t("Approved tools")}</a>
    </>}
    {enforcement ? <a href="#enforcement-evidence">{v5Ui(locale)[1]}</a> : null}
    {tools ? <a href="#university-ai-tools">{t(universityToolsUi(locale)[0])}</a> : null}
    {supplements ? <a href="#policy-supplements">{t("More policy information")}</a> : null}
    {uiLab ? <><a href="#submission-checklist">{t(policyV6Copy(locale).checklist)}</a><a href="#student-faq">{t(policyV6Copy(locale).faq)}</a></> : null}
    {changes ? <a href="#record-changes">{t(v6ChangesCopy(locale).title)}</a> : null}
    <a href="#claims">{t("Reviewed claims")}</a>
    <a href="#sources">{t("Official sources")}</a>
    <a href="#record-info">{t("About this record")}</a>
  </nav>;
}

export function PolicyReferenceHero({ scene, locale = "en", sharedUiText, localizedActions = false, emphasizeActions = false, enforcement = false, tools = false, supplements = false, uiLab = false }: NavigationOptions & { scene: PolicyScenePilot; localizedActions?: boolean; emphasizeActions?: boolean }) {
  if(uiLab&&publishedV6Enabled())return null;
  if (!scene.quickGuide) return null;
  const t = (value: string) => localized(value, locale, sharedUiText);
  return <section className="policy-reference-hero" id="quick-guide" aria-labelledby="policy-scene-heading">
    <div className="policy-reference-intro">
      <p className="policy-reference-scope">{scene.eyebrow}</p>
      <h2 id="policy-scene-heading">{scene.title}</h2>
      <p lang={localizedActions ? "zh" : "en"} data-i18n="preserve">{scene.guidance || scene.quickGuide.scopeNote}</p>
      {!uiLab && localizedActions ? <p className="policy-reference-language-note">{t("Site interpretation; official evidence remains in its original language.")}</p> : !uiLab && locale !== "en" ? <p className="policy-reference-language-note">{t("Policy guidance below is in English; official evidence remains in its original language.")}</p> : null}
      {!uiLab && (scene.claimsOnly || scene.snapshotNotice) ? <p className="policy-reference-language-note">{t("No reviewed student policy snapshot has been published yet.")}</p> : null}
      {scene.scopeDetail ? <details className="policy-scope-detail"><summary>{t("Scope and transition details")}</summary><p lang={localizedActions ? "zh" : "en"} data-i18n="preserve">{scene.scopeDetail}</p></details> : null}
      {scene.sourceUpdate ? <p className="policy-reference-language-note"><a href="#current-source-supplement">{t("Source check and dated evidence")}</a></p> : null}
    </div>
    <div className="policy-reference-actions">
      {(["do", "dont"] as const).map(kind => <article key={kind} className={`policy-reference-action policy-reference-action--${kind}`}>
        <h3>{t(kind === "do" ? "Do" : "Don't")}</h3>
        <ul lang={localizedActions ? "zh" : "en"} data-i18n="preserve">{scene.quickGuide![kind].checks.map(check => <li key={check.text}>
          <a href={check.evidenceHref} target={check.evidenceHref.startsWith("https://") ? "_blank" : undefined} rel={check.evidenceHref.startsWith("https://") ? "noopener noreferrer" : undefined}>{emphasizeActions ? <PolicySummaryEmphasis text={check.text} phrases={sampleActionPhrases} policy /> : check.text}</a>
        </li>)}</ul>
        <Image className="policy-reference-action-art" src={scene.quickGuide![kind].artworkSrc} alt={scene.quickGuide![kind].artworkAlt} width={scene.quickGuide![kind].artworkLandscape ? 1280 : 1024} height={scene.quickGuide![kind].artworkLandscape ? 853 : 1024} sizes="(max-width: 767px) 100vw, 480px" loading="eager" unoptimized />
      </article>)}
    </div>
    <PolicyReferenceNavigation inline locale={locale} sharedUiText={sharedUiText} claimsOnly={Boolean(scene.claimsOnly || scene.snapshotNotice)} enforcement={enforcement} tools={tools} supplements={supplements} uiLab={uiLab} />
    <figure className="policy-reference-art">
      <Image src={scene.artworkSrc} alt={scene.artworkAlt} width={scene.artworkSquare ? 1024 : 1280} height={scene.artworkSquare ? 1024 : 853} sizes="(min-width: 1200px) 300px, 320px" preload unoptimized />
      <figcaption>{t("Check the rule for your school and assignment.")}</figcaption>
    </figure>
  </section>;
}
