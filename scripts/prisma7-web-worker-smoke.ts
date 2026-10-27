import assert from "node:assert/strict";
import { disconnectPrismaClient } from "../packages/db/src/index.js";
import { recordMirroredAnalyticsEvent, listMirroredAnalyticsEvents } from "../apps/web/lib/analytics-store";
import { loadWorkerConfig } from "../apps/worker/src/index.js";

async function main() {
const url = new URL(process.env.DATABASE_URL ?? "");
if (process.env.UAPT_PRISMA_TEST !== "1" || url.hostname !== "127.0.0.1" || !/^\/uapt_prisma7_test(?:_\w+)?$/.test(url.pathname)) throw new Error("Dedicated loopback integration database required");
// Explicitly exercise the Prisma analytics branch, never a connected Supabase RPC.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;
delete process.env.SUPABASE_ANALYTICS_SECRET;
try {
  await recordMirroredAnalyticsEvent({ id: "p7-web-mirror", eventName: "migration_smoke", pathname: "/test", payload: { unicode: "中文", nullable: null } });
  const event = (await listMirroredAnalyticsEvents(new Date(0))).find(row => row.id === "p7-web-mirror");
  assert.equal(event!.eventName, "migration_smoke");
  assert.deepEqual(event!.payload, { unicode: "中文", nullable: null });
  assert.deepEqual(loadWorkerConfig({ REDIS_URL: "redis://127.0.0.1:16379", INGESTION_API_BASE_URL: "http://127.0.0.1:14000" }), { redisUrl: "redis://127.0.0.1:16379", ingestionApiBaseUrl: "http://127.0.0.1:14000" });
  assert.throws(() => loadWorkerConfig({}), /REDIS_URL/);
  console.log("PASS Web analytics Prisma branch and existing worker configuration; worker has no queue processor implemented");
} finally { await disconnectPrismaClient(); }

}
void main().catch(error => { console.error(error); process.exitCode = 1; });
