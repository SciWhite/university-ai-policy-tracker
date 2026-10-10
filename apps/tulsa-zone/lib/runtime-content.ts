import { cache } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { reviewedClaimsFingerprint } from "@/lib/index-recovery-basis";
import {
  isRuntimeUniversity,
  newRuntimeUniversitySlugs,
  previouslyPublishedRuntimeUniversitySlugs,
  runtimeUniversitySlugs
} from "./schools";

const allowedRecordKeys = new Set([
  "id", "group", "sourceNature", "appliesToAI", "modality", "statement",
  "translationSourceHash", "localSummary", "emphasis", "deadlines", "scope",
  "conditions", "exceptions", "evidence"
]);
const allowedToolKeys = new Set([
  "universitySlug", "universityName", "tool", "rawToolName", "endorsementType",
  "availability", "description", "howToObtain", "costToUser", "reviewState",
  "checkedAt", "sourceLanguage", "relationship", "evidence"
]);
const supportedLocales = ["en", "zh", "fr", "pl", "es", "nl", "ms"] as const;
const oldSlugSet = new Set<string>(previouslyPublishedRuntimeUniversitySlugs);
const newSlugSet = new Set<string>(newRuntimeUniversitySlugs);

function isWebUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isHash(value: unknown): value is string {
  return typeof value === "string" && /^(?:sha256:)?[a-f0-9]{64}$/.test(value);
}

function assertToolRecord(tool: any, slug: string) {
  if (!tool || Object.keys(tool).some((key) => !allowedToolKeys.has(key))) {
    throw new Error(`Invalid tool fields for ${slug}`);
  }
  if (tool.universitySlug !== slug || typeof tool.rawToolName !== "string" ||
      !tool.rawToolName || typeof tool.tool !== "string" ||
      typeof tool.availability !== "string" || typeof tool.endorsementType !== "string" ||
      !Array.isArray(tool.evidence) || !tool.evidence.length) {
    throw new Error(`Invalid tool payload for ${slug}`);
  }
  for (const evidence of tool.evidence) {
    if (!isWebUrl(evidence.sourceUrl) || typeof evidence.evidenceSnippet !== "string" ||
        !evidence.evidenceSnippet || !isHash(evidence.snapshotHash) ||
        !["agent_reviewed", "human_reviewed"].includes(evidence.reviewState)) {
      throw new Error(`Invalid tool evidence for ${slug}`);
    }
  }
}

const loadPackage = cache(async () => {
  const root = process.env.UAPT_TULSA_CONTENT_ROOT;
  if (!root) throw new Error("Runtime content root required");

  const pointer = JSON.parse(await readFile(path.join(root, "current.json"), "utf8"));
  if (!/^[a-z0-9-]{1,80}$/.test(pointer.revision) || !/^[a-f0-9]{64}$/.test(pointer.sha256)) {
    throw new Error("Invalid content pointer");
  }

  const bytes = await readFile(path.join(root, "revisions", `${pointer.revision}.json`));
  if (createHash("sha256").update(bytes).digest("hex") !== pointer.sha256) {
    throw new Error("Content hash mismatch");
  }

  const value = JSON.parse(bytes.toString());
  const packageSlugs = Object.keys(value.schools ?? {});
  const expectedSlugs = [...runtimeUniversitySlugs];
  const scope = value.releaseScope;
  if (value.schemaVersion !== 3 || value.appCompatibility !== "uapt-v5-zone-v3" ||
      value.revision !== pointer.revision || value.publicationApproved !== true ||
      packageSlugs.length !== expectedSlugs.length ||
      expectedSlugs.some((slug) => !Object.hasOwn(value.schools, slug)) ||
      !scope || scope.includedSchoolCount !== expectedSlugs.length ||
      scope.newRouteSchoolCount !== newRuntimeUniversitySlugs.length ||
      scope.preservedExistingSchoolCount !== previouslyPublishedRuntimeUniversitySlugs.length ||
      JSON.stringify(scope.newRouteSlugs) !== JSON.stringify(newRuntimeUniversitySlugs) ||
      JSON.stringify(scope.preservedExistingSlugs) !== JSON.stringify(previouslyPublishedRuntimeUniversitySlugs) ||
      JSON.stringify(scope.locales) !== JSON.stringify(supportedLocales)) {
    throw new Error("Incompatible or out-of-scope content package");
  }
  if (Object.keys(value.recordCounts ?? {}).length !== expectedSlugs.length ||
      Object.keys(value.scenePins ?? {}).length !== expectedSlugs.length) {
    throw new Error("Content count or scene pin manifest mismatch");
  }

  for (const slug of runtimeUniversitySlugs) {
    const school = value.schools[slug];
    const expectedCount = value.recordCounts[slug];
    const isNewRoute = newSlugSet.has(slug);
    if (!school || school.slug !== slug || school.scene?.slug !== slug ||
        !Array.isArray(school.records) || school.records.length !== expectedCount ||
        !/^[a-f0-9]{64}$/.test(school.claimsFingerprint) ||
        value.scenePins[slug] !== school.claimsFingerprint ||
        (isNewRoute && (!school.sceneZh || school.sceneZh.slug !== slug)) ||
        (!isNewRoute && !oldSlugSet.has(slug))) {
      throw new Error(`Invalid school payload for ${slug}`);
    }

    if (!Array.isArray(school.records)) throw new Error(`Invalid records for ${slug}`);
    const ids = new Set<string>();
    for (const record of school.records) {
      if (!record || Object.keys(record).some((key) => !allowedRecordKeys.has(key)) ||
          typeof record.id !== "string" || !/^[a-z0-9][a-z0-9-]{2,119}$/.test(record.id) ||
          ids.has(record.id) || typeof record.statement !== "string" || !record.statement ||
          (record.modality !== undefined && typeof record.modality !== "string") ||
          !Array.isArray(record.deadlines) || !Array.isArray(record.conditions) ||
          !Array.isArray(record.exceptions) || !Array.isArray(record.evidence) ||
          !record.evidence.length || !record.scope || !Array.isArray(record.scope.qualifiers)) {
        throw new Error(`Invalid record for ${slug}`);
      }
      ids.add(record.id);
      if (record.translationSourceHash &&
          createHash("sha256").update(record.statement).digest("hex") !== record.translationSourceHash) {
        throw new Error(`Translation hash mismatch for ${slug}/${record.id}`);
      }
      for (const evidence of record.evidence) {
        if (typeof evidence.quote !== "string" || !evidence.quote || !isWebUrl(evidence.sourceUrl) ||
            !isHash(evidence.sourceSnapshotHash) || typeof evidence.retrievedAt !== "string" ||
            !Number.isFinite(Date.parse(evidence.retrievedAt)) ||
            !Number.isInteger(evidence.lineStart) || !Number.isInteger(evidence.lineEnd) ||
            evidence.lineEnd < evidence.lineStart) {
          throw new Error(`Invalid evidence for ${slug}/${record.id}`);
        }
      }
    }

    if (school.heldClaims !== undefined) {
      if (slug !== "massachusetts-institute-of-technology" || !Array.isArray(school.heldClaims) ||
          school.heldClaims.length !== 2 || school.heldClaims.some((claim: any) =>
            Object.keys(claim).sort().join(",") !== "id,sourceUrl,text" ||
            typeof claim.id !== "string" || typeof claim.text !== "string" || !isWebUrl(claim.sourceUrl))) {
        throw new Error(`Invalid historical hold for ${slug}`);
      }
    }

    if (school.tools !== undefined) {
      if (!Array.isArray(school.tools)) throw new Error(`Invalid tools for ${slug}`);
      for (const tool of school.tools) assertToolRecord(tool, slug);
    }
  }

  const eurHold = value.schools["erasmus-university-rotterdam"].claimHold;
  if (!eurHold || eurHold.claimId !== "cl-eur-phd-genai-guidance" ||
      !isWebUrl(eurHold.sourceUrl) || !eurHold.evidenceHref ||
      Object.keys(eurHold.notes ?? {}).sort().join(",") !== [...supportedLocales].sort().join(",") ||
      [...supportedLocales].some((locale) => typeof eurHold.notes[locale] !== "string" || !eurHold.notes[locale].trim())) {
    throw new Error("EUR presentation hold is missing or incomplete");
  }
  if (Object.values(value.schools).some((school: any) =>
      school.records.some((record: any) => record.id === "uhd-fact-08" || record.id === "uhd-fact-11"))) {
    throw new Error("Held Heidelberg records must not be published");
  }

  return value;
});

export const loadTulsaContent = cache(async (slug: string, claims: any[]) => {
  if (!isRuntimeUniversity(slug)) return null;
  const school = (await loadPackage()).schools[slug];
  if (school.claimsFingerprint !== reviewedClaimsFingerprint(claims)) {
    throw new Error(`Canonical claim fingerprint mismatch for ${slug}`);
  }
  if (school.heldClaims && school.heldClaims.some((held: any) =>
      !claims.some(claim => claim.id === held.id && claim.reviewState === "needs_review" && claim.claimText === held.text))) {
    throw new Error(`Historical hold does not match canonical claims for ${slug}`);
  }
  return school;
});
