import { Archive, FileUp, Pencil, Trash2, UserPlus, Wrench, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { he } from "../../i18n/he";

export type CustomerMenuAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  tone?: "default" | "danger";
  group: "customer" | "operations" | "lifecycle";
};

export function CustomerActionMenu({
  actions,
}: {
  actions: CustomerMenuAction[];
}) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const groups = [
    { key: "customer" as const, items: actions.filter((a) => a.group === "customer") },
    { key: "operations" as const, items: actions.filter((a) => a.group === "operations") },
    { key: "lifecycle" as const, items: actions.filter((a) => a.group === "lifecycle") },
  ].filter((g) => g.items.length > 0);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const id = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) closeMenu(true);
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
      }
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !visible) return;
    const items = menuItems();
    items[0]?.focus();
  }, [open, visible]);

  function menuItems() {
    return [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitem']") ?? [])];
  }

  function closeMenu(restoreFocus: boolean) {
    setOpen(false);
    setVisible(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  function select(action: CustomerMenuAction) {
    closeMenu(true);
    action.onSelect();
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = menuItems();
    if (!items.length) return;
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(index + 1 + items.length) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
    }
  }

  if (!actions.length) return null;

  return (
    <div className="customer-action-menu" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="customer-action-menu-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        aria-label={he.customer360More}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="customer-action-menu-dots" aria-hidden>
          •••
        </span>
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={he.customer360More}
          className={`customer-action-menu-panel${visible ? " is-open" : ""}`}
          onKeyDown={onMenuKeyDown}
        >
          {groups.map((group, groupIndex) => (
            <div key={group.key} className="customer-action-menu-group" role="group">
              {groupIndex > 0 ? <div className="customer-action-menu-sep" role="separator" /> : null}
              {group.items.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    type="button"
                    role="menuitem"
                    className={`customer-action-menu-item${action.tone === "danger" ? " is-danger" : ""}`}
                    onClick={() => select(action)}
                  >
                    <Icon className="customer-action-menu-icon" strokeWidth={1.75} aria-hidden />
                    <span>{action.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const customerMenuIcons = {
  edit: Pencil,
  contact: UserPlus,
  upload: FileUp,
  service: Wrench,
  archive: Archive,
  delete: Trash2,
} as const;
