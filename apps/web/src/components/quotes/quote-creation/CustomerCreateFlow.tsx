import { ApiClientError } from "@site-secure/api-client";
import { Button, Input } from "@site-secure/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { he } from "../../../i18n/he";
import { useSession } from "../../../lib/session";

export function CustomerCreateFlow({
  onCreated,
  onBack,
}: {
  onCreated: (customer: { id: string; name: string }) => void;
  onBack: () => void;
}) {
  const { session, api } = useSession();
  const queryClient = useQueryClient();
  const workspaceId = session?.memberships[0]?.workspace_id;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api.createCustomer(workspaceId!, {
        display_name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      }),
    onSuccess: (row) => {
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["customers", workspaceId] });
      onCreated({ id: row.id, name: row.display_name });
    },
    onError: (err) => {
      setFormError(err instanceof ApiClientError ? err.message : he.customersError);
    },
  });

  if (!workspaceId) return null;

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(ev: FormEvent) => {
        ev.preventDefault();
        if (!name.trim() || create.isPending) return;
        create.mutate();
      }}
    >
      <Input
        id="quote-flow-c-name"
        label={he.name}
        value={name}
        onChange={(ev) => setName(ev.target.value)}
        autoFocus
        data-autofocus
      />
      <Input id="quote-flow-c-email" label={he.email} value={email} onChange={(ev) => setEmail(ev.target.value)} />
      <Input id="quote-flow-c-phone" label={he.phone} value={phone} onChange={(ev) => setPhone(ev.target.value)} />
      {formError ? <p className="text-sm text-danger">{formError}</p> : null}
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="quote-flow-back" onClick={onBack}>
          {he.workflowBack}
        </button>
        <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
          {he.workflowSaveAndContinue}
        </Button>
      </div>
    </form>
  );
}
