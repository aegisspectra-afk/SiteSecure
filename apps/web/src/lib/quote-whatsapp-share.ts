/** Truthful WhatsApp share helpers — never claim delivery; preserve click gesture. */

import { he } from "../i18n/he";
import { toWhatsAppPhone } from "./quote-recipient-phone";

export type WhatsAppShareBuild = {
  customerName?: string | null;
  publicUrl: string;
  phoneDigits: string;
  forcePicker?: boolean;
};

export type WhatsAppOpenResult =
  | { ok: true; href: string; phoneUsed: string | null }
  | { ok: false; reason: "no_phone" | "popup_blocked"; href?: string };

/** Open a blank tab synchronously (same user gesture) so async work does not lose the popup. */
export function openSharePlaceholderTab(): Window | null {
  try {
    // Do not pass noopener — browsers return null and we cannot navigate the tab later.
    return window.open("about:blank", "_blank");
  } catch {
    return null;
  }
}

export function buildWhatsAppShareHref(input: WhatsAppShareBuild): { href: string; phone: string | null } {
  const text = encodeURIComponent(he.quoteWhatsAppMessage(input.customerName?.trim() || "", input.publicUrl));
  const phone = input.forcePicker ? null : toWhatsAppPhone(input.phoneDigits);
  if (!input.forcePicker && !phone) {
    return { href: "", phone: null };
  }
  const href =
    phone != null && phone.length > 0
      ? `https://wa.me/${phone}?text=${text}`
      : `https://wa.me/?text=${text}`;
  return { href, phone };
}

export function navigateShareTab(win: Window | null, href: string): boolean {
  if (!href) return false;
  if (win && !win.closed) {
    try {
      win.location.href = href;
      return true;
    } catch {
      // fall through to top-level open
    }
  }
  try {
    const opened = window.open(href, "_blank");
    return Boolean(opened);
  } catch {
    return false;
  }
}

export function closeSharePlaceholder(win: Window | null) {
  if (!win || win.closed) return;
  try {
    win.close();
  } catch {
    // ignore
  }
}

export function resolveWhatsAppOpen(input: WhatsAppShareBuild, placeholder: Window | null): WhatsAppOpenResult {
  const built = buildWhatsAppShareHref(input);
  if (!input.forcePicker && !built.phone) {
    closeSharePlaceholder(placeholder);
    return { ok: false, reason: "no_phone" };
  }
  const opened = navigateShareTab(placeholder, built.href);
  if (!opened) {
    return { ok: false, reason: "popup_blocked", href: built.href };
  }
  return { ok: true, href: built.href, phoneUsed: built.phone };
}
