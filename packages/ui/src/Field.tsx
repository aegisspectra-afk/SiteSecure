import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

const fieldClass =
  "min-h-11 w-full rounded-[var(--radius-control)] border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:text-fg-muted";

export type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  id: string;
  labelAccessory?: ReactNode;
};

export function FieldShell({
  id,
  label,
  hint,
  error,
  labelAccessory,
  children,
}: FieldProps & { children: ReactNode }) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-[13px] font-medium leading-[1.3] text-fg">
          {label}
        </label>
        {labelAccessory}
      </div>
      {children}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-fg-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> &
  FieldProps & {
    revealable?: boolean;
    showPasswordLabel?: string;
    hidePasswordLabel?: string;
  };

export function Input({
  id,
  label,
  hint,
  error,
  labelAccessory,
  className,
  revealable = false,
  showPasswordLabel = "הצג סיסמה",
  hidePasswordLabel = "הסתר סיסמה",
  type,
  ...props
}: InputProps) {
  const [visible, setVisible] = useState(false);
  const inputType = revealable ? (visible ? "text" : "password") : type;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} labelAccessory={labelAccessory}>
      <div className="relative">
        <input
          id={id}
          type={inputType}
          className={cn(fieldClass, revealable && "pe-11", error && "border-danger", className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          {...props}
        />
        {revealable ? (
          <button
            type="button"
            className="absolute end-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-[var(--radius-control)] text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            aria-label={visible ? hidePasswordLabel : showPasswordLabel}
            aria-pressed={visible}
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        ) : null}
      </div>
    </FieldShell>
  );
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps;

export function Textarea({ id, label, hint, error, labelAccessory, className, ...props }: TextareaProps) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} labelAccessory={labelAccessory}>
      <textarea
        id={id}
        className={cn(fieldClass, "min-h-24", error && "border-danger", className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...props}
      />
    </FieldShell>
  );
}

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> &
  FieldProps & {
    children: ReactNode;
  };

export function Select({ id, label, hint, error, labelAccessory, className, children, ...props }: SelectProps) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} labelAccessory={labelAccessory}>
      <select
        id={id}
        className={cn(fieldClass, error && "border-danger", className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}
