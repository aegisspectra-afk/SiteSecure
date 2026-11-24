export type KnowledgeCategory =
  | "cctv"
  | "cameras"
  | "access"
  | "alarm"
  | "network"
  | "business"
  | "install"
  | "tutorials";

export type KnowledgeArticle = {
  slug: string;
  title: string;
  summary: string;
  category: KnowledgeCategory;
  minutes: number;
  updated: string;
  featured?: boolean;
  body: string[];
};

export const KNOWLEDGE_CATEGORIES: { key: KnowledgeCategory | "all"; label: string }[] = [
  { key: "all", label: "הכל" },
  { key: "cctv", label: "CCTV" },
  { key: "cameras", label: "מצלמות והקלטה" },
  { key: "access", label: "בקרת כניסה" },
  { key: "alarm", label: "אזעקות" },
  { key: "network", label: "רשתות ותקשורת" },
  { key: "business", label: "ניהול עסקי" },
  { key: "install", label: "מדריכי התקנה" },
  { key: "tutorials", label: "מדריכי SITE SECURE" },
];

export const KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  {
    slug: "cctv-storage-basics",
    title: "יסודות חישוב אחסון CCTV",
    summary: "איך מספר מצלמות, רזולוציה וימי הקלטה משפיעים על נפח האחסון.",
    category: "cctv",
    minutes: 4,
    updated: "2026-11-01",
    featured: true,
    body: [
      "נפח הקלטה נגזר בעיקר מכמות המצלמות, קצב הביטים לכל מצלמה, משך ההקלטה ביום ומספר ימי השמירה.",
      "במחשבון הציבורי של SITE SECURE משתמשים באותו מנוע חישוב כמו באשף ההצעה — בלי מחירים ובלי התחייבות לדגם ספציפי.",
      "המלצת דיסק וערוצי NVR הן הערכה הנדסית לתכנון ראשוני. בחירת ציוד סופית נעשית בקטלוג אחרי הרשמה.",
    ],
  },
  {
    slug: "quote-alternatives",
    title: "חלופות הצעה לוועד בית",
    summary: "למה כדאי להציג כמה רמות הצעה ואיך זה מתחבר לתהליך אישור.",
    category: "business",
    minutes: 3,
    updated: "2026-11-01",
    featured: true,
    body: [
      "חלופות (למשל בסיסי / מומלץ / מתקדם) עוזרות ללקוח להשוות היקף מול תקציב בלי לנהל כמה קבצים נפרדים.",
      "ב-SITE SECURE החלופות הן חלק מתהליך ההצעה; האישור ממשיך לפרויקט ולמסירה לפי המסלול שנבחר.",
      "אין כאן המלצה מסחרית אוטומטית — הבחירה נשארת בידי המשתמש והלקוח.",
    ],
  },
  {
    slug: "field-checklist-handover",
    title: "צ׳קליסט שטח ותעודת מסירה",
    summary: "איך תיעוד מהטלפון הופך למסמך מסירה מסודר.",
    category: "tutorials",
    minutes: 5,
    updated: "2026-11-01",
    featured: true,
    body: [
      "במסלולים שכוללים שטח, טכנאי יכול למלא צ׳קליסט, לצלם ולחתום מול הלקוח מהדפדפן בנייד.",
      "תעודת המסירה נשמרת בהקשר של האתר והפרויקט — כדי שלא ייעלמו מסמכים בין שיחות.",
      "זמינות היכולת תלויה בחבילה ובהרשאות התפקיד בסביבת העבודה.",
    ],
  },
  {
    slug: "recording-modes",
    title: "מצבי הקלטה: רציף, מתוזמן ותנועה",
    summary: "הבדלים תפעוליים שמשפיעים על נפח ועל תכנון NVR.",
    category: "cameras",
    minutes: 4,
    updated: "2026-10-20",
    body: [
      "הקלטה רציפה פשוטה לתכנון אך צורכת יותר אחסון.",
      "הקלטה מתוזמנת מתאימה לאתרים עם שעות פעילות מוגדרות.",
      "הקלטה לפי תנועה חוסכת נפח אך דורשת הערכה זהירה של אחוז הפעילות באתר.",
    ],
  },
  {
    slug: "workspace-isolation",
    title: "בידוד סביבות עבודה ב-SITE SECURE",
    summary: "איך נתוני חברה אחת לא נראים בחברה אחרת.",
    category: "tutorials",
    minutes: 3,
    updated: "2026-10-15",
    body: [
      "כל חברה עובדת בסביבת עבודה נפרדת עם הרשאות לפי תפקיד.",
      "פעולות רגישות נבדקות מול ההרשאה וסביבת העבודה הפעילה.",
      "זהו עיקרון אבטחה בסיסי של המוצר — לא תעודת תקינה חיצונית.",
    ],
  },
  {
    slug: "network-planning-notes",
    title: "הערות תכנון לרשת מצלמות IP",
    summary: "נקודות לבדיקה לפני התקנה — בלי המלצות יצרן ספציפיות.",
    category: "network",
    minutes: 4,
    updated: "2026-10-10",
    body: [
      "בדקו רוחב פס זמין, PoE, ומרחקי כבילה לפני קביעת כמות מצלמות.",
      "הפרדת VLAN לאתרים גדולים היא שיקול תכנון נפוץ — בהתאם למדיניות הלקוח.",
      "SITE SECURE מסייע בתכנון ובתיעוד; תכנון הרשת עצמו נשאר באחריות המתקין.",
    ],
  },
];

export function articleBySlug(slug: string): KnowledgeArticle | undefined {
  return KNOWLEDGE_ARTICLES.find((a) => a.slug === slug);
}

export function articlesByCategory(category: KnowledgeCategory | "all"): KnowledgeArticle[] {
  if (category === "all") return KNOWLEDGE_ARTICLES;
  return KNOWLEDGE_ARTICLES.filter((a) => a.category === category);
}

export function relatedArticles(slug: string, limit = 3): KnowledgeArticle[] {
  const current = articleBySlug(slug);
  if (!current) return KNOWLEDGE_ARTICLES.slice(0, limit);
  return KNOWLEDGE_ARTICLES.filter((a) => a.slug !== slug && a.category === current.category).slice(0, limit);
}

export function categoryLabel(key: KnowledgeCategory): string {
  return KNOWLEDGE_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}
