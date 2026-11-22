import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  readCookieConsent,
  usesNonEssentialCookies,
  writeCookieConsent,
  type CookieConsentChoice,
} from "../../lib/cookie-consent";

const copy = {
  body: "האתר משתמש בעוגיות הכרחיות לתפעול. בהפעלת אנליטיקה — גם בעוגיות מדידה לא חיוניות. ניתן לאשר או לדחות.",
  accept: "מאשר/ת",
  decline: "רק הכרחיות",
  policy: "מדיניות עוגיות",
  aria: "הודעת עוגיות",
} as const;

export function CookieConsentBanner({ onChoice }: { onChoice?: (choice: CookieConsentChoice) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!usesNonEssentialCookies()) return;
    if (readCookieConsent()) return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  const choose = (choice: CookieConsentChoice) => {
    writeCookieConsent(choice);
    setVisible(false);
    window.dispatchEvent(new Event("ss-cookie-consent"));
    onChoice?.(choice);
  };

  return (
    <div
      role="dialog"
      aria-label={copy.aria}
      className="fixed inset-x-4 bottom-4 z-[80] mx-auto flex max-w-xl flex-col gap-3 rounded-[var(--radius-panel)] border border-border bg-bg px-4 py-4 shadow-lg sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      dir="rtl"
    >
      <p className="text-sm leading-6 text-fg">{copy.body}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/legal/$slug" params={{ slug: "cookies" }} className="text-sm text-action hover:underline">
          {copy.policy}
        </Link>
        <button
          type="button"
          className="min-h-10 rounded-[var(--radius-control)] border border-border px-3 text-sm font-medium text-fg hover:bg-public-elevated"
          onClick={() => choose("declined")}
        >
          {copy.decline}
        </button>
        <button
          type="button"
          className="min-h-10 rounded-[var(--radius-control)] bg-action px-3 text-sm font-medium text-action-fg hover:bg-action-hover"
          onClick={() => choose("accepted")}
        >
          {copy.accept}
        </button>
      </div>
    </div>
  );
}