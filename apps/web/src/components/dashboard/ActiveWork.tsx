import type { DashboardItem } from "@site-secure/api-client";
import { Status } from "@site-secure/ui";
import { he } from "../../i18n/he";

function formatTime(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function ActiveWork({ items }: { items: DashboardItem[] }) {
  if (!items.length) return null;
  return (
    <section className="ops-card p-5" aria-labelledby="active-work-heading">
      <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">ACTIVE WORK</p>
      <h2 id="active-work-heading" className="mt-1 text-base font-semibold text-fg">
        {he.activeWorkTitle}
      </h2>
      <p className="mt-1 text-sm text-fg-muted">{he.activeWorkCount(items.length)}</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-start text-sm">
          <thead>
            <tr className="text-xs text-fg-muted">
              <th className="py-2 pe-3 font-medium">{he.activeWorkColJob}</th>
              <th className="py-2 pe-3 font-medium">{he.activeWorkColSite}</th>
              <th className="py-2 font-medium">{he.activeWorkColStatus}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const time = formatTime(item.scheduled_for);
              return (
                <tr key={item.entity_id} className="border-t border-border">
                  <td className="py-2 pe-3">
                    <span className="font-medium text-fg">{item.number}</span>
                    {time ? (
                      <span className="ltr-meta mt-0.5 block text-xs text-fg-muted" dir="ltr">
                        {time}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 pe-3 text-fg-muted">{item.site_name || item.customer_name || "—"}</td>
                  <td className="py-2">
                    <Status
                      label={item.title_he}
                      tone={item.severity === "now" ? "warning" : "info"}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
