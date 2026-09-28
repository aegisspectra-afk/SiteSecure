import type { JobOut } from "@site-secure/api-client";
import { JobWorkCard } from "../jobs/JobWorkCard";

type ProjectJobCardProps = {
  job: JobOut;
  projectId: string;
};

/** Project-scoped Job row — thin wrapper over shared JobWorkCard. */
export function ProjectJobCard({ job, projectId }: ProjectJobCardProps) {
  return <JobWorkCard job={job} openFrom="project" projectId={projectId} />;
}
