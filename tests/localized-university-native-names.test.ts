import assert from "node:assert/strict";
import test from "node:test";

import { generateMetadata as generateLocaleUniversityMetadata } from "../apps/web/app/[locale]/universities/[slug]/page";
import { generateMetadata as generateDefaultUniversityMetadata } from "../apps/web/app/(default)/universities/[slug]/page";
import { getInstitutionNativeName } from "../apps/web/lib/institution-localization";

test("getInstitutionNativeName resolves native names correctly", () => {
  // Japanese
  assert.equal(getInstitutionNativeName("u-tokyo", "ja"), "東京大学");
  assert.equal(getInstitutionNativeName("The University of Tokyo", "ja"), "東京大学");
  assert.equal(getInstitutionNativeName("University of Tokyo", "ja"), "東京大学");

  // Korean
  assert.equal(getInstitutionNativeName("snu", "ko"), "서울대학교");
  assert.equal(getInstitutionNativeName("Seoul National University", "ko"), "서울대학교");

  // German
  assert.equal(
    getInstitutionNativeName("technical-university-of-munich", "de"),
    "Technische Universität München"
  );
  assert.equal(
    getInstitutionNativeName("Technical University of Munich", "de"),
    "Technische Universität München"
  );

  // Traditional Chinese
  assert.equal(getInstitutionNativeName("cuhk", "zh-Hant"), "香港中文大學");
  assert.equal(
    getInstitutionNativeName("The Chinese University of Hong Kong", "zh-Hant"),
    "香港中文大學"
  );

  // Cross-country: Tokyo is in Japan, so it must return undefined in German
  assert.equal(getInstitutionNativeName("u-tokyo", "de"), undefined);
  assert.equal(getInstitutionNativeName("The University of Tokyo", "de"), undefined);

  // Munich is in Germany, so it must return undefined in Japanese
  assert.equal(
    getInstitutionNativeName("technical-university-of-munich", "ja"),
    undefined
  );

  // English always returns undefined
  assert.equal(getInstitutionNativeName("u-tokyo", "en"), undefined);
});

test("Japanese university page titles use official native names", async () => {
  process.env.UAPT_V6_PUBLISHED_PAGES = "0";
  const tokyoV6_0 = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "ja", slug: "u-tokyo" })
  });
  assert.equal(tokyoV6_0.title, "東京大学 AI方針 | University AI Policy Tracker");

  process.env.UAPT_V6_PUBLISHED_PAGES = "1";
  const tokyoV6_1 = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "ja", slug: "u-tokyo" })
  });
  assert.equal(tokyoV6_1.title, "東京大学 AI方針");

  const kyoto = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "ja", slug: "kyoto-university" })
  });
  assert.equal(kyoto.title, "京都大学 AI方針");
});

test("Korean university page titles use official native names", async () => {
  process.env.UAPT_V6_PUBLISHED_PAGES = "1";
  const snu = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "ko", slug: "snu" })
  });
  assert.equal(snu.title, "서울대학교 AI 정책");

  const korea = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "ko", slug: "korea-university" })
  });
  assert.equal(korea.title, "고려대학교 AI 정책");
});

test("German university page titles use official native names", async () => {
  process.env.UAPT_V6_PUBLISHED_PAGES = "1";
  const tum = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "de", slug: "technical-university-of-munich" })
  });
  assert.equal(tum.title, "Technische Universität München KI-Richtlinie");

  const rwth = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "de", slug: "rwth-aachen-university" })
  });
  assert.equal(rwth.title, "RWTH Aachen KI-Richtlinie");
});

test("Traditional Chinese university page titles use official native names", async () => {
  process.env.UAPT_V6_PUBLISHED_PAGES = "1";
  const cuhk = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "zh-Hant", slug: "cuhk" })
  });
  assert.equal(cuhk.title, "香港中文大學 AI 政策");

  const ntu = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "zh-Hant", slug: "national-taiwan-university" })
  });
  assert.equal(ntu.title, "國立臺灣大學 AI 政策");
});

test("Foreign universities stay English in other countries' reading locales", async () => {
  process.env.UAPT_V6_PUBLISHED_PAGES = "1";

  // Tokyo in German must remain English institution name
  const deTokyo = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "de", slug: "u-tokyo" })
  });
  assert.equal(deTokyo.title, "The University of Tokyo KI-Richtlinie");

  // Munich in Japanese must remain English institution name
  const jaTum = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "ja", slug: "technical-university-of-munich" })
  });
  assert.equal(jaTum.title, "Technical University of Munich AI方針");

  // Harvard in English stays unchanged
  const enHarvard = await generateDefaultUniversityMetadata({
    params: Promise.resolve({ slug: "harvard-university" })
  });
  assert.equal(enHarvard.title, "Harvard University AI Policy");
});

test("Diverse reading locales use verified native names for domestic universities", async () => {
  process.env.UAPT_V6_PUBLISHED_PAGES = "1";

  // Italian
  const sapienza = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "it", slug: "sapienza-university-of-rome" })
  });
  assert.ok(
    sapienza.title?.toString().startsWith("Sapienza Università di Roma"),
    `Expected Sapienza Università di Roma, got ${sapienza.title}`
  );

  // Portuguese (Brazil)
  const usp = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "pt", slug: "universidade-de-sao-paulo" })
  });
  assert.ok(
    usp.title?.toString().startsWith("Universidade de São Paulo"),
    `Expected Universidade de São Paulo, got ${usp.title}`
  );

  // Dutch (Netherlands)
  const tudelft = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "nl", slug: "delft-university-of-technology" })
  });
  assert.ok(
    tudelft.title?.toString().startsWith("Technische Universiteit Delft"),
    `Expected Technische Universiteit Delft, got ${tudelft.title}`
  );

  // Swedish (Sweden)
  const lund = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "sv", slug: "lund-university" })
  });
  assert.ok(
    lund.title?.toString().startsWith("Lunds universitet"),
    `Expected Lunds universitet, got ${lund.title}`
  );

  // Danish (Denmark)
  const cph = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "da", slug: "university-of-copenhagen" })
  });
  assert.ok(
    cph.title?.toString().startsWith("Københavns Universitet"),
    `Expected Københavns Universitet, got ${cph.title}`
  );

  // Finnish (Finland)
  const helsinki = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "fi", slug: "university-of-helsinki" })
  });
  assert.ok(
    helsinki.title?.toString().startsWith("Helsingin yliopisto"),
    `Expected Helsingin yliopisto, got ${helsinki.title}`
  );

  // Polish (Poland)
  const jagiellonian = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "pl", slug: "jagiellonian-university" })
  });
  assert.ok(
    jagiellonian.title?.toString().startsWith("Uniwersytet Jagielloński"),
    `Expected Uniwersytet Jagielloński, got ${jagiellonian.title}`
  );

  // Czech (Czechia)
  const charles = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "cs", slug: "charles-university" })
  });
  assert.ok(
    charles.title?.toString().startsWith("Univerzita Karlova"),
    `Expected Univerzita Karlova, got ${charles.title}`
  );

  // Turkish (Turkey)
  const metu = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "tr", slug: "middle-east-technical-university" })
  });
  assert.ok(
    metu.title?.toString().startsWith("Orta Doğu Teknik Üniversitesi"),
    `Expected Orta Doğu Teknik Üniversitesi, got ${metu.title}`
  );

  // Russian (Russia)
  const msu = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "ru", slug: "lomonosov-moscow-state-university" })
  });
  assert.ok(
    msu.title?.toString().startsWith("Московский государственный университет"),
    `Expected MSU in Russian, got ${msu.title}`
  );

  // Arabic (Saudi Arabia)
  const ksu = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "ar", slug: "king-saud-university" })
  });
  assert.ok(
    ksu.title?.toString().startsWith("جامعة الملك سعود"),
    `Expected KSU in Arabic, got ${ksu.title}`
  );

  // Thai (Thailand)
  const chula = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "th", slug: "chulalongkorn-university" })
  });
  assert.ok(
    chula.title?.toString().startsWith("จุฬาลงกรณ์มหาวิทยาลัย"),
    `Expected Chulalongkorn in Thai, got ${chula.title}`
  );

  // Vietnamese (Vietnam)
  const vnu = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "vi", slug: "vietnam-national-university-hanoi" })
  });
  assert.ok(
    vnu.title?.toString().startsWith("Đại học Quốc gia Hà Nội"),
    `Expected VNU in Vietnamese, got ${vnu.title}`
  );

  // Hungarian (Hungary)
  const elte = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "hu", slug: "eotvos-lorand-university" })
  });
  assert.ok(
    elte.title?.toString().startsWith("Eötvös Loránd Tudományegyetem"),
    `Expected ELTE in Hungarian, got ${elte.title}`
  );

  // Lithuanian (Lithuania)
  const vilnius = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "lt", slug: "vilnius-university" })
  });
  assert.ok(
    vilnius.title?.toString().startsWith("Vilniaus universitetas"),
    `Expected Vilnius in Lithuanian, got ${vilnius.title}`
  );
});
