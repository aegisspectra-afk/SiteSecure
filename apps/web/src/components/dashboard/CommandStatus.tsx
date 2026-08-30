import type { AttentionGroup } from "@site-secure/api-client";
import { AlertTriangle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { attentionCount } from "../../lib/next-best-action";
import { AttentionList } from "./AttentionList";

export function CommandStatus({
  attention = [],
}: {
  workspaceStatus?: string;
  attention?: AttentionGroup[];
}) {
  const count = attentionCount(attention);

  return (
    <section
      className={`ops-panel ops-attention-card ${count ? "is-active p-4" : "px-4 py-3"}`}
      aria-labelledby="command-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {count ? <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden /> : null}
          <h2 id="command-heading" className="text-base font-semibold text-fg">
            {count ? he.commandTitleCount(count) : he.commandTitle}
          </h2>
        </div>
        {count ? (
          <Link
            to="/app/today"
            className="text-sm font-medium text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {he.attentionViewAll}
          </Link>
        ) : null}
      </div>
      {count ? null : <p className="mt-2 text-sm text-fg-muted">{he.commandQuietBody}</p>}
      {count ? <AttentionList groups={attention} framed={false} /> : null}
    </section>
  );
}
