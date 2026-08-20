import type { PublicQuote } from "@site-secure/api-client";
import type { ReactNode } from "react";
import { he } from "../../i18n/he";
import { formatDay, formatMoney } from "../../lib/quotes";

function Meta({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-end text-fg">{value}</dd>
    </div>
  );
}

function headerDiscountLabel(quote: PublicQuote): string | null {
  const value = quote.discount_value ?? 0;
  if (!value) return null;
  if (quote.discount_type === "percent") return `${value}%`;
  return formatMoney(value, quote.currency || "ILS");
}

export function QuoteCustomerView({
  quote,
  actions,
}: {
  quote: PublicQuote;
  actions?: ReactNode;
}) {
  const currency = quote.currency || "ILS";
  const issued = formatDay(quote.issued_at || quote.sent_at);
  const until = formatDay(quote.valid_until);
  const siteName = quote.site?.name || quote.project_name;
  const siteAddress = quote.project_address;
  const discountLabel = headerDiscountLabel(quote);
  const vatLabel =
    quote.vat_percent != null ? `${he.quoteTax} ${quote.vat_percent}%` : he.quoteTax;

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-6" dir="rtl">
      <header className="flex flex-col gap-1 border-b border-border pb-5">
        <p className="text-base font-semibold tracking-[-0.02em] text-fg">{quote.company?.name || he.brand}</p>
        <p className="public-mono text-[10px] tracking-[0.16em] text-fg-subtle">{he.quotePublicTitle}</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-fg">
          {quote.title || quote.number}
        </h1>
        <p className="ltr-meta text-sm text-fg-muted">
          {quote.number}
          {quote.version ? ` · ${he.quotesVersion(quote.version)}` : ""}
        </p>
      </header>

      {actions}

      <section className="ops-card flex flex-col gap-3 p-5">
        <dl className="flex flex-col gap-2">
          <Meta label={he.quoteIssueDate} value={issued} />
          <Meta label={he.quoteValidUntil} value={until} />
          <Meta label={he.quotePublicCustomer} value={quote.customer?.display_name} />
          <Meta label={he.quotePublicSite} value={siteName} />
          <Meta label={he.quoteProjectAddress} value={siteAddress} />
        </dl>
      </section>

      {quote.summary ? <p className="text-sm leading-7 text-fg">{quote.summary}</p> : null}
      {quote.key_points ? <p className="whitespace-pre-wrap text-sm leading-7 text-fg">{quote.key_points}</p> : null}

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
        <dl className="mt-4 flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <dt>{he.quoteSubtotal}</dt>
            <dd>{formatMoney(quote.subtotal_net, currency)}</dd>
          </div>
          {discountLabel ? (
            <div className="flex justify-between text-fg-muted">
              <dt>{he.quoteDiscount}</dt>
              <dd>{discountLabel}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt>{vatLabel}</dt>
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
