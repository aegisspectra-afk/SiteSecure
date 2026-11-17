import { describe, expect, it } from "vitest";
import {
  canWhatsAppRecipientPhone,
  isValidIsraeliMobile,
  resolveQuoteRecipientPhone,
  toWhatsAppPhone,
} from "../src/lib/quote-recipient-phone";

describe("resolveQuoteRecipientPhone", () => {
  it("prefers customer phone over lead", () => {
    expect(
      resolveQuoteRecipientPhone({
        customerPhone: "058-537-8423",
        leadPhone: "0500000000",
      }),
    ).toBe("0585378423");
  });

  it("falls back to primary contact then lead", () => {
    expect(
      resolveQuoteRecipientPhone({
        customerPhone: "",
        contactPhone: "052-1111111",
        leadPhone: "0500000000",
      }),
    ).toBe("0521111111");
    expect(
      resolveQuoteRecipientPhone({
        customerPhone: null,
        contactPhone: null,
        leadPhone: "050-1234567",
      }),
    ).toBe("0501234567");
  });

  it("converts local Israeli numbers for WhatsApp", () => {
    expect(toWhatsAppPhone("0585378423")).toBe("972585378423");
    expect(toWhatsAppPhone("972585378423")).toBe("972585378423");
  });
});

describe("Israeli mobile gate for WhatsApp", () => {
  it("accepts 05… and 9725… mobiles only", () => {
    expect(isValidIsraeliMobile("058-537-8423")).toBe(true);
    expect(isValidIsraeliMobile("972585378423")).toBe(true);
    expect(isValidIsraeliMobile("03-1234567")).toBe(false);
    expect(isValidIsraeliMobile("")).toBe(false);
    expect(canWhatsAppRecipientPhone({ customerPhone: "050-1234567" })).toBe(true);
    expect(canWhatsAppRecipientPhone({ customerPhone: "09-1234567" })).toBe(false);
  });
});

describe("WhatsApp href builder", () => {
  it("builds wa.me with 972 phone and prepared message", async () => {
    const { buildWhatsAppShareHref } = await import("../src/lib/quote-whatsapp-share");
    const built = buildWhatsAppShareHref({
      customerName: "דני",
      publicUrl: "https://example.com/h/token",
      phoneDigits: "0501234567",
      message: "שלום דני\nhttps://example.com/h/token",
    });
    expect(built.phone).toBe("972501234567");
    expect(built.href).toContain("https://wa.me/972501234567?text=");
    expect(decodeURIComponent(built.href)).toContain("https://example.com/h/token");
  });
});
