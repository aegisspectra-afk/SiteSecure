import { Button, Select } from "@site-secure/ui";
import { he } from "../../../i18n/he";

export type TemplateOption = {
  id: string;
  name_he: string;
};

export function TemplateFastPath({
  templates,
  selectedId,
  onSelect,
  onApply,
  applying = false,
  disabled = false,
}: {
  templates: TemplateOption[];
  selectedId: string;
  onSelect: (templateId: string) => void;
  onApply: (templateId: string) => void;
  applying?: boolean;
  disabled?: boolean;
}) {
  if (!templates.length) return null;

  return (
    <section
      className="cpq-template-fast-path ops-card ops-card-priority p-5"
      aria-labelledby="template-fast-path-heading"
    >
      <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.quoteStartFromTemplateKicker}</p>
      <h2 id="template-fast-path-heading" className="mt-1 text-base font-semibold text-fg">
        {he.quoteStartFromTemplate}
      </h2>
      <p className="mt-2 text-sm text-fg-muted">{he.quoteStartFromTemplateBody}</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Select
            id="template-fast-path-select"
            label={he.quoteTemplate}
            value={selectedId}
            disabled={disabled || applying}
            onChange={(ev) => onSelect(ev.target.value)}
          >
            {templates.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name_he}
              </option>
            ))}
          </Select>
        </div>
        <Button
          type="button"
          disabled={disabled || applying || !selectedId}
          loading={applying}
          onClick={() => onApply(selectedId)}
          className="min-h-11 shrink-0"
        >
          {he.quoteApplyTemplate}
        </Button>
      </div>
    </section>
  );
}
