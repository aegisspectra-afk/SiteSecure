import {
  Boxes,
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

type Action = {
  id: QuickAddActionId;
  label: string;
  hint: string;
  icon: LucideIcon;
  keywords: string;
};

type Row =
  | {
      kind: "product";
      id: string;
      label: string;
      hint: string;
      icon: LucideIcon;
    }
  | {
      kind: "action";
      id: QuickAddActionId;
      label: string;
      hint: string;
      icon: LucideIcon;
    };

export function QuoteQuickAdd({
  open,
  onClose,
  onAction,
  catalogResults,
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
  catalogResults: Array<{
    id: string;
    name: string;
    sku?: string | null;
    selling_price?: number | null;
    category_path?: string | null;
    manufacturer?: string | null;
    kind?: string | null;
  }>;
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
    const list: Action[] = [
      {
        id: "catalog",
        label: he.cpqQuickAddCatalog,
        hint: he.cpqQuickAddCatalogHint,
        icon: Package,
        keywords: "catalog קטלוג מוצר sku",
      },
      {
        id: "free",
        label: he.cpqQuickAddFree,
        hint: he.cpqQuickAddFreeHint,
        icon: Plus,
        keywords: "free שורה חופשית פריט מותאם",
      },
      {
        id: "service",
        label: he.cpqQuickAddService,
        hint: he.cpqQuickAddServiceHint,
        icon: Wrench,
        keywords: "service labor שירות עבודה התקנה",
      },
      {
        id: "note",
        label: he.cpqQuickAddNote,
        hint: he.cpqQuickAddNoteHint,
        icon: MessageSquareText,
        keywords: "note הערה טקסט",
      },
      {
        id: "section",
        label: he.cpqQuickAddSection,
        hint: he.cpqQuickAddSectionHint,
        icon: Layers,
        keywords: "section סעיף מקטע",
      },
    ];
    if (canSystem) {
      list.push({
        id: "system",
        label: he.cpqQuickAddSystem,
        hint: he.cpqQuickAddSystemHint,
        icon: Sparkles,
        keywords: "system מערכת cctv בנה תכנון",
      });
    }
    if (canCatalog) {
      list.push(
        {
          id: "addSystem",
          label: he.cpqQuickAddAddSystem,
          hint: he.cpqQuickAddAddSystemHint,
          icon: Boxes,
          keywords: "package חבילה מערכת מוכנה",
        },
        {
          id: "template",
          label: he.cpqQuickAddTemplate,
          hint: he.cpqQuickAddTemplateHint,
          icon: FileStack,
          keywords: "template תבנית הצעה",
        },
      );
    }
    return list;
  }, [canCatalog, canSystem]);

  const filteredActions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((a) => `${a.label} ${a.hint} ${a.keywords}`.toLowerCase().includes(q));
  }, [actions, query]);

  const showCatalogHits = Boolean(canCatalog && (query.trim().length >= 1 || catalogKind === "service"));
  const rows: Row[] = showCatalogHits
    ? [
        ...catalogResults.map((p) => {
          const skuPart = (p.sku || "").trim();
          const label = skuPart ? `${skuPart} · ${p.name}` : p.name;
          const meta = [p.category_path, p.manufacturer].filter(Boolean).join(" · ");
          const price =
            p.selling_price != null && Number.isFinite(Number(p.selling_price))
              ? `₪${Number(p.selling_price).toLocaleString("he-IL")}`
              : "";
          const kindHint = p.kind === "service" ? he.quoteLaborBadge : "";
          const hint = [kindHint, meta, price].filter(Boolean).join(" · ");
          return {
            kind: "product" as const,
            id: p.id,
            label,
            hint,
            icon: (p.kind === "service" ? Wrench : Package) as LucideIcon,
          };
        }),
        ...filteredActions.map((a) => ({
          kind: "action" as const,
          id: a.id,
          label: a.label,
          hint: a.hint,
          icon: a.icon,
        })),
      ]
    : filteredActions.map((a) => ({
        kind: "action" as const,
        id: a.id,
        label: a.label,
        hint: a.hint,
        icon: a.icon,
      }));

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

  function selectRow(row: Row) {
    if (selectLock.current) return;
    selectLock.current = true;
    // Release quickly so multi-add catalog picks still work while dialog stays open.
    window.setTimeout(() => {
      selectLock.current = false;
    }, 250);

    if (row.kind === "product") {
      onClose();
      onPickCatalog(row.id);
      return;
    }
    const actionId = row.id;
    // Close first for instant feedback (catalog/service keep browse mode open).
    if (actionId !== "catalog" && actionId !== "service") onClose();
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
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((i) => Math.min(i + 1, Math.max(rows.length - 1, 0)));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const row = rows[active];
        if (!row) return;
        selectRow(row);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, rows, active, onClose, onAction, onPickCatalog]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="cpq-quick-add-overlay" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="cpq-quick-add"
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
              setActive(0);
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
          {catalogLoading && showCatalogHits ? (
            <li className="px-3 py-2 text-sm text-fg-muted">{he.loading}</li>
          ) : null}
          {rows.map((row, index) => {
            const Icon = row.icon;
            return (
              <li key={`${row.kind}-${row.id}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  className={`cpq-quick-add-row${index === active ? " is-active" : ""}`}
                  onMouseEnter={() => setActive(index)}
                  onPointerDown={(ev) => {
                    if (ev.button !== 0) return;
                    // Fire on pointerdown so the choice registers before overlay teardown.
                    ev.preventDefault();
                    setActive(index);
                    selectRow(row);
                  }}
                >
                  <span className="cpq-quick-add-icon" aria-hidden>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 text-start">
                    <span className="block text-sm font-medium text-fg">{row.label}</span>
                    {row.hint ? <span className="block text-xs text-fg-muted">{row.hint}</span> : null}
                  </span>
                </button>
              </li>
            );
          })}
          {!rows.length ? <li className="px-3 py-4 text-center text-sm text-fg-muted">{he.cpqQuickAddEmpty}</li> : null}
        </ul>
        <p className="cpq-quick-add-hint">{he.cpqQuickAddKeys}</p>
      </div>
    </div>,
    document.body,
  );
}
