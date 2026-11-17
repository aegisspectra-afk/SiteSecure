import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { SendQuoteConfirm } from "../src/components/quotes/SendQuoteConfirm";
import { LOTTIE_ANIMATIONS } from "../src/components/lottie/lottie-registry";
import { he } from "../src/i18n/he";

const EMAIL_SENT_LIES = ["המייל נשלח", "email sent", "sent an email", "we emailed"];

function assertNoEmailSentLie(text: string) {
  const lower = text.toLowerCase();
  for (const lie of EMAIL_SENT_LIES) {
    expect(lower).not.toContain(lie.toLowerCase());
  }
  expect(text).not.toMatch(/(?<!לא )נשלח מייל/);
}

describe("T2-3 quote send honesty", () => {
  beforeEach(() => {
    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = function showModal() {
        this.setAttribute("open", "");
      };
    }
    if (!HTMLDialogElement.prototype.close) {
      HTMLDialogElement.prototype.close = function close() {
        this.removeAttribute("open");
      };
    }
  });

  it("send confirm offers a copy-link path and never claims email was sent", () => {
    render(
      <SendQuoteConfirm
        open
        onClose={() => undefined}
        onConfirm={() => undefined}
        customer="לקוח"
        number="Q-1"
        amount={100}
        canSend
      />,
    );

    expect(screen.getByText(he.cpqCopySecureLink)).toBeTruthy();
    expect(screen.getByText(he.quoteMailtoShareHint)).toBeTruthy();
    expect(screen.getByText(he.cpqSendHowLead)).toBeTruthy();
    expect(screen.getByRole("button", { name: he.quoteSendAction })).toBeTruthy();
    assertNoEmailSentLie(document.body.textContent ?? "");
  });

  it("margin below threshold is explained in Hebrew", () => {
    expect(he.quoteMarginBlocksSend).toBe("מרווח מתחת לסף. נדרשת הרשאת דריסת מחיר כדי לשלוח.");
  });

  it("post-send copy says copy the link, not that email was sent", () => {
    expect(he.quoteSentNoEmail).toContain("לא נשלח מייל");
    expect(he.quoteSentNoEmail).toContain("הקישור");
    expect(he.quoteSentTitle).toContain("סומנה כנשלחה");
    expect(he.quoteMailtoShareHint).toContain("אין שליחת מייל מובנית");
    assertNoEmailSentLie(
      [he.quoteSentTitle, he.quoteSentNoEmail, he.quoteSentLockedHint, he.quoteMailtoShareHint, he.quoteShareDialogLead].join(
        "\n",
      ),
    );
  });

  it("post-send honesty card includes שלח בוואטסאפ next to the public link", async () => {
    const { QuoteSentHonesty } = await import("../src/components/quotes/QuoteSentHonesty");
    const { render, screen } = await import("@testing-library/react");
    render(<QuoteSentHonesty publicUrl="https://app.example/q/y" customerName="לקוח" phoneDigits="0501112233" />);
    const card = screen.getByTestId("quote-sent-honesty");
    expect(card.querySelector("a")?.getAttribute("href")).toBe("https://app.example/q/y");
    expect(screen.getByRole("button", { name: he.jobWhatsApp })).toBeEnabled();
  });

  it("does not use the outbound-email animation for quote send", () => {
    expect(LOTTIE_ANIMATIONS.sentEmail.usage.where.toLowerCase()).not.toContain("quotebuilder");
    expect(LOTTIE_ANIMATIONS.sentEmail.usage.where.toLowerCase()).toContain("forgot-password");
  });
});
