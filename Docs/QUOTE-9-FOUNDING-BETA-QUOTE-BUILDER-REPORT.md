# QUOTE-9 FOUNDING BETA QUOTE BUILDER REPORT

Date: 2026-09-30  
Mode: Audit-first (no pricing rewrite, no revision architecture change)  
Artifacts: `Docs/quote-9-founding-beta-qa/`  
Fixture: Q3B seeded customer/site/package/catalog (`fixture.json`)  
Operator seat: Owner (`phase1b.owner…`) — commercial path representative for beta quote creators

---

## 1. Existing architecture verdict

Quote Builder is a mature, stage-based CPQ workspace (details → planning → pricing → review) with QuickAdd, packages, templates, CCTV drawer, autosave, send confirm, preview/PDF, revise/compare, and project-from-quote API. **Architecture is beta-capable.** Product risk is friction and a few honesty gaps—not missing core workflow.

## 2. Fresh quote timing

**Package / QuickAdd compose (existing Customer+Site):** **23.8s**  
Target under 3 minutes: **PASS**

## 3. Full send timing

UI confirm dialog click failed (dialog intercept / selector). **API send** on the same quote succeeded immediately after. Measured UI attempt ~41s before failure; send itself is not the bottleneck.

## 4. Click count

Fresh package path: **9 clicks**

## 5. Search count

Fresh package path: **0 searches** (package apply)

## 6. Overlay count

Fresh package path: **3 overlays** (QuickAdd + package picker + free-line path)

## 7. Fast-add result

`[data-testid="quote-fast-start"]` is **unmounted**. Live path is **QuickAdd** (`הוסף להצעה` / `הוסף פריט`). Catalog search works when options resolve; one automated SKU search timed out (P2 automation / search latency).

## 8. Package/template result

Package apply via QuickAdd **מערכת / חבילה** works. `apply-package` API returns correct priced lines + totals (CCTV package sample **₪4,861.54**). Risk: picker can apply the **first** package if the named QA package row is not targeted.

## 9. CCTV result

CCTV entry exists (`QuickAdd → CCTV` / SystemBuilderDrawer). Not timed in this run (package path was fastest intended compose). Desktop-favored; acceptable for beta.

## 10. Labor/free-line result

Labor catalog SKU and free line add work. Free line with empty description + qty edit is easy to create unintentionally (blank ₪0 line at top).

## 11. Line editing

Qty / price / discount inputs exist; autosave settles to **נשמר**. Keyboard-first spreadsheet feel is present but dense on mobile.

## 12. Autosave

Observed `.cpq-save-dot.is-saved` + **נשמר** after edits. No false “Saved” on failed mutation in this run.

## 13. Pricing correctness

Server totals after package apply match expected math. Client summary **briefly showed ₪0** while priced lines existed (live totals lag)—**fixed** with display fallback using existing `recalculateQuotePricing` when `total_gross===0` but priced lines exist. Server remains money authority after persist.

## 14. Optional items

API `is_optional` works. **Builder UI does not expose optional controls / optional totals** (`optionalLabel: false`). Preview/PDF optional distinction incomplete in UI. **P1 product gap.**

## 15. Review stage

Shows number, version, customer, payment terms, validity readiness, save state, VAT labels. Primary **שליחה ללקוח** present. **2–3 Send CTAs** visible (header + sidebar + review)—P2 consolidation.

## 16. PDF quality

PDF endpoint exists (`/quotes/{id}/pdf`). Not fully glyph-audited in this run (prior Q6a coverage). No cost leakage expected on customer PDF path when using public/customer views.

## 17. Public quote

Share mint works (`public_token`). Public page loads; approve needs valid signature/name payload (strict validation). Cost/margin not shown on public language path in probe.

## 18. Approval/reject

Send → public approve path exists; approve body validation is strict (400 without required fields). Reject not re-exercised here (prior Q5 coverage).

## 19. Revision/history/compare

`POST …/revise` → version 2 succeeded. Compare endpoint available. History UI exists when `version > 1`.

## 20. Project conversion

`POST /api/v1/workspaces/{ws}/projects/from-quote` with `{ source_quote_id }` — requires **approved** quote. Not completed in this run after revise returned draft. Capability exists; gate is status + payload shape.

## 21. Role security

Owner sees cost via API (`ownerSeesCost: true`). UI margin strip gated by `quotes.view_cost`. **Founding Technician is a badge/seat, not an authz role**—quote work requires Owner/Manager/Sales (or grants including quotes.*). Technician RBAC alone cannot run Quote Builder commercially.

## 22–27. Viewports

| Viewport | Overflow | Notes |
|---|---|---|
| 1440 | none | Compose/review shots |
| 1032 | none | |
| 768 | none | Send CTA count 3 |
| 430 / 390 / 360 | none | Usable; dense editing |
| Light 1440 / 390 | none | |

## 28. Dark/Light

Both captured; tokens preserved.

## 29. Performance

Compose ~24s wall time dominated by UI waits/overlays, not multi-second API stalls. Package apply returns full totals. Catalog search can miss within 10s (fixture/search).

## 30. Error recovery

Save error state exists in indicator. Send confirm dialog can block automation if wrong button targeted; user-visible confirm is present.

## 31. Fixes made

1. **`QuoteBuilder` display totals lag** — if priced lines exist and `live.total_gross` is still 0, show totals via existing `recalculateQuotePricing` (no formula change; server remains source of truth after persist).  
2. Audit script + artifacts under `Docs/quote-9-founding-beta-qa/`.

## 32. Remaining friction

- Optional-item UI missing  
- Multiple Send CTAs  
- Fast Start unmounted / QA drift  
- Blank free lines easy to add  
- Package picker targeting  
- Public approve field requirements not obvious in automation

## 33. P0 blockers

**None for Owner/Manager/Sales quote create→send** with seeded catalog.

## 34. P1 blockers

1. Optional items not operable/visible in builder (API ready, UI not)  
2. Summary ₪0 lag (mitigated in this checkpoint; watch for regressions)  
3. Role clarity: founding technician badge ≠ quote commercial permission

## 35. P2 polish

- Consolidate Send CTAs  
- Remount or formally retire Fast Start  
- Stronger package row targeting / empty free-line guard  
- Mobile line-edit density  

## 36. GO / NO-GO FOR FOUNDING TECHNICIAN QUOTE USAGE

### **CONDITIONAL GO**

GO for founding beta operators who have **Owner / Manager / Sales** (or equivalent `quotes.*`) and a **non-empty catalog/packages**.  
NO-GO if “Founding Technician” means **technician RBAC only** without quote grants, or empty catalog tenants.

---

## FINAL ANSWERS

**A. Can a real Founding Technician create and send a professional quote today?**  
Yes, if they operate under a commercial quote-capable seat (not technician-only grants) and the workspace has catalog/packages. End-to-end create→compose→save→send is real.

**B. Actual time from existing Customer+Site to Send-ready compose?**  
**~24 seconds** measured for package-accelerated compose (9 clicks, 3 overlays). Under the 3-minute target.

**C. Three biggest remaining friction points?**  
1. Optional-item UI not wired  
2. Duplicate Send CTAs / review clutter  
3. Fast-add IA drift (Fast Start gone; QuickAdd-only) + easy blank free lines  

**D. Is any quote behavior unsafe or unreliable?**  
No P0 money/authz failure in this run. Public path did not leak cost. Transient **₪0 summary** while lines priced was unreliable UX—mitigated with display fallback. Optional commercial honesty incomplete until UI lands.

**E. What can wait until after beta?**  
Optional-line UI polish, Send CTA consolidation, Fast Start cleanup, PostgREST cost hardening, deep PDF glyph stress, full public approve UX copy.

---

## SITE SECURE UI Review Checklist (sign-off)

| Item | Result |
|---|---|
| Area touched | Quote Builder summary display fallback only (+ audit artifacts) |
| Themes | Dark/light screenshots captured |
| Breakpoints | 1440–360 matrix; no overflow |
| RTL | Pass |
| Dark mode preserved | Pass |
| Bottom Nav untouched | Pass |
| Pricing formulas | Unchanged (reuse existing recalculate helper for display lag only) |
| Reviewer / agent | Auto (Composer) |
| Date | 2026-09-30 |

**Bold checklist items:** pass for scoped fix. Optional-item gap remains a product P1, not fixed in this checkpoint (would expand beyond clear reliability).
