import { useMemo, useState } from "react";
import { ActivityFeed } from "./ActivityFeed";
import { DEMO_BADGE, DEMO_NAV, DEMO_TABLE } from "./demo-data";

type TabId = "overview" | "quotes" | "service";

export function LiveAppPreview() {
  const [nav, setNav] = useState("dash");
  const [tab, setTab] = useState<TabId>("overview");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [toast, setToast] = useState<string | null>(null);

  const rows = useMemo(() => {
    return DEMO_TABLE.filter((r) => {
      const q = query.trim();
      const matchQ = !q || r.customer.includes(q) || r.id.toLowerCase().includes(q.toLowerCase());
      const matchS = statusFilter === "all" || r.status === statusFilter;
      return matchQ && matchS;
    });
  }, [query, statusFilter]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  return (
    <div className="mkt-live">
      <aside className="mkt-live-side" aria-label="ניווט הדגמה">
        <p className="mkt-live-brand">SITE SECURE</p>
        <nav className="mkt-live-nav">
          {DEMO_NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={nav === item.id ? "is-active" : undefined}
              aria-current={nav === item.id ? "page" : undefined}
              onClick={() => {
                setNav(item.id);
                showToast(`עברתם אל ${item.label} (הדגמה)`);
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <p className="mkt-demo-badge">{DEMO_BADGE}</p>
      </aside>

      <div className="mkt-live-main">
        <div className="mkt-live-toolbar">
          <label className="mkt-live-search">
            <span className="sr-only">חיפוש בהדגמה</span>
            <input
              type="search"
              placeholder="חיפוש לקוח או מספר…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className="mkt-live-filter">
            <span className="sr-only">סינון סטטוס</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">כל הסטטוסים</option>
              <option value="נשלחה">נשלחה</option>
              <option value="טיוטה">טיוטה</option>
              <option value="בהתקנה">בהתקנה</option>
              <option value="פתוחה">פתוחה</option>
            </select>
          </label>
        </div>

        <div className="mkt-live-tabs" role="tablist" aria-label="תצוגות הדגמה">
          {(
            [
              ["overview", "סקירה"],
              ["quotes", "הצעות"],
              ["service", "שירות"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? "is-active" : undefined}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "overview" ? (
          <div className="mkt-live-grid">
            <article className="mkt-live-card">
              <h3>סיכום יומי</h3>
              <p>
                <strong>3</strong> הצעות נשלחו · <strong>2</strong> עבודות פעילות
              </p>
            </article>
            <article className="mkt-live-card">
              <ActivityFeed compact />
            </article>
          </div>
        ) : null}

        {tab === "quotes" || tab === "service" ? (
          <div className="mkt-live-table-wrap">
            <table className="mkt-xp-table">
              <thead>
                <tr>
                  <th>מס׳</th>
                  <th>לקוח</th>
                  <th>סטטוס</th>
                  <th>סכום</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td dir="ltr">{r.id}</td>
                      <td>{r.customer}</td>
                      <td>
                        <span className="mkt-status is-info">{r.status}</span>
                      </td>
                      <td dir="ltr">{r.amount}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>אין תוצאות בהדגמה לסינון הנוכחי.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : null}

        {toast ? (
          <div className="mkt-toast" role="status">
            {toast}
          </div>
        ) : null}
      </div>
    </div>
  );
}
