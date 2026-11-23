/**
 * Which rows of a V6 page view a /zh/ page would show in English. One rule for two readers:
 * the pipeline's G3 gate (scripts/v6-pipeline/locale-gate.ts, at assembly) and the web index
 * decision (lib/university-reading-metadata.ts), so a school that passed G3 is indexable in zh
 * without a hand-kept list. Pure: no content access.
 */
// Real Chinese here quotes product and official names ("Copilot Chat 与 Cogniti", "Dean of the College"), so
// Latin words prove nothing. English prose shows in function words that outweigh the Chinese. Measured on
// 16,178 published zh strings (2026-11-23): Chinese reaches 5 function words per 124 characters, the only
// English strings had 6-12 per 2-4.
const ENGLISH_FUNCTION_WORD = /\b(?:the|and|of|to|for|with|that|this|is|are|be|must|should|may|not|any|before|using|when|by|from|your|their|students?)\b/gi;
/** Chinese text, not English prose that happens to contain a Chinese name. */
const zh = (value: unknown) => {
  if (typeof value !== "string") return false;
  const chinese = value.match(/[㐀-鿿]/g)?.length ?? 0, functionWords = value.match(ENGLISH_FUNCTION_WORD)?.length ?? 0;
  return chinese > 0 && !(functionWords >= 4 && 2 * functionWords > chinese);
};
const text = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

/** True when the zh reading-translation package has an accepted unit for this exact English string. */
export type ReadingLookup = (source: string) => boolean;
const TOOL_PROSE = ["description", "howToObtain", "costToUser"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function zhCoverageProblems(view: any, translated?: ReadingLookup): string[] {
  const out: string[] = [];
  const tr = (source: unknown) => Boolean(translated && text(source) && translated(source));
  const topics = [...(view.school?.topics ?? []), ...(view.school?.additionalTopics ?? [])];
  // An empty view has nothing to fail; it is not complete.
  if (!topics.length) out.push("no topics");
  // Without studentActions the page falls back to the English claim guide (unless a package translates it).
  const actions = view.studentActions;
  if (!translated && !(actions?.do?.length || actions?.dont?.length || Object.keys(actions?.claims ?? {}).length)) out.push("no studentActions");
  for (const t of topics) {
    const k = t.key;
    if (!zh(view.topicLabels?.[k]?.zh) && !tr(view.topicLabels?.[k]?.en)) out.push(`topicLabels.${k}.zh`);
    if (!zh(view.topicLabels?.[`${k}:status`]?.zh) && !tr(view.topicLabels?.[`${k}:status`]?.en)) out.push(`topicLabels.${k}:status.zh`);
    // The page shows the view entry when it is set, else the zh school topic's own summary/scope
    // (applyLocalV6Bundle in apps/web/lib/policy-v6-bundle.ts).
    for (const [family, field] of [["topicSummaries", "summary"], ["topicScopes", "scope"]] as const) {
      const entry = view[family]?.[k];
      const shown = text(entry?.zh) ? entry.zh : t[field];
      if (!zh(shown) && !tr(entry?.en || t[field])) out.push(`${family}.${k}.zh`);
    }
  }
  // Only the legacy page renders the hero; v6_presentation_integration pages use the catalog name.
  if (view.publication?.kind !== "v6_presentation_integration") {
    for (const part of ["title", "scope"]) if (!zh(view.hero?.[part]?.zh) && !tr(view.hero?.[part]?.en)) out.push(`hero.${part}.zh`);
  }
  const guide = view.studentActions ?? {};
  if (text(guide.scope?.en) && !zh(guide.scope?.zh) && !tr(guide.scope?.en)) out.push("studentActions.scope.zh");
  const linked = new Set<string>();
  for (const side of ["do", "dont"]) (guide[side] ?? []).forEach((a: { en?: string; zh?: string; claimIds?: string[] }, i: number) => {
    if (!zh(a.zh) && !tr(a.en)) out.push(`studentActions.${side}[${i}].zh`);
    for (const id of a.claimIds ?? []) linked.add(id);
  });
  for (const ids of Object.values(guide.procedures ?? {}) as string[][]) for (const id of ids) linked.add(id);
  for (const id of [...linked].sort()) {
    const row = guide.claims?.[id];
    if (!row) out.push(`linked evidence row missing: ${id}`);
    else if (!zh(row.summaryZh) && !tr(row.text)) out.push(`evidence row without summaryZh (English on /zh/): ${id}`);
  }
  for (const tool of view.tools ?? []) {
    const prose = TOOL_PROSE.map(field => tool[field]).filter(text);
    if (!prose.length) continue; // name and labels only; nothing to translate
    const proseTranslated = prose.every(tr);
    if (view.toolDisplayMode === "historical_discovery") {
      // PolicyV6PublicToolContext never reads toolDisplayCopy; it shows the record's prose.
      if (!proseTranslated) out.push(`tool discovery prose without Chinese (historical_discovery): ${tool.rawToolName}`);
    } else if (!zh(view.toolDisplayCopy?.zh?.[tool.rawToolName]?.description) && !proseTranslated) out.push(`toolDisplayCopy.zh: ${tool.rawToolName}`);
  }
  return out;
}
