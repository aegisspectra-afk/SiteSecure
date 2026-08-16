import type { PublicQuote } from "@site-secure/api-client";
import type { ReactNode } from "react";
import { he } from "../../i18n/he";
import { formatMoney, quoteStatusLabel } from "../../lib/quotes";

export function QuoteCustomerView({
  quote,
  actions,
}: {
  quote: PublicQuote;
  actions?: ReactNode;
}) {
  const currency = quote.currency || "ILS";
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-8" dir="rtl">
      <header className="flex flex-col gap-2">
        <p className="public-mono text-[11px] tracking-[0.22em] text-fg-muted">{he.quotePublicTitle}</p>
        <h1 className="text-3xl font-semibold tracking-[-0.04em]">{quote.title || quote.number}</h1>
        <p className="text-sm text-fg-muted">
          {quote.number} · {he.quotesVersion(quote.version)} · {quoteStatusLabel(quote.status)}
        </p>
      </header>

      {actions}

      <section className="ops-card flex flex-col gap-2 p-5">
        <h2 className="text-sm font-medium">{he.quotePublicCompany}</h2>
        <p>{quote.company?.name}</p>
        {quote.customer?.display_name ? <p>{quote.customer.display_name}</p> : null}
        {quote.project_name || quote.project_address ? (
          <div>
            <h2 className="mt-3 text-sm font-medium">{he.quotePublicProject}</h2>
            <p>{quote.project_name}</p>
            <p className="text-sm text-fg-muted">{quote.project_address}</p>
          </div>
        ) : null}
      </section>

      {quote.summary ? <p className="text-sm leading-7">{quote.summary}</p> : null}
      {quote.key_points ? <p className="whitespace-pre-wrap text-sm leading-7">{quote.key_points}</p> : null}

      <section className="ops-card overflow-x-auto p-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-start text-fg-muted">
              <th className="pb-2 font-medium">{he.quoteItemDescription}</th>
              <th className="pb-2 font-medium">{he.quoteQty}</th>
              <th className="pb-2 font-medium">{he.quoteUnitPrice}</th>
              <th className="pb-2 font-medium">{he.quoteTotal}</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className="py-2">{item.description || item.name}</td>
                <td className="py-2">{item.item_type === "note" ? "" : item.qty}</td>
                <td className="py-2">{item.item_type === "note" ? "" : formatMoney(item.unit_price, currency)}</td>
                <td className="py-2">{item.item_type === "note" ? "" : formatMoney(item.line_net, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-4 grid gap-2 text-sm">
          <div className="flex justify-between">
            <dt>{he.quoteSubtotal}</dt>
            <dd>{formatMoney(quote.subtotal_net, currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{he.quoteTax}</dt>
            <dd>{formatMoney(quote.vat_amount, currency)}</dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt>{he.quoteTotal}</dt>
            <dd>{formatMoney(quote.total_gross, currency)}</dd>
          </div>
        </dl>
      </section>

      {quote.payment_terms ? (
        <section>
          <h2 className="text-sm font-medium">{he.quotePaymentTerms}</h2>
          <p className="whitespace-pre-wrap text-sm leading-7">{quote.payment_terms}</p>
        </section>
      ) : null}
      {quote.warranty ? (
        <section>
          <h2 className="text-sm font-medium">{he.quoteWarranty}</h2>
          <p className="whitespace-pre-wrap text-sm leading-7">{quote.warranty}</p>
        </section>
      ) : null}
      {quote.general_terms ? (
        <section>
          <h2 className="text-sm font-medium">{he.quoteGeneralTerms}</h2>
          <p className="whitespace-pre-wrap text-sm leading-7">{quote.general_terms}</p>
        </section>
      ) : null}
      {quote.customer_notes ? (
        <section>
          <h2 className="text-sm font-medium">{he.quoteCustomerNotes}</h2>
          <p className="whitespace-pre-wrap text-sm leading-7">{quote.customer_notes}</p>
        </section>
      ) : null}
    </article>
  );
}
