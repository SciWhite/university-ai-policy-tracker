import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { policySnapshotSchema } from "@uapt/shared";
import { PolicyV6Provider, PolicyV6Intro } from "../apps/web/components/policy-v6";
import { PolicyV6RecordTopics } from "../apps/web/components/policy-v6-record-topics";
import { PolicyV6TopicEvidence, groupPolicyV6ReadingEvidence } from "../apps/web/components/policy-v6-topic-evidence";
import { StudentPolicySnapshot } from "../apps/web/components/student-policy-snapshot";
import { getPolicyV6Data, type PolicyV6Data } from "../apps/web/lib/policy-v6";
import { bindPolicyV6ReadingEvidence } from "../apps/web/lib/policy-v6-reading-evidence";
import { publishedV6Slugs } from "../apps/web/lib/policy-v6-published-gate";
import { getV6PageInput } from "../apps/web/lib/policy-v6-page-input";
import { v6CorrectedSummary } from "../apps/web/lib/v6-effective-records";
import { getStagedPublicSummaryBySlug } from "../apps/web/lib/staged-public-data";
import { preservePolicyReferenceSearch } from "../apps/web/lib/policy-reference-preview";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
const flag = process.env.UAPT_V6_PUBLISHED_PAGES;
before(() => { process.env.UAPT_V6_PUBLISHED_PAGES = "1"; });
after(() => { if (flag === undefined) delete process.env.UAPT_V6_PUBLISHED_PAGES; else process.env.UAPT_V6_PUBLISHED_PAGES = flag; });
const textHtml = (s: string) => renderToStaticMarkup(<p>{s}</p>).slice(3, -4);

test("all published V6 schools and enabled locales share the default reading presentation without changing content", async () => {
  const kinds = new Set<string>();
  for (const slug of publishedV6Slugs) for (const locale of ["en", "zh", "fr", "pl", "es", "nl", "ms"] as const) {
    const input = getV6PageInput(slug, locale); kinds.add(input.kind);
    const source = await getPolicyV6Data(locale, slug);
    const frozen = JSON.stringify(source);
    const originalClaims = input.bundle?.claims ?? input.evidence?.record.claims ?? v6CorrectedSummary(slug)?.claims ?? [];
    const data = bindPolicyV6ReadingEvidence(source, originalClaims);
    const school = data.schools.find(s => s.slug === slug)!;
    const html = renderToStaticMarkup(<PolicyV6Provider data={data}><PolicyV6Intro /><PolicyV6RecordTopics data={data} /></PolicyV6Provider>);
    assert(html.includes('data-v6-reading-layout="true"'), `${slug}/${locale}`);
    for (const key of ["coursework", "disclosure", "privacy_data", "approved_tools"]) assert(html.includes(`href="#snapshot-${key}"`));
    for (const topic of [...school.topics, ...school.additionalTopics]) {
      const readthrough = data.studentActions?.topics?.[topic.key];
      assert(html.includes(textHtml(readthrough ? (locale === "zh" ? readthrough.zh : readthrough.en) : topic.summary)), `${slug}/${locale}/${topic.key}: summary`);
      assert(html.includes(textHtml(topic.statusLabel)));
      if (!readthrough) assert(html.includes(textHtml(topic.scope)), `${slug}/${locale}/${topic.key}: scope`);
      else assert(html.includes(textHtml(locale === "zh" ? readthrough.meaningZh : readthrough.meaningEn)));
      assert(html.includes(`id="snapshot-scope-${topic.key}"`));
      const groups = groupPolicyV6ReadingEvidence(topic);
      const actual = groups.flatMap(g => [...g.quotations.values()].flat());
      const original = topic.claims.flatMap(claim => claim.evidence.map((evidence, index) => ({ claim, evidence, index })));
      const id = (v: typeof original[number]) => JSON.stringify([v.claim.id, v.claim.text, v.claim.checkedAt, v.index, v.evidence]);
      assert.deepEqual(actual.map(id).sort(), original.map(id).sort());
      for (const claim of topic.claims) for (const evidence of claim.evidence) assert(html.includes(textHtml(evidence.quote)));
      const oldTopic = [...source.schools[0].topics, ...source.schools[0].additionalTopics].find(t => t.key === topic.key)!;
      oldTopic.claims.forEach((claim, ci) => claim.evidence.forEach((e, ei) => {
        if (e.hash) assert.equal(topic.claims[ci].evidence[ei].hash, e.hash, "Bound source versions must never be repinned");
      }));
    }
    assert.equal(JSON.stringify(source), frozen);
  }
  assert.deepEqual([...kinds].sort(), ["bundle", "evidence", "record"]);
});

test("validated full-source versions stay bound while missing versions never borrow a topic URL hash", async () => {
  const source = await getPolicyV6Data("en", "purdue-university");
  const input = getV6PageInput("purdue-university", "en");
  const data = bindPolicyV6ReadingEvidence(source, input.bundle!.claims);
  const before = source.schools[0].topics.flatMap(t => t.claims).flatMap(c => c.evidence).filter(e => e.hash);
  const after = data.schools[0].topics.flatMap(t => t.claims).flatMap(c => c.evidence).filter(e => e.hash);
  assert(before.length > 0);
  assert.deepEqual(after.filter(e => before.some(b => JSON.stringify(b) === JSON.stringify(e))), before);
  const topic = structuredClone(data.schools[0].topics[0]);
  const e = topic.claims[0].evidence[0];
  delete e.hash;
  topic.claims = [{ ...topic.claims[0], id: "unmatched-original-object", evidence: [e, { ...e }] }];
  const isolated: PolicyV6Data = { ...data, schools: [{ ...data.schools[0], topics: [topic], additionalTopics: [] }] };
  const bound = bindPolicyV6ReadingEvidence(isolated, []);
  assert(bound.schools[0].topics[0].claims[0].evidence.every(e => e.hash === undefined));
  assert.equal(groupPolicyV6ReadingEvidence(bound.schools[0].topics[0]).reduce((n, g) => n + g.quotations.size, 0), 2);
  assert(renderToStaticMarkup(<PolicyV6TopicEvidence topic={bound.schools[0].topics[0]} locale="en" />).includes('data-source-version="unknown"'));
});

test("strong snapshot adapter preserves roles and original policy while using shared versioned readers", async () => {
  const snapshot = policySnapshotSchema.parse(JSON.parse(readFileSync("examples/fixtures/policy-snapshot-v1-bristol.json", "utf8")));
  const summary = await getStagedPublicSummaryBySlug(snapshot.universitySlug); assert(summary);
  for (const role of ["student", "instructor", "researcher", "staff"] as const) {
    const data = await getPolicyV6Data("en", snapshot.universitySlug);
    const markup = renderToStaticMarkup(<PolicyV6Provider data={data}><StudentPolicySnapshot claims={summary.claims} entitySlug={snapshot.universitySlug} snapshot={snapshot} role={role} uiLab guidanceInHero /></PolicyV6Provider>);
    assert(markup.includes('data-snapshot-role="student"'), "Student-only audience guard must survive the shared layout");
    assert(markup.includes('data-source-version="'));
    assert(markup.includes('id="snapshot-scope-coursework"'));
    for (const d of snapshot.dimensions) assert(markup.includes(textHtml(d.summary)));
  }
});

test("locale navigation normalizes old pilot links and keeps comparison state on every V6 school", () => {
  for (const slug of ["harvard-university", "purdue-university", "peking-university", "university-of-toronto"]) {
    const url = new URL(preservePolicyReferenceSearch(`/zh/universities/${slug}`, "?layout=v6&compare=harvard-university,purdue-university&view=compare&differences=1", "production"), "https://example.invalid");
    assert.equal(url.searchParams.get("layout"), "v6");
    assert.equal(url.searchParams.get("differences"), "1");
    assert.equal(url.searchParams.get("view"), "compare");
  }
});
