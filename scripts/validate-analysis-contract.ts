import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  NO_ADVICE_BOUNDARY,
  POLICY_ANALYSIS_SCHEMA_VERSION,
  PUBLIC_API_VERSION,
  policyAnalysisDimensionKeySchema,
  policyAnalysisProfileSchema
} from "@uapt/shared";

void main();

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const examplePath = path.join(repoRoot, "examples", "policy-analysis-profile.json");
  const example = JSON.parse(await readFile(examplePath, "utf8")) as unknown;
  const profile = policyAnalysisProfileSchema.parse(example);

  assert(
    profile.schemaVersion === POLICY_ANALYSIS_SCHEMA_VERSION,
    "Unexpected analysis schema version"
  );
  assert(profile.apiVersion === PUBLIC_API_VERSION, "Unexpected public API version");
  assert(
    profile.publicJsonUrl.includes(`/api/public/${PUBLIC_API_VERSION}/analysis/`),
    "Analysis publicJsonUrl must live under /api/public/v1/analysis/"
  );
  assert(
    profile.limitations.includes(NO_ADVICE_BOUNDARY),
    "Analysis profile must include the no-advice limitation"
  );

  const dimensionKeys = new Set(profile.dimensions.map((dimension) => dimension.key));
  for (const key of policyAnalysisDimensionKeySchema.options) {
    assert(dimensionKeys.has(key), `Example profile missing dimension: ${key}`);
  }

  for (const dimension of profile.dimensions) {
    if (dimension.status === "not_mentioned") {
      assert(
        dimension.evidenceClaimIds.length === 0 &&
          dimension.evidenceSourceUrls.length === 0 &&
          dimension.basis.length === 0,
        `${dimension.key} is not_mentioned but still has evidence`
      );
      assert(
        Boolean(dimension.notMentionedReason),
        `${dimension.key} is not_mentioned without notMentionedReason`
      );
    } else {
      assert(
        dimension.evidenceClaimIds.length > 0,
        `${dimension.key} must be evidence-backed when status=${dimension.status}`
      );
    }

    for (const basis of dimension.basis) {
      assert(
        basis.evidenceSnippet.length <= 700,
        `${dimension.key} basis evidence snippet is too long`
      );
    }
  }

  const scoreTotal = profile.coverageScore.components.reduce(
    (total, component) => total + component.points,
    0
  );
  assert(scoreTotal === profile.coverageScore.score, "Coverage score mismatch");

  const sourceLanguageCount = profile.sourceLanguages.length;
  const evidenceBackedDimensionCount = profile.dimensions.filter(
    (dimension) => dimension.evidenceClaimIds.length > 0
  ).length;

  console.log(
    `Validated ${profile.schemaVersion} example for ${profile.entitySlug}: ${profile.dimensions.length} dimensions, ${evidenceBackedDimensionCount} evidence-backed dimensions, ${profile.basedOnClaimIds.length} claim IDs, ${profile.basedOnSourceUrls.length} source URLs, ${sourceLanguageCount} source languages, coverage score ${profile.coverageScore.score}/${profile.coverageScore.maxScore}.`
  );
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
