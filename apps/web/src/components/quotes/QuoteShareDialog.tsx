import { Button } from "@site-secure/ui";
import { useEffect, useId, useRef, useState } from "react";
import { he } from "../../i18n/he";
import { copyTextToClipboard } from "../../lib/clipboard";

export function QuoteShareDialog({
  open,
  url,
  customerName,
  onClose,
  onWhatsApp,
  whatsappDisabled,
}: {
  open: boolean;
  url: string;
  customerName?: string;
  onClose: () => void;
  onWhatsApp?: () => void;
  whatsappDisabled?: boolean;
}) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">("idle");

  useEffect(() => {
    if (!open) {
      setCopyState("idle");
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !url) return null;

  async function onCopy() {
    const result = await copyTextToClipboard(url);
    if (result === "copied") {
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2000);
      return;
    }
    setCopyState("manual");
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="ops-card flex w-full max-w-md flex-col gap-4 p-5 shadow-lg"
      >
        <div>
          <p id={titleId} className="text-base font-semibold text-fg">
            {he.quoteShareDialogTitle}
          </p>
          <p className="mt-1 text-sm text-fg-muted">{he.quoteShareDialogLead}</p>
          {customerName ? <p className="mt-1 text-sm text-fg-muted">{customerName}</p> : null}
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-fg-muted" htmlFor="quote-share-url">
            {he.quoteShareSecureLink}
          </label>
          <input
            id="quote-share-url"
            ref={inputRef}
            readOnly
            value={url}
            className="ltr-meta min-h-11 w-full rounded-[var(--radius-control)] border border-border bg-bg px-3 py-2 font-mono text-xs text-fg"
            onFocus={(ev) => ev.currentTarget.select()}
          />
          {copyState === "manual" ? (
            <p className="text-sm text-fg-muted">{he.quoteShareClipboardFallback}</p>
          ) : null}
          {copyState === "copied" ? <p className="text-sm text-success">{he.quoteShareCopied}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void onCopy()}>{he.cpqCopySecureLink}</Button>
          {onWhatsApp ? (
            <Button variant="secondary" disabled={whatsappDisabled} onClick={onWhatsApp}>
              {he.quoteWhatsApp}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            {he.cancel}
          </Button>
        </div>
      </div>
    </div>
  );
}
