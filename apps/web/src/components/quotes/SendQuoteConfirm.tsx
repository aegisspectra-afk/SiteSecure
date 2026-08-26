import { Button, Modal } from "@site-secure/ui";
import type { QuoteGap } from "@site-secure/api-client";
import { he } from "../../i18n/he";
import { formatMoney } from "../../lib/quotes";
import { gapSeverity, partitionGaps } from "../../lib/quote-cpq";
import { goToQuoteField } from "../../lib/quote-builder";

export type SendChannel = "whatsapp" | "link" | "email" | "send";

export function SendQuoteConfirm({
  open,
  onClose,
  onConfirm,
  onChannel,
  pending,
  customer,
  number,
  amount,
  currency = "ILS",
  gaps = [],
  canSend = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onChannel?: (channel: SendChannel) => void;
  pending?: boolean;
  customer?: string | null;
  number?: string | null;
  amount?: number | null;
  currency?: string;
  gaps?: QuoteGap[];
  canSend?: boolean;
}) {
  const { critical, warning, info } = partitionGaps(gaps);
  const passed = Math.max(0, 8 - critical.length - warning.length - info.length);

  return (
    <Modal open={open} onClose={onClose} title={he.quoteSendTitle}>
      <div className="flex flex-col gap-4">
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-fg-muted">{he.quoteSendCustomer}</dt>
            <dd className="text-end font-medium">{customer?.trim() || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-fg-muted">{he.quoteSendNumber}</dt>
            <dd className="ltr-meta text-end font-medium">{number?.trim() || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-fg-muted">{he.quoteSendAmount}</dt>
            <dd className="text-end font-medium">{formatMoney(amount, currency)}</dd>
          </div>
        </dl>

        <section className="cpq-send-checks">
          <p className="text-xs font-semibold text-fg-muted">{he.cpqSendBeforeTitle}</p>
          <ul className="mt-2 space-y-1 text-sm">
            <li className="text-success">🟢 {he.cpqSendChecksPassed(passed)}</li>
            {warning.length ? <li>🟡 {he.cpqSendChecksWarn(warning.length)}</li> : null}
            {critical.length ? <li className="text-danger">🔴 {he.cpqSendChecksBlock(critical.length)}</li> : null}
          </ul>
          {critical[0] ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <p className="text-xs text-fg-muted">{critical[0].message}</p>
              <Button
                variant="ghost"
                onClick={() => {
                  goToQuoteField(critical[0].field);
                  onClose();
                }}
              >
                {he.cpqSendFixNow}
              </Button>
            </div>
          ) : null}
          {!critical.length && warning[0] ? (
            <p className="mt-2 text-xs text-fg-muted">
              {warning.filter((g) => gapSeverity(g) === "warning")[0]?.message}
            </p>
          ) : null}
        </section>

        <section className="flex flex-col gap-2">
          <p className="text-sm font-medium text-fg">{he.cpqSendHowTitle}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button
              variant="secondary"
              disabled={!canSend || pending}
              onClick={() => onChannel?.("whatsapp")}
            >
              {he.quoteWhatsApp}
            </Button>
            <Button variant="secondary" disabled={!canSend || pending} onClick={() => onChannel?.("link")}>
              {he.cpqCopySecureLink}
            </Button>
            <Button variant="secondary" disabled={!canSend || pending} onClick={() => onChannel?.("email")}>
              {he.quoteMailtoShare}
            </Button>
          </div>
        </section>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {he.quotesCancel}
          </Button>
          <Button loading={pending} disabled={!canSend} onClick={onConfirm}>
            {he.quoteSendAction}
          </Button>
        </div>
        <p className="text-xs text-fg-muted">{he.quoteSentLockedHint}</p>
      </div>
    </Modal>
  );
}
