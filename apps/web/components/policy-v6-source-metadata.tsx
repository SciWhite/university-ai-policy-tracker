import React from "react";
import type { V6SourceDocument } from "@uapt/shared";
import type { SupportedLocale } from "@/lib/i18n";
import { formatSourceDate, policyV6SourceMetadataCopy } from "@/lib/policy-v6-source-metadata-copy";

/** Agent-reviewed document metadata on one official source card. Every value links back to a verbatim quote. */
export function PolicyV6SourceMetadata({ document, locale }: { document: V6SourceDocument; locale: SupportedLocale }) {
  const t = policyV6SourceMetadataCopy(locale);
  const shown = document.displayDate;
  const later = document.latestUpdate;
  const time = (d: { value: string; precision: "day" | "month" | "year" }) => <time dateTime={d.value}>{formatSourceDate(d.value, d.precision, locale)}</time>;
  return (
    <div className="policy-v6-sourceMeta" data-source-meta-doc-type={document.docType} data-source-meta-date-kind={shown.kind} data-i18n="preserve">
      <p className="policy-v6-sourceMeta__line">
        <span>{t.docType[document.docType]}{document.stage === "draft" ? ` · ${t.draft}` : ""}</span>
        {" · "}
        <span data-date-kind={shown.kind}>{t.date[shown.kind]} {time(shown)}</span>
        {later ? <>{" · "}<span data-date-kind={later.kind}>{t.updated} {time(later)}</span></> : null}
      </p>
      {document.issuer ? <p className="policy-v6-sourceMeta__line"><span>{t.issuer}</span> <span lang="und" dir="auto">{document.issuer.name}</span></p> : null}
      {document.approvedBy ? <p className="policy-v6-sourceMeta__line"><span>{t.approvedBy}</span> <span lang="und" dir="auto">{document.approvedBy.name}</span></p> : null}
      <details className="policy-v6-sourceMeta__details">
        <summary>{t.details}</summary>
        <dl>
          {document.dates.map((date, index) => (
            <div key={`${date.kind}:${date.value}:${index}`}>
              <dt>{t.date[date.kind]} {time(date)}</dt>
              <dd><blockquote dir="auto" lang="und">{date.quote}</blockquote></dd>
            </div>
          ))}
          {document.issuer ? <div><dt>{t.issuer} · <span dir="auto">{document.issuer.name}</span></dt><dd><blockquote dir="auto" lang="und">{document.issuer.quote}</blockquote></dd></div> : null}
          {document.approvedBy ? <div><dt>{t.approvedBy} · <span dir="auto">{document.approvedBy.name}</span></dt><dd><blockquote dir="auto" lang="und">{document.approvedBy.quote}</blockquote></dd></div> : null}
          {document.version ? <div><dt>{t.version} · <span dir="auto">{document.version.value}</span></dt><dd><blockquote dir="auto" lang="und">{document.version.quote}</blockquote></dd></div> : null}
          {document.scope ? <div><dt>{t.scope}</dt><dd><p lang="en">{document.scope.en}</p><blockquote dir="auto" lang="und">{document.scope.quote}</blockquote></dd></div> : null}
        </dl>
        <p>{t.note}</p>
        <p className="hash-value" style={{ overflowWrap: "anywhere" }}>{t.captured} · {document.capture.sha256}</p>
      </details>
    </div>
  );
}
