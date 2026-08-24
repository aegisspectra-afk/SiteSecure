import { Check } from "lucide-react";
import { cn } from "@site-secure/ui";
import { he } from "../../i18n/he";

export type AuthLaunchPhase = "session" | "workspace" | "ready";

function stepState(index: number, current: number, ready: boolean): "done" | "current" | "upcoming" {
  if (ready || index < current) return "done";
  if (index === current) return "current";
  return "upcoming";
}

export function AuthLaunchScreen({
  phase = "session",
  workspaceName,
  ready = false,
  className,
}: {
  phase?: AuthLaunchPhase;
  workspaceName?: string | null;
  ready?: boolean;
  className?: string;
}) {
  const showReady = ready || phase === "ready";
  const current = showReady ? 3 : phase === "workspace" ? 1 : 0;
  const name = workspaceName?.trim() || he.authLaunchWorkspaceFallback;
  const steps = [
    { id: "session", label: he.authLaunchVerifying },
    { id: "workspace", label: name },
    { id: "prepare", label: he.authLaunchPreparingWorkspace },
  ];

  return (
    <div
      className={cn("auth-root auth-shell auth-launch", className)}
      role="status"
      aria-live="polite"
      dir="ltr"
    >
      <div className="auth-launch-inner">
        <div className={cn("auth-launch-mark", showReady && "is-ready")} aria-hidden>
          {showReady ? (
            <span className="auth-launch-success">
              <Check className="size-4" strokeWidth={2.5} />
            </span>
          ) : (
            <span className="auth-launch-diamond" />
          )}
        </div>

        <div className="auth-launch-copy is-visible" dir="rtl">
          {showReady ? (
            <>
              <p className="text-base font-semibold text-fg">{he.authLaunchReady}</p>
              {workspaceName ? <p className="mt-1 text-sm text-fg-muted">{workspaceName}</p> : null}
            </>
          ) : (
            <>
              <p className="ltr-meta text-sm font-semibold tracking-[0.22em] text-fg">{he.brand}</p>
              <p className="public-mono mt-2 text-[11px] tracking-[0.16em] text-fg-muted">{he.authPlatformLabel}</p>
            </>
          )}
        </div>

        <ol className="auth-launch-steps" dir="rtl">
          {steps.map((step, index) => {
            const state = stepState(index, current, showReady);
            return (
              <li
                key={step.id}
                className={`auth-launch-step is-${state}`}
                aria-current={state === "current" ? "step" : undefined}
              >
                <span className="auth-launch-step-mark" aria-hidden>
                  {state === "done" ? "✓" : state === "current" ? <span className="auth-launch-step-spin" /> : "○"}
                </span>
                <span className="auth-launch-step-label">{step.label}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
