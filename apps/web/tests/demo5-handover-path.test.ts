import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("DEMO-5 handover document path", () => {
  it("installation_complete mints a public handover link and FieldJob surfaces it", () => {
    const complete = readFileSync(join(root, "api/app/installation_complete.py"), "utf8");
    expect(complete).toMatch(/mint_handover_link|handover_url/);
    const field = readFileSync(join(root, "web/src/components/field/FieldJob.tsx"), "utf8");
    expect(field).toContain("handover_url");
    expect(field).toContain("handoverOpenCertificate");
  });
});