import { Button, ErrorState, LoadingBlock } from "@site-secure/ui";
import { Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthLayout } from "../components/AuthLayout";
import { AuthFooter } from "../components/auth";
import { OnboardingForm } from "../components/OnboardingForm";
import { he } from "../i18n/he";
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
      <AuthLayout title={he.onboardingTitle} kicker={he.onboardingKicker} heading={he.onboardingTitle}>
        <LoadingBlock label={he.loading} />
      </AuthLayout>
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
  if (session?.has_workspace && !created) return <Navigate to={afterAuthPath(true)} />;

  const profileDone = Boolean(session?.profile?.full_name);
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
      description={created ? he.onboardingReadyBody : undefined}
      footer={accountFooter}
    >
      <OnboardingForm
        email={email}
        profileDone={profileDone}
        created={created}
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
        onCreateWorkspace={async ({ name, timezone, vatPercent }) => {
          setSubmitting(true);
          setError(null);
          try {
            const ws = await api.createWorkspace({ name });
            setCreated(true);
            try {
              await api.patchWorkspace(ws.id, { timezone, vat_percent: vatPercent });
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
        onEnter={() => void navigate({ to: afterAuthPath(true) })}
      />
    </AuthLayout>
  );
}
