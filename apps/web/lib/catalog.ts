import {
  aiTools,
  catalogSourceRecordSchema,
  catalogToolSummarySchema,
  catalogUniversitySchema,
  seedUniversities,
  type CatalogSourceRecord,
  type CatalogToolSummary,
  type CatalogUniversity
} from "@uapt/shared";

type Parser<T> = {
  parse(value: unknown): T;
};

const API_BASE_URL = process.env.API_PUBLIC_BASE_URL;

export async function getCatalogUniversities(): Promise<CatalogUniversity[]> {
  return (
    (await fetchApi("/universities", {
      parse: (value) => catalogUniversitySchema.array().parse(value)
    })) ?? getSeedCatalogUniversities()
  );
}

export async function getCatalogUniversityBySlug(
  slug: string
): Promise<CatalogUniversity | undefined> {
  const fromApi = await fetchApi(`/universities/${slug}`, catalogUniversitySchema);

  if (fromApi) return fromApi;

  return getSeedCatalogUniversities().find((university) => university.slug === slug);
}

export async function getCatalogTools(): Promise<CatalogToolSummary[]> {
  return (
    (await fetchApi("/tools", {
      parse: (value) => catalogToolSummarySchema.array().parse(value)
    })) ?? getSeedCatalogTools()
  );
}

export async function getCatalogSources(): Promise<CatalogSourceRecord[]> {
  return (
    (await fetchApi("/sources", {
      parse: (value) => catalogSourceRecordSchema.array().parse(value)
    })) ?? getSeedCatalogSources()
  );
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
