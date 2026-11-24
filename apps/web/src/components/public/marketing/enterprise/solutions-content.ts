import { MARKETING_ROUTES } from "./marketing-routes";

export type SolutionKey = "technicians" | "installation" | "security" | "enterprise";

export type SolutionProfile = {
  key: SolutionKey;
  title: string;
  href: string;
  plan: string;
  challenges: string[];
  modules: string[];
  workflow: string[];
  benefits: string[];
  cta: { label: string; href: string };
};

export const SOLUTION_PROFILES: SolutionProfile[] = [
  {
    key: "technicians",
    title: "טכנאים עצמאיים",
    href: MARKETING_ROUTES.solutionsTechnicians,
    plan: "Free / Pro",
    challenges: [
      "הצעות שנשארות בוואטסאפ ובאקסל",
      "אין תיק אתר מסודר אחרי מסירה",
      "קושי להציג חלופות מקצועיות ללקוח",
    ],
    modules: ["הצעות מחיר", "אשף CCTV", "לקוחות ואתרים", "תעודת מסירה"],
    workflow: ["ליד", "סיור", "הצעה", "אישור", "מסירה"],
    benefits: ["התחלת עבודה מסודרת בחינם", "הצעה מקצועית מהשטח", "מסמך מסירה במותג שלכם"],
    cta: { label: "התחילו בחינם", href: MARKETING_ROUTES.register },
  },
  {
    key: "installation",
    title: "חברות התקנה קטנות",
    href: MARKETING_ROUTES.solutionsInstallation,
    plan: "Pro / Business",
    challenges: [
      "משרד ושטח לא מסונכרנים",
      "גרסאות הצעה מתערבבות",
      "תמונות מהסיור נעלמות",
    ],
    modules: ["לידים ופניות", "לקוחות", "הצעות", "פרויקטים", "מסמכים"],
    workflow: ["ליד", "לקוח", "הצעה", "פרויקט", "התקנה", "מסירה"],
    benefits: ["סנכרון משרד־שטח", "היסטוריית לקוח אחת", "מעקב אחרי עבודות"],
    cta: { label: "למחירון", href: MARKETING_ROUTES.pricing },
  },
  {
    key: "security",
    title: "חברות אבטחה והתקנה",
    href: MARKETING_ROUTES.solutionsSecurity,
    plan: "Business",
    challenges: [
      "שיבוץ טכנאים מורכב",
      "קריאות שירות בלי הקשר לאתר",
      "אין תמונת מצב תפעולית",
    ],
    modules: ["טכנאים", "קריאות שירות", "תיק אתר", "יומן", "דוחות"],
    workflow: ["לקוח", "פרויקט", "שיבוץ", "התקנה", "שירות"],
    benefits: ["צוות בשטח עם צ׳קליסט", "שירות לפי אתר", "בקרה למנהלים"],
    cta: { label: "דברו איתנו", href: MARKETING_ROUTES.contact },
  },
  {
    key: "enterprise",
    title: "ארגונים גדולים",
    href: MARKETING_ROUTES.solutionsEnterprise,
    plan: "Enterprise",
    challenges: [
      "ריבוי משתמשים ואתרים",
      "צורך בהתאמות ותמיכה ייעודית",
      "דרישות אבטחה ואכיפת הרשאות",
    ],
    modules: ["כל המודולים הזמינים", "הרשאות מתקדמות", "אינטגרציות (לפי תיאום)"],
    workflow: ["הטמעה מודרכת", "הגדרת תפקידים", "הפעלה בסביבות עבודה"],
    benefits: ["תמחור בהתאמה", "ליווי הטמעה", "בידוד סביבות עבודה"],
    cta: { label: "פנייה ל-Enterprise", href: `${MARKETING_ROUTES.contact}?topic=enterprise` },
  },
];

export function solutionByKey(key: SolutionKey): SolutionProfile {
  return SOLUTION_PROFILES.find((s) => s.key === key) ?? SOLUTION_PROFILES[0];
}
