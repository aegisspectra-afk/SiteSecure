import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ApiClient } from "@site-secure/api-client";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { NewInstallJobDialog } from "../src/components/jobs/NewInstallJobDialog";

beforeAll(() => {
  // jsdom has no <dialog> modal support.
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

function renderDialog(api: Partial<ApiClient>, onCreated = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <NewInstallJobDialog
        open
        onClose={() => {}}
        api={api as ApiClient}
        workspaceId="ws"
        canAssign={false}
        job={{ title: "התקנה", customer_id: "c", site_id: "s", project_id: "p" }}
        onCreated={onCreated}
      />
    </QueryClientProvider>,
  );
  return onCreated;
}

describe("DEMO-3.3 a second click never creates a second job", () => {
  it("the button is disabled while sending, so two clicks make one request", async () => {
    let release: () => void = () => {};
    const createJob = vi.fn(() => new Promise((resolve) => (release = () => resolve({ id: "j1" }))));
    const onCreated = renderDialog({ createJob } as never);
    const submit = screen.getByTestId("new-install-job-submit");
    fireEvent.click(submit);
    await waitFor(() => expect(submit).toBeDisabled());
    fireEvent.click(submit);
    release();
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(createJob).toHaveBeenCalledTimes(1);
  });

  it("two clicks in the same instant (before React re-renders) still make one request", async () => {
    const createJob = vi.fn(async () => ({ id: "j1" }));
    const onCreated = renderDialog({ createJob } as never);
    const submit = screen.getByTestId("new-install-job-submit");
    fireEvent.click(submit);
    fireEvent.click(submit); // no await in between: the button is not disabled yet
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(createJob).toHaveBeenCalledTimes(1);
  });

  it("a retry after a failure sends the same Idempotency-Key", async () => {
    const createJob = vi
      .fn()
      .mockRejectedValueOnce(new Error("רשת"))
      .mockResolvedValueOnce({ id: "j1" });
    const onCreated = renderDialog({ createJob } as never);
    fireEvent.click(screen.getByTestId("new-install-job-submit"));
    await waitFor(() => expect(createJob).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId("new-install-job-submit")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("new-install-job-submit"));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    const keys = createJob.mock.calls.map((call) => (call[2] as { idempotencyKey: string }).idempotencyKey);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
  });
});
