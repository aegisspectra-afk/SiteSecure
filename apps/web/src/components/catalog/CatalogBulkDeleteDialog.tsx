import { Button, Modal } from "@site-secure/ui";
import { he } from "../../i18n/he";

export type BulkDeletePhase = "confirm" | "running" | "done";

type Props = {
  open: boolean;
  phase: BulkDeletePhase;
  count: number;
  done: number;
  total: number;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function CatalogBulkDeleteDialog({
  open,
  phase,
  count,
  done,
  total,
  error,
  onClose,
  onConfirm,
}: Props) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const busy = phase === "running";

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={phase === "done" ? he.catalogBulkDeleteDone : he.catalogBulkDeleteTitle}
    >
      {phase === "confirm" ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fg">
            {he.catalogBulkDeleteConfirm.replace("{count}", String(count))}
          </p>
          <div className="catalog-bulk-delete-warn" role="note">
            {he.catalogBulkSelected.replace("{count}", String(count))}
          </div>
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              {he.catalogBulkDeleteNo}
            </Button>
            <Button variant="danger" onClick={onConfirm}>
              {he.catalogBulkDeleteYes}
            </Button>
          </div>
        </div>
      ) : null}

      {phase === "running" || phase === "done" ? (
        <div className="catalog-bulk-delete-progress" role="status" aria-live="polite">
          <div className="catalog-bulk-delete-ring-wrap" aria-hidden>
            <div
              className={`catalog-bulk-delete-ring ${phase === "running" ? "is-spinning" : "is-done"}`}
              style={{ ["--bulk-pct" as string]: `${pct}` }}
            />
            <span className="catalog-bulk-delete-ring-pct">{pct}%</span>
          </div>
          <div className="catalog-bulk-delete-copy">
            <p className="catalog-bulk-delete-heading">
              {phase === "running" ? he.catalogBulkDeleteWorking : he.catalogBulkDeleteDone}
            </p>
            <p className="catalog-bulk-delete-count">
              {he.catalogBulkDeleteProgress
                .replace("{done}", String(done))
                .replace("{total}", String(total))}
            </p>
            <div
              className="catalog-bulk-delete-bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={done}
            >
              <div className="catalog-bulk-delete-bar-fill" style={{ width: `${Math.max(pct, 4)}%` }} />
            </div>
          </div>
          {phase === "done" ? (
            <div className="flex justify-end">
              <Button onClick={onClose}>{he.catalogImportClose}</Button>
            </div>
          ) : null}
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
