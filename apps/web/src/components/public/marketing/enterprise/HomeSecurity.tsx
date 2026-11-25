const POINTS = [
  {
    title: "כל חברה רואה רק את הנתונים שלה",
    body: "סביבת עבודה נפרדת לכל עסק — בלי ערבוב בין לקוחות.",
  },
  {
    title: "הרשאות לפי תפקיד",
    body: "בעלים, מנהל, מכירות וטכנאי רואים ופועלים לפי מה שמותר להם.",
  },
  {
    title: "חיבור מוצפן",
    body: "התקשורת בין הדפדפן לשרת מוגנת בהצפנה.",
  },
  {
    title: "גיבויים",
    body: "הנתונים נשמרים עם גיבויים שוטפים בתשתית הענן.",
  },
] as const;

export function HomeSecurity() {
  return (
    <div className="mkt-grid-2">
      {POINTS.map((p) => (
        <article key={p.title} className="mkt-card">
          <h3 className="m-0 text-lg font-semibold text-[var(--mkt-ink)]">{p.title}</h3>
          <p className="mt-2 m-0 text-[17px] leading-7 text-[var(--mkt-ink-soft)]">{p.body}</p>
        </article>
      ))}
    </div>
  );
}
