import { Monitor, Moon, Sun } from "lucide-react";
import type { KeyboardEvent } from "react";
import { he } from "../i18n/he";
import { THEME_MODES, setThemeMode, type ThemeMode } from "../lib/theme";
import { useTheme } from "../lib/use-theme";

const ICONS = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

const LABELS: Record<ThemeMode, string> = {
  light: he.themeLight,
  dark: he.themeDark,
  system: he.themeSystem,
};

export function ThemePicker({ id }: { id?: string }) {
  const { mode } = useTheme();
  const groupId = id ?? "theme-mode";

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const index = THEME_MODES.indexOf(mode);
    const rtl = document.documentElement.dir === "rtl";
    const forward = event.key === "ArrowRight";
    const delta = rtl ? (forward ? -1 : 1) : forward ? 1 : -1;
    const next = THEME_MODES[(index + delta + THEME_MODES.length) % THEME_MODES.length];
    setThemeMode(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <p id={`${groupId}-label`} className="text-xs text-fg-muted">
        {he.themeLabel}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={`${groupId}-label`}
        className="grid grid-cols-3 gap-1 rounded-[var(--radius-control)] border border-border bg-bg-subtle p-1"
        onKeyDown={onKeyDown}
      >
        {THEME_MODES.map((value) => {
          const Icon = ICONS[value];
          const selected = mode === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={
                selected
                  ? "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] bg-bg-1 px-1 text-[11px] font-medium text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  : "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] px-1 text-[11px] text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              }
              onClick={(event) => setThemeMode(value, { x: event.clientX, y: event.clientY })}
            >
              <Icon className="size-4" strokeWidth={selected ? 2.25 : 1.75} aria-hidden />
              {LABELS[value]}
            </button>
          );
        })}
      </div>
      {mode === "system" ? <p className="text-[11px] text-fg-muted">{he.themeSystemHint}</p> : null}
    </div>
  );
}
