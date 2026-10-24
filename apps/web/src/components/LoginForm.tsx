import { Button, Checkbox } from "@site-secure/ui";
import { Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { he } from "../i18n/he";
import { getRememberDevice, setRememberDevice } from "../lib/remember-device";
import { AuthAlert, AuthField, AuthForm, PasswordField, useAuthExperience } from "./auth";

const schema = z.object({
  email: z.string().email(he.invalidEmail),
  password: z.string().min(1, he.required),
});

export function LoginForm({
  onSubmit,
  onSubmitUnit,
  error,
  loading,
}: {
  onSubmit: (email: string, password: string) => Promise<void>;
  onSubmitUnit?: (code: string) => Promise<void>;
  error?: string | null;
  loading?: boolean;
}) {
  const { setPasswordScan } = useAuthExperience();
  const [mode, setMode] = useState<"password" | "unit">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [unitCode, setUnitCode] = useState("");
  const [remember, setRemember] = useState(() => getRememberDevice());
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; code?: string }>({});
  const busy = Boolean(loading);

  useEffect(() => {
    setPasswordScan(password.length);
    return () => setPasswordScan(0);
  }, [password, setPasswordScan]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (mode === "unit") {
      const code = unitCode.replace(/[\s_-]/g, "").trim();
      if (code.length < 8) {
        setFieldErrors({ code: he.required });
        return;
      }
      setFieldErrors({});
      await onSubmitUnit?.(code);
      return;
    }
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      const next: { email?: string; password?: string } = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "email" || key === "password") next[key] = issue.message;
      }
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});
    setRememberDevice(remember);
    await onSubmit(parsed.data.email, parsed.data.password);
  }

  return (
    <AuthForm
      onSubmit={handleSubmit}
      aria-busy={busy || undefined}
      className={
        error || fieldErrors.email || fieldErrors.password || fieldErrors.code
          ? "auth-login-form ss-auth-shake gap-5"
          : "auth-login-form gap-5"
      }
    >
      <div className="flex flex-col gap-4">
        {onSubmitUnit ? (
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "password" ? "pill" : "secondary"}
              disabled={busy}
              onClick={() => setMode("password")}
            >
              {he.loginPrimary}
            </Button>
            <Button
              type="button"
              variant={mode === "unit" ? "pill" : "secondary"}
              disabled={busy}
              onClick={() => setMode("unit")}
            >
              {he.sspUnitLoginToggle}
            </Button>
          </div>
        ) : null}
        {mode === "unit" && onSubmitUnit ? (
          <AuthField
            id="unit-code"
            name="unit-code"
            label={he.sspUnitCodeLabel}
            autoComplete="one-time-code"
            appearance="comfortable"
            ltr
            value={unitCode}
            onChange={(ev) => setUnitCode(ev.target.value)}
            error={fieldErrors.code}
            disabled={busy}
            hint={he.sspUnitLoginHint}
          />
        ) : (
          <>
        <AuthField
          id="email"
          name="email"
          label={he.email}
          type="email"
          autoComplete="email"
          appearance="comfortable"
          ltr
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          error={fieldErrors.email}
          disabled={busy}
        />
        <PasswordField
          id="password"
          name="password"
          label={he.password}
          autoComplete="current-password"
          appearance="comfortable"
          value={password}
          onChange={(ev) => setPassword(ev.target.value)}
          error={fieldErrors.password}
          disabled={busy}
        />
        <Link
          to="/forgot-password"
          className="auth-forgot-link self-start text-sm text-fg-muted transition-colors duration-150 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {he.loginSecondaryForgot}
        </Link>
        <Checkbox
          id="remember"
          name="remember"
          label={he.rememberMe}
          checked={remember}
          onChange={(ev) => setRemember(ev.target.checked)}
          disabled={busy}
          className="accent-action"
        />
          </>
        )}
      </div>

      {error ? <AuthAlert>{error}</AuthAlert> : null}

      <Button
        type="submit"
        variant="pill"
        loading={busy}
        loadingLabel={he.authenticating}
        disabled={busy}
        className="auth-cta w-full"
      >
        {mode === "unit" ? he.sspUnitLoginSubmit : he.loginPrimary}
      </Button>
    </AuthForm>
  );
}
