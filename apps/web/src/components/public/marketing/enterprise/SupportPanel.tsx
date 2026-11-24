import { HelpCircle, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { HOME_FAQ } from "./marketing-content";
import { MARKETING_ROUTES } from "./marketing-routes";

/** Global support drawer — FAQ subset + real documentation/contact links. */
export function SupportPanel() {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="mkt-support-fab"
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
        onClick={() => setOpen(true)}
      >
        <HelpCircle className="size-5" aria-hidden />
        תמיכה
      </button>

      {open
        ? createPortal(
            <div className="mkt-support-root" role="presentation">
              <button type="button" className="mkt-support-backdrop" aria-label="סגירה" onClick={() => setOpen(false)} />
              <aside
                className="mkt-support-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
              >
                <div className="mkt-support-head">
                  <h2 id={titleId} className="m-0 text-lg font-semibold">
                    מרכז תמיכה
                  </h2>
                  <button type="button" className="mkt-nav-menu-btn" aria-label="סגור" onClick={() => setOpen(false)}>
                    <X className="size-5" aria-hidden />
                  </button>
                </div>

                <div className="mkt-support-body">
                  <h3 className="m-0 text-sm font-semibold">שאלות נפוצות</h3>
                  <div className="mkt-faq mt-3">
                    {HOME_FAQ.slice(0, 5).map((item) => (
                      <details key={item.q}>
                        <summary>{item.q}</summary>
                        <p>{item.a}</p>
                      </details>
                    ))}
                  </div>

                  <h3 className="mt-8 m-0 text-sm font-semibold">קישורים</h3>
                  <ul className="mt-3 m-0 flex list-none flex-col gap-2 p-0 text-sm">
                    <li>
                      <Link to={MARKETING_ROUTES.knowledge} onClick={() => setOpen(false)}>
                        מרכז ידע
                      </Link>
                    </li>
                    <li>
                      <Link to={MARKETING_ROUTES.cctvTool} onClick={() => setOpen(false)}>
                        מחשבון אחסון CCTV
                      </Link>
                    </li>
                    <li>
                      <Link to="/legal/$slug" params={{ slug: "security" }} onClick={() => setOpen(false)}>
                        אבטחת מידע
                      </Link>
                    </li>
                    <li>
                      <Link to={MARKETING_ROUTES.contact} onClick={() => setOpen(false)}>
                        צור קשר / תמיכה
                      </Link>
                    </li>
                    <li>
                      <Link to={MARKETING_ROUTES.product} onClick={() => setOpen(false)}>
                        סקירת מוצר
                      </Link>
                    </li>
                  </ul>

                  <Link
                    to={MARKETING_ROUTES.contact}
                    search={{ topic: "support" }}
                    className="mkt-btn mkt-btn-primary mt-8"
                    onClick={() => setOpen(false)}
                  >
                    פתיחת פניית תמיכה
                  </Link>
                </div>
              </aside>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
