import assert from "node:assert/strict";
import test from "node:test";
import { READING_LOCALES } from "../apps/web/lib/language-catalog";
import { SUPPORTED_LOCALES } from "../apps/web/lib/i18n";
import * as baseRelease from "../apps/web/app/(default)/changes/[releaseId]/page";
import * as baseRecord from "../apps/web/app/(default)/changes/[releaseId]/[slug]/page";
import { generateStaticParams as localizedReleaseParams, dynamicParams as localizedReleaseDynamicParams } from "../apps/web/app/[locale]/changes/[releaseId]/page";
import { generateStaticParams as localizedRecordParams, dynamicParams as localizedRecordDynamicParams } from "../apps/web/app/[locale]/changes/[releaseId]/[slug]/page";

type FirstArg<F> = F extends (arg: infer A, ...rest: any[]) => any ? A : never;
type Assert<T extends true> = T;
type _ReleaseGenerateStaticParamsMatchesNext = Assert<FirstArg<typeof localizedReleaseParams> extends { params: any } ? true : false>;
type _RecordGenerateStaticParamsMatchesNext = Assert<FirstArg<typeof localizedRecordParams> extends { params: any } ? true : false>;

const oldLocalizedLocales = SUPPORTED_LOCALES.filter(locale => locale !== "en");
const newerLocales = READING_LOCALES.filter(locale => locale !== "en" && !SUPPORTED_LOCALES.includes(locale as typeof SUPPORTED_LOCALES[number]));

test("localized change wrappers prebuild only the six legacy locale sets and keep all other locales dynamic", async () => {
  assert.equal(oldLocalizedLocales.length, 6);
  assert.equal(newerLocales.length, 26);
  assert.equal(localizedReleaseDynamicParams, true);
  assert.equal(localizedRecordDynamicParams, true);

  const expectedReleaseParams = await baseRelease.generateStaticParams();
  const expectedRecordParams = await baseRecord.generateStaticParams();
  for (const locale of oldLocalizedLocales) {
    assert.deepEqual(await localizedReleaseParams({ params: { locale } }), expectedReleaseParams, `release page ${locale}`);
    assert.deepEqual(await localizedRecordParams({ params: { locale } }), expectedRecordParams, `record page ${locale}`);
  }
  for (const locale of newerLocales) {
    assert.deepEqual(await localizedReleaseParams({ params: { locale } }), [], `release page ${locale} is on-demand`);
    assert.deepEqual(await localizedRecordParams({ params: { locale } }), [], `record page ${locale} is on-demand`);
  }
  assert.deepEqual(await localizedReleaseParams({ params: { locale: "xx" } }), [], "unsupported locales must not be prebuilt");
  assert.deepEqual(await localizedRecordParams({ params: { locale: "xx" } }), [], "unsupported locales must not be prebuilt");
});
