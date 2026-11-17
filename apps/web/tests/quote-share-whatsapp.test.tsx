import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuoteShareDialog } from "../src/components/quotes/QuoteShareDialog";

describe("QuoteShareDialog WhatsApp gate", () => {
  it("disables WhatsApp with an explanation when there is no valid mobile", () => {
    render(
      <QuoteShareDialog
        open
        url="https://example.com/q/token"
        onClose={() => undefined}
        onWhatsApp={() => undefined}
        whatsappDisabled
      />,
    );
    const btn = screen.getByRole("button", { name: /WhatsApp/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/אין מספר נייד תקין/)).toBeTruthy();
  });

  it("keeps WhatsApp enabled when a valid mobile is available", () => {
    const onWhatsApp = vi.fn();
    render(
      <QuoteShareDialog
        open
        url="https://example.com/q/token"
        onClose={() => undefined}
        onWhatsApp={onWhatsApp}
        whatsappDisabled={false}
      />,
    );
    expect(screen.getByRole("button", { name: /WhatsApp/i })).not.toBeDisabled();
  });
});
