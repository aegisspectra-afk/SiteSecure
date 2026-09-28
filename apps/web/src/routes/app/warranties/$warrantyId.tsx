import { ApiClientError } from "@site-secure/api-client";
import { Button, Select, Status } from "@site-secure/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ErrorState, Input, ModuleScaffold, useMutation, useQuery } from "../../../components/modules/ModuleKit";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import { useSession } from "../../../lib/session";
import { WarrantyDocumentView } from "../../../components/warranties/WarrantyDocumentView";
import {
  WARRANTY_DISCLAIMER,
  readWarrantyPolicy,
} from "../../../lib/warranty-document";
import {
  WARRANTY_STATUSES,
  WARRANTY_TYPES,
  warrantyStatusLabel,
  warrantyStatusTone,
  warrantyTypeLabel,
} from "../../../lib/warranties";

export const Route = createFileRoute("/app/warranties/$warrantyId")({
  component: WarrantyDetailPage,
});

const MANAGERIAL_ROLES = new Set(["owner", "administrator", "manager"]);

function WarrantyDetailPage() {
  return (
    <RequirePermission permission="warranties.view">
      <WarrantyDetailBody />
    </RequirePermission>
  );
}

function WarrantyDetailBody() {
  const { warrantyId } = Route.useParams();
  const { session, api } = useSession();
  const queryClient = useQueryClient();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const features = membership?.features ?? [];
  const roleKey = membership?.role_key;
  const canEdit =
    Boolean(roleKey && MANAGERIAL_ROLES.has(roleKey)) &&
    can(roleKey, "warranties.issue", features);

  const [status, setStatus] = useState<string | null>(null);
  const [startsOn, setStartsOn] = useState<string | null>(null);
  const [endsOn, setEndsOn] = useState<string | null>(null);
  const [warrantyType, setWarrantyType] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["warranty", workspaceId, warrantyId],
    enabled: Boolean(workspaceId && warrantyId),
    queryFn: () => api.getWarranty(workspaceId!, warrantyId),
  });

  const patch = useMutation({
    mutationFn: () => {
      const row = detailQuery.data!;
      return api.patchWarranty(workspaceId!, warrantyId, {
        status: (status ?? row.status) || undefined,
        starts_on: (startsOn ?? row.starts_on) || undefined,
        ends_on: (endsOn ?? row.ends_on) || undefined,
        type: (warrantyType ?? row.type) || undefined,
      });
    },
    onSuccess: (row) => {
      setFormError(null);
      setStatus(null);
      setStartsOn(null);
      setEndsOn(null);
      setWarrantyType(null);
      void queryClient.setQueryData(["warranty", workspaceId, warrantyId], row);
      void queryClient.invalidateQueries({ queryKey: ["warranties", workspaceId] });
    },
    onError: (err) => setFormError(err instanceof ApiClientError ? err.message : he.warrantiesError),
  });

  if (!workspaceId) return <ErrorState title={he.warrantiesDetailError} />;
  if (detailQuery.isError) {
    return (
      <ErrorState
        title={he.warrantiesDetailError}
        action={
          <Button type="button" variant="secondary" onClick={() => void detailQuery.refetch()}>
            {he.retry}
          </Button>
        }
      />
    );
  }
  if (detailQuery.isLoading || !detailQuery.data) {
    return <ErrorState title={he.loading} />;
  }

  const row = detailQuery.data;
  const policy = readWarrantyPolicy(row.policy);
  const product = [row.equipment_manufacturer, row.equipment_model, row.equipment_name]
    .filter(Boolean)
    .join(" · ");

  return (
    <ModuleScaffold
      title={row.number}
      lead={he.warrantiesLead}
      action={
        <Link
          to="/app/warranties"
          search={{ customer: "", edit: "" }}
          className="text-sm text-action hover:underline"
        >
          {he.warrantiesDetailBack}
        </Link>
      }
    >
      {policy?.sections.length ? (
        <div className="warranty-print-root">
          <div className="mb-3 flex justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                document.body.classList.add("warranty-printing");
                window.addEventListener(
                  "afterprint",
                  () => document.body.classList.remove("warranty-printing"),
                  { once: true },
                );
                window.print();
              }}
            >
              הורדת PDF
            </Button>
          </div>
          <WarrantyDocumentView
            businessName={membership?.workspace_name ?? ""}
            customerName={row.customer_name || ""}
            subject={policy.subject_label || row.title || product || ""}
            number={row.number}
            startsOn={row.starts_on}
            endsOn={row.ends_on}
            sections={policy.sections}
            qrValue={`${window.location.origin}/app/warranties/${row.id}`}
          />
          {policy.versions.length > 0 ? (
            <section className="warranty-versions">
              <h3>היסטוריית גרסאות</h3>
              <ul>
                {policy.versions.map((version) => (
                  <li key={`${version.version}-${version.at}`}>
                    Version {version.version} · {version.summary} · {version.actor} · {version.at.slice(0, 10)}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <p className="warranty-disclaimer">{WARRANTY_DISCLAIMER}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2" data-testid="warranty-detail">
        <Status label={warrantyStatusLabel(row.status)} tone={warrantyStatusTone(row.status)} />
        <span className="text-xs text-fg-muted">{warrantyTypeLabel(row.type)}</span>
      </div>

      <dl className="divide-y divide-border rounded-md border border-border">
        {[
          [he.pickCustomer, row.customer_name || "—"],
          [he.pickSite, row.site_name || "—"],
          [he.warrantiesPickEquipment, product || he.warrantiesPickEquipmentNone],
          [he.equipmentSerial, row.equipment_serial || "—"],
          [he.catalogManufacturer, row.equipment_manufacturer || "—"],
          [he.catalogModel, row.equipment_model || "—"],
          [he.startsOn, row.starts_on],
          [he.endsOn, row.ends_on],
        ].map(([label, value]) => (
          <div key={String(label)} className="flex justify-between gap-4 px-3 py-3 text-sm">
            <dt className="text-fg-muted">{label}</dt>
            <dd
              className={
                label === he.equipmentSerial || label === he.startsOn || label === he.endsOn
                  ? "ltr-meta font-medium text-fg"
                  : "font-medium text-fg"
              }
              dir={label === he.equipmentSerial ? "ltr" : undefined}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {canEdit ? (
        <form
          className="ss-module-create"
          onSubmit={(ev: FormEvent) => {
            ev.preventDefault();
            patch.mutate();
          }}
        >
          <p className="text-xs text-fg-muted">{he.warrantiesEditHint}</p>
          <Select
            id="wd-status"
            label={he.status}
            value={status ?? row.status}
            onChange={(ev) => setStatus(ev.target.value)}
          >
            {WARRANTY_STATUSES.map((key) => (
              <option key={key} value={key}>
                {warrantyStatusLabel(key)}
              </option>
            ))}
          </Select>
          <Select
            id="wd-type"
            label={he.warrantiesType}
            value={warrantyType ?? row.type}
            onChange={(ev) => setWarrantyType(ev.target.value)}
          >
            {WARRANTY_TYPES.map((key) => (
              <option key={key} value={key}>
                {warrantyTypeLabel(key)}
              </option>
            ))}
          </Select>
          <Input
            id="wd-start"
            label={he.startsOn}
            type="date"
            value={startsOn ?? row.starts_on}
            onChange={(ev) => setStartsOn(ev.target.value)}
          />
          <Input
            id="wd-end"
            label={he.endsOn}
            type="date"
            value={endsOn ?? row.ends_on}
            onChange={(ev) => setEndsOn(ev.target.value)}
          />
          {formError ? <p className="text-sm text-danger">{formError}</p> : null}
          <Button type="submit" disabled={patch.isPending}>
            {patch.isPending ? he.saving : he.warrantiesSaveDates}
          </Button>
        </form>
      ) : null}
    </ModuleScaffold>
  );
}
