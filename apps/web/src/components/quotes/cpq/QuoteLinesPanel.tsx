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
import { QuoteSectionDiscountField } from "./QuoteSectionDiscountField";
import { QuoteSectionNameField } from "./QuoteSectionNameField";
import { SolutionItemCard } from "./SolutionItemCard";

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

export type QuoteLinesWorkspaceMode = "planning" | "pricing";

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
  onOpenAddSystem,
  onOpenQuickAdd,
  onFocusCatalog,
  onAddSection,
  onRenameSection,
  onPatchSectionDiscount,
  onToggleSection,
  onDuplicateSection,
  onDeleteSection,
  onGoToPlanning,
  workspaceMode = "planning",
  addPending,
  quoteDiscountAmount,
  quoteDiscountPercent,
  onQuoteDiscountAmount,
  onQuoteDiscountPercent,
  validUntil,
  onValidUntil,
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
  onOpenAddSystem?: () => void;
  onOpenQuickAdd?: () => void;
  onFocusCatalog?: () => void;
  onAddSection?: () => void;
  onRenameSection?: (sectionId: string, name: string) => Promise<void>;
  onPatchSectionDiscount?: (sectionId: string, body: { discount_type: string; discount_value: number }) => void;
  onToggleSection?: (sectionId: string, collapsed: boolean) => void;
  onDuplicateSection?: (sectionId: string) => void;
  onDeleteSection?: (sectionId: string) => void;
  onGoToPlanning?: () => void;
  workspaceMode?: QuoteLinesWorkspaceMode;
  addPending?: boolean;
  quoteDiscountAmount?: string;
  quoteDiscountPercent?: string;
  onQuoteDiscountAmount?: (value: string) => void;
  onQuoteDiscountPercent?: (value: string) => void;
  validUntil?: string;
  onValidUntil?: (value: string) => void;
}) {
  const isPricing = workspaceMode === "pricing";
  const rows = sortedQuoteItems(items);
  const [emptyCatalogOpen, setEmptyCatalogOpen] = useState(false);
  const sectionOrder = [...sections].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const grouped = groupBySection(rows, sectionOrder);
  const [sectionMenuId, setSectionMenuId] = useState<string | null>(null);
  const isEmpty = rows.length === 0 && sectionOrder.length === 0;

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

  const catalogResultsList =
    debouncedCatalogQ && catalogResults.length ? (
      <ul className="flex max-h-40 flex-col gap-1 overflow-auto text-sm">
        {catalogResults.map((product) => (
          <li key={product.id}>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-[var(--radius-control)] px-2 py-1.5 text-start hover:bg-bg-2"
              onClick={() =>
                onAdd({
                  product_id: product.id,
                  item_type: product.kind === "service" ? "labor" : "catalog",
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
              <span className="ltr-meta shrink-0 text-xs text-fg-muted">
                {formatMoney(product.selling_price ?? product.list_price, currency)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    ) : null;

  return (
    <section
      id="quote-items"
      tabIndex={-1}
      className={`cpq-content-panel cpq-content-kai flex flex-col gap-4 p-5${isPricing ? " is-pricing-mode" : " is-planning-mode"}`}
      data-testid={isPricing ? "stage3-commercial-workspace" : "stage2-solution-workspace"}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-fg">
            {isPricing ? he.cpqStage3PopulatedTitle : he.cpqStage2Title}
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            {isPricing ? he.cpqStage3Subtext : he.cpqStage2Subtext}
          </p>
          <p className="mt-1 text-xs text-fg-muted">
            {isPricing ? he.cpqStage3ItemsCount(rows.length) : he.quoteItemsCount(rows.length)}
          </p>
        </div>
        {canEdit && !isEmpty && !isPricing ? (
          <div className="cpq-scope-toolbar flex flex-wrap gap-2">
            <Button type="button" loading={addPending} onClick={() => onOpenQuickAdd?.()}>
              <Plus className="size-4" aria-hidden />
              {he.cpqAddToQuotePrimary}
            </Button>
            {onAddSection ? (
              <Button type="button" variant="ghost" onClick={onAddSection}>
                {he.cpqAddSection}
              </Button>
            ) : null}
          </div>
        ) : null}
        {canEdit && isPricing && onGoToPlanning ? (
          <Button type="button" variant="ghost" onClick={onGoToPlanning}>
            {he.cpqStage3EditInPlanning}
          </Button>
        ) : null}
      </div>

      {isEmpty ? (
        isPricing ? (
          <div className="cpq-empty cpq-empty-kai">
            <p className="cpq-empty-title">{he.cpqStage3EmptyTitle}</p>
            <p className="cpq-empty-body">{he.cpqStage3EmptyBody}</p>
            {onGoToPlanning ? (
              <div className="cpq-empty-actions-kai">
                <Button type="button" onClick={onGoToPlanning}>
                  {he.cpqStage3EmptyCta}
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="cpq-empty cpq-empty-kai">
            <p className="cpq-empty-title">{he.cpqEmptyTitle}</p>
            <p className="cpq-empty-body">{he.cpqEmptyBody}</p>
            {canEdit ? (
              <div className="cpq-empty-actions-kai">
                <Button type="button" onClick={() => onOpenQuickAdd?.()}>
                  <Plus className="size-4" aria-hidden />
                  {he.quoteAddItem}
                </Button>
                {onOpenSystemBuilder ? (
                  <Button type="button" variant="secondary" className="cpq-empty-build-cta" onClick={onOpenSystemBuilder}>
                    {he.cpqBuildSystem}
                  </Button>
                ) : onOpenAddSystem ? (
                  <Button type="button" variant="secondary" onClick={onOpenAddSystem}>
                    {he.cpqAddSystem}
                  </Button>
                ) : null}
                <button
                  type="button"
                  className="cpq-empty-catalog-link"
                  onClick={() => {
                    setEmptyCatalogOpen(true);
                    onFocusCatalog?.();
                    window.requestAnimationFrame(() => {
                      document.getElementById("catalog-search")?.focus();
                    });
                  }}
                >
                  {he.cpqEmptyBrowseCatalog}
                </button>
              </div>
            ) : null}
            {canCatalog && canEdit && (emptyCatalogOpen || Boolean(catalogQ)) ? (
              <div className="cpq-empty-catalog-panel">
                <Input
                  id="catalog-search"
                  label={he.quoteCatalogSearch}
                  value={catalogQ}
                  onChange={(e) => onCatalogQ(e.target.value)}
                  placeholder={he.quoteCatalogSearchHint}
                />
                {catalogLoading ? <p className="text-xs text-fg-muted">{he.loading}</p> : null}
                {catalogResultsList}
              </div>
            ) : null}
          </div>
        )
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
                      {canEdit && onRenameSection && !isPricing ? (
                        <QuoteSectionNameField
                          sectionId={group.section.id}
                          name={group.section.name}
                          canEdit={canEdit}
                          onPersist={onRenameSection}
                        />
                      ) : (
                        <h3 className="text-base font-semibold">{group.section.name || he.cpqSectionUntitled}</h3>
                      )}
                      <p className="mt-1 text-xs text-fg-muted">
                        {he.quoteItemsCount(group.items.length)}
                        {group.items.length ? ` · ${formatMoney(sectionNet, currency)}` : ""}
                        {Number(group.section.discount_value || 0) > 0 ? ` · ${he.cpqSectionDiscount}` : ""}
                      </p>
                      {isPricing && (onPatchSectionDiscount || Number(group.section.discount_value || 0) > 0) ? (
                        <div className="mt-2">
                          <QuoteSectionDiscountField
                            section={group.section}
                            canEdit={Boolean(canEdit && onPatchSectionDiscount)}
                            onPersist={(body) => onPatchSectionDiscount?.(group.section!.id, body)}
                          />
                        </div>
                      ) : null}
                    </div>
                    {canEdit && !isPricing ? (
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
                              {he.quoteAddFree}
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                onAdd({
                                  item_type: "note",
                                  description: "",
                                  qty: 1,
                                  unit_price: 0,
                                  section_id: group.section!.id,
                                });
                                setSectionMenuId(null);
                              }}
                            >
                              {he.quoteAddNote}
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
                  <div className={`flex flex-col gap-3${isPricing ? " cpq-pricing-lines" : ""}`}>
                    {group.items.map((item) => {
                      const globalIndex = rows.findIndex((r) => r.id === item.id);
                      if (isPricing) {
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
                      }
                      return (
                        <SolutionItemCard
                          key={item.id}
                          item={item}
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

      {isPricing && !isEmpty ? (
        <section className="cpq-stage3-commercial" aria-labelledby="cpq-stage3-commercial-title">
          <h3 id="cpq-stage3-commercial-title" className="text-sm font-semibold text-fg">
            {he.cpqStage3CommercialTitle}
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {onQuoteDiscountAmount ? (
              <Input
                id="stage3_discount_amount"
                label={he.quoteDiscountAmountIls}
                value={quoteDiscountAmount ?? ""}
                disabled={!canEdit}
                onChange={(ev) => onQuoteDiscountAmount(ev.target.value)}
              />
            ) : null}
            {onQuoteDiscountPercent ? (
              <Input
                id="stage3_discount_percent"
                label={he.quoteDiscountPercentLabel}
                value={quoteDiscountPercent ?? ""}
                disabled={!canEdit}
                onChange={(ev) => onQuoteDiscountPercent(ev.target.value)}
              />
            ) : null}
            {onValidUntil ? (
              <Input
                id="stage3_valid_until"
                label={he.quoteValidUntil}
                type="date"
                value={validUntil ?? ""}
                disabled={!canEdit}
                onChange={(ev) => onValidUntil(ev.target.value)}
              />
            ) : null}
          </div>
          <p className="mt-2 text-xs text-fg-muted">{he.quoteDiscountQuoteHint}</p>
        </section>
      ) : null}

      {canCatalog && canEdit && !isEmpty && !isPricing ? (
        <div className="cpq-catalog-inline flex flex-col gap-2 border-t border-border pt-4">
          <Input
            id="catalog-search"
            label={he.quoteCatalogSearch}
            value={catalogQ}
            onChange={(e) => onCatalogQ(e.target.value)}
            placeholder={he.quoteCatalogSearchHint}
          />
          {catalogLoading ? <p className="text-xs text-fg-muted">{he.loading}</p> : null}
          {catalogResultsList}
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
