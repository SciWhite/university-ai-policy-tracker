"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { PolicyV6Data, LabSchool } from "@/lib/policy-v6";
import { policyV6StatusTone } from "@/lib/policy-v6-status";
import { policyV6AgentReviewLabel } from "@/lib/policy-v6-review";
import { policyV6RecordCopy } from "@/lib/policy-v6-record-copy";
import { policyV6DensityCopy } from "@/lib/policy-v6-density-copy";
import { policyV6Copy } from "@/lib/policy-v6-copy";
import type { PageToolRecord } from "./university-ai-tools";
import { PolicyV6Popover, PolicyV6ActionIcon } from "./policy-v6-popover";
import { PolicyV6Share } from "./policy-v6-share";
import { PolicyV6SearchPicker } from "./policy-v6-search-picker";
import { UniversityMark } from "./university-mark";
import { canonicalUniversitySlugs } from "@/lib/canonical-university-slug";
import { policyV6InteractionCopy } from "@/lib/policy-v6-interaction-copy";
import { UNIVERSITY_POLICY_PLUGIN_URL } from "@/lib/plugin-directory";
import { pluginPromotionCopy } from "@/lib/plugin-promotion";
import {PolicyV6StudentGuide} from './policy-v6-student-guide';
const v6Classes = {
  actions: "policy-v6-actions",
  badge: "policy-v6-badge",
  bottom: "policy-v6-bottom",
  checklist: "policy-v6-checklist",
  copyFallback: "policy-v6-copyFallback",
  faq: "policy-v6-faq",
  filters: "policy-v6-filters",
  intro: "policy-v6-intro",
  introFoot: "policy-v6-introFoot",
  introHeading: "policy-v6-introHeading",
  lab: "policy-v6-lab",
  muted: "policy-v6-muted",
  questionNumber: "policy-v6-questionNumber",
  questions: "policy-v6-questions",
  scope: "policy-v6-scope",
  srOnly: "policy-v6-srOnly",
  table: "policy-v6-table",
  tableScroll: "policy-v6-tableScroll",
  toast: "policy-v6-toast",
  tools: "policy-v6-tools",
  tray: "policy-v6-tray",
  trayNames: "policy-v6-trayNames",
  version: "policy-v6-version",
};

type LabContext = {
  data: PolicyV6Data;
  ui: ReturnType<typeof policyV6Copy>;
  copy: (url: string) => Promise<boolean>;
  shareUrl: () => string;
  comparison: ReactNode;
  compareOpen: boolean;
  compareView: boolean;
  setCompareOpen: (open: boolean) => void;
  openCompare: () => void;
};
const Context = createContext<LabContext | undefined>(undefined);
const useLab = () => useContext(Context);
const schoolPath = (slug: string, locale: string) =>
  `${locale === "en" ? "" : `/${locale}`}/universities/${slug}`;
const topicUrl = (key: string) => {
  const url = new URL(window.location.href);
  url.hash = `snapshot-evidence-${key}`;
  url.searchParams.delete("compare");
  url.searchParams.delete("view");
  return url.href;
};
const domain = (url: string) => new URL(url).hostname;

export function PolicyV6Provider({
  data,
  children,
}: {
  data?: PolicyV6Data;
  children: ReactNode;
}) {
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareView, setCompareView] = useState(false);
  const [selected, setSelected] = useState([
    data?.currentSlug ?? "harvard-university",
  ]);
  const [extraSchools, setExtraSchools] = useState<LabSchool[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [loadRetry, setLoadRetry] = useState(0);
  const [loading, setLoading] = useState(false);
  const [differences, setDifferences] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [failedUrl, setFailedUrl] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ui = policyV6Copy(data?.locale ?? "en");
  useEffect(() => {
    if (!data) return;
    const restore = () => {
      const url = new URL(window.location.href);
      const values = canonicalUniversitySlugs(
        (url.searchParams.get("compare") ?? "")
          .split(",")
          .filter(
            (slug) =>
              slug.length <= 160 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug),
          ),
      ).slice(0, 4);
      setSelected(
        url.searchParams.has("compare") && !url.searchParams.get("compare")
          ? []
          : values.length
            ? values
            : [data.currentSlug],
      );
      setDifferences(url.searchParams.get("differences") === "1");
      const restoredView = url.searchParams.get("view") === "compare";
      setCompareView(restoredView);
      setCompareOpen(restoredView);
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => {
      window.removeEventListener("popstate", restore);
      clearTimeout(timer.current);
    };
  }, [data]);
  useEffect(() => {
    if (!data) return;
    const missing = selected.filter(
      (slug) =>
        ![...data.schools, ...extraSchools].some(
          (school) => school.slug === slug,
        ),
    );
    if (!missing.length) {
      setLoading(false);
      setLoadError(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    fetch(
      `/api/policy-v6/compare?${new URLSearchParams({ slugs: missing.join(","), locale: data.locale })}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Comparison unavailable");
        return response.json();
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        if (
          !Array.isArray(payload.schools) ||
          !missing.every((slug) =>
            payload.schools.some((school: LabSchool) => school.slug === slug),
          )
        )
          throw new Error("Incomplete comparison");
        setExtraSchools((previous) => [
          ...previous.filter((s) => !missing.includes(s.slug)),
          ...payload.schools,
        ]);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [data, selected, extraSchools, loadRetry]);
  if (!data) return children;
  const current = data.schools.find((s) => s.slug === data.currentSlug);
  const knownSchools = [...data.schools, ...extraSchools];
  const schools = selected.flatMap((slug) =>
    knownSchools.filter((s) => s.slug === slug),
  );
  const interactionUi = policyV6InteractionCopy(data.locale);
  const comparisonReady =
    schools.length >= 2 && schools.length === selected.length && !loading;
  const topics = current?.topics ?? [];
  const visibleTopics = topics.filter(
    (t) =>
      !differences ||
      new Set(
        schools.map(
          (s) => s.topics.find((d) => d.key === t.key)?.status ?? "unavailable",
        ),
      ).size > 1,
  );
  function writeUrl(
    values = selected,
    diff = differences,
    view = compareView && compareOpen,
  ) {
    const url = new URL(window.location.href);
    if (
      view ||
      values.length > 1 ||
      values[0] !== (data?.currentSlug ?? "harvard-university")
    )
      url.searchParams.set("compare", values.join(","));
    else url.searchParams.delete("compare");
    if (diff) url.searchParams.set("differences", "1");
    else url.searchParams.delete("differences");
    if (view) url.searchParams.set("view", "compare");
    else url.searchParams.delete("view");
    window.history.replaceState(null, "", url);
  }
  function openCompare() {
    setCompareView(false);
    setCompareOpen(true);
    const header = document.getElementById("v6-header-actions");
    if (header)
      window.scrollTo({
        top: window.scrollY + header.getBoundingClientRect().top - 120,
      });
  }
  function changeCompareOpen(value: boolean) {
    setCompareOpen(value);
    if (!value) writeUrl(selected, differences, false);
  }
  function toggle(slug: string) {
    const values = selected.includes(slug)
      ? selected.filter((s) => s !== slug)
      : selected.length < 4
        ? [...selected, slug]
        : selected;
    setSelected(values);
    writeUrl(values, differences, compareView);
  }
  async function copy(url: string) {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(url);
      setFailedUrl("");
      setFeedback(ui.copied);
      timer.current = setTimeout(() => setFeedback(""), 4000);
      return true;
    } catch {
      setFailedUrl(url);
      setFeedback(ui.copyError);
      timer.current = setTimeout(() => setFeedback(""), 4000);
      return false;
    }
  }
  function shareUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set("layout", "v6");
    if (selected.length > 1) {
      url.searchParams.set("compare", selected.join(","));
      url.searchParams.set("view", "compare");
    } else {
      url.searchParams.delete("compare");
      url.searchParams.delete("view");
    }
    return url.href;
  }
  function exportComparison() {
    const rows = [
      [
        "University",
        "Topic",
        "Status",
        "Scope",
        "Summary (original language)",
        "Official sources",
        "Source snapshot hashes",
        "Record checked",
        "Snapshot generated",
        "Basis fingerprint",
        "Record revision",
        "Student snapshot state",
        "V6 agent review state",
        "Topic basis",
      ],
    ];
    for (const topic of visibleTopics)
      for (const school of schools) {
        const d = school.topics.find((t) => t.key === topic.key);
        rows.push([
          school.name,
          topic.title,
          d?.status ?? "unavailable",
          d?.scope ?? "",
          d?.summary ?? ui.unavailable,
          d?.sources.map((s) => s.url).join("\n") ?? "",
          d?.sources.map((s) => s.hash).join("\n") ?? "",
          school.checkedAt,
          school.generatedAt ?? "",
          school.fingerprint ?? "",
          school.revision,
          school.snapshotStatus,
          school.v6ReviewState ?? "",
          d?.basisKind ?? "unavailable",
        ]);
      }
    // Escape spreadsheet formulas as well as CSV delimiters in externally sourced text.
    const csv =
      "\ufeff" +
      rows
        .map((row) =>
          row
            .map(
              (value) =>
                `"${(/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`,
            )
            .join(","),
        )
        .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "university-policy-comparison-with-sources.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const comparison = (
    <>
      {compareView ? (
        <button
          className="policy-v6-backToSearch"
          onClick={() => {
            setCompareView(false);
            writeUrl(selected, differences, false);
          }}
        >
          ← {interactionUi.search}
        </button>
      ) : null}
      {!compareView ? (
        <PolicyV6SearchPicker
          locale={data.locale}
          selected={selected}
          names={{
            ...data.schoolNames,
            ...Object.fromEntries(knownSchools.map((s) => [s.slug, s.name])),
          }}
          onToggle={toggle}
        />
      ) : null}
      {loading ? <p role="status">{interactionUi.searching}</p> : null}
      {loadError ? (
        <p role="alert">
          {interactionUi.error}{" "}
          <button onClick={() => setLoadRetry((v) => v + 1)}>
            {interactionUi.retry}
          </button>
        </p>
      ) : null}
      {!compareView ? (
        <button
          className="policy-v6-viewComparison"
          disabled={!comparisonReady}
          onClick={() => {
            setCompareView(true);
            writeUrl(selected, differences, true);
          }}
        >
          {ui.compare} ({selected.length}) →
        </button>
      ) : (
        <>
          <div className={v6Classes.actions}>
            <label>
              <input
                type="checkbox"
                checked={differences}
                onChange={(e) => {
                  setDifferences(e.target.checked);
                  writeUrl(selected, e.target.checked, true);
                }}
              />{" "}
              {ui.differences}
            </label>
            <button
              disabled={!comparisonReady}
              onClick={() => copy(shareUrl())}
            >
              {ui.copy}
            </button>
            <button disabled={!comparisonReady} onClick={exportComparison}>
              {ui.export}
            </button>
          </div>
          {!comparisonReady ? (
            <p role="status">{ui.limit}</p>
          ) : (
            <div
              className={v6Classes.tableScroll}
              tabIndex={0}
              role="region"
              aria-label={ui.compare}
            >
              <table className={v6Classes.table}>
                <thead>
                  <tr>
                    <th scope="col">{policyV6RecordCopy(data.locale).topic}</th>
                    {schools.map((s) => (
                      <th scope="col" key={s.slug}>
                        <span className="policy-v6-universityName">
                          <UniversityMark slug={s.slug} size="chip" />
                          {s.name}
                        </span>
                        <small>
                          {s.revision} ·{" "}
                          {["local_reviewed_bundle_not_public_snapshot","published_reviewed_page_supplement"].includes(s.snapshotStatus)
                            ? `${policyV6AgentReviewLabel(data.locale)} · ${data.locale === "zh" ? (data.published ? "已发布页面补充；整校审计 PARTIAL" : "本地证据包；整校审计 PARTIAL") : (data.published ? "Published page supplement; institutional audit PARTIAL" : "Local evidence bundle; institutional audit PARTIAL")}`
                            : s.v6ReviewState === "agent_reviewed"
                            ? policyV6AgentReviewLabel(data.locale)
                            : s.snapshotStatus === "strong"
                              ? policyV6RecordCopy(data.locale).strong
                              : policyV6RecordCopy(data.locale).held}
                        </small>
                        <small>
                          {ui.sourceDate}: {s.checkedAt.slice(0, 10)}
                        </small>
                        <a
                          href={`${schoolPath(s.slug, data.locale)}${data.schools.some((known) => known.slug === s.slug) || Boolean(data.schoolNames?.[s.slug]) || ["local_reviewed_bundle_not_public_snapshot","published_reviewed_page_supplement"].includes(s.snapshotStatus) ? "?layout=v6" : ""}`}
                        >
                          {ui.openRecord} ↗
                        </a>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleTopics.map((t) => (
                    <tr key={t.key}>
                      <th scope="row">{t.title}</th>
                      {schools.map((s) => {
                        const d = s.topics.find((x) => x.key === t.key);
                        return (
                          <td key={s.slug}>
                            {d ? (
                              <>
                                <span
                                  className={v6Classes.badge}
                                  data-policy-tone={policyV6StatusTone(
                                    d.status,
                                    s.slug,
                                  )}
                                >
                                  {d.statusLabel}
                                </span>
                                <p lang="en" data-i18n="preserve">
                                  {d.summary}
                                </p>
                                <small>
                                  {ui.scope}:{" "}
                                  {d.basisKind === "record_analysis"
                                    ? policyV6RecordCopy(data.locale).scope
                                    : d.scope}
                                </small>
                                {d.sources.map((source) => (
                                  <a
                                    key={`${source.url}:${source.hash}`}
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {domain(source.url)} ↗
                                  </a>
                                ))}
                                {!d.sources.length ? (
                                  <small>{ui.gap}</small>
                                ) : null}
                              </>
                            ) : (
                              <p>{ui.unavailable}</p>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!visibleTopics.length ? <p>{ui.same}</p> : null}
            </div>
          )}
        </>
      )}
    </>
  );
  return (
    <Context.Provider
      value={{
        data,
        ui,
        copy,
        shareUrl,
        comparison,
        compareOpen,
        compareView,
        setCompareOpen: changeCompareOpen,
        openCompare,
      }}
    >
      <div className={v6Classes.lab} data-policy-v6>
        {children}
      </div>
      {selected.length >= 2 && !compareOpen ? (
        <aside className={v6Classes.tray} aria-label={ui.compare}>
          <span>
            {ui.selected}: {selected.length}/4
          </span>
          <span className={v6Classes.trayNames}>
            {selected.map(slug => knownSchools.find(s => s.slug === slug)?.name ?? data.schoolNames?.[slug] ?? slug).join(" · ")}
          </span>
          <button onClick={openCompare}>{ui.compare} →</button>
          <button
            onClick={() => {
              setSelected([data.currentSlug]);
              writeUrl([data.currentSlug], false, false);
            }}
          >
            {ui.clear}
          </button>
        </aside>
      ) : null}
      <div
        role="status"
        className={feedback ? v6Classes.toast : v6Classes.srOnly}
      >
        {feedback}
      </div>
      {failedUrl ? (
        <div className={v6Classes.copyFallback}>
          <label>
            {ui.shareLink}
            <input
              readOnly
              value={failedUrl}
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
          <button onClick={() => setFailedUrl("")}>{ui.close}</button>
        </div>
      ) : null}
    </Context.Provider>
  );
}

export function PolicyV6Actions() {
  const lab = useLab();
  if (!lab) return null;
  const { ui, data } = lab;
  const current = data.schools.find((s) => s.slug === data.currentSlug);
  return (
    <div className={v6Classes.actions}>
      <PolicyV6Popover
        label={<>{ui.compare} ⇄</>}
        title={ui.compare}
        className={
          lab.compareView
            ? "policy-v6-compareResults"
            : "policy-v6-comparePicker"
        }
        width={lab.compareView ? 1100 : 440}
        closeLabel={ui.close}
        open={lab.compareOpen}
        onOpenChange={lab.setCompareOpen}
      >
        {lab.comparison}
      </PolicyV6Popover>
      <PolicyV6Share
        ui={ui}
        name={current?.name ?? ""}
        getUrl={lab.shareUrl}
        copy={lab.copy}
      />
    </div>
  );
}

export function PolicyV6Intro() {
  const lab = useLab();
  if (!lab) return null;
  const { ui, data } = lab;
  const current = data.schools.find((s) => s.slug === data.currentSlug);
  const questionKeys = ["coursework", "approved_tools", "research_publication", "teaching_guidance"] as const;
  const compactQuestions: Record<string, string> = data.locale === "zh"
    ? { coursework: "作业里可以用 AI 吗？", approved_tools: "有哪些工具可以使用？", research_publication: "研究发表如何使用 AI？", teaching_guidance: "教学中如何使用 AI？" }
    : { coursework: "Can I use AI in coursework?", approved_tools: "Which AI tools can I access?", research_publication: "How can I use AI in research?", teaching_guidance: "How can I use AI in teaching?" };
  return (<>
    <span id="quick-guide" />
    <p className="v6-compact-independence">{data.locale === "zh" ? "独立整理 · 免费开放 · 非学校官方页面" : "Independent · Open access · Not an official university page"}</p>
    <section
      className={v6Classes.intro}
      id="v6-questions"
      aria-labelledby="lab-explore-title"
    >
      <div className={v6Classes.introHeading}>
        <div>
          <h2 id="lab-explore-title">{ui.explore}</h2>
        </div>
        <a className="v6-compact-university-search" href={`${data.locale==='en'?'':'/'+data.locale}/universities`}>{data.locale==='zh'?'搜索大学':'Search universities'}</a>
      </div>
      <div className={v6Classes.questions}>
        {questionKeys.map((key) => {
          const topic = [...current?.topics ?? [], ...current?.additionalTopics ?? []].find((t) => t.key === key);
          return (
            <a href={`#snapshot-${key}`} key={key}>

              <strong>{compactQuestions[key]}</strong>
              <small
                data-policy-tone={policyV6StatusTone(
                  topic?.status ?? "unclear",
                  data.currentSlug,
                )}
              >
                {topic?.statusLabel ?? ui.unavailableEvidence}
              </small>
              <span aria-hidden="true">↓</span>
            </a>
          );
        })}
      </div>
      <div className={v6Classes.introFoot}>
        <a href={UNIVERSITY_POLICY_PLUGIN_URL} target="_blank" rel="noopener noreferrer">{pluginPromotionCopy(data.locale).cta} ↗</a>
        <a className="v6-compact-check-entry" href="#v6-submission-guide"><strong>{data.locale === "zh" ? "提交前检查" : "Before you submit"}</strong><span>{data.locale === "zh" ? "建议与注意事项" : "Advice and precautions"}</span><span aria-hidden="true">↓</span></a>
        <a
          href={`${data.locale === "en" ? "" : `/${data.locale}`}/changes/${data.currentSlug}`}
        >
          {ui.changes} →
        </a>
      </div>
    </section>
    </>
  );
}

export function PolicyV6BeforeTools() {
  const lab = useLab();
  if (!lab || !lab.data.studentActionsPilot) return null;
  return <PolicyV6StudentGuide guide={lab.data.studentActions} locale={lab.data.locale} />;
}

export function PolicyV6TopicControls({
  dimensionKey,
  originalEvidence,
  scopeDetail,
}: {
  dimensionKey: string;
  originalEvidence?: ReactNode;
  scopeDetail?: ReactNode;
}) {
  const lab = useLab();
  if (!lab) return null;
  const school = lab.data.schools.find((s) => s.slug === lab.data.currentSlug);
  const topic = school
    ? [...school.topics, ...school.additionalTopics].find(
        (t) => t.key === dimensionKey,
      )
    : undefined;
  if (!topic) return null;
  const originals = originalEvidence ?? (
    <div className="student-snapshot-card__evidence">
      {topic.claims.length ? (
        topic.claims.map((claim) => (
          <article className="student-evidence" key={claim.id}>
            <h4 data-i18n="preserve" lang="en">
              {claim.text}
            </h4>
            <small>
              {claim.id} · {claim.checkedAt?.slice(0, 10) ?? "—"}
            </small>
            {claim.evidence.map((e, i) => (
              <blockquote
                className="student-evidence__quote"
                key={`${e.url}:${i}`}
              >
                <p data-i18n="preserve" lang={e.language}>
                  {e.quote}
                </p>
                <footer>
                  <a href={e.url} target="_blank" rel="noopener noreferrer">
                    {e.title} ↗
                  </a>
                  {e.location ? <p data-i18n="preserve">{e.location}</p> : null}
                </footer>
              </blockquote>
            ))}
          </article>
        ))
      ) : (
        <p>{lab.ui.gap}</p>
      )}
    </div>
  );
  return (
    <div className="policy-v6-topicFooter">
      <PolicyV6Popover
        id={`snapshot-evidence-${topic.key}`}
        label={
          <>
            <PolicyV6ActionIcon kind="document" />
            {lab.ui.evidence}
          </>
        }
        title={topic.title}
        closeLabel={lab.ui.close}
        triggerClassName="policy-v6-evidenceTrigger"
        className="policy-v6-originalPopover"
        mobileReading
        width={480}
        align="start"
      >
        <p
          className="policy-v6-popoverStatus"
          data-policy-tone={policyV6StatusTone(topic.status, lab.data.currentSlug)}
        >
          {topic.statusLabel}
        </p>

        {topic.basisKind !== "record_analysis" ? (
          <p className="policy-v6-muted">{topic.scope}</p>
        ) : null}
        {topic.actions.length ? (
          <ul lang={lab.data.locale === "zh" ? "zh" : "en"} data-i18n="preserve">
            {topic.actions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        ) : null}
        {topic.sources.map((source) => (
          <p key={`${source.url}:${source.hash}`}>
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              {domain(source.url)} ↗
            </a>
          </p>
        ))}
        <div className="policy-v6-topicEvidence">
          <h4>{lab.ui.original}</h4>
          {originals}
        </div>
      </PolicyV6Popover>
      {scopeDetail ? <PolicyV6Popover
        id={`snapshot-scope-${topic.key}`}
        label={lab.data.locale === "zh" ? "状态与范围" : "Status & scope"}
        title={`${topic.title} · ${lab.data.locale === "zh" ? "状态与范围" : "Status & scope"}`}
        closeLabel={lab.ui.close}
        triggerClassName="policy-v6-textAction"
        className="v6-compact-scope-popover"
        width={480}
        align="start"
        mobileReading
      >{scopeDetail}</PolicyV6Popover> : null}
      <button
        className="policy-v6-textAction"
        aria-label={`${lab.ui.copy}: ${topic.title}`}
        onClick={() => lab.copy(topicUrl(topic.key))}
      >
        <PolicyV6ActionIcon kind="copy" />
        {lab.ui.copy}
      </button>
      {topic.sources[0] ? (
        <a
          href={topic.sources[0].url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <PolicyV6ActionIcon kind="external" />
          {lab.ui.source} ↗
        </a>
      ) : null}
    </div>
  );
}

function useGridColumns(
  container: React.RefObject<HTMLDivElement | null>,
  selector: string,
  fallback: number,
) {
  const [layout, setLayout] = useState({ columns: fallback, ready: false });
  useEffect(() => {
    const grid = container.current?.querySelector<HTMLElement>(selector);
    if (!grid) return;
    const measure = () => {
      const columns = Math.max(
        1,
        getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean)
          .length,
      );
      setLayout((previous) =>
        previous.ready && previous.columns === columns
          ? previous
          : { columns, ready: true },
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    measure();
    return () => observer.disconnect();
  }, [container, selector]);
  return layout;
}

export function PolicyV6Tools({
  records,
  children,
  scopedTools,
}: {
  records: PageToolRecord[];
  children: ReactNode;
  scopedTools?: ReactNode;
}) {
  const lab = useLab();
  const [expanded, setExpanded] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const id = useId();
  const { columns, ready } = useGridColumns(
    container,
    ".university-ai-tools__list",
    2,
  );
  if (!lab) return children;
  const ui = policyV6DensityCopy(lab.data.locale);
  return (
    <div className={v6Classes.tools} ref={container} data-expanded={expanded}>
      <div id={id}>{children}</div>
      {scopedTools ? (
        <div
          className="policy-v6-scopedTools"
          id={`${id}-scoped`}
          hidden={!expanded}
        >
          {scopedTools}
        </div>
      ) : null}
      {records.length > columns || scopedTools ? (
        <div className="policy-v6-showAll">
          <button
            type="button"
            disabled={!ready}
            aria-expanded={expanded}
            aria-controls={`${id}${scopedTools ? ` ${id}-scoped` : ""}`}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? ui.fewerTools : ui.allTools}{" "}
            <span aria-hidden="true">{expanded ? "⌃" : "⌄"}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function PolicyV6SourceGrid({
  children,
  allLabel,
  fewerLabel,
  count,
}: {
  children: ReactNode;
  allLabel: string;
  fewerLabel: string;
  count: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const id = useId();
  const { columns, ready } = useGridColumns(
    container,
    ".policy-v6-sourceGrid",
    1,
  );
  return (
    <div
      className="policy-v6-sourceCollection"
      ref={container}
      data-expanded={expanded}
    >
      <div className="policy-v6-sourceGrid" id={id}>
        {children}
      </div>
      {count > columns ? (
        <div className="policy-v6-showAll">
          <button
            type="button"
            disabled={!ready}
            aria-expanded={expanded}
            aria-controls={id}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? fewerLabel : allLabel}{" "}
            <span aria-hidden="true">{expanded ? "⌃" : "⌄"}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

const checklistStorageKey = (slug: string) =>
  `uapt:${slug === "harvard-university" ? "harvard" : slug}:submission-checklist:v1`;
const checklistKeys = [
  "permission",
  "declaration",
  "data",
  "accuracy",
] as const;
export function PolicyV6ChecklistFaq({
  includeFaq = true,
}: {
  includeFaq?: boolean;
}) {
  const lab = useLab();
  if (!lab) return null;
  return includeFaq?<PolicyV6Faq/>:null;
}

export function PolicyV6Faq() {
  const lab = useLab();
  if (!lab) return null;
  const { ui, data } = lab;
  const copy = policyV6InteractionCopy(data.locale);
  const school = data.schools.find((s) => s.slug === data.currentSlug);
  const topics = [
    ...(school?.topics ?? []),
    ...(school?.additionalTopics ?? []),
  ];
  const keys = [
    "coursework",
    "disclosure",
    "privacy_data",
    "approved_tools",
    "exams",
    "research_publication",
    "academic_integrity",
    "teaching_guidance",
    "security_procurement",
  ];
  const sources = [
    ...new Map(
      topics
        .flatMap((topic) => topic.sources)
        .map((source) => [source.url, source]),
    ).values(),
  ];
  const content=(
    <section
      className={v6Classes.faq}
      id="student-faq"
      aria-labelledby="faq-title"
    >
      <h2 id="faq-title">{ui.faq}</h2>
      <div className="policy-v6-faqGrid">
        {keys.map((key, index) => {
          const topic = topics.find((t) => t.key === key);
          const question =
            index < 4
              ? ui[
                  key as
                    | "coursework"
                    | "disclosure"
                    | "privacy_data"
                    | "approved_tools"
                ]
              : copy.questions[index - 4];
          return (
            <details key={key}>
              <summary>{question}</summary>
              <p lang="en" data-i18n="preserve">
                {topic?.summary ?? ui.gap}
              </p>
              {topic ? (
                <a href={`#snapshot-evidence-${key}`}>{ui.evidence} →</a>
              ) : null}
            </details>
          );
        })}
        <details>
          <summary>{copy.dates}</summary>
          <p>
            {ui.sourceDate}:{" "}
            <time dateTime={school?.checkedAt}>
              {school?.checkedAt.slice(0, 10)}
            </time>
          </p>
          <a href="#record-info">{ui.version} →</a>
        </details>
        <details>
          <summary>{copy.sources}</summary>
          <ul>
            {sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {domain(source.url)} ↗
                </a>
              </li>
            ))}
          </ul>
          <a href="#sources">{ui.source} →</a>
        </details>
        <details>
          <summary>{copy.full}</summary>
          <p>
            {school?.reviewedClaimCount} · {copy.evidence}
          </p>
          <a href="#claims">{copy.evidence} →</a>
        </details>
      </div>
    </section>
  );
  return <details className="v6-compact-faq"><summary>{ui.faq}</summary>{content}</details>;
}
