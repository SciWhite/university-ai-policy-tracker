import React from "react";
import type {
  PolicyClaim,
  PolicySnapshot,
  PolicySnapshotAudience,
  PolicySnapshotDimension,
  PolicySnapshotDimensionKey,
  PolicySnapshotDimensionStatus
} from "@uapt/shared";
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
  {
    label: string;
    audience: string;
    audienceKeys: readonly PolicySnapshotAudience[];
    focus: string;
    unsupportedLabel: string;
  }
> = {
  student: {
    label: "Student",
    audience: "For students",
    audienceKeys: ["students"],
    focus: "Coursework, exams, and disclosure",
    unsupportedLabel: "student"
  },
  instructor: {
    label: "Instructor",
    audience: "For instructors",
    audienceKeys: ["faculty"],
    focus: "Teaching and assessment",
    unsupportedLabel: "instructor"
  },
  researcher: {
    label: "Researcher",
    audience: "For researchers",
    audienceKeys: ["researchers"],
    focus: "Research and publication",
    unsupportedLabel: "researcher"
  },
  staff: {
    label: "Staff & institutional data",
    audience: "For staff",
    audienceKeys: ["staff", "administrators"],
    focus: "Privacy and university-provided tools",
    unsupportedLabel: "staff"
  }
};

const roleDimensionPriority: Record<
  StudentSnapshotRole,
  readonly PolicySnapshotDimensionKey[]
> = {
  student: [
    "coursework",
    "exams",
    "disclosure",
    "privacy_data",
    "approved_tools",
    "research_publication"
  ],
  instructor: [
    "exams",
    "coursework",
    "disclosure",
    "approved_tools",
    "privacy_data",
    "research_publication"
  ],
  researcher: [
    "research_publication",
    "privacy_data",
    "disclosure",
    "approved_tools",
    "coursework",
    "exams"
  ],
  staff: [
    "privacy_data",
    "approved_tools",
    "disclosure",
    "research_publication",
    "coursework",
    "exams"
  ]
};

const dimensionCopy: Record<
  PolicySnapshotDimensionKey,
  { title: string; extraScope?: string }
> = {
  coursework: { title: "Coursework & assignments" },
  exams: { title: "Exams & assessment" },
  disclosure: { title: "Disclosure & citation" },
  privacy_data: { title: "Privacy & sensitive data" },
  approved_tools: {
    title: "University-provided AI tools",
    extraScope: "Provision ≠ coursework permission"
  },
  research_publication: { title: "Research & publication" }
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
  action: "do" | "dont",
  role: StudentSnapshotRole = "student"
): string[] {
  const seen = new Set<string>();
  const values: string[] = [];

  for (const dimension of getRolePrioritizedDimensions(snapshot, role)) {
    for (const value of dimension.actions[action]) {
      if (seen.has(value)) continue;
      seen.add(value);
      values.push(value);
      if (values.length === 3) return values;
    }
  }

  return values;
}

export function getRolePrioritizedDimensions(
  snapshot: PolicySnapshot,
  role: StudentSnapshotRole
): PolicySnapshotDimension[] {
  const priority = new Map(
    roleDimensionPriority[role].map((key, index) => [key, index])
  );

  return getSnapshotDimensions(snapshot)
    .slice()
    .sort(
      (left, right) =>
        (priority.get(left.key) ?? Number.MAX_SAFE_INTEGER) -
        (priority.get(right.key) ?? Number.MAX_SAFE_INTEGER)
    );
}

export function isSnapshotRoleSupported(
  snapshot: PolicySnapshot,
  role: StudentSnapshotRole
): boolean {
  return roleCopy[role].audienceKeys.some((audience) =>
    snapshot.audiences.includes(audience)
  );
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
  const roleSupported = isSnapshotRoleSupported(snapshot, role);
  const doItems = roleSupported ? collectSnapshotActions(snapshot, "do", role) : [];
  const dontItems = roleSupported
    ? collectSnapshotActions(snapshot, "dont", role)
    : [];
  const currentRole = roleCopy[role];
  const prioritizedKeys = getRolePrioritizedDimensions(snapshot, role)
    .slice(0, 3)
    .map((dimension) => dimension.key)
    .join(",");

  return (
    <section
      aria-labelledby="student-policy-heading"
      className="student-policy"
      data-snapshot-status="strong"
      data-snapshot-role={role}
      data-snapshot-role-supported={roleSupported ? "true" : "false"}
      data-snapshot-role-priority={prioritizedKeys}
    >
      <div className="student-policy__overall">
        <StatusIcon status="strong" />
        <div>
          <h2 id="student-policy-heading">Reviewed policy snapshot</h2>
          <p>{snapshot.summary}</p>
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
          <p
            className={`student-policy__role-coverage${roleSupported ? "" : " student-policy__role-coverage--unsupported"}`}
          >
            {roleSupported
              ? "Reviewed material is available for this audience."
              : `No reviewed ${currentRole.unsupportedLabel}-specific guidance; general conclusions only.`}
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
        <DimensionIcon dimension={dimension.key} />
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

function DimensionIcon({
  dimension
}: {
  dimension: PolicySnapshotDimensionKey;
}) {
  return (
    <span aria-hidden="true" className="student-snapshot-card__icon">
      <svg
        focusable="false"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        {dimension === "coursework" ? (
          <>
            <path d="M5 3.5h7.5L17 8v12.5H5z" key="document" />
            <path d="M12.5 3.5V8H17M8 11h5M8 14h3" key="document-lines" />
            <path d="m14.5 16.5 4.1-4.1 2 2-4.1 4.1-2.7.7z" key="document-pencil" />
          </>
        ) : dimension === "exams" ? (
          <>
            <rect height="15" key="clipboard" rx="1.5" width="14" x="5" y="5.5" />
            <path d="M9 5.5V4h6v1.5M9 12l2 2 4-4" key="clipboard-check" />
          </>
        ) : dimension === "disclosure" ? (
          <>
            <path d="M5 8h5v4H7v4h3M14 8h5v4h-3v4h3" key="quotes" />
          </>
        ) : dimension === "privacy_data" ? (
          <>
            <path d="M12 3.5 19 6v5c0 4.4-2.7 7.7-7 10-4.3-2.3-7-5.6-7-10V6z" key="shield" />
            <rect height="5" key="lock" rx="1" width="7" x="8.5" y="10" />
            <path d="M10 10V8.8a2 2 0 0 1 4 0V10" key="lock-shackle" />
          </>
        ) : dimension === "approved_tools" ? (
          <>
            <rect height="9" key="chip" rx="2" width="9" x="4" y="9" />
            <path d="M7 6v3M10 6v3M13 6v3M7 18v2M10 18v2M13 18v2M4 12H2M4 15H2M17 12h2M17 15h2" key="chip-pins" />
            <path d="m18 3 .7 2.3L21 6l-2.3.7L18 9l-.7-2.3L15 6l2.3-.7z" key="spark" />
          </>
        ) : (
          <>
            <path d="M4 5.5c2.6-.8 5.3-.4 8 1.2v12c-2.7-1.6-5.4-2-8-1.2zM20 5.5c-2.6-.8-5.3-.4-8 1.2v12c2.7-1.6 5.4-2 8-1.2z" key="book" />
            <path d="M12 6.7v12" key="book-spine" />
          </>
        )}
      </svg>
    </span>
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
