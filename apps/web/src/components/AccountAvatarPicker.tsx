import type { KeyboardEvent } from "react";
import { he } from "../i18n/he";
import {
  ACCOUNT_AVATAR_IDS,
  accountAvatarUrl,
  setAccountAvatarId,
  type AccountAvatarId,
} from "../lib/account-avatar";
import { useAccountAvatar } from "../lib/use-account-avatar";

const LABELS: Record<AccountAvatarId, string> = {
  man: he.accountAvatarStyleA,
  woman: he.accountAvatarStyleB,
};

export function AccountAvatarPicker({
  id,
  labelledBy,
  showHint = true,
}: {
  id?: string;
  /** When set, hides the internal label and wires aria-labelledby to this id. */
  labelledBy?: string;
  showHint?: boolean;
}) {
  const selected = useAccountAvatar();
  const groupId = id ?? "account-avatar";
  const labelId = labelledBy ?? `${groupId}-label`;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const index = ACCOUNT_AVATAR_IDS.indexOf(selected);
    const rtl = document.documentElement.dir === "rtl";
    const forward = event.key === "ArrowRight";
    const delta = rtl ? (forward ? -1 : 1) : forward ? 1 : -1;
    const next = ACCOUNT_AVATAR_IDS[(index + delta + ACCOUNT_AVATAR_IDS.length) % ACCOUNT_AVATAR_IDS.length];
    setAccountAvatarId(next);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {labelledBy ? null : (
        <p id={labelId} className="text-xs text-fg-muted">
          {he.accountAvatarLabel}
        </p>
      )}
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="grid grid-cols-2 gap-1.5"
        onKeyDown={onKeyDown}
      >
        {ACCOUNT_AVATAR_IDS.map((value) => {
          const active = selected === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={LABELS[value]}
              className={
                active
                  ? "flex items-center gap-2 rounded-[var(--radius-control)] border border-action bg-bg-1 px-2.5 py-1.5 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  : "flex items-center gap-2 rounded-[var(--radius-control)] border border-border bg-bg-subtle px-2.5 py-1.5 text-start hover:bg-bg-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              }
              onClick={() => setAccountAvatarId(value)}
            >
              <span className="relative size-8 shrink-0 overflow-hidden rounded-full border border-border bg-bg-subtle">
                <img
                  src={accountAvatarUrl(value)}
                  alt=""
                  width={32}
                  height={32}
                  decoding="async"
                  className="size-full object-cover"
                />
              </span>
              <span className={active ? "text-sm font-medium text-fg" : "text-sm text-fg-muted"}>
                {LABELS[value]}
              </span>
            </button>
          );
        })}
      </div>
      {showHint ? <p className="text-[11px] leading-snug text-fg-muted">{he.accountAvatarHint}</p> : null}
    </div>
  );
}
