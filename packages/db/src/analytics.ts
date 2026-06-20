import type { Prisma, PrismaClient } from "./prisma-client.js";
import { getPrismaClient } from "./client.js";

export interface AnalyticsEventRecordInput {
  countryCode?: string;
  copyTarget?: string;
  createdAt?: Date;
  deviceType?: string;
  endpointKind?: string;
  entitySlug?: string;
  exampleKey?: string;
  eventName: string;
  footerGroup?: string;
  fromLocale?: string;
  fromTheme?: string;
  limitBucket?: string;
  locale?: string;
  navArea?: string;
  pageType?: string;
  pathname: string;
  payload?: Record<string, unknown>;
  sessionId?: string;
  queryKind?: string;
  queryLengthBucket?: string;
  resultCountBucket?: string;
  resultRank?: number;
  resultSource?: string;
  source?: string;
  sourceDomain?: string;
  visitorId?: string;
  targetKind?: string;
  toLocale?: string;
  toTheme?: string;
}

export interface AnalyticsEventSummary {
  count: number;
  eventName: string;
}

export interface AnalyticsEventRow {
  countryCode?: string | null;
  createdAt: string;
  copyTarget?: string | null;
  deviceType?: string | null;
  endpointKind?: string | null;
  entitySlug?: string | null;
  exampleKey?: string | null;
  eventName: string;
  footerGroup?: string | null;
  fromLocale?: string | null;
  fromTheme?: string | null;
  id: string;
  limitBucket?: string | null;
  locale?: string | null;
  navArea?: string | null;
  pageType?: string | null;
  pathname: string;
  payload?: unknown;
  sessionId?: string | null;
  queryKind?: string | null;
  queryLengthBucket?: string | null;
  resultCountBucket?: string | null;
  resultRank?: number | null;
  resultSource?: string | null;
  source: string;
  sourceDomain?: string | null;
  visitorId?: string | null;
  targetKind?: string | null;
  toLocale?: string | null;
  toTheme?: string | null;
}

export async function recordAnalyticsEvent(
  input: AnalyticsEventRecordInput,
  client: PrismaClient = getPrismaClient()
): Promise<{ id: string; eventName: string }> {
  const created = await client.analyticsEvent.create({
    data: {
      countryCode: input.countryCode,
      copyTarget: input.copyTarget,
      createdAt: input.createdAt,
      deviceType: input.deviceType,
      endpointKind: input.endpointKind,
      entitySlug: input.entitySlug,
      exampleKey: input.exampleKey,
      eventName: input.eventName,
      footerGroup: input.footerGroup,
      fromLocale: input.fromLocale,
      fromTheme: input.fromTheme,
      limitBucket: input.limitBucket,
      locale: input.locale,
      navArea: input.navArea,
      pageType: input.pageType,
      pathname: input.pathname,
      payload: toJson(input.payload),
      sessionId: input.sessionId,
      queryKind: input.queryKind,
      queryLengthBucket: input.queryLengthBucket,
      resultCountBucket: input.resultCountBucket,
      resultRank: input.resultRank,
      resultSource: input.resultSource,
      source: input.source ?? "client",
      sourceDomain: input.sourceDomain,
      visitorId: input.visitorId,
      targetKind: input.targetKind,
      toLocale: input.toLocale,
      toTheme: input.toTheme
    }
  });

  return {
    id: created.id,
    eventName: created.eventName
  };
}

export async function listAnalyticsEvents(
  since: Date,
  client: PrismaClient = getPrismaClient()
): Promise<AnalyticsEventRow[]> {
  const rows = await client.analyticsEvent.findMany({
    where: { createdAt: { gte: since } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });

  return rows.map((row: any) => ({
    countryCode: row.countryCode,
    createdAt: row.createdAt.toISOString(),
    copyTarget: row.copyTarget,
    deviceType: row.deviceType,
    endpointKind: row.endpointKind,
    entitySlug: row.entitySlug,
    exampleKey: row.exampleKey,
    eventName: row.eventName,
    footerGroup: row.footerGroup,
    fromLocale: row.fromLocale,
    fromTheme: row.fromTheme,
    id: row.id,
    limitBucket: row.limitBucket,
    locale: row.locale,
    navArea: row.navArea,
    pageType: row.pageType,
    pathname: row.pathname,
    payload: row.payload,
    sessionId: row.sessionId,
    queryKind: row.queryKind,
    queryLengthBucket: row.queryLengthBucket,
    resultCountBucket: row.resultCountBucket,
    resultRank: row.resultRank,
    resultSource: row.resultSource,
    source: row.source,
    sourceDomain: row.sourceDomain,
    visitorId: row.visitorId,
    targetKind: row.targetKind,
    toLocale: row.toLocale,
    toTheme: row.toTheme
  }));
}

function toJson(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
  return value as Prisma.InputJsonValue | undefined;
}
