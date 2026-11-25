import { Link } from "@tanstack/react-router";
import { MessageCircle, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { marketingWhatsAppHref } from "../../../../lib/marketing-contact-config";
import { trackMarketingEvent } from "../../../../lib/marketing-analytics";
import { submitBetaSignup } from "../../../../lib/public-marketing-api";
import { useFocusTrap } from "../../../../lib/use-focus-trap";
import { BrandBdi } from "./BrandBdi";
import { MARKETING_ROUTES } from "./marketing-routes";

type View = "menu" | "demo" | "done";

/** Marketing FAB — WhatsApp, demo booking, or free signup. No FAQ / link lists. */
export function SupportPanel() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("menu");
  const [form, setForm] = useState({ full_name: "", phone: "", technician_count: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const waHref = marketingWhatsAppHref();

  useFocusTrap(open, panelRef);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function close() {
    setOpen(false);
    setView("menu");
    setErr(null);
    window.setTimeout(() => fabRef.current?.focus(), 0);
  }

  function openPanel() {
    setOpen(true);
    setView("menu");
    setErr(null);
    trackMarketingEvent("cta_click", { cta: "talk_to_us_open" });
  }

  function onDemoSubmit(ev: FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setErr(null);
    void submitBetaSignup({ ...form, source: "talk_to_us_demo" })
      .then(() => {
        setView("done");
        setForm({ full_name: "", phone: "", technician_count: "" });
        trackMarketingEvent("demo_start", { source: "talk_to_us" });
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setBusy(false));
  }

  return (
    <>
      <button
        type="button"
        ref={fabRef}
        className="mkt-support-fab"
        aria-label="דברו איתנו"
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
        onClick={openPanel}
      >
        <MessageCircle className="size-6" aria-hidden />
      </button>

      {open
        ? createPortal(
            <div className="mkt-support-root" role="presentation">
              <button
                type="button"
                className="mkt-support-backdrop"
                aria-label="סגירה"
                tabIndex={-1}
                onClick={close}
              />
              <aside
                ref={panelRef}
                className="mkt-support-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
              >
                <div className="mkt-support-head">
                  <h2 id={titleId} className="m-0 text-lg font-semibold">
                    דברו איתנו
                  </h2>
                  <button
                    type="button"
                    ref={closeBtnRef}
                    className="mkt-nav-menu-btn"
                    aria-label="סגור"
                    onClick={close}
                  >
                    <X className="size-5" aria-hidden />
                  </button>
                </div>

                <div className="mkt-support-body">
                  {view === "menu" ? (
                    <div className="mkt-support-actions">
                      {waHref ? (
                        <a
                          href={waHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mkt-support-action"
                          onClick={() =>
                            trackMarketingEvent("cta_click", { cta: "talk_to_us_whatsapp" })
                          }
                        >
                          <strong>וואטסאפ</strong>
                          <span>שיחה מהירה עם הצוות</span>
                        </a>
                      ) : null}

                      <button
                        type="button"
                        className="mkt-support-action"
                        onClick={() => setView("demo")}
                      >
                        <strong>תיאום הדגמה</strong>
                        <span>השאירו פרטים — נחזור אליכם</span>
                      </button>

                      <Link
                        to={MARKETING_ROUTES.register}
                        className="mkt-support-action"
                        onClick={() => {
                          trackMarketingEvent("signup_start", { from: "talk_to_us" });
                          close();
                        }}
                      >
                        <strong>התחילו בחינם</strong>
                        <span>הרשמה למסלול החינמי</span>
                      </Link>
                    </div>
                  ) : null}

                  {view === "demo" ? (
                    <form className="mkt-form mkt-support-demo" onSubmit={onDemoSubmit}>
                      <p className="m-0 text-sm leading-6 text-[var(--mkt-muted)]">
                        נשמור את הפנייה בפאנל הניהול ונחזור לתיאום.
                      </p>
                      <label>
                        שם מלא
                        <input
                          required
                          minLength={2}
                          value={form.full_name}
                          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                        />
                      </label>
                      <label>
                        טלפון
                        <input
                          required
                          dir="ltr"
                          minLength={7}
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        />
                      </label>
                      <label>
                        כמה טכנאים?
                        <input
                          required
                          value={form.technician_count}
                          onChange={(e) => setForm({ ...form, technician_count: e.target.value })}
                        />
                      </label>
                      {err ? <p className="m-0 text-sm text-red-600">{err}</p> : null}
                      <div className="mkt-support-demo-actions">
                        <button
                          type="button"
                          className="mkt-btn mkt-btn-secondary"
                          onClick={() => setView("menu")}
                        >
                          חזרה
                        </button>
                        <button type="submit" className="mkt-btn mkt-btn-primary" disabled={busy}>
                          שליחה
                        </button>
                      </div>
                    </form>
                  ) : null}

                  {view === "done" ? (
                    <div className="mkt-support-done" role="status">
                      <p className="m-0 text-[17px] font-medium leading-7">
                        תודה! נחזור אליכם תוך יום עסקים
                      </p>
                      <p className="mt-3 m-0 text-sm text-[var(--mkt-muted)]">
                        בינתיים אפשר להתחיל עם <BrandBdi name="SITE SECURE" /> בחינם.
                      </p>
                      <div className="mkt-support-demo-actions mt-6">
                        <button type="button" className="mkt-btn mkt-btn-secondary" onClick={close}>
                          סגירה
                        </button>
                        <Link
                          to={MARKETING_ROUTES.register}
                          className="mkt-btn mkt-btn-primary"
                          onClick={close}
                        >
                          התחילו בחינם
                        </Link>
                      </div>
                    </div>
                  ) : null}
                </div>
              </aside>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
