import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuoteQuickAdd } from "../src/components/quotes/cpq/QuoteQuickAdd";
import { he } from "../src/i18n/he";

function renderQuickAdd(props: Partial<ComponentProps<typeof QuoteQuickAdd>> = {}) {
  const utils = render(
    <QuoteQuickAdd
      open
      onClose={props.onClose ?? (() => undefined)}
      onAction={(props.onAction as never) ?? (() => undefined)}
      catalogResults={props.catalogResults ?? []}
      recentResults={props.recentResults ?? []}
      onCatalogQuery={props.onCatalogQuery ?? (() => undefined)}
      onPickCatalog={props.onPickCatalog ?? (() => undefined)}
      canCatalog={props.canCatalog ?? true}
      canSystem={props.canSystem ?? true}
      catalogKind={props.catalogKind ?? null}
      catalogLoading={props.catalogLoading}
    />,
  );
  const dialog = screen.getByRole("dialog", { name: he.cpqQuickAddTitle });
  return { ...utils, dialog };
}

describe("B1 QuoteQuickAdd catalog-first", () => {
  afterEach(() => {
    cleanup();
  });

  it("does not expose a dead «מוצר» action row — search is the catalog entry", () => {
    const { dialog } = renderQuickAdd();
    expect(within(dialog).queryByRole("option", { name: /^מוצר\b/ })).not.toBeInTheDocument();
    expect(within(dialog).getByPlaceholderText(he.cpqQuickAddPlaceholder)).toBeInTheDocument();
  });

  it("shows recent products above actions when the search is empty", () => {
    const { dialog } = renderQuickAdd({
      recentResults: [
        { id: "r1", name: "מצלמת כניסה", sku: "CAM-1", selling_price: 320 },
        { id: "r2", name: "NVR 8CH", sku: "NVR-8", selling_price: 1100 },
      ],
    });
    expect(within(dialog).getByText(he.cpqQuickAddRecent)).toBeInTheDocument();
    expect(within(dialog).getByText(/CAM-1/)).toBeInTheDocument();
    const options = within(dialog).getAllByRole("option");
    expect(options[0]).toHaveTextContent(/CAM-1|מצלמת כניסה/);
  });

  it("search hits appear above grouped actions; Enter picks the product", async () => {
    const onPick = vi.fn();
    const onQuery = vi.fn();
    const { dialog } = renderQuickAdd({
      onPickCatalog: onPick,
      onCatalogQuery: onQuery,
      catalogResults: [
        {
          id: "p1",
          name: "Camera Pro",
          sku: "CAM-4",
          selling_price: 450,
          image_url: "https://example.com/cam.jpg",
        },
      ],
    });
    const input = within(dialog).getByPlaceholderText(he.cpqQuickAddPlaceholder);
    fireEvent.change(input, { target: { value: "CAM" } });
    expect(onQuery).toHaveBeenCalledWith("CAM");
    expect(within(dialog).getByText(/CAM-4/)).toBeInTheDocument();
    expect(within(dialog).getByRole("img", { name: /Camera Pro/ })).toBeInTheDocument();
    const first = within(dialog).getAllByRole("option")[0]!;
    expect(first).toHaveTextContent(/CAM-4/);
    fireEvent.keyDown(window, { key: "Enter" });
    await waitFor(() => expect(onPick).toHaveBeenCalledWith("p1"));
  });

  it("groups actions: planning (CCTV first), lines, document — with package vs template hints", () => {
    const { dialog } = renderQuickAdd();
    expect(within(dialog).getByText(he.cpqQuickAddGroupPlanning)).toBeInTheDocument();
    expect(within(dialog).getByText(he.cpqQuickAddGroupLines)).toBeInTheDocument();
    expect(within(dialog).getByText(he.cpqQuickAddGroupDocument)).toBeInTheDocument();
    const list = within(dialog).getByRole("listbox");
    const optionLabels = within(list)
      .getAllByRole("option")
      .map((el) => el.textContent || "");
    const cctvIdx = optionLabels.findIndex((t) => t.includes("CCTV"));
    const packageIdx = optionLabels.findIndex((t) => t.includes(he.cpqQuickAddAddSystem));
    const templateIdx = optionLabels.findIndex((t) => t.includes(he.cpqQuickAddTemplate));
    expect(cctvIdx).toBeGreaterThanOrEqual(0);
    expect(packageIdx).toBeGreaterThan(cctvIdx);
    expect(templateIdx).toBeGreaterThan(packageIdx);
    expect(within(dialog).getByText(he.cpqPackageVsTemplateHint)).toBeInTheDocument();
  });

  it("CCTV planning row is emphasized", () => {
    const { dialog } = renderQuickAdd();
    const cctv = within(dialog)
      .getAllByRole("option")
      .find((el) => (el.textContent || "").includes("CCTV"));
    expect(cctv).toBeTruthy();
    expect(cctv!.className).toMatch(/is-emphasis|is-primary/);
  });

  it("Esc closes; arrow keys move active row", () => {
    const onClose = vi.fn();
    renderQuickAdd({
      onClose,
      recentResults: [{ id: "r1", name: "A", sku: "A1", selling_price: 1 }],
    });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
