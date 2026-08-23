import { describe, expect, it } from "vitest";
import {
  projectCreateHref,
  quoteCreateHref,
  resolveProjectContext,
  resolveQuoteContext,
} from "../src/lib/workflow-context";

describe("workflow-context", () => {
  it("builds quote create href without params", () => {
    expect(quoteCreateHref()).toBe("/app/quotes/new");
  });

  it("builds quote create href with customer and site", () => {
    expect(quoteCreateHref({ customerId: "c1", siteId: "s1" })).toBe(
      "/app/quotes/new?customerId=c1&siteId=s1",
    );
  });

  it("returns customer only when there are no sites", () => {
    expect(resolveQuoteContext({ customerId: "c1", sites: [] })).toEqual({
      customerId: "c1",
      needsSiteSelection: false,
    });
  });

  it("auto-attaches the only site", () => {
    expect(resolveQuoteContext({ customerId: "c1", sites: [{ id: "s1" }] })).toEqual({
      customerId: "c1",
      siteId: "s1",
      needsSiteSelection: false,
    });
  });

  it("requires site selection when many sites and no siteId", () => {
    expect(
      resolveQuoteContext({
        customerId: "c1",
        sites: [{ id: "s1" }, { id: "s2" }],
      }),
    ).toEqual({
      customerId: "c1",
      needsSiteSelection: true,
    });
  });

  it("honors an explicit siteId", () => {
    expect(
      resolveQuoteContext({
        customerId: "c1",
        siteId: "s2",
        sites: [{ id: "s1" }, { id: "s2" }],
      }),
    ).toEqual({
      customerId: "c1",
      siteId: "s2",
      needsSiteSelection: false,
    });
  });

  it("builds project create href with quote context", () => {
    expect(projectCreateHref({ quoteId: "q1", customerId: "c1", siteId: "s1" })).toBe(
      "/app/projects?quoteId=q1&customerId=c1&siteId=s1",
    );
  });

  it("resolves project context with quote as authoritative", () => {
    expect(resolveProjectContext({ quoteId: "q1", customerId: "c1" })).toEqual({
      quoteId: "q1",
      customerId: "c1",
      fromQuote: true,
    });
    expect(resolveProjectContext({ customerId: "c1" })).toEqual({
      customerId: "c1",
      fromQuote: false,
    });
  });
});
