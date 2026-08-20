import { Button, ProgressList, type ProgressStep } from "@site-secure/ui";
import { useMemo, useState, type FormEvent } from "react";
import { he } from "../i18n/he";
import { AuthAlert, AuthField, AuthForm } from "./auth";
import { LottieAnimation } from "./lottie";

export function OnboardingForm({
  email,
  profileDone,
  created = false,
  onSaveProfile,
  onCreateWorkspace,
  onEnter,
  error,
  loading,
}: {
  email?: string | null;
  profileDone: boolean;
  created?: boolean;
  onSaveProfile: (fullName: string) => Promise<void>;
  onCreateWorkspace: (input: { name: string; timezone: string; vatPercent: number }) => Promise<void>;
  onEnter: () => void;
  error?: string | null;
  loading?: boolean;
}) {
  const [name, setName] = useState("");
  const [fullName, setFullName] = useState("");
  const [timezone, setTimezone] = useState("Asia/Jerusalem");
  const [vat, setVat] = useState("18");
  const [nameError, setNameError] = useState<string>();
  const [fullNameError, setFullNameError] = useState<string>();

  const steps: ProgressStep[] = useMemo(
    () => [
      { id: "account", label: he.stepAccount, state: "done" },
      { id: "profile", label: he.stepProfile, state: profileDone ? "done" : "current" },
      {
        id: "workspace",
        label: he.stepWorkspace,
        state: !profileDone ? "upcoming" : created ? "done" : "current",
      },
      { id: "ready", label: he.stepReady, state: created ? "current" : "upcoming" },
    ],
    [created, profileDone],
  );

  async function handleProfile(e: FormEvent) {
    e.preventDefault();
    if (fullName.trim().length < 2) {
      setFullNameError(he.nameMin);
      return;
    }
    setFullNameError(undefined);
    await onSaveProfile(fullName.trim());
  }

  async function handleWorkspace(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setNameError(he.nameMin);
      return;
    }
    setNameError(undefined);
    const vatPercent = Number(vat);
    await onCreateWorkspace({
      name: name.trim(),
      timezone,
      vatPercent: Number.isFinite(vatPercent) ? vatPercent : 18,
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {email ? (
        <p className="text-sm text-fg-muted">
          {he.onboardingAccount}{" "}
          <span className="ltr-meta font-medium text-fg">{email}</span>
        </p>
      ) : null}
      <ProgressList steps={steps} />
      {created ? (
        <div className="flex flex-col items-center gap-6">
          <LottieAnimation name="success" size={72} />
          <Button type="button" variant="primary" className="h-12 w-full" onClick={onEnter}>
            {he.enterWorkspace}
          </Button>
        </div>
      ) : profileDone ? (
        <AuthForm onSubmit={handleWorkspace}>
          <AuthField
            id="workspaceName"
            label={he.workspaceName}
            value={name}
            onChange={(ev) => setName(ev.target.value)}
            error={nameError}
          />
          <AuthField
            id="timezone"
            label={he.timezone}
            ltr
            value={timezone}
            onChange={(ev) => setTimezone(ev.target.value)}
          />
          <AuthField
            id="vat"
            label={he.vat}
            type="number"
            value={vat}
            onChange={(ev) => setVat(ev.target.value)}
          />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-fg">{he.currencyLabel}</span>
            <p className="public-mono text-sm text-fg-muted">{he.currencyValue}</p>
          </div>
          {error ? <AuthAlert>{error}</AuthAlert> : null}
          <Button type="submit" variant="primary" loading={loading} className="h-12 w-full">
            {he.onboardingPrimary}
          </Button>
        </AuthForm>
      ) : (
        <AuthForm onSubmit={handleProfile}>
          <AuthField
            id="fullName"
            label={he.fullName}
            autoComplete="name"
            value={fullName}
            onChange={(ev) => setFullName(ev.target.value)}
            error={fullNameError}
          />
          {error ? <AuthAlert>{error}</AuthAlert> : null}
          <Button type="submit" variant="primary" loading={loading} className="h-12 w-full">
            {he.profileContinue}
          </Button>
        </AuthForm>
      )}
    </div>
  );
}
