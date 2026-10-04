import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getStagedPublicSummaryBySlug } from '../apps/web/lib/staged-public-data';
import { getLoadedPolicySnapshotBySlug } from '../apps/web/lib/policy-snapshots';
import { getPolicyScenePilot } from '../apps/web/lib/policy-scene-pilot';
import { isStudentOnlyPolicyPage } from '../apps/web/lib/policy-page-audience';
import { StudentPolicySnapshot } from '../apps/web/components/student-policy-snapshot';
import { isIndexRecoveryPilotSlug } from '../apps/web/lib/index-recovery-pilot';

test('Stanford illustration is pinned independently of the SEO cohort and active in production', async () => {
  const slug = 'stanford-university';
  const summary = await getStagedPublicSummaryBySlug(slug);
  assert(summary);
  const loaded = await getLoadedPolicySnapshotBySlug(slug);
  assert.equal(loaded?.validation.effectiveStatus, 'strong');
  assert.equal(isIndexRecoveryPilotSlug(slug), false);
  assert(getPolicyScenePilot(slug, summary.claims, true, false)?.studentFirst);
  assert.equal(getPolicyScenePilot(slug, summary.claims, false, false), undefined);
  const changed = structuredClone(summary.claims);
  if (changed[0].claimText) changed[0].claimText += ' changed';
  else changed[0].id += '-changed';
  assert.equal(getPolicyScenePilot(slug, changed, true, false), undefined);
  assert.equal(getPolicyScenePilot(slug, [], true, false), undefined);
});

test('Cambridge and MIT illustrations are active in production default and fail closed without strong snapshot or on tampered claims', async () => {
  for (const slug of ['university-of-cambridge', 'massachusetts-institute-of-technology'] as const) {
    const summary = await getStagedPublicSummaryBySlug(slug);
    assert(summary);
    const loaded = await getLoadedPolicySnapshotBySlug(slug);
    assert.equal(loaded?.validation.effectiveStatus, 'strong');
    assert.equal(isIndexRecoveryPilotSlug(slug), false);

    // Active in production default
    const scene = getPolicyScenePilot(slug, summary.claims, true, false);
    assert(scene?.studentFirst);
    assert(scene?.quickGuide);

    // Fail-closed without strong snapshot
    assert.equal(getPolicyScenePilot(slug, summary.claims, false, false), undefined);

    // Fail-closed on tampered claims or empty claims
    const changed = structuredClone(summary.claims);
    if (changed[0].claimText) changed[0].claimText += ' changed';
    else changed[0].id += '-changed';
    assert.equal(getPolicyScenePilot(slug, changed, true, false), undefined);
    assert.equal(getPolicyScenePilot(slug, [], true, false), undefined);
  }
});

test('next ten V4 illustrations are active in production default, reject strong snapshots, and enforce pinned claims fingerprints', async () => {
  const nextTenSlugs = [
    'university-of-exeter',
    'keele-university',
    'university-of-glasgow',
    'tilburg-university',
    'university-of-aberdeen',
    'flinders-university',
    'kingston-university-london',
    'university-of-victoria-uvic',
    'chalmers-university-of-technology',
    'cardiff-university'
  ] as const;

  for (const slug of nextTenSlugs) {
    const summary = await getStagedPublicSummaryBySlug(slug);
    assert(summary);
    const loaded = await getLoadedPolicySnapshotBySlug(slug);
    assert.equal(loaded, undefined);
    assert.equal(isIndexRecoveryPilotSlug(slug), false);

    // Active in production default as claims-only
    const scene = getPolicyScenePilot(slug, summary.claims, false, false);
    assert(scene);
    assert.equal(scene.claimsOnly, true);
    assert(scene.snapshotNotice);
    assert(scene.quickGuide);
    assert(scene.quickGuide.do.checks.length >= 2);
    assert(scene.quickGuide.dont.checks.length >= 2);

    // Rejects strong snapshot (these 10 are claims-only)
    assert.equal(getPolicyScenePilot(slug, summary.claims, true, false), undefined);

    // Fails closed if reviewed claims are tampered or empty
    const changed = structuredClone(summary.claims);
    if (changed[0].claimText) changed[0].claimText += ' changed';
    else changed[0].id += '-changed';
    assert.equal(getPolicyScenePilot(slug, changed, false, false), undefined);
    assert.equal(getPolicyScenePilot(slug, [], false, false), undefined);
  }
});
test('student pages ignore legacy audience requests without changing reviewed audiences',async()=>{
 for(const slug of ['harvard-university','national-university-of-singapore','utrecht-university','de-la-salle-university','imperial-college-london','adelaide-university','university-of-auckland','stanford-university','ubc','university-of-cambridge','massachusetts-institute-of-technology','aalto-university','cornell-university','university-of-melbourne']){
 const loaded=await getLoadedPolicySnapshotBySlug(slug);assert(loaded);const before=JSON.stringify(loaded.snapshot.audiences);
 const html=renderToStaticMarkup(<StudentPolicySnapshot claims={[]} entitySlug={slug} locale="en" role="researcher" snapshot={loaded.snapshot}/>);
 assert.match(html,/data-snapshot-role="student"/);assert.doesNotMatch(html,/aria-label="Snapshot audience"/);assert.equal(JSON.stringify(loaded.snapshot.audiences),before);
 }
 assert.equal(isStudentOnlyPolicyPage('university-of-queensland'),true);assert.equal(isStudentOnlyPolicyPage('durham-university'),true);assert.equal(isStudentOnlyPolicyPage('university-of-bristol'),true);
 assert.equal(isStudentOnlyPolicyPage('unsw-sydney'),true);
 assert.equal(isStudentOnlyPolicyPage('deakin-university'),true);
 assert.equal(isStudentOnlyPolicyPage('university-of-surrey'),true);
 assert.equal(isStudentOnlyPolicyPage('university-of-cambridge'),true);
 assert.equal(isStudentOnlyPolicyPage('massachusetts-institute-of-technology'),true);
});
test('other schools retain their audience selector',async()=>{
 const loaded=await getLoadedPolicySnapshotBySlug('snu');assert(loaded);
 const html=renderToStaticMarkup(<StudentPolicySnapshot claims={[]} entitySlug="snu" locale="en" role="researcher" snapshot={loaded.snapshot}/>);
 assert.match(html,/aria-label="Snapshot audience"/);assert.match(html,/data-snapshot-role="researcher"/);
});
test('source supplements identify retained records and current policy boundaries',async()=>{
 for(const slug of ['university-of-bristol','university-of-auckland']){
 const summary=await getStagedPublicSummaryBySlug(slug);assert(summary);
 const scene=getPolicyScenePilot(slug,summary.claims,slug==='university-of-auckland',slug==='university-of-bristol');assert(scene?.sourceUpdate);
 assert.match(scene.sourceUpdate.text,/older|earlier/);assert.match(scene.sourceUpdate.href,/^https:\/\//);
 }
});
