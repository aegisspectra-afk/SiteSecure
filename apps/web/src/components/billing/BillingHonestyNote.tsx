import { billingHonestyNote, subscriptionAccessLabel } from "../../lib/billing-honesty";

export function BillingHonestyNote({
  status,
  className = "text-xs text-amber-800 dark:text-amber-200",
}: {
  status?: string | null;
  className?: string;
}) {
  return (
    <p className={className} data-testid="billing-honesty-note">
      <span className="font-medium">{subscriptionAccessLabel(status)}</span>
      {" — "}
      {billingHonestyNote()}
    </p>
  );
}
