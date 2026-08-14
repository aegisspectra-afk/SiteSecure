# V2 Web Architecture

**Status:** Authenticated desktop/tablet **application** of SITE SECURE V2 (`/app`) plus auth pages on the same origin.  
**Package:** `apps/web`  
**Not:** a field-first product. Technicians use mobile.  
**Not:** the visitor marketing origin — that is [V2-PUBLIC-WEB.md](./V2-PUBLIC-WEB.md).

SITE SECURE web is **one origin, two jobs**:

1. **Public Web** — visitor marketing, trust, CTAs into `/login` and `/register`  
2. **Authenticated Web** — this document: onboarding + `/app` (CRM, quotes, ops)

Tokenized `/p/s/:token` and `/p/w/:token` are a third, **noindex** public *product* surface (end-customer dossier), not marketing and not CRM.

---

## 1. Stack

| Layer | Choice |
|-------|--------|
| UI | React 19 + TypeScript |
| Build | Vite |
| Routing | TanStack Router (file routes, code-split per path) |
| Server state | TanStack Query |
| Auth session | Supabase JS (auth only) + `/api/v1/auth/session` |
| HTTP | `packages/api-client` |
| Validation | Zod on forms; server remains authority |
| Style | Tailwind v4 + `packages/design-system` tokens |
| Host | **Vercel** static Vite build (`apps/web`). FastAPI is **not** on Vercel. |
| Icons | Lucide |
| i18n | Lightweight message catalogs (he default, en stub) — no hardcoded-only Hebrew trap |

No Next.js **for `/app`**. Public marketing **must** emit crawlable HTML (SSG, prerender, or SSR) — see [V2-PUBLIC-WEB.md](./V2-PUBLIC-WEB.md) §7. That is not a license to SSR the authenticated shell. Default for `/app`: SPA + code-split routes.

---

## 2. Shell (authenticated `/app` only)

The AppShell (sidebar, workspace, user) exists **only** under `/app`. Marketing pages use a distinct public header/footer (logo, section links, התחברות / הרשמה). Do not reuse AppShell on `/`.

**Desktop (`lg+`) — `/app`**

- Sidebar (~240–260px): grouped nav, selected state obvious
- Top bar: workspace name, search later, notifications, user
- Main: page header (title + primary action) then content

**Tablet / small web**

- Collapse sidebar to rail or sheet
- Do not pretend this is the technician product

RTL: `dir="rtl"` on `<html>`. Numbers, SKUs, IPs, MACs use `dir="ltr"` spans.

---

## 3. Information architecture (authenticated management)

Groups (Hebrew labels in UI). Shown only after login + workspace, filtered by `authorize()` + features. Hidden ≠ secured.

**Do not show** placeholder modules. If inventory is not shipped, it is absent.

This IA is **not** the public marketing sitemap. Visitors never see לקוחות / הצעות מחיר as a public nav.

1. **סקירה** — Dashboard, Calendar/tasks  
2. **לקוחות ומכירות** — Customers, Leads, Quotes, Catalog  
3. **תפעול** — Projects, Jobs (ops view), Sites, Service, Warranties  
4. **משאבים** — Inventory (when feature), Knowledge  
5. **תובנות** — Reports / Finance when those features exist  
6. **הגדרות / חיוב** — Settings, Billing (owner)

---

## 4. Route map

### 4.1 Public Web and auth (same origin)

See [V2-PUBLIC-WEB.md](./V2-PUBLIC-WEB.md) for marketing IA, SEO, and CTAs.

| Path | Surface |
|------|---------|
| `/` and marketing paths | Public Web — **indexable** |
| `/login` `/register` `/forgot-password` `/reset-password` | Auth — **noindex** |
| `/onboarding` | Auth, identity without tenant — **noindex** |
| `/p/s/:token` `/p/w/:token` | Tokenized tenant customer view — **noindex**, not marketing |

### 4.2 Authenticated application

| Path | Purpose |
|------|---------|
| `/app` | Redirect to role home (dashboard or today) |
| `/app/dashboard` | Attention + next actions |
| `/app/today` | Field home on web |
| `/app/customers` `/app/customers/:id` | List + Customer 360 |
| `/app/sites` `/app/sites/:id` | List + Site File (identity first; dossier when that phase ships) |
| `/app/leads` | Funnel |
| `/app/quotes` `/app/quotes/new` `/app/quotes/:id` | List + builder |
| `/app/catalog` | Products |
| `/app/projects` | Projects |
| `/app/jobs` | Operations jobs board |
| `/app/service` | Service calls |
| `/app/warranties` | Warranties |
| `/app/tasks` | Tasks |
| `/app/settings/*` | Only real sections |

Guards for `/app`: session → workspace required → permission → feature. Hidden nav ≠ secured.

Anonymous hit to `/app/*` → `/login?returnTo=`. Never render CRM on the public origin.

---

## 5. Dashboard contract

The dashboard answers four questions only:

1. What happened?  
2. What matters?  
3. What needs attention?  
4. What should I do next?

Example attention rows: quotes awaiting approval, overloaded technician, overdue maintenance, open critical service calls, jobs without assignee.

No duplicated KPIs. No charts without a decision. No decorative maps.

---

## 6. Quote builder (flagship)

Must feel fast, clear, professional, predictable.

Always visible:

- Who is the customer / site
- What is the customer total (gross)
- Status and next action (Save draft / Send quote)
- Margin **only** if `quotes.view_cost`

Progressive disclosure: costs, internal notes, payment terms, advanced discounts behind “מתקדם”.

Autosave via API (debounced) with visible “נשמר” / error. Draft recovery from server versions, not only localStorage.

Totals displayed from last server recalculation; optimistic UI allowed, then reconcile.

---

## 7. Site File (web)

Dossier tabs: Overview, Systems, Equipment, Documents, Photos, Timeline, Service, Warranty, Readiness, Notes.

Scan-friendly: definition lists, not a wall of cards. Primary action per tab (Add system, Upload photo, Issue warranty).

---

## 8. Customer 360

Story of the relationship: contacts, sites, systems, projects, quotes, jobs, service, documents, warranties, money (when finance exists).

Primary action depends on state (Create quote, Create job, Open site).

---

## 9. Data loading

- Query keys include `workspaceId`
- Workspace switch = clear cache
- Lists paginated
- Virtualize long tables (`@tanstack/react-virtual`)
- Mutations invalidate targeted keys + rely on Realtime for cross-user updates (jobs, notifications)

---

## 10. Auth UX

SITE SECURE hosts login **on this origin**. Branding is SITE SECURE, not Aegis.

Visitor path: Public Web → `/register` or `/login` → onboarding if needed → `/app`.

After login:

- No membership → onboarding (progress that reflects real steps)
- Memberships → last workspace or picker (picker is required once multi-workspace exists; v2.0 can auto-select the only one)

No silent workspace create. The same Auth user is valid on mobile.

---

## 11. Accessibility and performance

Keyboard, focus rings, labels, dialogs, contrast, `prefers-reduced-motion`.  
Route-level code splitting. Do not download the quote builder on the dashboard.

---

## 12. Out of scope for the authenticated app

- Offline-first field completion (mobile)
- Embedding Aegis admin
- Demo mode switch
- Marketing sections, ROI calculators, or public FAQ **inside** `/app` — those belong on Public Web
- Indexing `/app` in search engines
