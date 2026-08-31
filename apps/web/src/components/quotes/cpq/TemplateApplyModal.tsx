import type { QuoteTemplate } from "@site-secure/api-client";
import { Button, Modal } from "@site-secure/ui";
import { FileStack, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { he } from "../../../i18n/he";

export function TemplateApplyModal({
  open,
  onClose,
  templates,
  loading,
  error,
  applyingId,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  templates: QuoteTemplate[];
  loading?: boolean;
  error?: string | null;
  applyingId?: string | null;
  onApply: (templateId: string) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((row) => {
      const hay = `${row.name_he} ${row.key || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [templates, query]);

  return (
    <Modal
      open={open}
      onClose={() => {
        if (applyingId) return;
        onClose();
      }}
      title={he.cpqApplyProposalTemplateTitle}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-fg-muted">{he.cpqApplyProposalTemplateBody}</p>
        <div className="cpq-quick-add-search">
          <Search className="size-4 text-fg-muted" aria-hidden />
          <input
            value={query}
            onChange={(ev) => setQuery(ev.target.value)}
            placeholder={he.cpqApplyProposalTemplateSearch}
            className="cpq-quick-add-input"
            autoComplete="off"
          />
        </div>
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        {loading ? (
          <p className="text-sm text-fg-muted">{he.loading}</p>
        ) : null}
        <ul className="cpq-system-picker-list max-h-[min(420px,50vh)] overflow-y-auto" role="list">
          {!loading && !filtered.length ? (
            <li className="px-1 py-6 text-center text-sm text-fg-muted">{he.cpqApplyProposalTemplateEmpty}</li>
          ) : null}
          {filtered.map((row) => {
            const busy = applyingId === row.id;
            const anyBusy = Boolean(applyingId);
            return (
              <li key={row.id} className="cpq-system-picker-row">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="cpq-quick-add-icon shrink-0" aria-hidden>
                    <FileStack className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-fg">{row.name_he}</p>
                    {row.item_count != null ? (
                      <p className="mt-0.5 text-xs text-fg-muted">{he.cpqSystemItemCount(row.item_count)}</p>
                    ) : null}
                  </div>
                </div>
                <Button
                  type="button"
                  className="shrink-0 min-h-9 px-3 text-sm"
                  loading={busy}
                  disabled={anyBusy && !busy}
                  onClick={() => onApply(row.id)}
                >
                  {he.quoteApplyTemplate}
                </Button>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
