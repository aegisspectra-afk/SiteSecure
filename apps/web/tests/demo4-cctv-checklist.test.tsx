import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ApiClient, JobChecklistItem } from "@site-secure/api-client";
import { describe, expect, it, vi } from "vitest";
import { checklistProgress, JobChecklist } from "../src/components/jobs/JobChecklist";
import { he } from "../src/i18n/he";

const base = { completed: false, not_applicable: false, notes: null, photo_document_id: null, template_key: "cctv_installation_v1" };
const items: JobChecklistItem[] = [
  { ...base, id: "i1", item_key: "site_walkthrough", label_he: "סיור באתר", required: true, photo_required: false, allow_na: false },
  { ...base, id: "i2", item_key: "cabling", label_he: "כבילה", required: true, photo_required: true, allow_na: false },
  { ...base, id: "i3", item_key: "poe_switch", label_he: "מתג PoE", required: true, photo_required: false, allow_na: true },
  { ...base, id: "i4", item_key: "labeling", label_he: "סימון", required: false, photo_required: false, allow_na: true,
    completed: true, completed_by_name: "טכנאי דמו", completed_at: "2026-11-17T08:05:00Z" },
];

function view(onPatch = vi.fn(async () => ({})), onUploadPhoto = vi.fn(async () => "doc-1"), list = items, locked = false) {
  const api = { getDocumentUrl: vi.fn(async () => ({ url: "https://example.test/p.jpg" })) } as unknown as ApiClient;
  render(
    <QueryClientProvider client={new QueryClient()}>
      <JobChecklist api={api} workspaceId="ws" items={list} locked={locked} online onPatch={onPatch} onUploadPhoto={onUploadPhoto} />
    </QueryClientProvider>,
  );
  const row = (key: string) => screen.getAllByTestId("checklist-row").find((r) => r.getAttribute("data-key") === key)!;
  return { onPatch, onUploadPhoto, row };
}

describe("DEMO-4.3 CCTV checklist", () => {
  it("progress counts done and N/A, and says how many required items are left", () => {
    expect(checklistProgress(items)).toEqual({ done: 1, total: 4, requiredLeft: 3 });
    view();
    expect(screen.getByTestId("job-checklist-progress")).toHaveTextContent("1/4");
    expect(screen.getByTestId("job-checklist-progress")).toHaveTextContent(he.checklistRequiredLeft(3));
  });

  it("marks required items and shows who marked and when", () => {
    const { row } = view();
    expect(within(row("site_walkthrough")).getByText(he.checklistRequired)).toBeInTheDocument();
    expect(within(row("labeling")).getByTestId("checklist-marked-by")).toHaveTextContent("סומן ע״י טכנאי דמו");
  });

  it("a photo item cannot be ticked until a photo is attached; the photo is uploaded then linked", async () => {
    const { row, onPatch, onUploadPhoto } = view();
    const cabling = row("cabling");
    expect(within(cabling).getByRole("checkbox")).toBeDisabled();
    expect(within(cabling).getByText(he.checklistPhotoNeeded)).toBeInTheDocument();
    const file = new File(["x"], "cable.jpg", { type: "image/jpeg" });
    fireEvent.change(within(cabling).getByTestId("checklist-photo-input"), { target: { files: [file] } });
    await waitFor(() => expect(onPatch).toHaveBeenCalledWith("i2", { photo_document_id: "doc-1" }));
    expect(onUploadPhoto).toHaveBeenCalledWith(file);
  });

  it("'לא רלוונטי' only where the template allows it", async () => {
    const { row, onPatch } = view();
    expect(within(row("site_walkthrough")).queryByTestId("checklist-na")).not.toBeInTheDocument();
    fireEvent.click(within(row("poe_switch")).getByTestId("checklist-na"));
    await waitFor(() => expect(onPatch).toHaveBeenCalledWith("i3", { not_applicable: true }));
  });

  it("notes are saved on blur", async () => {
    const { row, onPatch } = view();
    const r = row("site_walkthrough");
    fireEvent.click(within(r).getByRole("button", { name: he.checklistNote }));
    const box = within(r).getByTestId("checklist-notes");
    fireEvent.change(box, { target: { value: "  אושר עם הלקוח  " } });
    fireEvent.blur(box);
    await waitFor(() => expect(onPatch).toHaveBeenCalledWith("i1", { notes: "אושר עם הלקוח" }));
  });

  it("a locked checklist has no actions", () => {
    view(undefined, undefined, items, true);
    expect(screen.queryByTestId("checklist-na")).not.toBeInTheDocument();
    expect(screen.getAllByRole("checkbox").every((c) => (c as HTMLInputElement).disabled)).toBe(true);
  });
});
