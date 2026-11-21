#!/usr/bin/env node
// Read-only Google Search Console query for sc-domain:eduaipolicy.org.
//
// Credentials stay outside Git: `.env.agents.local` (in this checkout, or in
// the main checkout when run from a git worktree) supplies
// GOOGLE_APPLICATION_CREDENTIALS (service-account key under .local/secrets/)
// and GSC_SITE_URL. Values already in the environment win. Nothing secret is
// printed: only the query and the returned rows.
//
// Usage:
//   node scripts/gsc-query.mjs [--start YYYY-MM-DD] [--end YYYY-MM-DD]
//     [--dimensions date,page,query,country,device] [--row-limit 25]
//     [--page-contains /universities/] [--query-contains policy]
//     [--search-type web] [--data-state all|final]
//
// GSC rows are search-side metrics (clicks, impressions, ctr, position); they
// say nothing about onsite engagement.
import { readFileSync, existsSync } from "node:fs";
import { createSign } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// In a git worktree `.git` is a file pointing at <main>/.git/worktrees/<name>;
// local secrets live only in the main checkout.
function mainCheckoutRoot() {
  const dotGit = path.join(repoRoot, ".git");
  try {
    const match = /^gitdir:\s*(.+)$/m.exec(readFileSync(dotGit, "utf8"));
    const marker = `${path.sep}.git${path.sep}worktrees${path.sep}`;
    if (match && match[1].includes(marker)) return match[1].slice(0, match[1].indexOf(marker));
  } catch {
    // .git is a directory (main checkout) or missing.
  }
  return repoRoot;
}

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}

function parseArgs(argv) {
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const daysAgo = (n) => iso(new Date(today.getTime() - n * 86_400_000));
  const options = {
    start: daysAgo(10),
    end: daysAgo(3),
    dimensions: ["date"],
    rowLimit: 25,
    pageContains: undefined,
    queryContains: undefined,
    searchType: "web",
    dataState: "all",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) throw new Error(`${flag} needs a value`);
      return value;
    };
    if (flag === "--start") options.start = next();
    else if (flag === "--end") options.end = next();
    else if (flag === "--dimensions") options.dimensions = next().split(",").map((d) => d.trim()).filter(Boolean);
    else if (flag === "--row-limit") options.rowLimit = Number(next());
    else if (flag === "--page-contains") options.pageContains = next();
    else if (flag === "--query-contains") options.queryContains = next();
    else if (flag === "--search-type") options.searchType = next();
    else if (flag === "--data-state") options.dataState = next();
    else if (flag === "--help" || flag === "-h") {
      console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 17).join("\n"));
      process.exit(0);
    } else throw new Error(`Unknown argument: ${flag}`);
  }
  for (const key of ["start", "end"]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(options[key])) throw new Error(`--${key} must be YYYY-MM-DD`);
  }
  if (!Number.isInteger(options.rowLimit) || options.rowLimit < 1 || options.rowLimit > 25_000) {
    throw new Error("--row-limit must be an integer between 1 and 25000");
  }
  return options;
}

async function accessToken(credentials) {
  const b64url = (value) => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const input = [
    b64url({ alg: "RS256", typ: "JWT" }),
    b64url({ iss: credentials.client_email, scope: SCOPE, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }),
  ].join(".");
  const signature = createSign("RSA-SHA256").update(input).sign(credentials.private_key).toString("base64url");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${input}.${signature}` }),
  });
  const body = await response.json();
  // Never echo the token response: report only the status and OAuth error code.
  if (!response.ok || !body.access_token) throw new Error(`token request failed: HTTP ${response.status} ${body.error ?? ""}`.trim());
  return body.access_token;
}

async function main() {
  const secretsRoot = existsSync(path.join(repoRoot, ".env.agents.local")) ? repoRoot : mainCheckoutRoot();
  loadEnvFile(path.join(secretsRoot, ".env.agents.local"));
  const options = parseArgs(process.argv.slice(2));
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const site = process.env.GSC_SITE_URL ?? "sc-domain:eduaipolicy.org";
  if (!keyFile) throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not set (expected in .env.agents.local)");
  const keyPath = path.isAbsolute(keyFile) ? keyFile : path.join(secretsRoot, keyFile);
  if (!existsSync(keyPath)) throw new Error("service-account key file not found (path from GOOGLE_APPLICATION_CREDENTIALS)");
  const credentials = JSON.parse(readFileSync(keyPath, "utf8"));
  const token = await accessToken(credentials);

  const filters = [];
  if (options.pageContains) filters.push({ dimension: "page", operator: "contains", expression: options.pageContains });
  if (options.queryContains) filters.push({ dimension: "query", operator: "contains", expression: options.queryContains });
  const request = {
    startDate: options.start,
    endDate: options.end,
    dimensions: options.dimensions,
    rowLimit: options.rowLimit,
    type: options.searchType,
    dataState: options.dataState,
    ...(filters.length ? { dimensionFilterGroups: [{ filters }] } : {}),
  };
  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
    { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(request) },
  );
  const data = await response.json();
  console.log(JSON.stringify({
    ok: response.ok,
    status: response.status,
    site,
    request,
    rows: data.rows ?? [],
    ...(response.ok ? {} : { error: data.error?.message ?? "request failed" }),
  }, null, 2));
  if (!response.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`gsc-query: ${error.message}`);
  process.exit(1);
});
