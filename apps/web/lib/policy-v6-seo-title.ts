import type {SupportedLocale} from './i18n';
import {getInstitutionLocalizedAliasesByLocale} from './institution-localization';

export const V6_SEO_TITLE_BUDGET = 70;
const siteName = 'University AI Policy Tracker';

// SEO labels only, verified against the university's own site. Formal H1s,
// catalog identities, evidence and citation titles are not rewritten.
const names: Record<string, {preferred: string; short: string; source: string}> = {
  'the-london-school-of-economics-and-political-science': {preferred:'London School of Economics and Political Science',short:'LSE',source:'https://www.lse.ac.uk/'},
  'massachusetts-institute-of-technology': {preferred: 'Massachusetts Institute of Technology', short: 'MIT', source: 'https://www.mit.edu/'},
  'california-institute-of-technology': {preferred: 'California Institute of Technology', short: 'Caltech', source: 'https://www.caltech.edu/about/at-a-glance'},
  'eth-zurich': {preferred: 'ETH Zurich', short: 'ETH Zurich', source: 'https://ethz.ch/en.html'},
  'national-university-of-singapore': {preferred: 'National University of Singapore', short: 'NUS', source: 'https://nus.edu.sg/'},
  'nanyang-technological-university': {preferred: 'Nanyang Technological University, Singapore', short: 'NTU Singapore', source: 'https://www.ntu.edu.sg/about-us/'},
  ucl: {preferred: 'University College London', short: 'UCL', source: 'https://www.ucl.ac.uk/about/who-we-are'},
  'university-of-california-berkeley': {preferred: 'University of California, Berkeley', short: 'UC Berkeley', source: 'https://www.berkeley.edu/'}
};

const copy: Record<SupportedLocale, {policy: string; sources: string; separator: string}> = {
  en: {policy: 'AI Policy', sources: 'AI Policy & Sources', separator: ' '},
  zh: {policy: 'AI 政策', sources: 'AI 政策与来源', separator: ' '},
  fr: {policy: 'Politique d’IA', sources: 'Politique d’IA et sources', separator: ' — '},
  pl: {policy: 'Polityka AI', sources: 'Polityka AI i źródła', separator: ' — '},
  es: {policy: 'Política de IA', sources: 'Política de IA y fuentes', separator: ' — '},
  nl: {policy: 'AI-beleid', sources: 'AI-beleid en bronnen', separator: ' — '},
  ms: {policy: 'Dasar AI', sources: 'Dasar AI dan sumber', separator: ' — '}
};

interface TitleOptions {
  includeBrand?: boolean;
  emphasizeSources?: boolean;
}

/** Preserve identity before optional sources/branding; never cut a school name. */
export function buildPolicyV6SeoTitle(slug: string, canonicalName: string, locale: SupportedLocale, options: TitleOptions = {}): string {
  const mapped = names[slug];
  const localized = getInstitutionLocalizedAliasesByLocale(slug, locale)[0];
  const preferred = localized ?? mapped?.preferred ?? canonicalName;
  const candidates = [preferred, ...(mapped ? [mapped.short] : [])];
  const labels = options.emphasizeSources ? [copy[locale].sources, copy[locale].policy] : [copy[locale].policy];
  for (const name of candidates) {
    for (const label of labels) {
      const title = `${name}${copy[locale].separator}${label}`;
      const branded = `${title} | ${siteName}`;
      if (options.includeBrand && Array.from(branded).length <= V6_SEO_TITLE_BUDGET) return branded;
      if (Array.from(title).length <= V6_SEO_TITLE_BUDGET) return title;
    }
  }
  // A future unregistered long identity stays intact. Release validation must
  // flag it for a verified mapping rather than breaking the public route.
  return `${preferred}${copy[locale].separator}${copy[locale].policy}`;
}
