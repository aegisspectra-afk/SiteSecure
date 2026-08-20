import { Button, Modal } from "@site-secure/ui";
import { he } from "../../i18n/he";
import { formatMoney } from "../../lib/quotes";

export function SendQuoteConfirm({
  open,
  onClose,
  onConfirm,
  pending,
  customer,
  number,
  amount,
  currency = "ILS",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pending?: boolean;
  customer?: string | null;
  number?: string | null;
  amount?: number | null;
  currency?: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title={he.quoteSendTitle}>
      <dl className="flex flex-col gap-3 text-sm">
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
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          {he.quotesCancel}
        </Button>
        <Button loading={pending} onClick={onConfirm}>
          {he.quoteSendAction}
        </Button>
      </div>
    </Modal>
  );
}
