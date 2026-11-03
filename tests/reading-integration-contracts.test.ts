import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  acceptedReadingUiText,
  getReadingTranslations,
  getReadingSharedUiText,
  readingDisplayView,
  readingSummaryBasis,
  readingTranslationCacheStats,
  verifiedV6ReadingBasis,
  validateReadingTranslationBundle,
  type ReadingTranslationBundle,
  type ReadingTranslationSelection,
} from "../apps/web/lib/reading-translations";
import { READING_LOCALES, isReadingLocale, matchReadingLocale, preferredReadingLocale, readingDirection } from "../apps/web/lib/language-catalog";
import { getReadingLocaleFromPathname, legacyLocale, localizeHref, normalizeReadingLocale } from "../apps/web/lib/i18n";
import { packAcceptedMatrixCandidate } from "../scripts/pack-reading-translations";
import { localEvidenceDisplayRequirements, policySceneDisplaySources, readingDisplayRequirementsComplete, universityReadingIndexLocales } from "../apps/web/lib/university-reading-metadata";
import { getPublicUniversitySummaryBySlug } from "../apps/web/lib/catalog";

const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

function makeBundle(slug: string, source: string, translation: string): ReadingTranslationBundle {
  const sourceSha256 = "a".repeat(64);
  const sourceHash = sha(source);
  return {
    schemaVersion: "uapt-reading-translations-v1",
    sourceSha256,
    locale: "ar",
    slug,
    recordSha256: "b".repeat(64),
    originalEvidenceSha256: "c".repeat(64),
    review: { status: "accepted", receiptSha256: "d".repeat(64) },
    protectedClaimIds: [],
    requiredSourceHashes: [sourceHash],
    strings: { [sourceHash]: { source, sourceSha256: sourceHash, translation } },
  };
}

async function packageFixture(root: string, options: { sampled?: boolean; slug?: string; recordSha256?: string; originalEvidenceSha256?: string } = {}) {
  const source = "Policy overview";
  const slug = options.slug ?? "ucl";
  const shared = makeBundle("_shared", source, "ملخص السياسة");
  const school = makeBundle(slug, source, "ملخص السياسة");
  school.sourceFieldUses = { [sha(source)]: ["/public/summary"] };
  if (options.recordSha256) school.recordSha256 = options.recordSha256;
  if (options.originalEvidenceSha256) school.originalEvidenceSha256 = options.originalEvidenceSha256;
  const put = async (name: string, value: unknown) => {
    const bytes = `${JSON.stringify(value)}\n`;
    await writeFile(path.join(root, name), bytes);
    return { path: name, sha256: sha(bytes) };
  };
  const samplingAcceptance = {
    schemaVersion: "uapt-translation-sampling-acceptance-v1",
    sourceSha256: school.sourceSha256,
    matrixSha256: "e".repeat(64),
    acceptanceSha256: "f".repeat(64),
    targetPairs: 538624,
    randomConfirmationSize: 120,
    confirmedErrorsBeforeCorrection: 1,
    oneSidedUpperBound: 0.04,
    fullCorpusSemanticReview: false as const,
    nativeSpeakerApproval: false as const,
    ...(options.sampled ? { packageAdjustmentSha256: "" } : {}),
  };
  const selection: ReadingTranslationSelection = {
    schemaVersion: "uapt-reading-selection-v1",
    revision: "contract-test",
    sourceSha256: school.sourceSha256,
    publicationApproved: options.sampled ? false : true,
    ...(options.sampled ? { candidateOnly: true as const, samplingAcceptance } : {}),
    shared: { ar: await put("shared.json", shared) },
    schools: { [slug]: { ar: await put("school.json", school) } },
  };
  if (selection.samplingAcceptance) {
    selection.samplingAcceptance.packageAdjustmentSha256 = sha(JSON.stringify({ statusEnumExceptions: [], urlBoundaryRepairs: [] }));
  }
  const selectionRef = await put("selection.json", selection);
  await writeFile(path.join(root, "candidate.json"), `${JSON.stringify(selectionRef)}\n`);
  return { selection, selectionRef, pointer: path.join(root, "candidate.json"), basis: { recordSha256: school.recordSha256, originalEvidenceSha256: school.originalEvidenceSha256 } };
}

test("concurrent reading and shell requests share bounded verified package work", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "uapt-reading-cache-"));
  try {
    const fixture = await packageFixture(root);
    const before = readingTranslationCacheStats();
    const results = await Promise.all(Array.from({ length: 16 }, () =>
      getReadingTranslations("ucl", "ar", fixture.basis, fixture.pointer)));
    const first = results[0];
    assert.equal(first.state, "ready");
    if (first.state !== "ready") return;
    for (const result of results) {
      assert.equal(result.state, "ready");
      if (result.state !== "ready") continue;
      assert.equal(result.shared, first.shared);
      assert.equal(result.school, first.school);
    }
    assert.equal(Object.isFrozen(first.school.strings), true);
    assert.equal(readingDisplayRequirementsComplete([{ source: "Policy overview", field: "/public/summary" }], first.school, first.shared), true);
    assert.equal(readingDisplayRequirementsComplete([{ source: "Policy overview", field: "/public/summary" }], first.school, first.shared), true);
    assert.equal(readingDisplayRequirementsComplete([{ source: "Policy overview", field: "/public/claims/claim-unknown/claimText" }], first.school, first.shared), false);
    const after = readingTranslationCacheStats();
    assert.equal(after.artifactReads - before.artifactReads, 3, "one selection and two bundle reads, even for concurrent callers");
    assert.equal(after.bundleValidations - before.bundleValidations, 2);
    assert.deepEqual(await getReadingSharedUiText("ar", ["Policy overview"], fixture.pointer), { "Policy overview": "ملخص السياسة" });
    const warm = readingTranslationCacheStats();
    assert.equal(warm.artifactReads, after.artifactReads);
    assert.equal(warm.bundleValidations, after.bundleValidations);
    assert(warm.artifacts.bytes <= warm.artifacts.maxBytes);
    assert(warm.artifacts.entries <= warm.artifacts.maxEntries);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a warm package rejects same-size tampering with restored mtime and accepts repaired bytes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "uapt-reading-cache-tamper-"));
  try {
    const fixture = await packageFixture(root);
    assert.equal((await getReadingTranslations("ucl", "ar", fixture.basis, fixture.pointer)).state, "ready");
    const schoolPath = path.join(root, "school.json");
    const original = await readFile(schoolPath, "utf8");
    const info = await stat(schoolPath);
    const changed = original.replace("ملخص", "ملخض");
    assert.notEqual(changed, original);
    assert.equal(Buffer.byteLength(changed), Buffer.byteLength(original));
    await writeFile(schoolPath, changed);
    await utimes(schoolPath, info.atime, info.mtime);
    assert.equal((await getReadingTranslations("ucl", "ar", fixture.basis, fixture.pointer)).state, "invalid_package");
    await writeFile(schoolPath, original);
    await utimes(schoolPath, info.atime, info.mtime);
    assert.equal((await getReadingTranslations("ucl", "ar", fixture.basis, fixture.pointer)).state, "ready");
    assert.equal((await getReadingTranslations("ucl", "ar", { ...fixture.basis, recordSha256: "e".repeat(64) }, fixture.pointer)).state, "stale_record");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("shallow-frozen caller objects cannot seed a cached field-coverage decision", () => {
  const source = "Policy overview";
  const shared = makeBundle("_shared", source, "ملخص السياسة");
  const school = makeBundle("ucl", source, "ملخص السياسة");
  const key = sha(source);
  school.sourceFieldUses = { [key]: ["/public/summary"] };
  for (const bundle of [shared, school]) {
    Object.freeze(bundle.strings);
    Object.freeze(bundle.sourceFieldUses);
    Object.freeze(bundle);
  }
  const allowed = [{ source, field: "/public/summary" }];
  assert.equal(readingDisplayRequirementsComplete(allowed, school, shared), true);
  assert.equal(readingDisplayRequirementsComplete(allowed, school, shared), true);
  assert.equal(readingDisplayRequirementsComplete(allowed, school, shared, false), false);
  assert.equal(readingDisplayRequirementsComplete([{ source, field: "/v6/studentActions/claims/claim-a/text" }], school, shared), false);
  assert.equal(readingDisplayRequirementsComplete(allowed, school, shared), true);
  school.sourceFieldUses![key].splice(0, 1);
  assert.equal(readingDisplayRequirementsComplete(allowed, school, shared), false);
});

test("index eligibility rechecks replaced policy bytes and approval hash after a warm decision", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "uapt-reading-index-cache-"));
  const env = ["UAPT_READING_PACKAGE_POINTER", "UAPT_UNIVERSITY_LOCALE_INDEX_POLICY", "UAPT_UNIVERSITY_LOCALE_INDEX_POLICY_SHA256"] as const;
  const saved = Object.fromEntries(env.map(key => [key, process.env[key]]));
  try {
    const slug = "synthetic-university";
    const fixture = await packageFixture(root, { slug });
    const policyPath = path.join(root, "index-policy.json");
    const policy = {
      schemaVersion: "uapt-university-locale-index-policy-v1", sourceSha256: fixture.selection.sourceSha256,
      schools: { [slug]: { recordSha256: fixture.basis.recordSha256, locales: ["en", "ar"], evidence: [] } }, globalCitationExceptions: {},
    };
    const raw = JSON.stringify(policy);
    await writeFile(policyPath, raw);
    process.env.UAPT_READING_PACKAGE_POINTER = fixture.pointer;
    process.env.UAPT_UNIVERSITY_LOCALE_INDEX_POLICY = policyPath;
    process.env.UAPT_UNIVERSITY_LOCALE_INDEX_POLICY_SHA256 = sha(raw);
    const summary = { entity: { slug }, claims: [] } as unknown as NonNullable<Parameters<typeof universityReadingIndexLocales>[2]>;
    const before = readingTranslationCacheStats();
    assert.deepEqual(await universityReadingIndexLocales(slug, fixture.basis, summary, "fr"), ["en"]);
    assert.equal(readingTranslationCacheStats().artifactReads, before.artifactReads, "a disallowed locale does not load other language bundles");
    assert.deepEqual(await universityReadingIndexLocales(slug, fixture.basis, summary), ["en", "ar"]);
    assert.deepEqual(await universityReadingIndexLocales(slug, fixture.basis, summary, "ar"), ["en", "ar"]);
    const info = await stat(policyPath);
    await writeFile(policyPath, raw.replace('"ar"', '"fr"'));
    await utimes(policyPath, info.atime, info.mtime);
    assert.deepEqual(await universityReadingIndexLocales(slug, fixture.basis, summary), ["en"]);
    await writeFile(policyPath, raw);
    assert.deepEqual(await universityReadingIndexLocales(slug, fixture.basis, summary), ["en", "ar"]);
    process.env.UAPT_UNIVERSITY_LOCALE_INDEX_POLICY_SHA256 = "0".repeat(64);
    assert.deepEqual(await universityReadingIndexLocales(slug, fixture.basis, summary), ["en"]);
  } finally {
    for (const key of env) saved[key] === undefined ? delete process.env[key] : process.env[key] = saved[key]!;
    await rm(root, { recursive: true, force: true });
  }
});

test("sampled candidate requires development mode plus both exact acceptance and selection pins", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "uapt-reading-contract-"));
  const saved = { nodeEnv: process.env.NODE_ENV, acceptance: process.env.UAPT_LOCAL_READING_CANDIDATE_ACCEPTANCE_SHA256, selection: process.env.UAPT_LOCAL_READING_CANDIDATE_SELECTION_SHA256 };
  try {
    const fixture = await packageFixture(root, { sampled: true });
    process.env.UAPT_LOCAL_READING_CANDIDATE_ACCEPTANCE_SHA256 = fixture.selection.samplingAcceptance!.acceptanceSha256;
    process.env.UAPT_LOCAL_READING_CANDIDATE_SELECTION_SHA256 = fixture.selectionRef.sha256;

    process.env.NODE_ENV = "development";
    assert.equal((await getReadingTranslations("ucl", "ar", fixture.basis, fixture.pointer)).state, "ready");

    process.env.NODE_ENV = "production";
    assert.equal((await getReadingTranslations("ucl", "ar", fixture.basis, fixture.pointer)).state, "unapproved");

    process.env.NODE_ENV = "development";
    process.env.UAPT_LOCAL_READING_CANDIDATE_ACCEPTANCE_SHA256 = "0".repeat(64);
    assert.equal((await getReadingTranslations("ucl", "ar", fixture.basis, fixture.pointer)).state, "unapproved");
    process.env.UAPT_LOCAL_READING_CANDIDATE_ACCEPTANCE_SHA256 = fixture.selection.samplingAcceptance!.acceptanceSha256;
    process.env.UAPT_LOCAL_READING_CANDIDATE_SELECTION_SHA256 = "1".repeat(64);
    assert.equal((await getReadingTranslations("ucl", "ar", fixture.basis, fixture.pointer)).state, "unapproved");

    // Even a correctly re-pinned candidate cannot upgrade a sample into a
    // full-corpus review or native-speaker approval claim.
    const selectionPath = path.join(root, "selection.json");
    const sampling = fixture.selection.samplingAcceptance as unknown as { fullCorpusSemanticReview: boolean; nativeSpeakerApproval: boolean };
    const rewriteSelection = async () => {
      const bytes = `${JSON.stringify(fixture.selection, null, 2)}\n`;
      await writeFile(selectionPath, bytes);
      const ref = { path: "selection.json", sha256: sha(bytes) };
      await writeFile(fixture.pointer, `${JSON.stringify(ref)}\n`);
      process.env.UAPT_LOCAL_READING_CANDIDATE_SELECTION_SHA256 = ref.sha256;
    };
    sampling.fullCorpusSemanticReview = true;
    await rewriteSelection();
    assert.equal((await getReadingTranslations("ucl", "ar", fixture.basis, fixture.pointer)).state, "unapproved");
    sampling.fullCorpusSemanticReview = false;
    sampling.nativeSpeakerApproval = true;
    await rewriteSelection();
    assert.equal((await getReadingTranslations("ucl", "ar", fixture.basis, fixture.pointer)).state, "unapproved");
  } finally {
    if (saved.nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = saved.nodeEnv;
    if (saved.acceptance === undefined) delete process.env.UAPT_LOCAL_READING_CANDIDATE_ACCEPTANCE_SHA256; else process.env.UAPT_LOCAL_READING_CANDIDATE_ACCEPTANCE_SHA256 = saved.acceptance;
    if (saved.selection === undefined) delete process.env.UAPT_LOCAL_READING_CANDIDATE_SELECTION_SHA256; else process.env.UAPT_LOCAL_READING_CANDIDATE_SELECTION_SHA256 = saved.selection;
    await rm(root, { recursive: true, force: true });
  }
});

test("production sampled approval is pinned to selected bytes and still requires exact raw record basis", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "uapt-reading-production-pin-"));
  const env = ["NODE_ENV", "UAPT_READING_PACKAGE_POINTER", "UAPT_READING_SAMPLED_PUBLICATION_ACCEPTANCE_SHA256", "UAPT_READING_SAMPLED_PUBLICATION_SELECTION_SHA256", "NEXT_PUBLIC_SITE_URL"] as const;
  const saved = Object.fromEntries(env.map(key => [key, process.env[key]]));
  try {
    const fixture = await packageFixture(root, { sampled: true });
    const selection = fixture.selection;
    selection.publicationApproved = true;
    delete selection.candidateOnly;
    selection.sampledPublicationAcceptance = {
      schemaVersion: "uapt-reviewed-sampled-translation-publication-v1",
      status: "approved",
      sourceSha256: selection.sourceSha256,
      matrixSha256: selection.samplingAcceptance!.matrixSha256,
      acceptanceSha256: selection.samplingAcceptance!.acceptanceSha256,
      packageAdjustmentSha256: selection.samplingAcceptance!.packageAdjustmentSha256!,
      targetPairs: selection.samplingAcceptance!.targetPairs,
      publicationApproved: true,
    };
    const writeSelection = async () => {
      const raw = `${JSON.stringify(selection)}\n`;
      await writeFile(path.join(root, "selection.json"), raw);
      const ref = { path: "selection.json", sha256: sha(raw) };
      await writeFile(fixture.pointer, `${JSON.stringify(ref)}\n`);
      fixture.selectionRef.sha256 = ref.sha256;
      return ref.sha256;
    };
    const selectedSha = await writeSelection();
    process.env.NODE_ENV = "production";
    process.env.UAPT_READING_PACKAGE_POINTER = fixture.pointer;
    process.env.UAPT_READING_SAMPLED_PUBLICATION_ACCEPTANCE_SHA256 = selection.samplingAcceptance!.acceptanceSha256;
    process.env.UAPT_READING_SAMPLED_PUBLICATION_SELECTION_SHA256 = selectedSha;
    process.env.NEXT_PUBLIC_SITE_URL = "https://eduaipolicy.org";
    assert.equal((await getReadingTranslations("ucl", "ar", fixture.basis, fixture.pointer)).state, "ready");

    const site = "https://eduaipolicy.org";
    const summary = {
      entity: { slug: "ucl", canonicalUrl: `${site}/universities/ucl` },
      canonicalUrl: `${site}/universities/ucl`, publicPageUrl: `${site}/universities/ucl`,
      apiUrl: `${site}/api/public/v1/universities/ucl.json`, suggestedCitation: `Policy record ${site}/universities/ucl`, claims: [],
    } as Parameters<typeof readingSummaryBasis>[0];
    assert.equal(readingSummaryBasis(summary).recordSha256, sha(JSON.stringify(summary)));

    // An old acceptance hash cannot authorize a rewritten sampled selection,
    // even when its changed marker exception is internally self-consistent.
    const exceptionText = "Allowed conditionally.";
    const target = "condition: conditionally_allowed";
    const marker = { locale: "ar" as const, sourceSha256: sha(exceptionText), targetSha256: sha(target), marker: "conditionally_allowed" };
    selection.samplingAcceptance!.statusEnumExceptions = [marker];
    selection.samplingAcceptance!.packageAdjustmentSha256 = sha(JSON.stringify({ statusEnumExceptions: [marker], urlBoundaryRepairs: [] }));
    selection.sampledPublicationAcceptance!.packageAdjustmentSha256 = selection.samplingAcceptance!.packageAdjustmentSha256;
    await writeSelection();
    assert.equal((await getReadingTranslations("ucl", "ar", fixture.basis, fixture.pointer)).state, "unapproved");
    assert.equal(readingSummaryBasis(summary).recordSha256, sha(JSON.stringify(summary)));

    // Legacy approved selections keep raw record hashing even if sampled env
    // pins happen to be present.
    delete selection.samplingAcceptance;
    delete selection.sampledPublicationAcceptance;
    const legacySha = await writeSelection();
    process.env.UAPT_READING_SAMPLED_PUBLICATION_SELECTION_SHA256 = legacySha;
    assert.equal(readingSummaryBasis(summary).recordSha256, sha(JSON.stringify(summary)));
  } finally {
    for (const key of env) saved[key] === undefined ? delete process.env[key] : process.env[key] = saved[key]!;
    await rm(root, { recursive: true, force: true });
  }
});

test("published V6 reading uses the exact verified V6 summary basis, not API metadata serialization", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "uapt-v6-reading-basis-"));
  const saved = { nodeEnv: process.env.NODE_ENV, pointer: process.env.UAPT_READING_PACKAGE_POINTER };
  try {
    const summary = {
      entity: { slug: "ucl", canonicalUrl: "https://eduaipolicy.org/universities/ucl", name: "UCL" },
      canonicalUrl: "https://eduaipolicy.org/universities/ucl",
      publicPageUrl: "https://eduaipolicy.org/universities/ucl",
      apiUrl: "https://eduaipolicy.org/api/public/v1/universities/ucl.json",
      suggestedCitation: "Policy record https://eduaipolicy.org/universities/ucl",
      claims: [{ id: "claim-ucl-001", claimText: "Course guidance applies.", evidence: [{ id: "evidence-1", quote: "Source quote", sourceLanguage: "en", sourceUrl: "https://ucl.example/policy" }] }],
    } as Parameters<typeof readingSummaryBasis>[0];
    const expectedRecord = sha(JSON.stringify(summary));
    const expectedEvidence = readingSummaryBasis(summary).originalEvidenceSha256;
    const fixture = await packageFixture(root, { recordSha256: expectedRecord, originalEvidenceSha256: expectedEvidence });
    process.env.NODE_ENV = "production";
    process.env.UAPT_READING_PACKAGE_POINTER = fixture.pointer;

    const v6Basis = verifiedV6ReadingBasis(summary, expectedRecord);
    assert.deepEqual(v6Basis, { recordSha256: expectedRecord, originalEvidenceSha256: expectedEvidence });
    assert.equal((await getReadingTranslations("ucl", "ar", v6Basis!)).state, "ready");

    // The canonical API can serialize the same policy claims with different
    // record metadata or property order. It must stay stale against the V6 pin.
    const apiMetadataVariant = { ...summary, sourceRights: { status: "available" } } as typeof summary;
    assert.equal(verifiedV6ReadingBasis(apiMetadataVariant, expectedRecord), undefined);
    assert.equal((await getReadingTranslations("ucl", "ar", readingSummaryBasis(apiMetadataVariant))).state, "stale_record");
    const reordered = {
      claims: summary.claims,
      suggestedCitation: summary.suggestedCitation,
      apiUrl: summary.apiUrl,
      publicPageUrl: summary.publicPageUrl,
      canonicalUrl: summary.canonicalUrl,
      entity: summary.entity,
    } as typeof summary;
    assert.equal(verifiedV6ReadingBasis(reordered, expectedRecord), undefined);

    const changedRecord = { ...summary, claims: summary.claims.map(claim => ({ ...claim, claimText: "Changed V6 policy text." })) } as typeof summary;
    assert.equal(verifiedV6ReadingBasis(changedRecord, expectedRecord), undefined);
    const changedEvidence = { ...summary, claims: summary.claims.map(claim => ({ ...claim, evidence: [...claim.evidence, { id: "evidence-2", quote: "New evidence", sourceLanguage: "en", sourceUrl: "https://ucl.example/other" }] })) } as typeof summary;
    assert.equal(verifiedV6ReadingBasis(changedEvidence, expectedRecord), undefined);
    assert.equal((await getReadingTranslations("ucl", "ar", readingSummaryBasis(changedEvidence))).state, "stale_record");
  } finally {
    saved.nodeEnv === undefined ? delete process.env.NODE_ENV : process.env.NODE_ENV = saved.nodeEnv;
    saved.pointer === undefined ? delete process.env.UAPT_READING_PACKAGE_POINTER : process.env.UAPT_READING_PACKAGE_POINTER = saved.pointer;
    await rm(root, { recursive: true, force: true });
  }
});

test("candidate artifact references cannot escape the immutable package directory", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "uapt-reading-path-"));
  try {
    const outside = path.join(path.dirname(root), `${path.basename(root)}-outside.json`);
    await writeFile(outside, "{}\n");
    const selection = { path: "../" + path.basename(outside), sha256: sha(await readFile(outside)) };
    const bytes = `${JSON.stringify(selection)}\n`;
    const pointer = path.join(root, "candidate.json");
    await writeFile(pointer, JSON.stringify({ path: "selection.json", sha256: sha(bytes) }));
    await writeFile(path.join(root, "selection.json"), bytes);
    assert.equal((await getReadingTranslations("ucl", "ar", { recordSha256: "b".repeat(64), originalEvidenceSha256: "c".repeat(64) }, pointer)).state, "invalid_package");
    await rm(outside, { force: true });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("sampled acceptance stays explicitly non-full-review and hash-bound marker exceptions are narrow", () => {
  const source = "Derived status: conditionally allowed.";
  const translation = "الحالة: conditionally_allowed.";
  const value = makeBundle("ucl", source, translation);
  const marker = { locale: "ar" as const, sourceSha256: sha(source), targetSha256: sha(translation), marker: "conditionally_allowed" };
  assert.throws(() => validateReadingTranslationBundle(value, { sourceSha256: value.sourceSha256, locale: "ar", slug: "ucl" }), /added protected marker/);
  assert.doesNotThrow(() => validateReadingTranslationBundle(value, { sourceSha256: value.sourceSha256, locale: "ar", slug: "ucl" }, { statusEnumExceptions: [marker] }));
  for (const exception of [
    { ...marker, targetSha256: "0".repeat(64) },
    { ...marker, sourceSha256: "1".repeat(64) },
    { ...marker, locale: "fr" as const },
  ]) {
    assert.throws(() => validateReadingTranslationBundle(value, { sourceSha256: value.sourceSha256, locale: "ar", slug: "ucl" }, { statusEnumExceptions: [exception] }), /added protected marker/);
  }
  for (const injected of [
    "الحالة: conditionally_allowed https://attacker.example/path",
    "الحالة: conditionally_allowed {inventedField}",
    `الحالة: conditionally_allowed ${"a".repeat(64)}`,
  ]) {
    const invalid = makeBundle("ucl", source, injected);
    assert.throws(() => validateReadingTranslationBundle(invalid, { sourceSha256: invalid.sourceSha256, locale: "ar", slug: "ucl" }, { statusEnumExceptions: [marker] }), /protected/);
  }
  const sourceWithClaim = "Derived status: conditionally allowed; claim-ucl-001.";
  const claimBundle = makeBundle("ucl", sourceWithClaim, "الحالة: conditionally_allowed; claim-ucl-999.");
  claimBundle.protectedClaimIds = ["claim-ucl-001"];
  assert.throws(() => validateReadingTranslationBundle(claimBundle, { sourceSha256: claimBundle.sourceSha256, locale: "ar", slug: "ucl" }, { statusEnumExceptions: [{ ...marker, sourceSha256: sha(sourceWithClaim), targetSha256: sha(claimBundle.strings[sha(sourceWithClaim)].translation) }] }), /protected Claim ID/);

  const changedNumber = makeBundle("ucl", "The rule applies for 30 days.", "تطبق القاعدة لمدة 31 days.");
  assert.throws(() => validateReadingTranslationBundle(changedNumber, { sourceSha256: changedNumber.sourceSha256, locale: "ar", slug: "ucl" }, { matchAcceptedBrandVocabulary: true }), /numeric facts/);
});

test("accepted UI labels use only exact accepted source strings and preserve absent English fallback", () => {
  const bundle = makeBundle("_shared", "Reading details", "تفاصيل القراءة");
  assert.deepEqual(acceptedReadingUiText(["Reading details", "Not reviewed", "Reading details"], [bundle]), {
    "Reading details": "تفاصيل القراءة",
  });
  assert.deepEqual(acceptedReadingUiText(["Reading details", "Original evidence"], []), {});
  // A hash collision alone is insufficient if the stored source text differs.
  const corrupt = structuredClone(bundle);
  const key = Object.keys(corrupt.strings)[0];
  corrupt.strings[key].source = "Other label";
  assert.deepEqual(acceptedReadingUiText(["Reading details"], [corrupt]), {});
});

test("same record is incomplete when an applicable V6 display field lacks an exact source-field binding", () => {
  const source = "Follow the school and course AI rule.";
  const translation = "Suis les règles d’IA de l’école et du cours.";
  const school = makeBundle("ucl", source, translation);
  const shared = makeBundle("_shared", source, translation);
  const requirement = [{ source, field: "/v6/view/hero/actions/do/0/en" }];
  school.sourceFieldUses = { [sha(source)]: ["/v6/view/hero/actions/do/0/zh"] };
  assert.equal(readingDisplayRequirementsComplete(requirement, school, shared), false);
  school.sourceFieldUses[sha(source)] = requirement[0] ? [requirement[0].field] : [];
  assert.equal(readingDisplayRequirementsComplete(requirement, school, shared), true);
});

test("student-guide projection aliases only the identical canonical Claim text field", () => {
  const source = "The reviewed claim text is reused verbatim in the student guide.";
  const school = makeBundle("ucl", source, "Le texte vérifié est réutilisé à l’identique dans le guide étudiant.");
  const shared = makeBundle("_shared", "Shared", "Partagé");
  const requirement = [{ source, field: "/v6/studentActions/claims/claim-ucl-001/text", fieldAliases: ["/public/claims/claim-ucl-001/claimText"] }];
  school.sourceFieldUses = { [sha(source)]: ["/public/claims/claim-ucl-001/claimText"] };
  assert.equal(readingDisplayRequirementsComplete(requirement, school, shared), true);
  school.sourceFieldUses[sha(source)] = ["/public/claims/claim-ucl-002/claimText"];
  assert.equal(readingDisplayRequirementsComplete(requirement, school, shared), false);
});

test("evidence-only V6 inputs inventory public display fields, preserve source evidence, and fail closed outside published scope", () => {
  const evidence = {
    record: { summary: "Reviewed summary.", claims: [{ id: "claim-ucl-001", claimText: "Reviewed claim." }] },
    tools: [{ description: "Tool display description.", howToObtain: "Request access.", costToUser: "No charge.", evidence: [{ quote: "Original quotation.", title: "Source title.", url: "https://example.edu/policy" }] }],
    dimensions: [], additionalDimensions: [], hmsTools: [{ name: "Tool name", originalTableRow: "Original table row" }],
  } as unknown as import("../apps/web/lib/policy-v6-local-evidence").LocalV6Evidence;
  const requirements = localEvidenceDisplayRequirements(evidence);
  assert.deepEqual(requirements.map(row => row.field).sort(), ["/public/claims/claim-ucl-001/claimText", "/public/summary", "/tools/0/costToUser", "/tools/0/description", "/tools/0/howToObtain"].sort());
  assert.equal(requirements.some(row => /Original quotation|Source title|Original table row|Tool name/.test(row.source)), false);
  const school = makeBundle("ucl", "Reviewed summary.", "Résumé vérifié.");
  for (const requirement of requirements) {
    const hash = sha(requirement.source);
    school.strings[hash] = { source: requirement.source, sourceSha256: hash, translation: `Traduction ${requirement.field}` };
    school.sourceFieldUses ??= {};
    school.sourceFieldUses[hash] = [requirement.field];
  }
  school.requiredSourceHashes = Object.keys(school.strings);
  const shared = makeBundle("_shared", "Shared", "Partagé");
  assert.equal(readingDisplayRequirementsComplete(requirements, school, shared, true), true);
  assert.equal(readingDisplayRequirementsComplete(requirements, school, shared, false), false);
  const tableRowHash = sha("Original table row");
  school.strings[tableRowHash] = { source: "Original table row", sourceSha256: tableRowHash, translation: "Ligne de tableau originale" };
  school.requiredSourceHashes = Object.keys(school.strings);
  const display = readingDisplayView(evidence, { state: "ready", revision: "synthetic", school, shared }, "fr");
  assert.equal(display.hmsTools[0].originalTableRow, "Original table row");
  assert.equal(display.tools[0].evidence[0].quote, "Original quotation.");
});

test("the root shell receives only exact allowlisted shared strings from the locally pinned candidate", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "uapt-reading-shell-"));
  const saved = { nodeEnv: process.env.NODE_ENV, acceptance: process.env.UAPT_LOCAL_READING_CANDIDATE_ACCEPTANCE_SHA256, selection: process.env.UAPT_LOCAL_READING_CANDIDATE_SELECTION_SHA256 };
  try {
    const fixture = await packageFixture(root, { sampled: true });
    process.env.NODE_ENV = "development";
    process.env.UAPT_LOCAL_READING_CANDIDATE_ACCEPTANCE_SHA256 = fixture.selection.samplingAcceptance!.acceptanceSha256;
    process.env.UAPT_LOCAL_READING_CANDIDATE_SELECTION_SHA256 = fixture.selectionRef.sha256;
    assert.deepEqual(await getReadingSharedUiText("ar", ["Policy overview", "Untranslated shell fallback"], fixture.pointer), { "Policy overview": "ملخص السياسة" });
    process.env.NODE_ENV = "production";
    assert.deepEqual(await getReadingSharedUiText("ar", ["Policy overview"], fixture.pointer), {});
  } finally {
    if (saved.nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = saved.nodeEnv;
    if (saved.acceptance === undefined) delete process.env.UAPT_LOCAL_READING_CANDIDATE_ACCEPTANCE_SHA256; else process.env.UAPT_LOCAL_READING_CANDIDATE_ACCEPTANCE_SHA256 = saved.acceptance;
    if (saved.selection === undefined) delete process.env.UAPT_LOCAL_READING_CANDIDATE_SELECTION_SHA256; else process.env.UAPT_LOCAL_READING_CANDIDATE_SELECTION_SHA256 = saved.selection;
    await rm(root, { recursive: true, force: true });
  }
});

test("all reading locales route distinctly while legacy UI remains seven-locale and RTL-aware", () => {
  assert.equal(READING_LOCALES.length, 33);
  for (const locale of READING_LOCALES) {
    assert.equal(isReadingLocale(locale), true);
    assert.equal(normalizeReadingLocale(locale), locale);
    assert.equal(getReadingLocaleFromPathname(`/${locale}/universities/ucl`), locale);
    assert.equal(localizeHref("/universities/ucl", locale), locale === "en" ? "/universities/ucl" : `/${locale}/universities/ucl`);
  }
  assert.equal(matchReadingLocale("zh_TW"), "zh-Hant");
  assert.equal(normalizeReadingLocale("zh-Hant-TW"), "zh-Hant");
  assert.equal(localizeHref("/zh-Hant/universities/ucl", "zh-Hant"), "/zh-Hant/universities/ucl");
  assert.equal(legacyLocale("zh-Hant"), "en");
  assert.equal(legacyLocale("fr"), "fr");
  assert.equal(preferredReadingLocale(["xx-YY", "he-IL"]), "he");
  assert.equal(readingDirection("ar"), "rtl");
  assert.equal(readingDirection("fa"), "rtl");
  assert.equal(readingDirection("zh-Hant"), "ltr");
});

test("published V6 scene index requirements exclude hidden legacy copy but keep visible source updates strict", async () => {
  const previous = process.env.UAPT_V6_PUBLISHED_PAGES;
  process.env.UAPT_V6_PUBLISHED_PAGES = "1";
  try {
    const bristol = await getPublicUniversitySummaryBySlug("university-of-bristol");
    assert(bristol);
    const bristolRequirements = policySceneDisplaySources("university-of-bristol", bristol);
    assert(bristolRequirements.length > 0);
    assert(bristolRequirements.every(row => row.field === "scene/sourceUpdate/text"));
    const source = bristolRequirements[0]!.source;
    const school = makeBundle("university-of-bristol", source, "approved translation");
    const shared = makeBundle("_shared", "Shared UI", "Translated shared UI");
    assert.equal(readingDisplayRequirementsComplete(bristolRequirements, school, shared), false,
      "a sourceUpdate translation without its exact field binding must block completeness");
    school.sourceFieldUses = { [sha(source)]: ["scene/sourceUpdate/text"] };
    assert.equal(readingDisplayRequirementsComplete(bristolRequirements, school, shared), true);

    const aalto = await getPublicUniversitySummaryBySlug("aalto-university");
    assert(aalto);
    const aaltoRequirements = policySceneDisplaySources("aalto-university", aalto);
    assert.equal(aaltoRequirements.some(row => row.field !== "scene/sourceUpdate/text"), false,
      "published V6 must not require legacy hero/quick-guide/gallery copy hidden by the active renderer");

    const nonPublished = await getPublicUniversitySummaryBySlug("university-of-aberdeen");
    assert(nonPublished);
    const nonPublishedRequirements = policySceneDisplaySources("university-of-aberdeen", nonPublished);
    assert(nonPublishedRequirements.length > 0);
    assert(nonPublishedRequirements.some(row => row.field !== "scene/sourceUpdate/text"),
      "non-published V6 slugs retain the existing legacy scene requirements");
  } finally {
    if (previous === undefined) delete process.env.UAPT_V6_PUBLISHED_PAGES;
    else process.env.UAPT_V6_PUBLISHED_PAGES = previous;
  }
});

test("accepted matrix packaging binds output labels to frozen insertion-order source maps", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "uapt-reading-matrix-contract-"));
  const output = path.join(root, "candidate");
  const sources = ["Source Alpha", "Source Beta"];
  const ids = sources.map(sha);
  const source = {
    schemaVersion: "uapt-multilingual-source-v1",
    schools: [{ slug: "ucl", recordSha256: "b".repeat(64), originalEvidenceSha256: "c".repeat(64), publicClaimIds: [] }],
    units: Object.fromEntries(sources.map((text, index) => [ids[index], { source: text, sourceSha256: ids[index], uses: [{ slug: "_shared" }, { slug: "ucl" }] }])),
  };
  const sourceBytes = Buffer.from(JSON.stringify(source));
  const sourceSha256 = sha(sourceBytes);
  const translated = ["Target Alpha", "Target Beta"];
  const matrix = {
    schemaVersion: "uapt-repaired-translation-matrix-v1",
    sourceSha256,
    schools: 1,
    sourceStrings: 2,
    targetLocales: 32,
    batches: 32,
    fields: 64,
    missingPairs: 0,
    fieldValidation: "PASS",
    rows: [] as { locale: (typeof READING_LOCALES)[number]; batch: string; path: string; sha256: string; fields: number }[],
    semanticAcceptance: { wholeCorpusSemanticReview: false, randomConfirmationSize: 120, confirmedErrorsBeforeCorrection: 1, oneSided975UpperBound: 0.04, confirmationRulePassed: true, nativeSpeakerApproval: false },
    publicationApproved: false,
  };
  const writeRow = async (locale: (typeof READING_LOCALES)[number], candidate: Record<string, string>, inputIds = { u0: ids[0], u1: ids[1] }, inputStrings = { u0: sources[0], u1: sources[1] }) => {
    const directory = path.join(root, "candidates", locale, "batch-0000");
    await import("node:fs/promises").then(fs => fs.mkdir(directory, { recursive: true }));
    const candidateBytes = Buffer.from(JSON.stringify(candidate));
    const candidatePath = path.join(directory, "final.json");
    await writeFile(candidatePath, candidateBytes);
    const input = { locale, sourceSha256, sourceIds: inputIds, strings: inputStrings };
    await writeFile(path.join(directory, "input.json"), JSON.stringify(input));
    return { locale, batch: "batch-0000", path: candidatePath, sha256: sha(candidateBytes), fields: 2 };
  };
  const matrixPath = path.join(root, "matrix.json");
  const acceptancePath = path.join(root, "acceptance.json");
  const acceptance: Record<string, unknown> = {
    status: "COMPLETE_CANDIDATE_COVERAGE_AND_SAMPLING_ACCEPTED",
    sourceSha256,
    finalMatrixSha256: "",
    publicationApproved: false,
    wholeCorpusFullMachineSemanticReview: false,
    schools: 1,
    sourceStrings: 2,
    targetLocales: 32,
    targetPairs: 64,
    finalConfirmation: { sampleSize: 120, confirmedErrorsBeforeCorrection: 1, upperBound: 0.04 },
  };
  const persistPinnedEvidence = async () => {
    const matrixBytes = Buffer.from(JSON.stringify(matrix));
    const matrixSha256 = sha(matrixBytes);
    acceptance.finalMatrixSha256 = matrixSha256;
    const acceptanceBytes = Buffer.from(JSON.stringify(acceptance));
    await writeFile(matrixPath, matrixBytes);
    await writeFile(acceptancePath, acceptanceBytes);
    return { matrixSha256, acceptanceSha256: sha(acceptanceBytes) };
  };
  const invoke = async (destination: string) => {
    const pins = await persistPinnedEvidence();
    return packAcceptedMatrixCandidate(path.join(root, "source.json"), sourceSha256, matrixPath, pins.matrixSha256, acceptancePath, pins.acceptanceSha256, destination);
  };
  try {
    await writeFile(path.join(root, "source.json"), sourceBytes);
    for (const locale of READING_LOCALES.filter(value => value !== "en")) {
      matrix.rows.push(await writeRow(locale, { u0: translated[0], u1: translated[1] }));
    }
    const result = await invoke(output);
    assert.equal(result.publicationApproved, false);
    const bundle = JSON.parse(await readFile(path.join(output, "ar/ucl.json"), "utf8")) as ReadingTranslationBundle;
    const packed = Object.values(bundle.strings);
    assert.deepEqual(packed.map(unit => [unit.source, unit.translation]).sort(), [["Source Alpha", "Target Alpha"], ["Source Beta", "Target Beta"]]);

    // Swap the input IDs and text together, and swap the accepted output keys
    // consistently. Rehash all mutable artifacts; only the frozen source map
    // can detect this attempted reassignment.
    const arabic = matrix.rows.find(row => row.locale === "ar")!;
    const directory = path.dirname(arabic.path);
    const swappedInput = { locale: "ar", sourceSha256, sourceIds: { u0: ids[1], u1: ids[0] }, strings: { u0: sources[1], u1: sources[0] } };
    await writeFile(path.join(directory, "input.json"), JSON.stringify(swappedInput));
    const swappedCandidateBytes = Buffer.from(JSON.stringify({ u0: translated[1], u1: translated[0] }));
    await writeFile(arabic.path, swappedCandidateBytes);
    arabic.sha256 = sha(swappedCandidateBytes);
    await assert.rejects(invoke(path.join(root, "swapped")), /Frozen source-map assignment mismatch/);

    // The candidate's row hash is also part of the accepted matrix contract.
    await writeFile(path.join(directory, "input.json"), JSON.stringify({ locale: "ar", sourceSha256, sourceIds: { u0: ids[0], u1: ids[1] }, strings: { u0: sources[0], u1: sources[1] } }));
    const unknownKeys = Buffer.from(JSON.stringify({ u0: translated[0], unexpected: translated[1] }));
    await writeFile(arabic.path, unknownKeys);
    arabic.sha256 = sha(unknownKeys);
    await assert.rejects(invoke(path.join(root, "bad-keys")), /Matrix field count mismatch/);
    assert.deepEqual(await import("node:fs/promises").then(fs => fs.stat(path.join(root, "bad-keys")).then(() => true, () => false)), false);

    const unhashedMutation = Buffer.from(JSON.stringify({ u0: translated[0], u1: "Changed after receipt" }));
    await writeFile(arabic.path, unhashedMutation);
    await assert.rejects(invoke(path.join(root, "tampered-bytes")), /Matrix candidate hash mismatch/);
    assert.deepEqual(await import("node:fs/promises").then(fs => fs.stat(path.join(root, "tampered-bytes")).then(() => true, () => false)), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
