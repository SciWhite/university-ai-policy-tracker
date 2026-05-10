import type {
  CatalogPolicySource,
  CatalogToolSummary,
  CatalogUniversity,
  DocumentStatus,
  ReviewState,
  ServiceTreatment
} from "@uapt/shared";
import { aiTools } from "@uapt/shared";
import type { Prisma, PrismaClient } from "@prisma/client";
import { getPrismaClient } from "./client.js";

const universityCatalogInclude = {
  policySources: {
    where: { active: true },
    orderBy: [{ title: "asc" }],
    include: {
      extractionCandidates: {
        orderBy: { createdAt: "desc" },
        take: 1
      },
      policyVersions: {
        orderBy: { versionNumber: "desc" },
        take: 1
      }
    }
  }
} satisfies Prisma.UniversityInclude;

type UniversityWithCatalog = Prisma.UniversityGetPayload<{
  include: typeof universityCatalogInclude;
}>;

export interface CatalogSourceRecord extends CatalogPolicySource {
  universityName: string;
  universitySlug: string;
}

export async function listCatalogUniversities(
  client: PrismaClient = getPrismaClient()
): Promise<CatalogUniversity[]> {
  const universities = await client.university.findMany({
    include: universityCatalogInclude,
    orderBy: [{ country: "asc" }, { name: "asc" }]
  });

  return universities.map(mapCatalogUniversity);
}

export async function getCatalogUniversityBySlug(
  slug: string,
  client: PrismaClient = getPrismaClient()
): Promise<CatalogUniversity | null> {
  const university = await client.university.findUnique({
    where: { slug },
    include: universityCatalogInclude
  });

  return university ? mapCatalogUniversity(university) : null;
}

export async function listCatalogTools(
  client: PrismaClient = getPrismaClient()
): Promise<CatalogToolSummary[]> {
  const universities = await listCatalogUniversities(client);

  return aiTools.map((tool) => {
    const universitiesWithTool = universities.filter((university) =>
      university.sources.some((source) => source.tools.includes(tool))
    );

    return {
      tool,
      sourceCount: universities.reduce(
        (total, university) =>
          total +
          university.sources.filter((source) => source.tools.includes(tool)).length,
        0
      ),
      universityCount: universitiesWithTool.length
    };
  });
}

export async function listCatalogSources(
  client: PrismaClient = getPrismaClient()
): Promise<CatalogSourceRecord[]> {
  const universities = await listCatalogUniversities(client);

  return universities.flatMap((university) =>
    university.sources.map((source) => ({
      ...source,
      universityName: university.name,
      universitySlug: university.slug
    }))
  );
}

function mapCatalogUniversity(university: UniversityWithCatalog): CatalogUniversity {
  const sources = university.policySources.map(mapCatalogSource);

  return {
    id: university.id,
    slug: university.slug,
    name: university.name,
    country: university.country,
    region: university.region ?? "Unknown",
    website: university.website ?? "https://example.com",
    summary:
      university.summary ??
      "Source-backed university AI policy status is pending review.",
    sourceCount: sources.length,
    sources,
    rankings: []
  };
}

function mapCatalogSource(
  source: UniversityWithCatalog["policySources"][number]
): CatalogPolicySource {
  const latestCandidate = source.extractionCandidates[0];
  const latestVersion = source.policyVersions[0];

  return {
    id: source.id,
    title: source.title ?? source.url,
    url: source.url,
    documentStatus: fromDbEnum(source.documentStatus) as DocumentStatus,
    serviceTreatment: fromDbEnum(
      latestVersion?.serviceTreatment ??
        latestCandidate?.serviceTreatment ??
        "NOT_MENTIONED"
    ) as ServiceTreatment,
    reviewState: fromDbEnum(latestCandidate?.reviewState ?? "NEEDS_REVIEW") as ReviewState,
    themes: (latestVersion?.themes ?? latestCandidate?.themes ?? []) as CatalogPolicySource["themes"],
    tools: (latestVersion?.aiTools ?? latestCandidate?.aiTools ?? []) as CatalogPolicySource["tools"],
    lastCheckedAt: source.lastCheckedAt?.toISOString(),
    lastChangedAt: source.lastChangedAt?.toISOString()
  };
}

function fromDbEnum(value: string): string {
  return value.toLowerCase();
}
