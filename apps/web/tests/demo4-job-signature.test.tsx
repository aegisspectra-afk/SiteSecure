import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ApiClient } from "@site-secure/api-client";
import { describe, expect, it, vi } from "vitest";
import { JobSignatureSection } from "../src/components/jobs/JobSignatureSection";
import { he } from "../src/i18n/he";

// jsdom has no canvas: a button stands in for drawing.
vi.mock("../src/components/quotes/SignaturePad", () => ({
  SignaturePad: ({ onChange }: { onChange: (v: string | null) => void }) => (
    <button type="button" data-testid="fake-draw" onClick={() => onChange("data:image/png;base64,AAAA")}>
      draw
    </button>
  ),
}));

function view(api: Partial<ApiClient>, job: Record<string, unknown>, canSign = true) {
  const onSigned = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <JobSignatureSection api={api as ApiClient} workspaceId="ws" job={job as never} canSign={canSign} online onSigned={onSigned} />
    </QueryClientProvider>,
  );
  return onSigned;
}

describe("DEMO-4.1 customer signature on the job", () => {
  it("needs a name and a drawing, then saves once", async () => {
    const signJob = vi.fn(async () => ({}));
    const onSigned = view({ signJob } as never, { id: "j1", status: "in_progress" });
    const save = screen.getByTestId("job-signature-save");
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText(he.jobSignatureSignerName), { target: { value: " דני  אורן " } });
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByTestId("fake-draw"));
    expect(save).not.toBeDisabled();
    fireEvent.click(save);
    fireEvent.click(save);
    await waitFor(() => expect(onSigned).toHaveBeenCalled());
    expect(signJob).toHaveBeenCalledTimes(1);
    expect(signJob).toHaveBeenCalledWith("ws", "j1", { signer_name: "דני  אורן", signature_data_url: "data:image/png;base64,AAAA" });
  });

  it("shows the signature, the signer and the date once signed", async () => {
    const getDocumentUrl = vi.fn(async () => ({ url: "https://example.test/s.png" }));
    view({ getDocumentUrl } as never, {
      id: "j1",
      status: "completed",
      customer_signature_document_id: "d1",
      customer_signer_name: "דני אורן",
      customer_signed_at: "2026-11-17T08:30:00Z",
    });
    expect(screen.getByTestId("job-signature-signer")).toHaveTextContent("נחתם על ידי דני אורן");
    await waitFor(() => expect(screen.getByRole("img")).toHaveAttribute("src", "https://example.test/s.png"));
    expect(getDocumentUrl).toHaveBeenCalledWith("ws", "d1");
    expect(screen.queryByTestId("job-signature-form")).not.toBeInTheDocument();
  });

  it("no form before arriving on site or without permission", () => {
    view({} as never, { id: "j1", status: "scheduled" });
    expect(screen.queryByTestId("job-signature-form")).not.toBeInTheDocument();
    expect(screen.getByTestId("job-signature-missing")).toHaveTextContent(he.jobSignatureWhenOnSite);
  });
});
