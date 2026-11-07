import React from "react";
import { readPublishedV6Revision, publishedV6School } from "@/lib/policy-v6-published";
import {
  readV6RecordCorrectionRevision,
  readV6RecordCorrections,
  v6BaselineRevision,
  v6SummaryAtRevision
} from "@/lib/v6-effective-records";
import { V6ChangeNote } from "./v6-change-note";
import { JsonLd } from "./json-ld";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import { withLocalePrefix, type SupportedLocale } from "@/lib/i18n";
import { getLocalizedInstitutionName } from "@/lib/institution-localization";
import { formatSchoolChangeDescription } from "@/lib/change-history-view";

export function V6ChangeDetail({
  revision,
  slug,
  locale = "en"
}: {
  revision: string;
  slug: string;
  locale?: string;
}) {
  const data = readPublishedV6Revision(revision);
  if (!data) return null;

  const supportedLocale = (locale as SupportedLocale) || "en";
  const zh = locale === "zh";
  const correction = readV6RecordCorrectionRevision(revision);
  const isSelectedRevision =
    readV6RecordCorrections()?.recordRevisions[slug]?.universityRevisionId === revision;
  const school = publishedV6School(slug, "en", revision) ?? {
    name: slug,
    fingerprint: correction?.recordRevisions?.[slug]?.recordSha256 ?? ""
  };
  const displayName = getLocalizedInstitutionName(slug, school.name ?? slug, supportedLocale);
  const canonicalUrl = getAbsoluteSiteUrl(withLocalePrefix(`/changes/${revision}/${slug}`, supportedLocale));
  const description = formatSchoolChangeDescription(displayName, revision, supportedLocale);

  const jsonLd = (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: `${displayName} — ${revision}`,
        description,
        url: canonicalUrl,
        inLanguage: locale,
        isPartOf: {
          "@type": "WebSite",
          name: "University AI Policy Tracker",
          url: getAbsoluteSiteUrl("/")
        },
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: getAbsoluteSiteUrl(withLocalePrefix("/", supportedLocale))
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Changes",
              item: getAbsoluteSiteUrl(withLocalePrefix("/changes", supportedLocale))
            },
            {
              "@type": "ListItem",
              position: 3,
              name: revision,
              item: getAbsoluteSiteUrl(withLocalePrefix(`/changes/${revision}`, supportedLocale))
            },
            {
              "@type": "ListItem",
              position: 4,
              name: displayName,
              item: canonicalUrl
            }
          ]
        }
      }}
    />
  );

  const header = (
    <header className="entity-header">
      <div className="entity-header__main">
        <p className="entity-header__eyebrow">{zh ? "政策版本变动" : "Release diff"}</p>
        <h1 data-i18n="preserve">{displayName}</h1>
        <p className="entity-header__summary">
          {zh
            ? `版本 ${revision} 的追踪器变更记录。`
            : `Unified tracker diff for ${revision}. Full source-page text is not published; short original-language evidence snippets are shown for citation context.`}
        </p>
      </div>
    </header>
  );

  if (data.publicationKind === "v6_presentation_integration") {
    return (
      <main className="page-shell page-shell--wide">
        {jsonLd}
        {header}
        <V6ChangeNote locale={locale} slug={slug} revision={revision} />
      </main>
    );
  }

  const view = data.locales.en.views[slug];
  const local = data.locales.en.localEvidence[slug];
  const claims = v6SummaryAtRevision(slug, revision)?.claims ??
    view?.claims ?? local?.record.claims ?? [];
  const changes = correction?.changesBySlug?.[slug];

  return (
    <main className="page-shell page-shell--wide">
      {jsonLd}
      {header}
      <V6ChangeNote locale={locale} slug={slug} revision={revision} />
      <section className="page-shell">
        <h2>{zh ? "记录修订、适用范围与原文" : "Record revision, scope and original evidence"}</h2>
        <p>{zh
          ? "原文与人员、课程、学部范围保留。网站修订时间不是大学政策生效时间。"
          : "Original evidence and audience, course and unit scopes are preserved. Tracker correction time is not a policy effective date."}
        </p>
        {!isSelectedRevision ? <p>{zh
          ? "以下记录仅反映此历史版本，不代表当前政策记录或当前审核结论。"
          : "The records below reflect this historical version, not the current policy record or current review conclusions."}
        </p> : null}
        {school.fingerprint ? <p>{school.fingerprint}</p> : null}
        {changes ? <pre>{JSON.stringify(changes, null, 2)}</pre> : null}
        <a href={`/api/public/v1/universities/${slug}/revisions/${v6BaselineRevision(slug, correction)}.json`}>
          {zh ? "旧基线与旧审核记录" : "Previous baseline and review records"}
        </a>
        <ul>
          {claims.map((claim) => (
            <li key={claim.id}>
              <a href={(locale === "en" ? "" : `/${locale}`) + `/universities/${slug}#claim-${claim.id}`}>
                {claim.id}
              </a>{" "}— {claim.claimText}
            </li>
          ))}
        </ul>
        {view?.gaps.map((gap) => <p key={gap}>{gap}</p>)}
      </section>
    </main>
  );
}
