import assert from "node:assert/strict";
import { SUPPORTED_LOCALES, withLocalePrefix } from "../apps/web/lib/i18n";
import { getTrustContent } from "../apps/web/lib/trust-content";
async function main() {
  const base = process.env.UAPT_SITE_CHECK_ORIGIN ?? "http://127.0.0.1:3120";
  const kinds = ["contact","support","privacy","terms","mcp"] as const;
  let checked = 0;
  for (const locale of SUPPORTED_LOCALES) {
    const text = getTrustContent(locale);
    await Promise.all(kinds.map(async (kind,index) => {
      const path = withLocalePrefix(`/${kind}`,locale);
      const response = await fetch(new URL(path,base),{signal:AbortSignal.timeout(60000)});
      assert.equal(response.status,200,path);
      const html = await response.text();
      assert.ok(html.includes('data-trust-layout="v4"'),`${path}: V4 shared layout`);
      assert.ok(html.includes(`<h1 class="home-v4__title">${text.labels[index]}</h1>`),`${path}: localized heading`);
      assert.ok(html.includes('aria-current="page"'),`${path}: navigation current state`);
      if (kind === "privacy") assert.ok(html.includes("<h2>"),`${path}: separate data practices`);
      checked++;
    }));
  }
  console.log(JSON.stringify({origin:base,routes:checked,style:"V4 markup and localized HTTP content passed",browserVisualReview:"separate"}));
}
main().catch(error => {console.error(error instanceof Error ? error.message : "Trust page HTTP check failed");process.exitCode=1;});
