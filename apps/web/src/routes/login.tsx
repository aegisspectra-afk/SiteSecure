import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthFooter, AuthHydrateError, AuthLaunchScreen, AuthLayout } from "../components/auth";
import { LoginForm } from "../components/LoginForm";
import { he } from "../i18n/he";
import { authErrorMessage } from "../lib/auth-errors";
import { authLaunchSequence } from "../lib/auth-launch";
import { landingPathForSession, sanitizeNextPath } from "../lib/auth-routes";
import { useSession } from "../lib/session";
import { supabase } from "../lib/supabase";
import { clearUnitSession, hasUnitSession, saveUnitSession } from "../lib/unit-session";

type AuthNextSearch = { next?: string; msg?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): AuthNextSearch => {
    const next = typeof search.next === "string" ? search.next : undefined;
    const msg = typeof search.msg === "string" ? search.msg : undefined;
    return { ...(next ? { next } : {}), ...(msg ? { msg } : {}) };
  },
  component: LoginPage,
});

function LoginPage() {
  const { loading, user, session, error, refresh, signOut, api } = useSession();
  const navigate = useNavigate();
  const { next: nextRaw, msg: authMsg } = Route.useSearch();
  const next = sanitizeNextPath(nextRaw);
  const shell = {
    title: he.loginTitle,
    kicker: he.authWelcomeBack,
    heading: he.loginLead,
    description: he.loginDescription,
    variant: "login" as const,
    tone: "premium" as const,
  };
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchReady, setLaunchReady] = useState(false);

  const workspaceName = session?.memberships[0]?.workspace_name ?? null;
  const ready = Boolean(user && session && !loading);

  useEffect(() => {
    if (loading || user) return;
    if (hasUnitSession()) {
      void navigate({ to: "/unit" });
    }
  }, [loading, navigate, user]);

  useEffect(() => {
    if (!ready || formError || submitting) return;
    setLaunching(true);
    void (async () => {
      const dest = landingPathForSession(session!, next);
      if (session!.has_workspace && dest !== "/onboarding") {
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
      {authMsg ? (
        <p
          role="status"
          data-testid="login-auth-msg"
          className="mb-4 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-950"
        >
          {authMsg}
        </p>
      ) : null}
      <LoginForm
        loading={submitting}
        error={formError}
        onSubmitUnit={async (code) => {
          setSubmitting(true);
          setFormError(null);
          try {
            await supabase.auth.signOut({ scope: "local" });
            const result = await api.loginSspUnit({ code });
            saveUnitSession({
              token: result.unit_token,
              expiresAt: result.expires_at,
              workspaceId: result.workspace_id,
              siteId: result.site.id,
              siteName: result.site.name || "",
            });
            await navigate({ to: "/unit" });
          } catch (err) {
            clearUnitSession();
            setFormError(err instanceof Error ? err.message : he.sspUnitLoginInvalid);
          } finally {
            setSubmitting(false);
          }
        }}
        onSubmit={async (email, password) => {
          setSubmitting(true);
          setFormError(null);
          setLaunching(true);
          setLaunchReady(false);
          clearUnitSession();
          const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
          if (authError) {
            setSubmitting(false);
            setLaunching(false);
            setFormError(authErrorMessage(authError.message));
            return;
          }
          const hydrated = await refresh();
          const dest = landingPathForSession(hydrated ?? null, next);
          if (hydrated?.has_workspace && dest !== "/onboarding") {
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
