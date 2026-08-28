import type { QuoteItemOut } from "@site-secure/api-client";
import { Button, Input } from "@site-secure/ui";
import { ArrowDown, ArrowUp } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { he } from "../../../i18n/he";
import { catalogListPrice, isPriceOverride } from "../../../lib/quote-cpq";
import {
  lineDraftFromItem,
  lineDraftToPatchForFields,
  mergeDraftFromItem,
  patchFieldsFromPatch,
  previewLineNet,
  QUOTE_LINE_FIELDS,
  type QuoteLineDraft,
  type QuoteLineField,
  type QuoteLinePatch,
} from "../../../lib/quote-line-edit";
import { formatMoney } from "../../../lib/quotes";

const PERSIST_DEBOUNCE_MS = 450;

export const QuoteLineRow = memo(function QuoteLineRow({
  item,
  currency,
  canEdit,
  globalIndex,
  rowCount,
  onPersist,
  onDelete,
  onReorder,
}: {
  item: QuoteItemOut;
  currency: string;
  canEdit: boolean;
  globalIndex: number;
  rowCount: number;
  onPersist: (itemId: string, body: QuoteLinePatch) => Promise<void>;
  onDelete: (itemId: string) => void;
  onReorder: (itemId: string, direction: "up" | "down") => void;
}) {
  const [draft, setDraft] = useState<QuoteLineDraft>(() => lineDraftFromItem(item));
  const [savedFlash, setSavedFlash] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const focused = useRef(new Set<QuoteLineField>());
  const dirty = useRef(new Set<QuoteLineField>());
  const draftRef = useRef(draft);
  const itemRef = useRef(item);
  const persistTimer = useRef<number | null>(null);
  const persistInFlight = useRef(false);
  const persistQueued = useRef(false);
  const persistGen = useRef(0);
  const mountedItemId = useRef(item.id);

  draftRef.current = draft;
  itemRef.current = item;

  useEffect(() => {
    if (item.id !== mountedItemId.current) {
      mountedItemId.current = item.id;
      dirty.current.clear();
      focused.current.clear();
      setDraft(lineDraftFromItem(item));
      return;
    }
    const protectedFields = new Set<QuoteLineField>([...dirty.current, ...focused.current]);
    setDraft((prev) => mergeDraftFromItem(prev, item, protectedFields));
  }, [
    item.id,
    item.description,
    item.sku,
    item.qty,
    item.unit_price,
    item.discount,
    item.discount_type,
  ]);

  const resolvePersistFields = useCallback((blurredField?: QuoteLineField): QuoteLineField[] => {
    return QUOTE_LINE_FIELDS.filter((field) => {
      if (!dirty.current.has(field)) return false;
      if (field === blurredField) return true;
      return !focused.current.has(field);
    });
  }, []);

  const flushPersist = useCallback(
    async (blurredField?: QuoteLineField) => {
      if (persistTimer.current != null) {
        window.clearTimeout(persistTimer.current);
        persistTimer.current = null;
      }

      const fieldsToSave = resolvePersistFields(blurredField);
      if (!fieldsToSave.length) return;

      const patch = lineDraftToPatchForFields(
        draftRef.current,
        itemRef.current,
        new Set(fieldsToSave),
      );
      if (!patch) {
        for (const field of fieldsToSave) dirty.current.delete(field);
        return;
      }

      if (persistInFlight.current) {
        persistQueued.current = true;
        return;
      }

      const gen = ++persistGen.current;
      const draftSnapshot = { ...draftRef.current };
      const savedFields = patchFieldsFromPatch(patch);

      persistInFlight.current = true;
      setPersistError(null);
      try {
        await onPersist(itemRef.current.id, patch);
        if (gen !== persistGen.current) return;
        for (const field of savedFields) {
          if (draftRef.current[field] === draftSnapshot[field]) {
            dirty.current.delete(field);
          }
        }
        setSavedFlash(true);
        window.setTimeout(() => setSavedFlash(false), 1200);
      } catch (err) {
        if (gen === persistGen.current) {
          setPersistError(err instanceof Error ? err.message : he.quotesError);
        }
      } finally {
        persistInFlight.current = false;
        if (persistQueued.current) {
          persistQueued.current = false;
          void flushPersist();
        }
      }
    },
    [onPersist, resolvePersistFields],
  );

  const schedulePersist = useCallback(() => {
    if (persistTimer.current != null) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      persistTimer.current = null;
      void flushPersist();
    }, PERSIST_DEBOUNCE_MS);
  }, [flushPersist]);

  useEffect(() => {
    return () => {
      if (persistTimer.current != null) window.clearTimeout(persistTimer.current);
    };
  }, []);

  function updateField(field: QuoteLineField, value: string) {
    dirty.current.add(field);
    setDraft((prev) => ({ ...prev, [field]: value }));
    schedulePersist();
  }

  function handleFocus(field: QuoteLineField) {
    focused.current.add(field);
  }

  function handleBlur(field: QuoteLineField) {
    focused.current.delete(field);
    void flushPersist(field);
  }

  const override = isPriceOverride(item);
  const listPrice = catalogListPrice(item);
  const lineTotal = previewLineNet(item, draft);

  return (
    <div
      className="cpq-line-row grid gap-2 rounded-[var(--radius-control)] border border-border p-3 sm:grid-cols-[6.5rem_minmax(0,1fr)_5rem_7rem_5.5rem_auto]"
    >
      <Input
        id={`item-sku-${item.id}`}
        label={he.quoteProductSku}
        className="ltr-meta font-mono text-xs"
        value={draft.sku}
        disabled={!canEdit}
        onFocus={() => handleFocus("sku")}
        onBlur={() => handleBlur("sku")}
        onChange={(e) => updateField("sku", e.target.value)}
      />
      <div className="flex min-w-0 flex-col gap-1">
        <Input
          id={`item-desc-${item.id}`}
          label={he.quoteItemDescription}
          value={draft.description}
          disabled={!canEdit}
          onFocus={() => handleFocus("description")}
          onBlur={() => handleBlur("description")}
          onChange={(e) => updateField("description", e.target.value)}
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
        type="text"
        inputMode="decimal"
        className="ltr-meta"
        value={draft.qty}
        disabled={!canEdit}
        onFocus={() => handleFocus("qty")}
        onBlur={() => handleBlur("qty")}
        onChange={(e) => updateField("qty", e.target.value)}
      />
      <Input
        id={`item-price-${item.id}`}
        label={he.quoteUnitPrice}
        type="text"
        inputMode="decimal"
        className="ltr-meta"
        value={draft.unit_price}
        disabled={!canEdit}
        onFocus={() => handleFocus("unit_price")}
        onBlur={() => handleBlur("unit_price")}
        onChange={(e) => updateField("unit_price", e.target.value)}
      />
      <Input
        id={`item-discount-${item.id}`}
        label={he.quoteDiscountPercentLabel}
        type="text"
        inputMode="decimal"
        className="ltr-meta"
        value={draft.discount}
        disabled={!canEdit}
        onFocus={() => handleFocus("discount")}
        onBlur={() => handleBlur("discount")}
        onChange={(e) => updateField("discount", e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-sm font-medium">{formatMoney(lineTotal, currency)}</span>
        {savedFlash ? <span className="cpq-line-saved">{he.cpqLineSaved}</span> : null}
        {persistError ? (
          <span className="text-xs text-danger" role="alert">
            {persistError}
          </span>
        ) : null}
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
              disabled={globalIndex >= rowCount - 1}
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
});
