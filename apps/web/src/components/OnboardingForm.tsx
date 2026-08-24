import { Button, Select } from "@site-secure/ui";
import { useState, type FormEvent } from "react";
import { he } from "../i18n/he";
import { AuthAlert, AuthField, AuthForm } from "./auth";

const BUSINESS_TYPES = [
  "security_company",
  "security_installer",
  "low_voltage",
  "integrator",
  "electrician",
  "other",
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

export function OnboardingForm({
  email,
  profileDone,
  created = false,
  workspaceName,
  isBeta = false,
  onSaveProfile,
  onCreateWorkspace,
  onEnter,
  error,
  loading,
}: {
  email?: string | null;
  profileDone: boolean;
  created?: boolean;
  workspaceName?: string | null;
  isBeta?: boolean;
  onSaveProfile: (fullName: string) => Promise<void>;
  onCreateWorkspace: (input: { name: string; businessType: BusinessType }) => Promise<void>;
  onEnter: () => void;
  error?: string | null;
  loading?: boolean;
}) {
  const [name, setName] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType | "">("");
  const [nameError, setNameError] = useState<string>();
  const [typeError, setTypeError] = useState<string>();
  const [fullNameError, setFullNameError] = useState<string>();

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
    let ok = true;
    if (name.trim().length < 2) {
      setNameError(he.nameMin);
      ok = false;
    } else setNameError(undefined);
    if (!businessType) {
      setTypeError(he.required);
      ok = false;
    } else setTypeError(undefined);
    if (!ok) return;
    await onCreateWorkspace({
      name: name.trim(),
      businessType: businessType as BusinessType,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {email ? (
        <p className="text-sm text-fg-muted">
          {he.onboardingAccount}{" "}
          <span className="ltr-meta font-medium text-fg">{email}</span>
        </p>
      ) : null}

      {created ? (
        <div className="flex flex-col gap-6">
          {workspaceName ? (
            <div className="auth-ready-card ops-card px-4 py-4">
              <p className="text-base font-semibold text-fg">{workspaceName}</p>
              <p className="public-mono mt-1 text-[10px] tracking-[0.16em] text-fg-muted">{he.brand}</p>
              {isBeta ? (
                <p className="mt-3 text-sm text-fg-muted">
                  <span className="font-medium text-fg">{he.onboardingBetaTitle}. </span>
                  {he.onboardingBetaBody}
                </p>
              ) : null}
            </div>
          ) : null}
          <Button type="button" variant="primary" className="auth-cta h-12 w-full" onClick={onEnter}>
            {he.enterWorkspace}
          </Button>
        </div>
      ) : profileDone ? (
        <AuthForm onSubmit={handleWorkspace}>
          <AuthField
            id="workspaceName"
            label={he.businessName}
            value={name}
            onChange={(ev) => setName(ev.target.value)}
            error={nameError}
          />
          <Select
              id="businessType"
              label={he.businessType}
              value={businessType}
              onChange={(ev) => setBusinessType(ev.target.value as BusinessType | "")}
              error={typeError}
            >
              <option value="">{he.businessTypePlaceholder}</option>
              {BUSINESS_TYPES.map((key) => (
                <option key={key} value={key}>
                  {he.businessTypes[key]}
                </option>
              ))}
            </Select>
          {error ? <AuthAlert>{error}</AuthAlert> : null}
          <Button type="submit" variant="primary" loading={loading} className="auth-cta h-12 w-full">
            {he.profileContinue}
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
          <Button type="submit" variant="primary" loading={loading} className="auth-cta h-12 w-full">
            {he.profileContinue}
          </Button>
        </AuthForm>
      )}
    </div>
  );
}
