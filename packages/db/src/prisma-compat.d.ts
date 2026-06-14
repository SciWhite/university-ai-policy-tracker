declare module "@prisma/client" {
  export class PrismaClient {
    [key: string]: any;
    constructor(...args: any[]);
    $connect(): Promise<void>;
    $disconnect(): Promise<void>;
    $on(...args: any[]): void;
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
}
