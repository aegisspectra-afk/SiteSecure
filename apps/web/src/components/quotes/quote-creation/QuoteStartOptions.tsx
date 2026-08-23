import { Building2, ChevronLeft, FileText, UserPlus, type LucideIcon } from "lucide-react";
import { he } from "../../../i18n/he";

export function QuoteStartOptions({
  onExisting,
  onCreate,
  onSkip,
}: {
  onExisting: () => void;
  onCreate: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="flex flex-col gap-2.5" role="list">
      <ActionCard
        icon={Building2}
        title={he.workflowExistingCustomer}
        description={he.workflowExistingCustomerHint}
        onClick={onExisting}
      />
      <ActionCard
        icon={UserPlus}
        title={he.workflowNewCustomer}
        description={he.workflowNewCustomerHint}
        onClick={onCreate}
        recommended
      />
      <ActionCard
        icon={FileText}
        title={he.workflowNoCustomer}
        description={he.workflowNoCustomerHint}
        onClick={onSkip}
        tone="muted"
      />
    </div>
  );
}

export function ActionCard({
  icon: Icon,
  title,
  description,
  onClick,
  tone = "default",
  busy,
  recommended,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
  tone?: "default" | "muted";
  busy?: boolean;
  recommended?: boolean;
}) {
  return (
    <button
      type="button"
      role="listitem"
      disabled={busy}
      onClick={onClick}
      className={`quote-flow-action${tone === "muted" ? " is-muted" : ""}${recommended ? " is-recommended" : ""}${busy ? " is-busy" : ""}`}
    >
      <span className={`quote-flow-action-icon${tone === "muted" ? " is-muted" : ""}`} aria-hidden>
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1 text-start">
        <span className="flex items-center gap-2">
          <span className="block text-sm font-semibold text-fg">{title}</span>
          {recommended ? (
            <span className="rounded-[var(--radius-control)] bg-action/10 px-1.5 py-0.5 text-[10px] font-medium text-action">
              {he.workflowRecommended}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-fg-muted">{description}</span>
      </span>
      <ChevronLeft className="quote-flow-action-chevron size-4 shrink-0" aria-hidden />
    </button>
  );
}
