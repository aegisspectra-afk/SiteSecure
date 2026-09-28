import type { SystemDesign } from "@site-secure/api-client";
import { Button } from "@site-secure/ui";
import { he } from "../../../i18n/he";

/** Compact Stage 2 surface for an existing durable System Design — open only, no Apply. */
export function PlanningSystemDesignCard({
  design,
  onOpen,
}: {
  design: SystemDesign;
  onOpen: () => void;
}) {
  const active = (design.components ?? []).filter((c) => !c.removed);
  const chips = active
    .slice(0, 6)
    .map((c) => {
      const qty = Number(c.quantity ?? 0);
      const label = (c.label || c.role_key || "").trim();
      if (!label) return null;
      return qty > 0 ? `${qty} ${label}` : label;
    })
    .filter(Boolean) as string[];

  const title =
    design.engine_type === "cctv"
      ? he.leadServiceTypes.cctv
      : he.cpqSolutionDesignFallbackTitle;

  const statusLabel =
    design.lifecycle_status === "calculated" || design.lifecycle_status === "applied"
      ? he.cpqSolutionDesignComplete
      : he.cpqSolutionDesignDraft;

  const intentWithoutCatalog = active.some(
    (c) =>
      c.equipment_intent &&
      !c.user_selected_product_id &&
      !c.engine_preferred_product_id &&
      !c.applied_product_id,
  );

  return (
    <article className="cpq-planning-design-card" data-testid="planning-system-design">
      <div className="cpq-planning-design-copy">
        <h3 className="cpq-planning-design-title">{title}</h3>
        <p className="cpq-planning-design-status">{statusLabel}</p>
        {chips.length ? (
          <p className="cpq-planning-design-chips">{chips.join(" · ")}</p>
        ) : (
          <p className="cpq-planning-design-chips">{he.cpqSolutionDesignNoComponents}</p>
        )}
        {intentWithoutCatalog ? (
          <p className="cpq-planning-design-intent">{he.cpqSolutionDesignHasIntent}</p>
        ) : null}
      </div>
      <Button type="button" variant="secondary" onClick={onOpen}>
        {he.cpqSolutionOpenDesign}
      </Button>
    </article>
  );
}
