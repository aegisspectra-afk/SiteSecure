import { Button, ErrorState, PageHeader } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useNavigate } from "@tanstack/react-router";
import { he } from "../i18n/he";
import { createSspApi } from "../lib/api";
import { clearDeviceSession, readDeviceSession } from "../lib/deviceSession";

const api = createSspApi();

function statusHe(status: string) {
  if (status === "available") return he.siteAvailable;
  if (status === "unfilled") return he.siteUnfilled;
  if (status === "submitted") return he.siteSubmitted;
  if (status === "overdue") return he.siteOverdue;
  return status;
}

export function FieldHomePage() {
  const navigate = useNavigate();
  const stored = readDeviceSession();
  const me = useQuery({
    queryKey: ["ssp-device-me", stored?.device_token],
    enabled: Boolean(stored?.device_token),
    queryFn: () => api.getSspSiteDeviceMe(stored!.device_token),
    retry: false,
  });
  const ops = useQuery({
    queryKey: ["ssp-device-ops", stored?.device_token],
    enabled: Boolean(stored?.device_token) && me.isSuccess,
    queryFn: () => api.getSspSiteDeviceOps(stored!.device_token),
    retry: false,
  });

  if (!stored) return <Navigate to="/activate" />;

  if (me.isError) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 py-8">
        <ErrorState title={he.forbiddenTitle} description={he.forbiddenBody} />
        <Button
          type="button"
          onClick={() => {
            clearDeviceSession();
            void navigate({ to: "/activate" });
          }}
        >
          {he.activationTitle}
        </Button>
      </main>
    );
  }

  const site = me.data?.site;
  const buckets = ops.data?.buckets ?? {};
  const byId = new Map((ops.data?.assignments ?? []).map((a) => [a.id, a]));

  function list(key: string) {
    const rows = (buckets[key] ?? []).map((id) => byId.get(id)).filter(Boolean);
    if (!rows.length) return <p className="text-sm text-fg-muted">{he.noItems}</p>;
    return (
      <ul className="divide-y divide-border rounded-lg border border-border">
        {rows.map((a) => (
          <li key={a!.id}>
            <Link
              to="/field/forms/$assignmentId"
              params={{ assignmentId: a!.id }}
              className="flex items-center justify-between px-3 py-3 text-sm"
            >
              <span>{a!.form_title || a!.form_id}</span>
              <span className="text-xs text-fg-muted">{statusHe(a!.fill_status || a!.status)}</span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-4 py-6" data-testid="ssp-field-home">
      <PageHeader
        title={site?.name || he.fieldHome}
        description={`${he.sitePhone}: ${site?.phone || "—"} · ${site?.is_active ? he.fieldStatusActive : he.siteInactive}`}
      />
      {me.isLoading || ops.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
      {ops.data?.data_mode === "empty" ? <p className="text-sm text-fg-muted">{he.sspNoForms}</p> : null}

      <section>
        <h2 className="mb-2 text-base font-semibold">{he.siteAvailable}</h2>
        {list("available")}
      </section>
      <section>
        <h2 className="mb-2 text-base font-semibold">{he.siteUnfilled}</h2>
        {list("unfilled")}
      </section>
      <section>
        <h2 className="mb-2 text-base font-semibold">{he.siteSubmitted}</h2>
        {list("submitted")}
      </section>
      <section>
        <h2 className="mb-2 text-base font-semibold">{he.siteOverdue}</h2>
        {list("overdue")}
      </section>
      <section>
        <h2 className="mb-2 text-base font-semibold">{he.siteHistory}</h2>
        {!ops.data?.submissions.length ? (
          <p className="text-sm text-fg-muted">{he.sspNoSubmissions}</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {ops.data.submissions.map((s) => (
              <li key={s.id} className="px-3 py-2">
                {s.submitted_at} · {he.viaSiteDevice} · {s.status}
              </li>
            ))}
          </ul>
        )}
      </section>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          clearDeviceSession();
          void navigate({ to: "/activate" });
        }}
      >
        {he.fieldDisconnect}
      </Button>
    </main>
  );
}
