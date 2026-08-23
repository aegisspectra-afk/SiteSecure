import { FileText } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { he } from "../../i18n/he";
import { NewQuoteDialog } from "./quote-creation/NewQuoteDialog";

const primaryClass =
  "quote-new-btn inline-flex h-11 min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-transparent bg-action px-4 text-sm font-medium text-action-fg shadow-[0_1px_0_color-mix(in_srgb,var(--color-fg)_8%,transparent)] transition-[filter,transform,box-shadow,border-color] duration-150 hover:brightness-[1.06] hover:shadow-sm active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60";

const linkClass =
  "inline-flex min-h-11 items-center gap-2 text-sm font-medium text-action transition-colors duration-200 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export function NewQuoteButton({
  children,
  className,
  variant = "primary",
  title,
  loading,
}: {
  children?: ReactNode;
  className?: string;
  variant?: "primary" | "link";
  title?: string;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const base = variant === "link" ? linkClass : primaryClass;
  const label = children ?? he.newQuoteAction;
  const tip = title ?? he.newQuoteAction;

  function closeDialog() {
    setOpen(false);
    window.requestAnimationFrame(() => btnRef.current?.focus());
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={className ? `${base} ${className}` : base}
        title={tip}
        aria-label={typeof label === "string" ? label : tip}
        aria-busy={loading || undefined}
        disabled={loading}
        onClick={() => setOpen(true)}
      >
        {variant === "primary" ? <FileText className="size-4 shrink-0 opacity-90" strokeWidth={1.75} aria-hidden /> : null}
        <span>{loading ? he.loading : label}</span>
      </button>
      <NewQuoteDialog open={open} onClose={closeDialog} />
    </>
  );
}
