import { ApiClientError } from "@site-secure/api-client";
import { Button } from "@site-secure/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, LayoutGrid, QrCode, Shield, Truck } from "lucide-react";
import { useState, type ComponentType } from "react";
import { he } from "../../i18n/he";
import { displayWorkspaceName } from "../../lib/quotes";
import { useSession } from "../../lib/session";

export const Route = createFileRoute("/platform/")({
  component: PlatformHomePage,
});

const PRODUCT_ICONS: Record<string, ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  site_secure: Shield,
  ssp: QrCode,
  fleet: Truck,
};

function productKey(product: { id: string; entry_path: string }): string {
  if (product.id === "ssp" || product.entry_path.startsWith("/app/ssp")) return "ssp";
  if (product.id === "fleet" || product.entry_path.startsWith("/app/fleet")) return "fleet";
  return "site_secure";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return letters || "•";
}

function PlatformHomePage() {
  const { session, api, switchWorkspace, signOut, refresh } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  const home = useQuery({
    queryKey: ["platform-home", session?.profile?.last_workspace_id, session?.memberships[0]?.workspace_id],
    queryFn: () => api.platformHome(),
    enabled: Boolean(session?.has_workspace),
    refetchOnWindowFocus: true,
  });

  const data = home.data;
  const displayName = data?.user.full_name?.trim() || session?.profile?.full_name?.trim() || session?.email || he.brand;
  const workspaces = data?.workspaces ?? [];
  const products = data?.products ?? [];
  const activeId = data?.active_workspace_id ?? session?.memberships[0]?.workspace_id ?? "";
  const activeWorkspace = workspaces.find((ws) => ws.id === activeId) ?? workspaces[0];
  const workspaceLabel = displayWorkspaceName(activeWorkspace?.name) || activeWorkspace?.name || "";
  const loadError =
    home.error instanceof ApiClientError ? home.error.message : home.isError ? he.platformHomeLoadFailed : null;

  async function onSwitchWorkspace(workspaceId: string) {
    if (!workspaceId || workspaceId === activeId || switching) return;
    setSwitching(true);
    setSwitchError(null);
    try {
      await switchWorkspace(workspaceId);
      await queryClient.invalidateQueries({ queryKey: ["platform-home"] });
      await home.refetch();
    } catch {
      setSwitchError(he.platformHomeSwitchFailed);
    } finally {
      setSwitching(false);
    }
  }

  function openProduct(entryPath: string) {
    if (entryPath === "/app/today") {
      void navigate({ to: "/app/today" });
      return;
    }
    if (entryPath === "/app/ssp") {
      void navigate({ to: "/app/ssp" });
      return;
    }
    if (entryPath === "/app/fleet") {
      void navigate({ to: "/app/fleet" });
      return;
    }
    void navigate({ to: "/app/dashboard" });
  }

  return (
    <div className="platform-home" data-testid="platform-home">
      <div className="platform-home-frame">
        <header className="platform-home-top">
          <div className="platform-home-start">
            <div className="platform-home-brand">
              <p className="platform-home-brand-mark">{he.platformHomeKicker}</p>
              <p className="platform-home-brand-kicker">{he.authPlatformLabel}</p>
            </div>
            {workspaces.length > 1 ? (
              <div className="platform-home-chip">
                <label htmlFor="platform-ws">{he.platformHomeWorkspace}</label>
                <select
                  id="platform-ws"
                  value={activeId}
                  disabled={switching || home.isFetching}
                  onChange={(ev) => void onSwitchWorkspace(ev.target.value)}
                >
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {displayWorkspaceName(ws.name) || ws.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : workspaceLabel ? (
              <div className="platform-home-chip">
                <label>{he.platformHomeWorkspace}</label>
                <span>{workspaceLabel}</span>
              </div>
            ) : null}
          </div>
          <div className="platform-home-meta">
            <div className="platform-home-user">
              <span className="platform-home-avatar" aria-hidden>
                {initials(displayName)}
              </span>
              <div className="platform-home-user-copy">
                <strong>{displayName}</strong>
                {session?.email ? <span className="ltr-meta">{session.email}</span> : null}
              </div>
            </div>
            <button type="button" className="platform-home-signout" onClick={() => void signOut()}>
              {he.signOut}
            </button>
          </div>
        </header>

        <div className="platform-home-intro">
          <h1>{he.platformHomeTitle}</h1>
          <p>{he.platformHomeLead}</p>
        </div>

        {switchError ? (
          <p className="text-sm text-danger" role="alert">
            {switchError}
          </p>
        ) : null}

        <section>
          <div className="platform-home-section-label">
            <h2>{he.platformHomeProductsTitle}</h2>
            <p>{he.platformHomeProductsLead}</p>
          </div>
          {home.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
          {loadError ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-danger" role="alert">
                {loadError}
              </p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  void refresh();
                  void home.refetch();
                }}
              >
                {he.retry}
              </Button>
            </div>
          ) : null}
          {!home.isLoading && !loadError && products.length === 0 ? (
            <div className="platform-home-empty">
              <p className="font-medium text-fg">{he.platformHomeEmptyTitle}</p>
              <p className="mt-2 text-sm text-fg-muted">{he.platformHomeEmptyBody}</p>
            </div>
          ) : null}
          <ul className="platform-home-grid">
            {products.map((product) => {
              const key = productKey(product);
              const Icon = PRODUCT_ICONS[key] ?? LayoutGrid;
              return (
                <li key={product.id}>
                  <button
                    type="button"
                    className="platform-product"
                    data-product={key}
                    onClick={() => openProduct(product.entry_path)}
                  >
                    <span className="platform-product-icon">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="platform-product-title">{product.title}</span>
                    <span className="platform-product-desc">{product.description}</span>
                    <span className="platform-product-cta">
                      {he.platformHomeOpenProduct}
                      <ArrowLeft className="size-4" aria-hidden />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <footer className="platform-home-footer">
          {data?.links.account_settings ? (
            <Link to="/app/settings/profile" className="platform-home-link">
              {he.platformHomeAccountSettings}
            </Link>
          ) : null}
          {data?.links.workspace_settings ? (
            <Link to="/app/settings" className="platform-home-link">
              {he.platformHomeWorkspaceSettings}
            </Link>
          ) : null}
          {data?.links.platform_admin ? (
            <Link to="/admin" className="platform-home-link platform-home-link-admin">
              {he.platformHomeAdmin}
            </Link>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
