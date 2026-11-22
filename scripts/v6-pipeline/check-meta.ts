// S5 source-metadata coverage for the batch schools (each official source documented or a typed gap).
//   tsx --tsconfig apps/web/tsconfig.json scripts/v6-pipeline/check-meta.ts --workspace <dir> <public-v6-source-metadata.json>
import { readFileSync } from 'node:fs';
import { v6SourceMetadataSchema, v6SourceMetadataCoverage } from '../../packages/shared/src/v6-source-metadata';
import { loadBatch, workspaceFromArgv } from './batch';

const { ws, args } = workspaceFromArgv();
const batch = loadBatch(ws);
const metadata = v6SourceMetadataSchema.parse(JSON.parse(readFileSync(args[0] ?? `${ws}/${batch.sourceMetadataFile ?? 'source-metadata/public-v6-source-metadata.json'}`, 'utf8')));
const official: Record<string, string[]> = {};
for (const { slug } of batch.schools) official[slug] = JSON.parse(readFileSync(`${ws}/${slug}/public.json`, 'utf8')).data.officialSources.map((x: { sourceUrl: string }) => x.sourceUrl);
const coverage = v6SourceMetadataCoverage(metadata as never, official);
console.log(JSON.stringify(coverage));
