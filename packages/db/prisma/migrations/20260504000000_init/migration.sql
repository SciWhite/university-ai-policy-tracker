-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UNIVERSITY_WIDE_POLICY', 'SPECIFIC_UNIT_POLICY_OR_GUIDANCE', 'EXTERNAL_POLICY_OR_GUIDANCE', 'NO_POLICY', 'INACCESSIBLE');

-- CreateEnum
CREATE TYPE "PolicyAuthority" AS ENUM ('UNIVERSITY_WIDE', 'FACULTY_OR_SCHOOL', 'DEPARTMENT', 'COURSE_LEVEL', 'IT_OR_SECURITY_OFFICE', 'LIBRARY', 'TEACHING_AND_LEARNING_CENTER', 'RESEARCH_OFFICE', 'PROCUREMENT_OR_LEGAL');

-- CreateEnum
CREATE TYPE "AiServiceStatus" AS ENUM ('INSTITUTIONALLY_LICENSED_OR_PROCURED', 'THIRD_PARTY_SERVICE', 'SELF_HOSTED_SYSTEM', 'RESTRICTED_OR_PROHIBITED', 'NO_SPECIFIC_AI_SERVICE_NAMED');

-- CreateEnum
CREATE TYPE "ServiceTreatment" AS ENUM ('ALLOWED', 'CONDITIONALLY_ALLOWED', 'RESTRICTED_OR_BLOCKED', 'NOT_MENTIONED');

-- CreateEnum
CREATE TYPE "ReviewState" AS ENUM ('MACHINE_EXTRACTED', 'AGENT_REVIEWED', 'HUMAN_REVIEWED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "CrawlStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "FetchMode" AS ENUM ('HTTP', 'PLAYWRIGHT', 'OPENCLI', 'FIRECRAWL');

-- CreateEnum
CREATE TYPE "ReviewDecisionType" AS ENUM ('APPROVED', 'REJECTED', 'NEEDS_CHANGES');

-- CreateTable
CREATE TABLE "universities" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT,
    "website" TEXT,
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "universities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_sources" (
    "id" TEXT NOT NULL,
    "university_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "final_url" TEXT,
    "title" TEXT,
    "document_status" "DocumentStatus" NOT NULL,
    "policy_authority" "PolicyAuthority",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_checked_at" TIMESTAMP(3),
    "last_changed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_snapshots" (
    "id" TEXT NOT NULL,
    "policy_source_id" TEXT NOT NULL,
    "crawl_run_id" TEXT,
    "content_hash" TEXT NOT NULL,
    "normalized_text" TEXT NOT NULL,
    "raw_storage_key" TEXT,
    "http_status" INTEGER,
    "etag" TEXT,
    "last_modified" TEXT,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "source_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crawl_runs" (
    "id" TEXT NOT NULL,
    "university_id" TEXT,
    "policy_source_id" TEXT,
    "status" "CrawlStatus" NOT NULL DEFAULT 'QUEUED',
    "fetch_mode" "FetchMode" NOT NULL DEFAULT 'HTTP',
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "requested_url" TEXT NOT NULL,
    "final_url" TEXT,
    "http_status" INTEGER,
    "robots_allowed" BOOLEAN,
    "failure_reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crawl_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extraction_candidates" (
    "id" TEXT NOT NULL,
    "university_id" TEXT NOT NULL,
    "policy_source_id" TEXT NOT NULL,
    "source_snapshot_id" TEXT NOT NULL,
    "crawl_run_id" TEXT,
    "document_status" "DocumentStatus" NOT NULL,
    "policy_authority" "PolicyAuthority",
    "ai_service_status" "AiServiceStatus" NOT NULL,
    "service_treatment" "ServiceTreatment" NOT NULL,
    "ai_tools" TEXT[],
    "themes" TEXT[],
    "audiences" TEXT[],
    "academic_contexts" TEXT[],
    "data_sensitivities" TEXT[],
    "evidence" JSONB NOT NULL,
    "summary" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "review_state" "ReviewState" NOT NULL DEFAULT 'MACHINE_EXTRACTED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extraction_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_versions" (
    "id" TEXT NOT NULL,
    "university_id" TEXT NOT NULL,
    "policy_source_id" TEXT NOT NULL,
    "source_snapshot_id" TEXT NOT NULL,
    "extraction_candidate_id" TEXT,
    "version_number" INTEGER NOT NULL,
    "document_status" "DocumentStatus" NOT NULL,
    "policy_authority" "PolicyAuthority",
    "ai_service_status" "AiServiceStatus" NOT NULL,
    "service_treatment" "ServiceTreatment" NOT NULL,
    "ai_tools" TEXT[],
    "themes" TEXT[],
    "summary" TEXT,
    "diff_text" TEXT,
    "effective_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_decisions" (
    "id" TEXT NOT NULL,
    "university_id" TEXT NOT NULL,
    "policy_source_id" TEXT NOT NULL,
    "extraction_candidate_id" TEXT,
    "policy_version_id" TEXT,
    "decision" "ReviewDecisionType" NOT NULL,
    "reviewer" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "universities_slug_key" ON "universities"("slug");

-- CreateIndex
CREATE INDEX "policy_sources_document_status_idx" ON "policy_sources"("document_status");

-- CreateIndex
CREATE INDEX "policy_sources_last_checked_at_idx" ON "policy_sources"("last_checked_at");

-- CreateIndex
CREATE UNIQUE INDEX "policy_sources_university_id_url_key" ON "policy_sources"("university_id", "url");

-- CreateIndex
CREATE INDEX "source_snapshots_fetched_at_idx" ON "source_snapshots"("fetched_at");

-- CreateIndex
CREATE INDEX "source_snapshots_content_hash_idx" ON "source_snapshots"("content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "source_snapshots_policy_source_id_content_hash_key" ON "source_snapshots"("policy_source_id", "content_hash");

-- CreateIndex
CREATE INDEX "crawl_runs_status_idx" ON "crawl_runs"("status");

-- CreateIndex
CREATE INDEX "crawl_runs_started_at_idx" ON "crawl_runs"("started_at");

-- CreateIndex
CREATE INDEX "crawl_runs_policy_source_id_idx" ON "crawl_runs"("policy_source_id");

-- CreateIndex
CREATE INDEX "extraction_candidates_review_state_idx" ON "extraction_candidates"("review_state");

-- CreateIndex
CREATE INDEX "extraction_candidates_university_id_idx" ON "extraction_candidates"("university_id");

-- CreateIndex
CREATE INDEX "extraction_candidates_policy_source_id_idx" ON "extraction_candidates"("policy_source_id");

-- CreateIndex
CREATE UNIQUE INDEX "extraction_candidates_policy_source_id_source_snapshot_id_key" ON "extraction_candidates"("policy_source_id", "source_snapshot_id");

-- CreateIndex
CREATE INDEX "policy_versions_university_id_idx" ON "policy_versions"("university_id");

-- CreateIndex
CREATE INDEX "policy_versions_created_at_idx" ON "policy_versions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "policy_versions_policy_source_id_version_number_key" ON "policy_versions"("policy_source_id", "version_number");

-- CreateIndex
CREATE INDEX "review_decisions_decision_idx" ON "review_decisions"("decision");

-- CreateIndex
CREATE INDEX "review_decisions_created_at_idx" ON "review_decisions"("created_at");

-- AddForeignKey
ALTER TABLE "policy_sources" ADD CONSTRAINT "policy_sources_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_snapshots" ADD CONSTRAINT "source_snapshots_crawl_run_id_fkey" FOREIGN KEY ("crawl_run_id") REFERENCES "crawl_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_snapshots" ADD CONSTRAINT "source_snapshots_policy_source_id_fkey" FOREIGN KEY ("policy_source_id") REFERENCES "policy_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crawl_runs" ADD CONSTRAINT "crawl_runs_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crawl_runs" ADD CONSTRAINT "crawl_runs_policy_source_id_fkey" FOREIGN KEY ("policy_source_id") REFERENCES "policy_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_candidates" ADD CONSTRAINT "extraction_candidates_crawl_run_id_fkey" FOREIGN KEY ("crawl_run_id") REFERENCES "crawl_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_candidates" ADD CONSTRAINT "extraction_candidates_policy_source_id_fkey" FOREIGN KEY ("policy_source_id") REFERENCES "policy_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_candidates" ADD CONSTRAINT "extraction_candidates_source_snapshot_id_fkey" FOREIGN KEY ("source_snapshot_id") REFERENCES "source_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_candidates" ADD CONSTRAINT "extraction_candidates_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_extraction_candidate_id_fkey" FOREIGN KEY ("extraction_candidate_id") REFERENCES "extraction_candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_policy_source_id_fkey" FOREIGN KEY ("policy_source_id") REFERENCES "policy_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_source_snapshot_id_fkey" FOREIGN KEY ("source_snapshot_id") REFERENCES "source_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_extraction_candidate_id_fkey" FOREIGN KEY ("extraction_candidate_id") REFERENCES "extraction_candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_policy_source_id_fkey" FOREIGN KEY ("policy_source_id") REFERENCES "policy_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "policy_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

