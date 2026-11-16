import { useCallback, useRef } from "react";

/** DEMO-3.3: a random key for one create attempt (sent as the Idempotency-Key header). */
export function newIdempotencyKey(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * The same key until the attempt succeeds, so a double click or a retry after a network error
 * returns the job the server already created instead of making a second one.
 */
export function useIdempotencyKey(): { current: () => string; renew: () => void } {
  const ref = useRef<string>(newIdempotencyKey());
  const current = useCallback(() => ref.current, []);
  const renew = useCallback(() => {
    ref.current = newIdempotencyKey();
  }, []);
  return { current, renew };
}

/**
 * Synchronous in-flight guard: a double click fires both clicks before React re-renders the
 * button as disabled, so `disabled={isPending}` alone lets the second one through.
 */
export function useSingleFlight(): { begin: () => boolean; end: () => void } {
  const busy = useRef(false);
  const begin = useCallback(() => {
    if (busy.current) return false;
    busy.current = true;
    return true;
  }, []);
  const end = useCallback(() => {
    busy.current = false;
  }, []);
  return { begin, end };
}
