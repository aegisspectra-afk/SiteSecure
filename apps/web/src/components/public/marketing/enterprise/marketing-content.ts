/** Honest module catalog — only ship claims that match product reality. */

export type ModuleStatus = "live" | "partial" | "planned";

export type MarketingModule = {
  key: string;
  title: string;
  body: string;
  status: ModuleStatus;
  href?: string;
};

export const MARKETING_MODULES: MarketingModule[] = [
  { key: "crm", title: "CRM ולידים", body: "ניהול לידים ולקוחות במקום אחד.", status: "live", href: "/product#crm" },
  { key: "customers", title: "ניהול לקוחות", body: "כרטיס לקוח, אתרים והיסטוריה תפעולית.", status: "live", href: "/product#customers" },
  { key: "projects", title: "פרויקטים והתקנות", body: "מפרויקט מאושר לעבודות שטח.", status: "live", href: "/product#projects" },
  { key: "service", title: "קריאות שירות", body: "מעקב שירות ואחריות לפי אתר.", status: "live", href: "/product#service" },
  { key: "quotes", title: "הצעות מחיר", body: "אשף CCTV, חלופות, PDF ושליחה ללקוח.", status: "live", href: "/pricing" },
  { key: "catalog", title: "קטלוג ציוד", body: "מוצרים, מק״טים ומחירים לסביבת העבודה.", status: "live", href: "/product#catalog" },
  { key: "inventory", title: "מלאי", body: "ניהול מלאי מתקדם — בהמשך הדרך.", status: "planned" },
  { key: "techs", title: "ניהול טכנאים", body: "שיבוץ, צ׳קליסט וחתימה בשטח (Business).", status: "live", href: "/solutions/technicians" },
  { key: "calendar", title: "יומן עבודה", body: "תצוגות לוח זמנים ושיבוץ צוות.", status: "partial", href: "/product#calendar" },
  { key: "maps", title: "מפות", body: "מיפוי אתרים על המפה — בהרחבה.", status: "planned" },
  { key: "docs", title: "מסמכים ותמונות", body: "צילומי סיור, מסמכי מסירה ותיק אתר.", status: "live", href: "/product#docs" },
  { key: "sign", title: "חתימות דיגיטליות", body: "אישור לקוח וחתימה על מסירה.", status: "live", href: "/product#sign" },
  { key: "reports", title: "דוחות", body: "משפך הצעות ותמונת מצב מסחרית.", status: "partial", href: "/product#reports" },
];

export const WORKFLOW_STEPS = [
  { title: "ליד", body: "קליטה ראשונית" },
  { title: "לקוח", body: "כרטיס ופרטים" },
  { title: "סיור", body: "תיעוד באתר" },
  { title: "הצעה", body: "תמחור מקצועי" },
  { title: "אישור", body: "בחירת חלופה" },
  { title: "פרויקט", body: "תכנון ביצוע" },
  { title: "התקנה", body: "עבודה בשטח" },
  { title: "מסירה", body: "תעודה וחתימה" },
  { title: "שירות", body: "אחריות ותחזוקה" },
] as const;

export const PROBLEMS = [
  "מידע לקוחות מפוזר בין מערכות שונות",
  "הצעות מחיר שנעלמות בין גרסאות",
  "קושי לעקוב אחרי התקנות בביצוע",
  "תקשורת שבורה בין משרד לטכנאים",
  "היסטוריית שירות חסרה או לא מסודרת",
  "אין תמונת מצב תפעולית אחת",
] as const;

export const SOLUTIONS = [
  {
    slug: "technicians",
    title: "טכנאים עצמאיים",
    body: "מהצעה ראשונה ועד מסירה — בלי לנהל חמש תוכנות.",
    href: "/solutions/technicians",
  },
  {
    slug: "installation-companies",
    title: "חברות התקנה קטנות",
    body: "משרד ושטח מסונכרנים, בלי לאבד הצעות ותמונות.",
    href: "/solutions/installation-companies",
  },
  {
    slug: "security-companies",
    title: "חברות אבטחה והתקנה",
    body: "שיבוץ טכנאים, תיק אתר ותזכורות שירות לכל האתרים.",
    href: "/solutions/security-companies",
  },
  {
    slug: "enterprise",
    title: "ארגונים גדולים",
    body: "ריבוי משתמשים, אינטגרציות ותמיכה ייעודית.",
    href: "/solutions/enterprise",
  },
] as const;

export const HOME_FAQ = [
  {
    q: "האם המידע שלי מבודד מלקוחות אחרים?",
    a: "כן. כל חברה עובדת בסביבת עבודה נפרדת, עם הרשאות לפי תפקיד.",
  },
  {
    q: "איך מוציאים חשבוניות?",
    a: "בסבב הנוכחי אין חשבוניות אוטומטיות מהמערכת. חיבור לתוכנת הנהלת חשבונות מתוכנן לשלב הבא.",
  },
  {
    q: "האם צריך כרטיס אשראי?",
    a: "לא בבטא. מתחילים בחינם; שדרוג מתבצע בפנייה אלינו עד השקת הסליקה.",
  },
  {
    q: "יש אפליקציית מובייל?",
    a: "היום עובדים מהדפדפן בטלפון. אפליקציה ייעודית בדרך.",
  },
  {
    q: "אפשר לייבא לקוחות קיימים?",
    a: "ייבוא מסודר בתכנון. בבטא נעזור בהצטרפות ידנית.",
  },
  {
    q: "איך מבטלים מנוי?",
    a: "בקשה למשרד — בלי חיובים אוטומטיים בבטא. ראו גם מדיניות הביטול.",
  },
  {
    q: "איזו תמיכה יש?",
    a: "תמיכה במייל ובוואטסאפ עסקי למשתתפי בטא.",
  },
  {
    q: "הכל בעברית?",
    a: "כן — ממשק מימין לשמאל, מע״מ ושקלים.",
  },
  {
    q: "אפשר לנהל כמה טכנאים?",
    a: "במסלול Business ומעלה — שיבוץ טכנאים, צ׳קליסט וחתימה בשטח.",
  },
  {
    q: "אפשר לנהל כמה אתרים או סניפים?",
    a: "אפשר לנהל לקוחות ואתרים מרובים. ניהול סניפים מתקדם נמצא בהרחבה.",
  },
] as const;

/** @deprecated Prefer HEADER_FLAT_LINKS from marketing-routes.ts */
export const NAV_LINKS = [
  { href: "/product", label: "סקירת מוצר", isRoute: true },
  { href: "/solutions", label: "פתרונות", isRoute: true },
  { href: "/pricing", label: "מחירון", isRoute: true },
  { href: "/tools/cctv-storage", label: "מחשבון אחסון", isRoute: true },
  { href: "/about", label: "אודות", isRoute: true },
  { href: "/contact", label: "צור קשר", isRoute: true },
  { href: "/knowledge", label: "מרכז ידע", isRoute: true },
] as const;

export function statusLabel(status: ModuleStatus): string {
  if (status === "live") return "פעיל";
  if (status === "partial") return "חלקי";
  return "בקרוב";
}
