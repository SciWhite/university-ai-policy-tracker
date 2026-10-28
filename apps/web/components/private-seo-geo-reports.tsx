import React from "react";
import type { SeoGeoReport, SeoGeoReports, SeoGeoReportState } from "@/lib/seo-geo-report-types";

const states: Record<SeoGeoReportState, [string, string]> = {
  ready: ["报告已验证", "Report verified"], not_configured: ["未配置报告目录", "Report directory not configured"],
  not_run: ["尚未运行", "Not run"], read_error: ["报告读取失败", "Report read failed"],
  unsupported_version: ["未知报告版本", "Unsupported report version"], missing_provenance: ["来源或哈希验证失败", "Provenance or hash verification failed"],
  invalid_report: ["报告格式无效", "Invalid report format"]
};
export function PrivateSeoGeoReports({ reports, locale }: { reports: SeoGeoReports; locale: "en" | "zh" }) {
  const zh = locale === "zh";
  return <section className="analytics-seo-reports" aria-label={zh ? "SEO 与 GEO 诊断" : "SEO and GEO diagnostics"}>
    <p className="analytics-comparison-note">{zh ? "扫描报告不受上方站内日期筛选影响。技术检查、GEO 准备度、受控引用实验和政策证据分别验收；实验室分数不表示收录、自然引用或政策准确性。打开页面只读取私有报告。" : "Scan reports keep their own observation periods. Technical checks, GEO readiness, controlled citation experiments and policy evidence are assessed independently. Lab scores do not establish indexing, organic citations or policy accuracy. This page only reads private reports."}</p>
    {(["technical", "geo", "citations"] as const).map(kind => {
      const report = reports[kind];
      const title = kind === "technical" ? zh ? "技术体检 · Unlighthouse" : "Technical checks · Unlighthouse" : kind === "geo" ? zh ? "GEO 问题与修复" : "GEO findings and repairs" : zh ? "AI 引用实验 · Elmo" : "AI citation experiments · Elmo";
      return <details className="analytics-detail-section" key={kind} open>
        <summary><span>{kind === "technical" ? "07F" : kind === "geo" ? "07G" : "07H"}</span><strong>{title} · {states[report.state][zh ? 0 : 1]}</strong><i /></summary>
        <div className="analytics-detail-section__body">
          {report.runId ? <p className="analytics-comparison-note"><b>{report.runId}</b> · {report.version} / {report.rulesVersion} · {report.target} · {report.device} · <time dateTime={report.completedAt}>{report.completedAt}</time><br />{zh ? "工具源码" : "Tool source"}: <code>{report.sourceCommit}</code> · {zh ? "配置 SHA256" : "Config SHA256"}: <code>{report.configSha256 ?? "—"}</code></p> : null}
          {report.pages.map(page => <details className="analytics-seo-page" key={page.requestedUrl}>
            <summary><span>{page.requestedUrl}</span><strong>{page.state === "failed" ? zh ? "扫描失败" : "Scan failed" : Object.entries(page.scores).map(([key, score]) => `${key}: ${score === null ? "—" : Math.round(key === "readiness" ? score : score * 100)}`).join(" · ")}</strong></summary>
            <p>{page.template} · {page.locale} · <time dateTime={page.measuredAt}>{page.measuredAt}</time></p>
            <dl className="analytics-seo-provenance"><dt>URL →</dt><dd>{page.finalUrl}</dd><dt>Code SHA</dt><dd><code>{page.codeSha}</code></dd><dt>Raw SHA256</dt><dd><code>{page.rawSha256}</code></dd><dt>HTML SHA256</dt><dd><code>{page.contentSha256}</code></dd></dl>
            <div className="analytics-table-wrap"><table className="analytics-table"><thead><tr><th>ID</th><th>{zh ? "检查" : "Check"}</th><th>{zh ? "分项" : "Score"}</th><th>{zh ? "证据" : "Evidence"}</th></tr></thead><tbody>{page.checks.map(check => <tr key={check.id}><td>{check.id}</td><td>{check.title}</td><td>{check.score ?? "—"} / {check.max}</td><td>{check.evidence}</td></tr>)}</tbody></table></div>
            {page.recommendations.length ? <details><summary>{zh ? "工具原始建议（待判断）" : "Upstream recommendations (unreviewed)"} · {page.recommendations.length}</summary><ul>{page.recommendations.map((recommendation, i) => <li key={i}>{recommendation}</li>)}</ul></details> : null}
            {page.issues.map((issue, i) => <article className="analytics-seo-issue" key={`${issue.checkId}:${i}`}><b>{issue.priority} · {issue.checkId} · {issue.status}</b><p>{issue.evidence}</p><p>{zh ? "预期" : "Expected"}: {issue.expected}</p><code>{issue.source}</code>{issue.retest ? <p>{issue.retest.runId} · {issue.retest.target} · {issue.retest.result} · <code>{issue.retest.rawSha256}</code></p> : null}</article>)}
          </details>)}
          {kind === "citations" ? <CitationResults report={report} zh={zh} /> : null}
        </div>
      </details>;
    })}
  </section>;
}
function CitationResults({ report, zh }: { report: SeoGeoReport; zh: boolean }) {
  const count = report.experiments.length;
  const mentions = report.experiments.filter(s => s.mention).length;
  const citations = report.experiments.filter(s => s.citedUrls.some(url => new URL(url).hostname === "eduaipolicy.org")).length;
  return <>
    {report.plan ? <p>{report.plan.questionSet} · {report.plan.locales.join(", ")} · {report.plan.models.join(", ")} · {report.plan.repetitions} {zh ? "次/题" : "samples per question"}</p> : null}
    <p>{zh ? "样本数" : "Samples"}: {count} · {zh ? "提及率" : "Mention rate"}: {count ? `${Math.round(mentions / count * 100)}%` : "—"} · {zh ? "本站真实引用率" : "Site citation rate"}: {count ? `${Math.round(citations / count * 100)}%` : "—"}</p>
    <p>{zh ? "仅提供商返回的来源 URL 计入引用；与自然 Bing 引用、站内 AI 转介分开展示。" : "Only provider-returned source URLs count as citations. These experiments are separate from organic Bing citations and onsite AI referrals."}</p>
    {report.experiments.map((sample, i) => <details key={i}><summary>{sample.promptId} · {sample.locale} · {sample.model} · {sample.answeredAt}</summary><p className="analytics-seo-answer">{sample.answer}</p><ul>{sample.citedUrls.map(url => <li key={url}>{url}</li>)}</ul><code>{sample.rawSha256}</code></details>)}
  </>;
}
