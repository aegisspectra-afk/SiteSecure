/** Resolve WhatsApp recipient phone from quote-related customer / lead data. */

export type QuotePhoneSource = {
  customerPhone?: string | null;
  contactPhone?: string | null;
  leadPhone?: string | null;
};

/** Digits only, Israel-local leading 0 preserved for later wa.me conversion. */
export function digitsOnly(value?: string | null): string {
  return String(value || "").replace(/\D/g, "");
}

export function resolveQuoteRecipientPhone(source: QuotePhoneSource): string {
  return (
    digitsOnly(source.customerPhone) ||
    digitsOnly(source.contactPhone) ||
    digitsOnly(source.leadPhone) ||
    ""
  );
}

/** Convert local Israeli mobile (05…) to international digits for wa.me. */
export function toWhatsAppPhone(rawDigits: string): string {
  const digits = digitsOnly(rawDigits);
  if (!digits) return "";
  if (digits.startsWith("0")) return `972${digits.slice(1)}`;
  if (digits.startsWith("972")) return digits;
  return digits;
}

/** Israeli mobile only (05X + 7 digits), including 9725… form. */
export function isValidIsraeliMobile(raw?: string | null): boolean {
  const digits = digitsOnly(raw);
  if (!digits) return false;
  if (/^05\d{8}$/.test(digits)) return true;
  if (/^9725\d{8}$/.test(digits)) return true;
  return false;
}

export function canWhatsAppRecipientPhone(source: QuotePhoneSource): boolean {
  return isValidIsraeliMobile(resolveQuoteRecipientPhone(source));
}

/** Display formatting for Israeli phones (05X-XXX-XXXX / 0X-XXX-XXXX). */
export function formatIsraeliPhoneDisplay(raw?: string | null): string {
  const digits = digitsOnly(raw);
  if (!digits) return "";
  let local = digits;
  if (local.startsWith("972")) local = `0${local.slice(3)}`;
  if (/^05\d{8}$/.test(local)) return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
  if (/^0\d{8,9}$/.test(local)) {
    const split = local.length === 9 ? 2 : 3;
    return `${local.slice(0, split)}-${local.slice(split, split + 3)}-${local.slice(split + 3)}`;
  }
  return String(raw || "").trim();
}
