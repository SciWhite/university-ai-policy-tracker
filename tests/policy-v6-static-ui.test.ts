import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { READING_LOCALES } from "../apps/web/lib/language-catalog";
import { policyV6StaticUiText } from "../apps/web/lib/policy-v6-static-ui";
import { PolicyV6CompactGuide } from "../apps/web/components/policy-v6-compact-guide";
import { formatAcceptedReadingCount } from "../apps/web/components/policy-v6-topic-evidence";
import { getPolicyV6Data } from "../apps/web/lib/policy-v6";

const scope = { en: "Before submitting, check the course rule.", zh: "提交前请查看课程规则。" };
const guide = {
  slug: "massachusetts-institute-of-technology", recordSha256: "a".repeat(64), schoolFingerprint: "b".repeat(64),
  universityRevisionId: "revision", name: "Massachusetts Institute of Technology", scope,
  do: [], dont: [], procedures: { investigation: [], outcomes: [], appeal: [] }, claims: {}, images: [],
};

test("reviewed compact-guide labels cover all 33 reading locales and incorporate exact corrections", () => {
  assert.equal(READING_LOCALES.length, 33);
  for (const locale of READING_LOCALES) {
    const labels = policyV6StaticUiText(locale);
    if (locale === "en") continue;
    assert(labels["Site advice"], `${locale} Site advice`);
    assert(labels["Evidence ↗"], `${locale} evidence label`);
    assert(labels["Current status: held; historical review state"], `${locale} held status`);
  }
  assert.equal(policyV6StaticUiText("fr")["Site advice"], "Conseils du site");
  assert.match(policyV6StaticUiText("de")["The current evidence does not include a verified specific procedure or deadline. Check the applicable university rules."], /weder .*noch/);
  assert.deepEqual(policyV6StaticUiText("en"), {});
});

test("compact guide fallback notice follows accepted field coverage and target language", () => {
  const text = policyV6StaticUiText("fr");
  const readyGuide = { ...guide, scope: { en: "Vérifiez la règle du cours.", zh: scope.zh } };
  const localized = renderToStaticMarkup(React.createElement(PolicyV6CompactGuide, {
    guide: readyGuide, locale: "en", readingLocale: "fr", sharedUiText: text, studentGuideTranslated: true,
  }));
  assert(!localized.includes("Guidance is currently in English"));
  assert(localized.includes("Vérifiez la règle du cours."));
  assert(localized.includes('lang="fr"'));
  const fallback = renderToStaticMarkup(React.createElement(PolicyV6CompactGuide, {
    guide, locale: "en", readingLocale: "fr", sharedUiText: text, studentGuideTranslated: false,
  }));
  assert(fallback.includes('lang="en">Guidance is currently in English; original evidence retains its source language.'));
});

test("accepted reader count templates retain locale word order above the old fixed count range", () => {
  assert.equal(formatAcceptedReadingCount("{0} sources · Aller à une source", 26, "26 sources"), "26 sources · Aller à une source");
  assert.equal(formatAcceptedReadingCount("由 {0} 筆主張紀錄引用", 24, "24 claim records"), "由 24 筆主張紀錄引用");
});

test("unconfigured legacy zh V6 fallback still renders its existing Chinese guide copy", async () => {
  const previous = process.env.UAPT_V6_PUBLISHED_PAGES;
  process.env.UAPT_V6_PUBLISHED_PAGES = "1";
  const data = await getPolicyV6Data("zh", "massachusetts-institute-of-technology");
  if (previous === undefined) delete process.env.UAPT_V6_PUBLISHED_PAGES; else process.env.UAPT_V6_PUBLISHED_PAGES = previous;
  assert.equal(data.locale, "zh");
  assert(data.studentActions, "The existing Chinese V6 guide should remain available as a fallback.");
  const html = renderToStaticMarkup(React.createElement(PolicyV6CompactGuide, {
    guide: data.studentActions, locale: "zh", readingLocale: "zh", studentGuideTranslated: false,
  }));
  assert(html.includes("提交前快速检查"));
  assert(html.includes("建议做"));
  assert(html.includes("应避免"));
});
