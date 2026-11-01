import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PolicySupplements, policySupplementsAcceptedUiSources } from "../apps/web/components/policy-supplements";
import { getApprovedPolicySupplements } from "../apps/web/lib/policy-supplements";

test("supplement UI uses accepted locale labels without translating its policy summary or evidence", async () => {
  const slug = "universite-de-montreal";
  const [record] = getApprovedPolicySupplements(slug);
  assert(record);
  assert(policySupplementsAcceptedUiSources.includes("More policy information"));
  assert(policySupplementsAcceptedUiSources.includes("Published source-based additions"));
  const translations = {
    "More policy information": "Daha fazla politika bilgisi",
    "Published source-based additions": "Yayımlanmış kaynaklara dayalı eklemeler",
    "These tracker summaries are based on retained official-source material. Present applicability has not been independently confirmed. English summaries and original-language quotations are retained unless a checked Chinese summary is available.": "Bu izleyici özetleri saklanan resmî kaynak materyaline dayanmaktadır. Güncel uygulanabilirlik bağımsız olarak doğrulanmamıştır.",
    "Privacy and student work": "Gizlilik ve öğrenci çalışmaları",
  };
  const localized = await PolicySupplements({ slug, locale: "en", claims: [], sharedUiText: translations });
  assert(localized);
  const html = renderToStaticMarkup(localized);
  assert(html.includes("Daha fazla politika bilgisi"));
  assert(html.includes("Yayımlanmış kaynaklara dayalı eklemeler"));
  assert(html.includes("Bu izleyici özetleri saklanan resmî kaynak materyaline dayanmaktadır."));
  assert(html.includes("Gizlilik ve öğrenci çalışmaları"));
  assert(!html.includes(">More policy information<"));
  assert(!html.includes(">Published source-based additions<"));
  assert(html.includes(record.fact.statement.slice(0, 70)));
  assert.match(html, /data-i18n="preserve" lang="en">The teaching guidance says instructors/);
  assert(html.includes("data-i18n=\"preserve\""));
  assert.match(html, /<dd data-i18n="preserve" lang="en">faculty · university<\/dd>/);
  assert(html.includes(record.fact.evidence[0].quote));
  assert(html.includes('blockquote lang="fr"'));
  assert(html.includes("faculty · university"));

  const legacy = await PolicySupplements({ slug, locale: "fr", claims: [] });
  assert(legacy);
  const legacyHtml = renderToStaticMarkup(legacy);
  assert(legacyHtml.includes("Autres informations"));
  assert(legacyHtml.includes("Compléments fondés sur des sources publiés"));
});
