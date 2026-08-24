import { he } from "../../i18n/he";

export type AuthStepStatus = "done" | "current" | "upcoming";

export function AuthStepRail({
  steps,
}: {
  steps: readonly { n: string; label: string; status: AuthStepStatus }[];
}) {
  return (
    <ol className="auth-step-rail" aria-label={he.authStepsAria}>
      {steps.map((step, index) => (
        <li key={step.n} className="auth-step-rail-group">
          <div
            className={
              step.status === "current"
                ? "auth-step-rail-item is-current"
                : step.status === "done"
                  ? "auth-step-rail-item is-done"
                  : "auth-step-rail-item"
            }
            aria-current={step.status === "current" ? "step" : undefined}
          >
            <span className="auth-step-rail-n" aria-hidden>
              {step.status === "done" ? "✓" : step.n}
            </span>
            <span className="auth-step-rail-label">{step.label}</span>
          </div>
          {index < steps.length - 1 ? <span className="auth-step-rail-line" aria-hidden /> : null}
        </li>
      ))}
    </ol>
  );
}

export function registerSteps(current: 1 | 2 | 3 = 1) {
  return [
    { n: "01", label: he.stepAccount, status: (current === 1 ? "current" : "done") as AuthStepStatus },
    {
      n: "02",
      label: he.stepBusiness,
      status: (current === 2 ? "current" : current > 2 ? "done" : "upcoming") as AuthStepStatus,
    },
    { n: "03", label: he.stepReady, status: (current === 3 ? "current" : "upcoming") as AuthStepStatus },
  ] as const;
}

export function onboardingSteps(current: "profile" | "workspace" | "ready") {
  if (current === "profile") {
    return [
      { n: "01", label: he.stepAccount, status: "current" as const },
      { n: "02", label: he.stepBusiness, status: "upcoming" as const },
      { n: "03", label: he.stepReady, status: "upcoming" as const },
    ];
  }
  if (current === "workspace") {
    return [
      { n: "01", label: he.stepAccount, status: "done" as const },
      { n: "02", label: he.stepBusiness, status: "current" as const },
      { n: "03", label: he.stepReady, status: "upcoming" as const },
    ];
  }
  return [
    { n: "01", label: he.stepAccount, status: "done" as const },
    { n: "02", label: he.stepBusiness, status: "done" as const },
    { n: "03", label: he.stepReady, status: "current" as const },
  ];
}
