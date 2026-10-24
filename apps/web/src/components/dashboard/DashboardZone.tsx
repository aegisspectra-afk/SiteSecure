import type { ReactNode } from "react";

/** Named operational band — presentation only; children keep their own headings. */
export function DashboardZone({
  id,
  label,
  children,
  className = "",
  action,
}: {
  id: string;
  label: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className={`ops-zone${className ? ` ${className}` : ""}`}
      data-zone={id}
      aria-label={label}
    >
      <div className={`ops-zone-head${action ? " has-action" : ""}`}>
        <p className="ops-zone-label">{label}</p>
        {action}
      </div>
      <div className="ops-zone-body">{children}</div>
    </section>
  );
}
