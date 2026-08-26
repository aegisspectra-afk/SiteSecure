import type { CatalogProduct, QuoteItemOut, QuoteSection } from "@site-secure/api-client";
import { Button, Input } from "@site-secure/ui";
import { ArrowDown, ArrowUp, MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";
import { he } from "../../../i18n/he";
import { catalogListPrice, isPriceOverride, sortedQuoteItems } from "../../../lib/quote-cpq";
import { parseNonNegative } from "../../../lib/quote-builder";
import { formatMoney } from "../../../lib/quotes";

type AddBody = {
  item_type?: string;
  description?: string;
  sku?: string | null;
  qty?: number;
  unit_price?: number;
  product_id?: string;
  section_id?: string | null;
};

type PatchBody = {
  qty?: number;
  unit_price?: number;
  discount?: number;
  description?: string;
  sku?: string | null;
  sort_order?: number;
  section_id?: string | null;
};

export function QuoteLinesPanel({
  items,
  sections = [],
  currency,
  canEdit,
  canCatalog,
  catalogQ,
  onCatalogQ,
  catalogResults,
  catalogLoading,
  debouncedCatalogQ,
  onAdd,
  onPatch,
  onDelete,
  onReorder,
  onOpenSystemBuilder,
  onOpenQuickAdd,
  onFocusCatalog,
  onAddSection,
  onRenameSection,
  onToggleSection,
  onDuplicateSection,
  onDeleteSection,
  addPending,
}: {
  items: QuoteItemOut[];
  sections?: QuoteSection[];
  currency: string;
  canEdit: boolean;
  canCatalog: boolean;
  catalogQ: string;
  onCatalogQ: (value: string) => void;
  catalogResults: CatalogProduct[];
  catalogLoading: boolean;
  debouncedCatalogQ: string;
  onAdd: (body: AddBody) => void;
  onPatch: (itemId: string, body: PatchBody) => void;
  onDelete: (itemId: string) => void;
  onReorder: (itemId: string, direction: "up" | "down") => void;
  onOpenSystemBuilder?: () => void;
  onOpenQuickAdd?: () => void;
  onFocusCatalog?: () => void;
  onAddSection?: () => void;
  onRenameSection?: (sectionId: string, name: string) => void;
  onToggleSection?: (sectionId: string, collapsed: boolean) => void;
  onDuplicateSection?: (sectionId: string) => void;
  onDeleteSection?: (sectionId: string) => void;
  addPending?: boolean;
}) {
  const rows = sortedQuoteItems(items);
  const sectionOrder = [...sections].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const grouped = groupBySection(rows, sectionOrder);
  const [sectionMenuId, setSectionMenuId] = useState<string | null>(null);
  const [flashItemId, setFlashItemId] = useState<string | null>(null);

  function patchWithFlash(itemId: string, body: PatchBody) {
    onPatch(itemId, body);
    setFlashItemId(itemId);
    window.setTimeout(() => setFlashItemId((cur) => (cur === itemId ? null : cur)), 1200);
  }

  return (
    <section id="quote-items" tabIndex={-1} className="cpq-content-panel flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-fg">{he.cpqContentTitle}</h2>
          <p className="mt-1 text-sm text-fg-muted">{he.quoteItemsCount(rows.length)}</p>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => onOpenQuickAdd?.()}>
              <Plus className="size-4" aria-hidden />
              {he.cpqAddCommand}
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={addPending}
              onClick={() => onAdd({ item_type: "free", description: "", sku: "", qty: 1, unit_price: 0 })}
            >
              <Plus className="size-4" aria-hidden />
              {he.quoteAddItem}
            </Button>
            {onAddSection ? (
              <Button type="button" variant="secondary" onClick={onAddSection}>
                <Plus className="size-4" aria-hidden />
                {he.cpqAddSection}
              </Button>
            ) : null}
            {onOpenSystemBuilder ? (
              <Button type="button" variant="secondary" onClick={onOpenSystemBuilder}>
                {he.cpqBuildSystem}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {rows.length === 0 && sectionOrder.length === 0 ? (
        <div className="cpq-empty">
          <p className="cpq-empty-title">{he.cpqEmptyTitle}</p>
          <p className="cpq-empty-body">{he.cpqEmptyBody}</p>
          {canEdit ? (
            <div className="cpq-empty-actions-simple">
              <Button
                type="button"
                onClick={() => onAdd({ item_type: "free", description: "", sku: "", qty: 1, unit_price: 0 })}
              >
                {he.quoteAddItem}
              </Button>
              {onOpenSystemBuilder ? (
                <Button type="button" variant="secondary" onClick={onOpenSystemBuilder}>
                  {he.cpqBuildSystem}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  onFocusCatalog?.();
                  document.getElementById("catalog-search")?.focus();
                }}
              >
                {he.cpqEmptyCatalogTitle}
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {grouped.map((group) => {
            const sectionNet = group.items
              .filter((i) => i.item_type !== "note")
              .reduce((sum, i) => sum + Number(i.line_net || 0), 0);
            return (
            <div key={group.id ?? "none"} className="flex flex-col gap-3">
              {group.section ? (
                <div className="cpq-section-head">
                  <div className="min-w-0 flex-1">
                    {canEdit && onRenameSection ? (
                      <Input
                        id={`section-name-${group.section.id}`}
                        label={he.cpqAddSection}
                        className="max-w-sm font-medium"
                        value={group.section.name}
                        onChange={(e) => onRenameSection(group.section!.id, e.target.value)}
                      />
                    ) : (
                      <h3 className="text-base font-semibold">{group.section.name || he.cpqSectionUntitled}</h3>
                    )}
                    <p className="mt-1 text-xs text-fg-muted">
                      {he.quoteItemsCount(group.items.length)}
                      {group.items.length ? ` · ${formatMoney(sectionNet, currency)}` : ""}
                    </p>
                  </div>
                  {canEdit ? (
                    <div className="relative">
                      <Button
                        type="button"
                        variant="ghost"
                        aria-label={he.cpqSectionMenu}
                        aria-expanded={sectionMenuId === group.section.id}
                        onClick={() =>
                          setSectionMenuId((id) => (id === group.section!.id ? null : group.section!.id))
                        }
                      >
                        <MoreHorizontal className="size-4" aria-hidden />
                      </Button>
                      {sectionMenuId === group.section.id ? (
                        <div className="cpq-overflow-menu" role="menu">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              onAdd({
                                item_type: "free",
                                description: "",
                                sku: "",
                                qty: 1,
                                unit_price: 0,
                                section_id: group.section!.id,
                              });
                              setSectionMenuId(null);
                            }}
                          >
                            {he.quoteAddItem}
                          </button>
                          {onDuplicateSection ? (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                onDuplicateSection(group.section!.id);
                                setSectionMenuId(null);
                              }}
                            >
                              {he.cpqSectionDuplicate}
                            </button>
                          ) : null}
                          {onToggleSection ? (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                onToggleSection(group.section!.id, !group.section!.collapsed);
                                setSectionMenuId(null);
                              }}
                            >
                              {group.section.collapsed ? he.cpqSectionExpand : he.cpqSectionCollapse}
                            </button>
                          ) : null}
                          {onDeleteSection ? (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                onDeleteSection(group.section!.id);
                                setSectionMenuId(null);
                              }}
                            >
                              {he.cpqSectionDelete}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : sectionOrder.length > 0 ? (
                <h3 className="text-sm font-medium text-fg-muted">{he.cpqUnsectioned}</h3>
              ) : null}

              {group.section?.collapsed ? null : (
                <div className="flex flex-col gap-3">
                  {group.items.map((item) => {
                    const override = isPriceOverride(item);
                    const listPrice = catalogListPrice(item);
                    const globalIndex = rows.findIndex((r) => r.id === item.id);
                    return (
                      <div
                        key={item.id}
                        className="cpq-line-row grid gap-2 rounded-[var(--radius-control)] border border-border p-3 sm:grid-cols-[6.5rem_minmax(0,1fr)_5rem_7rem_5.5rem_auto]"
                      >
                        <Input
                          id={`item-sku-${item.id}`}
                          label={he.quoteProductSku}
                          className="ltr-meta font-mono text-xs"
                          value={item.sku ?? ""}
                          disabled={!canEdit}
                          onChange={(e) => patchWithFlash(item.id, { sku: e.target.value })}
                        />
                        <div className="flex min-w-0 flex-col gap-1">
                          <Input
                            id={`item-desc-${item.id}`}
                            label={he.quoteItemDescription}
                            value={item.description}
                            disabled={!canEdit}
                            onChange={(e) => patchWithFlash(item.id, { description: e.target.value })}
                          />
                          <div className="flex flex-wrap gap-2 text-xs text-fg-muted">
                            {item.package_name ? (
                              <span className="rounded border border-border px-1.5 py-0.5">
                                {he.cpqPackageBadge}: {item.package_name}
                              </span>
                            ) : null}
                            {override ? (
                              <span className="rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-warning">
                                {he.cpqPriceOverride}
                                {listPrice != null ? ` (${formatMoney(listPrice, currency)})` : ""}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <Input
                          id={`item-qty-${item.id}`}
                          label={he.quoteQty}
                          type="number"
                          min={0}
                          step="1"
                          value={item.qty}
                          disabled={!canEdit}
                          onChange={(e) => patchWithFlash(item.id, { qty: parseNonNegative(e.target.value) })}
                        />
                        <Input
                          id={`item-price-${item.id}`}
                          label={he.quoteUnitPrice}
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.unit_price}
                          disabled={!canEdit}
                          onChange={(e) => patchWithFlash(item.id, { unit_price: parseNonNegative(e.target.value) })}
                        />
                        <Input
                          id={`item-discount-${item.id}`}
                          label={he.quoteDiscount}
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.discount ?? 0}
                          disabled={!canEdit}
                          onChange={(e) => patchWithFlash(item.id, { discount: parseNonNegative(e.target.value) })}
                        />
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-sm font-medium">{formatMoney(item.line_net, currency)}</span>
                          {flashItemId === item.id ? <span className="cpq-line-saved">{he.cpqLineSaved}</span> : null}
                          {canEdit ? (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                aria-label={he.cpqMoveUp}
                                disabled={globalIndex <= 0}
                                onClick={() => onReorder(item.id, "up")}
                              >
                                <ArrowUp className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                aria-label={he.cpqMoveDown}
                                disabled={globalIndex >= rows.length - 1}
                                onClick={() => onReorder(item.id, "down")}
                              >
                                <ArrowDown className="size-4" />
                              </Button>
                              <Button type="button" variant="ghost" onClick={() => onDelete(item.id)}>
                                {he.quoteDeleteItem}
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  {!group.items.length ? <p className="text-sm text-fg-subtle">{he.quoteItemsEmpty}</p> : null}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      {canCatalog && canEdit ? (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <Input
            id="catalog-search"
            label={he.quoteCatalogSearch}
            value={catalogQ}
            onChange={(e) => onCatalogQ(e.target.value)}
            placeholder={he.quoteCatalogSearchHint}
          />
          {catalogLoading ? <p className="text-xs text-fg-muted">{he.loading}</p> : null}
          {debouncedCatalogQ && catalogResults.length ? (
            <ul className="flex max-h-40 flex-col gap-1 overflow-auto text-sm">
              {catalogResults.map((product) => (
                <li key={product.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-start hover:bg-bg-2"
                    onClick={() =>
                      onAdd({
                        product_id: product.id,
                        item_type: "catalog",
                        description: product.description || product.name,
                        sku: product.sku,
                        qty: 1,
                        unit_price: product.selling_price ?? product.list_price,
                      })
                    }
                  >
                    <span className="min-w-0 text-start">
                      <span className="block font-medium">
                        {product.sku ? <span className="ltr-meta me-2 font-mono text-xs">{product.sku}</span> : null}
                        {product.name}
                      </span>
                      <span className="block text-xs text-fg-muted">
                        {[product.category_path, product.manufacturer].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span>{formatMoney(product.selling_price ?? product.list_price, currency)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function groupBySection(items: QuoteItemOut[], sections: QuoteSection[]) {
  const byId = new Map(sections.map((s) => [s.id, s]));
  const buckets = new Map<string | null, QuoteItemOut[]>();
  for (const section of sections) buckets.set(section.id, []);
  buckets.set(null, []);
  for (const item of items) {
    const sid = item.section_id && byId.has(item.section_id) ? item.section_id : null;
    const list = buckets.get(sid) ?? [];
    list.push(item);
    buckets.set(sid, list);
  }
  const groups: Array<{ id: string | null; section: QuoteSection | null; items: QuoteItemOut[] }> = [];
  for (const section of sections) {
    groups.push({ id: section.id, section, items: buckets.get(section.id) ?? [] });
  }
  const loose = buckets.get(null) ?? [];
  if (loose.length || !sections.length) {
    groups.push({ id: null, section: null, items: loose });
  }
  return groups;
}
