import React from "react";
import type {
  PolicyClaim,
  PolicySnapshot,
  PolicySnapshotDimension,
  PolicySnapshotDimensionKey,
  PolicySnapshotDimensionStatus
} from "@uapt/shared";
import { MetaLabel } from "@/components/meta-label";
import { StateLabel } from "@/components/state-label";
import { getSourceDomain } from "@/lib/analytics-events";
import { formatSnapshotHash } from "@/lib/snapshot-hash";
import type { SupportedLocale } from "@/lib/i18n";

export const STUDENT_SNAPSHOT_DIMENSION_ORDER: readonly PolicySnapshotDimensionKey[] = [
  "coursework",
  "exams",
  "disclosure",
  "privacy_data",
  "approved_tools",
  "research_publication"
];

export const STUDENT_SNAPSHOT_ROLES = [
  "student",
  "instructor",
  "researcher",
  "staff"
] as const;

export type StudentSnapshotRole = (typeof STUDENT_SNAPSHOT_ROLES)[number];

const roleCopy: Record<
  StudentSnapshotRole,
  { label: string; audience: string; focus: string }
> = {
  student: {
    label: "Student",
    audience: "For students",
    focus: "Coursework, exams, and disclosure"
  },
  instructor: {
    label: "Instructor",
    audience: "For instructors",
    focus: "Teaching and assessment"
  },
  researcher: {
    label: "Researcher",
    audience: "For researchers",
    focus: "Research and publication"
  },
  staff: {
    label: "Staff",
    audience: "For staff",
    focus: "Privacy and university-provided tools"
  }
};

const dimensionCopy: Record<
  PolicySnapshotDimensionKey,
  { title: string; icon: string; extraScope?: string }
> = {
  coursework: { title: "Coursework & assignments", icon: "A" },
  exams: { title: "Exams & assessment", icon: "E" },
  disclosure: { title: "Disclosure & citation", icon: "C" },
  privacy_data: { title: "Privacy & sensitive data", icon: "P" },
  approved_tools: {
    title: "University-provided AI tools",
    icon: "T",
    extraScope: "Provision ≠ coursework permission"
  },
  research_publication: { title: "Research & publication", icon: "R" }
};

const statusCopy: Record<PolicySnapshotDimensionStatus, string> = {
  allowed: "Allowed in this scope",
  conditionally_allowed: "Conditional",
  restricted: "Restricted",
  blocked: "Blocked",
  required: "Required",
  recommended: "Recommended",
  not_mentioned: "Not mentioned in reviewed sources",
  unclear: "Unclear",
  insufficient_public_evidence: "Insufficient public evidence"
};

const scopeCopy: Record<PolicySnapshot["scope"], string> = {
  university_wide: "University-wide",
  unit_specific: "Unit-specific",
  course_or_assessment: "Course or assessment",
  research_or_thesis: "Research or thesis",
  mixed: "Mixed scope"
};

const contextCopy: Record<string, string> = {
  assignment: "Assignment",
  exam: "Exam",
  thesis: "Thesis",
  research: "Research",
  teaching_preparation: "Teaching",
  administrative_work: "Administration"
};

interface StudentPolicySnapshotProps {
  claims: PolicyClaim[];
  entitySlug: string;
  locale?: SupportedLocale;
  role: StudentSnapshotRole;
  snapshot: PolicySnapshot;
}

export function normalizeStudentSnapshotRole(
  value: string | string[] | undefined
): StudentSnapshotRole {
  const candidate = Array.isArray(value) ? value[0] : value;
  return isStudentSnapshotRole(candidate) ? candidate : "student";
}

export function getSnapshotDimensions(
  snapshot: PolicySnapshot
): PolicySnapshotDimension[] {
  const byKey = new Map(snapshot.dimensions.map((dimension) => [dimension.key, dimension]));
  return STUDENT_SNAPSHOT_DIMENSION_ORDER.flatMap((key) => {
    const dimension = byKey.get(key);
    return dimension ? [dimension] : [];
  });
}

export function collectSnapshotActions(
  snapshot: PolicySnapshot,
  action: "do" | "dont"
): string[] {
  const seen = new Set<string>();
  const values: string[] = [];

  for (const dimension of getSnapshotDimensions(snapshot)) {
    for (const value of dimension.actions[action]) {
      if (seen.has(value)) continue;
      seen.add(value);
      values.push(value);
      if (values.length === 3) return values;
    }
  }

  return values;
}

export function isStrongStudentSnapshot(
  loaded:
    | { snapshot: PolicySnapshot; validation: { effectiveStatus: string } }
    | undefined
): loaded is { snapshot: PolicySnapshot; validation: { effectiveStatus: "strong" } } {
  return Boolean(
    loaded?.snapshot.overallStatus === "strong" &&
      loaded.validation.effectiveStatus === "strong"
  );
}

export function StudentPolicySnapshot({
  claims,
  entitySlug,
  locale = "en",
  role,
  snapshot
}: StudentPolicySnapshotProps) {
  const dimensions = getSnapshotDimensions(snapshot);
  const doItems = collectSnapshotActions(snapshot, "do");
  const dontItems = collectSnapshotActions(snapshot, "dont");
  const currentRole = roleCopy[role];

  return (
    <section
      aria-labelledby="student-policy-heading"
      className="student-policy"
      data-snapshot-status="strong"
      data-snapshot-role={role}
    >
      <div className="student-policy__overall">
        <StatusIcon status="strong" />
        <div>
          <h2 id="student-policy-heading">Reviewed policy snapshot</h2>
          <p>Source-backed guidance is available for this university.</p>
        </div>
      </div>

      {doItems.length || dontItems.length ? (
        <div aria-label="Quick guidance" className="student-policy__actions">
          {doItems.length ? (
            <ActionList items={doItems} kind="do" />
          ) : null}
          {dontItems.length ? (
            <ActionList items={dontItems} kind="dont" />
          ) : null}
        </div>
      ) : null}

      <div className="student-policy__role-row">
        <div>
          <p className="student-policy__eyebrow">Audience</p>
          <p className="student-policy__role-focus">
            {currentRole.audience} · {currentRole.focus}
          </p>
        </div>
        <nav aria-label="Snapshot audience" className="student-policy__roles">
          {STUDENT_SNAPSHOT_ROLES.map((candidate) => (
            <a
              aria-current={candidate === role ? "page" : undefined}
              data-analytics-entity-slug={entitySlug}
              data-analytics-event="snapshot_role"
              data-analytics-snapshot-role={candidate}
              href={`?for=${candidate}`}
              key={candidate}
            >
              {roleCopy[candidate].label}
            </a>
          ))}
        </nav>
      </div>

      <div className="student-policy__grid">
        {dimensions.map((dimension) => (
          <SnapshotDimensionCard
            claims={claims}
            dimension={dimension}
            entitySlug={entitySlug}
            key={dimension.key}
            locale={locale}
            snapshot={snapshot}
          />
        ))}
      </div>
    </section>
  );
}

export function NoReviewedSnapshotState() {
  return (
    <section
      aria-labelledby="student-policy-heading"
      className="student-policy student-policy--empty"
      data-snapshot-status="not_available"
    >
      <div className="student-policy__overall">
        <StatusIcon status="not_available" />
        <div>
          <h2 id="student-policy-heading">No reviewed summary yet</h2>
        </div>
      </div>
    </section>
  );
}

function SnapshotDimensionCard({
  claims,
  dimension,
  entitySlug,
  locale,
  snapshot
}: {
  claims: PolicyClaim[];
  dimension: PolicySnapshotDimension;
  entitySlug: string;
  locale: SupportedLocale;
  snapshot: PolicySnapshot;
}) {
  const copy = dimensionCopy[dimension.key];
  const basisClaims = new Map(
    claims
      .filter((claim) => dimension.basis.claimIds.includes(claim.id ?? ""))
      .map((claim) => [claim.id, claim])
  );
  const sourceAttributions = dimension.basis.sources.map((source) => ({
    ...source,
    title:
      findSourceTitle(claims, source.sourceUrl) ?? source.sourceUrl
  }));
  const contexts = getDimensionContexts(dimension.key, snapshot.academicContexts);
  const detailsId = `snapshot-evidence-${dimension.key}`;

  return (
    <article
      className="student-snapshot-card"
      data-snapshot-dimension={dimension.key}
      data-snapshot-status={dimension.status}
    >
      <div className="student-snapshot-card__summary">
        <div aria-hidden="true" className="student-snapshot-card__icon">
          {copy.icon}
        </div>
        <div className="student-snapshot-card__content">
          <h3>{copy.title}</h3>
          <p className="student-snapshot-card__status">
            <StatusIcon status={dimension.status} />
            <span>{statusCopy[dimension.status]}</span>
          </p>
          <p className="student-snapshot-card__sentence">{dimension.summary}</p>
          <div className="student-snapshot-card__scopes">
            <a
              data-analytics-entity-slug={entitySlug}
              data-analytics-event="snapshot_scope"
              data-analytics-snapshot-dimension={dimension.key}
              data-analytics-snapshot-scope={snapshot.scope}
              href="#snapshot-scope"
            >
              Scope: {scopeCopy[snapshot.scope]}
            </a>
            {contexts.map((context) => (
              <span key={context}>{contextCopy[context] ?? context}</span>
            ))}
            {copy.extraScope ? <span>{copy.extraScope}</span> : null}
          </div>
        </div>
      </div>

      <details className="student-snapshot-card__details">
        <summary
          aria-controls={detailsId}
          data-analytics-entity-slug={entitySlug}
          data-analytics-event="snapshot_card_expand"
          data-analytics-snapshot-dimension={dimension.key}
        >
          <span aria-hidden="true" className="student-snapshot-card__disclosure">
            +
          </span>
          Reviewed evidence &amp; official sources
        </summary>
        <div className="student-snapshot-card__evidence" id={detailsId}>
          {basisClaims.size ? (
            <div>
              <h4>Reviewed evidence</h4>
              <div className="student-evidence-list">
                {[...basisClaims.values()].map((claim) => (
                  <article className="student-evidence" key={claim.id}>
                    <div className="student-evidence__heading">
                      <h5>{claim.claimText}</h5>
                      <StateLabel locale={locale} prefix="" reviewState={claim.reviewState} />
                    </div>
                    {claim.evidence.map((evidence, index) => (
                      <blockquote
                        className="student-evidence__quote"
                        key={`${evidence.sourceUrl}:${index}`}
                      >
                        {evidence.evidenceSnippet}
                        <footer>
                          <a
                            data-analytics-entity-slug={entitySlug}
                            data-analytics-event="snapshot_evidence"
                            data-analytics-snapshot-dimension={dimension.key}
                            data-analytics-snapshot-evidence="claim"
                            data-analytics-source-domain={getSourceDomain(evidence.sourceUrl)}
                            href={evidence.sourceUrl}
                          >
                            {evidence.attribution.citationTitle}
                          </a>
                        </footer>
                      </blockquote>
                    ))}
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <p className="muted">No reviewed evidence is included in this dimension.</p>
          )}

          {sourceAttributions.length ? (
            <div>
              <h4>Official sources</h4>
              <ul className="student-source-list">
                {sourceAttributions.map((source) => (
                  <li key={`${source.sourceUrl}:${source.sourceSnapshotHash}`}>
                    <a
                      data-analytics-entity-slug={entitySlug}
                      data-analytics-event="snapshot_evidence"
                      data-analytics-snapshot-dimension={dimension.key}
                      data-analytics-snapshot-evidence="source"
                      data-analytics-source-domain={getSourceDomain(source.sourceUrl)}
                      href={source.sourceUrl}
                    >
                      {source.title}
                    </a>
                    <span className="hash-value" title={source.sourceSnapshotHash}>
                      {formatSnapshotHash(source.sourceSnapshotHash)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </details>
    </article>
  );
}

function ActionList({ items, kind }: { items: string[]; kind: "do" | "dont" }) {
  const label = kind === "do" ? "Do" : "Don't";
  const icon = kind === "do" ? "✓" : "×";

  return (
    <div className={`student-action-list student-action-list--${kind}`}>
      <p>
        <span aria-hidden="true" className="student-action-list__icon">
          {icon}
        </span>
        <strong>{label}</strong>
      </p>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  const icon = status === "strong" || status === "allowed" || status === "recommended" || status === "required"
    ? "✓"
    : status === "not_available" || status === "not_mentioned"
      ? "—"
      : "!";

  return (
    <span aria-hidden="true" className={`student-status-icon student-status-icon--${status}`}>
      {icon}
    </span>
  );
}

function getDimensionContexts(
  key: PolicySnapshotDimensionKey,
  contexts: PolicySnapshot["academicContexts"]
): string[] {
  const relevant = new Set<string>(
    key === "coursework"
      ? ["assignment"]
      : key === "exams"
        ? ["exam"]
        : key === "research_publication"
          ? ["thesis", "research"]
          : key === "approved_tools"
            ? ["teaching_preparation", "administrative_work"]
            : contexts
  );

  return contexts.filter((context) => relevant.has(context));
}

function findSourceTitle(claims: PolicyClaim[], sourceUrl: string): string | undefined {
  for (const claim of claims) {
    const evidence = claim.evidence.find((item) => item.sourceUrl === sourceUrl);
    if (evidence) return evidence.attribution.citationTitle;
  }

  return undefined;
}

function isStudentSnapshotRole(value: string | undefined): value is StudentSnapshotRole {
  return Boolean(value && STUDENT_SNAPSHOT_ROLES.includes(value as StudentSnapshotRole));
}
