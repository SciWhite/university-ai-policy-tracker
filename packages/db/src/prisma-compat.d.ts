import type { PrismaClient } from "@prisma/client";

declare module "@prisma/client" {
  export namespace Prisma {
    type InputJsonValue = unknown;
    type JsonValue = unknown;
    type PolicyClaimInclude = Record<string, unknown>;
    type PolicyClaimGetPayload<T = unknown> = unknown;
    type TransactionClient = PrismaClient;
    type UniversityInclude = Record<string, unknown>;
    type UniversityGetPayload<T = unknown> = unknown;
  }
}
