import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthFooter, AuthHydrateError, AuthLaunchScreen, AuthLayout } from "../components/auth";
import { LoginForm } from "../components/LoginForm";
import { he } from "../i18n/he";
import { authErrorMessage } from "../lib/auth-errors";
import { authLaunchSequence } from "../lib/auth-launch";
import { afterAuthPath, sanitizeNextPath } from "../lib/auth-routes";
import { useSession } from "../lib/session";
import { supabase } from "../lib/supabase";

type AuthNextSearch = { next?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): AuthNextSearch => {
    const next = typeof search.next === "string" ? search.next : undefined;
    return next ? { next } : {};
  },
  component: LoginPage,
});

function LoginPage() {
  const { loading, user, session, error, refresh, signOut } = useSession();
  const navigate = useNavigate();
  const { next: nextRaw } = Route.useSearch();
  const next = sanitizeNextPath(nextRaw);
  const shell = {
    title: he.loginTitle,
    kicker: he.authWelcomeBack,
    heading: he.loginLead,
    description: he.loginDescription,
    variant: "login" as const,
  };
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
      const dest = afterAuthPath(session!.has_workspace, next);
      if (session!.has_workspace && dest === "/app") {
        await authLaunchSequence({
          onWorkspace: () => setLaunchReady(false),
          onReady: () => setLaunchReady(true),
        });
      }
      await navigate({ to: dest });
    })();
  }, [formError, navigate, next, ready, session, submitting]);

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
      <AuthLayout {...shell}>
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
      {...shell}
      footer={
        <AuthFooter
          prompt={he.noAccount}
          action={
            <Link
              to="/register"
              search={next ? { next } : {}}
              className="font-medium text-action transition-colors hover:underline"
            >
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
          setLaunching(true);
          setLaunchReady(false);
          const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
          if (authError) {
            setSubmitting(false);
            setLaunching(false);
            setFormError(authErrorMessage(authError.message));
            return;
          }
          const hydrated = await refresh();
          const dest = afterAuthPath(Boolean(hydrated?.has_workspace), next);
          if (hydrated?.has_workspace && dest === "/app") {
            await authLaunchSequence({
              onWorkspace: () => setLaunchReady(false),
              onReady: () => setLaunchReady(true),
            });
          }
          await navigate({ to: dest });
        }}
      />
    </AuthLayout>
  );
}
