import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { policySnapshotSchema } from "@uapt/shared";
import {
  StudentPolicySnapshot,
  STUDENT_SNAPSHOT_DIMENSION_ORDER,
  collectSnapshotActions,
  getSnapshotDimensions,
  getRolePrioritizedDimensions,
  isStrongStudentSnapshot,
  isSnapshotRoleSupported,
  normalizeStudentSnapshotRole
} from "../apps/web/components/student-policy-snapshot";
import { getStagedPublicSummaryBySlug } from "../apps/web/lib/staged-public-data";

const fixturePath = path.join(
  process.cwd(),
  "examples",
  "fixtures",
  "policy-snapshot-v1-bristol.json"
);

async function readFixture() {
  return policySnapshotSchema.parse(
    JSON.parse(await readFile(fixturePath, "utf8"))
  );
}

test("student snapshot dimensions render in the contract order", async () => {
  const snapshot = await readFixture();

  assert.deepEqual(
    getSnapshotDimensions(snapshot).map((dimension) => dimension.key),
    STUDENT_SNAPSHOT_DIMENSION_ORDER
  );
});

test("student snapshot quick guidance is deduplicated and capped at three", async () => {
  const snapshot = await readFixture();

  assert.deepEqual(collectSnapshotActions(snapshot, "do"), [
    "Check the assessment instructions before using AI.",
    "Confirm the category for the specific assessment.",
    "Write thesis and APM text in your own words."
  ]);
  assert.equal(collectSnapshotActions(snapshot, "dont").length, 3);
});

test("role lenses prioritize relevant reviewed dimensions and fail closed", async () => {
  const snapshot = await readFixture();

  assert.deepEqual(
    getRolePrioritizedDimensions(snapshot, "researcher").map(
      (dimension) => dimension.key
    ),
    [
      "research_publication",
      "privacy_data",
      "disclosure",
      "approved_tools",
      "coursework",
      "exams"
    ]
  );
  assert.equal(collectSnapshotActions(snapshot, "do", "researcher")[0], "Write thesis and APM text in your own words.");
  assert.equal(isSnapshotRoleSupported(snapshot, "researcher"), true);
  assert.equal(isSnapshotRoleSupported(snapshot, "staff"), false);
});

test("role query values fail closed to the student view", () => {
  assert.equal(normalizeStudentSnapshotRole(undefined), "student");
  assert.equal(normalizeStudentSnapshotRole("instructor"), "instructor");
  assert.equal(normalizeStudentSnapshotRole(["researcher"]), "researcher");
  assert.equal(normalizeStudentSnapshotRole("candidate"), "student");
});

test("only a dual-reviewed current snapshot is eligible for the student UI", async () => {
  const snapshot = await readFixture();

  assert.equal(
    isStrongStudentSnapshot({
      snapshot,
      validation: { effectiveStatus: "strong" }
    }),
    true
  );
  assert.equal(
    isStrongStudentSnapshot({
      snapshot,
      validation: { effectiveStatus: "stale" }
    }),
    false
  );
  assert.equal(
    isStrongStudentSnapshot({
      snapshot: { ...snapshot, overallStatus: "needs_review" },
      validation: { effectiveStatus: "strong" }
    }),
    false
  );
});

test("strong snapshot markup keeps the role lens and six-card order in SSR", async () => {
  const snapshot = await readFixture();
  const summary = await getStagedPublicSummaryBySlug(snapshot.universitySlug);
  assert(summary);
  (globalThis as typeof globalThis & { React: typeof React }).React = React;
  const claims = summary.claims.filter((claim) =>
    claim.reviewState === "agent_reviewed" || claim.reviewState === "human_reviewed"
  );
  const html = renderToStaticMarkup(
    React.createElement(StudentPolicySnapshot, {
      claims,
      entitySlug: snapshot.universitySlug,
      role: "researcher",
      snapshot
    })
  );
  const labels = [
    "Coursework &amp; assignments",
    "Exams &amp; assessment",
    "Disclosure &amp; citation",
    "Privacy &amp; sensitive data",
    "University-provided AI tools",
    "Research &amp; publication"
  ];

  let previous = -1;
  for (const label of labels) {
    const next = html.indexOf(label);
    assert(next > previous, `${label} is out of order or missing`);
    previous = next;
  }
  assert.match(html, /data-snapshot-role="researcher"/);
  assert.match(html, /data-snapshot-role-supported="true"/);
  assert.match(html, /data-snapshot-role-priority="research_publication,privacy_data,disclosure"/);
  assert.match(html, new RegExp(snapshot.summary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, /<svg[^>]+viewBox="0 0 24 24"/);
  assert.doesNotMatch(html, /student-snapshot-card__icon[^>]*>A</);
  assert.match(html, /href="\?for=instructor"/);
  assert.match(html, /data-analytics-event="snapshot_card_expand"/);
  assert.match(html, /data-analytics-event="snapshot_scope"/);
  assert.match(html, /data-analytics-event="snapshot_evidence"/);
  assert.match(html, /Provision ≠ coursework permission/);
});
