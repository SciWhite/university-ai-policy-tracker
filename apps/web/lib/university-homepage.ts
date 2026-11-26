import homepages from "./university-homepages.json";
import type { PublicEntitySummary } from "@uapt/shared";

export interface OfficialHomepage {
  url: string;
  checkedAt: string;
}

export function legacyUniversityHomepage(slug: string): string | undefined {
  return Object.hasOwn(homepages, slug) ? homepages[slug as keyof typeof homepages] : undefined;
}

function parseUrl(value: string): URL | undefined {
  try { return new URL(value); } catch { return undefined; }
}

function homepageUrl(value: unknown): URL | undefined {
  // Plain HTTPS host, with at most two short path segments and no URL modifiers.
  if (typeof value !== "string" || value.trim() !== value || !/^https:\/\/[a-z0-9.-]+(?:\/[a-z0-9_-][a-z0-9._-]{0,31}){0,2}\/?$/i.test(value)) return;
  const url = parseUrl(value);
  if (!url) return;
  const host = url.hostname;
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]+$/.test(host) ||
      host === "eduaipolicy.org" || host.endsWith(".eduaipolicy.org")) return;
  return url;
}

export function universityHomepageHref(slug: string, homepage?: OfficialHomepage) {
  const href = homepage === undefined ? legacyUniversityHomepage(slug) : homepage?.url;
  return homepageUrl(href) ? href : undefined;
}

function homepageHostMatchesRecord(hostname: string, summary: PublicEntitySummary) {
  const host = hostname.replace(/^www\./, "");
  const labels = host.split(".");
  // A new root can be corroborated by a departmental source beneath it.
  if (labels.length === 2 && labels[1].length === 2 &&
      /^(?:ac|co|com|edu|gov|net|org|sch)$/.test(labels[0])) return false;
  const urls = [
    legacyUniversityHomepage(summary.entity.slug),
    ...summary.officialSources.filter(source => source.official !== false).flatMap(source => [source.sourceUrl, source.finalUrl]),
  ];
  return urls.some(reference => {
    const candidate = reference ? parseUrl(reference) : undefined;
    if (!candidate || !["http:", "https:"].includes(candidate.protocol)) return false;
    const known = candidate.hostname.replace(/^www\./, "");
    return known === host || known.endsWith("." + host);
  });
}

export function isOfficialHomepageCandidate(value: string, summary: PublicEntitySummary) {
  const url = homepageUrl(value);
  return Boolean(url && homepageHostMatchesRecord(url.hostname, summary));
}

export function validateOfficialHomepage(value: unknown, slug: string, summary?: PublicEntitySummary): OfficialHomepage {
  const fail = (reason: string): never => { throw Error(`${slug}: invalid officialHomepage (${reason})`); };
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => key !== "url" && key !== "checkedAt")) return fail("expected url and checkedAt");
  const { url, checkedAt } = value as OfficialHomepage;
  const parsed = homepageUrl(url);
  if (!parsed) return fail("expected an HTTPS homepage with a plain host and short path");
  if (typeof checkedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(checkedAt) ||
      !Number.isFinite(Date.parse(checkedAt)) || new Date(checkedAt).toISOString().slice(0, 10) !== checkedAt) return fail("expected a valid YYYY-MM-DD check date");

  if (summary && !homepageHostMatchesRecord(parsed.hostname, summary)) return fail("host is outside the school's recorded domains");
  return { url, checkedAt };
}

export function validateOfficialHomepages(value: unknown, slugs: readonly string[], summaries: readonly PublicEntitySummary[]) {
  if (value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Invalid V6 officialHomepages map");
  const scope = new Set(slugs);
  const bySlug = new Map(summaries.map(summary => [summary.entity.slug, summary]));
  for (const [slug, homepage] of Object.entries(value)) {
    const summary = bySlug.get(slug);
    if (!scope.has(slug) || !summary) throw Error("Official homepage outside V6 school scope: " + slug);
    validateOfficialHomepage(homepage, slug, summary);
  }
}
