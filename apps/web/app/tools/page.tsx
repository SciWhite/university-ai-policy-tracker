import {
  PUBLIC_API_VERSION,
  formatToolAvailability,
  formatToolEndorsementType,
  formatToolLabel,
  type UniversityToolRecord
} from "@uapt/shared";
import { DataList, DataListRow } from "@/components/data-list";
import { DocumentLink as Link } from "@/components/document-link";
import { JsonLd } from "@/components/json-ld";
import { MetaLabel } from "@/components/meta-label";
import { StateLabel } from "@/components/state-label";
import { getAllUniversityToolRecords } from "@/lib/tool-records";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

interface ToolsPageProps {
  searchParams?: Promise<{
    availability?: string;
    endorsementType?: string;
    q?: string;
    reviewState?: string;
    tool?: string;
  }>;
}

interface ToolFilters {
  availability?: string;
  endorsementType?: string;
  q?: string;
  reviewState?: string;
  tool?: string;
}

export const metadata = {
  title: "AI Tools | University AI Policy Tracker",
  description:
    "Derived university AI tool records with tool-level evidence, availability, endorsement type, review state, and official source links."
};

export default async function ToolsPage({ searchParams }: ToolsPageProps) {
  const filters = normalizeFilters((await searchParams) ?? {});
  const records = await getAllUniversityToolRecords();
  const filteredRecords = filterRecords(records, filters);
  const tools = unique(records.map((record) => record.tool));
  const availabilities = unique(records.map((record) => record.availability));
  const endorsementTypes = unique(
    records.map((record) => record.endorsementType)
  );
  const reviewStates = unique(records.map((record) => record.reviewState));
  const publicJsonPath = `/api/public/${PUBLIC_API_VERSION}/tools.json`;

  return (
    <main className="page-shell page-shell--wide">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "University AI tools directory",
          description: metadata.description,
          url: getAbsoluteSiteUrl("/tools"),
          isPartOf: {
            "@type": "WebSite",
            name: "University AI Policy Tracker",
            url: getAbsoluteSiteUrl("/")
          },
          mainEntity: {
            "@type": "Dataset",
            name: "University AI tools derived records",
            distribution: {
              "@type": "DataDownload",
              encodingFormat: "application/json",
              contentUrl: getAbsoluteSiteUrl(publicJsonPath)
            }
          }
        }}
      />

      <section className="hero">
        <p className="kicker">Derived tools</p>
        <h1>AI tools</h1>
        <p className="lead">
          Tool-level records derived from public claim and evidence text. These
          records are discovery metadata and do not replace official university
          source language.
        </p>
        <div className="tag-row hero-meta">
          <MetaLabel label="Tool records">{records.length}</MetaLabel>
          <MetaLabel label="Matching">{filteredRecords.length}</MetaLabel>
          <MetaLabel label="Public JSON">
            <a href={publicJsonPath}>{publicJsonPath}</a>
          </MetaLabel>
        </div>
      </section>

      <section className="section compact-section">
        <form action="/tools" className="university-filter-form" method="get">
          <label>
            <span>Search</span>
            <input
              defaultValue={filters.q ?? ""}
              name="q"
              placeholder="University, tool, evidence..."
              type="search"
            />
          </label>
          <label>
            <span>Tool</span>
            <select defaultValue={filters.tool ?? ""} name="tool">
              <option value="">All tools</option>
              {tools.map((tool) => (
                <option key={tool} value={tool}>
                  {formatToolLabel(tool)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Availability</span>
            <select
              defaultValue={filters.availability ?? ""}
              name="availability"
            >
              <option value="">All availability</option>
              {availabilities.map((availability) => (
                <option key={availability} value={availability}>
                  {formatToolAvailability(availability)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Endorsement</span>
            <select
              defaultValue={filters.endorsementType ?? ""}
              name="endorsementType"
            >
              <option value="">All endorsement</option>
              {endorsementTypes.map((endorsementType) => (
                <option key={endorsementType} value={endorsementType}>
                  {formatToolEndorsementType(endorsementType)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Review</span>
            <select defaultValue={filters.reviewState ?? ""} name="reviewState">
              <option value="">All review states</option>
              {reviewStates.map((reviewState) => (
                <option key={reviewState} value={reviewState}>
                  {formatLabel(reviewState)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Apply</button>
          <Link className="filter-reset-link" href="/tools">Reset</Link>
        </form>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Derived tool records</h2>
          <p>{filteredRecords.length} matching tool-level evidence record</p>
        </div>
        {filteredRecords.length ? (
          <DataList>
            {filteredRecords.map((record) => (
              <DataListRow
                actions={
                  <>
                    <Link href={`/universities/${record.universitySlug}`}>
                      University record
                    </Link>
                    <a href={record.evidence[0]?.sourceUrl}>Source</a>
                  </>
                }
                key={`${record.universitySlug}:${record.tool}`}
                metadata={
                  <>
                    <MetaLabel label="Canonical tool">
                      {formatToolLabel(record.tool)}
                    </MetaLabel>
                    <MetaLabel label="Availability">
                      {formatToolAvailability(record.availability)}
                    </MetaLabel>
                    <MetaLabel label="Endorsement">
                      {formatToolEndorsementType(record.endorsementType)}
                    </MetaLabel>
                    <StateLabel reviewState={record.reviewState} />
                  </>
                }
              >
                <h2>{record.rawToolName}</h2>
                <p>
                  <Link href={`/universities/${record.universitySlug}`}>
                    {record.universityName}
                  </Link>
                </p>
                <p className="muted">
                  Canonical slug: {record.tool}. Evidence records:{" "}
                  {record.evidence.length}. Tool status is derived from
                  source-backed claim and evidence text.
                </p>
                <p>{record.evidence[0]?.evidenceSnippet}</p>
              </DataListRow>
            ))}
          </DataList>
        ) : (
          <p className="notice-card">
            No derived tool records match these filters. Unknown or broad AI
            tool mentions are not expanded into named tool conclusions.
          </p>
        )}
      </section>
    </main>
  );
}

function normalizeFilters(filters: ToolFilters): ToolFilters {
  return {
    availability: normalizeString(filters.availability),
    endorsementType: normalizeString(filters.endorsementType),
    q: normalizeString(filters.q),
    reviewState: normalizeString(filters.reviewState),
    tool: normalizeString(filters.tool)
  };
}

function filterRecords(
  records: UniversityToolRecord[],
  filters: ToolFilters
): UniversityToolRecord[] {
  const query = filters.q?.toLowerCase();

  return records.filter((record) => {
    if (filters.tool && record.tool !== filters.tool) return false;
    if (filters.availability && record.availability !== filters.availability) {
      return false;
    }
    if (
      filters.endorsementType &&
      record.endorsementType !== filters.endorsementType
    ) {
      return false;
    }
    if (filters.reviewState && record.reviewState !== filters.reviewState) {
      return false;
    }
    if (!query) return true;

    const haystack = [
      record.universityName,
      record.universitySlug,
      record.rawToolName,
      record.tool,
      formatToolLabel(record.tool),
      formatToolAvailability(record.availability),
      formatToolEndorsementType(record.endorsementType),
      ...record.evidence.map((evidence) => evidence.evidenceSnippet)
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

function unique<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values)).sort((left, right) =>
    left.localeCompare(right)
  );
}

function normalizeString(value: string | undefined): string | undefined {
  const normalized = value?.trim();

  return normalized || undefined;
}

function formatLabel(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
