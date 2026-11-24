import { ssMarketing } from "../../../i18n/site-secure-marketing-he";

/** Fixed bottom CTA on phone — pairs with sticky header CTA on desktop. */
export function LandingMobileCta() {
  return (
    <div className="landing-mobile-cta lg:hidden" role="region" aria-label="פעולה ראשית">
      <a href="#beta" className="landing-mobile-cta-btn">
        {ssMarketing.heroPrimary}
      </a>
    </div>
  );
}
