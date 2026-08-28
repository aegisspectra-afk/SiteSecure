import type { AttentionGroup } from "@site-secure/api-client";
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
      className={`ops-panel ops-panel-priority ${count ? "p-5" : "px-5 py-4"}`}
      aria-labelledby="command-heading"
    >
      <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.commandKicker}</p>
      <h2 id="command-heading" className="mt-1 text-base font-semibold text-fg">
        {count ? he.commandTitleCount(count) : he.commandTitle}
      </h2>
      {count ? null : <p className="mt-3 text-sm text-fg-muted">{he.commandQuietBody}</p>}
      {count ? <AttentionList groups={attention} framed={false} /> : null}
    </section>
  );
}
