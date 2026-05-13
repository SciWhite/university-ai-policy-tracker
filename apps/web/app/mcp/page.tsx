import { PUBLIC_API_VERSION } from "@uapt/shared";
import { ApiEndpointRow } from "@/components/api-endpoint-row";
import { DataList, DataListRow } from "@/components/data-list";
import { JsonLd } from "@/components/json-ld";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import {
  exampleAgentQueries,
  mcpToolSpecs
} from "@/lib/developer-surfaces";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

const title = "Read-only MCP Alpha | University AI Policy Tracker";
const description =
  "Read-only MCP alpha design for agents that need source-backed university AI policy metadata without mutation access.";

export function generateMetadata() {
  const canonical = getAbsoluteSiteUrl("/mcp");

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

export default function McpPage() {
  return (
    <main className="page-shell page-shell--wide">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "TechArticle",
          name: title,
          description,
          url: getAbsoluteSiteUrl("/mcp"),
          isPartOf: {
            "@type": "WebSite",
            name: "University AI Policy Tracker",
            url: getAbsoluteSiteUrl("/")
          },
          about: [
            "read-only MCP",
            "AI agent retrieval",
            "university AI policy public JSON",
            "source-backed citation"
          ]
        }}
      />
      <section className="hero">
        <p className="kicker">MCP alpha</p>
        <h1>Read-only agent access design</h1>
        <p className="lead">
          The first MCP surface is intentionally read-only. It should help agents
          answer citation-backed questions from public records, but it must not
          mutate records, write the production database, publish canonical
          claims, push main, operate OpenClaw, or bypass review state.
        </p>
      </section>

      <ReferenceBox
        description="How future MCP clients should decide when to use this tracker."
        title="When agents should use this source"
      >
        <ul className="compact-list">
          <li>
            Use this tracker for source-backed summaries, public JSON, citation
            metadata, review state, confidence, and official source URLs.
          </li>
          <li>
            Use it for comparison, coverage, recent-change, theme, region, and
            dataset questions that official single-university pages do not
            answer directly.
          </li>
          <li>
            Prefer the linked official university source when the user asks for
            final institutional policy language or a binding rule.
          </li>
          <li>
            Refuse to turn tracker metadata into legal advice, academic
            integrity advice, compliance advice, or permission to use AI in a
            specific course.
          </li>
        </ul>
      </ReferenceBox>

      <ReferenceBox
        description="Machine-readable manifests for the alpha MCP design."
        title="MCP manifest"
      >
        <ApiEndpointRow
          description="Read-only tool manifest, prohibited actions, citation requirements, and example agent queries."
          label="MCP alpha manifest"
          path={`/api/public/${PUBLIC_API_VERSION}/mcp/manifest.json`}
          status="Design alpha"
          url={`/api/public/${PUBLIC_API_VERSION}/mcp/manifest.json`}
        />
        <ApiEndpointRow
          description="Full tool catalog with input schemas, required output fields, prohibited actions, and example queries."
          label="MCP tool catalog"
          path={`/api/public/${PUBLIC_API_VERSION}/mcp/tool-catalog.json`}
          status="Design alpha"
          url={`/api/public/${PUBLIC_API_VERSION}/mcp/tool-catalog.json`}
        />
      </ReferenceBox>

      <ReferenceBox
        description="A read-only retrieval protocol that maps MCP behavior to public API endpoints."
        title="Agent retrieval protocol"
      >
        <DataList>
          <DataListRow
            metadata={<MetaLabel label="Tool shape">search_entities</MetaLabel>}
          >
            <h2>Find the canonical entity</h2>
            <p>
              Resolve a user query through public search or the entity index.
              Return matched aliases, but label aliases as routing aids rather
              than policy facts.
            </p>
          </DataListRow>
          <DataListRow
            metadata={<MetaLabel label="Tool shape">get_university_record</MetaLabel>}
          >
            <h2>Fetch the canonical record</h2>
            <p>
              Return the university page URL, public JSON URL, last checked
              date, review state, confidence, limitations, and suggested
              citation before summarizing policy content.
            </p>
          </DataListRow>
          <DataListRow
            metadata={<MetaLabel label="Tool shape">get_claim_evidence</MetaLabel>}
          >
            <h2>Attach evidence to each claim</h2>
            <p>
              For claim-level answers, include source URLs, source language,
              source snapshot hashes, evidence snippets, confidence, and review
              state. Original-language evidence remains canonical.
            </p>
          </DataListRow>
          <DataListRow
            metadata={<MetaLabel label="Tool shape">get_analysis_profile</MetaLabel>}
          >
            <h2>Use analysis as derived metadata</h2>
            <p>
              Analysis profiles can help compare disclosure, privacy, approved
              tools, coursework, exams, and other dimensions, but they must stay
              linked to basis claim IDs and source URLs.
            </p>
          </DataListRow>
        </DataList>
      </ReferenceBox>

      <ReferenceBox
        description="Allowed tool shapes map directly to existing public JSON endpoints."
        title="Read-only tools"
      >
        <DataList>
          {mcpToolSpecs.map((tool) => (
            <DataListRow
              key={tool.name}
              metadata={
                <>
                  <MetaLabel label="Method">{tool.method}</MetaLabel>
                  <MetaLabel label="Path">{tool.path}</MetaLabel>
                </>
              }
            >
              <h2>{tool.name}</h2>
              <p>{tool.description}</p>
            </DataListRow>
          ))}
        </DataList>
      </ReferenceBox>

      <ReferenceBox
        description="The MCP layer must keep publication authority inside the reviewed dataset workflow."
        title="Prohibited actions"
      >
        <ul className="compact-list">
          <li>No writes to the production database.</li>
          <li>No publishing canonical claims or changing review state.</li>
          <li>No pushing to `main` or bypassing pull request review.</li>
          <li>No OpenClaw operation, crawling, login bypass, paywall bypass, or robots bypass.</li>
          <li>No legal advice or academic integrity advice.</li>
          <li>No write tools for institution corrections or course submissions in the alpha MCP surface.</li>
        </ul>
      </ReferenceBox>

      <ReferenceBox
        description="These examples define the intended retrieval behavior for future MCP implementation."
        title="Example agent queries"
      >
        <ul className="compact-list">
          {exampleAgentQueries.map((query) => (
            <li key={query}>{query}</li>
          ))}
        </ul>
      </ReferenceBox>

      <ReferenceBox
        description="Every MCP answer should be usable as a citation trail."
        title="Response requirements"
      >
        <ul className="compact-list">
          <li>Return canonical page URLs and public JSON URLs with answers.</li>
          <li>Return review state next to any summarized claim.</li>
          <li>Return confidence when the public endpoint provides confidence.</li>
          <li>Return source URLs and source snapshot hashes for claim evidence.</li>
          <li>Return source rights and no-advice caveats for reusable summaries.</li>
          <li>Preserve source-language evidence as canonical evidence.</li>
          <li>Label candidate or needs-review records clearly.</li>
        </ul>
      </ReferenceBox>
    </main>
  );
}
