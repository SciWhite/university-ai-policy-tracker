import { Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import {
  getPublicUniversitySummaryBySlug,
  listPublicRecentChanges
} from "@uapt/db";

@Controller("api/public/v1")
export class PublicJsonController {
  @Get("universities/:slug.json")
  async getUniversityJson(@Param("slug") slug: string) {
    const summary = await getPublicUniversitySummaryBySlug(slug);

    if (!summary) {
      throw new NotFoundException(`University not found: ${slug}`);
    }

    return summary;
  }

  @Get("recent-changes.json")
  async getRecentChanges(@Query("limit") limit?: string) {
    const parsedLimit = limit ? Number(limit) : undefined;

    return listPublicRecentChanges(
      Number.isFinite(parsedLimit) && parsedLimit ? parsedLimit : undefined
    );
  }
}
