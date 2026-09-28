import { useSyncExternalStore } from "react";
import {
  readAccountAvatarId,
  subscribeAccountAvatar,
  type AccountAvatarId,
} from "./account-avatar";

function getSnapshot(): AccountAvatarId {
  return readAccountAvatarId();
}

function getServerSnapshot(): AccountAvatarId {
  return "man";
}

export function useAccountAvatar(): AccountAvatarId {
  return useSyncExternalStore(subscribeAccountAvatar, getSnapshot, getServerSnapshot);
}
