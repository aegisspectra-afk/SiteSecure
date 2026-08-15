import { createFileRoute } from "@tanstack/react-router";
import { LegalDocument, LegalNotFound } from "../../components/public/LegalDocument";
import { isLegalSlug } from "../../i18n/legal-he";

export const Route = createFileRoute("/legal/$slug")({
  component: LegalSlugPage,
});

function LegalSlugPage() {
  const { slug } = Route.useParams();
  if (!isLegalSlug(slug)) return <LegalNotFound />;
  return <LegalDocument slug={slug} />;
}
