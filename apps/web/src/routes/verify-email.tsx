import { Link, Navigate, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AuthFooter, AuthLaunchScreen, AuthLayout } from "../components/auth";
import { VerifyEmailPanel } from "../components/VerifyEmailPanel";
import { he } from "../i18n/he";
import { authErrorMessage } from "../lib/auth-errors";
import { signupVerifyRedirectUrl } from "../lib/auth-redirect";
import { afterAuthPath } from "../lib/auth-routes";
import { useSession } from "../lib/session";
import { supabase } from "../lib/supabase";

export const Route = createFileRoute("/verify-email")({
  validateSearch: (search: Record<string, unknown>): { email?: string } => ({
    email: typeof search.email === "string" && search.email.trim() ? search.email.trim() : undefined,
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { email } = Route.useSearch();
  const { loading, user, session } = useSession();
  const [submitting, setSubmitting] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return <AuthLaunchScreen phase="session" />;
  }
  if (user && session) return <Navigate to={afterAuthPath(session.has_workspace)} />;

  return (
    <AuthLayout
      title={he.verifyTitle}
      kicker={he.verifyKicker}
      heading={he.verifyTitle}
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
      <VerifyEmailPanel
        email={email}
        loading={submitting}
        resent={resent}
        error={error}
        onResend={async () => {
          if (!email) return;
          setSubmitting(true);
          setError(null);
          const { error: authError } = await supabase.auth.resend({
            type: "signup",
            email,
            options: { emailRedirectTo: signupVerifyRedirectUrl() },
          });
          setSubmitting(false);
          if (authError) {
            setError(authErrorMessage(authError.message));
            return;
          }
          setResent(true);
        }}
      />
    </AuthLayout>
  );
}
