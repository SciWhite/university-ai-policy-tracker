import React from "react";
import type { PublicEntitySummary } from "@uapt/shared";
import type { SupportedLocale } from "@/lib/i18n";
import { translatePolicyReferenceUi } from "@/lib/policy-reference-ui";
import { formatSnapshotHash } from "@/lib/snapshot-hash";
import { getSourceDomain } from "@/lib/analytics-events";

export function OfficialSourceAttributionList({
  sources,
  slug,
  locale = "en",
  localizeUi = false,
}: {
  sources: PublicEntitySummary["officialSources"];
  slug: string;
  locale?: SupportedLocale;
  localizeUi?: boolean;
}) {
  const t = (value: string) =>
    localizeUi ? translatePolicyReferenceUi(value, locale) : value;
  return (
    <div className="student-source-attribution-list">
      {sources.map((source) => (
        <article
          className="student-source-attribution"
          key={`${source.sourceUrl}:${source.snapshotHash}`}
        >
          <div>
            <h3>{source.citationTitle}</h3>
            <p className="muted">
              {source.publisher ?? "Official university source"}
            </p>
          </div>
          <dl>
            <div>
              <dt>{t("Source URL")}</dt>
              <dd>
                <a
                  href={source.sourceUrl}
                  data-analytics-entity-slug={slug}
                  data-analytics-event="official_source_click"
                  data-analytics-source-domain={getSourceDomain(
                    source.sourceUrl,
                  )}
                >
                  {source.sourceUrl}
                </a>
              </dd>
            </div>
            <div>
              <dt>{t("Snapshot hash")}</dt>
              <dd className="hash-value" title={source.snapshotHash}>
                {formatSnapshotHash(source.snapshotHash)}
              </dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}
