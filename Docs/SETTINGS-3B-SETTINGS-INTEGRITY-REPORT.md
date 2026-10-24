# SETTINGS-3B SETTINGS INTEGRITY REPORT

Checkpoint complete. Settings that are shown as active now either affect product behavior or are clearly marked unavailable / planned. No SETTINGS-3C profile redesign started.

---

## 1. Quote validity before/after

| | Before | After |
|---|---|---|
| Persist | `quotes.validity_days` in workspace settings | unchanged |
| Create quote | ignored | server applies `valid_until = workspace today + days` when create payload has no `valid_until` and days > 0 |
| Timezone | n/a | workspace `timezone` via `ZoneInfo` (fallback `Asia/Jerusalem`) |
| Existing quotes | — | untouched |

## 2. Payment terms before/after

| | Before | After |
|---|---|---|
| Persist | `quotes.payment_terms` | unchanged |
| Create quote | not applied to quote row | applied when create `payment_terms` empty |
| PDF | workspace → template merge when template lacks `paymentTerms` | same merge helper, shared path |
| Precedence | informal | **quote explicit > workspace default (on create / PDF fill) > template `paymentTerms`** |

## 3. Show VAT result

**Wired (presentation only — no VAT math changes).**

- Workspace `show_vat` merges into PDF template as `showVat` when template does not set it (including when no template row exists).
- Customer Preview / Document / PDF consume `pdf_template.showVat`.
- Builder live preview still shows VAT for editing transparency; settings copy states this.
- Frozen historical snapshots keep their embedded `pdf_template` (no rewrite).

## 4. Site requirements result

**Path A — enforce (partial):**

- `require_address` and `require_access_notes`: server enforce on site create + patch (explicit `True` only).
- `require_contact`: **removed from active UI** — site model has no contact field; marked unavailable.

UI defaults aligned to explicit-true semantics (unchecked until configured).

## 5. Notifications honesty fix

Page is **«העדפות התראה עתידיות»** with unavailable banner.  
No toggles, no save, no fake success. Event prefs are no longer written from Settings UI.

## 6. Numbering truthfulness

- **Quote prefix:** still active; save patches only quote prefix (preserves stored unused prefixes).
- **Project / site-file prefixes:** not exposed as active controls; unused note shown.

## 7. Security page wording

- Lead + honesty body: no MFA / session / in-app password management claims.
- Signals relabeled in Hebrew; sessions remain `not_built` with clear wording.
- Link to `/forgot-password` for password reset.

## 8. Appearance permission semantics

- Gate: `settings.view` (personal / device-local theme unchanged).
- Nav + AppShell + workspace-setup include `settings.view` so Sales/Technician/Viewer can open Appearance without workspace edit.
- Theme persistence still localStorage — not workspace-wide.

## 9. Role/authz regression

| Role | Workspace commercial/ops settings | Team/security | Appearance |
|---|---|---|---|
| Owner/Admin | full (`workspace.edit`) | yes | yes |
| Manager | no `workspace.edit` | users + security (`settings.general`) | yes (`settings.view`) |
| Sales/Tech/Viewer | no | no | yes (`settings.view`) |

Company / quotes / numbering / sites / notifications still require `workspace.edit`.

## 10. Save UX impact

- Notifications: no form / no save.
- Numbering / sites / quotes: only dirty active fields; unused controls not savable.
- No fake success on inactive surfaces.

## 11. Files changed

**API**

- `apps/api/app/quote_workspace_defaults.py` (new)
- `apps/api/app/site_requirements.py` (new)
- `apps/api/app/routers/quotes.py`
- `apps/api/app/routers/sites.py`
- `apps/api/app/routers/team.py`
- `apps/api/tests/test_quote_workspace_defaults.py` (new)
- `apps/api/tests/test_site_requirements.py` (new)
- `apps/api/tests/test_quote_pdf.py`

**Web**

- `apps/web/src/routes/app/settings/{quotes,sites,notifications,numbering,appearance,security}.tsx`
- `apps/web/src/components/settings/SettingsShell.tsx`
- `apps/web/src/components/quotes/document/QuoteDocument.tsx`
- `apps/web/src/components/AppShell.tsx`
- `apps/web/src/lib/{workspace-prefs,app-nav,workspace-setup}.ts`
- `apps/web/src/i18n/he.ts`
- `apps/web/src/styles.css`
- `apps/web/tests/settings-expansion.test.ts`
- `packages/api-client/src/index.ts` (`pdf_template` on `PublicQuote`)

## 12. Tests

| Suite | Result |
|---|---|
| `test_quote_workspace_defaults.py` | pass |
| `test_site_requirements.py` | pass |
| PDF showVat + snapshot regression (selected) | pass |
| `settings-expansion.test.ts` + `settings-shell.test.tsx` | pass (20) |

Coverage mapped to checklist: validity default / no-default / payment precedence / show VAT / site enforce + contact hidden / notifications honesty / quote prefix UI / unused prefixes / security copy / appearance `settings.view` / workspace.edit unchanged / historical frozen template path / PDF snapshot labels.

## 13. Typecheck

`npm run web:typecheck` still fails on **pre-existing** test TS errors (`customers-page`, `workNav`, etc.).  
No new errors in SETTINGS-3B source files (`settings/*`, `workspace-prefs`, `QuoteDocument`, `AppShell`, `he.ts`).

## 14. Build

`npm run web:build` — **pass**.

## 15. Remaining settings that still persist but are not consumed

| Pref | Notes |
|---|---|
| `localization.project_prefix` / `site_file_prefix` | may still exist in DB; not shown as active |
| `notifications.events.*` | may still exist in DB; UI no longer edits/claims delivery |
| `scheduling.sites.require_contact` | may still exist historically; not enforced / not shown |

## 16. Readiness for SETTINGS-3C profile-led redesign

Ready to start SETTINGS-3C:

- Integrity of active vs unavailable controls is honest.
- Avatar still on General (intentionally not moved).
- Appearance already personal-permission semantics.
- No visual redesign / Profile / Bottom Nav / AppShell layout changes in this checkpoint.

**Canonical implementation prompt (with design governance):**  
`Docs/SETTINGS-3C-PROFILE-LED-PREMIUM-SETTINGS-PROMPT.md`

Must follow before/during/after implementation:

- `Docs/design/SITE-SECURE-UI-DESIGN-RULES.md`
- `Docs/design/SITE-SECURE-UI-REVIEW-CHECKLIST.md`

**STOP — do not start SETTINGS-3C automatically.**
