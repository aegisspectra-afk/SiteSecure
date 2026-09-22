import type { ReactNode } from "react";
import { cn } from "./cn";

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-border [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => {
        const selected = tab.id === value;
        const showCount = typeof tab.count === "number" && tab.count > 0;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cn(
              "min-h-11 shrink-0 px-3 text-sm transition-colors duration-150",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
              selected
                ? "border-b-2 border-action font-semibold text-fg"
                : "border-b-2 border-transparent text-fg-muted hover:text-fg",
            )}
            onClick={() => onChange(tab.id)}
          >
            <span className="inline-flex items-center gap-1.5">
              {tab.label}
              {showCount ? (
                <span className={cn("tabular-nums text-xs", selected ? "text-fg-muted" : "text-fg-subtle")}>
                  {tab.count}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
  eyebrow,
  appearance = "default",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  eyebrow?: string;
  appearance?: "default" | "display";
}) {
  return (
    <div className="ss-page-header mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow ? (
          <p className="text-sm font-medium tracking-[0.01em] text-fg-muted">{eyebrow}</p>
        ) : null}
        <h1
          className={cn(
            "font-semibold leading-tight tracking-[-0.03em] text-fg",
            appearance === "display" ? "text-[1.75rem] sm:text-2xl" : "text-2xl",
          )}
        >
          {title}
        </h1>
        {description ? <p className="text-sm leading-6 text-fg-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
