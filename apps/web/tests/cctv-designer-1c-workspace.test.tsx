/**
 * SYSTEM-DESIGNER-1 Slice C — requirements workspace UI/state tests A–L.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import {
  defaultCctvBuildRequirements,
  validateCctvBuildRequirements,
  type CctvBuildRequirements,
} from "../src/lib/cctv-build-requirements";
import {
  applyTechnology,
  isProfessionalMode,
  patchCameraCounts,
  requirementsCalcFingerprint,
  visibleSectionsFor,
  withDesignerMode,
} from "../src/lib/cctv-designer-workspace";
import { CctvRequirementsWorkspace } from "../src/components/quotes/cpq/CctvRequirementsWorkspace";

function Harness({
  initial,
  stale = false,
  calcState = "draft",
}: {
  initial?: Partial<CctvBuildRequirements>;
  stale?: boolean;
  calcState?: "draft" | "fresh" | "stale";
}) {
  const [req, setReq] = useState<CctvBuildRequirements>({
    ...defaultCctvBuildRequirements(),
    ...initial,
  });
  return (
    <CctvRequirementsWorkspace
      req={req}
      setReq={setReq}
      inputError={null}
      stale={stale}
      calcState={calcState}
    />
  );
}

describe("SYSTEM-DESIGNER-1 Slice C workspace", () => {
  it("A. IP Quick — core IP fields, no Pro extras, network visible", () => {
    render(
      <Harness initial={{ cctvTechnology: "ip", designerMode: "quick", showAdvanced: false }} />,
    );
    const root = screen.getByTestId("cctv-requirements-workspace");
    expect(root).toHaveAttribute("data-tech", "ip");
    expect(root).toHaveAttribute("data-mode", "quick");
    expect(screen.getByLabelText("מצלמות IP")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "רשת ו-PoE" })).toBeInTheDocument();
    expect(screen.queryByLabelText("FPS")).not.toBeInTheDocument();
    expect(screen.queryByText("ארון תקשורת")).not.toBeInTheDocument();
  });

  it("B. IP Professional — advanced camera/network controls", async () => {
    const user = userEvent.setup();
    render(
      <Harness initial={{ cctvTechnology: "ip", designerMode: "quick", showAdvanced: false }} />,
    );
    await user.click(screen.getByRole("radio", { name: "מקצועי" }));
    expect(screen.getByTestId("cctv-requirements-workspace")).toHaveAttribute(
      "data-mode",
      "professional",
    );
    expect(screen.getByLabelText("FPS")).toBeInTheDocument();
    expect(screen.getByText("ארון תקשורת")).toBeInTheDocument();
  });

  it("C. Analog Quick — hides PoE/network, shows coax path & PSU", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("radio", { name: "Analog HD" }));
    expect(screen.getByTestId("cctv-requirements-workspace")).toHaveAttribute(
      "data-tech",
      "analog_hd",
    );
    expect(screen.queryByRole("heading", { name: "רשת ו-PoE" })).not.toBeInTheDocument();
    expect(screen.getAllByText(/RG59/).length).toBeGreaterThan(0);
    expect(screen.getByText("ספק כוח מרכזי")).toBeInTheDocument();
  });

  it("D. Analog Professional — preserves analog path + pro infra", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={{
          cctvTechnology: "analog_hd",
          designerMode: "quick",
          showAdvanced: false,
          analogSignal: "tvi",
          fps: "15",
        }}
      />,
    );
    await user.click(screen.getByRole("radio", { name: "מקצועי" }));
    expect(screen.getByTestId("cctv-requirements-workspace")).toHaveAttribute(
      "data-tech",
      "analog_hd",
    );
    expect(screen.queryByRole("heading", { name: "רשת ו-PoE" })).not.toBeInTheDocument();
    expect(screen.getByText("ארון תקשורת")).toBeInTheDocument();
    expect(screen.getByLabelText("אות אנלוגי")).toHaveValue("tvi");
  });

  it("E. Hybrid Quick — dual counts + PoE section", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("radio", { name: "Hybrid" }));
    expect(screen.getByTestId("cctv-requirements-workspace")).toHaveAttribute("data-tech", "hybrid");
    expect(screen.getByLabelText("מצלמות IP")).toBeInTheDocument();
    expect(screen.getByLabelText("מצלמות אנלוגיות")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "רשת ו-PoE" })).toBeInTheDocument();
  });

  it("F. Hybrid Professional — IP subset PoE hint + pro fields", () => {
    render(
      <Harness
        initial={{
          cctvTechnology: "hybrid",
          designerMode: "professional",
          showAdvanced: true,
          ipCameraCount: 5,
          analogCameraCount: 3,
          cameraCount: 8,
        }}
      />,
    );
    expect(screen.getAllByText(/PoE מחושב רק עבור מצלמות/).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("FPS")).toBeInTheDocument();
  });

  it("G. Quick→Pro preserves values", () => {
    const withVals = {
      ...defaultCctvBuildRequirements(),
      cameraCount: 12,
      retentionDays: 30,
      resolutionMp: 8,
      fps: "20",
      cableDistanceMeters: "45",
    };
    const pro = withDesignerMode(withVals, "professional");
    expect(pro.cameraCount).toBe(12);
    expect(pro.retentionDays).toBe(30);
    expect(pro.fps).toBe("20");
    expect(pro.cableDistanceMeters).toBe("45");
    expect(isProfessionalMode(pro)).toBe(true);
  });

  it("H. Pro→Quick preserves advanced values", () => {
    const pro = withDesignerMode(
      {
        ...defaultCctvBuildRequirements(),
        designerMode: "professional",
        showAdvanced: true,
        fps: "25",
        codec: "h265" as const,
        bitrateMbpsOverride: "4",
        expansionHeadroomPercent: "20",
        infraRackRequested: true,
      },
      "quick",
    );
    expect(pro.designerMode).toBe("quick");
    expect(pro.showAdvanced).toBe(false);
    expect(pro.fps).toBe("25");
    expect(pro.codec).toBe("h265");
    expect(pro.bitrateMbpsOverride).toBe("4");
    expect(pro.infraRackRequested).toBe(true);
  });

  it("I. Analog hides PoE section in visibility helper", () => {
    expect(visibleSectionsFor("analog_hd")).not.toContain("network");
    expect(visibleSectionsFor("ip")).toContain("network");
    expect(visibleSectionsFor("hybrid")).toContain("network");
  });

  it("J. Hybrid count validation", () => {
    const bad = {
      ...defaultCctvBuildRequirements(),
      cctvTechnology: "hybrid" as const,
      cameraCount: 8,
      ipCameraCount: 5,
      analogCameraCount: 2,
    };
    expect(validateCctvBuildRequirements(bad).ok).toBe(false);
    const good = patchCameraCounts(bad, { ipCameraCount: 5, analogCameraCount: 3 });
    expect(validateCctvBuildRequirements(good).ok).toBe(true);
  });

  it("K. stale after edit — fingerprint changes; mode does not", () => {
    const a = defaultCctvBuildRequirements();
    const fp1 = requirementsCalcFingerprint(a);
    const edited = { ...a, cameraCount: 9, ipCameraCount: 9 };
    expect(requirementsCalcFingerprint(edited)).not.toBe(fp1);
    expect(requirementsCalcFingerprint(withDesignerMode(a, "professional"))).toBe(fp1);
  });

  it("L. calculate clears stale — matching fingerprint", () => {
    const req = applyTechnology(defaultCctvBuildRequirements(), "analog_hd");
    const calcFp = requirementsCalcFingerprint(req);
    expect(requirementsCalcFingerprint(req)).toBe(calcFp);
    expect(requirementsCalcFingerprint({ ...req, retentionDays: 21 })).not.toBe(calcFp);
  });

  it("stale banner renders when stale prop set", () => {
    render(<Harness stale calcState="stale" />);
    expect(screen.getByTestId("cctv-stale-banner")).toBeInTheDocument();
    expect(screen.getByTestId("cctv-calc-state")).toHaveTextContent(/חישוב מחדש/);
  });

  it("technology switch updates workspace immediately", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("radio", { name: "Hybrid" }));
    expect(screen.getByTestId("cctv-requirements-workspace")).toHaveAttribute("data-tech", "hybrid");
    await user.click(screen.getByRole("radio", { name: "IP" }));
    expect(screen.getByTestId("cctv-requirements-workspace")).toHaveAttribute("data-tech", "ip");
  });
});
