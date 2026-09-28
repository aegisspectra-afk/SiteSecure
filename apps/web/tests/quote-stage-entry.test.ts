import { describe, expect, it } from "vitest";
import {
  adjacentQuoteWorkspaceStep,
  initialQuoteWorkspaceStep,
} from "../src/components/quotes/workspace/types";

describe("quote workspace stage entry", () => {
  it("skips Stage 1 when customer and site are already known", () => {
    expect(
      initialQuoteWorkspaceStep({
        itemCount: 0,
        customerId: "cust-1",
        siteId: "site-1",
      }),
    ).toBe("items");
  });

  it("stays on Stage 1 when only customer is known", () => {
    expect(
      initialQuoteWorkspaceStep({
        itemCount: 0,
        customerId: "cust-1",
        siteId: null,
      }),
    ).toBe("details");
  });

  it("opens composition when the quote already has lines", () => {
    expect(initialQuoteWorkspaceStep({ itemCount: 3, customerId: null, siteId: null })).toBe("items");
  });

  it("keeps adjacent navigation linear", () => {
    expect(adjacentQuoteWorkspaceStep("items", 1)).toBe("pricing");
    expect(adjacentQuoteWorkspaceStep("pricing", -1)).toBe("items");
  });
});
