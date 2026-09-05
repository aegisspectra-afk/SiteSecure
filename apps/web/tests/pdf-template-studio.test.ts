import { describe, expect, it } from "vitest";
import {
  configToApiPayload,
  readTemplateConfig,
  DEFAULT_QUOTE_TEMPLATE_CONFIG,
} from "../src/lib/pdf-template-config";

describe("pdf template config", () => {
  it("reads legacy configs without inventing company identity", () => {
    const cfg = readTemplateConfig({
      showLogo: true,
      headerCompany: true,
      primaryColor: "#123456",
      notes: "x",
    });
    expect(cfg.useCompanyLogo).toBe(true);
    expect(cfg.headerCompany).toBe(true);
    expect(cfg.notes).toBe("x");
    expect(cfg.bodyLineItems).toBe(true);
    expect(cfg.showGrandTotal).toBe(true);
  });

  it("keeps line total and grand total protected when turning columns off", () => {
    const cfg = readTemplateConfig({
      showLineTotal: false,
      showGrandTotal: false,
      bodyLineItems: false,
    });
    expect(cfg.showLineTotal).toBe(true);
    expect(cfg.showGrandTotal).toBe(true);
    expect(cfg.bodyLineItems).toBe(true);
  });

  it("serializes company-color preference for the renderer", () => {
    const base = { ...DEFAULT_QUOTE_TEMPLATE_CONFIG, useCompanyColors: true, overrideColors: false };
    const payload = configToApiPayload(base);
    expect(payload.useCompanyColors).toBe(true);
    expect(payload.overrideColors).toBe(false);
  });
});
