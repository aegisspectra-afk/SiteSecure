import { createFileRoute } from "@tanstack/react-router";
import { ContactForm, type ContactTopic } from "../components/public/marketing/enterprise/ContactForm";
import { MarketingShell } from "../components/public/marketing/enterprise/MarketingShell";
import { usePublicSeo } from "../lib/public-seo";

type ContactSearch = { topic?: ContactTopic };

export const Route = createFileRoute("/contact")({
  validateSearch: (search: Record<string, unknown>): ContactSearch => {
    const topic = typeof search.topic === "string" ? (search.topic as ContactTopic) : undefined;
    return topic ? { topic } : {};
  },
  component: ContactPage,
});

const origin = typeof window !== "undefined" ? window.location.origin : "https://site-secure.com";

function ContactPage() {
  const { topic } = Route.useSearch();
  usePublicSeo({
    title: "צור קשר — SITE SECURE",
    description: "פנייה ל-SITE SECURE: תמיכה, מכירות, הדגמה או Enterprise.",
    canonical: `${origin}/contact`,
  });

  return (
    <MarketingShell>
      <section className="mkt-dark mkt-section">
        <div className="mkt-container grid gap-10 lg:grid-cols-2">
          <div>
            <h1 className="mkt-h1">צור קשר</h1>
            <p className="mkt-lede">
              בחרו סוג פנייה ומלאו פרטים. הודעת הצלחה מוצגת רק אחרי שהשרת מאשר שמירה. אין הצגת הצלחה מזויפת.
            </p>
            <ul className="mt-6 list-none space-y-2 p-0 text-sm text-[var(--mkt-on-dark-muted)]">
              <li>• פנייה כללית</li>
              <li>• תמיכה טכנית</li>
              <li>• מכירות</li>
              <li>• Enterprise</li>
              <li>• בקשת הדגמה</li>
            </ul>
          </div>
          <ContactForm initialTopic={topic ?? "general"} />
        </div>
      </section>
    </MarketingShell>
  );
}
