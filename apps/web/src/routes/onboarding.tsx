import { ApiClientError } from "@site-secure/api-client";
import { Button, ErrorState } from "@site-secure/ui";
import { Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthLayout } from "../components/AuthLayout";
import { AuthFooter, AuthLaunchScreen, onboardingSteps } from "../components/auth";
import { OnboardingForm } from "../components/OnboardingForm";
import { OnboardingSoloSetup } from "../components/OnboardingSoloSetup";
import { he } from "../i18n/he";
import { authLaunchSequence } from "../lib/auth-launch";
import { afterAuthPath, guestEntryPath, onboardingEnterPath } from "../lib/auth-routes";
import { markSoloOnboarding, readSoloOnboarding } from "../lib/onboarding-solo";
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
  const [ownerConfirmed, setOwnerConfirmed] = useState(false);
  const [entering, setEntering] = useState(false);
  const [launchReady, setLaunchReady] = useState(false);
  const [createdWorkspaceId, setCreatedWorkspaceId] = useState<string | null>(null);
  const email = user?.email ?? session?.email ?? null;

  useEffect(() => {
    const workspaceId = session?.memberships[0]?.workspace_id;
    if (!workspaceId || created) return;
    const stored = readSoloOnboarding(workspaceId);
    if (!stored) return;
    setCreatedWorkspaceId(stored);
    setCreatedName(session?.memberships[0]?.workspace_name ?? null);
    setOwnerConfirmed(true);
    setCreated(true);
  }, [session, created]);

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

  // Existing workspace: Site Secure home — never public product/plan path.
  if (session?.has_workspace && !created && !entering && !readSoloOnboarding(session.memberships[0]?.workspace_id)) {
    return <Navigate to={afterAuthPath(true)} />;
  }

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
  const heading = created && ownerConfirmed
    ? he.onboardingStepBusinessVat
    : created
      ? he.onboardingReadyTitle
      : profileDone
        ? he.onboardingWorkspaceHeading
        : he.onboardingProfileHeading;
  const setupWorkspaceId = createdWorkspaceId ?? session?.memberships[0]?.workspace_id ?? null;

  async function enterSiteSecure() {
    setEntering(true);
    setLaunchReady(false);
    await authLaunchSequence({
      onWorkspace: () => setLaunchReady(false),
      onReady: () => setLaunchReady(true),
    });
    await navigate({ to: onboardingEnterPath() });
  }

  return (
    <AuthLayout
      title={he.onboardingTitle}
      kicker={he.onboardingKicker}
      heading={heading}
      description={
        created && ownerConfirmed
          ? he.onboardingSetupLead
          : created
            ? he.onboardingReadyBody
            : profileDone
              ? he.onboardingWorkspaceLead
              : undefined
      }
      steps={onboardingSteps(stepKey)}
      footer={accountFooter}
      showTrust={false}
    >
      {created && ownerConfirmed && setupWorkspaceId ? (
        <OnboardingSoloSetup
          api={api}
          workspaceId={setupWorkspaceId}
          workspaceName={createdName}
          onComplete={() => {
            void enterSiteSecure();
          }}
        />
      ) : (
      <OnboardingForm
        email={email}
        profileDone={profileDone}
        created={created}
        workspaceName={createdName}
        isBeta={createdIsBeta || Boolean(session?.memberships[0]?.is_beta)}
        ownerConfirmed={ownerConfirmed}
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
            setCreatedWorkspaceId(ws.id);
            markSoloOnboarding(ws.id);
            setCreatedIsBeta(Boolean(ws.is_beta));
            try {
              await api.patchWorkspace(ws.id, {
                timezone: "Asia/Jerusalem",
                vat_percent: 18,
                business_type: businessType,
              });
            } catch {
              // Workspace exists; timezone/VAT defaults still apply.
            }
            const hydrated = await refresh();
            const role = hydrated?.memberships[0]?.role_key;
            if (role !== "owner") {
              setOwnerConfirmed(false);
              setCreated(true);
              setError(he.onboardingOwnerRoleMissing);
              return;
            }
            setOwnerConfirmed(true);
            setCreated(true);
            setSubmitting(false);
            return;
          } catch (err) {
            // Workspace may already exist if defaults seed failed after RPC commit.
            const hydrated = await refresh();
            const m = hydrated?.memberships[0];
            if (hydrated?.has_workspace && m?.role_key === "owner") {
              setCreatedName(m.workspace_name || name);
              setCreatedWorkspaceId(m.workspace_id);
              markSoloOnboarding(m.workspace_id);
              setCreatedIsBeta(Boolean(m.is_beta));
              setOwnerConfirmed(true);
              setCreated(true);
              const code = err instanceof ApiClientError ? err.code : "";
              setError(
                code === "WORKSPACE_PRODUCT_DEFAULTS_FAILED" || code === "PRODUCT_DEFAULTS_UNAVAILABLE"
                  ? he.onboardingWorkspaceCreatedDefaultsFailed
                  : he.onboardingWorkspaceCreatedPartial,
              );
              return;
            }
            // Total failure: stay on create form (do not show ready/success).
            setCreated(false);
            setOwnerConfirmed(false);
            setError(err instanceof Error ? err.message : he.sessionError);
          } finally {
            setSubmitting(false);
          }
        }}
        onEnter={() => {
          void enterSiteSecure();
        }}
      />
      )}
    </AuthLayout>
  );
}
