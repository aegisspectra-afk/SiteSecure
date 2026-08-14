import { Button, ErrorState, LoadingBlock } from "@site-secure/ui";
import { Link, Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthFooter, AuthLayout } from "../components/auth";
import { LoginForm } from "../components/LoginForm";
import { he } from "../i18n/he";
import { authErrorMessage } from "../lib/auth-errors";
import { afterAuthPath } from "../lib/auth-routes";
import { useSession } from "../lib/session";
import { supabase } from "../lib/supabase";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { loading, user, session, error, refresh } = useSession();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const shell = { title: he.loginTitle, kicker: he.authWelcomeBack, heading: he.loginLead };

  if (loading) {
    return (
      <AuthLayout {...shell}>
        <LoadingBlock label={he.loading} />
      </AuthLayout>
    );
  }
  if (error && user) {
    return (
      <AuthLayout {...shell}>
        <ErrorState
          className="px-0 py-4"
          title={he.sessionError}
          action={
            <Button variant="secondary" onClick={() => void refresh()}>
              {he.retry}
            </Button>
          }
        />
      </AuthLayout>
    );
  }
  if (user && session) return <Navigate to={afterAuthPath(session.has_workspace)} />;

  return (
    <AuthLayout
      {...shell}
      footer={
        <AuthFooter
          prompt={he.noAccount}
          action={
            <Link to="/register" className="font-medium text-action hover:underline">
              {he.loginSecondaryRegister}
            </Link>
          }
        />
      }
    >
      <LoginForm
        loading={submitting}
        error={formError}
        onSubmit={async (email, password) => {
          setSubmitting(true);
          setFormError(null);
          const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
          if (authError) {
            setSubmitting(false);
            setFormError(authErrorMessage(authError.message));
            return;
          }
          const hydrated = await refresh();
          setSubmitting(false);
          await navigate({ to: afterAuthPath(Boolean(hydrated?.has_workspace)) });
        }}
      />
    </AuthLayout>
  );
}
