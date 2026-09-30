/**
 * SYSTEM-DESIGNER-1 Slice C — Professional Requirements Workspace.
 * Local draft only; Calculate triggers /cctv/recommend (parent).
 */

import { Input, Select } from "@site-secure/ui";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { he } from "../../../i18n/he";
import type { CctvBuildRequirements } from "../../../lib/cctv-build-requirements";
import {
  applyTechnology,
  isProfessionalMode,
  patchCameraCounts,
  siteContextChips,
  visibleSectionsFor,
  withDesignerMode,
  type RequirementsSectionId,
  type SiteContextChip,
} from "../../../lib/cctv-designer-workspace";

type Props = {
  req: CctvBuildRequirements;
  setReq: (next: CctvBuildRequirements) => void;
  inputError: string | null;
  stale: boolean;
  calcState: "draft" | "fresh" | "stale";
  disabled?: boolean;
  siteContext?: {
    customerName?: string | null;
    siteName?: string | null;
    leadLocation?: string | null;
    leadInfra?: string | null;
  };
};

const SECTION_LABEL: Record<RequirementsSectionId, string> = {
  system: he.cpqCctvSectionSystem,
  site: he.cpqCctvSectionSite,
  cameras: he.cpqCctvSectionCameras,
  recording: he.cpqCctvSectionRecording,
  network: he.cpqCctvSectionNetwork,
  power: he.cpqCctvSectionPower,
  infrastructure: he.cpqCctvSectionInfra,
  services: he.cpqCctvSectionServices,
};

function Ltr({ children }: { children: ReactNode }) {
  return (
    <span className="ltr-meta" dir="ltr">
      {children}
    </span>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  name,
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode; hint?: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
  name: string;
}) {
  const labelId = useId();
  return (
    <div className="cpq-cctv-ws-field">
      <p className="cpq-cctv-ws-label" id={labelId}>
        {label}
      </p>
      <div
        className="cpq-cctv-ws-segmented"
        role="radiogroup"
        aria-labelledby={labelId}
      >
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              name={name}
              aria-checked={selected}
              className={selected ? "cpq-cctv-ws-seg is-selected" : "cpq-cctv-ws-seg"}
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              title={opt.hint}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Stepper({
  id,
  label,
  value,
  onChange,
  min = 0,
  max = 512,
  unit,
  disabled,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  unit?: string;
  disabled?: boolean;
}) {
  return (
    <div className="cpq-cctv-ws-field">
      <label className="cpq-cctv-ws-label" htmlFor={id}>
        {label}
        {unit ? (
          <>
            {" "}
            <span className="cpq-cctv-ws-unit" dir="ltr">
              ({unit})
            </span>
          </>
        ) : null}
      </label>
      <div className="cpq-cctv-ws-stepper">
        <button
          type="button"
          className="cpq-cctv-ws-stepper-btn"
          aria-label={he.cpqCctvStepperDec}
          disabled={disabled || value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          −
        </button>
        <input
          id={id}
          className="cpq-cctv-ws-stepper-input"
          dir="ltr"
          inputMode="numeric"
          value={String(value || 0)}
          disabled={disabled}
          onChange={(ev) => {
            const n = Number(ev.target.value.replace(/\D/g, "") || 0);
            onChange(Math.min(max, Math.max(min, n)));
          }}
        />
        <button
          type="button"
          className="cpq-cctv-ws-stepper-btn"
          aria-label={he.cpqCctvStepperInc}
          disabled={disabled || value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          +
        </button>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  disabled,
  hint,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label className="cpq-cctv-ws-toggle">
      <input
        type="checkbox"
        className="cpq-cctv-ws-toggle-input"
        checked={checked}
        disabled={disabled}
        onChange={(ev) => onChange(ev.target.checked)}
      />
      <span className="cpq-cctv-ws-toggle-copy">
        <span className="cpq-cctv-ws-toggle-label">{label}</span>
        {hint ? <span className="cpq-cctv-ws-toggle-hint">{hint}</span> : null}
      </span>
    </label>
  );
}

function UnitInput({
  id,
  label,
  value,
  onChange,
  unit,
  inputMode = "decimal",
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit: string;
  inputMode?: "decimal" | "numeric" | "text";
  disabled?: boolean;
}) {
  return (
    <div className="cpq-cctv-ws-field">
      <label className="cpq-cctv-ws-label" htmlFor={id}>
        {label}
      </label>
      <div className="cpq-cctv-ws-unit-input">
        <input
          id={id}
          className="cpq-cctv-ws-text-input"
          dir="ltr"
          inputMode={inputMode}
          value={value}
          disabled={disabled}
          onChange={(ev) => onChange(ev.target.value)}
        />
        <span className="cpq-cctv-ws-unit-affix" dir="ltr">
          {unit}
        </span>
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  children,
  active,
}: {
  id: RequirementsSectionId;
  title: string;
  children: ReactNode;
  active: boolean;
}) {
  return (
    <section
      id={`cpq-cctv-sec-${id}`}
      className={active ? "cpq-cctv-ws-section is-active" : "cpq-cctv-ws-section"}
      data-section={id}
      aria-labelledby={`cpq-cctv-sec-title-${id}`}
    >
      <h3 className="cpq-cctv-ws-section-title" id={`cpq-cctv-sec-title-${id}`}>
        {title}
      </h3>
      <div className="cpq-cctv-ws-section-body">{children}</div>
    </section>
  );
}

export function CctvRequirementsWorkspace({
  req,
  setReq,
  inputError,
  stale,
  calcState,
  disabled = false,
  siteContext,
}: Props) {
  const pro = isProfessionalMode(req);
  const tech = req.cctvTechnology;
  const sections = visibleSectionsFor(tech);
  const [activeSection, setActiveSection] = useState<RequirementsSectionId>("system");
  const mainRef = useRef<HTMLDivElement>(null);
  const chips: SiteContextChip[] = siteContextChips(siteContext ?? {});

  useEffect(() => {
    if (!sections.includes(activeSection)) {
      setActiveSection(sections[0] ?? "system");
    }
  }, [sections, activeSection]);

  function jumpTo(id: RequirementsSectionId) {
    setActiveSection(id);
    const el = document.getElementById(`cpq-cctv-sec-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function patch(partial: Partial<CctvBuildRequirements>) {
    setReq({ ...req, ...partial });
  }

  const calcLabel =
    calcState === "stale"
      ? he.cpqCctvCalcStale
      : calcState === "fresh"
        ? he.cpqCctvCalcFresh
        : he.cpqCctvCalcReady;

  return (
    <div
      className="cpq-cctv-ws"
      data-testid="cctv-requirements-workspace"
      data-tech={tech}
      data-mode={pro ? "professional" : "quick"}
      data-stale={stale ? "true" : "false"}
    >
      <header className="cpq-cctv-ws-header">
        <div className="cpq-cctv-ws-header-main">
          <p className="cpq-cctv-ws-kicker">
            <Ltr>CCTV</Ltr>
          </p>
          <div className="cpq-cctv-ws-header-row">
            <Segmented
              name="cctv-tech"
              label={he.cpqCctvTechLabel}
              value={tech}
              disabled={disabled}
              onChange={(v) => setReq(applyTechnology(req, v))}
              options={[
                { value: "ip", label: <Ltr>{he.cpqCctvTechIp}</Ltr> },
                { value: "analog_hd", label: <Ltr>{he.cpqCctvTechAnalog}</Ltr> },
                { value: "hybrid", label: <Ltr>{he.cpqCctvTechHybrid}</Ltr> },
              ]}
            />
            <Segmented
              name="cctv-mode"
              label={he.cpqCctvModeLabel}
              value={pro ? "professional" : "quick"}
              disabled={disabled}
              onChange={(v) => setReq(withDesignerMode(req, v))}
              options={[
                { value: "quick", label: he.cpqCctvModeQuick },
                { value: "professional", label: he.cpqCctvModePro },
              ]}
            />
          </div>
        </div>
        <p
          className={
            calcState === "stale"
              ? "cpq-cctv-ws-calc-state is-stale"
              : calcState === "fresh"
                ? "cpq-cctv-ws-calc-state is-fresh"
                : "cpq-cctv-ws-calc-state"
          }
          role="status"
          data-testid="cctv-calc-state"
        >
          {calcLabel}
        </p>
      </header>

      {chips.length > 0 ? (
        <div className="cpq-cctv-ws-context" aria-label={he.cpqCctvSiteContext}>
          {chips.map((c) => (
            <span key={c.id} className="cpq-cctv-ws-chip">
              <span className="cpq-cctv-ws-chip-label">{c.label}</span>
              <span className="cpq-cctv-ws-chip-value">{c.value}</span>
            </span>
          ))}
        </div>
      ) : null}

      {stale ? (
        <p className="cpq-cctv-ws-stale" role="status" data-testid="cctv-stale-banner">
          {he.cpqCctvStaleBanner}
        </p>
      ) : null}

      <div className="cpq-cctv-ws-layout">
        <nav className="cpq-cctv-ws-rail" aria-label={he.cpqCctvNavLabel}>
          {sections.map((id) => (
            <button
              key={id}
              type="button"
              className={
                activeSection === id ? "cpq-cctv-ws-rail-item is-active" : "cpq-cctv-ws-rail-item"
              }
              aria-current={activeSection === id ? "true" : undefined}
              onClick={() => jumpTo(id)}
            >
              {SECTION_LABEL[id]}
            </button>
          ))}
        </nav>

        <div className="cpq-cctv-ws-main" ref={mainRef}>
          <Section id="system" title={he.cpqCctvSectionSystem} active={activeSection === "system"}>
            <p className="cpq-cctv-ws-hint">
              {tech === "ip" ? (
                <>
                  {he.cpqCctvRecorderPathIp} · <Ltr>PoE</Ltr> / network · <Ltr>CAT</Ltr>
                </>
              ) : tech === "analog_hd" ? (
                <>
                  {he.cpqCctvRecorderPathAnalog} · <Ltr>RG59</Ltr> · {he.cpqCctvPowerSupply}
                </>
              ) : (
                <>
                  {he.cpqCctvRecorderPathHybrid}
                </>
              )}
            </p>
            {pro ? (
              <Input
                id="cpq-mfr"
                label={he.cpqCctvManufacturerPref}
                value={req.manufacturerPreference}
                disabled={disabled}
                onChange={(ev) => patch({ manufacturerPreference: ev.target.value })}
              />
            ) : null}
          </Section>

          <Section id="site" title={he.cpqCctvSectionSite} active={activeSection === "site"}>
            <Select
              id="cpq-environment"
              label={he.cpqCctvEnvironment}
              value={req.environment}
              disabled={disabled}
              onChange={(ev) =>
                patch({ environment: ev.target.value as CctvBuildRequirements["environment"] })
              }
            >
              <option value="">{he.cpqCctvEnvironmentUnspecified}</option>
              <option value="indoor">{he.leadsReqLocationIndoor}</option>
              <option value="outdoor">{he.leadsReqLocationOutdoor}</option>
              <option value="indoor_outdoor">{he.leadsReqLocationBoth}</option>
            </Select>
          </Section>

          <Section id="cameras" title={he.cpqCctvSectionCameras} active={activeSection === "cameras"}>
            {tech === "hybrid" ? (
              <div className="cpq-cctv-ws-grid-2">
                <Stepper
                  id="cpq-ip-count"
                  label={he.cpqCctvIpCameraCount}
                  value={req.ipCameraCount}
                  disabled={disabled}
                  min={0}
                  onChange={(n) => setReq(patchCameraCounts(req, { ipCameraCount: n }))}
                />
                <Stepper
                  id="cpq-analog-count"
                  label={he.cpqCctvAnalogCameraCount}
                  value={req.analogCameraCount}
                  disabled={disabled}
                  min={0}
                  onChange={(n) => setReq(patchCameraCounts(req, { analogCameraCount: n }))}
                />
              </div>
            ) : tech === "analog_hd" ? (
              <Stepper
                id="cpq-camera-count"
                label={he.cpqCctvAnalogCameraCount}
                value={req.cameraCount}
                disabled={disabled}
                min={1}
                onChange={(n) => setReq(patchCameraCounts(req, { cameraCount: n }))}
              />
            ) : (
              <Stepper
                id="cpq-camera-count"
                label={he.cpqCctvIpCameraCount}
                value={req.cameraCount}
                disabled={disabled}
                min={1}
                onChange={(n) => setReq(patchCameraCounts(req, { cameraCount: n }))}
              />
            )}

            {tech === "hybrid" ? (
              <p className="cpq-cctv-ws-hint" dir="ltr">
                Σ = {req.ipCameraCount + req.analogCameraCount}
              </p>
            ) : null}

            {(tech === "analog_hd" || tech === "hybrid") && (
              <Select
                id="cpq-analog-signal"
                label={he.cpqCctvAnalogSignal}
                value={req.analogSignal}
                disabled={disabled}
                onChange={(ev) =>
                  patch({ analogSignal: ev.target.value as CctvBuildRequirements["analogSignal"] })
                }
              >
                <option value="">—</option>
                <option value="tvi">TVI</option>
                <option value="cvi">CVI</option>
                <option value="ahd">AHD</option>
                <option value="cvbs">CVBS</option>
              </Select>
            )}

            <Select
              id="cpq-resolution"
              label={he.cpqCctvResolution}
              value={String(req.resolutionMp)}
              disabled={disabled}
              onChange={(ev) => patch({ resolutionMp: Number(ev.target.value) })}
            >
              <option value="2">2 {he.cpqCctvUnitMp}</option>
              <option value="4">4 {he.cpqCctvUnitMp}</option>
              <option value="5">5 {he.cpqCctvUnitMp}</option>
              <option value="8">8 {he.cpqCctvUnitMp}</option>
              <option value="12">12 {he.cpqCctvUnitMp}</option>
            </Select>

            {(pro || tech === "ip" || tech === "hybrid") && (
              <Select
                id="cpq-form-factor"
                label={he.cpqCameraType}
                value={req.formFactor}
                disabled={disabled}
                onChange={(ev) =>
                  patch({ formFactor: ev.target.value as CctvBuildRequirements["formFactor"] })
                }
              >
                <option value="">{he.cpqCameraMixed}</option>
                <option value="dome">{he.cpqCameraDome}</option>
                <option value="bullet">{he.cpqCameraBullet}</option>
                <option value="turret">Turret</option>
                <option value="ptz">PTZ</option>
              </Select>
            )}

            {pro && (tech === "ip" || tech === "hybrid") ? (
              <div className="cpq-cctv-ws-grid-2">
                <UnitInput
                  id="cpq-fps"
                  label={he.cpqCctvUnitFps}
                  value={req.fps}
                  unit={he.cpqCctvUnitFps}
                  disabled={disabled}
                  onChange={(v) => patch({ fps: v })}
                />
                <Select
                  id="cpq-codec"
                  label="Codec"
                  value={req.codec}
                  disabled={disabled}
                  onChange={(ev) =>
                    patch({ codec: ev.target.value as CctvBuildRequirements["codec"] })
                  }
                >
                  <option value="">ברירת מחדל הנדסית</option>
                  <option value="h265">H.265</option>
                  <option value="h264">H.264</option>
                </Select>
                <UnitInput
                  id="cpq-bitrate"
                  label={he.cpqCctvBitrateOverride}
                  value={req.bitrateMbpsOverride}
                  unit={he.cpqCctvUnitMbps}
                  disabled={disabled}
                  onChange={(v) => patch({ bitrateMbpsOverride: v })}
                />
                <UnitInput
                  id="cpq-cam-power"
                  label={he.cpqCctvCameraPower}
                  value={req.cameraMaxPowerW}
                  unit={he.cpqCctvUnitWatts}
                  disabled={disabled}
                  onChange={(v) => patch({ cameraMaxPowerW: v })}
                />
              </div>
            ) : null}
          </Section>

          <Section
            id="recording"
            title={he.cpqCctvSectionRecording}
            active={activeSection === "recording"}
          >
            <div className="cpq-cctv-ws-grid-2">
              <Stepper
                id="cpq-retention"
                label={he.cpqCctvRetention}
                value={req.retentionDays}
                unit={he.cpqCctvUnitDays}
                disabled={disabled}
                min={1}
                max={365}
                onChange={(n) => patch({ retentionDays: n })}
              />
              <Select
                id="cpq-recording-mode"
                label={he.cpqCctvRecordingMode}
                value={req.recordingMode}
                disabled={disabled}
                onChange={(ev) =>
                  patch({
                    recordingMode: ev.target.value as CctvBuildRequirements["recordingMode"],
                  })
                }
              >
                <option value="continuous">{he.cpqCctvModeContinuous}</option>
                <option value="scheduled">{he.cpqCctvModeScheduled}</option>
                <option value="motion">{he.cpqCctvModeMotion}</option>
              </Select>
            </div>
            <p className="cpq-cctv-ws-hint">{he.cpqCctvStorageHint}</p>
            {pro ? (
              <div className="cpq-cctv-ws-grid-2">
                {req.recordingMode === "scheduled" ? (
                  <UnitInput
                    id="cpq-hours"
                    label={he.cpqCctvRecordingHours}
                    value={req.recordingHoursPerDay}
                    unit={he.cpqCctvUnitHours}
                    disabled={disabled}
                    onChange={(v) => patch({ recordingHoursPerDay: v })}
                  />
                ) : null}
                {req.recordingMode === "motion" ? (
                  <UnitInput
                    id="cpq-duty"
                    label={he.cpqCctvMotionDuty}
                    value={req.motionDutyCycle}
                    unit={he.cpqCctvUnitPct}
                    disabled={disabled}
                    onChange={(v) => patch({ motionDutyCycle: v })}
                  />
                ) : null}
                <UnitInput
                  id="cpq-headroom"
                  label={he.cpqCctvHeadroom}
                  value={req.expansionHeadroomPercent}
                  unit={he.cpqCctvUnitPct}
                  disabled={disabled}
                  onChange={(v) => patch({ expansionHeadroomPercent: v })}
                />
              </div>
            ) : req.recordingMode === "scheduled" ? (
              <UnitInput
                id="cpq-hours"
                label={he.cpqCctvRecordingHours}
                value={req.recordingHoursPerDay}
                unit={he.cpqCctvUnitHours}
                disabled={disabled}
                onChange={(v) => patch({ recordingHoursPerDay: v })}
              />
            ) : null}
          </Section>

          {sections.includes("network") ? (
            <Section
              id="network"
              title={he.cpqCctvSectionNetwork}
              active={activeSection === "network"}
            >
              {tech === "hybrid" ? (
                <p className="cpq-cctv-ws-hint">{he.cpqCctvPoeIpSubsetHint}</p>
              ) : null}
              <ToggleRow
                label={
                  <>
                    <Ltr>PoE</Ltr> נדרש
                  </>
                }
                checked={req.poeRequired}
                disabled={disabled}
                onChange={(checked) => patch({ poeRequired: checked })}
              />
              <Select
                id="cpq-arch"
                label={he.cpqCctvArchitecture}
                value={req.architectureIntent}
                disabled={disabled || !req.poeRequired}
                onChange={(ev) =>
                  patch({
                    architectureIntent: ev.target
                      .value as CctvBuildRequirements["architectureIntent"],
                  })
                }
              >
                <option value="prefer_nvr_integrated">{he.cpqCctvArchIntegrated}</option>
                <option value="prefer_external_switch">{he.cpqCctvArchExternal}</option>
                <option value="unknown">{he.cpqCctvArchUnknown}</option>
              </Select>
              <UnitInput
                id="cpq-cable-m"
                label={he.cpqCctvCableMeters}
                value={req.cableDistanceMeters}
                unit={he.cpqCctvUnitMeters}
                disabled={disabled}
                onChange={(v) => patch({ cableDistanceMeters: v })}
              />
              {pro ? (
                <UnitInput
                  id="cpq-cam-power-net"
                  label={he.cpqCctvCameraPower}
                  value={req.cameraMaxPowerW}
                  unit={he.cpqCctvUnitWatts}
                  disabled={disabled}
                  onChange={(v) => patch({ cameraMaxPowerW: v })}
                />
              ) : null}
            </Section>
          ) : null}

          <Section id="power" title={he.cpqCctvSectionPower} active={activeSection === "power"}>
            {tech === "analog_hd" || tech === "hybrid" ? (
              <ToggleRow
                label={he.cpqCctvPowerSupply}
                checked={req.powerSupplyRequested}
                disabled={disabled}
                onChange={(checked) => patch({ powerSupplyRequested: checked })}
              />
            ) : (
              <p className="cpq-cctv-ws-hint">
                מערך <Ltr>IP</Ltr> — הזנת מצלמות דרך <Ltr>PoE</Ltr>
                {req.poeRequired ? "" : " (כבוי)"}.
              </p>
            )}
            <ToggleRow
              label={<Ltr>{he.cpqCctvUps}</Ltr>}
              checked={req.upsRequested}
              disabled={disabled}
              onChange={(checked) => patch({ upsRequested: checked })}
            />
          </Section>

          <Section
            id="infrastructure"
            title={he.cpqCctvSectionInfra}
            active={activeSection === "infrastructure"}
          >
            {(tech === "ip" || tech === "hybrid") && (
              <p className="cpq-cctv-ws-hint">
                <Ltr>{he.cpqCctvCableCat}</Ltr>
                {req.cableDistanceMeters ? (
                  <>
                    {" "}
                    · <Ltr>{req.cableDistanceMeters} m</Ltr>
                  </>
                ) : null}
              </p>
            )}
            {(tech === "analog_hd" || tech === "hybrid") && (
              <p className="cpq-cctv-ws-hint">
                <Ltr>{he.cpqCctvCableCoax}</Ltr>
              </p>
            )}
            {tech === "analog_hd" ? (
              <UnitInput
                id="cpq-cable-m-analog"
                label={he.cpqCctvCableMeters}
                value={req.cableDistanceMeters}
                unit={he.cpqCctvUnitMeters}
                disabled={disabled}
                onChange={(v) => patch({ cableDistanceMeters: v })}
              />
            ) : null}
            {pro ? (
              <div className="cpq-cctv-ws-toggles">
                <ToggleRow
                  label={he.cpqCctvInfraRack}
                  checked={req.infraRackRequested}
                  disabled={disabled}
                  onChange={(v) => patch({ infraRackRequested: v })}
                />
                <ToggleRow
                  label={he.cpqCctvInfraConduit}
                  checked={req.infraConduitRequested}
                  disabled={disabled}
                  onChange={(v) => patch({ infraConduitRequested: v })}
                />
                <ToggleRow
                  label={he.cpqCctvInfraSurge}
                  checked={req.infraSurgeRequested}
                  disabled={disabled}
                  onChange={(v) => patch({ infraSurgeRequested: v })}
                />
                <ToggleRow
                  label={he.cpqCctvInfraJunction}
                  checked={req.infraJunctionRequested}
                  disabled={disabled}
                  onChange={(v) => patch({ infraJunctionRequested: v })}
                />
                <ToggleRow
                  label={he.cpqCctvInfraMounts}
                  checked={req.infraMountsRequested}
                  disabled={disabled}
                  onChange={(v) => patch({ infraMountsRequested: v })}
                />
              </div>
            ) : null}
          </Section>

          <Section
            id="services"
            title={he.cpqCctvSectionServices}
            active={activeSection === "services"}
          >
            <div className="cpq-cctv-ws-toggles">
              <ToggleRow
                label={he.cpqCctvServiceInstall}
                checked={req.installationRequested}
                disabled={disabled}
                onChange={(checked) => patch({ installationRequested: checked })}
              />
              <ToggleRow
                label={he.cpqCctvServiceRemote}
                checked={req.remoteViewing}
                disabled={disabled}
                onChange={(checked) => patch({ remoteViewing: checked })}
              />
              <ToggleRow
                label={he.cpqCctvServiceTesting}
                checked={req.testingRequested}
                disabled={disabled}
                onChange={(checked) => patch({ testingRequested: checked })}
              />
              <ToggleRow
                label={he.cpqCctvServiceCommissioning}
                checked={req.commissioningRequested}
                disabled={disabled}
                onChange={(checked) => patch({ commissioningRequested: checked })}
              />
            </div>
          </Section>

          {inputError ? (
            <p className="cpq-cctv-ws-error" role="alert" data-testid="cctv-req-error">
              {inputError}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
