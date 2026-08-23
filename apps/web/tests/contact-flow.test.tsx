import { QueryClient } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuoteFlowSheet } from "../src/components/quotes/quote-creation/QuoteFlowSheet";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("QuoteFlowSheet focus", () => {
  it("does not steal focus back to autofocus field while typing in another input", async () => {
    const focusCalls: string[] = [];
    const originalFocus = HTMLElement.prototype.focus;
    vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (this: HTMLElement, ...args) {
      focusCalls.push(this.getAttribute("data-testid") ?? this.getAttribute("aria-label") ?? this.tagName);
      return originalFocus.apply(this, args as []);
    });

    function Harness() {
      // New onClose identity every render — historically re-triggered autofocus.
      const [open, setOpen] = useState(true);
      const [name, setName] = useState("");
      const [phone, setPhone] = useState("");
      return (
        <QuoteFlowSheet open={open} onClose={() => setOpen(false)} title="איש קשר חדש">
          <div className="grid gap-3">
            <label>
              שם
              <input
                data-autofocus
                data-testid="contact-name"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
              />
            </label>
            <label>
              טלפון
              <input
                data-testid="contact-phone"
                value={phone}
                onChange={(ev) => setPhone(ev.target.value)}
              />
            </label>
          </div>
        </QuoteFlowSheet>
      );
    }

    render(<Harness />);
    await waitFor(() => screen.getByTestId("contact-name"));

    const phone = screen.getByTestId("contact-phone");
    phone.focus();
    expect(document.activeElement).toBe(phone);

    const focusesBeforeType = focusCalls.filter((id) => id === "contact-name").length;

    fireEvent.change(phone, { target: { value: "0501234567" } });

    // Re-query after re-render (avoid stale node identity).
    const phoneAfter = screen.getByTestId("contact-phone");
    const nameAfter = screen.getByTestId("contact-name");
    expect(document.activeElement).toBe(phoneAfter);
    expect(document.activeElement).not.toBe(nameAfter);
    expect((phoneAfter as HTMLInputElement).value).toBe("0501234567");

    fireEvent.change(phoneAfter, { target: { value: "05012345678" } });
    expect(document.activeElement).toBe(screen.getByTestId("contact-phone"));

    const focusesAfterType = focusCalls.filter((id) => id === "contact-name").length;
    expect(focusesAfterType).toBe(focusesBeforeType);
  });
});

describe("customer contact cache update", () => {
  it("appends created contact into the customer-contacts query cache", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const key = ["customer-contacts", "ws", "c1"] as const;
    client.setQueryData(key, []);

    const created = {
      id: "ct1",
      customer_id: "c1",
      full_name: "ישראל ישראלי",
      phone: "0501234567",
      email: "israel@example.com",
      is_primary: true,
    };

    client.setQueryData(key, (prev: typeof created[] | undefined) => {
      const list = prev ?? [];
      if (list.some((row) => row.id === created.id)) return list;
      return [...list, created];
    });

    expect(client.getQueryData(key)).toEqual([created]);
  });
});
