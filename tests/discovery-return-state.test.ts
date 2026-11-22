import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { selectDiscoveryReturn } from "../apps/web/lib/discovery-return-state";

const now = Date.parse("2026-11-21T12:00:00Z");
const entry = (url: string, target: string, at = now - 60_000) => JSON.stringify({ url, target, at });

test("school links carry no returnTo: one cache key per page (audit 2026-11-21 phase 2.1)", () => {
  const dir = path.join(process.cwd(), "apps/web/components");
  for (const file of readdirSync(dir).filter(name => name.endsWith(".tsx"))) {
    assert.doesNotMatch(readFileSync(path.join(dir, file), "utf8"), /returnTo=\$\{/, file); // a link that builds ?returnTo=${...}
  }
});

test("the stored view is the back target only for the page it opened, and only for a while", () => {
  const stored = entry("/universities?q=oxford&page=2", "/de/universities/mit");
  assert.equal(selectDiscoveryReturn("/de/universities/mit", "", stored, now).href, "/universities?q=oxford&page=2");
  assert.equal(selectDiscoveryReturn("/universities/mit", "", stored, now).href, null);
  assert.equal(selectDiscoveryReturn("/de/universities/mit", "", entry("/universities", "/de/universities/mit", now - 7 * 3600_000), now).href, null);
  assert.equal(selectDiscoveryReturn("/de/universities/mit", "", "not json", now).href, null);
  assert.equal(selectDiscoveryReturn("/de/universities/mit", "", null, now).href, null);
});

test("old ?returnTo= links still work and are removed from the address bar", () => {
  const legacy = selectDiscoveryReturn("/universities/mit", "?returnTo=%2Frankings%2Fqs-2026%3Fpage%3D3&utm_source=x", null, now);
  assert.equal(legacy.href, "/rankings/qs-2026?page=3");
  assert.equal(legacy.legacy, "/rankings/qs-2026?page=3");
  assert.equal(legacy.cleanSearch, "?utm_source=x");
  // An unsafe value is dropped, never followed, and still removed from the URL.
  const unsafe = selectDiscoveryReturn("/universities/mit", "?returnTo=https%3A%2F%2Fevil.example%2F", entry("/universities", "/universities/mit"), now);
  assert.equal(unsafe.href, null);
  assert.equal(unsafe.cleanSearch, "");
  // The stored entry is never mixed with a legacy parameter.
  assert.equal(selectDiscoveryReturn("/universities/mit", "", entry("https://evil.example/", "/universities/mit"), now).href, null);
});
