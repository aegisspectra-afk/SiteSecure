import { Link, Navigate, createFileRoute } from "@tanstack/react-router";
import type { PortalHome } from "@site-secure/api-client";
import type { ReactNode } from "react";
import { PortalShell } from "../../components/portal/PortalShell";
import { he } from "../../i18n/he";
import { usePortalContext } from "../../lib/use-portal-context";

export const Route = createFileRoute("/portal/")({
  component: PortalHomePage,
  head: () => ({
    meta: [{ name: "robots", content: "noindex,nofollow" }],
  }),
});

function PortalHomePage() {
  const ctx = usePortalContext();
  if (!ctx.authed) return <Navigate to="/portal/login" />;
  if (ctx.sessionQuery.isLoading || ctx.homeQuery.isLoading) {
    return <p className="p-6 text-sm text-fg-muted">{he.loading}</p>;
  }
  if (!ctx.sessionQuery.isLoading && ctx.grants.length === 0) {
    return <p className="p-6 text-sm text-fg">{he.portalEmpty}</p>;
  }
  const home = ctx.home;
  if (!home || !ctx.accessId) return <p className="p-6 text-sm text-fg-muted">{he.loading}</p>;

  return (
    <PortalShell
      title={home.customer_name || he.portalAccessTitle}
      brand={home.installer_brand || undefined}
      onSignOut={ctx.signOut}
    >
      {ctx.grants.length > 1 ? (
        <label className="text-sm text-fg">
          {he.portalSwitchCustomer}
          <select
            className="mt-1 block w-full rounded-[var(--radius-control)] border border-border bg-bg px-3 py-2"
            value={ctx.accessId}
            onChange={(event) => ctx.setSelected(event.target.value)}
          >
            {ctx.grants.map((grant) => (
              <option key={grant.access_id} value={grant.access_id}>
                {grant.customer_name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <PortalSummary home={home} accessId={ctx.accessId} api={ctx.api} />
    </PortalShell>
  );
}

function PortalSummary({
  home,
  accessId,
  api,
}: {
  home: PortalHome;
  accessId: string;
  api: ReturnType<typeof usePortalContext>["api"];
}) {
  const pendingQuotes = home.quotes.filter((q) => q.status === "sent" || q.status === "viewed").length;
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[var(--radius-card)] border border-border bg-bg p-4">
        <h2 className="text-sm font-semibold text-fg">{he.portalNavHome}</h2>
        <p className="mt-2 text-sm text-fg-muted">{he.portalOtpLead}</p>
        <ul className="mt-3 space-y-1 text-sm text-fg">
          {pendingQuotes > 0 ? <li>{he.portalBuildQuotesAmount(pendingQuotes)} ממתינות לאישור</li> : null}
          {home.warranties.length > 0 ? <li>{he.portalBuildWarrantiesAmount(home.warranties.length)}</li> : null}
          {home.installations[0] ? <li>{home.installations[0].title}</li> : null}
        </ul>
        <Link to="/portal/service" className="mt-3 inline-block text-sm text-action underline">
          {he.portalNavServiceForm}
        </Link>
      </section>
      <Section title={he.portalSectionSites}>
        {home.sites.length === 0 ? (
          <Empty />
        ) : (
          home.sites.map((site) => (
            <Link key={site.id} to="/portal/sites/$siteId" params={{ siteId: site.id }} className="block text-action underline">
              {site.name}
            </Link>
          ))
        )}
      </Section>
      <Section title={he.portalSectionDocuments}>
        {home.documents.length === 0 ? (
          <Empty />
        ) : (
          home.documents.map((doc) => (
            <p key={doc.id}>
              <button
                type="button"
                className="text-action underline"
                onClick={() => {
                  void api.getPortalDocumentUrl(accessId, doc.id).then((result) => {
                    window.open(result.url, "_blank", "noopener,noreferrer");
                  });
                }}
              >
                {doc.filename || he.portalOpenDocument}
              </button>
            </p>
          ))
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-bg p-4">
      <h2 className="mb-2 text-sm font-semibold text-fg">{title}</h2>
      <div className="space-y-1 text-sm text-fg-muted">{children}</div>
    </section>
  );
}

function Empty() {
  return <p className="text-sm text-fg-muted">—</p>;
}