import type { SspFormField } from "@site-secure/api-client";
import { Input, Textarea } from "@site-secure/ui";

export function SspFormFields({
  fields,
  answers,
  onChange,
  disabled,
}: {
  fields: SspFormField[];
  answers: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  disabled?: boolean;
}) {
  function setValue(id: string, value: unknown) {
    onChange({ ...answers, [id]: value });
  }

  return (
    <div className="flex flex-col gap-3">
      {fields.map((field) => {
        const value = answers[field.id];
        if (field.type === "heading") {
          return (
            <div key={field.id} className="pt-2">
              <p className="text-base font-semibold text-fg">{field.label}</p>
              {field.help_text ? <p className="text-sm text-fg-muted">{field.help_text}</p> : null}
            </div>
          );
        }
        if (field.type === "long_text" || field.type === "notes") {
          return (
            <div key={field.id} className="flex flex-col gap-1">
              <Textarea
                id={`fill-${field.id}`}
                label={`${field.label}${field.required ? " *" : ""}`}
                value={String(value ?? "")}
                onChange={(e) => setValue(field.id, e.target.value)}
                disabled={disabled}
                rows={4}
              />
              {field.help_text ? <p className="text-xs text-fg-muted">{field.help_text}</p> : null}
            </div>
          );
        }
        if (field.type === "yes_no" || field.type === "checkbox" || field.type === "consent") {
          return (
            <label key={field.id} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={value === true || value === "true"}
                onChange={(e) => setValue(field.id, e.target.checked)}
                disabled={disabled}
              />
              <span>
                {field.type === "consent" ? field.consent_wording || field.label : field.label}
                {field.required ? " *" : ""}
                {field.help_text ? <span className="mt-0.5 block text-xs text-fg-muted">{field.help_text}</span> : null}
              </span>
            </label>
          );
        }
        if (field.type === "single_choice") {
          return (
            <label key={field.id} className="flex flex-col gap-1 text-sm">
              <span>
                {field.label}
                {field.required ? " *" : ""}
              </span>
              {field.help_text ? <span className="text-xs text-fg-muted">{field.help_text}</span> : null}
              <select
                className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
                value={String(value ?? "")}
                onChange={(e) => setValue(field.id, e.target.value)}
                disabled={disabled}
                aria-label={field.label}
              >
                <option value="">—</option>
                {(field.options ?? []).map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          );
        }
        if (field.type === "multi_choice") {
          const selected = Array.isArray(value) ? value.map(String) : [];
          return (
            <fieldset key={field.id} className="flex flex-col gap-1 text-sm">
              <legend>
                {field.label}
                {field.required ? " *" : ""}
              </legend>
              {field.help_text ? <p className="text-xs text-fg-muted">{field.help_text}</p> : null}
              {(field.options ?? []).map((opt) => (
                <label key={opt.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(opt.id)}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...selected, opt.id]
                        : selected.filter((id) => id !== opt.id);
                      setValue(field.id, next);
                    }}
                  />
                  {opt.label}
                </label>
              ))}
            </fieldset>
          );
        }
        const inputType =
          field.type === "number"
            ? "number"
            : field.type === "date"
              ? "date"
              : field.type === "time"
                ? "time"
                : field.type === "datetime"
                  ? "datetime-local"
                  : "text";
        return (
          <div key={field.id} className="flex flex-col gap-1">
            <Input
              id={`fill-${field.id}`}
              label={`${field.label}${field.required ? " *" : ""}`}
              type={inputType}
              value={String(value ?? "")}
              onChange={(e) =>
                setValue(field.id, field.type === "number" && e.target.value !== "" ? Number(e.target.value) : e.target.value)
              }
              disabled={disabled}
            />
            {field.help_text ? <p className="text-xs text-fg-muted">{field.help_text}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
