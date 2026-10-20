import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import registry from "../apps/web/lib/university-marks-local.json";
import legacy from "../apps/web/lib/university-marks.json";
import { getLocalCompactMark, isLocalMarkFile, requiresLocalCompactGeometry } from "../apps/web/lib/local-university-marks";
import { GET } from "../apps/web/app/api/local/university-marks/[filename]/route";

test("local compact marks preserve native/role limits and remain unavailable in production", async () => {
  const prior = process.env.NODE_ENV;
  try {
    Object.assign(process.env, { NODE_ENV: "development" });
    for (const [slug, entry] of Object.entries(registry.entries)) {
      if (slug in legacy) assert.ok(entry.legacyGeometryCorrection, "only explicit geometry corrections override accepted display locally");
      assert.equal(entry.publicationApproved, false);
      assert.equal(entry.publicUseReviewRequired, true);
      const local = getLocalCompactMark(slug, "directory");
      assert.ok(local);
      assert.ok(local.displayWidth <= entry.width && local.displayHeight <= entry.height);
      assert.equal(getLocalCompactMark(slug, "hero"), undefined, "compact is not a title asset");
      assert.equal(getLocalCompactMark(slug, "chip"), undefined, "24px is below accepted size");
    }
    for (const slug of ["ecole-normale-superieure-de-lyon", "universidade-federal-de-sao-paulo"]) {
      assert.equal(getLocalCompactMark(slug, "small"), undefined);
      assert.equal(getLocalCompactMark(slug, "directory")?.displayWidth, 64);
    }
    for (const slug of ["bilkent-university", "birkbeck-university-london"]) {
      assert.ok(getLocalCompactMark(slug, "directory"));
      assert.ok(getLocalCompactMark(slug, "small"));
    }
    assert.equal(getLocalCompactMark("comenius-university-bratislava", "directory")?.backing, "dark");
    for (const slug of ["national-taiwan-normal-university-ntnu", "universidad-de-concepcion",
      "universidad-de-santiago-de-chile-usach", "university-of-naples-federico-ii",
      "university-of-science-and-technology-beijing"]) {
      assert.equal(getLocalCompactMark(slug, "directory")?.backing, "dark");
    }
    assert.ok(getLocalCompactMark("universitas-airlangga", "directory"));
    assert.ok(getLocalCompactMark("university-of-pavia", "directory"));
    const minnesota = getLocalCompactMark("university-of-minnesota", "directory");
    assert.ok(minnesota && minnesota.displayWidth >= 45);
    assert.equal(getLocalCompactMark("university-of-minnesota", "small"), undefined);
    assert.ok(getLocalCompactMark("sabanci-university", "directory")!.displayWidth >= 96);
    assert.equal(getLocalCompactMark("sabanci-university", "small"), undefined);
    assert.equal(requiresLocalCompactGeometry("sabanci-university"), true);
    const wollongong = getLocalCompactMark("university-of-wollongong", "directory")!;
    assert.ok(wollongong.displayWidth >= 40 && wollongong.displayHeight <= 56);
    assert.equal(wollongong.backing, "dark");
    assert.equal(getLocalCompactMark("university-of-wollongong", "small"), undefined);
    const file = Object.values(registry.entries)[0].file;
    const params = { params: Promise.resolve({ filename: file }) };
    const response = await GET(new Request(`http://127.0.0.1:3270/api/local/university-marks/${file}`), params);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/webp");
    assert.equal(createHash("sha256").update(new Uint8Array(await response.arrayBuffer())).digest("hex"), file.slice(0, -5));
    assert.equal(isLocalMarkFile("../../original.raw"), false);
    assert.equal(isLocalMarkFile("0".repeat(64) + ".webp"), false);
    assert.equal((await GET(new Request(`https://example.test/api/local/university-marks/${file}`), params)).status, 404);
    Object.assign(process.env, { NODE_ENV: "production" });
    assert.equal(getLocalCompactMark("american-university", "directory"), undefined);
    assert.equal(isLocalMarkFile(file), false);
    assert.equal(requiresLocalCompactGeometry("sabanci-university"), false);
    assert.equal((await GET(new Request(`http://127.0.0.1:3270/api/local/university-marks/${file}`), params)).status, 404);
  } finally {
    if (prior === undefined) delete process.env.NODE_ENV;
    else Object.assign(process.env, { NODE_ENV: prior });
  }
});
