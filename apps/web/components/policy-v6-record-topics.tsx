import React from "react";
import type { PolicyV6Data, LabTopic } from "@/lib/policy-v6";
import { policyV6RecordCopy } from "@/lib/policy-v6-record-copy";
import { policyV6Copy } from "@/lib/policy-v6-copy";
import { PolicyV6Artwork } from "./policy-v6-artwork";
import { policyV6StatusTone } from "@/lib/policy-v6-status";
import { PolicyV6TopicControls } from "./policy-v6";

/** SSR evidence stays available to anchors, printing and readers without JavaScript. */
export function PolicyV6RecordTopics({
  data,
  additionalOnly = false,
}: {
  data: PolicyV6Data;
  additionalOnly?: boolean;
}) {
  const school = data.schools.find((s) => s.slug === data.currentSlug);
  if (!school) return null;
  const basisFingerprint = school.fingerprint;
  const copy = policyV6RecordCopy(data.locale);
  const ui = policyV6Copy(data.locale);
  function card(topic: LabTopic) {
    return (
      <article
        className="student-snapshot-card"
        id={`snapshot-${topic.key}`}
        data-snapshot-dimension={topic.key}
        data-topic-basis={topic.basisKind}
        data-snapshot-status={topic.status}
        key={topic.key}
      >
        <div className="student-snapshot-card__summary">
          <div className="student-snapshot-card__content">
            <h3>{topic.title}</h3>
            <p
              className="student-snapshot-card__status"
              data-policy-tone={policyV6StatusTone(topic.status)}
            >
              {topic.statusLabel}
            </p>
            <p
              className="student-snapshot-card__sentence"
              data-i18n="preserve"
              lang="en"
            >
              {topic.summary}
            </p>
          </div>
        </div>
        <PolicyV6Artwork
          locale={data.locale}
          basisFingerprint={basisFingerprint}
          section={topic.key}
          schoolSlug={data.currentSlug}
          className="policy-v6-topic-art"
        />
        <PolicyV6TopicControls
          dimensionKey={topic.key}
          originalEvidence={
            <div className="student-snapshot-card__evidence">
              {topic.claims.length ? (
                topic.claims.map((claim) => (
                  <article className="student-evidence" key={claim.id}>
                    <h4 data-i18n="preserve" lang="en">
                      {claim.text}
                    </h4>
                    <small>
                      {claim.id} · {copy.claimChecked}:{" "}
                      {claim.checkedAt?.slice(0, 10) ?? "—"}
                    </small>
                    {claim.evidence.map((e, i) => (
                      <blockquote
                        className="student-evidence__quote"
                        key={`${e.url}:${i}`}
                      >
                        <p data-i18n="preserve" lang={e.language}>
                          {e.quote}
                        </p>
                        <footer>
                          <a
                            href={e.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {e.title} ↗
                          </a>
                          {e.location ? (
                            <p data-i18n="preserve">{e.location}</p>
                          ) : null}
                          {e.retrievedAt ? (
                            <small>
                              {copy.retrieved}: {e.retrievedAt.slice(0, 10)}
                            </small>
                          ) : null}
                        </footer>
                      </blockquote>
                    ))}
                  </article>
                ))
              ) : (
                <p>{ui.gap}</p>
              )}
            </div>
          }
        />
      </article>
    );
  }
  return (
    <section
      className="student-policy student-policy--compact policy-v6-record-topics"
      aria-labelledby={
        additionalOnly ? "v6-additional-title" : "student-policy-heading"
      }
    >
      {!additionalOnly ? (
        <>
          <h2 id="student-policy-heading">{copy.topics}</h2>
          <div className="student-policy__grid">{school.topics.map(card)}</div>
        </>
      ) : null}
      <details className="policy-v6-additional" id="v6-additional-topics">
        <summary id="v6-additional-title">{copy.more}</summary>
        <div className="student-policy__grid">
          {school.additionalTopics.map(card)}
        </div>
      </details>
    </section>
  );
}
