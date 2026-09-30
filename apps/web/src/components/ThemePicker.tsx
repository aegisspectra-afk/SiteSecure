import { Monitor, Moon, Sun } from "lucide-react";
import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { cn } from "@site-secure/ui";
import { he } from "../i18n/he";
import { THEME_MODES, setThemeMode, type ThemeMode } from "../lib/theme";
import { useReducedMotion } from "../lib/use-reduced-motion";
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

type ThumbBox = { x: number; width: number };

function readSelectedThumb(track: HTMLElement): ThumbBox | null {
  const selected = track.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]');
  if (!selected) return null;
  return { x: selected.offsetLeft, width: selected.offsetWidth };
}

export function ThemePicker({
  id,
  compact = false,
}: {
  id?: string;
  /** Icon-only segmented control for tight surfaces (account menu). */
  compact?: boolean;
}) {
  const { mode } = useTheme();
  const groupId = id ?? "theme-mode";
  const reducedMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const placedRef = useRef(false);
  const [thumb, setThumb] = useState<ThumbBox | null>(null);
  const [canSlide, setCanSlide] = useState(false);
  const [rtl, setRtl] = useState(() =>
    typeof document !== "undefined" ? document.documentElement.dir !== "ltr" : true,
  );

  useLayoutEffect(() => {
    const root = document.documentElement;
    const syncDir = () => setRtl(root.dir !== "ltr");
    syncDir();
    const dirObserver = new MutationObserver(syncDir);
    dirObserver.observe(root, { attributes: true, attributeFilter: ["dir"] });
    return () => dirObserver.disconnect();
  }, []);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const sync = () => {
      const next = readSelectedThumb(track);
      setThumb(next);
      if (!next) return;
      if (!placedRef.current) {
        placedRef.current = true;
        return;
      }
      setCanSlide(true);
    };

    sync();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    ro?.observe(track);
    window.addEventListener("resize", sync);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [mode, compact, rtl]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const index = THEME_MODES.indexOf(mode);
    const forward = event.key === "ArrowRight";
    const delta = rtl ? (forward ? -1 : 1) : forward ? 1 : -1;
    const next = THEME_MODES[(index + delta + THEME_MODES.length) % THEME_MODES.length];
    setThemeMode(next);
  };

  const onSelect = (value: ThemeMode, event: MouseEvent<HTMLButtonElement>) => {
    // Move the thumb immediately so the slide is visible before any theme view-transition.
    const btn = event.currentTarget;
    setCanSlide(true);
    setThumb({ x: btn.offsetLeft, width: btn.offsetWidth });
    setThemeMode(value, { x: event.clientX, y: event.clientY });
  };

  return (
    <div className={compact ? "flex flex-col gap-1.5" : "flex flex-col gap-2"}>
      <p id={`${groupId}-label`} className="text-xs text-fg-muted">
        {he.themeLabel}
      </p>
      <div
        ref={trackRef}
        role="radiogroup"
        aria-labelledby={`${groupId}-label`}
        className="theme-picker-track relative grid grid-cols-3 gap-1 rounded-[var(--radius-control)] border border-border bg-bg-subtle p-1"
        onKeyDown={onKeyDown}
      >
        <span
          aria-hidden
          data-theme-thumb
          className={cn(
            "theme-picker-thumb pointer-events-none absolute top-1 left-0 z-0 h-[calc(100%-0.5rem)] rounded-[var(--radius-control)]",
            canSlide && !reducedMotion && "is-animated",
            !thumb && "opacity-0",
          )}
          style={
            thumb
              ? {
                  width: thumb.width,
                  transform: `translate3d(${thumb.x}px, 0, 0)`,
                }
              : { width: 0, transform: "translate3d(0, 0, 0)" }
          }
        />
        {THEME_MODES.map((value) => {
          const Icon = ICONS[value];
          const selected = mode === value;
          const label = LABELS[value];
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={compact ? label : undefined}
              title={compact ? label : undefined}
              className={cn(
                "relative z-10 rounded-[var(--radius-control)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                compact
                  ? "flex min-h-11 items-center justify-center"
                  : "flex min-h-11 flex-col items-center justify-center gap-0.5 px-1 text-[11px]",
                selected
                  ? compact
                    ? "text-fg"
                    : "font-medium text-fg"
                  : "text-fg-muted hover:text-fg",
                !reducedMotion && "transition-colors duration-150",
              )}
              onClick={(event) => onSelect(value, event)}
            >
              <Icon className="size-4" strokeWidth={selected ? 2.25 : 1.75} aria-hidden />
              {compact ? null : label}
            </button>
          );
        })}
      </div>
      {!compact && mode === "system" ? <p className="text-[11px] text-fg-muted">{he.themeSystemHint}</p> : null}
    </div>
  );
}
