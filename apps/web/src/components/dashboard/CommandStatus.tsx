import type { AttentionGroup, DashboardItem } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { he } from "../../i18n/he";
import { ATTENTION_DISPLAY_LIMIT, attentionEntityCount, attentionQueueLimited } from "../../lib/attention-queue";
import { AttentionList } from "./AttentionList";
import { DashboardCreateProjectDialog } from "./DashboardCreateProjectDialog";

export function CommandStatus({
  attention = [],
  canCreateProject = true,
  viewAllTo = "/app/quotes",
  workspaceId,
}: {
  attention?: AttentionGroup[];
  canCreateProject?: boolean;
  viewAllTo?: "/app/quotes" | "/app/today" | "/app/leads";
  workspaceId?: string | null;
}) {
  const [projectItem, setProjectItem] = useState<DashboardItem | null>(null);
  const count = attentionEntityCount(attention);
  const { hasMore } = attentionQueueLimited(attention, {
    canCreateProject,
    limit: ATTENTION_DISPLAY_LIMIT,
  });

  return (
    <section
      id="command-attention"
      className={`ops-attention-card is-hero ${count ? "is-active" : "is-quiet"}`}
      aria-labelledby="command-heading"
    >
      <div className="ops-attention-head">
        <h2 id="command-heading" className="ops-section-title is-hero">
          {count ? he.dashCommandQueueCount(count) : he.dashCommandQueue}
        </h2>
        {count && hasMore ? (
          <Link to={viewAllTo} className="ops-section-link">
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
          onCreateProject={
            canCreateProject && workspaceId
              ? (item) => setProjectItem(item)
              : undefined
          }
        />
      ) : (
        <p className="ops-attention-quiet">{he.commandQuietBody}</p>
      )}
      {projectItem && workspaceId ? (
        <DashboardCreateProjectDialog
          item={projectItem}
          workspaceId={workspaceId}
          onClose={() => setProjectItem(null)}
        />
      ) : null}
    </section>
  );
}
