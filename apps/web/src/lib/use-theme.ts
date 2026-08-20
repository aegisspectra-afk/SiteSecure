import { useEffect, useSyncExternalStore } from "react";
import {
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
  useEffect(() => startThemeRuntime(), []);
  return null;
}
