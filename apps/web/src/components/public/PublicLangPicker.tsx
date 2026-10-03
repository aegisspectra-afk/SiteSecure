import { cn } from "@site-secure/ui";
import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { PUBLIC_LOCALES, type PublicLocale } from "../../i18n/public";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import { usePublicLocale } from "./PublicLocaleProvider";

type ThumbBox = { x: number; width: number };

function readSelectedThumb(track: HTMLElement): ThumbBox | null {
  const selected = track.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]');
  if (!selected) return null;
  return { x: selected.offsetLeft, width: selected.offsetWidth };
}

/**
 * Segmented HE / EN control with sliding thumb — same interaction grammar as ThemePicker.
 * Track is always LTR so option order and thumb do not jump when page locale flips.
 */
export function PublicLangPicker({
  id = "public-lang",
  className,
  compact = false,
}: {
  id?: string;
  className?: string;
  /** Icon-density: shorter min height for tight header chrome. */
  compact?: boolean;
}) {
  const { locale, setLocale, t } = usePublicLocale();
  const reducedMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const placedRef = useRef(false);
  const [thumb, setThumb] = useState<ThumbBox | null>(null);
  const [canSlide, setCanSlide] = useState(false);

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
  }, [locale, compact]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const index = PUBLIC_LOCALES.indexOf(locale);
    const forward = event.key === "ArrowRight";
    const delta = forward ? 1 : -1;
    const next = PUBLIC_LOCALES[(index + delta + PUBLIC_LOCALES.length) % PUBLIC_LOCALES.length];
    setLocale(next);
  };

  const onSelect = (value: PublicLocale, event: MouseEvent<HTMLButtonElement>) => {
    const btn = event.currentTarget;
    setCanSlide(true);
    setThumb({ x: btn.offsetLeft, width: btn.offsetWidth });
    setLocale(value);
  };

  const labels: Record<PublicLocale, string> = {
    he: t.languageHe,
    en: t.languageEn,
  };

  return (
    <div className={cn("public-lang-picker", className)}>
      <p id={`${id}-label`} className="sr-only">
        {t.languageLabel}
      </p>
      <div
        ref={trackRef}
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        dir="ltr"
        className={cn(
          "theme-picker-track public-lang-track relative grid grid-cols-2 rounded-[var(--radius-control)] border border-border bg-bg-subtle",
          compact ? "min-w-[7.25rem] gap-0.5 p-0.5" : "min-w-[8.5rem] gap-1 p-1",
        )}
        onKeyDown={onKeyDown}
      >
        <span
          aria-hidden
          data-theme-thumb
          className={cn(
            "theme-picker-thumb pointer-events-none absolute left-0 z-0 rounded-[calc(var(--radius-control)-1px)]",
            compact ? "top-0.5 h-[calc(100%-0.25rem)]" : "top-1 h-[calc(100%-0.5rem)]",
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
        {PUBLIC_LOCALES.map((value) => {
          const selected = locale === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${t.languageLabel}: ${labels[value]}`}
              className={cn(
                "relative z-10 rounded-[calc(var(--radius-control)-1px)] px-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                compact ? "flex h-8 items-center justify-center" : "flex min-h-11 items-center justify-center",
                selected ? "font-medium text-fg" : "text-fg-muted hover:text-fg",
                !reducedMotion && "transition-colors duration-150",
              )}
              onClick={(event) => onSelect(value, event)}
            >
              <span
                className={cn(
                  "text-[12px] tracking-[0.04em]",
                  value === "en" && "public-mono text-[11px] tracking-[0.12em]",
                )}
              >
                {labels[value]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
