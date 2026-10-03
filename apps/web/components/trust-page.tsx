import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnalyticsPreferenceControl } from "./analytics-preference-control";
import { PluginInstallLink } from "./plugin-install-link";
import { SupportMailboxDetails } from "./support-mailbox-details";
import { getTrustContent, trustIntroductions, type TrustPageKind } from "@/lib/trust-content";
import { isSupportedLocale, withLocalePrefix, SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/i18n";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import styles from "./trust-page.module.css";
const kindIndex = { contact:0, support:1, privacy:2, terms:3, mcp:4 } as const;
type Props = { params: Promise<{ locale: string }> };
export function trustMetadata(kind: TrustPageKind, locale: SupportedLocale = "en"): Metadata {
  const text = getTrustContent(locale);
  return { title: `${text.labels[kindIndex[kind]]} | University AI Policy Tracker`, description: trustIntroductions[locale][kindIndex[kind]],
    alternates: { canonical: getAbsoluteSiteUrl(withLocalePrefix(`/${kind}`,locale)), languages: Object.fromEntries(SUPPORTED_LOCALES.map(l => [l,getAbsoluteSiteUrl(withLocalePrefix(`/${kind}`,l))])) } };
}
export function TrustPage({ kind, locale = "en" }: { kind: TrustPageKind; locale?: SupportedLocale }) {
  const text = getTrustContent(locale);
  return <main className="page-shell home-v4-shell page-shell--wide" data-trust-layout="v4">
    <div className="home-v4" data-i18n="preserve">
    <header className={styles.hero}><h1 className="home-v4__title">{text.labels[kindIndex[kind]]}</h1><p className="home-v4__subtitle">{trustIntroductions[locale][kindIndex[kind]]}</p></header>
    <div className={styles.body}>
    <nav aria-label={text.labels[5]} className={styles.navigation}><p>{text.labels[5]}</p>{(["contact","support","privacy","terms","mcp"] as const).map(k => <a key={k} href={withLocalePrefix(`/${k}`,locale)} aria-current={kind === k ? "page" : undefined}>{text.labels[kindIndex[k]]}</a>)}</nav>
    <div className={styles.content}>
    {text[kind].map((p,index) => {
      const split = kind === "privacy" ? p.search(/[:：]/) : -1;
      return <section key={p}>{split > 0 ? <><h2>{p.slice(0,split)}</h2><p>{p.slice(split+1).trim()}</p></> : <p>{p}</p>}
        {kind === "privacy" && index === 0 ? <AnalyticsPreferenceControl labels={text.labels} /> : null}
        {kind === "privacy" && index === 3 ? <SupportMailboxDetails locale={locale} /> : null}
      </section>;
    })}
    <div className={styles.actions}>
      {(kind === "contact" || kind === "support" || kind === "privacy" || kind === "terms") && <p><a href="mailto:support@eduaipolicy.org">support@eduaipolicy.org</a></p>}
      {(kind === "mcp" || kind === "support") && <PluginInstallLink labels={text.labels} />}
    </div>
      {kind === "mcp" && <div className={styles.technical}><p><a href="/api/public/v1/mcp/manifest.json">REST alpha manifest</a> · <a href="/api/public/v1/mcp/tool-catalog.json">REST alpha tool catalog</a></p><p><code>resolve_university → get_student_policy → get_policy_evidence</code></p></div>}
    <footer className={styles.note}><p>{text.labels[12]} <a href={`/${kind}`} lang="en">English</a></p></footer>
    </div></div></div>
  </main>;
}
export function localizedTrustPage(kind: TrustPageKind) {
  return async ({params}: Props) => {
    const {locale} = await params;
    if (!isSupportedLocale(locale)) notFound();
    return <TrustPage kind={kind} locale={locale} />;
  };
}
export function localizedTrustMetadata(kind: TrustPageKind) {
  return async ({params}: Props) => { const {locale} = await params; if (!isSupportedLocale(locale)) notFound(); return trustMetadata(kind,locale); };
}
