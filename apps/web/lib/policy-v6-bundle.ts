import {publishedV6Bundle} from "./policy-v6-published";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import type { PolicyClaim, SourceAttribution } from "@uapt/shared";
import { policyClaimSchema, sourceAttributionSchema, universityToolRecordSchema, aiTools } from "@uapt/shared";
import type { LabSchool } from "./policy-v6";
import type { PageToolRecord } from "@/components/university-ai-tools";
import type { PolicyScenePilot, PolicySceneQuickCheck } from "./policy-scene-pilot";
import type { SupportedLocale } from "./i18n";

/** Private, normalized display input. This is not a public policy/snapshot schema. */
export interface LocalV6Bundle {
  publication?: {releaseId:string;kind:string;publishedAt?:string};
  schemaVersion: "uapt-v6-local-view-v1";
  publicationApproved: false;
  sourceBundleSha256: string;
  school: LabSchool;
  claims: PolicyClaim[];
  sources: SourceAttribution[];
  tools: PageToolRecord[];
  scopedToolNames?: string[];
  gaps: string[];
  remainingRecordKeys: string[];
  heldDraftIds?: string[];
  workflowHolds?: unknown[];
  claimScopes?: Record<string, string>;
  auditCoverage?: { publicClaimIds: string[]; excludedClaims: { id: string; auditStatus: string }[]; originalObjectCount: number; analysisDimensionKeys: string[]; institutionAuditStatus: string };
  topicLabels: Record<string, { en: string; zh: string }>;
  topicSummaries?: Record<string, { en: string; zh: string }>;
  topicScopes?: Record<string, { en: string; zh: string }>;
  topicActions?: Record<string, { en: string[]; zh: string[] }>;
  hero: { title: { en: string; zh: string }; scope: { en: string; zh: string }; images: { hero: string; do: string; dont: string }; actions: { do: { key: string; en: string; zh: string }[]; dont: { key: string; en: string; zh: string }[] } };
}

/** Explicit local registration only; no environment-selected unrelated candidates. */
export function getLocalV6Bundle(slug: string, locale: SupportedLocale): LocalV6Bundle | undefined {
  const published=publishedV6Bundle(slug,locale);
  if(published)return published;
  if (process.env.NODE_ENV !== "development") return undefined;
  const pointer = [resolve(process.cwd(), ".local/policy-v6/bundles-current.json"), resolve(process.cwd(), "../../.local/policy-v6/bundles-current.json")].find(existsSync);
  if (!pointer) return undefined;
  const entry = JSON.parse(readFileSync(pointer, "utf8"))[slug] as { path: string; sha256: string; sourceBundleSha256: string } | undefined;
  if (!entry) return undefined;
  const path = resolve(pointer, "..", entry.path);
  if (!path.startsWith(resolve(pointer, "..") + "/")) throw new Error("V6 view escapes private root");
  const raw = readFileSync(path);
  return parseLocalV6Bundle(raw, slug, entry, locale);
}

/** Pure gate so exporters/tests can validate the exact view before selecting its pointer. */
export function parseLocalV6Bundle(raw: Buffer, slug: string, entry: { sha256: string; sourceBundleSha256: string }, locale: SupportedLocale): LocalV6Bundle {
  if (createHash("sha256").update(raw).digest("hex") !== entry.sha256) throw new Error("V6 local view changed; revalidate before selecting it");
  const view = JSON.parse(raw.toString()) as LocalV6Bundle;
  if (view.schemaVersion !== "uapt-v6-local-view-v1" || view.publicationApproved !== false || view.school.slug !== slug || view.sourceBundleSha256 !== entry.sourceBundleSha256 || view.school.fingerprint !== entry.sourceBundleSha256) throw new Error("V6 local view identity mismatch");
  view.claims.forEach((claim) => policyClaimSchema.parse(claim));
  view.sources.forEach((source) => sourceAttributionSchema.parse(source));
  for (const tool of view.tools) {
    universityToolRecordSchema.omit({ tool: true }).parse(tool);
    if (!aiTools.some((code) => code === tool.tool) && !/^proposed:[a-z0-9-]+$/.test(tool.tool)) throw new Error("Invalid local product identity");
  }
  if (new Set(view.claims.map((claim) => claim.id)).size !== view.claims.length || view.claims.some((claim) => claim.entitySlug !== slug || claim.reviewState !== "agent_reviewed")) throw new Error("Invalid local claim coverage");
  const displayedIds = new Set(view.claims.map((claim) => claim.id));
  if (view.heldDraftIds?.some((id) => displayedIds.has(id))) throw new Error("Held draft promoted into V6 conclusions");
  if (view.auditCoverage) {
    const expected = view.auditCoverage.publicClaimIds;
    const excluded = view.auditCoverage.excludedClaims;
    if (new Set(expected).size !== expected.length || new Set(excluded.map((claim) => claim.id)).size !== excluded.length ||
      excluded.some((claim) => displayedIds.has(claim.id) || !expected.includes(claim.id)) ||
      expected.some((id) => !displayedIds.has(id) && !excluded.some((claim) => claim.id === id))) throw new Error("Incomplete V6 public Claim ID reconciliation");
  }
  const scoped = view.scopedToolNames ?? [];
  if (new Set(scoped).size !== scoped.length || scoped.some((name) => !view.tools.some((tool) => tool.rawToolName === name))) throw new Error("Invalid scoped tool mapping");
  const topics = [...view.school.topics, ...view.school.additionalTopics];
  if (view.school.topics.map((topic) => topic.key).join(",") !== "coursework,exams,disclosure,privacy_data,approved_tools,research_publication" || new Set(topics.map((topic) => topic.key)).size !== topics.length) throw new Error("Invalid V6 topic coverage");
  for (const topic of topics) {
    if (topic.basisKind !== "local_reviewed_bundle" || !topic.claims.length || !topic.summary || topic.claims.some((claim) => !claim.evidence.length || claim.evidence.some((e) => !e.quote || !/^https?:\/\//.test(e.url)))) throw new Error("Invalid V6 topic evidence");
  }
  const local = locale === "zh" ? "zh" : "en";
  for (const topic of [...view.school.topics, ...view.school.additionalTopics]) {
    topic.title = view.topicLabels[topic.key]?.[local] ?? topic.title;
    topic.statusLabel = view.topicLabels[`${topic.key}:status`]?.[local] ?? topic.statusLabel;
    if (view.topicSummaries?.[topic.key]?.[local]) {
      topic.summary = view.topicSummaries[topic.key][local];
    }
    if (view.topicScopes?.[topic.key]?.[local]) {
      topic.scope = view.topicScopes[topic.key][local];
    }
    if (view.topicActions?.[topic.key]?.[local]) {
      topic.actions = view.topicActions[topic.key][local];
    }
  }
  return view;
}

export function getLocalV6BundleScene(view: LocalV6Bundle, locale: SupportedLocale): PolicyScenePilot {
  const local = locale === "zh" ? "zh" : "en";
  const action = (key: string, text: string): PolicySceneQuickCheck => ({ text, evidenceHref: `#snapshot-${key}` as PolicySceneQuickCheck["evidenceHref"] });
  return {
    slug: view.school.slug as PolicyScenePilot["slug"], eyebrow: local === "zh" ? "学生指南" : "Student guide",
    title: view.hero.title[local], guidance: view.hero.scope[local], evidenceLabel: local === "zh" ? "查看证据" : "View evidence", evidenceHref: "#student-policy-heading",
    artworkSrc: view.hero.images.hero, artworkAlt: view.hero.scope[local], artworkContainsText: true, artworkLandscape: true,
    claimsOnly: true, studentFirst: true, showGallerySummaries: true,
    quickGuide: { scopeNote: view.hero.scope[local],
      do: { artworkSrc: view.hero.images.do, artworkAlt: view.hero.scope[local], artworkLandscape: true, checks: view.hero.actions.do.map((item) => action(item.key, item[local])) as [ReturnType<typeof action>, ReturnType<typeof action>, ReturnType<typeof action>] },
      dont: { artworkSrc: view.hero.images.dont, artworkAlt: view.hero.scope[local], artworkLandscape: true, checks: view.hero.actions.dont.map((item) => action(item.key, item[local])) as [ReturnType<typeof action>, ReturnType<typeof action>, ReturnType<typeof action>] }
    }
  };
}
