import { cn } from "@site-secure/ui";
import { he } from "../i18n/he";

export function BetaBadge({ className }: { className?: string }) {
  return (
    <span className={cn("beta-badge", className)} title={he.betaBadgeHint}>
      {he.betaBadge}
    </span>
  );
}
