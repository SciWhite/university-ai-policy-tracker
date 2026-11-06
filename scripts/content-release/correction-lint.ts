/**
 * Review-checklist lints for `content:correct` (docs/content-release.md §12).
 * They encode the checks that caught real problems in the first post-R1
 * correction release (9 schools, 2026-11-06):
 *
 *   generic-entity-summary   entity summary replaced by generic claim/source counts
 *   zh-missing-facts         zh copy drops numbers, names or most of the length of en
 *   checked-at-before-evidence  a checked date older than the evidence it cites (hard)
 *   summary-sentence-unsupported a topic summary sentence with no support in that topic's evidence
 *   claim-without-topic      a claim the correction leaves (or puts) in no topic (hard)
 *   placeholder-scope        empty, TODO-like or untranslated scope text (hard)
 *
 * Hard findings always block. Review findings block unless the decisions file
 * acknowledges them (`lintAcknowledgements`: code + slug + target + reason).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

export type LintSeverity = "error" | "review";
export interface LintFinding { code: string; severity: LintSeverity; slug: string; target: string; message: string }
export interface LintAcknowledgement { code: string; slug: string; target: string; reason: string }
export interface LintReport { findings: LintFinding[]; acknowledged: (LintFinding & { reason: string })[]; blocking: LintFinding[]; notes: string[] }

export interface LintInput {
  slugs: string[];
  /** Claim IDs the correction adds or corrects, per school. */
  touched: Record<string, string[]>;
  parent: { records: Json; pages: Json };
  next: { records: Json; pages: Json };
  /** Bilingual copy the decisions file supplies, per school. */
  presentation: Record<string, Json>;
}

const COUNT_PHRASE = /\b\d+\s+(?:current\s+|reviewed\s+|published\s+)*(?:source-backed\s+)?(?:AI policy\s+)?(?:claims?|claim records?|record claims|official source attributions?|source attributions?|official sources?|sources)\b/gi;
const ZH_COUNT_PHRASE = /\d+\s*(?:条|项|个|份|处)/g;
const BOILERPLATE = new Set(("with and the of a an are is was by this that for to in on from as its their under remains remain retained update updates approved " +
  "course courses assessment assessments research data institutional institution tool tools scope scopes distinguished audit partial held decisions decision remaining " +
  "coverage gaps gap source sources representation limits limit public student students snapshot snapshots current source-backed claim claims official attribution " +
  "attributions reviewed review records record policy policies university universities tracker evidence summary no not any").split(/\s+/));
const words = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter(token => token.length > 2 && !/^\d+$/.test(token));
const cjk = (text: string) => [...text].filter(ch => /\p{Script=Han}/u.test(ch)).length;

/** A summary that says how many claims/sources exist but nothing about the policy. */
export function isGenericCountSummary(text: string, name = "", language: "en" | "zh" = "en"): boolean {
  if (!text?.trim()) return true;
  if (language === "zh") {
    const counts = text.match(ZH_COUNT_PHRASE)?.length ?? 0;
    const content = cjk(text.replace(name, "").replace(/来源|声明|条目|官方|当前|审核|记录|政策|大学|证据|快照|学生|公开|范围|保留|缺口|决定|暂缓|审计|部分|更新|批准|研究|课程|评估|数据|工具|机构/g, ""));
    return counts > 0 && content < 25;
  }
  if (!text.match(COUNT_PHRASE)) return false;
  const nameWords = new Set(words(name));
  const content = new Set(words(text.replace(COUNT_PHRASE, " ")).filter(token => !BOILERPLATE.has(token) && !nameWords.has(token)));
  return content.size < 6;
}

const NUMBER = /\d+(?:[.,:/-]\d+)*/g;
// Brand names and acronyms that zh copy keeps in Latin script (ChatGPT Edu, UQ, BCA, Copilot 365...).
const LATIN_NAME = /\b(?:[A-Z][A-Za-z0-9+.-]*[A-Z0-9][A-Za-z0-9+.-]*|[A-Z]{2,})\b/g;

/** zh copy that drops facts the en copy states: numbers, Latin names, or most of the length. */
export function zhFactGaps(en: string, zh: string): string[] {
  const gaps: string[] = [];
  if (!zh?.trim()) return ["zh text is empty"];
  const missingNumbers = [...new Set(en.match(NUMBER) ?? [])].filter(number => !zh.includes(number));
  if (missingNumbers.length) gaps.push(`numbers missing in zh: ${missingNumbers.join(", ")}`);
  const missingNames = [...new Set(en.match(LATIN_NAME) ?? [])].filter(name => !zh.includes(name));
  if (missingNames.length) gaps.push(`names missing in zh: ${missingNames.join(", ")}`);
  // zh needs roughly 0.3-0.6 characters per en character; far below that, facts were dropped.
  const ratio = (cjk(zh) + words(zh).length * 4) / Math.max(1, en.length);
  if (en.length >= 80 && ratio < 0.22) gaps.push(`zh is much shorter than en (${zh.length} vs ${en.length} characters)`);
  if (/[a-z]{4,}\s+[a-z]{4,}\s+[a-z]{4,}/.test(zh) && cjk(zh) === 0) gaps.push("zh text is untranslated English");
  return gaps;
}

const PLACEHOLDER = /^\s*$|\b(?:TBD|TODO|FIXME|XXX|placeholder|lorem ipsum|to be confirmed|to be added|待定|待补充|占位)\b|^\s*(?:n\/a|na|none|null|undefined|-|—|…|\.\.\.)\s*$|\{\{[^}]*\}\}|<[a-z][^>]*>/i;

/** Scope text a student would read as a real caveat: not empty, a template token, or the en text in the zh slot. */
export function placeholderScope(text: unknown, language: "en" | "zh", counterpart?: string, title?: string): string | undefined {
  if (typeof text !== "string") return "scope is missing";
  if (PLACEHOLDER.test(text)) return `placeholder scope: ${JSON.stringify(text.slice(0, 60))}`;
  if (text.trim().length < 12) return `scope too short to state a scope: ${JSON.stringify(text)}`;
  if (title && text.trim().toLowerCase() === title.trim().toLowerCase()) return "scope repeats the topic title";
  if (language === "zh" && cjk(text) === 0) return "zh scope has no Chinese text";
  if (language === "zh" && counterpart && text.trim() === counterpart.trim()) return "zh scope is the en text";
  return undefined;
}

const SENTENCE = /(?<=[.!?;])\s+(?=[A-Z0-9"“(])/;
const STOP = new Set("about above after again against also because been before being below between both cannot could does doing during each from further have having here into itself more most must only other over same should some such than that their them then there these they this those through under until very were what when where which while will with would your students student university policy guidance course courses".split(" "));

/** Sentences of a topic summary whose facts are not in that topic's claims or evidence. */
export function unsupportedSentences(summary: string, evidenceText: string, ownNames: string[] = []): string[] {
  const haystack = evidenceText.toLowerCase();
  const own = new Set(ownNames.map(name => name.toLowerCase()));
  const out: string[] = [];
  for (const sentence of summary.split(SENTENCE).map(item => item.trim()).filter(Boolean)) {
    const salient = [...new Set([...(sentence.match(NUMBER) ?? []), ...(sentence.match(LATIN_NAME) ?? []), ...[...sentence.matchAll(/[“"]([^”"]{4,})[”"]/g)].map(match => match[1])])];
    if (salient.length) {
      // The school's own name and abbreviations need no evidence.
      const missing = salient.filter(token => !own.has(token.toLowerCase()) && !haystack.includes(token.toLowerCase()));
      if (missing.length) out.push(`${sentence} [not in topic evidence: ${missing.join(", ")}]`);
      continue;
    }
    const content = [...new Set(words(sentence).filter(token => token.length >= 5 && !STOP.has(token)))];
    const shared = content.filter(token => haystack.includes(token.slice(0, Math.max(5, token.length - 2))));
    if (content.length >= 3 && shared.length < Math.min(2, content.length)) out.push(`${sentence} [no shared terms with topic evidence]`);
  }
  return out;
}

const pageSchool = (pages: Json, locale: string, slug: string) => pages?.locales?.[locale]?.schools?.find((school: Json) => school.slug === slug);
const summaryOf = (records: Json, slug: string) => records?.summaries?.find((summary: Json) => summary.entity.slug === slug);
const topicsOf = (school: Json): Json[] => school ? [...(school.topics ?? []), ...(school.additionalTopics ?? [])] : [];
const newest = (dates: (string | undefined)[]) => dates.filter((date): date is string => Boolean(date) && Number.isFinite(Date.parse(date!))).sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1);
const before = (a: string | undefined, b: string | undefined) => Boolean(a && b && Date.parse(a) < Date.parse(b));

/** The school's name, aliases and their initials ("UQ", "CMU"), which summaries use without quoting evidence. */
function ownNames(record: Json, slug: string): string[] {
  const names: string[] = [record?.entity?.name, ...(record?.entity?.aliases ?? []), slug].filter((name: unknown): name is string => typeof name === "string");
  const initials = names.map(name => name.split(/[\s-]+/).filter(word => /^[A-Z]/.test(word) || /^[a-z]{3,}$/.test(word)).filter(word => !/^(of|the|and|at|de|la)$/i.test(word)).map(word => word[0].toUpperCase()).join(""));
  return [...names, ...initials.filter(value => value.length >= 2), ...names.flatMap(name => name.match(LATIN_NAME) ?? [])];
}

/** Claim IDs a school page places: in a topic, a student-action row or an explicit disposition. */
export function placedClaimIds(pages: Json, slug: string): Set<string> {
  const school = pageSchool(pages, "en", slug);
  const view = pages?.locales?.en?.views?.[slug];
  return new Set<string>([
    ...topicsOf(school).flatMap(topic => (topic.claims ?? []).map((claim: Json) => claim.id)),
    ...Object.keys(view?.studentActions?.claims ?? {}),
    ...(view?.claimDispositions ?? []).map((disposition: Json) => disposition.claimId)
  ]);
}

export function lintCorrection(input: LintInput): LintFinding[] {
  const findings: LintFinding[] = [];
  const add = (severity: LintSeverity, code: string, slug: string, target: string, message: string) => findings.push({ code, severity, slug, target, message });
  for (const slug of input.slugs) {
    const record = summaryOf(input.next.records, slug), parentRecord = summaryOf(input.parent.records, slug);
    const presentation = input.presentation[slug] ?? {};
    const touched = new Set(input.touched[slug] ?? []);
    const name = record?.entity?.name ?? slug;

    // Entity summary: a correction must not trade a specific summary for generic counts.
    for (const locale of ["en", "zh"] as const) {
      const now = input.next.pages?.locales?.[locale]?.entities?.[slug]?.summary;
      const was = input.parent.pages?.locales?.[locale]?.entities?.[slug]?.summary;
      if (typeof now === "string" && isGenericCountSummary(now, name, locale) && !(typeof was === "string" && isGenericCountSummary(was, name, locale))) {
        add("review", "generic-entity-summary", slug, `entities/${locale}`, `entity summary became a generic count: ${JSON.stringify(now.slice(0, 160))}`);
      }
    }
    for (const [field, value] of [["record/summary", record?.summary], ["record/entity.summary", record?.entity?.summary]] as const) {
      const was = field === "record/summary" ? parentRecord?.summary : parentRecord?.entity?.summary;
      if (typeof value === "string" && value !== was && isGenericCountSummary(value, name) && !(typeof was === "string" && isGenericCountSummary(was, name))) {
        add("review", "generic-entity-summary", slug, field, `record summary became a generic count: ${JSON.stringify(value.slice(0, 160))}`);
      }
    }

    // zh must carry the facts of en for every bilingual text the correction supplies.
    const pairs: [string, Json][] = [
      ...(presentation.entitySummary ? [["entitySummary", presentation.entitySummary]] as [string, Json][] : []),
      ...Object.entries(presentation.topicSummaries ?? {}).map(([key, value]) => [`topicSummaries/${key}`, value] as [string, Json]),
      ...Object.entries(presentation.topicScopes ?? {}).map(([key, value]) => [`topicScopes/${key}`, value] as [string, Json]),
      ...Object.entries(presentation.statusOverrides ?? {}).map(([key, value]) => [`statusOverrides/${key}`, value] as [string, Json])
    ];
    for (const [target, value] of pairs) for (const gap of zhFactGaps(value?.en ?? "", value?.zh ?? "")) add("review", "zh-missing-facts", slug, target, gap);

    // Checked dates follow the newest evidence they cite.
    for (const claim of record?.claims ?? []) {
      const cited = newest((claim.evidence ?? []).map((evidence: Json) => evidence.retrievedAt));
      if (touched.has(claim.id) && before(claim.lastCheckedAt, cited)) add("error", "checked-at-before-evidence", slug, `claims/${claim.id}`, `lastCheckedAt ${claim.lastCheckedAt} is older than its evidence (${cited})`);
    }
    const newestTouched = newest((record?.claims ?? []).filter((claim: Json) => touched.has(claim.id)).flatMap((claim: Json) => (claim.evidence ?? []).map((evidence: Json) => evidence.retrievedAt)));
    if (before(record?.lastCheckedAt, newestTouched)) add("error", "checked-at-before-evidence", slug, "record/lastCheckedAt", `record lastCheckedAt ${record.lastCheckedAt} is older than corrected evidence (${newestTouched})`);
    for (const locale of Object.keys(input.next.pages?.locales ?? {})) {
      const school = pageSchool(input.next.pages, locale, slug);
      if (school && before(school.checkedAt, newestTouched)) add("error", "checked-at-before-evidence", slug, `pages/${locale}/checkedAt`, `page checkedAt ${school.checkedAt} is older than corrected evidence (${newestTouched})`);
      for (const topic of topicsOf(school)) for (const claim of topic.claims ?? []) {
        if (!touched.has(claim.id) || !("checkedAt" in claim)) continue;
        const cited = newest((claim.evidence ?? []).map((evidence: Json) => evidence.retrievedAt));
        if (before(claim.checkedAt, cited)) add("error", "checked-at-before-evidence", slug, `pages/${locale}/topics/${topic.key}/${claim.id}`, `presentation checkedAt ${claim.checkedAt} is older than its evidence (${cited})`);
      }
    }

    // Every summary sentence the correction writes is backed by that topic's evidence group.
    const enSchool = pageSchool(input.next.pages, "en", slug);
    const claimsById = new Map<string, Json>((record?.claims ?? []).map((claim: Json) => [claim.id, claim]));
    for (const [key, value] of Object.entries(presentation.topicSummaries ?? {}) as [string, Json][]) {
      const topic = topicsOf(enSchool).find(item => item.key === key);
      if (!topic) { add("error", "summary-sentence-unsupported", slug, `topicSummaries/${key}`, "topic is not on the school page"); continue; }
      const evidence = (topic.claims ?? []).flatMap((claim: Json) => [claim.text, ...(claim.evidence ?? []).map((item: Json) => item.quote), claimsById.get(claim.id)?.claimText, ...(claimsById.get(claim.id)?.evidence ?? []).map((item: Json) => item.evidenceSnippet)]);
      const view = input.next.pages?.locales?.en?.views?.[slug];
      for (const [id, row] of Object.entries(view?.studentActions?.claims ?? {}) as [string, Json][]) if ((topic.claims ?? []).some((claim: Json) => claim.id === id) || (row.topics ?? []).includes?.(key)) evidence.push(row.text, ...(row.evidence ?? []).map((item: Json) => item.quote));
      for (const sentence of unsupportedSentences(value?.en ?? "", evidence.filter(Boolean).join("\n"), ownNames(record, slug))) add("review", "summary-sentence-unsupported", slug, `topicSummaries/${key}`, sentence);
    }

    // No claim is left in (or added to) no topic.
    const placedNow = placedClaimIds(input.next.pages, slug), placedBefore = placedClaimIds(input.parent.pages, slug);
    const parentIds = new Set((parentRecord?.claims ?? []).map((claim: Json) => claim.id));
    for (const claim of record?.claims ?? []) {
      if (placedNow.has(claim.id)) continue;
      if (!parentIds.has(claim.id)) add("error", "claim-without-topic", slug, `claims/${claim.id}`, "added claim is shown in no topic, student-action row or disposition (use claim.topics)");
      else if (placedBefore.has(claim.id)) add("error", "claim-without-topic", slug, `claims/${claim.id}`, "claim was shown in a topic before this correction and no longer is");
    }

    // Scopes students read as caveats are real text in both languages.
    const titles = new Map<string, string>(topicsOf(enSchool).map(topic => [topic.key, topic.title]));
    for (const [key, value] of Object.entries(presentation.topicScopes ?? {}) as [string, Json][]) {
      for (const language of ["en", "zh"] as const) {
        const problem = placeholderScope(value?.[language], language, value?.en, titles.get(key));
        if (problem) add("error", "placeholder-scope", slug, `topicScopes/${key}/${language}`, problem);
      }
    }
    for (const [id, scope] of Object.entries(presentation.claimScopes ?? {})) {
      const problem = placeholderScope(scope, "en");
      if (problem) add("error", "placeholder-scope", slug, `claimScopes/${id}`, problem);
    }
    const view = input.next.pages?.locales?.en?.views?.[slug], parentView = input.parent.pages?.locales?.en?.views?.[slug];
    for (const [key, value] of Object.entries(view?.topicScopes ?? {}) as [string, Json][]) {
      if (presentation.topicScopes?.[key] || JSON.stringify(parentView?.topicScopes?.[key]) === JSON.stringify(value)) continue;
      for (const language of ["en", "zh"] as const) {
        const problem = placeholderScope(value?.[language], language, value?.en, titles.get(key));
        if (problem) add("error", "placeholder-scope", slug, `view/topicScopes/${key}/${language}`, problem);
      }
    }
  }
  return findings;
}

/** Apply acknowledgements: hard findings always block; review findings need a recorded reason. */
export function resolveLint(findings: LintFinding[], acknowledgements: LintAcknowledgement[] = []): LintReport {
  const acknowledged: LintReport["acknowledged"] = [], blocking: LintFinding[] = [], notes: string[] = [];
  const used = new Set<LintAcknowledgement>();
  for (const finding of findings) {
    const ack = finding.severity === "review" ? acknowledgements.find(item => item.code === finding.code && item.slug === finding.slug && item.target === finding.target && item.reason?.trim().length >= 10) : undefined;
    if (ack) { acknowledged.push({ ...finding, reason: ack.reason }); used.add(ack); }
    else blocking.push(finding);
  }
  for (const ack of acknowledgements) if (!used.has(ack)) notes.push(`Unused lint acknowledgement: ${ack.code} ${ack.slug} ${ack.target}`);
  return { findings, acknowledged, blocking, notes };
}
