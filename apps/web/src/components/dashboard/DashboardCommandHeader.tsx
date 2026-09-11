import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { he } from "../../i18n/he";
import { dayGreeting } from "../../lib/greeting";
import { DashboardCreateMenu } from "./DashboardCreateMenu";

function formatOpsDateHeader(now = new Date()): string {
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
}

function openCommandPalette() {
  window.dispatchEvent(new CustomEvent("site-secure:open-command-palette"));
}

export function DashboardCommandHeader({
  displayName,
  roleKey,
  features,
  attentionCount = 0,
  showCreate = true,
  secondaryAction,
}: {
  displayName?: string | null;
  roleKey?: string;
  features?: string[];
  attentionCount?: number;
  showCreate?: boolean;
  secondaryAction?: ReactNode;
}) {
  const greeting = dayGreeting();
  const name = displayName?.trim() || null;
  const statusLabel =
    attentionCount > 0 ? he.commandHeaderAttention(attentionCount) : he.dashStatusQuiet;

  return (
    <header className="ops-cmd-header">
      <div className="ops-cmd-header-main min-w-0">
        <p className="ops-cmd-eyebrow">{he.opsOverviewKicker}</p>
        <h1 className="ops-cmd-hello">
          <span className="ops-cmd-hello-text">{greeting}</span>
          {name ? <span className="ops-cmd-hello-name">, {name}</span> : null}
        </h1>
        <p className="ops-cmd-date">{formatOpsDateHeader()}</p>
        <p className={`ops-cmd-status${attentionCount > 0 ? " is-attention" : ""}`} role="status">
          {statusLabel}
        </p>
      </div>

      <div className="ops-cmd-header-tools">
        <button type="button" className="ops-cmd-search" onClick={openCommandPalette}>
          <span className="ops-cmd-search-label">{he.dashSearchPlaceholder}</span>
          <kbd className="ops-cmd-search-kbd ltr-meta" dir="ltr">
            Ctrl K
          </kbd>
        </button>
        <div className="ops-cmd-header-actions">
          {showCreate ? <DashboardCreateMenu roleKey={roleKey} features={features ?? []} /> : null}
          {secondaryAction}
          <Link to="/app/today" className="ops-cmd-secondary-link">
            {he.todayViewAll}
          </Link>
        </div>
      </div>

      {showCreate ? (
        <div className="ops-cmd-mobile-actions" aria-label={he.dashQuickActionsAria}>
          <button type="button" className="ops-cmd-search is-mobile" onClick={openCommandPalette}>
            <span className="ops-cmd-search-label">{he.dashSearchPlaceholder}</span>
          </button>
          <DashboardCreateMenu roleKey={roleKey} features={features ?? []} />
        </div>
      ) : (
        <div className="ops-cmd-mobile-actions" aria-label={he.dashQuickActionsAria}>
          <button type="button" className="ops-cmd-search is-mobile" onClick={openCommandPalette}>
            <span className="ops-cmd-search-label">{he.dashSearchPlaceholder}</span>
          </button>
        </div>
      )}
    </header>
  );
}
