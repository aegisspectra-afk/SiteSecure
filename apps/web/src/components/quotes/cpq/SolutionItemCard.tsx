import type { QuoteItemOut } from "@site-secure/api-client";
import { Button, Input } from "@site-secure/ui";
import { ArrowDown, ArrowUp } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { he } from "../../../i18n/he";
import {
  isIncompleteNumericDraft,
  lineDraftFromItem,
  lineDraftToPatchForFields,
  mergeDraftFromItem,
  patchFieldsFromPatch,
  type QuoteLineDraft,
  type QuoteLineField,
  type QuoteLinePatch,
} from "../../../lib/quote-line-edit";

const PERSIST_DEBOUNCE_MS = 450;
const SOLUTION_FIELDS: QuoteLineField[] = ["description", "sku", "qty"];

export function isSolutionServiceItem(item: QuoteItemOut): boolean {
  return item.item_type === "labor";
}

export function isSolutionNoteItem(item: QuoteItemOut): boolean {
  return item.item_type === "note";
}

export function isSolutionEquipmentItem(item: QuoteItemOut): boolean {
  return !isSolutionServiceItem(item) && !isSolutionNoteItem(item);
}

/**
 * Stage 2 solution composition card — description + qty (+ SKU metadata).
 * No unit price / discount / line total. Shares QuoteLinePatch mutations with pricing rows.
 */
export const SolutionItemCard = memo(function SolutionItemCard({
  item,
  canEdit,
  globalIndex,
  rowCount,
  onPersist,
  onDelete,
  onReorder,
}: {
  item: QuoteItemOut;
  canEdit: boolean;
  globalIndex: number;
  rowCount: number;
  onPersist: (itemId: string, body: QuoteLinePatch) => Promise<void>;
  onDelete: (itemId: string) => void;
  onReorder: (itemId: string, direction: "up" | "down") => void;
}) {
  const [draft, setDraft] = useState<QuoteLineDraft>(() => lineDraftFromItem(item));
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
  const flushRef = useRef<(blurredField?: QuoteLineField) => Promise<void>>(async () => undefined);

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
  }, [item.id, item.description, item.sku, item.qty]);

  const resolvePersistFields = useCallback((blurredField?: QuoteLineField): QuoteLineField[] => {
    return SOLUTION_FIELDS.filter((field) => {
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
        for (const field of fieldsToSave) {
          if (isIncompleteNumericDraft(field, draftRef.current[field])) continue;
          dirty.current.delete(field);
        }
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

  flushRef.current = flushPersist;

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
      void flushRef.current();
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

  function handleNumericKeyDown(event: KeyboardEvent<HTMLInputElement>, field: QuoteLineField) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    event.currentTarget.blur();
    void flushPersist(field);
  }

  const isNote = isSolutionNoteItem(item);
  const isLabor = isSolutionServiceItem(item);
  const fromCatalog = Boolean(item.product_id);
  const title = (draft.description || item.name || "").trim() || he.cpqSolutionUntitledItem;

  if (isNote) {
    return (
      <article className="cpq-solution-card cpq-solution-card-note" data-testid="solution-item-card" data-item-kind="note">
        <Input
          id={`sol-note-${item.id}`}
          label={he.quoteAddNote}
          value={draft.description}
          disabled={!canEdit}
          onFocus={() => handleFocus("description")}
          onBlur={() => handleBlur("description")}
          onChange={(e) => updateField("description", e.target.value)}
        />
        {persistError ? (
          <span className="text-xs text-danger" role="alert">
            {persistError}
          </span>
        ) : null}
        {canEdit ? (
          <div className="cpq-solution-card-actions">
            <ReorderDelete
              itemId={item.id}
              globalIndex={globalIndex}
              rowCount={rowCount}
              onReorder={onReorder}
              onDelete={onDelete}
            />
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <article
      className={`cpq-solution-card${isLabor ? " is-service" : " is-equipment"}`}
      data-testid="solution-item-card"
      data-item-kind={isLabor ? "service" : "equipment"}
    >
      <div className="cpq-solution-card-main">
        <div className="cpq-solution-card-copy">
          {canEdit ? (
            <Input
              id={`sol-desc-${item.id}`}
              label={isLabor ? he.cpqSolutionServiceLabel : he.cpqSolutionEquipmentLabel}
              value={draft.description}
              onFocus={() => handleFocus("description")}
              onBlur={() => handleBlur("description")}
              onChange={(e) => updateField("description", e.target.value)}
            />
          ) : (
            <h4 className="cpq-solution-card-title">{title}</h4>
          )}
          <div className="cpq-solution-card-meta">
            {isLabor ? (
              <span className="cpq-solution-chip">{he.quoteLaborBadge}</span>
            ) : fromCatalog ? (
              <span className="cpq-solution-chip">{he.cpqSolutionFromCatalog}</span>
            ) : (
              <span className="cpq-solution-chip">{he.cpqSolutionManualItem}</span>
            )}
            {item.package_name ? (
              <span className="cpq-solution-chip">
                {he.cpqPackageBadge}: {item.package_name}
              </span>
            ) : null}
            {!isLabor && draft.sku.trim() ? (
              <span className="cpq-solution-sku ltr-meta" dir="ltr">
                {he.quoteProductSku}: {draft.sku.trim()}
              </span>
            ) : null}
          </div>
        </div>

        <div className="cpq-solution-card-qty">
          <Input
            id={`sol-qty-${item.id}`}
            label={he.quoteQty}
            type="text"
            inputMode="decimal"
            className="ltr-meta"
            value={draft.qty}
            disabled={!canEdit}
            onFocus={() => handleFocus("qty")}
            onBlur={() => handleBlur("qty")}
            onKeyDown={(e) => handleNumericKeyDown(e, "qty")}
            onChange={(e) => updateField("qty", e.target.value)}
          />
        </div>
      </div>

      {persistError ? (
        <span className="text-xs text-danger" role="alert">
          {persistError}
        </span>
      ) : null}

      {canEdit ? (
        <div className="cpq-solution-card-actions">
          <ReorderDelete
            itemId={item.id}
            globalIndex={globalIndex}
            rowCount={rowCount}
            onReorder={onReorder}
            onDelete={onDelete}
          />
        </div>
      ) : null}
    </article>
  );
});

function ReorderDelete({
  itemId,
  globalIndex,
  rowCount,
  onReorder,
  onDelete,
}: {
  itemId: string;
  globalIndex: number;
  rowCount: number;
  onReorder: (itemId: string, direction: "up" | "down") => void;
  onDelete: (itemId: string) => void;
}) {
  const deleteLock = useRef(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        aria-label={he.cpqMoveUp}
        disabled={globalIndex <= 0}
        onClick={() => onReorder(itemId, "up")}
      >
        <ArrowUp className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        aria-label={he.cpqMoveDown}
        disabled={globalIndex >= rowCount - 1}
        onClick={() => onReorder(itemId, "down")}
      >
        <ArrowDown className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        onPointerDown={(ev) => {
          if (ev.button !== 0) return;
          ev.preventDefault();
          if (deleteLock.current) return;
          deleteLock.current = true;
          onDelete(itemId);
          window.setTimeout(() => {
            deleteLock.current = false;
          }, 400);
        }}
      >
        {he.quoteDeleteItem}
      </Button>
    </>
  );
}
