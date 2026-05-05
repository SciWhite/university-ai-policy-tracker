import { Module } from "@nestjs/common";
import { CatalogController } from "./catalog.controller.js";
import { HealthController } from "./health.controller.js";
import { IngestionController } from "./ingestion.controller.js";
import { PublicJsonController } from "./public-json.controller.js";

@Module({
  controllers: [
    CatalogController,
    HealthController,
    IngestionController,
    PublicJsonController
  ]
})
export class AppModule {}
