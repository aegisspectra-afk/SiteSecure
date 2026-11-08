import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignaturePad } from "../src/components/quotes/SignaturePad";

// jsdom has no canvas: a minimal 2D context is enough to drive the pad's pointer logic.
const ctx = {
  setTransform: vi.fn(),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  drawImage: vi.fn(),
  fillStyle: "",
  strokeStyle: "",
  lineWidth: 0,
  lineCap: "",
  lineJoin: "",
};

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,SIGNED");
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function sign(canvas: HTMLCanvasElement) {
  fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 10 });
  fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 40, clientY: 30 });
  fireEvent.pointerUp(canvas, { pointerId: 1 });
}

describe("SignaturePad", () => {
  it("reports the signature after a stroke", () => {
    const onChange = vi.fn();
    const { container } = render(<SignaturePad onChange={onChange} />);
    sign(container.querySelector("canvas")!);
    expect(onChange).toHaveBeenLastCalledWith("data:image/png;base64,SIGNED");
  });

  it("keeps the signature when only the window height changes (mobile toolbar / scroll)", () => {
    const onChange = vi.fn();
    const { container } = render(<SignaturePad onChange={onChange} />);
    sign(container.querySelector("canvas")!);
    onChange.mockClear();
    window.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("resize"));
    expect(onChange).not.toHaveBeenCalledWith(null);
    expect(ctx.fillRect).toHaveBeenCalledTimes(1); // only the initial blank fill
  });
});
