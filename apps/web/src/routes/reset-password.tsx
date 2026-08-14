import { Button, ErrorState, LoadingBlock } from "@site-secure/ui";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthAlert, AuthFooter, AuthForm, AuthLayout, PasswordField } from "../components/auth";
import { he } from "../i18n/he";
import { authErrorMessage } from "../lib/auth-errors";
import { useSession } from "../lib/session";
import { supabase } from "../lib/supabase";

export const Route = createFileRoute("/reset-password")({
  component: ResetPage,
});

function ResetPage() {
  const { loading, user } = useSession();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string>();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setFieldError(he.passwordMin);
      setError(null);
      return;
    }
    if (password !== confirm) {
      setFieldError(he.passwordMismatch);
      setError(null);
      return;
    }
    setFieldError(undefined);
    setSubmitting(true);
    const { error: authError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (authError) {
      setError(authErrorMessage(authError.message));
      return;
    }
    await supabase.auth.signOut();
    await navigate({ to: "/login" });
  }

  if (loading) {
    return (
      <AuthLayout title={he.resetTitle} description={he.resetLead}>
        <LoadingBlock label={he.loading} />
      </AuthLayout>
    );
  }

  if (!user) {
    return (
      <AuthLayout title={he.resetTitle} description={he.resetLead}>
        <ErrorState
          className="px-0 py-4"
          title={he.resetInvalid}
          description={he.resetInvalidBody}
          action={
            <Button variant="primary" className="h-12" onClick={() => void navigate({ to: "/forgot-password" })}>
              {he.requestNewReset}
            </Button>
          }
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={he.resetTitle}
      description={he.resetLead}
      footer={
        <AuthFooter
          action={
            <Link to="/login" className="font-medium text-action hover:underline">
              {he.backToLogin}
            </Link>
          }
        />
      }
    >
      <AuthForm onSubmit={onSubmit}>
        <PasswordField
          id="password"
          name="password"
          label={he.password}
          autoComplete="new-password"
          hint={he.passwordMin}
          value={password}
          onChange={(ev) => setPassword(ev.target.value)}
          error={fieldError}
        />
        <PasswordField
          id="confirm"
          name="confirm"
          label={he.passwordConfirm}
          autoComplete="new-password"
          value={confirm}
          onChange={(ev) => setConfirm(ev.target.value)}
        />
        {error ? <AuthAlert>{error}</AuthAlert> : null}
        <Button type="submit" variant="primary" loading={submitting} className="h-12 w-full">
          {he.resetPrimary}
        </Button>
      </AuthForm>
    </AuthLayout>
  );
}
