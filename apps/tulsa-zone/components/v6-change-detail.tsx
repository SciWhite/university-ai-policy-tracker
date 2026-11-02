import React from "react";
import { readPublishedV6Revision, publishedV6School } from "@/lib/policy-v6-published";
import {
  readV6RecordCorrectionRevision,
  readV6RecordCorrections,
  v6BaselineRevision,
  v6SummaryAtRevision
} from "@/lib/v6-effective-records";
import { V6ChangeNote } from "./v6-change-note";

export function V6ChangeDetail({
  revision,
  slug,
  locale = "en"
}: {
  revision: string;
  slug: string;
  locale?: string;
}) {
  const data = readPublishedV6Revision(revision)!;
  if (data.publicationKind === "v6_presentation_integration") {
    return <main><V6ChangeNote locale={locale} slug={slug} revision={revision} /></main>;
  }

  const correction = readV6RecordCorrectionRevision(revision)!;
  const isSelectedRevision =
    readV6RecordCorrections()?.recordRevisions[slug]?.universityRevisionId === revision;
  const school = publishedV6School(slug, "en", revision) ?? {
    fingerprint: correction.recordRevisions[slug].recordSha256
  };
  const view = data.locales.en.views[slug];
  const local = data.locales.en.localEvidence[slug];
  const claims = v6SummaryAtRevision(slug, revision)?.claims ??
    view?.claims ?? local?.record.claims ?? [];
  const zh = locale === "zh";

  return (
    <main>
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
        <p>{school.fingerprint}</p>
        <pre>{JSON.stringify(correction.changesBySlug[slug], null, 2)}</pre>
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
