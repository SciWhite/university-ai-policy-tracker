import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import { createServer, type Socket } from "node:net";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient, Prisma } from "../src/prisma-client.js";
import { getDatabaseConnection } from "../src/connection.js";
import * as current from "../src/index.js";

// Explicit opt-in, loopback and database-name guard: never run against production.
if (process.env.UAPT_PRISMA_TEST !== "1") throw new Error("Set UAPT_PRISMA_TEST=1 for isolated integration acceptance");
const url = new URL(process.env.DATABASE_URL ?? "");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || !/^\/uapt_prisma7_test(?:_\w+)?$/.test(url.pathname)) {
  throw new Error("Integration acceptance requires the dedicated loopback uapt_prisma7_test database");
}
const legacyRoot = resolve(process.env.UAPT_PRISMA6_BASELINE ?? ".local/prisma7/legacy");
const legacyModule = await import(pathToFileURL(resolve(legacyRoot, "generated/index.js")).href);
const legacy = await import(pathToFileURL(resolve(legacyRoot, "src/index.ts")).href);
assert.equal(legacyModule.Prisma.prismaVersion.client, "6.19.3");
assert.equal(Prisma.prismaVersion.client, "7.10.1");
const oldClient = new legacyModule.PrismaClient({ datasources: { db: { url: url.toString() } } });
const connection = getDatabaseConnection();
const client = new PrismaClient({ adapter: new PrismaPg(connection.pool, { schema: connection.schema }), transactionOptions: connection.transactionOptions });
const checks: Array<{ name: string; milliseconds: number; hash?: string }> = [];
async function check(name: string, run: () => Promise<unknown>) {
  const start = performance.now();
  const value = await run();
  checks.push({ name, milliseconds: Math.round(performance.now() - start), ...(value === undefined ? {} : { hash: createHash("sha256").update(JSON.stringify(value)).digest("hex") }) });
  console.log(`PASS ${name}`);
}
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "generatedAt").map(([key, v]) => [key, stable(v)]));
  return value;
}
const special = "prisma7-边界-test";
try {
  assert.equal(await client.university.count(), 0, "Start with a NEW empty acceptance database");
  await check("Prisma6 seed transaction replays existing catalog on historical migrations", async () => legacy.seedInitialCatalog(oldClient));
  await check("Prisma7 seed transaction is idempotent and Prisma6 can read its writes", async () => {
    const before = await client.policyClaim.count();
    await current.seedInitialCatalog(client);
    assert.equal(await oldClient.policyClaim.count(), before);
  });
  await check("fixture preserves nullable fields, JSON nulls, dates and review boundaries", async () => {
    await oldClient.university.create({ data: { id: "p7-u", slug: special, name: "Boundary 大学", country: "CA", region: null, website: null, summary: null } });
    await oldClient.canonicalEntity.create({ data: { id: "p7-entity", type: "UNIVERSITY", slug: special, name: "Boundary 大学", canonicalUrl: `https://eduaipolicy.org/universities/${special}`, aliases: ["大学", "Boundary"], policyClaims: { create: ["NEEDS_REVIEW", "REJECTED", "MACHINE_CANDIDATE"].map((reviewState, i) => ({ id: `p7-claim-${i}`, claimType: "other", claimText: `Test review boundary ${reviewState}`, confidence: 0.25, reviewState, claimValue: null, lastCheckedAt: null, lastChangedAt: null, evidence: { create: { id: `p7-evidence-${i}`, sourceUrl: "https://example.edu/policy", sourceSnapshotHash: "a".repeat(64), evidenceSnippet: "Original evidence; no approval inferred.", retrievedAt: new Date("2026-10-20T10:23:45.123Z") } } })) } } });
    const t = new Date("2026-10-20T10:23:45.123Z");
    for (let i = 0; i < 4; i++) await client.analyticsEvent.create({ data: { id: `p7-event-${i}`, eventName: "migration_fixture", pathname: "/test", createdAt: t, resultRank: i === 0 ? null : i, payload: i === 0 ? Prisma.DbNull : i === 1 ? Prisma.JsonNull : { unicode: "中文", nested: { value: null }, list: [1, "x", false], i } } });
  });
  // A structural cast is confined to the old dynamic test client; production uses generated types.
  const oldTyped = oldClient as PrismaClient;
  await check("same data: ordered pagination, cursor, null ordering, JSON filters, enum/array/relation reads", async () => {
    const queries: Array<(db: PrismaClient, values: typeof Prisma) => Promise<unknown>> = [
      db => db.university.findMany({ orderBy: [{ name: "asc" }, { id: "asc" }], skip: 1, take: 3 }),
      db => db.university.findMany({ where: { OR: [{ region: null }, { name: { contains: "大学" } }] }, orderBy: [{ region: { sort: "asc", nulls: "first" } }, { id: "asc" }] }),
      db => db.analyticsEvent.findMany({ cursor: { id: "p7-event-1" }, skip: 1, take: 2, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      (db, values) => db.analyticsEvent.findMany({ where: { payload: { path: ["nested", "value"], equals: values.JsonNull } }, orderBy: { id: "asc" } }),
      (db, values) => db.analyticsEvent.findMany({ where: { payload: { equals: values.DbNull } }, orderBy: { id: "asc" } }),
      db => db.canonicalEntity.findMany({ where: { aliases: { has: "大学" } }, include: { policyClaims: { include: { evidence: true }, orderBy: { id: "asc" } } } }),
      db => db.$queryRaw`SELECT TIMESTAMP '2026-10-20 10:23:45.123' AS date, NULL::text AS empty, '{"x":null}'::jsonb AS json`
    ];
    const outputs = [];
    for (const query of queries) { const a = await query(oldTyped, legacyModule.Prisma); const b = await query(client, Prisma); assert.deepEqual(b, a); outputs.push(b); }
    return outputs;
  });
  await check("public contracts and catalogs match Prisma6 including canonical Claim/Evidence IDs", async () => {
    const pairs = [
      [() => legacy.listCatalogUniversities(oldClient), () => current.listCatalogUniversities(client)],
      [() => legacy.listCatalogTools(oldClient), () => current.listCatalogTools(client)],
      [() => legacy.listCatalogSources(oldClient), () => current.listCatalogSources(client)],
      [() => legacy.listPublicUniversitiesResponse(100, oldClient), () => current.listPublicUniversitiesResponse(100, client)],
      [() => legacy.listPublicRecentChangesEnvelope(25, oldClient), () => current.listPublicRecentChangesEnvelope(25, client)],
      [() => legacy.listAnalyticsEvents(new Date(0), oldClient), () => current.listAnalyticsEvents(new Date(0), client)]
    ];
    for (const [before, after] of pairs) assert.deepEqual(stable(await after!()), stable(await before!()));
    for (const { slug } of await client.university.findMany()) assert.deepEqual(await current.getPublicUniversitySummaryBySlug(slug, client), await legacy.getPublicUniversitySummaryBySlug(slug, oldClient));
    const summary = await current.getPublicUniversitySummaryBySlug(special, client);
    assert.deepEqual(summary!.claims.map(c => c.id).sort(), ["p7-claim-0", "p7-claim-2"]);
    assert.equal(summary!.reviewState, "needs_review");
    assert.equal(await current.getPublicUniversitySummaryBySlug("missing", client), null);
    return summary;
  });
  await check("ingestion round-trip uses enum/date/JSON and preserves snapshot identity", async () => {
    const payload = { universitySlug: special, sourceUrl: "https://example.edu/policy", sourceTitle: "Test source", documentStatus: "university_wide_policy" as const, contentHash: "b".repeat(64), normalizedText: "Original 中文 policy", fetchedAt: "2026-10-20T10:23:45.123Z", metadata: { languageGap: true, held: true, nullable: null }, markChanged: false };
    const snapshot = await current.ingestSourceSnapshot(payload, client);
    assert.deepEqual(await legacy.ingestSourceSnapshot(payload, oldClient), snapshot);
    const row = await oldClient.sourceSnapshot.findUnique({ where: { id: snapshot.id } });
    assert.deepEqual(row.metadata, payload.metadata);
    assert.equal(row.fetchedAt.toISOString(), payload.fetchedAt);
    const candidate = { sourceSnapshotId: snapshot.id, documentStatus: "university_wide_policy" as const, aiServiceStatus: "third_party_service" as const, serviceTreatment: "not_mentioned" as const, aiTools: [], themes: [], audiences: [], academicContexts: [], dataSensitivities: [], evidence: [{ url: "https://example.edu/policy", retrievedAt: payload.fetchedAt, evidenceQuality: "official_source" as const, quote: "test" }], confidence: 0.25, reviewState: "needs_review" as const };
    const extracted = await current.ingestExtractionCandidate(candidate, client);
    assert.deepEqual(await legacy.ingestExtractionCandidate(candidate, oldClient), extracted);
    assert.equal(extracted.reviewState, "NEEDS_REVIEW");
  });
  await check("interactive and batch commit/rollback; unique errors retain P2002; old client reads new writes", async () => {
    await client.$transaction(async tx => { await tx.university.update({ where: { slug: special }, data: { summary: "committed" } }); });
    assert.equal((await oldClient.university.findUnique({ where: { slug: special } })).summary, "committed");
    await assert.rejects(client.$transaction(async tx => { await tx.university.update({ where: { slug: special }, data: { summary: "must rollback" } }); throw new Error("forced rollback"); }), /forced rollback/);
    assert.equal((await oldClient.university.findUnique({ where: { slug: special } })).summary, "committed");
    await assert.rejects(client.$transaction([client.university.update({ where: { slug: special }, data: { summary: "batch rollback" } }), client.university.create({ data: { slug: special, name: "duplicate", country: "CA" } })]), (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002");
    assert.equal((await oldClient.university.findUnique({ where: { slug: special } })).summary, "committed");
    await client.$transaction([client.university.update({ where: { slug: special }, data: { summary: "batch commit" } })]);
    assert.equal((await oldClient.university.findUnique({ where: { slug: special } })).summary, "batch commit");
  });
  await check("pool saturation is bounded and recovers after release; transaction timeout rolls back", async () => {
    const limited = new PrismaClient({ adapter: new PrismaPg({ ...connection.pool, max: 1, connectionTimeoutMillis: 180 }), transactionOptions: { maxWait: 200, timeout: 2000 } });
    let release!: () => void;
    let acquired!: () => void;
    const gate = new Promise<void>(r => { release = r; });
    const ready = new Promise<void>(r => { acquired = r; });
    try {
      const busy = limited.$transaction(async tx => { await tx.$queryRaw`SELECT 1`; acquired(); await gate; });
      await ready;
      const start = performance.now();
      try { await assert.rejects(limited.university.count()); assert(performance.now() - start < 1500); } finally { release(); await busy; }
      assert(await limited.university.count() > 0);
      await assert.rejects(limited.$transaction(async tx => { await tx.university.update({ where: { slug: special }, data: { summary: "timeout rollback" } }); await new Promise(r => setTimeout(r, 250)); await tx.university.count(); }, { timeout: 100 }));
      assert.equal((await client.university.findUnique({ where: { slug: special } }))!.summary, "batch commit");
    } finally { await limited.$disconnect(); }
  });
  await check("TLS trusts configured CA, rejects untrusted certificate; connection failure is bounded", async () => {
    const ca = process.env.UAPT_TEST_CA_FILE;
    assert(ca, "Provide test PostgreSQL CA certificate");
    const tlsUrl = new URL(url); tlsUrl.searchParams.delete("sslmode");
    const secureConfig = getDatabaseConnection({ DATABASE_URL: tlsUrl.toString(), DATABASE_TLS_MODE: "verify-full", DATABASE_TLS_CA_FILE: ca });
    const secure = new PrismaClient({ adapter: new PrismaPg(secureConfig.pool) });
    const untrusted = new PrismaClient({ adapter: new PrismaPg({ ...secureConfig.pool, ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 250 }) });
    const refusedUrl = new URL(tlsUrl); refusedUrl.port = "55438";
    const refused = new PrismaClient({ adapter: new PrismaPg({ ...connection.pool, connectionString: refusedUrl.toString(), connectionTimeoutMillis: 250 }) });
    try {
      const result = await secure.$queryRaw<Array<{ ssl: boolean }>>`SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()`;
      assert.equal(result[0]!.ssl, true);
      await assert.rejects(untrusted.university.count());
      const start = performance.now(); await assert.rejects(refused.university.count()); assert(performance.now() - start < 1500);
    } finally { await Promise.all([secure.$disconnect(), untrusted.$disconnect(), refused.$disconnect()]); }
  });
  await check("stalled database handshake times out and idle connection termination recovers", async () => {
    const sockets = new Set<Socket>();
    const stalled = createServer(socket => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
    await new Promise<void>(r => stalled.listen(0, "127.0.0.1", r));
    const address = stalled.address();
    assert(address && typeof address !== "string");
    const stalledUrl = new URL(url); stalledUrl.port = String(address.port);
    const waiting = new PrismaClient({ adapter: new PrismaPg({ ...connection.pool, connectionString: stalledUrl.toString(), connectionTimeoutMillis: 200 }) });
    const recovering = new PrismaClient({ adapter: new PrismaPg({ ...connection.pool, max: 1 }) });
    try {
      const start = performance.now(); await assert.rejects(waiting.university.count()); assert(performance.now() - start < 1500);
      const rows = await recovering.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      await client.$queryRaw`SELECT pg_terminate_backend(${rows[0]!.pid})`;
      await new Promise(r => setTimeout(r, 50));
      assert(await recovering.university.count() > 0);
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>(r => stalled.close(() => r()));
      await Promise.all([waiting.$disconnect(), recovering.$disconnect()]);
    }
  });
  await check("disconnect closes adapter connections and allows a fresh singleton", async () => {
    await current.getPrismaClient().university.count();
    await current.disconnectPrismaClient();
    await current.getPrismaClient().university.count();
    await current.disconnectPrismaClient();
    const observer = new Pool({ ...connection.pool, application_name: "uapt-test-observer" });
    const tracked = new PrismaClient({ adapter: new PrismaPg({ ...connection.pool, application_name: "uapt-disconnect-test" }) });
    try {
      await tracked.university.count();
      assert.equal((await observer.query("select count(*)::int AS count from pg_stat_activity where application_name='uapt-disconnect-test'")).rows[0].count, 1);
      await tracked.$disconnect();
      assert.equal((await observer.query("select count(*)::int AS count from pg_stat_activity where application_name='uapt-disconnect-test'")).rows[0].count, 0);
 const result = await observer.query("select count(*)::int AS count from pg_stat_activity where datname=current_database() and state='idle in transaction'"); assert.equal(result.rows[0].count, 0); } finally { await tracked.$disconnect(); await observer.end(); }
  });
  const report = { status: "PASS", prismaBefore: "6.19.3", prismaAfter: Prisma.prismaVersion.client, fixture: "synthetic seed + boundary records on unchanged historical migrations", checks, limitations: ["No production database access or deployment", "No actual production PgBouncer/TLS/network validation", "Held/language gaps absent from relational schema are checked separately as unchanged public artifacts"] };
  writeFileSync(resolve(process.env.UAPT_TEST_REPORT ?? ".local/prisma7/evidence/integration.json"), JSON.stringify(report, null, 2));
} finally { await Promise.all([client.$disconnect(), oldClient.$disconnect(), current.disconnectPrismaClient()]); }
