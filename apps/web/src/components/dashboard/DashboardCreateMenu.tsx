import { Link } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";
import { he } from "../../i18n/he";
import { can } from "../../lib/can";
import { hasFeature } from "../../lib/home";
import { NewQuoteButton } from "../quotes/NewQuoteButton";

export type CreateMenuAction = {
  key: string;
  label: string;
  href?: string;
  quote?: boolean;
};

export function buildCreateActions(
  roleKey: string | undefined,
  features: string[],
): CreateMenuAction[] {
  const out: CreateMenuAction[] = [];
  if (can(roleKey, "quotes.create", features) && hasFeature(features, "quotes")) {
    out.push({ key: "quote", label: he.dashCreateQuote, quote: true });
  }
  if (can(roleKey, "crm.create", features) && hasFeature(features, "crm")) {
    out.push({ key: "customer", label: he.dashCreateCustomer, href: "/app/customers" });
  }
  if (can(roleKey, "sites.create", features)) {
    out.push({ key: "site", label: he.dashCreateSite, href: "/app/sites" });
  }
  if (can(roleKey, "leads.create", features)) {
    out.push({ key: "lead", label: he.dashCreateLead, href: "/app/leads" });
  }
  if (can(roleKey, "jobs.create", features)) {
    out.push({ key: "job", label: he.dashCreateJob, href: "/app/today" });
  }
  return out;
}

export function DashboardCreateMenu({
  roleKey,
  features,
}: {
  roleKey: string | undefined;
  features: string[];
}) {
  const actions = buildCreateActions(roleKey, features);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!actions.length) return null;

  if (actions.length === 1 && actions[0].quote) {
    return <NewQuoteButton />;
  }

  return (
    <div className="ops-create-menu" ref={rootRef}>
      <button
        type="button"
        className="ops-create-trigger"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden>+ </span>
        {he.dashCreate}
      </button>
      {open ? (
        <ul id={menuId} className="ops-create-panel" role="menu">
          {actions.map((action) => (
            <li key={action.key} role="none">
              {action.quote ? (
                <div className="ops-create-quote-wrap" role="menuitem">
                  <NewQuoteButton className="ops-create-quote-btn" />
                </div>
              ) : (
                <Link
                  to={action.href!}
                  role="menuitem"
                  className="ops-create-item"
                  onClick={() => setOpen(false)}
                >
                  {action.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
