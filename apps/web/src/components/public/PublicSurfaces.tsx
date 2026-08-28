import { cn } from "@site-secure/ui";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { pub } from "../../i18n/public-he";
import { useReducedMotion } from "./useReducedMotion";

export function HeroConsole() {
  return (
    <aside aria-label={pub.previewAria} className="public-preview" dir="ltr">
      <div className="public-app public-preview-shell overflow-hidden">
        <div className="public-app-bar">
          <p className="public-mono text-[11px] tracking-[0.14em] text-fg-muted">{pub.previewChrome}</p>
          <p className="public-mono text-[10px] tracking-[0.16em] text-action">{pub.previewBadge}</p>
        </div>

        <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
          <div className="border-b border-border px-5 py-6 sm:px-6 lg:border-b-0 lg:border-e lg:px-7 lg:py-7">
            <p className="ltr-meta text-xl font-semibold tracking-[-0.03em] text-fg sm:text-2xl">{pub.siteNameEn}</p>
            <p className="public-mono mt-1.5 text-xs text-fg-muted">{pub.previewRef}</p>
            <p className="public-mono mt-5 flex items-center gap-2 text-xs text-fg">
              <span className="auth-status-pulse size-1.5 rounded-full bg-success" aria-hidden />
              {pub.previewStatus}
            </p>
            <dl className="mt-8 grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {pub.previewMetrics.map(([n, l]) => (
                <div key={l}>
                  <dd className="public-mono text-2xl font-semibold tracking-[-0.03em] text-fg">{n}</dd>
                  <dt className="public-mono mt-1 text-[10px] tracking-[0.12em] text-fg-muted">{l}</dt>
                </div>
              ))}
            </dl>
          </div>

          <div className="bg-public-elevated/35 px-5 py-6 sm:px-6 lg:px-6 lg:py-7">
            <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">{pub.previewOps}</p>
            <div className="mt-4 flex items-start justify-between gap-3">
              <div>
                <p className="public-mono text-2xl font-semibold tracking-[-0.04em] text-fg">{pub.previewOpsTime}</p>
                <p className="ltr-meta mt-2 text-sm font-medium text-fg">{pub.previewOpsJob}</p>
                <p className="ltr-meta mt-1 text-sm text-fg-muted">
                  {pub.previewOpsAddr}
                  <br />
                  {pub.previewOpsCity}
                </p>
              </div>
              <span className="public-mono text-[10px] tracking-[0.14em] text-success">LIVE</span>
            </div>
            <div className="mt-5 border-t border-border pt-4">
              <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{pub.previewOpsEquip}</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {pub.previewOpsItems.map((item) => (
                  <li key={item} className="public-mono text-sm text-fg">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <p
              className="mt-5 inline-flex min-h-10 w-full items-center justify-center rounded-[var(--radius-control)] bg-action text-sm font-medium text-action-fg"
              aria-hidden
            >
              {pub.previewOpsStart}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function ChaosChain() {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState(1);

  useEffect(() => {
    if (reduced) {
      setPhase(1);
      return;
    }
    setPhase(0);
    const id = window.setInterval(() => {
      setPhase((n) => (n === 0 ? 1 : 0));
    }, 3800);
    return () => window.clearInterval(id);
  }, [reduced]);

  return (
    <div className="grid items-stretch gap-10 lg:grid-cols-[minmax(0,0.9fr)_auto_minmax(0,1.1fr)] lg:gap-8" dir="ltr">
      <div className={cn("transition-opacity duration-500", phase === 0 ? "opacity-100" : "opacity-45")}>
        <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">BEFORE</p>
        <ol className="mt-7 flex flex-col">
          {pub.chaosTools.map((step, i) => (
            <li key={step} className="flex flex-col">
              <span className="public-mono text-lg tracking-[0.08em] text-fg sm:text-xl">{step}</span>
              {i < pub.chaosTools.length - 1 ? (
                <span className="public-spine-inline my-2.5 h-6 w-px bg-border" aria-hidden />
              ) : null}
            </li>
          ))}
        </ol>
      </div>

      <div className="hidden items-center lg:flex" aria-hidden>
        <div className="public-chaos-bridge" />
      </div>

      <div
        className={cn(
          "border border-border bg-public-card px-5 py-7 transition-opacity duration-500 sm:px-7 sm:py-8",
          phase === 1 ? "opacity-100" : "opacity-70",
        )}
      >
        <p className="public-mono text-[11px] tracking-[0.18em] text-action">{pub.brand}</p>
        <p className="ltr-meta mt-3 text-2xl font-semibold tracking-[-0.04em] text-fg sm:text-[1.75rem]">{pub.chaosResolve}</p>
        <ul className="mt-8 divide-y divide-border border-y border-border">
          {pub.chaosPillars.map((item) => (
            <li key={item} className="public-mono flex items-center justify-between py-3 text-xs tracking-[0.12em] text-fg">
              <span>{item}</span>
              <span className="text-fg-muted">●</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const floors = [
  { n: "01", cams: ["CAM-001", "CAM-002", "CAM-003"] },
  { n: "02", cams: ["CAM-018", "CAM-019", "CAM-020"] },
] as const;

export function SiteFileStage() {
  const [tab, setTab] = useState<(typeof pub.siteFileTabs)[number]>("Overview");

  return (
    <div className="public-app overflow-hidden" dir="ltr">
      <div className="public-app-bar public-app-tabs gap-3 overflow-x-auto">
        <div className="flex min-w-0 flex-1 gap-0">
          {pub.siteFileTabs.map((item) => (
            <button
              key={item}
              type="button"
              className={cn(
                "public-mono shrink-0 border-b-2 px-3 py-2 text-[11px] tracking-[0.08em] transition-colors duration-200",
                tab === item
                  ? "border-fg text-fg"
                  : "border-transparent text-fg-muted hover:text-fg",
              )}
              aria-pressed={tab === item}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <p className="public-mono shrink-0 text-[10px] tracking-[0.16em] text-action">{pub.previewBadge}</p>
      </div>

      <div className="px-5 py-7 sm:px-7 lg:px-10 lg:py-9">
        <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">{pub.previewProduct}</p>
        <p className="ltr-meta mt-3 text-2xl font-semibold tracking-[-0.03em] text-fg sm:text-3xl">{pub.siteNameEn}</p>
        <p dir="rtl" className="mt-1 text-sm text-fg-muted">
          {pub.siteName}
        </p>
        <p className="public-mono mt-2 text-xs text-fg-muted">{pub.previewRef}</p>

        <dl className="mt-9 flex flex-wrap gap-x-10 gap-y-5 border-y border-border py-6">
          {[
            ["24", "CAMERAS"],
            ["2", "NVRs"],
            ["3", "SWITCHES"],
          ].map(([n, l]) => (
            <div key={l}>
              <dd className="public-mono text-3xl font-semibold tracking-[-0.03em] text-fg">{n}</dd>
              <dt className="public-mono mt-1 text-[10px] tracking-[0.14em] text-fg-muted">{l}</dt>
            </div>
          ))}
        </dl>

        {tab === "Overview" || tab === "Devices" ? (
          <div className="mt-8 grid gap-8 sm:grid-cols-2 sm:gap-0 sm:divide-x sm:divide-border">
            {floors.map((floor, idx) => (
              <div key={floor.n} className={cn(idx === 0 ? "sm:pe-8" : "sm:ps-8")}>
                <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">FLOOR {floor.n}</p>
                <ul className="mt-4 divide-y divide-border border-y border-border">
                  {floor.cams.map((cam) => (
                    <li key={cam} className="public-mono flex items-center gap-3 py-3 text-sm text-fg">
                      <span className="size-1.5 rounded-full bg-success" aria-hidden />
                      {cam}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 border border-border px-5 py-8">
            <p className="public-mono text-sm tracking-[0.1em] text-fg-muted">{tab.toUpperCase()}</p>
            <p className="ltr-meta mt-3 max-w-md text-sm leading-6 text-fg-muted">
              Illustrative product chrome for the {tab.toLowerCase()} layer of a Site File — not live customer data.
            </p>
          </div>
        )}

        <dl className="mt-10 grid max-w-lg grid-cols-2 gap-y-3 border-t border-border pt-6">
          {[
            ["WARRANTY", "ACTIVE"],
            ["LAST SERVICE", "12.01.2026"],
            ["DOCUMENTS", "08"],
            ["PHOTOS", "03"],
          ].map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="public-mono text-[11px] tracking-[0.12em] text-fg-muted">{k}</dt>
              <dd className="public-mono text-[11px] text-fg">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-xs text-fg-muted" dir="rtl">
          {pub.siteFileIntent}
        </p>
      </div>
    </div>
  );
}

const twinRecords = [
  { id: "site", label: "SITE", title: "GOLDA MEIR SCHOOL", rows: [["REF", "AS-S-2026-000142"], ["CAMERAS", "24"]] },
  { id: "floor", label: "FLOOR", title: "FLOOR 02", rows: [["ZONE", "EAST WING"], ["DEVICES", "12"]] },
  { id: "system", label: "SYSTEM", title: "CCTV", rows: [["NVR", "NVR-02"], ["RECORDING", "ACTIVE"]] },
  {
    id: "device",
    label: "DEVICE",
    title: "CAM-018",
    rows: [
      ["MODEL", "UNV 4MP Dome"],
      ["SERIAL", "UNV-XXXXXX"],
      ["INSTALLED", "14.02.2026"],
      ["WARRANTY", "Active"],
      ["LAST SERVICE", "12.01.2026"],
    ],
  },
  { id: "serial", label: "SERIAL", title: "UNV-XXXXXX", rows: [["DEVICE", "CAM-018"], ["VENDOR", "UNV"]] },
  { id: "warranty", label: "WARRANTY", title: "ACTIVE", rows: [["REMAINING", "14 MONTHS"], ["COVER", "PARTS + LABOR"]] },
  { id: "service", label: "SERVICE", title: "12.01.2026", rows: [["TECH", "FIELD-04"], ["NEXT", "SCHEDULED"]] },
] as const;

export function TwinExplorer() {
  const [id, setId] = useState<(typeof twinRecords)[number]["id"]>("device");
  const selected = twinRecords.find((node) => node.id === id) ?? twinRecords[3];

  return (
    <div className="grid gap-8 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-10" dir="ltr">
      <ol className="public-twin-rail relative flex flex-row flex-wrap items-center gap-x-2 gap-y-2 lg:flex-col lg:items-stretch lg:gap-0">
        {twinRecords.map((node, i) => (
          <li key={node.id} className="relative flex flex-row items-center gap-2 lg:flex-col lg:items-stretch">
            <button
              type="button"
              className={cn(
                "public-mono w-full py-1.5 text-start text-sm tracking-[0.14em] transition-colors duration-200",
                id === node.id ? "text-fg" : "text-fg-muted hover:text-fg",
              )}
              aria-pressed={id === node.id}
              onClick={() => setId(node.id)}
              onMouseEnter={() => setId(node.id)}
            >
              <span className="lg:flex lg:items-center lg:gap-3">
                <span
                  className={cn(
                    "hidden size-1.5 shrink-0 rounded-full lg:inline-block",
                    id === node.id ? "bg-action" : "bg-border",
                  )}
                  aria-hidden
                />
                {node.label}
              </span>
            </button>
            {i < twinRecords.length - 1 ? (
              <span className="text-fg-muted lg:ms-[2px] lg:h-4 lg:w-px lg:bg-border lg:ps-0 lg:text-[0px]" aria-hidden>
                ↓
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      <div className="border border-border bg-public-card px-5 py-7 sm:px-7 sm:py-8">
        <p className="public-mono text-[10px] tracking-[0.16em] text-action">{selected.label}</p>
        <p className="ltr-meta mt-3 text-2xl font-semibold tracking-[-0.03em] text-fg sm:text-3xl">{selected.title}</p>
        <dl className="mt-8 flex max-w-md flex-col">
          {selected.rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-6 border-b border-border py-3 first:border-t">
              <dt className="public-mono text-[10px] tracking-[0.14em] text-fg-muted">{k}</dt>
              <dd className="public-mono text-sm text-fg">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

export function OpsChain() {
  const reduced = useReducedMotion();
  const locked = 3;
  const [tick, setTick] = useState(locked);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => {
      setTick((n) => (n >= pub.opsSteps.length - 1 ? locked : n + 1));
    }, 1600);
    return () => window.clearInterval(id);
  }, [reduced]);

  return (
    <div dir="ltr">
      <ol className="public-ops-rail flex gap-0 overflow-x-auto border border-border">
        {pub.opsSteps.map((step, i) => {
          const done = i < tick;
          const active = i === tick;
          const pending = i > tick;
          return (
            <li
              key={step}
              className={cn(
                "public-ops-node relative min-w-[8rem] flex-1 border-e border-border px-4 py-5 last:border-e-0",
                done && "bg-public-elevated/40",
                active && "bg-action/10",
                pending && "opacity-55",
              )}
            >
              <span
                className={cn(
                  "public-mono text-[10px] tracking-[0.16em]",
                  active ? "text-action" : "text-fg-muted",
                )}
              >
                {done ? "COMPLETED" : active ? "ACTIVE" : "PENDING"}
              </span>
              <p className={cn("public-mono mt-2 text-sm tracking-[0.12em]", pending ? "text-fg-muted" : "text-fg")}>
                {step}
              </p>
              {active ? <span className="public-ops-active-bar" aria-hidden /> : null}
            </li>
          );
        })}
      </ol>
      <p className="ltr-meta mt-8 max-w-xl text-[15px] leading-7 text-fg-muted">{pub.opsSub}</p>
    </div>
  );
}

export function FieldPhone() {
  return (
    <div className="mx-auto w-full max-w-[22.5rem]">
      <div className="public-device-frame border border-border bg-public-elevated p-2">
        <div className="min-h-[34rem] overflow-hidden bg-public-surface sm:min-h-[36rem]">
          <div className="flex justify-center border-b border-border py-3" aria-hidden>
            <span className="h-1 w-16 rounded-full bg-border" />
          </div>
          <div className="px-5 pt-5" dir="ltr">
            <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">{pub.brand}</p>
            <p className="public-mono mt-7 text-[10px] tracking-[0.2em] text-fg-muted">{pub.fieldToday}</p>
            <p className="public-mono mt-2 text-4xl font-semibold tracking-[-0.04em] text-fg">{pub.fieldTime}</p>
            <p className="public-mono mt-6 text-[11px] tracking-[0.16em] text-action">{pub.fieldJob}</p>
            <p className="mt-2 text-lg font-medium text-fg" dir="rtl">
              {pub.fieldJobHe}
            </p>
            <p className="ltr-meta mt-2 text-sm text-fg-muted">
              {pub.fieldAddr}
              <br />
              {pub.fieldCity}
            </p>
          </div>
          <div className="mt-7 px-5" dir="ltr">
            <p className="public-mono text-[10px] tracking-[0.18em] text-fg-muted">{pub.fieldEquip}</p>
            <ul className="mt-2 divide-y divide-border border-y border-border">
              {pub.fieldItems.map((item) => (
                <li key={item} className="public-mono py-2.5 text-sm text-fg">
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-6 px-5" dir="ltr">
            <p className="public-mono text-[10px] tracking-[0.18em] text-fg-muted">{pub.fieldTech}</p>
            <p className="ltr-meta mt-1 text-sm text-fg">{pub.fieldTechName}</p>
          </div>
          <div className="px-5 pt-8 pb-6">
            <p
              className="inline-flex min-h-12 w-full items-center justify-center rounded-[var(--radius-control)] bg-action text-sm font-medium text-action-fg"
              aria-hidden
            >
              {pub.fieldStart}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function IntelligencePanel() {
  return (
    <div className="border border-border bg-public-card overflow-hidden" dir="ltr">
      <div className="public-app-bar">
        <p className="public-mono text-[11px] tracking-[0.14em] text-fg-muted">{pub.intelChrome}</p>
        <p className="public-mono text-[10px] tracking-[0.16em] text-action">{pub.previewBadge}</p>
      </div>
      <div className="px-5 py-7 sm:px-7">
        <p className="ltr-meta text-lg font-medium text-fg sm:text-xl">{pub.intelSummary}</p>
        <ul className="mt-6 divide-y divide-border border-y border-border">
          {pub.intelItems.map((item) => (
            <li key={item.code} className="flex items-start gap-4 py-4">
              <span className="public-mono mt-0.5 text-[10px] tracking-[0.12em] text-warning">ATTN</span>
              <div>
                <p className="public-mono text-sm tracking-[0.08em] text-fg">{item.code}</p>
                <p className="ltr-meta mt-1 text-sm text-fg-muted">{item.detail}</p>
              </div>
            </li>
          ))}
        </ul>
        <p
          className="mt-6 inline-flex min-h-11 items-center justify-center border border-border px-4 text-sm font-medium text-fg"
          aria-hidden
        >
          {pub.intelAction}
        </p>
        <p className="mt-5 text-xs text-fg-muted">{pub.intelIntent}</p>
      </div>
    </div>
  );
}

export function SecurityArch() {
  return (
    <div dir="ltr">
      <ul className="divide-y divide-border border border-border">
        {pub.securityPillars.map((pillar) => (
          <li key={pillar.title} className="grid gap-2 px-5 py-5 sm:grid-cols-[minmax(10rem,14rem)_minmax(0,1fr)] sm:gap-8 sm:px-6">
            <p className="ltr-meta text-[15px] font-medium tracking-[-0.01em] text-fg">{pillar.title}</p>
            <p className="ltr-meta text-sm leading-6 text-fg-muted">{pillar.body}</p>
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <Link to="/legal/$slug" params={{ slug: "security" }} className="public-cta-secondary">
          {pub.securityCta}
        </Link>
      </div>
    </div>
  );
}

export function MetricsStrip() {
  return (
    <dl className="grid grid-cols-2 gap-y-10 border-y border-border py-8 lg:grid-cols-4 lg:divide-x lg:divide-border" dir="ltr">
      {pub.metrics.map((metric, i) => (
        <div key={metric.label} className={cn("lg:px-8", i === 0 && "lg:ps-0")}>
          <dd className="public-mono text-4xl font-semibold tracking-[-0.05em] text-fg sm:text-5xl">{metric.value}</dd>
          <dt className="ltr-meta mt-3 text-sm text-fg-muted">{metric.label}</dt>
        </div>
      ))}
    </dl>
  );
}
