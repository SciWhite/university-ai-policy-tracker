import type { SourceHealthStatus } from "@/lib/review-dashboards";

const labels: Record<SourceHealthStatus, string> = {
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
  robots_blocked: "Robots blocked",
  unknown_error: "Unknown error"
};

interface SourceHealthLabelProps {
  status: SourceHealthStatus;
}

export function SourceHealthLabel({ status }: SourceHealthLabelProps) {
  return (
    <span className="source-health-label" data-source-health={status}>
      {labels[status]}
    </span>
  );
}
