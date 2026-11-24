import { useEffect } from "react";
import { trackMarketingEvent } from "../../../lib/marketing-analytics";
import { siteSecurePricingJsonLd, usePublicSeo } from "../../../lib/public-seo";
import { InteractivePricingExperience } from "./enterprise/InteractivePricingExperience";
import { MarketingShell } from "./enterprise/MarketingShell";

const pricingSeoTitle = "מחירון SITE SECURE";
const pricingSeoDescription =
  "תמחור שקוף ל־Free, Pro, Business ו־Enterprise — מחירים לפני מע״מ, בחירת מסלול אינטראקטיבית ומאתר המלצות מהקטלוג.";
const pricingOrigin =
  typeof window !== "undefined" ? window.location.origin : "https://site-secure.com";

export function PublicPricingPage() {
  usePublicSeo({
    title: pricingSeoTitle,
    description: pricingSeoDescription,
    canonical: `${pricingOrigin}/pricing`,
    jsonLd: siteSecurePricingJsonLd(pricingOrigin, pricingSeoTitle, pricingSeoDescription),
  });

  useEffect(() => {
    trackMarketingEvent("pricing_view");
  }, []);

  return (
    <MarketingShell darkNav={false}>
      <div className="mkt-container px-0 py-12">
        <InteractivePricingExperience />
      </div>
    </MarketingShell>
  );
}
