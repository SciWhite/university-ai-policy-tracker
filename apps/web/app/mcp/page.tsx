import { PUBLIC_API_VERSION } from "@uapt/shared";
import { ApiEndpointRow } from "@/components/api-endpoint-row";
import { DataList, DataListRow } from "@/components/data-list";
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
