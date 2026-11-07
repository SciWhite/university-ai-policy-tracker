// Next.js refuses a route that exports both `metadata` and `generateMetadata`;
// the type check does not catch it, only `next build` does (build 42345453097).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : /\.(tsx?|jsx?)$/.test(name) ? [full] : [];
  });
}

test("no route exports both metadata and generateMetadata", () => {
  const both = files("apps/web/app").filter((file) => {
    const source = readFileSync(file, "utf8");
    return /export\s+const\s+metadata\b/.test(source) && /export\s+(async\s+)?(function|const)\s+generateMetadata\b/.test(source);
  });
  assert.deepEqual(both, []);
});
