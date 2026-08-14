import { Button, SuccessState } from "@site-secure/ui";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { AuthAlert, AuthField, AuthFooter, AuthForm, AuthLayout } from "../components/auth";
import { he } from "../i18n/he";
import { authErrorMessage } from "../lib/auth-errors";
import { resetPasswordRedirectUrl } from "../lib/auth-redirect";
import { supabase } from "../lib/supabase";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPage,
});

function ForgotPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string>();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = z.string().email(he.invalidEmail).safeParse(email);
    if (!parsed.success) {
      setFieldError(he.invalidEmail);
      return;
    }
    setFieldError(undefined);
    setLoading(true);
    setError(null);
    const { error: authError } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: resetPasswordRedirectUrl(),
    });
    setLoading(false);
    if (authError) {
      setError(authErrorMessage(authError.message));
      return;
    }
    setSent(true);
  }

  return (
    <AuthLayout
      title={he.forgotTitle}
      description={he.forgotLead}
      footer={
        sent ? undefined : (
          <AuthFooter
            action={
              <Link to="/login" className="font-medium text-action hover:underline">
                {he.backToLogin}
              </Link>
            }
          />
        )
      }
    >
      {sent ? (
        <SuccessState
          className="px-0 py-4"
          title={he.forgotSent}
          description={he.forgotSentBody}
          action={
            <Button variant="primary" className="h-12" onClick={() => void navigate({ to: "/login" })}>
              {he.continueToLogin}
            </Button>
          }
        />
      ) : (
        <AuthForm onSubmit={onSubmit}>
          <AuthField
            id="email"
            name="email"
            label={he.email}
            type="email"
            autoComplete="email"
            ltr
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            error={fieldError}
          />
          {error ? <AuthAlert>{error}</AuthAlert> : null}
          <Button type="submit" variant="primary" loading={loading} className="h-12 w-full">
            {he.forgotPrimary}
          </Button>
        </AuthForm>
      )}
    </AuthLayout>
  );
}
