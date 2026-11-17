import { he } from "../../i18n/he";

const MARKETING_ORIGIN = "https://site-secure.com";

/** Small “created with SITE SECURE” credit for public customer pages. */
export function PublicPlatformFooter({
  utmSource,
  className,
}: {
  utmSource: string;
  className?: string;
}) {
  const href = `${MARKETING_ORIGIN}/?utm_source=${encodeURIComponent(utmSource)}`;
  return (
    <footer className={["public-platform-footer", className].filter(Boolean).join(" ")}>
      <a href={href} target="_blank" rel="noopener noreferrer" className="public-platform-footer-link">
        {he.publicCreatedWithSiteSecure}
      </a>
    </footer>
  );
}

export function publicPlatformMarketingHref(utmSource: string): string {
  return `${MARKETING_ORIGIN}/?utm_source=${encodeURIComponent(utmSource)}`;
}
