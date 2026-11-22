// S3 finalize: add the Simplified Chinese copy from inputs/<abbr>.json to view-prehash.json, bind the local guide to the
// view's claims, and check the result with the production local loaders (EN and ZH). Writes <slug>/view.json and
// selection.json (full runs only). Every evidence row linked from Do/Don't/procedures gets summaryZh (G3 checks it).
//   tsx --tsconfig apps/web/tsconfig.json scripts/v6-pipeline/finalize.ts --workspace <dir> [abbr ...]
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseLocalV6Bundle, getLocalV6StudentActions } from '../../apps/web/lib/policy-v6-bundle';
import { acceptV6SchoolInput } from '../../apps/web/lib/policy-v6-input';
import { validateV6Completeness } from '../../apps/web/lib/policy-v6-completeness';
import { loadBatch, workspaceFromArgv } from './batch';

const { ws: P, args } = workspaceFromArgv();
const BATCH = loadBatch(P);
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const hash = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const zhTitles = ['课程作业', '考试与考核', '披露与引用', '隐私与数据', '工具与获取方式', '研究与出版', '学术诚信', '教学指引', '安全与工具审批'];
const only = new Set(args);
const selPath = P + '/selection.json';
let selection: Record<string, { path: string; sha256: string; sourceBundleSha256: string }> = {};
try { selection = read(selPath); } catch { /* first run */ }
const results = [];
for (const { slug, abbr } of BATCH.schools) {
  if (only.size && !only.has(abbr)) continue;
  const view = read(`${P}/${slug}/view-prehash.json`);
  const zh = read(`${P}/inputs/${abbr}.json`).zh;
  const topics = [...view.school.topics, ...view.school.additionalTopics];
  assert.equal(zh.topics.length, topics.length, abbr + ' zh topics');
  delete view.localPreviewLanguage;
  topics.forEach((topic: { key: string }, i: number) => {
    const [label, summary, scope] = zh.topics[i];
    const key = topic.key;
    view.topicLabels[key].zh = zhTitles[i];
    view.topicLabels[key + ':status'].zh = label;
    view.topicSummaries[key].zh = summary;
    view.topicScopes[key].zh = scope;
    view.studentActions.topics[key].zh = summary;
    view.studentActions.topics[key].meaningZh = scope;
  });
  [view.hero.title.zh, view.hero.scope.zh] = zh.hero;
  view.studentActions.scope.zh = view.hero.scope.zh;
  for (const side of ['do', 'dont'] as const) {
    assert.equal(view.studentActions[side].length, zh[side].length, abbr + ' zh ' + side);
    view.studentActions[side].forEach((action: { en: string; zh: string }, i: number) => {
      assert.equal(view.hero.actions[side][i].en, action.en);
      action.zh = view.hero.actions[side][i].zh = zh[side][i];
    });
  }
  view.toolDisplayCopy = { zh: Object.fromEntries(view.tools.map((tool: { rawToolName: string }) => {
    const row = zh.tools[tool.rawToolName];
    assert.ok(row, abbr + ' zh tool ' + tool.rawToolName);
    const [description, howToObtain, costToUser] = row;
    return [tool.rawToolName, { description, howToObtain, costToUser, basisSha256: hash(JSON.stringify(tool)) }];
  })) };
  // Chinese text for every evidence row linked from Do/Don't/procedures (rendered as summaryZh on /zh/).
  {
    const input = read(`${P}/inputs/${abbr}.json`);
    const pub = read(`${P}/${slug}/public.json`).data.claims as { id: string }[];
    const rid = (ref: string) => /^p\d+$/.test(ref) ? pub[Number(ref.slice(1)) - 1].id : 'local-' + abbr + '-v6-' + ref;
    const refs = new Set<string>([...input.do, ...input.dont].flatMap((a: { refs: string[] }) => a.refs)
      .concat(Object.values(input.procedures ?? {}).flat() as string[]));
    for (const ref of refs) {
      const text = zh.claims?.[ref];
      assert.ok(typeof text === 'string' && text.trim(), abbr + ' zh.claims missing ' + ref);
      const row = view.studentActions.claims[rid(ref)];
      assert.ok(row, abbr + ' linked claim missing ' + ref);
      row.summaryZh = text;
    }
  }
  view.studentActions.recordSha256 = hash(JSON.stringify(view.claims));
  const rel = `${slug}/view.json`;
  writeFileSync(`${P}/${rel}`, JSON.stringify(view, null, 2) + '\n', { mode: 0o600 });
  const bytes = readFileSync(`${P}/${rel}`);
  const entry = { path: rel, sha256: hash(bytes), sourceBundleSha256: view.sourceBundleSha256 };
  for (const locale of ['en', 'zh'] as const) {
    const v = parseLocalV6Bundle(bytes, slug, entry, locale);
    const accepted = acceptV6SchoolInput({ school: v.school, bundle: v }, undefined, undefined, { locale, allowFrozenLegacy: false });
    assert.equal(accepted.kind, 'bundle');
    validateV6Completeness(accepted, locale, false);
    assert.ok(getLocalV6StudentActions(v), abbr + ' student actions rejected');
  }
  // Quotes in topic groups and public claims must come from the captured texts bound in the bundle.
  const data = read(`${P}/${slug}/bundle/outputs/bundle.json`);
  const texts = new Map<string, string>(data.sources.map((s: any) => [s.sourceId, readFileSync(`${P}/${slug}/bundle/${s.textFile}`, 'utf8')]));
  for (const b of data.evidenceBindings) assert.equal(Array.from(texts.get(b.sourceId)!).slice(b.charStart, b.charEnd).join('') === b.quote || texts.get(b.sourceId)!.slice(b.charStart, b.charEnd) === b.quote, true, b.evidenceId);
  selection[slug] = entry;
  results.push({ abbr, slug, sha256: entry.sha256, topics: topics.length, tools: view.tools.length, do: view.studentActions.do.length, dont: view.studentActions.dont.length, quotes: data.evidenceBindings.length });
}
// Per-school runs (with abbr arguments) only check; the integrator writes selection.json with a full run.
if (!only.size) writeFileSync(selPath, JSON.stringify(selection, null, 2) + '\n');
console.log(JSON.stringify(results, null, 1));
