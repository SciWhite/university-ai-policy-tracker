"use client";

import { useMemo, useState, type MouseEvent } from "react";
import type {
  AnalyticsDashboardMover,
  AnalyticsDashboardOpportunity,
  AnalyticsDashboardSourceTrendRow
} from "@/lib/private-analytics-dashboard-types";
import type { GscMetricRow } from "@/lib/google-search-console";

export interface DashboardLineSeries {
  color: string;
  dashed?: boolean;
  key: string;
  label: string;
  values: number[];
}

export function DashboardSparkline({ values }: { values: number[] }) {
  const path = buildLinePath(values, 80, 24, 1, 2);
  return (
    <svg aria-hidden="true" className="analytics-mini-chart" viewBox="0 0 80 24">
      <path d={path} />
    </svg>
  );
}

export function DashboardLineChart({
  emptyLabel,
  labels,
  series
}: {
  emptyLabel: string;
  labels: string[];
  series: DashboardLineSeries[];
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const visibleSeries = series.filter((item) => !hidden.has(item.key));
  const max = Math.max(...visibleSeries.flatMap((item) => item.values), 0);

  if (!labels.length) return <p className="analytics-empty">{emptyLabel}</p>;

  function handleMove(event: MouseEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    setActiveIndex(Math.round(ratio * Math.max(0, labels.length - 1)));
  }

  function toggle(key: string) {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="analytics-chart-shell">
      <div className="analytics-chart-legend" aria-label="Chart series">
        {series.map((item) => (
          <button
            aria-pressed={!hidden.has(item.key)}
            key={item.key}
            onClick={() => toggle(item.key)}
            type="button"
          >
            <i style={{ background: item.color }} />
            {item.label}
          </button>
        ))}
      </div>
      <div className="analytics-chart-stage">
        <svg
          aria-label="Interactive trend chart"
          className="analytics-line-chart"
          onFocus={() => setActiveIndex(labels.length - 1)}
          onMouseLeave={() => setActiveIndex(null)}
          onMouseMove={handleMove}
          role="img"
          tabIndex={0}
          viewBox="0 0 640 220"
        >
          {[0, 1, 2, 3].map((row) => (
            <line
              className="analytics-chart-gridline"
              key={row}
              x1="18"
              x2="628"
              y1={28 + row * 52}
              y2={28 + row * 52}
            />
          ))}
          {visibleSeries.map((item) => (
            <path
              className={item.dashed ? "is-dashed" : undefined}
              d={buildLinePath(item.values, 610, 168, 18, 28, max)}
              key={item.key}
              style={{ stroke: item.color }}
            />
          ))}
          {activeIndex !== null ? (
            <line
              className="analytics-chart-crosshair"
              x1={pointX(activeIndex, labels.length, 610, 18)}
              x2={pointX(activeIndex, labels.length, 610, 18)}
              y1="20"
              y2="198"
            />
          ) : null}
          <text className="analytics-chart-axis" x="18" y="214">{labels[0]}</text>
          <text className="analytics-chart-axis" textAnchor="end" x="628" y="214">
            {labels.at(-1)}
          </text>
        </svg>
        {activeIndex !== null ? (
          <div
            className={`analytics-chart-tooltip${
              activeIndex === 0
                ? " analytics-chart-tooltip--start"
                : activeIndex === labels.length - 1
                  ? " analytics-chart-tooltip--end"
                  : ""
            }`}
            style={{ left: `${(activeIndex / Math.max(1, labels.length - 1)) * 100}%` }}
          >
            <strong>{labels[activeIndex]}</strong>
            {visibleSeries.map((item) => (
              <span key={item.key}>
                <i style={{ background: item.color }} />
                {item.label}: {formatNumber(item.values[activeIndex] ?? 0)}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DashboardSourceChart({
  emptyLabel,
  labels,
  onSelect,
  rows
}: {
  emptyLabel: string;
  labels: Record<string, string>;
  onSelect: (source: string) => void;
  rows: AnalyticsDashboardSourceTrendRow[];
}) {
  const [active, setActive] = useState<{ index: number; key: SourceKey } | null>(null);
  const keys: SourceKey[] = ["direct", "search", "ai", "referral", "unknown", "other"];
  const colors: Record<SourceKey, string> = {
    ai: "var(--analytics-ai)",
    direct: "var(--analytics-direct)",
    other: "var(--analytics-other)",
    referral: "var(--analytics-referral)",
    search: "var(--analytics-search)",
    unknown: "var(--analytics-unknown)"
  };
  const max = Math.max(...rows.map((row) => keys.reduce((sum, key) => sum + row[key], 0)), 0);

  if (!rows.length || max === 0) {
    return <p className="analytics-empty">{emptyLabel}</p>;
  }

  return (
    <div className="analytics-chart-shell">
      <div className="analytics-chart-legend">
        {keys.map((key) => (
          <button key={key} onClick={() => onSelect(key)} type="button">
            <i style={{ background: colors[key] }} />{labels[key] ?? key}
          </button>
        ))}
      </div>
      <div className="analytics-chart-stage">
        <svg
          aria-label="Source composition over time"
          className="analytics-source-chart"
          onMouseLeave={() => setActive(null)}
          role="img"
          viewBox="0 0 640 220"
        >
          {rows.map((row, index) => {
            const width = Math.max(4, Math.min(28, 560 / Math.max(rows.length, 1) - 4));
            const x = 42 + index * (560 / Math.max(rows.length, 1));
            let cumulative = 0;
            return (
              <g key={`${row.label}:${index}`}>
                {keys.map((key) => {
                  const height = max ? (row[key] / max) * 164 : 0;
                  cumulative += height;
                  return (
                    <rect
                      aria-label={`${labels[key] ?? key} ${row[key]}`}
                      fill={colors[key]}
                      height={height}
                      key={key}
                      onClick={() => onSelect(key)}
                      onFocus={() => setActive({ index, key })}
                      onMouseEnter={() => setActive({ index, key })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") onSelect(key);
                      }}
                      role="button"
                      tabIndex={0}
                      width={width}
                      x={x}
                      y={194 - cumulative}
                    />
                  );
                })}
              </g>
            );
          })}
          <text className="analytics-chart-axis" x="42" y="214">{rows[0]?.label}</text>
          <text className="analytics-chart-axis" textAnchor="end" x="608" y="214">
            {rows.at(-1)?.label}
          </text>
        </svg>
        {active ? (
          <div
            className="analytics-chart-tooltip"
            style={{ left: `${(active.index / Math.max(1, rows.length - 1)) * 100}%` }}
          >
            <strong>{rows[active.index]?.label}</strong>
            <span><i style={{ background: colors[active.key] }} />{labels[active.key]}: {rows[active.index]?.[active.key]}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DashboardOpportunityChart({
  emptyLabel,
  lowCtrLabel,
  onSelect,
  opportunities,
  rows
}: {
  emptyLabel: string;
  lowCtrLabel: string;
  onSelect: (row: GscMetricRow) => void;
  opportunities: AnalyticsDashboardOpportunity[];
  rows: GscMetricRow[];
}) {
  const plotted = useMemo(
    () => rows.filter((row) => row.impressions > 0).slice(0, 60),
    [rows]
  );
  const opportunityKeys = new Set(opportunities.map((row) => row.key));
  const [active, setActive] = useState<GscMetricRow | null>(null);
  const maxImpressions = Math.max(...plotted.map((row) => row.impressions), 1);
  const maxCtr = Math.max(...plotted.map((row) => row.ctr), 0.05);

  if (!plotted.length) return <p className="analytics-empty">{emptyLabel}</p>;

  return (
    <div className="analytics-chart-stage analytics-opportunity-stage">
      <span className="analytics-opportunity-hint">{lowCtrLabel}</span>
      <svg
        aria-label="Query opportunity matrix"
        className="analytics-opportunity-chart"
        onMouseLeave={() => setActive(null)}
        role="img"
        viewBox="0 0 640 260"
      >
        <line className="analytics-chart-gridline" x1="52" x2="620" y1="222" y2="222" />
        <line className="analytics-chart-gridline" x1="52" x2="52" y1="20" y2="222" />
        {plotted.map((row) => {
          const x = 52 + (Math.log10(row.impressions + 1) / Math.log10(maxImpressions + 1)) * 552;
          const y = 222 - Math.min(1, row.ctr / maxCtr) * 190;
          const radius = 4 + Math.min(10, Math.sqrt(row.clicks + 1) * 1.8);
          const isOpportunity = opportunityKeys.has(row.key);
          return (
            <circle
              aria-label={`${row.key}: ${row.impressions} impressions, ${formatPercent(row.ctr)} CTR`}
              className={isOpportunity ? "is-opportunity" : undefined}
              cx={x.toFixed(3)}
              cy={y.toFixed(3)}
              key={row.key}
              onClick={() => onSelect(row)}
              onFocus={() => setActive(row)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onSelect(row);
              }}
              onMouseEnter={() => setActive(row)}
              r={radius.toFixed(3)}
              role="button"
              tabIndex={0}
            />
          );
        })}
        <text className="analytics-chart-axis" x="52" y="248">Low impressions</text>
        <text className="analytics-chart-axis" textAnchor="end" x="620" y="248">High impressions</text>
        <text className="analytics-chart-axis" x="4" y="28">High CTR</text>
        <text className="analytics-chart-axis" x="4" y="218">Low CTR</text>
      </svg>
      {active ? (
        <div className="analytics-chart-tooltip analytics-chart-tooltip--fixed">
          <strong>{active.key}</strong>
          <span>{formatNumber(active.impressions)} impr. · {formatPercent(active.ctr)} CTR</span>
          <span>{formatNumber(active.clicks)} clicks · pos. {active.position.toFixed(1)}</span>
        </div>
      ) : null}
    </div>
  );
}

export function DashboardMoverChart({
  newLabel,
  onSelect,
  rows
}: {
  newLabel: string;
  onSelect: (row: AnalyticsDashboardMover) => void;
  rows: AnalyticsDashboardMover[];
}) {
  const max = Math.max(...rows.map((row) => Math.abs(row.current - row.previous)), 1);
  return (
    <div className="analytics-mover-chart">
      {rows.slice(0, 8).map((row) => {
        const delta = row.current - row.previous;
        return (
          <button key={row.label} onClick={() => onSelect(row)} type="button">
            <span title={row.label}>{row.label}</span>
            <i className={delta >= 0 ? "is-positive" : "is-negative"}>
              <b style={{ width: `${Math.max(3, Math.abs(delta) / max * 100)}%` }} />
            </i>
            <strong className={delta >= 0 ? "is-positive" : "is-negative"}>
              {row.change === null ? newLabel : `${delta >= 0 ? "+" : ""}${formatPercent(row.change ?? 0)}`}
            </strong>
          </button>
        );
      })}
    </div>
  );
}

type SourceKey = "ai" | "direct" | "other" | "referral" | "search" | "unknown";

function buildLinePath(
  values: number[],
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
  explicitMax?: number
) {
  const max = explicitMax ?? Math.max(...values, 0);
  return values
    .map((value, index) => {
      const x = pointX(index, values.length, width, offsetX);
      const y = offsetY + height - (max ? value / max * height : 0);
      return `${index ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function pointX(index: number, length: number, width: number, offset: number) {
  return offset + (length <= 1 ? 0 : index / (length - 1) * width);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, style: "percent" }).format(value);
}
