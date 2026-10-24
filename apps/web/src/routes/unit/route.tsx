import { Button } from "@site-secure/ui";
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { he } from "../../i18n/he";
import { useSession } from "../../lib/session";
import { clearUnitSession, loadUnitSession } from "../../lib/unit-session";

export const Route = createFileRoute("/unit")({
  component: UnitLayoutPage,
});

function UnitLayoutPage() {
  const navigate = useNavigate();
  const { api, user } = useSession();
  const [stored] = useState(() => loadUnitSession());

  useEffect(() => {
    if (user) {
      clearUnitSession();
      void navigate({ to: "/platform" });
      return;
    }
    if (!stored) {
      void navigate({ to: "/login" });
    }
  }, [navigate, stored, user]);

  if (!stored) return null;

  return (
    <div className="min-h-svh bg-bg text-fg" data-testid="ssp-unit-shell">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-xs text-fg-muted">{he.sspUnitIdentity}</p>
          <h1 className="text-base font-semibold">{stored.siteName || he.sspUnitLoginToggle}</h1>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            const token = loadUnitSession()?.token;
            if (token) void api.logoutSspUnit(token).catch(() => undefined);
            clearUnitSession();
            void navigate({ to: "/login" });
          }}
        >
          {he.signOut}
        </Button>
      </header>
      <main className="mx-auto w-full max-w-3xl p-4">
        <Outlet />
      </main>
    </div>
  );
}
