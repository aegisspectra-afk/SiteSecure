import { ClipboardList, ListChecks, Package, Wallet } from "lucide-react";
import { he } from "../../../i18n/he";
import type { QuoteWorkspaceStep } from "./types";

const STEPS: Array<{
  id: QuoteWorkspaceStep;
  label: string;
  shortLabel: string;
  icon: typeof Package;
}> = [
  { id: "details", label: he.cpqWorkflowDetails, shortLabel: he.cpqStepDetailsShort, icon: ClipboardList },
  { id: "items", label: he.cpqWorkflowContent, shortLabel: he.cpqStepItemsShort, icon: Package },
  { id: "pricing", label: he.cpqWorkflowPricing, shortLabel: he.cpqStepPricingShort, icon: Wallet },
  { id: "review", label: he.cpqStepReview, shortLabel: he.cpqStepReviewShort, icon: ListChecks },
];

export function QuoteStepper({
  active,
  onSelect,
  variant = "default",
  className,
}: {
  active: QuoteWorkspaceStep;
  onSelect: (step: QuoteWorkspaceStep) => void;
  variant?: "default" | "icons";
  className?: string;
}) {
  return (
    <nav
      className={`cpq-stepper${variant === "icons" ? " cpq-stepper-icons" : ""}${className ? ` ${className}` : ""}`}
      aria-label={he.cpqStepperAria}
    >
      <ol className="cpq-stepper-list">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = active === step.id;
          return (
            <li key={step.id} className="cpq-stepper-item">
              {index > 0 && variant !== "icons" ? <span className="cpq-stepper-sep" aria-hidden /> : null}
              <button
                type="button"
                className={`cpq-stepper-btn${isActive ? " is-active" : ""}`}
                aria-current={isActive ? "step" : undefined}
                aria-label={step.label}
                title={step.label}
                onClick={() => onSelect(step.id)}
              >
                <Icon className="cpq-stepper-icon" aria-hidden />
                <span className="cpq-stepper-label">{step.label}</span>
                <span className="cpq-stepper-label-short">{step.shortLabel}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
