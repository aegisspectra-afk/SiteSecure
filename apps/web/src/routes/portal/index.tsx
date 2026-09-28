import { Button } from "@site-secure/ui";
import type { PortalHome } from "@site-secure/api-client";
import { useQuery } from "@tanstack/react-query";
import { Navigate, createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { he } from "../../i18n/he";
import { guestEntryPath } from "../../lib/auth-routes";
import { useSession } from "../../lib/session";

export const Route = createFileRoute("/portal/")({
  component: PortalHomePage,
});

function PortalHomePage() {
  const { loading, user, api, signOut } = useSession();
  const sessionQuery = useQuery({
    queryKey: ["portal-session"],
    enabled: Boolean(user),
    queryFn: () => api.getPortalSession(),
  });
  const grants = sessionQuery.data?.grants ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const accessId = selected ?? grants[0]?.access_id ?? null;
  const homeQuery = useQuery({
    queryKey: ["portal-home", accessId],
    enabled: Boolean(user && accessId),
    queryFn: () => api.getPortalHome(accessId!),
  });
  if (loading) return <p className="p-6 text-sm text-fg-muted">{he.loading}</p>;
  if (!user) return <Navigate to={guestEntryPath()} />;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.14em] text-fg-muted">SITE SECURE</p>
          <h1 className="text-xl font-semibold text-fg">{homeQuery.data?.customer_name || he.portalAccessTitle}</h1>
        </div>
        <Button type="button" variant="secondary" onClick={() => void signOut()}>
          {he.portalSignOut}
        </Button>
      </header>

      {grants.length > 1 ? (
        <label className="text-sm text-fg">
          {he.portalSwitchCustomer}
          <select
            className="mt-1 block w-full rounded-[var(--radius-control)] border border-border bg-bg px-3 py-2"
            value={accessId ?? ""}
            onChange={(event) => setSelected(event.target.value)}
          >
            {grants.map((grant) => (
              <option key={grant.access_id} value={grant.access_id}>
                {grant.customer_name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {sessionQuery.isLoading || homeQuery.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
      {!sessionQuery.isLoading && grants.length === 0 ? <p className="text-sm text-fg">{he.portalEmpty}</p> : null}
      {homeQuery.data ? <PortalSections home={homeQuery.data} accessId={accessId!} /> : null}
    </main>
  );
}

function PortalSections({ home, accessId }: { home: PortalHome; accessId: string }) {
  const { api } = useSession();
  return (
    <div className="flex flex-col gap-4">
      <Section title={he.portalSectionProfile}>
        <p>{home.profile.display_name}</p>
        <p dir="ltr">{home.profile.email}</p>
        {home.profile.phone ? <p dir="ltr">{home.profile.phone}</p> : null}
      </Section>
      <Section title={he.portalSectionSites}>
        {home.sites.length === 0 ? <Empty /> : home.sites.map((site) => (
          <p key={site.id}>
            {site.name} · {site.installation_status}
          </p>
        ))}
      </Section>
      <Section title={he.portalSectionInstallations}>
        {home.installations.length === 0 ? <Empty /> : home.installations.map((job) => (
          <p key={job.id}>
            {job.number} · {job.title}
          </p>
        ))}
      </Section>
      <Section title={he.portalSectionEquipment}>
        {home.equipment.length === 0 ? <Empty /> : home.equipment.map((item) => (
          <p key={item.id}>
            {item.name}
            {item.serial ? ` · ${item.serial}` : ""}
          </p>
        ))}
      </Section>
      <Section title={he.portalSectionWarranties}>
        {home.warranties.length === 0 ? <Empty /> : home.warranties.map((item) => (
          <p key={item.id}>
            {item.number} · {item.status}
          </p>
        ))}
      </Section>
      <Section title={he.portalSectionQuotes}>
        {home.quotes.length === 0 ? <Empty /> : home.quotes.map((item) => (
          <p key={item.id}>
            {item.number} · {item.status}
          </p>
        ))}
      </Section>
      <Section title={he.portalSectionService}>
        {home.service.length === 0 ? <Empty /> : home.service.map((item) => (
          <p key={item.id}>{item.title}</p>
        ))}
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
  return <p>{he.portalEmpty}</p>;
}
