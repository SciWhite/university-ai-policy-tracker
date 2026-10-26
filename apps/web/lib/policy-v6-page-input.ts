import type {SupportedLocale} from './i18n';
import {getLocalV6Bundle} from './policy-v6-bundle';
import {getLocalV6Evidence} from './policy-v6-local-evidence';
import {publishedV6School} from './policy-v6-published';
import {v6CorrectedSummary, v6RecordRevision} from './v6-effective-records';
import {acceptV6SchoolInput} from './policy-v6-input';

export function getV6PageInput(slug: string, locale: SupportedLocale) {
  const bundle = getLocalV6Bundle(slug, locale);
  const evidence = getLocalV6Evidence(slug);
  const school = publishedV6School(slug, locale) ?? bundle?.school;
  // Legacy private evidence has its own frozen-record gate; no public identity is inferred.
  if (!school) return {kind: evidence ? 'evidence' as const : 'record' as const, bundle, evidence};
  return acceptV6SchoolInput({school, bundle, evidence}, v6CorrectedSummary(slug), v6RecordRevision(slug)?.recordSha256, {locale});
}
