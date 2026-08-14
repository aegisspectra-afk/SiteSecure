import { Button, ErrorState, LoadingBlock, SuccessState } from "@site-secure/ui";
import { Link, Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthFooter, AuthLayout } from "../components/auth";
import { RegisterForm } from "../components/RegisterForm";
import { he } from "../i18n/he";
import { authErrorMessage } from "../lib/auth-errors";
import { afterAuthPath } from "../lib/auth-routes";
import { useSession } from "../lib/session";
import { supabase } from "../lib/supabase";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function RegisterPage() {
  const { loading, user, session, api, error, refresh } = useSession();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  if (loading) {
    return (
      <AuthLayout title={he.registerTitle} welcome={he.authWelcome} description={he.registerLead}>
        <LoadingBlock label={he.loading} />
      </AuthLayout>
    );
  }
  if (error && user && !checkEmail) {
    return (
      <AuthLayout title={he.registerTitle} welcome={he.authWelcome} description={he.registerLead}>
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
  if (user && session && !checkEmail) return <Navigate to={afterAuthPath(session.has_workspace)} />;

  if (checkEmail) {
    return (
      <AuthLayout title={he.registerTitle} welcome={he.authWelcome} description={he.registerLead}>
        <SuccessState
          className="px-0 py-4"
          title={he.checkEmail}
          description={he.checkEmailBody}
          action={
            <Button variant="primary" className="h-12" onClick={() => void navigate({ to: "/login" })}>
              {he.continueToLogin}
            </Button>
          }
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={he.registerTitle}
      welcome={he.authWelcome}
      description={he.registerLead}
      footer={
        <AuthFooter
          action={
            <Link to="/login" className="font-medium text-action hover:underline">
              {he.registerHasAccount}
            </Link>
          }
        />
      }
    >
      <RegisterForm
        loading={submitting}
        error={formError}
        onSubmit={async ({ fullName, email, password }) => {
          setSubmitting(true);
          setFormError(null);
          const { data, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: fullName },
              emailRedirectTo: `${window.location.origin}/login`,
            },
          });
          if (authError) {
            setSubmitting(false);
            setFormError(authErrorMessage(authError.message));
            return;
          }
          if (!data.session) {
            setSubmitting(false);
            setCheckEmail(true);
            return;
          }
          try {
            await api.patchMe({ full_name: fullName, locale: "he" });
            const hydrated = await refresh();
            await navigate({ to: afterAuthPath(Boolean(hydrated?.has_workspace)) });
          } catch (err) {
            setFormError(err instanceof Error ? authErrorMessage(err.message) : he.sessionError);
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </AuthLayout>
  );
}
