import type { SspFormField } from "@site-secure/api-client";
import { Input, Textarea } from "@site-secure/ui";

export function FormFillFields({
  fields,
  answers,
  onChange,
  disabled,
}: {
  fields: SspFormField[];
  answers: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {fields.map((field) => (
        <div key={field.id} className="flex flex-col gap-1 rounded-lg border border-border p-3">
          {field.help_text ? <p className="text-xs text-fg-muted">{field.help_text}</p> : null}
          {field.type === "consent" ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={answers[field.id] === true || answers[field.id] === "true"}
                disabled={disabled}
                onChange={(e) => onChange(field.id, e.target.checked)}
              />
              {field.consent_wording || field.label}
              {field.required ? " *" : ""}
            </label>
          ) : field.type === "long_text" || field.type === "notes" ? (
            <Textarea
              id={`ans-${field.id}`}
              label={`${field.label}${field.required ? " *" : ""}`}
              value={String(answers[field.id] ?? "")}
              onChange={(e) => onChange(field.id, e.target.value)}
              rows={3}
              disabled={disabled}
            />
          ) : field.type === "yes_no" ? (
            <label className="flex flex-col gap-1 text-sm">
              <span>
                {field.label}
                {field.required ? " *" : ""}
              </span>
              <select
                id={`ans-${field.id}`}
                className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
                value={String(answers[field.id] ?? "")}
                onChange={(e) => onChange(field.id, e.target.value)}
                aria-label={field.label}
                disabled={disabled}
              >
                <option value="">—</option>
                <option value="yes">כן</option>
                <option value="no">לא</option>
              </select>
            </label>
          ) : field.type === "single_choice" ? (
            <label className="flex flex-col gap-1 text-sm">
              <span>
                {field.label}
                {field.required ? " *" : ""}
              </span>
              <select
                id={`ans-${field.id}`}
                className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
                value={String(answers[field.id] ?? "")}
                onChange={(e) => onChange(field.id, e.target.value)}
                aria-label={field.label}
                disabled={disabled}
              >
                <option value="">—</option>
                {(field.options ?? []).map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          ) : field.type === "multi_choice" ? (
            <fieldset className="flex flex-col gap-1 text-sm">
              <legend>
                {field.label}
                {field.required ? " *" : ""}
              </legend>
              {(field.options ?? []).map((opt) => {
                const selected = Array.isArray(answers[field.id])
                  ? (answers[field.id] as string[])
                  : [];
                return (
                  <label key={opt.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(opt.id)}
                      disabled={disabled}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...selected, opt.id]
                          : selected.filter((id) => id !== opt.id);
                        onChange(field.id, next);
                      }}
                    />
                    {opt.label}
                  </label>
                );
              })}
            </fieldset>
          ) : (
            <Input
              id={`ans-${field.id}`}
              label={`${field.label}${field.required ? " *" : ""}`}
              type={
                field.type === "number"
                  ? "number"
                  : field.type === "date"
                    ? "date"
                    : field.type === "time"
                      ? "time"
                      : "text"
              }
              value={String(answers[field.id] ?? "")}
              onChange={(e) => onChange(field.id, e.target.value)}
              disabled={disabled}
            />
          )}
        </div>
      ))}
    </div>
  );
}
