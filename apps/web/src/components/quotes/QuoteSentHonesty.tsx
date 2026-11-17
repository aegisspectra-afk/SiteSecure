import { Button } from "@site-secure/ui";
import { he } from "../../i18n/he";
import { isValidIsraeliMobile } from "../../lib/quote-recipient-phone";
import {
  openSharePlaceholderTab,
  resolveWhatsAppOpen,
} from "../../lib/quote-whatsapp-share";

/**
 * Post-send delivery card: public link + «שלח בוואטסאפ» (same pattern as job handover WhatsApp).
 */
export function QuoteSentHonesty({
  publicUrl,
  customerName,
  phoneDigits,
}: {
  publicUrl: string;
  customerName: string;
  phoneDigits: string;
}) {
  const mobileOk = isValidIsraeliMobile(phoneDigits);
  return (
    <section className="ops-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" data-testid="quote-sent-honesty">
      <div className="min-w-0">
        <p className="text-sm font-medium">{he.quoteSentTitle}</p>
        <p className="text-xs text-fg-muted">{he.quoteSentNoEmail}</p>
        <p className="text-xs text-fg-muted">{he.quoteSentLockedHint}</p>
        <a className="break-all text-sm text-action" href={publicUrl} target="_blank" rel="noreferrer">
          {publicUrl}
        </a>
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        <Button
          type="button"
          variant="secondary"
          data-testid="quote-whatsapp-share"
          disabled={!mobileOk || !publicUrl}
          title={!mobileOk ? he.jobWhatsAppDisabledHint : undefined}
          onClick={() => {
            if (!mobileOk || !publicUrl) return;
            const placeholder = openSharePlaceholderTab();
            resolveWhatsAppOpen(
              {
                customerName,
                publicUrl,
                phoneDigits,
                message: he.quoteWhatsAppMessage(customerName, publicUrl),
              },
              placeholder,
            );
          }}
        >
          {he.jobWhatsApp}
        </Button>
        {!mobileOk ? <p className="text-xs text-fg-muted">{he.jobWhatsAppDisabledHint}</p> : null}
      </div>
    </section>
  );
}
