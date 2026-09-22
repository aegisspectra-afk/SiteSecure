import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type CardAppearance = "default" | "premium";

export function Card({
  className,
  appearance = "default",
  ...props
}: HTMLAttributes<HTMLDivElement> & { appearance?: CardAppearance }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-panel)] border border-border bg-bg-1 p-6 shadow-card",
        appearance === "premium" &&
          "ss-premium-card rounded-[var(--radius-premium)] border-[color:var(--color-premium-hairline,var(--color-border))] bg-[var(--color-premium-surface,var(--color-bg-1))] p-5 shadow-[var(--shadow-premium)]",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-control)] border border-border bg-bg-subtle px-2 py-0.5 text-xs font-medium text-fg-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

const toneDot: Record<StatusTone, string> = {
  neutral: "bg-fg-muted",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export function Status({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: StatusTone;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] font-medium text-fg">
      <span className={cn("size-2 rounded-full", toneDot[tone])} aria-hidden />
      {label}
    </span>
  );
}
