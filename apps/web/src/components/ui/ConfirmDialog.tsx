import { Button, Modal } from "@site-secure/ui";
import { he } from "../../i18n/he";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** System confirm sheet — replaces window.confirm (Hebrew RTL). */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = he.confirm,
  cancelLabel = he.cancel,
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <div className="flex flex-col gap-4" data-testid="system-confirm-dialog" dir="rtl">
        <p className="text-sm text-fg">{body}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={danger ? "danger" : "primary"}
            disabled={busy}
            data-testid="system-confirm-accept"
            onClick={onConfirm}
          >
            {busy ? he.saving : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
