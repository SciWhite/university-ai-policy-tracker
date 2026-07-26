import type { SourceHealthStatus } from "@/lib/review-dashboards";
import { badgeToneClass, type BadgeTone } from "@/lib/badge-tones";
import { DEFAULT_LOCALE, type SupportedLocale } from "@/lib/i18n";
import { translateSurfaceText } from "@/lib/surface-localization";

const labels: Record<SourceHealthStatus, string> = {
  agent_blocked_captcha_waf: "Agent WAF block",
  agent_blocked_login: "Agent login block",
  agent_blocked_robots: "Agent robots block",
  agent_fetch_failed: "Agent failed",
  agent_unresolved: "Agent unresolved",
  agent_verified_404: "Agent 404",
  agent_verified_accessible: "Agent verified",
  agent_verified_empty: "Agent empty",
  agent_verified_redirect_unrelated: "Agent redirect",
  blocked_by_client: "Client blocked",
  browser_timeout_unverified: "Browser timeout",
  browser_verified: "Browser verified",
  captcha_or_waf: "CAPTCHA/WAF",
  changed_hash: "Changed hash",
  firecrawl_failed: "Firecrawl failed",
  firecrawl_opened_no_content: "Firecrawl opened",
  firecrawl_verified: "Firecrawl verified",
  forbidden: "Forbidden",
  login_wall: "Login wall",
  not_found: "Not found",
  ok: "OK",
  paywall: "Paywall",
  redirected: "Redirected",
  rejected_not_policy_evidence: "Not policy evidence",
  robots_blocked: "Robots blocked",
  unknown_error: "Unknown error"
};

const tones: Record<SourceHealthStatus, BadgeTone> = {
  ok: "positive",
  redirected: "positive",
  agent_verified_accessible: "positive",
  rejected_not_policy_evidence: "positive",
  browser_verified: "positive",
  firecrawl_verified: "positive",
  changed_hash: "warning",
  not_found: "warning",
  agent_fetch_failed: "warning",
  agent_unresolved: "warning",
  agent_verified_404: "warning",
  agent_verified_empty: "warning",
  agent_verified_redirect_unrelated: "warning",
  blocked_by_client: "warning",
  browser_timeout_unverified: "warning",
  firecrawl_opened_no_content: "warning",
  unknown_error: "warning",
  forbidden: "danger",
  robots_blocked: "danger",
  login_wall: "danger",
  paywall: "danger",
  agent_blocked_captcha_waf: "danger",
  agent_blocked_login: "danger",
  agent_blocked_robots: "danger",
  firecrawl_failed: "danger",
  captcha_or_waf: "danger"
};

interface SourceHealthLabelProps {
  status: SourceHealthStatus;
  locale?: SupportedLocale;
}

export function SourceHealthLabel({ locale = DEFAULT_LOCALE, status }: SourceHealthLabelProps) {
  return (
    <span
      className={badgeToneClass("source-health-label", tones[status])}
      data-source-health={status}
    >
      {translateSurfaceText(labels[status], locale)}
    </span>
  );
}
