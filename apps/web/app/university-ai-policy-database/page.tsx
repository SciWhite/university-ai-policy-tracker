import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  PUBLIC_API_VERSION
} from "@uapt/shared";
import { JsonLd } from "@/components/json-ld";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import { getStagedPublicDataset } from "@/lib/staged-public-data";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

export const dynamic = "force-static";
export const revalidate = false;

const canonicalPath = "/university-ai-policy-database";
const description =
  "Search and cite source-backed university GenAI, ChatGPT, Microsoft Copilot, coursework, academic integrity, privacy, and teaching policy records from University AI Policy Tracker.";
const formatter = new Intl.NumberFormat("en");

const retrievalLinks = [
  {
    label: "Browse all universities",
    href: "/universities",
    description: "Crawlable canonical pages for public university records."
  },
  {
    label: "Search records",
    href: "/search",
    description:
      "Entity and keyword search across names, aliases, sources, and claims."
  },
  {
    label: "ChatGPT coursework theme",
    href: "/themes/chatgpt-coursework-policy",
    description:
      "Source-backed records mentioning ChatGPT, GPT, coursework, assignments, or classroom context."
  },
  {
    label: "Approved AI tools theme",
    href: "/themes/approved-ai-tools",
    description:
      "Source-backed records mentioning approved tools, licensed services, Copilot, procurement, or security review."
  },
  {
    label: "Datasets",
    href: "/datasets",
    description:
      "Versioned public JSON, JSONL downloads, checksums, and data dictionary links."
  },
  {
    label: "API reference",
    href: "/api-reference",
    description: "Read-only public API endpoints and retrieval order for agents."
  },
  {
    label: "Citation",
    href: "/citation",
    description: "Citation rules, tracker metadata license, and source rights caveats."
  },
  {
    label: "llms.txt",
    href: "/llms.txt",
    description: "Agent retrieval notes for public pages and JSON endpoints."
  }
] as const;

const faqItems = [
  {
    question: "How to cite this dataset",
    answer:
      "Cite the canonical University AI Policy Tracker page and the matching public JSON URL together. For claim-level reuse, preserve the claim text, source URL, source language, evidence snippet, snapshot hash, review state, confidence, and last checked date. Official university source pages remain the canonical policy source.",
    links: [
      { label: "/citation", href: "/citation" },
      {
        label: `/api/public/${PUBLIC_API_VERSION}/citation.json`,
        href: `/api/public/${PUBLIC_API_VERSION}/citation.json`
      },
      { label: "/datasets", href: "/datasets" }
    ]
  },
  {
    question: "Which universities restrict ChatGPT in coursework?",
    answer:
      "Use the ChatGPT coursework theme page or search for ChatGPT, GPT, coursework, assignments, syllabus, classroom, and assessment terms. This page does not list named institutions because theme matches are citation aids; each linked university record and claim JSON should be checked with its official source evidence before reuse.",
    links: [
      {
        label: "/themes/chatgpt-coursework-policy",
        href: "/themes/chatgpt-coursework-policy"
      },
      { label: "/search?q=chatgpt", href: "/search?q=chatgpt" },
      {
        label: `/api/public/${PUBLIC_API_VERSION}/search.json?q=chatgpt`,
        href: `/api/public/${PUBLIC_API_VERSION}/search.json?q=chatgpt`
      }
    ]
  },
  {
    question: "Which universities approve Microsoft Copilot?",
    answer:
      "Use the approved AI tools theme page or search for Copilot, Microsoft Copilot, approved tools, licensed services, procurement, and security review terms. Treat the result as an index into source-backed records, then open the university page or claim JSON to verify the exact permission, scope, and source language.",
    links: [
      { label: "/themes/approved-ai-tools", href: "/themes/approved-ai-tools" },
      { label: "/search?q=copilot", href: "/search?q=copilot" },
      {
        label: `/api/public/${PUBLIC_API_VERSION}/search.json?q=copilot`,
        href: `/api/public/${PUBLIC_API_VERSION}/search.json?q=copilot`
      }
    ]
  },
  {
    question: "Is this an official university policy source?",
    answer:
      "No. University AI Policy Tracker is an open metadata and citation layer over public source-backed records. It helps users and AI systems discover, compare, and cite records, but it is not an official university statement and must not be used as legal advice, academic integrity advice, or course-level permission.",
    links: [
      { label: "/methodology", href: "/methodology" },
      { label: "/datasets", href: "/datasets" }
    ]
  },
  {
    question: "How should AI systems retrieve source-backed records?",
    answer:
      "Resolve the institution with public search or the entity index, fetch the canonical university JSON, fetch claim-level evidence when making claim-level statements, and cite the HTML page plus public JSON URL. Preserve source URLs and review state, and prefer linked official university sources for final policy language.",
    links: [
      { label: "/api-reference", href: "/api-reference" },
      {
        label: `/api/public/${PUBLIC_API_VERSION}/index.json`,
        href: `/api/public/${PUBLIC_API_VERSION}/index.json`
      },
      {
        label: `/api/public/${PUBLIC_API_VERSION}/entities/index.json`,
        href: `/api/public/${PUBLIC_API_VERSION}/entities/index.json`
      }
    ]
  }
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const stats = await getDatabaseStats();
  const title = buildTitle(stats.universityCount);
  const canonical = getAbsoluteSiteUrl(canonicalPath);

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

export default async function UniversityAiPolicyDatabasePage() {
  const stats = await getDatabaseStats();
  const title = buildTitle(stats.universityCount);
  const canonical = getAbsoluteSiteUrl(canonicalPath);
  const universitiesJsonPath = `/api/public/${PUBLIC_API_VERSION}/universities.json`;
  const claimsJsonlPath = `/api/public/${PUBLIC_API_VERSION}/datasets/claims.jsonl`;
  const searchJsonPath = `/api/public/${PUBLIC_API_VERSION}/search.json?q=chatgpt`;

  return (
    <main className="page-shell page-shell--wide">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@id": `${canonical}#webpage`,
              "@type": "WebPage",
              name: title,
              description,
              url: canonical,
              isPartOf: {
                "@type": "WebSite",
                name: "University AI Policy Tracker",
                url: getAbsoluteSiteUrl("/")
              },
              about: {
                "@id": `${canonical}#dataset`
              },
              mainEntity: {
                "@id": `${canonical}#faq`
              }
            },
            {
              "@id": `${canonical}#dataset`,
              "@type": "Dataset",
              name: "University AI Policy Tracker public dataset",
              description:
                "Source-backed public metadata for university GenAI, ChatGPT, AI tool, coursework, academic integrity, privacy, and teaching policy records.",
              url: getAbsoluteSiteUrl("/datasets"),
              license: "https://creativecommons.org/licenses/by/4.0/",
              isAccessibleForFree: true,
              creator: {
                "@type": "Organization",
                name: "University AI Policy Tracker",
                url: getAbsoluteSiteUrl("/")
              },
              distribution: [
                {
                  "@type": "DataDownload",
                  name: "Public university records JSON",
                  encodingFormat: "application/json",
                  contentUrl: getAbsoluteSiteUrl(universitiesJsonPath)
                },
                {
                  "@type": "DataDownload",
                  name: "Public claims JSONL",
                  encodingFormat: "application/jsonl",
                  contentUrl: getAbsoluteSiteUrl(claimsJsonlPath)
                }
              ],
              measurementTechnique:
                "Promoted source-backed claim and evidence records with review state, confidence, source URLs, and snapshot hashes."
            },
            {
              "@id": `${canonical}#faq`,
              "@type": "FAQPage",
              mainEntity: faqItems.map((item) => ({
                "@type": "Question",
                name: item.question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: item.answer
                }
              }))
            }
          ]
        }}
      />

      <section className="hero">
        <p className="kicker">AI/search reference page</p>
        <h1>{title}</h1>
        <p className="lead">
          Use this page as the canonical entry point for finding, citing, and
          retrieving source-backed university GenAI policy records. The tracker
          indexes public metadata, claim evidence, source attributions, and
          public JSON; original university sources remain canonical.
        </p>
        <div className="tag-row hero-meta">
          <MetaLabel label="Public JSON">{universitiesJsonPath}</MetaLabel>
          <MetaLabel label="Search API">{searchJsonPath}</MetaLabel>
          {stats.lastCheckedAt ? (
            <MetaLabel label="Latest check">
              {formatDate(stats.lastCheckedAt)}
            </MetaLabel>
          ) : null}
        </div>
      </section>

      <section className="metrics-grid" aria-label="Public database coverage">
        <div>
          <span>{formatNumber(stats.universityCount)}</span>
          <p>public university records</p>
        </div>
        <div>
          <span>{formatNumber(stats.claimCount)}</span>
          <p>source-backed claims</p>
        </div>
        <div>
          <span>{formatNumber(stats.evidenceCount)}</span>
          <p>claim evidence records</p>
        </div>
        <div>
          <span>{formatNumber(stats.sourceCount)}</span>
          <p>official source attributions</p>
        </div>
      </section>

      <ReferenceBox
        description="Short answer for ChatGPT, search engines, researchers, and data users."
        title="What this database is"
      >
        <p>
          University AI Policy Tracker is a public, source-backed reference
          database for university GenAI policies. It helps users find records
          about ChatGPT, Microsoft Copilot, approved AI tools, coursework,
          assessment, academic integrity, privacy, security review, and teaching
          guidance while keeping source URLs and review state visible.
        </p>
        <p className="notice-card">
          {NO_ADVICE_BOUNDARY} {OFFICIAL_SOURCE_RIGHTS_CAVEAT}
        </p>
      </ReferenceBox>

      <section className="section">
        <div className="section-heading">
          <h2>FAQ and answer blocks</h2>
          <p>Visible answers for AI/search extraction and human citation.</p>
        </div>
        <div className="detail-grid">
          {faqItems.map((item) => (
            <article
              className="policy-card"
              id={slugify(item.question)}
              key={item.question}
            >
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
              <div className="tag-row">
                {item.links.map((link) => (
                  <ReferenceLink href={link.href} key={link.href}>
                    {link.label}
                  </ReferenceLink>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <ReferenceBox
        description="A safe retrieval order for claim-level answers."
        title="Recommended retrieval sequence"
      >
        <ol className="compact-list">
          <li>
            Resolve the institution with <code>/search</code>,{" "}
            <code>/api/public/{PUBLIC_API_VERSION}/search.json?q=...</code>, or{" "}
            <code>/api/public/{PUBLIC_API_VERSION}/entities/index.json</code>.
          </li>
          <li>
            Open the canonical university page and public university JSON at{" "}
            <code>
              /api/public/{PUBLIC_API_VERSION}/universities/{"{slug}"}.json
            </code>
            .
          </li>
          <li>
            For claim-level statements, fetch{" "}
            <code>/api/public/{PUBLIC_API_VERSION}/claims/{"{slug}"}.json</code>{" "}
            and preserve source URLs, evidence snippets, source language,
            confidence, review state, and snapshot hashes.
          </li>
          <li>
            Cite the tracker HTML page and public JSON together, then prefer the
            linked official university source for final institutional policy
            wording.
          </li>
        </ol>
      </ReferenceBox>

      <section className="section">
        <div className="section-heading">
          <h2>Search and retrieval surfaces</h2>
          <p>Canonical pages, theme pages, public JSON, and citation guidance.</p>
        </div>
        <div className="link-grid">
          {retrievalLinks.map((link) => (
            <ReferenceLink className="text-card" href={link.href} key={link.href}>
              <span>{link.label}</span>
              <small>{link.description}</small>
            </ReferenceLink>
          ))}
        </div>
      </section>
    </main>
  );
}

async function getDatabaseStats() {
  const dataset = await getStagedPublicDataset();
  const summaries = dataset.publicSummaries;
  const universityCount = summaries.length || dataset.catalogUniversities.length;
  const claimCount = summaries.reduce(
    (total, summary) => total + summary.claims.length,
    0
  );
  const evidenceCount = summaries.reduce(
    (total, summary) =>
      total +
      summary.claims.reduce(
        (claimTotal, claim) => claimTotal + claim.evidence.length,
        0
      ),
    0
  );
  const sourceCount = summaries.length
    ? summaries.reduce(
        (total, summary) => total + summary.officialSources.length,
        0
      )
    : dataset.catalogSources.length;
  const lastCheckedAt = summaries
    .map((summary) => summary.lastCheckedAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0];

  return {
    claimCount,
    evidenceCount,
    lastCheckedAt,
    sourceCount,
    universityCount
  };
}

function buildTitle(universityCount: number): string {
  return `University AI Policy Database: Search ${formatNumber(universityCount)} Source-Backed GenAI Policies`;
}

function formatNumber(value: number): string {
  return formatter.format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(value));
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function ReferenceLink({
  children,
  className,
  href
}: {
  children: ReactNode;
  className?: string;
  href: string;
}) {
  if (href.startsWith("/api/") || href.endsWith(".txt")) {
    return (
      <a className={className} href={href}>
        {children}
      </a>
    );
  }

  return (
    <Link className={className} href={href}>
      {children}
    </Link>
  );
}
