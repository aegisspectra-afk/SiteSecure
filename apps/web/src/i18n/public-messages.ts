import { pubEn } from "./public-en";
import { pubHe } from "./public-he";
import type { PublicLocale, PublicMessages } from "./public";

export function getPublicMessages(locale: PublicLocale): PublicMessages {
  return locale === "en" ? pubEn : pubHe;
}
