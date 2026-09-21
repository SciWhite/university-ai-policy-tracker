import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  computePolicySnapshotBasisFingerprint
} from "../apps/web/lib/policy-snapshots";
import {
  getCurrentPublicReleaseManifest,
  getStagedPublicSummaryBySlug
} from "../apps/web/lib/staged-public-data";

/**
 * Re-pins policy snapshots to the current public release after a release
 * rolls (maintenance or full).
 *
 * Why this exists: the snapshot basis fingerprint covers
 * (releaseId, basis, claims), so every new public release makes all
 * previously-issued snapshots "stale" — even when no claim content changed.
 * On 2026-09-21 maintenance release public-release-20260921-001 invalidated
 * all 17 strong snapshots, silently degrading 6 of the 10 index-recovery
 * pilot pages (lost pilot title, snapshot section, dimension grouping).
 *
 * Safety gate (fail-closed): for every snapshot the script first recomputes
 * the fingerprint with the snapshot's ORIGINAL releaseId and the CURRENT
 * public claims. Only when that equals the stored basisFingerprint — proving
 * the reviewed claim/evidence content is byte-identical — is the snapshot
 * re-pinned to the new release. Any mismatch is skipped and reported; those
 * snapshots need a real re-review, not a mechanical re-pin.
 *
 * Keeps consistent, per scripts/validate-policy-snapshot.ts:
 * - data/policy-snapshots/v1/universities/{slug}.json  (releaseId, basisFingerprint)
 * - data/policy-snapshots/v1/index.json                (top-level + per-entry)
 * - data/policy-snapshots/v1/reviews/uapt-6-independent-review.json
 *   (top-level releaseId + decisions[].evidence.basisFingerprint)
 * - examples/fixtures/policy-snapshot-v1-bristol.json  (validator fixture)
 *
 * generatedAt, review metadata, decisions, issueCodes and all reviewed
 * content are left untouched — this is a release re-assertion, not a
 * content edit.
 *
 * Usage:
 *   pnpm snapshots:repin-release            # apply (with per-snapshot verification)
 *   pnpm snapshots:repin-release -- --dry-run
 *
 * After running, re-run: pnpm validate:policy-snapshot, then sync
 * data/policy-snapshots into apps/web/.runtime-data before building.
 */

interface RepinResult {
  slug: string;
  action: "repinned" | "skipped" | "error";
  detail: string;
}

const DRY_RUN = process.argv.includes("--dry-run");

async function readJson(file: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(file, "utf8"));
}

async function writeJson(file: string, value: unknown): Promise<void> {
  if (DRY_RUN) return;
  await writeFile(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}

async function main(): Promise<void> {
  const release = await getCurrentPublicReleaseManifest();
  if (!release?.releaseId) throw new Error("Missing current public release manifest");
  const newReleaseId = release.releaseId;

  const snapshotRoot = path.join(process.cwd(), "data", "policy-snapshots", "v1");
  const universityRoot = path.join(snapshotRoot, "universities");
  const indexPath = path.join(snapshotRoot, "index.json");
  const reviewPath = path.join(snapshotRoot, "reviews", "uapt-6-independent-review.json");
  const fixturePath = path.join(
    process.cwd(),
    "examples",
    "fixtures",
    "policy-snapshot-v1-bristol.json"
  );

  const index = await readJson(indexPath);
  const entries = (index.entries ?? []) as Array<Record<string, unknown>>;
  if (!entries.length) throw new Error("Snapshot index has no entries");

  const previousReleaseId = (index.releaseId as string) ?? "(unknown)";
  console.log(
    `${DRY_RUN ? "[dry-run] " : ""}Re-pinning ${entries.length} snapshots: ${previousReleaseId} -> ${newReleaseId}`
  );

  const newFingerprints = new Map<string, string>();
  const results: RepinResult[] = [];

  for (const entry of entries) {
    const slug = entry.universitySlug as string;
    const file = path.join(universityRoot, `${slug}.json`);
    try {
      const snapshot = await readJson(file);
      const basis = snapshot.basis as { claimIds: string[]; sources: unknown[] };
      const oldReleaseId = snapshot.releaseId as string;
      const storedFingerprint = snapshot.basisFingerprint as string;

      const summary = await getStagedPublicSummaryBySlug(slug);
      if (!summary) {
        results.push({ slug, action: "skipped", detail: "no current public summary" });
        continue;
      }
      const claimMap = new Map(summary.claims.map((claim) => [claim.id, claim]));
      const basisClaims = basis.claimIds.map((claimId) => claimMap.get(claimId));
      const missing = basis.claimIds.filter((claimId) => !claimMap.get(claimId));
      if (missing.length) {
        results.push({
          slug,
          action: "skipped",
          detail: `basis claims missing from current data: ${missing.join(", ")}`
        });
        continue;
      }

      // Safety gate: prove content unchanged since the snapshot was issued.
      const oldFingerprint = computePolicySnapshotBasisFingerprint(
        oldReleaseId,
        basis as never,
        basisClaims as never
      );
      if (oldFingerprint !== storedFingerprint) {
        results.push({
          slug,
          action: "skipped",
          detail:
            "content changed since issue (old-release fingerprint mismatch) — needs real re-review"
        });
        continue;
      }

      const newFingerprint = computePolicySnapshotBasisFingerprint(
        newReleaseId,
        basis as never,
        basisClaims as never
      );
      snapshot.releaseId = newReleaseId;
      snapshot.basisFingerprint = newFingerprint;
      await writeJson(file, snapshot);
      entry.releaseId = newReleaseId;
      entry.basisFingerprint = newFingerprint;
      newFingerprints.set(slug, newFingerprint);
      results.push({
        slug,
        action: "repinned",
        detail: `${(snapshot.overallStatus as string) ?? "?"}; fp ${storedFingerprint.slice(0, 8)} -> ${newFingerprint.slice(0, 8)}`
      });
    } catch (error) {
      results.push({
        slug,
        action: "error",
        detail: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Index top-level releaseId.
  index.releaseId = newReleaseId;
  await writeJson(indexPath, index);

  // Independent review artifact: releaseId + per-decision fingerprint pointer.
  const review = await readJson(reviewPath);
  review.releaseId = newReleaseId;
  for (const decision of (review.decisions ?? []) as Array<Record<string, unknown>>) {
    const slug = decision.universitySlug as string;
    const fp = newFingerprints.get(slug);
    const evidence = decision.evidence as Record<string, unknown> | undefined;
    if (fp && evidence) evidence.basisFingerprint = fp;
  }
  await writeJson(reviewPath, review);

  // Validator fixture (Bristol) — same verification gate.
  const fixture = await readJson(fixturePath);
  const fixtureSummary = await getStagedPublicSummaryBySlug(fixture.universitySlug as string);
  if (fixtureSummary) {
    const basis = fixture.basis as { claimIds: string[]; sources: unknown[] };
    const claimMap = new Map(fixtureSummary.claims.map((claim) => [claim.id, claim]));
    const basisClaims = basis.claimIds.map((claimId) => claimMap.get(claimId));
    if (basisClaims.every(Boolean)) {
      const oldFingerprint = computePolicySnapshotBasisFingerprint(
        fixture.releaseId as string,
        basis as never,
        basisClaims as never
      );
      if (oldFingerprint === fixture.basisFingerprint) {
        fixture.releaseId = newReleaseId;
        fixture.basisFingerprint = computePolicySnapshotBasisFingerprint(
          newReleaseId,
          basis as never,
          basisClaims as never
        );
        await writeJson(fixturePath, fixture);
        results.push({ slug: "fixture:university-of-bristol", action: "repinned", detail: "validator fixture" });
      } else {
        results.push({
          slug: "fixture:university-of-bristol",
          action: "skipped",
          detail: "fixture content changed — update fixture manually"
        });
      }
    }
  }

  for (const result of results) {
    const mark = result.action === "repinned" ? "OK  " : result.action === "skipped" ? "SKIP" : "ERR ";
    console.log(`  [${mark}] ${result.slug}: ${result.detail}`);
  }
  const skipped = results.filter((result) => result.action !== "repinned");
  console.log(
    `${results.length - skipped.length} repinned, ${skipped.length} skipped/error` +
      (DRY_RUN ? " (dry-run, nothing written)" : "")
  );
  if (skipped.some((result) => result.action !== "repinned")) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
