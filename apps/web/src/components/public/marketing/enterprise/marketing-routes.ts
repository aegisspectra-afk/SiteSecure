/** Central marketing route map — single source for nav/footer/CTAs. */

export const MARKETING_ROUTES = {
  home: "/",
  product: "/product",
  solutions: "/solutions",
  solutionsTechnicians: "/solutions/technicians",
  solutionsInstallation: "/solutions/installation-companies",
  solutionsSecurity: "/solutions/security-companies",
  solutionsEnterprise: "/solutions/enterprise",
  pricing: "/pricing",
  cctvTool: "/tools/cctv-storage",
  about: "/about",
  contact: "/contact",
  knowledge: "/knowledge",
  register: "/register",
  login: "/login",
  legalTerms: "/legal/terms",
  legalPrivacy: "/legal/privacy",
  legalCancellation: "/legal/cancellation",
  legalAccessibility: "/legal/accessibility",
  legalSecurity: "/legal/security",
} as const;

export const HEADER_PLATFORM_LINKS = [
  { href: MARKETING_ROUTES.product, label: "סקירת מוצר" },
  { href: MARKETING_ROUTES.solutions, label: "פתרונות" },
  { href: MARKETING_ROUTES.pricing, label: "מחירון" },
  { href: MARKETING_ROUTES.cctvTool, label: "מחשבון אחסון" },
] as const;

export const HEADER_COMPANY_LINKS = [
  { href: MARKETING_ROUTES.about, label: "אודות" },
  { href: MARKETING_ROUTES.contact, label: "צור קשר" },
  { href: MARKETING_ROUTES.knowledge, label: "מרכז ידע" },
] as const;

export const FOOTER_LEGAL_LINKS = [
  { href: MARKETING_ROUTES.legalTerms, label: "תנאי שימוש", slug: "terms" as const },
  { href: MARKETING_ROUTES.legalPrivacy, label: "מדיניות פרטיות", slug: "privacy" as const },
  { href: MARKETING_ROUTES.legalCancellation, label: "מדיניות ביטול", slug: "cancellation" as const },
  { href: MARKETING_ROUTES.legalAccessibility, label: "הצהרת נגישות", slug: "accessibility" as const },
  { href: MARKETING_ROUTES.legalSecurity, label: "אבטחת מידע", slug: "security" as const },
] as const;

/** Flat header links for compact desktop nav. */
export const HEADER_FLAT_LINKS = [...HEADER_PLATFORM_LINKS, ...HEADER_COMPANY_LINKS] as const;
