import { Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import {
  getPublicApiIndexResponse,
  getPublicUniversitySummaryResponseBySlug,
  listPublicRecentChangesEnvelope,
  listPublicUniversitiesResponse
} from "@uapt/db";

@Controller("api/public/v1")
export class PublicJsonController {
  @Get("index.json")
  getIndexJson() {
    return getPublicApiIndexResponse();
  }

  @Get("universities.json")
  async getUniversitiesJson(@Query("limit") limit?: string) {
    const parsedLimit = limit ? Number(limit) : undefined;

    return listPublicUniversitiesResponse(
      Number.isFinite(parsedLimit) && parsedLimit ? parsedLimit : undefined
    );
  }

  @Get("universities/:slug.json")
  async getUniversityJson(@Param("slug") slug: string) {
    const summary = await getPublicUniversitySummaryResponseBySlug(slug);

    if (!summary) {
      throw new NotFoundException(`University not found: ${slug}`);
    }

    return summary;
  }

  @Get("recent-changes.json")
  async getRecentChanges(@Query("limit") limit?: string) {
    const parsedLimit = limit ? Number(limit) : undefined;

    return listPublicRecentChangesEnvelope(
      Number.isFinite(parsedLimit) && parsedLimit ? parsedLimit : undefined
    );
  }
}
