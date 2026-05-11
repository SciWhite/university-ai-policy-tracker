import { PUBLIC_API_VERSION } from "@uapt/shared";
import { ApiEndpointRow } from "@/components/api-endpoint-row";
import { DataList, DataListRow } from "@/components/data-list";
import { JsonLd } from "@/components/json-ld";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import { StateLabel } from "@/components/state-label";
import {
  getWidgetPreviewRecords,
  widgetScriptPath
} from "@/lib/developer-surfaces";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

const title = "Embeddable Widgets | University AI Policy Tracker";
const description =
  "Embeddable read-only widgets for university AI policy status and recent public source-check changes.";

const statusSnippet =
  `<script async src="https://eduaipolicy.org${widgetScriptPath}" ` +
  `data-widget="university-status" data-slug="anu"></script>`;

const changesSnippet =
  `<script async src="https://eduaipolicy.org${widgetScriptPath}" ` +
  `data-widget="recent-changes" data-limit="5"></script>`;

export function generateMetadata() {
  const canonical = getAbsoluteSiteUrl("/widgets");

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

export default async function WidgetsPage() {
  const { recentChangesWidget, statusWidget } = await getWidgetPreviewRecords();
  const statusData = statusWidget?.data;
  const changes = recentChangesWidget.data.changes;

  return (
    <main className="page-shell page-shell--wide">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "University AI Policy Tracker embeddable widgets",
          applicationCategory: "ReferenceApplication",
          operatingSystem: "Web",
          isAccessibleForFree: true,
          url: getAbsoluteSiteUrl("/widgets"),
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }
        }}
      />

      <section className="hero">
        <p className="kicker">Widgets</p>
        <h1>Embeddable read-only policy status cards</h1>
        <p className="lead">
          Add a small University AI Policy Tracker card to a library guide,
          newsletter, research page, or school-facing resource. Widgets link back
          to canonical records, show review state and freshness, and avoid
          exposing unreviewed claim text.
        </p>
      </section>

      <section className="metrics-grid" aria-label="Widget principles">
        <div>
          <span>2</span>
          <p>initial widget types</p>
        </div>
        <div>
          <span>{PUBLIC_API_VERSION}</span>
          <p>versioned data endpoints</p>
        </div>
        <div>
          <span>0</span>
          <p>write permissions</p>
        </div>
        <div>
          <span>1h</span>
          <p>recommended client cache</p>
        </div>
      </section>

      <ReferenceBox
        description="Copy the script tag into a public web page. The script renders inside a Shadow DOM card and reads only public widget JSON."
        title="Embed snippets"
      >
        <DataList>
          <DataListRow
            metadata={<MetaLabel label="Widget">University status</MetaLabel>}
          >
            <h2>University status card</h2>
            <pre>{statusSnippet}</pre>
          </DataListRow>
          <DataListRow
            metadata={<MetaLabel label="Widget">Recent changes</MetaLabel>}
          >
            <h2>Recent changes card</h2>
            <pre>{changesSnippet}</pre>
          </DataListRow>
        </DataList>
      </ReferenceBox>

      <ReferenceBox
        description="Server-rendered previews of the same public fields used by the embeddable JavaScript."
        title="Widget previews"
      >
        <div className="metrics-grid" aria-label="Widget preview cards">
          {statusData ? (
            <div>
              <p className="kicker">University status</p>
              <h2>{statusData.entityName}</h2>
              <p>{statusData.summaryPreview}</p>
              <div className="tag-row">
                <StateLabel reviewState={statusData.reviewState} />
                <MetaLabel label="Claims">{statusData.claimCount}</MetaLabel>
                <MetaLabel label="Sources">
                  {statusData.officialSourceCount}
                </MetaLabel>
              </div>
            </div>
          ) : null}
          <div>
            <p className="kicker">Recent changes</p>
            <h2>{changes.length} public source-check records</h2>
            <ul className="compact-list">
              {changes.slice(0, 5).map((change) => (
                <li key={change.entitySlug}>
                  <a href={change.changeUrl}>{change.entityName}</a>{" "}
                  <StateLabel prefix="" reviewState={change.reviewState} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </ReferenceBox>

      <ReferenceBox
        description="Widget JSON endpoints have CORS enabled for public read-only embedding."
        title="Widget data endpoints"
      >
        <ApiEndpointRow
          description="Discovery document for widget types, constraints, and example HTML snippets."
          label="Widget index"
          path={`/api/public/${PUBLIC_API_VERSION}/widgets/index.json`}
          url={`/api/public/${PUBLIC_API_VERSION}/widgets/index.json`}
        />
        <ApiEndpointRow
          description="Compact university status payload with review state, freshness, source count, and canonical links."
          label="University status widget JSON"
          path={`/api/public/${PUBLIC_API_VERSION}/widgets/university-status/anu.json`}
          url={`/api/public/${PUBLIC_API_VERSION}/widgets/university-status/anu.json`}
        />
        <ApiEndpointRow
          description="Compact recent changes payload for public source checks and change records."
          label="Recent changes widget JSON"
          path={`/api/public/${PUBLIC_API_VERSION}/widgets/recent-changes.json`}
          url={`/api/public/${PUBLIC_API_VERSION}/widgets/recent-changes.json`}
        />
      </ReferenceBox>

      <ReferenceBox
        description="Widget output is a distribution layer, not a new source of truth."
        title="Publication rules"
      >
        <ul className="compact-list">
          <li>Widgets must link back to canonical tracker pages.</li>
          <li>Widgets display review state and last checked or changed dates.</li>
          <li>
            Widgets do not expose unreviewed claim text; candidate counts remain
            clearly labeled.
          </li>
          <li>
            Original-language evidence and source URLs remain canonical in the
            linked public record.
          </li>
          <li>
            Widgets do not provide legal advice or academic integrity advice.
          </li>
        </ul>
      </ReferenceBox>
    </main>
  );
}
