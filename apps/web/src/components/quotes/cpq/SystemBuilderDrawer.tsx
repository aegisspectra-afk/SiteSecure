/**
 * Task 13D — Build System V1 product integration.
 * R2: durable CCTV Design persistence + hydration (no Apply/REPLACE).
 *
 * Flow: requirements → POST /cctv/recommend → review → quote projection.
 * CCTV sizing is server-authoritative. Do not call legacy keyword matching here.
 */

import { apiErrorMessage } from "../../../lib/api-validation-message";
import { formatMoney } from "../../../lib/quotes";
import {
  ApiClientError,
  type ApiClient,
  type LeadOut,
  type QuoteOut,
  type SystemDesign,
  type SystemDesignApplyDiverged,
  type SystemRecommendation,
} from "@site-secure/api-client";
import { Button } from "@site-secure/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { QuoteFlowSheet } from "../quote-creation/QuoteFlowSheet";
import { he } from "../../../i18n/he";
import {
  defaultCctvBuildRequirements,
  requirementsToRecommendBody,
  validateCctvBuildRequirements,
  type CctvBuildRequirements,
} from "../../../lib/cctv-build-requirements";
import { requirementsCalcFingerprint } from "../../../lib/cctv-designer-workspace";
import {
  designerStatus,
  deriveDesignerReadiness,
  type PersistTrustState,
} from "../../../lib/cctv-designer-summary";
import {
  CctvRequirementsHeader,
  CctvRequirementsWorkspace,
} from "./CctvRequirementsWorkspace";
import { CctvEngineeringSummaryPanel } from "./CctvEngineeringSummaryPanel";
import { CctvReviewPanel } from "./CctvReviewPanel";
import {
  componentsFromRecommendation,
  designHasRecommendation,
  mergeSelectionAfterRecalculate,
  pickActiveCctvDesign,
  recommendationFromDesign,
  recommendationMetaFromRec,
  requirementsFromDesign,
  requirementsToDesignDoc,
  selectionFromDesign,
} from "../../../lib/cctv-design-persistence";
import { commercialLabelHe } from "../../../lib/cctv-component-keys";
import {
  canAddRecommendationToQuote,
  emptyReviewSelection,
  type CctvBuildQuoteLine,
  type CctvPlannedQuoteLine,
  type PartialApplyRecovery,
  type ReviewSelectionState,
} from "../../../lib/cctv-recommend-projection";
import { domainLabel, visibleDomains } from "../../../lib/domain-registry";
import { normalizeLaborRate } from "../../../lib/cctv-labor";

type Step = "requirements" | "loading" | "review";

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  /** Live quote id when known; persistence waits until a Quote exists. */
  quoteId?: string | null;
  /** Ensure a Quote row exists before first Design persist (createOnce). */
  ensureQuoteId?: () => Promise<string>;
  api: ApiClient;
  lead?: LeadOut | null;
  /** Real quote customer name — header/summary chips only. */
  customerName?: string | null;
  /** Real quote site name — header/summary chips only. */
  siteName?: string | null;
  /** Open review picker for this component_key after hydrate (Step 2 resolve). */
  focusComponentKey?: string | null;
  applying?: boolean;
  applyError?: string | null;
  recovery?: PartialApplyRecovery | null;
  /** Legacy sequential addQuoteItem — only when no durable Design exists. */
  onApply: (
    lines: CctvBuildQuoteLine[],
    opts?: { resume?: PartialApplyRecovery; planned?: CctvPlannedQuoteLine[] },
  ) => void | Promise<void>;
  /** After successful atomic Design Apply — authoritative Quote (do not close drawer). */
  onAppliedQuote?: (quote: QuoteOut) => void | Promise<void>;
  /** Add/replace planned free lines (unresolved required) onto the live quote. */
  onApplyPlanned?: (planned: CctvPlannedQuoteLine[], quote?: QuoteOut | null) => Promise<QuoteOut | void>;
  onClearRecovery?: () => void;
};

function leadDefaults(lead?: LeadOut | null): CctvBuildRequirements {
  return defaultCctvBuildRequirements({
    cameraCount: lead?.requirements?.camera_count,
    recording: lead?.requirements?.recording,
    remoteViewing: lead?.requirements?.remote_viewing,
    infrastructure: lead?.requirements?.infrastructure,
    location: lead?.requirements?.location,
  });
}

/** Q2: automatic calculation runs this long after the last requirements change. */
export const AUTO_CALC_DEBOUNCE_MS = 600;

export function SystemBuilderDrawer({
  open,
  onClose,
  workspaceId,
  quoteId = null,
  ensureQuoteId,
  api,
  lead,
  customerName = null,
  siteName = null,
  focusComponentKey = null,
  applying = false,
  applyError = null,
  recovery = null,
  onApply,
  onAppliedQuote,
  onApplyPlanned,
  onClearRecovery,
}: Props) {
  const [systemType, setSystemType] = useState<string>("cctv");
  const [step, setStep] = useState<Step>("requirements");
  const [req, setReq] = useState<CctvBuildRequirements>(() => leadDefaults(lead));
  const [inputError, setInputError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  const [needsReviewHint, setNeedsReviewHint] = useState(false);
  const [recommendation, setRecommendation] = useState<SystemRecommendation | null>(null);
  const [selection, setSelection] = useState<ReviewSelectionState>(emptyReviewSelection());
  const [needsReviewKeys, setNeedsReviewKeys] = useState<Set<string>>(() => new Set());
  const [appliedOnce, setAppliedOnce] = useState(false);
  const [applySucceeded, setApplySucceeded] = useState(false);
  /** DEMO-2.5: the quote total as the server priced it after the add (no client math). */
  const [appliedTotal, setAppliedTotal] = useState<number | null>(null);
  const [lastLines, setLastLines] = useState<CctvBuildQuoteLine[] | null>(null);
  const [localApplying, setLocalApplying] = useState(false);
  const [localApplyError, setLocalApplyError] = useState<string | null>(null);
  const [divergence, setDivergence] = useState<SystemDesignApplyDiverged | null>(null);
  const [lastCalcFingerprint, setLastCalcFingerprint] = useState<string | null>(null);
  const [persistState, setPersistState] = useState<PersistTrustState>("idle");
  /** Q2.6: workspace hourly labor rate (null = not set; service lines go in unpriced). */
  const [laborRate, setLaborRate] = useState<number | null>(null);
  const [laborRateEditable, setLaborRateEditable] = useState(false);
  const [laborRateDraft, setLaborRateDraft] = useState("");
  const [laborRateError, setLaborRateError] = useState<string | null>(null);
  const [laborRateSaving, setLaborRateSaving] = useState(false);
  /** Q2: background (auto) calculation in flight; the requirements screen stays put. */
  const [calculating, setCalculating] = useState(false);
  const calcRunRef = useRef(0);
  const savedReqFingerprintRef = useRef<string | null>(null);

  const designRef = useRef<SystemDesign | null>(null);
  const revisionRef = useRef(1);
  const hydratingRef = useRef(false);
  const selectionPersistTimer = useRef<number | null>(null);
  const openGen = useRef(0);
  /** Quote this drawer created itself (first save on a new quote) while it stayed open. */
  const selfCreatedQuoteRef = useRef<string | null>(null);
  const creatingQuoteRef = useRef(false);
  const wasOpenRef = useRef(false);

  const currentFingerprint = useMemo(() => requirementsCalcFingerprint(req), [req]);
  const requirementsStale = Boolean(
    lastCalcFingerprint && lastCalcFingerprint !== currentFingerprint,
  );
  const calcState: "draft" | "fresh" | "stale" = !lastCalcFingerprint
    ? "draft"
    : requirementsStale
      ? "stale"
      : "fresh";

  const requirementsValid = validateCctvBuildRequirements(req).ok;
  const status = designerStatus({
    valid: requirementsValid,
    calculating,
    calcError: Boolean(serverError),
    calcState,
    persistState,
  });

  const designerReadiness = useMemo(
    () =>
      deriveDesignerReadiness({
        req,
        calcState,
        recommendation,
        selection,
        appliedOnce,
      }),
    [req, calcState, recommendation, selection, appliedOnce],
  );

  function updateRequirements(next: CctvBuildRequirements) {
    setReq(next);
    if (applySucceeded || appliedOnce) {
      setApplySucceeded(false);
      setAppliedOnce(false);
    }
    const fp = requirementsCalcFingerprint(next);
    if (savedReqFingerprintRef.current != null && fp !== savedReqFingerprintRef.current) {
      setPersistState((prev) => (prev === "error" ? prev : "dirty"));
    }
  }

  const addGate = useMemo(() => {
    if (!recommendation) return { ok: false as const, reason: "empty" as const };
    return canAddRecommendationToQuote(recommendation, selection, { laborRate });
  }, [recommendation, selection, laborRate]);

  useEffect(() => {
    if (!open || typeof api.getLaborRate !== "function") return;
    let cancelled = false;
    api
      .getLaborRate(workspaceId)
      .then((out) => {
        if (cancelled) return;
        setLaborRate(normalizeLaborRate(out.labor_hourly_rate));
        setLaborRateEditable(Boolean(out.can_edit));
      })
      .catch(() => {
        if (!cancelled) setLaborRate(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, api, workspaceId]);

  async function saveLaborRate() {
    const value = normalizeLaborRate(laborRateDraft);
    if (value == null) {
      setLaborRateError(he.laborRateInvalid);
      return;
    }
    setLaborRateSaving(true);
    setLaborRateError(null);
    try {
      const out = await api.putLaborRate(workspaceId, value);
      setLaborRate(normalizeLaborRate(out.labor_hourly_rate));
    } catch (err) {
      setLaborRateError(apiErrorMessage(err, he.laborRateInvalid));
    } finally {
      setLaborRateSaving(false);
    }
  }

  const laborPanel =
    systemType === "cctv" && step === "review" && recommendation ? (
      <section className="cpq-cctv-labor" data-testid="cctv-labor-rate" aria-label={he.laborRateSection}>
        <p className="text-sm text-fg-muted">{he.laborRateLead}</p>
        {laborRate != null ? (
          <p className="text-sm font-medium text-fg" data-testid="cctv-labor-rate-current">
            {he.laborRateCurrent(laborRate)}
          </p>
        ) : (
          <>
            <p className="text-sm font-medium text-warning" role="status" data-testid="cctv-labor-rate-missing">
              {he.laborRateMissing}
            </p>
            {laborRateEditable ? (
              <div className="flex flex-wrap items-end gap-2">
                <label className="grid gap-1 text-sm" htmlFor="cctv-labor-rate-input">
                  <span>{he.laborRateLabel}</span>
                  <input
                    id="cctv-labor-rate-input"
                    className="cpq-cctv-ws-text-input"
                    dir="ltr"
                    inputMode="decimal"
                    value={laborRateDraft}
                    onChange={(ev) => setLaborRateDraft(ev.target.value)}
                  />
                </label>
                <Button type="button" variant="secondary" loading={laborRateSaving} onClick={() => void saveLaborRate()}>
                  {he.laborRateSave}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-fg-muted">{he.laborRateAskAdmin}</p>
            )}
            {laborRateError ? (
              <p className="text-sm text-danger" role="alert">
                {laborRateError}
              </p>
            ) : null}
          </>
        )}
      </section>
    ) : null;

  function adoptDesign(design: SystemDesign) {
    designRef.current = design;
    revisionRef.current = Number(design.revision) || 1;
  }

  function applyHydratedDesign(design: SystemDesign) {
    adoptDesign(design);
    const hydratedReq = requirementsFromDesign(design);
    setReq(hydratedReq);
    const rec = recommendationFromDesign(design);
    if (rec && designHasRecommendation(design)) {
      setRecommendation(rec);
      setSelection(selectionFromDesign(design));
      setStep("review");
      setNeedsReviewHint((design.components ?? []).some((c) => c.needs_review));
      setLastCalcFingerprint(requirementsCalcFingerprint(hydratedReq));
      savedReqFingerprintRef.current = requirementsCalcFingerprint(hydratedReq);
      setPersistState("saved");
    } else {
      setRecommendation(null);
      setSelection(emptyReviewSelection());
      setStep("requirements");
      setNeedsReviewHint(false);
      setLastCalcFingerprint(null);
      savedReqFingerprintRef.current = null;
      setPersistState("idle");
    }
  }

  async function reloadDesignFromServer() {
    const id = designRef.current?.id;
    if (!id) return;
    setConflict(false);
    setPersistError(null);
    try {
      const design = await api.getSystemDesign(workspaceId, id);
      hydratingRef.current = true;
      applyHydratedDesign(design);
    } catch (err) {
      setPersistError(apiErrorMessage(err, he.cpqCctvDesignLoadError));
    } finally {
      hydratingRef.current = false;
    }
  }

  async function ensureDesign(quote: string, requirements: CctvBuildRequirements): Promise<SystemDesign> {
    const listed = await api.listSystemDesigns(workspaceId, quote);
    const existing = pickActiveCctvDesign(listed.items);
    if (existing) {
      adoptDesign(existing);
      return existing;
    }
    const created = await api.createSystemDesign(workspaceId, quote, {
      engine_type: "cctv",
      engine_version: 1,
      requirements: requirementsToDesignDoc(requirements) as unknown as Record<string, unknown>,
    });
    // Re-list to prefer earliest if a race created duplicates (no unique constraint by design).
    const again = await api.listSystemDesigns(workspaceId, quote);
    const winner = pickActiveCctvDesign(again.items) ?? created;
    adoptDesign(winner);
    return winner;
  }

  async function patchDesign(body: Parameters<ApiClient["patchSystemDesign"]>[2]): Promise<SystemDesign | null> {
    const current = designRef.current;
    if (!current) return null;
    setPersistState("saving");
    try {
      const next = await api.patchSystemDesign(workspaceId, current.id, {
        ...body,
        revision: revisionRef.current,
      });
      adoptDesign(next);
      setConflict(false);
      setPersistError(null);
      if (body.requirements) {
        savedReqFingerprintRef.current = requirementsCalcFingerprint(req);
      }
      setPersistState("saved");
      return next;
    } catch (err) {
      if (err instanceof ApiClientError && (err.status === 409 || err.code === "CONFLICT_REVISION")) {
        setConflict(true);
        setPersistError(he.cpqCctvDesignConflict);
        setPersistState("error");
        return null;
      }
      setPersistError(apiErrorMessage(err, he.cpqCctvDesignSaveError));
      setPersistState("error");
      return null;
    }
  }

  async function persistRecommendationState(
    rec: SystemRecommendation,
    nextSelection: ReviewSelectionState,
    requirements: CctvBuildRequirements,
    needsReviewRoles: Set<string>,
    opts: { allowCreate?: boolean } = {},
  ) {
    let quote = quoteId;
    if (!quote) {
      // DEMO-2.3: no quote is created until it gets content. A calculation on a new quote
      // stays local; "הוסף תכנון להצעה" creates the quote and saves the design.
      if (!ensureQuoteId || !opts.allowCreate) return;
      creatingQuoteRef.current = true;
      try {
        quote = await ensureQuoteId();
        selfCreatedQuoteRef.current = quote;
      } finally {
        creatingQuoteRef.current = false;
      }
    }
    await ensureDesign(quote, requirements);
    const calculatedAt = new Date().toISOString();
    const next = await patchDesign({
      revision: revisionRef.current,
      requirements: requirementsToDesignDoc(requirements) as unknown as Record<string, unknown>,
      engineering_result: rec.engineering ?? {},
      recommendation_meta: recommendationMetaFromRec(rec),
      lifecycle_status: "calculated",
      engine_version: Number(rec.engine_version) || 1,
      calculated_at: calculatedAt,
      components: componentsFromRecommendation(rec, nextSelection, needsReviewRoles),
      components_replace: true,
    });
    if (next) {
      savedReqFingerprintRef.current = requirementsCalcFingerprint(requirements);
      setPersistState("saved");
    }
  }

  function schedulePersistSelection(next: ReviewSelectionState) {
    if (hydratingRef.current || conflict || !designRef.current || !recommendation) return;
    if (selectionPersistTimer.current) window.clearTimeout(selectionPersistTimer.current);
    selectionPersistTimer.current = window.setTimeout(() => {
      void patchDesign({
        revision: revisionRef.current,
        components: componentsFromRecommendation(recommendation, next),
        components_replace: true,
      });
    }, 400);
  }

  function updateSelection(next: ReviewSelectionState) {
    setSelection(next);
    // Editing after a successful Apply unlocks re-apply (idempotent replace, not append).
    if (applySucceeded || appliedOnce) {
      setApplySucceeded(false);
      setAppliedOnce(false);
    }
    schedulePersistSelection(next);
  }

  // Open / hydrate — no empty Design creation on mere open.
  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      selfCreatedQuoteRef.current = null;
      return;
    }
    // The quote id arrived because this drawer just created the quote: the design and the
    // local review state are already current. Reloading would reset them and recalculate.
    if (wasOpenRef.current && quoteId && (creatingQuoteRef.current || quoteId === selfCreatedQuoteRef.current)) {
      selfCreatedQuoteRef.current = quoteId;
      return;
    }
    wasOpenRef.current = true;
    const gen = ++openGen.current;
    setSystemType("cctv");
    setInputError(null);
    setServerError(null);
    setPersistError(null);
    setConflict(false);
    setNeedsReviewHint(false);
    setNeedsReviewKeys(new Set());
    setAppliedOnce(false);
    setApplySucceeded(false);
    setLastLines(null);
    setDivergence(null);
    setLocalApplyError(null);
    setLocalApplying(false);
    designRef.current = null;
    revisionRef.current = 1;

    let cancelled = false;
    async function hydrate() {
      if (!quoteId) {
        setReq(leadDefaults(lead));
        setRecommendation(null);
        setSelection(emptyReviewSelection());
        setLastCalcFingerprint(null);
        setPersistState("idle");
        savedReqFingerprintRef.current = null;
        setStep("requirements");
        return;
      }
      setHydrating(true);
      hydratingRef.current = true;
      try {
        const listed = await api.listSystemDesigns(workspaceId, quoteId);
        if (cancelled || openGen.current !== gen) return;
        const existing = pickActiveCctvDesign(listed.items);
        if (existing) {
          const fresh = await api.getSystemDesign(workspaceId, existing.id);
          if (cancelled || openGen.current !== gen) return;
          applyHydratedDesign(fresh);
        } else {
          setReq(leadDefaults(lead));
          setRecommendation(null);
          setSelection(emptyReviewSelection());
          setLastCalcFingerprint(null);
          setPersistState("idle");
          savedReqFingerprintRef.current = null;
          setStep("requirements");
        }
      } catch (err) {
        if (cancelled || openGen.current !== gen) return;
        setReq(leadDefaults(lead));
        setRecommendation(null);
        setSelection(emptyReviewSelection());
        setLastCalcFingerprint(null);
        setPersistState("idle");
        savedReqFingerprintRef.current = null;
        setStep("requirements");
        setPersistError(apiErrorMessage(err, he.cpqCctvDesignLoadError));
      } finally {
        if (!cancelled && openGen.current === gen) {
          setHydrating(false);
          hydratingRef.current = false;
        }
      }
    }
    void hydrate();
    return () => {
      cancelled = true;
      if (selectionPersistTimer.current) window.clearTimeout(selectionPersistTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional open/quote gate
  }, [open, quoteId, workspaceId, api, lead]);

  /**
   * silent = automatic run after an edit: stays on the requirements screen, keeps the user's
   * place, and ignores a response that a newer run has already superseded.
   */
  async function calculate(opts: { silent?: boolean } = {}) {
    const silent = Boolean(opts.silent);
    if (systemType !== "cctv") return;
    if (conflict) {
      setPersistError(he.cpqCctvDesignConflict);
      return;
    }
    const validation = validateCctvBuildRequirements(req);
    if (!validation.ok) {
      setInputError(
        validation.messageKey === "cameras"
          ? he.cpqCctvErrCameras
          : validation.messageKey === "retention"
            ? he.cpqCctvErrRetention
            : validation.messageKey === "hours"
              ? he.cpqCctvErrHours
              : validation.messageKey === "hybridSplit"
                ? he.cpqCctvErrHybridSplit
                : he.cpqCctvErrResolution,
      );
      setServerError(null);
      return;
    }
    setInputError(null);
    setServerError(null);
    setPersistError(null);
    const run = ++calcRunRef.current;
    const reqAtRun = req;
    if (silent) setCalculating(true);
    else setStep("loading");
    onClearRecovery?.();
    setAppliedOnce(false);
    setLastLines(null);
    const priorSelection = selection;
    try {
      const body = requirementsToRecommendBody(reqAtRun);
      const rec = await api.recommendCctv(workspaceId, body);
      if (run !== calcRunRef.current) return; // a newer edit already started another run
      const merged = mergeSelectionAfterRecalculate(rec, priorSelection);
      setRecommendation(rec);
      setSelection(merged.selection);
      setNeedsReviewKeys(merged.needsReviewRoles);
      setNeedsReviewHint(merged.needsReviewRoles.size > 0);
      setLastCalcFingerprint(requirementsCalcFingerprint(reqAtRun));
      if (!silent) setStep("review");
      // Persist after successful recommend — failure must not erase local review state.
      try {
        await persistRecommendationState(rec, merged.selection, reqAtRun, merged.needsReviewRoles);
      } catch (err) {
        setPersistError(apiErrorMessage(err, he.cpqCctvDesignSaveError));
      }
    } catch (err) {
      if (run !== calcRunRef.current) return;
      setRecommendation(null);
      setStep("requirements");
      setServerError(apiErrorMessage(err, he.cpqCctvServerError));
    } finally {
      if (run === calcRunRef.current) setCalculating(false);
    }
  }

  // Q2: calculate automatically 600 ms after the last valid change on the requirements screen.
  useEffect(() => {
    if (!open || systemType !== "cctv" || step !== "requirements" || hydrating || conflict) return;
    if (!requirementsValid || currentFingerprint === lastCalcFingerprint) return;
    const timer = window.setTimeout(() => {
      void calculate({ silent: true });
    }, AUTO_CALC_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs on requirement changes only
  }, [open, systemType, step, hydrating, conflict, requirementsValid, currentFingerprint, lastCalcFingerprint]);

  async function handleAdd(resume?: PartialApplyRecovery | null, confirmationToken?: string | null) {
    if (!addGate.ok || applying || localApplying) return;
    if (appliedOnce && !resume && !confirmationToken && !divergence) return;
    if (!resume && !confirmationToken) setAppliedOnce(true);
    setLastLines(addGate.lines);
    setLocalApplyError(null);

    let design = designRef.current;
    const planned = addGate.ok ? addGate.planned : [];
    const resolved = addGate.ok ? addGate.lines : [];

    if (!design && recommendation && ensureQuoteId && (resolved.length > 0 || planned.length > 0)) {
      // DEMO-2.3: first content for a new quote: create it now, then the durable apply path.
      setLocalApplying(true);
      try {
        await persistRecommendationState(recommendation, selection, req, new Set(), { allowCreate: true });
      } catch (err) {
        setLocalApplyError(apiErrorMessage(err, he.cpqCctvDesignSaveError));
      } finally {
        setLocalApplying(false);
      }
      design = designRef.current;
    }

    if (design) {
      // Durable atomic Apply for resolved catalog products; planned free-lines separately.
      setLocalApplying(true);
      try {
        if (recommendation) {
          try {
            await persistRecommendationState(recommendation, selection, req, new Set());
          } catch {
            // Apply still uses server Design state from last successful persist.
          }
        }
        let quoteAfter: QuoteOut | null = null;
        if (resolved.length > 0) {
          const fresh = designRef.current ?? design;
          const result = await api.applySystemDesign(workspaceId, fresh.id, {
            revision: fresh.revision,
            confirmation_token: confirmationToken ?? undefined,
            section_name: he.cpqCctvSystemSection,
          });
          designRef.current = result.design;
          quoteAfter = result.quote;
        }
        if (planned.length && onApplyPlanned) {
          const next = await onApplyPlanned(planned, quoteAfter);
          if (next) quoteAfter = next;
        }
        setDivergence(null);
        setLocalApplyError(null);
        onClearRecovery?.();
        setApplySucceeded(true);
        setAppliedOnce(true);
        setAppliedTotal(quoteAfter?.total_gross != null ? Number(quoteAfter.total_gross) : null);
        if (quoteAfter && onAppliedQuote) {
          await onAppliedQuote(quoteAfter);
        } else if (!resolved.length && !planned.length) {
          setLocalApplyError(he.cpqCctvAddNeedsEquipment);
          setAppliedOnce(false);
          setApplySucceeded(false);
          return;
        } else if (!quoteAfter && onAppliedQuote && quoteId) {
          // Planned-only path without returned quote — parent refreshed via onApplyPlanned.
        }
      } catch (err) {
        setApplySucceeded(false);
        if (err instanceof ApiClientError && err.code === "DESIGN_APPLY_DIVERGED") {
          const details = err.details as SystemDesignApplyDiverged;
          if (details?.confirmation_token) {
            setDivergence(details);
            setLocalApplyError(he.cpqCctvApplyDiverged);
            setAppliedOnce(false);
            return;
          }
        }
        if (err instanceof ApiClientError && err.code === "CONFLICT_REVISION") {
          setConflict(true);
          setAppliedOnce(false);
          return;
        }
        if (err instanceof ApiClientError && err.code === "CONFIRMATION_STALE") {
          setDivergence(null);
          setLocalApplyError(he.cpqCctvApplyConfirmStale);
          setAppliedOnce(false);
          return;
        }
        setLocalApplyError(
          `${he.cpqCctvApplyError}: ${err instanceof ApiClientError ? err.message : he.quotesError}`,
        );
        if (!resume && !confirmationToken) setAppliedOnce(false);
      } finally {
        setLocalApplying(false);
      }
      return;
    }

    // Legacy fallback: no durable Design yet (pre-persist / failed persist).
    try {
      await onApply(resolved, { resume: resume ?? undefined, planned });
      setApplySucceeded(true);
      setAppliedOnce(true);
    } catch {
      setApplySucceeded(false);
      if (!resume) setAppliedOnce(false);
    }
  }

  const busy = applying || localApplying;
  const shownApplyError = localApplyError || applyError;

  const footer =
    applySucceeded && step === "review" ? (
      <div className="cpq-cctv-designer-footer flex w-full flex-col gap-3" data-testid="cctv-apply-success">
        <div className="rounded-md border border-success/40 bg-success/5 p-3 text-sm" role="status">
          <p className="font-medium text-fg">{he.cpqCctvApplySuccessTitle}</p>
          <p className="mt-1 text-fg-muted">{he.cpqCctvApplySuccessBody}</p>
          {appliedTotal != null ? (
            <p className="mt-2 font-medium text-fg" data-testid="cctv-applied-total" data-total={appliedTotal}>
              {he.cpqCctvAppliedTotal(formatMoney(appliedTotal))}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setApplySucceeded(false);
              setAppliedOnce(false);
            }}
          >
            {he.cpqCctvContinueEquipment}
          </Button>
          <Button
            type="button"
            onClick={() => {
              onClose();
            }}
          >
            {he.cpqCctvReturnToQuote}
          </Button>
        </div>
      </div>
    ) : step === "review" && recommendation ? (
      <div className="cpq-cctv-designer-footer flex w-full flex-col gap-2">
        {!divergence && !(recovery && lastLines) && addGate.ok && addGate.planned.length > 0 ? (
          <p className="text-xs text-fg-muted ms-auto" role="status">
            {he.cpqCctvAddPlanHint(
              addGate.planned.filter((line) => line.itemType !== "labor").length,
              addGate.lines.length,
              addGate.planned.filter((line) => line.itemType === "labor").length,
            )}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setStep("requirements");
              // Keep last recommendation so stale metrics remain visible until recalc.
              setAppliedOnce(false);
              setApplySucceeded(false);
              setLastLines(null);
              setDivergence(null);
              setLocalApplyError(null);
              onClearRecovery?.();
            }}
            disabled={busy || conflict}
          >
            {he.cpqAdjustPlan}
          </Button>
          {divergence ? (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setDivergence(null);
                  setLocalApplyError(null);
                  setAppliedOnce(false);
                }}
                disabled={busy}
              >
                {he.cancel}
              </Button>
              <Button
                type="button"
                onClick={() => void handleAdd(null, divergence.confirmation_token)}
                disabled={busy || conflict}
                aria-busy={busy}
              >
                {busy ? he.cpqCctvApplying : he.cpqCctvConfirmReplace}
              </Button>
            </>
          ) : recovery && lastLines ? (
            <Button
              type="button"
              onClick={() => void handleAdd(recovery)}
              disabled={busy || conflict}
              aria-busy={busy}
            >
              {busy ? he.cpqCctvApplying : he.cpqCctvResumeApply}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => void handleAdd(null)}
              disabled={!addGate.ok || busy || appliedOnce || conflict}
              aria-busy={busy}
            >
              {busy
                ? he.cpqCctvApplying
                : !addGate.ok
                  ? he.cpqCctvResolveEquipmentFirst
                  : addGate.lines.length === 0 && addGate.planned.length > 0
                    ? he.cpqAddPlanToQuote
                    : addGate.incomplete
                      ? he.cpqAddResolvedToQuote
                      : he.cpqAddPlanToQuote}
            </Button>
          )}
        </div>
      </div>
    ) : step === "loading" || hydrating ? (
      <div className="flex justify-end">
        <Button type="button" variant="secondary" disabled>
          {hydrating ? he.cpqCctvDesignHydrating : he.cpqCctvPlanning}
        </Button>
      </div>
    ) : (
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          {systemType === "free_build" ? he.domainFreeBuildBack : he.cancel}
        </Button>
        {systemType === "cctv" ? (
          <Button
            type="button"
            disabled={conflict || calculating || !(calcState === "fresh" && recommendation)}
            onClick={() => {
              if (calcState === "fresh" && recommendation) setStep("review");
            }}
          >
            {he.cpqCctvContinueToEquipment}
          </Button>
        ) : null}
      </div>
    );

  return (
    <QuoteFlowSheet
      open={open}
      onClose={() => {
        if (busy) return;
        onClose();
      }}
      title={he.cpqBuildSystem}
      subtitle={he.cpqBuildSystemLead}
      variant="sheet"
      size="lg"
      footer={footer}
    >
      <div className="grid gap-4">
        <div>
          <p className="mb-2 text-xs font-medium text-fg-muted">{he.domainPickerLabel}</p>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label={he.domainPickerLabel}>
            {visibleDomains().map((domain) => (
              <button
                key={domain.key}
                type="button"
                role="tab"
                aria-selected={systemType === domain.key}
                data-testid={`domain-tab-${domain.key}`}
                className={`rounded-[var(--radius-control)] border px-3 py-1.5 text-sm ${
                  systemType === domain.key
                    ? "border-fg bg-bg-subtle font-medium text-fg"
                    : "border-border text-fg-muted hover:text-fg"
                }`}
                onClick={() => setSystemType(domain.key)}
              >
                {domainLabel(domain.key, he)}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-fg-muted">{he.domainMultipleHint}</p>
        </div>
        {systemType === "free_build" ? (
          <div className="rounded-[var(--radius-card)] border border-border p-4" data-testid="domain-free-build-panel">
            <p className="text-sm font-medium text-fg">{he.domainFreeBuild}</p>
            <p className="mt-1 text-sm text-fg-muted">{he.domainFreeBuildLead}</p>
          </div>
        ) : null}
        {conflict ? (
          <div className="rounded-md border border-danger/40 bg-danger/5 p-3 text-sm" role="alert">
            <p className="text-danger">{he.cpqCctvDesignConflict}</p>
            <Button type="button" className="mt-2" variant="secondary" onClick={() => void reloadDesignFromServer()}>
              {he.cpqCctvDesignReload}
            </Button>
          </div>
        ) : null}
        {persistError && !conflict ? (
          <div className="rounded-md border border-danger/40 bg-danger/5 p-3 text-sm" role="alert">
            <p className="font-medium text-danger">{he.cpqCctvSaveErrorTitle}</p>
            <p className="mt-1 text-fg-muted">{persistError}</p>
          </div>
        ) : null}
        {needsReviewHint && step === "review" ? (
          <p className="text-sm text-fg-muted" role="status">
            {he.cpqCctvNeedsReviewHint}
          </p>
        ) : null}
        {divergence && step === "review" ? (
          <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm" role="alert">
            <p className="font-medium text-fg">{he.cpqCctvApplyDivergedTitle}</p>
            <p className="mt-1 text-fg-muted">{he.cpqCctvApplyDivergedBody}</p>
            <ul className="mt-2 list-disc space-y-1 pe-5 text-fg-muted">
              {divergence.diverged.map((d) => (
                <li key={d.component_id}>
                  {commercialLabelHe(d.role_key)}:{" "}
                  {d.kind === "MISSING"
                    ? he.cpqCctvApplyDivergedMissing
                    : he.cpqCctvApplyDivergedChanged}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-fg-muted">{he.cpqCctvApplyDivergedReplaceHint}</p>
          </div>
        ) : null}

        {systemType === "cctv" && (step === "requirements" || step === "loading" || hydrating) ? (
          <>
            {step === "loading" || hydrating ? (
              <CctvBuildProgress label={hydrating ? he.cpqCctvDesignHydrating : undefined} />
            ) : (
              <div className="cpq-cctv-designer-shell" data-testid="cctv-designer-requirements-shell">
                <CctvRequirementsHeader
                  req={req}
                  setReq={updateRequirements}
                  calcState={calcState}
                  disabled={conflict}
                  status={status}
                />
                <div className="cpq-cctv-designer-shell-body">
                  <CctvEngineeringSummaryPanel
                    req={req}
                    recommendation={recommendation}
                    calcState={calcState}
                    readiness={designerReadiness}
                    persistState={persistState}
                    stale={false}
                  />
                  <CctvRequirementsWorkspace
                    req={req}
                    setReq={updateRequirements}
                    inputError={inputError}
                    stale={false}
                    calcState={calcState}
                    disabled={conflict}
                    hideHeader
                    siteContext={{
                      customerName,
                      siteName,
                      leadLocation: lead?.requirements?.location,
                      leadInfra: lead?.requirements?.infrastructure,
                    }}
                  />
                </div>
              </div>
            )}
            {serverError ? (
              <p className="text-sm text-danger" role="alert">
                {serverError}
              </p>
            ) : null}
          </>
        ) : null}

        {systemType === "cctv" && step === "review" && recommendation && !hydrating ? (
          <CctvReviewPanel
            rec={recommendation}
            selection={selection}
            setSelection={updateSelection}
            needsReviewKeys={needsReviewKeys}
            onNeedsReviewKeysChange={(next) => {
              setNeedsReviewKeys(next);
              setNeedsReviewHint(next.size > 0);
            }}
            applyError={shownApplyError}
            focusComponentKey={focusComponentKey}
            workspaceId={workspaceId}
            api={api}
          />
        ) : null}
        {laborPanel}
      </div>
    </QuoteFlowSheet>
  );
}

function CctvBuildProgress({ label }: { label?: string }) {
  const stages = [
    he.cpqCctvStageAnalyze,
    he.cpqCctvStageStorage,
    he.cpqCctvStagePoe,
    he.cpqCctvStageCatalog,
    he.cpqCctvStageRecommend,
  ];
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (label) return;
    const id = window.setInterval(() => {
      setIndex((value) => (value + 1) % stages.length);
    }, 900);
    return () => window.clearInterval(id);
  }, [stages.length, label]);
  return (
    <div className="flex flex-col items-center gap-3 py-6" role="status" aria-live="polite">
      <div className="cpq-cctv-progress-ring" aria-hidden />
      <p className="text-sm font-semibold text-fg">{label ?? stages[index]}</p>
      <p className="text-xs text-fg-muted">{he.cpqCctvPlanningHint}</p>
    </div>
  );
}
