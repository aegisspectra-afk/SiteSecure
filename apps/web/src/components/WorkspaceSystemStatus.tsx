import { Status, type StatusTone } from "@site-secure/ui";
import { LottieAnimation } from "./lottie";
import { HeaderPopover } from "./HeaderPopover";
import { he } from "../i18n/he";
import {
  headerHealth,
  headerHealthLabel,
  type SystemCheck,
} from "../lib/workspace-header";

const NETWORK_LOTTIE_CHIP = { width: 34, height: 28 };
const NETWORK_LOTTIE_PANEL = { width: 43, height: 36 };

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
  const tone: StatusTone = health === "ready" ? "success" : offline ? "danger" : "warning";
  return (
    <HeaderPopover
      menuLabel={he.systemStatusTitle}
      placement="below"
      trigger={
        <span className="flex items-center gap-2">
          {offline ? <NetworkLottie {...NETWORK_LOTTIE_CHIP} /> : null}
          <Status label={headerHealthLabel(health)} tone={tone} />
        </span>
      }
    >
      <div className="px-3 py-3">
        <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.systemStatusTitle}</p>
        <ul className="mt-3 flex flex-col gap-3">
          {checks.map((check) => (
            <li key={check.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-fg">{check.label}</span>
              <span className="flex items-center gap-2">
                {check.id === "network" && !check.ok ? <NetworkLottie {...NETWORK_LOTTIE_PANEL} /> : null}
                <Status label={check.detail} tone={checkTone(check)} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </HeaderPopover>
  );
}
