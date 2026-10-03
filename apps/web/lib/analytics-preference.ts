export const ANALYTICS_OPTOUT_KEY = "uapt.analytics.opt_out";
export const ANALYTICS_OPTOUT_COOKIE = "uapt_analytics_opt_out";
export function requestAnalyticsOptedOut(headers: Headers) {
  return /(?:^|;\s*)uapt_analytics_opt_out=1(?:;|$)/.test(headers.get("cookie") ?? "");
}
export function analyticsOptedOut() {
  if (typeof window === "undefined") return false;
  if (requestAnalyticsOptedOut(new Headers({ cookie: document.cookie }))) return true;
  try { return window.localStorage.getItem(ANALYTICS_OPTOUT_KEY) === "1"; } catch { return false; }
}
export function setAnalyticsOptOut(disabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ANALYTICS_OPTOUT_KEY, disabled ? "1" : "0");
    if (disabled) for (const storage of [window.localStorage, window.sessionStorage]) {
      for (const key of Object.keys(storage)) if (key.startsWith("uapt.analytics.") && key !== ANALYTICS_OPTOUT_KEY) storage.removeItem(key);
    }
  } catch { /* The cookie preserves the choice if browser storage is unavailable. */ }
  document.cookie = `${ANALYTICS_OPTOUT_COOKIE}=${disabled ? "1" : "0"}; Path=/; Max-Age=34128000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  window.dispatchEvent(new Event("uapt-analytics-preference"));
}
