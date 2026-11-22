import { ApiClientError } from "@site-secure/api-client";
import { Button, Textarea } from "@site-secure/ui";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { he } from "../../i18n/he";
import { useSession } from "../../lib/session";

type Props = {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
};

export function BillingUpgradeDialog({ workspaceId, open, onClose }: Props) {
  const { api } = useSession();
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  const submit = useMutation({
    mutationFn: () => api.createBillingUpgradeRequest(workspaceId, { message: message.trim() || undefined }),
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
      <div className="flex w-full max-w-md flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-bg p-4 shadow-lg">
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
          <Textarea
            id="billing-upgrade-message"
            label={he.settingsBillingUpgradeMessage}
            value={message}
            onChange={(ev) => setMessage(ev.target.value)}
            rows={4}
          />
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