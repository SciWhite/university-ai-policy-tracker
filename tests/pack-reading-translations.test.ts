import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { READING_LOCALES } from "../apps/web/lib/language-catalog";
import { packReadingTranslations } from "../scripts/pack-reading-translations";
import { getReadingTranslations } from "../apps/web/lib/reading-translations";
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
test("a complete reviewed delivery becomes an isolated candidate with resolved immutable placeholders", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "uapt-reading-pack-"));
  const shared = "Synthetic shared copy", template = "{universityName} has {claimCount} records.", record = "b".repeat(64), evidence = "c".repeat(64);
  const source = { schemaVersion: "uapt-multilingual-source-v1", schools: [{ slug: "test-university", recordSha256: record, originalEvidenceSha256: evidence }], units: { [sha(shared)]: { source: shared, sourceSha256: sha(shared), uses: [{ slug: "_shared" }] }, [sha(template)]: { source: template, sourceSha256: sha(template), uses: [{ slug: "test-university", source: "Test University has 3 records.", sourceSha256: sha("Test University has 3 records."), substitutions: { universityName: "Test University", claimCount: "3" } }] } } };
  const sourceBytes = JSON.stringify(source), sourceSha = sha(sourceBytes);
  const accepted = { status: "accepted", receipt: { path: "", sha256: "" }, strings: { [sha(shared)]: "Synthetic accepted shared fixture", [sha(template)]: "Synthetic {universityName}: {claimCount} records." } };
  const delivery = { schemaVersion: "uapt-reviewed-translation-delivery-v1", sourceSha256: sourceSha, locales: Object.fromEntries(READING_LOCALES.filter(l => l !== "en").map(locale => [locale, structuredClone(accepted)])) };
  try {
    await writeFile(path.join(root, "source.json"), sourceBytes);
    for (const [locale, value] of Object.entries(delivery.locales)) {
      const receipt = JSON.stringify({ schemaVersion: "uapt-translation-review-receipt-v1", locale, sourceSha256: sourceSha, status: "accepted", translationsSha256: sha(JSON.stringify(value.strings)), checkedSourceHashes: Object.keys(source.units), remainingSourceHashes: [] });
      value.receipt = { path: `review-${locale}.json`, sha256: sha(receipt) };
      await writeFile(path.join(root, value.receipt.path), receipt);
    }
    await writeFile(path.join(root, "delivery.json"), JSON.stringify(delivery));
    const output = path.join(root, "candidate");
    const result = await packReadingTranslations(path.join(root, "source.json"), sourceSha, path.join(root, "delivery.json"), output);
    assert.equal(result.readingLocales, 33); assert.equal(result.translatedLocales, 32); assert.equal(result.publicationApproved, false);
    const school = JSON.parse(await readFile(path.join(output, "ar/test-university.json"), "utf8"));
    assert.equal(Object.values(school.strings as Record<string, { translation: string }>)[0].translation, "Synthetic Test University: 3 records.");
    assert.equal((await getReadingTranslations("test-university", "ar", { recordSha256: record, originalEvidenceSha256: evidence }, path.join(output, "candidate.json"))).state, "unapproved");
    await writeFile(path.join(root, "review-ar.json"), "{}");
    await assert.rejects(packReadingTranslations(path.join(root, "source.json"), sourceSha, path.join(root, "delivery.json"), path.join(root, "tampered")), /receipt bytes changed/);
    await assert.rejects(stat(path.join(root, "tampered")), { code: "ENOENT" });
    delete delivery.locales.ar; await writeFile(path.join(root, "delivery.json"), JSON.stringify(delivery));
    await assert.rejects(packReadingTranslations(path.join(root, "source.json"), sourceSha, path.join(root, "delivery.json"), path.join(root, "missing")), /Missing accepted delivery: ar/);
    await assert.rejects(stat(path.join(root, "missing")), { code: "ENOENT" });
  } finally { await rm(root, { recursive: true, force: true }); }
});
