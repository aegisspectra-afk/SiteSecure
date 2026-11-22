import { Button } from "@site-secure/ui";
import { Navigate, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PortalShell } from "../../components/portal/PortalShell";
import { he } from "../../i18n/he";
import { formatMoney } from "../../lib/quotes";
import { quoteStatusLabel } from "../../lib/quotes";
import { usePortalContext } from "../../lib/use-portal-context";

export const Route = createFileRoute("/portal/quotes")({
  component: PortalQuotesPage,
});

function PortalQuotesPage() {
  const ctx = usePortalContext();
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  if (!ctx.authed) return <Navigate to="/portal/login" />;
  const home = ctx.home;
  if (!home || !ctx.accessId) return <p className="p-6 text-sm text-fg-muted">{he.loading}</p>;

  async function openQuote(quoteId: string) {
    if (!ctx.accessId) return;
    setOpeningId(quoteId);
    setError(null);
    try {
      const { public_path } = await ctx.api.openPortalQuote(ctx.accessId, quoteId);
      window.open(public_path, "_blank", "noopener,noreferrer");
    } catch {
      setError(he.portalQuoteOpenFailed);
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <PortalShell title={he.portalSectionQuotes} brand={home.installer_brand} onSignOut={ctx.signOut}>
      {home.quotes.length === 0 ? <p className="text-sm text-fg-muted">—</p> : null}
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
      <ul className="space-y-3">
        {home.quotes.map((quote) => (
          <li key={quote.id} className="rounded border border-border p-3 text-sm text-fg">
            <p className="font-medium">
              {quote.number} · {quoteStatusLabel(quote.status)}
            </p>
            {quote.total_gross != null ? <p className="text-fg-muted">{formatMoney(quote.total_gross)}</p> : null}
            {quote.can_open ? (
              <Button
                type="button"
                variant="secondary"
                className="mt-2 min-h-12 text-base"
                disabled={openingId === quote.id}
                onClick={() => void openQuote(quote.id)}
              >
                {he.portalQuoteOpen}
              </Button>
            ) : (
              <p className="text-xs text-fg-muted">ההצעה כבר אושרה או נדחתה.</p>
            )}
          </li>
        ))}
      </ul>
    </PortalShell>
  );
}