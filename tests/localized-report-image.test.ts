import assert from "node:assert/strict";
import test from "node:test";
import { createLocalizedReportImage } from "../apps/web/components/localized-report-opengraph";

// Consume the image body: constructing ImageResponse alone misses stream errors.
for (const locale of ["zh", "fr", "pl", "es", "nl", "ms"] as const) {
  test(`localized monthly image produces a complete PNG: ${locale}`, async () => {
    const response = createLocalizedReportImage(locale, "2026-05");
    assert.equal(response.headers.get("content-type"), "image/png");
    const png = Buffer.from(await response.arrayBuffer());
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png.readUInt32BE(16), 1200);
    assert.equal(png.readUInt32BE(20), 630);
    assert.equal(png.subarray(-8, -4).toString(), "IEND");
  });
}
