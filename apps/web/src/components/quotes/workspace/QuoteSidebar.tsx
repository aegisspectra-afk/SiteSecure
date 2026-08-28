import type { ReactNode } from "react";

export function QuoteSidebar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <aside id="cpq-summary-anchor" className={`cpq-workspace-sidebar ${className ?? ""}`}>
      {children}
    </aside>
  );
}
