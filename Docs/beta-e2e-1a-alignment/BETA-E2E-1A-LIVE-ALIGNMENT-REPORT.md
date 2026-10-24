# BETA-E2E-1A LIVE ALIGNMENT REPORT

**Mode:** SETTINGS-3B live alignment + focused recertification  
**Timestamp (UTC):** `2026-09-30T18:44:33Z` → completed `2026-09-30T18:46:59Z`  
**Evidence:** `Docs/beta-e2e-1a-alignment/` (`artifacts/report.json`, `artifacts/run.log`, `pdfs/`)

---

## 1. Root cause

**Deployment drift (code never shipped), not a regression and not a missing migration.**

SETTINGS-3B API implementation (`site_requirements.py`, `quote_workspace_defaults.py` + router hooks) existed only as **uncommitted local working-tree changes**. It was never on `main` / `release/beta-go-live-2`, so Render staging (`4a2c395`) could not enforce site requirements or apply quote defaults.

No DB migration required — behavior reads existing `workspace_settings` JSON and `workspaces.timezone`.

---

## 2. Local SHA

| Ref | SHA |
|---|---|
| Pre-align workspace branch tip (`feat/quote-cpq-phase-ab`) | `d34032dea597af251f71899760db83d49753ac29` |
| SETTINGS-3B align commit (API-only) | `f8fa9e5a5180c2927c7a2d22b3c7b9362897d96e` |

---

## 3. Deployed API SHA

| Ref | SHA |
|---|---|
| Prior staging (`main` / `release/beta-go-live-2`) | `4a2c395071b21c9be4f6458e16bd5930ecc97d37` |
| **Current staging (Render GitHub deploy)** | **`f8fa9e5a5180c2927c7a2d22b3c7b9362897d96e`** |

GitHub deployment `6767266312` → environment `main - site-secure-api-staging` → **success** at `2026-09-30T18:39:31Z`  
Service URL: `https://site-secure-api-staging.onrender.com`  
Deploy log: `https://dashboard.render.com/web/srv-da043jdbedkc739ru8pg/deploys/dep-daule8ff3r2c73fuk5e0`

Vercel also built `f8fa9e5` (web); API fix is the release-critical piece.

---

## 4. Deployment action

1. Isolated API-only SETTINGS-3B commit on branch `fix/settings-3b-live-align` from `origin/main`.
2. Pushed to `origin/main` and `origin/release/beta-go-live-2` (`4a2c395` → `f8fa9e5`).
3. Render auto-deployed via GitHub App (`render`) — status **success**.
4. No Supabase migration applied (none needed).

---

## 5. Site address enforcement

| Case | Result |
|---|---|
| **A** `require_address=ON` → create without address | **PASS** — `400 VALIDATION_ERROR` «נדרשת כתובת לאתר לפי הגדרות הסביבה» |
| **B** `require_address=OFF` → create without address | **PASS** — `200` |

---

## 6. Site access-notes enforcement

| Case | Result |
|---|---|
| **C** `require_access_notes=ON` → create without notes | **PASS** — `400 VALIDATION_ERROR` «נדרשות הערות גישה לאתר לפי הגדרות הסביבה» |
| **D** `require_access_notes=OFF` → create without notes | **PASS** — `200` |

---

## 7. Quote validity default

| Case | Result |
|---|---|
| **E** `validity_days=21` → create without `valid_until` | **PASS** — `valid_until=2026-10-21` (= Asia/Jerusalem today + 21) |

---

## 8. Payment terms default

| Case | Result |
|---|---|
| **F** workspace `payment_terms` configured → create without terms | **PASS** — terms applied verbatim |

---

## 9. Explicit override precedence

| Case | Result |
|---|---|
| **G** explicit `valid_until` + `payment_terms` on create | **PASS** — override kept (`2026-10-07`, explicit terms) |

---

## 10. Existing-data safety

| Case | Result |
|---|---|
| **H** prior quote after later creates | **PASS** — `valid_until` / `payment_terms` / version unchanged |

---

## 11. Golden-path smoke

Customer → Site → Quote (**no manual validity/terms**) → Preview → PDF → Send

| Step | Result |
|---|---|
| Quote defaults from workspace | **PASS** |
| Preview `/document` | **PASS** |
| PDF (`%PDF`, ~29KB stored) | **PASS** |
| Send → `status=sent` + public token | **PASS** |

Workspace: `8e974e1c-0713-4ab8-97a8-b6c16a2cdb48`  
Quote: `52f16515-e2bc-4cdb-9bb2-3e147105bc1f`  
PDF: `Docs/beta-e2e-1a-alignment/pdfs/quote-52f16515-e2bc-4cdb-9bb2-3e147105bc1f.pdf`

---

## 12. Regression check

| Check | Result |
|---|---|
| Pricing (`total_gross=2124.0`) | **PASS** |
| Autosave (qty PATCH) | **PASS** |
| Send | **PASS** |
| Public quote | **PASS** |
| Cost protection (no cost/margin keys) | **PASS** |
| Approval | **PASS** |
| Project conversion (`from-quote`) | **PASS** — project `c495fd2c-e2d7-46a8-a505-dcd088c9e2a8` |

---

## 13. P0 remaining

**None.**

---

## 14. P1 remaining

**None** from BETA-E2E-1 blockers (site enforce + quote defaults).  
Prior E2E-1 **NOT IMPLEMENTED** items (optional lines / compare / installed-assets on this API schema) are unchanged and out of scope for 1A.

---

## 15. FINAL FOUNDING BETA DECISION: **GO**

Both release P1 blockers from BETA-E2E-1 are closed on live staging after deploying `f8fa9e5`. Focused A–H + golden smoke + regression: **18 PASS / 0 FAIL / 0 P0 / 0 P1**.

Harness: `apps/api/scripts/beta_e2e_1a_alignment.py`
