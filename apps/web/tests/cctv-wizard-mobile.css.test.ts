import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../src/styles.css"), "utf8");

describe("CCTV wizard mobile tap targets and overflow", () => {
  it("keeps header segments, picker rows and pick links at least 44px", () => {
    expect(css).toMatch(/\.cpq-cctv-ws-header-row \.cpq-cctv-ws-seg\s*\{[^}]*min-height:\s*44px/s);
    expect(css).toMatch(/\.cpq-cctv-picker-item\s*\{[^}]*min-height:\s*44px/s);
    expect(css).toMatch(/\.cpq-cctv-designer-pick\s*\{[^}]*min-height:\s*44px/s);
  });

  it("clips horizontal overflow on the quote flow root and CCTV shell", () => {
    expect(css).toMatch(/\.quote-flow-root\s*\{[^}]*overflow-x:\s*clip/s);
    expect(css).toMatch(/\.cpq-cctv-designer-shell\s*\{[^}]*overflow-x:\s*clip/s);
  });
});
