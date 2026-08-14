import { Button, Input, ProgressList, type ProgressStep } from "@site-secure/ui";
import { useMemo, useState, type FormEvent } from "react";
import { he } from "../i18n/he";

export function OnboardingForm({
  profileDone,
  onSubmit,
  error,
  loading,
}: {
  profileDone: boolean;
  onSubmit: (input: {
    name: string;
    timezone: string;
    vatPercent: number;
    fullName?: string;
  }) => Promise<void>;
  error?: string | null;
  loading?: boolean;
}) {
  const [name, setName] = useState("");
  const [fullName, setFullName] = useState("");
  const [timezone, setTimezone] = useState("Asia/Jerusalem");
  const [vat, setVat] = useState("18");
  const [advanced, setAdvanced] = useState(false);
  const [nameError, setNameError] = useState<string>();
  const [fullNameError, setFullNameError] = useState<string>();

  const steps: ProgressStep[] = useMemo(
    () => [
      { id: "account", label: he.stepAccount, state: "done" },
      { id: "profile", label: he.stepProfile, state: profileDone ? "done" : "current" },
      {
        id: "workspace",
        label: he.stepWorkspace,
        state: "current",
      },
      { id: "customer", label: `${he.stepCustomer} — ${he.laterStep}`, state: "upcoming" },
      { id: "site", label: `${he.stepSite} — ${he.laterStep}`, state: "upcoming" },
      { id: "quote", label: `${he.stepQuote} — ${he.laterStep}`, state: "upcoming" },
    ],
    [profileDone],
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    let blocked = false;
    if (!profileDone && fullName.trim().length < 2) {
      setFullNameError(he.nameMin);
      blocked = true;
    } else {
      setFullNameError(undefined);
    }
    if (name.trim().length < 2) {
      setNameError(he.nameMin);
      blocked = true;
    } else {
      setNameError(undefined);
    }
    if (blocked) return;
    const vatPercent = Number(vat);
    await onSubmit({
      name: name.trim(),
      timezone,
      vatPercent: Number.isFinite(vatPercent) ? vatPercent : 18,
      fullName: profileDone ? undefined : fullName.trim(),
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <ProgressList steps={steps} />
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        {profileDone ? null : (
          <Input
            id="fullName"
            label={he.fullName}
            autoComplete="name"
            value={fullName}
            onChange={(ev) => setFullName(ev.target.value)}
            error={fullNameError}
          />
        )}
        <Input
          id="workspaceName"
          label={he.workspaceName}
          value={name}
          onChange={(ev) => setName(ev.target.value)}
          error={nameError}
        />
        <button
          type="button"
          className="self-start text-sm font-medium text-action hover:underline focus-visible:outline-2 focus-visible:outline-focus"
          aria-expanded={advanced}
          onClick={() => setAdvanced((v) => !v)}
        >
          {he.advanced}
        </button>
        {advanced ? (
          <div className="flex flex-col gap-4">
            <Input
              id="timezone"
              label={he.timezone}
              value={timezone}
              onChange={(ev) => setTimezone(ev.target.value)}
              className="ltr-meta"
            />
            <Input
              id="vat"
              label={he.vat}
              type="number"
              value={vat}
              onChange={(ev) => setVat(ev.target.value)}
            />
          </div>
        ) : null}
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" loading={loading} className="w-full">
          {he.onboardingPrimary}
        </Button>
      </form>
    </div>
  );
}
