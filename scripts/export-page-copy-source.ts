import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getPageCopy } from "../apps/web/lib/page-copy";

const formatterArguments: Record<string, string[]> = {
  "home.metadataTitle": ["{count}"],
  "universities.rankedRecords": ["{ranking}"],
  "universities.showing": ["{visible}", "{total}"],
  "universities.searchSummary": ["{query}"],
  "universities.rankingView": ["{ranking}"],
  "universities.rank": ["{ranking}"],
  "universities.candidateNotice": ["{count}"],
  "analysis.qualityStatus": ["{status}", "{count}"],
  "changes.timelineLead": ["{current}", "{previous}", "{sources}", "{records}"],
  "changes.summary": [
    "{name}",
    "{claims}",
    "{sources}",
    "{changedDate}",
    "{diffRows}",
    "{policy}",
    "{extracted}",
    "{snapshot}",
    "{sourceText}"
  ]
};

function serialize(value: unknown, currentPath = ""): unknown {
  if (typeof value === "function") {
    const args = formatterArguments[currentPath];
    if (!args) throw new Error(`Missing formatter arguments for ${currentPath}`);
    return value(...args);
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => serialize(item, `${currentPath}[${index}]`));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        serialize(child, currentPath ? `${currentPath}.${key}` : key)
      ])
    );
  }

  return value;
}

async function main() {
  const outputPath = path.resolve("apps/web/messages/pages/en.json");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify(serialize(getPageCopy("en")), null, 2)}\n`,
    "utf8"
  );
  console.log(outputPath);
}

void main();
