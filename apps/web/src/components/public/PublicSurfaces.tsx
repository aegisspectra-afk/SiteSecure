import { cn } from "@site-secure/ui";
import { useEffect, useState } from "react";
import { pub } from "../../i18n/public-he";
import { useReducedMotion } from "./useReducedMotion";

export function HeroConsole() {
  return (
    <aside aria-label={pub.previewAria} className="public-app px-6 py-6 lg:min-h-[28rem] lg:px-8 lg:py-8" dir="ltr">
      <div className="flex items-center justify-between gap-3">
        <p className="public-mono text-[11px] tracking-[0.14em] text-fg-muted">{pub.previewChrome}</p>
        <p className="public-mono text-[10px] tracking-[0.16em] text-action">{pub.previewBadge}</p>
      </div>
      <p className="public-mono mt-10 text-[11px] tracking-[0.18em] text-fg-muted">{pub.previewProduct}</p>
      <p className="ltr-meta mt-3 text-xl font-semibold tracking-[-0.03em] text-fg">{pub.siteNameEn}</p>
      <p className="public-mono mt-1 text-xs text-fg-muted">{pub.previewRef}</p>
      <dl className="mt-10 grid grid-cols-3 gap-6">
        {[
          ["24", "CAMERAS"],
          ["2", "NVR"],
          ["3", "JOBS"],
        ].map(([n, l]) => (
          <div key={l}>
            <dd className="public-mono text-2xl font-semibold text-fg">{n}</dd>
            <dt className="public-mono mt-1 text-[10px] tracking-[0.14em] text-fg-muted">{l}</dt>
          </div>
        ))}
      </dl>
      <p className="public-mono mt-10 flex items-center gap-2 text-xs text-fg">
        <span className="auth-status-pulse size-1.5 rounded-full bg-success" aria-hidden />
        {pub.previewStatus}
      </p>
    </aside>
  );
}

export function ChaosChain() {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(pub.chain.length - 1);

  useEffect(() => {
    if (reduced) return;
    setActive(0);
    const id = window.setInterval(() => {
      setActive((n) => (n + 1) % pub.chain.length);
    }, 900);
    return () => window.clearInterval(id);
  }, [reduced]);

  return (
    <ol className="mx-auto flex w-max flex-col items-center" dir="ltr">
      {pub.chain.map((step, i) => (
        <li key={step} className="flex flex-col items-center">
          <span
            className={cn(
              "public-mono text-lg tracking-[0.12em] sm:text-xl",
              i === active || i === pub.chain.length - 1 ? "public-node-glow text-fg" : "text-fg-muted",
              i === pub.chain.length - 1 && "font-semibold",
            )}
          >
            {step}
          </span>
          {i < pub.chain.length - 1 ? (
            <span className="py-2 text-fg-muted" aria-hidden>
              ↓
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

const floors = [
  { n: "01", cams: ["CAM-001", "CAM-002", "CAM-003"] },
  { n: "02", cams: ["CAM-018", "CAM-019", "CAM-020"] },
] as const;

export function SiteFileStage() {
  return (
    <div className="public-app px-6 py-8 lg:px-12 lg:py-12" dir="ltr">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">{pub.previewProduct}</p>
          <p className="public-mono mt-3 text-xs text-fg-muted">{pub.previewRef}</p>
          <p className="ltr-meta mt-2 text-2xl font-semibold tracking-[-0.03em] text-fg">{pub.siteNameEn}</p>
          <p dir="rtl" className="mt-1 text-sm text-fg-muted">
            {pub.siteName}
          </p>
        </div>
        <p className="public-mono text-[10px] tracking-[0.16em] text-action">{pub.previewBadge}</p>
      </div>
      <dl className="mt-10 flex flex-wrap gap-10">
        {[
          ["24", "CAMERAS"],
          ["2", "NVR"],
          ["3", "SWITCHES"],
        ].map(([n, l]) => (
          <div key={l}>
            <dd className="public-mono text-3xl font-semibold text-fg">{n}</dd>
            <dt className="public-mono mt-1 text-[10px] tracking-[0.14em] text-fg-muted">{l}</dt>
          </div>
        ))}
      </dl>
      <div className="mt-12 grid gap-10 sm:grid-cols-2">
        {floors.map((floor) => (
          <div key={floor.n}>
            <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">FLOOR {floor.n}</p>
            <ul className="mt-4 flex flex-col gap-3">
              {floor.cams.map((cam) => (
                <li key={cam} className="public-mono flex items-center gap-3 text-sm text-fg">
                  <span className="text-action" aria-hidden>
                    ●
                  </span>
                  {cam}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <dl className="mt-12 grid max-w-md grid-cols-2 gap-y-3 border-t border-border pt-6">
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
    <div className="grid gap-10 lg:grid-cols-[10rem_minmax(0,1fr)]" dir="ltr">
      <ol className="flex flex-col items-start">
        {twinRecords.map((node, i) => (
          <li key={node.id} className="flex flex-col items-start">
            <button
              type="button"
              className={cn(
                "public-mono py-1 text-sm tracking-[0.14em]",
                id === node.id ? "text-fg" : "text-fg-muted hover:text-fg",
              )}
              aria-pressed={id === node.id}
              onClick={() => setId(node.id)}
              onMouseEnter={() => setId(node.id)}
            >
              {node.label}
            </button>
            {i < twinRecords.length - 1 ? (
              <span className="py-1 text-fg-muted" aria-hidden>
                ↓
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      <div className="public-app px-6 py-8">
        <p className="public-mono text-[10px] tracking-[0.16em] text-action">{selected.label}</p>
        <p className="ltr-meta mt-3 text-2xl font-semibold tracking-[-0.03em] text-fg">{selected.title}</p>
        <dl className="mt-8 flex max-w-md flex-col gap-4">
          {selected.rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-6 border-b border-border pb-3">
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
    }, 1200);
    return () => window.clearInterval(id);
  }, [reduced]);

  return (
    <ol className="flex flex-wrap items-end gap-x-3 gap-y-6" dir="ltr">
      {pub.opsSteps.map((step, i) => {
        const mark = i < locked ? "✓" : i === tick ? "●" : "○";
        return (
          <li key={step} className="flex items-end gap-3">
            <span className="flex flex-col gap-2">
              <span className={cn("public-mono text-sm tracking-[0.14em]", mark === "○" ? "text-fg-muted" : "text-fg")}>
                {step}
              </span>
              <span className="public-mono text-fg-muted" aria-hidden>
                {mark}
              </span>
            </span>
            {i < pub.opsSteps.length - 1 ? (
              <span className="public-mono pb-1 text-fg-muted" aria-hidden>
                ──
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function FieldPhone() {
  return (
    <div className="mx-auto w-full max-w-[320px] rounded-[2.1rem] border border-border bg-public-elevated p-2.5">
      <div className="min-h-[34rem] overflow-hidden rounded-[1.6rem] bg-public-surface">
        <div className="flex justify-center py-3" aria-hidden>
          <span className="h-1.5 w-20 rounded-full bg-border" />
        </div>
        <div className="px-5" dir="ltr">
          <p className="public-mono text-[11px] tracking-[0.18em] text-fg">{pub.brand}</p>
          <p className="public-mono mt-8 text-[10px] tracking-[0.2em] text-fg-muted">{pub.fieldToday}</p>
          <p className="public-mono mt-2 text-4xl font-semibold tracking-[-0.04em] text-fg">{pub.fieldTime}</p>
        </div>
        <div className="mt-8 px-5" dir="rtl">
          <p className="text-lg font-semibold text-fg">{pub.fieldJob}</p>
          <p className="mt-2 text-sm text-fg-muted">{pub.fieldAddr}</p>
          <p className="text-sm text-fg-muted">{pub.fieldCity}</p>
        </div>
        <div className="mt-8 px-5" dir="ltr">
          <p className="public-mono text-[10px] tracking-[0.18em] text-fg-muted">{pub.fieldEquip}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {pub.fieldItems.map((item) => (
              <li key={item} className="public-mono text-sm text-fg">
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="px-5 pt-10 pb-6">
          <p
            className="inline-flex min-h-12 w-full items-center justify-center rounded-[var(--radius-control)] bg-action text-sm font-medium text-action-fg"
            aria-hidden
          >
            {pub.fieldStart}
          </p>
        </div>
      </div>
    </div>
  );
}

export function SecurityArch() {
  return (
    <ol className="flex flex-col items-start" dir="ltr">
      {pub.arch.map((step, i) => (
        <li key={step} className="flex flex-col items-start">
          <span className="public-mono text-xl tracking-[0.16em] text-fg sm:text-2xl">{step}</span>
          {i < pub.arch.length - 1 ? (
            <span className="py-2 text-fg-muted" aria-hidden>
              ↓
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
