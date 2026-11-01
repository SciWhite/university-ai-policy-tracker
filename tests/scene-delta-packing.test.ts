import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { READING_LOCALES, type ReadingLocale } from "../apps/web/lib/language-catalog";
import { getReadingTranslations, readingTranslation } from "../apps/web/lib/reading-translations";
import { clopperPearsonUpperBound, packAcceptedMatrixCandidate, verifyIndependentCorrectionArtifact, type IndependentCorrectionRow } from "../scripts/pack-reading-translations";

const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
test("independent correction receipts must bind the full correction chain and exact reviewed IDs", () => {
  const row: IndependentCorrectionRow = { id: "fr:2", locale: "fr", index: 2, sourceSha256: "1".repeat(64), originalTargetSha256: sha("before"), repairedTargetSha256: sha("after"), original: "before", translation: "after", reason: "Reviewed repair", independentReview: "accepted", kind: "semantic" };
  const finalOutputs = { fr: { path: "reviewed/fr.json", sha256: "2".repeat(64) } };
  const artifact = { schemaVersion: "uapt-display-addendum-correction-verification-v1", sourceSha256: "3".repeat(64), inputSha256: "4".repeat(64), checkedIds: ["fr:2"], approvedIds: ["fr:2"], issues: [], appliedChanges: [{ ...row }], finalOutputs, publicationApproved: false };
  const expected = { schemaVersion: "uapt-display-addendum-correction-verification-v1", sourceSha256: "3".repeat(64), changes: [row], finalOutputs, scene: false };
  assert.doesNotThrow(() => verifyIndependentCorrectionArtifact(artifact, expected));
  assert.throws(() => verifyIndependentCorrectionArtifact({ ...artifact, checkedIds: [] }, expected), /scope or counts/);
  assert.throws(() => verifyIndependentCorrectionArtifact({ ...artifact, appliedChanges: [{ ...row, translation: "forged" }] }, expected), /exact repaired bytes/);
  const sceneArtifact = { schemaVersion: "uapt-scene-delta-confirmation-correction-verification-final-v1", sourceSha256: "3".repeat(64), checkedIds: ["fr:2"], approvedIds: ["fr:2"], clarificationAcceptedIds: [], issues: [], appliedChanges: [{ ...row, kind: undefined }], finalOutputs, publicationApproved: false };
  assert.doesNotThrow(() => verifyIndependentCorrectionArtifact(sceneArtifact, { ...expected, schemaVersion: sceneArtifact.schemaVersion, scene: true }));
  assert.throws(() => verifyIndependentCorrectionArtifact({ ...sceneArtifact, clarificationAcceptedIds: ["fr:2"] }, { ...expected, schemaVersion: sceneArtifact.schemaVersion, scene: true }), /scope or counts/);
});

test("accepted scene delta preserves failed initial sampling, bounded reviews, and the final confidence-bound acceptance", async () => {
  assert.ok(Math.abs(clopperPearsonUpperBound(11, 1000, 0.975) - 0.01959662822201652) < 1e-12);
  assert.ok(clopperPearsonUpperBound(12, 1000, 0.975) > 0.02);
  const root = await mkdtemp(path.join(tmpdir(), "uapt-scene-delta-"));
  const envKeys = ["NODE_ENV", "UAPT_LOCAL_READING_CANDIDATE_ACCEPTANCE_SHA256", "UAPT_LOCAL_READING_CANDIDATE_SELECTION_SHA256", "UAPT_LOCAL_SCENE_DELTA_ACCEPTANCE_SHA256", "UAPT_READING_PACKAGE_POINTER", "UAPT_READING_SAMPLED_PUBLICATION_ACCEPTANCE_SHA256", "UAPT_READING_SAMPLED_PUBLICATION_SELECTION_SHA256"] as const;
  const before = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  try {
    const sourceSha256 = "1".repeat(64), recordSha256 = "2".repeat(64), evidenceSha256 = "3".repeat(64);
    const baseStrings = ["Base displayed summary", "Base shared label"].sort((a, b) => sha(a).localeCompare(sha(b)));
    const baseSource = { schemaVersion: "uapt-multilingual-source-v1", schools: [{ slug: "test-university", recordSha256, originalEvidenceSha256: evidenceSha256, publicClaimIds: ["claim-test-001"] }], units: Object.fromEntries(baseStrings.map(source => [sha(source), { source, sourceSha256: sha(source), uses: [{ slug: source === "Base shared label" ? "_shared" : "test-university" }] }])) };
    const sourcePath = path.join(root, "source.json"), sourceBytes = JSON.stringify(baseSource);
    await writeFile(sourcePath, sourceBytes);
    const sourceHash = sha(sourceBytes), rows: unknown[] = [], matrixRoot = path.join(root, "matrix");
    await mkdir(matrixRoot);
    for (const locale of READING_LOCALES.filter(value => value !== "en")) {
      const batchRoot = path.join(matrixRoot, locale, "batch-0000");
      await mkdir(batchRoot, { recursive: true });
      const translations = baseStrings.map(source => `Localized ${source === "Base shared label" ? "shared label" : "base summary"} ${locale}`);
      const outputPath = path.join(batchRoot, "output.json"), outputBytes = JSON.stringify(Object.fromEntries(translations.map((value, index) => [`u${index}`, value])));
      await writeFile(outputPath, outputBytes);
      await writeFile(path.join(batchRoot, "input.json"), JSON.stringify({ locale, sourceSha256: sourceHash, sourceIds: Object.fromEntries(baseStrings.map((source, index) => [`u${index}`, sha(source)])), strings: Object.fromEntries(baseStrings.map((source, index) => [`u${index}`, source])) }));
      rows.push({ locale, batch: "batch-0000", path: outputPath, sha256: sha(outputBytes), fields: 2 });
    }
    const matrix = { schemaVersion: "uapt-repaired-translation-matrix-v1", sourceSha256: sourceHash, schools: 1, sourceStrings: 2, targetLocales: 32, batches: 32, fields: 64, missingPairs: 0, fieldValidation: "PASS", rows, semanticAcceptance: { wholeCorpusSemanticReview: false, randomConfirmationSize: 1, confirmedErrorsBeforeCorrection: 0, oneSided975UpperBound: 0.1, confirmationRulePassed: true, nativeSpeakerApproval: false }, publicationApproved: false };
    const matrixPath = path.join(root, "matrix.json"), matrixBytes = JSON.stringify(matrix);
    await writeFile(matrixPath, matrixBytes);
    const baseAcceptance = { sourceSha256: sourceHash, finalMatrixSha256: sha(matrixBytes), publicationApproved: false, wholeCorpusFullMachineSemanticReview: false, status: "COMPLETE_CANDIDATE_COVERAGE_AND_SAMPLING_ACCEPTED", schools: 1, sourceStrings: 2, targetLocales: 32, targetPairs: 64, finalConfirmation: { sampleSize: 1, confirmedErrorsBeforeCorrection: 0, upperBound: 0.1 } };
    const baseAcceptancePath = path.join(root, "base-acceptance.json"), baseAcceptanceBytes = JSON.stringify(baseAcceptance);
    await writeFile(baseAcceptancePath, baseAcceptanceBytes);

    const sceneRoot = path.join(root, "scene-delta");
    await mkdir(path.join(sceneRoot, "generated"), { recursive: true });
    await mkdir(path.join(sceneRoot, "review"), { recursive: true });
    const sceneUnits = Array.from({ length: 337 }, (_, index) => { const source = `Synthetic scene rule ${String(index).padStart(3, "0")}.`; return { index, sourceSha256: sha(source), source, uses: [{ slug: "test-university", field: `scene/story/${index}` }] }; });
    const sceneSource = { schemaVersion: "uapt-runtime-scene-source-delta-v1", parentSourceSha256: sourceHash, inventorySha256: "4".repeat(64), units: sceneUnits };
    const sceneSourcePath = path.join(sceneRoot, "source.json"), sceneSourceBytes = JSON.stringify(sceneSource);
    await writeFile(sceneSourcePath, sceneSourceBytes);
    const sceneSourceSha256 = sha(sceneSourceBytes);
    const localeRefs: Partial<Record<ReadingLocale, { path: string; sha256: string; fields: number }>> = {};
    const localeTranslations = new Map<ReadingLocale, string[]>();
    for (const locale of READING_LOCALES.filter(value => value !== "en")) {
      const translations = sceneUnits.map(unit => `Regel ${unit.index.toString().padStart(3, "0")}.`);
      localeTranslations.set(locale, translations);
      const output = { schemaVersion: "uapt-scene-delta-translation-candidate-v1", sourceSha256: sceneSourceSha256, locale, translations };
      const raw = JSON.stringify(output), relative = `generated/${locale}.json`;
      await writeFile(path.join(sceneRoot, relative), raw);
      localeRefs[locale] = { path: relative, sha256: sha(raw), fields: 337 };
    }
    const locales = READING_LOCALES.filter(value => value !== "en");
    const randomSeed = `uapt-scene-delta-confirmation-${sceneSourceSha256}`;
    const allPairs = locales.flatMap(locale => sceneUnits.map(unit => ({ locale, index: unit.index, sourceSha256: unit.sourceSha256, priority: sha(`${randomSeed}\0${locale}\0${unit.sourceSha256}`) }))).sort((a, b) => a.priority.localeCompare(b.priority));
    const randomSelectedIds = allPairs.slice(0, 600).map(pair => `${pair.locale}:${pair.index}`);
    const blindSelectedIds = locales.flatMap(locale => randomSelectedIds.filter(id => id.startsWith(`${locale}:`)).slice(0, 2));
    const highRiskSelectedIds = locales.flatMap(locale => sceneUnits.map(unit => `${locale}:${unit.index}`).filter(id => !randomSelectedIds.includes(id)).slice(0, 3));
    const plan = { schemaVersion: "uapt-scene-delta-sampling-plan-v1", sourceSha256: sceneSourceSha256, targetPairs: 10_784, randomSampleSize: 600, randomSeed, randomSelectedIds, blindReviewSize: 64, blindPerLocale: 2, blindSelectedIds, highRiskReviewSize: 96, highRiskPerLocale: 3, highRiskSelectedIds, higherModelReviewSize: 160, maxConfirmedErrors: 5, confidenceLevel: 0.975, targetUpperBound: 0.02, publicationApproved: false };
    const planBytes = JSON.stringify(plan);
    await writeFile(path.join(sceneRoot, "sampling-plan.json"), planBytes);
    const pairRow = (id: string, status: "approved" | "error" | "clarified" = "approved", targetSha256?: string) => {
      const [locale, indexText] = id.split(":") as [ReadingLocale, string], index = Number(indexText), unit = sceneUnits[index];
      return { id, locale, index, sourceSha256: unit.sourceSha256, targetSha256: targetSha256 ?? sha(localeTranslations.get(locale)![index]), status };
    };
    const errorText = (id: string) => `Incorrect reviewed target for ${id}`;
    const correction = (id: string, kind: "semantic" | "source_ambiguity_clarification" = "semantic") => {
      const current = pairRow(id), [locale, indexText] = id.split(":") as [ReadingLocale, string], unit = sceneUnits[Number(indexText)], fixed = localeTranslations.get(locale)![Number(indexText)];
      return { locale, index: Number(indexText), sourceSha256: unit.sourceSha256, originalTargetSha256: sha(errorText(id)), repairedTargetSha256: current.targetSha256, original: errorText(id), translation: fixed, reason: kind === "semantic" ? "Synthetic semantic correction chain." : "Synthetic neutral source-boundary clarification.", independentReview: "accepted" as const, kind };
    };
    const initialErrorIds = randomSelectedIds.slice(0, 6);
    const randomChecked = randomSelectedIds.map(id => initialErrorIds.includes(id) ? pairRow(id, "error", sha(errorText(id))) : pairRow(id));
    const randomArtifact: import("../scripts/pack-reading-translations").SceneDeltaRandomReview = { schemaVersion: "uapt-scene-delta-random-review-v1", sourceSha256: sceneSourceSha256, samplingPlanSha256: sha(planBytes), checkedCount: 600, confirmedErrorsBeforeCorrection: 6, rulePassed: false, checked: randomChecked };
    const highCheckedIds = [...blindSelectedIds, ...highRiskSelectedIds];
    const highRiskArtifact: import("../scripts/pack-reading-translations").SceneDeltaHighRiskReview = { schemaVersion: "uapt-scene-delta-high-risk-review-v1", sourceSha256: sceneSourceSha256, checkedCount: 160, checked: highCheckedIds.map(id => ({ ...pairRow(id), blind: blindSelectedIds.includes(id) })) };
    const highSet = new Set(highCheckedIds), initialSet = new Set(randomSelectedIds);
    const expansionIds = allPairs.map(pair => `${pair.locale}:${pair.index}`).filter(id => !initialSet.has(id) && !highSet.has(id)).slice(0, 195);
    const expansionPlan = { schemaVersion: "uapt-scene-delta-bounded-expansion-plan-v1", sourceSha256: sceneSourceSha256, checkedCount: 195, maxChecked: 200, publicationApproved: false, selectedIds: expansionIds };
    const expansionPlanBytes = JSON.stringify(expansionPlan);
    await writeFile(path.join(sceneRoot, "review", "expansion-plan.json"), expansionPlanBytes);
    highRiskArtifact.boundedExpansion = { plan: { path: "review/expansion-plan.json", sha256: sha(expansionPlanBytes) }, checkedCount: 195, checked: expansionIds.map(id => pairRow(id)) };
    const alreadyReviewed = new Set([...randomSelectedIds, ...highCheckedIds, ...expansionIds]);
    const finalSeed = `uapt-scene-delta-final-confirmation-${sceneSourceSha256}`;
    const finalPlanPairs = locales.flatMap(locale => sceneUnits.map(unit => ({ id: `${locale}:${unit.index}`, priority: sha(`${finalSeed}\0${locale}\0${unit.sourceSha256}`) }))).filter(pair => !alreadyReviewed.has(pair.id)).sort((a, b) => a.priority.localeCompare(b.priority));
    const finalSelectedIds = finalPlanPairs.slice(0, 1000).map(pair => pair.id);
    const finalErrorIds = finalSelectedIds.slice(0, 11), clarifiedId = finalSelectedIds[11];
    const finalChecked = finalSelectedIds.map(id => finalErrorIds.includes(id) ? pairRow(id, "error", sha(errorText(id))) : id === clarifiedId ? pairRow(id, "clarified", sha(errorText(id))) : pairRow(id));
    const finalPlan = { schemaVersion: "uapt-scene-delta-final-confirmation-plan-v1", sourceSha256: sceneSourceSha256, parentSamplingPlanSha256: sha(planBytes), initialSampleSize: 600, initialConfirmedErrors: 6, initialMaxErrors: 5, initialRulePassed: false, sampleSize: 1000, maxConfirmedErrors: 10, confidenceLevel: 0.975, targetUpperBound: 0.02, seed: finalSeed, excludedReviewedIds: [...alreadyReviewed].sort(), unreviewedPopulation: 10_784 - alreadyReviewed.size, maximumConfirmationRounds: 1, publicationApproved: false, selectedIds: finalSelectedIds };
    const finalPlanBytes = JSON.stringify(finalPlan);
    await writeFile(path.join(sceneRoot, "review", "final-confirmation-plan.json"), finalPlanBytes);
    const finalUpper = clopperPearsonUpperBound(11, 1000, 0.975);
    randomArtifact.finalConfirmation = { plan: { path: "review/final-confirmation-plan.json", sha256: sha(finalPlanBytes) }, checkedCount: 1000, confirmedErrorsBeforeCorrection: 11, maxConfirmedErrors: 10, oneSidedConfidenceLevel: 0.975, upperBound: finalUpper, rulePassed: false, confidenceTargetPassed: finalUpper <= 0.02, acceptanceBasis: "user_approximate_two_percent_confidence_bound", checked: finalChecked };
    const correctionChanges = [...initialErrorIds.map(id => correction(id)), ...finalErrorIds.map(id => correction(id)), correction(clarifiedId, "source_ambiguity_clarification")].map(change => ({ ...change, id: change.locale + ":" + change.index }));
    const finalOutputs = Object.fromEntries(locales.map(locale => [locale, { path: localeRefs[locale]!.path, sha256: localeRefs[locale]!.sha256 }]));
    const independentArtifact = { schemaVersion: "uapt-scene-delta-confirmation-correction-verification-final-v1", sourceSha256: sceneSourceSha256, checkedIds: correctionChanges.map(change => change.id), approvedIds: correctionChanges.filter(change => change.kind === "semantic").map(change => change.id), clarificationAcceptedIds: correctionChanges.filter(change => change.kind === "source_ambiguity_clarification").map(change => change.id), issues: [], appliedChanges: correctionChanges.map(({ kind: _kind, ...change }) => change), finalOutputs, publicationApproved: false };
    const independentBytes = JSON.stringify(independentArtifact);
    await writeFile(path.join(sceneRoot, "review", "correction-verification.json"), independentBytes);
    const correctionsArtifact = { schemaVersion: "uapt-scene-delta-corrections-v1", sourceSha256: sceneSourceSha256, status: "complete", remainingIssues: 0, changes: correctionChanges, finalOutputs, independentVerification: { path: "review/correction-verification.json", sha256: sha(independentBytes) } };
    const reviewArtifacts = { random: randomArtifact, highRisk: highRiskArtifact, corrections: correctionsArtifact };
    const reviewRefs = {} as Record<keyof typeof reviewArtifacts, { path: string; sha256: string }>;
    for (const [key, artifact] of Object.entries(reviewArtifacts) as [keyof typeof reviewArtifacts, (typeof reviewArtifacts)[keyof typeof reviewArtifacts]][]) {
      const raw = JSON.stringify(artifact), file = key === "highRisk" ? "high-risk.json" : `${key}.json`;
      await writeFile(path.join(sceneRoot, "review", file), raw);
      reviewRefs[key] = { path: `review/${file}`, sha256: sha(raw) };
    }
    const sceneAcceptance = { schemaVersion: "uapt-reviewed-scene-delta-acceptance-v1", status: "accepted", sourceSha256: sceneSourceSha256, parentSourceSha256: sourceHash, sourceStrings: 337, targetLocales: 32, targetPairs: 10_784, fieldValidation: "PASS", fullCorpusSemanticReview: false, nativeSpeakerApproval: false, publicationApproved: false, locales: localeRefs, semanticAcceptance: { mode: "sampling", samplingPlanSha256: sha(planBytes), randomSampleSize: 600, confirmedErrorsBeforeCorrection: 6, oneSidedConfidenceLevel: 0.975, upperBound: clopperPearsonUpperBound(6, 600, 0.975), preRegisteredMaxErrors: 5, rulePassed: false, highRiskReviewed: 160, blindReviewed: 64, expandedReviewed: 195, finalConfirmation: { plan: { path: "review/final-confirmation-plan.json", sha256: sha(finalPlanBytes) }, checkedCount: 1000, confirmedErrorsBeforeCorrection: 11, maxConfirmedErrors: 10, oneSidedConfidenceLevel: 0.975, upperBound: finalUpper, rulePassed: false, confidenceTargetPassed: finalUpper <= 0.02, acceptanceBasis: "user_approximate_two_percent_confidence_bound" }, allDiscoveredCorrectionsApplied: true, remainingIssues: 0 }, reviewArtifacts: reviewRefs };
    const sceneAcceptancePath = path.join(sceneRoot, "acceptance.json"), sceneAcceptanceBytes = JSON.stringify(sceneAcceptance);
    await writeFile(sceneAcceptancePath, sceneAcceptanceBytes);
    const badAcceptance = { ...sceneAcceptance, locales: { ...localeRefs, fr: { ...localeRefs.fr!, sha256: "f".repeat(64) } } };
    const badAcceptancePath = path.join(sceneRoot, "bad-acceptance.json"), badAcceptanceBytes = JSON.stringify(badAcceptance);
    await writeFile(badAcceptancePath, badAcceptanceBytes);
    await assert.rejects(packAcceptedMatrixCandidate(sourcePath, sourceHash, matrixPath, sha(matrixBytes), baseAcceptancePath, sha(baseAcceptanceBytes), path.join(root, "rejected-candidate"), { sourcePath: sceneSourcePath, sourceSha256: sceneSourceSha256, acceptancePath: badAcceptancePath, acceptanceSha256: sha(badAcceptanceBytes) }), /hash mismatch/);
    const forgedBound = structuredClone(sceneAcceptance);
    forgedBound.semanticAcceptance.finalConfirmation.upperBound = 0.001;
    const forgedBoundBytes = JSON.stringify(forgedBound), forgedBoundPath = path.join(sceneRoot, "forged-bound.json");
    await writeFile(forgedBoundPath, forgedBoundBytes);
    await assert.rejects(packAcceptedMatrixCandidate(sourcePath, sourceHash, matrixPath, sha(matrixBytes), baseAcceptancePath, sha(baseAcceptanceBytes), path.join(root, "rejected-forged-bound"), { sourcePath: sceneSourcePath, sourceSha256: sceneSourceSha256, acceptancePath: forgedBoundPath, acceptanceSha256: sha(forgedBoundBytes) }), /confidence-bound acceptance/);
    const missingFresh = structuredClone(sceneAcceptance);
    delete missingFresh.semanticAcceptance.finalConfirmation;
    const missingFreshBytes = JSON.stringify(missingFresh), missingFreshPath = path.join(sceneRoot, "missing-fresh-confirmation.json");
    await writeFile(missingFreshPath, missingFreshBytes);
    await assert.rejects(packAcceptedMatrixCandidate(sourcePath, sourceHash, matrixPath, sha(matrixBytes), baseAcceptancePath, sha(baseAcceptanceBytes), path.join(root, "rejected-missing-fresh"), { sourcePath: sceneSourcePath, sourceSha256: sceneSourceSha256, acceptancePath: missingFreshPath, acceptanceSha256: sha(missingFreshBytes) }), /final confirmation artifact is incomplete/);
    const badIndependent = structuredClone(sceneAcceptance);
    const badCorrectionsRef = badIndependent.reviewArtifacts.corrections;
    const badCorrections = JSON.parse(await readFile(path.join(sceneRoot, badCorrectionsRef.path), "utf8"));
    badCorrections.independentVerification.sha256 = "f".repeat(64);
    const badCorrectionsBytes = JSON.stringify(badCorrections);
    await writeFile(path.join(sceneRoot, "review", "bad-corrections.json"), badCorrectionsBytes);
    badIndependent.reviewArtifacts.corrections = { path: "review/bad-corrections.json", sha256: sha(badCorrectionsBytes) };
    const badIndependentBytes = JSON.stringify(badIndependent), badIndependentPath = path.join(sceneRoot, "bad-independent-acceptance.json");
    await writeFile(badIndependentPath, badIndependentBytes);
    await assert.rejects(packAcceptedMatrixCandidate(sourcePath, sourceHash, matrixPath, sha(matrixBytes), baseAcceptancePath, sha(baseAcceptanceBytes), path.join(root, "rejected-independent-review"), { sourcePath: sceneSourcePath, sourceSha256: sceneSourceSha256, acceptancePath: badIndependentPath, acceptanceSha256: sha(badIndependentBytes) }), /hash mismatch/);
    const missingIndependent = structuredClone(sceneAcceptance);
    const missingRef = missingIndependent.reviewArtifacts.corrections;
    const missingCorrections = JSON.parse(await readFile(path.join(sceneRoot, missingRef.path), "utf8"));
    delete missingCorrections.independentVerification;
    const missingCorrectionsBytes = JSON.stringify(missingCorrections);
    await writeFile(path.join(sceneRoot, "review", "missing-independent-corrections.json"), missingCorrectionsBytes);
    missingIndependent.reviewArtifacts.corrections = { path: "review/missing-independent-corrections.json", sha256: sha(missingCorrectionsBytes) };
    const missingIndependentBytes = JSON.stringify(missingIndependent), missingIndependentPath = path.join(sceneRoot, "missing-independent-acceptance.json");
    await writeFile(missingIndependentPath, missingIndependentBytes);
    await assert.rejects(packAcceptedMatrixCandidate(sourcePath, sourceHash, matrixPath, sha(matrixBytes), baseAcceptancePath, sha(baseAcceptanceBytes), path.join(root, "rejected-missing-independent-review"), { sourcePath: sceneSourcePath, sourceSha256: sceneSourceSha256, acceptancePath: missingIndependentPath, acceptanceSha256: sha(missingIndependentBytes) }), /lacks its independent verification reference/);
    const output = path.join(root, "candidate");
    await packAcceptedMatrixCandidate(sourcePath, sourceHash, matrixPath, sha(matrixBytes), baseAcceptancePath, sha(baseAcceptanceBytes), output, { sourcePath: sceneSourcePath, sourceSha256: sceneSourceSha256, acceptancePath: sceneAcceptancePath, acceptanceSha256: sha(sceneAcceptanceBytes) });
    const selectionBytes = await readFile(path.join(output, "selection.json"), "utf8"), selection = JSON.parse(selectionBytes);
    const selectionPin = sha(selectionBytes), candidatePointer = path.join(output, "candidate.json");
    process.env.NODE_ENV = "development";
    process.env.UAPT_LOCAL_READING_CANDIDATE_ACCEPTANCE_SHA256 = sha(baseAcceptanceBytes);
    process.env.UAPT_LOCAL_READING_CANDIDATE_SELECTION_SHA256 = selectionPin;
    process.env.UAPT_LOCAL_SCENE_DELTA_ACCEPTANCE_SHA256 = sha(sceneAcceptanceBytes);
    const ready = await getReadingTranslations("test-university", "fr", { recordSha256, originalEvidenceSha256: evidenceSha256 }, candidatePointer);
    assert.equal(ready.state, "ready");
    if (ready.state === "ready") assert.equal(readingTranslation(sceneUnits[12].source, [ready.school, ready.shared]).translated, true);
    process.env.UAPT_LOCAL_SCENE_DELTA_ACCEPTANCE_SHA256 = "f".repeat(64);
    assert.equal((await getReadingTranslations("test-university", "fr", { recordSha256, originalEvidenceSha256: evidenceSha256 }, candidatePointer)).state, "unapproved");
    assert.equal(selection.publicationApproved, false);
    assert.equal(selection.supplemental.sceneDelta.sourceSha256, sceneSourceSha256);
    assert.equal(selection.supplemental.sceneDelta.acceptanceSha256, sha(sceneAcceptanceBytes));

    // The same accepted supplemental proof can be selected under the distinct
    // production approval contract without relaxing the development pins.
    process.env.UAPT_LOCAL_SCENE_DELTA_ACCEPTANCE_SHA256 = sha(sceneAcceptanceBytes);
    const published = { ...selection, publicationApproved: true, sampledPublicationAcceptance: {
      schemaVersion: "uapt-reviewed-sampled-translation-publication-v1",
      status: "approved",
      sourceSha256: selection.sourceSha256,
      matrixSha256: selection.samplingAcceptance.matrixSha256,
      acceptanceSha256: selection.samplingAcceptance.acceptanceSha256,
      packageAdjustmentSha256: selection.samplingAcceptance.packageAdjustmentSha256,
      targetPairs: selection.samplingAcceptance.targetPairs,
      sceneDeltaAcceptanceSha256: sha(sceneAcceptanceBytes),
      publicationApproved: true,
    } };
    delete (published as { candidateOnly?: true }).candidateOnly;
    const publishedBytes = `${JSON.stringify(published)}\n`;
    await writeFile(path.join(output, "selection.json"), publishedBytes);
    const publishedSha = sha(publishedBytes);
    await writeFile(candidatePointer, `${JSON.stringify({ path: "selection.json", sha256: publishedSha })}\n`);
    process.env.NODE_ENV = "production";
    process.env.UAPT_READING_PACKAGE_POINTER = candidatePointer;
    process.env.UAPT_READING_SAMPLED_PUBLICATION_ACCEPTANCE_SHA256 = sha(baseAcceptanceBytes);
    process.env.UAPT_READING_SAMPLED_PUBLICATION_SELECTION_SHA256 = publishedSha;
    const publishedReady = await getReadingTranslations("test-university", "fr", { recordSha256, originalEvidenceSha256: evidenceSha256 }, candidatePointer);
    assert.equal(publishedReady.state, "ready");
    if (publishedReady.state === "ready") assert.equal(readingTranslation(sceneUnits[12].source, [publishedReady.school, publishedReady.shared]).translated, true);
    const originalDeltaReceipt = published.sampledPublicationAcceptance.sceneDeltaAcceptanceSha256;
    published.sampledPublicationAcceptance.sceneDeltaAcceptanceSha256 = "f".repeat(64);
    const forgedDeltaBytes = `${JSON.stringify(published)}\n`;
    await writeFile(path.join(output, "selection.json"), forgedDeltaBytes);
    const forgedDeltaSha = sha(forgedDeltaBytes);
    await writeFile(candidatePointer, `${JSON.stringify({ path: "selection.json", sha256: forgedDeltaSha })}\n`);
    assert.equal((await getReadingTranslations("test-university", "fr", { recordSha256, originalEvidenceSha256: evidenceSha256 }, candidatePointer)).state, "unapproved");
    process.env.UAPT_READING_SAMPLED_PUBLICATION_SELECTION_SHA256 = forgedDeltaSha;
    assert.equal((await getReadingTranslations("test-university", "fr", { recordSha256, originalEvidenceSha256: evidenceSha256 }, candidatePointer)).state, "unapproved");
    process.env.UAPT_READING_SAMPLED_PUBLICATION_SELECTION_SHA256 = publishedSha;
    published.sampledPublicationAcceptance.sceneDeltaAcceptanceSha256 = originalDeltaReceipt;
  } finally {
    for (const key of envKeys) before[key] === undefined ? delete process.env[key] : process.env[key] = before[key];
    await rm(root, { recursive: true, force: true });
  }
});
