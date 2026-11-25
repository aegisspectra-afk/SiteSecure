import { useId, useMemo, useState } from "react";
import { DEMO_ACTIVITY, DEMO_BADGE } from "./demo-data";

type ToneFilter = "all" | "ok" | "warn" | "info";

const TONE_LABEL: Record<Exclude<ToneFilter, "all">, string> = {
  ok: "הצלחה",
  warn: "דורש תשומת לב",
  info: "מידע",
};

/** Operational activity feed preview. */
export function ActivityFeed({ compact = false }: { compact?: boolean }) {
  const baseId = useId();
  const [tone, setTone] = useState<ToneFilter>("all");
  const [selected, setSelected] = useState<string | null>(DEMO_ACTIVITY[0]?.id ?? null);

  const items = useMemo(
    () => (tone === "all" ? DEMO_ACTIVITY : DEMO_ACTIVITY.filter((a) => a.tone === tone)),
    [tone],
  );

  const active = items.find((a) => a.id === selected) ?? items[0] ?? null;

  return (
    <div className={`mkt-feed${compact ? " is-compact" : ""}`}>
      <div className="mkt-feed-head">
        <div>
          <h3 className="m-0 text-base font-semibold">פיד פעילות</h3>
          {!compact ? <p className="mkt-demo-badge mt-2">{DEMO_BADGE}</p> : null}
        </div>
        <div className="mkt-xp-tabs" role="tablist" aria-label="סינון לפי סוג אירוע">
          {(
            [
              ["all", "הכל"],
              ["ok", "הצלחה"],
              ["warn", "אזהרה"],
              ["info", "מידע"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tone === key}
              className={`mkt-xp-tab${tone === key ? " is-active" : ""}`}
              onClick={() => {
                setTone(key);
                setSelected(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {items.length ? (
        <ul className="mkt-demo-feed" aria-labelledby={`${baseId}-list`}>
          <span id={`${baseId}-list`} className="sr-only">
            אירועי הדגמה מסוננים
          </span>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`mkt-feed-row${active?.id === item.id ? " is-active" : ""}`}
                aria-pressed={active?.id === item.id}
                onClick={() => setSelected(item.id)}
              >
                <time dateTime={`2026-01-01T${item.time}:00`}>{item.time}</time>
                <span className={`mkt-status-dot is-${item.tone}`} aria-hidden />
                <p>{item.text}</p>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mkt-card mt-3 text-sm" role="status">
          אין אירועים בסינון הנוכחי.
        </p>
      )}

      {active && !compact ? (
        <div className="mkt-feed-detail mkt-card" aria-live="polite">
          <p className="m-0 text-xs font-semibold text-[var(--mkt-muted)]">
            {TONE_LABEL[active.tone]} · {active.time}
          </p>
          <p className="mt-2 m-0 text-[17px] leading-7">{active.text}</p>
        </div>
      ) : null}
    </div>
  );
}
