import { cn } from "./cn";

export type ProgressStep = {
  id: string;
  label: string;
  state: "done" | "current" | "upcoming";
};

export function ProgressList({ steps }: { steps: ProgressStep[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step) => (
        <li
          key={step.id}
          className="flex items-center gap-3 text-sm"
          aria-current={step.state === "current" ? "step" : undefined}
        >
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full border text-xs font-semibold",
              step.state === "done" && "border-success bg-success/10 text-success",
              step.state === "current" && "border-action bg-action font-bold text-action-fg",
              step.state === "upcoming" && "border-border bg-bg text-fg-muted",
            )}
            aria-hidden
          >
            {step.state === "done" ? "✓" : step.state === "current" ? "●" : "○"}
          </span>
          <span
            className={cn(
              step.state === "current" && "font-semibold text-fg",
              step.state === "done" && "text-fg",
              step.state === "upcoming" && "text-fg-muted",
            )}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
