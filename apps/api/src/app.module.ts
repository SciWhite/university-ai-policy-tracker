import { Module } from "@nestjs/common";
import { CatalogController } from "./catalog.controller.js";
import { HealthController } from "./health.controller.js";
import { IngestionController } from "./ingestion.controller.js";

@Module({
  controllers: [CatalogController, HealthController, IngestionController]
})
export class AppModule {}
