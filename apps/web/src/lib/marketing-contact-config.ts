/** Public marketing contact channels — env-driven, no hardcoded sales numbers. */

const WA_MESSAGE = "היי, אשמח לשמוע על SITE SECURE";

/** Digits-only international phone from `VITE_MARKETING_WHATSAPP` (e.g. 972501234567). */
export function marketingWhatsAppNumber(): string | null {
  const raw = String(import.meta.env.VITE_MARKETING_WHATSAPP ?? "").trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return null;
  return digits;
}

export function marketingWhatsAppHref(): string | null {
  const digits = marketingWhatsAppNumber();
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(WA_MESSAGE)}`;
}

export const MARKETING_WA_PREFILL = WA_MESSAGE;
