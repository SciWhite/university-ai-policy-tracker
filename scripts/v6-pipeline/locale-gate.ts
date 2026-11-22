/**
 * G3 on assembled V6 pages: every row a /zh/ page shows has Chinese (docs/v6-pipeline.md §3).
 * assemble.ts runs it on every view it publishes and refuses to build a content release otherwise.
 * As a CLI it audits a content release tree (for example the live parent):
 *
 *   tsx --tsconfig apps/web/tsconfig.json scripts/v6-pipeline/locale-gate.ts <release-dir> [slug ...]
 *
 * Batches 1-2 (2026-11-19/20) shipped 197 /zh/ evidence rows in English; this check fails them.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const CJK = /[㐀-鿿]/;
const zh = (value: unknown) => typeof value === "string" && value.trim() !== "" && CJK.test(value);
const text = (value: unknown) => typeof value === "string" && value.trim() !== "";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function zhCoverageProblems(view: any): string[] {
  const out: string[] = [];
  const topics = [...(view.school?.topics ?? []), ...(view.school?.additionalTopics ?? [])];
  for (const t of topics) {
    const k = t.key;
    if (!zh(view.topicLabels?.[k]?.zh)) out.push(`topicLabels.${k}.zh`);
    if (!zh(view.topicLabels?.[`${k}:status`]?.zh)) out.push(`topicLabels.${k}:status.zh`);
    if (!zh(view.topicSummaries?.[k]?.zh)) out.push(`topicSummaries.${k}.zh`);
    if (!zh(view.topicScopes?.[k]?.zh)) out.push(`topicScopes.${k}.zh`);
  }
  for (const part of ["title", "scope"]) if (!zh(view.hero?.[part]?.zh)) out.push(`hero.${part}.zh`);
  const guide = view.studentActions ?? {};
  const linked = new Set<string>();
  for (const side of ["do", "dont"]) (guide[side] ?? []).forEach((a: { zh?: string; claimIds?: string[] }, i: number) => {
    if (!zh(a.zh)) out.push(`studentActions.${side}[${i}].zh`);
    for (const id of a.claimIds ?? []) linked.add(id);
  });
  for (const ids of Object.values(guide.procedures ?? {}) as string[][]) for (const id of ids) linked.add(id);
  for (const id of [...linked].sort()) {
    const row = guide.claims?.[id];
    if (!row) out.push(`linked evidence row missing: ${id}`);
    else if (!zh(row.summaryZh)) out.push(`evidence row without summaryZh (English on /zh/): ${id}`);
  }
  for (const tool of view.tools ?? []) if (!text(view.toolDisplayCopy?.zh?.[tool.rawToolName]?.description)) out.push(`toolDisplayCopy.zh: ${tool.rawToolName}`);
  return out;
}

/** Problems per slug for the zh views of a V6 pages package (englishOnly slugs are exempt). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pagesZhProblems(pages: any, slugs?: string[]): Record<string, string[]> {
  const englishOnly = new Set<string>(pages.englishOnlySlugs ?? []);
  const out: Record<string, string[]> = {};
  for (const slug of slugs ?? pages.slugs ?? []) {
    if (englishOnly.has(slug)) continue;
    const view = pages.locales?.zh?.views?.[slug];
    const problems = view ? zhCoverageProblems(view) : ["no zh view"];
    if (problems.length) out[slug] = problems;
  }
  return out;
}

export async function releasePagesZhProblems(releaseDir: string, slugs?: string[]) {
  const { selectTree } = await import("../content-release/lib");
  const { loadSelected } = await import("../content-release/correct");
  const manifest = JSON.parse(readFileSync(path.join(releaseDir, "manifest.json"), "utf8"));
  selectTree(manifest.contentId, path.join(releaseDir, "tree"), manifest);
  const { pages } = loadSelected(path.join(releaseDir, "tree", "data"));
  return pagesZhProblems(pages, slugs?.length ? slugs : undefined);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [release, ...slugs] = process.argv.slice(2);
  if (!release) { console.error("usage: locale-gate.ts <release-dir> [slug ...]"); process.exit(2); }
  releasePagesZhProblems(path.resolve(release), slugs).then(problems => {
    const rows = Object.values(problems).reduce((n, p) => n + p.length, 0);
    console.log(JSON.stringify({ schoolsWithProblems: Object.keys(problems).length, problems: rows, detail: problems }, null, 1));
    process.exitCode = rows ? 1 : 0;
  }).catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 2; });
}
