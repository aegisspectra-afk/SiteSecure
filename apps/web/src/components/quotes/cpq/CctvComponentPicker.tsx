/**
 * SYSTEM-DESIGNER-1 Slice E — focused catalog picker for a component_key.
 * Uses recommendation candidates first; optional catalog search by category family.
 * Never requests products.cost (Q4-S).
 */

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { ApiClient, CctvRecommendationCandidate, CctvRecommendationComponent } from "@site-secure/api-client";
import { Button, Input } from "@site-secure/ui";
import { he } from "../../../i18n/he";
import { componentKeyOf } from "../../../lib/cctv-component-keys";
import {
  candidateSpecLines,
  categoryKeysForComponent,
  compatibilityLabelHe,
  filterPickerCandidates,
  overallCompatibility,
  type CompatUi,
} from "../../../lib/cctv-designer-review";

type Props = {
  open: boolean;
  onClose: () => void;
  component: CctvRecommendationComponent;
  technology: "ip" | "analog_hd" | "hybrid";
  selectedProductId?: string | null;
  onSelect: (productId: string) => void;
  workspaceId: string;
  api: ApiClient;
};

function Ltr({ children }: { children: ReactNode }) {
  return (
    <span className="ltr-meta" dir="ltr">
      {children}
    </span>
  );
}

function CompatBadge({ state }: { state: CompatUi }) {
  if (state === "NONE") return null;
  return (
    <span className={`cpq-cctv-picker-compat is-${state.toLowerCase()}`}>
      {compatibilityLabelHe(state)}
    </span>
  );
}

export function CctvComponentPicker({
  open,
  onClose,
  component,
  technology,
  selectedProductId,
  onSelect,
  workspaceId,
  api,
}: Props) {
  const titleId = useId();
  const searchId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState("");
  const [extra, setExtra] = useState<CctvRecommendationCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const cacheKeyRef = useRef<string>("");
  const componentKey = componentKeyOf(component);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setLoadError(null);
    const t = window.setTimeout(() => closeRef.current?.focus(), 0);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const cacheKey = `${componentKey}:${technology}`;
    if (cacheKeyRef.current === cacheKey && extra.length) return;
    const allowed = new Set(categoryKeysForComponent(componentKey, technology));
    if (!allowed.size) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        // listCatalogProducts uses server PRODUCT_SELECT — no products.cost (Q4-S).
        const res = await api.listCatalogProducts(workspaceId, { q: "", limit: 80 });
        if (cancelled) return;
        const existingIds = new Set(component.candidates.map((c) => c.product.id));
        const mapped: CctvRecommendationCandidate[] = (res.items ?? [])
          .filter((p) => p.category_key && allowed.has(p.category_key) && !existingIds.has(p.id))
          .map((p) => ({
            product: {
              id: p.id,
              sku: p.sku,
              name: p.name,
              manufacturer: p.manufacturer,
              model: p.model,
              category_key: p.category_key,
              unit: p.unit,
              list_price: p.list_price,
              attributes: p.attributes ?? {},
            },
            confidence: "PARTIAL" as const,
            compatibility: {},
            reason_codes: [{ code: "CATALOG_BROWSE_UNVERIFIED", params: {} }],
          }));
        setExtra(mapped);
        cacheKeyRef.current = cacheKey;
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : he.quotesError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally omit extra.length — cacheKeyRef gates refetch for same component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, componentKey, technology, workspaceId, api, component.candidates]);

  const merged = useMemo(() => {
    const byId = new Map<string, CctvRecommendationCandidate>();
    for (const c of component.candidates) byId.set(c.product.id, c);
    for (const c of extra) {
      if (!byId.has(c.product.id)) byId.set(c.product.id, c);
    }
    return [...byId.values()];
  }, [component.candidates, extra]);

  const visible = useMemo(
    () => filterPickerCandidates(merged, { query, includeFail: true }),
    [merged, query],
  );
  const selectable = visible.filter((c) => overallCompatibility(c.compatibility) !== "FAIL");
  const failed = visible.filter((c) => overallCompatibility(c.compatibility) === "FAIL");

  if (!open) return null;

  return (
    <div className="cpq-cctv-picker-root" role="presentation">
      <button type="button" className="cpq-cctv-picker-backdrop" aria-label={he.cancel} onClick={onClose} />
      <div
        className="cpq-cctv-picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="cctv-component-picker"
        data-component-key={componentKey}
      >
        <header className="cpq-cctv-picker-head">
          <div>
            <p className="cpq-cctv-picker-kicker">
              <Ltr>{componentKey}</Ltr>
            </p>
            <h2 className="cpq-cctv-picker-title" id={titleId}>
              בחירת מוצר
            </h2>
          </div>
          <Button ref={closeRef} type="button" variant="secondary" onClick={onClose}>
            {he.cancel}
          </Button>
        </header>

        <div className="cpq-cctv-picker-search">
          <Input
            id={searchId}
            label="חיפוש שם / מק״ט / יצרן"
            value={query}
            onChange={(ev) => setQuery(ev.target.value)}
            autoComplete="off"
          />
        </div>

        {loading ? (
          <p className="cpq-cctv-picker-hint" role="status">
            טוען מועמדים…
          </p>
        ) : null}
        {loadError ? (
          <p className="cpq-cctv-picker-error" role="alert">
            {loadError}
          </p>
        ) : null}

        {selectable.length === 0 && failed.length === 0 ? (
          <div className="cpq-cctv-picker-empty" data-testid="cctv-picker-empty">
            <p>לא נמצאו מוצרים מתאימים בקטלוג.</p>
            <div className="cpq-cctv-picker-empty-actions">
              <Link to="/app/catalog" className="cpq-cctv-designer-catalog-primary">
                הוסף מוצר לקטלוג
              </Link>
              <Button type="button" variant="secondary" onClick={onClose}>
                השאר כ״נדרש ציוד״
              </Button>
              <Button type="button" variant="ghost" onClick={onClose}>
                חזור
              </Button>
            </div>
          </div>
        ) : (
          <ul className="cpq-cctv-picker-list">
            {selectable.map((cand) => {
              const compat = overallCompatibility(cand.compatibility);
              const specs = candidateSpecLines(componentKey, cand);
              const selected = selectedProductId === cand.product.id;
              return (
                <li key={cand.product.id}>
                  <button
                    type="button"
                    className={
                      selected ? "cpq-cctv-picker-item is-selected" : "cpq-cctv-picker-item"
                    }
                    aria-pressed={selected}
                    onClick={() => {
                      onSelect(cand.product.id);
                      onClose();
                    }}
                  >
                    <div className="cpq-cctv-picker-item-top">
                      <p className="cpq-cctv-picker-name">{cand.product.name}</p>
                      <CompatBadge state={compat === "NONE" ? "UNKNOWN" : compat} />
                    </div>
                    <p className="cpq-cctv-picker-meta" dir="ltr">
                      {[cand.product.sku, cand.product.manufacturer, cand.product.model]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {specs.length ? (
                      <p className="cpq-cctv-picker-specs" dir="ltr">
                        {specs.join(" · ")}
                      </p>
                    ) : null}
                    {typeof cand.product.list_price === "number" ? (
                      <p className="cpq-cctv-picker-price" dir="ltr">
                        ₪{Number(cand.product.list_price).toFixed(2)}
                      </p>
                    ) : null}
                    {compat === "UNKNOWN" || Object.keys(cand.compatibility ?? {}).length === 0 ? (
                      <p className="cpq-cctv-picker-warn">לא ניתן לאמת תאימות אוטומטית.</p>
                    ) : null}
                    {/* Q4-S: never render cost */}
                  </button>
                </li>
              );
            })}
            {failed.map((cand) => (
              <li key={cand.product.id}>
                <div className="cpq-cctv-picker-item is-fail" aria-disabled="true">
                  <div className="cpq-cctv-picker-item-top">
                    <p className="cpq-cctv-picker-name">{cand.product.name}</p>
                    <CompatBadge state="FAIL" />
                  </div>
                  <p className="cpq-cctv-picker-warn">לא מתאים לדרישות — לא ניתן לבחור.</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
