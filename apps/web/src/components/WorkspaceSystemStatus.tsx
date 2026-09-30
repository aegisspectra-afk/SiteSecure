import { Status, cn, type StatusTone } from "@site-secure/ui";
import { ChevronDown } from "lucide-react";
import { LottieAnimation } from "./lottie";
import { HeaderPopover } from "./HeaderPopover";
import { he } from "../i18n/he";
import { useReducedMotion } from "../lib/use-reduced-motion";
import {
  headerHealth,
  headerHealthAriaLabel,
  headerHealthLabel,
  headerHealthSummary,
  sortSystemChecks,
  type SystemCheck,
} from "../lib/workspace-header";

const NETWORK_LOTTIE_CHIP = { width: 34, height: 28 };
const NETWORK_LOTTIE_PANEL = { width: 43, height: 36 };

const toneDotClass: Record<StatusTone, string> = {
  neutral: "bg-fg-muted",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

function checkTone(check: SystemCheck): StatusTone {
  if (check.ok) return "success";
  if (check.id === "network") return "danger";
  return "warning";
}

function NetworkLottie({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  return (
    <LottieAnimation
      name="networkConnecting"
      width={width}
      height={height}
      loop
      pauseWhenHidden={false}
      label={he.systemStatusOffline}
      className="shrink-0"
    />
  );
}

export function WorkspaceSystemStatus({ checks }: { checks: SystemCheck[] }) {
  const health = headerHealth(checks);
  const offline = health === "offline";
  const ready = health === "ready";
  const tone: StatusTone = ready ? "success" : offline ? "danger" : "warning";
  const label = headerHealthLabel(health);
  const ordered = sortSystemChecks(checks);
  const reducedMotion = useReducedMotion();

  return (
    <HeaderPopover
      menuLabel={he.systemStatusTitle}
      triggerAriaLabel={headerHealthAriaLabel(health)}
      placement="below"
      trigger={(open) => (
        <span className="flex items-center gap-1.5">
          {offline ? <NetworkLottie {...NETWORK_LOTTIE_CHIP} /> : null}
          {ready ? (
            <span className="size-2 shrink-0 rounded-full bg-success" aria-hidden />
          ) : (
            <Status label={label} tone={tone} />
          )}
          <ChevronDown
            className={cn(
              "system-status-chevron size-3.5 shrink-0 text-fg-muted opacity-70",
              !reducedMotion && "transition-transform duration-150 ease-out",
              open && "rotate-180",
            )}
            strokeWidth={1.75}
            aria-hidden
          />
        </span>
      )}
    >
      <div className="flex items-center gap-2 px-3 py-3">
        <span className={cn("size-2 shrink-0 rounded-full", toneDotClass[tone])} aria-hidden />
        <p className="text-sm font-medium text-fg">{headerHealthSummary(health)}</p>
      </div>
      <ul className="border-t border-border px-3 py-1.5">
        {ordered.map((check) => {
          const muted = check.ok && ready;
          return (
            <li
              key={check.id}
              className={cn(
                "flex items-center gap-2 py-1.5 text-sm",
                muted ? "text-fg-muted" : "text-fg",
              )}
            >
              <span className="min-w-0 flex-1 truncate">{check.label}</span>
              <span className="flex shrink-0 items-center gap-1.5">
                {check.id === "network" && !check.ok ? <NetworkLottie {...NETWORK_LOTTIE_PANEL} /> : null}
                {muted ? (
                  <span className="inline-flex items-center gap-1.5 text-[13px]">
                    <span className="size-2 rounded-full bg-success opacity-70" aria-hidden />
                    {check.detail}
                  </span>
                ) : (
                  <Status label={check.detail} tone={checkTone(check)} />
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </HeaderPopover>
  );
}
