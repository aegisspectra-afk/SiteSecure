export const THEME_STORAGE_KEY = "site-secure-theme";
export const THEME_MODES = ["light", "dark", "system"] as const;
export const THEME_REVEAL_MS = 200;
export const BRAND_DARK_CLASS = "ss-brand-dark";
export const BRAND_DARK_CANVAS = "#070b12";

export type ThemeMode = (typeof THEME_MODES)[number];
export type ResolvedTheme = "light" | "dark";
export type ThemeOrigin = { x: number; y: number };

const LIGHT_CANVAS = "#f1f5f9";
const DARK_CANVAS = "#0b1220";

function normalizePathname(pathname: string): string {
  let path = pathname.split("?")[0].split("#")[0];
  if (!path) return "/";
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path;
}

/**
 * Auth/marketing canvas that stays brand-dark regardless of theme picker.
 * Homepage `/` follows light / dark / system like `/app`.
 * `/app`, `/admin`, `/dev` keep user theme.
 */
export function isBrandDarkPath(pathname: string | null | undefined): boolean {
  const path = normalizePathname(pathname ?? "/");
  if (path === "/") return false;
  if (path === "/app" || path.startsWith("/app/")) return false;
  if (path === "/admin" || path.startsWith("/admin/")) return false;
  if (path === "/dev" || path.startsWith("/dev/")) return false;
  return true;
}

export function currentPathname(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname || "/";
}

type Listener = () => void;
const listeners = new Set<Listener>();

export function isThemeMode(value: string | null | undefined): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

export function parseThemeMode(value: string | null | undefined): ThemeMode {
  return isThemeMode(value) ? value : "system";
}

export function prefersDarkScheme(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "system") return prefersDarkScheme() ? "dark" : "light";
  return mode;
}

export function readThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  try {
    return parseThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

export function persistThemeMode(mode: ThemeMode) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* private mode */
  }
}

export function canvasColor(resolved: ResolvedTheme): string {
  return resolved === "dark" ? DARK_CANVAS : LIGHT_CANVAS;
}

export function applyDocumentTheme(mode: ThemeMode, pathname = currentPathname()) {
  if (typeof document === "undefined") return resolveTheme(mode);
  const resolved = resolveTheme(mode);
  const brandDark = isBrandDarkPath(pathname);
  const root = document.documentElement;
  root.dataset.themeMode = mode;
  root.dataset.theme = resolved;
  root.classList.toggle("dark", resolved === "dark");
  root.classList.toggle(BRAND_DARK_CLASS, brandDark);
  root.style.colorScheme = brandDark ? "dark" : resolved;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])');
  if (meta) meta.setAttribute("content", brandDark ? BRAND_DARK_CANVAS : canvasColor(resolved));
  return resolved;
}

export function subscribeTheme(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyTheme() {
  listeners.forEach((listener) => listener());
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function revealRadius(origin: ThemeOrigin) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  return Math.hypot(Math.max(origin.x, width - origin.x), Math.max(origin.y, height - origin.y));
}

export function setThemeMode(mode: ThemeMode, origin?: ThemeOrigin) {
  const next = parseThemeMode(mode);
  persistThemeMode(next);
  const currentResolved = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const nextResolved = resolveTheme(next);

  const commit = () => {
    applyDocumentTheme(next);
    notifyTheme();
  };

  if (
    currentResolved === nextResolved ||
    !origin ||
    prefersReducedMotion() ||
    typeof document.startViewTransition !== "function"
  ) {
    commit();
    return;
  }

  const root = document.documentElement;
  root.style.setProperty("--theme-x", `${origin.x}px`);
  root.style.setProperty("--theme-y", `${origin.y}px`);
  root.style.setProperty("--theme-r", `${revealRadius(origin)}px`);
  root.classList.add("theme-revealing");

  const finish = () => {
    root.classList.remove("theme-revealing");
    root.style.removeProperty("--theme-x");
    root.style.removeProperty("--theme-y");
    root.style.removeProperty("--theme-r");
  };

  try {
    // Must be invoked as a method of document. Detaching it throws Illegal invocation.
    const transition = document.startViewTransition(commit);
    void (transition.finished ?? Promise.resolve()).finally(finish);
  } catch {
    commit();
    finish();
  }
}

export function startThemeRuntime() {
  applyDocumentTheme(readThemeMode());
  notifyTheme();

  const onScheme = () => {
    if (readThemeMode() !== "system") return;
    applyDocumentTheme("system");
    notifyTheme();
  };
  const media = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  media?.addEventListener("change", onScheme);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    applyDocumentTheme(parseThemeMode(event.newValue));
    notifyTheme();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    media?.removeEventListener("change", onScheme);
    window.removeEventListener("storage", onStorage);
  };
}
