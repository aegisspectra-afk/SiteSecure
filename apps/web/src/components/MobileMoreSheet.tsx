import { ChevronLeft, LayoutDashboard, LogOut, Plus, Search, Settings, SquareArrowOutUpRight } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { cn } from "@site-secure/ui";
import { useMemo, useState } from "react";
import { he } from "../i18n/he";
import {
  isNavSelected,
  mobileCommandSections,
  mobileQuickActions,
  planLabel,
  type AppNavLink,
  type MobileCommandSection,
} from "../lib/app-nav";
import { MobileNavSheet } from "./MobileNavSheet";
import { NavIcon } from "./NavIcon";
import { BetaBadge } from "./BetaBadge";

function workspaceMetaLine(planKey?: string, active?: boolean): string {
  const plan = planLabel(planKey);
  const status = active === false ? he.workspaceMetaInactive : he.workspaceMetaActive;
  return [plan, status].filter(Boolean).join(" · ");
}

function filterSections(sections: MobileCommandSection[], q: string): MobileCommandSection[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return sections;
  return sections
    .map((section) => ({
      ...section,
      defaultOpen: true,
      items: section.items.filter(
        (item) => item.label.toLowerCase().includes(needle) || section.label.toLowerCase().includes(needle),
      ),
    }))
    .filter((section) => section.items.length > 0);
}

function CommandRow({
  item,
  pathname,
  onNavigate,
}: {
  item: AppNavLink;
  pathname: string;
  onNavigate: () => void;
}) {
  const selected = isNavSelected(item.to, pathname);
  return (
    <Link
      to={item.to}
      className={cn("mcc-row", selected && "is-active")}
      aria-current={selected ? "page" : undefined}
      onClick={onNavigate}
    >
      <span className="mcc-row-icon">
        <NavIcon name={item.icon} active={selected} className="size-5" />
      </span>
      <span className="mcc-row-label">{item.label}</span>
      <ChevronLeft className="mcc-row-chevron size-4" aria-hidden />
    </Link>
  );
}

function CommandSection({
  section,
  pathname,
  open,
  onToggle,
  onNavigate,
}: {
  section: MobileCommandSection;
  pathname: string;
  open: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  return (
    <section className="mcc-section">
      <button type="button" className="mcc-section-toggle" aria-expanded={open} onClick={onToggle}>
        <span>{section.label}</span>
        <ChevronDownIcon open={open} />
      </button>
      {open ? (
        <div className="mcc-section-body">
          {section.items.map((item) => (
            <CommandRow key={item.to} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={cn("size-4 text-fg-muted transition-transform duration-200", open && "rotate-180")}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MobileMoreSheet({
  open,
  onClose,
  pathname,
  roleKey,
  features,
  workspaceName,
  planKey,
  workspaceActive = true,
  displayName,
  email,
  canSettings,
  isBeta = false,
  isPlatformAdmin = false,
  onSettings,
  onAdmin,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  pathname: string;
  roleKey?: string;
  features?: string[];
  workspaceName?: string | null;
  planKey?: string;
  workspaceActive?: boolean;
  displayName: string;
  email?: string | null;
  canSettings: boolean;
  isBeta?: boolean;
  isPlatformAdmin?: boolean;
  onSettings: () => void;
  onAdmin?: () => void;
  onSignOut: () => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const sections = useMemo(() => mobileCommandSections(roleKey, features ?? []), [roleKey, features]);
  const quick = useMemo(() => mobileQuickActions(roleKey, features ?? []), [roleKey, features]);
  const filtered = useMemo(() => filterSections(sections, query), [sections, query]);
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});

  const meta = workspaceMetaLine(planKey, workspaceActive);
  const searching = query.trim().length > 0;

  const isSectionOpen = (section: MobileCommandSection) => {
    if (searching) return true;
    if (openIds[section.id] != null) return openIds[section.id];
    return section.defaultOpen;
  };

  const closeAndReset = () => {
    setQuery("");
    onClose();
  };

  return (
    <MobileNavSheet open={open} onClose={closeAndReset} title={he.navMoreSheetTitle} footer={
      <div className="mcc-account">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate text-sm font-semibold text-fg">
            <span className="truncate">{displayName}</span>
            {isBeta ? <BetaBadge /> : null}
          </p>
          {email ? <p className="mt-0.5 truncate text-xs text-fg-muted">{email}</p> : null}
        </div>
        <div className="flex shrink-0 gap-1">
          {canSettings ? (
            <button
              type="button"
              className="mcc-account-icon"
              aria-label={he.navAccountSettings}
              onClick={() => {
                onSettings();
                closeAndReset();
              }}
            >
              <Settings className="size-4" aria-hidden />
            </button>
          ) : null}
          {isPlatformAdmin && onAdmin ? (
            <button
              type="button"
              className="mcc-account-icon"
              aria-label={he.adminNav}
              onClick={() => {
                onAdmin();
                closeAndReset();
              }}
            >
              <LayoutDashboard className="size-4" aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            className="mcc-account-icon"
            aria-label={he.signOut}
            onClick={() => {
              onSignOut();
              closeAndReset();
            }}
          >
            <LogOut className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    }>
      <div className="mcc">
        <label className="mcc-search">
          <Search className="size-4 shrink-0 text-fg-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={he.navSearchPlaceholder}
            aria-label={he.navSearchHint}
            autoComplete="off"
            data-autofocus
          />
        </label>
        <p className="mcc-search-hint">{he.navSearchHint}</p>

        {workspaceName ? (
          <div className="mcc-workspace" aria-label={`${he.navWorkspace}: ${workspaceName}`}>
            <span className="min-w-0 flex-1 text-start">
              <span className="block truncate text-sm font-semibold text-fg">{workspaceName}</span>
              {meta ? <span className="mt-0.5 block truncate text-xs text-fg-muted">{meta}</span> : null}
            </span>
            <ChevronLeft className="size-4 shrink-0 text-fg-muted" aria-hidden />
          </div>
        ) : null}

        {quick.length > 0 && !searching ? (
          <div className="mcc-quick" role="group" aria-label={he.quickActionsTitle}>
            {quick.map((action) => (
              <button
                key={action.id}
                type="button"
                className="mcc-quick-tile"
                onClick={() => {
                  try {
                    if (action.id === "lead") {
                      sessionStorage.setItem("site-secure-open-new-lead", "1");
                    }
                  } catch {
                    /* ignore */
                  }
                  void navigate({ to: action.to });
                  closeAndReset();
                }}
              >
                <span className="mcc-quick-plus" aria-hidden>
                  <Plus className="size-4" />
                </span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        ) : null}

        <nav aria-label={he.navMore} className="mcc-nav">
          {filtered.length === 0 ? (
            <p className="mcc-empty">{he.navCommandEmpty}</p>
          ) : (
            filtered.map((section) => (
              <CommandSection
                key={section.id}
                section={section}
                pathname={pathname}
                open={isSectionOpen(section)}
                onToggle={() =>
                  setOpenIds((prev) => ({
                    ...prev,
                    [section.id]: !isSectionOpen(section),
                  }))
                }
                onNavigate={closeAndReset}
              />
            ))
          )}

          {!searching ? (
            <section className="mcc-section">
              <p className="mcc-section-label">{he.navResources}</p>
              <Link to="/" className="mcc-row" onClick={closeAndReset}>
                <span className="mcc-row-icon">
                  <SquareArrowOutUpRight className="size-5" aria-hidden />
                </span>
                <span className="mcc-row-label">{he.navAegis}</span>
                <ChevronLeft className="mcc-row-chevron size-4" aria-hidden />
              </Link>
            </section>
          ) : null}
        </nav>
      </div>
    </MobileNavSheet>
  );
}
