import { useState } from "react";
import { submitBetaSignup } from "../../../../lib/public-marketing-api";
import { trackMarketingEvent } from "../../../../lib/marketing-analytics";

/** Enterprise / demo lead — stored via existing beta intake with source=enterprise. */
export function EnterpriseLeadForm({ source = "enterprise" }: { source?: string }) {
  const [form, setForm] = useState({
    full_name: "",
    business_name: "",
    phone: "",
    email: "",
    technician_count: "",
    locations: "",
    needs: "",
    notes: "",
  });
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (done) {
    return (
      <p className="mkt-card text-base font-medium text-[var(--mkt-ink)]" role="status">
        תודה. נחזור אליך לתיאום שיחה תוך יום עסקים.
      </p>
    );
  }

  return (
    <form
      className="mkt-form mkt-card"
      onSubmit={(ev) => {
        ev.preventDefault();
        setBusy(true);
        setErr(null);
        const trade = [
          form.email ? `אימייל: ${form.email}` : "",
          form.locations ? `מיקומים/סניפים: ${form.locations}` : "",
          form.needs ? `יכולות נדרשות: ${form.needs}` : "",
          form.notes ? `הערות: ${form.notes}` : "",
        ]
          .filter(Boolean)
          .join(" | ");
        void submitBetaSignup({
          full_name: form.full_name,
          phone: form.phone,
          business_name: form.business_name,
          technician_count: form.technician_count || "לא צוין",
          trade_focus: trade.slice(0, 160),
          source,
        })
          .then(() => {
            setDone(true);
            trackMarketingEvent(source === "enterprise" ? "enterprise_lead" : "demo_start", {
              source,
            });
          })
          .catch((e: Error) => setErr(e.message))
          .finally(() => setBusy(false));
      }}
    >
      <label>
        שם מלא
        <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
      </label>
      <label>
        שם החברה
        <input
          required
          value={form.business_name}
          onChange={(e) => setForm({ ...form, business_name: e.target.value })}
        />
      </label>
      <label>
        טלפון
        <input required dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </label>
      <label>
        אימייל
        <input
          required
          type="email"
          dir="ltr"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </label>
      <label>
        מספר עובדים / טכנאים
        <input
          required
          value={form.technician_count}
          onChange={(e) => setForm({ ...form, technician_count: e.target.value })}
        />
      </label>
      <label>
        מספר מיקומים / סניפים
        <input value={form.locations} onChange={(e) => setForm({ ...form, locations: e.target.value })} />
      </label>
      <label>
        יכולות נדרשות
        <input value={form.needs} onChange={(e) => setForm({ ...form, needs: e.target.value })} />
      </label>
      <label>
        מידע נוסף
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </label>
      {err ? <p className="m-0 text-sm text-red-600">{err}</p> : null}
      <button type="submit" className="mkt-btn mkt-btn-primary" disabled={busy}>
        שליחת פנייה
      </button>
    </form>
  );
}
