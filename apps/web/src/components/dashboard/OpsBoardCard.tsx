import type { OpsBoard } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";

/**
 * D1 ops card: today's jobs per technician and jobs nobody is assigned to.
 * Owner/administrator/manager only (the API omits ops_board for other roles).
 * "Completed and awaiting billing" is not shown: no billing state exists in the data.
 */
export function OpsBoardCard({ board }: { board: OpsBoard }) {
  const { technicians, unassigned_today: unassignedToday, unassigned_open: unassignedOpen } = board;

  return (
    <section className="ops-today-card is-dense is-queue" aria-labelledby="ops-board-heading" data-testid="ops-board">
      <div className="ops-section-head is-today">
        <h2 id="ops-board-heading" className="ops-section-title is-today">
          {he.opsBoardTitle}
        </h2>
      </div>

      <h3 className="ops-today-context" id="ops-board-techs">
        {he.opsBoardByTechnician}
      </h3>
      {technicians.length ? (
        <ul className="ops-today-list is-queue" aria-labelledby="ops-board-techs">
          {technicians.map((tech) => (
            <li key={tech.user_id} className="ss-activity-row" data-testid="ops-board-tech">
              <div className="ss-activity-row-body">
                <p className="ops-today-title">
                  <bdi>{tech.name}</bdi>
                </p>
                <p className="ops-today-context">{he.opsBoardTechLine(tech.jobs_today, tech.in_progress, tech.completed)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ops-today-empty-text" data-testid="ops-board-no-techs">
          {he.opsBoardNoAssignedToday}
        </p>
      )}

      <div className="ss-activity-row" data-testid="ops-board-unassigned">
        <div className="ss-activity-row-body">
          <p className="ops-today-title">{he.opsBoardUnassignedTitle}</p>
          <p className="ops-today-context">{he.opsBoardUnassignedLine(unassignedOpen, unassignedToday)}</p>
        </div>
        {unassignedOpen > 0 ? (
          <div className="ss-activity-row-trailing">
            <Link to="/app/attention" className="ops-section-link" data-testid="ops-board-unassigned-link">
              {he.opsBoardUnassignedCta}
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
