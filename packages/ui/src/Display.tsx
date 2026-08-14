import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-panel)] border border-border bg-bg-1 p-6 shadow-card",
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
  info: "bg-action",
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
