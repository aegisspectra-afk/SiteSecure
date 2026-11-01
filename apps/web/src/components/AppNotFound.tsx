import { he } from "../i18n/he";

export function AppNotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-start justify-center gap-4 p-6" role="status">
      <h1 className="text-xl font-semibold text-fg">{he.pageNotFoundTitle}</h1>
      <p className="text-sm text-fg-muted">{he.pageNotFoundBody}</p>
      <a
        href="/app"
        className="inline-flex min-h-10 items-center rounded-[var(--radius-control)] bg-fg px-4 text-sm text-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {he.pageNotFoundHome}
      </a>
    </div>
  );
}
