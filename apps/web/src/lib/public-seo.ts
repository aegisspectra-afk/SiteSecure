import { useEffect } from "react";

type SeoInput = {
  title: string;
  description: string;
  robots?: string;
  canonical?: string;
  ogImage?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function usePublicSeo({
  title,
  description,
  robots = "index, follow",
  canonical,
  ogImage = "/landing-v2/02-quote-review-desktop.jpg",
  jsonLd,
}: SeoInput) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;
    upsertMeta("name", "description", description);
    upsertMeta("name", "robots", robots);
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:locale", "he_IL");
    if (ogImage) upsertMeta("property", "og:image", ogImage);
    if (canonical) upsertLink("canonical", canonical);

    const id = "ss-public-jsonld";
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    if (jsonLd) {
      const script = document.createElement("script");
      script.id = id;
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }

    return () => {
      document.title = prevTitle;
      document.getElementById(id)?.remove();
    };
  }, [title, description, robots, canonical, ogImage, jsonLd]);
}

export function siteSecureOrgJsonLd(origin: string) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Aegis Spectra",
      url: origin,
      brand: { "@type": "Brand", name: "SITE SECURE" },
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "SITE SECURE",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "ILS" },
    },
  ];
}