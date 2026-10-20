import { Link } from "@tanstack/react-router";

export function SspHubLinks({ items }: { items: Array<{ to: string; label: string }> }) {
  if (!items.length) return null;
  return (
    <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="מסכים קשורים">
      {items.map((item) => (
        <Link key={item.to} to={item.to as never} className="underline">
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
