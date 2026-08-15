import { LoadingBlock } from "@site-secure/ui";
import { Link, Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthFooter, AuthHydrateError, AuthLayout } from "../components/auth";
import { RegisterForm } from "../components/RegisterForm";
import { he } from "../i18n/he";
import { authErrorMessage } from "../lib/auth-errors";
import { signupVerifyRedirectUrl } from "../lib/auth-redirect";
import { afterAuthPath } from "../lib/auth-routes";
import { useSession } from "../lib/session";
import { supabase } from "../lib/supabase";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

const registerShell = {
  title: he.registerTitle,
  kicker: he.authCreateAccount,
  heading: he.registerTitle,
  description: he.registerLead,
} as const;

function RegisterPage() {
  const { loading, user, session, api, error, refresh, signOut } = useSession();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(false);

  if (loading) {
    return (
      <AuthLayout {...registerShell}>
        <LoadingBlock label={he.loading} />
      </AuthLayout>
    );
  }
  if (error && user) {
    return (
      <AuthLayout {...registerShell}>
        <AuthHydrateError
          error={error}
          onRetry={() => void refresh()}
          onSignOut={() => void signOut()}
        />
      </AuthLayout>
    );
  }
  if (user && session) return <Navigate to={afterAuthPath(session.has_workspace)} />;

  return (
    <AuthLayout
      {...registerShell}
      footer={
        <AuthFooter
          prompt={he.registerHasAccount}
          action={
            <Link to="/login" className="font-medium text-action hover:underline">
              {he.loginTitle}
            </Link>
          }
        />
      }
    >
      <RegisterForm
        loading={submitting}
        created={created}
        error={formError}
        onSubmit={async ({ fullName, email, password }) => {
          setSubmitting(true);
          setFormError(null);
          const { data, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: fullName },
              emailRedirectTo: signupVerifyRedirectUrl(),
            },
          });
          if (authError) {
            setSubmitting(false);
            setFormError(authErrorMessage(authError.message));
            return;
          }
          setCreated(true);
          if (!data.session) {
            await navigate({ to: "/verify-email", search: { email } });
            return;
          }
          try {
            await api.patchMe({ full_name: fullName, locale: "he" });
          } catch {
            // Profile is completed on /onboarding. Never create a workspace here.
          }
          try {
            const hydrated = await refresh();
            await navigate({ to: afterAuthPath(Boolean(hydrated?.has_workspace)) });
          } catch (err) {
            setCreated(false);
            setFormError(err instanceof Error ? authErrorMessage(err.message) : he.sessionError);
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </AuthLayout>
  );
}
