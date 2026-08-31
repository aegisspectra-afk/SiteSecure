import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { he } from "../../../i18n/he";

export type QuoteMobileAddAction = "item" | "system" | "section" | "buildSystem";

export function QuoteMobileAddMenu({
  open,
  onClose,
  onPick,
  canEdit,
  canCatalog,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (action: QuoteMobileAddAction) => void;
  canEdit: boolean;
  canCatalog: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted || typeof document === "undefined" || !canEdit) return null;

  const items: Array<{ id: QuoteMobileAddAction; label: string; show: boolean }> = [
    { id: "item", label: he.cpqMobileAddItem, show: true },
    { id: "system", label: he.cpqMobileAddSystem, show: true },
    { id: "section", label: he.cpqMobileAddSection, show: true },
    { id: "buildSystem", label: he.cpqBuildSystem, show: canCatalog },
  ];

  return createPortal(
    <div className="cpq-mobile-add-root" role="presentation">
      <button type="button" className="cpq-mobile-add-backdrop" aria-label={he.cpqMobileAddMenuClose} onClick={onClose} />
      <div className="cpq-mobile-add-menu" role="menu" aria-label={he.cpqMobileAddMenuAria}>
        {items
          .filter((item) => item.show)
          .map((item) => (
            <AddMenuItem key={item.id} onClick={() => onPick(item.id)}>
              {item.label}
            </AddMenuItem>
          ))}
      </div>
    </div>,
    document.body,
  );
}

function AddMenuItem({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" className="cpq-mobile-add-item" onClick={onClick}>
      {children}
    </button>
  );
}
