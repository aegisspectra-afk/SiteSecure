import { Button, Input } from "@site-secure/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { he } from "../i18n/he";
import { createSspApi } from "../lib/api";
import {
  clearPollToken,
  readDeviceSession,
  readPollToken,
  saveDeviceSession,
  savePollToken,
} from "../lib/deviceSession";
import { platformHomeUrl } from "../lib/env";

const api = createSspApi();

export function ActivatePage() {
  const navigate = useNavigate();
  const existing = readDeviceSession();
  const [code, setCode] = useState("");
  const [pollToken, setPollToken] = useState<string | null>(() => readPollToken());
  const [message, setMessage] = useState<string | null>(null);
  const [siteHint, setSiteHint] = useState<string | null>(null);
  const claimed = useRef(false);

  useEffect(() => {
    if (existing) void navigate({ to: "/field" });
  }, [existing, navigate]);

  const activate = useMutation({
    mutationFn: () => api.activateSspSitePublic({ code: code.trim() }),
    onSuccess: (row) => {
      savePollToken(row.poll_token);
      setPollToken(row.poll_token);
      setMessage(row.message);
      setSiteHint(row.site?.name || null);
    },
    onError: (e: unknown) => setMessage(e instanceof Error ? e.message : he.apiUnavailable),
  });

  const poll = useQuery({
    queryKey: ["ssp-enroll-poll", pollToken],
    enabled: Boolean(pollToken),
    queryFn: () => api.pollSspEnrollmentPublic(pollToken!),
    refetchInterval: (q) => {
      const st = q.state.data?.status;
      if (!st || st === "pending") return 3000;
      return false;
    },
  });

  const claim = useMutation({
    mutationFn: () => api.claimSspEnrollmentPublic(pollToken!),
    onSuccess: (row) => {
      saveDeviceSession({
        device_token: row.device_token,
        expires_at: row.expires_at,
        site_id: row.site.id,
        site_name: row.site.name,
      });
      clearPollToken();
      void navigate({ to: "/field" });
    },
    onError: (e: unknown) => {
      claimed.current = false;
      setMessage(e instanceof Error ? e.message : he.apiUnavailable);
    },
  });

  useEffect(() => {
    if (poll.data?.status === "approved" && poll.data.claimable && !claimed.current && !claim.isPending) {
      claimed.current = true;
      claim.mutate();
    }
  }, [poll.data, claim]);

  const status = poll.data?.status;
  const waiting = Boolean(pollToken) && (!status || status === "pending");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4" data-testid="ssp-activate">
      <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">{he.platformBrand}</p>
      <h1 className="text-2xl font-semibold">{he.brand}</h1>
      <h2 className="text-lg font-medium">{he.activationTitle}</h2>
      <p className="text-sm text-fg-muted">{he.activationHelp}</p>
      <p className="text-xs text-fg-muted">{he.activationHelpMore}</p>

      {!pollToken ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            activate.mutate();
          }}
        >
          <Input
            id="act-code"
            label="קוד הפעלה"
            value={code}
            autoCapitalize="characters"
            autoComplete="one-time-code"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <Button type="submit" loading={activate.isPending} disabled={activate.isPending || !code.trim()}>
            {he.activationContinue}
          </Button>
        </form>
      ) : null}

      {waiting ? (
        <p className="text-sm text-fg-muted">
          {he.enrollPending}
          {siteHint ? ` · ${siteHint}` : ""}
        </p>
      ) : null}
      {status === "denied" ? <p className="text-sm text-danger">{he.enrollDenied}</p> : null}
      {status === "expired" || status === "cancelled" ? (
        <p className="text-sm text-danger">{he.enrollExpired}</p>
      ) : null}
      {message ? <p className="text-sm text-fg-muted">{message}</p> : null}
      {poll.isError ? <p className="text-sm text-danger">{he.apiUnavailable}</p> : null}

      {pollToken && status && status !== "pending" && status !== "approved" ? (
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            clearPollToken();
            setPollToken(null);
            setCode("");
          }}
        >
          {he.retry}
        </Button>
      ) : null}

      <Link to="/login" className="text-sm text-fg-muted underline">
        {he.loginTitle}
      </Link>
      <Button type="button" variant="ghost" onClick={() => window.location.assign(platformHomeUrl())}>
        {he.backToPlatform}
      </Button>
    </main>
  );
}
