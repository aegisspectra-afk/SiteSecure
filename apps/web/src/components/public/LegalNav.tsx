import { Link } from "@tanstack/react-router";
import { cn } from "@site-secure/ui";
import { legal, legalCompact, legalNav, type LegalSlug } from "../../i18n/legal-he";

export function LegalNav({
  current,
  compact = false,
  className,
}: {
  current?: LegalSlug;
  compact?: boolean;
  className?: string;
}) {
  const items = compact ? legalNav.filter((item) => legalCompact.includes(item.slug)) : legalNav;
  return (
    <nav aria-label={legal.navAria} className={cn("flex flex-wrap gap-x-5 gap-y-2", className)}>
      {items.map((item) => (
        <Link
          key={item.slug}
          to="/legal/$slug"
          params={{ slug: item.slug }}
          className={cn(
            "text-sm hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
            current === item.slug ? "font-medium text-fg" : "text-fg-muted",
          )}
        >
          {compact ? item.footer : item.label}
        </Link>
      ))}
    </nav>
  );
}

function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("0")) return `tel:+972${digits.slice(1)}`;
  return `tel:${digits}`;
}

export function LegalContact({
  title,
  email,
  phone,
  extra,
}: {
  title: string;
  email?: string;
  phone?: string;
  extra?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium text-fg">{title}</p>
      {email ? (
        <p>
          <span className="text-sm text-fg-muted">אימייל: </span>
          <a
            href={`mailto:${email}`}
            className="ltr-meta text-sm text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            dir="ltr"
          >
            {email}
          </a>
        </p>
      ) : null}
      {phone ? (
        <p>
          <span className="text-sm text-fg-muted">טלפון: </span>
          <a
            href={telHref(phone)}
            className="ltr-meta text-sm text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            dir="ltr"
          >
            {phone}
          </a>
        </p>
      ) : null}
      {extra ? <p className="text-sm text-fg-muted">{extra}</p> : null}
    </div>
  );
}
