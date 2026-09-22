# QUOTE BUILDER — POST A1/A2/A3 E2E QA GATE

**Date:** 2026-09-22  
**Mode:** TEST / QA / FIX-ONLY-IF-REGRESSION  
**Product features added this gate:** NONE  
**Code fixes this gate:** NONE (no A1/A2/A3 regressions found)

---

## 1. Executive result

SITE SECURE Quote Builder behaves as **one coherent quote system** under automated contracts and code-path verification for A1 terminology/visibility, A2 composition exposure, and A3 outbound integrity.

**OVERALL QUOTE BUILDER QA GATE: PASS**

No A1/A2/A3 regressions requiring fixes were discovered. Pre-existing / product / environment items are documented below without scope expansion.

---

## 2. Test environment

| Item | Value |
|---|---|
| Host | macOS darwin (local workspace) |
| Web | Vitest 2.1.9, Vite build, `tsc --noEmit` |
| API | pytest + Python 3.12 toolchain |
| Live browser E2E against deployed stack | Not run this gate (no stuck auth session assumed) |
| `pymupdf` | **Absent** — blocks PDF plain-text extraction tests |
| Method | Automated suites + source-contract verification of A1/A2/A3 paths |

---

## 3. New quote / persistence

| Check | Result | Evidence |
|---|---|---|
| `/app/quotes/new` local draft, no immediate server row | **PASS** | `quote-builder.test.tsx` — opens unsaved; `createQuote` not called after idle timers |
| Label `טיוטה חדשה` | **PASS** | `he.quoteUnsaved`; asserted via `getByText(he.quoteUnsaved)` |
| createOnce gate (single create) | **PASS** | `QuoteBuilder.createOnce` uses `createGate` promise; returns existing `live.id` |
| Autosave only after content | **PASS** | Autosave effect: `!live.id && !draftHasContent(draft)` returns early |
| Dirty vs new-local distinct | **PASS** | `QuoteSaveIndicator`: `!hasLiveId` → unsaved; `dirty` → `cpqUnsavedChanges`; saving/saved keys unchanged |
| Saving / saved copy | **PASS** | `cpqSaving` / `cpqSavedJustNow` already correct (A1) |

Classification notes: none.

---

## 4. Customer

| Check | Result | Evidence |
|---|---|---|
| Search / select / create surfaces exist | **PASS** (contract) | QuoteBuilder customer combobox + create paths; covered indirectly by builder/lifecycle suites |
| Draft without customer allowed | **PASS** | Local unsaved / draft open without customer |
| Send blocked without customer | **PASS** | Server `validate_for_send` critical rules; client readiness/`canSendNow` |
| Clear-customer / dedupe | **Not in scope** | PRODUCT DECISION / FUTURE — not tested as features |

---

## 5. Site

| Check | Result | Evidence |
|---|---|---|
| Site optional for composition | **PASS** | Send validation does not hard-require site in critical path used by A3 Share/Send completeness (customer/items/terms-oriented) |
| Project-from-quote requires site | **PASS** | `project_from_quote.py` blocks when `site_id` missing; `test_project_from_quote.py` |
| Site policy unchanged | **PASS** | No A1–A3 edits to site rules |

---

## 6. Unified composition

| Source | Discoverable | Same quote list | Notes |
|---|---|---|---|
| Catalog | QuickAdd + panel search | Yes | Existing |
| Free line | QuickAdd / mobile / toolbar | Yes | A2 labels |
| Service/labor | QuickAdd `kind=service` → labor | Yes | `quote-composition-a2` labor badge |
| Note | QuickAdd / mobile / section menu | Yes | note row + `addQuoteItem({item_type:"note"})` |
| Template / package | QuickAdd | Yes | system-apply tests |
| CCTV System Builder | QuickAdd + drawer | Yes | CCTV-only option |
| Section | QuickAdd / mobile | Yes | |

All converge via `addItem` / apply mutations → `applyRow` on one `QuoteOut`.

---

## 7. Hybrid composition scenario

| Check | Result |
|---|---|
| CCTV apply + further manual add taxonomy | **PASS** (contract) — apply uses normal quote items; QuickAdd remains available |
| No separate CCTV quote product | **PASS** — single QuoteBuilder surface |
| Automated hybrid fixture of all six sources in one UI test | Limited — composition unit tests cover pieces; full multi-source UI fixture not one single E2E file |

Finding: **FUTURE CAPABILITY / PRE-EXISTING** — stronger single hybrid Playwright/E2E fixture would improve confidence; not an A1–A3 regression.

---

## 8. Discounts

| Scope | Exposure | Authority |
|---|---|---|
| Line | `QuoteLineRow` % field | `patchQuoteItem` → server |
| Section | `QuoteSectionDiscountField` %/amount | `patchQuoteSection` → `_persist_totals` |
| Quote | Draft discount fields in details | `patchQuote` header |

| Check | Result |
|---|---|
| Scopes distinct in copy | **PASS** — section hint explicitly “not line / not whole quote”; quote uses `cpqQuoteDiscount` |
| Server totals | **PASS** — mutations apply server row |
| Pricing order unchanged | **PASS** — `pricing.py` not modified; `test_pricing.py` green |

---

## 9. Pricing / VAT / security

| Check | Result |
|---|---|
| Subtotal / VAT / gross from server | **PASS** — UI displays `live.*`; no client authoritative totals |
| Cost/margin gated | **PASS** — `canViewCost` / server strip; public payload omits cost (A3 test) |
| `pricing.py` untouched | **PASS** |
| `test_pricing.py` | **7/7 PASS** |

---

## 10. CCTV

| Check | Result |
|---|---|
| Only CCTV in System Builder selector | **PASS** — single `<option value="cctv">` |
| Recommend / sizing / apply paths | **PASS** — web CCTV suites + API recommend/sizing/hardening |
| Math unchanged | **PASS** — no CCTV engine edits in A1–A3 beyond visibility |

Web: `cctv-build-system` 11 + `cctv-sizing` 30 = **41 PASS**  
API: `test_cctv_recommend` + `test_cctv_sizing_parity` + `test_cctv_hardening` included in **87 PASS** batch with A3/project/authz/signature.

---

## 11. Preview

| Check | Result |
|---|---|
| Staff preview route / live pane | **PASS** (contract) — authenticated document; no public token mint by preview alone |
| Does not publish | **PASS** — no call to share/send from preview navigation itself |
| Disabled when empty local draft | **PASS** — `quote-builder` disables customer view without id/content |

---

## 12. Share (A3 invariant)

| Check | Result | Evidence |
|---|---|---|
| Draft Share can view | **PASS** | Snapshot public served |
| Open keeps draft | **PASS** | `test_assemble_draft_share_open_does_not_promote_or_allow_decide` |
| Repeated opens stay draft | **PASS** | `test_assemble_repeated_draft_views_stay_draft` |
| `can_approve` / `can_reject` false | **PASS** | same |
| Direct approve/reject fail | **PASS** | A3 approve/reject draft tests → 403 |
| Staff can edit after Share view | **PASS** | status remains draft → `QUOTE_EDITABLE` |
| Copy does not promise approval | **PASS** | `quoteShareDialogLead` view-only; A3 he.ts assertion |

### Share-after-edit behavior (documented — NOT changed)

**Current behavior:** recipient sees the **snapshot frozen at last Share (or re-Share)**, not live draft edits.

Mechanism: `_prepare_share_link` upserts `quote_versions` snapshot; public `GET` reads `_public_from_version`. Line edits after Share update live `quote_items` only until another Share/Send upserts the snapshot.

| Classification | **PRODUCT DECISION** |
|---|---|
| Question for later | Should draft Share be live-updating, last-Share frozen, or re-Share required messaging? |
| Gate action | Document only — no behavior change |

---

## 13. Send

| Check | Result |
|---|---|
| Readiness validation | **PASS** — `validate_for_send` before publish |
| Hebrew CTA | **PASS** — `שליחה לאישור הלקוח` / mobile short |
| Snapshot + sent status | **PASS** — winner path upserts sent snapshot after conditional patch |
| Concurrent Send single winner | **PASS** — `test_send_losing_concurrent_request_does_not_mint_or_snapshot` |
| Formal Send still enables decide | **PASS** — sent open → viewed → `can_approve` |

---

## 14. Customer view (post Send)

| Check | Result |
|---|---|
| Document from snapshot | **PASS** — public assemble |
| Notes / sections / lines in document model | **PASS** — `quote-document` + snapshot public_items |
| No cost leakage | **PASS** — A3 snapshot cost keys test + PDF strip |

Full visual customer portal E2E against live backend: not executed this gate (environment).

---

## 15. PDF integrity

| Check | Result |
|---|---|
| Draft staff PDF = live | **PASS** — `_document_payload` draft path; unit test |
| Non-draft staff PDF = `snapshot.public` | **PASS** — `_SNAPSHOT_PDF_STATES` + unit test live-vs-frozen |
| Public PDF = snapshot | **PASS** — `get_public_quote_pdf` → assemble |
| Same source for sent staff/public | **PASS** (source selection) |
| Renderer smoke (bytes) | **PASS** — 7 `test_quote_pdf` cases without text extract |
| Plain-text PDF content asserts | **ENVIRONMENT LIMITATION** — 5 failures: `ModuleNotFoundError: pymupdf` |

No dependency install attempted (gate rule).

---

## 16. Approval / rejection

| Check | Result |
|---|---|
| Draft cannot approve/reject | **PASS** (A3) |
| Formally sent/viewed can decide | **PASS** (assemble sent→viewed + DECISION_STATES) |
| Signature/terms required on approve | **PASS** — `approve_public_quote` validation; signature tests in suite |
| Superseded / version mismatch | **PASS** — public gate + boundary tests |

---

## 17. Revision

| Check | Result |
|---|---|
| Revise → draft version+1 | **PASS** (contract in `revise_quote`) |
| Old token superseded | **PASS** — version mismatch → superseded |
| Prior snapshot row retained | **PASS** — upsert is per version; revise increments version |
| Lifecycle continuity CTAs | **PASS** — `quote-lifecycle-continuity` 11 tests |

---

## 18. Project handoff

| Check | Result |
|---|---|
| Approved + site → plan | **PASS** — `test_project_from_quote.py` |
| Missing site blocks | **PASS** |
| A1–A3 did not touch handoff | **PASS** |

---

## 19. Responsive / mobile

| Check | Result |
|---|---|
| Bottom stack architecture intact | **PASS** — `--ss-mobile-nav-reserve`, `--cpq-mobile-actions-offset`, `--quote-mobile-bottom-clearance` still in `styles.css`; no second dock added |
| Add taxonomy on mobile | **PASS** — `quote-mobile-actions` taxonomy + note add |
| Send short label | **PASS** |
| Visual pixel QA at 360/390/768/1024 | **Not executed** this gate (no browser capture run) — classified **ENVIRONMENT LIMITATION / FUTURE** for visual lab; automated mobile action tests cover interaction contracts |

No mobile architecture regression from A1–A3 code review.

---

## 20. Permissions

| Check | Result |
|---|---|
| Edit only draft | **PASS** — `QUOTE_EDITABLE` |
| Send only draft | **PASS** — `QUOTE_SENDABLE` |
| Share mint uses `quotes.send` | **PASS** |
| Authz suite | Included in API **87 PASS** batch (`test_authorize.py`) |
| Full multi-role UI matrix | Partial — not a full role matrix browser run |

---

## 21. Automated test results

### Web

```text
14 files, 119 tests PASSED
  quote-builder 19, mobile-actions 10, lifecycle 11, composition-a2 5,
  system-apply 5, save-indicator 2, cpq 11, line-row 9, document 2,
  lines-panel 1, readiness 2+1, cctv-build 11, cctv-sizing 30
typecheck PASSED
production build PASSED
```

### API (relevant)

```text
test_quote_a3_outbound_integrity.py          12 PASSED
share/public/snapshot/pricing/validation/
  share_policy/phase2                        30 PASSED
A3 + cctv_* + project_from_quote + signature
  + authorize                                87 PASSED
test_pricing.py                              7 PASSED (also in batches above)
test_quote_pdf.py                            7 PASSED / 5 FAILED (pymupdf missing)
```

**Exact counts for gate summary:**

| Bucket | Passed | Failed | Notes |
|---|---|---|---|
| Web quote + CCTV gate set | **119** | 0 | |
| API A3 integrity | **12** | 0 | |
| API quote integrity cluster | **30** | 0 | |
| API A3+CCTV+project+authz+signature | **87** | 0 | overlaps A3 12 |
| API PDF text extract | 7 | **5** | ENVIRONMENT |
| Web typecheck/build | pass | — | |

---

## 22. Regressions found / fixed

| ID | Classification | Action |
|---|---|---|
| — | — | **None.** No A1/A2/A3 regressions identified. |

---

## 23. Pre-existing issues

| Issue | Classification |
|---|---|
| `test_pdf_studio_verification.py` collection error when broad `-k quote` used | PRE-EXISTING / ENVIRONMENT |
| No single automated UI test that builds one quote with all six composition sources | PRE-EXISTING |
| Full multi-role browser permission matrix not automated | PRE-EXISTING |

---

## 24. Product decisions discovered

| Decision | Status |
|---|---|
| Draft Share recipient sees **last Share snapshot**, not live edits until re-Share | **PRODUCT DECISION** — confirm messaging / future refresh policy |
| Share-as-Send workflows intentionally broken by A3 | Already locked — verified |
| Site remains optional at Send; required at project | Confirmed current contract |

---

## 25. Environment limitations

| Limitation | Impact |
|---|---|
| `pymupdf` not installed | Cannot assert PDF glyph/text content in 5 tests |
| No authenticated live browser session this gate | Pixel responsive QA + full customer portal walkthrough not screenshot-verified |
| No dependency changes allowed/performed | Correct per gate rules |

---

## 26. Final protected-area verification

| Area | Intact? |
|---|---|
| `pricing.py` / formulas | YES |
| CCTV sizing/recommend math | YES |
| Authz engine/catalog (no redesign) | YES |
| RLS / migrations | YES (none in A1–A3) |
| Mobile bottom-stack architecture | YES |
| QuoteBuilder refactor | YES (none) |

---

## FINAL STATUS

```text
A1: PASS
A2: PASS
A3: PASS

UNIFIED QUOTE COMPOSITION: PASS
SHARE = VIEW: PASS
SEND = DECIDE: PASS
SENT SNAPSHOT INTEGRITY: PASS
PRICING AUTHORITY PROTECTED: PASS
CCTV ENGINE PROTECTED: PASS
MOBILE BOTTOM STACK PROTECTED: PASS

OVERALL QUOTE BUILDER QA GATE: PASS
```

---

**END — POST A3 E2E QA GATE — STOP**
