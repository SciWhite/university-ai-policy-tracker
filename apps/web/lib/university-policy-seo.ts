import type {PublicEntitySummary} from '@uapt/shared';
import type {SupportedLocale} from './i18n';
import {getLocalizedAlternates} from './i18n-metadata';
import {getIndexRecoveryPilotLocaleRestriction} from './index-recovery-pilot';
import {getLocalizedInstitutionName} from './institution-localization';
import {getAbsoluteSiteUrl} from './site-url';
import {buildPolicyV6SeoTitle} from './policy-v6-seo-title';

/** UI metadata only; does not assert approved policy translations or snapshot status. */
export function universityPolicySeo(summary: PublicEntitySummary, locale: SupportedLocale) {
  const slug = summary.entity.slug;
  const name = getLocalizedInstitutionName(slug, summary.entity.name, locale);
  const title = buildPolicyV6SeoTitle(slug, summary.entity.name, locale);
  const description = locale === 'zh'
    ? `查看${name}的 AI 使用政策记录、已审核条款及官方来源。课程、考试和院系的具体要求以原始证据为准；工具可用不代表获准用于考核。`
    : `Explore ${name}'s AI policy record, reviewed claims and official sources. Course, assessment and unit conditions remain distinct; tool access does not grant assessment permission.`;
  const restriction = getIndexRecoveryPilotLocaleRestriction(slug);
  const alternates = getLocalizedAlternates(`/universities/${slug}`, locale, restriction ? {restrictLocales: restriction} : undefined);
  return {title, description, alternates};
}

export function universityPolicyStructuredData(summary: PublicEntitySummary, locale: SupportedLocale) {
  const seo = universityPolicySeo(summary, locale);
  const url = String(seo.alternates.canonical);
  return {
    '@context': 'https://schema.org', '@type': 'WebPage', inLanguage: locale, name: seo.title, description: seo.description, url,
    dateModified: summary.lastChangedAt ?? summary.lastCheckedAt,
    isPartOf: {'@type': 'WebSite', name: 'University AI Policy Tracker', url: getAbsoluteSiteUrl('/')},
    mainEntity: {'@type': 'Dataset', name: summary.citationTitle, description: seo.description,
      url: summary.publicPageUrl ?? summary.canonicalUrl,
      license: 'https://creativecommons.org/licenses/by/4.0/', isAccessibleForFree: true,
      creator: {'@type': 'Organization', name: 'University AI Policy Tracker', url: getAbsoluteSiteUrl('/')},
      distribution: {'@type': 'DataDownload', name: `${summary.entity.name} public JSON record`, encodingFormat: 'application/json',
        contentUrl: summary.apiUrl ?? getAbsoluteSiteUrl(`/api/public/v1/universities/${summary.entity.slug}.json`)}}
  };
}
