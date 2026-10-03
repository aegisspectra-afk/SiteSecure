/**
 * SYSTEM-DESIGNER-1 Slice E — professional Review surface.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { ApiClient, SystemRecommendation } from "@site-secure/api-client";
import { Button } from "@site-secure/ui";
import { he } from "../../../i18n/he";
import { componentKeyOf } from "../../../lib/cctv-component-keys";
import {
  buildApplyReadinessPreview,
  commercialRoleLabelHe,
  compatibilityLabelHe,
  deriveReviewCardStatus,
  groupComponentsForReview,
  isUserConfirmedSelection,
  overallCompatibility,
  requirementTextForCard,
  reviewStatusLabelHe,
  technologyFromRecommendation,
  whyTextForCard,
} from "../../../lib/cctv-designer-review";
import { buildEngineeringSummary, formatReasonHe } from "../../../lib/cctv-recommend-copy";
import {
  resolveComponentProduct,
  type ReviewSelectionState,
} from "../../../lib/cctv-recommend-projection";
import { CctvComponentPicker } from "./CctvComponentPicker";

type Props = {
  rec: SystemRecommendation;
  selection: ReviewSelectionState;
  setSelection: (next: ReviewSelectionState) => void;
  needsReviewKeys?: Set<string>;
  onNeedsReviewKeysChange?: (next: Set<string>) => void;
  applyError?: string | null;
  /** Open picker for this component_key once (Step 2 resolve / reopen). */
  focusComponentKey?: string | null;
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

export function CctvReviewPanel({
  rec,
  selection,
  setSelection,
  needsReviewKeys = new Set(),
  onNeedsReviewKeysChange,
  applyError = null,
  focusComponentKey = null,
  workspaceId,
  api,
}: Props) {
  const [pickerKey, setPickerKey] = useState<string | null>(null);
  const tech = technologyFromRecommendation(rec);
  const summary = buildEngineeringSummary(rec);
  const visible = rec.components.filter((c) => !selection.removedComponentIds.has(componentKeyOf(c)));
  const sections = groupComponentsForReview(visible);
  const preview = buildApplyReadinessPreview(rec, selection);

  // One-shot focus from Step 2 planned resolve — open the matching picker.
  useEffect(() => {
    if (!focusComponentKey) return;
    setPickerKey(focusComponentKey);
  }, [focusComponentKey]);

  const readiness = (
    rec as {
      catalog_readiness?: {
        empty_catalog?: boolean;
        ready_for_core?: boolean;
      };
    }
  ).catalog_readiness;

  const warnings = useMemo(() => {
    return [...(rec.assumptions || []), ...(rec.warnings || [])]
      .filter((r, i, arr) => arr.findIndex((x) => x.code === r.code) === i)
      .filter((r) => {
        if (readiness?.empty_catalog && r.code === "CATALOG_EMPTY") return false;
        if (readiness && !readiness.ready_for_core && r.code === "CATALOG_CORE_INCOMPLETE") {
          return false;
        }
        return true;
      });
  }, [rec.assumptions, rec.warnings, readiness]);

  const pickerComponent = visible.find((c) => componentKeyOf(c) === pickerKey) ?? null;

  return (
    <div className="cpq-cctv-review" data-testid="cctv-designer-review" data-tech={tech}>
      <section className="cpq-cctv-review-section" aria-labelledby="cctv-review-summary">
        <h2 className="cpq-cctv-review-section-title" id="cctv-review-summary">
          סיכום
        </h2>
        <p className="cpq-cctv-review-lead">
          מערכת <Ltr>CCTV</Ltr> · {summary.cameraCount} מצלמות
          {summary.channelTier != null ? (
            <>
              {" "}
              · <Ltr>{summary.channelTier}CH</Ltr>
            </>
          ) : null}
          {summary.requiredTb != null ? (
            <>
              {" "}
              · <Ltr>≈{summary.requiredTb.toFixed(1)}TB</Ltr>
            </>
          ) : null}
        </p>

        <div
          className="cpq-cctv-review-preview"
          data-testid="cctv-apply-readiness-preview"
          role="status"
        >
          <span>
            <strong>{preview.required}</strong> רכיבי חובה
          </span>
          <span>
            <strong>{preview.selected}</strong> נבחרו
          </span>
          <span>
            <strong>{preview.needsEquipment}</strong> דורשים ציוד
          </span>
          <span>
            <strong>{preview.optional}</strong> אופציונליים
          </span>
        </div>

        {readiness?.empty_catalog ? (
          <div className="cpq-cctv-designer-catalog" role="status">
            <p className="cpq-cctv-designer-catalog-copy">{he.cpqCctvCatalogEmptyShort}</p>
            <div className="cpq-cctv-designer-catalog-actions">
              <Link to="/app/catalog" className="cpq-cctv-designer-catalog-primary">
                {he.cpqCctvCatalogComplete}
              </Link>
            </div>
          </div>
        ) : null}
      </section>

      {applyError ? (
        <p className="text-sm text-danger" role="alert">
          {applyError}
        </p>
      ) : null}

      {sections.map((section) => (
        <section
          key={section.id}
          className="cpq-cctv-review-section"
          aria-labelledby={`cctv-review-${section.id}`}
        >
          <h2 className="cpq-cctv-review-section-title" id={`cctv-review-${section.id}`}>
            {section.label}
          </h2>
          <div className="cpq-cctv-review-cards">
            {section.components.map((component) => {
              const key = componentKeyOf(component);
              const picked = resolveComponentProduct(component, selection);
              const userConfirmed = isUserConfirmedSelection(component, selection, picked);
              const status = deriveReviewCardStatus(component, picked, needsReviewKeys.has(key), {
                userConfirmed,
              });
              const reqText = requirementTextForCard(component, summary.channelTier);
              const whyText = whyTextForCard(component);
              const compat = overallCompatibility(
                picked?.compatibility ?? component.selected_compatibility,
              );

              return (
                <article
                  key={key}
                  className="cpq-cctv-review-card"
                  data-testid={`cctv-review-card-${key}`}
                  data-status={status}
                >
                  <div className="cpq-cctv-review-card-top">
                    <div>
                      <p className="cpq-cctv-review-card-title">
                        {commercialRoleLabelHe(key, tech)}
                        {component.quantity > 1 ? ` ×${component.quantity}` : ""}
                      </p>
                    </div>
                    <span className={`cpq-cctv-review-chip is-${status}`}>
                      {reviewStatusLabelHe(status)}
                    </span>
                  </div>

                  {reqText ? (
                    <div className="cpq-cctv-review-block">
                      <p className="cpq-cctv-review-label">דרישה</p>
                      <p className="cpq-cctv-review-value">{reqText}</p>
                    </div>
                  ) : null}

                  {whyText && whyText !== reqText ? (
                    <div className="cpq-cctv-review-block">
                      <p className="cpq-cctv-review-label">למה</p>
                      <p className="cpq-cctv-review-value">{whyText}</p>
                    </div>
                  ) : null}

                  <div className="cpq-cctv-review-block">
                    <p className="cpq-cctv-review-label">מוצר</p>
                    {picked ? (
                      <div>
                        <p className="cpq-cctv-review-product">{picked.product.name}</p>
                        <p className="cpq-cctv-review-meta" dir="ltr">
                          {[picked.product.manufacturer, picked.product.model, picked.product.sku]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {compat !== "NONE" ? (
                          <p className={`cpq-cctv-review-compat is-${compat.toLowerCase()}`}>
                            {compatibilityLabelHe(compat)}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="cpq-cctv-review-value is-muted">טרם נבחר</p>
                    )}
                  </div>

                  <div className="cpq-cctv-review-actions">
                    <Button
                      type="button"
                      variant={picked ? "secondary" : "primary"}
                      onClick={() => setPickerKey(key)}
                    >
                      {picked ? he.cpqCctvReplace : "בחר מוצר"}
                    </Button>
                    {component.optional ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          const removed = new Set(selection.removedComponentIds);
                          removed.add(key);
                          setSelection({ ...selection, removedComponentIds: removed });
                        }}
                      >
                        {he.cpqCctvRemoveOptional}
                      </Button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {warnings.length ? (
        <section className="cpq-cctv-review-section" aria-labelledby="cctv-review-warnings">
          <h2 className="cpq-cctv-review-section-title" id="cctv-review-warnings">
            אזהרות
          </h2>
          <ul className="cpq-cctv-review-warnings">
            {warnings.slice(0, 12).map((a) => (
              <li key={a.code}>{formatReasonHe(a)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {pickerComponent ? (
        <CctvComponentPicker
          open
          onClose={() => setPickerKey(null)}
          component={pickerComponent}
          technology={tech}
          selectedProductId={selection.selectedByComponentId[componentKeyOf(pickerComponent)] ?? null}
          workspaceId={workspaceId}
          api={api}
          onSelect={(candidate) => {
            const key = componentKeyOf(pickerComponent);
            const productId = candidate.product.id;
            if (!productId) return;
            setSelection({
              ...selection,
              selectedByComponentId: {
                ...selection.selectedByComponentId,
                [key]: productId,
              },
              candidateOverrides: {
                ...(selection.candidateOverrides ?? {}),
                [key]: candidate,
              },
            });
            if (onNeedsReviewKeysChange && needsReviewKeys.has(key)) {
              const next = new Set(needsReviewKeys);
              next.delete(key);
              onNeedsReviewKeysChange(next);
            }
          }}
        />
      ) : null}
    </div>
  );
}
