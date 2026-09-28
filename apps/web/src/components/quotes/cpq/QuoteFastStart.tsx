/**
 * Compact operational fast-start for scoped empty quotes.
 * Not marketing cards — one row of actions.
 */
import { Boxes, Camera, FileStack, Package, Plus } from "lucide-react";
import { he } from "../../../i18n/he";

export type QuoteFastStartAction =
  | "cctv"
  | "catalog"
  | "package"
  | "template"
  | "free";

export function QuoteFastStart({
  onAction,
  canCatalog,
  canCctv,
}: {
  onAction: (action: QuoteFastStartAction) => void;
  canCatalog: boolean;
  canCctv: boolean;
}) {
  const actions: Array<{
    id: QuoteFastStartAction;
    label: string;
    hint: string;
    show: boolean;
    icon: typeof Package;
  }> = [
    {
      id: "cctv",
      label: he.cpqFastStartCctv,
      hint: he.cpqFastStartCctvHint,
      show: canCctv,
      icon: Camera,
    },
    {
      id: "catalog",
      label: he.cpqFastStartCatalog,
      hint: he.cpqFastStartCatalogHint,
      show: canCatalog,
      icon: Package,
    },
    {
      id: "package",
      label: he.cpqFastStartPackage,
      hint: he.cpqFastStartPackageHint,
      show: canCatalog,
      icon: Boxes,
    },
    {
      id: "template",
      label: he.cpqFastStartTemplate,
      hint: he.cpqFastStartTemplateHint,
      show: canCatalog,
      icon: FileStack,
    },
    {
      id: "free",
      label: he.cpqFastStartFree,
      hint: he.cpqFastStartFreeHint,
      show: true,
      icon: Plus,
    },
  ];

  const visible = actions.filter((a) => a.show);
  if (!visible.length) return null;

  return (
    <section className="cpq-fast-start" aria-label={he.cpqFastStartAria} data-testid="quote-fast-start">
      <div className="cpq-fast-start-head">
        <h2 className="cpq-fast-start-title">{he.cpqFastStartTitle}</h2>
        <p className="cpq-fast-start-lead">{he.cpqFastStartLead}</p>
      </div>
      <div className="cpq-fast-start-grid" role="group">
        {visible.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              className="cpq-fast-start-action"
              onClick={() => onAction(action.id)}
            >
              <span className="cpq-fast-start-icon" aria-hidden>
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1 text-start">
                <span className="block text-sm font-semibold text-fg">{action.label}</span>
                <span className="block text-[11px] leading-snug text-fg-muted">{action.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
