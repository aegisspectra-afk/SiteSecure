import { Link } from "@tanstack/react-router";
import type { AppNavTo } from "../../lib/app-nav";

export function SspHubLinks({
  items,
}: {
  items: Array<{ to: AppNavTo; label: string }>;
}) {
  if (!items.length) return null;
  return (
    <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="מסכים קשורים">
      {items.map((item) => (
        <Link key={item.to} to={item.to} className="ops-section-link">
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
