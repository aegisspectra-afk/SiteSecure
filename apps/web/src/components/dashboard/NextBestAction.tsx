import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import type { NextAction } from "../../lib/next-best-action";

export function NextBestAction({ action }: { action: NextAction }) {
  return (
    <section className="ops-card p-5" aria-labelledby="next-action-heading">
      <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.nextActionKicker}</p>
      <h2 id="next-action-heading" className="mt-1 text-base font-semibold text-fg">
        {he.nextActionTitle}
      </h2>
      <p className="mt-3 text-sm font-medium text-fg">{action.title}</p>
      <p className="mt-1 text-sm text-fg-muted">{action.body}</p>
      <Link
        to={action.href}
        className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {action.label}
      </Link>
    </section>
  );
}
