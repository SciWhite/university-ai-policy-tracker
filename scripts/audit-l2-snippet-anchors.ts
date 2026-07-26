/**
 * L2 snippet anchoring: does the published evidence still exist on the live page?
 *
 * This is the layer that answers the actual question. L1 could only report
 * whether a page is reachable and whether its whole-page hash changed, and that
 * hash is dominated by navigation and banner churn — only 4% of pages were
 * byte-identical, which says nothing about whether any *policy* moved.
 *
 * L2 asks something falsifiable instead: for every published evidence record,
 * is the quoted snippet still present in the text the live page serves today?
 *
 * Matching runs on normalized text (NFKC, unified quotes/dashes, collapsed
 * whitespace, casefolded) and reports:
 *
 *   present     the quote is there verbatim, or verbatim after normalization
 *   drifted     most of the quote survives but the wording around it moved
 *   absent      the quote is gone from the page that is cited for it
 *   unverifiable  no live text to compare against, or the snippet cannot be
 *                 matched in principle
 *
 * `absent` is the finding that matters: the site still serves a page, so no
 * link checker flags it, but the sentence the tracker quotes is no longer on it.
 *
 * Three snippet defects from L0 are handled explicitly rather than silently
 * scoring badly:
 *   - snippets stored as an English paraphrase of a non-English source cannot
 *     be matched at all (unverifiable_paraphrase)
 *   - snippets ending in an ellipsis are matched on their prefix only
 *   - snippets under 40 characters are matched but flagged, because a short
 *     string can match by chance
 *
 * Read-only and offline: consumes the page text L1 cached under .local and
 * never fetches, never edits staged artifacts or review states.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getStagedPublicDataset } from "../apps/web/lib/staged-public-data";
import { findRepoRoot } from "../apps/web/lib/repo-root";

const OUTPUT_ROOT = ".local/full-audit";
const WEAK_ANCHOR_CHARS = 40;
const PRESENT_THRESHOLD = 0.85;
const DRIFT_THRESHOLD = 0.4;
// Below this much captured text the page is a shell or an error body, not a
// fair witness. Scoring a quote "absent" against it would be a false positive.
const MIN_TRUSTWORTHY_PAGE_CHARS = 1_000;
// A verbatim run this long surviving on the page means the quote was edited
// around, not removed. Trigram coverage alone can score such a page below the
// drift threshold when the rest of the sentence was rewritten.
const SURVIVING_RUN_WORDS = 8;
// Office documents are ZIP containers. L1 fetches them and runs an HTML
// stripper over the raw bytes, which yields the ZIP header rather than prose,
// so any quote scored against that "text" is guaranteed not to match. These
// need a real docx/pptx extractor before they can be anchored at all.
const OFFICE_DOCUMENT_PATTERN = /\.(?:docx?|pptx?|xlsx?|odt|odp|ods|rtf)(?:$|\?)/i;
const BINARY_CAPTURE_PATTERN = /\[Content_Types\]\.xml|^PK\u0003\u0004|%PDF-/;
const SAMPLE_LIMIT = 40;
// Reported-speech markers, the same set scripts/validate-openclaw-artifacts.ts
// uses to catch a paraphrase stored as the "original" snippet. A snippet
// written as "X says that ..." was authored by the extraction agent, not copied
// off the page, so it can never anchor. Measured on this dataset the marker
// appears in 45.6% of non-matching snippets versus 0.9% of matching ones — a
// 50x skew, which is why a failure to match is attributed to the snippet rather
// than reported as vanished policy text.
const ENGLISH_REPORTING_PATTERN =
  /\b(says|states|describes|indicates|announces|presents|reports|lists)\b/i;

// Scripts whose presence proves a snippet is in the source language. If a
// snippet declares one of these and contains none of it, the stored "original"
// is a translation and cannot be anchored against the live page.
const SCRIPT_RANGES: Array<{ pattern: RegExp; prefixes: string[] }> = [
  { pattern: /[؀-ۿ]/, prefixes: ["ar", "fa", "ur"] },
  { pattern: /[֐-׿]/, prefixes: ["he"] },
  { pattern: /[Ѐ-ӿ]/, prefixes: ["ru", "uk", "bg", "sr", "mk", "be"] },
  { pattern: /[Ͱ-Ͽ]/, prefixes: ["el"] },
  { pattern: /[฀-๿]/, prefixes: ["th"] },
  { pattern: /[ऀ-ॿ]/, prefixes: ["hi", "mr", "ne"] },
  { pattern: /[一-鿿]/, prefixes: ["zh"] },
  { pattern: /[぀-ヿ一-鿿]/, prefixes: ["ja"] },
  { pattern: /[가-힯]/, prefixes: ["ko"] }
];

type Verdict = "absent" | "drifted" | "present" | "unverifiable";

interface AnchorRow {
  coverage: number;
  entitySlug: string;
  flags: string[];
  liveStatus?: string;
  matchKind: string;
  snippetHead: string;
  snippetLength: number;
  sourceLanguage?: string;
  sourceUrl: string;
  verdict: Verdict;
}

void main();

async function main(): Promise<void> {
  const repoRoot = await findRepoRoot();
  const options = parseArgs(process.argv.slice(2));
  const l1Dir = options.l1Dir ?? (await findLatestL1(repoRoot));
  const runId = `l2-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const outputDir = path.join(l1Dir, runId);
  await mkdir(outputDir, { recursive: true });

  const pages = await loadPageCache(l1Dir);
  const liveStatus = await loadLiveStatus(l1Dir);
  const dataset = await getStagedPublicDataset();

  console.log(`L2 snippet anchoring ${runId}`);
  console.log(`live page texts available: ${pages.size}`);

  const rows: AnchorRow[] = [];
  for (const summary of dataset.publicSummaries) {
    for (const claim of summary.claims) {
      for (const evidence of claim.evidence) {
        const snippet = evidence.evidenceSnippet;
        if (typeof snippet !== "string" || !snippet.trim()) continue;
        rows.push(
          scoreAnchor(
            summary.entity.slug,
            evidence.sourceUrl,
            snippet,
            evidence.sourceLanguage,
            pages,
            liveStatus
          )
        );
      }
    }
  }

  const byVerdict = tally(rows, (row) => row.verdict);
  const report = {
    generatedAt: new Date().toISOString(),
    l1Dir,
    limitations: [
      "A present anchor proves the quoted text is still on the page. It does not prove the surrounding policy is unchanged.",
      "An absent anchor is a citation-integrity finding, not proof the policy reversed. The page may have been rewritten, reorganized, or re-hosted.",
      "Pages that could not be fetched (gated, dead, robots-disallowed) are unverifiable here, not failures."
    ],
    rows,
    runId,
    schemaVersion: "uapt-full-audit-l2-report-v1",
    summary: {
      byMatchKind: tally(rows, (row) => row.matchKind),
      byVerdict,
      evidenceScored: rows.length,
      flags: tally(
        rows.flatMap((row) => row.flags),
        (flag) => flag
      )
    }
  };

  await writeFile(
    path.join(outputDir, "l2-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(outputDir, "l3-targets.json"),
    `${JSON.stringify(buildL3Targets(rows), null, 2)}\n`,
    "utf8"
  );
  await writeFile(path.join(outputDir, "l2-summary.md"), renderMarkdown(report), "utf8");

  console.log(`\nevidence scored: ${rows.length}`);
  console.log(JSON.stringify(byVerdict, null, 2));
  console.log(`\nOutput: ${outputDir}`);
}

function scoreAnchor(
  entitySlug: string,
  sourceUrl: string,
  rawSnippet: string,
  sourceLanguage: string | undefined,
  pages: Map<string, string>,
  liveStatus: Map<string, string>
): AnchorRow {
  const flags: string[] = [];
  const status = liveStatus.get(sourceUrl);
  const base = {
    entitySlug,
    liveStatus: status,
    snippetHead: rawSnippet.slice(0, 120),
    snippetLength: rawSnippet.length,
    sourceLanguage,
    sourceUrl
  };

  // Truncated display snippets ("… continues") only ever quote a prefix, so
  // match the prefix and say so rather than scoring the ellipsis as missing.
  let snippet = rawSnippet.trim();
  if (/(\.\.\.|…)\s*$/.test(snippet)) {
    snippet = snippet.replace(/(\.\.\.|…)\s*$/, "").trim();
    flags.push("truncated_snippet");
  }
  if (snippet.length < WEAK_ANCHOR_CHARS) flags.push("weak_anchor");

  const language = sourceLanguage?.split("-")[0]?.toLowerCase();
  const expectation = language
    ? SCRIPT_RANGES.find((entry) => entry.prefixes.includes(language))
    : undefined;
  if (expectation && !expectation.pattern.test(snippet)) {
    // The stored "original" is a translation; there is nothing to anchor.
    flags.push("script_mismatch");
    return {
      ...base,
      coverage: 0,
      flags,
      matchKind: "unverifiable_paraphrase",
      verdict: "unverifiable"
    };
  }

  if (OFFICE_DOCUMENT_PATTERN.test(sourceUrl)) {
    flags.push("office_document");
    return {
      ...base,
      coverage: 0,
      flags,
      matchKind: "unverifiable_binary_document",
      verdict: "unverifiable"
    };
  }

  const page = pages.get(cacheKey(sourceUrl));
  if (!page) {
    flags.push("no_live_text");
    return {
      ...base,
      coverage: 0,
      flags,
      matchKind: status ? `unverifiable_${status}` : "unverifiable_not_fetched",
      verdict: "unverifiable"
    };
  }

  if (BINARY_CAPTURE_PATTERN.test(page.slice(0, 400))) {
    flags.push("binary_capture");
    return {
      ...base,
      coverage: 0,
      flags,
      matchKind: "unverifiable_binary_document",
      verdict: "unverifiable"
    };
  }

  const normalizedPage = normalize(page);
  const normalizedSnippet = normalize(snippet);

  if (normalizedPage.length < MIN_TRUSTWORTHY_PAGE_CHARS) {
    flags.push("thin_live_text");
    return {
      ...base,
      coverage: 0,
      flags,
      matchKind: "unverifiable_thin_capture",
      verdict: "unverifiable"
    };
  }
  if (!normalizedSnippet) {
    return { ...base, coverage: 0, flags, matchKind: "empty_snippet", verdict: "unverifiable" };
  }

  if (normalizedPage.includes(normalizedSnippet)) {
    return { ...base, coverage: 1, flags, matchKind: "exact", verdict: "present" };
  }

  const coverage = trigramCoverage(normalizedSnippet, normalizedPage);
  if (coverage >= PRESENT_THRESHOLD) {
    return { ...base, coverage, flags, matchKind: "normalized", verdict: "present" };
  }
  if (coverage >= DRIFT_THRESHOLD) {
    return { ...base, coverage, flags, matchKind: "partial", verdict: "drifted" };
  }
  if (hasSurvivingRun(normalizedSnippet, normalizedPage)) {
    flags.push("verbatim_run_survives");
    return { ...base, coverage, flags, matchKind: "partial_run", verdict: "drifted" };
  }
  if (ENGLISH_REPORTING_PATTERN.test(snippet)) {
    flags.push("reported_speech_paraphrase");
    return {
      ...base,
      coverage,
      flags,
      matchKind: "unverifiable_paraphrase_en",
      verdict: "unverifiable"
    };
  }
  return { ...base, coverage, flags, matchKind: "not_found", verdict: "absent" };
}

/**
 * Fraction of the snippet's word trigrams that still occur on the page.
 * Word trigrams beat a raw substring test because a single edited word inside a
 * long quote should read as drift, not as the whole quote vanishing; and they
 * beat bag-of-words because word order is what makes a quote a quote.
 */
function trigramCoverage(snippet: string, page: string): number {
  const snippetGrams = wordTrigrams(snippet);
  if (!snippetGrams.length) {
    // Too short for trigrams (CJK text has few spaces): fall back to character
    // 5-grams so short and unspaced snippets still get a real score.
    const snippetChars = charGrams(snippet, 5);
    if (!snippetChars.size) return page.includes(snippet) ? 1 : 0;
    const pageChars = charGrams(page, 5);
    let hits = 0;
    for (const gram of snippetChars) if (pageChars.has(gram)) hits += 1;
    return hits / snippetChars.size;
  }
  const pageGrams = new Set(wordTrigrams(page));
  let hits = 0;
  for (const gram of snippetGrams) if (pageGrams.has(gram)) hits += 1;
  return hits / snippetGrams.length;
}

/** True when any run of SURVIVING_RUN_WORDS consecutive quote words is still present. */
function hasSurvivingRun(snippet: string, page: string): boolean {
  const words = snippet.split(" ").filter(Boolean);
  if (words.length < SURVIVING_RUN_WORDS) return false;
  for (let index = 0; index + SURVIVING_RUN_WORDS <= words.length; index += 1) {
    if (page.includes(words.slice(index, index + SURVIVING_RUN_WORDS).join(" "))) return true;
  }
  return false;
}

function wordTrigrams(value: string): string[] {
  const words = value.split(" ").filter(Boolean);
  if (words.length < 3) return [];
  const grams: string[] = [];
  for (let index = 0; index + 2 < words.length; index += 1) {
    grams.push(`${words[index]} ${words[index + 1]} ${words[index + 2]}`);
  }
  return grams;
}

function charGrams(value: string, size: number): Set<string> {
  const grams = new Set<string>();
  const compact = value.replace(/ /g, "");
  for (let index = 0; index + size <= compact.length; index += 1) {
    grams.add(compact.slice(index, index + size));
  }
  return grams;
}

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/ /g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function loadPageCache(l1Dir: string): Promise<Map<string, string>> {
  const pages = new Map<string, string>();
  // Later passes supersede earlier ones: a page recovered by the browser is a
  // better witness than the empty shell plain HTTP saw.
  const roots = [
    path.join(l1Dir, "pages"),
    path.join(l1Dir, "escalation", "pages"),
    path.join(l1Dir, "escalation", "escalation", "pages"),
    path.join(l1Dir, "deadcheck", "escalation", "pages")
  ];
  for (const root of roots) {
    let files: string[];
    try {
      files = await readdir(root);
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.endsWith(".txt")) continue;
      pages.set(file.replace(/\.txt$/, ""), await readFile(path.join(root, file), "utf8"));
    }
  }
  return pages;
}

async function loadLiveStatus(l1Dir: string): Promise<Map<string, string>> {
  try {
    const parsed = JSON.parse(await readFile(path.join(l1Dir, "l1-final-status.json"), "utf8"));
    return new Map(Object.entries(parsed as Record<string, string>));
  } catch {
    return new Map();
  }
}

function buildL3Targets(rows: AnchorRow[]) {
  // L3 re-judges meaning, so it only needs the anchors that actually moved.
  const targets = rows.filter((row) => row.verdict === "absent" || row.verdict === "drifted");
  return {
    generatedAt: new Date().toISOString(),
    note: "Evidence whose quoted text no longer matches the live page. Absent anchors need a human or semantic judgment before any claim is changed; none of this is itself proof a policy reversed.",
    schemaVersion: "uapt-full-audit-l3-targets-v1",
    targets
  };
}

function tally<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const value = key(item);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([, a], [, b]) => b - a));
}

function renderMarkdown(report: {
  limitations: string[];
  rows: AnchorRow[];
  runId: string;
  summary: { byMatchKind: Record<string, number>; byVerdict: Record<string, number>; evidenceScored: number };
}): string {
  const lines = [
    `# L2 Snippet Anchoring — ${report.runId}`,
    "",
    `Evidence records scored: **${report.summary.evidenceScored}**`,
    "",
    ...report.limitations.map((line) => `- ${line}`),
    "",
    "| Verdict | Count |",
    "| --- | ---: |",
    ...Object.entries(report.summary.byVerdict).map(([key, value]) => `| \`${key}\` | ${value} |`),
    "",
    "| Match kind | Count |",
    "| --- | ---: |",
    ...Object.entries(report.summary.byMatchKind).map(([key, value]) => `| \`${key}\` | ${value} |`)
  ];

  const absent = report.rows
    .filter((row) => row.verdict === "absent" && !row.flags.includes("weak_anchor"))
    .sort((left, right) => right.snippetLength - left.snippetLength);
  if (absent.length) {
    lines.push(
      "",
      `## Quoted text no longer on the cited page (${absent.length}, strongest anchors first)`,
      "",
      "| University | Quote | Source |",
      "| --- | --- | --- |"
    );
    for (const row of absent.slice(0, SAMPLE_LIMIT)) {
      lines.push(
        `| ${row.entitySlug} | ${escapeCell(row.snippetHead)} | ${escapeCell(row.sourceUrl)} |`
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 150);
}

function cacheKey(url: string): string {
  return createHash("sha256").update(url, "utf8").digest("hex").slice(0, 32);
}

async function findLatestL1(repoRoot: string): Promise<string> {
  const root = path.join(repoRoot, OUTPUT_ROOT);
  const candidates: string[] = [];
  for (const l0 of await readdir(root)) {
    if (!l0.startsWith("l0-")) continue;
    let inner: string[];
    try {
      inner = await readdir(path.join(root, l0));
    } catch {
      continue;
    }
    for (const l1 of inner) {
      if (l1.startsWith("l1-")) candidates.push(path.join(root, l0, l1));
    }
  }
  const latest = candidates.sort().at(-1);
  if (!latest) throw new Error(`No L1 run under ${root}. Run "pnpm audit:l1-live-fetch" first.`);
  return latest;
}

function parseArgs(args: string[]): { l1Dir?: string } {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    if (!args[index].startsWith("--")) continue;
    const [flag, inline] = args[index].slice(2).split("=");
    values.set(flag, inline ?? args[index + 1] ?? "");
  }
  return { l1Dir: values.get("l1") || undefined };
}
