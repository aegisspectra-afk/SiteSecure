import { Link } from "@tanstack/react-router";
import {
  Briefcase,
  Building2,
  ChevronDown,
  FileText,
  UserPlus,
  UserRoundSearch,
  type LucideIcon,
} from "lucide-react";
import { useId, useState } from "react";
import { he } from "../../i18n/he";
import { NewQuoteButton } from "../quotes/NewQuoteButton";
import { buildCreateActions, type CreateMenuAction } from "./DashboardCreateMenu";

const ACTION_ICONS: Record<string, LucideIcon> = {
  quote: FileText,
  customer: UserPlus,
  site: Building2,
  lead: UserRoundSearch,
  job: Briefcase,
};

/** Dashboard-priority create keys; remaining go under "More". */
const PRIMARY_CREATE_KEYS = ["quote", "customer", "job"] as const;

function ActionFace({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <>
      <span className="ops-qa-tile-icon">
        <Icon strokeWidth={1.75} aria-hidden />
      </span>
      <span className="ops-qa-tile-label">{label}</span>
    </>
  );
}

function CreateActionControl({ action }: { action: CreateMenuAction }) {
  const Icon = ACTION_ICONS[action.key] ?? FileText;
  if (action.quote) {
    return (
      <NewQuoteButton className="ops-qa-tile is-quote" variant="primary">
        {action.label}
      </NewQuoteButton>
    );
  }
  return (
    <Link to={action.href!} className="ops-qa-tile">
      <ActionFace icon={Icon} label={action.label} />
    </Link>
  );
}

/**
 * High-value create actions only.
 * Search → AppShell Ctrl/Cmd+K. Today → Today section “view all” + bottom nav.
 */
export function DashboardQuickActions({
  roleKey,
  features,
  showCreate,
}: {
  roleKey?: string;
  features: string[];
  showCreate: boolean;
}) {
  const actions = showCreate ? buildCreateActions(roleKey, features) : [];
  const primary = actions.filter((a) => (PRIMARY_CREATE_KEYS as readonly string[]).includes(a.key));
  const secondary = actions.filter((a) => !(PRIMARY_CREATE_KEYS as readonly string[]).includes(a.key));
  const [moreOpen, setMoreOpen] = useState(false);
  const moreId = useId();

  const visibleCreates = primary.slice(0, 3);
  const overflowCreates = [...primary.slice(3), ...secondary];

  if (!showCreate && overflowCreates.length === 0 && visibleCreates.length === 0) {
    return null;
  }

  return (
    <nav className="ops-qa" aria-label={he.dashQuickActionsAria}>
      {visibleCreates.map((action) => (
        <CreateActionControl key={action.key} action={action} />
      ))}

      {overflowCreates.length > 0 ? (
        <div className="ops-qa-more">
          <button
            type="button"
            className="ops-qa-tile"
            aria-expanded={moreOpen}
            aria-controls={moreId}
            onClick={() => setMoreOpen((v) => !v)}
          >
            <ActionFace icon={ChevronDown} label={he.navMore} />
          </button>
          {moreOpen ? (
            <ul id={moreId} className="ops-qa-more-panel" role="menu">
              {overflowCreates.map((action) => (
                <li key={action.key} role="none">
                  {action.quote ? (
                    <div role="menuitem" className="ops-qa-more-item">
                      <NewQuoteButton className="ops-qa-more-quote" variant="link">
                        {action.label}
                      </NewQuoteButton>
                    </div>
                  ) : (
                    <Link
                      to={action.href!}
                      role="menuitem"
                      className="ops-qa-more-item"
                      onClick={() => setMoreOpen(false)}
                    >
                      {action.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}
