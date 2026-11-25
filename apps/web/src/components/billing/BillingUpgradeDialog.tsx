import { ApiClientError } from "@site-secure/api-client";
import {
  catalogPlansOrdered,
  formatIls,
  monthlyTotalIls,
  planAllowsExtraSeats,
} from "../../lib/public-pricing";
import { Button, Input, Textarea } from "@site-secure/ui";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { he } from "../../i18n/he";
import { useSession } from "../../lib/session";

type Props = {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
};

const UPGRADE_PLANS = catalogPlansOrdered().filter((p) => p.key !== "free");

export function BillingUpgradeDialog({ workspaceId, open, onClose }: Props) {
  const { api } = useSession();
  const [targetPlan, setTargetPlan] = useState("pro");
  const [extraSeats, setExtraSeats] = useState(0);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  const plan = useMemo(
    () => UPGRADE_PLANS.find((p) => p.key === targetPlan) ?? UPGRADE_PLANS[0],
    [targetPlan],
  );
  const allowsExtras = plan ? planAllowsExtraSeats(plan) : false;
  const estimated = plan
    ? monthlyTotalIls({ plan, extraSeats: allowsExtras ? extraSeats : 0 })
    : null;

  const submit = useMutation({
    mutationFn: () =>
      api.createBillingUpgradeRequest(workspaceId, {
        target_plan_key: plan?.key,
        requested_extra_seats: allowsExtras ? extraSeats : 0,
        estimated_monthly_ils_before_vat: estimated ?? undefined,
        contact_name: contactName.trim() || undefined,
        contact_phone: contactPhone.trim() || undefined,
        contact_email: contactEmail.trim() || undefined,
        message: message.trim() || undefined,
      }),
    onSuccess: () => {
      setDone(true);
      setMessage("");
    },
  });

  if (!open) return null;

  const error =
    submit.error instanceof ApiClientError ? submit.error.message : submit.isError ? he.sessionError : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-fg/30 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="billing-upgrade-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-[var(--radius-card)] border border-border bg-bg p-4 shadow-lg">
        <div>
          <h2 id="billing-upgrade-title" className="text-base font-semibold text-fg">
            {he.settingsBillingUpgradeTitle}
          </h2>
          <p className="mt-1 text-sm text-fg-muted">{he.settingsBillingUpgradeHint}</p>
        </div>
        {done ? (
          <p className="text-sm text-fg" role="status">
            {he.settingsBillingUpgradeDone}
          </p>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-fg-muted">{he.settingsBillingUpgradePlan}</span>
              <select
                className="h-12 min-h-12 rounded-[var(--radius-control)] border border-border bg-bg px-3 text-[17px] text-fg"
                value={targetPlan}
                onChange={(ev) => {
                  setTargetPlan(ev.target.value);
                  setExtraSeats(0);
                }}
              >
                {UPGRADE_PLANS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label_he}
                  </option>
                ))}
              </select>
            </label>

            {allowsExtras ? (
              <Input
                id="billing-upgrade-extras"
                type="number"
                min={0}
                max={500}
                label={he.settingsBillingUpgradeExtras}
                value={String(extraSeats)}
                onChange={(ev) => setExtraSeats(Math.max(0, Number(ev.target.value) || 0))}
              />
            ) : null}

            <p className="text-sm text-fg">
              {he.settingsBillingUpgradeEstimate}:{" "}
              <strong>{estimated == null ? he.settingsBillingUpgradeCustom : formatIls(estimated)}</strong>
              <span className="text-fg-muted"> {he.settingsBillingUpgradeBeforeVat}</span>
            </p>

            <Input
              id="billing-upgrade-name"
              label={he.settingsBillingUpgradeContactName}
              value={contactName}
              onChange={(ev) => setContactName(ev.target.value)}
            />
            <Input
              id="billing-upgrade-phone"
              label={he.settingsBillingUpgradeContactPhone}
              value={contactPhone}
              onChange={(ev) => setContactPhone(ev.target.value)}
            />
            <Input
              id="billing-upgrade-email"
              type="email"
              label={he.settingsBillingUpgradeContactEmail}
              value={contactEmail}
              onChange={(ev) => setContactEmail(ev.target.value)}
            />
            <Textarea
              id="billing-upgrade-message"
              label={he.settingsBillingUpgradeMessage}
              value={message}
              onChange={(ev) => setMessage(ev.target.value)}
              rows={3}
            />
          </>
        )}
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {he.cancel}
          </Button>
          {done ? (
            <Button type="button" variant="primary" onClick={onClose}>
              {he.adminWorkspaceProductsClose}
            </Button>
          ) : (
            <Button type="button" variant="primary" loading={submit.isPending} onClick={() => submit.mutate()}>
              {he.settingsBillingUpgradeSubmit}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
