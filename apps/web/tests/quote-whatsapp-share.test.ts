import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { he } from "../src/i18n/he";
import {
  buildWhatsAppShareHref,
  resolveWhatsAppOpen,
} from "../src/lib/quote-whatsapp-share";

describe("quote-whatsapp-share", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      open: vi.fn(() => ({ closed: false, location: { href: "" }, close: vi.fn() })),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds wa.me URL with customer phone and secure link", () => {
    const { href, phone } = buildWhatsAppShareHref({
      customerName: "שנידי",
      publicUrl: "https://example.com/q/abc",
      phoneDigits: "0501234567",
    });
    expect(phone).toBe("972501234567");
    expect(href).toContain("https://wa.me/972501234567?text=");
    expect(decodeURIComponent(href)).toContain("https://example.com/q/abc");
    expect(decodeURIComponent(href)).toContain("שנידי");
  });

  it("requires phone unless forcePicker", () => {
    const blocked = buildWhatsAppShareHref({
      publicUrl: "https://example.com/q/abc",
      phoneDigits: "",
    });
    expect(blocked.href).toBe("");
    expect(blocked.phone).toBeNull();

    const picker = buildWhatsAppShareHref({
      publicUrl: "https://example.com/q/abc",
      phoneDigits: "",
      forcePicker: true,
    });
    expect(picker.href.startsWith("https://wa.me/?text=")).toBe(true);
  });

  it("reports no_phone without claiming success", () => {
    const result = resolveWhatsAppOpen(
      { publicUrl: "https://example.com/q/abc", phoneDigits: "" },
      null,
    );
    expect(result).toEqual({ ok: false, reason: "no_phone" });
  });

  it("uses message template that includes secure link", () => {
    const msg = he.quoteWhatsAppMessage("שנידי", "https://secure/link");
    expect(msg).toContain("שנידי");
    expect(msg).toContain("https://secure/link");
    expect(msg.toLowerCase()).not.toContain("נשלחה");
  });
});
