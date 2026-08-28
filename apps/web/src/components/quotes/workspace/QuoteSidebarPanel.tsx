import type { ReactNode } from "react";

/** Shared sidebar stack: summary, readiness, submit (desktop aside + mobile sheet). */
export function QuoteSidebarPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`cpq-sidebar-panel flex flex-col gap-3 ${className ?? ""}`}>{children}</div>;
}
