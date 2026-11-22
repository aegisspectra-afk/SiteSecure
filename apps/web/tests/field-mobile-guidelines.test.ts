import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(__dirname, "../src/styles.css"), "utf8");

describe("Field technician mobile guidelines (styles.css)", () => {
  it("keeps primary field tap targets at least 48px", () => {
    expect(css).toMatch(/\.field-job-navlink\s*\{[^}]*min-height:\s*3rem/s);
    expect(css).toMatch(/\.field-quick-tile\s*\{[^}]*min-height:\s*3rem/s);
    expect(css).toMatch(/\.field-sheet-close\s*\{[^}]*min-height:\s*3rem/s);
    expect(css).toContain(".field-check-hit");
    expect(css).toMatch(/\.field-check-hit\s*\{[\s\S]*?min-width:\s*3rem/);
    expect(css).toMatch(/\.field-check-hit\s*\{[\s\S]*?min-height:\s*3rem/);
  });

  it("sets body and input typography to at least 17px (1.0625rem)", () => {
    expect(css).toMatch(/\.field-control\s*\{[^}]*font-size:\s*1\.0625rem/s);
    expect(css).toMatch(/\.field-notes\s*\{[^}]*font-size:\s*1\.0625rem/s);
    expect(css).toMatch(/\.field-job-navlink\s*\{[^}]*font-size:\s*1\.0625rem/s);
  });

  it("reserves bottom safe area so checklist rows clear the tab bar", () => {
    expect(css).toMatch(
      /\.field-job:has\(\.field-job-primary-cta\)\s*\{[^}]*padding-bottom:\s*calc\(var\(--ops-bottom-nav-offset/s,
    );
    expect(css).toMatch(/\.field-today,\s*\n\.field-job\s*\{[^}]*padding-bottom:\s*calc\(var\(--ops-bottom-nav-offset/s);
  });

  it("hides duplicate desktop rail on narrow viewports", () => {
    expect(css).toMatch(/\.field-job-rail\s*\{\s*display:\s*none;/);
  });
});