import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readDevelopmentPreviewQuery } from "../apps/web/lib/development-preview-query";
import { policyV6ClientData } from "../apps/web/lib/policy-v6-client-data";
import { getPolicyV6Data } from "../apps/web/lib/policy-v6";
import { readPublishedV6 } from "../apps/web/lib/policy-v6-published";
import { generateMetadata as universityMetadata } from "../apps/web/app/(default)/universities/[slug]/page";

process.env.UAPT_V6_PUBLISHED_PAGES = "1";
process.env.UAPT_DISABLE_INTERNAL_FETCH = "1";

const unread = <T,>() => ({ then() { throw new Error("production public page must not read searchParams"); } }) as unknown as Promise<T>;

test("preview query flags are read only under next dev", async () => {
  assert.equal(await readDevelopmentPreviewQuery(unread<{ layout: string }>(), "production"), undefined);
  assert.equal(await readDevelopmentPreviewQuery(unread<{ layout: string }>(), "test"), undefined);
  assert.deepEqual(await readDevelopmentPreviewQuery(Promise.resolve({ layout: "v6" }), "development"), { layout: "v6" });
  assert.deepEqual(await readDevelopmentPreviewQuery(undefined, "development"), {});
});

test("public home and university pages never await searchParams directly", () => {
  for (const file of ["../apps/web/app/(default)/page.tsx", "../apps/web/app/(default)/universities/[slug]/page.tsx"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /await searchParams/, file);
  }
});

test("university metadata renders its public layout without reading the query", async () => {
  for (const slug of ["harvard-university", "eth-zurich", "university-of-tulsa"]) {
    const metadata = await universityMetadata({ params: Promise.resolve({ slug }), searchParams: unread() });
    assert(metadata.title, slug);
    assert.notEqual(metadata.robots && typeof metadata.robots === "object" ? metadata.robots.index : undefined, false, slug);
  }
});

test("V6 provider payload carries only client-rendered fields", async () => {
  const published = readPublishedV6()!;
  for (const current of published.locales.en.schools) {
    const data = await getPolicyV6Data("en", current.slug);
    const client = policyV6ClientData(data);
    assert.equal(client.currentSlug, data.currentSlug);
    assert.equal("schoolNames" in client, false, current.slug);
    for (const school of client.schools) {
      assert.equal("heldClaims" in school, false);
      for (const topic of [...school.topics, ...school.additionalTopics]) {
        assert.equal("claims" in topic, false, `${current.slug}/${topic.key}`);
        const original = [...data.schools[0].topics, ...data.schools[0].additionalTopics].find(t => t.key === topic.key)!;
        assert.deepEqual(topic.sources, original.sources);
        assert.equal(topic.summary, original.summary);
      }
    }
    if (data.studentActions) {
      const guide = client.studentActions!;
      const used = new Set([...guide.do, ...guide.dont].flatMap(action => action.claimIds));
      Object.values(guide.procedures).flat().forEach(id => used.add(id));
      assert.deepEqual(new Set(Object.keys(guide.claims)), used, current.slug);
      for (const id of used) assert.deepEqual(guide.claims[id], data.studentActions.claims[id]);
    }
    assert(JSON.stringify(client).length < JSON.stringify(data).length, current.slug);
  }
});
