import type { PrismaClient as PrismaClientType } from "@prisma/client";

export { PrismaClient } from "@prisma/client";

export namespace Prisma {
  export type JsonPrimitive = string | number | boolean | null;
  export type JsonObject = { [key: string]: JsonValue };
  export type JsonArray = JsonValue[];
  export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
  export type InputJsonValue = Exclude<JsonPrimitive, null> | JsonObject | JsonArray;
  export type PolicyClaimInclude = Record<string, unknown>;
  export type PolicyClaimGetPayload<T = unknown> = unknown;
  export type TransactionClient = PrismaClientType;
  export type UniversityInclude = Record<string, unknown>;
  export type UniversityGetPayload<T = unknown> = unknown;
}
