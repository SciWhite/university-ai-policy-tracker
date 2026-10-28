import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadSeoGeoReport } from "../apps/web/lib/seo-geo-reports";
import type { SeoGeoTool } from "../apps/web/lib/seo-geo-report-types";

/** Select a validated manifest; raw reports/config/HTML stay in the private root. */
async function main() {
  const [directory, input, kind] = process.argv.slice(2);
  const tools = { technical: "unlighthouse", geo: "geo-optimizer", citations: "elmo" } as const;
  if (!directory || !input || !Object.hasOwn(tools, kind ?? "") || path.dirname(input) !== "." || !/^[a-z]+\.json$/.test(input)) throw Error("Usage: tsx scripts/import-seo-geo-report.ts <private-root> <manifest.json> <technical|geo|citations>");
  const tool: SeoGeoTool = tools[kind as keyof typeof tools];
  const result = await loadSeoGeoReport(directory, input, tool);
  if (result.state !== "ready" && !(kind === "citations" && result.state === "not_run" && result.plan)) throw Error("Report rejected: " + result.state);
  const selected = path.join(directory, kind + ".json");
  const temporary = selected + ".tmp-" + process.pid;
  await writeFile(temporary, await readFile(path.join(directory, input)), { flag: "wx", mode: 0o600 });
  await rename(temporary, selected);
  console.log(JSON.stringify({ tool, state: result.state, runId: result.runId, pages: result.pages.length, failedPages: result.pages.filter(page => page.state === "failed").length, experiments: result.experiments.length }));
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Import failed"); process.exitCode = 1; });
