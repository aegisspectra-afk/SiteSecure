import type { InputHTMLAttributes } from "react";
import { cn } from "./cn";

type BoxProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hideLabel?: boolean;
};

export function Checkbox({ label, hideLabel, className, id, ...props }: BoxProps) {
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-fg">
      <input
        id={id}
        type="checkbox"
        aria-label={hideLabel ? label : undefined}
        className={cn(
          "size-4 rounded-[3px] border-border text-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
      {hideLabel ? null : <span>{label}</span>}
    </label>
  );
}

export function Radio({ label, className, id, ...props }: BoxProps) {
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-fg">
      <input
        id={id}
        type="radio"
        className={cn(
          "size-4 border-border text-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}

export function Switch({
  label,
  checked,
  onCheckedChange,
  disabled,
  id,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 text-sm text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:text-fg-muted",
      )}
    >
      <span
        className={cn(
          "relative h-6 w-10 rounded-full transition-colors duration-150",
          checked ? "bg-action" : "bg-border",
          disabled && "opacity-50",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-bg shadow-card transition-transform duration-150",
            checked ? "start-[18px]" : "start-0.5",
          )}
        />
      </span>
      <span>{label}</span>
    </button>
  );
}
