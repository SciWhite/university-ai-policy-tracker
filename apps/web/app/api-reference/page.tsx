import { PUBLIC_API_VERSION } from "@uapt/shared";
import { ApiEndpointRow } from "@/components/api-endpoint-row";
import { DataList, DataListRow } from "@/components/data-list";
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
    label: "University record",
    path: `/api/public/${PUBLIC_API_VERSION}/universities/{slug}.json`,
    description:
      "One citation-ready university record with claims, evidence snippets, source URLs, confidence, review state, and rights caveats."
  },
  {
    label: "Recent changes",
    path: `/api/public/${PUBLIC_API_VERSION}/recent-changes.json`,
    description:
      "Recent public source checks and changed institution records."
  },
  {
    label: "Dataset release",
    path: `/api/public/${PUBLIC_API_VERSION}/datasets/latest.json`,
    description:
      "Release manifest with artifacts, row counts, byte sizes, SHA-256 checksums, citation, and limitations."
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
    label: "MCP alpha manifest",
    path: `/api/public/${PUBLIC_API_VERSION}/mcp/manifest.json`,
    description:
      "Read-only MCP design manifest with allowed tool shapes, prohibited actions, and example agent queries."
  },
  {
    label: "Rate-limit policy",
    path: `/api/public/${PUBLIC_API_VERSION}/rate-limit-policy.json`,
    description:
      "Machine-readable public fair-use policy for API, widget, and crawler access."
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
      <section className="hero">
        <p className="kicker">API reference</p>
        <h1>Versioned read-only public data API</h1>
        <p className="lead">
          The public API is a citation and lookup surface for policy metadata,
          not an internal app API. Every public JSON endpoint is versioned under{" "}
          <code>/api/public/{PUBLIC_API_VERSION}/...</code> and should be used
          with canonical page URLs, public JSON URLs, source URLs, review state,
          and citation fields.
        </p>
      </section>

      <ReferenceBox
        description="Read-only endpoints for records, releases, widgets, feeds, and agent integrations."
        title="Endpoint families"
      >
        {apiFamilies.map((endpoint) => (
          <ApiEndpointRow
            description={endpoint.description}
            key={endpoint.path}
            label={endpoint.label}
            path={endpoint.path}
            status="Read-only"
            url={endpoint.path.replace("{slug}", "anu")}
          />
        ))}
      </ReferenceBox>

      <ReferenceBox
        description="All API consumers should preserve the evidence model when displaying or summarizing public data."
        title="Citation and evidence requirements"
      >
        <ul className="compact-list">
          <li>Cite the canonical page URL and public JSON URL together.</li>
          <li>
            Treat each claim as reusable only with its source URL, source
            language, source snapshot hash, evidence snippet, confidence, and
            review state.
          </li>
          <li>
            Keep confidence separate from review state. Confidence is extraction
            confidence; review state is publication workflow status.
          </li>
          <li>
            Original-language evidence is canonical. Localized display text is
            only a helper layer.
          </li>
          <li>
            Do not present machine-candidate or needs-review claims as final
            policy conclusions.
          </li>
        </ul>
      </ReferenceBox>

      <ReferenceBox
        description="Public widgets use the same API contract, with CORS enabled only on widget JSON endpoints."
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
            metadata={<MetaLabel label="CORS">Widget endpoints only</MetaLabel>}
          >
            <h2>Cross-site use</h2>
            <p>
              Widget JSON endpoints include permissive CORS headers for public
              embedding. General public API endpoints remain normal same-origin
              JSON unless separately documented.
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
