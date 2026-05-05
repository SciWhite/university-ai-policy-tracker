import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException
} from "@nestjs/common";
import {
  ingestCrawlRun,
  ingestExtractionCandidate,
  ingestSourceSnapshot
} from "@uapt/db";
import {
  crawlRunIngestPayloadSchema,
  extractionCandidateIngestPayloadSchema,
  sourceSnapshotIngestPayloadSchema
} from "@uapt/shared";
import { ZodError } from "zod";

@Controller("internal/ingest")
export class IngestionController {
  @Post("crawl-run")
  async createCrawlRun(
    @Body() body: unknown,
    @Headers("authorization") authorization?: string,
    @Headers("x-ingestion-token") tokenHeader?: string
  ) {
    assertIngestionAuthorized(authorization, tokenHeader);
    const payload = parseBody(crawlRunIngestPayloadSchema, body);

    try {
      return await ingestCrawlRun(payload);
    } catch (error) {
      throw new BadRequestException(getErrorMessage(error));
    }
  }

  @Post("source-snapshot")
  async createSourceSnapshot(
    @Body() body: unknown,
    @Headers("authorization") authorization?: string,
    @Headers("x-ingestion-token") tokenHeader?: string
  ) {
    assertIngestionAuthorized(authorization, tokenHeader);
    const payload = parseBody(sourceSnapshotIngestPayloadSchema, body);

    try {
      return await ingestSourceSnapshot(payload);
    } catch (error) {
      throw new BadRequestException(getErrorMessage(error));
    }
  }

  @Post("extraction-candidate")
  async createExtractionCandidate(
    @Body() body: unknown,
    @Headers("authorization") authorization?: string,
    @Headers("x-ingestion-token") tokenHeader?: string
  ) {
    assertIngestionAuthorized(authorization, tokenHeader);
    const payload = parseBody(extractionCandidateIngestPayloadSchema, body);

    try {
      return await ingestExtractionCandidate(payload);
    } catch (error) {
      throw new BadRequestException(getErrorMessage(error));
    }
  }
}

function assertIngestionAuthorized(
  authorization: string | undefined,
  tokenHeader: string | undefined
): void {
  const configuredToken = process.env.INGESTION_TOKEN;

  if (!configuredToken) {
    throw new UnauthorizedException("INGESTION_TOKEN is not configured");
  }

  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : undefined;

  if (tokenHeader !== configuredToken && bearerToken !== configuredToken) {
    throw new UnauthorizedException("Invalid ingestion token");
  }
}

function parseBody<T>(schema: { parse(value: unknown): T }, body: unknown): T {
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestException(error.issues);
    }

    throw error;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Invalid ingestion payload";
}
