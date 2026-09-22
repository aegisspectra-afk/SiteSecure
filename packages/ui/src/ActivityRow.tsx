import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export function ActivityRow({
  leading,
  title,
  subtitle,
  meta,
  trailing,
  className,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className={cn("ss-activity-row", className)} {...props}>
      {leading ? <div className="ss-activity-row-leading">{leading}</div> : null}
      <div className="ss-activity-row-body min-w-0">
        <p className="ss-activity-row-title">{title}</p>
        {subtitle ? <p className="ss-activity-row-subtitle">{subtitle}</p> : null}
        {meta ? <div className="ss-activity-row-meta">{meta}</div> : null}
      </div>
      {trailing ? <div className="ss-activity-row-trailing">{trailing}</div> : null}
    </div>
  );
}
