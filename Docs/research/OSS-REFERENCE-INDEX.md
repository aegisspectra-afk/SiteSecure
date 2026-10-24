# OSS Reference Index

Local clones live under `.external-reference/` (gitignored). They are for architecture / UX / integration research only — **not** part of SITE SECURE runtime, build, or deploy.

Retrieval dates (UTC): **2026-09-28** (infra/analytics refs) · **2026-09-29** (Brainwave, UI/UX Design Pro skill) · Method: `git clone --depth 1`

| Local dir | Upstream | Branch | HEAD SHA | Approx size | License (see licenses doc) |
|---|---|---|---|---|---|
| `posthog/` | https://github.com/PostHog/posthog | `master` | `40eeb716559d19325eb82b381663dd07ba9c8020` | ~999 MB | MIT + Enterprise (`ee/`) |
| `posthog-docs/` | https://github.com/PostHog/posthog.com | `master` | `9607e30be4b116b511e4fdab0c9b17e22bf1d3b8` | ~420 MB | Design restricted; `/contents/` MIT |
| `unleash/` | https://github.com/Unleash/unleash | `main` | `2923286c2ff8497ee43169556fe6f8a5f8ae96c2` | ~54 MB | AGPL-3.0 |
| `opentelemetry-js/` | https://github.com/open-telemetry/opentelemetry-js | `main` | `acd385fc533af33ccf3f0a0e2d23a1bd3627a848` | ~21 MB | Apache-2.0 |
| `papra/` | https://github.com/papra-hq/papra | `main` | `2181983bcafa9739ab9065b9ddf386388b404527` | ~57 MB | AGPL-3.0 |
| `brainwave/` | https://github.com/sanidhyy/brainwave | `main` | `601d552de7c10b686f3a7b6e7fa7a034a5c6ec6e` | ~27 MB | MIT |
| `ui-ux-design-pro-skill/` | https://github.com/saifyxpro/ui-ux-design-pro-skill | `main` | `3c24c74446e37634d33332e77db4445e2a9cac5b` | ~17 MB | MIT |

**Total:** ~1.57 GB

---

## Why each repo matters to SITE SECURE

### PostHog (`posthog/`)

**Research:** product analytics, event naming, session replay internals, feature flags, user identification, org/workspace context, error tracking, privacy controls, masking/redaction, beta analytics.

**SITE SECURE areas:** Founding Technician beta, onboarding funnel, Quote completion / abandoned flows, feature usage, feedback correlation.

**Do not integrate yet.** Prefer studying docs (below) before reverse-engineering the monorepo. Large clone (~1 GB) is mostly `products/`, `posthog/`, `frontend/`, `rust/` — keep shallow clone for now; sparse checkout possible later if disk becomes an issue.

### PostHog Docs (`posthog-docs/`)

**Research:** recommended JS integration, privacy, session replay masking, `identify` / groups, feature flags, event capture, cloud vs self-host tradeoffs.

**Prefer this over reading PostHog application code** when deciding how SITE SECURE would instrument.

Useful entry points (under `contents/docs/`):

- `product-analytics/identify.mdx`, `identity-resolution.mdx`, `group-analytics.mdx`, `capture-events.mdx`, `privacy.mdx`, `funnels.mdx`
- `session-replay/privacy.mdx`, `session-replay/_snippets/web-privacy.mdx`, `network-recording.mdx`
- `feature-flags/phased-rollout.md`, `best-practices.mdx`, `creating-feature-flags.mdx`
- `libraries/` (JS / React / etc.)

### Unleash (`unleash/`)

**Research:** feature-flag architecture, gradual rollout, targeting, kill switches, environments, auditability.

**SITE SECURE future cases:** Founding Technician-only features, experimental Infrastructure modules, Quote UX rollout, beta cohorts, emergency disable.

Key paths: `src/lib/features/` (`feature-toggle`, `environments`, `constraints`, `segment`, `client-feature-toggles`, `events`, …).

**Do not integrate yet.** License is AGPL — treat as conceptual / optional separate service.

### OpenTelemetry JS (`opentelemetry-js/`)

**Research:** browser instrumentation, trace propagation, correlation IDs, frontend→API tracing, HTTP spans, error correlation, context propagation.

**Compare with SITE SECURE today:**

- `apps/api/app/main.py` — `X-Request-Id` middleware
- `apps/api/app/deps.py` — `request_id`
- `apps/api/app/errors.py` — request id on error responses
- `audit_logs` / operational logging

**Goal later:** decide if OTel adds enough value over request IDs. **Do not instrument production yet.**

Useful paths: `packages/opentelemetry-sdk-trace-web`, `experimental/packages/opentelemetry-instrumentation-fetch`, `opentelemetry-instrumentation-http`, propagators / OTLP exporters.

### Papra (`papra/`)

**Research:** organization-scoped documents, metadata, sharing, expiration, external links, access control, browsing, upload UX.

**SITE SECURE relevance:** Site Documents, Asset Documents, configuration backups, warranty/service attachments — **patterns only**.

Useful modules: `apps/papra-server/src/modules/{documents,document-share-links,document-views,organizations,roles,storage,invitations}/`, client `apps/papra-client/src/modules/documents/`.

**Do NOT copy Papra’s application architecture wholesale** (AGPL + different product shape). SITE SECURE already has polymorphic `documents` + Supabase Storage.

### Brainwave (`brainwave/`)

**Research:** marketing / SaaS landing visual patterns — hero hierarchy, CTA styling, feature cards, pricing layout, roadmap storytelling, dark surfaces, restrained section motion.

**SITE SECURE areas:** public landing, Founding Technician onboarding framing, beta activation storytelling, future pricing/plans presentation, selective empty/intro polish. **Not** for Quote Builder, dashboard, FieldJob, Settings, Admin, or dense operational UI.

**Study doc:** `Docs/research/BRAINWAVE-REFERENCE-STUDY.md`

**Do not integrate.** Prefer conceptual adaptation into SITE SECURE design system; do not vendor Brainwave assets, purple/neon brand, or Framer/parallax stack into the product app.

### UI/UX Design Pro Skill (`ui-ux-design-pro-skill/`)

**Research:** senior UI/UX craft methodology — hierarchy, spacing, density, a11y, forms/tables, critique protocol, token *concepts*.

**SITE SECURE use:** design governance only. Extracted into:

- `Docs/design/SITE-SECURE-UI-DESIGN-RULES.md`
- `Docs/design/SITE-SECURE-UI-REVIEW-CHECKLIST.md`

**Critical conflict:** skill default “Always prefer Light Mode” is **NOT APPLICABLE TO SITE SECURE**. Dark premium shell remains first-class.

**Do not install Bun CLI, do not execute generators against the product, do not replace SITE SECURE tokens.**

---

## Cursor usage

Keep `.external-reference/` local so Cursor can open files when a future task **explicitly** asks to inspect a pattern. Always:

1. Name the source repo + path  
2. Explain the pattern  
3. Check license implications  
4. Adapt to SITE SECURE architecture  
5. Never blindly copy  

SITE SECURE remains the architectural source of truth.
