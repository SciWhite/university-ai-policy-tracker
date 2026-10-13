import {publishedV6Evidence} from "./policy-v6-published";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  publicEntitySummarySchema,
  deriveUniversityToolRecordsForSummary,
  type PublicEntitySummary,
} from "@uapt/shared";
import type { PageToolRecord } from "@/components/university-ai-tools";
import { policyV6ReviewState } from "./policy-v6-review";

type Ref = { path: string; sha256: string };
type Entry = {
  slug: string;
  baselineClaimIds: string[];
  candidateClaimIds: string[];
  files: Record<string, Ref>;
};
export type LocalV6Dimension = {
  key: string;
  status: string;
  summary: string;
  basis?: { claimIds: string[] };
  evidenceClaimIds?: string[];
};
export type HmsTool = {
  name: string;
  dataLevel: string;
  eligibility: string;
  trainingRequired: string;
  cost: string;
  unit: string;
  sourceUrl: string;
  originalTableRow: string;
  claimId: string;
};
export type LocalV6Evidence = {
  record: PublicEntitySummary;
  originalRecord: PublicEntitySummary;
  dimensions: LocalV6Dimension[];
  additionalDimensions: LocalV6Dimension[];
  tools: PageToolRecord[];
  hmsTools: HmsTool[];
  fingerprint: string;
  revision: string;
  sourceManifestHash: string;
  baselineClaimIds: string[];
  remainingObjects: number;
};
const hash = (value: Buffer) =>
  createHash("sha256").update(value).digest("hex");

/** Explicit development-only V6 adapter. Canonical catalog, APIs and public snapshot pins never read this data. */
export function getLocalV6Evidence(slug: string): LocalV6Evidence | undefined {
  const published=publishedV6Evidence(slug);
  if(published)return published;
  if (
    process.env.NODE_ENV !== "development" ||
    !["harvard-university", "university-of-cambridge"].includes(slug)
  )
    return undefined;
  const configured = process.env.UAPT_V6_EVIDENCE_POINTER;
  const pointer =
    configured ??
    [
      resolve(process.cwd(), ".local/policy-v6/evidence-current.json"),
      resolve(process.cwd(), "../../.local/policy-v6/evidence-current.json"),
    ].find(existsSync);
  if (!pointer || !existsSync(pointer)) return undefined;
  const target = JSON.parse(readFileSync(pointer, "utf8")) as {
    root: string;
    manifestSha256: string;
  };
  const bytes = readFileSync(resolve(target.root, "v6-manifest.json"));
  if (hash(bytes) !== target.manifestSha256)
    throw new Error(
      "V6 evidence manifest changed; frozen basis must be reaccepted.",
    );
  const manifest = JSON.parse(bytes.toString()) as {
    publicationApproved: boolean;
    productionLoaderConnected: boolean;
    sourceBundleManifestSha256: string;
    universities: Entry[];
  };
  if (manifest.publicationApproved || manifest.productionLoaderConnected)
    throw new Error("Local V6 adapter must remain separate from publication.");
  const entry = manifest.universities.find((s) => s.slug === slug);
  if (!entry) return undefined;
  function read<T>(key: string): T {
    const ref = entry!.files[key];
    if (!ref) throw new Error(`Missing frozen V6 evidence: ${key}`);
    const path = resolve(target.root, ref.path);
    if (!path.startsWith(resolve(target.root) + "/"))
      throw new Error("V6 evidence path escapes its frozen bundle.");
    const raw = readFileSync(path);
    if (hash(raw) !== ref.sha256)
      throw new Error(`Frozen V6 evidence changed: ${key}`);
    return JSON.parse(raw.toString()) as T;
  }
  const originalRecord = publicEntitySummarySchema.parse(
    read("draft/record.json"),
  );
  const ids = originalRecord.claims.map((c) => c.id);
  if (
    policyV6ReviewState(slug, entry.files["draft/record.json"].sha256) !==
    "agent_reviewed"
  )
    throw new Error(
      "V6 agent approval does not match this frozen record version.",
    );
  if (
    new Set(ids).size !== ids.length ||
    entry.candidateClaimIds.length !== ids.length ||
    entry.candidateClaimIds.some((id) => !ids.includes(id)) ||
    entry.baselineClaimIds.some((id) => !ids.includes(id))
  )
    throw new Error("V6 full baseline/new claim coverage mismatch.");
  // The user confirmed ChatGPT agent review passed for these V6 views. Keep the input's original hold and confidence intact.
  const record: PublicEntitySummary = {
    ...originalRecord,
    confidence: undefined,
    reviewState: "agent_reviewed",
    claims: originalRecord.claims.map((c) => ({
      ...c,
      reviewState: "agent_reviewed",
    })),
  };
  const dimensions = read<{ dimensions: LocalV6Dimension[] }>(
    "draft/student-summary.json",
  ).dimensions;
  const analysis = read<{ dimensions: LocalV6Dimension[] }>(
    "draft/analysis-dimensions.json",
  ).dimensions;
  const additionalDimensions = analysis.filter((d) =>
    [
      "academic_integrity",
      "teaching_guidance",
      "security_procurement",
    ].includes(d.key),
  );
  for (const d of [...dimensions, ...additionalDimensions]) {
    const basis = d.basis?.claimIds ?? d.evidenceClaimIds ?? [];
    if (!basis.length || basis.some((id) => !ids.includes(id)))
      throw new Error(`V6 topic basis incomplete: ${d.key}`);
  }
  const coverage = read<{
    remainingOriginalRecordKeys?: string[];
    remainingRecordKeys?: string[];
  }>("object-coverage.json");
  return {
    record,
    originalRecord,
    dimensions,
    additionalDimensions,
    tools: deriveUniversityToolRecordsForSummary(record),
    hmsTools: entry.files["hms-scoped-tools.json"]
      ? read<HmsTool[]>("hms-scoped-tools.json")
      : [],
    fingerprint: entry.files["draft/record.json"].sha256,
    revision: `local-agent-v6-${slug}-20261012`,
    sourceManifestHash: manifest.sourceBundleManifestSha256,
    baselineClaimIds: entry.baselineClaimIds,
    remainingObjects: (
      coverage.remainingOriginalRecordKeys ??
      coverage.remainingRecordKeys ??
      []
    ).length,
  };
}
