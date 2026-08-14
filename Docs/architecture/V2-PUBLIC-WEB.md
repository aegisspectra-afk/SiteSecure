# V2 Public Web — Marketing origin

**Status:** Binding. Public Web is a **first-class SITE SECURE V2 surface**, not a deferred landing and not a screen inside `/app`.  
**Implementation:** started — marketing origin is `/` in `apps/web`. Auth remains `/login` `/register`; product remains `/app/*`.  
**Companion:** [V2-WEB.md](./V2-WEB.md) (authenticated app), [V2-MOBILE.md](./V2-MOBILE.md), [V2-ARCHITECTURE.md](./V2-ARCHITECTURE.md)

SITE SECURE is one product with three clients of the same backend:

```
                         SITE SECURE
                              │
              ┌───────────────┼───────────────┐
              │               │               │
          PUBLIC WEB       AUTH WEB        MOBILE
              │               │               │
        Marketing origin   /app + auth    Expo app
              │               │               │
              └───────────────┼───────────────┘
                              │
                           FastAPI
                              │
                    Supabase (Auth, Postgres+RLS,
                    Storage, Realtime)
```

Visitor journey (this document):

```
Visitor
  → Marketing Website
  → Value / Trust
  → Pilot / Signup
  → Authentication
  → Onboarding
  → Authenticated Web App
```

Field journey (parallel, same account):

```
Technician
  → Mobile App
  → Same Auth user
  → Same workspace
  → Same FastAPI / Postgres
```

---

## 1. What Public Web is

The **SITE SECURE origin** a stranger can open without a workspace: Hebrew marketing, trust, pricing *copy*, FAQ, about, contact, and the doors into auth.

It is **not**:

- The authenticated application (`/app`)
- Tenant CRM (`/app/customers`, leads)
- Tokenized Site File / warranty pages (those are public **product** routes, not marketing — §6)
- Aegis marketing, Aegis auth, or `/site-secure` mount

V1 put a landing page in the same SPA as the app and sent CTAs to Aegis. V2 **REBUILDS** a SITE SECURE–owned public origin. Decision record: [V1-TO-V2.md](./V1-TO-V2.md).

---

## 2. Information architecture (visitor)

Canonical sections (one long home with anchors **or** equivalent dedicated paths — implementation choice; labels are product, not URL bikeshed):

| Section | Purpose |
|---------|---------|
| SITE SECURE / hero | Who this is for (security installers / field ops). One next action. |
| הכאב | Operational pain the product actually addresses |
| ROI | **Illustrative** framing of time/quality — never guaranteed savings (§8) |
| Site File | What a digital installation dossier *is* (concept). Not a live tenant file. |
| Digital Twin | Concept of the installed site as a living record. Not a 3D product in v2.0. |
| אמון | How work, access, and customer data are handled — only **verifiable** claims |
| פיילוט | Founding Technician / pilot **invitation to apply**, not a capacity number unless verified |
| Pricing | Plan names and **published** commercial copy; not a fake checkout |
| FAQ | Real objections |
| About | Who operates SITE SECURE |
| Contact | Human inquiry — not a tenant lead |

Auth doors (same origin):

| Path | Purpose |
|------|---------|
| `/login` | Existing user → session |
| `/register` | Signup / trial / pilot intent (`?intent=pilot` allowed) |
| `/forgot-password` `/reset-password` | Account recovery |

Optional dedicated paths: `/about`, `/contact`, `/pricing`, `/faq`. Do not invent `/app/marketing`.

---

## 3. Routing boundary

Same **product origin** (preferred). Path prefixes are the contract:

| Prefix / path | Surface | Indexed? | Session |
|---------------|---------|----------|---------|
| `/` and marketing paths above | Public Web | **Yes** (SEO) | None required |
| `/login` `/register` `/forgot-password` `/reset-password` | Auth Web | **Noindex** | Creates or recovers session |
| `/onboarding` | Auth Web | **Noindex** | JWT **without** workspace |
| `/app/*` | Authenticated Web | **Noindex** | JWT + active membership |
| `/p/s/:token` `/p/w/:token` | Public **product** (tokenized dossier/warranty) | **Noindex** | Token, not JWT |
| `/api/v1/*` | FastAPI | N/A | Per route |

Rules:

- An anonymous visitor **never** lands on `/app`.  
- A logged-in user with a workspace who opens `/` may see marketing **or** be offered “כניסה לסביבת העבודה” — do not trap them. Do not hide `/`.  
- Deep links like `/app/customers/…` without a session go to `/login?returnTo=…` then the app — **not** to a public CRM page.  
- Mobile does not render this marketing IA.

---

## 4. Authentication boundary

| Surface | Who is the user? | AuthN | AuthZ |
|---------|------------------|-------|--------|
| Public marketing | Nobody (visitor) | None | None. No `authorize()`, no RBAC roles |
| Public contact/inquiry POST | Nobody | None + rate limit + abuse controls | No workspace. **Not** `leads.create` |
| Auth pages | Identity being created or resumed | Supabase Auth | N/A |
| Onboarding | Identity, zero memberships | JWT | Must **not** create a workspace silently |
| `/app` | Member | JWT | `authorize()` + features + RLS |
| Tokenized `/p/*` | Bearer of a secret token | Token lookup in FastAPI | Narrow row, no tenant browse |
| Mobile | Same Auth user as web | JWT in secure store | Same catalog + RLS |

Public Web **does not** hold `SUPABASE_SERVICE_ROLE_KEY`.  
Browser **anon key** is only for Auth on `/login` `/register`. Marketing pages should not open a Supabase realtime channel or list tables.

After signup: verify (when configured) → `/onboarding` if no membership → `/app` (role home: dashboard or today). The **same** user can then install the Expo app and see the **same** workspace.

---

## 5. Relationship to the platform

| Layer | Public Web | Auth Web (`/app`) | Mobile |
|-------|------------|-------------------|--------|
| FastAPI | Optional: inquiry/pilot request, later public checkout. No tenant CRUD | All workspace APIs | Same workspace APIs + `/sync` |
| Supabase Auth | Signup/login pages only | Session + `/api/v1/auth/session` | Same |
| RBAC catalog | Unused | UX hide + server enforce | Same |
| RLS | No tenant queries | User JWT on every tenant call | Same |
| Storage | **Marketing assets** (repo or a **non-tenant** bucket). Never `{workspace_id}/…` | Signed URLs after `authorize()` | Same |
| Realtime | **Off** | Jobs, quotes, notifications (when that phase ships) | Same + push later |

Tenant buckets stay private. Public marketing images are not Site File photos.

---

## 6. Two different “public” pages

Do not conflate:

| | Marketing origin | Tokenized customer view |
|--|------------------|-------------------------|
| Audience | Installer considering SITE SECURE | End customer of a **tenant** |
| URL | `/`, `/pricing`, `/contact` | `/p/s/:token`, `/p/w/:token` |
| Data | Static/CMS copy | One site or warranty row |
| SEO | Index | **Noindex** |
| CRM | Must not write `customers` / tenant `leads` | Must not list the tenant’s CRM |

Tokenized routes stay specified in [V2-WEB.md](./V2-WEB.md) and [V2-API.md](./V2-API.md). They are not marketing sections.

---

## 7. SEO strategy

Public Web is a **search and trust** surface. An empty JS shell that search engines cannot read **fails** this product.

**Must:**

- Crawlable HTML for marketing routes (SSG, prerender, or SSR — **implementation choice at the Public Website phase**; not a mandate to make `/app` a Next.js app)
- `lang="he"` `dir="rtl"` on marketing documents
- Unique title + meta description per indexable path
- Canonical URLs on the SITE SECURE origin (not Aegis)
- `sitemap.xml` of **marketing** URLs only
- Open Graph for share cards (title, description, one brand image)
- `robots.txt`: allow `/`; disallow `/app`, `/onboarding`, `/p/`

**Must not:**

- Index `/app/*`, query-string workspace ids, or tokenized dossiers
- Put tenant customer names in marketing HTML
- Duplicate V1 `/site-secure/` as a second public origin without a redirect plan

Auth routes: **noindex**. Login ranking is not a goal.

---

## 8. CTA strategy

One visual peak per marketing view (same OS as the app: decision fatigue).

| Rank | CTA | Target |
|------|-----|--------|
| Primary | ניסיון / הרשמה / הצטרפות לפיילוט | `/register` (optional `intent=pilot`) |
| Secondary | התחברות | `/login` |
| Tertiary | צור קשר | `/contact` or `#contact` |

Rules:

- CTAs that require a workspace (`לקוח חדש`, Dashboard, CRM) are **absent** on Public Web.  
- Pricing CTA is register or contact — not a silent Stripe charge unless billing is live and copy is verified.  
- Pilot CTA is an application/signup, not “only 3 seats left” unless the owner verifies scarcity.  
- After auth, the app’s own primaries apply ([V2-DASHBOARD-SPEC.md](../ux/V2-DASHBOARD-SPEC.md), [V2-CRM-SPEC.md](../ux/V2-CRM-SPEC.md)).

---

## 9. Content and claim safety

Psychology on Public Web is for **clarity and trust**. Dark patterns remain forbidden ([V2-UX-PSYCHOLOGY.md](../ux/V2-UX-PSYCHOLOGY.md) §1).

**Hard rules — do not publish as fact unless the product owner has verified the claim:**

- Guaranteed savings or a calculated ROI presented as the customer’s result  
- `99.9%` (or any) availability SLO  
- Local hosting / on-prem  
- Encryption, compliance, or certification statements (ISO, SOC, GDPR “we are certified”, etc.)  
- Manufacturer partnerships (Hikvision, RISCO, …)  
- Customer counts, logos, or named case studies  
- Pilot capacity (“עשרה טכנאים”, “closed”)  
- “Digital Twin” as a shipped 3D/simulation product  
- Feature completeness that the authenticated app does not have yet  

**Allowed:**

- Illustrative ROI: labeled **לשם דוגמה** / “המחשה, לא התחייבות לחיסכון”  
- Description of Site File / Digital Twin as **product intent** clearly marked if not fully shipped  
- Pricing numbers **only** when they match the live commercial offer  
- Honest “מה קיים היום” vs “מה בדרך” — never grey fake modules on the public site either  

Copy review is a **human** gate before go-live. Engineering must not invent statistics to fill sections.

---

## 10. Conversion vs CRM

Public Contact / Pilot request is a **SITE SECURE** inquiry.

- FastAPI (when implemented): `POST /api/v1/public/inquiries` (name illustrative)  
- Stored **outside** tenant `leads` / `customers`  
- Operators of SITE SECURE (not the visitor’s future workspace) handle it  
- If a visitor later signs up, **do not** auto-insert a CRM customer or tenant lead from the inquiry unless a later explicit product rule says so  

Tenant CRM stays an **authenticated application** capability. See [V2-CRM-SPEC.md](../ux/V2-CRM-SPEC.md) (navigation + conversion only; CRM screens are not redesigned by this document).

---

## 11. UX

Public Web **may** look like a serious marketing site (hero, sections, FAQ).  
Authenticated `/app` **must not** (OS: field/ops tool, not a landing).

Shared: Hebrew-first RTL, brand `#0b6bcb`, Heebo + Inter, no emoji UI, no fake urgency.

North star here: the visitor can answer «מה מציעים לי, ולמה זה אמין, ומה הצעד הבא?» in a few seconds. Next action is signup, login, or contact — not a demo tour of `/app`.

---

## 12. Out of scope until a Public Website phase is started

- Building the marketing UI  
- CMS, blog, or multilingual site beyond he + en stub  
- Aegis-hosted landing  
- Indexing the app  
- Wiring Contact into tenant CRM  

Auth login/register **already exist** from Phase 5; this phase wraps them in a real origin and honest copy.
