/**
 * Task 13D — Build System V1 product integration.
 * R2: durable CCTV Design persistence + hydration (no Apply/REPLACE).
 *
 * Flow: requirements → POST /cctv/recommend → review → quote projection.
 * CCTV sizing is server-authoritative. Do not call legacy keyword matching here.
 */

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
import type { SystemBuilderType } from "../../../lib/system-builder";

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
  const [systemType, setSystemType] = useState<SystemBuilderType>("cctv");
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
  const [lastLines, setLastLines] = useState<CctvBuildQuoteLine[] | null>(null);
  const [localApplying, setLocalApplying] = useState(false);
  const [localApplyError, setLocalApplyError] = useState<string | null>(null);
  const [divergence, setDivergence] = useState<SystemDesignApplyDiverged | null>(null);
  const [lastCalcFingerprint, setLastCalcFingerprint] = useState<string | null>(null);
  const [persistState, setPersistState] = useState<PersistTrustState>("idle");
  const savedReqFingerprintRef = useRef<string | null>(null);

  const designRef = useRef<SystemDesign | null>(null);
  const revisionRef = useRef(1);
  const hydratingRef = useRef(false);
  const selectionPersistTimer = useRef<number | null>(null);
  const openGen = useRef(0);

  const currentFingerprint = useMemo(() => requirementsCalcFingerprint(req), [req]);
  const requirementsStale = Boolean(
    lastCalcFingerprint && lastCalcFingerprint !== currentFingerprint,
  );
  const calcState: "draft" | "fresh" | "stale" = !lastCalcFingerprint
    ? "draft"
    : requirementsStale
      ? "stale"
      : "fresh";

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
    return canAddRecommendationToQuote(recommendation, selection);
  }, [recommendation, selection]);

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
      setPersistError(err instanceof ApiClientError ? err.message : he.cpqCctvDesignLoadError);
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
      setPersistError(err instanceof ApiClientError ? err.message : he.cpqCctvDesignSaveError);
      setPersistState("error");
      return null;
    }
  }

  async function persistRecommendationState(
    rec: SystemRecommendation,
    nextSelection: ReviewSelectionState,
    requirements: CctvBuildRequirements,
    needsReviewRoles: Set<string>,
  ) {
    let quote = quoteId;
    if (!quote) {
      if (!ensureQuoteId) return;
      quote = await ensureQuoteId();
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
    if (!open) return;
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
        setPersistError(err instanceof ApiClientError ? err.message : he.cpqCctvDesignLoadError);
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

  async function calculate() {
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
    setStep("loading");
    onClearRecovery?.();
    setAppliedOnce(false);
    setLastLines(null);
    const priorSelection = selection;
    try {
      const body = requirementsToRecommendBody(req);
      const rec = await api.recommendCctv(workspaceId, body);
      const merged = mergeSelectionAfterRecalculate(rec, priorSelection);
      setRecommendation(rec);
      setSelection(merged.selection);
      setNeedsReviewKeys(merged.needsReviewRoles);
      setNeedsReviewHint(merged.needsReviewRoles.size > 0);
      setLastCalcFingerprint(requirementsCalcFingerprint(req));
      setStep("review");
      // Persist after successful recommend — failure must not erase local review state.
      try {
        await persistRecommendationState(rec, merged.selection, req, merged.needsReviewRoles);
      } catch (err) {
        setPersistError(err instanceof ApiClientError ? err.message : he.cpqCctvDesignSaveError);
      }
    } catch (err) {
      setRecommendation(null);
      setStep("requirements");
      setServerError(err instanceof ApiClientError ? err.message : he.cpqCctvServerError);
    }
  }

  async function handleAdd(resume?: PartialApplyRecovery | null, confirmationToken?: string | null) {
    if (!addGate.ok || applying || localApplying) return;
    if (appliedOnce && !resume && !confirmationToken && !divergence) return;
    if (!resume && !confirmationToken) setAppliedOnce(true);
    setLastLines(addGate.lines);
    setLocalApplyError(null);

    const design = designRef.current;
    const planned = addGate.ok ? addGate.planned : [];
    const resolved = addGate.ok ? addGate.lines : [];

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
            {he.cpqCctvAddPlanHint(addGate.planned.length, addGate.lines.length)}
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
          {he.cancel}
        </Button>
        <Button
          type="button"
          disabled={systemType !== "cctv" || conflict}
          onClick={() => void calculate()}
        >
          {lastCalcFingerprint ? he.cpqCctvRecalculate : he.cpqCctvCalculate}
        </Button>
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

        {step === "requirements" || step === "loading" || hydrating ? (
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
                />
                <div className="cpq-cctv-designer-shell-body">
                  <CctvEngineeringSummaryPanel
                    req={req}
                    recommendation={recommendation}
                    calcState={calcState}
                    readiness={designerReadiness}
                    persistState={persistState}
                    stale={requirementsStale}
                  />
                  <CctvRequirementsWorkspace
                    req={req}
                    setReq={updateRequirements}
                    inputError={inputError}
                    stale={requirementsStale}
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

        {step === "review" && recommendation && !hydrating ? (
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
