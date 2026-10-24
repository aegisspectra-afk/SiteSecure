# SETTINGS-3A CURRENT SETTINGS AUDIT

**Date:** 2026-09-29  
**Mode:** READ-ONLY inventory (no UI/API/route/migration changes)  
**Sources:** `SettingsShell.tsx`, settings routes under `apps/web/src/routes/app/settings/`, `workspace-prefs.ts`, `packages/authz/catalog.json`, `apps/api` consumption paths, theme/avatar libs

---

## 1. Current route inventory

| Route | Component | Visible label | Nav group | Permission(s) | In Settings nav when allowed |
|---|---|---|---|---|---|
| `/app/settings` (layout) | `settings/route.tsx` → `SettingsShell` | — | — | — | shell always wraps children |
| `/app/settings/` | `settings/index.tsx` | כללי | חשבון וסביבה | `workspace.edit` | yes |
| `/app/settings/company` | `company.tsx` | פרטי חברה ומיתוג | חשבון וסביבה | `workspace.edit` **or** `settings.branding` | yes |
| `/app/settings/appearance` | `appearance.tsx` | מראה | חשבון וסביבה | `workspace.edit` | yes |
| `/app/settings/quotes` | `quotes.tsx` | הצעות מחיר | מסחרי | `workspace.edit` | yes |
| `/app/settings/numbering` | `numbering.tsx` | מספור | מסחרי | `workspace.edit` | yes |
| `/app/settings/pdf-templates` | `pdf-templates.tsx` | תבניות מסמכים | מסחרי | `workspace.edit` | yes |
| `/app/settings/sites` | `sites.tsx` | אתרים | תפעול | `workspace.edit` | yes |
| `/app/settings/notifications` | `notifications.tsx` | התראות | תפעול | `workspace.edit` | yes |
| `/app/settings/users` | `users.tsx` | צוות | צוות וגישה | `users.view` | yes |
| `/app/settings/roles` | `roles.tsx` | תפקידים והרשאות | צוות וגישה | `roles.manage` (+ plan `team` feature for edit) | yes |
| `/app/settings/security` | `security.tsx` | אבטחה | צוות וגישה | `settings.general` **or** `workspace.edit` | yes |
| `/app/settings/system` | `system.tsx` | הגדרות מערכת | מתקדם | `workspace.edit` | yes |
| `/app/settings/audit` | `audit.tsx` | יומן ביקורת | מתקדם | `audit.view` | yes |

**Related but outside `/app/settings*`:**
- `/forgot-password`, `/reset-password` — auth, not settings nav
- Theme also in `UserAccountMenu` (not a settings route)
- Platform Admin under `/admin/*` — not under settings; not linked from system page beyond workspace audit/security

**No orphaned settings routes found** — all registered routes appear in `SettingsShell` when permission allows.

---

## 2. Current visible IA

### Product-owner reported IA vs implementation

Owner report **omitted three items that exist in code for `workspace.edit` / privileged roles:**

| Reported | Implemented |
|---|---|
| חשבון וסביבה: כללי, פרטי חברה | **+ מראה** |
| מסחרי: הצעות, מספור, תבניות | match |
| תפעול: אתרים, התראות | match |
| צוות וגישה: צוות, אבטחה | **+ תפקידים והרשאות** (when `roles.manage`) |
| מתקדם: הגדרות מערכת | **+ יומן ביקורת** (when `audit.view`) |

So the reported IA is a **subset** of Owner/Admin reality, not an exact match.

Group labels in code: `חשבון וסביבה` · `מסחרי` · `תפעול` · `צוות וגישה` · `מתקדם`.

---

## 3. General settings (`/app/settings`)

| Field | Source | API | Editable | Persistence | Validation | Permission | Save |
|---|---|---|---|---|---|---|---|
| Workspace name | `workspaces.name` | `GET/PATCH /workspaces/{id}` | yes | DB workspace | required non-empty | `workspace.edit` | explicit Save, dirty-gated |
| Timezone | `workspaces.timezone` | same | yes | DB | free text (no IANA picker validation) | same | same |
| VAT % | `workspaces.vat_percent` | same | yes | DB | 0–100 number | same | same |
| Currency | hardcoded UI | none | **read-only** | N/A (ILS locked) | — | same | — |
| Avatar (גבר/אישה) | Supabase `user_metadata.account_avatar` + local cache | `supabase.auth.updateUser` | yes | user-global auth metadata (+ localStorage cache) | enum `man`\|`woman` | same page gate; no separate avatar perm | **immediate** (no form Save) |

**Not on General:** `full_name`, `phone`, `locale` (exist on `profiles` / `PATCH /me` but not editable here).

---

## 4. Company / branding (`/app/settings/company`)

**Gate:** `workspace.edit` ∨ `settings.branding`.

**Persists via** `PATCH workspace settings` → `branding` JSON (+ logo upload intent/complete).

**Fields (all editable unless noted):**
- Identity: display name (required), legal name, business number type, business number, tax status
- Contact/address: address lines, city, postal, phone, email, website
- Brand: logo (immediate upload ≤2MB), brand primary, brand accent
- Payment: bank fields, payment instructions, show-on-documents
- Preview actions: quote / tax_invoice PDF preview (not settings fields); link to PDF templates

**Overlap with General:**  
- Workspace **name** (General) ≠ company **displayName** (Company) — different stores; intentional separation with UI hint.  
- VAT lives on workspace (General); company has separate **taxStatus** taxonomy — not duplicate VAT%.

---

## 5. Quote settings (`/app/settings/quotes`)

| Setting | Exists | Persists (`workspace_settings.quotes`) | Applied to new quotes / runtime |
|---|---|---|---|
| Default validity days | yes | yes (`validity_days`) | **No** — create quote does not set `valid_until` from prefs |
| Payment terms | yes | yes (`payment_terms`) | **Partial** — merged into PDF template snapshot when template lacks `paymentTerms` |
| Show VAT on quotes | yes | yes (`show_vat`) | **No** — PDF uses template `showVat`; workspace flag unread in API |
| PDF notes | yes | yes (`pdf_notes`) | **Yes** — merged into PDF template notes on snapshot |
| Approval settings | **no UI** | — | — |
| Default template picker | **no** on this page | — | default lives under PDF templates |

Save: explicit, dirty-gated, success/error.

---

## 6. Numbering (`/app/settings/numbering`)

| Prefix | Persists | Applied |
|---|---|---|
| Quote prefix | `localization.quote_prefix` | **Yes** — DB trigger `quotes_set_number()` |
| Project prefix | `localization.project_prefix` | **No consumer found** |
| Site-file prefix | `localization.site_file_prefix` | **No consumer found** |

UI shows examples only; next sequence number not exposed. Save: dirty-gated.

---

## 7. PDF templates (`/app/settings/pdf-templates`)

Full template studio for **quote** PDFs: list/create/duplicate, name, status (draft/active/archived), set default, config toggles (branding/header/customer/lines/totals/terms/approval/footer), live preview.

- Exists + persists + applied when generating quote PDFs.
- Company missing fields surface as warnings linking to Company.
- Gate: `workspace.edit`.
- Save: per-template dirty bar (not the same prefs form pattern).

---

## 8. Sites (`/app/settings/sites`)

Toggles: require address / contact / access notes → `scheduling.sites.*`.

**Persists: yes. Applied: no** — site create UI/API does not enforce these prefs.

---

## 9. Notifications (`/app/settings/notifications`)

Toggles: quote viewed / quote approved / job overdue / team invite → `notifications.events.*`.

**Persists: yes. Applied: no** — no API consumer found that sends mail/push based on these flags.

---

## 10. Team (`/app/settings/users`)

| Capability | Present | Permission |
|---|---|---|
| List active members | yes | `users.view` |
| Invite by email + role | yes | `users.invite` |
| Pending invitations list | yes | `users.invite` |
| Revoke pending invite | yes | `users.invite` |
| Reissue invite | yes | `users.invite` |
| Change member role | yes | `users.manage` |
| Activate/deactivate member | yes | `users.manage` |
| Seat usage meters | yes | view with members |
| Owner self-protection / owner assign rules | yes | special-cased |

Not Platform Admin. No separate “owner transfer” settings UI beyond role rules.

---

## 11. Security (`/app/settings/security`)

**Read-only signal list** from `GET …/security` (`getSecurityCenter`). No password/MFA/session management UI.

| Signal key | Typical status |
|---|---|
| `authentication` | healthy |
| `rbac` | healthy |
| `tenant_isolation` | healthy |
| `audit_logging` | healthy or not_in_plan |
| `api_security` | healthy |
| `sessions` | **not_built** |

| Capability | Exposed in Security settings? | Elsewhere |
|---|---|---|
| Password change | **no** | `/reset-password` after recovery only |
| Password recovery | **no** | `/forgot-password` (public) |
| Active sessions | **no** (signal says not built) | — |
| MFA | **no** | — |
| Account email edit | **no** | email from auth session display only |
| Login/security events UI | **no** | audit log is separate page |

---

## 12. System / Advanced (`/app/settings/system`)

Read-only membership meta: workspace name, `plan_key`, `role_key`, workspace status. Links to Security + Audit.

| Item | Classification |
|---|---|
| Workspace name / status | support/operator info (duplicative of General) |
| Plan / role keys | developer/operator diagnostics |
| Links | navigation shortcuts |

**No Platform Admin controls.** Soft content — low operational value as a settings page.

---

## 13. Personal profile capabilities

| Capability | Stored | Editable where | Scope | In Settings? |
|---|---|---|---|---|
| Full name | `profiles.full_name` | onboarding / register via `PATCH /me` | user-global | **not** as profile editor (display only elsewhere) |
| Phone | `profiles.phone` | API supports `patchMe`; **no settings UI** | user-global | no |
| Locale | `profiles.locale` | set `"he"` on onboarding; **no settings UI** | user-global | no |
| Email | auth user | not editable in-app | user-global | display only |
| Avatar illustration | `user_metadata.account_avatar` (+ local cache) | General → פרופיל אישי | user-global (synced) | yes (under General) |
| Personal timezone | — | — | — | **does not exist** (only workspace TZ) |
| Profile photo upload | `profiles.avatar_path` in schema | **no product UI found** | — | no |

**Conclusion:** There is a **partial** personal profile model (`profiles` + auth metadata). A future `/app/settings/profile` can use **existing** `PATCH /me` + avatar sync **without new architecture** for name/phone/locale/avatar; photo upload would need new product work on `avatar_path`.

---

## 14. Appearance / theme capabilities

| Capability | Exists | Persistence | Where |
|---|---|---|---|
| Light / dark / system | yes (`ThemePicker`) | `localStorage` key `site-secure-theme` | `/app/settings/appearance` **and** account menu |
| Density | no | — | — |
| Accent/brand for app chrome | no (company brand colors are document branding) | — | Company |

**Why מראה may be “missing” from owner report:** it **is** in nav for `workspace.edit`, but theme is also reachable from the account menu, so it is easy to overlook as a dedicated settings category. Gated as **workspace** permission though preference is **device-local** — placement mismatch.

---

## 15. Save behavior

| Page | Pattern | Dirty | Saving | Success | Error | Unsaved navigate guard |
|---|---|---|---|---|---|---|
| General (workspace fields) | explicit Save | yes | yes | flash | alert | **no** |
| General (avatar) | immediate | n/a | silent sync | none | console warn | n/a |
| Company | explicit Save | yes | yes | flash | alert | **no**; logo immediate |
| Quotes / Numbering / Sites / Notifications | explicit Save | yes | yes | flash | alert | **no** |
| PDF templates | explicit Save bar | yes | yes | in-editor | yes | soft dirty hints |
| Appearance | immediate theme apply | n/a | n/a | n/a | n/a | n/a |
| Users / Roles | action buttons / matrix Save | roles: yes | yes | varies | yes | no |
| Security / System / Audit | read-only | n/a | n/a | n/a | load errors | n/a |

**Inconsistencies:** immediate vs Save; personal avatar under workspace Save page; no leave-dirty confirmation anywhere; notifications/sites prefs save but unused.

---

## 16. Role matrix

Based on `packages/authz/catalog.json` grants + `SettingsShell` visibility + page gates.  
Assume features include those needed for gated modules (`team` for roles edit, `audit` for audit).  
Legend: **V**=visible in nav · **E**=editable · **R**=read-only · **H**=hidden from nav (direct URL → Forbidden if gated)

| Route | Owner | Admin | Manager | Sales | Technician | Viewer |
|---|---|---|---|---|---|---|
| General | V/E | V/E | H | H | H | H |
| Company | V/E | V/E | H* | H | H | H |
| Appearance | V/E | V/E | H | H | H | H |
| Quotes | V/E | V/E | H | H | H | H |
| Numbering | V/E | V/E | H | H | H | H |
| PDF templates | V/E | V/E | H | H | H | H |
| Sites | V/E | V/E | H | H | H | H |
| Notifications | V/E | V/E | H | H | H | H |
| Team (users) | V/E† | V/E† | **V/R**‡ | H | H | H |
| Roles | V/E§ | V/E§ | H | H | H | H |
| Security | V/R | V/R | **V/R** | H | H | H |
| System | V/R | V/R | H | H | H | H |
| Audit | V/R§ | V/R§ | H | H | H | H |

\* Manager lacks `settings.branding` and `workspace.edit` → company hidden.  
† Invite/manage need `users.invite` / `users.manage` (Owner/Admin have them).  
‡ Manager has `users.view` only → list members; no invite/role change.  
§ Also requires plan features (`team` / `audit`) via `can()`.

Sales / Technician / Viewer: only `settings.view` — **no SettingsShell items**; app settings entry typically hidden.

---

## 17. Desktop / mobile behavior

From `styles.css` `.settings-shell`:

| Width | Behavior |
|---|---|
| **360 / 390 / 768** (<900) | Single column; mobile `<select>` with `<optgroup>`; desktop rail hidden; form one column |
| **900+ (incl. 1032 / 1440)** | `15rem` sticky aside + main; desktop group nav; 2-col field grids |
| Bottom Nav | Not replaced; main content padding; clearance patterns exist in app shell (settings does not remove Bottom Nav) |
| Overflow | `min-w-0` on main; sticky aside scrolls independently on desktop |
| Tablet 768–899 | Uses **mobile select**, not cramped dual column — intentional |

---

## 18. Duplicated / misplaced settings

1. **Personal avatar under General (workspace)** — wrong category; should be profile/account.
2. **Appearance gated by `workspace.edit`** but preference is device-local — personal, not workspace.
3. **System page** duplicates workspace name/status already in General / session.
4. **VAT** on General vs **taxStatus** on Company — related but different; not true duplicates.
5. **Display name vs workspace name** — two “names”; documented but easy to confuse.
6. **Theme in account menu + appearance page** — dual entry (OK) but IA muddy.
7. **Dead / unused persisted prefs:** validity_days default, show_vat, site require_*, notification events, project/site-file prefixes.
8. **Security “sessions” signal** advertises capability that is not built.

---

## 19. Existing capabilities not exposed in Settings

| Capability | Backend / data | Missing UI |
|---|---|---|
| Edit `full_name` / `phone` / `locale` | `PATCH /me` | no profile settings page |
| `profiles.avatar_path` | schema | no photo upload UI |
| Password recovery | `/forgot-password` | not linked from Security |
| Password change while logged in | Supabase `updateUser({ password })` possible | **no in-app UI found** |
| Quote validity auto-apply | prefs persist | create-quote path unused |
| Site field requirements | prefs persist | create-site unused |
| Notification event flags | prefs persist | no dispatcher |
| Project / site-file numbering | prefs persist | no emitters found |

---

## 20. Missing settings analysis

Only where product need + current STAGE fit (Founding Beta / workspace ops):

| Candidate | Verdict |
|---|---|
| פרופיל אישי (name/phone/avatar) | **P1** — data exists; currently misplaced/partial |
| מראה | **Exists** — keep; fix placement/permission later |
| חשבון / סיסמה | **P1** — recovery exists; in-session change + Security links missing |
| שפה ואזור | **P2 / NOT NEEDED now** — product is Hebrew-first; locale forced `he` |
| אינטגרציות | **NOT NEEDED** now — no product integrations surface |
| ייבוא/ייצוא | **NOT NEEDED** as Settings category now |
| גיבוי | **NOT NEEDED** in tenant Settings (ops/durability elsewhere) |
| Billing / subscription | **P2 / defer** — SaaS phases exist in docs; not in current settings IA; do not invent UI here without billing readiness |
| API / developer | **NOT NEEDED** in tenant Settings (Platform Admin separate) |

---

## 21. P0 gaps

1. **Prefs that save but do not apply** (validity, site requirements, notification toggles, show_vat, non-quote prefixes) — risk of false confidence for operators.
2. **Security page implies coverage** while sessions/MFA/password UX are absent or `not_built`.
3. **Manager/Sales/Tech** have almost no useful settings; Managers who manage day-to-day ops cannot edit workspace commercial defaults (by catalog) — confirm intentional before redesign.

---

## 22. P1 gaps

1. Dedicated **פרופיל אישי** placement (name, avatar; phone if desired) using `PATCH /me` + existing avatar sync.
2. Wire **Security** to real account actions (forgot-password link, future change-password) or shrink claims to match signals.
3. Make commercial defaults **actually apply** to new quotes (validity / payment terms) before expanding commercial UI.
4. Clarify **Appearance** as personal/device preference (permission + IA).
5. Surface **Roles** / **Audit** consistently in IA docs (they exist but were missing from owner inventory).

---

## 23. P2 opportunities

- Enforce site required-field prefs at create time  
- Real notification delivery tied to event flags  
- Project/site-file numbering consumers  
- Logged-in password change  
- Billing/plan UI when Phase billing is ready  
- Soften or remove empty **System** page into Advanced meta strip  

---

## 24. Settings that are NOT needed (now)

- Integrations hub  
- Data import/export center  
- Backup controls in tenant Settings  
- Multi-language settings  
- Developer API keys in workspace Settings  
- Speculative MFA UI before backend productization  
- Density / accent chrome themes  

---

## 25. CURRENT VERIFIED IA

```
חשבון וסביבה
  - כללי                    [/app/settings]           workspace.edit
  - פרטי חברה ומיתוג       [/app/settings/company]   workspace.edit | settings.branding
  - מראה                    [/app/settings/appearance] workspace.edit

מסחרי
  - הצעות מחיר             [/app/settings/quotes]
  - מספור                   [/app/settings/numbering]
  - תבניות מסמכים          [/app/settings/pdf-templates]

תפעול
  - אתרים                   [/app/settings/sites]
  - התראות                  [/app/settings/notifications]

צוות וגישה
  - צוות                    [/app/settings/users]      users.view
  - תפקידים והרשאות        [/app/settings/roles]      roles.manage
  - אבטחה                   [/app/settings/security]   settings.general | workspace.edit

מתקדם
  - הגדרות מערכת            [/app/settings/system]     workspace.edit
  - יומן ביקורת             [/app/settings/audit]      audit.view
```

---

## 26. RECOMMENDED IA (minimal; for later redesign — not implementing)

```
פרופיל וחשבון                    [mostly EXISTING CAPABILITY → better placement]
  - פרופיל אישי                 FUTURE PAGE using PATCH /me + avatar   (proposed)
  - מראה                        EXISTING /app/settings/appearance
  - אבטחה / חשבון               EXISTING security + links to recovery   (existing + better links)

סביבת עבודה
  - כללי                       EXISTING (workspace ops only; remove avatar)
  - פרטי חברה ומיתוג          EXISTING

מסחרי
  - הצעות מחיר                EXISTING (after apply-wiring)
  - מספור                      EXISTING
  - תבניות מסמכים             EXISTING

תפעול
  - אתרים                      EXISTING (after enforce or hide unused)
  - התראות                     EXISTING (after wire or label as “planned”)

צוות וגישה
  - צוות                       EXISTING
  - תפקידים והרשאות           EXISTING
  - יומן ביקורת                EXISTING (move from Advanced if desired)

מתקדם (optional thin)
  - מטא סביבה / תוכנית         EXISTING system content OR fold into כללי
```

Legend: **EXISTING page** · **EXISTING capability needing placement** · **proposed future page**.

---

## 27. Exact recommendation before SETTINGS-3 redesign

1. Treat the **verified IA in §25** as source of truth — owner list was incomplete (missing מראה, תפקידים, יומן).  
2. **Do not add** Integrations / Backup / Billing / API settings in the next redesign pass.  
3. **Prioritize placement + honesty over new pages:**  
   - split personal (profile/avatar/theme/security links) from workspace (general/company/commercial/ops/team);  
   - either **wire or clearly mark** unused prefs (validity, sites requires, notifications, show_vat, non-quote prefixes).  
4. If one new page is justified: **`/app/settings/profile`** backed by existing `PATCH /me` + avatar metadata — **P1**, not greenfield architecture.  
5. Keep PDF templates and Team as-is functionally; they are the strongest real settings surfaces today.  
6. Shrink or fold **System** unless it gains real controls.  

**STOP.** No SETTINGS-3 implementation started.
