const embedScript = `(() => {
  const script = document.currentScript;
  if (!script || !script.parentNode) return;

  const origin = new URL(script.src).origin;
  const widgetType = script.dataset.widget || "university-status";
  const slug = script.dataset.slug || "anu";
  const limit = clampNumber(Number(script.dataset.limit || "5"), 1, 10);
  const mount = document.createElement("div");
  mount.setAttribute("data-uapt-widget-root", widgetType);
  script.parentNode.insertBefore(mount, script);

  const shadow = mount.attachShadow({ mode: "open" });
  shadow.innerHTML = baseStyles() + '<article class="uapt-card"><p class="uapt-muted">Loading University AI Policy Tracker widget...</p></article>';

  const endpoint = buildEndpoint(widgetType, slug, limit);

  fetch(endpoint, { headers: { Accept: "application/json" } })
    .then((response) => {
      if (!response.ok) throw new Error("Widget request failed: " + response.status);
      return response.json();
    })
    .then((payload) => {
      shadow.innerHTML =
        baseStyles() +
        renderWidget(widgetType, payload);
    })
    .catch((error) => {
      shadow.innerHTML =
        baseStyles() +
        '<article class="uapt-card"><p class="uapt-label">University AI Policy Tracker</p><p class="uapt-muted">' +
        escapeHtml(error.message || "Unable to load widget.") +
        '</p><a class="uapt-link" href="' +
        origin +
        '/widgets" target="_blank" rel="noopener">Widget documentation</a></article>';
    });

  function buildEndpoint(type, entitySlug, itemLimit) {
    if (type === "recent-changes") {
      return origin + "/api/public/v1/widgets/recent-changes.json?limit=" + encodeURIComponent(String(itemLimit));
    }
    const encodedSlug = encodeURIComponent(entitySlug);
    if (type === "policy-coverage") return origin + "/api/public/v1/widgets/policy-coverage/" + encodedSlug + ".json";
    if (type === "source-freshness") return origin + "/api/public/v1/widgets/source-freshness/" + encodedSlug + ".json";
    if (type === "review-state") return origin + "/api/public/v1/widgets/review-state/" + encodedSlug + ".json";
    return origin + "/api/public/v1/widgets/university-status/" + encodedSlug + ".json";
  }

  function renderWidget(type, payload) {
    if (type === "recent-changes") return renderRecentChanges(payload);
    if (type === "policy-coverage") return renderPolicyCoverage(payload);
    if (type === "source-freshness") return renderSourceFreshness(payload);
    if (type === "review-state") return renderReviewState(payload);
    return renderUniversityStatus(payload);
  }

  function renderUniversityStatus(payload) {
    const data = payload.data || {};
    const recordUrl = data.publicPageUrl || payload.canonicalUrl || origin + "/universities";
    const checked = formatDate(data.lastCheckedAt);
    const changed = formatDate(data.lastChangedAt);
    const candidateLine =
      Number(data.candidateClaimCount || 0) > 0
        ? '<p class="uapt-warning">' + escapeHtml(String(data.candidateClaimCount)) + " candidate or non-reviewed claim(s) remain labeled.</p>"
        : "";

    return (
      '<article class="uapt-card">' +
      '<div class="uapt-row"><p class="uapt-label">University AI policy record</p><span class="uapt-state">' +
      escapeHtml(formatState(data.reviewState)) +
      "</span></div>" +
      '<h2><a href="' +
      escapeAttr(recordUrl) +
      '" target="_blank" rel="noopener">' +
      escapeHtml(data.entityName || "University record") +
      "</a></h2>" +
      '<p class="uapt-summary">' +
      escapeHtml(data.summaryPreview || "Source-backed policy metadata record.") +
      "</p>" +
      '<dl class="uapt-meta"><div><dt>Last checked</dt><dd>' +
      escapeHtml(checked) +
      "</dd></div><div><dt>Last changed</dt><dd>" +
      escapeHtml(changed) +
      "</dd></div><div><dt>Claims</dt><dd>" +
      escapeHtml(String(data.claimCount || 0)) +
      "</dd></div><div><dt>Sources</dt><dd>" +
      escapeHtml(String(data.officialSourceCount || 0)) +
      "</dd></div></dl>" +
      candidateLine +
      '<p class="uapt-footer"><a href="' +
      escapeAttr(recordUrl) +
      '" target="_blank" rel="noopener">Open canonical record</a><span>Evidence-backed public data</span></p>' +
      "</article>"
    );
  }

  function renderRecentChanges(payload) {
    const changes = ((payload.data || {}).changes || []).slice(0, limit);
    const items = changes
      .map((item) => {
        const url = item.changeUrl || item.publicPageUrl || origin + "/changes";
        return (
          '<li><a href="' +
          escapeAttr(url) +
          '" target="_blank" rel="noopener">' +
          escapeHtml(item.entityName || "University record") +
          '</a><span class="uapt-muted">' +
          escapeHtml(formatState(item.reviewState)) +
          " - checked " +
          escapeHtml(formatDate(item.lastCheckedAt)) +
          "</span></li>"
        );
      })
      .join("");

    return (
      '<article class="uapt-card"><div class="uapt-row"><p class="uapt-label">Recent AI policy checks</p><span class="uapt-state">Read-only</span></div>' +
      '<ul class="uapt-list">' +
      items +
      '</ul><p class="uapt-footer"><a href="' +
      origin +
      '/changes" target="_blank" rel="noopener">Open change log</a><span>Candidate data remains labeled</span></p></article>'
    );
  }

  function renderPolicyCoverage(payload) {
    const data = payload.data || {};
    const recordUrl = data.publicPageUrl || payload.canonicalUrl || origin + "/analysis";
    return (
      '<article class="uapt-card">' +
      '<div class="uapt-row"><p class="uapt-label">Policy coverage</p><span class="uapt-state">' +
      escapeHtml(formatState(data.reviewState)) +
      "</span></div>" +
      '<h2><a href="' +
      escapeAttr(recordUrl) +
      '" target="_blank" rel="noopener">' +
      escapeHtml(data.entityName || "University record") +
      "</a></h2>" +
      '<p class="uapt-score">' +
      escapeHtml(String(data.coverageScore || 0)) +
      "/" +
      escapeHtml(String(data.coverageMaxScore || 100)) +
      "</p>" +
      '<p class="uapt-summary">' +
      escapeHtml(data.summaryPreview || "Source-backed coverage metadata.") +
      "</p>" +
      '<dl class="uapt-meta"><div><dt>Evidence-backed dimensions</dt><dd>' +
      escapeHtml(String(data.evidenceBackedDimensionCount || 0)) +
      "/" +
      escapeHtml(String(data.dimensionCount || 0)) +
      "</dd></div><div><dt>Source languages</dt><dd>" +
      escapeHtml(String(data.sourceLanguageCount || 0)) +
      "</dd></div></dl>" +
      '<p class="uapt-footer"><a href="' +
      escapeAttr(recordUrl) +
      '" target="_blank" rel="noopener">Open analysis basis</a><span>Not policy quality</span></p>' +
      "</article>"
    );
  }

  function renderSourceFreshness(payload) {
    const data = payload.data || {};
    const recordUrl = data.publicPageUrl || payload.canonicalUrl || origin + "/universities";
    const okCount = (data.sourceHealthCounts || {}).ok || 0;
    return (
      '<article class="uapt-card">' +
      '<div class="uapt-row"><p class="uapt-label">Source freshness</p><span class="uapt-state">' +
      escapeHtml(formatState(data.reviewState)) +
      "</span></div>" +
      '<h2><a href="' +
      escapeAttr(recordUrl) +
      '" target="_blank" rel="noopener">' +
      escapeHtml(data.entityName || "University record") +
      "</a></h2>" +
      '<p class="uapt-summary">' +
      escapeHtml(data.summaryPreview || "Promoted source snapshot metadata.") +
      "</p>" +
      '<dl class="uapt-meta"><div><dt>Last checked</dt><dd>' +
      escapeHtml(formatDate(data.lastCheckedAt)) +
      "</dd></div><div><dt>Sources</dt><dd>" +
      escapeHtml(String(data.officialSourceCount || 0)) +
      "</dd></div><div><dt>OK health rows</dt><dd>" +
      escapeHtml(String(okCount)) +
      "</dd></div><div><dt>Last changed</dt><dd>" +
      escapeHtml(formatDate(data.lastChangedAt)) +
      "</dd></div></dl>" +
      '<p class="uapt-footer"><a href="' +
      escapeAttr(recordUrl) +
      '" target="_blank" rel="noopener">Open source-backed record</a><span>No live recrawl guarantee</span></p>' +
      "</article>"
    );
  }

  function renderReviewState(payload) {
    const data = payload.data || {};
    const recordUrl = data.publicPageUrl || payload.canonicalUrl || origin + "/universities";
    return (
      '<article class="uapt-card">' +
      '<div class="uapt-row"><p class="uapt-label">Review state</p><span class="uapt-state">' +
      escapeHtml(formatState(data.reviewState)) +
      "</span></div>" +
      '<h2><a href="' +
      escapeAttr(recordUrl) +
      '" target="_blank" rel="noopener">' +
      escapeHtml(data.entityName || "University record") +
      "</a></h2>" +
      '<p class="uapt-summary">' +
      escapeHtml(data.summaryPreview || "Review state and claim-count metadata.") +
      "</p>" +
      '<dl class="uapt-meta"><div><dt>Claims</dt><dd>' +
      escapeHtml(String(data.claimCount || 0)) +
      "</dd></div><div><dt>Reviewed</dt><dd>" +
      escapeHtml(String(data.reviewedClaimCount || 0)) +
      "</dd></div><div><dt>Candidate</dt><dd>" +
      escapeHtml(String(data.candidateClaimCount || 0)) +
      "</dd></div><div><dt>Confidence</dt><dd>" +
      escapeHtml(formatPercent(data.confidence)) +
      "</dd></div></dl>" +
      '<p class="uapt-footer"><a href="' +
      escapeAttr(recordUrl) +
      '" target="_blank" rel="noopener">Open canonical record</a><span>Review state is not confidence</span></p>' +
      "</article>"
    );
  }

  function baseStyles() {
    return '<style>:host{color-scheme:light dark}.uapt-card{box-sizing:border-box;max-width:560px;border:1px solid #d0d7de;border-radius:8px;background:#fff;color:#24292f;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:16px}.uapt-row{display:flex;align-items:center;gap:8px;justify-content:space-between}.uapt-label{margin:0;color:#57606a;font-size:12px;font-weight:700;text-transform:uppercase}.uapt-state{border:1px solid #d0d7de;border-radius:999px;color:#57606a;font-size:12px;padding:2px 8px;white-space:nowrap}.uapt-card h2{font-size:18px;line-height:1.25;margin:10px 0 6px}.uapt-card a{color:#0969da;text-decoration:none}.uapt-card a:hover{text-decoration:underline}.uapt-summary,.uapt-muted,.uapt-warning{margin:0;color:#57606a}.uapt-score{font-size:28px;font-weight:800;margin:8px 0;color:#24292f}.uapt-warning{background:#fff8c5;border:1px solid #d4a72c;border-radius:6px;color:#633c01;margin-top:12px;padding:8px}.uapt-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:14px 0 0}.uapt-meta div{border-top:1px solid #d8dee4;padding-top:8px}.uapt-meta dt{color:#57606a;font-size:12px}.uapt-meta dd{font-weight:600;margin:2px 0 0}.uapt-list{display:grid;gap:10px;list-style:none;margin:12px 0 0;padding:0}.uapt-list li{display:grid;gap:2px;border-top:1px solid #d8dee4;padding-top:10px}.uapt-footer{display:flex;gap:8px;justify-content:space-between;margin:14px 0 0;color:#57606a;font-size:12px}@media(prefers-color-scheme:dark){.uapt-card{background:#0d1117;border-color:#30363d;color:#e6edf3}.uapt-state,.uapt-meta div,.uapt-list li{border-color:#30363d}.uapt-label,.uapt-summary,.uapt-muted,.uapt-footer{color:#8b949e}.uapt-score{color:#e6edf3}.uapt-card a{color:#58a6ff}.uapt-warning{background:#3b2300;border-color:#9e6a03;color:#f2cc60}}</style>';
  }

  function formatState(value) {
    return String(value || "unknown").replace(/_/g, " ");
  }

  function formatDate(value) {
    if (!value) return "not published";
    try {
      return new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric"
      }).format(new Date(value));
    } catch {
      return String(value);
    }
  }

  function clampNumber(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(Math.trunc(value), max));
  }

  function formatPercent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "not published";
    return Math.round(number * 100) + "%";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/\\n/g, "");
  }
})();`;

export const dynamic = "force-static";

export function GET() {
  return new Response(embedScript, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Content-Type": "application/javascript; charset=utf-8"
    }
  });
}
