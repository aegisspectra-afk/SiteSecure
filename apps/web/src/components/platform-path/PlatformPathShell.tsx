import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { he } from "../../i18n/he";
import { cn } from "@site-secure/ui";

export type PlatformPathStep = "products" | "plans" | "review" | "done";

const STEPS: { id: PlatformPathStep; label: string; to: string }[] = [
  { id: "products", label: he.platformPathStepProducts, to: "/app/platform-path/products" },
  { id: "plans", label: he.platformPathStepPlans, to: "/app/platform-path/plans" },
  { id: "review", label: he.platformPathStepReview, to: "/app/platform-path/review" },
  { id: "done", label: he.platformPathStepDone, to: "/app/platform-path/done" },
];

export function PlatformPathShell({
  step,
  children,
}: {
  step: PlatformPathStep;
  children: ReactNode;
}) {
  const idx = STEPS.findIndex((s) => s.id === step);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6" dir="rtl">
      <div className="rounded-[var(--radius-control)] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-fg">
        <p className="font-semibold">{he.platformPathDemoBadge}</p>
        <p className="mt-1 text-fg-muted">{he.platformPathDemoLead}</p>
      </div>
      <header className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">{he.platformPathKicker}</p>
        <h1 className="text-xl font-semibold text-fg">{he.platformPathTitle}</h1>
        <p className="text-sm text-fg-muted">{he.platformPathLead}</p>
      </header>
      <nav aria-label={he.platformPathStepsAria} className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => {
          const active = s.id === step;
          const done = i < idx;
          return (
            <Link
              key={s.id}
              to={s.to}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active && "border-fg bg-fg text-bg",
                done && !active && "border-border bg-bg-subtle text-fg",
                !active && !done && "border-border text-fg-muted",
              )}
            >
              {i + 1}. {s.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}

export const DEMO_PLAN_STORAGE_KEY = "aegis-platform-path-preferred-plan";

export function readDemoPlanKey(fallback: string): string {
  try {
    const v = sessionStorage.getItem(DEMO_PLAN_STORAGE_KEY);
    if (v === "solo" || v === "business" || v === "enterprise") return v;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function writeDemoPlanKey(planKey: string): void {
  try {
    sessionStorage.setItem(DEMO_PLAN_STORAGE_KEY, planKey);
  } catch {
    /* ignore */
  }
}
