import { ApiClientError } from "@site-secure/api-client";
import { he } from "../i18n/he";

/** Hebrew names for request fields that show up in API validation errors. */
const FIELD_LABELS_HE: Record<string, string> = {
  equipment_intent: "כוונת ציוד",
  cable_distance_meters: "אורך כבל",
  cableDistanceMeters: "אורך כבל",
  quantity: "כמות",
  role_key: "סוג רכיב",
  label: "שם רכיב",
  candidates: "מוצרים מוצעים",
  technical_requirements: "דרישות טכניות",
  selection_origin: "מקור הבחירה",
  reason_codes: "סיבות",
  requirements: "דרישות",
  engineering_result: "תוצאת החישוב",
  recommendation_meta: "המלצה",
  lifecycle_status: "סטטוס",
  revision: "גרסה",
  camera_count: "מספר מצלמות",
  retention_days: "ימי הקלטה",
  resolution_mp: "רזולוציה",
};

type ValidationIssue = { loc?: unknown[]; msg?: string };

/** "equipment_intent" at body.components.0.equipment_intent -> "כוונת ציוד (רכיב 1)". */
export function validationFieldLabel(loc: unknown[] | undefined): string | null {
  if (!Array.isArray(loc) || loc.length === 0) return null;
  const path = loc.filter((part) => part !== "body");
  const field = [...path].reverse().find((part) => typeof part === "string") as string | undefined;
  if (!field) return null;
  const label = FIELD_LABELS_HE[field] ?? field;
  const componentIndex = path.indexOf("components");
  const index = componentIndex >= 0 ? path[componentIndex + 1] : undefined;
  return typeof index === "number" ? he.apiFieldInComponent(label, index + 1) : label;
}

/**
 * The API message, plus the field that failed when the API says which one.
 * Non-validation errors keep their own message; anything else gets the fallback.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiClientError)) return fallback;
  const base = err.message || fallback;
  if (err.code !== "VALIDATION_ERROR") return base;
  const issues = (err.details?.errors as ValidationIssue[] | undefined) ?? [];
  const labels = [...new Set(issues.map((issue) => validationFieldLabel(issue.loc)).filter(Boolean))] as string[];
  if (!labels.length) return base;
  return he.apiValidationWithField(base, labels.slice(0, 3).join(", "));
}
