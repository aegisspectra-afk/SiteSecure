import { he } from "../i18n/he";

/**
 * Pick a quote section name for an applied System (quote_package).
 * First apply uses the system name; repeat applies use "(2)", "(3)" …
 * so separate installations are not merged into one section.
 */
export function resolveSystemSectionName(
  systemName: string,
  existingSections: Array<{ name?: string | null }>,
): string {
  const base = systemName.trim() || he.cpqSectionUntitled;
  const names = new Set(
    existingSections.map((section) => (section.name || "").trim()).filter(Boolean),
  );
  if (!names.has(base)) return base;
  let suffix = 2;
  while (names.has(`${base} (${suffix})`)) suffix += 1;
  return `${base} (${suffix})`;
}
