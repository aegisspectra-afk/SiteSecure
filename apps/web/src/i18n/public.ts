export type PublicLocale = "he" | "en";

export const PUBLIC_LOCALES = ["he", "en"] as const satisfies readonly PublicLocale[];

export const PUBLIC_LOCALE_STORAGE_KEY = "site-secure-public-locale";

export type PublicProductId = "site_secure" | "ssp" | "fleet" | "scheduling";

export type PublicProductStatus = "available" | "in_development" | "planned";

export type PublicCapabilityStatus = "active" | "in_development" | "planned";

export type PublicProductCard = {
  id: PublicProductId;
  name: string;
  role: string;
  description: string;
  benefits: readonly string[];
  href: string | null;
  cta: string | null;
  status: PublicProductStatus;
  statusLabel: string;
};

export type PublicSolutionItem = {
  text: string;
  status: PublicCapabilityStatus;
};

export type PublicComplementItem = {
  name: string;
  body: string;
};

export type PublicSolutionGroup = {
  id: string;
  title: string;
  items: readonly PublicSolutionItem[];
};

export type PublicMessages = {
  operator: string;
  brand: string;
  platformBrand: string;
  skipToContent: string;
  menu: string;
  login: string;
  joinPilot: string;
  seeProduct: string;
  enterWorkspace: string;
  continueOnboarding: string;
  signedInAs: string;
  signedInUnknown: string;
  signOut: string;
  sessionUnavailable: string;
  languageLabel: string;
  languageHe: string;
  languageEn: string;
  themeLabel: string;
  themeLight: string;
  themeDark: string;
  themeSystem: string;
  themeSystemHint: string;
  navPlatform: string;
  navProducts: string;
  navSolutions: string;
  navQuotes: string;
  navSiteFile: string;
  navField: string;
  navSecurity: string;
  navContact: string;
  navAria: string;
  footerCompany: string;
  footerLegal: string;
  footerPlatform: string;
  footerProducts: string;
  footerContact: string;
  footerEarlyAccess: string;
  footerPrivacy: string;
  footerTerms: string;
  pageTitle: string;
  pageDescription: string;
  heroEyebrow: string;
  heroLine1: string;
  heroLine2: string;
  heroSupport: string;
  heroLead: string;
  heroShotLabel: string;
  heroShotAlt: string;
  heroStageLabel: string;
  heroStageAlt: string;
  statusAvailable: string;
  statusWorkspace: string;
  statusInDevelopment: string;
  statusPlanned: string;
  capabilityLegend: string;
  productShotUnavailable: string;
  productsIndex: string;
  productsTitle: string;
  productsSub: string;
  productCards: readonly PublicProductCard[];
  quoteIndex: string;
  quoteA: string;
  quoteB: string;
  quoteSub: string;
  quoteProof: readonly string[];
  quoteCta: string;
  quoteShotLabel: string;
  quoteShotAlt: string;
  quoteReviewLabel: string;
  quoteReviewAlt: string;
  flowIndex: string;
  flowTitle: string;
  flowSub: string;
  flowSteps: readonly string[];
  flowComplementTitle: string;
  flowComplementSub: string;
  flowComplement: readonly PublicComplementItem[];
  siteIndex: string;
  siteFileA: string;
  siteFileB: string;
  siteFileSub: string;
  siteProof: readonly string[];
  siteShotLabel: string;
  siteShotAlt: string;
  assetsIndex: string;
  assetsA: string;
  assetsB: string;
  assetsSub: string;
  assetsProof: readonly string[];
  assetsShotLabel: string;
  assetsShotAlt: string;
  fieldIndex: string;
  fieldA: string;
  fieldB: string;
  fieldSub: string;
  fieldProof: readonly string[];
  fieldShotLabel: string;
  fieldTodayAlt: string;
  fieldJobAlt: string;
  fieldJobLabel: string;
  fieldOfficeLabel: string;
  solutionsIndex: string;
  solutionsTitle: string;
  solutionsSub: string;
  solutionGroups: readonly PublicSolutionGroup[];
  frictionIndex: string;
  frictionA: string;
  frictionB: string;
  frictionBeforeLabel: string;
  frictionAfterLabel: string;
  frictionNote: string;
  frictionBefore: readonly string[];
  frictionAfter: readonly string[];
  securityIndex: string;
  securityTitleA: string;
  securityTitleB: string;
  securitySub: string;
  securityPillars: readonly { title: string; body: string }[];
  securityCta: string;
  contactIndex: string;
  contactTitle: string;
  contactBody: string;
  contactEmail: string;
  contactEmailLabel: string;
  pilotTitle: string;
  pilotBody: string;
  footerTag: string;
  footerCopyright: string;
};

export function isPublicLocale(value: string | null | undefined): value is PublicLocale {
  return value === "he" || value === "en";
}
