import { LoaderCircle } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "pill";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
  loadingLabel?: string;
};

const variants: Record<ButtonVariant, string> = {
  primary: "bg-action text-action-fg hover:bg-action-hover active:bg-action-active",
  secondary: "bg-bg text-fg border border-border hover:bg-bg-subtle active:bg-bg-0",
  ghost: "bg-transparent text-fg hover:bg-bg-subtle active:bg-bg-0",
  danger: "bg-danger text-danger-fg hover:opacity-90 active:opacity-80",
  pill: "ss-btn-pill bg-action text-action-fg hover:bg-action-hover active:bg-action-active",
};

const disabledVisual: Record<ButtonVariant, string> = {
  primary: "bg-bg-subtle text-fg-muted border border-border hover:bg-bg-subtle",
  secondary: "bg-bg-subtle text-fg-muted border border-border hover:bg-bg-subtle",
  ghost: "bg-transparent text-fg-muted hover:bg-transparent",
  danger: "bg-bg-subtle text-fg-muted border border-border hover:bg-bg-subtle",
  pill: "ss-btn-pill bg-bg-subtle text-fg-muted border border-border hover:bg-bg-subtle",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    loading = false,
    loadingLabel,
    className,
    disabled,
    children,
    type = "button",
    ...props
  },
  ref,
) {
  const isDisabled = Boolean(disabled) || loading;
  const showDisabledLook = Boolean(disabled) && !loading;
  const showLoadingLabel = loading && Boolean(loadingLabel);
  const isPill = variant === "pill";
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "relative inline-flex min-h-11 min-w-24 items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 text-sm font-medium transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        isPill &&
          "min-h-[var(--premium-cta-height)] rounded-[var(--radius-pill)] px-6 text-base font-semibold tracking-[-0.02em] transition-transform duration-[var(--motion-press)] [transition-timing-function:var(--ease-out-cubic)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
        isDisabled && "cursor-not-allowed",
        showDisabledLook ? disabledVisual[variant] : variants[variant],
        className,
      )}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-disabled={isDisabled || undefined}
      aria-label={showLoadingLabel ? loadingLabel : undefined}
      {...props}
    >
      {showLoadingLabel ? (
        <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap">
          <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden />
          <span>{loadingLabel}</span>
        </span>
      ) : (
        <>
          {loading ? <LoaderCircle className="absolute size-4 shrink-0 animate-spin" aria-hidden /> : null}
          <span
            className={cn(
              "inline-flex items-center justify-center gap-2 whitespace-nowrap [&_svg]:size-4 [&_svg]:shrink-0",
              loading && "invisible",
            )}
          >
            {children}
          </span>
        </>
      )}
    </button>
  );
});
