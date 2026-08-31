import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuoteSectionNameField } from "../src/components/quotes/cpq/QuoteSectionNameField";
import { he } from "../src/i18n/he";

describe("QuoteSectionNameField", () => {
  it("debounces section rename persistence while focused", async () => {
    vi.useFakeTimers();
    const onPersist = vi.fn(async () => undefined);
    render(
      <QuoteSectionNameField sectionId="sec1" name="מצלמות" canEdit onPersist={onPersist} />,
    );

    const input = screen.getByLabelText(he.cpqAddSection) as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "ה" } });
    fireEvent.change(input, { target: { value: "הת" } });
    fireEvent.change(input, { target: { value: "התקנה ושירותים" } });

    expect(onPersist).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });

    expect(onPersist).toHaveBeenCalledTimes(1);
    expect(onPersist).toHaveBeenCalledWith("sec1", "התקנה ושירותים");
    vi.useRealTimers();
  });

  it("flushes the final section name on blur", async () => {
    const onPersist = vi.fn(async () => undefined);
    render(
      <QuoteSectionNameField sectionId="sec1" name="מצלמות" canEdit onPersist={onPersist} />,
    );

    const input = screen.getByLabelText(he.cpqAddSection) as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "הקלטה" } });
    fireEvent.blur(input);

    await waitFor(() => expect(onPersist).toHaveBeenCalledTimes(1));
    expect(onPersist).toHaveBeenCalledWith("sec1", "הקלטה");
  });

  it("does not let stale server props overwrite active typing", async () => {
    function Harness() {
      const [name, setName] = useState("מצלמות");
      const onPersist = vi.fn(async (_id: string, next: string) => {
        await new Promise((r) => setTimeout(r, 30));
        setName(next);
      });
      return (
        <>
          <QuoteSectionNameField sectionId="sec1" name={name} canEdit onPersist={onPersist} />
          <button type="button" onClick={() => setName("ישן")}>
            stale refresh
          </button>
        </>
      );
    }

    render(<Harness />);
    const input = screen.getByLabelText(he.cpqAddSection) as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "התקנה ושירותים" } });
    expect(input.value).toBe("התקנה ושירותים");

    fireEvent.click(screen.getByRole("button", { name: "stale refresh" }));
    expect(input.value).toBe("התקנה ושירותים");
  });
});
