import { Module } from "@nestjs/common";
import { CatalogController } from "./catalog.controller.js";
import { HealthController } from "./health.controller.js";

@Module({
  controllers: [CatalogController, HealthController]
})
export class AppModule {}
