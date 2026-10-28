import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, utimes, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { getBingAiPerformanceSnapshot } from "../apps/web/lib/bing-ai-performance";
import { withBingAiWindow } from "../apps/web/lib/analytics-window";

test("independent export metadata cannot make an old core snapshot current", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "uapt-bing-provenance-"));
  const previous = process.env.BING_AI_PERFORMANCE_SNAPSHOT_DIR;
  process.env.BING_AI_PERFORMANCE_SNAPSHOT_DIR = directory;
  const overview = "Date,Citations,Cited Pages\n10/23/2026 12:00:00 AM,107,19\n";
  try {
    const files = { "overview.csv": overview, "pages.csv": "Page,Citations\nhttps://eduaipolicy.org/pl/universities/purdue-university,15\n", "queries.csv": "Grounding Query,Intent,Topic,Citations,Citation Share\nAI policy,informational,Education,15,20%\n", "topic-portfolio.csv": "Topic,Volume Range,Queries Range,Sites Range\nEducation,10-20,1-5,1-5\n" };
    for (const [file, csv] of Object.entries(files)) {
      await writeFile(path.join(directory, file), csv);
      const modified = file === "topic-portfolio.csv" ? new Date("2026-10-28T12:00:00Z") : new Date("2026-10-24T12:00:00Z");
      await utimes(path.join(directory, file), modified, modified);
    }
    const snapshot = await getBingAiPerformanceSnapshot();
    assert.equal(snapshot.available, true);
    assert.equal(snapshot.importedAt, "2026-10-24T12:00:00.000Z");
    assert.equal(snapshot.coverageEnd, "2026-10-23");
    assert.equal(snapshot.tables?.overview?.sha256, createHash("sha256").update(overview).digest("hex"));
    assert.equal(snapshot.tables?.pages?.coverage, "unspecified_export_period");
    assert.equal(snapshot.tables?.pages?.coverageEnd, undefined);
    assert.equal(snapshot.tables?.topics?.modifiedAt, "2026-10-28T12:00:00.000Z");
    const window = withBingAiWindow(snapshot, "2026-10-23", "2026-10-27");
    assert.equal(window.window?.citations, null);
    assert.equal(window.window?.missingDays, 4);
    assert.equal(window.pageRows[0]?.citations, 15);
  } finally {
    if (previous === undefined) delete process.env.BING_AI_PERFORMANCE_SNAPSHOT_DIR;
    else process.env.BING_AI_PERFORMANCE_SNAPSHOT_DIR = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
