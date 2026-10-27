import { readFileSync } from "node:fs";
import type { PoolConfig } from "pg";

function integer(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > 2_147_483_647) {
    throw new Error(`${name} must be a positive integer within the Node timer limit`);
  }
  return Number(value);
}

/** Resolve v6 URL settings explicitly instead of silently losing them in pg. */
export function getDatabaseConnection(env: NodeJS.ProcessEnv = process.env): {
  pool: PoolConfig;
  schema: string;
  transactionOptions: { maxWait: number; timeout: number };
} {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required for Prisma");
  let url: URL;
  try { url = new URL(env.DATABASE_URL); } catch { throw new Error("DATABASE_URL must be a valid PostgreSQL URL"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("PrismaPg requires a PostgreSQL TCP connection");
  }
  const params = url.searchParams;
  if (params.has("pgbouncer")) throw new Error("Review pooler compatibility and remove the legacy pgbouncer URL flag");
  const allowed = new Set(["schema", "connection_limit", "connect_timeout", "pool_timeout", "max_idle_connection_lifetime", "max_connection_lifetime", "sslmode", "sslrootcert", "sslcert", "sslkey", "application_name", "options", "channel_binding", "client_encoding"]);
  // pg URI query fields override PoolConfig, including host and ssl. Reject
  // unreviewed fields so they cannot bypass loopback/TLS/timeout decisions.
  if ([...params.keys()].some(name => !allowed.has(name))) throw new Error("Unsupported DATABASE_URL parameter; review it before migration");
  const connect = params.get("connect_timeout") ?? undefined;
  const acquire = params.get("pool_timeout") ?? undefined;
  if (!env.DATABASE_CONNECTION_TIMEOUT_MS && connect && acquire && connect !== acquire) {
    throw new Error("pg shares connect/acquire timeout; set DATABASE_CONNECTION_TIMEOUT_MS explicitly");
  }
  const max = integer(env.DATABASE_POOL_MAX ?? params.get("connection_limit") ?? undefined, 5, "DATABASE_POOL_MAX");
  const connectionTimeoutMillis = env.DATABASE_CONNECTION_TIMEOUT_MS === undefined
    ? integer(connect ?? acquire, 5, "connect_timeout/pool_timeout") * 1000
    : integer(env.DATABASE_CONNECTION_TIMEOUT_MS, 5000, "DATABASE_CONNECTION_TIMEOUT_MS");
  const idleTimeoutMillis = env.DATABASE_IDLE_TIMEOUT_MS === undefined
    ? integer(params.get("max_idle_connection_lifetime") ?? undefined, 300, "max_idle_connection_lifetime") * 1000
    : integer(env.DATABASE_IDLE_TIMEOUT_MS, 300000, "DATABASE_IDLE_TIMEOUT_MS");
  if (Math.max(connectionTimeoutMillis, idleTimeoutMillis) > 2_147_483_647) throw new Error("Database timeout exceeds the Node timer limit");
  const schema = params.get("schema") ?? "public";
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const tlsMode = env.DATABASE_TLS_MODE ?? params.get("sslmode") ?? (loopback ? "disable" : "verify-full");
  if (!["disable", "require", "verify-ca", "verify-full"].includes(tlsMode)) {
    throw new Error("DATABASE_TLS_MODE must be disable or a verified TLS mode");
  }
  if (tlsMode === "disable" && !loopback) throw new Error("Unencrypted database connections require a loopback host");
  const ca = env.DATABASE_TLS_CA_FILE ?? params.get("sslrootcert");
  const cert = params.get("sslcert");
  const key = params.get("sslkey");
  const ssl: PoolConfig["ssl"] = tlsMode === "disable" ? false : {
    rejectUnauthorized: true,
    ...(ca ? { ca: readFileSync(ca, "utf8") } : {}),
    ...(cert ? { cert: readFileSync(cert, "utf8") } : {}),
    ...(key ? { key: readFileSync(key, "utf8") } : {})
  };
  const maxLifetimeSeconds = params.get("max_connection_lifetime");
  for (const name of ["schema", "connection_limit", "connect_timeout", "pool_timeout", "max_idle_connection_lifetime", "max_connection_lifetime", "sslmode", "sslrootcert", "sslcert", "sslkey"]) params.delete(name);
  return {
    schema,
    pool: {
      connectionString: url.toString(), max, connectionTimeoutMillis, idleTimeoutMillis, ssl,
      maxLifetimeSeconds: maxLifetimeSeconds === null || maxLifetimeSeconds === "0" ? 0 : integer(maxLifetimeSeconds, 0, "max_connection_lifetime")
    },
    transactionOptions: {
      maxWait: integer(env.DATABASE_TRANSACTION_MAX_WAIT_MS, 2000, "DATABASE_TRANSACTION_MAX_WAIT_MS"),
      timeout: integer(env.DATABASE_TRANSACTION_TIMEOUT_MS, 5000, "DATABASE_TRANSACTION_TIMEOUT_MS")
    }
  };
}
