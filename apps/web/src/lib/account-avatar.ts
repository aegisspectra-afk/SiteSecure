import avatarManUrl from "../assets/avatars/avatar-man.png";
import avatarWomanUrl from "../assets/avatars/avatar-woman.png";
import { supabase } from "./supabase";

export const ACCOUNT_AVATAR_STORAGE_KEY = "site-secure-account-avatar";
export const ACCOUNT_AVATAR_METADATA_KEY = "account_avatar";
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

function writeLocal(id: AccountAvatarId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACCOUNT_AVATAR_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

function notify(): void {
  for (const listener of listeners) listener();
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

/** Apply remote preference into the local cache used by the UI. */
export function hydrateAccountAvatarFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): AccountAvatarId | null {
  const raw = metadata?.[ACCOUNT_AVATAR_METADATA_KEY];
  if (!isAccountAvatarId(typeof raw === "string" ? raw : null)) return null;
  if (readAccountAvatarId() === raw) return raw;
  writeLocal(raw);
  notify();
  return raw;
}

/**
 * Optimistic local update + sync to the signed-in Supabase user (cross-device).
 * Local cache remains for instant UI; remote write is best-effort with silent retry on next select.
 */
export function setAccountAvatarId(id: AccountAvatarId): void {
  if (!isAccountAvatarId(id)) return;
  writeLocal(id);
  notify();
  void supabase.auth.updateUser({ data: { [ACCOUNT_AVATAR_METADATA_KEY]: id } }).then(({ error }) => {
    if (error && typeof console !== "undefined") {
      console.warn("account-avatar sync failed", error.message);
    }
  });
}

/** On sign-in: pull remote preference, or push local cache once if remote is empty. */
export function syncAccountAvatarWithUser(metadata: Record<string, unknown> | null | undefined): void {
  const remote = hydrateAccountAvatarFromMetadata(metadata);
  if (remote) return;
  const local = readAccountAvatarId();
  void supabase.auth.updateUser({ data: { [ACCOUNT_AVATAR_METADATA_KEY]: local } });
}

export function subscribeAccountAvatar(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
