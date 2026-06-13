CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'client',
    "pathname" TEXT NOT NULL,
    "visitor_id" TEXT,
    "session_id" TEXT,
    "locale" TEXT,
    "page_type" TEXT,
    "entity_slug" TEXT,
    "query_kind" TEXT,
    "query_length_bucket" TEXT,
    "result_rank" INTEGER,
    "result_source" TEXT,
    "endpoint_kind" TEXT,
    "target_kind" TEXT,
    "source_domain" TEXT,
    "nav_area" TEXT,
    "footer_group" TEXT,
    "example_key" TEXT,
    "copy_target" TEXT,
    "from_locale" TEXT,
    "to_locale" TEXT,
    "from_theme" TEXT,
    "to_theme" TEXT,
    "limit_bucket" TEXT,
    "result_count_bucket" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "analytics_events_event_name_created_at_idx" ON "analytics_events"("event_name", "created_at");
CREATE INDEX "analytics_events_pathname_created_at_idx" ON "analytics_events"("pathname", "created_at");
CREATE INDEX "analytics_events_visitor_id_created_at_idx" ON "analytics_events"("visitor_id", "created_at");
CREATE INDEX "analytics_events_session_id_created_at_idx" ON "analytics_events"("session_id", "created_at");
CREATE INDEX "analytics_events_entity_slug_created_at_idx" ON "analytics_events"("entity_slug", "created_at");
CREATE INDEX "analytics_events_page_type_created_at_idx" ON "analytics_events"("page_type", "created_at");
CREATE INDEX "analytics_events_source_created_at_idx" ON "analytics_events"("source", "created_at");
