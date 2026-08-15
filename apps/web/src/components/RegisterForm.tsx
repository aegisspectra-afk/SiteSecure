import { Button, cn } from "@site-secure/ui";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { he } from "../i18n/he";
import { AuthAlert, AuthField, AuthForm, PasswordField, PasswordStrength } from "./auth";

const schema = z
  .object({
    fullName: z.string().min(2, he.nameMin),
    email: z.string().email(he.invalidEmail),
    password: z.string().min(8, he.passwordMin),
    confirm: z.string().min(8, he.passwordMin),
  })
  .refine((v) => v.password === v.confirm, { message: he.passwordMismatch, path: ["confirm"] });

export function RegisterForm({
  onSubmit,
  error,
  loading,
  created,
}: {
  onSubmit: (input: { fullName: string; email: string; password: string }) => Promise<void>;
  error?: string | null;
  loading?: boolean;
  created?: boolean;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const busy = Boolean(loading || created);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const parsed = schema.safeParse({ fullName, email, password, confirm });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        next[key] = issue.message;
      }
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});
    await onSubmit({
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      password: parsed.data.password,
    });
  }

  return (
    <AuthForm onSubmit={handleSubmit} aria-busy={busy || undefined}>
      <AuthField
        id="fullName"
        name="fullName"
        label={he.fullName}
        autoComplete="name"
        value={fullName}
        onChange={(ev) => setFullName(ev.target.value)}
        error={fieldErrors.fullName}
        disabled={busy}
      />
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
        autoComplete="new-password"
        value={password}
        onChange={(ev) => setPassword(ev.target.value)}
        error={fieldErrors.password}
        disabled={busy}
      />
      <PasswordStrength password={password} />
      <PasswordField
        id="confirm"
        name="confirm"
        label={he.passwordConfirm}
        autoComplete="new-password"
        value={confirm}
        onChange={(ev) => setConfirm(ev.target.value)}
        error={fieldErrors.confirm}
        disabled={busy}
      />
      {error ? <AuthAlert>{error}</AuthAlert> : null}
      <Button
        type="submit"
        variant="primary"
        loading={Boolean(loading) && !created}
        loadingLabel={he.creatingAccount}
        disabled={created}
        className={cn("auth-cta mt-2 h-12 w-full", created && "bg-action text-action-fg")}
      >
        {created ? he.accountCreated : he.registerPrimary}
      </Button>
    </AuthForm>
  );
}
