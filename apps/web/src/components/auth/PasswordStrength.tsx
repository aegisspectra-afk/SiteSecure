import { cn } from "@site-secure/ui";
import { he } from "../../i18n/he";

function Rule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={cn("auth-password-rule", ok && "is-met")}>
      <span className="auth-password-rule-mark" aria-hidden>
        {ok ? "✓" : "○"}
      </span>
      <span>{label}</span>
    </li>
  );
}

export function PasswordStrength({ password }: { password: string }) {
  const lengthOk = password.length >= 8;
  const upperOk = /[A-Z]/.test(password);
  const numberOk = /\d/.test(password);
  const specialOk = /[^A-Za-z0-9]/.test(password);
  const active = password.length > 0;
  const metCount = [lengthOk, upperOk, numberOk, specialOk].filter(Boolean).length;

  return (
    <div className={cn("auth-password-strength", active && "is-active")} aria-live="polite">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium text-fg-muted">{he.passwordStrength}</p>
        {active ? (
          <p className="text-[10px] tabular-nums text-fg-muted">
            {metCount}/4
          </p>
        ) : null}
      </div>
      <div className="auth-password-meter" aria-hidden>
        {[1, 2, 3, 4].map((slot) => (
          <span
            key={slot}
            className={cn("auth-password-meter-segment", active && slot <= metCount && "is-filled")}
          />
        ))}
      </div>
      <ul className="auth-password-rules">
        <Rule ok={lengthOk} label={he.passwordRuleLength} />
        {active ? (
          <>
            <Rule ok={upperOk} label={he.passwordRuleUpper} />
            <Rule ok={numberOk} label={he.passwordRuleNumber} />
            <Rule ok={specialOk} label={he.passwordRuleSpecial} />
          </>
        ) : null}
      </ul>
    </div>
  );
}
