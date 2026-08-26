import { describe, expect, it } from "vitest";
import {
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
