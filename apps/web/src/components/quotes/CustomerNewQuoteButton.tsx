import { Button, Modal, Select } from "@site-secure/ui";
import { useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { he } from "../../i18n/he";
import { quoteCreateSearch, resolveQuoteContext, type QuoteContextSite } from "../../lib/workflow-context";

export function CustomerNewQuoteButton({
  customerId,
  customerName,
  sites,
  disabled,
  label,
  variant = "primary",
  className,
}: {
  customerId: string;
  customerName: string;
  sites: QuoteContextSite[];
  disabled?: boolean;
  label?: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const navigate = useNavigate();
  const [pickSite, setPickSite] = useState(false);
  const [siteId, setSiteId] = useState("");

  function startQuote() {
    const resolved = resolveQuoteContext({ customerId, sites });
    if (resolved.needsSiteSelection) {
      setSiteId("");
      setPickSite(true);
      return;
    }
    void navigate({
      to: "/app/quotes/new",
      search: quoteCreateSearch({ customerId: resolved.customerId, siteId: resolved.siteId }),
    });
  }

  function confirmSite() {
    if (!siteId) return;
    setPickSite(false);
    void navigate({
      to: "/app/quotes/new",
      search: quoteCreateSearch({ customerId, siteId }),
    });
  }

  return (
    <>
      <Button type="button" variant={variant} className={className} onClick={startQuote} disabled={disabled}>
        {label ?? he.newQuoteAction}
      </Button>
      <Modal open={pickSite} onClose={() => setPickSite(false)} title={he.workflowPickSite}>
        <p className="text-sm text-fg-muted">{he.workflowPickSiteFor(customerName)}</p>
        <div className="mt-3">
          <Select id="customer-quote-site" label={he.navSiteFiles} value={siteId} onChange={(ev) => setSiteId(ev.target.value)}>
            <option value="">{he.workflowPickSitePlaceholder}</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name ?? site.id}
              </option>
            ))}
          </Select>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setPickSite(false)}>
            {he.quotesCancel}
          </Button>
          <Button type="button" disabled={!siteId} onClick={confirmSite}>
            {he.workflowContinueToQuote}
          </Button>
        </div>
      </Modal>
    </>
  );
}
