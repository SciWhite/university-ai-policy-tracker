import crypto from "node:crypto";
import fs from "node:fs";

export interface GscMetricRow {
  clicks: number;
  ctr: number;
  impressions: number;
  key: string;
  position: number;
}

export interface GscSummary {
  available: boolean;
  countryRows: GscMetricRow[];
  dateRows: GscMetricRow[];
  deviceRows: GscMetricRow[];
  error?: string;
  pageRows: GscMetricRow[];
  queryRows: GscMetricRow[];
  siteUrl?: string;
  totals: {
    clicks: number;
    ctr: number;
    impressions: number;
    position: number;
  };
}

interface GoogleCredentials {
  client_email: string;
  private_key: string;
}

interface GscApiRow {
  clicks?: number;
  ctr?: number;
  impressions?: number;
  keys?: string[];
  position?: number;
}

export async function getGoogleSearchConsoleSummary(
  startDate: Date,
  endDate: Date,
  options: { detailRowLimit?: number } = {}
): Promise<GscSummary> {
  const siteUrl = process.env.GSC_SITE_URL ?? "sc-domain:eduaipolicy.org";
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialPath) {
    return emptyGscSummary({
      error: "GSC credentials are not configured.",
      siteUrl
    });
  }

  try {
    const token = await getAccessToken(credentialPath);
    const detailRowLimit = Math.max(
      12,
      Math.min(250, options.detailRowLimit ?? 12)
    );
    const [dateRows, pageRows, queryRows, countryRows, deviceRows] =
      await Promise.all([
        queryGsc(token, siteUrl, startDate, endDate, ["date"], 240),
        queryGsc(token, siteUrl, startDate, endDate, ["page"], detailRowLimit),
        queryGsc(token, siteUrl, startDate, endDate, ["query"], detailRowLimit),
        queryGsc(token, siteUrl, startDate, endDate, ["country"], 12),
        queryGsc(token, siteUrl, startDate, endDate, ["device"], 8)
      ]);

    return {
      available: true,
      countryRows,
      dateRows,
      deviceRows,
      pageRows,
      queryRows,
      siteUrl,
      totals: getMetricTotals(dateRows)
    };
  } catch (error) {
    return emptyGscSummary({
      error: error instanceof Error ? error.message : String(error),
      siteUrl
    });
  }
}

function emptyGscSummary(input: {
  error?: string;
  siteUrl?: string;
}): GscSummary {
  return {
    available: false,
    countryRows: [],
    dateRows: [],
    deviceRows: [],
    error: input.error,
    pageRows: [],
    queryRows: [],
    siteUrl: input.siteUrl,
    totals: {
      clicks: 0,
      ctr: 0,
      impressions: 0,
      position: 0
    }
  };
}

async function getAccessToken(credentialPath: string): Promise<string> {
  const creds = JSON.parse(
    fs.readFileSync(credentialPath, "utf8")
  ) as GoogleCredentials;
  const now = Math.floor(Date.now() / 1000);
  const assertionInput = [
    base64Url({ alg: "RS256", typ: "JWT" }),
    base64Url({
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
      iss: creds.client_email,
      scope: "https://www.googleapis.com/auth/webmasters.readonly"
    })
  ].join(".");
  const assertion = [
    assertionInput,
    crypto
      .sign("RSA-SHA256", Buffer.from(assertionInput), creds.private_key)
      .toString("base64url")
  ].join(".");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams({
      assertion,
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer"
    }),
    cache: "no-store",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    method: "POST"
  });
  const data = (await response.json()) as { access_token?: string; error?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(`GSC token request failed: ${data.error ?? response.status}`);
  }
  return data.access_token;
}

async function queryGsc(
  token: string,
  siteUrl: string,
  startDate: Date,
  endDate: Date,
  dimensions: string[],
  rowLimit: number
): Promise<GscMetricRow[]> {
  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
      siteUrl
    )}/searchAnalytics/query`,
    {
      body: JSON.stringify({
        dataState: "final",
        dimensions,
        endDate: formatGscDate(endDate),
        rowLimit,
        startDate: formatGscDate(startDate)
      }),
      cache: "no-store",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      method: "POST"
    }
  );
  const data = (await response.json()) as { rows?: GscApiRow[]; error?: unknown };
  if (!response.ok) {
    throw new Error(`GSC query failed: ${response.status}`);
  }

  return (data.rows ?? []).map((row) => ({
    clicks: row.clicks ?? 0,
    ctr: row.ctr ?? 0,
    impressions: row.impressions ?? 0,
    key: row.keys?.join(" / ") ?? "unknown",
    position: row.position ?? 0
  }));
}

function getMetricTotals(rows: GscMetricRow[]): GscSummary["totals"] {
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  const weightedPosition = rows.reduce(
    (sum, row) => sum + row.position * row.impressions,
    0
  );

  return {
    clicks,
    ctr: impressions ? clicks / impressions : 0,
    impressions,
    position: impressions ? weightedPosition / impressions : 0
  };
}

function base64Url(value: unknown): string {
  return Buffer.from(
    typeof value === "string" ? value : JSON.stringify(value)
  ).toString("base64url");
}

export function formatGscDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
