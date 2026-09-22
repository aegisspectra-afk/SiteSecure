import { he } from "../../i18n/he";
import { maskBankAccount, type PaymentDetailsFields } from "../../lib/payment-details";

export function PaymentDetailsCard({
  details,
  onEdit,
}: {
  details: PaymentDetailsFields;
  onEdit: () => void;
}) {
  const masked = maskBankAccount(details.bankAccount);
  const instructions = details.paymentInstructions.trim();
  const docStatus = details.showBankOnDocuments
    ? he.companyBankShownOnDocs
    : he.companyBankHiddenOnDocs;

  return (
    <div className="ss-payment-block">
      <article className="ss-payment-card" aria-labelledby="payment-card-heading">
        <div className="ss-payment-card-glow" aria-hidden />
        <header className="ss-payment-card-top">
          <div className="ss-payment-card-brand min-w-0">
            <p className="ss-payment-card-product">{he.brand}</p>
            <h3 id="payment-card-heading" className="ss-payment-card-kicker">
              {he.companyPaymentSection}
            </h3>
          </div>
          <button type="button" className="ss-payment-card-edit" onClick={onEdit}>
            {he.companyPaymentEdit}
          </button>
        </header>

        <p className="ss-payment-card-bank" dir="auto">
          {details.bankName.trim() || he.companyBankNameUnset}
        </p>

        <dl className="ss-payment-card-grid">
          <div className="ss-payment-card-field">
            <dt>{he.companyBankBranch}</dt>
            <dd className="ltr-meta" dir="ltr">
              {details.bankBranch.trim() || "—"}
            </dd>
          </div>
          <div className="ss-payment-card-field">
            <dt>{he.companyBankAccount}</dt>
            <dd className="ss-payment-card-account ltr-meta" dir="ltr">
              {masked}
            </dd>
          </div>
          <div className="ss-payment-card-field is-wide">
            <dt>{he.companyBankHolder}</dt>
            <dd dir="auto">{details.bankAccountHolder.trim() || "—"}</dd>
          </div>
        </dl>

        <p
          className={`ss-payment-card-doc is-${details.showBankOnDocuments ? "on" : "off"}`}
          role="status"
        >
          {docStatus}
        </p>
      </article>

      {instructions ? (
        <section className="ss-payment-instructions" aria-labelledby="payment-instructions-heading">
          <h3 id="payment-instructions-heading" className="ss-payment-instructions-title">
            {he.companyPaymentInstructionsShort}
          </h3>
          <p className="ss-payment-instructions-body" dir="auto">
            {instructions}
          </p>
        </section>
      ) : null}
    </div>
  );
}

export function PaymentDetailsEmpty({ onEdit }: { onEdit: () => void }) {
  return (
    <div className="ss-payment-empty">
      <p className="ss-payment-empty-title">{he.companyPaymentEmptyTitle}</p>
      <p className="ss-payment-empty-body">{he.companyPaymentEmptyBody}</p>
      <button type="button" className="ss-payment-card-edit is-primary" onClick={onEdit}>
        {he.companyPaymentAdd}
      </button>
    </div>
  );
}
