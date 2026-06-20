ALTER TABLE "analytics_events"
ADD COLUMN "country_code" TEXT,
ADD COLUMN "device_type" TEXT;

CREATE INDEX "analytics_events_country_code_created_at_idx" ON "analytics_events"("country_code", "created_at");
CREATE INDEX "analytics_events_device_type_created_at_idx" ON "analytics_events"("device_type", "created_at");
