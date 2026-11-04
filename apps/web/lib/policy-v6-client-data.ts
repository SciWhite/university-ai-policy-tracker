import type { LabSchool, LabTopic, PolicyV6Data } from "./policy-v6";
import type { V6StudentGuideView } from "./policy-v6-student-actions";

/**
 * What PolicyV6Provider serializes into the page's RSC payload. Topic claims
 * and evidence are rendered on the server (PolicyV6TopicControls receives them
 * as `originalEvidence`), so only topic summaries, status and sources cross to
 * the client. Other schools are fetched from the compare API when selected.
 */
export type PolicyV6ClientTopic = Omit<LabTopic, "claims">;
export type PolicyV6ClientSchool = Omit<LabSchool, "topics" | "additionalTopics" | "heldClaims"> & {
  topics: PolicyV6ClientTopic[];
  additionalTopics: PolicyV6ClientTopic[];
};
export type PolicyV6ClientData = Omit<PolicyV6Data, "schools" | "schoolNames" | "studentActions"> & {
  schools: PolicyV6ClientSchool[];
  studentActions?: V6StudentGuideView;
};

const clientTopic = ({ claims: _claims, ...topic }: LabTopic): PolicyV6ClientTopic => topic;

export function policyV6ClientData(data: PolicyV6Data): PolicyV6ClientData {
  const { schools, schoolNames: _schoolNames, studentActions, ...rest } = data;
  return {
    ...rest,
    schools: schools.map(({ topics, additionalTopics, heldClaims: _heldClaims, ...school }) => ({
      ...school,
      topics: topics.map(clientTopic),
      additionalTopics: additionalTopics.map(clientTopic),
    })),
    ...(studentActions ? { studentActions: studentGuideView(studentActions) } : {}),
  };
}

function studentGuideView(guide: V6StudentGuideView): V6StudentGuideView {
  const used = new Set([...guide.do, ...guide.dont].flatMap((action) => action.claimIds));
  Object.values(guide.procedures).flat().forEach((id) => used.add(id));
  return {
    ...(guide.privatePreview !== undefined ? { privatePreview: guide.privatePreview } : {}),
    ...(guide.slug !== undefined ? { slug: guide.slug } : {}),
    name: guide.name,
    recordSha256: guide.recordSha256,
    do: guide.do,
    dont: guide.dont,
    procedures: guide.procedures,
    scope: guide.scope,
    claims: Object.fromEntries(Object.entries(guide.claims).filter(([id]) => used.has(id))),
  };
}
