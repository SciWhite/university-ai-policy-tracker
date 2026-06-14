import { PUBLIC_API_VERSION } from "@uapt/shared";
import { ApiEndpointRow } from "@/components/api-endpoint-row";
import { DataList, DataListRow } from "@/components/data-list";
import { JsonLd } from "@/components/json-ld";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import {
  rateLimitPolicy,
  widgetScriptPath
} from "@/lib/developer-surfaces";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

const title = "API Reference | University AI Policy Tracker";
const description =
  "Read-only public API reference for versioned university AI policy JSON, dataset releases, widgets, feeds, rate limits, and citation requirements.";

const apiFamilies = [
  {
    label: "Discovery",
    path: `/api/public/${PUBLIC_API_VERSION}/index.json`,
    description:
      "Public API index with endpoint links, trust pages, citation rules, limitations, and version metadata."
  },
  {
    label: "Universities",
    path: `/api/public/${PUBLIC_API_VERSION}/universities.json`,
    description:
      "Public university record list with canonical page URL, public JSON URL, review state, dates, and counts."
  },
  {
    label: "Entity search",
    path: `/api/public/${PUBLIC_API_VERSION}/search.json?q={query}`,
    description:
      "Search public university records by canonical name, alias, official source title, claim summary, source domain, or analysis dimension."
  },
  {
    label: "Safe search index",
    path: `/api/public/${PUBLIC_API_VERSION}/search/index.json`,
    description:
      "Pagefind-ready public search index excluding raw source snapshots, private files, unpromoted staging evidence, and non-authoritative spreadsheet rows."
  },
  {
    label: "Entity resolution index",
    path: `/api/public/${PUBLIC_API_VERSION}/entities/index.json`,
    description:
      "Canonical university entity aliases for recall. Alias matches do not create public policy facts."
  },
  {
    label: "University record",
    path: `/api/public/${PUBLIC_API_VERSION}/universities/{slug}.json`,
    description:
      "One citation-ready university record with claims, evidence snippets, source URLs, confidence, review state, and rights caveats."
  },
  {
    label: "University claims",
    path: `/api/public/${PUBLIC_API_VERSION}/claims/{slug}.json`,
    description:
      "One public university record's claim/evidence rows with source URL, source language, snapshot hash, confidence, and review state."
  },
  {
    label: "AI tools directory",
    path: `/api/public/${PUBLIC_API_VERSION}/tools.json`,
    description:
      "Derived university AI tool records with tool-level availability, endorsement type, review state, and evidence snippets. Tool records are discovery metadata, not official policy conclusions."
  },
  {
    label: "Recent changes",
    path: `/api/public/${PUBLIC_API_VERSION}/recent-changes.json`,
    description:
      "Recent public source checks and changed institution records."
  },
  {
    label: "Analysis API index",
    path: `/api/public/${PUBLIC_API_VERSION}/analysis/index.json`,
    description:
      "Deterministic policy analysis dimensions, endpoint paths, limitations, and schema version metadata."
  },
  {
    label: "University analysis profile",
    path: `/api/public/${PUBLIC_API_VERSION}/analysis/universities/{slug}.json`,
    description:
      "Source-backed analysis profile with dimensions, evidence claim IDs, source URLs, confidence, review state, and policy coverage score."
  },
  {
    label: "Policy coverage scores",
    path: `/api/public/${PUBLIC_API_VERSION}/analysis/coverage-scores.json`,
    description:
      "Coverage score list for public analysis profiles. Scores measure breadth of source-backed public coverage, not policy quality."
  },
  {
    label: "Analysis page quality",
    path: `/api/public/${PUBLIC_API_VERSION}/analysis/page-quality.json`,
    description:
      "Read-only page-quality gates, indexability status, analysis review workflow, and no-advice boundaries for public analysis pages."
  },
  {
    label: "QS 2026 coverage",
    path: `/api/public/${PUBLIC_API_VERSION}/coverage/qs-2026.json`,
    description:
      "Collection coverage rows for QS 2026 targets with public, staging-only, missing, source-count, review-state, and next-action fields."
  },
  {
    label: "Source health",
    path: `/api/public/${PUBLIC_API_VERSION}/source-health.json`,
    description:
      "Source/fetch health metadata for promoted public source snapshots and staging runs. Used for repair planning, not claim publication."
  },
  {
    label: "Review queue",
    path: `/api/public/${PUBLIC_API_VERSION}/review/queue.json`,
    description:
      "Unpromoted staging run metadata with validation status, source breadth, detected slugs, and recommended next action."
  },
  {
    label: "Dataset release",
    path: `/api/public/${PUBLIC_API_VERSION}/datasets/latest.json`,
    description:
      "Release manifest with artifacts, row counts, byte sizes, SHA-256 checksums, citation, and limitations."
  },
  {
    label: "Reports index",
    path: `/api/public/${PUBLIC_API_VERSION}/reports/index.json`,
    description:
      "Machine-readable reports index with report URLs, metrics, data links, feeds, and outreach discovery."
  },
  {
    label: "Report chart data",
    path: `/api/public/${PUBLIC_API_VERSION}/reports/monthly/2026-05/chart-data.json`,
    description:
      "Chart-ready source-language, review-state, region coverage, city/campus coverage, and ranking coverage distributions for the May 2026 monthly baseline report."
  },
  {
    label: "Reports outreach package",
    path: `/api/public/${PUBLIC_API_VERSION}/reports/outreach.json`,
    description:
      "Machine-readable media, newsletter, researcher-email, and social copy with explicit use boundaries."
  },
  {
    label: "Widget index",
    path: `/api/public/${PUBLIC_API_VERSION}/widgets/index.json`,
    description:
      "Widget discovery payload with script URL, supported widgets, constraints, and example HTML."
  },
  {
    label: "University status widget",
    path: `/api/public/${PUBLIC_API_VERSION}/widgets/university-status/{slug}.json`,
    description:
      "Compact widget payload with freshness, review state, claim/source counts, and canonical links."
  },
  {
    label: "Recent changes widget",
    path: `/api/public/${PUBLIC_API_VERSION}/widgets/recent-changes.json`,
    description:
      "Compact recent changes payload for public source-check and change widgets."
  },
  {
    label: "Policy coverage widget",
    path: `/api/public/${PUBLIC_API_VERSION}/widgets/policy-coverage/{slug}.json`,
    description:
      "Compact source-backed policy coverage widget payload. Coverage is breadth, not policy quality."
  },
  {
    label: "Source freshness widget",
    path: `/api/public/${PUBLIC_API_VERSION}/widgets/source-freshness/{slug}.json`,
    description:
      "Compact source freshness widget payload with last checked date, source count, and public source-health counts."
  },
  {
    label: "Review-state widget",
    path: `/api/public/${PUBLIC_API_VERSION}/widgets/review-state/{slug}.json`,
    description:
      "Compact review-state widget payload with confidence, reviewed claims, and candidate claim counts."
  },
  {
    label: "MCP alpha manifest",
    path: `/api/public/${PUBLIC_API_VERSION}/mcp/manifest.json`,
    description:
      "Read-only MCP design manifest with allowed tool shapes, prohibited actions, and example agent queries."
  },
  {
    label: "MCP tool catalog",
    path: `/api/public/${PUBLIC_API_VERSION}/mcp/tool-catalog.json`,
    description:
      "Read-only MCP alpha tool catalog with input schemas, required output fields, and hard prohibited mutations."
  },
  {
    label: "Rate-limit policy",
    path: `/api/public/${PUBLIC_API_VERSION}/rate-limit-policy.json`,
    description:
      "Machine-readable public fair-use policy for API, widget, and crawler access."
  },
  {
    label: "Citation metadata",
    path: `/api/public/${PUBLIC_API_VERSION}/citation.json`,
    description:
      "Machine-readable citation templates, required fields, evidence rules, source rights caveat, and no-advice boundary."
  },
  {
    label: "Contribution index",
    path: `/api/public/${PUBLIC_API_VERSION}/contributions/index.json`,
    description:
      "Read-only contribution workflow metadata, GitHub issue template URLs, safeguards, and publication rules."
  },
  {
    label: "Contribution review policy",
    path: `/api/public/${PUBLIC_API_VERSION}/contributions/review-policy.json`,
    description:
      "Read-only review queue definitions, moderation boundaries, and publication gates."
  }
] as const;

export function generateMetadata() {
  const canonical = getAbsoluteSiteUrl("/api-reference");

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website"
    }
  };
}

export default function ApiReferencePage() {
  return (
    <main className="page-shell page-shell--wide">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "TechArticle",
          name: title,
          description,
          url: getAbsoluteSiteUrl("/api-reference"),
          isPartOf: {
            "@type": "WebSite",
            name: "University AI Policy Tracker",
            url: getAbsoluteSiteUrl("/")
          },
          about: [
            "university AI policy API",
            "source-backed public JSON",
            "AI agent retrieval",
            "citation metadata"
          ]
        }}
      />
      <section className="hero">
        <p className="kicker">API reference</p>
        <h1>Versioned read-only public data API</h1>
        <p className="lead">
          Citation and lookup endpoints for public policy metadata. Every JSON
          endpoint is versioned under{" "}
          <code>/api/public/{PUBLIC_API_VERSION}</code>.
        </p>
      </section>

      <section className="answer-strip" aria-label="API reference answer blocks">
        <article className="answer-card">
          <h2>What the API returns</h2>
          <p>
            Read-only tracker metadata: canonical record URLs, public JSON,
            review states, evidence fields, source links, and citation fields.
          </p>
        </article>
        <article className="answer-card">
          <h2>What the API does not do</h2>
          <p>
            It does not mutate records, publish staging runs, bypass review
            state, or replace official university policy sources.
          </p>
        </article>
        <article className="answer-card">
          <h2>Recommended retrieval</h2>
          <p>
            Resolve with search or entity aliases, fetch the university record,
            then attach claim evidence and source URLs for claim-level answers.
          </p>
        </article>
      </section>

      <ReferenceBox
        className="compact-reference-box"
        description="Recommended use for agents and data tools."
        title="Agent and API positioning"
      >
        <ul className="compact-list">
          <li>
            Use for source-backed summaries, public JSON, citation metadata,
            review state, and official source links.
          </li>
          <li>
            Use official university pages as the authority for policy language.
          </li>
          <li>
            Do not treat analysis as advice, safety guidance, or compliance.
          </li>
          <li>
            Alias matches, themes, and coverage scores do not create facts.
          </li>
          <li>
            Tool records are derived from claim and evidence text; they do not
            replace official university source language.
          </li>
        </ul>
      </ReferenceBox>

      <ReferenceBox
        description="A safe retrieval order for agents that need citation-backed answers."
        title="Recommended retrieval sequence"
      >
        <DataList>
          <DataListRow
            metadata={<MetaLabel label="Step">1</MetaLabel>}
          >
            <h2>Resolve the entity</h2>
            <p>
              Call <code>/api/public/{PUBLIC_API_VERSION}/search.json?q=...</code>{" "}
              or inspect <code>/api/public/{PUBLIC_API_VERSION}/entities/index.json</code>{" "}
              to find the canonical university slug. Alias matches improve
              recall, but they do not create facts.
            </p>
          </DataListRow>
          <DataListRow
            metadata={<MetaLabel label="Step">2</MetaLabel>}
          >
            <h2>Open the canonical record</h2>
            <p>
              Fetch <code>/api/public/{PUBLIC_API_VERSION}/universities/{"{slug}"}.json</code>{" "}
              and keep the canonical page URL, public JSON URL, review state,
              last checked date, limitations, and citation fields with the
              answer.
            </p>
          </DataListRow>
          <DataListRow
            metadata={<MetaLabel label="Step">3</MetaLabel>}
          >
            <h2>Attach claim evidence</h2>
            <p>
              Fetch <code>/api/public/{PUBLIC_API_VERSION}/claims/{"{slug}"}.json</code>{" "}
              when claim-level reuse is needed. Preserve source URLs, source
              language, evidence snippets, snapshot hashes, confidence, and
              review state.
            </p>
          </DataListRow>
          <DataListRow
            metadata={<MetaLabel label="Step">4</MetaLabel>}
          >
            <h2>Use analysis as derived metadata</h2>
            <p>
              Fetch <code>/api/public/{PUBLIC_API_VERSION}/analysis/universities/{"{slug}"}.json</code>{" "}
              only as deterministic derived metadata. Always cite the basis
              claim IDs and source URLs for non-empty analysis dimensions.
            </p>
          </DataListRow>
        </DataList>
      </ReferenceBox>

      <ReferenceBox
        description="Records, releases, widgets, feeds, and agent integrations."
        title="Endpoint families"
      >
        {apiFamilies.map((endpoint) => (
          <ApiEndpointRow
            description={endpoint.description}
            key={endpoint.path}
            label={endpoint.label}
            path={endpoint.path}
            status="Read-only"
            url={endpoint.path.replace("{slug}", "anu").replace("{query}", "mit")}
          />
        ))}
      </ReferenceBox>

      <ReferenceBox
        className="compact-reference-box"
        description="Preserve the evidence model when reusing public data."
        title="Citation and evidence requirements"
      >
        <ul className="compact-list">
          <li>Cite the canonical page URL and public JSON URL together.</li>
          <li>
            Keep source URL, language, snapshot hash, evidence snippet,
            confidence, and review state with claim reuse.
          </li>
          <li>
            Confidence and review state are separate fields.
          </li>
          <li>Original-language evidence is canonical.</li>
          <li>
            Do not present machine-candidate or needs-review claims as final
            policy conclusions.
          </li>
          <li>
            Contribution endpoints are metadata only. Public submissions create
            review tasks through GitHub issue templates, not direct canonical
            facts.
          </li>
        </ul>
      </ReferenceBox>

      <ReferenceBox
        description="Public widgets use the same API contract, with CORS enabled for embeddable widget JSON and entity search."
        title="Embeddable widget contract"
      >
        <DataList>
          <DataListRow
            metadata={<MetaLabel label="Script">{widgetScriptPath}</MetaLabel>}
          >
            <h2>JavaScript embed</h2>
            <p>
              The embed script renders a compact Shadow DOM card and reads only
              widget-specific public JSON. It links back to canonical tracker
              pages and avoids unreviewed claim text.
            </p>
          </DataListRow>
          <DataListRow
            metadata={<MetaLabel label="CORS">Widgets and search</MetaLabel>}
          >
            <h2>Cross-site use</h2>
            <p>
              Widget JSON endpoints and the public entity search endpoint
              include permissive CORS headers for public embedding and
              browser-based lookup. Other public API endpoints remain normal
              same-origin JSON unless separately documented.
            </p>
          </DataListRow>
        </DataList>
      </ReferenceBox>

      <ReferenceBox
        description="This is a public fair-use policy, not a paid API SLA."
        id="rate-limits"
        title="Rate-limit and crawler policy"
      >
        <dl className="source-attribution-row__meta">
          <div>
            <dt>Suggested limit</dt>
            <dd>{rateLimitPolicy.suggestedLimit}</dd>
          </div>
          <div>
            <dt>Client cache</dt>
            <dd>
              {rateLimitPolicy.recommendedClientCacheSeconds} seconds minimum
            </dd>
          </div>
          <div>
            <dt>Bulk use</dt>
            <dd>{rateLimitPolicy.bulkUse}</dd>
          </div>
          <div>
            <dt>Crawler use</dt>
            <dd>{rateLimitPolicy.crawlerUse}</dd>
          </div>
        </dl>
        <p className="notice-card">{rateLimitPolicy.changeNotice}</p>
      </ReferenceBox>
    </main>
  );
}
