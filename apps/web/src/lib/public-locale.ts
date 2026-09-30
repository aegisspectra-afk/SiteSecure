import {
  isPublicLocale,
  PUBLIC_LOCALE_STORAGE_KEY,
  type PublicLocale,
} from "../i18n/public";

export const DEFAULT_PUBLIC_LOCALE: PublicLocale = "he";

export function readStoredPublicLocale(): PublicLocale {
  if (typeof window === "undefined") return DEFAULT_PUBLIC_LOCALE;
  try {
    const raw = window.localStorage.getItem(PUBLIC_LOCALE_STORAGE_KEY);
    if (isPublicLocale(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_PUBLIC_LOCALE;
}

export function writeStoredPublicLocale(locale: PublicLocale): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PUBLIC_LOCALE_STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}

export function publicDir(locale: PublicLocale): "rtl" | "ltr" {
  return locale === "he" ? "rtl" : "ltr";
}
