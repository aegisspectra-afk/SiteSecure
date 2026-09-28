import type { BusinessChart, DashboardSummary } from "@site-secure/api-client";
import { useEffect, useState, type ReactNode } from "react";
import { he } from "../../i18n/he";
import {
  dayPeriod,
  greetingForPeriod,
  heroSurface,
  msUntilNextDayPeriod,
  type DayPeriod,
  type HeroSurface,
} from "../../lib/greeting";
import { useTheme } from "../../lib/use-theme";
import { givenName } from "../../lib/workspace-header";
import { DashboardCommandBalance } from "./DashboardCommandBalance";
import { DashboardQuickActions } from "./DashboardQuickActions";

function formatOpsDateHeader(now = new Date()): string {
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
}

/** Boundary-aware period — updates only when crossing morning/afternoon/evening/night. */
function useDayPeriod(): DayPeriod {
  const [period, setPeriod] = useState<DayPeriod>(() => dayPeriod());

  useEffect(() => {
    let timer = 0;
    const tick = () => {
      const now = new Date();
      setPeriod(dayPeriod(now));
      timer = window.setTimeout(tick, msUntilNextDayPeriod(now));
    };
    tick();
    return () => window.clearTimeout(timer);
  }, []);

  return period;
}

type Signal = { key: string; value: number; label: string };

/**
 * Daily command hero — greeting, signals, pipeline balance, Quick Actions.
 */
export function DashboardCommandHero({
  displayName,
  roleKey,
  features,
  attentionCount = 0,
  todayCount = 0,
  quotesOpen = 0,
  showQuotes = false,
  showToday = false,
  showCreate = true,
  activationMode = false,
  summary = null,
  chart = null,
  secondaryAction,
}: {
  displayName?: string | null;
  roleKey?: string;
  features?: string[];
  attentionCount?: number;
  todayCount?: number;
  quotesOpen?: number;
  showQuotes?: boolean;
  showToday?: boolean;
  showCreate?: boolean;
  activationMode?: boolean;
  summary?: DashboardSummary | null;
  chart?: BusinessChart | null;
  secondaryAction?: ReactNode;
}) {
  const { resolved } = useTheme();
  const period = useDayPeriod();
  const surface: HeroSurface = heroSurface(resolved, period);
  const greeting = greetingForPeriod(period);
  const rawName = givenName(displayName);
  // Never greet with email locals or QA technical identifiers.
  const looksTechnical =
    !rawName ||
    rawName.includes("@") ||
    /^phase\d/i.test(rawName) ||
    /\d{6,}/.test(rawName) ||
    rawName.includes(".");
  const shortName = looksTechnical ? "" : rawName;
  const featureList = features ?? [];
  const isQuiet = attentionCount === 0;
  const statusLine = isQuiet ? he.commandQuiet : he.commandHeaderAttention(attentionCount);
  const showBalance = Boolean(showQuotes && summary);

  const signals: Signal[] = [];
  signals.push({
    key: "attention",
    value: attentionCount,
    label: he.dashSignalAttention,
  });
  if (showToday) {
    signals.push({ key: "today", value: todayCount, label: he.todayTitle });
  }
  if (showQuotes) {
    signals.push({ key: "quotes", value: quotesOpen, label: he.dashSignalQuotes });
  }
  const signalRow = signals.slice(0, 3);

  return (
    <header
      className={`ops-command-hero is-v2 is-v3 is-dense is-composed is-compact-cc is-dash12-hero ss-ops-enter ss-ops-enter-1${activationMode ? " is-activation" : ""}${isQuiet ? " is-quiet" : ""}${showBalance ? " has-balance" : ""}`}
      data-theme-tone={resolved}
      data-time-period={period}
      data-hero-surface={surface}
    >
      <div className="ops-command-hero-glow" aria-hidden />

      <div className="ops-command-hero-compose">
        {/* Lead column: greeting + signals stay together; balance is the sibling grid cell. */}
        <div className="ops-command-hero-lead min-w-0">
          <div className="ops-command-hero-identity min-w-0">
            <h1 className="ops-command-hero-hello">
              <span className="ops-command-hero-greeting">{greeting}</span>
              {shortName ? (
                <>
                  <span className="ops-command-hero-hello-sep" aria-hidden>
                    ,{"\u00A0"}
                  </span>
                  <bdi className="ops-command-hero-name">{shortName}</bdi>
                </>
              ) : null}
            </h1>
            <p className="ops-command-hero-date">{formatOpsDateHeader()}</p>
          </div>

          <div className="ops-command-hero-body is-signals">
            {activationMode || isQuiet ? (
              <p className="ops-command-hero-state is-calm" role="status">
                {statusLine}
              </p>
            ) : null}

            {signalRow.length > 0 ? (
              <p className="ops-command-hero-signals is-chips" aria-label={he.commandHeaderChipsAria}>
                {signalRow.map((signal) => {
                  const isAttention = signal.key === "attention";
                  const warn = isAttention && signal.value > 0;
                  const inner = (
                    <span className="ops-command-hero-chip-inner">
                      <span className="ops-command-hero-signal-value tabular-nums">{signal.value}</span>
                      <span className="ops-command-hero-signal-label">{signal.label}</span>
                    </span>
                  );
                  return (
                    <span
                      key={signal.key}
                      className={`ops-command-hero-chip ops-command-hero-signal${warn ? " is-warn" : ""}`}
                    >
                      {warn ? (
                        <a href="#command-attention" className="ops-command-hero-signal-link">
                          {inner}
                        </a>
                      ) : (
                        inner
                      )}
                    </span>
                  );
                })}
              </p>
            ) : null}
          </div>
        </div>

        {showBalance && summary ? (
          <DashboardCommandBalance summary={summary} chart={chart} />
        ) : null}
      </div>

      {showCreate || secondaryAction ? (
        <div className="ops-command-hero-actions-bar ss-ops-enter ss-ops-enter-2">
          <DashboardQuickActions roleKey={roleKey} features={featureList} showCreate={showCreate} />
          {secondaryAction ? <div className="ops-command-hero-secondary">{secondaryAction}</div> : null}
        </div>
      ) : null}
    </header>
  );
}
