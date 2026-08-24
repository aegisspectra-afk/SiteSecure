import type { GlobalSearchHit } from "@site-secure/api-client";
import { cn } from "@site-secure/ui";
import { useNavigate } from "@tanstack/react-router";
import {
  Building2,
  ClipboardList,
  FileText,
  FolderKanban,
  Package,
  Plus,
  Search,
  UserPlus,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { he } from "../i18n/he";
import { can } from "../lib/can";
import { useSession } from "../lib/session";

type CommandAction = {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: () => void;
};

const entityIcon: Record<GlobalSearchHit["entity_type"], LucideIcon> = {
  customer: Building2,
  site: ClipboardList,
  lead: UserPlus,
  quote: FileText,
  project: FolderKanban,
  service: Wrench,
  equipment: Package,
};

function entityLabel(type: GlobalSearchHit["entity_type"]): string {
  switch (type) {
    case "customer":
      return he.navCustomers;
    case "site":
      return he.navSiteFiles;
    case "lead":
      return he.navLeads;
    case "quote":
      return he.navQuotes;
    case "project":
      return he.navProjects;
    case "service":
      return he.navServiceShort;
    case "equipment":
      return he.commandEquipment;
    default:
      return type;
  }
}

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { session, api } = useSession();
  const navigate = useNavigate();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const roleKey = membership?.role_key;
  const features = membership?.features ?? [];
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GlobalSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  const actions = useMemo<CommandAction[]>(() => {
    const list: CommandAction[] = [];
    if (can(roleKey, "leads.create", features)) {
      list.push({
        id: "new-lead",
        label: he.commandNewLead,
        hint: he.navLeads,
        icon: Plus,
        run: () => {
          try {
            sessionStorage.setItem("site-secure-open-new-lead", "1");
          } catch {
            /* ignore */
          }
          void navigate({ to: "/app/leads" });
        },
      });
    }
    if (can(roleKey, "quotes.create", features)) {
      list.push({
        id: "new-quote",
        label: he.commandNewQuote,
        hint: he.navQuotes,
        icon: Plus,
        run: () => void navigate({ to: "/app/quotes/new" }),
      });
    }
    if (can(roleKey, "crm.create", features)) {
      list.push({
        id: "new-customer",
        label: he.commandNewCustomer,
        hint: he.navCustomers,
        icon: Plus,
        run: () => void navigate({ to: "/app/customers" }),
      });
    }
    if (can(roleKey, "service.create", features)) {
      list.push({
        id: "new-service",
        label: he.commandNewService,
        hint: he.navServiceShort,
        icon: Plus,
        run: () => void navigate({ to: "/app/service" }),
      });
    }
    list.push({
      id: "go-today",
      label: he.commandOpenToday,
      icon: ClipboardList,
      run: () => void navigate({ to: "/app/today" }),
    });
    return list;
  }, [features, navigate, roleKey]);

  const filteredActions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return actions;
    return actions.filter((action) => action.label.toLowerCase().includes(needle));
  }, [actions, query]);

  const rows = useMemo(() => {
    const result: { kind: "action" | "hit"; action?: CommandAction; hit?: GlobalSearchHit }[] = [];
    for (const action of filteredActions) result.push({ kind: "action", action });
    for (const hit of hits) result.push({ kind: "hit", hit });
    return result;
  }, [filteredActions, hits]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setHits([]);
      setActive(0);
      return;
    }
    const id = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open || !workspaceId) return;
    const needle = query.trim();
    if (needle.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void api
        .globalSearch(workspaceId, needle)
        .then((res) => {
          if (!cancelled) setHits(res.items);
        })
        .catch(() => {
          if (!cancelled) setHits([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [api, open, query, workspaceId]);

  useEffect(() => {
    setActive(0);
  }, [query, hits.length, filteredActions.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((value) => (rows.length ? (value + 1) % rows.length : 0));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((value) => (rows.length ? (value - 1 + rows.length) % rows.length : 0));
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const row = rows[active];
        if (!row) return;
        if (row.kind === "action" && row.action) {
          row.action.run();
          onClose();
        } else if (row.hit) {
          void navigate({ to: row.hit.href as never });
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, navigate, onClose, open, rows]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="command-palette-root" role="presentation">
      <button type="button" className="command-palette-backdrop" aria-label="סגור" onClick={onClose} />
      <div className="command-palette" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="command-palette-search">
          <Search className="size-4 shrink-0 text-fg-muted" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={he.commandSearchPlaceholder}
            aria-label={he.commandSearchPlaceholder}
          />
          <button type="button" className="command-palette-close" aria-label="סגור" onClick={onClose}>
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <p id={titleId} className="command-palette-hint">
          {he.commandSearchHint}
        </p>
        <div className="command-palette-body">
          {loading ? <p className="command-palette-empty">{he.loading}</p> : null}
          {!loading && rows.length === 0 ? (
            <p className="command-palette-empty">{query.trim() ? he.navCommandEmpty : he.commandEmptyIdle}</p>
          ) : null}
          <ul className="command-palette-list">
            {rows.map((row, index) => {
              if (row.kind === "action" && row.action) {
                const Icon = row.action.icon;
                return (
                  <li key={row.action.id}>
                    <button
                      type="button"
                      className={cn("command-palette-item", index === active && "is-active")}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => {
                        row.action!.run();
                        onClose();
                      }}
                    >
                      <span className="command-palette-icon">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1 text-start">
                        <span className="block truncate font-medium">{row.action.label}</span>
                        {row.action.hint ? (
                          <span className="block truncate text-xs text-fg-muted">{row.action.hint}</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              }
              if (!row.hit) return null;
              const Icon = entityIcon[row.hit.entity_type];
              return (
                <li key={`${row.hit.entity_type}-${row.hit.id}`}>
                  <button
                    type="button"
                    className={cn("command-palette-item", index === active && "is-active")}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => {
                      void navigate({ to: row.hit!.href as never });
                      onClose();
                    }}
                  >
                    <span className="command-palette-icon">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 text-start">
                      <span className="block truncate font-medium">{row.hit.title}</span>
                      <span className="block truncate text-xs text-fg-muted">
                        {entityLabel(row.hit.entity_type)}
                        {row.hit.subtitle ? ` · ${row.hit.subtitle}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <p className="command-palette-footer">{he.commandShortcutHint}</p>
      </div>
    </div>,
    document.body,
  );
}

export function useCommandPaletteHotkey(onOpen: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta || event.key.toLowerCase() !== "k") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable=true]")) {
        // Still allow Cmd+K from inputs — command palette is global.
      }
      event.preventDefault();
      onOpen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpen]);
}
