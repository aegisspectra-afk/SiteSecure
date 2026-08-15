import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

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
};

const disabledVisual: Record<ButtonVariant, string> = {
  primary: "bg-bg-subtle text-fg-muted border border-border hover:bg-bg-subtle",
  secondary: "bg-bg-subtle text-fg-muted border border-border hover:bg-bg-subtle",
  ghost: "bg-transparent text-fg-muted hover:bg-transparent",
  danger: "bg-bg-subtle text-fg-muted border border-border hover:bg-bg-subtle",
};

export function Button({
  variant = "primary",
  loading = false,
  loadingLabel,
  className,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const isDisabled = Boolean(disabled) || loading;
  const showDisabledLook = Boolean(disabled) && !loading;
  const showLoadingLabel = loading && Boolean(loadingLabel);
  return (
    <button
      type={type}
      className={cn(
        "relative inline-flex min-h-11 min-w-24 items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 text-sm font-medium transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
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
        <>
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          <span>{loadingLabel}</span>
        </>
      ) : (
        <>
          {loading ? <LoaderCircle className="absolute size-4 animate-spin" aria-hidden /> : null}
          <span className={loading ? "invisible" : undefined}>{children}</span>
        </>
      )}
    </button>
  );
}
