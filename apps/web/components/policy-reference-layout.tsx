import { translatePolicyReferenceUi as translate } from "@/lib/policy-reference-ui";
import type { SupportedLocale } from "@/lib/i18n";
import { v5Ui } from "@/lib/enforcement-v5-ui";
import { PolicySummaryEmphasis, sampleActionPhrases } from "@/components/policy-summary-emphasis";
import Image from "next/image";
import type { PolicyScenePilot } from "@/lib/policy-scene-pilot";
import React, { type ReactNode } from "react";

export function PolicyReferenceLayout({ enabled, children, locale = "en", claimsOnly = false, enforcement = false }: { claimsOnly?: boolean; enabled: boolean; children: ReactNode; locale?: SupportedLocale; enforcement?: boolean }) {
  if (!enabled) return <>{children}</>;
  return <div className="policy-reference-body"><PolicyReferenceNavigation locale={locale} claimsOnly={claimsOnly} enforcement={enforcement} /><div className="policy-reference-content">{children}</div></div>;
}

export function PolicyReferenceNavigation({ inline = false, locale = "en", claimsOnly = false, enforcement = false }: { claimsOnly?: boolean; inline?: boolean; locale?: SupportedLocale; enforcement?: boolean }) {
  return <nav className={`policy-reference-nav policy-reference-nav--${inline ? "inline" : "rail"}`} aria-label={translate("On this page", locale)}>
    <p>{translate("On this page", locale)}</p>
    <a href="#quick-guide">{translate("At a glance", locale)}</a>
    {claimsOnly ? null : <>
    <a href="#snapshot-coursework">{translate("Coursework", locale)}</a>
    <a href="#snapshot-exams">{translate("Exams", locale)}</a>
    <a href="#snapshot-disclosure">{translate("Disclosure", locale)}</a>
    <a href="#snapshot-privacy_data">{translate("Data safety", locale)}</a>
    <a href="#snapshot-approved_tools">{translate("Approved tools", locale)}</a>
    </>}
    {enforcement ? <a href="#enforcement-evidence">{v5Ui(locale)[1]}</a> : null}
    <a href="#claims">{translate("Reviewed claims", locale)}</a>
    <a href="#sources">{translate("Official sources", locale)}</a>
    <a href="#record-info">{translate("About this record", locale)}</a>
  </nav>;
}

export function PolicyReferenceHero({ scene, locale = "en", localizedActions = false, emphasizeActions = false }: { scene: PolicyScenePilot; locale?: SupportedLocale; localizedActions?: boolean; emphasizeActions?: boolean }) {
  if (!scene.quickGuide) return null;
  return <section className="policy-reference-hero" id="quick-guide" aria-labelledby="policy-scene-heading">
    <div className="policy-reference-intro">
      <p className="policy-reference-scope">{scene.eyebrow}</p>
      <h2 id="policy-scene-heading">{scene.title}</h2>
      <p lang={localizedActions ? "zh" : "en"} data-i18n="preserve">{scene.guidance || scene.quickGuide.scopeNote}</p>
      {locale !== "en" ? <p className="policy-reference-language-note">{translate("Policy guidance below is in English; official evidence remains in its original language.", locale)}</p> : null}
      {scene.claimsOnly || scene.snapshotNotice ? <p className="policy-reference-language-note">{translate("No reviewed student policy snapshot has been published yet.", locale)}</p> : null}
      {scene.scopeDetail ? <details className="policy-scope-detail"><summary>{translate("Scope and transition details", locale)}</summary><p lang={localizedActions ? "zh" : "en"} data-i18n="preserve">{scene.scopeDetail}</p></details> : null}
      {scene.sourceUpdate ? <p className="policy-reference-language-note"><a href="#current-source-supplement">{translate("Source check and dated evidence", locale)}</a></p> : null}
    </div>
    <div className="policy-reference-actions">
      {(["do", "dont"] as const).map(kind => <article key={kind} className={`policy-reference-action policy-reference-action--${kind}`}>
        <h3>{translate(kind === "do" ? "Do" : "Don't", locale)}</h3>
        <ul lang={localizedActions ? "zh" : "en"} data-i18n="preserve">{scene.quickGuide![kind].checks.map(check => <li key={check.text}>
          <a href={check.evidenceHref} target={check.evidenceHref.startsWith("https://") ? "_blank" : undefined} rel={check.evidenceHref.startsWith("https://") ? "noopener noreferrer" : undefined}>{emphasizeActions ? <PolicySummaryEmphasis text={check.text} phrases={sampleActionPhrases} policy /> : check.text}</a>
        </li>)}</ul>
        <Image className="policy-reference-action-art" src={scene.quickGuide![kind].artworkSrc} alt={scene.quickGuide![kind].artworkAlt} width={scene.quickGuide![kind].artworkLandscape ? 1280 : 1024} height={scene.quickGuide![kind].artworkLandscape ? 853 : 1024} sizes="(max-width: 767px) 100vw, 480px" loading="eager" unoptimized />
      </article>)}
    </div>
    <PolicyReferenceNavigation inline locale={locale} claimsOnly={Boolean(scene.claimsOnly || scene.snapshotNotice)} />
    <figure className="policy-reference-art">
      <Image src={scene.artworkSrc} alt={scene.artworkAlt} width={scene.artworkSquare ? 1024 : 1280} height={scene.artworkSquare ? 1024 : 853} sizes="(min-width: 1200px) 300px, 320px" preload unoptimized />
      <figcaption>{translate("Check the rule for your school and assignment.", locale)}</figcaption>
    </figure>
  </section>;
}
