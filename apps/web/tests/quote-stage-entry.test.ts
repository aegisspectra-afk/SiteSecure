import { describe, expect, it } from "vitest";
import {
  adjacentQuoteWorkspaceStep,
  initialQuoteWorkspaceStep,
} from "../src/components/quotes/workspace/types";

describe("quote workspace stage entry", () => {
  it("starts on details for an empty quote", () => {
    expect(initialQuoteWorkspaceStep(0)).toBe("details");
  });

  it("opens composition when the quote already has lines", () => {
    expect(initialQuoteWorkspaceStep(3)).toBe("items");
  });

  it("keeps adjacent navigation linear", () => {
    expect(adjacentQuoteWorkspaceStep("items", 1)).toBe("pricing");
    expect(adjacentQuoteWorkspaceStep("pricing", -1)).toBe("items");
  });
});
