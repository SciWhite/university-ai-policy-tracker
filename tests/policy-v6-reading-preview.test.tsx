import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { isPolicyV6Preview } from "../apps/web/lib/policy-v6-gate";
import { preservePolicyReferenceSearch } from "../apps/web/lib/policy-reference-preview";
import { PolicyV6TopicEvidence, groupPolicyV6ReadingEvidence } from "../apps/web/components/policy-v6-topic-evidence";
import { PolicyV6Provider, PolicyV6Intro } from "../apps/web/components/policy-v6";
import { PolicyV6RecordTopics } from "../apps/web/components/policy-v6-record-topics";
import { bindPolicyV6ReadingEvidence } from "../apps/web/lib/policy-v6-reading-evidence";
import { getLocalV6Evidence } from "../apps/web/lib/policy-v6-local-evidence";
import { getPolicyV6Data, type LabTopic } from "../apps/web/lib/policy-v6";

const originalPublishedFlag = process.env.UAPT_V6_PUBLISHED_PAGES;
before(() => { process.env.UAPT_V6_PUBLISHED_PAGES = "1"; });
after(() => {
  if (originalPublishedFlag === undefined) delete process.env.UAPT_V6_PUBLISHED_PAGES;
  else process.env.UAPT_V6_PUBLISHED_PAGES = originalPublishedFlag;
});
async function readingData() {
  const data = await getPolicyV6Data("en", "harvard-university");
  assert.equal(data.published, true, "Acceptance must use the verified published data path");
  const raw = getLocalV6Evidence("harvard-university");
  assert(raw, "Accepted original evidence is required");
  return bindPolicyV6ReadingEvidence(data, raw.record.claims);
}

(globalThis as typeof globalThis & { React: typeof React }).React = React;
const textHtml = (text: string) => renderToStaticMarkup(<p>{text}</p>).slice(3, -4);

test("historical Harvard alias keeps its gate but canonicalizes navigation to shared V6", () => {
  const server = process.env.UAPT_V6_PUBLISHED_PAGES, client = process.env.NEXT_PUBLIC_UAPT_V6_PUBLISHED_PAGES;
  process.env.UAPT_V6_PUBLISHED_PAGES = "0"; process.env.NEXT_PUBLIC_UAPT_V6_PUBLISHED_PAGES = "0";
  try {
    assert(isPolicyV6Preview("harvard-university", "harvard-ui-lab", "development"));
    assert(!isPolicyV6Preview("harvard-university", "harvard-ui-lab", "production"));
    assert(!isPolicyV6Preview("university-of-toronto", "harvard-ui-lab", "development"));
    assert.equal(new URL(preservePolicyReferenceSearch("/zh/universities/harvard-university", "?layout=harvard-ui-lab", "development"), "https://example.invalid").searchParams.get("layout"), "v6");
  } finally {
    if (server === undefined) delete process.env.UAPT_V6_PUBLISHED_PAGES; else process.env.UAPT_V6_PUBLISHED_PAGES = server;
    if (client === undefined) delete process.env.NEXT_PUBLIC_UAPT_V6_PUBLISHED_PAGES; else process.env.NEXT_PUBLIC_UAPT_V6_PUBLISHED_PAGES = client;
  }
});

test("reading groups preserve quotations, distinct versions, separate dates, and claims lacking evidence", () => {
  const topic: LabTopic = {
    key: "coursework", title: "Coursework", status: "restricted", statusLabel: "Restricted",
    summary: "Scoped rule", scope: "Limited scope", basisKind: "record_analysis", actions: [], sources: [],
    claims: [
      {id: "claim-a", text: "Meaning retained.", checkedAt: "2026-10-12", evidence: [
        {quote: "Exact text.\n  Keep punctuation & whitespace.", url: "https://example.edu/policy", title: "Policy", language: "en", hash: "version-a", retrievedAt: "2026-09-14", location: "lines 1–2"},
        {quote: "A different captured version.", url: "https://example.edu/policy", title: "Policy", language: "en", hash: "version-b", retrievedAt: "2026-10-01"},
      ]},
      {id: "claim-no-evidence", text: "Retain the unresolved claim.", checkedAt: "2026-08-01", evidence: []},
    ],
  };
  const before = JSON.stringify(topic);
  const html = renderToStaticMarkup(<PolicyV6TopicEvidence topic={topic} locale="en" />);
  for (const claim of topic.claims) {
    assert(html.includes(claim.id));
    assert(html.includes(textHtml(claim.text)));
    for (const evidence of claim.evidence) assert(html.includes(textHtml(evidence.quote)));
  }
  assert.equal((html.match(/class="policy-v6-readerSource"/g) ?? []).length, 2);
  assert(html.includes("Source retrieved: 2026-09-14"));
  assert(html.includes("Claim checked: 2026-10-12"));
  assert(html.includes("data-evidence-gap=\"true\""));
  assert.equal(JSON.stringify(topic), before);
});

test("accepted Harvard content remains verbatim in both SSR presentations and retains the six topics", async () => {
  const data = await readingData();
  const before = JSON.stringify(data);
  const render = (readingLayout: boolean) => renderToStaticMarkup(<PolicyV6Provider data={data} readingLayout={readingLayout}>
    <PolicyV6Intro /><PolicyV6RecordTopics data={data} readingLayout={readingLayout} />
  </PolicyV6Provider>);
  const old = render(false), pilot = render(true);
  assert(pilot.includes('href="#snapshot-disclosure"'));
  assert(pilot.includes('href="#snapshot-privacy_data"'));
  assert(old.includes("How can I use AI in teaching?"));
  assert(!pilot.includes("How can I use AI in teaching?"));
  const school = data.schools.find(s => s.slug === "harvard-university")!;
  assert.equal(school.topics.length, 6);
  for (const topic of [...school.topics, ...school.additionalTopics]) {
    assert(pilot.includes(`id="snapshot-${topic.key}"`));
    assert(pilot.includes(textHtml(topic.summary)));
    assert(pilot.includes(textHtml(topic.statusLabel)));
    assert(pilot.includes(textHtml(topic.scope)));
    for (const claim of topic.claims) for (const evidence of claim.evidence) {
      assert(old.includes(textHtml(evidence.quote)));
      assert(pilot.includes(textHtml(evidence.quote)));
    }
  }
  assert.equal(JSON.stringify(data), before);
});

test("quote coalescing preserves all bindings and refuses different or unknown source versions", () => {
  const original = { quote: "Exact text, no normalization.", url: "https://example.edu/policy", title: "Policy", language: "en", hash: "version-a", retrievedAt: "2026-10-01", location: "line 1" };
  const variants = [
    original,
    { ...original, location: "line 9", retrievedAt: "2026-10-02" },
    { ...original, hash: "version-b" },
    { ...original, url: "https://another.edu/policy" },
    { ...original, language: "fr" },
    { ...original, quote: "Exact text, no normalization. " },
    { ...original, hash: undefined },
    { ...original, hash: undefined },
  ];
  const topic: LabTopic = {
    key: "approved_tools", title: "Tools", status: "unclear", statusLabel: "Unclear",
    summary: "Original", scope: "Original scope", basisKind: "record_analysis", actions: [], sources: [],
    claims: variants.map((evidence, index) => ({ id: `claim-${index}`, text: `Distinct claim ${index}`, checkedAt: `2026-09-${10 + index}`, evidence: [evidence] })),
  };
  const frozen = JSON.stringify(topic);
  const groups = groupPolicyV6ReadingEvidence(topic);
  const quotes = groups.flatMap(group => [...group.quotations.values()]);
  assert.equal(quotes.length, 7);
  assert.deepEqual(quotes.find(bindings => bindings.length === 2)?.map(b => b.claim.id), ["claim-0", "claim-1"]);
  assert.equal(quotes.flat().length, variants.length);
  const rendered = renderToStaticMarkup(<PolicyV6TopicEvidence topic={topic} locale="en" />);
  for (const claim of topic.claims) {
    assert(rendered.includes(claim.id));
    assert(rendered.includes(claim.text));
    assert(rendered.includes(claim.checkedAt!));
    assert(rendered.includes(claim.evidence[0].retrievedAt));
    assert(rendered.includes(claim.evidence[0].location));
  }
  assert(rendered.includes("Referenced by 2 claim records"));
  assert.equal(JSON.stringify(topic), frozen);
  // Topic-level versions never fill a missing per-evidence binding.
  topic.sources = [{ url: original.url, hash: "version-a" }];
  assert.equal(groupPolicyV6ReadingEvidence(topic).flatMap(g => [...g.quotations.values()]).length, 7);
  // An ambiguous accepted mapping must not arbitrarily choose one version.
  topic.sources.push({ url: original.url, hash: "version-b" });
  assert.equal(groupPolicyV6ReadingEvidence(topic).flatMap(g => [...g.quotations.values()]).length, 7);
});

test("Harvard collapses only 11 duplicate displays while preserving all 120 source-to-claim relationships", async () => {
  const data = await readingData();
  const school = data.schools.find(s => s.slug === "harvard-university")!;
  let before = 0, after = 0, bindings = 0;
  for (const topic of [...school.topics, ...school.additionalTopics]) {
    const original = topic.claims.flatMap(claim => claim.evidence.map((evidence, index) => ({ claim, evidence, index })));
    const groups = groupPolicyV6ReadingEvidence(topic);
    const actual = groups.flatMap(g => [...g.quotations.values()].flat());
    const identity = (b: typeof actual[number]) => JSON.stringify([b.claim.id, b.claim.text, b.claim.checkedAt, b.claim.basisObjectType, b.index, b.evidence]);
    assert.deepEqual(actual.map(identity).sort(), original.map(identity).sort());
    before += original.length;
    after += groups.reduce((count, group) => count + group.quotations.size, 0);
    bindings += actual.length;
  }
  assert.equal(before, 120);
  assert.equal(after, 109);
  assert.equal(bindings, 120);
  const html = renderToStaticMarkup(<PolicyV6Provider data={data} readingLayout><PolicyV6RecordTopics data={data} readingLayout /></PolicyV6Provider>);
  for (const topic of school.topics) assert(html.includes(`id="snapshot-scope-${topic.key}"`));
});


test("derivative excerpt digests stay in records but never identify or merge source versions", () => {
  const evidence = { quote: "An exact captured quotation.", url: "https://example.edu/policy", title: "Policy", language: "en", hash: "a".repeat(64) };
  const locations = [
    "Policy Statement; SHA256 refers to excerpt file, not original source bytes",
    "Supplied excerpt locator; capture SHA256; not original HTML/PDF bytes",
    "tool-extracted excerpt, not raw official bytes",
    "Retained tool-extracted UTF-8 excerpt; SHA is not raw source hash. Original page/offset unavailable.",
    "derivative capture, not verified raw HTML/PDF",
    "selected derivative excerpt SHA256; not original HTML/PDF/DOCX",
    "supplied excerpt only; declared capture unavailable locally; original HTML/PDF bytes not verified",
    "General Regulation VII 7.1; SHA-256 identifies this retained UTF-8 excerpt, not raw HTML/PDF; physical page and original offsets unavailable.",
  ];
  for (const location of locations) {
    const topic = { key: "coursework", claims: [
      { id: "source-a", basisObjectType: "source", text: "First binding", evidence: [{ ...evidence, location }] },
      { id: "source-b", basisObjectType: "source", text: "Second binding", evidence: [{ ...evidence, location }] },
    ] } as unknown as LabTopic;
    const original = JSON.stringify(topic);
    const groups = groupPolicyV6ReadingEvidence(topic);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].version, undefined);
    assert.equal(groups[0].quotations.size, 2, "Unproven versions must not merge identical text");
    const html = renderToStaticMarkup(<PolicyV6TopicEvidence topic={topic} locale="en" />);
    assert(html.includes('data-source-version="unknown"'));
    assert(html.includes(evidence.hash), "The derivative digest remains available in record details");
    assert.equal(JSON.stringify(topic), original, "Original quotation, locator and digest stay unchanged");
  }
});

test("missing versions come only from an exact original claim-evidence binding", async () => {
  const data = await getPolicyV6Data("en", "harvard-university");
  const raw = structuredClone(getLocalV6Evidence("harvard-university")!.record.claims);
  const frozen = JSON.stringify(data);
  const mapped = bindPolicyV6ReadingEvidence(data, raw);
  const original = raw.find(c => c.evidence.length && mapped.schools[0].topics.some(t => t.claims.some(v => v.id === c.id)))!;
  const e = original.evidence[0];
  const find = (value: typeof data) => value.schools[0].topics.flatMap(t => t.claims).find(c => c.id === original.id)!.evidence[0];
  assert.equal(find(mapped).hash, e.sourceSnapshotHash);
  e.sourceSnapshotHash = "";
  assert.equal(find(bindPolicyV6ReadingEvidence(data, raw)).hash, undefined);
  e.sourceSnapshotHash = "different-version";
  e.evidenceSnippet += " changed";
  assert.equal(find(bindPolicyV6ReadingEvidence(data, raw)).hash, undefined);
  e.evidenceSnippet = find(mapped).quote;
  original.evidence.push({ ...e, sourceSnapshotHash: "ambiguous-version" });
  assert.equal(find(bindPolicyV6ReadingEvidence(data, raw)).hash, undefined);
  assert.equal(JSON.stringify(data), frozen);
});
