import { Button } from "@site-secure/ui";
import { Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { he } from "../i18n/he";
import { AuthAlert, AuthField, AuthForm, PasswordField } from "./auth";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
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
    await onSubmit(parsed.data.email, parsed.data.password);
  }

  return (
    <AuthForm onSubmit={handleSubmit}>
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
      />
      <PasswordField
        id="password"
        name="password"
        label={he.password}
        autoComplete="current-password"
        value={password}
        onChange={(ev) => setPassword(ev.target.value)}
        error={fieldErrors.password}
        accessory={
          <Link
            to="/forgot-password"
            className="text-sm text-fg-muted hover:text-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {he.loginSecondaryForgot}
          </Link>
        }
      />
      {error ? <AuthAlert>{error}</AuthAlert> : null}
      <Button type="submit" variant="primary" loading={loading} className="mt-2 h-12 w-full">
        {he.loginPrimary}
      </Button>
    </AuthForm>
  );
}
