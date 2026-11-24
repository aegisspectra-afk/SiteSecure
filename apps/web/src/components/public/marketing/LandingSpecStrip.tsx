const SPECS = [
  { value: "10", unit: "דקות", hint: "מהסיור להצעה ללקוח" },
  { value: "3", unit: "חלופות", hint: "בסיסי · מומלץ · מתקדם" },
  { value: "1", unit: "מערכת", hint: "במקום אקסל ווואטסאפ" },
  { value: "0", unit: "ניירת", hint: "חתימה ותיק אתר דיגיטליים" },
] as const;

/** Spec strip directly under the hero — short proof points, no invented customers. */
export function LandingSpecStrip() {
  return (
    <section className="landing-spec-strip landing-reveal" aria-label="מפרט בקצרה">
      <div className="public-container mx-auto max-w-6xl px-4">
        <ul className="landing-spec-strip-grid">
          {SPECS.map((row) => (
            <li key={row.unit} className="landing-spec-strip-item">
              <p className="landing-spec-strip-value">
                <strong>{row.value}</strong>
                <span>{row.unit}</span>
              </p>
              <p className="landing-spec-strip-hint">{row.hint}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
