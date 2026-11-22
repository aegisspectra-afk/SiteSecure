import {
  Boxes,
  ChevronLeft,
  FileStack,
  Layers,
  MessageSquareText,
  Package,
  Plus,
  Search,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { he } from "../../../i18n/he";

export type QuickAddActionId =
  | "catalog"
  | "free"
  | "service"
  | "note"
  | "section"
  | "system"
  | "addSystem"
  | "template";

export type QuickAddProduct = {
  id: string;
  name: string;
  sku?: string | null;
  selling_price?: number | null;
  category_path?: string | null;
  manufacturer?: string | null;
  kind?: string | null;
  image_url?: string | null;
};

type Action = {
  id: QuickAddActionId;
  label: string;
  hint: string;
  icon: LucideIcon;
  group: "planning" | "lines" | "document";
  emphasis?: boolean;
  extraHint?: string;
};

type FlatRow =
  | { kind: "header"; id: string; label: string }
  | {
      kind: "product";
      id: string;
      label: string;
      hint: string;
      price: string;
      imageUrl: string | null;
      icon: LucideIcon;
    }
  | {
      kind: "action";
      id: QuickAddActionId;
      label: string;
      hint: string;
      icon: LucideIcon;
      emphasis?: boolean;
      extraHint?: string;
    };

function formatPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "";
  return `₪${Number(value).toLocaleString("he-IL")}`;
}

function productLabel(p: QuickAddProduct): string {
  const skuPart = (p.sku || "").trim();
  return skuPart ? `${skuPart} · ${p.name}` : p.name;
}

function productHint(p: QuickAddProduct): string {
  const kindHint = p.kind === "service" ? he.quoteLaborBadge : "";
  const meta = [p.category_path, p.manufacturer].filter(Boolean).join(" · ");
  return [kindHint, meta].filter(Boolean).join(" · ");
}

function toProductRow(p: QuickAddProduct): FlatRow {
  return {
    kind: "product",
    id: p.id,
    label: productLabel(p),
    hint: productHint(p),
    price: formatPrice(p.selling_price),
    imageUrl: (p.image_url || "").trim() || null,
    icon: (p.kind === "service" ? Wrench : Package) as LucideIcon,
  };
}

export function QuoteQuickAdd({
  open,
  onClose,
  onAction,
  catalogResults,
  recentResults = [],
  catalogLoading,
  onCatalogQuery,
  onPickCatalog,
  canCatalog,
  canSystem,
  catalogKind = null,
}: {
  open: boolean;
  onClose: () => void;
  onAction: (id: QuickAddActionId) => void;
  catalogResults: QuickAddProduct[];
  /** Last products added in the workspace (empty-query strip). */
  recentResults?: QuickAddProduct[];
  catalogLoading?: boolean;
  onCatalogQuery: (q: string) => void;
  onPickCatalog: (productId: string) => void;
  canCatalog?: boolean;
  canSystem?: boolean;
  /** When "service", catalog hits are scoped to catalog kind=service. */
  catalogKind?: string | null;
}) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const selectLock = useRef(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const actions = useMemo(() => {
    const list: Action[] = [];
    if (canSystem) {
      list.push({
        id: "system",
        label: he.cpqQuickAddSystem,
        hint: he.cpqQuickAddSystemHint,
        icon: Sparkles,
        group: "planning",
        emphasis: true,
      });
    }
    if (canCatalog) {
      list.push(
        {
          id: "addSystem",
          label: he.cpqQuickAddAddSystem,
          hint: he.cpqQuickAddAddSystemHint,
          icon: Boxes,
          group: "planning",
          extraHint: he.cpqPackageVsTemplateHint,
        },
        {
          id: "template",
          label: he.cpqQuickAddTemplate,
          hint: he.cpqQuickAddTemplateHint,
          icon: FileStack,
          group: "planning",
          extraHint: he.cpqTemplateVsPackageHint,
        },
      );
    }
    list.push(
      {
        id: "service",
        label: he.cpqQuickAddService,
        hint: he.cpqQuickAddServiceHint,
        icon: Wrench,
        group: "lines",
      },
      {
        id: "free",
        label: he.cpqQuickAddFree,
        hint: he.cpqQuickAddFreeHint,
        icon: Plus,
        group: "lines",
      },
      {
        id: "section",
        label: he.cpqQuickAddSection,
        hint: he.cpqQuickAddSectionHint,
        icon: Layers,
        group: "document",
      },
      {
        id: "note",
        label: he.cpqQuickAddNote,
        hint: he.cpqQuickAddNoteHint,
        icon: MessageSquareText,
        group: "document",
      },
    );
    return list;
  }, [canCatalog, canSystem]);

  const qTrim = query.trim();
  const searching = qTrim.length >= 1 || catalogKind === "service";
  const showRecent = Boolean(canCatalog && !searching && recentResults.length > 0);

  const rows: FlatRow[] = useMemo(() => {
    const out: FlatRow[] = [];

    if (searching && canCatalog) {
      for (const p of catalogResults) out.push(toProductRow(p));
    } else if (showRecent) {
      out.push({ kind: "header", id: "hdr-recent", label: he.cpqQuickAddRecent });
      for (const p of recentResults) out.push(toProductRow(p));
    }

    const groups: Array<{ id: Action["group"]; label: string }> = [
      { id: "planning", label: he.cpqQuickAddGroupPlanning },
      { id: "lines", label: he.cpqQuickAddGroupLines },
      { id: "document", label: he.cpqQuickAddGroupDocument },
    ];
    for (const group of groups) {
      const items = actions.filter((a) => a.group === group.id);
      if (!items.length) continue;
      out.push({ kind: "header", id: `hdr-${group.id}`, label: group.label });
      for (const a of items) {
        out.push({
          kind: "action",
          id: a.id,
          label: a.label,
          hint: a.hint,
          icon: a.icon,
          emphasis: a.emphasis,
          extraHint: a.extraHint,
        });
      }
    }
    return out;
  }, [actions, canCatalog, catalogResults, recentResults, searching, showRecent]);

  const selectable = useMemo(() => rows.filter((r) => r.kind !== "header"), [rows]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActive(0);
      selectLock.current = false;
      onCatalogQuery("");
      return;
    }
    selectLock.current = false;
    window.setTimeout(() => inputRef.current?.focus(), 20);
  }, [open, onCatalogQuery]);

  useEffect(() => {
    setActive(0);
  }, [query, catalogKind, recentResults.length, catalogResults.length]);

  function selectRow(row: FlatRow) {
    if (row.kind === "header") return;
    if (selectLock.current) return;
    selectLock.current = true;
    window.setTimeout(() => {
      selectLock.current = false;
    }, 250);

    if (row.kind === "product") {
      onClose();
      onPickCatalog(row.id);
      return;
    }
    const actionId = row.id;
    if (actionId !== "service" && actionId !== "catalog") onClose();
    onAction(actionId);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (!selectable.length) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((i) => Math.min(i + 1, selectable.length - 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const row = selectable[active];
        if (!row) return;
        selectRow(row);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, selectable, active, onClose, onAction, onPickCatalog]);

  if (!open || typeof document === "undefined") return null;

  let selectableIndex = -1;

  return createPortal(
    <div className="cpq-quick-add-overlay" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="cpq-quick-add cpq-quick-add--sheet"
        onClick={(ev) => ev.stopPropagation()}
      >
        <p id={titleId} className="sr-only">
          {he.cpqQuickAddTitle}
        </p>
        <div className="cpq-quick-add-search">
          <Search className="size-4 text-fg-muted" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(ev) => {
              const value = ev.target.value;
              setQuery(value);
              onCatalogQuery(value);
            }}
            placeholder={
              catalogKind === "service" ? he.cpqQuickAddPlaceholderService : he.cpqQuickAddPlaceholder
            }
            className="cpq-quick-add-input"
            autoComplete="off"
          />
        </div>
        <ul className="cpq-quick-add-list" role="listbox">
          {catalogLoading && searching ? (
            <li className="px-3 py-2 text-sm text-fg-muted">{he.loading}</li>
          ) : null}
          {rows.map((row) => {
            if (row.kind === "header") {
              return (
                <li key={row.id} className="cpq-quick-add-group" role="presentation">
                  {row.label}
                </li>
              );
            }
            selectableIndex += 1;
            const index = selectableIndex;
            const Icon = row.icon;
            const isActive = index === active;
            const emphasisClass = row.kind === "action" && row.emphasis ? " is-emphasis" : "";
            return (
              <li key={`${row.kind}-${row.id}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`cpq-quick-add-row${isActive ? " is-active" : ""}${emphasisClass}`}
                  onMouseEnter={() => setActive(index)}
                  onPointerDown={(ev) => {
                    if (ev.button !== 0) return;
                    ev.preventDefault();
                    setActive(index);
                    selectRow(row);
                  }}
                >
                  {row.kind === "product" && row.imageUrl ? (
                    <img
                      src={row.imageUrl}
                      alt={row.label}
                      className="cpq-quick-add-thumb"
                      loading="lazy"
                    />
                  ) : (
                    <span className="cpq-quick-add-icon" aria-hidden>
                      <Icon className="size-4" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 text-start">
                    <span className="block text-sm font-medium text-fg">{row.label}</span>
                    {row.hint ? <span className="block text-xs text-fg-muted">{row.hint}</span> : null}
                    {row.kind === "action" && row.extraHint ? (
                      <span className="block text-[0.65rem] text-fg-subtle">{row.extraHint}</span>
                    ) : null}
                  </span>
                  {row.kind === "product" && row.price ? (
                    <span className="cpq-quick-add-price">{row.price}</span>
                  ) : (
                    <ChevronLeft className="cpq-quick-add-chevron size-4 text-fg-subtle" aria-hidden />
                  )}
                </button>
              </li>
            );
          })}
          {!selectable.length && !catalogLoading ? (
            <li className="px-3 py-4 text-center text-sm text-fg-muted">{he.cpqQuickAddEmpty}</li>
          ) : null}
        </ul>
        <p className="cpq-quick-add-hint">{he.cpqQuickAddKeys}</p>
      </div>
    </div>,
    document.body,
  );
}
