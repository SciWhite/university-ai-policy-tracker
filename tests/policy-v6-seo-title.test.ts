import assert from 'node:assert/strict';
import test from 'node:test';
import {buildPolicyV6SeoTitle} from '../apps/web/lib/policy-v6-seo-title';
import {getLocalizedInstitutionName} from '../apps/web/lib/institution-localization';

test('seven languages describe policy, with no mandatory or invented brand', () => {
  const expected = {
    en: 'Harvard University AI Policy', zh: 'Harvard University AI 政策',
    fr: 'Harvard University — Politique d’IA', pl: 'Harvard University — Polityka AI',
    es: 'Harvard University — Política de IA', nl: 'Harvard University — AI-beleid',
    ms: 'Harvard University — Dasar AI'
  } as const;
  for (const locale of Object.keys(expected) as Array<keyof typeof expected>) {
    assert.equal(buildPolicyV6SeoTitle('harvard-university', 'Harvard University', locale), expected[locale]);
  }
});

test('SEO names and existing language aliases preserve canonical display names', () => {
  const canonical = 'ETH Zurich (Swiss Federal Institute of Technology Zurich)';
  assert.equal(buildPolicyV6SeoTitle('eth-zurich', canonical, 'en'), 'ETH Zurich AI Policy');
  assert.equal(getLocalizedInstitutionName('eth-zurich', canonical, 'en'), canonical);
  assert.equal(buildPolicyV6SeoTitle('tsinghua-university', 'Tsinghua University', 'zh'), '清华大学 AI 政策');
  assert.equal(buildPolicyV6SeoTitle('national-university-of-singapore', 'National University of Singapore (NUS)', 'en'), 'National University of Singapore AI Policy');
});

test('optional formal brand is dropped before sacrificing a complete school name', () => {
  assert.equal(buildPolicyV6SeoTitle('harvard-university', 'Harvard University', 'en', {includeBrand: true}), 'Harvard University AI Policy | University AI Policy Tracker');
  assert.equal(buildPolicyV6SeoTitle('nanyang-technological-university', 'Nanyang Technological University, Singapore (NTU Singapore)', 'en', {includeBrand: true}), 'Nanyang Technological University, Singapore AI Policy');
});

test('optional source wording respects the budget; unknown identities are never sliced', () => {
  const unknown = 'An unusually long institutional identity with a significant geographical distinction';
  assert.equal(buildPolicyV6SeoTitle('unmapped-university', unknown, 'en'), `${unknown} AI Policy`);
  assert.equal(buildPolicyV6SeoTitle('harvard-university', 'Harvard University', 'en', {emphasizeSources: true}), 'Harvard University AI Policy & Sources');
  const title = buildPolicyV6SeoTitle('nanyang-technological-university', 'Nanyang Technological University, Singapore (NTU Singapore)', 'fr', {emphasizeSources: true});
  assert.ok(Array.from(title).length <= 70);
  assert.ok(title.startsWith('Nanyang Technological University, Singapore'));
});
