import type { ReactNode, TableHTMLAttributes } from "react";
import { cn } from "./cn";

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-border">
      <table className={cn("w-full border-collapse text-[13px] leading-[1.4]", className)} {...props} />
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-bg-subtle text-start text-fg-muted">{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="bg-bg">{children}</tbody>;
}

export function TR({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <tr className={cn("h-10 border-t border-border", className)}>{children}</tr>
  );
}

export function TH({ children, className }: { children: ReactNode; className?: string }) {
  return <th className={cn("px-3 py-2 font-medium", className)}>{children}</th>;
}

export function TD({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2 text-fg", className)}>{children}</td>;
}
