import { Button, Input, Select } from "@site-secure/ui";
import { ApiClientError } from "@site-secure/api-client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { he } from "../../i18n/he";
import { useSession } from "../../lib/session";

export function CatalogBulkPricing({
  open,
  onClose,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
}) {
  const { session, api } = useSession();
  const workspaceId = session?.memberships[0]?.workspace_id;
  const [mode, setMode] = useState<"markup_percent" | "multiplier">("markup_percent");
  const [value, setValue] = useState("30");
  const [manufacturer, setManufacturer] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    will_update: number;
    sample: Array<{ sku: string | null; name: string | null; cost: number; list_price_after: number }>;
  } | null>(null);

  const run = useMutation({
    mutationFn: (dry_run: boolean) =>
      api.bulkCatalogPricing(workspaceId!, {
        mode,
        value: Number(value),
        only_missing_list_price: onlyMissing,
        manufacturer: manufacturer.trim() || null,
        dry_run,
      }),
    onSuccess: (data, dry_run) => {
      setError(null);
      if (dry_run) {
        setPreview({ will_update: data.will_update, sample: data.sample });
        return;
      }
      setPreview(null);
      onApplied();
      onClose();
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : he.catalogImportError);
    },
  });

  if (!open || !workspaceId) return null;

  return (
    <div className="ops-card flex flex-col gap-3 p-4">
      <div>
        <h3 className="text-base font-semibold text-fg">{he.catalogBulkPricingTitle}</h3>
        <p className="mt-1 text-sm text-fg-muted">{he.catalogBulkPricingBody}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          id="bulk-mode"
          label={he.catalogBulkPricingMode}
          value={mode}
          onChange={(ev) => setMode(ev.target.value as typeof mode)}
        >
          <option value="markup_percent">{he.catalogBulkMarkupPercent}</option>
          <option value="multiplier">{he.catalogBulkMultiplier}</option>
        </Select>
        <Input
          id="bulk-value"
          label={he.catalogBulkValue}
          type="number"
          value={value}
          onChange={(ev) => setValue(ev.target.value)}
        />
        <Input
          id="bulk-mfr"
          label={he.catalogBulkManufacturer}
          value={manufacturer}
          onChange={(ev) => setManufacturer(ev.target.value)}
          placeholder="UNIVIEW"
        />
        <label className="flex items-end gap-2 pb-2 text-sm text-fg">
          <input type="checkbox" checked={onlyMissing} onChange={(ev) => setOnlyMissing(ev.target.checked)} />
          {he.catalogBulkOnlyMissing}
        </label>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {preview ? (
        <div className="rounded-[var(--radius-control)] border border-border bg-bg-1 p-3 text-sm">
          <p className="font-medium text-fg">
            {preview.will_update
              ? he.catalogBulkApply.replace("{n}", String(preview.will_update))
              : he.catalogBulkNone}
          </p>
          {preview.sample.length ? (
            <ul className="mt-2 space-y-1 text-fg-muted">
              {preview.sample.slice(0, 8).map((row) => (
                <li key={`${row.sku}-${row.name}`}>
                  <span className="public-mono">{row.sku}</span> · {row.name} · ₪{row.cost} → ₪
                  {row.list_price_after}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" loading={run.isPending} onClick={() => run.mutate(true)}>
          {he.catalogBulkPreview}
        </Button>
        <Button
          loading={run.isPending}
          disabled={!preview?.will_update}
          onClick={() => run.mutate(false)}
        >
          {he.catalogBulkApply.replace("{n}", String(preview?.will_update ?? 0))}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          {he.catalogCancel}
        </Button>
      </div>
    </div>
  );
}
