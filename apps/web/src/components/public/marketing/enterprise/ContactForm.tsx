import { useMemo, useState } from "react";
import { submitBetaSignup } from "../../../../lib/public-marketing-api";
import { trackMarketingEvent } from "../../../../lib/marketing-analytics";

export type ContactTopic = "general" | "support" | "sales" | "enterprise" | "demo";

const TOPICS: { value: ContactTopic; label: string }[] = [
  { value: "general", label: "פנייה כללית" },
  { value: "support", label: "תמיכה טכנית" },
  { value: "sales", label: "מכירות" },
  { value: "enterprise", label: "Enterprise" },
  { value: "demo", label: "בקשת הדגמה" },
];

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isPhone(v: string) {
  const digits = v.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15;
}

export function ContactForm({ initialTopic = "general" }: { initialTopic?: ContactTopic }) {
  const [topic, setTopic] = useState<ContactTopic>(
    TOPICS.some((t) => t.value === initialTopic) ? initialTopic : "general",
  );
  const [form, setForm] = useState({
    full_name: "",
    business_name: "",
    phone: "",
    email: "",
    message: "",
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});

  const honeypotId = useMemo(() => `hp_${Math.random().toString(36).slice(2, 8)}`, []);
  const [honeypot, setHoneypot] = useState("");

  if (done) {
    return (
      <p className="mkt-card text-base font-medium text-[var(--mkt-ink)]" role="status">
        הפנייה נשמרה בהצלחה. נחזור אליכם תוך יום עסקים.
      </p>
    );
  }

  const validate = () => {
    const next: Record<string, string> = {};
    if (form.full_name.trim().length < 2) next.full_name = "נא להזין שם מלא.";
    if (form.business_name.trim().length < 2) next.business_name = "נא להזין שם חברה.";
    if (!isPhone(form.phone)) next.phone = "נא להזין טלפון תקין.";
    if (!isEmail(form.email)) next.email = "נא להזין אימייל תקין.";
    if (form.message.trim().length < 8) next.message = "נא לפרט מעט יותר בהודעה.";
    setFieldErr(next);
    return Object.keys(next).length === 0;
  };

  return (
    <form
      className="mkt-form mkt-card"
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        setErr(null);
        if (honeypot.trim()) {
          // Silent drop for bots — do not claim success.
          setErr("לא ניתן לשלוח כרגע. נסו שוב.");
          return;
        }
        if (!validate()) return;
        setBusy(true);
        const topicLabel = TOPICS.find((t) => t.value === topic)?.label ?? topic;
        const trade = [
          `נושא: ${topicLabel}`,
          `אימייל: ${form.email.trim()}`,
          `הודעה: ${form.message.trim()}`,
        ]
          .join(" | ")
          .slice(0, 160);
        void submitBetaSignup({
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          business_name: form.business_name.trim(),
          technician_count: "פנייה מהאתר",
          trade_focus: trade,
          source: topic === "enterprise" ? "enterprise" : topic === "demo" ? "demo" : `contact_${topic}`,
        })
          .then(() => {
            setDone(true);
            trackMarketingEvent(topic === "enterprise" ? "enterprise_lead" : "demo_start", {
              source: topic,
            });
          })
          .catch((e: Error) => setErr(e.message || "השליחה נכשלה"))
          .finally(() => setBusy(false));
      }}
    >
      <h2 className="m-0 text-lg font-semibold text-[var(--mkt-ink)]">טופס פנייה</h2>

      <label>
        סוג פנייה
        <select
          value={topic}
          onChange={(e) => setTopic(e.target.value as ContactTopic)}
          aria-label="סוג פנייה"
        >
          {TOPICS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        שם מלא
        <input
          required
          autoComplete="name"
          value={form.full_name}
          aria-invalid={Boolean(fieldErr.full_name)}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
        />
        {fieldErr.full_name ? <span className="text-sm text-red-600">{fieldErr.full_name}</span> : null}
      </label>

      <label>
        שם החברה
        <input
          required
          autoComplete="organization"
          value={form.business_name}
          aria-invalid={Boolean(fieldErr.business_name)}
          onChange={(e) => setForm({ ...form, business_name: e.target.value })}
        />
        {fieldErr.business_name ? (
          <span className="text-sm text-red-600">{fieldErr.business_name}</span>
        ) : null}
      </label>

      <label>
        טלפון
        <input
          required
          dir="ltr"
          autoComplete="tel"
          value={form.phone}
          aria-invalid={Boolean(fieldErr.phone)}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        {fieldErr.phone ? <span className="text-sm text-red-600">{fieldErr.phone}</span> : null}
      </label>

      <label>
        אימייל
        <input
          required
          type="email"
          dir="ltr"
          autoComplete="email"
          value={form.email}
          aria-invalid={Boolean(fieldErr.email)}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        {fieldErr.email ? <span className="text-sm text-red-600">{fieldErr.email}</span> : null}
      </label>

      <label>
        הודעה
        <textarea
          required
          value={form.message}
          aria-invalid={Boolean(fieldErr.message)}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
        />
        {fieldErr.message ? <span className="text-sm text-red-600">{fieldErr.message}</span> : null}
      </label>

      {/* Honeypot — hidden from users */}
      <label className="sr-only" aria-hidden="true">
        אל תמלאו
        <input
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          name={honeypotId}
        />
      </label>

      {err ? (
        <p className="m-0 text-sm text-red-600" role="alert">
          {err}
        </p>
      ) : null}

      <button type="submit" className="mkt-btn mkt-btn-primary" disabled={busy} aria-busy={busy}>
        {busy ? "שולחים…" : "שליחת פנייה"}
      </button>
    </form>
  );
}
