import { useId, type ReactNode } from "react";

/**
 * Explains why the wrapped control is disabled.
 * A disabled <button> fires no pointer events, so its own `title` never shows; the tooltip
 * sits on this wrapper instead, and screen readers get the same text.
 */
export function DisabledReason({ reason, children }: { reason?: string; children: ReactNode }) {
  const id = useId();
  if (!reason) return <>{children}</>;
  return (
    <span className="inline-flex" title={reason} data-disabled-reason={reason} aria-describedby={id}>
      {children}
      <span id={id} className="sr-only">
        {reason}
      </span>
    </span>
  );
}
