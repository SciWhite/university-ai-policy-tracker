// MCP readback for a content or program release (candidate loopback or the public endpoint):
// every school's published Claim IDs via get_student_policy plus paginated get_policy_evidence,
// presentation exclusions and source-metadata counts. Writes the mcp-readback.json the sync
// event's mcp surface receipt cites.
//
//   pnpm --filter @uapt/mcp readback <endpoint> '<["slug", ...]>' <out.json>
import { writeFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const [endpoint, slugsJson, out] = process.argv.slice(2);
const slugs: string[] = JSON.parse(slugsJson);
const client = new Client({ name: "uapt-source-metadata-readback", version: "1.0.0" });
await client.connect(new StreamableHTTPClientTransport(new URL(endpoint)));
const tools = (await client.listTools()).tools.map(t => t.name).sort();
const rows: Record<string, unknown> = {};
for (const slug of slugs) {
  const policy = (await client.callTool({ name: "get_student_policy", arguments: { slug } })).structuredContent as any;
  const ids = new Set<string>((policy.claims ?? []).map((c: any) => c.id));
  let remaining: string[] = [...(policy.remainingClaimIds ?? [])];
  const evidenceReads: string[][] = [];
  while (remaining.length) {
    const batch = remaining.slice(0, 10); remaining = remaining.slice(10);
    const ev = (await client.callTool({ name: "get_policy_evidence", arguments: { slug, claim_ids: batch } })).structuredContent as any;
    for (const c of ev.claims ?? []) ids.add(c.id);
    evidenceReads.push(batch);
  }
  const excluded: string[] = policy.presentationExcludedClaimIds ?? [];
  rows[slug] = { status: policy.status, returnedClaimIds: [...ids].sort(), presentationExcludedClaimIds: [...excluded].sort(),
    evidenceBatches: evidenceReads.length, remainingAfterPagination: [] as string[],
    sourceMetadataDocuments: policy.sourceMetadata?.documents?.length ?? 0, recordSha256: policy.recordSha256 ?? null };
}
writeFileSync(out, JSON.stringify({ endpoint, tools, checkedAt: new Date().toISOString(), rows }, null, 1) + "\n");
console.log(JSON.stringify({ schools: slugs.length, tools }));
await client.close();
