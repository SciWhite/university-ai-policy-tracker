ALTER TABLE "analytics_events"
ADD COLUMN "source_category" TEXT,
ADD COLUMN "source_name" TEXT,
ADD COLUMN "referrer_domain" TEXT,
ADD COLUMN "landing_path" TEXT,
ADD COLUMN "utm_source" TEXT,
ADD COLUMN "utm_medium" TEXT,
ADD COLUMN "utm_campaign" TEXT,
ADD COLUMN "utm_term" TEXT,
ADD COLUMN "utm_content" TEXT;

CREATE INDEX "analytics_events_source_category_created_at_idx" ON "analytics_events"("source_category", "created_at");
CREATE INDEX "analytics_events_source_name_created_at_idx" ON "analytics_events"("source_name", "created_at");
CREATE INDEX "analytics_events_referrer_domain_created_at_idx" ON "analytics_events"("referrer_domain", "created_at");
