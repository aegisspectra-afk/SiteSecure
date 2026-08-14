import { AuthLayout } from "../components/AuthLayout";
import { OnboardingForm } from "../components/OnboardingForm";
import { LoadingBlock } from "@site-secure/ui";
import { Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { he } from "../i18n/he";
import { afterAuthPath, guestEntryPath } from "../lib/auth-routes";
import { useSession } from "../lib/session";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  const { loading, user, session, api, refresh } = useSession();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <AuthLayout title={he.onboardingTitle}>
        <LoadingBlock label={he.loading} />
      </AuthLayout>
    );
  }
  if (!user) return <Navigate to={guestEntryPath()} />;
  if (session?.has_workspace) return <Navigate to={afterAuthPath(true)} />;

  const profileDone = Boolean(session?.profile?.full_name);

  return (
    <AuthLayout title={he.onboardingTitle}>
      <OnboardingForm
        profileDone={profileDone}
        loading={submitting}
        error={error}
        onSubmit={async ({ name, timezone, vatPercent, fullName }) => {
          setSubmitting(true);
          setError(null);
          try {
            if (fullName) {
              await api.patchMe({ full_name: fullName, locale: "he" });
            }
            const ws = await api.createWorkspace({ name, plan_key: "solo" });
            const patch: { timezone?: string; vat_percent?: number } = {};
            if (timezone !== "Asia/Jerusalem") patch.timezone = timezone;
            if (vatPercent !== 18) patch.vat_percent = vatPercent;
            if (Object.keys(patch).length) {
              await api.patchWorkspace(ws.id, patch);
            }
            await refresh();
            await navigate({ to: afterAuthPath(true) });
          } catch (err) {
            setError(err instanceof Error ? err.message : he.sessionError);
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </AuthLayout>
  );
}
