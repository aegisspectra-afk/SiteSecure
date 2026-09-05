import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PdfDocumentPreview } from "../src/components/pdf/PdfDocumentPreview";
import {
  clampPdfZoom,
  computeFitScale,
  formatZoomPercent,
  stepPdfZoom,
} from "../src/lib/pdf-preview";

const renderMock = vi.fn();
const destroyDoc = vi.fn(async () => undefined);
const destroyTask = vi.fn(async () => undefined);

vi.mock("../src/lib/pdfjs", () => ({
  ensurePdfjsWorker: vi.fn(),
}));

vi.mock("pdfjs-dist", () => {
  return {
    getDocument: vi.fn(() => {
      const page = {
        getViewport: ({ scale }: { scale: number }) => ({
          width: 595.28 * scale,
          height: 841.89 * scale,
        }),
        render: (params: { canvasContext: CanvasRenderingContext2D }) => {
          renderMock(params);
          return { promise: Promise.resolve(), cancel: vi.fn() };
        },
      };
      const proxy = {
        numPages: 3,
        fingerprints: ["test-doc"],
        getPage: vi.fn(async () => page),
        destroy: destroyDoc,
      };
      return {
        promise: Promise.resolve(proxy),
        destroy: destroyTask,
      };
    }),
  };
});

vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "/mock-worker.js" }));

describe("pdf preview zoom helpers", () => {
  it("minus decreases and plus increases across steps", () => {
    expect(stepPdfZoom(0.75, -1)).toBe(0.5);
    expect(stepPdfZoom(0.75, 1)).toBe(1);
    expect(clampPdfZoom(9)).toBe(1.5);
    expect(formatZoomPercent(0.75)).toBe("75%");
  });

  it("fit mode uses available container width", () => {
    // page width 595.28, container 400, pad 24 → (400-24)/595.28
    const scale = computeFitScale(595.28, 400);
    expect(scale).toBeGreaterThanOrEqual(0.35);
    expect(scale).toBeLessThanOrEqual(1.5);
    expect(scale).toBeCloseTo((400 - 24) / 595.28, 3);
    // Narrow phone must go below the manual 50% floor
    const phone = computeFitScale(595.28, 375);
    expect(phone).toBeLessThan(0.6);
    expect(phone).toBeGreaterThan(0.35);
  });
});

describe("PdfDocumentPreview", () => {
  beforeEach(() => {
    renderMock.mockClear();
    destroyDoc.mockClear();
    // jsdom canvas
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      // minimal 2d stub
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    // ResizeObserver stub
    class RO {
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal("ResizeObserver", RO);
  });

  it("renders one page surface per PDF page (no iframe/object/embed)", async () => {
    const data = new Uint8Array([1, 2, 3, 4]);
    const { container } = render(
      <PdfDocumentPreview
        data={data}
        scale={0.75}
        fitWidth={false}
        preparingLabel="מכין תצוגה מקדימה…"
        errorTitle="לא ניתן להציג את התצוגה המקדימה"
        errorHint="נסה לרענן את התצוגה."
        retryLabel="נסה שוב"
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByTestId("pdf-preview-page")).toHaveLength(3);
    });
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("object")).toBeNull();
    expect(container.querySelector("embed")).toBeNull();
    expect(container.querySelectorAll("canvas").length).toBe(3);
  });

  it("shows preparing state before pages exist", () => {
    render(
      <PdfDocumentPreview
        data={null}
        scale={0.75}
        fitWidth={false}
        preparingLabel="מכין תצוגה מקדימה…"
        errorTitle="err"
        errorHint="hint"
        retryLabel="retry"
      />,
    );
    expect(screen.getByText("מכין תצוגה מקדימה…")).toBeInTheDocument();
  });

  it("shows error state with retry", async () => {
    const onRetry = vi.fn();
    render(
      <PdfDocumentPreview
        data={null}
        scale={0.75}
        fitWidth={false}
        fetchError="network"
        preparingLabel="prep"
        errorTitle="לא ניתן להציג את התצוגה המקדימה"
        errorHint="נסה לרענן את התצוגה."
        retryLabel="נסה שוב"
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("network");
    await userEvent.click(screen.getByRole("button", { name: "נסה שוב" }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe("PDF Template Studio native preview wiring", () => {
  it("does not embed iframe/object/embed for studio preview", () => {
    const src = readFileSync(
      path.resolve(__dirname, "../src/routes/app/settings/pdf-templates.tsx"),
      "utf8",
    );
    expect(src).toContain("PdfDocumentPreview");
    expect(src).not.toMatch(/<iframe[\s>]/);
    expect(src).not.toMatch(/<object[\s>]/);
    expect(src).not.toMatch(/<embed[\s>]/);
    expect(src).toContain("previewGen");
    expect(src).toContain("AbortController");
    expect(src).toContain("downloadAndOpenPdf");
  });

  it("open PDF reuses cached blob when available", () => {
    const src = readFileSync(
      path.resolve(__dirname, "../src/routes/app/settings/pdf-templates.tsx"),
      "utf8",
    );
    expect(src).toContain("if (pdfBlob) return { blob: pdfBlob");
    expect(src).not.toContain("createObjectURL");
  });
});
