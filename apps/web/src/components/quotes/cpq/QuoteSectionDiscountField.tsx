import type { QuoteSection } from "@site-secure/api-client";
import { Button, Input, Select } from "@site-secure/ui";
import { useEffect, useState } from "react";
import { he } from "../../../i18n/he";

/** Compact section-discount editor — server remains authoritative via patchQuoteSection. */
export function QuoteSectionDiscountField({
  section,
  canEdit,
  onPersist,
}: {
  section: QuoteSection;
  canEdit: boolean;
  onPersist: (body: { discount_type: string; discount_value: number }) => void;
}) {
  const serverType = section.discount_type === "percent" ? "percent" : "amount";
  const serverValue = Number(section.discount_value ?? 0);
  const [discountType, setDiscountType] = useState<"percent" | "amount">(serverType);
  const [value, setValue] = useState(serverValue > 0 ? String(serverValue) : "");

  useEffect(() => {
    setDiscountType(section.discount_type === "percent" ? "percent" : "amount");
    const next = Number(section.discount_value ?? 0);
    setValue(next > 0 ? String(next) : "");
  }, [section.id, section.discount_type, section.discount_value]);

  if (!canEdit) {
    if (!(serverValue > 0)) return null;
    const label =
      serverType === "percent" ? `${serverValue}%` : `₪${serverValue.toLocaleString("he-IL")}`;
    return <p className="text-xs text-fg-muted">{he.cpqSectionDiscountActive(label)}</p>;
  }

  function apply() {
    const n = Number(value);
    onPersist({
      discount_type: discountType,
      discount_value: Number.isFinite(n) && n > 0 ? n : 0,
    });
  }

  function clear() {
    setValue("");
    onPersist({ discount_type: discountType, discount_value: 0 });
  }

  const activeLabel =
    serverValue > 0
      ? serverType === "percent"
        ? `${serverValue}%`
        : `₪${serverValue.toLocaleString("he-IL")}`
      : null;

  return (
    <div className="cpq-section-discount" role="group" aria-label={he.cpqSectionDiscount}>
      <p className="text-xs text-fg-muted">{he.cpqSectionDiscountHint}</p>
      {activeLabel ? <p className="text-xs font-medium text-fg">{he.cpqSectionDiscountActive(activeLabel)}</p> : null}
      <div className="flex flex-wrap items-end gap-2">
        <Select
          id={`section-discount-type-${section.id}`}
          label={he.quoteDiscountType}
          value={discountType}
          onChange={(ev) => setDiscountType(ev.target.value === "percent" ? "percent" : "amount")}
        >
          <option value="percent">{he.quoteDiscountPercent}</option>
          <option value="amount">{he.quoteDiscountAmount}</option>
        </Select>
        <Input
          id={`section-discount-value-${section.id}`}
          label={discountType === "percent" ? he.quoteDiscountPercentLabel : he.quoteDiscountAmountIls}
          type="text"
          inputMode="decimal"
          className="ltr-meta"
          value={value}
          onChange={(ev) => setValue(ev.target.value)}
        />
        <Button type="button" variant="secondary" onClick={apply}>
          {he.cpqSectionDiscountApply}
        </Button>
        {serverValue > 0 ? (
          <Button type="button" variant="ghost" onClick={clear}>
            {he.cpqSectionDiscountClear}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
