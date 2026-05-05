-- CreateEnum
CREATE TYPE "CanonicalEntityType" AS ENUM ('UNIVERSITY', 'TOOL', 'REGION', 'THEME', 'COURSE');

-- CreateEnum
CREATE TYPE "ClaimReviewState" AS ENUM ('MACHINE_CANDIDATE', 'AGENT_REVIEWED', 'HUMAN_REVIEWED', 'NEEDS_REVIEW', 'REJECTED');

-- CreateTable
CREATE TABLE "canonical_entities" (
    "id" TEXT NOT NULL,
    "type" "CanonicalEntityType" NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "canonical_url" TEXT NOT NULL,
    "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canonical_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_claims" (
    "id" TEXT NOT NULL,
    "canonical_entity_id" TEXT NOT NULL,
    "claim_type" TEXT NOT NULL,
    "claim_text" TEXT NOT NULL,
    "claim_value" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "review_state" "ClaimReviewState" NOT NULL DEFAULT 'MACHINE_CANDIDATE',
    "last_checked_at" TIMESTAMP(3),
    "last_changed_at" TIMESTAMP(3),
    "dedupe_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_attributions" (
    "id" TEXT NOT NULL,
    "policy_source_id" TEXT,
    "source_snapshot_id" TEXT,
    "source_url" TEXT NOT NULL,
    "final_url" TEXT,
    "citation_title" TEXT NOT NULL,
    "publisher" TEXT,
    "retrieved_at" TIMESTAMP(3),
    "snapshot_hash" TEXT NOT NULL,
    "source_type" TEXT NOT NULL DEFAULT 'official_policy_page',
    "official" BOOLEAN NOT NULL DEFAULT true,
    "source_rights" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_attributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_evidence" (
    "id" TEXT NOT NULL,
    "policy_claim_id" TEXT NOT NULL,
    "source_attribution_id" TEXT,
    "policy_source_id" TEXT,
    "source_snapshot_id" TEXT,
    "source_url" TEXT NOT NULL,
    "source_snapshot_hash" TEXT NOT NULL,
    "evidence_snippet" TEXT NOT NULL,
    "snippet_location" TEXT,
    "retrieved_at" TIMESTAMP(3),
    "dedupe_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "canonical_entities_type_idx" ON "canonical_entities"("type");

-- CreateIndex
CREATE UNIQUE INDEX "canonical_entities_type_slug_key" ON "canonical_entities"("type", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "policy_claims_dedupe_key_key" ON "policy_claims"("dedupe_key");

-- CreateIndex
CREATE INDEX "policy_claims_canonical_entity_id_idx" ON "policy_claims"("canonical_entity_id");

-- CreateIndex
CREATE INDEX "policy_claims_review_state_idx" ON "policy_claims"("review_state");

-- CreateIndex
CREATE INDEX "policy_claims_last_changed_at_idx" ON "policy_claims"("last_changed_at");

-- CreateIndex
CREATE UNIQUE INDEX "source_attributions_source_url_snapshot_hash_key" ON "source_attributions"("source_url", "snapshot_hash");

-- CreateIndex
CREATE INDEX "source_attributions_policy_source_id_idx" ON "source_attributions"("policy_source_id");

-- CreateIndex
CREATE INDEX "source_attributions_source_snapshot_id_idx" ON "source_attributions"("source_snapshot_id");

-- CreateIndex
CREATE UNIQUE INDEX "claim_evidence_dedupe_key_key" ON "claim_evidence"("dedupe_key");

-- CreateIndex
CREATE INDEX "claim_evidence_policy_claim_id_idx" ON "claim_evidence"("policy_claim_id");

-- CreateIndex
CREATE INDEX "claim_evidence_policy_source_id_idx" ON "claim_evidence"("policy_source_id");

-- CreateIndex
CREATE INDEX "claim_evidence_source_snapshot_id_idx" ON "claim_evidence"("source_snapshot_id");

-- CreateIndex
CREATE INDEX "claim_evidence_source_snapshot_hash_idx" ON "claim_evidence"("source_snapshot_hash");

-- AddForeignKey
ALTER TABLE "policy_claims" ADD CONSTRAINT "policy_claims_canonical_entity_id_fkey" FOREIGN KEY ("canonical_entity_id") REFERENCES "canonical_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_attributions" ADD CONSTRAINT "source_attributions_policy_source_id_fkey" FOREIGN KEY ("policy_source_id") REFERENCES "policy_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_attributions" ADD CONSTRAINT "source_attributions_source_snapshot_id_fkey" FOREIGN KEY ("source_snapshot_id") REFERENCES "source_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_evidence" ADD CONSTRAINT "claim_evidence_policy_claim_id_fkey" FOREIGN KEY ("policy_claim_id") REFERENCES "policy_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_evidence" ADD CONSTRAINT "claim_evidence_source_attribution_id_fkey" FOREIGN KEY ("source_attribution_id") REFERENCES "source_attributions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_evidence" ADD CONSTRAINT "claim_evidence_policy_source_id_fkey" FOREIGN KEY ("policy_source_id") REFERENCES "policy_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_evidence" ADD CONSTRAINT "claim_evidence_source_snapshot_id_fkey" FOREIGN KEY ("source_snapshot_id") REFERENCES "source_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
