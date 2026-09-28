import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { he } from "../../i18n/he";
import { NewQuoteButton } from "../quotes/NewQuoteButton";
import { buildCreateActions } from "./DashboardCreateMenu";

/** Visible secondary tools before "More" overflow. */
const VISIBLE_TOOL_COUNT = 4;

/**
 * DASH-6 — one primary Quote CTA + quiet secondary tools + More overflow.
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
  const quote = actions.find((a) => a.quote);
  const tools = actions.filter((a) => !a.quote && a.href);
  const visible = tools.slice(0, VISIBLE_TOOL_COUNT);
  const overflow = tools.slice(VISIBLE_TOOL_COUNT);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreId = useId();
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (event: MouseEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  if (!quote && visible.length === 0 && overflow.length === 0) {
    return null;
  }

  return (
    <nav
      className="ops-qa is-premium is-dash6"
      aria-label={he.dashQuickActionsAria}
      data-testid="dash-quick-actions"
    >
      {quote ? (
        <NewQuoteButton className="ops-qa-primary is-quote-cta quote-new-btn">
          {he.newQuoteAction}
        </NewQuoteButton>
      ) : null}

      {visible.length > 0 || overflow.length > 0 ? (
        <div className="ops-qa-tools" aria-label={he.dashQuickToolsAria}>
          {visible.map((action) => (
            <Link
              key={action.key}
              to={action.href!}
              className="ops-qa-tool"
              data-qa-key={action.key}
              data-testid={`dash-qa-${action.key}`}
            >
              {action.label}
            </Link>
          ))}

          {overflow.length > 0 ? (
            <div className="ops-qa-more" ref={moreRef}>
              <button
                type="button"
                className="ops-qa-tool is-more"
                aria-label={he.dashQuickMoreAria}
                aria-expanded={moreOpen}
                aria-controls={moreId}
                onClick={() => setMoreOpen((v) => !v)}
              >
                <span>{he.navMore}</span>
                <ChevronDown className="size-3.5 opacity-70" strokeWidth={1.75} aria-hidden />
              </button>
              {moreOpen ? (
                <ul id={moreId} className="ops-qa-more-panel" role="menu">
                  <li className="ops-qa-more-heading" role="presentation">
                    {he.dashQuickMoreHeading}
                  </li>
                  {overflow.map((action) => (
                    <li key={action.key} role="none">
                      <Link
                        to={action.href!}
                        role="menuitem"
                        className="ops-qa-more-item"
                        data-qa-key={action.key}
                        data-testid={`dash-qa-${action.key}`}
                        onClick={() => setMoreOpen(false)}
                      >
                        {action.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}
