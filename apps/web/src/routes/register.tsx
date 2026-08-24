import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthFooter, AuthHydrateError, AuthLaunchScreen, AuthLayout, registerSteps } from "../components/auth";
import { RegisterForm } from "../components/RegisterForm";
import { he } from "../i18n/he";
import { authErrorMessage } from "../lib/auth-errors";
import { signupVerifyRedirectUrl } from "../lib/auth-redirect";
import { authLaunchSequence } from "../lib/auth-launch";
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
  const [launching, setLaunching] = useState(false);
  const [launchReady, setLaunchReady] = useState(false);

  const workspaceName = session?.memberships[0]?.workspace_name ?? null;
  const ready = Boolean(user && session && !loading);

  useEffect(() => {
    if (!ready || formError || submitting) return;
    setLaunching(true);
    void (async () => {
      if (session!.has_workspace) {
        await authLaunchSequence({
          onWorkspace: () => setLaunchReady(false),
          onReady: () => setLaunchReady(true),
        });
      }
      await navigate({ to: afterAuthPath(session!.has_workspace) });
    })();
  }, [formError, navigate, ready, session, submitting]);

  if (loading || launching || (user && session)) {
    return (
      <AuthLaunchScreen
        phase={
          launchReady ? "ready" : session?.has_workspace && !loading ? "workspace" : "session"
        }
        workspaceName={workspaceName}
        ready={launchReady}
      />
    );
  }

  if (error && user) {
    return (
      <AuthLayout {...registerShell} steps={registerSteps(1)}>
        <AuthHydrateError
          error={error}
          onRetry={() => void refresh()}
          onSignOut={() => void signOut()}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      {...registerShell}
      steps={registerSteps(1)}
      footer={
        <AuthFooter
          prompt={he.registerHasAccount}
          action={
            <Link to="/login" className="font-medium text-action transition-colors hover:underline">
              {he.loginTitle}
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
              emailRedirectTo: signupVerifyRedirectUrl(),
            },
          });
          if (authError) {
            setSubmitting(false);
            setFormError(authErrorMessage(authError.message));
            return;
          }
          if (!data.session) {
            setSubmitting(false);
            await navigate({ to: "/verify-email", search: { email } });
            return;
          }
          setLaunching(true);
          setLaunchReady(false);
          try {
            await api.patchMe({ full_name: fullName, locale: "he" });
          } catch {
            // Profile is completed on /onboarding. Never create a workspace here.
          }
          try {
            const hydrated = await refresh();
            if (hydrated?.has_workspace) {
              await authLaunchSequence({
                onWorkspace: () => setLaunchReady(false),
                onReady: () => setLaunchReady(true),
              });
            }
            await navigate({ to: afterAuthPath(Boolean(hydrated?.has_workspace)) });
          } catch (err) {
            setLaunching(false);
            setFormError(err instanceof Error ? authErrorMessage(err.message) : he.sessionError);
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </AuthLayout>
  );
}
