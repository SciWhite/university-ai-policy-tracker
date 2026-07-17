declare module "@prisma/client" {
  export class PrismaClient {
    [key: string]: any;
    constructor(...args: any[]);
    $connect(): Promise<void>;
    $disconnect(): Promise<void>;
    $on(...args: any[]): void;
    $transaction<T>(callback: (transaction: any) => Promise<T>): Promise<T>;
    $transaction(...args: any[]): any;
    $extends(...args: any[]): any;
  }

  export namespace Prisma {
    export type JsonPrimitive = string | number | boolean | null;
    export type JsonObject = { [key: string]: JsonValue };
    export type JsonArray = JsonValue[];
    export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
    export type InputJsonValue = Exclude<JsonPrimitive, null> | JsonObject | JsonArray;
  }

  export const AiServiceStatus: EnumValues<
    | "INSTITUTIONALLY_LICENSED_OR_PROCURED"
    | "THIRD_PARTY_SERVICE"
    | "SELF_HOSTED_SYSTEM"
    | "RESTRICTED_OR_PROHIBITED"
    | "NO_SPECIFIC_AI_SERVICE_NAMED"
  >;
  export type AiServiceStatus = EnumValue<typeof AiServiceStatus>;

  export const CanonicalEntityType: EnumValues<
    "UNIVERSITY" | "TOOL" | "REGION" | "THEME" | "COURSE"
  >;
  export type CanonicalEntityType = EnumValue<typeof CanonicalEntityType>;

  export const ClaimReviewState: EnumValues<
    "MACHINE_CANDIDATE" | "AGENT_REVIEWED" | "HUMAN_REVIEWED" | "NEEDS_REVIEW" | "REJECTED"
  >;
  export type ClaimReviewState = EnumValue<typeof ClaimReviewState>;

  export const CrawlStatus: EnumValues<
    "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "SKIPPED"
  >;
  export type CrawlStatus = EnumValue<typeof CrawlStatus>;

  export const DocumentStatus: EnumValues<
    "UNIVERSITY_WIDE_POLICY" | "SPECIFIC_UNIT_POLICY_OR_GUIDANCE" | "EXTERNAL_POLICY_OR_GUIDANCE" | "NO_POLICY" | "INACCESSIBLE"
  >;
  export type DocumentStatus = EnumValue<typeof DocumentStatus>;

  export const FetchMode: EnumValues<"HTTP" | "PLAYWRIGHT" | "OPENCLI" | "FIRECRAWL">;
  export type FetchMode = EnumValue<typeof FetchMode>;

  export const PolicyAuthority: EnumValues<
    | "UNIVERSITY_WIDE"
    | "FACULTY_OR_SCHOOL"
    | "DEPARTMENT"
    | "COURSE_LEVEL"
    | "IT_OR_SECURITY_OFFICE"
    | "LIBRARY"
    | "TEACHING_AND_LEARNING_CENTER"
    | "RESEARCH_OFFICE"
    | "PROCUREMENT_OR_LEGAL"
  >;
  export type PolicyAuthority = EnumValue<typeof PolicyAuthority>;

  export const ReviewState: EnumValues<
    "MACHINE_EXTRACTED" | "AGENT_REVIEWED" | "HUMAN_REVIEWED" | "NEEDS_REVIEW"
  >;
  export type ReviewState = EnumValue<typeof ReviewState>;

  export const ServiceTreatment: EnumValues<
    "ALLOWED" | "CONDITIONALLY_ALLOWED" | "RESTRICTED_OR_BLOCKED" | "NOT_MENTIONED"
  >;
  export type ServiceTreatment = EnumValue<typeof ServiceTreatment>;

  type EnumValues<T extends string> = { readonly [K in T]: K };
  type EnumValue<T> = T[keyof T];
}
