import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";

// CLI env loading is explicit in Prisma 7. Existing process env wins.
config({ path: [fileURLToPath(new URL(".env", import.meta.url)), fileURLToPath(new URL("../../.env", import.meta.url))], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  // A direct migration connection may differ from the pooled runtime connection.
  // Generation deliberately works without database credentials.
  datasource: { url: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL }
});
