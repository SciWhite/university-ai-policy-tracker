import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readLimitedBytes, saveSourceEvidence } from "../scripts/lib/maintenance-source-evidence";

test("binary bytes survive capture and a truncated response stays explicitly partial", async () => {
  const result = await readLimitedBytes(new Response(new Uint8Array([0, 255, 1, 254, 2])), 3);
  assert.deepEqual([...result.bytes], [0, 255, 1]);
  assert.equal(result.truncated, true);
  const full = await readLimitedBytes(new Response(new Uint8Array([0, 255])), 20);
  assert.deepEqual([...full.bytes], [0, 255]);
  assert.equal(full.truncated, false);
});

test("source identities remain distinct and conflicting bytes cannot overwrite evidence", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "uapt-evidence-test-"));
  try {
    const bytes = Buffer.from([0, 255, 10]);
    const a = await saveSourceEvidence(root, "https://a.edu/policy", "http_decoded_entity", bytes, false);
    const b = await saveSourceEvidence(root, "https://b.edu/policy", "http_decoded_entity", bytes, false);
    assert.equal(a.sha256, b.sha256);
    assert.notEqual(a.path, b.path);
    assert.deepEqual(await readFile(path.join(root, a.path)), bytes);
    assert.equal((await stat(path.join(root, a.path))).mode & 0o777, 0o600);
    await saveSourceEvidence(root, "https://a.edu/policy", "http_decoded_entity", bytes, false);
    await writeFile(path.join(root, a.path), "corrupt");
    await assert.rejects(saveSourceEvidence(root, "https://a.edu/policy", "http_decoded_entity", bytes, false));
  } finally { await rm(root, { recursive: true, force: true }); }
});
