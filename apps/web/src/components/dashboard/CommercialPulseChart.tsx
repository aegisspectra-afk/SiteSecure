import type { BusinessChart } from "@site-secure/api-client";
import type { ApexOptions } from "apexcharts";
import { useMemo, useState } from "react";
import Chart from "react-apexcharts";
import { he } from "../../i18n/he";
import { meaningfulChangePercent } from "../../lib/attention-queue";
import { useTheme } from "../../lib/use-theme";

type RangeMonths = 3 | 6 | 12;

function readCssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function sliceForRange(chart: BusinessChart, months: RangeMonths) {
  const len = chart.labels_he.length;
  const take = Math.min(months, len);
  const start = Math.max(0, len - take);
  return {
    labels: chart.labels_he.slice(start),
    revenue: chart.revenue.slice(start),
  };
}

export function CommercialPulseChart({ chart }: { chart: BusinessChart }) {
  const { resolved } = useTheme();
  const [range, setRange] = useState<RangeMonths>(6);
  const change = meaningfulChangePercent(chart.revenue_change_percent, chart.revenue ?? null);
  const sliced = useMemo(() => sliceForRange(chart, range), [chart, range]);

  const colors = useMemo(() => {
    void resolved;
    return {
      line: readCssVar("--color-fg", "#0f172a"),
      fgSubtle: readCssVar("--color-fg-subtle", "#64748b"),
      border: readCssVar("--color-border", "#d8dee8"),
      bg: readCssVar("--color-bg", "#ffffff"),
    };
  }, [resolved]);

  const options: ApexOptions = useMemo(
    () => ({
      chart: {
        id: "commercial-pulse",
        type: "area",
        fontFamily: "Heebo, Inter, ui-sans-serif, system-ui, sans-serif",
        background: "transparent",
        toolbar: {
          show: true,
          tools: {
            download: false,
            selection: true,
            zoom: true,
            zoomin: false,
            zoomout: false,
            pan: true,
            reset: true,
          },
        },
        zoom: { enabled: true, type: "x", autoScaleYaxis: true },
        selection: { enabled: true },
        animations: { enabled: true, speed: 180 },
        sparkline: { enabled: false },
      },
      theme: { mode: resolved },
      colors: [colors.line],
      dataLabels: { enabled: false },
      stroke: { curve: "straight", width: 2 },
      fill: {
        type: "solid",
        opacity: resolved === "dark" ? 0.1 : 0.07,
      },
      grid: {
        borderColor: colors.border,
        strokeDashArray: 0,
        padding: { left: 2, right: 6, top: 0, bottom: 0 },
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
      },
      xaxis: {
        categories: sliced.labels,
        labels: {
          style: { colors: colors.fgSubtle, fontSize: "10px", fontWeight: 400 },
        },
        axisBorder: { show: true, color: colors.border },
        axisTicks: { show: false },
        tooltip: { enabled: false },
      },
      yaxis: {
        labels: {
          style: { colors: colors.fgSubtle, fontSize: "10px", fontWeight: 400 },
          formatter: (value: number) => {
            if (value >= 1000) return `${Math.round(value / 1000)}k`;
            return String(Math.round(value));
          },
        },
      },
      tooltip: {
        theme: resolved,
        style: { fontSize: "12px" },
        marker: { show: true },
        y: {
          formatter: (value: number) =>
            new Intl.NumberFormat("he-IL", {
              style: "currency",
              currency: "ILS",
              maximumFractionDigits: 0,
            }).format(value),
        },
      },
      legend: { show: false },
      markers: {
        size: 0,
        hover: { size: 4 },
        strokeColors: colors.bg,
        strokeWidth: 1.5,
      },
    }),
    [colors, resolved, sliced.labels],
  );

  const series = useMemo(
    () => [{ name: he.businessChartQuoteValueTrend, data: sliced.revenue }],
    [sliced.revenue],
  );

  return (
    <div className="ops-commercial-chart">
      <div className="ops-commercial-chart-toolbar">
        <div className="ops-commercial-chart-label">
          <span>{he.businessChartQuoteValueTrend}</span>
          {change != null ? (
            <span className={change > 0 ? "text-success" : "text-danger"}>
              {change > 0 ? "+" : ""}
              {change}%
            </span>
          ) : null}
        </div>
        <div className="ops-chart-ranges" role="group" aria-label={he.commercialChartRangeAria}>
          {([3, 6, 12] as const).map((months) => (
            <button
              key={months}
              type="button"
              className={`ops-chart-range${range === months ? " is-active" : ""}`}
              aria-pressed={range === months}
              onClick={() => setRange(months)}
            >
              {he.commercialChartRange(months)}
            </button>
          ))}
        </div>
      </div>
      <div className="ops-commercial-apex" role="img" aria-label={he.businessChartAria(sliced.labels, sliced.revenue)}>
        <Chart options={options} series={series} type="area" height={168} width="100%" />
      </div>
      <div className="ops-commercial-chart-footer">
        <a href="/app/analytics" className="ops-section-link">
          {he.commercialFullAnalysis}
        </a>
      </div>
    </div>
  );
}
