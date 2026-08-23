import type { CatalogProduct, LeadOut } from "@site-secure/api-client";
import { Button, Input, Select } from "@site-secure/ui";
import { useEffect, useMemo, useState } from "react";
import { QuoteFlowSheet } from "../quote-creation/QuoteFlowSheet";
import { he } from "../../../i18n/he";
import { formatMoney } from "../../../lib/quotes";
import {
  buildCctvRecommendation,
  defaultCctvInputFromLead,
  type CctvBuilderInput,
  type SystemBuilderLine,
  type SystemBuilderType,
} from "../../../lib/system-builder";

export function SystemBuilderDrawer({
  open,
  onClose,
  lead,
  catalog,
  currency,
  catalogLoading,
  onRequestCatalog,
  onAddLines,
}: {
  open: boolean;
  onClose: () => void;
  lead?: LeadOut | null;
  catalog: CatalogProduct[];
  currency: string;
  catalogLoading?: boolean;
  onRequestCatalog: () => void;
  onAddLines: (lines: SystemBuilderLine[]) => void;
}) {
  const [systemType, setSystemType] = useState<SystemBuilderType>("cctv");
  const [input, setInput] = useState<CctvBuilderInput>(() =>
    defaultCctvInputFromLead({
      cameraCount: lead?.requirements?.camera_count,
      recording: lead?.requirements?.recording,
      remoteViewing: lead?.requirements?.remote_viewing,
      infrastructure: lead?.requirements?.infrastructure,
    }),
  );
  const [plan, setPlan] = useState<SystemBuilderLine[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setPlan(null);
    setSystemType("cctv");
    setInput(
      defaultCctvInputFromLead({
        cameraCount: lead?.requirements?.camera_count,
        recording: lead?.requirements?.recording,
        remoteViewing: lead?.requirements?.remote_viewing,
        infrastructure: lead?.requirements?.infrastructure,
      }),
    );
    onRequestCatalog();
  }, [open, lead, onRequestCatalog]);

  const recommendation = useMemo(() => {
    if (systemType !== "cctv") return [];
    return buildCctvRecommendation(input, catalog);
  }, [systemType, input, catalog]);

  return (
    <QuoteFlowSheet
      open={open}
      onClose={onClose}
      title={he.cpqBuildSystem}
      subtitle={he.cpqBuildSystemLead}
      variant="sheet"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {he.cancel}
          </Button>
          {plan ? (
            <>
              <Button type="button" variant="secondary" onClick={() => setPlan(null)}>
                {he.cpqAdjustPlan}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onAddLines(plan.filter((line) => line.configured && line.product));
                  onClose();
                }}
                disabled={!plan.some((line) => line.configured && line.product)}
              >
                {he.cpqAddPlanToQuote}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              disabled={systemType !== "cctv"}
              onClick={() => setPlan(recommendation)}
            >
              {he.cpqShowRecommendation}
            </Button>
          )}
        </div>
      }
    >
      <div className="grid gap-4">
        <Select
          id="cpq-system-type"
          label={he.cpqSystemType}
          value={systemType}
          onChange={(ev) => setSystemType(ev.target.value as SystemBuilderType)}
        >
          <option value="cctv">{he.leadServiceTypes.cctv}</option>
          <option value="alarm">{he.leadServiceTypes.alarm}</option>
          <option value="access_control">{he.leadServiceTypes.access_control}</option>
          <option value="intercom">{he.leadServiceTypes.intercom}</option>
          <option value="network">{he.cpqSystemNetwork}</option>
          <option value="low_voltage">{he.leadServiceTypes.low_voltage}</option>
          <option value="combined">{he.cpqSystemCombined}</option>
        </Select>

        {systemType !== "cctv" ? (
          <p className="text-sm text-fg-muted">{he.cpqSystemTypeSoon}</p>
        ) : (
          <div className="grid gap-3">
            <Input
              id="cpq-camera-count"
              label={he.leadsReqCamerasLabel}
              value={String(input.cameraCount || "")}
              onChange={(ev) =>
                setInput({ ...input, cameraCount: Number(ev.target.value.replace(/\D/g, "") || 0) })
              }
              inputMode="numeric"
            />
            <Select
              id="cpq-camera-type"
              label={he.cpqCameraType}
              value={input.cameraType}
              onChange={(ev) => setInput({ ...input, cameraType: ev.target.value as CctvBuilderInput["cameraType"] })}
            >
              <option value="mixed">{he.cpqCameraMixed}</option>
              <option value="dome">{he.cpqCameraDome}</option>
              <option value="bullet">{he.cpqCameraBullet}</option>
            </Select>
            <ToggleRow
              label={he.cpqNeedRecorder}
              checked={input.needsRecorder}
              onChange={(checked) => setInput({ ...input, needsRecorder: checked })}
            />
            <ToggleRow
              label={he.leadsReqRecording}
              checked={input.needsStorage}
              onChange={(checked) => setInput({ ...input, needsStorage: checked })}
            />
            <ToggleRow
              label={he.cpqNeedPoe}
              checked={input.needsPoe}
              onChange={(checked) => setInput({ ...input, needsPoe: checked })}
            />
            <ToggleRow
              label={he.cpqNeedCabling}
              checked={input.needsCabling}
              onChange={(checked) => setInput({ ...input, needsCabling: checked })}
            />
            <ToggleRow
              label={he.cpqNeedInstall}
              checked={input.needsInstallation}
              onChange={(checked) => setInput({ ...input, needsInstallation: checked })}
            />
            <ToggleRow
              label={he.leadsReqRemote}
              checked={input.needsRemote}
              onChange={(checked) => setInput({ ...input, needsRemote: checked })}
            />
          </div>
        )}

        {catalogLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}

        {plan ? (
          <div className="grid gap-2">
            <p className="text-sm font-semibold text-fg">{he.cpqRecommendedConfig}</p>
            <p className="text-xs text-fg-muted">{he.cpqRecommendHint}</p>
            {plan.map((line) => (
              <div key={line.role} className="rounded-[var(--radius-control)] border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-fg">
                      {line.qty} × {line.label}
                    </p>
                    <p className="mt-0.5 text-xs text-fg-muted">{line.reason}</p>
                  </div>
                  {line.configured && line.product ? (
                    <p className="text-sm text-fg-muted">
                      {formatMoney(line.product.selling_price ?? line.product.list_price, currency)}
                    </p>
                  ) : (
                    <p className="text-sm text-warning">{he.cpqNotConfigured}</p>
                  )}
                </div>
                {line.product ? (
                  <p className="mt-1 text-xs text-fg-muted">
                    {line.product.name}
                    {line.product.sku ? ` · ${line.product.sku}` : ""}
                  </p>
                ) : null}
              </div>
            ))}
            <Button type="button" variant="ghost" onClick={onClose}>
              {he.cpqIgnorePlan}
            </Button>
          </div>
        ) : null}
      </div>
    </QuoteFlowSheet>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border px-3 py-2 text-sm">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(ev) => onChange(ev.target.checked)} />
    </label>
  );
}
