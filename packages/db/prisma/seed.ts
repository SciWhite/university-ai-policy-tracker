import {
  disconnectPrismaClient,
  seedInitialCatalog
} from "../src/index.js";

async function main() {
  const result = await seedInitialCatalog();
  console.log(
    `Seeded ${result.universities} universities, ${result.sources} policy sources, and ${result.claims} public claims.`
  );
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrismaClient();
  });
