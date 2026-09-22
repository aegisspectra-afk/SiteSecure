import { cn } from "@site-secure/ui";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { pub } from "../../i18n/public-he";
import { useReducedMotion } from "./useReducedMotion";

/** In-product preview action — distinct from landing conversion CTAs. */
function PreviewAction({ label }: { label: string }) {
  return (
    <p className="public-preview-action" aria-hidden>
      {label}
    </p>
  );
}

export function HeroConsole() {
  return (
    <aside aria-label={pub.previewAria} className="public-preview public-focal" dir="ltr">
      <div className="public-focal-stack" aria-hidden>
        <span className="public-focal-layer is-back" />
        <span className="public-focal-layer is-mid" />
      </div>
      <div className="public-app public-preview-shell public-preview-object public-focal-front overflow-hidden">
        <div className="public-preview-accent" aria-hidden />
        <div className="public-app-bar">
          <p className="public-mono text-[11px] tracking-[0.14em] text-fg-muted">{pub.previewChrome}</p>
          <p className="public-mono text-[10px] tracking-[0.16em] text-action">{pub.previewBadge}</p>
        </div>

        <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
          <div className="border-b border-border px-5 py-5 sm:px-6 sm:py-6 lg:border-b-0 lg:border-e lg:px-7 lg:py-7">
            <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{pub.previewProduct}</p>
            <p className="ltr-meta mt-2 text-xl font-semibold tracking-[-0.03em] text-fg sm:text-2xl">{pub.siteNameEn}</p>
            <p className="public-mono mt-1.5 text-xs text-fg-muted">{pub.previewRef}</p>
            <p className="public-mono mt-5 flex items-center gap-2 text-xs text-fg">
              <span className="auth-status-pulse size-1.5 rounded-full bg-success" aria-hidden />
              {pub.previewStatus}
            </p>
            <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {pub.previewMetrics.map(([n, l]) => (
                <div key={l} className="public-metric-cell">
                  <dd className="public-mono text-[1.65rem] font-semibold tracking-[-0.04em] text-fg sm:text-2xl">{n}</dd>
                  <dt className="public-mono mt-0.5 text-[10px] tracking-[0.12em] text-fg-muted">{l}</dt>
                </div>
              ))}
            </dl>
          </div>

          <div className="bg-public-elevated/45 px-5 py-5 sm:px-6 lg:px-6 lg:py-7">
            <div className="flex items-center justify-between gap-3">
              <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">{pub.previewOps}</p>
              <span className="public-mono text-[10px] tracking-[0.14em] text-success">LIVE</span>
            </div>
            <p className="public-mono mt-3 text-[1.75rem] font-semibold tracking-[-0.045em] text-fg">{pub.previewOpsTime}</p>
            <p className="ltr-meta mt-2 text-sm font-medium text-fg">{pub.previewOpsJob}</p>
            <p className="ltr-meta mt-1 text-sm text-fg-muted">
              {pub.previewOpsAddr}, {pub.previewOpsCity}
            </p>
            <ul className="public-row-list mt-4">
              {pub.previewOpsItems.map((item) => (
                <li key={item} className="public-row">
                  <span className="public-row-dot" aria-hidden />
                  <span className="public-mono text-sm text-fg">{item}</span>
                </li>
              ))}
            </ul>
            <PreviewAction label={pub.previewOpsStart} />
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
    <div className="grid items-stretch gap-8 lg:grid-cols-[minmax(0,0.85fr)_auto_minmax(0,1.15fr)] lg:gap-8" dir="ltr">
      <div
        className={cn(
          "public-chaos-before transition-opacity duration-500",
          phase === 0 ? "opacity-100" : "opacity-40",
        )}
      >
        <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">BEFORE</p>
        <ol className="mt-5 flex flex-col">
          {pub.chaosTools.map((step, i) => (
            <li key={step} className="public-chaos-tool flex flex-col">
              <span className="public-mono text-lg tracking-[0.08em] text-fg-muted sm:text-xl">{step}</span>
              {i < pub.chaosTools.length - 1 ? (
                <span className="public-spine-inline my-2 h-4 w-px bg-border" aria-hidden />
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
          "public-chaos-after public-dominant-surface transition-opacity duration-500",
          phase === 1 ? "opacity-100" : "opacity-70",
        )}
      >
        <p className="public-mono text-[11px] tracking-[0.18em] text-action">{pub.brand}</p>
        <p className="ltr-meta mt-2 text-2xl font-semibold tracking-[-0.035em] text-fg sm:text-[1.75rem]">
          {pub.chaosResolve}
        </p>
        <ul className="public-row-list mt-6 border-y border-border">
          {pub.chaosPillars.map((item) => (
            <li key={item} className="public-row is-dense">
              <span className="public-mono text-xs tracking-[0.12em] text-fg">{item}</span>
              <span className="size-1.5 rounded-full bg-action" aria-hidden />
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

const siteMeta = [
  ["WARRANTY", "ACTIVE"],
  ["LAST SERVICE", "12.01.2026"],
  ["DOCUMENTS", "08"],
  ["PHOTOS", "03"],
] as const;

export function SiteFileStage() {
  const [tab, setTab] = useState<(typeof pub.siteFileTabs)[number]>("Overview");
  const tabIndex = pub.siteFileTabs.indexOf(tab);

  return (
    <div className="public-dossier-shell" dir="ltr">
      <div className="public-app public-dossier public-dominant-surface overflow-hidden">
        <div className="public-dossier-accent" aria-hidden />

        {/* Identity band — Profile hierarchy translated to site identity */}
        <div className="public-dossier-identity">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">{pub.previewProduct}</p>
              <p className="ltr-meta mt-2 text-2xl font-semibold tracking-[-0.03em] text-fg sm:text-[1.85rem]">
                {pub.siteNameEn}
              </p>
              <p dir="rtl" lang="he" className="mt-1 text-sm text-fg-muted">
                {pub.siteName}
              </p>
              <p className="public-mono mt-2 text-xs text-fg-muted">{pub.previewRef}</p>
            </div>
            <p className="public-mono shrink-0 text-[10px] tracking-[0.16em] text-action">{pub.previewBadge}</p>
          </div>

          <dl className="public-dossier-summary">
            {[
              ["24", "CAMERAS"],
              ["2", "NVRs"],
              ["3", "SWITCHES"],
            ].map(([n, l]) => (
              <div key={l} className="public-metric-cell">
                <dd className="public-mono text-3xl font-semibold tracking-[-0.04em] text-fg">{n}</dd>
                <dt className="public-mono mt-1 text-[10px] tracking-[0.14em] text-fg-muted">{l}</dt>
              </div>
            ))}
          </dl>
        </div>

        {/* Segmented preview chrome — Kai selected-state language, presentation-only */}
        <div
          className="public-segment"
          role="tablist"
          aria-label="Site File preview layers"
        >
          <span
            className="public-segment-pill"
            style={{
              width: `calc((100% - 0.4rem) / ${pub.siteFileTabs.length})`,
              transform: `translateX(${tabIndex * 100}%)`,
            }}
            aria-hidden
          />
          {pub.siteFileTabs.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={tab === item}
              className={cn("public-segment-item", tab === item && "is-active")}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="px-5 py-5 sm:px-7 sm:py-6">
          {tab === "Overview" || tab === "Devices" ? (
            <div className="grid gap-6 sm:grid-cols-2 sm:gap-0 sm:divide-x sm:divide-border">
              {floors.map((floor, idx) => (
                <div key={floor.n} className={cn(idx === 0 ? "sm:pe-7" : "sm:ps-7")}>
                  <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">FLOOR {floor.n}</p>
                  <ul className="public-row-list mt-2 border-y border-border">
                    {floor.cams.map((cam) => (
                      <li key={cam} className="public-row is-device">
                        <span className="size-1.5 rounded-full bg-success" aria-hidden />
                        <span className="public-mono text-sm text-fg">{cam}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-border px-4 py-6">
              <p className="public-mono text-sm tracking-[0.1em] text-fg-muted">{tab.toUpperCase()}</p>
              <p className="ltr-meta mt-2 max-w-md text-sm leading-6 text-fg-muted">
                Illustrative product chrome for the {tab.toLowerCase()} layer of a Site File — not live customer data.
              </p>
            </div>
          )}

          <ul className="public-row-list mt-6 border-t border-border">
            {siteMeta.map(([k, v]) => (
              <li key={k} className="public-row is-meta">
                <span className="public-mono text-[11px] tracking-[0.12em] text-fg-muted">{k}</span>
                <span className="public-mono text-[11px] text-fg">{v}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-fg-muted" dir="rtl" lang="he">
            {pub.siteFileIntent}
          </p>
        </div>
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
  const selectedIndex = twinRecords.findIndex((node) => node.id === id);

  return (
    <div className="public-twin-stage" dir="ltr">
      <div className="public-twin-depth" aria-hidden>
        <span className="public-twin-plate is-a" />
        <span className="public-twin-plate is-b" />
      </div>

      <div className="relative z-[1] grid gap-8 lg:grid-cols-[11.5rem_minmax(0,1fr)] lg:gap-10">
        <ol className="public-twin-rail relative flex flex-row flex-wrap items-center gap-x-1.5 gap-y-2 lg:flex-col lg:items-stretch lg:gap-0">
          {twinRecords.map((node, i) => {
            const active = id === node.id;
            const above = i < selectedIndex;
            return (
              <li key={node.id} className="relative flex flex-row items-center gap-1.5 lg:flex-col lg:items-stretch">
                <button
                  type="button"
                  className={cn(
                    "public-twin-node public-mono w-full py-1.5 text-start text-sm tracking-[0.14em] transition-colors duration-200",
                    active && "is-active text-fg",
                    !active && above && "text-fg-muted/80",
                    !active && !above && "text-fg-muted hover:text-fg",
                  )}
                  aria-pressed={active}
                  onClick={() => setId(node.id)}
                  onMouseEnter={() => setId(node.id)}
                >
                  <span className="lg:flex lg:items-center lg:gap-3">
                    <span
                      className={cn(
                        "hidden size-1.5 shrink-0 rounded-full lg:inline-block",
                        active ? "bg-action" : above ? "bg-action/40" : "bg-border",
                      )}
                      aria-hidden
                    />
                    {node.label}
                  </span>
                </button>
                {i < twinRecords.length - 1 ? (
                  <span className="text-fg-muted lg:ms-[2px] lg:h-3.5 lg:w-px lg:bg-border lg:ps-0 lg:text-[0px]" aria-hidden>
                    ↓
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>

        <div className="public-twin-leaf public-dominant-surface">
          <p className="public-mono text-[10px] tracking-[0.16em] text-action">{selected.label}</p>
          <p className="ltr-meta mt-2 text-2xl font-semibold tracking-[-0.03em] text-fg sm:text-[1.85rem]">{selected.title}</p>
          <ul className="public-row-list mt-6 border-y border-border">
            {selected.rows.map(([k, v]) => (
              <li key={k} className="public-row is-meta">
                <span className="public-mono text-[10px] tracking-[0.14em] text-fg-muted">{k}</span>
                <span className="public-mono text-sm text-fg">{v}</span>
              </li>
            ))}
          </ul>
        </div>
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
    <div dir="ltr" className="public-ops-stage">
      <ol className="public-ops-rail flex gap-0 overflow-x-auto">
        {pub.opsSteps.map((step, i) => {
          const done = i < tick;
          const active = i === tick;
          const pending = i > tick;
          return (
            <li
              key={step}
              className={cn(
                "public-ops-node relative min-w-[7.25rem] flex-1 px-3.5 py-4 last:border-e-0 sm:min-w-[8rem] sm:px-4 sm:py-5",
                done && "is-done",
                active && "is-active",
                pending && "is-pending",
              )}
            >
              <span className={cn("public-mono text-[10px] tracking-[0.16em]", active ? "text-action" : "text-fg-muted")}>
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
    </div>
  );
}

export function FieldPhone() {
  return (
    <div className="public-field-wrap mx-auto w-full max-w-[19.5rem]">
      <div className="public-device-frame border border-border bg-public-elevated p-1.5">
        <div className="public-device-screen overflow-hidden bg-public-surface">
          <div className="flex justify-center border-b border-border py-2" aria-hidden>
            <span className="h-1 w-12 rounded-full bg-border" />
          </div>

          <div className="public-device-header px-4 pt-3.5" dir="ltr">
            <div className="flex items-center justify-between gap-2">
              <p className="public-mono text-[10px] tracking-[0.18em] text-fg-muted">{pub.brand}</p>
              <p className="public-mono text-[10px] tracking-[0.16em] text-action">{pub.fieldToday}</p>
            </div>
            <p className="public-mono mt-4 text-[2.35rem] font-semibold tracking-[-0.05em] text-fg leading-none">
              {pub.fieldTime}
            </p>
            <p className="public-mono mt-4 text-[11px] tracking-[0.16em] text-action">{pub.fieldJob}</p>
            <p className="mt-1 text-base font-medium text-fg" dir="rtl" lang="he">
              {pub.fieldJobHe}
            </p>
            <p className="ltr-meta mt-1.5 text-sm text-fg-muted">
              {pub.fieldAddr} · {pub.fieldCity}
            </p>
          </div>

          <div className="mt-5 px-4" dir="ltr">
            <p className="public-mono text-[10px] tracking-[0.18em] text-fg-muted">{pub.fieldEquip}</p>
            <ul className="public-row-list mt-1.5 border-y border-border">
              {pub.fieldItems.map((item) => (
                <li key={item} className="public-row is-dense">
                  <span className="public-row-dot" aria-hidden />
                  <span className="public-mono text-sm text-fg">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 px-4" dir="ltr">
            <div>
              <p className="public-mono text-[10px] tracking-[0.18em] text-fg-muted">{pub.fieldTech}</p>
              <p className="ltr-meta mt-0.5 text-sm text-fg">{pub.fieldTechName}</p>
            </div>
          </div>

          <div className="px-4 pt-5 pb-4">
            <PreviewAction label={pub.fieldStart} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function IntelligencePanel() {
  return (
    <div className="public-intel public-dominant-surface overflow-hidden" dir="ltr">
      <div className="public-app-bar">
        <p className="public-mono text-[11px] tracking-[0.14em] text-fg-muted">{pub.intelChrome}</p>
        <p className="public-mono text-[10px] tracking-[0.16em] text-action">{pub.previewBadge}</p>
      </div>
      <div className="px-5 py-5 sm:px-6 sm:py-6">
        <p className="ltr-meta text-base font-medium text-fg sm:text-lg">{pub.intelSummary}</p>
        <ul className="public-row-list mt-4 border-y border-border">
          {pub.intelItems.map((item) => (
            <li key={item.code} className="public-row is-attention">
              <span className="public-mono shrink-0 text-[10px] tracking-[0.12em] text-warning">ATTN</span>
              <div className="min-w-0 flex-1">
                <p className="public-mono text-sm tracking-[0.06em] text-fg">{item.code}</p>
                <p className="ltr-meta mt-0.5 text-sm text-fg-muted">{item.detail}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <PreviewAction label={pub.intelAction} />
        </div>
        <p className="mt-3 text-xs leading-5 text-fg-muted">{pub.intelIntent}</p>
      </div>
    </div>
  );
}

export function SecurityArch() {
  return (
    <div dir="ltr" className="public-security-grid">
      <ul className="public-security-list">
        {pub.securityPillars.map((pillar) => (
          <li key={pillar.title} className="public-security-row">
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
