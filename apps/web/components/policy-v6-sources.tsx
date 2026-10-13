import React from "react";
import type { PublicEntitySummary } from "@uapt/shared";
import type { SupportedLocale } from "@/lib/i18n";
import { policyV6Copy } from "@/lib/policy-v6-copy";
import { policyV6DensityCopy } from "@/lib/policy-v6-density-copy";
import { PolicyV6SourceGrid } from "./policy-v6";

export function PolicyV6Sources({
  sources,
  slug,
  locale,
}: {
  sources: PublicEntitySummary["officialSources"];
  slug: string;
  locale: SupportedLocale;
}) {
  const ui = policyV6Copy(locale),
    density = policyV6DensityCopy(locale);
  return (
    <PolicyV6SourceGrid
      allLabel={density.allSources}
      fewerLabel={density.fewerSources}
      count={sources.length}
    >
      {sources.map((source) => {
        const domain = new URL(source.sourceUrl).hostname;
        return (
          <article
            className="policy-v6-sourceCard"
            key={`${source.sourceUrl}:${source.snapshotHash}`}
          >
            <h3 data-i18n="preserve">{source.citationTitle}</h3>
            <p className="policy-v6-sourceDomain" data-i18n="preserve">
              {domain}
            </p>
            {source.publisher ? (
              <p className="policy-v6-muted" data-i18n="preserve">
                {source.publisher}
              </p>
            ) : null}
            {slug === "imperial-college-london" &&
            source.sourceUrl.includes(
              "dAIsy-use-guidance-and-process-flows",
            ) ? (
              <p className="policy-v6-muted">
                {locale === "zh"
                  ? "历史来源目前无法访问（HTTP 404）；不以此证明当前政策有效。"
                  : "Historical source unavailable (HTTP 404); not evidence of current policy validity."}
              </p>
            ) : null}
            <a
              href={source.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-analytics-entity-slug={slug}
              data-analytics-event="official_source_click"
              data-analytics-source-domain={domain}
            >
              {ui.source} ↗
            </a>
          </article>
        );
      })}
    </PolicyV6SourceGrid>
  );
}
