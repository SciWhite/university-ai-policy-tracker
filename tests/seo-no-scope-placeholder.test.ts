import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

import { getPolicyV6School } from "../apps/web/lib/policy-v6";

test("codebase does not contain placeholder 'Scope stated in the cited claims'", () => {
  const webDir = path.resolve(__dirname, "../apps/web");
  function searchDir(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file === "node_modules" || file === ".next") continue;
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        searchDir(fullPath);
      } else if (/\.(ts|tsx|js|json)$/.test(file)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        assert.ok(
          !content.includes("Scope stated in the cited claims"),
          `File ${fullPath} contains obsolete placeholder string 'Scope stated in the cited claims'`
        );
      }
    }
  }
  searchDir(webDir);
});

test("topic scope does not produce placeholder text for base-tier schools", async () => {
  // Test both en and zh for stanford-university (which uses record-derived V6 topics)
  const schoolEn = await getPolicyV6School("en", "stanford-university");
  assert.ok(schoolEn, "Expected stanford-university school record");
  for (const topic of schoolEn.topics) {
    assert.notEqual(
      topic.scope,
      "Scope stated in the cited claims",
      `Topic ${topic.key} produced placeholder 'Scope stated in the cited claims'`
    );
    if (topic.basisKind === "record_analysis") {
      assert.equal(
        topic.scope,
        "",
        `Topic ${topic.key} should have empty scope when basisKind is record_analysis`
      );
    }
  }

  const schoolZh = await getPolicyV6School("zh", "stanford-university");
  assert.ok(schoolZh, "Expected stanford-university school record in zh");
  for (const topic of schoolZh.topics) {
    assert.notEqual(
      topic.scope,
      "适用范围见引用主张",
      `Topic ${topic.key} produced placeholder '适用范围见引用主张'`
    );
    if (topic.basisKind === "record_analysis") {
      assert.equal(
        topic.scope,
        "",
        `Topic ${topic.key} should have empty scope in zh when basisKind is record_analysis`
      );
    }
  }
});
