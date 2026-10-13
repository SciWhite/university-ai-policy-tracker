import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { getLocalV6Evidence } from "../apps/web/lib/policy-v6-local-evidence";
import { getPolicyV6Data } from "../apps/web/lib/policy-v6";
import {
  isPolicyV6Preview,
  policyV6Slugs,
} from "../apps/web/lib/policy-v6-gate";
import { PolicyV6LocalPage } from "../apps/web/components/policy-v6-local-page";
import { policyV6ReviewState } from "../apps/web/lib/policy-v6-review";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
const pointer = resolve(".local/policy-v6/evidence-current.json");
const sha = (raw: Buffer) => createHash("sha256").update(raw).digest("hex");

test("six local V6 schools retain frozen evidence, complete original IDs and agent approval provenance", async () => {
  const env = process.env.NODE_ENV,
    previousPointer = process.env.UAPT_V6_EVIDENCE_POINTER;
  process.env.NODE_ENV = "development";
  process.env.UAPT_V6_EVIDENCE_POINTER = pointer;
  try {
    assert.equal(policyV6Slugs.length, 6);
    const data = await getPolicyV6Data("zh", "university-of-cambridge");
    assert(data.schools.every((s) => s.v6ReviewState === "agent_reviewed"));
    for (const [slug, count, baseline] of [
      ["harvard-university", 35, 30],
      ["university-of-cambridge", 19, 16],
    ] as const) {
      const local = getLocalV6Evidence(slug)!;
      assert.equal(local.record.claims.length, count);
      assert.equal(local.baselineClaimIds.length, baseline);
      assert(
        local.originalRecord.claims.every(
          (c) => c.reviewState === "needs_review",
        ),
      );
      assert(
        local.record.claims.every((c) => c.reviewState === "agent_reviewed"),
      );
      for (const original of local.originalRecord.claims) {
        const projected = local.record.claims.find(
          (c) => c.id === original.id,
        )!;
        assert.equal(projected.claimText, original.claimText);
        assert.deepEqual(projected.evidence, original.evidence);
      }
      const html = renderToStaticMarkup(
        <PolicyV6LocalPage
          university={{
            slug,
            name: local.record.entity.name,
            region: "Cambridge",
            country:
              slug === "harvard-university"
                ? "United States"
                : "United Kingdom",
          }}
          data={{ ...data, currentSlug: slug }}
          evidence={local}
          locale="zh"
        />,
      );
      assert(html.includes('data-v6-review-state="agent_reviewed"'));
      assert(html.includes(slug === "harvard-university" ? "harvard-mechanism-hero-v2.jpg" : "cambridge-mechanism-hero-v2.jpg"));
      assert(!html.includes("data-v6-record-metadata"));
      assert(!html.includes("97%") && !html.includes("98%"));
      const articleIds = [
        ...html.matchAll(/class="claim-evidence-card(?: claim-evidence-card--compact)?"[^>]*id="claim-([^"]+)"/g),
      ].map((m) => m[1]);
      assert.deepEqual(
        articleIds.sort(),
        local.record.claims.map((c) => c.id).sort(),
      );
      for (const claim of local.originalRecord.claims)
        for (const evidence of claim.evidence) {
          const escaped = renderToStaticMarkup(
            <span>{evidence.evidenceSnippet}</span>,
          ).slice(6, -7);
          assert(
            html.includes(escaped),
            `${slug}: ${claim.id} quotation changed`,
          );
        }
      for (const key of [
        "coursework",
        "exams",
        "disclosure",
        "privacy_data",
        "approved_tools",
        "research_publication",
        "academic_integrity",
        "teaching_guidance",
        "security_procurement",
      ])
        assert(html.includes(`data-v6-art-section="${key}"`));
      assert.equal(
        data.schools.find((s) => s.slug === slug)?.fingerprint,
        local.fingerprint,
      );
      assert.equal(policyV6ReviewState(slug,local.fingerprint), "agent_reviewed");
      assert.equal(policyV6ReviewState(slug,"changed"), undefined);
      assert(!html.includes(".local/") && !html.includes("/Users/"));
      if (slug === "harvard-university") {
        assert.equal(local.hmsTools.length, 8);
        assert(
          html.includes("Longwood Cluster") &&
            html.includes("Level 4") &&
            html.includes("Level 2"),
        );
        assert(html.includes("Prospectus") && html.includes("DUS"));
      } else {
        assert.equal(local.tools.length, 4);
        assert.equal(
          local.tools.filter((t) => String(t.tool) === "gemini").length,
          1,
        );
        assert(
          html.includes("significant AND unrevised") &&
            html.includes("Engineering"),
        );
      }
    }
    const p = JSON.parse(readFileSync(pointer, "utf8"));
    const m = readFileSync(join(p.root, "v6-manifest.json"));
    assert.equal(sha(m), p.manifestSha256);
    const manifest = JSON.parse(m.toString());
    assert.equal(manifest.agentReviewAuthorization.humanReviewRequired, false);
    assert.match(manifest.agentReviewAuthorization.source, /User confirmation/);
  } finally {
    if (env === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = env;
    if (previousPointer === undefined)
      delete process.env.UAPT_V6_EVIDENCE_POINTER;
    else process.env.UAPT_V6_EVIDENCE_POINTER = previousPointer;
  }
});

test("production rejects the private V6 adapter and changed frozen basis fails closed", () => {
  const env = process.env.NODE_ENV,
    originalPointer = process.env.UAPT_V6_EVIDENCE_POINTER;
  const temp = mkdtempSync(join(tmpdir(), "uapt-v6-basis-test-"));
  try {
    process.env.NODE_ENV = "production";
    process.env.UAPT_V6_EVIDENCE_POINTER = join(temp, "does-not-exist.json");
    assert.equal(getLocalV6Evidence("harvard-university"), undefined);
    for (const slug of policyV6Slugs)
      assert.equal(isPolicyV6Preview(slug, "v6", "production"), false);
    const p = JSON.parse(readFileSync(pointer, "utf8"));
    p.manifestSha256 = "changed";
    writeFileSync(join(temp, "changed-pointer.json"), JSON.stringify(p));
    process.env.NODE_ENV = "development";
    process.env.UAPT_V6_EVIDENCE_POINTER = join(temp, "changed-pointer.json");
    assert.throws(
      () => getLocalV6Evidence("harvard-university"),
      /manifest changed/,
    );
  } finally {
    if (env === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = env;
    if (originalPointer === undefined)
      delete process.env.UAPT_V6_EVIDENCE_POINTER;
    else process.env.UAPT_V6_EVIDENCE_POINTER = originalPointer;
    rmSync(temp, { recursive: true, force: true });
  }
});
