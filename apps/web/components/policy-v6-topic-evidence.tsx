import { policyV6ReaderCopy } from "@/lib/policy-v6-reader-copy";
import React from "react";
import type { LabTopic } from "@/lib/policy-v6";
import type { SupportedLocale } from "@/lib/i18n";
import { policyV6RecordCopy } from "@/lib/policy-v6-record-copy";
import { policyV6Copy } from "@/lib/policy-v6-copy";
import { policyV6EvidenceLabel } from "@/lib/policy-v6-evidence-labels";

type Claim = LabTopic["claims"][number];
type Binding = { claim: Claim; evidence: Claim["evidence"][number]; index: number };

/** A derivative excerpt digest cannot identify the original source version.
 * Keep that digest and its locator in the record, but do not use it to coalesce quotes. */
export function policyV6ReadingSourceVersion(evidence: Claim["evidence"][number]) {
  const derivative = /SHA256 refers to excerpt file|selected derivative excerpt SHA256|SHA[-\s]?256 identifies (?:this )?retained (?:UTF-8 )?excerpt|not original (?:source |HTML\/PDF )?bytes|original HTML\/PDF bytes not verified|not raw (?:official bytes|HTML\/PDF(?:\/DOCX)?)|SHA is not raw source hash|derivative capture, not verified raw HTML\/PDF/i.test(evidence.location ?? "");
  return derivative ? undefined : evidence.hash || undefined;
}

/** Coalesce only identical, version-bound text within this topic; retain every binding. */
export function groupPolicyV6ReadingEvidence(topic: LabTopic) {
  const groups = new Map<string, { url: string; title: string; version?: string; quotations: Map<string, Binding[]> }>();
  for (const claim of topic.claims) {
    claim.evidence.forEach((evidence, index) => {
      const version = policyV6ReadingSourceVersion(evidence);
      const key = JSON.stringify([evidence.url, version ?? null]);
      const group = groups.get(key) ?? { url: evidence.url, title: evidence.title, version, quotations: new Map<string, Binding[]>() };
      // Unknown versions remain separate even when their text is identical.
      const quoteKey = JSON.stringify([evidence.language, evidence.quote, version ? null : [claim.id, index]]);
      const bindings = group.quotations.get(quoteKey) ?? [];
      bindings.push({ claim, evidence, index });
      group.quotations.set(quoteKey, bindings);
      groups.set(key, group);
    });
  }
  return [...groups.values()];
}

/** Display grouping changes no source data, claim identity, wording, date or locator. */
export function PolicyV6TopicEvidence({ topic, locale }: { topic: LabTopic; locale: SupportedLocale }) {
  const copy = policyV6RecordCopy(locale);
  const reader = policyV6ReaderCopy(locale);
  const groups = groupPolicyV6ReadingEvidence(topic);
  if (!topic.claims.length) return <p data-evidence-gap="true">{topic.evidenceGap ?? policyV6Copy(locale).gap}</p>;
  return <div className="policy-v6-readerSources student-snapshot-card__evidence">
    <details className="policy-v6-readerDirectory">
      <summary>{reader.sources(groups.length)}</summary>
      <nav aria-label={reader.sourceNavigation}>
        {groups.map((group, index) => <a key={index} href={`#reader-${topic.key}-source-${index}`}>{group.title}</a>)}
      </nav>
    </details>
    {groups.map((group, groupIndex) => <section className="policy-v6-readerSource" key={groupIndex} id={`reader-${topic.key}-source-${groupIndex}`}>
      <h4>{group.title}</h4>
      <details className="policy-v6-readerVersion">
        <summary>{reader.version}</summary>
        <p className="hash-value" data-source-version={group.version ?? "unknown"}>{group.version ?? reader.unknownVersion}</p>
      </details>
      {[...group.quotations.entries()].map(([key, bindings]) => {
        const evidence = bindings[0].evidence;
        const shared = bindings.length > 1;
        const BindingsContainer = shared ? "details" : "div";
        return <article className="student-evidence" key={key} data-evidence-binding-count={bindings.length}>
          <blockquote className="student-evidence__quote">
            <p data-i18n="preserve" lang={evidence.language}>{evidence.quote}</p>
          </blockquote>
          <div className="policy-v6-readerDates" data-quote-dates>
            <span>{copy.retrieved}: {[...new Set(bindings.map(b => b.evidence.retrievedAt?.slice(0, 10) ?? policyV6EvidenceLabel("date_unrecorded", locale)))].join(", ")}</span>
            {bindings.some(b => b.claim.basisObjectType !== "source") ? <span>{copy.claimChecked}: {[...new Set(bindings.filter(b => b.claim.basisObjectType !== "source").map(b => b.claim.checkedAt?.slice(0, 10) ?? policyV6EvidenceLabel("date_unrecorded", locale)))].join(", ")}</span> : null}
          </div>
          <BindingsContainer className={shared ? "policy-v6-readerBindings" : undefined}>
            {shared ? <summary className="policy-v6-readerBindingsLabel">{reader.bindings(bindings.length)}</summary> : null}
            {bindings.map(({ claim, evidence: boundEvidence, index }) => <div className="policy-v6-readerBinding" key={`${claim.id}:${index}`} data-reader-claim-id={claim.id}>
              {shared ? <p className="policy-v6-readerBindingTitle" data-i18n="preserve" lang="en">{claim.text}</p> : null}
              {shared ? <div className="policy-v6-readerDates">
                <span>{copy.retrieved}: {boundEvidence.retrievedAt?.slice(0, 10) ?? policyV6EvidenceLabel("date_unrecorded", locale)}</span>
                {claim.basisObjectType !== "source" ? <span>{copy.claimChecked}: {claim.checkedAt?.slice(0, 10) ?? policyV6EvidenceLabel("date_unrecorded", locale)}</span> : null}
              </div> : null}
              <details className="policy-v6-readerRecord">
                <summary>{reader.claimLocation}</summary>
                {!shared ? <p data-i18n="preserve" lang="en">{claim.text}</p> : null}
                <p className="hash-value">{claim.id}</p>
                {boundEvidence.title !== group.title ? <p data-i18n="preserve">{boundEvidence.title}</p> : null}
                {boundEvidence.location ? <p data-i18n="preserve">{boundEvidence.location}</p> : null}
                {boundEvidence.hash ? <p className="hash-value">{boundEvidence.hash}</p> : null}
              </details>
            </div>)}
          </BindingsContainer>
        </article>;
      })}
      <a className="policy-v6-readerSourceLink" href={group.url} target="_blank" rel="noopener noreferrer">{policyV6Copy(locale).source} ↗</a>
    </section>)}
    {topic.claims.filter(claim => !claim.evidence.length).map(claim => <article className="student-evidence" key={claim.id}>
      <p data-i18n="preserve" lang="en">{claim.text}</p>
      <p data-evidence-gap="true">{topic.evidenceGap ?? policyV6Copy(locale).gap}</p>
      <small>{claim.id} · {copy.claimChecked}: {claim.checkedAt?.slice(0, 10) ?? policyV6EvidenceLabel("date_unrecorded", locale)}</small>
    </article>)}
  </div>;
}
