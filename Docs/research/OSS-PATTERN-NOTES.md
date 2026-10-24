# OSS Pattern Notes (SITE SECURE)

Mapped from local clones under `.external-reference/` (2026-09-28).  
No external code was executed or installed. Patterns are recommendations only.

Timing labels: **NOW** = design / event dictionary / privacy checklist · **LATER** = optional integration · **NOT RECOMMENDED** = avoid for SITE SECURE.

---

## A. Beta / Analytics

### A1. Funnel event dictionary (PostHog Docs)

| Source | Path | What it does | Why it helps | When |
|---|---|---|---|---|
| PostHog Docs | `contents/docs/product-analytics/capture-events.mdx` | Explicit named events vs autocapture | Founding Beta needs controlled funnel metrics, not DOM noise | **NOW** (naming) |
| PostHog Docs | `contents/docs/product-analytics/funnels.mdx` | Ordered step analysis | Invite → workspace → quote → project activation | **LATER** |
| PostHog Docs | `contents/docs/product-analytics/identify.mdx` | Anonymous → identified merge | Invite open (anon) → accept/login (identified) | **NOW** (design) / **LATER** (SDK) |
| PostHog Docs | `contents/docs/product-analytics/group-analytics.mdx` | Group type = company/workspace | Map to SITE SECURE `workspace_id` | **LATER** |
| PostHog Docs | `contents/docs/product-analytics/privacy.mdx` | `ph-no-capture`, `before_send`, IP controls | Security SaaS must suppress secrets | **NOW** |

#### Recommended Founding Beta event map (do **not** implement yet)

| Proposed event | Suggested properties (non-sensitive) | Notes |
|---|---|---|
| `invite_created` | `workspace_id`, `invite_role`, `channel` | Never store raw invite token |
| `invite_opened` | `invite_id` (opaque), `workspace_id` if known | Often anonymous |
| `invite_accepted` | `workspace_id`, `role` | Call `identify` after auth |
| `workspace_entered` | `workspace_id`, `plan_key` | Group = workspace |
| `customer_created` | `workspace_id`, `customer_id` | IDs only |
| `site_created` | `workspace_id`, `site_id`, `customer_id` | |
| `quote_created` | `workspace_id`, `quote_id` | |
| `quote_item_added` | `workspace_id`, `quote_id`, `item_kind` | No prices in analytics if policy forbids |
| `quote_previewed` | `workspace_id`, `quote_id` | |
| `quote_sent` | `workspace_id`, `quote_id` | |
| `quote_public_opened` | `quote_public_token_hash` or quote id only | Never raw public token |
| `quote_approved` | `workspace_id`, `quote_id` | |
| `project_created` | `workspace_id`, `project_id`, `site_id?` | |
| `installed_assets_created` | `workspace_id`, `site_id`, `equipment_id`, `category` | No serial/IP/MAC in events by default |
| `job_opened` | `workspace_id`, `job_id` | |
| `job_completed` | `workspace_id`, `job_id` | |

**Identity transition:** after login/invite accept, `identify(stable_user_id)` then `group('workspace', workspace_id)` (PostHog docs pattern). Pass the same `distinct_id` to any future server capture.

**Autocapture:** **NOT RECOMMENDED** for Quote Builder / Site dossier without aggressive `ph-no-capture` — too easy to leak customer fields.

### A2. Feature flags for beta cohorts (PostHog Docs + Unleash)

| Source | Path | Pattern | When |
|---|---|---|---|
| PostHog Docs | `contents/docs/feature-flags/phased-rollout.md` | Percentage / cohort phased release | **LATER** |
| PostHog Docs | `contents/docs/feature-flags/best-practices.mdx` | Naming, cleanup, kill | **LATER** |
| Unleash | `src/lib/features/feature-toggle/`, `environments/`, `constraints/`, `segment/` | Env-separated toggles, targeting, audit events | **LATER** (service) / study **NOW** |

SITE SECURE already has plan/feature entitlements and platform admin flags — any new system must not fork RBAC.

---

## B. Observability

| Source | Path | Pattern | SITE SECURE today | When |
|---|---|---|---|---|
| SITE SECURE | `apps/api/app/main.py` | `X-Request-Id` in/out | Already enough for many support traces | **NOW** (keep) |
| OTel JS | `packages/opentelemetry-sdk-trace-web` | Browser tracer provider | Would add spans around UI actions | **LATER** |
| OTel JS | `experimental/packages/opentelemetry-instrumentation-fetch` | Auto-instrument `fetch` | Correlate browser → API with request id header | **LATER** |
| OTel JS | `experimental/packages/opentelemetry-instrumentation-http` | Node HTTP spans | If API moves to OTLP exporters | **LATER** |

**Assessment:** Keep strengthening request IDs + structured logs + `audit_logs` first. Add OTel only if distributed debugging across web/API/workers becomes painful.

---

## C. Feature Flags

| Source | Path | What | When |
|---|---|---|---|
| Unleash | `src/lib/features/environments/` | Prod/staging separation | **LATER** |
| Unleash | `src/lib/features/constraints/`, `segment/` | Workspace / role targeting concepts | **LATER** |
| Unleash | `src/lib/features/events/` | Flag change auditability | **LATER** |
| PostHog | Feature flags product + docs | Couple flags with analytics exposure | **LATER** |

**NOT RECOMMENDED:** Running Unleash **inside** SITE SECURE’s process (AGPL). Prefer conceptual patterns or a separately licensed/hosted flag service if needed.

---

## D. Documents

| Source | Path | Pattern | When |
|---|---|---|---|
| Papra | `apps/papra-server/src/modules/documents/` | Org-scoped document CRUD | Study **NOW**; adapt **LATER** |
| Papra | `apps/papra-server/src/modules/document-share-links/` | External share links + access | **LATER** (if SS needs expiring public site packs) |
| Papra | `apps/papra-server/src/modules/document-views/` | View tracking | **LATER** |
| Papra | `apps/papra-client/src/modules/documents/` | Upload / browse UX | UX inspiration **LATER** |
| SITE SECURE | `documents` table + Storage | Polymorphic `entity_type` / `entity_id` | **NOW** (extend, don’t replace) |

**NOT RECOMMENDED:** Replacing SITE SECURE document storage with Papra (AGPL + architecture mismatch).

---

## E. Privacy / Security

| Source | Path | Pattern | When |
|---|---|---|---|
| PostHog Docs | `session-replay/_snippets/web-privacy.mdx` | `maskAllInputs` default; password masking; `maskTextSelector`; `maskInputFn` | **NOW** (policy) / **LATER** (if replay enabled) |
| PostHog Docs | `session-replay/privacy.mdx` | Masking runs **in-browser** before network; network body scrubbing | **NOW** |
| PostHog Docs | `product-analytics/privacy.mdx` | `ph-no-capture`, `before_send` reject/sanitize, IP capture defaults | **NOW** |

### SITE SECURE must never send to analytics/replay (assume)

- Passwords, auth/session tokens, invitation tokens, API keys  
- Customer secrets / credential fields  
- Document contents / PDF bytes  
- Quote confidential commercial fields when not required for the funnel  
- Serials / IP / MAC when policy says suppress (prefer omit from events; use opaque IDs)

**Session replay for Quote Builder / Infrastructure:** default **NOT RECOMMENDED** until a strict allowlist + masking review. Prefer event analytics only for Founding Beta.

---

## F. Infrastructure

| Source | Relevance | When |
|---|---|---|
| Papra org scoping | Analogous to workspace + site document trees | Conceptual **LATER** |
| PostHog groups | Workspace-level adoption of INF modules | **LATER** |
| Unleash | Kill-switch experimental INF UI | **LATER** |

Do not use OSS repos as schema sources for Assets/IPAM — SITE SECURE INF-0 decisions remain authoritative.

---

## G. Patterns NOT appropriate for SITE SECURE

| Pattern | Why |
|---|---|
| Autocapture everything | Leaks Hebrew business UI + PII |
| Session replay on public quote links | Customer-facing commercial data |
| Shipping AGPL Unleash/Papra code into the SaaS binary | Copyleft / license risk |
| Forking PostHog `ee/` | Enterprise license restrictions |
| Copying PostHog.com marketing site design | Explicitly restricted in their LICENSE |
| Replacing `X-Request-Id` with OTel-only tracing | Lose simple support correlation |
| Analytics properties containing serials, tokens, raw addresses | Security product risk |
| Blindly copying Papra multi-app monorepo layout | Different domain; already have AppShell + Site dossier |

---

## High-priority PostHog study — answers

1. **Measure beta funnel:** define the event table above; capture from web (and optionally API) with workspace group; build a PostHog funnel Invite → Enter → Quote sent → Approved → Project/Asset.  
2. **Anonymous → authenticated:** identify on invite accept / login; merge prior anon pageviews of invite/public quote.  
3. **Workspace grouping:** `group('workspace', workspace_id)` with props `plan_key`, `is_beta`.  
4. **Replay masking:** if ever enabled — `maskAllInputs: true`, mask selectors for money/serial/IP, disable network body capture or scrub Authorization headers.  
5. **Sensitive suppression:** `before_send` drop events/properties matching token-like keys; never put invite/public tokens in properties.

**Do not implement these events in this task.**
