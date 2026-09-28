import { ApiClientError, type PortalAccess, type PortalAccessStatus } from "@site-secure/api-client";
import { Button, Input } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { encode } from "uqr";
import { he } from "../../i18n/he";
import { copyTextToClipboard } from "../../lib/clipboard";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import {
  formatPortalExpiry,
  portalBuildFrame,
  portalBuildPlan,
  portalBuildSegmentAt,
  portalContactChoices,
  portalInitialEmail,
  portalLinkPlan,
  portalShareText,
  type PortalBuildCounts,
  type PortalBuildSegment,
} from "./portal-build";

type PortalApi = {
  listCustomerPortal: (workspaceId: string, customerId: string) => Promise<{ access: PortalAccess[] }>;
  enableCustomerPortal: (workspaceId: string, customerId: string, body: { email: string }) => Promise<PortalAccess>;
  copyCustomerPortalLink: (workspaceId: string, customerId: string, accessId: string) => Promise<PortalAccess>;
  resendCustomerPortal: (workspaceId: string, customerId: string, accessId: string) => Promise<PortalAccess>;
  revokeCustomerPortal: (workspaceId: string, customerId: string, accessId: string) => Promise<PortalAccess>;
};

const STATUS_LABEL: Record<PortalAccessStatus, string> = {
  not_enabled: he.portalStatusNotEnabled,
  invited: he.portalStatusInvited,
  active: he.portalStatusActive,
  expired: he.portalStatusExpired,
  revoked: he.portalStatusRevoked,
};

function inviteUrl(token: string): string {
  return `${window.location.origin}/portal/invite/${token}`;
}

export function portalMailto(email: string, link: string, message?: string): string {
  const subject = encodeURIComponent(he.portalShareSubject);
  const body = encodeURIComponent(message ?? portalShareText({ email, link }));
  const to = encodeURIComponent(email);
  return `mailto:${to}?subject=${subject}&body=${body}`;
}

function PortalQr({ value }: { value: string }) {
  const qr = encode(value, { ecc: "M", border: 2 });
  const cells: { x: number; y: number }[] = [];
  qr.data.forEach((row, y) => {
    row.forEach((on, x) => {
      if (on) cells.push({ x, y });
    });
  });
  return (
    <svg className="portal-qr" viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label={he.portalQrLabel}>
      <rect className="portal-qr-bg" width={qr.size} height={qr.size} />
      {cells.map((cell) => (
        <rect key={`${cell.x}-${cell.y}`} className="portal-qr-fg" x={cell.x} y={cell.y} width={1} height={1} />
      ))}
    </svg>
  );
}

function canNativeShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

function PortalBuildMeter({ plan, percent }: { plan: PortalBuildSegment[]; percent: number }) {
  const segment = portalBuildSegmentAt(plan, percent);
  const shown = Math.min(100, Math.max(0, Math.round(percent)));
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - shown / 100);
  return (
    <div
      className="portal-build"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={shown}
      aria-valuetext={`${shown}% ${segment.label}`}
    >
      <p className="portal-build-kicker">{he.portalBuildTitle}</p>
      <div className="portal-build-ring">
        <svg className="portal-build-svg" viewBox="0 0 120 120" aria-hidden="true">
          <circle className="portal-build-track" cx="60" cy="60" r={radius} />
          <circle
            className="portal-build-value"
            cx="60"
            cy="60"
            r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 60 60)"
          />
        </svg>
        <span className="portal-build-spin" aria-hidden="true" />
        <span className="portal-build-percent" dir="ltr">
          {shown}%
        </span>
      </div>
      <p className="portal-build-label">{segment.label}</p>
      {segment.detail ? <p className="portal-build-amount">{segment.detail}</p> : null}
    </div>
  );
}

export function CustomerPortalAccess({
  workspaceId,
  customerId,
  api,
  defaultEmail,
  canView,
  canCreate,
  canManage,
  canRevoke,
  variant = "profile",
  density = "full",
  buildCounts = {},
  customerName = "",
  workspaceName = "",
  contacts = [],
}: {
  workspaceId: string;
  customerId: string;
  api: PortalApi;
  defaultEmail: string;
  canView: boolean;
  canCreate: boolean;
  canManage: boolean;
  canRevoke: boolean;
  variant?: "profile" | "field";
  density?: "full" | "compact";
  buildCounts?: PortalBuildCounts;
  customerName?: string;
  workspaceName?: string;
  contacts?: { name: string; email: string }[];
}) {
  const visible = variant === "field" ? canCreate : canView || canCreate;
  const queryClient = useQueryClient();
  const reducedMotion = useReducedMotion();
  const contactChoices = portalContactChoices({ customerName, customerEmail: defaultEmail, contacts });
  const initialEmail = portalInitialEmail(defaultEmail, contactChoices);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [accessId, setAccessId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [studioNote, setStudioNote] = useState<string | null>(null);
  const [choice, setChoice] = useState(initialEmail.choice);
  const [email, setEmail] = useState(initialEmail.email);
  const [copyMode, setCopyMode] = useState<"idle" | "copied" | "manual">("idle");
  const linkRef = useRef<HTMLInputElement>(null);
  const [shareEmail, setShareEmail] = useState(defaultEmail);
  const [link, setLink] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "building" | "linking" | "ready">("idle");
  const [plan, setPlan] = useState<PortalBuildSegment[]>([]);
  const [percent, setPercent] = useState(0);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(density !== "compact");
  const [studioOpen, setStudioOpen] = useState(false);
  const studioTitleId = useId();

  const query = useQuery({
    queryKey: ["customer-portal", workspaceId, customerId],
    enabled: visible,
    retry: false,
    queryFn: () => api.listCustomerPortal(workspaceId, customerId),
  });

  function fail(err: unknown) {
    setError(err instanceof ApiClientError ? err.message : he.customersError);
  }

  const enable = useMutation({
    mutationFn: () => api.enableCustomerPortal(workspaceId, customerId, { email: email.trim() }),
    onSuccess: async (row) => {
      setError(null);
      if (!row.token) {
        setPendingUrl(null);
        setPhase("idle");
        setError(he.customersError);
        return;
      }
      setAccessId(row.id);
      setExpiresAt(row.expires_at ?? null);
      setPendingUrl(inviteUrl(row.token));
      await queryClient.invalidateQueries({ queryKey: ["customer-portal", workspaceId, customerId] });
    },
    onError: (err) => {
      setPendingUrl(null);
      setPhase("idle");
      fail(err);
    },
  });

  const rotate = useMutation({
    mutationFn: (accessId: string) => api.copyCustomerPortalLink(workspaceId, customerId, accessId),
    onSuccess: async (row) => {
      setError(null);
      if (!row.token) {
        setPhase("idle");
        setError(he.customersError);
        return;
      }
      setAccessId(row.id);
      setExpiresAt(row.expires_at ?? null);
      setPendingUrl(inviteUrl(row.token));
      await queryClient.invalidateQueries({ queryKey: ["customer-portal", workspaceId, customerId] });
    },
    onError: (err) => {
      setPhase("idle");
      fail(err);
    },
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.revokeCustomerPortal(workspaceId, customerId, id),
    onSuccess: async () => {
      setError(null);
      setLink(null);
      setPendingUrl(null);
      setPhase("idle");
      setConfirmRevoke(null);
      await queryClient.invalidateQueries({ queryKey: ["customer-portal", workspaceId, customerId] });
    },
    onError: fail,
  });

  const pendingUrlRef = useRef(pendingUrl);
  pendingUrlRef.current = pendingUrl;
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  useEffect(() => {
    if (phase !== "building" && phase !== "linking") return;
    if (plan.length === 0) return;
    let stopped = false;
    const origin = performance.now();
    let sealOrigin: number | null = null;

    const tick = () => {
      if (stopped) return;
      const now = performance.now();
      const elapsed = now - origin;
      const sealed = Boolean(pendingUrlRef.current);
      if (reducedMotionRef.current) {
        if (sealed) {
          setPercent(100);
          setLink(pendingUrlRef.current);
          setCopied(false);
          setPhase("ready");
          return;
        }
        timer = window.setTimeout(tick, import.meta.env.MODE === "test" ? 16 : 32);
        return;
      }
      const worked = portalBuildFrame({ elapsedMs: elapsed, sealElapsedMs: null, plan });
      const workedCap = portalBuildFrame({ elapsedMs: 1_000_000, sealElapsedMs: null, plan });
      if (sealed && worked.percent >= workedCap.percent - 0.05 && sealOrigin == null) sealOrigin = now;
      const frame = portalBuildFrame({
        elapsedMs: elapsed,
        sealElapsedMs: sealOrigin == null ? null : now - sealOrigin,
        plan,
      });
      setPercent(frame.percent);
      if (frame.finished && pendingUrlRef.current) {
        setLink(pendingUrlRef.current);
        setCopied(false);
        setPhase("ready");
        return;
      }
      timer = window.setTimeout(tick, import.meta.env.MODE === "test" ? 16 : 32);
    };

    let timer = window.setTimeout(tick, 16);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [phase, plan]);

  useEffect(() => {
    if (!studioOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || phase !== "idle") return;
      setStudioOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [studioOpen, phase]);

  if (!visible) return null;

  const rows = query.data?.access ?? [];
  const live = rows.filter((row) => row.status === "invited" || row.status === "active" || row.status === "expired");
  const activeCount = rows.filter((row) => row.status === "active" || row.status === "invited").length;
  const building = phase === "building" || phase === "linking";
  const showFull = density === "full" || expanded;

  function openStudio() {
    if (building) return;
    setError(null);
    setCopied(false);
    setCopyMode("idle");
    setLink(null);
    setPendingUrl(null);
    setStudioNote(null);
    setPercent(0);
    setPlan([]);
    setPhase("idle");
    setStudioOpen(true);
  }

  function closeStudio() {
    if (building) return;
    setStudioOpen(false);
  }

  function beginCreate() {
    setError(null);
    setCopied(false);
    setLink(null);
    setPendingUrl(null);
    setShareEmail(email.trim());
    setStudioNote(null);
    setCopyMode("idle");
    setPercent(0);
    setPlan(portalBuildPlan(buildCounts));
    setStudioOpen(true);
    setPhase("building");
    enable.mutate();
  }

  function beginShareLink(row: PortalAccess) {
    setError(null);
    setCopied(false);
    setLink(null);
    setPendingUrl(null);
    setShareEmail(row.email);
    setAccessId(row.id);
    setExpiresAt(row.expires_at ?? null);
    setStudioNote(row.status === "expired" ? he.portalExpiredRenew : null);
    setCopyMode("idle");
    setPercent(0);
    setPlan(portalLinkPlan());
    setStudioOpen(true);
    setPhase("linking");
    rotate.mutate(row.id);
  }

  function shareMessage(url: string): string {
    return portalShareText({ workspaceName, customerName, email: shareEmail, link: url });
  }

  async function copyShown() {
    if (!link) return;
    const result = await copyTextToClipboard(link);
    if (result === "copied") {
      setCopyMode("copied");
      setCopied(true);
      return;
    }
    setCopyMode("manual");
    setCopied(false);
    window.setTimeout(() => {
      linkRef.current?.focus();
      linkRef.current?.select();
    }, 0);
  }

  function replaceEmail() {
    if (!accessId || !canRevoke) return;
    revoke.mutate(accessId);
  }

  async function shareShown() {
    if (!link || !canNativeShare()) return;
    try {
      await navigator.share({
        title: he.portalShareSubject,
        text: shareMessage(link),
        url: link,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(he.portalShareFailed);
    }
  }

  return (
    <section
      className={`ops-card customer-360-panel${density === "compact" ? " is-portal-compact" : ""}`}
      aria-labelledby="customer-portal-access"
    >
      <div className="customer-360-portal-head">
        <div className="min-w-0">
          <h2 id="customer-portal-access" className="text-base font-semibold text-fg">
            {density === "compact" ? he.customer360PortalCompact(activeCount) : he.portalAccessTitle}
          </h2>
          {density === "full" || expanded ? (
            <p className="mt-1 text-sm text-fg-muted">
              {variant === "field" ? he.portalAccessOptional : he.portalAccessLead}
            </p>
          ) : (
            <p className="mt-1 text-xs text-fg-muted">{he.portalAccessLead}</p>
          )}
        </div>
        {density === "compact" ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? he.customer360PortalHide : he.customer360PortalManage}
          </Button>
        ) : null}
      </div>

      {showFull ? (
        <>
      {query.isLoading ? <p className="mt-3 text-sm text-fg-muted">{he.loading}</p> : null}
      {query.isError ? (
        <p className="mt-3 text-sm text-danger">
          {query.error instanceof ApiClientError ? query.error.message : he.customersError}
        </p>
      ) : null}
      {!query.isLoading && !query.isError && rows.length === 0 && !canCreate ? (
        <p className="mt-3 text-sm text-fg">{he.portalStatusNotEnabled}</p>
      ) : null}

      <ul className="mt-3 space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-[var(--radius-card)] border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-fg" dir="ltr">
                {row.email}
              </p>
              <span className="text-xs text-fg-muted">
                {row.status === "invited" ? he.portalWaitingLogin : (STATUS_LABEL[row.status] ?? row.status)}
              </span>
            </div>
            {row.status === "invited" && row.expires_at ? (
              <p className="mt-1 text-xs text-fg-muted">{he.portalExpiresOn(formatPortalExpiry(row.expires_at))}</p>
            ) : null}
            {row.status === "expired" ? (
              <p className="mt-1 text-xs text-fg-muted">
                {row.expires_at ? he.portalExpiredOn(formatPortalExpiry(row.expires_at)) : he.portalStatusExpired}
              </p>
            ) : null}
            {row.status === "active" && row.last_login_at ? (
              <p className="mt-1 text-xs text-fg-muted">
                {he.portalLastLogin}: {new Date(row.last_login_at).toLocaleString("he-IL")}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {canManage && !building && (row.status === "invited" || row.status === "expired") ? (
                <Button type="button" variant="secondary" loading={rotate.isPending} onClick={() => beginShareLink(row)}>
                  {row.status === "expired" ? he.portalResend : he.portalPrepareLink}
                </Button>
              ) : null}
              {canRevoke && row.status !== "revoked" ? (
                confirmRevoke === row.id ? (
                  <Button type="button" variant="secondary" loading={revoke.isPending} onClick={() => revoke.mutate(row.id)}>
                    {he.portalRevokeConfirm}
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" onClick={() => setConfirmRevoke(row.id)}>
                    {he.portalRevoke}
                  </Button>
                )
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {canCreate && !query.isLoading && !query.isError && live.length === 0 ? (
        <div className="mt-3">
          <Button type="button" onClick={openStudio}>
            {he.portalEnable}
          </Button>
        </div>
      ) : null}

      {canCreate && !query.isLoading && !query.isError && live.length > 0 ? (
        <div className="mt-4 border-t border-border pt-3">
          <Button type="button" variant="secondary" onClick={openStudio} disabled={building}>
            {he.portalSendLink}
          </Button>
        </div>
      ) : null}

      {error && !studioOpen ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        </>
      ) : null}
      {studioOpen ? (
        <div className="portal-studio" role="presentation">
          <div
            className="ops-card portal-studio-panel flex flex-col gap-4 p-5 shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby={studioTitleId}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id={studioTitleId} className="text-base font-semibold text-fg">
                {building ? he.portalBuildTitle : phase === "ready" ? he.portalLinkReady : he.portalEnable}
              </h2>
              <button
                type="button"
                className="rounded-[var(--radius-control)] p-2 text-fg-muted hover:bg-bg-subtle disabled:opacity-40"
                aria-label={he.cancel}
                disabled={building}
                onClick={closeStudio}
              >
                <X className="size-4" />
              </button>
            </div>

            {studioNote && building ? <p className="text-sm text-fg-muted">{studioNote}</p> : null}
            {building && plan.length > 0 ? <PortalBuildMeter plan={plan} percent={percent} /> : null}

            {!building && phase !== "ready" ? (
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  beginCreate();
                }}
              >
                <p className="text-sm text-fg-muted">{he.portalCustomerSteps}</p>
                {contactChoices.length > 0 ? (
                  <fieldset className="portal-email-choices">
                    <legend>{he.portalEmail}</legend>
                    {contactChoices.map((option) => (
                      <label key={option.email} className="portal-email-choice">
                        <input
                          type="radio"
                          name={`portal-email-choice-${customerId}`}
                          checked={choice === option.email}
                          onChange={() => {
                            setChoice(option.email);
                            setEmail(option.email);
                          }}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm text-fg">{option.label}</span>
                          <span className="block text-xs text-fg-muted" dir="ltr">
                            {option.email}
                          </span>
                        </span>
                      </label>
                    ))}
                    <label className="portal-email-choice">
                      <input
                        type="radio"
                        name={`portal-email-choice-${customerId}`}
                        checked={choice === "custom"}
                        onChange={() => {
                          setChoice("custom");
                          setEmail("");
                        }}
                      />
                      <span className="text-sm text-fg">{he.portalEmailOther}</span>
                    </label>
                  </fieldset>
                ) : null}
                {contactChoices.length === 0 || choice === "custom" ? (
                  <Input
                    id={`portal-email-${customerId}`}
                    label={he.portalEmail}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                ) : null}
                <Button type="submit" disabled={!email.trim()}>
                  {he.portalEnable}
                </Button>
              </form>
            ) : null}

            {phase === "ready" && link ? (
              <div className="space-y-3">
                <p className="text-sm text-fg-muted">{he.portalCustomerSteps}</p>
                <PortalQr value={link} />
                <input
                  ref={linkRef}
                  readOnly
                  value={link}
                  aria-label={he.portalCopyLink}
                  className="min-h-11 w-full rounded-[var(--radius-control)] border border-border bg-bg px-3 py-2 text-sm text-fg"
                  dir="ltr"
                  onFocus={(event) => event.currentTarget.select()}
                />
                {expiresAt ? (
                  <p className="text-sm text-fg">{he.portalExpiresOn(formatPortalExpiry(expiresAt))}</p>
                ) : null}
                {copyMode === "manual" ? <p className="text-sm text-fg-muted">{he.portalCopyManual}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={() => void copyShown()}>
                    {copied ? he.portalLinkCopied : he.portalCopyLink}
                  </Button>
                  <a
                    href={portalMailto(shareEmail, link, shareMessage(link))}
                    className="inline-flex min-h-11 min-w-24 items-center justify-center rounded-[var(--radius-control)] border border-border bg-bg px-4 text-sm font-medium text-fg hover:bg-bg-subtle"
                  >
                    {he.portalShareEmail}
                  </a>
                  {canNativeShare() ? (
                    <Button type="button" onClick={() => void shareShown()}>
                      {he.portalShare}
                    </Button>
                  ) : null}
                  {canRevoke && accessId ? (
                    <Button type="button" variant="ghost" loading={revoke.isPending} onClick={replaceEmail}>
                      {he.portalReplaceEmail}
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {error ? <p className="text-sm text-danger">{error}</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
