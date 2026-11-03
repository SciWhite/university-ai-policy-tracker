import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnalyticsPreferenceControl } from "./analytics-preference-control";
import { ClarityPrivacyControl } from "./clarity-integration";
import { clarityCopy } from "@/lib/clarity-copy";
import { PluginGetStarted } from "./plugin-get-started";
import { pluginPromotionCopy } from "@/lib/plugin-promotion";
import { PluginInstallLink } from "./plugin-install-link";
import { SupportMailboxDetails } from "./support-mailbox-details";
import { getTrustContent, trustIntroductions, type TrustPageKind } from "@/lib/trust-content";
import { isSupportedLocale, withLocalePrefix, SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/i18n";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import { legacyLocale } from "@/lib/i18n";
import { isReadingLocale, type ReadingLocale } from "@/lib/language-catalog";
import { getReadingSharedUiText } from "@/lib/reading-translations";
import { presentationTextSources } from "@/lib/public-ui-sources";
import { localizeSurfaceCopy, localizeSurfaceMetadata, translateSurfaceText } from "@/lib/surface-localization";
import { ReadingUiTextProvider } from "./reading-ui-text-provider";
import styles from "./trust-page.module.css";
const kindIndex = { contact:0, support:1, privacy:2, terms:3, mcp:4 } as const;
type Props = { params: Promise<{ locale: string }> };
const trustSources = presentationTextSources(getTrustContent("en"), trustIntroductions.en, clarityCopy.en, pluginPromotionCopy("en"), ["Support email provider", "Retention"]);
export async function trustMetadata(kind: TrustPageKind, locale: ReadingLocale = "en"): Promise<Metadata> {
  const sourceLocale = legacyLocale(locale);
  const text = getTrustContent(sourceLocale);
  const uiText = locale === "en" ? {} : await getReadingSharedUiText(locale, trustSources);
  return localizeSurfaceMetadata({ title: `${text.labels[kindIndex[kind]]} | University AI Policy Tracker`, description: trustIntroductions[sourceLocale][kindIndex[kind]],
    alternates: { canonical: getAbsoluteSiteUrl(withLocalePrefix(`/${kind}`,locale)), languages: Object.fromEntries(SUPPORTED_LOCALES.map(l => [l,getAbsoluteSiteUrl(withLocalePrefix(`/${kind}`,l))])) } }, `/${kind}`, locale, uiText);
}
export async function TrustPage({ kind, locale = "en" }: { kind: TrustPageKind; locale?: ReadingLocale }) {
  const sourceLocale = legacyLocale(locale);
  const uiText = locale === "en" ? {} : await getReadingSharedUiText(locale, trustSources);
  const text = localizeSurfaceCopy(getTrustContent(sourceLocale), locale, uiText);
  const clarity = localizeSurfaceCopy(clarityCopy[sourceLocale], locale, uiText);
  return <ReadingUiTextProvider value={uiText}><main className="page-shell home-v4-shell page-shell--wide" data-trust-layout="v4">
    <div className="home-v4" data-i18n="preserve">
    <header className={styles.hero}><h1 className="home-v4__title">{text.labels[kindIndex[kind]]}</h1><p className="home-v4__subtitle">{translateSurfaceText(trustIntroductions[sourceLocale][kindIndex[kind]], locale, uiText)}</p></header>
    <div className={styles.body}>
    <nav aria-label={text.labels[5]} className={styles.navigation}><p>{text.labels[5]}</p>{(["contact","support","privacy","terms","mcp"] as const).map(k => <a key={k} href={withLocalePrefix(`/${k}`,locale)} aria-current={kind === k ? "page" : undefined}>{text.labels[kindIndex[k]]}</a>)}</nav>
    <div className={styles.content}>
    {kind === "mcp" && <div className={styles.install}><PluginInstallLink labels={text.labels} /></div>}
    {text[kind].map((p,index) => {
      if (kind === "mcp" && index === 2) return null;
      const split = kind === "privacy" ? p.search(/[:：]/) : -1;
      return <section key={p}>{split > 0 ? <><h2>{p.slice(0,split)}</h2><p>{p.slice(split+1).trim()}</p></> : <p>{p}</p>}
        {kind === "privacy" && index === 0 ? <AnalyticsPreferenceControl labels={text.labels} /> : null}
        {kind === "privacy" && index === 3 ? <SupportMailboxDetails locale={sourceLocale} /> : null}
      </section>;
    })}
    {kind === "privacy" ? <section><h2>Microsoft Clarity</h2><p>{clarity.disclosure}</p>
      <p><a href="https://privacy.microsoft.com/privacystatement">Microsoft Privacy Statement</a> · <a href="https://learn.microsoft.com/en-us/clarity/setup-and-installation/data-retention">Microsoft Clarity — data retention</a></p>
      <ClarityPrivacyControl locale={sourceLocale} />
    </section> : null}
    <div className={styles.actions}>
      {(kind === "contact" || kind === "support" || kind === "privacy" || kind === "terms") && <p><a href="mailto:support@eduaipolicy.org">support@eduaipolicy.org</a></p>}
      {kind === "support" && <PluginInstallLink labels={text.labels} />}
    </div>
      {kind === "mcp" && <><PluginGetStarted locale={sourceLocale} /><details className={styles.technical}><summary>{translateSurfaceText(pluginPromotionCopy(sourceLocale).technical, locale, uiText)}</summary><p>{text.mcp[2]}</p><p><a href="/api/public/v1/mcp/manifest.json">REST alpha manifest</a> · <a href="/api/public/v1/mcp/tool-catalog.json">REST alpha tool catalog</a></p><p><code>resolve_university → get_student_policy → get_policy_evidence</code></p></details></>}
    <footer className={styles.note}><p>{text.labels[12]} <a href={`/${kind}`} lang="en">English</a></p></footer>
    </div></div></div>
  </main></ReadingUiTextProvider>;
}
export function localizedTrustPage(kind: TrustPageKind) {
  return async ({params}: Props) => {
    const {locale} = await params;
    if (!isReadingLocale(locale)) notFound();
    return <TrustPage kind={kind} locale={locale} />;
  };
}
export function localizedTrustMetadata(kind: TrustPageKind) {
  return async ({params}: Props) => { const {locale} = await params; if (!isReadingLocale(locale)) notFound(); return trustMetadata(kind,locale); };
}
