import { readFileSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemePicker } from "../src/components/ThemePicker";
import { UserAccountMenu } from "../src/components/UserAccountMenu";
import { he } from "../src/i18n/he";
import {
  THEME_STORAGE_KEY,
  applyDocumentTheme,
  parseThemeMode,
  readThemeMode,
  resolveTheme,
  setThemeMode,
  startThemeRuntime,
} from "../src/lib/theme";

function mockScheme(dark: boolean, reduced = false) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query.includes("prefers-color-scheme: dark")
        ? dark
        : query.includes("prefers-reduced-motion: reduce")
          ? reduced
          : false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    }),
  });
}

afterEach(() => {
  window.localStorage.removeItem(THEME_STORAGE_KEY);
  document.documentElement.classList.remove("dark", "theme-revealing");
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.themeMode;
  document.documentElement.style.colorScheme = "";
});

describe("theme helpers", () => {
  it("defaults invalid storage to system", () => {
    expect(parseThemeMode(null)).toBe("system");
    expect(parseThemeMode("solarized")).toBe("system");
    expect(parseThemeMode("dark")).toBe("dark");
  });

  it("resolves system from prefers-color-scheme", () => {
    mockScheme(true);
    expect(resolveTheme("system")).toBe("dark");
    mockScheme(false);
    expect(resolveTheme("system")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
    expect(resolveTheme("light")).toBe("light");
  });

  it("persists the mode and applies the resolved class before paint logic", () => {
    mockScheme(false);
    setThemeMode("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(readThemeMode()).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.themeMode).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");

    setThemeMode("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.dataset.theme).toBe("light");

    mockScheme(true);
    setThemeMode("system");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.dataset.themeMode).toBe("system");
  });

  it("follows OS changes while mode is system, and ignores them when pinned", () => {
    const listeners = new Set<(event: Event) => void>();
    let dark = false;
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        get matches() {
          return query.includes("prefers-color-scheme: dark") ? dark : false;
        },
        media: query,
        addEventListener(_type: string, fn: (event: Event) => void) {
          if (query.includes("prefers-color-scheme: dark")) listeners.add(fn);
        },
        removeEventListener(_type: string, fn: (event: Event) => void) {
          listeners.delete(fn);
        },
        addListener() {},
        removeListener() {},
        dispatchEvent() {
          return false;
        },
      }),
    });
    window.localStorage.setItem(THEME_STORAGE_KEY, "system");
    const stop = startThemeRuntime();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    dark = true;
    listeners.forEach((fn) => fn(new Event("change")));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    setThemeMode("light");
    dark = true;
    listeners.forEach((fn) => fn(new Event("change")));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    stop();
  });

  it("does not start a view transition when motion is reduced", () => {
    mockScheme(false, true);
    const start = vi.fn();
    document.startViewTransition = start;
    setThemeMode("dark", { x: 12, y: 20 });
    expect(start).not.toHaveBeenCalled();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    delete document.startViewTransition;
  });

  it("invokes startViewTransition as a document method", () => {
    mockScheme(false);
    const start = vi.fn(function (this: Document, update?: () => void) {
      if (this !== document) throw new TypeError("Illegal invocation");
      update?.();
      return {
        finished: Promise.resolve(),
        ready: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
        types: new Set<string>(),
        skipTransition() {},
      };
    }) as unknown as typeof document.startViewTransition;
    document.startViewTransition = start;
    setThemeMode("dark", { x: 12, y: 20 });
    expect(start).toHaveBeenCalledTimes(1);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    delete document.startViewTransition;
  });
});

describe("theme boot", () => {
  it("inlines persistence and prefers-color-scheme before the app module", () => {
    const html = readFileSync(path.resolve(__dirname, "../index.html"), "utf8");
    const boot = html.split('<div id="root"')[0] ?? "";
    expect(boot).toContain("site-secure-theme");
    expect(boot).toContain("prefers-color-scheme");
    expect(boot).toContain('classList.toggle("dark"');
    expect(boot.indexOf("site-secure-theme")).toBeLessThan(boot.indexOf('src="/src/main.tsx"') === -1 ? boot.length : boot.indexOf('src="/src/main.tsx"'));
    expect(html).toContain('meta name="color-scheme"');
  });
});

describe("theme picker", () => {
  it("exposes light, dark and system as a radiogroup, not a two-state toggle", () => {
    mockScheme(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, "system");
    applyDocumentTheme("system");
    render(<ThemePicker />);
    const group = screen.getByRole("radiogroup", { name: he.themeLabel });
    expect(within(group).getByRole("radio", { name: he.themeLight })).toHaveAttribute("aria-checked", "false");
    expect(within(group).getByRole("radio", { name: he.themeDark })).toHaveAttribute("aria-checked", "false");
    expect(within(group).getByRole("radio", { name: he.themeSystem })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(within(group).getByRole("radio", { name: he.themeDark }));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("is available in the account menu for every signed-in role", () => {
    mockScheme(false);
    render(
      <UserAccountMenu
        displayName="ilya kerner"
        email="aegisspectra@gmail.com"
        roleKey="technician"
        planKey="solo"
        canSettings={false}
        canSecurity={false}
        onSettings={vi.fn()}
        onSecurity={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: he.userMenu }));
    const panel = screen.getByRole("dialog", { name: he.userMenu });
    expect(within(panel).getByRole("radiogroup", { name: he.themeLabel })).toBeInTheDocument();
    expect(within(panel).getByRole("radio", { name: he.themeLight })).toBeInTheDocument();
    expect(within(panel).getByRole("radio", { name: he.themeDark })).toBeInTheDocument();
    expect(within(panel).getByRole("radio", { name: he.themeSystem })).toBeInTheDocument();
  });
});

describe("dark color system", () => {
  const css = readFileSync(
    path.resolve(__dirname, "../../../packages/design-system/src/tokens.css"),
    "utf8",
  );
  const dark = css.slice(css.indexOf(".dark {"), css.indexOf(".auth-root"));
  const theme = css.slice(css.indexOf("@theme {"), css.indexOf(":root {"));

  it("keeps light brand primary and uses navy layers in dark, not black or full white ink", () => {
    expect(theme).toContain("--color-action: #0b6bcb");
    expect(dark).toContain("--color-bg-0: #0b1220");
    expect(dark).toContain("--color-bg-nav: #0f172a");
    expect(dark).toContain("--color-bg-1: #111c2e");
    expect(dark).toContain("--color-bg-2: #16243a");
    expect(dark).toContain("--color-bg: #0d192b");
    expect(dark).toContain("--color-border: #243550");
    expect(dark).toContain("--color-fg: #f1f5f9");
    expect(dark).toContain("--color-fg-muted: #a9b8cc");
    expect(dark).toContain("--color-fg-subtle: #71839a");
    expect(dark).toContain("--color-action: #2f80ed");
    expect(dark).not.toMatch(/--color-bg-0:\s*#000/);
    expect(dark).not.toMatch(/--color-fg:\s*#fff(?:fff)?\b/i);
    expect(dark).not.toMatch(/--color-bg-0:\s*#111827/);
    const layers = ["#0b1220", "#0f172a", "#111c2e", "#16243a", "#0d192b"];
    expect(new Set(layers).size).toBe(layers.length);
  });

  it("keeps functional color on status tokens, not as a canvas fill", () => {
    expect(dark).toContain("--color-success: #22c55e");
    expect(dark).toContain("--color-warning: #f59e0b");
    expect(dark).toContain("--color-danger: #ef4444");
    expect(dark).toContain("--color-info: #38bdf8");
    expect(dark).toContain("--color-analytics: #8b7cf6");
    expect(dark).toContain("--color-tech: #22d3ee");
    expect(dark).not.toMatch(/--color-bg-0:\s*#22c55e/);
    expect(dark).not.toMatch(/--color-bg-1:\s*#2f80ed/);
  });

  it("maps chrome to nav and popovers to elevated surfaces", () => {
    const styles = readFileSync(path.resolve(__dirname, "../src/styles.css"), "utf8");
    expect(styles).toContain("background: var(--color-bg-nav)");
    expect(styles).toContain("background-color: var(--color-bg-2)");
    expect(styles).toMatch(/\.ops-sidebar\s*\{[^}]*background:\s*var\(--color-bg-nav\)/s);
    expect(styles).not.toMatch(/\.ops-sidebar\s*\{[^}]*background:\s*var\(--color-bg-1\)/s);
  });
});
