import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@site-secure/ui";
import { he } from "../i18n/he";
import { displayWorkspaceName } from "../lib/quotes";
import { useSession } from "../lib/session";
import { planLabel, roleLabel } from "../lib/app-nav";

export function WorkspaceSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const { session, switchWorkspace } = useSession();
  const memberships = session?.memberships ?? [];
  const active = memberships[0];
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (memberships.length <= 1 || !active) {
    return null;
  }

  const label = displayWorkspaceName(active.workspace_name) || he.brand;

  async function onSelect(workspaceId: string) {
    if (workspaceId === active?.workspace_id || busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await switchWorkspace(workspaceId);
      if (!next) {
        setError(he.workspaceSwitchFailed);
        return;
      }
      setOpen(false);
    } catch {
      setError(he.workspaceSwitchFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("relative", collapsed && "px-1")}>
      <button
        type="button"
        className={cn(
          "flex w-full min-h-10 items-center gap-2 rounded-[var(--radius-control)] border border-border bg-bg-1 px-2.5 text-start text-sm text-fg transition-colors hover:bg-bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
          collapsed && "justify-center px-2",
        )}
        aria-label={he.workspaceSwitcherLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
      >
        {!collapsed ? (
          <span className="min-w-0 flex-1 truncate font-medium">{busy ? he.workspaceSwitching : label}</span>
        ) : (
          <span className="sr-only">{label}</span>
        )}
        <ChevronDown className="size-4 shrink-0 text-fg-muted" aria-hidden />
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-label={he.workspaceSwitcherLabel}
          className="absolute z-40 mt-1 max-h-64 w-full min-w-[12rem] overflow-auto rounded-[var(--radius-control)] border border-border bg-bg-1 py-1 shadow-md"
        >
          {memberships.map((m) => {
            const selected = m.workspace_id === active.workspace_id;
            const name = displayWorkspaceName(m.workspace_name) || m.workspace_id;
            return (
              <li key={m.workspace_id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full flex-col gap-0.5 px-3 py-2 text-start text-sm hover:bg-bg-subtle",
                    selected && "bg-bg-subtle",
                  )}
                  disabled={busy || selected}
                  onClick={() => void onSelect(m.workspace_id)}
                >
                  <span className="font-medium text-fg">{name}</span>
                  <span className="text-xs text-fg-muted">
                    {[planLabel(m.plan_key), roleLabel(m.role_key), selected ? he.workspaceSwitcherCurrent : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
