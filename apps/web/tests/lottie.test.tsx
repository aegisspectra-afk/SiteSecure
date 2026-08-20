import { render, screen } from "@testing-library/react";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LOTTIE_ANIMATIONS, LottieAnimation, type LottieName } from "../src/components/lottie";

const assetsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/assets/lottie");

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

describe("Lottie registry", () => {
  it("only registers files that exist in production assets", () => {
    const names = Object.keys(LOTTIE_ANIMATIONS) as LottieName[];
    expect(names).toEqual(["securityShield", "scan", "success", "sentEmail", "networkConnecting"]);
    for (const name of names) {
      const entry = LOTTIE_ANIMATIONS[name];
      expect(existsSync(path.join(assetsDir, entry.file))).toBe(true);
      expect(entry.usage.purpose.trim().length).toBeGreaterThan(20);
    }
  });

  it("keeps reduced-motion decorative and sized", () => {
    mockMatchMedia(true);
    const { container } = render(<LottieAnimation name="success" size={72} />);
    const host = container.firstElementChild as HTMLElement;
    expect(host).toHaveAttribute("aria-hidden", "true");
    expect(host.style.width).toBe("72px");
    expect(host.style.height).toBe("72px");
  });

  it("exposes an accessible name when the animation is meaningful", () => {
    mockMatchMedia(true);
    render(<LottieAnimation name="scan" label="סורק" />);
    expect(screen.getByRole("img", { name: "סורק" })).toBeInTheDocument();
  });
});
