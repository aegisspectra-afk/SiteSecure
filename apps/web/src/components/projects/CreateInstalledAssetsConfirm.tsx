import type { CreateInstalledAssetsPreviewOut } from "@site-secure/api-client";
import { Button, Modal } from "@site-secure/ui";
import { he } from "../../i18n/he";

export function CreateInstalledAssetsConfirm({
  open,
  onClose,
  onConfirm,
  pending,
  preview,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pending?: boolean;
  preview: CreateInstalledAssetsPreviewOut | null;
  error?: string | null;
}) {
  const lines = (preview?.lines ?? []).filter((l) => (l.remaining ?? 0) > 0);
  const total = preview?.total_to_create ?? 0;
  const alreadyDone = Boolean(preview?.fully_materialized) && total === 0;

  return (
    <Modal open={open} onClose={onClose} title={he.projectCreateInstalledAssetsTitle}>
      <div className="flex flex-col gap-4" data-testid="create-installed-assets-confirm">
        {alreadyDone ? (
          <p className="text-sm text-fg">{he.projectCreateInstalledAssetsAlready}</p>
        ) : (
          <>
            <p className="text-sm text-fg-muted">{he.projectCreateInstalledAssetsIntro}</p>
            <ul className="flex flex-col gap-1.5 text-sm text-fg">
              {lines.map((line) => (
                <li key={line.planned_item_id} className="flex items-baseline justify-between gap-3">
                  <span>
                    <span className="ltr-meta tabular-nums" dir="ltr">
                      {line.remaining} ×
                    </span>{" "}
                    {line.label}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-sm font-medium text-fg">{he.projectCreateInstalledAssetsTotal(total)}</p>
            <p className="text-xs text-fg-muted">{he.projectCreateInstalledAssetsLaborNote}</p>
          </>
        )}
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            {he.projectCreateInstalledAssetsCancel}
          </Button>
          {!alreadyDone ? (
            <Button
              type="button"
              onClick={onConfirm}
              disabled={pending || total <= 0}
              data-testid="create-installed-assets-submit"
            >
              {pending ? "…" : he.projectCreateInstalledAssetsConfirm}
            </Button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
