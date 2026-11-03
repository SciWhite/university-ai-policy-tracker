import assert from "node:assert/strict";
import test from "node:test";
import { READING_LOCALES } from "../apps/web/lib/language-catalog";
import * as baseRelease from "../apps/web/app/(default)/changes/[releaseId]/page";
import * as baseRecord from "../apps/web/app/(default)/changes/[releaseId]/[slug]/page";
import { generateStaticParams as localizedReleaseParams, dynamicParams as localizedReleaseDynamicParams } from "../apps/web/app/[locale]/changes/[releaseId]/page";
import { generateStaticParams as localizedRecordParams, dynamicParams as localizedRecordDynamicParams } from "../apps/web/app/[locale]/changes/[releaseId]/[slug]/page";

type FirstArg<F> = F extends (arg: infer A, ...rest: any[]) => any ? A : never;
type Assert<T extends true> = T;
type _ReleaseGenerateStaticParamsMatchesNext = Assert<FirstArg<typeof localizedReleaseParams> extends { params: any } ? true : false>;
type _RecordGenerateStaticParamsMatchesNext = Assert<FirstArg<typeof localizedRecordParams> extends { params: any } ? true : false>;

test("change wrappers keep every reading locale on demand without expanding historical data at build time", async () => {
  assert.equal(localizedReleaseDynamicParams, true);
  assert.equal(localizedRecordDynamicParams, true);

  assert.equal(baseRelease.dynamicParams, true);
  assert.equal(baseRecord.dynamicParams, true);
  assert.deepEqual(await baseRelease.generateStaticParams(), []);
  assert.deepEqual(await baseRecord.generateStaticParams(), []);
  for (const locale of READING_LOCALES) {
    assert.deepEqual(await localizedReleaseParams({ params: { locale } }), [], `release page ${locale} is on-demand`);
    assert.deepEqual(await localizedRecordParams({ params: { locale } }), [], `record page ${locale} is on-demand`);
  }
  assert.deepEqual(await localizedReleaseParams({ params: { locale: "xx" } }), [], "unsupported locales must not be prebuilt");
  assert.deepEqual(await localizedRecordParams({ params: { locale: "xx" } }), [], "unsupported locales must not be prebuilt");
});
