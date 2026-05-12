import {
  NO_ADVICE_BOUNDARY,
  POLICY_ANALYSIS_PAGE_QUALITY_SCHEMA_VERSION,
  PUBLIC_API_VERSION,
  policyAnalysisPageQualityResponseSchema
} from "@uapt/shared";
import {
  buildPolicyAnalysisPageQualityResponse,
  getPublishableAnalysisThemeSpecs
} from "../apps/web/lib/policy-analysis-pages";
import { getPolicyAnalysisProfiles } from "../apps/web/lib/policy-analysis";

void main();

async function main(): Promise<void> {
  const profiles = await getPolicyAnalysisProfiles();
  const publishableThemes = await getPublishableAnalysisThemeSpecs();
  const quality = policyAnalysisPageQualityResponseSchema.parse(
    await buildPolicyAnalysisPageQualityResponse()
  );

  assert(profiles.length >= 20, "Analysis page smoke expects at least 20 profiles");
  assert(
    quality.apiVersion === PUBLIC_API_VERSION,
    "Analysis page-quality API version mismatch"
  );
  assert(
    quality.data.schemaVersion === POLICY_ANALYSIS_PAGE_QUALITY_SCHEMA_VERSION,
    "Analysis page-quality schema version mismatch"
  );
  assert(
    quality.data.status === "passes_current_quality_gate",
    `Analysis page-quality status is ${quality.data.status}`
  );
  assert(
    quality.data.limitations.includes(NO_ADVICE_BOUNDARY),
    "Analysis page-quality response is missing the no-advice boundary"
  );
  assert(
    quality.data.reviewWorkflow.reviewQueue === "analysis_profile_review",
    "Analysis page-quality response is missing analysis_profile_review"
  );
  assert(
    quality.data.reviewWorkflow.publicApiMutationAllowed === false,
    "Analysis review workflow must be read-only"
  );

  const requiredPaths = new Set([
    "/analysis",
    "/analysis/policy-coverage",
    ...publishableThemes.map((theme) => `/analysis/${theme.slug}`)
  ]);
  const reportedPaths = new Set(quality.data.pages.map((page) => page.path));

  for (const path of requiredPaths) {
    assert(reportedPaths.has(path), `Missing page-quality entry for ${path}`);
  }

  for (const page of quality.data.pages) {
    assert(page.indexable, `${page.path} did not pass indexability gate`);
    assert(
      page.reviewState === "machine_candidate",
      `${page.path} page-quality should not upgrade review state`
    );
    assert(
      page.publicJsonUrls.every((url) =>
        url.includes(`/api/public/${PUBLIC_API_VERSION}/`)
      ),
      `${page.path} has unversioned public JSON URL`
    );
    assert(
      page.checks.every((check) => check.status === "pass"),
      `${page.path} has a non-pass quality check`
    );
  }

  console.log(
    `Smoke checked ${quality.data.pages.length} analysis pages with ${profiles.length} profiles and ${publishableThemes.length} publishable theme pages.`
  );
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
