import type { AttentionGroup } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { ATTENTION_DISPLAY_LIMIT, attentionEntityCount, attentionQueueLimited } from "../../lib/attention-queue";
import { AttentionList } from "./AttentionList";

export function CommandStatus({
  attention = [],
  canCreateProject = true,
  viewAllTo = "/app/quotes",
}: {
  attention?: AttentionGroup[];
  canCreateProject?: boolean;
  viewAllTo?: "/app/quotes" | "/app/today" | "/app/leads";
}) {
  const count = attentionEntityCount(attention);
  const { hasMore } = attentionQueueLimited(attention, {
    canCreateProject,
    limit: ATTENTION_DISPLAY_LIMIT,
  });

  return (
    <section
      className={`ops-panel ops-attention-card ${count ? "is-active p-4" : "px-4 py-3"}`}
      aria-labelledby="command-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="command-heading" className="text-base font-semibold text-fg">
          {count ? he.commandTitleCount(count) : he.commandTitle}
        </h2>
        {count && hasMore ? (
          <Link
            to={viewAllTo}
            className="text-sm font-medium text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {he.attentionShowAll}
          </Link>
        ) : null}
      </div>
      {count ? (
        <AttentionList
          groups={attention}
          framed={false}
          canCreateProject={canCreateProject}
          limit={ATTENTION_DISPLAY_LIMIT}
        />
      ) : (
        <p className="mt-1 text-sm text-fg-muted">{he.commandQuietBody}</p>
      )}
    </section>
  );
}
