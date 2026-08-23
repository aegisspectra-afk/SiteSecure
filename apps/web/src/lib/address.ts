/** Structured address stored in customers.billing_address and sites.address (jsonb). */

export type StructuredAddress = {
  street?: string;
  house_number?: string;
  city?: string;
  postal_code?: string;
  apartment?: string;
  floor?: string;
  entrance?: string;
  notes?: string;
  /** Legacy freeform single line */
  line?: string;
  formatted?: string;
};

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseAddress(raw?: Record<string, unknown> | null): StructuredAddress {
  if (!raw || typeof raw !== "object") return {};
  return {
    street: str(raw.street) || undefined,
    house_number: str(raw.house_number) || undefined,
    city: str(raw.city) || undefined,
    postal_code: str(raw.postal_code) || undefined,
    apartment: str(raw.apartment) || undefined,
    floor: str(raw.floor) || undefined,
    entrance: str(raw.entrance) || undefined,
    notes: str(raw.notes) || undefined,
    line: str(raw.line) || undefined,
    formatted: str(raw.formatted) || undefined,
  };
}

export function addressFromForm(fields: StructuredAddress): Record<string, string> | undefined {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    const v = typeof value === "string" ? value.trim() : "";
    if (v) cleaned[key] = v;
  }
  return Object.keys(cleaned).length ? cleaned : undefined;
}

export function hasAddress(raw?: Record<string, unknown> | null): boolean {
  return formatAddressLines(raw).length > 0;
}

/** Multi-line display blocks (no empty rows). */
export function formatAddressLines(raw?: Record<string, unknown> | null): string[] {
  const a = parseAddress(raw);
  const lines: string[] = [];

  const streetPart = [a.street, a.house_number].filter(Boolean).join(" ").trim();
  if (streetPart) lines.push(streetPart);
  else if (a.line) lines.push(a.line);
  else if (a.formatted) lines.push(a.formatted);

  if (a.city) {
    const cityLine = a.postal_code ? `${a.city} ${a.postal_code}` : a.city;
    lines.push(cityLine);
  }

  const extras: string[] = [];
  if (a.apartment) extras.push(`דירה ${a.apartment}`);
  if (a.floor) extras.push(`קומה ${a.floor}`);
  if (a.entrance) extras.push(`כניסה ${a.entrance}`);
  if (extras.length) lines.push(extras.join(" · "));

  if (a.notes) lines.push(a.notes);

  return lines;
}

/** Single-line for chips, cards, search, maps. */
export function formatAddressLine(raw?: Record<string, unknown> | null): string {
  const lines = formatAddressLines(raw);
  if (lines.length) return lines.join(", ");
  return "";
}

export function mapsSearchUrl(raw?: Record<string, unknown> | null): string | null {
  const query = formatAddressLine(raw);
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function addressSearchBlob(raw?: Record<string, unknown> | null): string {
  return formatAddressLines(raw).join(" ").toLowerCase();
}
