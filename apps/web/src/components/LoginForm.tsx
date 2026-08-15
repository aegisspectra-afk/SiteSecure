import { Button, Checkbox, cn } from "@site-secure/ui";
import { Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { he } from "../i18n/he";
import { getRememberDevice, setRememberDevice } from "../lib/remember-device";
import { AuthAlert, AuthField, AuthForm, PasswordField } from "./auth";

const schema = z.object({
  email: z.string().email(he.invalidEmail),
  password: z.string().min(1, he.required),
});

export function LoginForm({
  onSubmit,
  error,
  loading,
  granted,
}: {
  onSubmit: (email: string, password: string) => Promise<void>;
  error?: string | null;
  loading?: boolean;
  granted?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(() => getRememberDevice());
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const busy = Boolean(loading || granted);

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
    <AuthForm onSubmit={handleSubmit} aria-busy={busy || undefined}>
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
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Checkbox
          id="remember"
          name="remember"
          label={he.rememberMe}
          checked={remember}
          onChange={(ev) => setRemember(ev.target.checked)}
          disabled={busy}
          className="accent-action"
        />
        <Link
          to="/forgot-password"
          className="text-sm text-fg-muted hover:text-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {he.loginSecondaryForgot}
        </Link>
      </div>
      {error ? <AuthAlert>{error}</AuthAlert> : null}
      <Button
        type="submit"
        variant="primary"
        loading={Boolean(loading) && !granted}
        loadingLabel={he.authenticating}
        disabled={granted}
        className={cn("auth-cta mt-2 h-12 w-full", granted && "bg-action text-action-fg")}
      >
        {granted ? he.accessGranted : he.loginPrimary}
      </Button>
    </AuthForm>
  );
}
