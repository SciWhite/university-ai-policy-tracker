import assert from "node:assert/strict";
import test from "node:test";
import { lostIndexLocales } from "../scripts/content-release/index-locales";

const row = (tier: string, ...locales: string[]) => ({ tier, locales });

test("a school that moves from base to full may not lose a language", () => {
  const parent = { a: row("base", "en", "zh"), b: row("full", "en", "zh", "fr"), c: row("base", "en", "zh") };
  assert.deepEqual(lostIndexLocales(parent, { a: row("full", "en"), b: row("full", "en", "zh"), c: row("full", "en", "zh", "de") }), { a: ["zh"], b: ["fr"] });
  assert.deepEqual(lostIndexLocales(parent, parent), {});
});

test("a removed school loses every language; an accepted loss needs a reason", () => {
  const parent = { a: row("full", "en", "zh") };
  assert.deepEqual(lostIndexLocales(parent, {}), { a: ["en", "zh"] });
  assert.deepEqual(lostIndexLocales(parent, { a: row("full", "en") }, { a: { zh: "held: wrong translation" } }), {});
  assert.deepEqual(lostIndexLocales(parent, { a: row("full", "en") }, { a: { zh: " " } }), { a: ["zh"] });
});
