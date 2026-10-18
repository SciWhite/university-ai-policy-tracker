import assert from "node:assert/strict";
import test from "node:test";
import { uniqueSitemapEntries } from "../apps/web/lib/sitemap-entries";

test("duplicate school URLs retain the latest substantive timestamp and all distinct locales", () => {
  const earlier = new Date("2026-10-01T00:00:00Z");
  const latest = new Date("2026-10-16T00:00:00Z");
  const en = "https://eduaipolicy.org/universities/eth-zurich";
  const zh = "https://eduaipolicy.org/zh/universities/eth-zurich";
  const entries = [
    { url: en, lastModified: earlier },
    { url: zh, lastModified: earlier },
    { url: en, lastModified: latest },
    { url: en, lastModified: earlier }
  ];
  const output = uniqueSitemapEntries(entries);
  assert.deepEqual(output, [entries[2], entries[1]]);
  assert.equal(entries.length, 4);
  assert.equal(output[0].lastModified.toISOString(), "2026-10-16T00:00:00.000Z");
});
