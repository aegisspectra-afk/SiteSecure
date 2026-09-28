import { ApiClientError } from "@site-secure/api-client";
import { Button, PageHeader } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { useSession } from "../../lib/session";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

const QUICK_ACTIONS = [
  {
    to: "/admin/organizations" as const,
    titleKey: "adminQuickOrgTitle" as const,
    bodyKey: "adminQuickOrgBody" as const,
    ctaKey: "adminQuickOrgCta" as const,
    primary: true,
  },
  {
    to: "/admin/invitations" as const,
    titleKey: "adminQuickInviteTitle" as const,
    bodyKey: "adminQuickInviteBody" as const,
    ctaKey: "adminQuickInviteCta" as const,
    primary: true,
  },
  {
    to: "/admin/users" as const,
    titleKey: "adminQuickUsersTitle" as const,
    bodyKey: "adminQuickUsersBody" as const,
    ctaKey: "adminQuickUsersCta" as const,
    primary: false,
  },
  {
    to: "/admin/feedback" as const,
    titleKey: "adminQuickFeedbackTitle" as const,
    bodyKey: "adminQuickFeedbackBody" as const,
    ctaKey: "adminQuickFeedbackCta" as const,
    primary: false,
  },
];

function AdminHome() {
  const { api, session } = useSession();
  const query = useQuery({ queryKey: ["admin-summary"], queryFn: () => api.adminSummary() });
  const data = query.data;
  const errorMessage =
    query.error instanceof ApiClientError ? query.error.message : query.isError ? he.adminSummaryError : null;

  return (
    <div className="admin-home flex flex-col gap-8">
      <section className="admin-hero">
        <PageHeader title={he.adminTitle} description={he.adminLead} />
        <p className="admin-hero-note">{he.adminHomeWelcome(session?.email)}</p>
      </section>

      {query.isLoading ? <p className="text-sm text-fg-muted">{he.adminSummaryLoading}</p> : null}
      {errorMessage ? (
        <div className="ops-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm text-danger">{errorMessage}</p>
          <Button type="button" variant="secondary" onClick={() => void query.refetch()}>
            {he.retry}
          </Button>
        </div>
      ) : null}

      <section aria-label={he.adminSummarySection}>
        <h2 className="admin-section-title">{he.adminSummarySection}</h2>
        <div className="admin-stat-grid">
          <Stat label={he.adminOrgs} value={data?.organizations} loading={query.isLoading} hint={he.adminStatOrgsHint} />
          <Stat label={he.adminBeta} value={data?.beta_organizations} loading={query.isLoading} hint={he.adminStatBetaHint} accent />
          <Stat label={he.adminUsers} value={data?.users} loading={query.isLoading} hint={he.adminStatUsersHint} />
          <Stat
            label={he.adminOpenFeedback}
            value={data?.feedback_open}
            loading={query.isLoading}
            hint={he.adminStatFeedbackHint}
            accent={Boolean(data?.feedback_open)}
          />
        </div>
      </section>

      <section aria-label={he.adminQuickSection}>
        <h2 className="admin-section-title">{he.adminQuickSection}</h2>
        <p className="mb-4 text-sm text-fg-muted">{he.adminQuickLead}</p>
        <div className="admin-quick-grid">
          {QUICK_ACTIONS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={item.primary ? "admin-quick-card admin-quick-card-primary" : "admin-quick-card"}
            >
              <p className="admin-quick-title">{he[item.titleKey]}</p>
              <p className="admin-quick-body">{he[item.bodyKey]}</p>
              <span className="admin-quick-cta">{he[item.ctaKey]}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="admin-flow-card">
        <h2 className="admin-section-title">{he.adminFlowTitle}</h2>
        <ol className="admin-flow-steps">
          <li>{he.adminFlowStep1}</li>
          <li>{he.adminFlowStep2}</li>
          <li>{he.adminFlowStep3}</li>
          <li>{he.adminFlowStep4}</li>
        </ol>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  loading,
  hint,
  accent,
}: {
  label: string;
  value?: number;
  loading?: boolean;
  hint: string;
  accent?: boolean;
}) {
  let display: string;
  if (loading && value === undefined) display = "…";
  else if (value === undefined) display = "—";
  else display = String(value);

  return (
    <div className={accent ? "admin-stat admin-stat-accent" : "admin-stat"}>
      <p className="admin-stat-label">{label}</p>
      <p className="admin-stat-value ltr-meta" dir="ltr">
        {display}
      </p>
      <p className="admin-stat-hint">{hint}</p>
    </div>
  );
}
