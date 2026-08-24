import { Button, ErrorState } from "@site-secure/ui";
import { Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthLayout } from "../components/AuthLayout";
import { AuthFooter, AuthLaunchScreen, onboardingSteps } from "../components/auth";
import { OnboardingForm } from "../components/OnboardingForm";
import { he } from "../i18n/he";
import { authLaunchSequence } from "../lib/auth-launch";
import { afterAuthPath, guestEntryPath } from "../lib/auth-routes";
import { useSession } from "../lib/session";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  const { loading, user, session, api, error: sessionError, refresh, signOut } = useSession();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(false);
  const [createdName, setCreatedName] = useState<string | null>(null);
  const [createdIsBeta, setCreatedIsBeta] = useState(false);
  const [entering, setEntering] = useState(false);
  const [launchReady, setLaunchReady] = useState(false);
  const email = user?.email ?? session?.email ?? null;
  const accountFooter = (
    <AuthFooter
      prompt={he.onboardingWrongAccount}
      action={
        <button type="button" className="font-medium text-action hover:underline" onClick={() => void signOut()}>
          {he.signOut}
        </button>
      }
    />
  );

  if (loading) {
    return (
      <AuthLaunchScreen
        phase={session?.has_workspace ? "workspace" : "session"}
        workspaceName={session?.memberships[0]?.workspace_name}
      />
    );
  }
  if (!user) return <Navigate to={guestEntryPath()} />;
  if (sessionError && !session) {
    return (
      <AuthLayout
        title={he.onboardingTitle}
        kicker={he.onboardingKicker}
        heading={he.onboardingTitle}
        footer={accountFooter}
        showTrust={false}
        steps={onboardingSteps("profile")}
      >
        {email ? (
          <p className="mb-4 text-sm text-fg-muted">
            {he.onboardingAccount} <span className="ltr-meta font-medium text-fg">{email}</span>
          </p>
        ) : null}
        <ErrorState
          className="px-0 py-4"
          title={he.apiUnavailable}
          description={sessionError}
          action={
            <Button variant="secondary" onClick={() => void refresh()}>
              {he.retry}
            </Button>
          }
        />
      </AuthLayout>
    );
  }
  if (session?.has_workspace && !created && !entering) return <Navigate to={afterAuthPath(true)} />;

  if (entering) {
    return (
      <AuthLaunchScreen
        phase={launchReady ? "ready" : "workspace"}
        workspaceName={createdName ?? session?.memberships[0]?.workspace_name}
        ready={launchReady}
      />
    );
  }

  const profileDone = Boolean(session?.profile?.full_name);
  const stepKey = created ? "ready" : profileDone ? "workspace" : "profile";
  const heading = created
    ? he.onboardingReadyTitle
    : profileDone
      ? he.onboardingWorkspaceHeading
      : he.onboardingProfileHeading;

  return (
    <AuthLayout
      title={he.onboardingTitle}
      kicker={he.onboardingKicker}
      heading={heading}
      description={
        created ? he.onboardingReadyBody : profileDone ? he.onboardingWorkspaceLead : undefined
      }
      steps={onboardingSteps(stepKey)}
      footer={accountFooter}
      showTrust={false}
    >
      <OnboardingForm
        email={email}
        profileDone={profileDone}
        created={created}
        workspaceName={createdName}
        isBeta={createdIsBeta || Boolean(session?.memberships[0]?.is_beta)}
        loading={submitting}
        error={error}
        onSaveProfile={async (fullName) => {
          setSubmitting(true);
          setError(null);
          try {
            await api.patchMe({ full_name: fullName, locale: "he" });
            await refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : he.sessionError);
          } finally {
            setSubmitting(false);
          }
        }}
        onCreateWorkspace={async ({ name, businessType }) => {
          setSubmitting(true);
          setError(null);
          try {
            const ws = await api.createWorkspace({ name, business_type: businessType });
            setCreatedName(ws.name ?? name);
            setCreatedIsBeta(Boolean(ws.is_beta));
            setCreated(true);
            try {
              await api.patchWorkspace(ws.id, {
                timezone: "Asia/Jerusalem",
                vat_percent: 18,
                business_type: businessType,
              });
            } catch {
              // Workspace exists; timezone/VAT defaults still apply.
            }
            await refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : he.sessionError);
          } finally {
            setSubmitting(false);
          }
        }}
        onEnter={() => {
          setEntering(true);
          setLaunchReady(false);
          void (async () => {
            await authLaunchSequence({
              onWorkspace: () => setLaunchReady(false),
              onReady: () => setLaunchReady(true),
            });
            await navigate({ to: afterAuthPath(true) });
          })();
        }}
      />
    </AuthLayout>
  );
}
