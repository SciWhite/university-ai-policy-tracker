import assert from "node:assert/strict";
import test from "node:test";

test("the canonical university API reads published data without fetching itself", { timeout: 30000 }, async () => {
  const keys = ["INTERNAL_NEXT_BASE_URL", "UAPT_DISABLE_INTERNAL_FETCH", "UAPT_V6_PUBLISHED_PAGES"] as const;
  const previous = keys.map(key => process.env[key]);
  const originalFetch = globalThis.fetch;
  process.env.INTERNAL_NEXT_BASE_URL = "http://127.0.0.1:3189";
  delete process.env.UAPT_DISABLE_INTERNAL_FETCH;
  process.env.UAPT_V6_PUBLISHED_PAGES = "1";
  let fetches = 0;
  globalThis.fetch = async () => { fetches++; throw Error("The canonical API must not request its own URL"); };
  try {
    const { GET } = await import("../apps/web/app/api/public/v1/universities/[...slug]/route");
    const { getLocalPublicUniversitySummaryBySlug } = await import("../apps/web/lib/catalog");
    for (const slug of ["aarhus-university", "harvard-university"]) {
      const response = await GET(new Request(`http://127.0.0.1:3189/api/public/v1/universities/${slug}.json`), { params: Promise.resolve({ slug: [`${slug}.json`] }) });
      const body = await response.json();
      const local = await getLocalPublicUniversitySummaryBySlug(slug);
      assert.equal(response.status, 200);
      assert.equal(body.data.entity.slug, slug);
      assert.deepEqual(body.data.claims, JSON.parse(JSON.stringify(local!.claims)), "Claim IDs, original evidence and held exclusions remain canonical");
    }
    const missing = await GET(new Request("http://127.0.0.1:3189/api/public/v1/universities/not-a-university.json"), { params: Promise.resolve({ slug: ["not-a-university.json"] }) });
    assert.equal(missing.status, 404);
    assert.equal(fetches, 0);
  } finally {
    globalThis.fetch = originalFetch;
    keys.forEach((key, index) => previous[index] === undefined ? delete process.env[key] : process.env[key] = previous[index]);
  }
});
