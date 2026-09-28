import avatarManUrl from "../assets/avatars/avatar-man.png";
import avatarWomanUrl from "../assets/avatars/avatar-woman.png";

export const ACCOUNT_AVATAR_STORAGE_KEY = "site-secure-account-avatar";
export const ACCOUNT_AVATAR_IDS = ["man", "woman"] as const;

export type AccountAvatarId = (typeof ACCOUNT_AVATAR_IDS)[number];

const AVATAR_URLS: Record<AccountAvatarId, string> = {
  man: avatarManUrl,
  woman: avatarWomanUrl,
};

type Listener = () => void;
const listeners = new Set<Listener>();

export function isAccountAvatarId(value: string | null | undefined): value is AccountAvatarId {
  return value === "man" || value === "woman";
}

export function accountAvatarUrl(id: AccountAvatarId): string {
  return AVATAR_URLS[id];
}

export function readAccountAvatarId(): AccountAvatarId {
  if (typeof window === "undefined") return "man";
  try {
    const stored = window.localStorage.getItem(ACCOUNT_AVATAR_STORAGE_KEY);
    if (isAccountAvatarId(stored)) return stored;
  } catch {
    /* ignore */
  }
  return "man";
}

export function setAccountAvatarId(id: AccountAvatarId): void {
  if (!isAccountAvatarId(id)) return;
  try {
    window.localStorage.setItem(ACCOUNT_AVATAR_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
  for (const listener of listeners) listener();
}

export function subscribeAccountAvatar(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
