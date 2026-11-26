import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PublicEntitySummary } from "@uapt/shared";
import { UniversityHomepageMark } from "../apps/web/components/university-homepage-mark";
import { validateOfficialHomepage, validateOfficialHomepages } from "../apps/web/lib/university-homepage";
import { validateHomepageInput, validateHomepageOnlyInput } from "../scripts/v6-pipeline/homepage";

const slug = "harvard-university";
const school = {
  entity: { slug, website: "https://it.harvard.edu/ai" },
  officialSources: [{ sourceUrl: "https://guides.harvard.edu/ai", official: true }, { sourceUrl: "https://unofficial.example.org/", official: false }],
} as PublicEntitySummary;
const officialHomepage = { url: "https://harvard.edu/en/home", checkedAt: "2026-11-26" };

test("header mark prefers package data, uses the registry for absent data, and leaves an unsafe mark unlinked", () => {
  const render = (homepage = undefined as typeof officialHomepage | undefined) =>
    renderToStaticMarkup(<UniversityHomepageMark slug={slug} name="Harvard University" officialHomepage={homepage} />);
  assert.match(render(officialHomepage), /href="https:\/\/harvard.edu\/en\/home"/);
  assert.match(render(), /href="https:\/\/www.harvard.edu\/"/);
  for (const url of ["http://harvard.edu", "//harvard.edu", "https:harvard.edu", "javascript:alert(1)", "https://user@harvard.edu", "https://eduaipolicy.org"]) {
    assert.doesNotMatch(render({ ...officialHomepage, url }), /<a /);
  }
  assert.doesNotMatch(renderToStaticMarkup(<UniversityHomepageMark slug="unlisted-school" name="Unlisted School" />), /<a /);
});

test("homepage validator binds the URL to the school's domain and limits its shape", () => {
  assert.deepEqual(validateOfficialHomepage(officialHomepage, slug, school), officialHomepage);
  assert.doesNotThrow(() => validateOfficialHomepage({ ...officialHomepage, url: "https://harvard.edu/index.html" }, slug, school));
  for (const url of [
    "http://harvard.edu", "/en", "https://user:password@harvard.edu/", "https://@harvard.edu/",
    "https://eduaipolicy.org/", "https://www.eduaipolicy.org/", "https://harvard.edu.attacker.example/",
    "https://another-university.edu/", "https://unofficial.example.org/", "https://harvard.edu/long/path/three",
    "https://harvard.edu/en?q=1", "https://harvard.edu/#home", "https://harvard.edu:8443/", "https://harvard.edu/../en",
  ]) assert.throws(() => validateOfficialHomepage({ ...officialHomepage, url }, slug, school), /invalid officialHomepage/, url);
  for (const checkedAt of [undefined, "", "not-a-date", "2026-02-30"]) {
    assert.throws(() => validateOfficialHomepage({ ...officialHomepage, checkedAt }, slug, school), /check date/);
  }
});

test("published homepage schema is additive and rejects malformed or out-of-scope entries", () => {
  assert.doesNotThrow(() => validateOfficialHomepages(undefined, [slug], [school]));
  assert.doesNotThrow(() => validateOfficialHomepages({ [slug]: officialHomepage }, [slug], [school]));
  assert.throws(() => validateOfficialHomepages({ outside: officialHomepage }, [slug], [school]), /outside V6 school scope/);
  assert.throws(() => validateOfficialHomepages({ [slug]: null }, [slug], [school]), /invalid officialHomepage/);
  assert.throws(() => validateOfficialHomepages([], [slug], [school]), /Invalid V6 officialHomepages map/);
});

test("add gate requires a valid homepage or an explicit gap", () => {
  const add = { mode: "add" } as const;
  assert.throws(() => validateHomepageInput({}, add, school), /officialHomepage required/);
  assert.throws(() => validateHomepageInput({ homepageGap: " " }, add, school), /homepageGap must explain/);
  assert.throws(() => validateHomepageInput({ officialHomepage, homepageGap: "Conflicting input" }, add, school), /either officialHomepage or homepageGap/);
  assert.throws(() => validateHomepageInput({ officialHomepage: { ...officialHomepage, url: "https://wrong.edu/" } }, add, school), /outside the school's recorded domains/);
  assert.equal(validateHomepageInput({ homepageGap: "The institutional domain could not be confirmed." }, add, school), undefined);
  assert.deepEqual(validateHomepageInput({ officialHomepage }, add, school), officialHomepage);
});

test("homepage-only update takes just the verified homepage and normal updates may omit it", () => {
  const update = { mode: "update" } as const;
  const homepageOnly = { ...update, homepageOnly: true } as const;
  assert.equal(validateHomepageInput({}, update, school), undefined);
  assert.throws(() => validateHomepageOnlyInput({}, homepageOnly, school), /officialHomepage required/);
  assert.deepEqual(validateHomepageOnlyInput({ officialHomepage }, homepageOnly, school), officialHomepage);
  assert.throws(() => validateHomepageOnlyInput({ officialHomepage, claims: [] }, homepageOnly, school), /may contain only officialHomepage/);
});
