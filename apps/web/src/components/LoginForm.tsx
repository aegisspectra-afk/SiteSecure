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
  error,
  loading,
}: {
  onSubmit: (email: string, password: string) => Promise<void>;
  error?: string | null;
  loading?: boolean;
}) {
  const { setPasswordScan } = useAuthExperience();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(() => getRememberDevice());
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const busy = Boolean(loading);

  useEffect(() => {
    setPasswordScan(password.length);
    return () => setPasswordScan(0);
  }, [password, setPasswordScan]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
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
    <AuthForm onSubmit={handleSubmit} aria-busy={busy || undefined} className="auth-login-form gap-5">
      <div className="flex flex-col gap-4">
        <AuthField
          id="email"
          name="email"
          label={he.email}
          type="email"
          autoComplete="email"
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
      </div>

      {error ? <AuthAlert>{error}</AuthAlert> : null}

      <Button
        type="submit"
        variant="primary"
        loading={busy}
        loadingLabel={he.authenticating}
        disabled={busy}
        className="auth-cta h-12 w-full"
      >
        {he.loginPrimary}
      </Button>
    </AuthForm>
  );
}
