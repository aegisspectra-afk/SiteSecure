import type { CatalogProduct, QuoteItemOut, QuoteSection } from "@site-secure/api-client";
import { Button, Input } from "@site-secure/ui";
import { MoreHorizontal, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { he } from "../../../i18n/he";
import { sortedQuoteItems } from "../../../lib/quote-cpq";
import type { QuoteLinePatch } from "../../../lib/quote-line-edit";
import { LINE_ITEM_DISCOUNT_TYPE } from "../../../lib/quote-line-edit";
import { formatMoney } from "../../../lib/quotes";
import { QuoteLineRow } from "./QuoteLineRow";

type AddBody = {
  item_type?: string;
  description?: string;
  sku?: string | null;
  qty?: number;
  unit_price?: number;
  discount?: number;
  discount_type?: string;
  product_id?: string;
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
  onPersistLine,
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
  onPersistLine: (itemId: string, body: QuoteLinePatch) => Promise<void>;
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

  const defaultFreeLine = useCallback(
    (): AddBody => ({
      item_type: "free",
      description: "",
      sku: "",
      qty: 1,
      unit_price: 0,
      discount: 0,
      discount_type: LINE_ITEM_DISCOUNT_TYPE,
    }),
    [],
  );

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
            <Button type="button" variant="secondary" loading={addPending} onClick={() => onAdd(defaultFreeLine())}>
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
              <Button type="button" onClick={() => onAdd(defaultFreeLine())}>
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
                                onAdd({ ...defaultFreeLine(), section_id: group.section!.id });
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
                      const globalIndex = rows.findIndex((r) => r.id === item.id);
                      return (
                        <QuoteLineRow
                          key={item.id}
                          item={item}
                          currency={currency}
                          canEdit={canEdit}
                          globalIndex={globalIndex}
                          rowCount={rows.length}
                          onPersist={onPersistLine}
                          onDelete={onDelete}
                          onReorder={onReorder}
                        />
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
                        discount: 0,
                        discount_type: LINE_ITEM_DISCOUNT_TYPE,
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
