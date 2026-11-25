export const DEMO_BADGE = "דוגמה";

export const DEMO_KPIS = [
  { key: "customers", label: "לקוחות", value: 128, hint: "+6 החודש" },
  { key: "projects", label: "פרויקטים פעילים", value: 14, hint: "3 בפיגור" },
  { key: "service", label: "קריאות פתוחות", value: 9, hint: "2 דחופות" },
  { key: "techs", label: "טכנאים", value: 7, hint: "5 זמינים" },
] as const;

export const DEMO_ACTIVITY = [
  { id: "a1", time: "09:42", text: "הצעה Q-1042 נשלחה ללקוח", tone: "ok" as const },
  { id: "a2", time: "09:18", text: "קריאת שירות #882 נפתחה — אתר רמת גן", tone: "warn" as const },
  { id: "a3", time: "08:55", text: "טכנאי יוסי סיים התקנה — תיק מסירה נחתם", tone: "ok" as const },
  { id: "a4", time: "08:20", text: "ליד חדש מאתר — מצלמות לובי", tone: "info" as const },
  { id: "a5", time: "07:50", text: "שיבוץ טכנאי לעבודת התקנה P-221", tone: "info" as const },
  { id: "a6", time: "07:15", text: "קריאת שירות #871 נסגרה עם תיעוד", tone: "ok" as const },
  { id: "a7", time: "06:40", text: "תזכורת שירות — חוזה תחזוקה באתר הדר", tone: "warn" as const },
];

export const DEMO_CHART = [
  { label: "א׳", quotes: 4, installs: 2 },
  { label: "ב׳", quotes: 6, installs: 3 },
  { label: "ג׳", quotes: 5, installs: 4 },
  { label: "ד׳", quotes: 8, installs: 3 },
  { label: "ה׳", quotes: 7, installs: 5 },
  { label: "ו׳", quotes: 3, installs: 2 },
] as const;

export const DEMO_TABLE = [
  { id: "Q-1042", customer: "ועד בית הדר", status: "נשלחה", amount: "₪18,400" },
  { id: "Q-1041", customer: "חניון מרכז", status: "טיוטה", amount: "₪9,200" },
  { id: "P-221", customer: "משרדי אופק", status: "בהתקנה", amount: "—" },
  { id: "S-882", customer: "אתר רמת גן", status: "פתוחה", amount: "—" },
] as const;

export const DEMO_NAV = [
  { id: "dash", label: "לוח בקרה" },
  { id: "customers", label: "לקוחות" },
  { id: "quotes", label: "הצעות" },
  { id: "jobs", label: "עבודות" },
  { id: "service", label: "שירות" },
] as const;

export type ExplorerModuleKey =
  | "crm"
  | "customers"
  | "projects"
  | "installations"
  | "service"
  | "quotations"
  | "technicians";

export type ExplorerModule = {
  key: ExplorerModuleKey;
  title: string;
  value: string;
  capabilities: string[];
  previewKind: "list" | "table" | "board";
  cta: { label: string; href: string };
  status: "live" | "partial" | "planned";
};

export const EXPLORER_MODULES: ExplorerModule[] = [
  {
    key: "crm",
    title: "לידים וניהול פניות",
    value: "קליטת לידים והמרה ללקוח בלי לאבד פרטים בין וואטסאפ לאקסל.",
    capabilities: ["לידים עם מקור", "המרה ללקוח", "תזכורות מעקב", "היסטוריית פניות"],
    previewKind: "list",
    cta: { label: "התחילו בחינם", href: "/register" },
    status: "live",
  },
  {
    key: "customers",
    title: "לקוחות",
    value: "כרטיס לקוח אחד עם אתרים, הצעות והיסטוריית שירות.",
    capabilities: ["כרטיס לקוח", "ריבוי אתרים", "אנשי קשר", "תיעוד פעילות"],
    previewKind: "table",
    cta: { label: "למחירון", href: "/pricing" },
    status: "live",
  },
  {
    key: "projects",
    title: "פרויקטים",
    value: "מעקב אחרי פרויקטים מאושרים עד סיום התקנה ומסירה.",
    capabilities: ["סטטוס פרויקט", "קישור להצעה", "צוות אחראי", "אבני דרך"],
    previewKind: "board",
    cta: { label: "גלו את הפלטפורמה", href: "/product" },
    status: "live",
  },
  {
    key: "installations",
    title: "התקנות",
    value: "עבודות שטח עם צ׳קליסט, תמונות וחתימה מהטלפון.",
    capabilities: ["שיבוץ טכנאי", "צ׳קליסט", "צילום מהשטח", "חתימת לקוח"],
    previewKind: "list",
    cta: { label: "לפתרון טכנאים", href: "/solutions/technicians" },
    status: "live",
  },
  {
    key: "service",
    title: "קריאות שירות",
    value: "מעקב אחרי תקלות ואחריות לפי אתר — בלי שיחות אבודות.",
    capabilities: ["פתיחת קריאה", "עדיפות", "היסטוריית אתר", "סגירה עם תיעוד"],
    previewKind: "table",
    cta: { label: "דברו איתנו", href: "/contact" },
    status: "live",
  },
  {
    key: "quotations",
    title: "הצעות מחיר",
    value: "אשף CCTV, חלופות לוועד בית ושליחה ללקוח בוואטסאפ.",
    capabilities: ["אשף הנדסי", "חלופות", "PDF ממותג", "שיתוף ללקוח"],
    previewKind: "table",
    cta: { label: "מחשבון אחסון", href: "/tools/cctv-storage" },
    status: "live",
  },
  {
    key: "technicians",
    title: "טכנאים",
    value: "שיבוץ, זמינות וחתימה בשטח במסלול Business ומעלה.",
    capabilities: ["רשימת צוות", "שיבוץ יומי", "צ׳קליסט", "חתימה דיגיטלית"],
    previewKind: "list",
    cta: { label: "למסלול Business", href: "/pricing" },
    status: "live",
  },
];

export const WORKFLOW_DETAIL = [
  {
    key: "lead",
    title: "ליד",
    body: "קליטת פנייה ראשונית עם מקור ומעקב — בלי שיחה שנעלמת בוואטסאפ.",
  },
  {
    key: "customer",
    title: "לקוח",
    body: "כרטיס לקוח עם פרטי התקשרות ואתרים קשורים.",
  },
  {
    key: "survey",
    title: "סיור",
    body: "תיעוד באתר: תמונות, הערות והנחות הנדסיות לסיור.",
  },
  {
    key: "quote",
    title: "הצעה",
    body: "תמחור מקצועי עם אשף CCTV וחלופות ללקוח.",
  },
  {
    key: "approval",
    title: "אישור",
    body: "הלקוח בוחר חלופה ומאשר — המערכת ממשיכה לפרויקט.",
  },
  {
    key: "project",
    title: "פרויקט",
    body: "תכנון ביצוע, שיבוץ ואחריות על אבני דרך.",
  },
  {
    key: "install",
    title: "התקנה",
    body: "עבודה בשטח עם צ׳קליסט ותיעוד מהטלפון.",
  },
  {
    key: "handover",
    title: "מסירה",
    body: "תעודת מסירה וחתימת לקוח — תיק אתר מוכן.",
  },
  {
    key: "service",
    title: "שירות",
    body: "אחריות, תחזוקה וקריאות המשך על אותו אתר.",
  },
] as const;
