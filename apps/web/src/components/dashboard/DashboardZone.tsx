import type { ReactNode } from "react";

/** Named operational band — presentation only; children keep their own headings. */
export function DashboardZone({
  id,
  label,
  children,
  className = "",
}: {
  id: string;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`ops-zone${className ? ` ${className}` : ""}`}
      data-zone={id}
      aria-label={label}
    >
      <p className="ops-zone-label">{label}</p>
      <div className="ops-zone-body">{children}</div>
    </section>
  );
}
