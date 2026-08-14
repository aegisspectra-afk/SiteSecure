# SITE SECURE — COMPLETE PROJECT CONTEXT

**Status:** Source of Truth for the existing product (V1 / current codebase)  
**Generated:** 2026-08-14  
**Method:** Direct inspection of the repository. Not generated from memory or product slides.  
**Audience:** Cursor / engineers designing SITE SECURE V2

```
Study this first. This is the knowledge base of the existing SITE SECURE.
Now design V2 based on it.
```

---

## How to read this document

| Label | Meaning |
|-------|---------|
| **FACT** | Verified in source files |
| **INFERRED** | Strongly implied by code/comments but not a first-class declaration |
| **PLANNED** | Documented or scaffolded, not implemented as a working module |
| **PARTIAL** | Exists, incomplete, or gated |
| **LEGACY** | Deprecated shim, stale doc, duplicate folder, or hybrid leftover |
| **UNKNOWN / NOT FOUND** | Searched and not found in the repo |

Do **not** treat `docs/ARCHITECTURE_v1.md` or the module table in `docs/ENTERPRISE_ARCHITECTURE_v2.md` as current product status. Those documents understate what is already built (projects, site files, field, warranties, service). This file supersedes them for “what exists today.”

**Secrets:** this document lists environment **names** only. Never copy `.env` values.

---

## 1. Product identity

**FACT**

| Item | Value |
|------|--------|
| Product name | SITE SECURE |
| Package name | `site-secure` (`SiteSecure/package.json`) |
| Version | `0.1.0` |
| Domain | Field / installer SaaS for security systems (CCTV, alarm, access control, networking) |
| Language / direction | Hebrew UI, RTL (`index.html` `lang="he"` `dir="rtl"`) |
| App path | `/site-secure/` under the Aegis Spectra origin |
| Landing | Public marketing at `/site-secure/` |
| Authenticated home | `/site-secure/dashboard` |
| Field-first home for technicians | `/site-secure/field` |
| Auth owner | **Aegis** (ADR-001). SITE SECURE does not host login UI. |
| Tenant model | Multi-tenant `companies` + `company_members` |
| Current commercial motion | Founding Technician pilot (Model A) on an existing workspace |

**Position in the ecosystem (FACT from `shared/contracts/index.ts`):**

- **Aegis owns:** authentication, marketing leads, customer portal, admin center
- **SITE SECURE owns:** tenancy, CRM clients, tenant sales, catalog, quotes, projects, inventory, finance
- **Shared:** notifications, messages, profiles, files

SITE SECURE is a **field product**, not Aegis platform admin. Founding Technicians land at `/site-secure`, not SOMP/admin.

---

## 2. Monorepo layout

**Root package:** `aegis-ecosystem` (`package.json`)  
**Node:** `>=22`  
**Scripts:** `build` → `node scripts/build-netlify.mjs`; `install:apps` installs Aegis + SiteSecure.

| Path | Role | Status |
|------|------|--------|
| `SiteSecure/` | SITE SECURE Vite + React SPA | **FACT** — primary app |
| `AegisSpectraWeb/` | Aegis Spectra portal (`aegis-portal`) — marketing, auth, customer portal, admin | **FACT** |
| `AegisSpectraWebSite/` | Same `package.json` name `aegis-portal`, mirrored supabase functions/migrations | **LEGACY / DUPLICATE** — relationship to `AegisSpectraWeb` **NOT FOUND** in comments |
| `shared/contracts/` | `@aegis/contracts` domain events + ownership map | **FACT** |
| `docs/` | Architecture, ADRs, FT pilot, this file | **FACT** |
| `scripts/build-netlify.mjs` | Combined production build | **FACT** |
| `Companys/` | Folder exists | **EMPTY / NOT FOUND** |
| `.cursor/rules/founding-technician-pilot.mdc` | Cursor hard rules for FT Model A | **FACT** |

**How the two apps share a site (FACT):**

1. Production is **one static site**. Publish dir: `AegisSpectraWeb/dist-netlify`.
2. Aegis build → publish root.
3. SiteSecure build → `dist-netlify/site-secure/`.
4. SPA rewrite: `/site-secure/*` → `/site-secure/index.html`.
5. Dev: Aegis `:5173` proxies `/site-secure` → SiteSecure `:5174`. Aegis script `dev:ecosystem` starts both.
6. Same Supabase project. Shared browser auth storage key `aegis-spectra-auth`.
7. Opening SiteSecure on a **different origin** (raw `:5174` without proxy) breaks the session (ADR-001).

**Production URL (FACT from `docs/PILOT_QA_EXECUTION_REPORT.md`):**  
`https://aegis-spectra.vercel.app`  
Fallback hardcoded in `siteFiles/service.ts` if origin cannot be resolved: `https://aegis-spectra.vercel.app`.

Netlify config also exists (`netlify.toml`). Which host is “canonical” in ops beyond that QA report: **PARTIAL** (both configs present).

---

## 3. Tech stack

### SiteSecure (`SiteSecure/package.json`) — FACT

**Runtime dependencies**

| Package | Version range | Used for |
|---------|---------------|----------|
| `react` / `react-dom` | ^19.2.7 | UI |
| `@tanstack/react-router` | ^1.170.16 | Client routing |
| `@tanstack/react-query` | ^5.101.1 | Data fetching |
| `@tanstack/react-virtual` | ^3.14.6 | Virtual lists |
| `@supabase/supabase-js` | ^2.108.2 | Auth + Postgres + Storage + Edge invoke |
| `zustand` | ^5.0.14 | Quote builder store |
| `zod` | ^4.4.3 | Quote schema validation |
| `lucide-react` | ^1.21.0 | Icons |
| `clsx` + `tailwind-merge` | ^2.1.1 / ^3.6.0 | `cn()` |
| `jspdf` + `html2canvas` | ^4.2.1 / ^1.4.1 | PDF (quotes, site files, warranties) |
| `@vercel/analytics` | ^2.0.1 | Analytics in `main.tsx` |

**Dev**

`vite` ^8.1.0, `@vitejs/plugin-react`, `tailwindcss` ^4.3.1 + `@tailwindcss/vite`, `typescript` ~6.0.2, `vitest` ^4.1.10, `oxlint` ^1.69.0.

**Scripts:** `dev` (vite), `build` (`tsc -b && vite build`), `lint` (oxlint), `test` (vitest run), `preview`.

**NOT FOUND in SiteSecure:** Next.js, React Router DOM, i18n library, generated Supabase types, `App.tsx`, SiteSecure-local `netlify.toml`.

### Aegis (context only)

Aegis is Vite + React (JSX), React Router, Radix, React Hook Form. Stack split React 18 (Aegis, **INFERRED** from Aegis lockfile era / EA risk note) vs React 19 (SiteSecure) is called out as a risk in EA docs. Verify Aegis React version from `AegisSpectraWeb/package.json` if V2 unifies the stack — do not assume.

### Styling (FACT)

- Tailwind v4 `@theme` tokens in `SiteSecure/src/index.css`
- Brand primary: `#0b6bcb` (steel-blue security SaaS)
- Fonts: Heebo + Inter (Google Fonts in `index.html`)
- Operational accents: `--color-ops-*`
- No dark-mode theme switcher found as a first-class product feature (**NOT FOUND**)

---

## 4. Build, deploy, configuration

### Vite (`SiteSecure/vite.config.ts`) — FACT

- `base`: `process.env.VITE_BASE_PATH || '/site-secure/'`
- Dev port: `VITE_DEV_PORT || 5174`, `strictPort: true`, `open: false`
- Aliases: `@` → `./src`, `@aegis/contracts` → `../shared/contracts/index.ts`
- Plugin redirects `:5174/` → `/site-secure/`
- Vitest: `environment: 'node'`, `src/**/*.test.ts`

### Combined build (`scripts/build-netlify.mjs`) — FACT

1. Require `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
2. Build Aegis, then SiteSecure with `VITE_BASE_PATH=/site-secure/` and empty `VITE_AEGIS_WEB_URL` (runtime uses `window.location.origin`)
3. Copy into `AegisSpectraWeb/dist-netlify` + `_redirects`

### Host configs

| File | Facts |
|------|--------|
| `netlify.toml` | `NODE_VERSION=22`, `NETLIFY_NEXT_PLUGIN_SKIP=true`, SPA rewrites, immutable cache on `/assets` and `/site-secure/assets` |
| `vercel.json` | Same build command + output dir; install both apps; same rewrites |

### Environment variable **names** (no values)

**Used in SiteSecure `src/`**

| Name | Where |
|------|--------|
| `VITE_SUPABASE_URL` | `lib/supabase.ts` |
| `VITE_SUPABASE_ANON_KEY` | `lib/supabase.ts` |
| `VITE_FORCE_DEMO` | `lib/supabase.ts` — `'true'` forces demo even if keys exist |
| `VITE_AEGIS_WEB_URL` | `lib/ecosystem.ts`, `lib/siteFiles/service.ts` |
| `VITE_SITE_SECURE_PATH` | `lib/ecosystem.ts` (default `/site-secure`) |
| `import.meta.env.BASE_URL` | Vite built-in from `VITE_BASE_PATH` |

**Build / config only**

| Name | Where |
|------|--------|
| `VITE_BASE_PATH` | vite + build script |
| `VITE_DEV_PORT` | vite |
| `VITE_ADMIN_EMAIL` | build script list — **NOT FOUND** in SiteSecure `src/` |
| `VITE_LEAD_NOTIFY_EMAIL` | same |
| `VITE_WEB3FORMS_ACCESS_KEY` | same (Aegis marketing) |
| `VITE_SITE_SECURE_URL` | Aegis build / Netlify env |
| `VITE_SITE_SECURE_DEV_PORT` | Aegis vite proxy — **NOT** SiteSecure src |

**Documented in `SiteSecure/.env.example`:** URL, anon key (duplicated block), `VITE_BASE_PATH`, `VITE_AEGIS_WEB_URL`, `VITE_DEV_PORT`. `VITE_FORCE_DEMO` and `VITE_SITE_SECURE_PATH` are used in code but **not** listed in `.env.example` (**PARTIAL** docs).

**NOT FOUND:** `supabase/config.toml` in SiteSecure or repo root. No `database.types.ts` / `supabase gen types` script.

---

## 5. Application entry and routing

### Boot chain (FACT)

```
index.html (he / rtl)
  → src/main.tsx
      QueryClientProvider (staleTime 60s, retry 1)
        AuthProvider
          RouterProvider (TanStack Router)
          Vercel <Analytics />
```

**`App.tsx`:** **NOT FOUND**. Router is the app.

### Path constants (`lib/ecosystem.ts`) — FACT

```
SITE_SECURE_PATH     = VITE_SITE_SECURE_PATH || '/site-secure'
SITE_SECURE_HOME     = '/site-secure/'
SITE_SECURE_APP_HOME = '/site-secure/dashboard'
SITE_SECURE_ONBOARDING = '/site-secure/onboarding'
routerBasepath       = BASE_URL without trailing slash
```

Login redirect: `{Aegis}/login?returnTo={path}&product=site-secure`  
Register: `{Aegis}/register?product=site-secure` (+ `invite`, `returnTo` when token present)

### Guards (`src/router.tsx`) — FACT

| Guard | Behavior |
|-------|----------|
| `requireAuth` | No session → Aegis login. `hasWorkspace === false` → `/onboarding`. Module RBAC fail → `/dashboard`. |
| `requireIdentityOnly` | Auth required; workspace allowed (checkout success, provisioning). |
| `requireIdentityNoWorkspace` | Auth required; **must not** have workspace (onboarding, checkout). |
| `redirectAuthRoutesToAegis` | `/login` |
| External | `/register`, `/forgot-password` → Aegis |

Route RBAC uses `resolveModuleAccess(pathname)` + `hasPermission(session.role, rule.permission, session.company.plan)`. Feature flags are **not** applied in this router guard (nav filters features separately) — **FACT / gap**.

**Route-level code splitting:** **NOT FOUND** in `router.tsx` (eager page imports). Settings **sections** are lazy.

### Full route table

Public URL = `/site-secure` + path. Router paths are relative to basepath.

| Path | Page | Guard | Status |
|------|------|-------|--------|
| `/` | `LandingPage` | none | **IMPLEMENTED** (some landing sections lazy) |
| `/login` | redirect Aegis | — | **LEGACY** route |
| `/register` | redirect Aegis | invite query preserved | **LEGACY** route |
| `/forgot-password` | redirect Aegis | — | **LEGACY** route |
| `/onboarding` | `OnboardingPage` | identity, no workspace | **IMPLEMENTED** |
| `/checkout` | `CheckoutPage` | identity, no workspace | **PARTIAL** (Stripe via Edge; demo fallback) |
| `/checkout/success` | `CheckoutSuccessPage` | identity | **PARTIAL** |
| `/provisioning` | `ProvisioningPage` | identity | **IMPLEMENTED** (cinematic UI) |
| `/dashboard` | `DashboardPage` | auth + RBAC | **IMPLEMENTED** |
| `/crm` | `CrmPage` | auth + RBAC | **IMPLEMENTED** |
| `/crm/$clientId` | `Client360Page` | auth + RBAC | **IMPLEMENTED** (some 360 panels **PARTIAL**) |
| `/sales` | `SalesPage` | auth + RBAC | **IMPLEMENTED** |
| `/quotes` | `QuotesPage` | auth + RBAC | **IMPLEMENTED** |
| `/quotes/new` | `QuoteBuilderPage` | auth + RBAC | **IMPLEMENTED** |
| `/quotes/$quoteId` | `QuoteEditorPage` → same builder | auth + RBAC | **IMPLEMENTED** |
| `/catalog` | `CatalogPage` | auth + RBAC | **IMPLEMENTED** |
| `/projects` | `ProjectsPage` | auth + RBAC | **IMPLEMENTED** |
| `/installations` | redirect `/field` | auth | **LEGACY** alias |
| `/site-files` | `SiteFilesPage` | auth + RBAC | **IMPLEMENTED** (Supabase-only) |
| `/site-files/$siteFileId` | `SiteFileDetailPage` | auth + RBAC | **IMPLEMENTED** |
| `/warranties` | `WarrantiesPage` | auth + RBAC | **IMPLEMENTED** |
| `/inventory` | `ModulePlaceholder` | auth + RBAC | **PLANNED** page; catalog stock fields exist |
| `/site-planning` | `ModulePlaceholder` | auth + RBAC | **PLANNED** |
| `/finance` | `ModulePlaceholder` | auth + RBAC | **PLANNED** |
| `/service` | `ServicePage` | auth + RBAC | **IMPLEMENTED** |
| `/field` | `FieldPage` | auth + RBAC | **IMPLEMENTED** |
| `/knowledge` | `KnowledgeBasePage` | auth + RBAC | **IMPLEMENTED** |
| `/reports` | `ModulePlaceholder` | auth + RBAC | **PLANNED** |
| `/calendar` | `TasksPage` | auth + RBAC | **IMPLEMENTED** (tasks, not a full calendar product) |
| `/settings` | `SettingsPage` | auth + RBAC | **IMPLEMENTED** |
| `/settings/$section` | `SettingsPage` | auth + RBAC | **IMPLEMENTED** / some sections **PARTIAL** |

Helpers: `src/config/appRoutes.ts`.

### Module access map (`lib/permissions/routeAccess.ts`) — FACT

| Prefix | Permission | Feature |
|--------|------------|---------|
| `/dashboard` | `dashboard.view` | `core` |
| `/calendar` | `calendar.view` | `core` |
| `/crm` | `crm.view` | `crm` |
| `/sales` | `leads.view` | `sales` |
| `/quotes` | `quotes.view` | `quotes` |
| `/catalog` | `catalog.view` | `catalog` |
| `/projects` | `projects.view` | `projects` |
| `/site-files` | `projects.view` | `projects` |
| `/warranties` | `projects.view` | `projects` |
| `/installations` | `installations.view` | `installations` |
| `/inventory` | `inventory.view` | `inventory` |
| `/site-planning` | `sitePlanning.view` | `site_planning` |
| `/finance` | `finance.view` | `finance` |
| `/service` | `service.view` | `service` |
| `/field` | `service.view` | `service` |
| `/knowledge` | `projects.view` | `projects` |
| `/reports` | `reports.view` | `reports` |
| `/settings` | `settings.view` | `settings` |

**Design note for V2:** site-files / warranties / knowledge are gated as **projects**, field as **service**. There is no dedicated `site_files` or `warranties` capability.

---

## 6. Auth, identity, session

### Principles (FACT + ADR-001)

- Authentication UI lives in **Aegis**.
- SiteSecure uses `supabase.auth.getSession()` with storage key `aegis-spectra-auth`.
- Legacy key `sb-{projectRef}-auth-token` is migrated once (`lib/supabase.ts`).
- Identity without `company_members` row → `hasWorkspace: false` → onboarding. **No silent workspace create.**
- Multi-membership is loaded; `profiles.last_workspace_id` picks preferred company. Switcher UI: **PLANNED** (comment in `types/auth.ts`).

### `authService` (`lib/auth/service.ts`) — FACT

| Method | Live | Demo |
|--------|------|------|
| `getSession` | Auth + `company_members` + `profiles` | `demoAuth` |
| `createWorkspace` | RPC `create_site_secure_workspace` | demo |
| `register` | `signUp` + optional RPC `accept_company_invite` | demo |
| `login` | `signInWithPassword` | demo |
| `sendMagicLink` | OTP | demo |
| `resetPassword` | email | demo |
| `logout` | `signOut` | demo |
| `onAuthStateChange` | subscription | no-op |

Session fields: `user`, `company`, `role`, `hasWorkspace`, `memberships`, `technicianCode`, `programType`. Features hydrated separately in `AuthContext`.

### `AuthContext` — FACT

Exposes: `session`, `isLoading`, `isDemoMode`, `features`, `logout`, `refreshSession`, `can()`, `authorize()`.

On workspace session: seeds demo CRM/sales (no-op when Supabase live for seed helpers), `sessionsService.touchCurrent`, loads `company_features` intersected with plan catalog.

### Platform vs company roles (ADR-002) — FACT

| Layer | Store | Values |
|-------|--------|--------|
| Platform (Aegis) | `profiles.role` (Aegis) | customer / staff / admin / super_admin (mapped) |
| Company (SITE SECURE) | `company_members.role` | see §7 |

`super_admin` must **not** bypass SITE SECURE RLS for other companies (ADR-002).

### Invite flow (FACT)

1. Admin: Settings → Users (`UsersMembersSection`) → create invite (`invites` table).
2. Solo plan may invite only `founding_technician`, `technician`, `viewer` (`members.service.ts`).
3. Invite expires in 14 days. Email via Edge `send-company-invite` (lives in **AegisSpectraWeb**, invoked from SiteSecure).
4. Register URL can carry `invite`, `product=site-secure`, `program=founding_technician`.
5. DB RPCs: `accept_company_invite`, `peek_company_invite` (migration `028`).

**`invites` CREATE TABLE:** **NOT FOUND** in SiteSecure migrations. Altered in `015` / used in `016` / `028` / TS. Table exists remotely (**INFERRED** hybrid/restored schema).

---

## 7. Authorization (RBAC + Authorization v2)

**Docs:** `SiteSecure/docs/AUTHORIZATION_V2.md`  
**Rule:** call `decide()` / `can()` / `<Can />`. Do not hardcode `session.role === 'owner'`.

### Pipeline (`authorization/engine/decide.ts`) — FACT

```
Authenticated → TenantActive → SubscriptionValid → FeatureIncluded
  → RoleLoaded → PermissionGranted → ScopeCheck → ResourceState → BusinessRules
  → ALLOW | DENY
```

### Roles (`user_role` + `types/auth.ts`) — FACT

| Role | Label (he) | Default scope |
|------|------------|---------------|
| `owner` | בעלים | `all` |
| `administrator` | מנהל מערכת | `all` |
| `manager` | מנהל | `branch` (**UNCONFIGURED** scope → elevated only for owner/admin) |
| `sales` | מכירות | `owned` |
| `technician` | טכנאי | `assigned` |
| `founding_technician` | Founding Technician · טכנאי מייסד | `assigned` |
| `viewer` | צפייה בלבד | `all` |

Invite order: FT, technician, manager, sales, administrator, viewer.

### Capabilities (`lib/rbac/catalog.ts`) — FACT (source of grants)

Full list in file (~80). Groups: dashboard, crm, leads, quotes, catalog, projects, installations, service, inventory, sitePlanning, calendar, finance, reports, users, roles, workspace, billing, settings, api, audit.

**`founding_technician` grants:** dashboard.view; crm.view/create/edit; leads.view; quotes.view/edit/export; catalog.view; projects.view/create/edit/close; installations.\*; service.view/create/edit/close (**no** assign); calendar.view/edit; sitePlanning.view; reports.view; settings.view/general.

**FT denied (not in grant set):** users.\*, roles.\*, billing.\*, api.\*, audit.\*, settings.security/integrations/advanced/branding/pdf/notifications, crm.delete/export, leads.create/edit/delete/assign, quotes.create/delete/approve/send and cost/margin overrides, projects.delete/archive, inventory.\*, finance.\*, reports.export/financial/analytics, workspace.edit/branding/delete.

**`lib/rbac/*`:** **LEGACY shims** wrapping `decide()`. `@deprecated` comments on plan-denies-capability.

### Plans → features (`authorization/catalog/planFeatures.ts`) — FACT

Plans **never grant permissions**. They expose features.

| Plan | Features |
|------|----------|
| **solo** | core, crm, sales, catalog, quotes, projects, installations, service, settings |
| **business** | solo + inventory, site_planning, finance, reports, automation, team, audit, api |
| **enterprise** | business + ai, branches |

**Solo exception:** `users.invite` is **not** feature-gated so Solo owners can invite Founding Technicians. Seat/role rules are in `members.service` + `enforce_solo_member_limit`.

`PERMISSION_FEATURE_REQUIREMENTS` gates roles/api/audit/reports/inventory/sitePlanning/finance/billing/workspace.delete.

### Scopes (`authorization/catalog/scopes.ts`) — FACT

Configured: `all`, `owned`, `assigned`, `team`.  
**UNCONFIGURED (returns `SCOPE_NOT_CONFIGURED`):** `branch`, `region`, `department`. Owner/admin treated as allow on unconfigured.

FT `assigned`: requires `resource.assigneeUserId === user` **or** `resource.siteAssigned === true`. No open pool. **RLS is the real isolation**; UI scope must not override DB.

### Extensions

`authorization/extensions/registry.ts` — **STUB** (custom roles, temporary grants, scope resolvers).  
SSO / SCIM / JIT / multi-company UI / ABAC editor: **OUT OF SCOPE** (scaffolded only).

### UI adapters

- `authorization/adapters/react.ts` — `authorize()` used by AuthContext
- `components/auth/Can.tsx`
- `authorization/audit/log.ts` → `security_audit_events` for sensitive actions
- Edge stub: `SiteSecure/supabase/functions/authorize` — **PARTIAL** (membership + plan features, not full `decide()`)

---

## 8. SaaS packages and billing

### Marketing packages (`config/saasPackages.ts`) — FACT (copy, not billing engine)

| Plan | Price label | Notes |
|------|-------------|--------|
| Solo | ₪149 / month | “1 user”; annual 20% save copy |
| Business | ₪399 / month | “up to 15 users”; popular |
| Enterprise | custom | AI, SSO copy, dedicated CSM |

Commercial numbers in `docs/AEGIS_BUSINESS_OS.md` are marked draft there — **do not treat marketing copy as contract**.

### Plan change (`lib/billing/changePlan.ts`) — FACT

- RPC `change_site_secure_plan` + `sync_company_features_from_plan`
- Downgrade to Solo blocked if more than one active member
- Upgrade via checkout is **not** inside that RPC

### Checkout (`lib/billing/checkout.ts`) — PARTIAL

- `createBusinessCheckoutSession` → Edge `create-business-checkout-session`
- `confirmBusinessCheckout` → Edge `confirm-business-checkout`
- Function **source** lives under `AegisSpectraWeb/supabase/functions/`, not SiteSecure
- Unconfigured Supabase → demo session IDs, no Stripe

Enterprise onboarding: `submitEnterpriseWorkspaceRequest` writes `website_leads` + Telegram — **no self-serve workspace**.

---

## 9. Feature flags

Keys (`lib/features/keys.ts`):  
`core`, `crm`, `sales`, `catalog`, `quotes`, `projects`, `installations`, `inventory`, `site_planning`, `finance`, `service`, `settings`, `ai`, `api`, `reports`, `automation`, `team`, `audit`, `branches`.

Table: `company_features (company_id, feature_key, enabled)`.  
RPC: `ensure_company_features`.  
Nav: `filterNavByAccess` = feature ∩ RBAC.  
ADR-003 MVP defaults said projects off; **current** `PLAN_FEATURES.solo` includes `projects` and `installations` — ADR-003 seed comment is **STALE** vs `planFeatures.ts`.

---

## 10. UX, navigation, i18n

### Shell (`components/layout/AppShell.tsx`) — FACT

- Desktop `lg+`: sticky Sidebar (~260px)
- Mobile: `AppHeader` hamburger → `MobileDrawer`; `MobileBottomNav` fixed; main `pb` includes safe-area
- Global `ReportIssueFab` (product feedback)

### Nav groups (`config/navigation.ts`) — FACT

1. **סקירה:** שטח (`/field`, mobile primary), לוח בקרה, יומן ומשימות  
2. **מכירות ולקוחות:** לקוחות, לידים, הצעות מחיר, קטלוג  
3. **תפעול:** פרויקטים, תיקי אתר (mobile), אחריות, קריאות שירות (mobile), מלאי, תכנון אתר, מודיעין טכני  
4. **תובנות:** פיננסים, דוחות  

Secondary: external Aegis home, settings.  
Mobile primary: field, dashboard, site-files, service + “עוד” → settings.

### i18n — FACT / PARTIAL

- **No** i18n framework
- Hebrew strings hardcoded
- Settings `LocalizationLanguageSection` stores `he` / `en` on company settings — **no runtime locale switcher**
- `dir="ltr"` used on IP/MAC/codes
- PDFs use RTL HTML templates

### Design system components (`components/ui/`)

Badge, Button, Card, DataTable, Input, KpiCard, PageHeader, Select, Sheet, Skeleton, StatusChip, Textarea.

---

## 11. Feature modules (code reality)

### 11.1 Landing — IMPLEMENTED

`pages/LandingPage.tsx` + `features/landing/` (~29 section components + `landingContent.ts`). Hebrew marketing. CTAs go to Aegis login/register. Pricing from `SITE_SECURE_PACKAGES`.

### 11.2 Onboarding / provisioning / checkout — IMPLEMENTED / PARTIAL

```
/onboarding  (plan + company details)
  sessionStorage key: ss_pending_workspace
  → solo: /provisioning → create_site_secure_workspace → /dashboard
  → business: /checkout → Stripe Edge → /checkout/success → confirm → createWorkspace
  → enterprise: website_leads request (no workspace)
```

Cinematic UI: `WorkspaceProvisioningExperience`, `WelcomeWorkspaceModal`, `WorkspaceJourneyProgress`.

### 11.3 Dashboard — IMPLEMENTED

`DashboardPage` + `features/dashboard/useDashboardData.ts` + `buildOpsAlerts.ts`. KPIs, ops alerts, quick links. FT copy exists in dashboard.

### 11.4 CRM — IMPLEMENTED

Tables: `clients`, `client_contacts`, `client_notes`, `client_activities`.  
Types: private/business; active/inactive.  
Pages: list + Client 360. Demo seed in demo mode.

### 11.5 Sales / leads — IMPLEMENTED

Tenant table `leads` (not `website_leads`).  
Funnel: new → contacted → meeting → spec → quoted → follow_up → won | lost.  
Sources: website, referral, advertising, phone, other.  
`tasksService` side effects on status. Hybrid split: migration `008` renamed old leads → `website_leads`.

### 11.6 Catalog — IMPLEMENTED

`products`, `product_categories`, `product_recommendation_rules`, `quote_templates`.  
Category keys include CCTV, NVR/DVR, RISCO, access, cables, SIM, service plans, `installation_wiring_setup`.  
SKU generator, seed products in `lib/catalog/seed.ts` (**not auto-applied live**).

### 11.7 Quotes — IMPLEMENTED (deepest module)

List + metrics + **Quote Builder** (`features/quotes/builder/`, 38 files):

- Zustand store, autosave, keyboard, Zod schema
- Item types: catalog | free | service | note
- Pricing engine (client) + Edge `recalculate-quote` (server authoritative costs)
- Recommendations, AI panel component, draft versions, audit events
- PDF: `html2canvas` + `jspdf`, white-label from `company_settings`
- Statuses: draft, sent, approved, rejected, expired, cancelled
- Templates: apartment, private_house, villa, office, store, warehouse
- Offline queue service exists
- Share service exists

Tests: `pricing.engine.test.ts`, `productSearch.service.test.ts`.

### 11.8 Projects — IMPLEMENTED

Statuses: draft, planned, in_progress, on_hold, completed, cancelled.  
Review: none, requested, received, declined.  
Can create from approved quote. Events table. `site_file_id` + `assigned_to` added in migration `029`.  
Completion → `CompletionFollowUpSheet` + site-file ensure.

### 11.9 Site files (digital installation dossier) — IMPLEMENTED (Supabase required)

Site codes via RPC `next_site_code` (AS-S-\* format in `019`).  
Graph: `site_files`, `site_equipment`, `site_zones`, `site_documents`, `site_service_events`, `site_system_info`, `site_timeline_events`.  
Equipment categories: alarm panel, PIR, cameras, NVR, network, access, etc.  
Documents stored in bucket `site-documents` (private, signed URLs).  
Geocode helper + installer code decode exist in service.  
Public customer URL: `{origin}/site/{siteCode}` (Aegis `SitePortal.jsx`).

**Demo mode:** site files **do not** work (requireDb).

### 11.10 Warranties — IMPLEMENTED

Table `warranties`: number, public_token, dates, PDF paths.  
Statuses: active, expired, expiring_soon, cancelled.  
Types: manufacturer, installation, extended, maintenance_contract, expired.  
Finalize completion generates PDFs, uploads `warranty-pdfs` (public), emails via `send-warranty-pack`.  
Public URL: `{origin}/warranty/{warrantyNumber}` (`warrantyPortalUrl` is **LEGACY** alias).  
RPCs: `next_warranty_number`, `refresh_warranty_statuses`, `get_public_warranty`, `request_warranty_service`.

### 11.11 Field — IMPLEMENTED

`FieldPage`: today’s jobs = open service tickets ∪ in-progress projects.  
Maps / Waze links, start/complete, AAR sheet, completion follow-up, phone.  
`/installations` redirects here.

### 11.12 Service — IMPLEMENTED

Tickets: open, in_progress, waiting, closed; priority low/normal/high/critical.  
Contracts: basic/plus/pro; active/paused/ended.  
`site_file_id` on tickets (029). Telegram notify helpers exist.

### 11.13 Calendar / tasks — IMPLEMENTED (ops tasks, not Google Calendar)

`company_tasks` types: follow_up, call_sla, visit, review_request, service_followup, maintenance_60d, other.  
Status: open, done, cancelled.  
Auto-created from lead/quote/project flows via `ensureOpenTask`.  
Settings scheduling sections exist (hours/holidays) — **PARTIAL** product depth vs a real calendar.

### 11.14 Operations / intelligence — PARTIAL / IMPLEMENTED

Migration `027`: `site_readiness` (subsystems CCTV/alarm/access/network/power/recording/connectivity/server/firewall/wireless), assessments + items, `after_action_reports`, checklist templates, `knowledge_articles` (replaces portal legacy KB schema).  
UI: AAR sheet, command ops strip, site ops panels, Knowledge page.  
Seed: system checklists + KB articles in SQL.

### 11.15 Knowledge — IMPLEMENTED

Categories: networking, linux, cloud, security, field_ops, aegis_sop, general.  
Reads `knowledge_articles` via `operationsService.listKnowledge`.

### 11.16 Inventory / finance / reports / site-planning — PLANNED (routes)

Placeholder pages. Settings still has inventory **meta** (categories, manufacturers, units) as working CRUD. Catalog has stock fields. Plan features gate the placeholder routes on Business+.

### 11.17 Product feedback — IMPLEMENTED

FAB on AppShell. Table `product_feedback` (026 + 030 inbox workflow, issue numbers). Admin: Settings → Product Feedback. FT-oriented.

### 11.18 Settings — IMPLEMENTED (41 nav IDs; mixed depth)

Default: `account-profile`. Access levels: personal / workspace / admin (`settingsNav.ts`). All nav items marked `status: 'ready'` (**nav metadata only** — not a guarantee of full backend).

| Group | IDs |
|-------|-----|
| account | profile, preferences, notifications, security |
| workspace | general, company, branding |
| users | users (FT invites), product-feedback, roles, permissions |
| sales | quotes, products, pricing, taxes |
| inventory | categories, manufacturers, units |
| documents | pdf, quote-layout, invoice-layout |
| scheduling | calendar, hours, holidays |
| notifications | email, sms, whatsapp |
| integrations | google, outlook, whatsapp, api |
| ai | assistant, recommendations |
| security | auth, sessions, audit |
| localization | language, currency, formats |
| billing | subscription, usage |
| advanced | backup, import, export, api-keys |

**PARTIAL / coming soon in UI:**

- `DocumentsInvoiceLayoutSection` → `SettingsComingSoon`
- `SalesQuotesSection` discount-approval fields disabled (“בקרוב”)
- Many notification/integration/AI/advanced sections are forms or shells over `company_settings` columns — treat as **PARTIAL** until V2 audits each section against live writes

Access: `settingsAccess.ts` + `useSettingsAccess` (capabilities + plan features).

---

## 12. Domain services and hooks

### Services (`src/lib/`)

| Module | File | Tables / RPC | Demo |
|--------|------|----------------|------|
| Auth | `auth/service.ts` | members, profiles, RPCs | yes |
| CRM | `crm/service.ts` | clients + children | yes |
| Sales | `sales/service.ts` | leads | yes |
| Catalog | `catalog/service.ts` | products, settings, templates | yes |
| Quotes | `quotes/service.ts` | quotes, items, events, `next_quote_number` | yes |
| Projects | `projects/service.ts` | projects, events | in-memory maps |
| Tasks | `tasks/service.ts` | company_tasks | empty / throws |
| Site files | `siteFiles/service.ts` | site graph + warranties + storage | **requires DB** |
| Service ops | `service/service.ts` | tickets, contracts | empty / throws |
| Operations | `operations/service.ts` | readiness, AAR, KB, checklists | **requires DB** |
| Members | `settings/members.service.ts` | members, invites | throws |
| Assignments | `settings/assignments.service.ts` | site/job assignments | — |
| Audit | `settings/audit.service.ts` | workspace_audit_events | — |
| Sessions | `settings/sessions.service.ts` | user_device_sessions | — |
| Feedback | `settings/productFeedback.service.ts` | product_feedback | — |
| API keys | `settings/apiKeys.service.ts` | company_api_keys | — |
| Inventory meta | `settings/inventoryMeta.service.ts` | manufacturers, units, categories | localDemoStorage |
| Features | `features/service.ts` | company_features | plan defaults |
| Billing | `billing/*` | RPCs + Edge | demo checkout |
| Branding upload | `storage/brandingUpload.ts` | Storage `branding` | — |
| Telegram | `telegramNotify.ts` | Edge `send-lead-telegram` | — |
| Demo store | `demo/store.ts` | localStorage `site-secure-demo` | — |

### Hooks (`src/hooks/`)

`useClients`, `useLeads`, `useQuotes`, `useProducts`, `useProjects`, `useSiteFiles`, `useService`, `useTasks` (re-export), `useCompanyFeatures`.

Feature-local: `useDashboardData`, settings hooks, quote builder hooks.

---

## 13. Database

**Shared Postgres (INFERRED from migration comments + QA report):** one Supabase project used by Aegis + SITE SECURE. Remote project ref mentioned in comments: `flukzgqflaikmddeoica`. QA workspace id documented in `PILOT_QA_EXECUTION_REPORT.md`.

**Generated types:** **NOT FOUND**. Manual TS in `src/types/*` and inline service types.

### Migrations (`SiteSecure/supabase/migrations/`) — 31 files, FACT

Duplicate numeric prefix: `002_crm.sql` and `002_ensure_site_secure_free_workspace.sql`. Apply order from filenames **UNKNOWN** without remote history.

| File | Purpose |
|------|---------|
| `001_auth_and_companies.sql` | companies, profiles, company_members, user_role, plan_tier, RLS helpers |
| `002_crm.sql` | CRM tables |
| `002_ensure_site_secure_free_workspace.sql` | provisioning RPCs; uses `companies.owner_id` |
| `003_sales.sql` | leads |
| `004_catalog_and_quotes.sql` | catalog + quotes + company_settings |
| `005_align_restored_project.sql` | **STUB** comment only |
| `006_company_features.sql` | feature flags |
| `007_projects.sql` | projects |
| `008_split_website_and_sales_leads.sql` | website_leads vs tenant leads |
| `009_align_clients_crm.sql` | clients schema align |
| `010_quote_audit_and_versions.sql` | quote audit + drafts |
| `011_installation_wiring_category.sql` | enum value |
| `012_quote_item_types.sql` | item_type |
| `013_quote_payment_terms.sql` | payment_terms |
| `014_quote_pdf_white_label.sql` | branding PDF columns |
| `015_settings_center_complete.sql` | settings columns, manufacturers, units, api keys, audit; **alters invites** |
| `016_rbac_plan_and_role_enforcement.sql` | server RBAC, Solo seat limit, invite RPC |
| `017_business_os_ops.sql` | tasks, tickets, contracts |
| `018_site_files_and_warranties.sql` | site graph, warranties, storage buckets |
| `019_site_file_foundation.sql` | AS-S codes, timeline, public RPCs |
| `020_rebrand_aegis_spectra.sql` | comment-only |
| `021_authorization_v2.sql` | security_audit_events, user_device_sessions, feature helpers |
| `022_identity_workspace_separation.sql` | last_workspace_id, create_site_secure_workspace |
| `023_fix_create_workspace_joined_at.sql` | RPC fix |
| `024_fix_create_workspace_features_assert.sql` | RPC fix |
| `025_change_site_secure_plan.sql` | plan change RPCs |
| `026_founding_technician.sql` | FT role, AEGIS-FT-XXX, product_feedback |
| `027_operational_intelligence.sql` | ops tables + KB seed |
| `028_founding_invite_flow.sql` | Solo FT seats, accept/peek invite |
| `029_ft_assignment_access.sql` | assignment tables + FT RLS |
| `030_product_feedback_inbox.sql` | feedback inbox workflow |

Aegis migrations (`AegisSpectraWeb/supabase/migrations/`) are **platform** (portal, SOMP, marketing). Same DB **INFERRED**.

### `companies.owner_id`

Used by provisioning RPCs (`002+`, `022–025`). **NOT** in `001_auth_and_companies.sql`. **LEGACY / remote column.** V2 must not assume 001 is the full companies schema.

### Tenant tables (SiteSecure-owned, FACT unless noted)

`companies`, `profiles` (shared/hybrid with Aegis), `company_members`, `invites` (**CREATE NOT FOUND**), `clients`, `client_contacts`, `client_notes`, `client_activities`, `leads`, `website_leads` (Aegis marketing after 008), `company_settings`, `company_features`, `product_categories`, `products`, `product_recommendation_rules`, `quote_templates`, `quote_template_items`, `quotes`, `quote_items`, `quote_events`, `quote_audit_events`, `quote_draft_versions`, `projects`, `project_events`, `manufacturers`, `inventory_units`, `company_api_keys`, `workspace_audit_events`, `company_tasks`, `service_tickets`, `service_contracts`, `site_file_counters`, `warranty_counters`, `site_files`, `site_equipment`, `site_zones`, `site_documents`, `site_service_events`, `site_system_info`, `site_timeline_events`, `warranties`, `member_site_assignments`, `member_job_assignments`, `site_readiness`, `site_assessments`, `site_assessment_items`, `after_action_reports`, `checklist_templates`, `checklist_template_items`, `knowledge_articles`, `product_feedback`, `security_audit_events`, `user_device_sessions`.

### Enums (FACT)

`user_role`, `plan_tier`, `client_type`, `client_status`, `activity_type`, `lead_status`, `lead_source`, `product_category_key`, `quote_status`, `quote_template_key`, `quote_item_type`, `project_status`, `company_task_type`, `company_task_status`, `service_ticket_status`, `service_ticket_priority`, `service_contract_plan`, `service_contract_status`, `project_review_status`, `site_installation_status`, `site_equipment_category`, `site_document_type`, `warranty_status`, `site_equipment_status`, `warranty_type`, `site_timeline_event_type`, `member_job_type` (`service_ticket` \| `project` \| `company_task`).

### RLS helpers (FACT)

Core: `auth_user_company_ids`, `auth_user_role`, `auth_assert_company_member`, `auth_company_plan`, `auth_role_in` (FT satisfies `technician` lists), `auth_is_team_admin`, `auth_plan_has_feature`, `auth_feature_enabled`.

FT (029): `auth_is_founding_technician`, `auth_has_site_assignment`, `auth_site_visible`, `auth_has_job_assignment`, `auth_client_visible`, `auth_service_ticket_visible`, `auth_project_visible`.  
Trigger: `site_files_ft_auto_assign` on site INSERT.

**FT isolation coverage — PARTIAL:** assignment-scoped for site graph, warranties, clients (read/update), service tickets, projects, company tasks, readiness/assessments (conditional).  
**Still company-wide for FT unless app filters:** leads, quotes, catalog/products, client_contacts/notes/activities, service_contracts, project_events, AARs, checklists, KB (**FACT** from 029 vs 016 policies).

QA report (`PILOT_QA_EXECUTION_REPORT.md`): isolation helpers **PASS** for sites/jobs with FT JWT. Human Wave 1 smoke still **PARTIAL**.

### Storage buckets

| Bucket | In SS SQL? | Public? | Used by |
|--------|------------|---------|---------|
| `site-documents` | 018 | no | site files |
| `warranty-pdfs` | 018 | yes | warranty PDFs |
| `branding` | **NOT FOUND** in SS SQL | **UNKNOWN** | `brandingUpload.ts` |
| `documents` | Aegis 001 | yes | portal **LEGACY** |

---

## 14. Edge functions

### SiteSecure repo

| Function | Path | Status |
|----------|------|--------|
| `authorize` | `SiteSecure/supabase/functions/authorize/index.ts` | **PARTIAL** stub |
| `recalculate-quote` | `SiteSecure/supabase/functions/recalculate-quote/index.ts` | quote totals from product costs |

### Aegis repo (invoked by SITE SECURE or shared auth)

| Function | Relevance |
|----------|-----------|
| `send-company-invite` | Invite email; FT-aware |
| `send-warranty-pack` | Customer completion pack |
| `create-business-checkout-session` | Business Stripe |
| `confirm-business-checkout` | Confirm paid |
| `send-welcome-email` | Shared auth |
| `send-lead-email` / `send-lead-telegram` | Marketing / SS telegram helper |

`AegisSpectraWebSite/supabase/functions/` is a **duplicate mirror**.

---

## 15. Customer portal (Aegis-owned, SITE SECURE-related)

**FACT** — not inside SiteSecure app, but product-complete for warranties/sites:

| Aegis route | Page |
|-------------|------|
| `/site/:siteCode` | `SitePortal.jsx` — public site file |
| `/warranty/:warrantyNumber` | `WarrantyPortal` |
| `/portal/*` | Logged-in customer portal (service, documents, messages, visits, knowledge, security, profile) |

Public RPCs: `get_public_site`, `get_public_warranty`, `request_site_service`, `request_warranty_service`.

---

## 16. Founding Technician pilot (Model A)

**Docs:** `docs/FOUNDING_TECHNICIAN_PILOT.md`, `docs/PILOT_QA_CHECKLIST.md`, `docs/PILOT_QA_EXECUTION_REPORT.md`  
**Cursor rule:** `.cursor/rules/founding-technician-pilot.mdc`

**Hard product rules (do not regress in V2 without an explicit decision):**

1. One pilot workspace — not a company per tech.
2. FT is a **membership role**, not a SaaS plan.
3. Individual Auth user + profile + membership + `AEGIS-FT-XXX` + program dates. No duplicates.
4. Assignment-based data access (`member_site_assignments` / `member_job_assignments` + RLS).
5. Reuse SITE SECURE RBAC/RLS — no parallel auth system.
6. Real product at `/site-secure`, not a demo app.
7. Model B (independent Solo workspaces) later only.

Restricted: users/invite/RBAC admin, billing, API, global audit, plan-gated admin modules — **DB + capabilities**, not UI-only.

Open (scoped): dashboard, field/service, projects, site files, equipment, warranty, CRM/quotes (assigned context), calendar, basic settings, product feedback.

Program expiry does **not** auto-disable accounts.

Code: migrations `026`, `028`, `029`, `030`; grants in `lib/rbac/catalog.ts`.

---

## 17. Demo vs live

| Trigger | Mode |
|---------|------|
| Missing URL/anon key | Demo |
| `VITE_FORCE_DEMO=true` | Demo even with keys |
| Both keys present | Live |

| Layer | Live | Demo |
|-------|------|------|
| Auth, CRM, sales, catalog, quotes | Supabase | `demo/store.ts` localStorage |
| Projects | Supabase | in-memory in service file |
| Site files, tasks, service, operations, members | Supabase | empty / throw |
| Checkout | Stripe Edge | `demo_*` ids |

FT pilot is **not** demo mode. It is live SITE SECURE with a restricted role.

---

## 18. Tests

| File | Coverage |
|------|----------|
| `src/lib/rbac/rbac.solo.test.ts` | Solo owner FT invite; plan permission splits |
| `src/authorization/__tests__/decide.test.ts` | Engine: unauth, Solo/Business invite, viewer, quote state, FT scope |
| `features/quotes/builder/services/productSearch.service.test.ts` | Search ranking |
| `features/quotes/builder/services/pricing.engine.test.ts` | Pricing |
| `e2e/quote-builder.smoke.spec.ts` | Export-only case list + Playwright comment — **NOT** an executable suite |

**NOT FOUND:** component tests, FT isolation E2E, site-file/field/settings tests.

---

## 19. TypeScript types (manual)

`src/types/`: `auth.ts`, `crm.ts`, `sales.ts`, `catalog.ts`, `quotes.ts`, `projects.ts`, `siteFiles.ts`, `service.ts`, `tasks.ts`, `operations.ts`.  
`src/authorization/types.ts` — Decision, Scope, ResourceRef.

---

## 20. Shared contracts

`shared/contracts/index.ts` (`@aegis/contracts` v0.1.0).  
Events: lead.created/updated, quote.created/sent/approved/rejected, project.created, installation.completed, invoice.generated.  
Used in `projects/service.ts` via `createDomainEvent`. **PARTIAL** event bus — not a real message queue.

---

## 21. End-to-end product flows (as coded)

### A. New company (Solo)

Identity on Aegis → `/site-secure/onboarding` → pending workspace in sessionStorage → `/provisioning` → RPC `create_site_secure_workspace` → dashboard.

### B. New company (Business)

Onboarding → `/checkout` → Stripe session → `/checkout/success?session_id=` → confirm Edge → createWorkspace → dashboard.

### C. Invite member / FT

Owner Settings → Users → invite (email required) → `invites` row → `send-company-invite` → register with token → `accept_company_invite` → `/site-secure/dashboard` (FT should then only see assigned sites). Admin assigns sites/jobs.

### D. Sales → install → warranty

Lead funnel → quote builder → send/PDF → approve → `createFromQuote` project → field complete → `ensureSiteFileOnProjectComplete` → equipment/docs → `finalizeCompletion` → warranty PDF + email + public `/site/{code}`.

### E. Service day

Ticket or project appears on `/field` → navigate (Maps/Waze) → work → AAR / close ticket / complete project → 60-day maintenance task possible via task types.

---

## 22. Known issues, debt, gaps

### Verified in code

1. **FT RLS is PARTIAL** beyond sites/clients/tickets/projects/tasks — quotes/leads/catalog may still be tenant-wide.
2. **Router guard ignores feature flags** (nav hides; URL may still load if permission exists).
3. **No generated DB types** — drift risk between SQL and TS.
4. **`invites` and `companies.owner_id` not in 001** — hybrid restored schema.
5. **`branding` bucket not in SS migrations.**
6. **Duplicate `002_*` migrations; stub `005` and comment-only `020`.**
7. **`company_features` / some settings tables:** RLS enable without full policy text in early files (**PARTIAL**).
8. **Placeholder modules:** inventory, finance, reports, site-planning.
9. **No i18n runtime** despite language setting UI.
10. **Identity coupled to Aegis same-origin** (ADR-001). Standalone SS sales needs IdP phase 2–3.
11. **Quote builder is the only deep tested module.**
12. **Settings “ready” flags overstate completeness.**
13. **`AegisSpectraWebSite` duplicate** — confusion risk.
14. **Authorization extensions stub.** Manager `branch` scope not configured.
15. **Demo vs live inconsistency** — field/site/ops unusable in demo.
16. **TODO/FIXME/HACK:** **NOT FOUND** in `SiteSecure/src`. Incomplete work is expressed as placeholders / “בקרוב” / stubs instead.

### From docs (may be stale — labeled)

| Doc | Note |
|-----|------|
| `ARCHITECTURE_v1.md` | **LEGACY / Frozen** — still lists projects as placeholder |
| `ENTERPRISE_ARCHITECTURE_v2.md` | Still useful for identity/security principles; module maturity table **STALE** |
| `STAGE_A_STATUS.md` | **Historical** — Stage A done; later modules shipped anyway |
| `AUTHORIZATION_V2.md` | **Current** for authz design |
| `FOUNDING_TECHNICIAN_PILOT.md` | **Current** for Model A |
| `PILOT_QA_EXECUTION_REPORT.md` | Isolation PASS; human Wave 1 **PARTIAL**; do not re-apply 029 if already live |
| ADR-003 feature defaults | **STALE** vs `PLAN_FEATURES` |

### UNKNOWN

- Canonical production host long-term (Vercel verified in QA; Netlify config also present)
- Whether `AegisSpectraWebSite` is still deployed
- Completeness of remote schema vs local SQL (hybrid restore)
- Stripe live vs test vs unused in production **UNKNOWN** from repo alone
- Exact `invites` original CREATE

---

## 23. Source tree (SiteSecure/src)

```
src/
  authorization/     engine, catalog, policies, adapters, audit, extensions (stub)
  components/        auth, brand, catalog, crm, layout, projects, quotes, sales, ui
  config/            appRoutes, navigation, saasPackages
  contexts/          AuthContext
  features/          dashboard, feedback, landing, onboarding, operations, projects,
                     provisioning, quotes, settings, siteFiles, warranties
  hooks/             React Query domain hooks
  lib/               auth, billing, catalog, crm, demo, features, onboarding,
                     operations, permissions, projects, quotes, rbac, sales,
                     service, settings, siteFiles, storage, tasks, supabase, ecosystem
  pages/             23 page files
  types/             10 modules
  main.tsx, router.tsx, index.css
```

Non-src: `docs/AUTHORIZATION_V2.md`, `e2e/`, `public/`, `supabase/migrations` + 2 functions.

---

## 24. Related Aegis files V2 must not ignore

- `AegisSpectraWeb/src/lib/siteSecureAuth.js` — `product=site-secure` returnTo
- `AegisSpectraWeb/src/lib/ecosystem.js` — SITE SECURE path
- `AegisSpectraWeb/vite.config.js` — `/site-secure` proxy
- `AegisSpectraWeb/src/App.jsx` — `/site/:siteCode`, `/warranty/:warrantyNumber`, `/portal`
- `AegisSpectraWeb/src/pages/SitePortal.jsx`
- Edge functions listed in §14
- ADRs 001–003

---

## 25. Guidance for SITE SECURE V2

Preserve unless product explicitly changes it:

- Hebrew-first RTL field product for security installers
- Tenant = company + members + plan features + RLS
- Assignment-scoped FT (Model A) until Model B is a product decision
- Site file as the system of record for an installation (code AS-S-\*, equipment, docs, timeline, public portal)
- Quote builder economics (cost, labor, VAT, margin) as a core differentiator
- Authz as Role ∩ Feature ∩ Scope, not role string checks
- Same-origin or a real IdP — do not split cookies accidentally

Do not blindly copy:

- Placeholder modules presented as nav items
- Dual RBAC catalogs (legacy map + v2) without consolidating
- Hybrid `invites` / `owner_id` / restored-schema gaps
- AegisSpectraWebSite duplicate
- Demo store as a substitute for field modules
- Stale architecture markdown

Suggested V2 study order:

1. This file  
2. `SiteSecure/docs/AUTHORIZATION_V2.md`  
3. `docs/FOUNDING_TECHNICIAN_PILOT.md`  
4. `src/router.tsx` + `lib/rbac/catalog.ts` + `authorization/catalog/planFeatures.ts`  
5. Migrations `001`, `004`, `016`, `018`, `022`, `026–030`  
6. Quote builder + siteFiles service + FieldPage  

---

## 26. Cross-check log (generation)

Inspected: `SiteSecure/package.json`, `vite.config.ts`, `index.html`, `.env.example`, `src/main.tsx`, `src/router.tsx`, `src/index.css`, auth/supabase/ecosystem, RBAC + authorization engine, navigation, settingsNav, saasPackages, feature keys, types, services inventory, all 31 SQL migration filenames + 001/FT/RLS summaries, SiteSecure + Aegis edge functions, `netlify.toml`, `vercel.json`, `scripts/build-netlify.mjs`, `shared/contracts`, ADRs, FT/QA/authz docs, Aegis `App.jsx` portal routes, `sitePortalUrl`.

Not executed: live Supabase MCP schema dump, production Stripe probe, full line-by-line read of every settings section body.

If a later audit disagrees with a **FACT** here, treat the **code** as newer than this snapshot and update this file.
)
