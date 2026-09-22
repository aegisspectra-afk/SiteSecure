import { useRouterState } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import {
  applyDocumentTheme,
  readThemeMode,
  resolveTheme,
  startThemeRuntime,
  subscribeTheme,
  type ResolvedTheme,
  type ThemeMode,
} from "./theme";

function readSnapshot(): { mode: ThemeMode; resolved: ResolvedTheme } {
  const mode = readThemeMode();
  return { mode, resolved: resolveTheme(mode) };
}

let cached = readSnapshot();

function getSnapshot() {
  const next = readSnapshot();
  if (next.mode === cached.mode && next.resolved === cached.resolved) return cached;
  cached = next;
  return cached;
}

function getServerSnapshot() {
  return { mode: "system" as const, resolved: "light" as const };
}

export function useTheme() {
  return useSyncExternalStore(subscribeTheme, getSnapshot, getServerSnapshot);
}

export function ThemeRuntime() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  useEffect(() => startThemeRuntime(), []);
  useLayoutEffect(() => {
    applyDocumentTheme(readThemeMode(), pathname);
  }, [pathname]);
  return null;
}
