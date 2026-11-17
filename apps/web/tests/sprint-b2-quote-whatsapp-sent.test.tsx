import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { QuoteSentHonesty } from "../src/components/quotes/QuoteSentHonesty";
import { he } from "../src/i18n/he";

describe("Sprint B.2 WhatsApp after quote send", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      open: vi.fn(() => ({ closed: false, location: { href: "" }, close: vi.fn() })),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("disables שלח בוואטסאפ when there is no valid Israeli mobile", () => {
    render(<QuoteSentHonesty publicUrl="https://app.example/q/tok" customerName="אורן" phoneDigits="" />);
    const btn = screen.getByTestId("quote-whatsapp-share");
    expect(btn).toHaveTextContent(he.jobWhatsApp);
    expect(btn).toBeDisabled();
    expect(screen.getByText(he.jobWhatsAppDisabledHint)).toBeInTheDocument();
  });

  it("opens wa.me with the public quote link when mobile is valid", () => {
    const open = vi.fn(() => ({ closed: false, location: { href: "" }, close: vi.fn() }));
    vi.stubGlobal("window", { open });
    render(
      <QuoteSentHonesty publicUrl="https://app.example/q/tok-abc" customerName="אורן" phoneDigits="0501234567" />,
    );
    const btn = screen.getByTestId("quote-whatsapp-share");
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(open).toHaveBeenCalled();
    const href = String(open.mock.calls[0]?.[0] ?? "");
    // openSharePlaceholderTab opens about:blank first; resolve navigates the placeholder.
    // When placeholder exists, location.href is set — check via second path: navigateShareTab.
    const placeholder = open.mock.results[0]?.value as { location: { href: string } };
    const navigated = placeholder?.location?.href || href;
    expect(navigated).toContain("https://wa.me/972501234567?text=");
    expect(decodeURIComponent(navigated)).toContain("https://app.example/q/tok-abc");
    expect(decodeURIComponent(navigated)).toContain("אורן");
  });

  it("keeps WhatsApp in the same post-send card as the public link", () => {
    render(<QuoteSentHonesty publicUrl="https://app.example/q/x" customerName="בדיקה" phoneDigits="0521234567" />);
    const card = screen.getByTestId("quote-sent-honesty");
    expect(card.querySelector("a")?.getAttribute("href")).toBe("https://app.example/q/x");
    expect(card.querySelector("[data-testid=quote-whatsapp-share]")).toBeTruthy();
  });
});
