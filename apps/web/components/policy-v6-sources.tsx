import {sourceHashBinding} from "@/lib/source-hash-contract";
import {policySourceRole,policyV6EvidenceLabel} from "@/lib/policy-v6-evidence-labels";
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
        const binding = sourceHashBinding(source);
        return (
          <article
            className="policy-v6-sourceCard"
            key={`${source.sourceUrl}:${source.snapshotHash}`}
          >
            <h3 data-i18n="preserve">{source.citationTitle}</h3>
            <p className="policy-v6-sourceDomain" data-i18n="preserve">
              {domain}
            </p>
            <p className="policy-v6-muted">{policyV6EvidenceLabel(policySourceRole(source),locale)}</p>
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
                  ? "历史来源此前记录为 HTTP 404；后续访问也可能受限。不以此证明当前政策有效。"
                  : "Historical source previously recorded HTTP 404; subsequent access may also be restricted. Not evidence of current policy validity."}
              </p>
            ) : null}
            <details className="policy-v6-muted">
              <summary>{locale === "zh" ? "哈希与捕获版本" : "Hash and captured version"}</summary>
              <p>{binding.hashKind === 'extracted_text_utf8'
                ? locale === 'zh' ? 'SHA-256：所保留提取文本的 UTF-8 字节，不是 HTML/PDF 原始文件。' : 'SHA-256 of retained extracted UTF-8 text; not the original HTML/PDF file.'
                : binding.hashKind === 'raw_captured_bytes'
                  ? locale === 'zh' ? 'SHA-256：所保留捕获文件的字节。' : 'SHA-256 of the retained capture file bytes.'
                  : locale === 'zh' ? '历史记录未明确哈希对应的表示形式；不能据此认定是原始文件哈希。' : 'Representation unspecified in this historical record; do not assume an original-file hash.'}</p>
              <p data-i18n="preserve" style={{overflowWrap:'anywhere'}}>{source.snapshotHash}</p>
              <p>{locale === 'zh' ? '哈希确认版本身份，不代表政策仍然有效或审核已获批准。' : 'Hashes identify a captured version; they do not establish current policy or review approval.'}</p>
            </details>
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
