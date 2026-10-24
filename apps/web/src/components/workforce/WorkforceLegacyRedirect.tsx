import { useEffect, useState } from "react";
import { he } from "../../i18n/he";
import { supabase } from "../../lib/supabase";
import { workforceAppOrigin, workforceAppUrlWithSession } from "../../lib/workforce-app-url";

/** Temporary bridge: Site Secure no longer hosts Workforce screens. */
export function WorkforceLegacyRedirect() {
  const [missing, setMissing] = useState(!workforceAppOrigin());

  useEffect(() => {
    if (!workforceAppOrigin()) {
      setMissing(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const target = workforceAppUrlWithSession(window.location.pathname, window.location.search, {
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        expires_at: data.session?.expires_at,
      });
      if (!target) {
        setMissing(true);
        return;
      }
      window.location.replace(target);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4" data-testid="workforce-legacy-redirect">
      <p className="text-sm text-fg-muted">{missing ? he.workforceAppUrlMissing : he.loading}</p>
    </main>
  );
}
