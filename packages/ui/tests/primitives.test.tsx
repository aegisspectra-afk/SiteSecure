import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "../src/Button";
import { Checkbox } from "../src/Controls";
import { Input } from "../src/Field";
import { ProgressList } from "../src/ProgressList";
import { Status } from "../src/Display";

describe("Button", () => {
  it("keeps a verb label while loading and is not pressable", () => {
    render(
      <Button loading variant="primary">
        התחבר
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "התחבר" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn.className).toContain("bg-action");
  });

  it("exposes a loading label to assistive tech when provided", () => {
    render(
      <Button loading loadingLabel="AUTHENTICATING..." variant="primary">
        התחבר
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "AUTHENTICATING..." });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });

  it("disabled does not look like a primary action", () => {
    const { rerender } = render(<Button variant="primary">שלח הצעת מחיר</Button>);
    const enabled = screen.getByRole("button");
    expect(enabled).not.toBeDisabled();
    rerender(
      <Button variant="primary" disabled>
        שלח הצעת מחיר
      </Button>,
    );
    const disabled = screen.getByRole("button");
    expect(disabled).toBeDisabled();
    expect(disabled.className).toContain("cursor-not-allowed");
    expect(disabled.className).toContain("bg-bg-subtle");
    expect(disabled.className).not.toContain("bg-action");
  });
});

describe("ProgressList", () => {
  it("does not mark upcoming steps as done", () => {
    render(
      <ProgressList
        steps={[
          { id: "a", label: "חשבון", state: "done" },
          { id: "b", label: "סביבת עבודה", state: "current" },
          { id: "c", label: "לקוח ראשון", state: "upcoming" },
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items[0].textContent).toContain("✓");
    expect(items[1].textContent).toContain("●");
    expect(items[2].textContent).toContain("○");
    expect(items[2].textContent).not.toContain("✓");
  });
});

describe("Status", () => {
  it("shows Hebrew status text not a raw enum", () => {
    render(<Status label="ממתין לאישור הלקוח" tone="warning" />);
    expect(screen.getByText("ממתין לאישור הלקוח")).toBeInTheDocument();
    expect(screen.queryByText("PENDING_APPROVAL")).not.toBeInTheDocument();
  });

  it("marks info with the info token, not the primary action fill", () => {
    const { container } = render(<Status label="נשלחה" tone="info" />);
    const dot = container.querySelector("[aria-hidden]");
    expect(dot?.className).toContain("bg-info");
    expect(dot?.className).not.toContain("bg-action");
  });
});

describe("Checkbox", () => {
  it("can hide the label from the visual tree while keeping it accessible", () => {
    render(<Checkbox hideLabel label="בחירת Q-00009" />);
    expect(screen.queryByText("בחירת Q-00009")).not.toBeInTheDocument();
    expect(screen.getByLabelText("בחירת Q-00009")).toBeInTheDocument();
  });
});

describe("Input", () => {
  it("reveals and hides a password without leaving the control unlabeled", () => {
    render(<Input id="password" label="סיסמה" revealable />);
    const field = screen.getByLabelText("סיסמה");
    expect(field).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "הצג סיסמה" }));
    expect(field).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "הסתר סיסמה" }));
    expect(field).toHaveAttribute("type", "password");
  });
});
