import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

function read(rel: string) {
  return readFileSync(resolve(root, rel), "utf8");
}

describe("portal responsive RTL shell", () => {
  it("portal layout is RTL with touch-friendly navigation", () => {
    const layout = read("src/routes/portal/route.tsx");
    const shell = read("src/components/portal/PortalShell.tsx");
    expect(layout).toContain('dir="rtl"');
    expect(shell).toContain("min-h-12");
    expect(shell).toContain("text-base");
  });

  it("portal service and quotes pages use base text size for mobile", () => {
    const service = read("src/routes/portal/service.tsx");
    const quotes = read("src/routes/portal/quotes.tsx");
    expect(service).toContain("text-base");
    expect(quotes).toContain("min-h-12");
    expect(quotes).toContain("he.portalQuoteOpen");
  });
});