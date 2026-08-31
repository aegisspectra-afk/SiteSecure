import type { QuoteOut } from "@site-secure/api-client";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { he } from "../../../i18n/he";
import { formatDay } from "../../../lib/quotes";

export function QuoteLifecycleBanner({
  quote,
  linkedProject,
  canCreateProject,
}: {
  quote: QuoteOut;
  linkedProject: { name?: string | null } | null;
  canCreateProject: boolean;
}) {
  if (quote.status === "approved") {
    const approvedName = (quote as QuoteOut & { approved_name?: string | null }).approved_name;
    return (
      <section className="cpq-lifecycle-banner is-approved" aria-label={he.cpqLifecycleApprovedTitle}>
        <div className="cpq-lifecycle-banner-icon" aria-hidden>
          <CheckCircle2 className="size-5" />
        </div>
        <div className="cpq-lifecycle-banner-body">
          <p className="cpq-lifecycle-banner-title">{he.cpqLifecycleApprovedTitle}</p>
          <ul className="cpq-lifecycle-banner-meta">
            {quote.approved_at ? (
              <li>
                {he.cpqLifecycleApprovedAt}: <span className="ltr-meta">{formatDay(quote.approved_at)}</span>
              </li>
            ) : null}
            {approvedName ? <li>{he.cpqLifecycleApprovedBy(approvedName)}</li> : null}
            {quote.version ? <li>{he.cpqLifecycleApprovedVersion(quote.version)}</li> : null}
          </ul>
          {linkedProject ? (
            <p className="cpq-lifecycle-banner-hint">{he.cpqLifecycleProjectLinked(linkedProject.name)}</p>
          ) : !quote.site_id ? (
            <p className="cpq-lifecycle-banner-hint">{he.cpqSelectSiteBeforeProject}</p>
          ) : canCreateProject ? (
            <p className="cpq-lifecycle-banner-hint">{he.cpqLifecycleCreateProjectHint}</p>
          ) : null}
        </div>
      </section>
    );
  }

  if (quote.status === "rejected") {
    const reason = (quote as QuoteOut & { rejection_reason?: string | null }).rejection_reason;
    return (
      <section className="cpq-lifecycle-banner is-rejected" aria-label={he.cpqLifecycleRejectedTitle}>
        <div className="cpq-lifecycle-banner-icon" aria-hidden>
          <XCircle className="size-5" />
        </div>
        <div className="cpq-lifecycle-banner-body">
          <p className="cpq-lifecycle-banner-title">{he.cpqLifecycleRejectedTitle}</p>
          {quote.rejected_at ? (
            <p className="cpq-lifecycle-banner-meta">
              {he.cpqLifecycleRejectedAt}: <span className="ltr-meta">{formatDay(quote.rejected_at)}</span>
            </p>
          ) : null}
          {reason ? <p className="cpq-lifecycle-banner-hint">{reason}</p> : null}
          <p className="cpq-lifecycle-banner-hint">{he.cpqLifecycleRejectedNext}</p>
        </div>
      </section>
    );
  }

  if (quote.status === "sent" || quote.status === "viewed") {
    return (
      <section className="cpq-lifecycle-banner is-waiting" aria-label={he.cpqWaitingForApproval}>
        <div className="cpq-lifecycle-banner-icon" aria-hidden>
          <Clock className="size-5" />
        </div>
        <div className="cpq-lifecycle-banner-body">
          <p className="cpq-lifecycle-banner-title">
            {quote.status === "sent" ? he.cpqWaitingForApproval : he.cpqWaitingAfterView}
          </p>
          {quote.sent_at ? (
            <p className="cpq-lifecycle-banner-meta">
              {he.cpqLifecycleSentAt}: <span className="ltr-meta">{formatDay(quote.sent_at)}</span>
            </p>
          ) : null}
          {quote.viewed_at && quote.status === "viewed" ? (
            <p className="cpq-lifecycle-banner-meta">
              {he.cpqLifecycleViewedAt}: <span className="ltr-meta">{formatDay(quote.viewed_at)}</span>
            </p>
          ) : null}
          <p className="cpq-lifecycle-banner-hint">{he.cpqLifecycleWaitingHint}</p>
        </div>
      </section>
    );
  }

  return null;
}
