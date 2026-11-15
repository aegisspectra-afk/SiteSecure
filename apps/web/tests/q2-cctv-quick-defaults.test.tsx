import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { CctvRequirementsWorkspace } from "../src/components/quotes/cpq/CctvRequirementsWorkspace";
import { he } from "../src/i18n/he";
import {
  CCTV_QUICK_ASSUMPTIONS,
  defaultCctvBuildRequirements,
  effectiveCableMeters,
  isAssumed,
  requirementsToRecommendBody,
  type CctvBuildRequirements,
} from "../src/lib/cctv-build-requirements";
import { buildValidationCenter } from "../src/lib/cctv-designer-summary";

function Harness({ initial }: { initial?: Partial<CctvBuildRequirements> }) {
  const [req, setReq] = useState<CctvBuildRequirements>({ ...defaultCctvBuildRequirements(), ...initial });
  return <CctvRequirementsWorkspace req={req} setReq={setReq} inputError={null} stale={false} calcState="draft" hideHeader />;
}

describe("Q2.2 quick-mode defaults", () => {
  it("assumes 30 m of cable per camera, PoE in the NVR and continuous recording", () => {
    const req = defaultCctvBuildRequirements();
    expect(req.cableMetersPerCamera).toBe("30");
    expect(req.poeRequired).toBe(true);
    expect(req.architectureIntent).toBe("prefer_nvr_integrated");
    expect(req.recordingMode).toBe("continuous");
    for (const key of ["cable", "poe", "recording"] as const) expect(isAssumed(req, key)).toBe(true);
  });

  it("sends per-camera meters × cameras to the engine; a typed total wins", () => {
    const req = { ...defaultCctvBuildRequirements(), cameraCount: 4, ipCameraCount: 4 };
    expect(effectiveCableMeters(req)).toBe(120);
    expect(requirementsToRecommendBody(req).cable_distance_meters).toBe(120);
    expect(requirementsToRecommendBody({ ...req, cableDistanceMeters: "75" }).cable_distance_meters).toBe(75);
    expect(requirementsToRecommendBody({ ...req, cableMetersPerCamera: "" }).cable_distance_meters).toBeUndefined();
  });

  it("warns about cable only when there is no length at all", () => {
    const base = defaultCctvBuildRequirements();
    const codes = (req: CctvBuildRequirements) =>
      buildValidationCenter({ req, calcState: "draft", recommendation: null }).map((i) => i.code);
    expect(codes(base)).not.toContain("CABLE_DISTANCE_UNRESOLVED");
    expect(codes({ ...base, cableMetersPerCamera: "" })).toContain("CABLE_DISTANCE_UNRESOLVED");
  });
});

describe("Q2.2 quick mode shows only the four fields plus assumptions", () => {
  it("renders cameras, indoor/outdoor, resolution and retention, and nothing from professional mode", () => {
    const { container } = render(<Harness />);
    const quick = screen.getByTestId("cctv-quick-fields");
    for (const id of ["cpq-camera-count", "cpq-environment", "cpq-resolution", "cpq-retention"]) {
      expect(quick.querySelector(`#${id}`), id).not.toBeNull();
    }
    for (const id of ["cpq-fps", "cpq-codec", "cpq-arch", "cpq-cable-m", "cpq-form-factor", "cpq-mfr", "cpq-headroom"]) {
      expect(container.querySelector(`#${id}`), id).toBeNull();
    }
    expect(screen.queryByText(he.cpqCctvServiceInstall)).not.toBeInTheDocument();
    expect(container.querySelector(".cpq-cctv-ws-rail")).toBeNull();
  });

  it("marks each default as 'הנחה' and lets the user change it", () => {
    render(<Harness />);
    const panel = screen.getByTestId("cctv-assumptions");
    for (const key of ["cable", "poe", "recording"]) {
      expect(within(panel).getByTestId(`cctv-assumption-${key}-badge`)).toHaveTextContent(he.cpqCctvAssumptionBadge);
    }
    expect(within(panel).getByText(he.cpqCctvCableTotalHint(120))).toBeInTheDocument();

    fireEvent.change(within(panel).getByLabelText(he.cpqCctvAssumptionCable), { target: { value: "40" } });
    expect(within(panel).getByTestId("cctv-assumption-cable-badge")).toHaveTextContent(he.cpqCctvAssumptionChanged);
    expect(within(panel).getByText(he.cpqCctvCableTotalHint(160))).toBeInTheDocument();

    fireEvent.change(within(panel).getByLabelText(he.cpqCctvAssumptionPoe), { target: { value: "external" } });
    expect(within(panel).getByTestId("cctv-assumption-poe-badge")).toHaveTextContent(he.cpqCctvAssumptionChanged);

    fireEvent.change(within(panel).getByLabelText(he.cpqCctvAssumptionRecording), { target: { value: "motion" } });
    expect(within(panel).getByTestId("cctv-assumption-recording-badge")).toHaveTextContent(he.cpqCctvAssumptionChanged);
  });

  it("professional mode still has every field, including total and per-camera cable", () => {
    const { container } = render(<Harness initial={{ designerMode: "professional", showAdvanced: true }} />);
    expect(screen.queryByTestId("cctv-quick-fields")).not.toBeInTheDocument();
    for (const id of ["cpq-arch", "cpq-cable-m", "cpq-cable-per-camera", "cpq-fps"]) {
      expect(container.querySelector(`#${id}`), id).not.toBeNull();
    }
    expect(CCTV_QUICK_ASSUMPTIONS.cableMetersPerCamera).toBe("30");
  });
});
