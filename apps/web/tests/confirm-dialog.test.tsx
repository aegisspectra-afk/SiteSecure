import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "../src/components/ui/ConfirmDialog";
import { he } from "../src/i18n/he";

describe("ConfirmDialog", () => {
  it("calls onConfirm without using window.confirm", async () => {
    const spy = vi.spyOn(window, "confirm");
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="ביטול הצעה"
        body="האם לבטל?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByTestId("system-confirm-dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("system-confirm-accept"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("exposes Hebrew confirm label", () => {
    expect(he.confirm).toBe("אישור");
  });
});
