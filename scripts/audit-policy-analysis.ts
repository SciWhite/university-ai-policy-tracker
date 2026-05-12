import {
  NO_ADVICE_BOUNDARY,
  POLICY_ANALYSIS_SCHEMA_VERSION,
  PUBLIC_API_VERSION,
  policyAnalysisProfileSchema
} from "@uapt/shared";
import {
  buildPolicyAnalysisCoverageScoresResponse,
  getPolicyAnalysisProfiles
} from "../apps/web/lib/policy-analysis";
import { getStagedPublicSummaries } from "../apps/web/lib/staged-public-data";

void main();

async function main(): Promise<void> {
  const summaries = await getStagedPublicSummaries();
  const profiles = await getPolicyAnalysisProfiles();
  const summariesBySlug = new Map(
    summaries.map((summary) => [summary.entity.slug, summary])
  );

  assert(profiles.length > 0, "Expected at least one analysis profile");
  assert(
    profiles.length === summaries.length,
    `Analysis profile count ${profiles.length} does not match public summary count ${summaries.length}`
  );

  for (const profile of profiles) {
    const parsed = policyAnalysisProfileSchema.parse(profile);
    const summary = summariesBySlug.get(parsed.entitySlug);

    assert(summary, `Missing public summary for ${parsed.entitySlug}`);
    assert(
      parsed.schemaVersion === POLICY_ANALYSIS_SCHEMA_VERSION,
      `${parsed.entitySlug} has unexpected analysis schema version`
    );
    assert(
      parsed.apiVersion === PUBLIC_API_VERSION,
      `${parsed.entitySlug} has unexpected public API version`
    );
    assert(
      parsed.publicJsonUrl.includes(
        `/api/public/${PUBLIC_API_VERSION}/analysis/universities/`
      ),
      `${parsed.entitySlug} analysis JSON URL is not versioned under /api/public/v1/analysis/universities/`
    );
    assert(
      parsed.limitations.includes(NO_ADVICE_BOUNDARY),
      `${parsed.entitySlug} missing no-advice limitation`
    );
    assert(
      parsed.reviewState === "machine_candidate",
      `${parsed.entitySlug} deterministic analysis must remain machine_candidate until reviewed`
    );
    assert(
      parsed.coverageScore.limitations.some((limitation) =>
        limitation.includes("not a policy quality score")
      ),
      `${parsed.entitySlug} coverage score missing quality-score caveat`
    );

    const publicClaimIds = new Set(summary.claims.map((claim) => claim.id));
    const publicSourceUrls = new Set(
      summary.claims.flatMap((claim) =>
        claim.evidence.map((evidence) => evidence.sourceUrl)
      )
    );

    for (const dimension of parsed.dimensions) {
      if (dimension.status === "not_mentioned") {
        assert(
          dimension.evidenceClaimIds.length === 0 &&
            dimension.evidenceSourceUrls.length === 0 &&
            dimension.basis.length === 0,
          `${parsed.entitySlug}/${dimension.key} is not_mentioned but has evidence`
        );
        assert(
          Boolean(dimension.notMentionedReason),
          `${parsed.entitySlug}/${dimension.key} missing notMentionedReason`
        );
      } else {
        assert(
          dimension.evidenceClaimIds.length > 0,
          `${parsed.entitySlug}/${dimension.key} has status ${dimension.status} without evidence`
        );
      }

      for (const claimId of dimension.evidenceClaimIds) {
        assert(
          publicClaimIds.has(claimId),
          `${parsed.entitySlug}/${dimension.key} references unknown claim ID ${claimId}`
        );
      }

      for (const sourceUrl of dimension.evidenceSourceUrls) {
        assert(
          publicSourceUrls.has(sourceUrl),
          `${parsed.entitySlug}/${dimension.key} references unknown source URL ${sourceUrl}`
        );
      }

      for (const basis of dimension.basis) {
        assert(
          basis.evidenceSnippet.length <= 700,
          `${parsed.entitySlug}/${dimension.key} basis snippet exceeds contract limit`
        );
        assert(
          basis.sourceLanguage.length >= 2,
          `${parsed.entitySlug}/${dimension.key} basis is missing source language`
        );
      }
    }
  }

  const coverageScores = await buildPolicyAnalysisCoverageScoresResponse();
  assert(
    coverageScores.data.count === profiles.length,
    "Coverage score response count does not match profile count"
  );
  assert(
    coverageScores.data.profiles.every((profile) =>
      profile.publicJsonUrl.includes(
        `/api/public/${PUBLIC_API_VERSION}/analysis/universities/`
      )
    ),
    "Coverage score response contains an unversioned analysis profile URL"
  );

  const evidenceBackedDimensions = profiles.reduce(
    (total, profile) =>
      total +
      profile.dimensions.filter((dimension) => dimension.evidenceCount > 0).length,
    0
  );
  const scoreAverage =
    profiles.reduce(
      (total, profile) => total + profile.coverageScore.score,
      0
    ) / profiles.length;

  console.log(
    `Audited ${profiles.length} policy analysis profiles from ${summaries.length} public summaries: ${evidenceBackedDimensions} evidence-backed dimensions, average coverage score ${scoreAverage.toFixed(
      1
    )}/100.`
  );
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
