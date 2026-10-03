import { test } from "node:test";
import assert from "node:assert/strict";
import { requestAnalyticsOptedOut, setAnalyticsOptOut, ANALYTICS_OPTOUT_KEY } from "../apps/web/lib/analytics-preference";
test("server honors only the exact analytics opt-out cookie", () => {
  assert.equal(requestAnalyticsOptedOut(new Headers({cookie:"theme=dark; uapt_analytics_opt_out=1"})),true);
  assert.equal(requestAnalyticsOptedOut(new Headers({cookie:"uapt_analytics_opt_out=0"})),false);
  assert.equal(requestAnalyticsOptedOut(new Headers({cookie:"not_uapt_analytics_opt_out=1"})),false);
});
test("opting out clears analytics identifiers but preserves preference and other settings", () => {
  const local: { [key: string]: unknown } = { "uapt.analytics.visitor_id":"visitor", "uapt.analytics.session_state":"session", "uapt.analytics.landing_context":"landing", "theme":"dark" };
  const session: { [key:string]:unknown } = { "uapt.analytics.session_id":"legacy", "language":"zh" };
  for(const storage of [local,session]) {
    Object.defineProperty(storage,"setItem",{value:(k:string,v:string)=>{storage[k]=v;}});
    Object.defineProperty(storage,"removeItem",{value:(k:string)=>{delete storage[k];}});
  }
  const previous = { window:globalThis.window, document:globalThis.document, location:globalThis.location };
  try {
    Object.assign(globalThis,{window:{localStorage:local,sessionStorage:session,dispatchEvent:()=>{}},document:{cookie:""},location:{protocol:"https:"}});
    setAnalyticsOptOut(true);
    assert.deepEqual(Object.keys(local).sort(),["theme",ANALYTICS_OPTOUT_KEY].sort());
    assert.deepEqual(Object.keys(session),["language"]);
    assert.ok(document.cookie.includes("uapt_analytics_opt_out=1"));assert.ok(document.cookie.includes("Secure"));
    setAnalyticsOptOut(false);assert.equal(local[ANALYTICS_OPTOUT_KEY],"0");
  } finally { Object.assign(globalThis,previous); }
});
