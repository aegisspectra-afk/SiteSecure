/** Presentation helpers for company payment / bank details — no persistence. */

export type PaymentDetailsFields = {
  bankName: string;
  bankBranch: string;
  bankAccount: string;
  bankAccountHolder: string;
  paymentInstructions: string;
  showBankOnDocuments: boolean;
};

export function hasPaymentDetails(fields: PaymentDetailsFields): boolean {
  return Boolean(
    fields.bankName.trim() ||
      fields.bankAccount.trim() ||
      fields.bankAccountHolder.trim() ||
      fields.bankBranch.trim(),
  );
}

/** Mask account for read-only card: •••• 4567 */
export function maskBankAccount(account: string): string {
  const digits = account.replace(/\s+/g, "");
  if (!digits) return "—";
  if (digits.length <= 4) return `•••• ${digits}`;
  return `•••• ${digits.slice(-4)}`;
}
