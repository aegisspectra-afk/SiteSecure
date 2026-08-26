import type { PublicQuote } from "@site-secure/api-client";
import type { ReactNode } from "react";
import { he } from "../../../i18n/he";
import { formatDay, formatMoney, quoteStatusLabel } from "../../../lib/quotes";

function headerDiscountLabel(quote: PublicQuote): string | null {
  const value = quote.discount_value ?? 0;
  if (!value) return null;
  if (quote.discount_type === "percent") return `${value}%`;
  return formatMoney(value, quote.currency || "ILS");
}

function formatLineDiscount(item: PublicQuote["items"][number], currency: string): string {
  const value = Number(item.discount || 0);
  if (value <= 0) return "";
  const dtype = (item.discount_type || "amount").toLowerCase();
  if (dtype === "percent" || dtype === "%") return `${value}%`;
  return formatMoney(value, currency);
}
  if (amount == null || Math.abs(Number(amount)) < 0.005) return he.quoteDocIncluded;
  return formatMoney(amount, currency);
}

function isSourceMeta(text: string) {
  const t = text.trim();
  if (!t) return false;
  return /חיצונית|מקור\s*:|external\s*quote|imported/i.test(t) || /מס[׳'`]?\s*\d+/.test(t);
}

function MetaLine({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="quote-doc-meta-line">
      <span className="quote-doc-meta-label">{label}</span>
      <span className="quote-doc-meta-value">{value}</span>
    </div>
  );
}

function groupItems(quote: PublicQuote) {
  const sections = quote.sections ?? [];
  const bySection = new Map<string, PublicQuote["items"]>();
  for (const section of sections) bySection.set(section.id, []);
  const loose: PublicQuote["items"] = [];
  for (const item of quote.items) {
    const sid = item.section_id;
    if (sid && bySection.has(sid)) bySection.get(sid)!.push(item);
    else loose.push(item);
  }
  return { sections, bySection, loose };
}

/** Flatten display order matching PDF: section items then loose, skip notes for numbering. */
function numberedLines(quote: PublicQuote) {
  const { sections, bySection, loose } = groupItems(quote);
  const rows: Array<
    | { kind: "section"; id: string; name: string }
    | { kind: "line"; item: PublicQuote["items"][number]; index: number | null }
  > = [];
  let n = 0;
  for (const section of sections) {
    const items = bySection.get(section.id) ?? [];
    if (!items.length && !section.name) continue;
    rows.push({ kind: "section", id: section.id, name: section.name || he.cpqSectionUntitled });
    for (const item of items) {
      if (item.item_type === "note") {
        rows.push({ kind: "line", item, index: null });
      } else {
        n += 1;
        rows.push({ kind: "line", item, index: n });
      }
    }
  }
  for (const item of loose) {
    if (item.item_type === "note") {
      rows.push({ kind: "line", item, index: null });
    } else {
      n += 1;
      rows.push({ kind: "line", item, index: n });
    }
  }
  return rows;
}

export function QuoteDocument({
  quote,
  actions,
  showStatus = true,
  hideSignatureBlock = false,
}: {
  quote: PublicQuote;
  actions?: ReactNode;
  showStatus?: boolean;
  hideSignatureBlock?: boolean;
}) {
  const currency = quote.currency || "ILS";
  const brand = quote.company?.brand_name || quote.company?.name || he.brand;
  const legal = quote.company?.legal_name || quote.company?.name;
  const issued = formatDay(quote.issued_at || quote.sent_at);
  const until = formatDay(quote.valid_until);
  const discountLabel = headerDiscountLabel(quote);
  const vatLabel =
    quote.vat_percent != null ? `${he.quoteTax} ${quote.vat_percent}%` : he.quoteTax;
  const siteName =
    quote.site?.name && quote.site.name !== quote.title
      ? quote.site.name
      : quote.project_name && quote.project_name !== quote.title
        ? quote.project_name
        : null;
  const siteAddress = quote.project_address;
  const signature = quote.signature;
  const lines = numberedLines(quote);
  const showLineDiscount = quote.items.some((item) => Number(item.discount || 0) > 0);
  const colCount = showLineDiscount ? 7 : 6;
  const statusLabel =
    quote.superseded || quote.status === "superseded"
      ? he.quoteDocSupersededBadge
      : quoteStatusLabel(quote.status);
  const paymentLines = String(quote.payment_terms || "")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Import provenance (external quote # / "מקור:") stays internal — never on the customer doc.
  let lead = "";
  if (quote.summary && !isSourceMeta(quote.summary)) lead = quote.summary.trim();
  if (quote.key_points && !isSourceMeta(quote.key_points)) {
    const kp = quote.key_points.trim();
    if (!lead) lead = kp;
    else if (kp !== lead) lead = `${lead}\n${kp}`;
  }
  const whoLine = [quote.customer?.display_name, siteName || siteAddress].filter(Boolean).join(" · ");
  const metaBits = [
    issued,
    until ? `${he.quoteValidUntil} ${until}` : null,
    quote.version ? he.quotesVersion(quote.version) : null,
  ].filter(Boolean);
  const digitallyApproved = Boolean(quote.approved_at && quote.approved_name);

  return (
    <article id="quote-document-print-root" className="quote-doc" dir="rtl">
      <header className="quote-doc-header">
        <div className="quote-doc-brand">
          {quote.company?.logo_url ? (
            <img className="quote-doc-logo" src={quote.company.logo_url} alt="" />
          ) : (
            <div className="quote-doc-logo-fallback" aria-hidden>
              {(brand || "S").slice(0, 1)}
            </div>
          )}
          <div className="quote-doc-brand-text">
            <p className="quote-doc-company">{brand}</p>
            {legal && legal !== brand ? <p className="quote-doc-company-legal">{legal}</p> : null}
            {(quote.company?.phone || quote.company?.email) && (
              <p className="quote-doc-company-meta">
                {[quote.company.phone, quote.company.email].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
        <div className="quote-doc-header-meta">
          {showStatus ? <span className="quote-doc-status">{statusLabel}</span> : null}
        </div>
      </header>

      {actions ? <div className="quote-doc-actions no-print">{actions}</div> : null}

      <section className="quote-doc-hero">
        <p className="quote-doc-hero-kicker ltr-meta">{he.quoteDocHeroQuote(quote.number)}</p>
        {quote.title ? <h1 className="quote-doc-title">{quote.title}</h1> : null}
        {whoLine ? <p className="quote-doc-hero-who">{whoLine}</p> : null}
        {metaBits.length ? <p className="quote-doc-hero-meta">{metaBits.join(" · ")}</p> : null}
        {lead ? <p className="quote-doc-summary">{lead}</p> : null}
      </section>

      <section className="quote-doc-attention">
        <div className="quote-doc-attention-grid">
          <MetaLine label={he.quotePublicPhone} value={quote.customer?.phone} />
          <MetaLine label={he.quotePublicEmail} value={quote.customer?.email} />
          <MetaLine label={he.quoteProjectAddress} value={siteAddress} />
          <MetaLine label={he.quoteDocCustomerAddress} value={quote.customer?.address_line} />
        </div>
      </section>

      <section className="quote-doc-lines">
        <h2 className="quote-doc-section-heading">{he.quoteDocLinesHeading}</h2>
        <table className="quote-doc-table">
          <thead>
            <tr>
              <th className="quote-doc-col-num">#</th>
              <th className="quote-doc-col-sku">{he.quoteProductSku}</th>
              <th>{he.quoteItemDescription}</th>
              <th>{he.quoteQty}</th>
              <th>{he.quoteUnitPrice}</th>
              {showLineDiscount ? <th>{he.quoteDiscount}</th> : null}
              <th>{he.quoteDocColLineTotal}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((row) => {
              if (row.kind === "section") {
                return (
                  <tr key={`sec-${row.id}`} className="quote-doc-section-row">
                    <td colSpan={colCount}>
                      <span className="quote-doc-section-accent" aria-hidden />
                      {row.name}
                    </td>
                  </tr>
                );
              }
              return (
                <LineRow
                  key={row.item.id}
                  item={row.item}
                  currency={currency}
                  index={row.index}
                  showDiscount={showLineDiscount}
                />
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="quote-doc-totals" aria-label={he.quoteTotalDue}>
        <dl>
          <div>
            <dt>{he.quoteSubtotal}</dt>
            <dd>{formatMoney(quote.subtotal_net, currency)}</dd>
          </div>
          {discountLabel ? (
            <div>
              <dt>{he.quoteDiscount}</dt>
              <dd>{discountLabel}</dd>
            </div>
          ) : null}
          <div>
            <dt>{vatLabel}</dt>
            <dd>{formatMoney(quote.vat_amount, currency)}</dd>
          </div>
          <div className="quote-doc-totals-grand">
            <dt>{he.quoteTotalDue}</dt>
            <dd>{formatMoney(quote.total_gross, currency)}</dd>
          </div>
        </dl>
      </section>

      {paymentLines.length ? (
        <section className="quote-doc-block">
          <h2>{he.quoteDocPaymentTerms}</h2>
          {paymentLines.length > 1 ? (
            <ul className="quote-doc-bullets">
              {paymentLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="quote-doc-prose">{paymentLines[0]}</p>
          )}
        </section>
      ) : null}

      {(quote.warranty || quote.general_terms) && (
        <section className="quote-doc-terms quote-doc-break-before">
          {quote.warranty ? (
            <div className="quote-doc-block">
              <h2>{he.quoteDocWarranty}</h2>
              <p className="quote-doc-prose">{quote.warranty}</p>
            </div>
          ) : null}
          {quote.general_terms ? (
            <div className="quote-doc-block">
              <h2>{he.quoteDocGeneralTerms}</h2>
              <p className="quote-doc-prose">{quote.general_terms}</p>
            </div>
          ) : null}
        </section>
      )}

      {quote.customer_notes ? (
        <section className="quote-doc-block">
          <h2>{he.quoteDocCustomerNotes}</h2>
          <p className="quote-doc-prose">{quote.customer_notes}</p>
        </section>
      ) : null}

      {!hideSignatureBlock ? (
        digitallyApproved ? (
          <section className="quote-doc-signature is-digital">
            <h2>{he.quoteDocDigitalApproved}</h2>
            <p className="quote-doc-consent">
              {he.quoteDocApprovedBy}: {quote.approved_name}
            </p>
            <p className="quote-doc-consent">
              {he.quoteDocApprovedAt}: {formatDay(quote.approved_at)} · {he.quoteDocDigitalSignOk}
            </p>
          </section>
        ) : (
          <section className="quote-doc-signature">
            <h2>{signature?.title || he.quoteDocSignatureTitle}</h2>
            <p className="quote-doc-consent">{he.quoteDocPortalSignHint}</p>
            <p className="quote-doc-consent">
              {signature?.consent_he || signature?.consent_text || he.quoteDocSignatureConsent}
            </p>
            <div className="quote-doc-sign-fields">
              <div className="quote-doc-sign-field">
                <span>{he.quotePublicSigner}</span>
                <div className="quote-doc-sign-line" />
              </div>
              <div className="quote-doc-sign-field">
                <span>{he.quoteDocSignSignature}</span>
                <div className="quote-doc-sign-line" />
              </div>
              <div className="quote-doc-sign-field">
                <span>{he.quoteDocSignDate}</span>
                <div className="quote-doc-sign-line" />
              </div>
            </div>
          </section>
        )
      ) : null}

      <footer className="quote-doc-footer">
        <span>
          {brand}
          {legal && legal !== brand ? ` · ${legal}` : ""} · SITE SECURE
        </span>
        <span className="ltr-meta">
          {quote.number}
          {quote.version ? ` · v${quote.version}` : ""}
        </span>
      </footer>
    </article>
  );
}

function LineRow({
  item,
  currency,
  index,
  showDiscount,
}: {
  item: PublicQuote["items"][number];
  currency: string;
  index: number | null;
  showDiscount: boolean;
}) {
  const isNote = item.item_type === "note";
  const primary = item.description || item.name || (isNote ? he.quoteAddNote : "—");
  const sku = item.sku?.trim() || "";
  return (
    <tr className="quote-doc-line-row">
      <td className="quote-doc-col-num ltr-meta">{isNote ? "—" : index}</td>
      <td className="quote-doc-col-sku ltr-meta">{isNote ? "" : sku || "—"}</td>
      <td>
        <div className="quote-doc-line-desc">
          <span>{primary}</span>
        </div>
      </td>
      <td className="ltr-meta">{isNote ? "" : item.qty}</td>
      <td className="ltr-meta">{isNote ? "" : moneyOrIncluded(item.unit_price, currency)}</td>
      {showDiscount ? (
        <td className="ltr-meta">
          {isNote || !Number(item.discount || 0) ? "" : formatLineDiscount(item, currency)}
        </td>
      ) : null}
      <td className="ltr-meta">{isNote ? "" : moneyOrIncluded(item.line_net, currency)}</td>
    </tr>
  );
}
