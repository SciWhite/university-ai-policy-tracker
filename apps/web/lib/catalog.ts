import {
  aiTools,
  catalogSourceRecordSchema,
  catalogToolSummarySchema,
  catalogUniversitySchema,
  buildSeedPublicEntitySummary,
  PUBLIC_API_VERSION,
  publicEntitySummaryResponseSchema,
  publicEntitySummarySchema,
  seedUniversities,
  type CatalogSourceRecord,
  type CatalogToolSummary,
  type CatalogUniversity,
  type PublicEntitySummary
} from "@uapt/shared";
import { getSiteBaseUrl } from "./site-url";
import {
  getStagedCatalogSources,
  getStagedCatalogUniversities,
  getStagedPublicSummaryBySlug
} from "./staged-public-data";

type Parser<T> = {
  parse(value: unknown): T;
};

const API_BASE_URL = process.env.API_PUBLIC_BASE_URL;

export async function getCatalogUniversities(): Promise<CatalogUniversity[]> {
  const fromApi = await fetchApi("/universities", {
    parse: (value) => catalogUniversitySchema.array().parse(value)
  });
  if (fromApi?.length) return fromApi;

  const fromStaging = await getStagedCatalogUniversities();
  if (fromStaging.length) return fromStaging;

  return getSeedCatalogUniversities();
}

export async function getCatalogUniversityBySlug(
  slug: string
): Promise<CatalogUniversity | undefined> {
  const fromApi = await fetchApi(`/universities/${slug}`, catalogUniversitySchema);

  if (fromApi) return fromApi;

  return (
    (await getStagedCatalogUniversities()).find(
      (university) => university.slug === slug
    ) ?? getSeedCatalogUniversities().find((university) => university.slug === slug)
  );
}

export async function getCatalogTools(): Promise<CatalogToolSummary[]> {
  return (
    (await fetchApi("/tools", {
      parse: (value) => catalogToolSummarySchema.array().parse(value)
    })) ?? getSeedCatalogTools()
  );
}

export async function getCatalogSources(): Promise<CatalogSourceRecord[]> {
  const fromApi = await fetchApi("/sources", {
    parse: (value) => catalogSourceRecordSchema.array().parse(value)
  });
  if (fromApi?.length) return fromApi;

  const fromStaging = await getStagedCatalogSources();
  if (fromStaging.length) return fromStaging;

  return getSeedCatalogSources();
}

export async function getPublicUniversitySummaryBySlug(
  slug: string
): Promise<PublicEntitySummary | undefined> {
  const fromApi = await fetchApi(
    `/api/public/${PUBLIC_API_VERSION}/universities/${slug}.json`,
    {
      parse: (value) => {
        const envelope = publicEntitySummaryResponseSchema.safeParse(value);
        if (envelope.success) return envelope.data.data;

        return publicEntitySummarySchema.parse(value);
      }
    }
  );

  if (fromApi) return fromApi;

  const fromStaging = await getStagedPublicSummaryBySlug(slug);
  if (fromStaging) return fromStaging;

  const seedUniversity = seedUniversities.find(
    (university) => university.slug === slug
  );

  return seedUniversity
    ? buildSeedPublicEntitySummary(seedUniversity, getSiteBaseUrl())
    : undefined;
}

export function getPublicJsonUrl(slug: string): string {
  const path = `/api/public/${PUBLIC_API_VERSION}/universities/${slug}.json`;
  return API_BASE_URL ? new URL(path, API_BASE_URL).toString() : path;
}

export function getRecentChangesJsonUrl(): string {
  const path = `/api/public/${PUBLIC_API_VERSION}/recent-changes.json`;
  return API_BASE_URL ? new URL(path, API_BASE_URL).toString() : path;
}

export function getPublicApiIndexJsonUrl(): string {
  const path = `/api/public/${PUBLIC_API_VERSION}/index.json`;
  return API_BASE_URL ? new URL(path, API_BASE_URL).toString() : path;
}

export function getPublicUniversitiesJsonUrl(): string {
  const path = `/api/public/${PUBLIC_API_VERSION}/universities.json`;
  return API_BASE_URL ? new URL(path, API_BASE_URL).toString() : path;
}

function getSeedCatalogUniversities(): CatalogUniversity[] {
  return seedUniversities.map((university) => ({
    ...university,
    sourceCount: university.sources.length,
    sources: university.sources.map((source) => ({ ...source }))
  }));
}

function getSeedCatalogTools(): CatalogToolSummary[] {
  const universities = getSeedCatalogUniversities();

  return aiTools.map((tool) => ({
    tool,
    sourceCount: universities.reduce(
      (total, university) =>
        total +
        university.sources.filter((source) => source.tools.includes(tool)).length,
      0
    ),
    universityCount: universities.filter((university) =>
      university.sources.some((source) => source.tools.includes(tool))
    ).length
  }));
}

function getSeedCatalogSources(): CatalogSourceRecord[] {
  return getSeedCatalogUniversities().flatMap((university) =>
    university.sources.map((source) => ({
      ...source,
      universityName: university.name,
      universitySlug: university.slug
    }))
  );
}

async function fetchApi<T>(path: string, parser: Parser<T>): Promise<T | null> {
  if (!API_BASE_URL) return null;

  try {
    const response = await fetch(new URL(path, API_BASE_URL), {
      next: { revalidate: 60 }
    });

    if (!response.ok) return null;

    return parser.parse(await response.json());
  } catch {
    return null;
  }
}
