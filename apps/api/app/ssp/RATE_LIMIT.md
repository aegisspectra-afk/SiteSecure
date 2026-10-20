# SSP public access-code rate limiting

## Current behavior (V1)

- Location: `apps/api/app/routers/public_ssp.py` (`_code_failures` deque).
- Scope: per process memory, keyed by `sha256(token)[:16] + client IP`.
- Window: 12 failed unlock/submit code attempts per 300 seconds.
- Success path does not clear the bucket (failures only).

## Limitations

1. **Not shared across instances** — each Uvicorn/worker process has its own counter. Horizontal scale resets effective limits.
2. **Lost on restart** — process recycle clears budgets.
3. **IP spoofing** — uses `X-Forwarded-For` first hop when present; trust depends on proxy config.
4. **Does not replace auth** — only slows guessing; tokens remain the primary secret.

## Recommended shared-store approach (not implemented — needs approval)

Prefer a store already in the Site Secure / Supabase stack before adding Redis:

1. **Supabase Postgres** — table `ssp_access_code_failures (bucket text PK, fails int, window_start timestamptz)` updated via `SECURITY DEFINER` RPC from the service role on failed code checks. Pros: no new dependency. Cons: write amplification under attack.
2. **Supabase / Upstash Redis** (if already planned for API rate limits) — `INCR` + `EXPIRE` on the bucket key. Pros: cheap under load. Cons: new service + secrets.

Until an approved shared limiter ships, keep the in-process limiter as a defense-in-depth layer alongside hashed access codes and unguessable tokens.
