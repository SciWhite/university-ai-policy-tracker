import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseConnection } from "../src/connection.js";

const local = "postgresql://localhost/uapt_test";
test("pool settings and URL schema are explicit; old settings are translated", () => {
  const config = getDatabaseConnection({ DATABASE_URL: `${local}?schema=review&connection_limit=3&connect_timeout=2&pool_timeout=2` });
  assert.equal(config.schema, "review");
  assert.equal(config.pool.max, 3);
  assert.equal(config.pool.connectionTimeoutMillis, 2000);
  assert.equal(config.pool.idleTimeoutMillis, 300000);
  assert.equal(config.pool.ssl, false);
  assert.equal(new URL(config.pool.connectionString!).search, "");
  assert.deepEqual(config.transactionOptions, { maxWait: 2000, timeout: 5000 });
});
test("remote TLS verifies certificates and cannot silently fall back to plaintext", () => {
  const config = getDatabaseConnection({ DATABASE_URL: "postgresql://example.org/uapt?sslmode=require" });
  assert.deepEqual(config.pool.ssl, { rejectUnauthorized: true });
  assert.throws(() => getDatabaseConnection({ DATABASE_URL: "postgresql://example.org/uapt?sslmode=disable" }), /loopback/);
  assert.throws(() => getDatabaseConnection({ DATABASE_URL: `${local}?host=example.org` }), /Unsupported/);
  assert.throws(() => getDatabaseConnection({ DATABASE_URL: "postgresql://example.org/uapt?ssl=no-verify" }), /Unsupported/);
});
test("invalid, infinite and ambiguous timeout settings fail early without revealing credentials", () => {
  assert.throws(() => getDatabaseConnection({ DATABASE_URL: local, DATABASE_POOL_MAX: "0" }), /positive integer/);
  assert.throws(() => getDatabaseConnection({ DATABASE_URL: `${local}?pool_timeout=10&connect_timeout=5` }), /explicitly/);
  assert.throws(() => getDatabaseConnection({ DATABASE_URL: `${local}?pgbouncer=true` }), /pooler/);
  assert.throws(() => getDatabaseConnection({ DATABASE_URL: "prisma://example.org" }), /TCP/);
  assert.throws(() => getDatabaseConnection({}), /required/);
  assert.throws(() => getDatabaseConnection({ DATABASE_URL: "secret invalid input" }), e => e instanceof Error && !e.message.includes("secret"));
  assert.throws(() => getDatabaseConnection({ DATABASE_URL: local, DATABASE_CONNECTION_TIMEOUT_MS: "2147483648" }), /timer limit/);
  const override = getDatabaseConnection({ DATABASE_URL: `${local}?pool_timeout=10&connect_timeout=5`, DATABASE_CONNECTION_TIMEOUT_MS: "7000" });
  assert.equal(override.pool.connectionTimeoutMillis, 7000);
});
