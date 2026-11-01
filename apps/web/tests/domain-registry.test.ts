import { describe, expect, it } from "vitest";
import { he } from "../src/i18n/he";
import {
  cctvUsesAuthoritativeModules,
  ENGINE_STAGES,
  toEngineEnvelope,
} from "../src/lib/domain-engine-contract";
import { DOMAIN_DOCS_GAP } from "../src/lib/domain-docs-gap";
import {
  domainLabel,
  domainsOnQuote,
  getDomain,
  isDomainVisible,
  supportsMultipleDomainsOnQuote,
  visibleDomains,
} from "../src/lib/domain-registry";

describe("C0 domain registry", () => {
  it("keeps free-build always visible with no wizard", () => {
    const free = getDomain("free_build")!;
    expect(free.wizard).toBe(false);
    expect(free.kind).toBe("free_compose");
    expect(isDomainVisible("free_build")).toBe(true);
    expect(domainLabel("free_build", he)).toBe("בנייה חופשית");
  });

  it("exposes only free-build and verified CCTV in the picker", () => {
    expect(visibleDomains().map((row) => row.key)).toEqual(["free_build", "cctv"]);
    expect(isDomainVisible("alarm")).toBe(false);
    expect(isDomainVisible("access_control")).toBe(false);
    expect(getDomain("alarm")?.hasVerifiedEngineeringModule).toBe(false);
    expect(getDomain("cctv")?.engineeringModule).toBe("cctv_sizing+cctv_recommend");
  });

  it("allows several domains on the same quote", () => {
    expect(supportsMultipleDomainsOnQuote()).toBe(true);
    expect(domainsOnQuote({ engineTypes: ["cctv"], hasManualOrCatalogLines: true })).toEqual([
      "cctv",
      "free_build",
    ]);
  });
});

describe("C1 engine envelope", () => {
  it("maps a CCTV recommendation without changing module ownership", () => {
    const rec = {
      system_type: "cctv",
      engine_version: 1,
      input: { cameraCount: 4 },
      engineering: { storage: { requiredTbWithOverhead: 2.9 } },
      components: [],
      warnings: [],
      assumptions: [],
      unresolved: [],
      blocking: false,
      status: "OK" as const,
    };
    expect(toEngineEnvelope(rec)).toMatchObject({
      engine_type: "cctv",
      engine_version: 1,
      input: { cameraCount: 4 },
    });
    expect(cctvUsesAuthoritativeModules()).toEqual({
      sizing: "cctv_sizing",
      recommend: "cctv_recommend",
      apply: "quote_items",
      pricing: "pricing.recalculate",
    });
    expect(ENGINE_STAGES).toContain("pricing");
  });
});

describe("Docs gap is recorded", () => {
  it("does not ignore the existing architecture docs", () => {
    expect(DOMAIN_DOCS_GAP.sources.length).toBe(2);
    expect(DOMAIN_DOCS_GAP.docsSaid.some((row) => row.includes("Manual/Catalog"))).toBe(true);
    expect(DOMAIN_DOCS_GAP.thisApproach.some((row) => row.includes("בנייה חופשית"))).toBe(true);
    expect(DOMAIN_DOCS_GAP.preservedFromDocs.some((row) => row.includes("cctv_sizing"))).toBe(true);
  });
});
