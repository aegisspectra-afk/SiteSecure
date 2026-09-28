import type { WarrantyOut } from "@site-secure/api-client";

export const WARRANTY_SUBJECTS = [
  { id: "product", label: "מוצר" },
  { id: "service", label: "שירות" },
  { id: "repair", label: "תיקון" },
  { id: "installation", label: "התקנה" },
  { id: "work", label: "עבודה שבוצעה" },
  { id: "order", label: "הזמנה" },
  { id: "other", label: "אחר" },
] as const;

export const WARRANTY_KINDS = [
  { id: "product", label: "מוצר", db: "manufacturer" },
  { id: "service", label: "שירות", db: "maintenance_contract" },
  { id: "repair", label: "תיקון", db: "installation" },
  { id: "installation", label: "התקנה", db: "installation" },
  { id: "custom", label: "מותאם אישית", db: "extended" },
] as const;

export const START_BASES = [
  { id: "purchase", label: "ממועד הרכישה" },
  { id: "delivery", label: "ממועד מסירת המוצר" },
  { id: "completion", label: "ממועד סיום העבודה" },
  { id: "manual", label: "תאריך ידני" },
] as const;

export const DURATION_PRESETS = [
  { id: "3m", label: "3 חודשים", value: 3, unit: "months" },
  { id: "6m", label: "6 חודשים", value: 6, unit: "months" },
  { id: "12m", label: "12 חודשים", value: 12, unit: "months" },
  { id: "24m", label: "24 חודשים", value: 24, unit: "months" },
] as const;

export const COVERAGE_OPTIONS = [
  { id: "manufacturing_defect", label: "פגם בייצור", clause: "פגם בייצור או בחומר" },
  { id: "normal_use", label: "תקלה במהלך שימוש רגיל", clause: "תקלה שנוצרה במהלך שימוש רגיל וסביר" },
  { id: "defective_part", label: "חלק פגום", clause: "חלק שהתגלה כפגום" },
  { id: "free_repair", label: "תיקון ללא עלות", clause: "תיקון ללא חיוב, בכפוף לתנאי מסמך זה" },
  { id: "spare_parts", label: "חלקי חילוף", clause: "חלקי חילוף הנדרשים לתיקון" },
  { id: "labor", label: "עלות עבודה", clause: "עלות העבודה של התיקון" },
  { id: "replacement", label: "החלפת המוצר במקרה שלא ניתן לתקן", clause: "החלפת המוצר או השירות כאשר לא ניתן לתקן" },
  { id: "shipping_to_repair", label: "משלוח לתיקון", clause: "העברה לצורך תיקון, לפי האמור בסעיף המשלוח" },
  { id: "extra_service", label: "שירות נוסף ללא עלות", clause: "שירות נוסף ללא חיוב, באותו היקף" },
] as const;

export const EXCLUSION_OPTIONS = [
  { id: "physical", label: "נזק פיזי", clause: "נזק פיזי" },
  { id: "breakage", label: "שבר", clause: "שבר" },
  { id: "drop", label: "נפילה", clause: "נזק שנגרם כתוצאה מנפילה, מכה או פגיעה פיזית" },
  { id: "water", label: "נזקי מים", clause: "נזקי מים, לחות או נוזלים" },
  { id: "wear", label: "בלאי טבעי", clause: "בלאי טבעי או שחיקה הנובעת משימוש לאורך זמן" },
  { id: "misuse", label: "שימוש לא נכון", clause: "שימוש לא נכון, רשלני או החורג מהייעוד" },
  { id: "third_party_repair", label: "תיקון שבוצע על ידי גורם אחר", clause: "תיקון, פירוק או טיפול שבוצע על ידי גורם שלא הוסמך לכך" },
  { id: "modification", label: "שינוי במוצר", clause: "שינוי, תוספת או התאמה שלא אושרו מראש" },
  { id: "off_instructions", label: "שימוש שלא לפי הוראות", clause: "שימוש שלא בהתאם להוראות היצרן או נותן השירות" },
  { id: "loss", label: "אובדן", clause: "אובדן" },
  { id: "theft", label: "גניבה", clause: "גניבה" },
  { id: "cosmetic", label: "נזק קוסמטי", clause: "נזק קוסמטי שאינו פוגע בפעולה התקינה" },
  { id: "third_party", label: "נזק שנגרם על ידי צד שלישי", clause: "נזק שנגרם על ידי צד שלישי" },
] as const;

export const REQUIREMENT_OPTIONS = [
  { id: "proof", label: "הוכחת רכישה", clause: "הוכחת רכישה" },
  { id: "order_number", label: "מספר הזמנה", clause: "מספר הזמנה" },
  { id: "certificate", label: "תעודת אחריות", clause: "תעודת אחריות זו" },
  { id: "photo", label: "תמונה של המוצר", clause: "תמונה של המוצר או העבודה" },
  { id: "video", label: "סרטון של התקלה", clause: "סרטון המתעד את התקלה" },
  { id: "serial", label: "מספר סידורי", clause: "מספר סידורי, ככל שקיים" },
  { id: "return_for_inspection", label: "החזרת המוצר לבדיקה", clause: "העמדת המוצר או הגישה אליו לבדיקה" },
] as const;

export const CONTACT_OPTIONS = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "phone", label: "טלפון" },
  { id: "email", label: "אימייל" },
  { id: "web_form", label: "טופס באתר" },
  { id: "visit", label: "הגעה פיזית לעסק" },
] as const;

export const RESOLUTION_OPTIONS = [
  { id: "repair", label: "תיקון" },
  { id: "replace", label: "החלפה" },
  { id: "credit", label: "זיכוי" },
  { id: "refund", label: "החזר כספי" },
] as const;

export const SHIPPING_OPTIONS = [
  { id: "business", label: "העסק" },
  { id: "customer", label: "הלקוח" },
  { id: "case", label: "תלוי במקרה" },
] as const;

export const TONE_OPTIONS = [
  { id: "simple", label: "פשוט וברור" },
  { id: "professional", label: "מקצועי" },
  { id: "formal", label: "רשמי ומפורט" },
] as const;

export const WARRANTY_DISCLAIMER =
  "חשוב לדעת: הנוסח נוצר על בסיס הפרטים והבחירות שהוזנו על ידכם. התוכן נועד לסייע בניסוח מסמך אחריות ואינו מהווה ייעוץ משפטי, חוות דעת משפטית או תחליף לבדיקה של עורך דין. ייתכן שיחולו על העסק, המוצר או השירות הוראות חוק נוספות שלא נכללו במסמך.";

export type WarrantyTone = (typeof TONE_OPTIONS)[number]["id"];
export type DurationUnit = "days" | "months" | "years";

export type WarrantySection = {
  id: string;
  heading: string;
  source: string;
  body: string;
};

export type WarrantyVersionEntry = {
  version: number;
  at: string;
  actor: string;
  summary: string;
};

export type WarrantyPolicy = {
  subject_kind: string;
  subject_label: string;
  subject_ref?: { kind: string; id: string } | null;
  warranty_kind: string;
  start_basis: string;
  duration_value: number;
  duration_unit: DurationUnit;
  coverage: string[];
  coverage_custom: string[];
  exclusions: string[];
  exclusions_custom: string[];
  requirements: string[];
  contact_methods: string[];
  contact_details: string;
  resolution: string[];
  transferable: boolean | null;
  valid_without_receipt: boolean | null;
  shipping: string | null;
  turnaround_days: number | null;
  additional_terms: string;
  tone: WarrantyTone;
  sections: WarrantySection[];
  disclaimer_accepted: boolean;
  versions: WarrantyVersionEntry[];
  sent_at?: string | null;
};

export type WarrantySuggestion = { id: string; text: string };

const EMPTY_POLICY: WarrantyPolicy = {
  subject_kind: "product",
  subject_label: "",
  subject_ref: null,
  warranty_kind: "product",
  start_basis: "manual",
  duration_value: 12,
  duration_unit: "months",
  coverage: [],
  coverage_custom: [],
  exclusions: [],
  exclusions_custom: [],
  requirements: [],
  contact_methods: [],
  contact_details: "",
  resolution: ["repair", "replace", "credit", "refund"],
  transferable: null,
  valid_without_receipt: null,
  shipping: null,
  turnaround_days: null,
  additional_terms: "",
  tone: "professional",
  sections: [],
  disclaimer_accepted: false,
  versions: [],
  sent_at: null,
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function readWarrantyPolicy(value: unknown): WarrantyPolicy | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Partial<WarrantyPolicy>;
  if (!raw.subject_kind && !raw.sections && !raw.warranty_kind && !raw.subject_label) return null;
  return {
    ...EMPTY_POLICY,
    ...raw,
    coverage: asStringArray(raw.coverage),
    coverage_custom: asStringArray(raw.coverage_custom),
    exclusions: asStringArray(raw.exclusions),
    exclusions_custom: asStringArray(raw.exclusions_custom),
    requirements: asStringArray(raw.requirements),
    contact_methods: asStringArray(raw.contact_methods),
    resolution: asStringArray(raw.resolution).length ? asStringArray(raw.resolution) : EMPTY_POLICY.resolution,
    sections: Array.isArray(raw.sections) ? raw.sections.filter((section) => section && typeof section.body === "string") : [],
    versions: Array.isArray(raw.versions) ? raw.versions : [],
    duration_value: Number(raw.duration_value) || 12,
    duration_unit: raw.duration_unit === "days" || raw.duration_unit === "years" ? raw.duration_unit : "months",
    tone: raw.tone === "simple" || raw.tone === "formal" ? raw.tone : "professional",
    disclaimer_accepted: Boolean(raw.disclaimer_accepted),
    transferable: raw.transferable === true || raw.transferable === false ? raw.transferable : null,
    valid_without_receipt:
      raw.valid_without_receipt === true || raw.valid_without_receipt === false ? raw.valid_without_receipt : null,
    turnaround_days: raw.turnaround_days == null ? null : Number(raw.turnaround_days) || null,
    shipping: typeof raw.shipping === "string" ? raw.shipping : null,
    subject_label: typeof raw.subject_label === "string" ? raw.subject_label : "",
    contact_details: typeof raw.contact_details === "string" ? raw.contact_details : "",
    additional_terms: typeof raw.additional_terms === "string" ? raw.additional_terms : "",
  };
}

export function emptyWarrantyPolicy(): WarrantyPolicy {
  return { ...EMPTY_POLICY, coverage: [], exclusions: [], resolution: [...EMPTY_POLICY.resolution], sections: [], versions: [] };
}

export function addDuration(start: string, value: number, unit: DurationUnit): string {
  const date = new Date(`${start}T00:00:00`);
  if (Number.isNaN(date.getTime()) || value <= 0) return start;
  if (unit === "days") date.setDate(date.getDate() + value);
  if (unit === "months") date.setMonth(date.getMonth() + value);
  if (unit === "years") date.setFullYear(date.getFullYear() + value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function daysRemaining(endsOn: string, today = new Date()): number {
  const end = new Date(`${endsOn}T00:00:00`);
  const current = new Date(today);
  current.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - current.getTime()) / 86_400_000);
}

export function deriveWarrantyStatus(
  startsOn: string,
  endsOn: string,
  today = new Date(),
): "active" | "expiring_soon" | "expired" {
  const start = new Date(`${startsOn}T00:00:00`);
  const end = new Date(`${endsOn}T00:00:00`);
  const current = new Date(today);
  current.setHours(0, 0, 0, 0);
  if (end < current) return "expired";
  const left = daysRemaining(endsOn, current);
  if (left <= 30 && start <= current) return "expiring_soon";
  if (left <= 30 && end >= current) return "expiring_soon";
  return "active";
}

export function effectiveWarrantyStatus(row: Pick<WarrantyOut, "status" | "starts_on" | "ends_on">, today = new Date()): string {
  if (row.status === "cancelled" || row.status === "draft") return row.status;
  if (!row.starts_on || !row.ends_on) return row.status;
  return deriveWarrantyStatus(row.starts_on, row.ends_on, today);
}

export function warrantyKindLabel(kind: string): string {
  return WARRANTY_KINDS.find((item) => item.id === kind)?.label ?? kind;
}

export function warrantyDbType(kind: string): string {
  return WARRANTY_KINDS.find((item) => item.id === kind)?.db ?? "installation";
}

function labelsFor(ids: string[], options: readonly { id: string; label: string }[], custom: string[] = []): string[] {
  const chosen = ids.map((id) => options.find((item) => item.id === id)?.label).filter((label): label is string => Boolean(label));
  return [...chosen, ...custom.map((item) => item.trim()).filter(Boolean)];
}

function clausesFor(ids: string[], options: readonly { id: string; clause: string }[], custom: string[] = []): string[] {
  const chosen = ids
    .map((id) => options.find((item) => item.id === id)?.clause)
    .filter((clause): clause is string => Boolean(clause));
  return [...chosen, ...custom.map((item) => item.trim()).filter(Boolean)];
}

function joinHebrew(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} ו${items[items.length - 1]}`;
}

function yesNo(value: boolean | null, yes: string, no: string): string | null {
  if (value === true) return yes;
  if (value === false) return no;
  return null;
}

export function warrantySuggestions(policy: WarrantyPolicy): WarrantySuggestion[] {
  const items: WarrantySuggestion[] = [];
  if (policy.coverage.length === 0 && policy.coverage_custom.length === 0) {
    items.push({ id: "coverage", text: "לא הוגדר מה האחריות כוללת." });
  }
  if (policy.exclusions.length === 0 && policy.exclusions_custom.length === 0) {
    items.push({ id: "exclusions", text: "לא הוגדרו חריגים. כדאי לציין מה אינו כלול." });
  }
  if (!policy.exclusions.includes("wear") && !policy.exclusions_custom.some((item) => item.includes("בלאי"))) {
    items.push({ id: "wear", text: "ייתכן שכדאי להוסיף סעיף לגבי בלאי טבעי." });
  }
  if (policy.requirements.length === 0) {
    items.push({ id: "requirements", text: "לא הוגדר מה הלקוח צריך להציג כדי לממש את האחריות." });
  }
  if (policy.contact_methods.length === 0) {
    items.push({ id: "contact", text: "לא הוגדרה דרך יצירת קשר למימוש האחריות." });
  }
  if (!policy.shipping) {
    items.push({ id: "shipping", text: "לא הוגדר מי נושא בעלות המשלוח במקרה של תיקון." });
  }
  if (!policy.turnaround_days) {
    items.push({ id: "turnaround", text: "לא הוגדר זמן טיפול באחריות." });
  }
  if (policy.transferable == null) {
    items.push({ id: "transfer", text: "לא הוגדר אם האחריות ניתנת להעברה לבעלים אחר." });
  }
  return items;
}

function styleParagraph(text: string, tone: WarrantyTone): string {
  if (!text.trim()) return "";
  if (tone === "simple") return text.replaceAll("בכפוף לתנאי מסמך זה", "לפי מה שנבחר כאן");
  if (tone === "formal") return `מובהר כי ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
  return text;
}

export function composeWarrantySections(input: {
  policy: WarrantyPolicy;
  customerName: string;
  businessName: string;
  startsOn: string;
  endsOn: string;
  number?: string;
}): WarrantySection[] {
  const { policy, customerName, businessName, startsOn, endsOn } = input;
  const subject = policy.subject_label.trim() || "הפריט שסומן";
  const kind = warrantyKindLabel(policy.warranty_kind);
  const basis = START_BASES.find((item) => item.id === policy.start_basis)?.label ?? "המועד שנקבע";
  const coverage = clausesFor(policy.coverage, COVERAGE_OPTIONS, policy.coverage_custom);
  const exclusions = clausesFor(policy.exclusions, EXCLUSION_OPTIONS, policy.exclusions_custom);
  const requirements = clausesFor(policy.requirements, REQUIREMENT_OPTIONS);
  const contacts = labelsFor(policy.contact_methods, CONTACT_OPTIONS);
  const resolution = labelsFor(policy.resolution, RESOLUTION_OPTIONS);
  const shipping = SHIPPING_OPTIONS.find((item) => item.id === policy.shipping)?.label;
  const tone = policy.tone;

  const opening = styleParagraph(
    `${businessName || "העסק"} מעניק בזאת ל${customerName || "הלקוח"} אחריות מסוג ${kind} עבור ${subject}. תקופת האחריות היא מיום ${formatDisplayDate(startsOn)} ועד יום ${formatDisplayDate(endsOn)}. תחילת האחריות נקבעה ${policy.start_basis === "manual" ? "ידנית" : basis}.`,
    tone,
  );

  const coverageBody = coverage.length
    ? styleParagraph(
        `במהלך תקופת האחריות, ובכפוף לתנאים ולחריגים במסמך זה, הכיסוי כולל ${joinHebrew(coverage)}.`,
        tone,
      )
    : "";

  const exclusionBody = exclusions.length
    ? styleParagraph(`האחריות לא תחול על ${joinHebrew(exclusions)}.`, tone)
    : "";

  const requirementBody = requirements.length
    ? styleParagraph(
        `לצורך בירור פנייה במסגרת האחריות יתבקש הלקוח להציג ${joinHebrew(requirements)}. העסק רשאי לבקש פרטים נוספים הדרושים לזיהוי הפנייה.`,
        tone,
      )
    : "";

  const contactBody = contacts.length
    ? styleParagraph(
        `ניתן לפנות למימוש האחריות באמצעות ${joinHebrew(contacts)}${policy.contact_details.trim() ? `. פרטי הקשר: ${policy.contact_details.trim()}` : ""}.`,
        tone,
      )
    : "";

  const resolutionBody = resolution.length
    ? styleParagraph(
        `במקרה של תקלה המכוסה באחריות, סדר הטיפול הוא: ${resolution.map((item, index) => `${index + 1}. ${item}`).join(" · ")}. המעבר לשלב הבא ייעשה כאשר השלב הקודם אינו ישים או אינו פותר את התקלה.`,
        tone,
      )
    : "";

  const extras: string[] = [];
  const transfer = yesNo(
    policy.transferable,
    "האחריות ניתנת להעברה לבעלים אחר, ובלבד שהתנאים במסמך זה ממשיכים לחול.",
    "האחריות אינה ניתנת להעברה לבעלים אחר.",
  );
  const receipt = yesNo(
    policy.valid_without_receipt,
    "ניתן לממש את האחריות גם ללא קבלה, אם ניתן לזהות את הרכישה או את העבודה באמצעי אחר שצוין במסמך.",
    "מימוש האחריות מותנה בהצגת קבלה או אסמכתה לרכישה או לביצוע העבודה.",
  );
  if (transfer) extras.push(transfer);
  if (receipt) extras.push(receipt);
  if (shipping) extras.push(`עלות המשלוח או ההעברה לצורך תיקון חלה על ${shipping}.`);
  if (policy.turnaround_days) extras.push(`זמן הטיפול המשוער הוא עד ${policy.turnaround_days} ימי עסקים ממועד קבלת הפנייה והפריטים הנדרשים לבדיקה.`);
  if (policy.additional_terms.trim()) extras.push(policy.additional_terms.trim());
  const extraBody = extras.length ? styleParagraph(extras.join(" "), tone) : "";

  const sections: WarrantySection[] = [
    {
      id: "opening",
      heading: "פרטי האחריות",
      source: [kind, subject, basis, `${startsOn} – ${endsOn}`].filter(Boolean).join(" · "),
      body: opening,
    },
    {
      id: "coverage",
      heading: "מה האחריות כוללת",
      source: labelsFor(policy.coverage, COVERAGE_OPTIONS, policy.coverage_custom).join(" · ") || "לא נבחר כיסוי",
      body: coverageBody,
    },
    {
      id: "exclusions",
      heading: "מה האחריות אינה כוללת",
      source: labelsFor(policy.exclusions, EXCLUSION_OPTIONS, policy.exclusions_custom).join(" · ") || "לא נבחרו חריגים",
      body: exclusionBody,
    },
    {
      id: "requirements",
      heading: "תנאים למימוש",
      source: labelsFor(policy.requirements, REQUIREMENT_OPTIONS).join(" · ") || "לא נבחרו דרישות",
      body: requirementBody,
    },
    {
      id: "contact",
      heading: "דרך יצירת קשר",
      source: [contacts.join(" · "), policy.contact_details.trim()].filter(Boolean).join(" · ") || "לא נבחרה דרך קשר",
      body: contactBody,
    },
    {
      id: "resolution",
      heading: "פתרון במקרה של תקלה",
      source: resolution.join(" ← ") || "לא הוגדר סדר טיפול",
      body: resolutionBody,
    },
    {
      id: "terms",
      heading: "תנאים נוספים",
      source: extras.join(" · ") || "לא הוגדרו תנאים נוספים",
      body: extraBody,
    },
  ];
  return sections.filter((section) => section.body.trim() || section.id === "opening");
}

export type RewriteMode = "professional" | "shorter" | "longer" | "clearer" | "formal" | "simple" | "custom";

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function rewriteWarrantySection(section: WarrantySection, mode: RewriteMode, note = ""): WarrantySection {
  const body = section.body.trim();
  if (mode === "shorter") {
    const parts = sentences(body);
    return { ...section, body: (parts.slice(0, 2).join(" ") || body).trim() };
  }
  if (mode === "longer") {
    return {
      ...section,
      body: `${body} האמור בסעיף זה כפוף ליתר תנאי המסמך, לרבות החריגים ודרישות המימוש.`.trim(),
    };
  }
  if (mode === "clearer") {
    return { ...section, body: body.replaceAll(";", ".").replaceAll(" · ", ". ") };
  }
  if (mode === "formal") {
    return { ...section, body: body.startsWith("מובהר") ? body : `מובהר בזאת: ${body}` };
  }
  if (mode === "simple") {
    return {
      ...section,
      body: body
        .replaceAll("בכפוף לתנאי מסמך זה", "לפי התנאים כאן")
        .replaceAll("מובהר כי ", "")
        .replaceAll("מובהר בזאת: ", ""),
    };
  }
  if (mode === "custom") {
    const extra = note.trim();
    if (!extra) return section;
    const sentence = /[.!?]$/.test(extra) ? extra : `${extra}.`;
    return { ...section, body: `${body}\n\n${sentence}`.trim() };
  }
  return { ...section, body };
}

export function formatDisplayDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
}

export function durationLabel(value: number, unit: DurationUnit): string {
  const unitLabel = unit === "days" ? "ימים" : unit === "years" ? "שנים" : "חודשים";
  return `${value} ${unitLabel}`;
}

export function appendWarrantyVersion(policy: WarrantyPolicy, summary: string, actor: string, at = new Date().toISOString()): WarrantyPolicy {
  const versions = [...policy.versions];
  versions.push({ version: versions.length + 1, at, actor, summary });
  return { ...policy, versions };
}

export function warrantyDocumentText(sections: WarrantySection[], number: string): string {
  const lines = [`אחריות ${number}`, ""];
  for (const section of sections) {
    if (!section.body.trim()) continue;
    lines.push(section.heading, section.body.trim(), "");
  }
  lines.push(WARRANTY_DISCLAIMER);
  return lines.join("\n");
}

export function expiryAttention(endsOn: string, today = new Date()): 30 | 14 | 7 | 1 | null {
  const left = daysRemaining(endsOn, today);
  if (left === 30 || (left <= 30 && left > 14)) return 30;
  if (left <= 14 && left > 7) return 14;
  if (left <= 7 && left > 1) return 7;
  if (left === 1 || left === 0) return 1;
  return null;
}
