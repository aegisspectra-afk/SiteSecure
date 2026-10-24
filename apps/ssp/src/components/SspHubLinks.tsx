import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { he } from "../i18n/he";

const HUB_ACTION_CLASS =
  "inline-flex min-h-11 min-w-24 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-border bg-bg px-4 text-sm font-medium text-fg hover:bg-bg-subtle active:bg-bg-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export function SspHubLinks({ items }: { items: Array<{ to: string; label: string }> }) {
  if (!items.length) return null;
  return (
    <nav className="flex flex-wrap gap-2" aria-label={he.relatedScreens}>
      {items.map((item) => (
        <Link key={item.to} to={item.to as never} className={HUB_ACTION_CLASS}>
          <span>{item.label}</span>
          <ChevronLeft className="size-4 shrink-0 rtl:rotate-180" aria-hidden />
        </Link>
      ))}
    </nav>
  );
}
