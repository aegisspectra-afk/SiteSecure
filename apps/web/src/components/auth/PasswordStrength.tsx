import { cn } from "@site-secure/ui";
import { he } from "../../i18n/he";
import { scorePassword, type PasswordScore } from "../../lib/password-strength";

const labels: Record<Exclude<PasswordScore, 0>, string> = {
  1: he.passwordStrengthWeak,
  2: he.passwordStrengthFair,
  3: he.passwordStrengthStrong,
  4: he.passwordStrengthExcellent,
};

const barTone: Record<PasswordScore, string> = {
  0: "bg-border",
  1: "bg-danger",
  2: "bg-warning",
  3: "bg-action",
  4: "bg-success",
};

export function PasswordStrength({ password }: { password: string }) {
  const score = scorePassword(password);
  const met = password.length >= 8;
  const label = score === 0 ? null : labels[score];
  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3">
        <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.passwordStrength}</p>
        {label ? (
          <p className="public-mono text-[10px] tracking-[0.12em] text-fg">{label}</p>
        ) : null}
      </div>
      <div className="flex gap-1" aria-hidden>
        {([1, 2, 3, 4] as const).map((n) => (
          <span
            key={n}
            className={cn("h-0.5 flex-1 rounded-full", n <= score ? barTone[score] : "bg-border")}
          />
        ))}
      </div>
      <p className={cn("text-xs", met ? "text-success" : "text-fg-muted")}>
        <span aria-hidden>{met ? "✓" : "○"} </span>
        {he.passwordRuleLength}
      </p>
    </div>
  );
}
