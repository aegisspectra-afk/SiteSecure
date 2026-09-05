/**
 * Task 13D — Build System V1 product integration.
 *
 * Flow: requirements → POST /cctv/recommend → review → quote projection.
 * CCTV sizing is server-authoritative. Do not call legacy keyword matching here.
 */

import { ApiClientError, type ApiClient, type LeadOut, type SystemRecommendation } from "@site-secure/api-client";
import { Button, Input, Select } from "@site-secure/ui";
import { useEffect, useMemo, useState } from "react";
import { QuoteFlowSheet } from "../quote-creation/QuoteFlowSheet";
import { he } from "../../../i18n/he";
import {
  defaultCctvBuildRequirements,
  requirementsToRecommendBody,
  validateCctvBuildRequirements,
  type CctvBuildRequirements,
} from "../../../lib/cctv-build-requirements";
import {
  buildEngineeringSummary,
  compactCompatibilityLines,
  confidenceLabelHe,
  formatReasonHe,
  groupComponents,
  roleLabelHe,
} from "../../../lib/cctv-recommend-copy";
import {
  canAddRecommendationToQuote,
  componentKindLabel,
  initialReviewSelection,
  isCandidateSelectable,
  resolveComponentProduct,
  type CctvBuildQuoteLine,
  type PartialApplyRecovery,
  type ReviewSelectionState,
} from "../../../lib/cctv-recommend-projection";
import type { SystemBuilderType } from "../../../lib/system-builder";

type Step = "requirements" | "loading" | "review";

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  api: ApiClient;
  lead?: LeadOut | null;
  applying?: boolean;
  applyError?: string | null;
  recovery?: PartialApplyRecovery | null;
  onApply: (lines: CctvBuildQuoteLine[], opts?: { resume?: PartialApplyRecovery }) => void | Promise<void>;
  onClearRecovery?: () => void;
};

export function SystemBuilderDrawer({
  open,
  onClose,
  workspaceId,
  api,
  lead,
  applying = false,
  applyError = null,
  recovery = null,
  onApply,
  onClearRecovery,
}: Props) {
  const [systemType, setSystemType] = useState<SystemBuilderType>("cctv");
  const [step, setStep] = useState<Step>("requirements");
  const [req, setReq] = useState<CctvBuildRequirements>(() =>
    defaultCctvBuildRequirements({
      cameraCount: lead?.requirements?.camera_count,
      recording: lead?.requirements?.recording,
      remoteViewing: lead?.requirements?.remote_viewing,
      infrastructure: lead?.requirements?.infrastructure,
      location: lead?.requirements?.location,
    }),
  );
  const [inputError, setInputError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<SystemRecommendation | null>(null);
  const [selection, setSelection] = useState<ReviewSelectionState>({
    selectedByRole: {},
    removedRoles: new Set(),
  });
  const [swapRole, setSwapRole] = useState<string | null>(null);
  const [appliedOnce, setAppliedOnce] = useState(false);
  const [lastLines, setLastLines] = useState<CctvBuildQuoteLine[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("requirements");
    setSystemType("cctv");
    setRecommendation(null);
    setInputError(null);
    setServerError(null);
    setSwapRole(null);
    setAppliedOnce(false);
    setLastLines(null);
    setSelection({ selectedByRole: {}, removedRoles: new Set() });
    setReq(
      defaultCctvBuildRequirements({
        cameraCount: lead?.requirements?.camera_count,
        recording: lead?.requirements?.recording,
        remoteViewing: lead?.requirements?.remote_viewing,
        infrastructure: lead?.requirements?.infrastructure,
        location: lead?.requirements?.location,
      }),
    );
  }, [open, lead]);

  const addGate = useMemo(() => {
    if (!recommendation) return { ok: false as const, reason: "empty" as const };
    return canAddRecommendationToQuote(recommendation, selection);
  }, [recommendation, selection]);

  async function calculate() {
    if (systemType !== "cctv") return;
    const validation = validateCctvBuildRequirements(req);
    if (!validation.ok) {
      setInputError(
        validation.messageKey === "cameras"
          ? he.cpqCctvErrCameras
          : validation.messageKey === "retention"
            ? he.cpqCctvErrRetention
            : validation.messageKey === "hours"
              ? he.cpqCctvErrHours
              : he.cpqCctvErrResolution,
      );
      setServerError(null);
      return;
    }
    setInputError(null);
    setServerError(null);
    setStep("loading");
    onClearRecovery?.();
    setAppliedOnce(false);
    setLastLines(null);
    try {
      const body = requirementsToRecommendBody(req);
      const rec = await api.recommendCctv(workspaceId, body);
      setRecommendation(rec);
      setSelection(initialReviewSelection(rec));
      setStep("review");
    } catch (err) {
      setRecommendation(null);
      setStep("requirements");
      setServerError(err instanceof ApiClientError ? err.message : he.cpqCctvServerError);
    }
  }

  async function handleAdd(resume?: PartialApplyRecovery | null) {
    if (!addGate.ok || applying) return;
    if (appliedOnce && !resume) return;
    if (!resume) setAppliedOnce(true);
    setLastLines(addGate.lines);
    try {
      await onApply(addGate.lines, resume ? { resume } : undefined);
    } catch {
      if (!resume) setAppliedOnce(false);
    }
  }

  const footer =
    step === "review" && recommendation ? (
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setStep("requirements");
            setRecommendation(null);
            setAppliedOnce(false);
            setLastLines(null);
            onClearRecovery?.();
          }}
          disabled={applying}
        >
          {he.cpqAdjustPlan}
        </Button>
        {recovery && lastLines ? (
          <Button
            type="button"
            onClick={() => void handleAdd(recovery)}
            disabled={applying}
            aria-busy={applying}
          >
            {applying ? he.cpqCctvApplying : he.cpqCctvResumeApply}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => void handleAdd(null)}
            disabled={!addGate.ok || applying || appliedOnce}
            aria-busy={applying}
          >
            {applying ? he.cpqCctvApplying : he.cpqAddPlanToQuote}
          </Button>
        )}
      </div>
    ) : step === "loading" ? (
      <div className="flex justify-end">
        <Button type="button" variant="secondary" disabled>
          {he.cpqCctvPlanning}
        </Button>
      </div>
    ) : (
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          {he.cancel}
        </Button>
        <Button type="button" disabled={systemType !== "cctv"} onClick={() => void calculate()}>
          {he.cpqCctvCalculate}
        </Button>
      </div>
    );

  return (
    <QuoteFlowSheet
      open={open}
      onClose={() => {
        if (applying) return;
        onClose();
      }}
      title={he.cpqBuildSystem}
      subtitle={he.cpqBuildSystemLead}
      variant="sheet"
      footer={footer}
    >
      <div className="grid gap-4">
        {step === "requirements" || step === "loading" ? (
          <>
            <Select
              id="cpq-system-type"
              label={he.cpqSystemType}
              value={systemType}
              onChange={(ev) => setSystemType(ev.target.value as SystemBuilderType)}
              disabled={step === "loading"}
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
            ) : step === "loading" ? (
              <p className="text-sm text-fg" role="status" aria-live="polite">
                {he.cpqCctvPlanning}
              </p>
            ) : (
              <RequirementsForm req={req} setReq={setReq} inputError={inputError} />
            )}

            {serverError ? (
              <p className="text-sm text-danger" role="alert">
                {serverError}
              </p>
            ) : null}
          </>
        ) : null}

        {step === "review" && recommendation ? (
          <RecommendationReview
            rec={recommendation}
            selection={selection}
            setSelection={setSelection}
            swapRole={swapRole}
            setSwapRole={setSwapRole}
            addBlocked={!addGate.ok}
            applyError={applyError}
          />
        ) : null}
      </div>
    </QuoteFlowSheet>
  );
}

function RequirementsForm({
  req,
  setReq,
  inputError,
}: {
  req: CctvBuildRequirements;
  setReq: (next: CctvBuildRequirements) => void;
  inputError: string | null;
}) {
  return (
    <div className="grid gap-3">
      <Input
        id="cpq-camera-count"
        label={he.leadsReqCamerasLabel}
        value={String(req.cameraCount || "")}
        onChange={(ev) =>
          setReq({ ...req, cameraCount: Number(ev.target.value.replace(/\D/g, "") || 0) })
        }
        inputMode="numeric"
      />
      <Select
        id="cpq-environment"
        label={he.cpqCctvEnvironment}
        value={req.environment}
        onChange={(ev) =>
          setReq({ ...req, environment: ev.target.value as CctvBuildRequirements["environment"] })
        }
      >
        <option value="outdoor">{he.leadsReqLocationOutdoor}</option>
        <option value="indoor">{he.leadsReqLocationIndoor}</option>
        <option value="indoor_outdoor">{he.leadsReqLocationBoth}</option>
      </Select>
      <Select
        id="cpq-resolution"
        label={he.cpqCctvResolution}
        value={String(req.resolutionMp)}
        onChange={(ev) => setReq({ ...req, resolutionMp: Number(ev.target.value) })}
      >
        <option value="2">2MP</option>
        <option value="4">4MP</option>
        <option value="5">5MP</option>
        <option value="8">8MP</option>
        <option value="12">12MP</option>
      </Select>
      <Input
        id="cpq-retention"
        label={he.cpqCctvRetention}
        value={String(req.retentionDays || "")}
        onChange={(ev) =>
          setReq({ ...req, retentionDays: Number(ev.target.value.replace(/\D/g, "") || 0) })
        }
        inputMode="numeric"
      />
      <Select
        id="cpq-recording-mode"
        label={he.cpqCctvRecordingMode}
        value={req.recordingMode}
        onChange={(ev) =>
          setReq({
            ...req,
            recordingMode: ev.target.value as CctvBuildRequirements["recordingMode"],
          })
        }
      >
        <option value="continuous">{he.cpqCctvModeContinuous}</option>
        <option value="scheduled">{he.cpqCctvModeScheduled}</option>
        <option value="motion">{he.cpqCctvModeMotion}</option>
      </Select>
      <ToggleRow
        label={he.cpqNeedPoe}
        checked={req.poeRequired}
        onChange={(checked) => setReq({ ...req, poeRequired: checked })}
      />
      <ToggleRow
        label={he.cpqNeedInstall}
        checked={req.installationRequested}
        onChange={(checked) => setReq({ ...req, installationRequested: checked })}
      />

      <button
        type="button"
        className="justify-self-start text-sm text-fg-muted underline"
        onClick={() => setReq({ ...req, showAdvanced: !req.showAdvanced })}
        aria-expanded={req.showAdvanced}
      >
        {req.showAdvanced ? he.cpqCctvHideAdvanced : he.cpqCctvShowAdvanced}
      </button>

      {req.showAdvanced ? (
        <div className="grid gap-3 rounded-[var(--radius-control)] border border-border p-3">
          <Select
            id="cpq-form-factor"
            label={he.cpqCameraType}
            value={req.formFactor}
            onChange={(ev) =>
              setReq({ ...req, formFactor: ev.target.value as CctvBuildRequirements["formFactor"] })
            }
          >
            <option value="">{he.cpqCameraMixed}</option>
            <option value="dome">{he.cpqCameraDome}</option>
            <option value="bullet">{he.cpqCameraBullet}</option>
            <option value="turret">Turret</option>
            <option value="ptz">PTZ</option>
          </Select>
          <Input
            id="cpq-fps"
            label="FPS"
            value={req.fps}
            onChange={(ev) => setReq({ ...req, fps: ev.target.value })}
            inputMode="decimal"
          />
          <Select
            id="cpq-codec"
            label="Codec"
            value={req.codec}
            onChange={(ev) =>
              setReq({ ...req, codec: ev.target.value as CctvBuildRequirements["codec"] })
            }
          >
            <option value="">ברירת מחדל הנדסית</option>
            <option value="h265">H.265</option>
            <option value="h264">H.264</option>
          </Select>
          <Input
            id="cpq-bitrate"
            label={he.cpqCctvBitrateOverride}
            value={req.bitrateMbpsOverride}
            onChange={(ev) => setReq({ ...req, bitrateMbpsOverride: ev.target.value })}
            inputMode="decimal"
          />
          {req.recordingMode === "scheduled" ? (
            <Input
              id="cpq-hours"
              label={he.cpqCctvRecordingHours}
              value={req.recordingHoursPerDay}
              onChange={(ev) => setReq({ ...req, recordingHoursPerDay: ev.target.value })}
              inputMode="decimal"
            />
          ) : null}
          {req.recordingMode === "motion" ? (
            <Input
              id="cpq-duty"
              label={he.cpqCctvMotionDuty}
              value={req.motionDutyCycle}
              onChange={(ev) => setReq({ ...req, motionDutyCycle: ev.target.value })}
              inputMode="decimal"
            />
          ) : null}
          <Input
            id="cpq-headroom"
            label={he.cpqCctvHeadroom}
            value={req.expansionHeadroomPercent}
            onChange={(ev) => setReq({ ...req, expansionHeadroomPercent: ev.target.value })}
            inputMode="decimal"
          />
          <Input
            id="cpq-mfr"
            label={he.cpqCctvManufacturerPref}
            value={req.manufacturerPreference}
            onChange={(ev) => setReq({ ...req, manufacturerPreference: ev.target.value })}
          />
          <Input
            id="cpq-cable-m"
            label={he.cpqCctvCableMeters}
            value={req.cableDistanceMeters}
            onChange={(ev) => setReq({ ...req, cableDistanceMeters: ev.target.value })}
            inputMode="decimal"
          />
          <Input
            id="cpq-cam-power"
            label={he.cpqCctvCameraPower}
            value={req.cameraMaxPowerW}
            onChange={(ev) => setReq({ ...req, cameraMaxPowerW: ev.target.value })}
            inputMode="decimal"
          />
          <Select
            id="cpq-arch"
            label={he.cpqCctvArchitecture}
            value={req.architectureIntent}
            onChange={(ev) =>
              setReq({
                ...req,
                architectureIntent: ev.target.value as CctvBuildRequirements["architectureIntent"],
              })
            }
          >
            <option value="prefer_nvr_integrated">{he.cpqCctvArchIntegrated}</option>
            <option value="prefer_external_switch">{he.cpqCctvArchExternal}</option>
            <option value="unknown">{he.cpqCctvArchUnknown}</option>
          </Select>
          <ToggleRow
            label={he.leadsReqRemote}
            checked={req.remoteViewing}
            onChange={(checked) => setReq({ ...req, remoteViewing: checked })}
          />
          <ToggleRow
            label={he.cpqCctvUps}
            checked={req.upsRequested}
            onChange={(checked) => setReq({ ...req, upsRequested: checked })}
          />
          <ToggleRow
            label={he.cpqCctvCommissioning}
            checked={req.commissioningRequested}
            onChange={(checked) => setReq({ ...req, commissioningRequested: checked })}
          />
        </div>
      ) : null}

      {inputError ? (
        <p className="text-sm text-danger" role="alert">
          {inputError}
        </p>
      ) : null}
    </div>
  );
}

function RecommendationReview({
  rec,
  selection,
  setSelection,
  swapRole,
  setSwapRole,
  addBlocked,
  applyError,
}: {
  rec: SystemRecommendation;
  selection: ReviewSelectionState;
  setSelection: (next: ReviewSelectionState) => void;
  swapRole: string | null;
  setSwapRole: (role: string | null) => void;
  addBlocked: boolean;
  applyError: string | null;
}) {
  const summary = buildEngineeringSummary(rec);
  const groups = groupComponents(
    rec.components.filter((c) => !selection.removedRoles.has(c.role)),
  );
  const assumptions = [...(rec.assumptions || []), ...(rec.warnings || [])].filter(
    (r, i, arr) => arr.findIndex((x) => x.code === r.code) === i,
  );
  const readiness = (rec as { catalog_readiness?: {
    empty_catalog?: boolean;
    ready_for_core?: boolean;
    missing_families?: string[];
  } }).catalog_readiness;

  return (
    <div className="grid gap-4">
      {readiness?.empty_catalog ? (
        <div className="rounded-[var(--radius-control)] border border-warning/40 bg-warning/10 p-3" role="status">
          <p className="text-sm font-semibold text-fg">{he.cpqCctvCatalogReadiness}</p>
          <p className="mt-1 text-xs text-fg-muted">{he.cpqCctvCatalogEmpty}</p>
        </div>
      ) : readiness && !readiness.ready_for_core ? (
        <div className="rounded-[var(--radius-control)] border border-border p-3" role="status">
          <p className="text-sm font-semibold text-fg">{he.cpqCctvCatalogReadiness}</p>
          <p className="mt-1 text-xs text-fg-muted">{he.cpqCctvCatalogIncomplete}</p>
        </div>
      ) : null}

      <section className="rounded-[var(--radius-control)] border border-border bg-surface-muted/40 p-3">
        <p className="text-sm font-semibold text-fg">
          {he.cpqCctvSummaryTitle(summary.cameraCount)}
        </p>
        <ul className="mt-2 grid gap-1 text-sm text-fg-muted">
          {summary.channelTier != null ? (
            <li>
              {he.cpqCctvSummaryNvr}: {summary.channelTier} {he.cpqCctvChannels}
            </li>
          ) : null}
          {summary.requiredTb != null ? (
            <li>
              {he.cpqCctvSummaryStorage}: ≈{summary.requiredTb.toFixed(1)}TB
              {summary.hddPacking ? ` · ${summary.hddPacking}` : ""}
            </li>
          ) : null}
          {summary.poePorts != null ? (
            <li>
              {he.cpqCctvSummaryPoe}: {summary.poePorts} {he.cpqCctvPorts}
              {summary.poeBudgetW != null ? ` · ≥${Math.round(summary.poeBudgetW)}W` : ""}
            </li>
          ) : null}
          <li>
            {he.cpqCctvSummaryArch}:{" "}
            {summary.architecture === "external_switch"
              ? he.cpqCctvArchExternalShort
              : summary.architecture === "integrated"
                ? he.cpqCctvArchIntegratedShort
                : he.cpqCctvArchUnknown}
          </li>
        </ul>
      </section>

      {addBlocked ? (
        <div className="rounded-[var(--radius-control)] border border-warning/40 bg-warning/10 p-3" role="alert">
          <p className="text-sm font-semibold text-fg">{he.cpqCctvCannotComplete}</p>
          <p className="mt-1 text-xs text-fg-muted">{he.cpqCctvCannotCompleteHint}</p>
        </div>
      ) : null}

      {applyError ? (
        <p className="text-sm text-danger" role="alert">
          {applyError}
        </p>
      ) : null}

      {assumptions.length ? (
        <section>
          <p className="text-sm font-semibold text-fg">{he.cpqCctvAssumptions}</p>
          <ul className="mt-1 list-disc pr-5 text-xs text-fg-muted">
            {assumptions.slice(0, 8).map((a) => (
              <li key={a.code}>{formatReasonHe(a)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {groups.map((group) => (
        <section key={group.id} className="grid gap-2">
          <h3 className="text-sm font-semibold text-fg">{group.label}</h3>
          {group.components.map((component) => {
            const kind = componentKindLabel(component);
            const picked = resolveComponentProduct(component, selection);
            const selectableCandidates = component.candidates.filter(isCandidateSelectable);
            const textAssisted = component.candidates.filter((c) => c.confidence === "TEXT_ASSISTED");
            const openSwap = swapRole === component.role;
            const specs = compactCompatibilityLines(
              picked?.compatibility ?? component.selected_compatibility,
            );

            return (
              <article
                key={component.role}
                className="rounded-[var(--radius-control)] border border-border p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-fg">
                      {roleLabelHe(component.role)}
                      {component.quantity > 1 ? ` · ×${component.quantity}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-fg-muted">
                      {kind === "CORE"
                        ? he.cpqCctvKindCore
                        : kind === "OPTIONAL"
                          ? he.cpqCctvKindOptional
                          : he.cpqCctvKindManual}
                      {picked?.confidence
                        ? ` · ${confidenceLabelHe(picked.confidence)}`
                        : ` · ${he.cpqCctvNeedsManual}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {component.optional ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          const removed = new Set(selection.removedRoles);
                          removed.add(component.role);
                          setSelection({ ...selection, removedRoles: removed });
                        }}
                      >
                        {he.cpqCctvRemoveOptional}
                      </Button>
                    ) : null}
                    {selectableCandidates.length > 1 ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setSwapRole(openSwap ? null : component.role)}
                      >
                        {he.cpqCctvReplace}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {picked ? (
                  <div className="mt-2">
                    <p className="text-sm text-fg">{picked.product.name}</p>
                    <p className="text-xs text-fg-muted">
                      {[picked.product.manufacturer, picked.product.model, picked.product.sku]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {specs.length ? (
                      <p className="mt-1 text-xs text-fg-muted">✓ {specs.join(" · ")}</p>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-2">
                    <p className="text-sm text-warning">{he.cpqCctvNoStructuredProduct}</p>
                    {component.role === "recorder" && summary.channelTier != null ? (
                      <p className="mt-1 text-xs text-fg-muted">
                        {he.cpqCctvNeedNvrChannels(summary.channelTier)}
                      </p>
                    ) : null}
                  </div>
                )}

                {(component.reason_codes || []).slice(0, 2).map((r) => (
                  <p key={r.code} className="mt-1 text-xs text-fg-muted">
                    {formatReasonHe(r)}
                  </p>
                ))}

                {openSwap ? (
                  <div className="mt-2 grid gap-2 border-t border-border pt-2">
                    <p className="text-xs font-medium text-fg">{he.cpqCctvCandidates}</p>
                    {selectableCandidates.map((cand) => (
                      <label
                        key={cand.product.id}
                        className="flex cursor-pointer items-start gap-2 rounded-[var(--radius-control)] border border-border px-2 py-2 text-sm"
                      >
                        <input
                          type="radio"
                          name={`swap-${component.role}`}
                          checked={selection.selectedByRole[component.role] === cand.product.id}
                          onChange={() =>
                            setSelection({
                              ...selection,
                              selectedByRole: {
                                ...selection.selectedByRole,
                                [component.role]: cand.product.id,
                              },
                            })
                          }
                        />
                        <span>
                          <span className="block font-medium">{cand.product.name}</span>
                          <span className="block text-xs text-fg-muted">
                            {confidenceLabelHe(cand.confidence)}
                            {cand.confidence === "TEXT_ASSISTED" ? ` — ${he.cpqCctvNeedsVerify}` : ""}
                          </span>
                        </span>
                      </label>
                    ))}
                    {textAssisted.length ? (
                      <p className="text-xs text-fg-muted">{he.cpqCctvTextAssistedHint}</p>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      ))}
    </div>
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
