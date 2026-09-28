import type { AssetLifecycleActivityOut, ServiceCallOut } from "@site-secure/api-client";
import { Status } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { formatAssetDate } from "../../lib/site-assets";
import { useSession } from "../../lib/session";

export function AssetServiceHistorySection({
  assetId,
  canView,
}: {
  assetId: string;
  canView: boolean;
}) {
  const { session, api } = useSession();
  const workspaceId = session?.memberships[0]?.workspace_id;

  const query = useQuery({
    queryKey: ["equipment-service", workspaceId, assetId],
    enabled: Boolean(workspaceId && canView),
    queryFn: () => api.listServiceCalls(workspaceId!, { equipment_id: assetId, limit: 50 }),
  });

  if (!canView) {
    return (
      <p className="text-sm text-fg-muted" data-testid="asset-service-denied">
        {he.assetServiceDenied}
      </p>
    );
  }

  const items: ServiceCallOut[] = query.data?.items ?? [];

  if (query.isLoading) {
    return <p className="text-sm text-fg-muted">{he.loading}</p>;
  }

  if (!items.length) {
    return (
      <p className="text-sm text-fg-muted" data-testid="asset-service-empty">
        {he.assetServiceEmpty}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border border-y border-border" data-testid="asset-service-list">
      {items.map((row) => (
        <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
          <div className="min-w-0 flex-1">
            <Link
              to="/app/service"
              className="font-medium text-fg hover:underline"
              data-testid={`asset-service-${row.id}`}
            >
              {row.title}
            </Link>
            <p className="mt-1 text-xs text-fg-muted">
              {[row.number, formatAssetDate(row.updated_at || row.created_at)].filter(Boolean).join(" · ")}
            </p>
          </div>
          <Status label={row.status} />
        </li>
      ))}
    </ul>
  );
}

export function AssetActivitySection({ assetId }: { assetId: string }) {
  const { session, api } = useSession();
  const workspaceId = session?.memberships[0]?.workspace_id;

  const query = useQuery({
    queryKey: ["equipment-lifecycle", workspaceId, assetId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listEquipmentLifecycleActivity(workspaceId!, assetId),
  });

  const items: AssetLifecycleActivityOut[] = query.data?.items ?? [];

  if (query.isLoading) {
    return <p className="text-sm text-fg-muted">{he.loading}</p>;
  }

  if (!items.length) {
    return (
      <p className="text-sm text-fg-muted" data-testid="asset-activity-empty">
        {he.assetActivityEmpty}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border border-y border-border" data-testid="asset-activity-list">
      {items.map((row) => (
        <li key={row.id} className="py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-fg">{row.title}</p>
            <p className="text-xs text-fg-muted" dir="ltr">
              {formatAssetDate(row.at) || row.at}
            </p>
          </div>
          {row.detail ? (
            <p className="mt-1 break-words text-xs text-fg-muted" dir="auto">
              {row.detail}
            </p>
          ) : null}
          {row.href?.type === "warranty" ? (
            <Link
              to="/app/warranties/$warrantyId"
              params={{ warrantyId: row.href.id }}
              className="mt-1 inline-block text-xs font-medium hover:underline"
            >
              {he.siteWarrantyLabel}
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
