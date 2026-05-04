import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import {
  getCatalogUniversityBySlug,
  listCatalogSources,
  listCatalogTools,
  listCatalogUniversities
} from "@uapt/db";

@Controller()
export class CatalogController {
  @Get("universities")
  async listUniversities() {
    return listCatalogUniversities();
  }

  @Get("universities/:slug")
  async getUniversity(@Param("slug") slug: string) {
    const university = await getCatalogUniversityBySlug(slug);

    if (!university) {
      throw new NotFoundException(`University not found: ${slug}`);
    }

    return university;
  }

  @Get("tools")
  async listTools() {
    return listCatalogTools();
  }

  @Get("sources")
  async listSources() {
    return listCatalogSources();
  }
}
