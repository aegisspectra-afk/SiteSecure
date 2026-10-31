import { he } from "../i18n/he";

/** Hebrew labels for persisted audit.action values. Unknown keys stay Hebrew, never raw English. */
const ACTION_HE: Record<string, string> = {
  "quotes.send": "שליחת הצעת מחיר",
  "quotes.revise": "יצירת גרסה להצעת מחיר",
  "quotes.share_link": "יצירת קישור להצעת מחיר",
  "quotes.revoke_link": "ביטול קישור להצעת מחיר",
  "quotes.delete": "מחיקת הצעת מחיר",
  "quotes.duplicate": "שכפול הצעת מחיר",
  "quotes.price_override": "חריגת מחיר בשורת הצעה",
  "quotes.save_template": "שמירת תבנית הצעה",
  "quotes.margin_override": "חריגת מרווח בהצעה",
  "projects.create_from_quote": "יצירת פרויקט מהצעה",
  "equipment.updated": "עדכון ציוד",
  "equipment.create_from_plan": "יצירת ציוד מתוכנית",
  "service_calls.create_job": "יצירת עבודה מקריאת שירות",
  "workspace.create": "יצירת סביבת עבודה",
  "workspace.edit": "עריכת סביבת עבודה",
  "users.invite": "הזמנת משתמש",
};

const RESULT_HE: Record<string, string> = {
  success: "הצליחה",
  denied: "נדחתה",
  revoked: "בוטלה",
  deleted: "נמחקה",
};

export function auditActionLabel(action: string | null | undefined): string {
  const key = (action ?? "").trim();
  if (!key) return he.auditActionUnknown;
  return ACTION_HE[key] ?? he.auditActionUnknown;
}

export function auditResultLabel(result: unknown): string {
  if (typeof result !== "string" || !result.trim()) return "—";
  const key = result.trim().toLowerCase();
  return RESULT_HE[key] ?? he.auditResultOther;
}
