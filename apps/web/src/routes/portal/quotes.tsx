import { Navigate, createFileRoute } from "@tanstack/react-router";
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
  if (!ctx.authed) return <Navigate to="/portal/login" />;
  const home = ctx.home;
  if (!home) return <p className="p-6 text-sm text-fg-muted">{he.loading}</p>;
  return (
    <PortalShell title={he.portalSectionQuotes} brand={home.installer_brand} onSignOut={ctx.signOut}>
      {home.quotes.length === 0 ? <p className="text-sm text-fg-muted">—</p> : null}
      <ul className="space-y-3">
        {home.quotes.map((quote) => (
          <li key={quote.id} className="rounded border border-border p-3 text-sm text-fg">
            <p className="font-medium">
              {quote.number} · {quoteStatusLabel(quote.status)}
            </p>
            {quote.total_gross != null ? <p className="text-fg-muted">{formatMoney(quote.total_gross)}</p> : null}
            <p className="text-xs text-fg-muted">לאישור — פתחו את הקישור שנשלח אליכם בהודעה.</p>
          </li>
        ))}
      </ul>
    </PortalShell>
  );
}