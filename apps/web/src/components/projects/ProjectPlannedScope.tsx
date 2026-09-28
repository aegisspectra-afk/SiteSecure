import type { ProjectPlannedItemOut } from "@site-secure/api-client";
import { Button } from "@site-secure/ui";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";

function scopeKindLabel(kind: string): string {
  if (kind === "labor") return he.projectPlannedScopeKindLabor;
  if (kind === "equipment") return he.projectPlannedScopeKindEquipment;
  return he.projectPlannedScopeKindOther;
}

function itemTitle(item: ProjectPlannedItemOut): string {
  return (item.name || item.description || item.sku || "—").trim();
}

function materializationHint(item: ProjectPlannedItemOut): string | null {
  if (item.scope_kind !== "equipment") return null;
  const planned = Math.max(0, Math.floor(Number(item.qty) || 0));
  const created = Math.max(0, Number(item.assets_created) || 0);
  return he.projectPlannedScopeProgress(planned, created);
}

export function ProjectPlannedScope({
  items,
  loading,
  error,
  sourceVersion,
  canCreateInstalled,
  onCreateInstalled,
  createResultMessage,
  siteId,
}: {
  items: ProjectPlannedItemOut[];
  loading?: boolean;
  error?: string | null;
  sourceVersion?: number | null;
  canCreateInstalled?: boolean;
  onCreateInstalled?: () => void;
  createResultMessage?: string | null;
  siteId?: string | null;
}) {
  const eligibleRemaining = items
    .filter((i) => i.scope_kind === "equipment")
    .reduce((sum, i) => sum + Math.max(0, Number(i.assets_remaining) || 0), 0);
  const showAction = Boolean(canCreateInstalled && eligibleRemaining > 0 && onCreateInstalled);

  return (
    <section className="project-planned-scope" aria-labelledby="project-planned-scope-heading" data-testid="project-planned-scope">
      <div className="project-planned-scope-head">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="project-planned-scope-heading" className="project-workspace-section-title">
              {he.projectPlannedScopeTitle}
            </h2>
            {sourceVersion != null && sourceVersion > 0 ? (
              <p className="project-planned-scope-meta text-xs text-fg-muted">
                {he.projectPlannedScopeFromRevision(sourceVersion)}
              </p>
            ) : null}
          </div>
          {showAction ? (
            <Button
              type="button"
              onClick={onCreateInstalled}
              data-testid="create-installed-assets-action"
            >
              {he.projectCreateInstalledAssets}
            </Button>
          ) : null}
        </div>
      </div>

      {createResultMessage ? (
        <div
          className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
          data-testid="create-installed-assets-result"
          role="status"
        >
          <span className="text-fg">{createResultMessage}</span>
          {siteId ? (
            <Link
              to="/app/sites/$siteId"
              params={{ siteId }}
              className="font-medium text-fg underline-offset-2 hover:underline"
              data-testid="create-installed-assets-open-site"
            >
              {he.projectCreateInstalledAssetsOpenSite}
            </Link>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-fg-muted">{he.projectPlannedScopeLoading}</p>
      ) : error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : items.length === 0 ? (
        <div className="project-planned-scope-empty" data-testid="project-planned-scope-empty">
          <p className="text-sm font-medium text-fg">{he.projectPlannedScopeEmpty}</p>
          <p className="mt-1 text-xs text-fg-muted">{he.projectPlannedScopeEmptyHint}</p>
        </div>
      ) : (
        <>
          <ul className="project-planned-scope-list project-planned-scope-list-desktop" data-testid="project-planned-scope-list">
            {items.map((item) => {
              const progress = materializationHint(item);
              return (
                <li key={item.id} className="project-planned-scope-row">
                  <div className="project-planned-scope-row-main">
                    <span className="project-planned-scope-name">{itemTitle(item)}</span>
                    {item.section_name ? (
                      <span className="project-planned-scope-section text-xs text-fg-muted">{item.section_name}</span>
                    ) : null}
                    {progress ? (
                      <span className="project-planned-scope-progress text-xs text-fg-muted" data-testid="planned-scope-progress">
                        {progress}
                      </span>
                    ) : null}
                  </div>
                  <span className="project-planned-scope-kind text-xs text-fg-muted">{scopeKindLabel(item.scope_kind)}</span>
                  <span className="project-planned-scope-qty ltr-meta" dir="ltr">
                    {item.qty}
                    {item.unit ? ` ${item.unit}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
          <ul className="project-planned-scope-cards project-planned-scope-cards-mobile" data-testid="project-planned-scope-cards">
            {items.map((item) => {
              const progress = materializationHint(item);
              return (
                <li key={item.id} className="project-planned-scope-card">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-fg">{itemTitle(item)}</p>
                    <span className="ltr-meta shrink-0 text-sm font-semibold tabular-nums" dir="ltr">
                      ×{item.qty}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-fg-muted">
                    {scopeKindLabel(item.scope_kind)}
                    {" · "}
                    {item.section_name || he.projectPlannedScopeSectionFallback}
                  </p>
                  {progress ? (
                    <p className="mt-1 text-xs text-fg-muted" data-testid="planned-scope-progress">
                      {progress}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
