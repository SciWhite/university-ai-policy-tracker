import "reflect-metadata";
import assert from "node:assert/strict";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "../src/app.module.js";
import { disconnectPrismaClient, listCatalogUniversities, listPublicUniversitiesResponse } from "@uapt/db";

const url = new URL(process.env.DATABASE_URL ?? "");
if (process.env.UAPT_PRISMA_TEST !== "1" || url.hostname !== "127.0.0.1" || !/^\/uapt_prisma7_test(?:_\w+)?$/.test(url.pathname)) throw new Error("Dedicated loopback integration database required");
process.env.INGESTION_TOKEN = "isolated-test-token";
const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { logger: false });
try {
  await app.init();
  const server = app.getHttpAdapter().getInstance();
  await server.ready();
  const catalog = await server.inject({ method: "GET", url: "/universities" });
  assert.equal(catalog.statusCode, 200);
  assert.deepEqual(catalog.json(), JSON.parse(JSON.stringify(await listCatalogUniversities())));
  const publicList = await server.inject({ method: "GET", url: "/api/public/v1/universities.json?limit=3" });
  assert.equal(publicList.statusCode, 200);
  const expected = await listPublicUniversitiesResponse(3);
  const actual = publicList.json();
  // Envelope generation time is clock-dependent; every other field is compared.
  delete actual.generatedAt; delete (expected as { generatedAt?: string }).generatedAt;
  assert.deepEqual(actual, JSON.parse(JSON.stringify(expected)));
  assert.equal((await server.inject({ method: "GET", url: "/universities/does-not-exist" })).statusCode, 404);
  assert.equal((await server.inject({ method: "POST", url: "/internal/ingest/crawl-run", payload: {} })).statusCode, 401);
  const ingested = await server.inject({ method: "POST", url: "/internal/ingest/crawl-run", headers: { "x-ingestion-token": process.env.INGESTION_TOKEN }, payload: { requestedUrl: "https://example.edu/test", status: "succeeded", fetchMode: "http", startedAt: "2026-10-20T00:00:00.000Z", metadata: { syntheticTest: true } } });
  assert.equal(ingested.statusCode, 201, ingested.body);
  assert.equal(ingested.json().status, "SUCCEEDED");
  console.log("PASS Nest/Fastify HTTP catalog, public pagination, 404, auth and ingestion using Prisma7");
} finally { await app.close(); await disconnectPrismaClient(); }
