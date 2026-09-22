import type { ReactNode } from "react";
import type { QuoteWorkspaceStep } from "./types";

/** Keeps children mounted (display:none when inactive) so local dirty state survives stage switches. */
export function QuoteStagePanel({
  step,
  activeStep,
  children,
  className,
}: {
  step: QuoteWorkspaceStep | QuoteWorkspaceStep[];
  activeStep: QuoteWorkspaceStep;
  children: ReactNode;
  className?: string;
}) {
  const steps = Array.isArray(step) ? step : [step];
  const active = steps.includes(activeStep);
  return (
    <div
      className={`cpq-stage-panel${active ? " is-active" : " is-inactive"}${className ? ` ${className}` : ""}`}
      data-cpq-stage={steps.join(",")}
      data-active={active ? "true" : "false"}
      hidden={!active}
      aria-hidden={!active}
    >
      {children}
    </div>
  );
}
