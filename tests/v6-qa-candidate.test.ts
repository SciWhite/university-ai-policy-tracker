import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import {
  getLocalQACandidateRecords,
  getLocalQACandidatePages,
  resetQACandidateCache
} from '../apps/web/lib/v6-qa-candidate';
import { getScopedRecordReleaseDiff } from '../apps/web/lib/release-diffs';
import type { V6RecordPackage } from '../apps/web/lib/v6-effective-records';

function sha256(buf: Buffer | string): string {
  return createHash('sha256').update(buf).digest('hex');
}

test('getLocalQA candidate guards fail closed on incomplete configuration', () => {
  resetQACandidateCache();
  const oldEnv = { ...process.env };
  try {
    process.env.NODE_ENV = 'development';
    process.env.UAPT_LOCAL_QA_CANDIDATE_RECORDS = '/tmp/fake-records.json';
    delete process.env.UAPT_LOCAL_QA_CANDIDATE_PAGES;
    delete process.env.UAPT_LOCAL_QA_EXPECTED_RECORDS_HASH;
    delete process.env.UAPT_LOCAL_QA_EXPECTED_PAGES_HASH;
    delete process.env.UAPT_LOCAL_QA_EXPECTED_REVISION;

    assert.throws(() => getLocalQACandidateRecords(), /incomplete configuration/);
    assert.throws(() => getLocalQACandidatePages(), /incomplete configuration/);
  } finally {
    process.env = oldEnv;
    resetQACandidateCache();
  }
});

test('getLocalQA candidate guards ignore dev selector in production', () => {
  resetQACandidateCache();
  const oldEnv = { ...process.env };
  try {
    process.env.NODE_ENV = 'production';
    process.env.UAPT_LOCAL_QA_CANDIDATE_RECORDS = '/tmp/fake-records.json';
    process.env.UAPT_LOCAL_QA_CANDIDATE_PAGES = '/tmp/fake-pages.json';
    process.env.UAPT_LOCAL_QA_EXPECTED_RECORDS_HASH = 'abc';
    process.env.UAPT_LOCAL_QA_EXPECTED_PAGES_HASH = 'def';
    process.env.UAPT_LOCAL_QA_EXPECTED_REVISION = 'rev-1';

    assert.equal(getLocalQACandidateRecords(), undefined);
    assert.equal(getLocalQACandidatePages(), undefined);
  } finally {
    process.env = oldEnv;
    resetQACandidateCache();
  }
});

test('getLocalQA candidate guards reject wrong hash and mismatched revision', () => {
  resetQACandidateCache();
  const oldEnv = { ...process.env };
  const testDir = join(tmpdir(), 'uapt-test-qa-' + Date.now());
  mkdirSync(testDir, { recursive: true });

  const fakeRecords: any = {
    schemaVersion: 'uapt-v6-effective-records-v1',
    publicationApproved: true,
    revision: 'test-rev-1',
    publishedAt: new Date().toISOString(),
    datasetReleaseId: 'public-release-20260924-002',
    summaries: [],
    snapshots: {},
    toolsBySlug: {},
    recordRevisions: {},
    heldBySlug: {},
    historical: {},
    aliasesBySlug: {},
    changesBySlug: {},
    analysisOverrides: {}
  };
  const fakePages: any = {
    schemaVersion: 'uapt-v6-published-pages-v1',
    publicationApproved: true,
    releaseId: 'test-rev-1',
    slugs: [],
    locales: {}
  };

  const recRaw = Buffer.from(JSON.stringify(fakeRecords));
  const pagesRaw = Buffer.from(JSON.stringify(fakePages));
  const recHash = sha256(recRaw);
  const pagesHash = sha256(pagesRaw);

  const recFile = join(testDir, 'candidate-records.json');
  const pagesFile = join(testDir, 'candidate-pages.json');
  writeFileSync(recFile, recRaw);
  writeFileSync(pagesFile, pagesRaw);

  try {
    process.env.NODE_ENV = 'development';
    process.env.UAPT_LOCAL_QA_CANDIDATE_RECORDS = recFile;
    process.env.UAPT_LOCAL_QA_CANDIDATE_PAGES = pagesFile;
    process.env.UAPT_LOCAL_QA_EXPECTED_RECORDS_HASH = recHash;
    process.env.UAPT_LOCAL_QA_EXPECTED_PAGES_HASH = pagesHash;
    process.env.UAPT_LOCAL_QA_EXPECTED_REVISION = 'test-rev-1';

    // Valid load passes
    const loadedRec = getLocalQACandidateRecords();
    assert.equal(loadedRec?.revision, 'test-rev-1');
    const loadedPages = getLocalQACandidatePages();
    assert.equal(loadedPages?.releaseId, 'test-rev-1');

    // Wrong records hash fails closed
    process.env.UAPT_LOCAL_QA_EXPECTED_RECORDS_HASH = '0'.repeat(64);
    assert.throws(() => getLocalQACandidateRecords(), /hash mismatch/);

    // Restore correct hash, change expected revision -> fails closed even with unchanged mtime
    process.env.UAPT_LOCAL_QA_EXPECTED_RECORDS_HASH = recHash;
    process.env.UAPT_LOCAL_QA_EXPECTED_REVISION = 'other-rev';
    assert.throws(() => getLocalQACandidateRecords(), /revision mismatch/);
    assert.throws(() => getLocalQACandidatePages(), /revision mismatch/);

    // Pair mismatch
    resetQACandidateCache();
    process.env.UAPT_LOCAL_QA_EXPECTED_REVISION = 'test-rev-1';
    fakePages.releaseId = 'different-rev';
    writeFileSync(pagesFile, JSON.stringify(fakePages));
    process.env.UAPT_LOCAL_QA_EXPECTED_PAGES_HASH = sha256(JSON.stringify(fakePages));
    process.env.UAPT_LOCAL_QA_EXPECTED_REVISION = 'test-rev-1';
    // Loading records first
    getLocalQACandidateRecords();
    // Loading pages with different revision throws pair mismatch
    process.env.UAPT_LOCAL_QA_EXPECTED_REVISION = 'different-rev';
    assert.throws(() => getLocalQACandidatePages(), /pair mismatch/);
  } finally {
    try { unlinkSync(recFile); } catch {}
    try { unlinkSync(pagesFile); } catch {}
    process.env = oldEnv;
    resetQACandidateCache();
  }
});

test('getScopedRecordReleaseDiff never emits non-target entities', async () => {
  const dummyCustomPackage: any = {
    schemaVersion: 'uapt-v6-effective-records-v1',
    publicationApproved: true,
    revision: 'v6-custom-test-release',
    datasetReleaseId: 'public-release-20260924-002',
    publishedAt: '2026-10-21T05:00:00Z',
    recordRevisions: {
      'target-school-a': {
        universityRevisionId: 'v6-custom-test-release',
        datasetReleaseId: 'public-release-20260924-002',
        recordSha256: 'a'.repeat(64)
      },
      'non-target-school-b': {
        universityRevisionId: 'v6-audit-fix-20261014',
        datasetReleaseId: 'public-release-20260924-002',
        recordSha256: 'b'.repeat(64)
      }
    },
    historical: {
      'target-school-a': {
        baseline: {
          entity: { slug: 'target-school-a', name: 'Target School A', qsRank: 1 },
          claims: [],
          officialSources: []
        }
      },
      'non-target-school-b': {
        baseline: {
          entity: { slug: 'non-target-school-b', name: 'Non Target School B', qsRank: 2 },
          claims: [],
          officialSources: []
        }
      }
    },
    summaries: [
      {
        entity: { slug: 'target-school-a', name: 'Target School A', qsRank: 1 },
        claims: [{ id: 'claim-1', entitySlug: 'target-school-a', claimText: 'New text', claimType: 'other', confidence: 1, evidence: [] }],
        officialSources: []
      },
      {
        entity: { slug: 'non-target-school-b', name: 'Non Target School B', qsRank: 2 },
        claims: [{ id: 'claim-2', entitySlug: 'non-target-school-b', claimText: 'Old text', claimType: 'other', confidence: 1, evidence: [] }],
        officialSources: []
      }
    ],
    snapshots: {},
    toolsBySlug: {},
    heldBySlug: {},
    aliasesBySlug: {},
    changesBySlug: {
      'target-school-a': { addedClaimIds: ['claim-1'], updatedClaimIds: [], heldClaimIds: [] }
    },
    analysisOverrides: {}
  };

  const diff = await getScopedRecordReleaseDiff('v6-custom-test-release', dummyCustomPackage);
  assert.ok(diff);
  assert.equal(diff.entities.length, 1);
  assert.equal(diff.entities[0].entitySlug, 'target-school-a');
  assert.equal(diff.entities.some(e => e.entitySlug === 'non-target-school-b'), false);
});

test('candidate change index retains non-target control rows while full release diff excludes them', async () => {
  resetQACandidateCache();
  const oldEnv = { ...process.env };
  const testDir = join(tmpdir(), 'uapt-test-portable-' + Date.now());
  mkdirSync(testDir, { recursive: true });

  try {
    process.env.NODE_ENV = 'development';
    process.env.UAPT_V6_PUBLISHED_PAGES = '1';
    process.env.NEXT_PUBLIC_UAPT_V6_PUBLISHED_PAGES = '1';

    const { readV6RecordCorrections } = await import('../apps/web/lib/v6-effective-records');
    const baselineRecs = readV6RecordCorrections()!;
    const unswSummary = baselineRecs.summaries.find(s => s.entity.slug === 'unsw-sydney')!;
    const unswRevision = baselineRecs.recordRevisions['unsw-sydney'];

    const fakeRecords: any = {
      schemaVersion: 'uapt-v6-effective-records-v1',
      publicationApproved: true,
      revision: 'test-v6-target-candidate-rev',
      datasetReleaseId: 'public-release-20260924-002',
      publishedAt: '2026-10-21T08:00:00Z',
      recordRevisions: {
        'target-school-a': {
          universityRevisionId: 'test-v6-target-candidate-rev',
          datasetReleaseId: 'public-release-20260924-002',
          recordSha256: 'a'.repeat(64),
          publishedAt: '2026-10-21T08:00:00Z'
        },
        'unsw-sydney': unswRevision
      },
      historical: {
        'target-school-a': {
          baseline: { entity: { slug: 'target-school-a', name: 'Target School A', qsRank: 1 }, claims: [], officialSources: [] }
        },
        'unsw-sydney': baselineRecs.historical['unsw-sydney']
      },
      summaries: [
        {
          entity: { slug: 'target-school-a', name: 'Target School A', qsRank: 1, summary: 'Target School summary' },
          claims: [
            { id: 'claim-t1', entitySlug: 'target-school-a', claimText: 'Target claim 1', claimType: 'teaching', confidence: 1, evidence: [] },
            { id: 'claim-t2', entitySlug: 'target-school-a', claimText: 'Target claim 2', claimType: 'disclosure', confidence: 1, evidence: [] }
          ],
          officialSources: [{ id: 'src-t1', sourceUrl: 'https://example.edu/policy', citationTitle: 'Policy' }],
          lastCheckedAt: '2026-10-21T08:00:00Z',
          lastChangedAt: '2026-10-21T08:00:00Z',
          reviewState: 'agent_reviewed'
        },
        unswSummary
      ],
      snapshots: {},
      toolsBySlug: { 'target-school-a': [], 'unsw-sydney': baselineRecs.toolsBySlug['unsw-sydney'] },
      heldBySlug: { 'target-school-a': [], 'unsw-sydney': baselineRecs.heldBySlug['unsw-sydney'] },
      aliasesBySlug: { 'target-school-a': ['Target A'], 'unsw-sydney': baselineRecs.aliasesBySlug['unsw-sydney'] },
      changesBySlug: {
        'target-school-a': { addedClaimIds: ['claim-t1', 'claim-t2'], updatedClaimIds: [], heldClaimIds: [] },
        'unsw-sydney': baselineRecs.changesBySlug['unsw-sydney']
      },
      analysisOverrides: {}
    };
    const fakePages: any = {
      schemaVersion: 'uapt-v6-published-pages-v1',
      publicationApproved: true,
      releaseId: 'test-v6-target-candidate-rev',
      slugs: ['target-school-a', 'unsw-sydney'],
      locales: {}
    };

    const recRaw = Buffer.from(JSON.stringify(fakeRecords));
    const pagesRaw = Buffer.from(JSON.stringify(fakePages));
    const recHash = sha256(recRaw);
    const pagesHash = sha256(pagesRaw);

    const recFile = join(testDir, 'candidate-records.json');
    const pagesFile = join(testDir, 'candidate-pages.json');
    writeFileSync(recFile, recRaw);
    writeFileSync(pagesFile, pagesRaw);

    process.env.UAPT_LOCAL_QA_CANDIDATE_RECORDS = recFile;
    process.env.UAPT_LOCAL_QA_CANDIDATE_PAGES = pagesFile;
    process.env.UAPT_LOCAL_QA_EXPECTED_RECORDS_HASH = recHash;
    process.env.UAPT_LOCAL_QA_EXPECTED_PAGES_HASH = pagesHash;
    process.env.UAPT_LOCAL_QA_EXPECTED_REVISION = 'test-v6-target-candidate-rev';
    resetQACandidateCache();

    const { getChangeIndexData } = await import('../apps/web/lib/change-records');
    const index = await getChangeIndexData();

    // 1. Verify non-target control row retained with historical revision and full claim count
    const unsw = index.data.records.find(r => r.slug === 'unsw-sydney');
    assert.ok(unsw, 'UNSW must be present in aggregate change index');
    assert.equal(unsw.releaseId, 'qs20-24-v6-r7-20261020');
    assert.equal(unsw.claimCount, 40);
    assert.equal(unsw.recordSha256, '162f56fa911147609cee1e855195b0f2db3311a172b36b4d849543ae2ebe422d');

    // 2. Verify target school has candidate revision
    const target = index.data.records.find(r => r.slug === 'target-school-a');
    assert.ok(target, 'Target school must be present in aggregate change index');
    assert.equal(target.releaseId, 'test-v6-target-candidate-rev');
    assert.equal(target.claimCount, 2);

    // 3. Verify full release diff strictly contains only the target school
    const diff = await getScopedRecordReleaseDiff('test-v6-target-candidate-rev', fakeRecords);
    assert.ok(diff);
    assert.equal(diff.entities.length, 1);
    assert.equal(diff.entities[0].entitySlug, 'target-school-a');
    assert.equal(diff.entities.some(e => e.entitySlug === 'unsw-sydney'), false);
  } finally {
    try { unlinkSync(join(testDir, 'candidate-records.json')); } catch {}
    try { unlinkSync(join(testDir, 'candidate-pages.json')); } catch {}
    try { rmSync(testDir, { recursive: true, force: true }); } catch {}
    process.env = oldEnv;
    resetQACandidateCache();
  }
});
