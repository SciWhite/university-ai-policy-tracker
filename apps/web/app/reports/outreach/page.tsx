import Link from "next/link";
import { CitationCopyActions } from "@/components/citation-copy-actions";
import { DataList, DataListRow } from "@/components/data-list";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import {
  formatReportDate,
  getMonthlyReport,
  getOutreachPackage
} from "@/lib/reports";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

export async function generateMetadata() {
  const outreach = await getOutreachPackage();

  return {
    title: outreach.title,
    description: outreach.description,
    alternates: { canonical: outreach.canonicalUrl },
    openGraph: {
      title: outreach.title,
      description: outreach.description,
      url: outreach.canonicalUrl,
      type: "website"
    }
  };
}

export default async function OutreachPage() {
  const [outreach, report] = await Promise.all([
    getOutreachPackage(),
    getMonthlyReport()
  ]);
  const citationText = report
    ? `University AI Policy Tracker. "${report.title}." Published ${formatReportDate(
        report.publishedAt
      )}. ${report.canonicalUrl}`
    : `University AI Policy Tracker. "Reports." ${getAbsoluteSiteUrl("/reports")}`;
  const publicJsonUrl = getAbsoluteSiteUrl("/api/public/v1/datasets/latest.json");

  return (
    <main className="page-shell page-shell--wide">
      <section className="hero">
        <p className="kicker">Outreach package</p>
        <h1>Share the dataset without overstating the evidence</h1>
        <p className="lead">{outreach.description}</p>
        <div className="tag-row" aria-label="Outreach links">
          <MetaLabel label="Report">
            <Link href="/reports/2026-05">May 2026 baseline</Link>
          </MetaLabel>
          <MetaLabel label="Dataset">
            <a href="/api/public/v1/datasets/latest.json">latest manifest</a>
          </MetaLabel>
          <MetaLabel label="Feeds">
            <a href="/feeds/reports.xml">RSS</a>
          </MetaLabel>
          <MetaLabel label="JSON">
            <a href="/api/public/v1/reports/outreach.json">outreach package</a>
          </MetaLabel>
        </div>
      </section>

      <ReferenceBox
        actions={
          <CitationCopyActions
            canonicalUrl={outreach.canonicalUrl}
            citationText={citationText}
            publicJsonUrl={publicJsonUrl}
          />
        }
        description="Use these links when citing or sharing the project."
        title="Core links"
      >
        <DataList>
          <DataListRow
            actions={<Link href="/reports/2026-05">Open</Link>}
            metadata={<MetaLabel label="Type">Report</MetaLabel>}
          >
            <h2>May 2026 baseline report</h2>
            <p>
              Public report with coverage counts, review-state counts, example
              institution records, data links, methodology, and limitations.
            </p>
          </DataListRow>
          <DataListRow
            actions={<a href="/api/public/v1/reports/outreach.json">Open</a>}
            metadata={<MetaLabel label="Type">JSON</MetaLabel>}
          >
            <h2>Outreach package JSON</h2>
            <p>
              Machine-readable copy blocks and use boundaries for agents,
              newsletters, media kits, and repeatable citation workflows.
            </p>
          </DataListRow>
          <DataListRow
            actions={<a href="/api/public/v1/datasets/latest.json">Open</a>}
            metadata={<MetaLabel label="Type">JSON</MetaLabel>}
          >
            <h2>Dataset release manifest</h2>
            <p>
              Release ID, counts, artifacts, checksums, citation, license, and
              source-rights caveats.
            </p>
          </DataListRow>
          <DataListRow
            actions={<Link href="/methodology">Open</Link>}
            metadata={<MetaLabel label="Type">Trust page</MetaLabel>}
          >
            <h2>Methodology</h2>
            <p>
              Source discovery, snapshots, claim extraction, evidence binding,
              review states, change detection, and risk boundaries.
            </p>
          </DataListRow>
        </DataList>
      </ReferenceBox>

      <ReferenceBox
        description="Copy blocks for newsletters, researchers, social posts, library guides, and teaching-center references."
        title="Reusable copy"
      >
        <DataList>
          {outreach.assets.map((asset) => (
            <DataListRow
              key={asset.label}
              metadata={<MetaLabel label="Asset">{asset.label}</MetaLabel>}
            >
              <h2>{asset.label}</h2>
              <pre>{asset.body}</pre>
            </DataListRow>
          ))}
        </DataList>
      </ReferenceBox>

      <ReferenceBox
        description="These boundaries are part of the outreach package so citation does not turn metadata into advice."
        title="Use boundaries"
      >
        <ul className="compact-list">
          <li>
            Say "evidence-backed policy metadata" rather than "official
            university advice."
          </li>
          <li>
            Do not describe candidate or needs-review claims as final policy
            conclusions.
          </li>
          <li>
            Preserve the distinction between machine confidence and review
            state.
          </li>
          <li>
            Link back to original university sources when discussing a specific
            institution.
          </li>
          <li>
            Do not frame the tracker as legal advice, compliance advice, or
            academic integrity advice.
          </li>
        </ul>
      </ReferenceBox>
    </main>
  );
}
