"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import {
  DashboardLineChart,
  DashboardMoverChart,
  DashboardOpportunityChart,
  DashboardSourceChart,
  DashboardSparkline
} from "@/components/private-analytics-charts";
import type { BingMetricRow } from "@/lib/bing-webmaster";
import type { ClaritySignalMetricName } from "@/lib/clarity-insights";
import type { GscMetricRow } from "@/lib/google-search-console";
import type {
  AnalyticsDashboardFocus,
  AnalyticsDashboardMover,
  AnalyticsDashboardQuery,
  AnalyticsDashboardResponse
} from "@/lib/private-analytics-dashboard-types";

type DashboardLocale = "en" | "zh";

interface DrawerState {
  comparable?: boolean;
  current: number;
  focus: AnalyticsDashboardFocus;
  key: string;
  previous: number;
  rows: Array<[string, string]>;
  title: string;
}

const copy = {
  en: {
    ai: "AI",
    apiUsage: "API usage",
    allCountries: "All countries",
    allDevices: "All devices",
    allLocales: "All languages",
    allSources: "All sources",
    avgPosition: "Avg position",
    avgCitedPages: "Avg. cited pages / day",
    behavior: "Onsite behavior",
    bingAiExplorer: "Bing AI citation details",
    bingAiCaveat: "CSV snapshot; Bing reports AI Performance as a sample of overall citation activity.",
    bingAiSnapshot: "Bing AI citation snapshot",
    bingClicks: "Bing clicks",
    bingCtr: "Bing CTR",
    bingExplorer: "Bing search explorer",
    bingImpressions: "Bing impressions",
    bingSearchTrend: "Bing visibility trend",
    botRequests: "Bot page views",
    citationShare: "Citation share",
    citations: "AI citations",
    citedPages: "Cited pages",
    clarityActiveTime: "Avg active / total time",
    clarityAffectedSessions: "Affected sessions",
    clarityCaveat: "Clarity Data Export API (rolling 72h window, consented V6 sessions only; cached 3h on disk to respect the 10 calls/day quota).",
    clarityExplorer: "Clarity page UX & diagnostics (last 3 days)",
    clarityFetched: "Clarity synced",
    clarityFrustration: "Frustration & JS errors",
    clarityLive: "Clarity 72h UX & engagement snapshot",
    clarityPageEngagement: "Per-page engagement (72h)",
    clarityScrollDepth: "Avg scroll depth",
    claritySessions: "Consented sessions (72h)",
    claritySignalEvents: "Events",
    claritySignals: "UX & health signals",
    clarityUsers: "Distinct users (72h)",
    clicks: "GSC clicks",
    close: "Close",
    compare: "Compare previous period",
    connected: "Connected",
    country: "Country",
    coverage: "Coverage",
    ctr: "GSC CTR",
    customRange: "Custom range",
    dataScope: "Onsite filters do not alter search or AI metrics",
    day: "Daily",
    device: "Device",
    direct: "Direct",
    engaged: "Meaningfully engaged",
    filters: "Onsite filters",
    from: "From",
    generated: "Updated",
    gscFinal: "GSC final through",
    growthPulse: "Growth pulse",
    impressions: "GSC impressions",
    imported: "Imported",
    intent: "Intent",
    insights: "What changed",
    landingPages: "Landing pages",
    language: "Language",
    loading: "Refreshing dashboard…",
    locale: "Language",
    lowCtr: "Opportunity zone: high impressions, low CTR",
    month: "Monthly",
    movers: "Biggest movers",
    new: "New",
    noData: "No data in this range.",
    noInsights: "No material opportunity or anomaly crossed the balanced threshold.",
    onsite: "Onsite",
    onsiteTrend: "Onsite growth trend",
    opportunities: "Query opportunity matrix",
    pages: "Pages",
    pageViews: "Page views",
    partial: "Today is included; data is incomplete.",
    previous: "Previous",
    quality: "Quality & diagnostics",
    trust: "Measurement trust",
    unknown: "Unknown",
    queries: "Queries",
    referral: "Referral",
    refresh: "Refresh",
    search: "Search",
    searchExplorer: "Search explorer",
    searchTrend: "GSC visibility trend",
    sessions: "Sessions",
    sourceComposition: "Acquisition composition",
    sources: "Sources",
    sourcesGeo: "Sources & GEO",
    snapshot: "CSV snapshot",
    title: "Search visibility and acquisition",
    topic: "Topic",
    to: "To",
    aiOpportunityQueries: "Top opportunity queries for citations",
    aiTopicsAndOpportunities: "Bing AI topics & opportunity queries",
    aiTopicsCaveat: "Bing Copilot domain macro portfolio and top external citation opportunity queries.",
    aiTopicsPortfolio: "AI topics portfolio",
    allRanges: "All potential ranges",
    allTopics: "All topics",
    citationRange: "Citation potential",
    filterByRange: "Filter by potential",
    filterByTopic: "Filter by topic",
    opportunityQueriesCount: "Top opportunity queries",
    queriesRange: "Queries range",
    query: "Query",
    resetFilters: "Clear filters",
    searchQuery: "Search query",
    sitesRange: "Sites range",
    topicsCount: "Identified AI topics",
    volumeRange: "Volume range",
    unavailable: "Unavailable",
    visitors: "Visitors",
    week: "Weekly"
  },
  zh: {
    ai: "AI",
    aiOpportunityQueries: "AI 引用高潜机会词 (Top Opportunities)",
    aiTopicsAndOpportunities: "Bing AI 检索主题大盘与高潜机会词",
    aiTopicsCaveat: "Bing Copilot 依据领域主题评估的全网检索量级与 Top 50 高频引用机会词。",
    aiTopicsPortfolio: "AI 检索主题大盘 (Topic Portfolio)",
    allRanges: "全部潜力区间",
    allTopics: "全部主题",
    citationRange: "引用潜力区间",
    clarityActiveTime: "平均有效 / 总停留",
    clarityAffectedSessions: "受影响会话占比",
    clarityCaveat: "Clarity Data Export API（近 72 小时滚动窗口，仅统计已显式同意的 V6 页面会话；落盘缓存 3 小时以严格遵守每日 10 次调用配额）。",
    clarityExplorer: "Clarity 页面交互与体验诊断 (近 3 天)",
    clarityFetched: "Clarity 同步",
    clarityFrustration: "异常交互与脚本错误",
    clarityLive: "Clarity 72h 体验与互动快照",
    clarityPageEngagement: "页面互动明细 (72h)",
    clarityScrollDepth: "平均滚动深度",
    claritySessions: "同意录制会话 (72h)",
    claritySignalEvents: "触发次数",
    claritySignals: "体验与健康信号",
    clarityUsers: "独立用户 (72h)",
    filterByRange: "按潜力区间筛选",
    filterByTopic: "按主题筛选",
    opportunityQueriesCount: "高潜机会词数",
    queriesRange: "相关查询词量级",
    query: "查询词",
    resetFilters: "重置筛选",
    searchQuery: "搜索查询词",
    sitesRange: "竞争站点量级",
    topicsCount: "识别大盘主题数",
    volumeRange: "全网检索量区间",
    apiUsage: "API 使用",
    allCountries: "全部国家",
    allDevices: "全部设备",
    allLocales: "全部语言",
    allSources: "全部来源",
    avgPosition: "平均排名",
    avgCitedPages: "日均被引用页面",
    behavior: "站内使用行为",
    bingAiExplorer: "Bing AI 引用明细",
    bingAiCaveat: "CSV 快照；Bing 将 AI Performance 标注为整体引用活动的抽样数据。",
    bingAiSnapshot: "Bing AI 引用快照",
    bingClicks: "Bing 点击",
    bingCtr: "Bing CTR",
    bingExplorer: "Bing 搜索明细",
    bingImpressions: "Bing 展现",
    bingSearchTrend: "Bing 可见性趋势",
    botRequests: "Bot 浏览量",
    citationShare: "引用占比",
    citations: "AI 引用次数",
    citedPages: "被引用页面",
    clicks: "GSC 点击",
    close: "关闭",
    compare: "与上一周期对比",
    connected: "已连接",
    country: "国家",
    coverage: "覆盖区间",
    ctr: "GSC CTR",
    customRange: "自定义范围",
    dataScope: "站内筛选不会改变搜索或 AI 指标",
    day: "按日",
    device: "设备",
    direct: "直接访问",
    engaged: "有效参与会话",
    filters: "站内筛选",
    from: "开始",
    generated: "更新时间",
    gscFinal: "GSC 完整数据截止",
    growthPulse: "增长脉搏",
    impressions: "GSC 展现",
    imported: "导入时间",
    intent: "意图",
    insights: "发生了什么",
    landingPages: "落地页",
    language: "语言",
    loading: "正在刷新看板…",
    locale: "语言",
    lowCtr: "机会区域：高展现、低 CTR",
    month: "按月",
    movers: "涨跌最大的项目",
    new: "新增",
    noData: "该范围暂无数据。",
    noInsights: "没有机会或异常超过平衡模式阈值。",
    onsite: "站内",
    onsiteTrend: "站内增长趋势",
    opportunities: "查询机会矩阵",
    pages: "页面",
    pageViews: "浏览量",
    partial: "已包含今天，数据尚未完整。",
    previous: "上一周期",
    quality: "质量与诊断",
    trust: "测量可信度",
    unknown: "未知",
    queries: "查询词",
    referral: "引荐",
    refresh: "刷新",
    search: "搜索",
    searchExplorer: "搜索机会",
    searchTrend: "GSC 可见性趋势",
    sessions: "会话",
    sourceComposition: "访问来源构成",
    sources: "来源",
    sourcesGeo: "来源与地区",
    snapshot: "CSV 快照",
    title: "搜索可见性与访问增长",
    topic: "主题",
    to: "结束",
    unavailable: "不可用",
    visitors: "访客",
    week: "按周"
  }
} as const;

export function PrivateAnalyticsDashboard({
  initialData,
  initialLocale
}: {
  initialData: AnalyticsDashboardResponse;
  initialLocale: DashboardLocale;
}) {
  const [data, setData] = useState(initialData);
  const [locale, setLocale] = useState<DashboardLocale>(initialLocale);
  const [query, setQuery] = useState(initialData.meta.query);
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [gscMetric, setGscMetric] = useState<"clicks" | "ctr" | "impressions" | "position">("clicks");
  const [bingMetric, setBingMetric] = useState<"clicks" | "ctr" | "impressions">("clicks");
  const [moverTab, setMoverTab] = useState<"pages" | "queries" | "sources">("queries");
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const firstRender = useRef(true);
  const t = copy[locale];

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const params = queryToParams(query);
      window.history.replaceState(null, "", `/internal/analytics?${params.toString()}`);
      setLoading(true);
      try {
        const response = await fetch(`/api/internal/analytics/dashboard?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal
        });
        if (!response.ok) throw new Error(`Analytics request failed: ${response.status}`);
        const next = await response.json() as AnalyticsDashboardResponse;
        setData(next);
        setRequestError(null);
        setQuery((currentQuery) =>
          queryToParams(currentQuery).toString() ===
          queryToParams(next.meta.query).toString()
            ? currentQuery
            : next.meta.query
        );
      } catch (error) {
        if (!controller.signal.aborted) {
          setRequestError(error instanceof Error ? error.message : "Analytics request failed");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, refreshToken]);

  const current = data.onsite.current;
  const previous = data.onsite.previous;
  const gsc = data.gsc.current;
  const previousGsc = data.gsc.previous;
  const bing = data.bing.current;
  const previousBing = data.bing.previous;
  const bingAi = data.bingAi;
  const clarity = data.clarity;
  const engagedRate = safeRate(current.summary.engagedSessions, current.summary.sessions);
  const previousEngagedRate = safeRate(previous.summary.engagedSessions, previous.summary.sessions);
  const sourceLabels = {
    ai: t.ai,
    direct: t.direct,
    other: locale === "zh" ? "其他" : "Other",
    referral: t.referral,
    search: t.search,
    unknown: t.unknown
  };
  const moverRows = moverTab === "queries"
    ? data.gsc.movers.queries
    : moverTab === "pages"
      ? data.onsite.movers.pages
      : data.onsite.movers.sources;
  const moverComparison = moverTab === "queries"
    ? data.meta.comparison.gsc
    : moverTab === "sources"
      ? data.meta.comparison.sources
      : data.meta.comparison.onsite;

  const [oppTopicFilter, setOppTopicFilter] = useState<string>("");
  const [oppRangeFilter, setOppRangeFilter] = useState<string>("");
  const [oppSearchQuery, setOppSearchQuery] = useState<string>("");

  const availableTopics = useMemo(() => {
    return Array.from(new Set((bingAi.opportunityQueryRows ?? []).map((r) => r.topic))).filter(Boolean);
  }, [bingAi.opportunityQueryRows]);

  const availableRanges = useMemo(() => {
    return Array.from(new Set((bingAi.opportunityQueryRows ?? []).map((r) => r.citationRange))).filter(Boolean);
  }, [bingAi.opportunityQueryRows]);

  const filteredOpportunityRows = useMemo(() => {
    const q = oppSearchQuery.trim().toLowerCase();
    return (bingAi.opportunityQueryRows ?? []).filter((row) => {
      if (oppTopicFilter && row.topic !== oppTopicFilter) return false;
      if (oppRangeFilter && row.citationRange !== oppRangeFilter) return false;
      if (q && !row.query.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [bingAi.opportunityQueryRows, oppTopicFilter, oppRangeFilter, oppSearchQuery]);

  function updateQuery(patch: Partial<AnalyticsDashboardQuery>) {
    setQuery((value) => ({ ...value, ...patch }));
  }

  function updateFilters(key: keyof AnalyticsDashboardQuery["filters"], value: string) {
    setQuery((currentQuery) => ({
      ...currentQuery,
      filters: { ...currentQuery.filters, [key]: value ? [value] : [] }
    }));
  }

  function applyPreset(days: number) {
    const from = shiftDate(query.to, -(days - 1));
    updateQuery({ from, grain: days > 120 ? "month" : days > 45 ? "week" : "day" });
  }

  function changeLocale(next: DashboardLocale) {
    setLocale(next);
    document.cookie = `uapt-analytics-locale=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  function openDrawer(next: DrawerState) {
    setDrawer(next);
    const url = new URL(window.location.href);
    url.searchParams.set("focus", next.focus);
    url.searchParams.set("focusKey", next.key);
    window.history.replaceState(null, "", url.toString());
  }

  function closeDrawer() {
    setDrawer(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("focus");
    url.searchParams.delete("focusKey");
    window.history.replaceState(null, "", url.toString());
  }

  function openMetric(
    key: string,
    title: string,
    currentValue: number,
    previousValue: number,
    comparable: boolean
  ) {
    openDrawer({
      comparable,
      current: currentValue,
      focus: "metric",
      key,
      previous: previousValue,
      rows: [
        [locale === "zh" ? "本期" : "Current", formatMetricValue(key, currentValue)],
        [t.previous, comparable ? formatMetricValue(key, previousValue) : "N/A"],
        [locale === "zh" ? "变化" : "Change", comparable ? formatChange(currentValue, previousValue, t.new) : (locale === "zh" ? "不可比" : "Not comparable")]
      ],
      title
    });
  }

  function openGscRow(row: GscMetricRow, focus: "page" | "query") {
    const previousRow = (focus === "query" ? previousGsc.queryRows : previousGsc.pageRows)
      .find((item) => item.key === row.key);
    openDrawer({
      current: row.impressions,
      focus,
      key: row.key,
      previous: previousRow?.impressions ?? 0,
      rows: [
        [t.clicks, formatCount(row.clicks)],
        [t.impressions, formatCount(row.impressions)],
        [t.ctr, formatPercent(row.ctr)],
        [t.avgPosition, formatDecimal(row.position)]
      ],
      title: row.key
    });
  }

  function openBingRow(row: BingMetricRow, focus: "page" | "query") {
    const previousRow = (focus === "query" ? previousBing.queryRows : previousBing.pageRows)
      .find((item) => item.key === row.key);
    openDrawer({
      current: row.impressions,
      focus,
      key: row.key,
      previous: previousRow?.impressions ?? 0,
      rows: [
        [t.bingClicks, formatCount(row.clicks)],
        [t.bingImpressions, formatCount(row.impressions)],
        [t.bingCtr, formatPercent(row.ctr)],
        [t.avgPosition, formatDecimal(row.position)]
      ],
      title: row.key
    });
  }

  function openMover(row: AnalyticsDashboardMover) {
    const focus = moverTab === "queries" ? "query" : moverTab === "pages" ? "landing" : "source";
    openDrawer({
      current: row.current,
      focus,
      key: row.label,
      previous: row.previous,
      rows: [
        [locale === "zh" ? "本期" : "Current", formatCount(row.current)],
        [t.previous, formatCount(row.previous)],
        [locale === "zh" ? "变化" : "Change", row.change === null ? t.new : formatSignedPercent(row.change)]
      ],
      title: row.label
    });
  }

  return (
    <main className="analytics-dashboard" lang={locale === "zh" ? "zh-CN" : "en"}>
      <header className="analytics-dashboard__header">
        <div>
          <p className="analytics-dashboard__eyebrow">Internal analytics / {t.growthPulse}</p>
          <h1>{t.title}</h1>
          <p>{locale === "zh"
            ? "搜索表现与站内行为分别计算；来源、地区、语言和设备筛选只作用于站内数据。"
            : "Search visibility and onsite behavior are calculated separately. Acquisition filters apply only to onsite data."}</p>
        </div>
        <div className="analytics-language-toggle" aria-label={t.language}>
          <button aria-pressed={locale === "zh"} onClick={() => changeLocale("zh")} type="button">中文</button>
          <button aria-pressed={locale === "en"} onClick={() => changeLocale("en")} type="button">EN</button>
        </div>
      </header>

      <section className="analytics-control-bar" aria-label={t.customRange}>
        <div className="analytics-presets">
          {[7, 30, 90, 180].map((days) => (
            <button
              aria-pressed={differenceInDays(query.from, query.to) + 1 === days}
              key={days}
              onClick={() => applyPreset(days)}
              type="button"
            >{days}D</button>
          ))}
        </div>
        <label>{t.from}<input max={query.to} onChange={(event) => updateQuery({ from: event.target.value })} type="date" value={query.from} /></label>
        <label>{t.to}<input min={query.from} onChange={(event) => updateQuery({ to: event.target.value })} type="date" value={query.to} /></label>
        <label className="analytics-control-compact">
          <span>Grain</span>
          <select onChange={(event) => updateQuery({ grain: event.target.value as AnalyticsDashboardQuery["grain"] })} value={query.grain}>
            <option value="day">{t.day}</option><option value="week">{t.week}</option><option value="month">{t.month}</option>
          </select>
        </label>
        <label className="analytics-compare-toggle"><input checked={query.compare} onChange={(event) => updateQuery({ compare: event.target.checked })} type="checkbox" />{t.compare}</label>
        <button className="analytics-refresh" disabled={loading} onClick={() => setRefreshToken((value) => value + 1)} type="button">{t.refresh}</button>
      </section>

      <section className="analytics-filter-row" aria-label={t.filters}>
        <strong>{t.filters}</strong>
        <FilterSelect label={t.allSources} onChange={(value) => updateFilters("sources", value)} options={data.filterOptions.sources} value={query.filters.sources[0] ?? ""} />
        <FilterSelect label={t.allCountries} onChange={(value) => updateFilters("countries", value)} options={data.filterOptions.countries} value={query.filters.countries[0] ?? ""} />
        <FilterSelect label={t.allLocales} onChange={(value) => updateFilters("locales", value)} options={data.filterOptions.locales} value={query.filters.locales[0] ?? ""} />
        <FilterSelect label={t.allDevices} onChange={(value) => updateFilters("devices", value)} options={data.filterOptions.devices} value={query.filters.devices[0] ?? ""} />
        <span>{t.dataScope}</span>
      </section>

      <section className="analytics-status-row" aria-label="Data source status">
        <StatusPill label="Onsite" status={data.meta.dataStatus.onsite} t={t} />
        <StatusPill label="GSC" status={data.meta.dataStatus.gsc} t={t} />
        <StatusPill label="Bing" status={data.meta.dataStatus.bing} t={t} />
        <span className={bingAi.available ? "is-connected" : "is-warning"}><i />Bing AI: {bingAi.available ? t.snapshot : t.unavailable}</span>
        <StatusPill label="Clarity" status={data.meta.dataStatus.clarity} t={t} />
        <span>{query.from} → {query.to}</span>
        <span>{t.generated}: {formatDateTime(data.meta.generatedAt, locale)}</span>
        {bingAi.coverageStart && bingAi.coverageEnd ? <span>{t.coverage}: {bingAi.coverageStart} → {bingAi.coverageEnd}</span> : null}
        {bingAi.importedAt ? <span>{t.imported}: {formatDateTime(bingAi.importedAt, locale)}</span> : null}
        {clarity.fetchedAt ? <span>{t.clarityFetched}: {formatDateTime(clarity.fetchedAt, locale)}</span> : null}
        {data.meta.gscCompleteThrough ? <span>{t.gscFinal}: {data.meta.gscCompleteThrough}</span> : null}
        {data.meta.partialDay ? <span className="is-warning">{t.partial}</span> : null}
      </section>

      <p className="analytics-comparison-note" role="status">
        {locale === "zh"
          ? `站内口径 ${data.meta.measurement?.version ?? "旧版"}：排除已标记测试/内部/巡检会话；未标记客户端不等于已验证真人。本期排除测试 ${current.quality.excludedTestPageViews ?? 0} 次浏览；旧口径事件 ${current.quality.legacyUnclassifiedEvents ?? 0} 条。${data.meta.measurement?.complete === false ? "事件结果不完整或读取失败，不可作为完整总量，已停用增减比较。" : ""}`
          : `Onsite: exclude marked QA/internal/monitor sessions; unmarked clients are not verified humans. Excluded test page views: ${current.quality.excludedTestPageViews ?? 0}. Legacy events: ${current.quality.legacyUnclassifiedEvents ?? 0}. ${data.meta.measurement?.complete === false ? "Incomplete event query; totals are partial and comparisons disabled." : ""}`}
      </p>
      {bingAi.window ? <p className="analytics-comparison-note">{locale === "zh" ? `Bing AI 日趋势按所选日期过滤；${bingAi.window.complete ? "日期覆盖完整" : `缺少 ${bingAi.window.missingDays} 天，完整期间总量不显示，不能将缺数当作零`}。页面/查询/主题表仍是各自导出范围，不随本页日期筛选。` : `Bing AI daily trend uses selected dates; ${bingAi.window.complete ? "complete date coverage" : `${bingAi.window.missingDays} missing days; period totals unavailable`}. Page/query/topic tables retain their independent export ranges.`}</p> : null}
      <p className="analytics-comparison-note">{locale === "zh" ? "Clarity 是独立滚动 72 小时、用户同意后的已上线 V6 样本，不随本站 7/30 天或筛选条件变化；按 URL 分组的会话/用户之和可能重复，不代表全站去重总量。站内按 Toronto 日界统计，GSC/Bing 保留各来源的报告日。Direct 表示未识别到来源；会话归因的浏览量、搜索点击和 AI 引用分别计算。" : "Clarity is a separate rolling 72h consented V6 sample, independent of date and onsite filters. URL-group session/user sums may overlap and are not deduplicated site totals. Onsite uses Toronto days; search retains provider report dates. Direct means no identified source. Session-attributed page views, search clicks and AI citations are distinct."}</p>
      <section className="analytics-trust-strip" aria-label={t.trust}>
        <strong>{t.trust}</strong>
        <TrustItem date={data.meta.baselines.tracking} label={locale === "zh" ? "站内埋点开始" : "Onsite tracking started"} />
        <TrustItem date={data.meta.baselines.attribution} label={locale === "zh" ? "来源归因 v2" : "Attribution v2"} />
        <TrustItem date={data.meta.baselines.collector} label={locale === "zh" ? "采集器 v2" : "Collector v2"} />
        <ComparisonItem item={data.meta.comparison.onsite} label={locale === "zh" ? "站内环比" : "Onsite comparison"} locale={locale} />
        <ComparisonItem item={data.meta.comparison.sources} label={locale === "zh" ? "来源环比" : "Source comparison"} locale={locale} />
        <ComparisonItem item={data.meta.comparison.gsc} label="GSC" locale={locale} />
        <ComparisonItem item={data.meta.comparison.bing} label="Bing" locale={locale} />
      </section>

      {loading ? <div aria-live="polite" className="analytics-loading-bar">{t.loading}</div> : null}
      {requestError ? (
        <div className="analytics-request-error" role="alert">
          {locale === "zh" ? "刷新失败，请重试。" : "Refresh failed. Please try again."}
          <span>{requestError}</span>
        </div>
      ) : null}

      <section className="analytics-insight-strip" aria-label={t.insights}>
        <header><span>01</span><h2>{t.insights}</h2></header>
        <div>
          {data.insights.length ? data.insights.map((insight) => (
            <article className={`is-${insight.tone}`} key={insight.id}>
              <strong>{insight.title[locale]}</strong>
              <p>{insight.detail[locale]}</p>
            </article>
          )) : <p className="analytics-empty">{t.noInsights}</p>}
        </div>
      </section>

      <section className="analytics-kpi-grid" aria-label="Dashboard metrics">
        <KpiCard available={!data.meta.measurement?.error} partial={data.meta.measurement?.complete === false} comparable={data.meta.comparison.onsite.eligible} current={current.summary.visitors} label={t.visitors} onClick={() => openMetric("visitors", t.visitors, current.summary.visitors, previous.summary.visitors, data.meta.comparison.onsite.eligible)} previous={previous.summary.visitors} spark={current.summary.trend.map((row) => row.visitors)} />
        <KpiCard available={!data.meta.measurement?.error} partial={data.meta.measurement?.complete === false} comparable={data.meta.comparison.onsite.eligible} current={current.summary.sessions} label={t.sessions} onClick={() => openMetric("sessions", t.sessions, current.summary.sessions, previous.summary.sessions, data.meta.comparison.onsite.eligible)} previous={previous.summary.sessions} spark={current.summary.trend.map((row) => row.sessions)} />
        <KpiCard available={!data.meta.measurement?.error} partial={data.meta.measurement?.complete === false} comparable={data.meta.comparison.onsite.eligible} current={current.summary.pageViews} label={t.pageViews} onClick={() => openMetric("pageViews", t.pageViews, current.summary.pageViews, previous.summary.pageViews, data.meta.comparison.onsite.eligible)} previous={previous.summary.pageViews} spark={current.summary.trend.map((row) => row.pageViews)} />
        <KpiCard available={!data.meta.measurement?.error} partial={data.meta.measurement?.complete === false} comparable={data.meta.comparison.onsite.eligible} current={engagedRate} format="percent" label={t.engaged} onClick={() => openMetric("rate", t.engaged, engagedRate, previousEngagedRate, data.meta.comparison.onsite.eligible)} previous={previousEngagedRate} spark={[engagedRate]} />
        <KpiCard available={gsc.available} comparable={data.meta.comparison.gsc.eligible} current={gsc.totals.clicks} label={t.clicks} onClick={() => openMetric("clicks", t.clicks, gsc.totals.clicks, previousGsc.totals.clicks, data.meta.comparison.gsc.eligible)} previous={previousGsc.totals.clicks} spark={gsc.dateRows.map((row) => row.clicks)} />
        <KpiCard available={gsc.available} comparable={data.meta.comparison.gsc.eligible} current={gsc.totals.impressions} label={t.impressions} onClick={() => openMetric("impressions", t.impressions, gsc.totals.impressions, previousGsc.totals.impressions, data.meta.comparison.gsc.eligible)} previous={previousGsc.totals.impressions} spark={gsc.dateRows.map((row) => row.impressions)} />
        <KpiCard available={gsc.available} comparable={data.meta.comparison.gsc.eligible} current={gsc.totals.ctr} format="percent" label={t.ctr} onClick={() => openMetric("rate", t.ctr, gsc.totals.ctr, previousGsc.totals.ctr, data.meta.comparison.gsc.eligible)} previous={previousGsc.totals.ctr} spark={gsc.dateRows.map((row) => row.ctr * 100)} />
        <KpiCard available={gsc.available} comparable={data.meta.comparison.gsc.eligible} current={gsc.totals.position} format="decimal" label={t.avgPosition} onClick={() => openMetric("position", t.avgPosition, gsc.totals.position, previousGsc.totals.position, data.meta.comparison.gsc.eligible)} previous={previousGsc.totals.position} reverseTone spark={gsc.dateRows.map((row) => row.position)} />
        <KpiCard available={bing.available} comparable={data.meta.comparison.bing.eligible} current={bing.totals.clicks} label={t.bingClicks} onClick={() => openMetric("bingClicks", t.bingClicks, bing.totals.clicks, previousBing.totals.clicks, data.meta.comparison.bing.eligible)} previous={previousBing.totals.clicks} spark={bing.dateRows.map((row) => row.clicks)} />
        <KpiCard available={bing.available} comparable={data.meta.comparison.bing.eligible} current={bing.totals.impressions} label={t.bingImpressions} onClick={() => openMetric("bingImpressions", t.bingImpressions, bing.totals.impressions, previousBing.totals.impressions, data.meta.comparison.bing.eligible)} previous={previousBing.totals.impressions} spark={bing.dateRows.map((row) => row.impressions)} />
        <KpiCard available={bing.available} comparable={data.meta.comparison.bing.eligible} current={bing.totals.ctr} format="percent" label={t.bingCtr} onClick={() => openMetric("rate", t.bingCtr, bing.totals.ctr, previousBing.totals.ctr, data.meta.comparison.bing.eligible)} previous={previousBing.totals.ctr} spark={bing.dateRows.map((row) => row.ctr * 100)} />
      </section>

      <section className="analytics-growth-grid">
        <DashboardPanel index="02" meta={t.onsite} title={t.onsiteTrend}>
          <DashboardLineChart
            emptyLabel={t.noData}
            labels={current.summary.trend.map((row) => row.label)}
            series={[
              { color: "var(--analytics-onsite)", key: "visitors", label: t.visitors, values: current.summary.trend.map((row) => row.visitors) },
              { color: "var(--analytics-search)", key: "sessions", label: t.sessions, values: current.summary.trend.map((row) => row.sessions) },
              { color: "var(--analytics-ai)", key: "views", label: t.pageViews, values: current.summary.trend.map((row) => row.pageViews) },
              ...(data.meta.comparison.onsite.eligible ? [{ color: "var(--color-text-muted)", dashed: true, key: "previous", label: t.previous, values: previous.summary.trend.map((row) => row.visitors) }] : [])
            ]}
          />
        </DashboardPanel>
        <DashboardPanel
          action={<MetricTabs metric={gscMetric} onChange={setGscMetric} />}
          index="03"
          meta="Google Search Console"
          title={t.searchTrend}
        >
          <DashboardLineChart
            emptyLabel={t.noData}
            labels={gsc.dateRows.map((row) => row.key.slice(5))}
            series={[
              { color: "var(--analytics-search)", key: gscMetric, label: metricLabel(gscMetric, t), values: gsc.dateRows.map((row) => metricValue(row, gscMetric)) },
              ...(data.meta.comparison.gsc.eligible ? [{ color: "var(--color-text-muted)", dashed: true, key: "previous", label: t.previous, values: previousGsc.dateRows.map((row) => metricValue(row, gscMetric)) }] : [])
            ]}
          />
        </DashboardPanel>
        <DashboardPanel
          action={<MetricTabs includePosition={false} metric={bingMetric} onChange={(metric) => setBingMetric(metric as typeof bingMetric)} />}
          index="03B"
          meta="Bing Webmaster Tools"
          title={t.bingSearchTrend}
        >
          <DashboardLineChart
            emptyLabel={t.noData}
            labels={bing.dateRows.map((row) => row.key.slice(5))}
            series={[
              { color: "var(--analytics-ai)", key: bingMetric, label: bingMetricLabel(bingMetric, t), values: bing.dateRows.map((row) => metricValue(row, bingMetric)) },
              ...(data.meta.comparison.bing.eligible ? [{ color: "var(--color-text-muted)", dashed: true, key: "previous", label: t.previous, values: previousBing.dateRows.map((row) => metricValue(row, bingMetric)) }] : [])
            ]}
          />
        </DashboardPanel>
        <DashboardPanel
          className="analytics-panel--wide"
          index="03C"
          meta={bingAi.available ? (bingAi.coverageStart && bingAi.coverageEnd ? `${t.coverage}: ${bingAi.coverageStart} → ${bingAi.coverageEnd}` : t.snapshot) : t.unavailable}
          title={t.bingAiSnapshot}
        >
          {bingAi.available ? (
            <>
              <div className="analytics-ai-summary">
                <MetricSummary label={t.citations} value={bingAi.window ? bingAi.window.citations === null ? "—" : formatCount(bingAi.window.citations) : formatCount(bingAi.totals.citations)} />
                <MetricSummary label={t.avgCitedPages} value={bingAi.window ? bingAi.window.averageCitedPages === null ? "—" : formatDecimal(bingAi.window.averageCitedPages) : formatDecimal(bingAi.totals.averageCitedPages)} />
                {bingAi.totals.topicsCount ? (
                  <MetricSummary label={t.topicsCount} value={formatCount(bingAi.totals.topicsCount)} />
                ) : null}
                {bingAi.totals.opportunityQueriesCount ? (
                  <MetricSummary label={t.opportunityQueriesCount} value={formatCount(bingAi.totals.opportunityQueriesCount)} />
                ) : null}
              </div>
              <DashboardLineChart
                emptyLabel={t.noData}
                labels={(bingAi.window?.dateRows ?? bingAi.dateRows).map((row) => row.key.slice(5))}
                series={[
                  { color: "var(--analytics-ai)", key: "citations", label: t.citations, values: (bingAi.window?.dateRows ?? bingAi.dateRows).map((row) => row.citations) },
                  { color: "var(--analytics-search)", key: "citedPages", label: t.citedPages, values: (bingAi.window?.dateRows ?? bingAi.dateRows).map((row) => row.citedPages) }
                ]}
              />
            </>
          ) : <p className="analytics-empty">{bingAi.error ?? t.noData}</p>}
        </DashboardPanel>
        <DashboardPanel
          className="analytics-panel--wide"
          index="03D"
          meta={clarity.available ? `Microsoft Clarity · ${clarity.projectId} · ${clarity.numOfDays}D` : t.unavailable}
          title={t.clarityLive}
        >
          {clarity.available ? (
            <>
              <div className="analytics-ai-summary">
                <MetricSummary
                  label={locale === "zh" ? "页面会话累计（可能重复）" : "Page session sum (may overlap)"}
                  value={`${formatCount(clarity.totals.sessions)}${clarity.totals.botSessions ? ` (Bot: ${formatCount(clarity.totals.botSessions)})` : ""}`}
                />
                <MetricSummary label={locale === "zh" ? "页面用户累计（可能重复）" : "Page user sum (may overlap)"} value={formatCount(clarity.totals.distinctUsers)} />
                <MetricSummary
                  label={t.clarityActiveTime}
                  value={`${formatDecimal(clarity.totals.avgActiveTimeSec)}s / ${formatDecimal(clarity.totals.avgTotalTimeSec)}s`}
                />
                <MetricSummary label={t.clarityScrollDepth} value={`${formatDecimal(clarity.totals.avgScrollDepth)}%`} />
                <MetricSummary label={t.clarityFrustration} value={formatCount(clarity.totals.frustrationEvents)} />
              </div>
              <DataTable
                headers={[t.pages, t.device, t.sessions, t.clarityActiveTime, t.clarityScrollDepth, t.clarityFrustration]}
                rows={clarity.pageRows.slice(0, 8).map((row) => ({
                  key: `${row.url}:${row.device}:${row.country ?? ""}`,
                  values: [
                    shortPath(row.url),
                    row.device,
                    formatCount(row.sessions),
                    `${formatDecimal(row.avgActiveTimeSec)}s / ${formatDecimal(row.avgTotalTimeSec)}s`,
                    `${formatDecimal(row.avgScrollDepth)}%`,
                    formatCount(row.rageClicks + row.deadClicks + row.quickbacks + row.scriptErrors + row.errorClicks)
                  ]
                }))}
              />
            </>
          ) : <p className="analytics-empty">{clarity.error ?? t.noData}</p>}
        </DashboardPanel>
        <DashboardPanel index="04" meta={t.onsite} title={t.sourceComposition}>
          <DashboardSourceChart emptyLabel={t.noData} labels={sourceLabels} onSelect={(source) => openSourceDrawer(source, data, locale, openDrawer)} rows={current.sourceTrend} />
        </DashboardPanel>
        <DashboardPanel index="05" meta="Google Search Console" title={t.opportunities}>
          <DashboardOpportunityChart emptyLabel={t.noData} lowCtrLabel={t.lowCtr} onSelect={(row) => openGscRow(row, "query")} opportunities={data.gsc.opportunities} rows={gsc.queryRows} />
        </DashboardPanel>
        <DashboardPanel
          action={<div className="analytics-segmented"><button aria-pressed={moverTab === "queries"} onClick={() => setMoverTab("queries")} type="button">{t.queries}</button><button aria-pressed={moverTab === "pages"} onClick={() => setMoverTab("pages")} type="button">{t.pages}</button><button aria-pressed={moverTab === "sources"} onClick={() => setMoverTab("sources")} type="button">{t.sources}</button></div>}
          className="analytics-panel--wide"
          index="06"
          meta={query.compare ? t.compare : ""}
          title={t.movers}
        >
          {!moverComparison.eligible ? <p className="analytics-comparison-note">{moverComparison.reason?.[locale]}</p> : null}
          <DashboardMoverChart newLabel={t.new} onSelect={openMover} rows={moverRows} />
        </DashboardPanel>
      </section>

      <section className="analytics-detail-sections">
        <DetailSection index="07" open title={t.searchExplorer}>
          <div className="analytics-detail-grid">
            <DataTable headers={[t.queries, t.clicks, t.impressions, t.ctr, t.avgPosition]} rows={gsc.queryRows.slice(0, 20).map((row) => ({ key: row.key, onClick: () => openGscRow(row, "query"), values: [row.key, formatCount(row.clicks), formatCount(row.impressions), formatPercent(row.ctr), formatDecimal(row.position)] }))} />
            <DataTable headers={[t.pages, t.clicks, t.impressions, t.ctr, t.avgPosition]} rows={gsc.pageRows.slice(0, 20).map((row) => ({ key: row.key, onClick: () => openGscRow(row, "page"), values: [shortPath(row.key), formatCount(row.clicks), formatCount(row.impressions), formatPercent(row.ctr), formatDecimal(row.position)] }))} />
          </div>
        </DetailSection>
        <DetailSection index="07B" title={t.bingExplorer}>
          {!data.meta.comparison.bing.eligible && data.meta.comparison.bing.reason ? <p className="analytics-comparison-note">{data.meta.comparison.bing.reason[locale]}</p> : null}
          <div className="analytics-detail-grid">
            <DataTable headers={[t.queries, t.bingClicks, t.bingImpressions, t.bingCtr, t.avgPosition]} rows={bing.queryRows.slice(0, 20).map((row) => ({ key: row.key, onClick: () => openBingRow(row, "query"), values: [row.key, formatCount(row.clicks), formatCount(row.impressions), formatPercent(row.ctr), formatDecimal(row.position)] }))} />
            <DataTable headers={[t.pages, t.bingClicks, t.bingImpressions, t.bingCtr, t.avgPosition]} rows={bing.pageRows.slice(0, 20).map((row) => ({ key: row.key, onClick: () => openBingRow(row, "page"), values: [shortPath(row.key), formatCount(row.clicks), formatCount(row.impressions), formatPercent(row.ctr), formatDecimal(row.position)] }))} />
          </div>
        </DetailSection>
        <DetailSection index="07C" open title={t.bingAiExplorer}>
          {bingAi.dateRows.length ? (
            <>
              <p className="analytics-comparison-note">
                {t.bingAiCaveat} {bingAi.coverageStart && bingAi.coverageEnd ? `${t.coverage}: ${bingAi.coverageStart} → ${bingAi.coverageEnd} · ` : ""}{t.imported}: {bingAi.importedAt ? formatDateTime(bingAi.importedAt, locale) : "—"}
              </p>
              <div className="analytics-detail-grid">
                <DataTable headers={[t.queries, t.intent, t.topic, t.citations, t.citationShare]} rows={bingAi.queryRows.map((row) => ({ key: row.key, values: [row.key, row.intent ?? "—", row.topic ?? "—", formatCount(row.citations), formatPercent(row.citationShare)] }))} />
                <DataTable headers={[t.pages, t.citations]} rows={bingAi.pageRows.map((row) => ({ key: row.key, values: [shortPath(row.key), formatCount(row.citations)] }))} />
              </div>
            </>
          ) : <p className="analytics-empty">{bingAi.error ?? t.noData}</p>}
        </DetailSection>
        {(bingAi.topicPortfolioRows?.length > 0 || bingAi.opportunityQueryRows?.length > 0) ? (
          <DetailSection index="07D" open title={t.aiTopicsAndOpportunities}>
            <p className="analytics-comparison-note">
              {t.aiTopicsCaveat}
            </p>
            {bingAi.topicPortfolioRows?.length > 0 ? (
              <div className="analytics-subsection">
                <h3 className="analytics-subheading">{t.aiTopicsPortfolio}</h3>
                <DataTable
                  headers={[t.topic, t.volumeRange, t.queriesRange, t.sitesRange]}
                  rows={bingAi.topicPortfolioRows.map((row) => ({
                    key: row.topic,
                    values: [row.topic, row.volumeRange, row.queriesRange, row.sitesRange]
                  }))}
                />
              </div>
            ) : null}
            {bingAi.opportunityQueryRows?.length > 0 ? (
              <div>
                <div className="analytics-subheading-row">
                  <h3 className="analytics-subheading">{t.aiOpportunityQueries}</h3>
                  <span className="analytics-subheading-count">
                    {filteredOpportunityRows.length} / {bingAi.opportunityQueryRows.length}
                  </span>
                </div>
                <div className="analytics-table-controls">
                  <input
                    aria-label={t.searchQuery}
                    onChange={(e) => setOppSearchQuery(e.target.value)}
                    placeholder={`${t.searchQuery}…`}
                    type="search"
                    value={oppSearchQuery}
                  />
                  <select
                    aria-label={t.filterByTopic}
                    onChange={(e) => setOppTopicFilter(e.target.value)}
                    value={oppTopicFilter}
                  >
                    <option value="">{t.allTopics}</option>
                    {availableTopics.map((topic) => (
                      <option key={topic} value={topic}>{topic}</option>
                    ))}
                  </select>
                  <select
                    aria-label={t.filterByRange}
                    onChange={(e) => setOppRangeFilter(e.target.value)}
                    value={oppRangeFilter}
                  >
                    <option value="">{t.allRanges}</option>
                    {availableRanges.map((range) => (
                      <option key={range} value={range}>{range}</option>
                    ))}
                  </select>
                  {(oppTopicFilter || oppRangeFilter || oppSearchQuery) ? (
                    <button
                      className="analytics-reset-btn"
                      onClick={() => {
                        setOppTopicFilter("");
                        setOppRangeFilter("");
                        setOppSearchQuery("");
                      }}
                      type="button"
                    >
                      {t.resetFilters}
                    </button>
                  ) : null}
                </div>
                <DataTable
                  headers={[t.query, t.topic, t.citationRange]}
                  rows={filteredOpportunityRows.map((row) => ({
                    key: `${row.topic}:${row.query}`,
                    values: [row.query, row.topic, row.citationRange]
                  }))}
                />
              </div>
            ) : null}
          </DetailSection>
        ) : null}
        <DetailSection index="07E" open title={t.clarityExplorer}>
          {clarity.available ? (
            <>
              <p className="analytics-comparison-note">
                {t.clarityCaveat} Project: {clarity.projectId} · {t.clarityFetched}: {clarity.fetchedAt ? formatDateTime(clarity.fetchedAt, locale) : "—"}
              </p>
              <div className="analytics-detail-grid">
                <div>
                  <h3 className="analytics-subheading">{t.clarityPageEngagement}</h3>
                  <DataTable
                    headers={[t.pages, t.device, t.sessions, t.visitors, t.clarityActiveTime, t.clarityScrollDepth, t.clarityFrustration]}
                    rows={clarity.pageRows.map((row) => ({
                      key: `${row.url}:${row.device}:${row.country ?? ""}`,
                      values: [
                        shortPath(row.url),
                        row.device,
                        formatCount(row.sessions),
                        formatCount(row.distinctUsers),
                        `${formatDecimal(row.avgActiveTimeSec)}s / ${formatDecimal(row.avgTotalTimeSec)}s`,
                        `${formatDecimal(row.avgScrollDepth)}%`,
                        formatCount(row.rageClicks + row.deadClicks + row.quickbacks + row.scriptErrors + row.errorClicks)
                      ]
                    }))}
                  />
                </div>
                <div>
                  <h3 className="analytics-subheading">{t.claritySignals}</h3>
                  <DataTable
                    headers={[t.claritySignals, t.claritySignalEvents, t.sessions, t.clarityAffectedSessions]}
                    rows={clarity.signalRows.map((row) => ({
                      key: row.metricName,
                      values: [
                        formatClaritySignal(row.metricName, locale),
                        formatCount(row.subTotal),
                        formatCount(row.sessionsCount),
                        `${formatDecimal(row.affectedSessionsPercentage)}%`
                      ]
                    }))}
                  />
                </div>
              </div>
            </>
          ) : <p className="analytics-empty">{clarity.error ?? t.noData}</p>}
        </DetailSection>
        <DetailSection index="08" title={t.behavior}>
          <div className="analytics-detail-grid">
            <RateList locale={locale} rows={current.summary.funnel} />
            <DataTable headers={[t.landingPages, t.pageViews, locale === "zh" ? "占比" : "Share"]} rows={current.summary.topLandingPages.map((row) => ({ key: row.label, onClick: () => openDrawer({ current: row.count, focus: "landing", key: row.label, previous: previous.summary.topLandingPages.find((item) => item.label === row.label)?.count ?? 0, rows: [[t.pageViews, formatCount(row.count)], [locale === "zh" ? "占比" : "Share", formatPercent(row.share)]], title: row.label }), values: [row.label, formatCount(row.count), formatPercent(row.share)] }))} />
          </div>
        </DetailSection>
        <DetailSection index="09" title={t.apiUsage}>
          <div className="analytics-detail-grid analytics-detail-grid--three">
            <MetricSummary label={locale === "zh" ? "API 搜索请求" : "API search requests"} value={formatCount(current.api.requests)} />
            <MetricSummary label={locale === "zh" ? "零结果请求" : "Zero-result requests"} value={`${formatCount(current.api.zeroResultRequests)} · ${formatPercent(safeRate(current.api.zeroResultRequests, current.api.requests))}`} />
            <DataTable headers={[locale === "zh" ? "调用端" : "Client kind", locale === "zh" ? "请求" : "Requests"]} rows={current.api.clientKinds.map((row) => ({ key: row.label, values: [row.label, formatCount(row.count)] }))} />
            <DataTable headers={[locale === "zh" ? "查询类型" : "Query kind", locale === "zh" ? "请求" : "Requests"]} rows={current.api.queryKinds.map((row) => ({ key: row.label, values: [row.label, formatCount(row.count)] }))} />
            <DataTable headers={[locale === "zh" ? "延迟区间" : "Latency", locale === "zh" ? "请求" : "Requests"]} rows={current.api.latencyBuckets.map((row) => ({ key: row.label, values: [row.label, formatCount(row.count)] }))} />
          </div>
        </DetailSection>
        <DetailSection index="10" title={t.sourcesGeo}>
          <div className="analytics-detail-grid analytics-detail-grid--three">
            <DataTable headers={[t.sources, t.visitors, t.sessions, t.pageViews]} rows={current.summary.visitorSourceMix.map((row) => ({ key: `${row.sourceCategory}:${row.sourceName}`, onClick: () => openSourceDrawer(row.sourceCategory, data, locale, openDrawer), values: [row.sourceName, formatCount(row.visitors), formatCount(row.sessions), formatCount(row.pageViews)] }))} />
            <DataTable headers={[t.country, t.visitors, t.pageViews, locale === "zh" ? "占比" : "Share"]} rows={current.summary.countries.map((row) => ({ key: row.countryCode, onClick: () => openDrawer({ current: row.pageViews, focus: "country", key: row.countryCode, previous: previous.summary.countries.find((item) => item.countryCode === row.countryCode)?.pageViews ?? 0, rows: [[t.visitors, formatCount(row.visitors)], [t.pageViews, formatCount(row.pageViews)], [t.locale, row.primaryLocale]], title: `${row.countryName} (${row.countryCode})` }), values: [`${row.countryName} (${row.countryCode})`, formatCount(row.visitors), formatCount(row.pageViews), formatPercent(row.share)] }))} />
            <DataTable headers={[t.device, t.visitors, t.pageViews, locale === "zh" ? "占比" : "Share"]} rows={current.summary.devices.map((row) => ({ key: row.deviceType, values: [row.deviceType, formatCount(row.visitors), formatCount(row.pageViews), formatPercent(row.share)] }))} />
          </div>
        </DetailSection>
        <DetailSection index="11" title={t.quality}>
          <div className="analytics-quality-grid">
            <article><span>{t.botRequests}</span><strong>{formatCount(current.botPageViews)}</strong><DashboardSparkline values={current.botTrend.map((row) => row.pageViews)} /></article>
            <article><span>{locale === "zh" ? "未知来源" : "Unknown source"}</span><strong>{formatPercent(current.unknownSourceShare)}</strong><p>{locale === "zh" ? "主 KPI 已剔除 Bot" : "Bots are excluded from main KPIs"}</p></article>
            <article><span>{locale === "zh" ? "Bot 路径（v2 起）" : "Bot paths (since v2)"}</span><strong>{formatCount(current.bot.uniquePaths)}</strong><p>{formatCount(current.bot.knownFamilyPageViews)} {locale === "zh" ? "次已识别" : "classified"}</p></article>
            <article><span>{locale === "zh" ? "会话 ID 覆盖" : "Session ID coverage"}</span><strong>{formatPercent(current.quality.sessionIdCoverage)}</strong><p>{locale === "zh" ? "访客 ID" : "Visitor ID"}: {formatPercent(current.quality.visitorIdCoverage)}</p></article>
            <DataTable headers={[locale === "zh" ? "Bot family" : "Bot family", t.pageViews]} rows={current.bot.families.map((row) => ({ key: row.label, values: [row.label, formatCount(row.count)] }))} />
            <DataTable headers={[locale === "zh" ? "时间" : "When", locale === "zh" ? "事件" : "Event", locale === "zh" ? "路径" : "Path"]} rows={current.summary.recent.slice(0, 12).map((row) => ({ key: row.id, values: [formatDateTime(row.createdAt, locale), row.eventName, row.pathname] }))} />
          </div>
        </DetailSection>
      </section>

      {drawer ? <AnalyticsDrawer drawer={drawer} locale={locale} onClose={closeDrawer} t={t} /> : null}
    </main>
  );
}

function DashboardPanel({ action, children, className = "", index, meta, title }: { action?: ReactNode; children: ReactNode; className?: string; index: string; meta: string; title: string }) {
  return <section className={`analytics-panel ${className}`}><header><div><span>{index}</span><h2>{title}</h2></div><aside>{action ?? meta}</aside></header>{children}</section>;
}

function TrustItem({ date, label }: { date: string; label: string }) {
  return <span><i className="is-baseline" /><b>{date}</b>{label}</span>;
}

function ComparisonItem({ item, label, locale }: { item: { eligible: boolean; reason?: { en: string; zh: string } }; label: string; locale: DashboardLocale }) {
  return <span className={item.eligible ? "is-valid" : "is-invalid"} title={item.reason?.[locale]}><i />{label}: {item.eligible ? (locale === "zh" ? "可比" : "Comparable") : (locale === "zh" ? "不可比" : "Not comparable")}</span>;
}

function MetricSummary({ label, value }: { label: string; value: string }) {
  return <article className="analytics-metric-summary"><span>{label}</span><strong>{value}</strong></article>;
}

function DetailSection({ children, index, open = false, title }: { children: ReactNode; index: string; open?: boolean; title: string }) {
  return <details className="analytics-detail-section" open={open}><summary><span>{index}</span><strong>{title}</strong><i /></summary><div>{children}</div></details>;
}

function KpiCard({ available = true, partial = false, comparable, current, format = "count", label, onClick, previous, reverseTone = false, spark }: { available?: boolean; partial?: boolean; comparable: boolean; current: number; format?: "count" | "decimal" | "percent"; label: string; onClick: () => void; previous: number; reverseTone?: boolean; spark: number[] }) {
  const change = previous ? (current - previous) / previous : current ? null : 0;
  const positive = change !== null && (reverseTone ? change < 0 : change >= 0);
  return <button className="analytics-kpi-card" disabled={!available} onClick={onClick} type="button"><span>{label}</span><strong>{!available ? "—" : `${partial ? format === "count" ? "≥" : "~" : ""}${format === "percent" ? formatPercent(current) : format === "decimal" ? formatDecimal(current) : formatCount(current)}`}</strong><em className={!comparable ? "is-unavailable" : change === null ? "is-new" : positive ? "is-positive" : "is-negative"}>{!comparable ? "N/A" : change === null ? "NEW" : formatSignedPercent(change)}</em><DashboardSparkline values={spark} /></button>;
}

function FilterSelect({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: Array<{ count: number; label: string; value: string }>; value: string }) {
  return <label><span className="sr-only">{label}</span><select onChange={(event) => onChange(event.target.value)} value={value}><option value="">{label}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label} · {option.count}</option>)}</select></label>;
}

function StatusPill({ label, status, t }: { label: string; status: "connected" | "unavailable"; t: typeof copy.en | typeof copy.zh }) {
  return <span className={status === "connected" ? "is-connected" : "is-warning"}><i />{label}: {status === "connected" ? t.connected : t.unavailable}</span>;
}

function MetricTabs({ includePosition = true, metric, onChange }: { includePosition?: boolean; metric: "clicks" | "ctr" | "impressions" | "position"; onChange: (metric: "clicks" | "ctr" | "impressions" | "position") => void }) {
  const metrics = includePosition
    ? (["clicks", "impressions", "ctr", "position"] as const)
    : (["clicks", "impressions", "ctr"] as const);
  return <div className="analytics-segmented">{metrics.map((item) => <button aria-pressed={metric === item} key={item} onClick={() => onChange(item)} type="button">{item === "impressions" ? "Impr." : item === "position" ? "Pos." : item.toUpperCase()}</button>)}</div>;
}

function DataTable({ headers, rows }: { headers: string[]; rows: Array<{ key: string; onClick?: () => void; values: string[] }> }) {
  return <div className="analytics-table-wrap"><table className="analytics-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row) => <tr className={row.onClick ? "is-clickable" : undefined} key={row.key} onClick={row.onClick}>{row.values.map((value, index) => <td key={`${row.key}:${index}`}>{value}</td>)}</tr>)}</tbody></table></div>;
}

function RateList({ locale, rows }: { locale: DashboardLocale; rows: Array<{ count: number; label: string; share: number }> }) {
  return <div className="analytics-rate-list">{rows.map((row) => <article key={row.label}><span>{translateBehavior(row.label, locale)}</span><strong>{formatCount(row.count)} <em>{formatPercent(row.share)}</em></strong><i><b style={{ width: `${Math.min(100, row.share * 100)}%` }} /></i></article>)}</div>;
}

function AnalyticsDrawer({ drawer, locale, onClose, t }: { drawer: DrawerState; locale: DashboardLocale; onClose: () => void; t: typeof copy.en | typeof copy.zh }) {
  const comparable = drawer.comparable !== false;
  return <div className="analytics-drawer-layer"><button aria-label={t.close} className="analytics-drawer-backdrop" onClick={onClose} type="button" /><aside aria-modal="true" className="analytics-drawer" role="dialog"><header><div><span>{drawer.focus}</span><h2>{drawer.title}</h2></div><button onClick={onClose} type="button">{t.close}</button></header><div className="analytics-drawer-comparison"><article><span>{locale === "zh" ? "本期" : "Current"}</span><strong>{formatCount(drawer.current)}</strong></article><article><span>{t.previous}</span><strong>{comparable ? formatCount(drawer.previous) : "N/A"}</strong></article><article><span>{locale === "zh" ? "变化" : "Change"}</span><strong>{comparable ? formatChange(drawer.current, drawer.previous, t.new) : (locale === "zh" ? "不可比" : "Not comparable")}</strong></article></div><dl>{drawer.rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></aside></div>;
}

function openSourceDrawer(source: string, data: AnalyticsDashboardResponse, locale: DashboardLocale, open: (drawer: DrawerState) => void) {
  const row = data.onsite.current.summary.sourceCategoryVisitors.find((item) => item.label === source);
  const previous = data.onsite.previous.summary.sourceCategoryVisitors.find((item) => item.label === source);
  open({ current: row?.count ?? 0, focus: "source", key: source, previous: previous?.count ?? 0, rows: [[locale === "zh" ? "访客占比" : "Visitor share", formatPercent(row?.share ?? 0)], [locale === "zh" ? "来源分类" : "Source category", source]], title: formatSource(source, locale) });
}

function queryToParams(query: AnalyticsDashboardQuery) {
  const params = new URLSearchParams({ from: query.from, to: query.to, grain: query.grain, compare: query.compare ? "previous" : "none" });
  for (const value of query.filters.sources) params.append("source", value);
  for (const value of query.filters.countries) params.append("country", value);
  for (const value of query.filters.locales) params.append("locale", value);
  for (const value of query.filters.devices) params.append("device", value);
  return params;
}

function metricValue(row: GscMetricRow, metric: "clicks" | "ctr" | "impressions" | "position") { return metric === "ctr" ? row.ctr * 100 : row[metric]; }
function metricLabel(metric: "clicks" | "ctr" | "impressions" | "position", t: typeof copy.en | typeof copy.zh) { return metric === "clicks" ? t.clicks : metric === "impressions" ? t.impressions : metric === "ctr" ? t.ctr : t.avgPosition; }
function bingMetricLabel(metric: "clicks" | "ctr" | "impressions", t: typeof copy.en | typeof copy.zh) { return metric === "clicks" ? t.bingClicks : metric === "impressions" ? t.bingImpressions : t.bingCtr; }
function safeRate(value: number, total: number) { return total ? value / total : 0; }
function formatCount(value: number) { return new Intl.NumberFormat("en-US").format(Math.round(value)); }
function formatDecimal(value: number) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value); }
function formatPercent(value: number) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, style: "percent" }).format(value); }
function formatSignedPercent(value: number) { return `${value > 0 ? "+" : ""}${formatPercent(value)}`; }
function formatChange(current: number, previous: number, newLabel: string) { return previous ? formatSignedPercent((current - previous) / previous) : current ? newLabel : "0%"; }
function formatMetricValue(key: string, value: number) { return key === "rate" ? formatPercent(value) : key === "position" ? formatDecimal(value) : formatCount(value); }
function formatDateTime(value: string, locale: DashboardLocale) { return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-CA", { day: "2-digit", hour: "2-digit", minute: "2-digit", month: "short", timeZone: "America/Toronto" }).format(new Date(value)); }
function shortPath(value: string) { try { return new URL(value).pathname; } catch { return value; } }
function shiftDate(value: string, days: number) { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function differenceInDays(from: string, to: string) { return Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86400000); }
function formatSource(value: string, locale: DashboardLocale) { const labels: Record<string, [string, string]> = { ai: ["AI", "AI"], direct: ["直接访问", "Direct"], other: ["其他", "Other"], referral: ["引荐", "Referral"], search: ["搜索", "Search"], unknown: ["未知", "Unknown"] }; return labels[value]?.[locale === "zh" ? 0 : 1] ?? value; }
function formatClaritySignal(value: ClaritySignalMetricName, locale: DashboardLocale) {
  const labels: Record<ClaritySignalMetricName, [string, string]> = {
    DeadClickCount: ["无效点击 (Dead clicks)", "Dead clicks"],
    ErrorClickCount: ["报错点击 (Error clicks)", "Error clicks"],
    ExcessiveScroll: ["过度滚动 (Excessive scroll)", "Excessive scroll"],
    QuickbackClick: ["快速返回 (Quickback clicks)", "Quickback clicks"],
    RageClickCount: ["暴怒连击 (Rage clicks)", "Rage clicks"],
    ScriptErrorCount: ["脚本错误 (Script errors)", "Script errors"]
  };
  return labels[value]?.[locale === "zh" ? 0 : 1] ?? value;
}
function translateBehavior(value: string, locale: DashboardLocale) { if (locale === "en") return value; const labels: Record<string, string> = { "API / JSON discovery": "API / JSON 探索", "Citation copies": "复制引用", "Record / source opens": "打开记录 / 来源", "Result clicks": "点击搜索结果", "Search submits": "提交搜索" }; return labels[value] ?? value; }
