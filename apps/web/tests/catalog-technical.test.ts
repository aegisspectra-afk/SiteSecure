import { describe, expect, it } from "vitest";
import {
  hasStructuredTechnicalData,
  parseCameraTechnicalAttrs,
  parseHddTechnicalAttrs,
  parseNvrTechnicalAttrs,
  parseSwitchTechnicalAttrs,
} from "../src/lib/catalog-technical";

describe("catalog-technical parsers", () => {
  it("treats missing booleans as unknown not false", () => {
    const cam = parseCameraTechnicalAttrs({ resolution_mp: 4 });
    expect(cam.resolution_mp).toBe(4);
    expect(cam.poe).toBeNull();
    expect(cam.onvif).toBeNull();
  });

  it("parses nvr legacy hdd_bays alias", () => {
    const nvr = parseNvrTechnicalAttrs({ channels: 16, hdd_bays: 2, poe_budget: 200 });
    expect(nvr.channels).toBe(16);
    expect(nvr.drive_bays).toBe(2);
    expect(nvr.poe_budget_w).toBe(200);
  });

  it("parses hdd and switch", () => {
    expect(parseHddTechnicalAttrs({ capacity_tb: 8 }).capacity_tb).toBe(8);
    expect(parseHddTechnicalAttrs({}).surveillance_grade).toBeNull();
    const sw = parseSwitchTechnicalAttrs({ ports: 16, poe_ports: 16, poe_budget_w: 180 });
    expect(sw.ports).toBe(16);
    expect(sw.poe_budget_w).toBe(180);
  });

  it("reports structured completeness without inventing values", () => {
    expect(hasStructuredTechnicalData("cameras_ip", {})).toBe(false);
    expect(
      hasStructuredTechnicalData("cameras_ip", {
        resolution_mp: 4,
        environment: "outdoor",
        form_factor: "bullet",
        poe: true,
        max_power_w: 8,
      }),
    ).toBe(true);
    expect(hasStructuredTechnicalData("hdd_recorders", { capacity_tb: 8 })).toBe(true);
  });
});
