import assert from "node:assert/strict";
import test from "node:test";
import { preservePolicyReferenceSearch } from "../apps/web/lib/policy-reference-preview";
import { stripV6Layout, v6NavigationUrl, v6RecordHref, v6ShareUrl, v6TopicUrl } from "../apps/web/lib/policy-v6-urls";

const path = "/universities/harvard-university";
const zh = "/zh" + path;
const absolute = "https://example.invalid" + path;
const filter = "compare=harvard-university%2Cuniversity-of-oxford&view=compare&differences=1&guide=concerns";
const anchor = "#snapshot-exams";

test("the language switcher strips public layout flags and keeps reading state", () => {
  assert.equal(preservePolicyReferenceSearch(zh + "?layout=v6&" + filter + anchor, "?layout=v6&" + filter, "production"), zh + "?" + filter + anchor);
  assert.equal(preservePolicyReferenceSearch(zh + anchor, "", "production"), zh + anchor);
  assert.equal(preservePolicyReferenceSearch(zh + anchor, "", "development"), zh + anchor);
  assert.equal(preservePolicyReferenceSearch(zh + anchor, "?layout=harvard-ui-lab&" + filter, "development"), zh + "?layout=v6&" + filter + anchor);
});

test("comparison share URLs preserve useful parameters and only keep an explicit development preview", () => {
  const selection = ["harvard-university", "university-of-oxford"];
  const share = (href: string, environment: string) => new URL(v6ShareUrl(href, selection, environment));
  const url = share(absolute + "?layout=v6&" + filter + anchor, "production");
  assert.equal(url.href, absolute + "?" + filter + anchor);
  assert.equal(share(absolute + "?layout=v6", "development").searchParams.get("layout"), "v6");
  assert.equal(share(absolute, "development").searchParams.has("layout"), false);
  assert.equal(v6ShareUrl(absolute + "?layout=v6&" + filter + anchor, selection.slice(0, 1), "production"), absolute + "?differences=1&guide=concerns" + anchor);
});

test("topic and concern links keep their destination and carry only explicit development previews", () => {
  assert.equal(v6TopicUrl(absolute + "?layout=v6&" + filter + anchor, "disclosure", "production"), absolute + "?differences=1&guide=concerns#snapshot-evidence-disclosure");
  assert.equal(v6TopicUrl(absolute + "?layout=harvard-ui-lab", "exams", "development"), absolute + "?layout=harvard-ui-lab#snapshot-evidence-exams");
  assert.equal(v6TopicUrl(absolute, "exams", "development"), absolute + "#snapshot-evidence-exams");
  assert.equal(v6NavigationUrl(absolute + "?layout=reference-v4&guide=concerns" + anchor, "production").href, absolute + "?guide=concerns" + anchor);
});

test("old production URLs replace the same history entry and retain other params, hash and state", () => {
  const state = { routeState: 42 };
  const calls: [unknown, string, string][] = [];
  const history = { state, replaceState(data: unknown, unused: string, url: string | URL | null | undefined) {
    calls.push([data, unused, String(url)]);
  }};
  stripV6Layout(absolute + "?layout=v6&layout=old&" + filter + anchor, history, "production");
  stripV6Layout(absolute + "?" + filter + anchor, history, "production");
  stripV6Layout(absolute + "?layout=v6&" + filter + anchor, history, "development");
  assert.deepEqual(calls, [[state, "", absolute + "?" + filter + anchor]]);
});


test("record links in comparison and related schools stay clean unless a development preview is active", () => {
  assert.equal(v6RecordHref(zh, "harvard-university", "v6", "production"), zh);
  assert.equal(v6RecordHref(zh, "harvard-university", undefined, "development"), zh);
  assert.equal(v6RecordHref(zh, "harvard-university", "reference-v4", "development"), zh);
  assert.equal(v6RecordHref(zh, "harvard-university", "v6", "development"), zh + "?layout=v6");
});
