# Quote Builder — Unified Interaction Architecture

**Date:** 2026-09-22  
**Type:** Product UX contract only  
**Sources:**  
- [`QUOTE-BUILDER-CAPABILITY-AUDIT.md`](./QUOTE-BUILDER-CAPABILITY-AUDIT.md)  
- [`QUOTE-BUILDER-PRODUCT-DECISIONS.md`](./QUOTE-BUILDER-PRODUCT-DECISIONS.md)  
- [`QUOTE-BUILDER-UNIFIED-PRODUCT-ARCHITECTURE.md`](./QUOTE-BUILDER-UNIFIED-PRODUCT-ARCHITECTURE.md)  

**Scope:** **Zero implementation.** No product code, translations, CSS, APIs, pricing, authz, PDF, snapshots, or CCTV changes.

This is the **final planning pass** before implementation sequencing.

---

## 1. Interaction thesis

SITE SECURE provides **one Quote Builder**.

The user is always building **one professional customer proposal**.

They may compose it through:

| Approach | Meaning |
|---|---|
| Direct | “I already know what I want to sell.” |
| Guided | “I need SITE SECURE to help determine what this system requires.” |
| Hybrid | Natural mix of both — **default capability, not a third mode** |

**Multiple ways in. One quote out.**

Direct and Guided are **interaction approaches**, not products, routes, quote types, pricing systems, lifecycles, or PDFs.

There is **no** mandatory upfront screen:

> “How do you want to create this quote?”

Users start naturally and may mix approaches at any time.

---

## 2. One-builder mental model

```
ONE Quote Builder
├── Context: Customer · Site (when relevant) · details
├── Composition: ONE surface receiving all sources
│     ├── Direct actions (catalog / free / template / labor / note / sections)
│     └── Guided action (Design System → CCTV engine today)
├── Commercial: discounts · displayed totals (server-owned)
└── Outbound: Preview · Share (policy) · Send to customer for approval
```

After any Guided apply, the user remains in the **same** builder editing **ordinary** lines.

---

## 3. Primary composition surface

### Purpose

The central place where the offer’s content lives: sections and lines that become the customer proposal.

### Belongs in the primary surface

| Always visible / near-primary | Role |
|---|---|
| Quote identity + persistence state | Know which quote / save state |
| Customer (+ Site when useful) | WHO / WHERE |
| Composition list (sections + lines) | WHAT is offered |
| Primary add affordance | Start composing |
| Authoritative total affordance | Commercial orientation |
| Primary lifecycle CTA | Send when ready |

### Composition actions (taxonomy)

| Action | Opens / does | Priority |
|---|---|---|
| **הוסף מוצר** | Catalog search/pick | Primary |
| **הוסף פריט מותאם** | Free/custom line | Primary |
| **עיצוב מערכת** | System Builder (CCTV only today) | Primary when relevant; not a separate app |
| **תבנית / חבילה** | Existing template/package apply | Secondary (discoverable) |
| **עבודה / שירות** | Existing labor/service commercial model | Secondary — clear label, not new engine |
| **הערה** | Note line (capability exposure) | Secondary |
| **סעיף** | Section create | Secondary |

These are **composition actions**, not modules.

### Discoverability without clutter

- One clear **Add** entry (menu / split) that lists the actions above.  
- Desktop may show 1–2 frequent actions inline; overflow holds the rest.  
- Mobile: keep **one** dock; put secondary composition actions in overflow / in-flow section tools — **do not** add another permanent bottom bar.  
- Do not duplicate empty-state CTAs and toolbar chips at equal weight (already partially addressed).

### Desktop vs mobile same mental model

| | Desktop | Mobile |
|---|---|---|
| Composition | Main column list | Same list, scrollable |
| Summary | Side rail | Total → sheet (progressive) |
| Actions | Header + in-section tools | Dock primary + overflow |
| System Builder | Drawer/assistance | Same drawer pattern |

Same objects. Different chrome density.

---

## 4. Direct interaction

**Contract:** “I already know what I want to sell.”

User can immediately:

- Pick catalog products  
- Add free/custom lines  
- Apply template/package  
- Add labor/service (existing model)  
- Add notes (when exposed)  
- Manage sections  
- Adjust qty / price (with permissions) / discounts  

**Must not** be forced through engineering questions.

System Builder remains available as an optional assistance action — never a gate.

---

## 5. Guided interaction

**Contract:** “I need SITE SECURE to help determine what this system requires.”

### Current real engine: CCTV only

```
Requirements
  → Engineering calculation
  → Recommendation
  → Catalog candidates
  → User review / alternatives
  → Apply
  → SAME Quote Composition
```

### After Apply

Recommended lines are **ordinary composition** from the user’s perspective.

User must still be able to:

- change quantity where permitted  
- replace equipment  
- delete equipment  
- add manual equipment / labor / notes / free lines  
- use discounts  

without leaving Quote Builder.

**Do not modify CCTV calculations** as part of interaction architecture.

---

## 6. Hybrid interaction

Hybrid is **not a mode**. It is the natural ability to combine sources.

### Examples

| Flow | Still one quote |
|---|---|
| CCTV recommendation + manual monitor | Yes |
| Template + changed qty + custom installation | Yes |
| Catalog equipment + free line + note | Yes |
| CCTV recommendation + different camera + extra labor | Yes |

### Rule

Do **not** create artificial restrictions based on line origin.

Provenance may exist internally (package id, apply fingerprint, catalog snapshot) for audit/re-apply — it must not create a second workflow lane.

### Current technical restrictions that may contradict free hybrid (factual)

| Restriction | Nature |
|---|---|
| CCTV identical re-apply fingerprint block | Integrity guard — OK; does not block manual editing of applied lines |
| Draft-only editing after send | Lifecycle — revise for new version |
| `override_price` for catalog unit-price divergence | Permission — commercial control |
| Optional roles removable; core roles block “complete” recommend | Engine completeness — applied partial lines still editable after apply |

None of these require separate “engine quote” vs “manual quote” products.

---

## 7. Composition action taxonomy

| Layer | Actions |
|---|---|
| **Structure** | Sections (create/rename/collapse/duplicate/delete) |
| **Equipment** | Catalog product · free/custom · template/package · System Builder apply |
| **Commercial service** | Labor/service via existing catalog/service→labor model |
| **Annotation** | Note lines |
| **Commercial adjustments** | Line discount · quote discount · section discount (exposure) · price override (permissioned) |

### Coexistence without overload

1. **Structure tools** live with the composition list (section headers).  
2. **Add content** lives in one Add menu.  
3. **Money adjustments** live on the line row + advanced commercial area + summary — not a second builder.  
4. **Guided design** is one Add/Design entry → drawer → return to list.

---

## 8. Customer interaction

| Question | Contract |
|---|---|
| WHO is buying? | Customer |
| Draft without customer? | Allowed |
| Before Send? | Customer **required** (current rules) |
| Create/search/select/change? | Supported in builder |
| Clear to unassigned? | Deliberate open PO decision — not assumed in this contract |
| Full CRM edit in builder? | Not required for unified composition; profile link remains valid |

Customer is **context**, not a separate quoting product.

---

## 9. Site interaction

| Question | Contract |
|---|---|
| WHERE will the system exist? | Site |
| During creation/send? | **Optional** (current working decision) |
| Project-from-quote? | **Required** (current behavior) |
| Affect pricing? | **No** |
| Affect CCTV calculations? | **No** |

### Communicating operational value without false mandate

Conceptually:

- Soft readiness / hint: “בחירת אתר תעזור בהמשך לפרויקט והתקנה”  
- Do not block Send solely for missing site under current policy  
- After approval, project handoff clearly states site is needed  

This teaches the lifecycle connection **without** inventing site-driven engineering.

---

## 10. Sections / notes / labor / discounts

| Capability | Interaction treatment |
|---|---|
| **Sections** | First-class structure on the composition surface |
| **Section discounts** | Existing backend/pricing capability — expose carefully as commercial control on section, not a new module |
| **Notes** | Clear composition action (“הערה”) → note line; appears in document appropriately |
| **Labor / service** | No new labor engine; clearer labeling of existing service→labor catalog path (“עבודה / שירות”) |
| **Quote-level discount** | Advanced commercial controls (not primary add clutter) |
| **Line-level discount** | On the line editor (existing percent UX) |
| **Catalog lines** | Primary add path |
| **Free/custom lines** | Primary add path for non-catalog |

VAT: **workspace-driven by default**; displayed; server-calculated. **No** unrestricted per-quote VAT editing in primary Builder. Tax exceptions = separate future decision.

---

## 11. System Builder visibility

### Working decision

Do **not** advertise engines that do not exist.

### Visible as guided design today

**CCTV only** — has requirements, calculation, recommendation, catalog resolution, apply.

### Not presented as functional engines until complete

Alarm · Access Control · Intercom · Network · Low Voltage · Combined

### Visibility policy (planning only — do not delete code)

| Policy | Meaning |
|---|---|
| Hide or disable non-CCTV engine choices in user-facing System Builder entry | Prevents fake breadth |
| Keep CCTV as the labeled guided capability | Honest product |
| Future engines appear only when full contract is met | See §19 |

Code stubs may remain in repository; **interaction** must not promote them.

---

## 12. Send terminology

### Primary semantic direction

**שליחה לאישור הלקוח**

### Mobile / short contexts (same meaning)

**שליחה ללקוח** may be used where space is tight, with identical semantics.

(Existing copy already includes related phrasing such as menu “שלח ללקוח” — primary CTA today remains “שליחה לאישור”; **do not rename in this pass**.)

### CTA contract

| Aspect | Expectation |
|---|---|
| Audience | **Customer** |
| Meaning | Formal publication of the proposal for customer approval |
| Preconditions | Current send validation (customer, title, validity, payment_terms, billable lines, …) |
| Lifecycle | draft → `sent` (then viewed / approved / rejected …) |
| Immutability | Customer-facing version/snapshot established for that version |
| After click | Staff expects locked draft editing until revise; customer can open public experience |

**Not:** internal staff approval workflow.

---

## 13. Persistence terminology

### Technical states

| State | Technical meaning |
|---|---|
| **NEW LOCAL DRAFT** | No server `id` yet (`טרם נשמרה` today) |
| **SAVING** | Persist in flight |
| **SAVED** | Server id + clean vs baseline |
| **DIRTY / CHANGES PENDING** | Server id + unsaved header/content edits |
| **SAVE ERROR** | Persist failed |

### Recommended concise Hebrew (docs only — no string changes)

| State | Recommended direction |
|---|---|
| NEW LOCAL DRAFT | **טיוטה מקומית** or **עדיין לא נשמרה בשרת** (clearer than ambiguous “טרם נשמרה” alone) |
| SAVING | **שומר…** (already used) |
| SAVED | **נשמרה** / relative “נשמר לפני …” (existing pattern) |
| DIRTY | **שינויים שלא נשמרו** (already exists as distinct string) |
| SAVE ERROR | **שגיאת שמירה** |

**Critical distinction to preserve:** local-never-persisted ≠ dirty-after-persist.

---

## 14. Preview / Share / Send contract

### Desired semantic separation

| Action | Meaning |
|---|---|
| **PREVIEW** | Staff inspection of the proposal. No formal publication lifecycle. |
| **SHARE** | If retained: expose/access a proposal link **without** necessarily invoking full formal Send lifecycle. |
| **SEND TO CUSTOMER FOR APPROVAL** | Formal publication: validate → customer-facing version/snapshot → lifecycle `sent` → customer can approve/reject. |

### Current behavior vs desired (factual)

| Topic | Current implementation | Fit to contract |
|---|---|---|
| Preview | Staff `/preview` + in-builder live pane | Aligns with Preview |
| Share | `shareQuote` can mint secure link / refresh access; comment in API: draft may mint **without** marking sent; UI outcomes explicitly say proposal not marked sent | **Partially aligns** with “access without full send” |
| Send | `sendQuote`: validate, snapshot as sent, mark `sent`, mint token | Aligns with formal Send |
| Ambiguity | Share dialog lead mentions viewing **and approval**; user may think Share = Send | **Unsafe/confusing** relative to desired separation |
| Channels | Send confirm can also open share/email/WhatsApp paths | Blurs Share vs Send in interaction |

### PO decision required (do not invent behavior)

Before implementation:

1. Is Share allowed on **draft** without `sent`? (Current: yes.)  
2. If yes, can a customer **approve** via a draft share link? (Current: public open of draft share can promote toward sent — lifecycle nuance exists.)  
3. Should Share be staff-only preview-link vs customer-approval-capable?  
4. Should Send be the **only** path that enables approve/reject?

Flag: current Share semantics need an explicit product policy before UX rewrites.

---

## 15. Customer version contract

| State | Staff expectation | Customer expectation |
|---|---|---|
| Local draft | Editing; nothing on server | — |
| Server draft | Editable | Not formal proposal yet |
| Preview | Staff sees document | — |
| Send | Locks editing for that version | Receives proposal version |
| Sent | Read-only until revise | Can view (token) |
| Viewed | Status update | Has opened |
| Approved / Rejected | Lifecycle banner / next CTAs | Decision recorded |
| Revise | **New** editable draft/version | Old token superseded; not silent mutation of prior truth |

### Immutability principle

Once formally sent, **customer-facing version is immutable**. Revisions create a new version rather than rewriting customer truth.

### Staff PDF asymmetry (current — do not fix here)

| Consumer | Source |
|---|---|
| Public PDF/view | Version snapshot |
| Staff PDF after send | Live lines/totals + frozen company/template |

**Product decision needed** before implementation: keep dual path or align staff PDF to full snapshot.

---

## 16. Pricing interaction boundary

| UX may | UX must not |
|---|---|
| Display server totals | Become pricing authority |
| Collect qty / unit price / discounts | Invent parallel totals |
| Show VAT as commercial info | Unrestricted per-quote VAT editing in primary Builder |
| Show cost/margin if permitted | Leak cost to unauthorized roles |

| System Builder answers | Pricing answers |
|---|---|
| WHAT / HOW MUCH equipment / WHICH candidates | HOW MUCH the commercial offer costs |

Preserve FastAPI pricing, server VAT math, discounts, `view_cost`, `override_price`, technician restrictions.

---

## 17. Mobile interaction contract

Preserve recently stabilized architecture:

- One Quote action dock  
- AppShell nav coexistence  
- Total → summary disclosure  
- One primary CTA  
- Scrollable composition  
- No permanent second summary stack  
- No forced wizard  

### Fitting unified composition actions

| On dock | Elsewhere |
|---|---|
| Total (→ summary) | — |
| Primary lifecycle CTA (Send when appropriate) | — |
| Overflow: preview, add, share (per policy), more | In-flow: section tools, empty-state primary add |

Do **not** add a second persistent bottom composition bar for System Builder / catalog.

System Builder opens as overlay/drawer, then returns to composition list.

---

## 18. Desktop interaction contract

Conceptual hierarchy (not pixels):

```
Quote context / status / persistence
↓
Customer + Site + details
↓
Composition (list + add actions + System Builder entry)
↓
Commercial controls (discounts; permissioned cost/margin)
↓
Summary rail
↓
Preview / Share (policy) / Send
```

System Builder = **assistance / composition capability** (drawer), not a separate application window/product.

---

## 19. Future engine UX contract

An engine may become user-visible **only** when it supports the complete chain:

1. Domain requirements  
2. Validation  
3. Engineering calculation  
4. Required/optional component roles  
5. Recommendation  
6. Catalog resolution  
7. Alternatives/review  
8. Apply to **same** Quote  
9. Existing pricing takes over  

A type enum alone is **not** enough to show an engine.

Do not build engines in this task.

---

## 20. Current UX contradictions

| Contradiction | Detail |
|---|---|
| One builder vs stub engines | UI suggests Alarm/Access/… engines that cannot calculate |
| Send label vs behavior | “שליחה לאישור” vs customer publication |
| Unsaved label vs dirty | “טרם נשמרה” easy to confuse with unsaved edits |
| Share vs Send | Share can mint link without `sent`; copy mentions approval |
| Site soft then hard | Optional at send; required at project |
| Staff PDF vs public truth | Dual document sources after send |
| Stepper vs freedom | May feel wizard-like while allowing free navigation |
| Add clutter | Multiple equal-weight add affordances historically |

---

## 21. Existing capabilities ready for exposure

(Assuming PO confirms the working intents already stated.)

| Capability | Exposure type | Notes |
|---|---|---|
| Section discounts | Existing backend/pricing | Careful commercial UI |
| Note lines | Existing type + document render | Clear Add Note action |
| Labor/service clarity | Existing service→labor model | Labeling / entry clarity — not new engine |
| CCTV as sole guided engine | Existing | Hide fake breadth |
| Send-to-customer wording | Existing send API | Terminology only |
| Persistence vocabulary | Existing save states | Distinct local vs dirty |
| Hybrid editing after CCTV apply | Existing | Emphasize in UX copy/patterns |

---

## 22. Product policies still requiring decision

1. **Share vs Send** — especially draft share + whether approval is possible without formal Send.  
2. **Staff PDF after send** — live lines + frozen company vs full snapshot.  
3. **Site send-critical?** — keep optional vs require earlier.  
4. **Clear customer in UI?**  
5. **VAT exceptions** — stay workspace-only vs future controlled workflow.  
6. Exact short mobile string: only “שליחה ללקוח” vs always long form.  
7. Timing to hide stub engines (interaction policy agreed; execution timing).  
8. Section discount UX depth (simple % vs full amount/percent).  
9. Customer dedupe (CRM-wide — outside builder-only).  
10. Authz catalog cleanup (`quotes.approve` / `quotes.export` mismatches).  
11. Send idempotency priority (hardening).

---

## 23. Future implementation workstreams (categories only)

Do **not** mix into one pass:

| Stream | Examples |
|---|---|
| **A. UX / TERMINOLOGY** | Send wording; unsaved vocabulary; stub visibility; hybrid discoverability |
| **B. EXISTING CAPABILITY EXPOSURE** | Section discounts; note action; labor/service clarity |
| **C. PRODUCT POLICY** | Share vs Send rules; staff PDF snapshot policy; site timing communication |
| **D. TECHNICAL HARDENING** | Send idempotency; authz mismatches; optional structural risk containment (not rewrite) |
| **E. NEW DOMAIN CAPABILITY** | Alarm/Access/… engines; site-aware engineering — only with full engine contract |

---

## 24. Protected areas

Future implementation must not casually alter:

- QuoteBuilder mutation/persistence hub (no assumed rewrite)  
- Pricing authority (`pricing.py` / totals APIs)  
- CCTV sizing/recommend math & TS↔Python parity  
- Authz commercial strip (`view_cost`, `override_price`, technician deny)  
- Lifecycle send/public approve/revise  
- Public snapshot customer truth  
- RLS / workspace isolation  

Prefer: small presentation changes, existing APIs/mutations, isolated exposure, strong regression tests.

Any structural QuoteBuilder refactor requires a **separate justification**.

---

## 25. Recommended implementation sequence — CATEGORIES ONLY

Order is categorical planning guidance — **not** file edits, estimates, or P0 lists:

1. **PO lock** on Share vs Send + Staff PDF policy (hard blockers for honest outbound UX).  
2. **A — Terminology & visibility** (send-to-customer wording; persistence vocabulary; hide stub engines).  
3. **B — Composition exposure** (notes; section discounts carefully; labor/service clarity) on the one Add taxonomy.  
4. **C — Policy communication** (site value without false mandate; Share/Send UX aligned to locked policy).  
5. **D — Hardening** (send idempotency; authz cleanup) as separate reliability work.  
6. **E — New engines** only after full contract readiness — never as UI placeholders.

---

## Explicit confirmation (planning artifact)

The original planning task produced only this architecture document with **ZERO product code changed**.

Implementation begins below (Pass A1).

---

# IMPLEMENTATION PASS A1 — TERMINOLOGY & CAPABILITY VISIBILITY

**Date:** 2026-09-22  
**Scope:** Copy + System Builder visibility only. No lifecycle, Share, PDF, pricing, CCTV math, createOnce/autosave, API, authz, or QuoteBuilder refactor.

## Exact strings changed

| Key / surface | Before | After |
|---|---|---|
| `he.cpqSendForApproval` | שליחה לאישור | שליחה לאישור הלקוח |
| `he.cpqSendForApprovalShort` *(new)* | — | שליחה ללקוח |
| `he.quoteUnsaved` | טרם נשמרה | טיוטה חדשה |
| `he.quoteUnsavedHint` | הבונה נפתח מיד. טיוטה במערכת נוצרת רק אחרי שיש תוכן — לא נשמרת הצעה ריקה. | טיוטה חדשה נפתחת מיד. שמירה בשרת מתחילה רק אחרי שיש תוכן — לא נשמרת הצעה ריקה. |

**Unchanged (already matched preferred semantics):**

| Key | Value |
|---|---|
| `he.cpqSaving` | שומר… |
| `he.cpqSavedJustNow` / `cpqSavedAgo` (fresh) | נשמר |
| `he.cpqUnsavedChanges` | שינויים שלא נשמרו |
| Save error | existing `he.quoteSaveError` via `QuoteSaveIndicator` |

**Where each send label appears:**

- Desktop header overflow / sidebar / lifecycle primary / desktop CTAs → `cpqSendForApproval` (“שליחה לאישור הלקוח”).
- Mobile actions bar primary when `lifecyclePrimary.kind === "send"` → `cpqSendForApprovalShort` (“שליחה ללקוח”).

## Exact non-CCTV options hidden

From `SystemBuilderDrawer` type `<Select>` user-facing options:

| Value | Hidden |
|---|---|
| `alarm` | yes |
| `access_control` | yes |
| `intercom` | yes |
| `network` | yes |
| `low_voltage` | yes |
| `combined` | yes |

**Still visible / usable:** `cctv` only.

`SystemBuilderType` enum/type in `apps/web/src/lib/system-builder.ts` **not deleted**. Stub “soon” branch removed from the drawer UI because non-CCTV choices are no longer selectable. CCTV recommend / apply path unchanged.

## Files changed

| File | Change |
|---|---|
| `apps/web/src/i18n/he.ts` | Send + new-local-draft copy; add short send key |
| `apps/web/src/components/quotes/QuoteBuilder.tsx` | Mobile dock pass short send label only |
| `apps/web/src/components/quotes/cpq/SystemBuilderDrawer.tsx` | Selector exposes CCTV only |
| `apps/web/tests/quote-mobile-actions.test.tsx` | Expect short send on mobile toolbar |
| `Docs/QUOTE-BUILDER-UNIFIED-INTERACTION-ARCHITECTURE.md` | This report |

## Tests run

```text
vitest: quote-builder, quote-mobile-actions, quote-save-indicator,
        quote-system-apply, quote-lifecycle-continuity
→ 5 files, 46 tests passed

vitest: cctv-build-system, cctv-sizing
→ 2 files, 41 tests passed

npm run typecheck → pass
npm run build → pass
```

## Regression results (A1)

| Check | Result |
|---|---|
| New Quote local open / createOnce | Untouched; builder tests pass |
| Autosave semantics | Untouched |
| Existing quote load | Untouched |
| CCTV System Builder open / requirements / recommend / apply | Untouched; system-apply + CCTV tests pass |
| Pricing server authority | Untouched (`apps/api/**` / pricing not edited) |
| Send / public approval behavior | Untouched (label only) |
| Mobile dock / desktop builder architecture | Untouched (label wiring only on mobile primary CTA) |

## Business logic untouched (confirmation)

No edits to: `apps/api/**`, `pricing.py`, `quote_pdf.py`, `quote_snapshot.py`, CCTV sizing/recommend, quote lifecycle handlers, share mint, approval, createOnce, autosave, API contracts, authz, RLS, migrations, VAT/cost/margin, project-from-quote.

## Share locations discovered (future policy pass — NOT changed in A1)

Product policy locked for later: **SHARE = VIEW**; **SEND = DECIDE**. Audit only:

| Location | Role |
|---|---|
| `apps/api/app/routers/quotes.py` → `POST /quotes/{quote_id}/share` (`share_quote`) | Mints/remints public token; explicitly does **not** set `sent`; draft path validates completeness |
| `apps/api/app/routers/quotes.py` → `_prepare_share_link` / `_upsert_version_snapshot` | Snapshot upsert for share without status promotion |
| `apps/web/src/components/quotes/QuoteBuilder.tsx` | `ensurePublicUrl` → `api.shareQuote`; mailto / WhatsApp / dialog share; comment: never treat share as sent |
| `apps/web/src/routes/app/quotes/$quoteId.preview.tsx` | Preview-page share/PDF/WhatsApp |
| `apps/web/src/components/quotes/QuoteShareDialog.tsx` | Copy UI |
| `apps/web/src/i18n/he.ts` | Share copy that still implies approval (e.g. `quoteShareDialogLead`: “צפייה ואישור הלקוח”; `quoteShare`: “קישור ללקוח”) — needs future copy/policy pass |
| `apps/web/src/lib/quote-whatsapp-share.ts` | WhatsApp href helpers |
| `apps/web/src/routes/q/$token.tsx` + public quote routes | Customer portal entry |

## Staff PDF path discovered (future snapshot alignment — NOT changed in A1)

Product policy locked for later: after Send, staff PDF for that sent version must equal the public snapshot.

**Current staff PDF code path:**

1. Web: `api.downloadQuotePdf(workspaceId, quoteId)` from `QuoteBuilder.downloadPdf` / print / WhatsApp attach, and preview route.
2. API: `GET /quotes/{quote_id}/pdf` in `apps/api/app/routers/quote_cpq.py` (`quote_pdf`).
3. Builds document via `_document_payload(...)` (imported from quotes router helpers / same pattern as `quotes._document_payload`).
4. `_document_payload` loads **live** quote items + related entities; for non-draft it freezes **company** (and optionally `pdf_template`) from `quote_versions.snapshot.public`, then calls `public_payload(...)`.
5. Renders with `quote_pdf.render_quote_pdf(document)`.

**Gap for future pass:** line/commercial content for staff PDF after send still follows live items (+ frozen company), not a full immutable public snapshot document. Public customer view/PDF use the version snapshot path separately — align staff PDF to the same snapshot for a given sent version.

---

**END — IMPLEMENTATION PASS A1 — STOP**

---

# IMPLEMENTATION PASS A2 — UNIFIED COMPOSITION EXPOSURE

**Date:** 2026-09-22  
**Scope:** Expose existing note / service→labor / section-discount composition inside ONE Quote Builder Add taxonomy. No new domain engines, no pricing.py / API / authz / PDF / lifecycle / CCTV changes.

## Pre-edit capability verification

| Capability | Existing contract | Safely exposable in A2? |
|---|---|---|
| Note lines | `ITEM_TYPES` includes `note`; `POST …/items` with `item_type:"note"`; `pricing.line_net` → 0; `QuoteDocument` already renders notes | Yes |
| Service → labor | Catalog `kind:"service"` / `is_labor`; `_insert_line` remaps; `listCatalogProducts({ kind:"service" })` | Yes (discoverability) |
| Section discount | `quote_sections.discount_type` + `discount_value`; `PATCH …/sections/{id}` recalculates via `_persist_totals` / `pricing.recalculate` | Yes (percent + amount already supported) |
| Templates / packages / CCTV | Existing QuickAdd + drawers | Already present — relabeled into taxonomy |

## Exact existing contracts reused

- **Notes:** `api.addQuoteItem(…, { item_type: "note", description, qty: 1, unit_price: 0 })`
- **Service/labor:** `api.listCatalogProducts(…, { kind: "service" })` then `addQuoteItem` with `product_id` + `item_type: "labor"`
- **Section discount:** `api.patchQuoteSection(…, { discount_type, discount_value })` → server returns authoritative totals (`applyRow`)
- **Permissions:** UI still gated by existing `canEdit` / `canCatalog`; section patch requires server `quotes.edit` (unchanged)

## Files changed

| File | Change |
|---|---|
| `apps/web/src/i18n/he.ts` | Unified Add / section-discount / labor labels |
| `apps/web/src/components/quotes/cpq/QuoteQuickAdd.tsx` | Taxonomy actions: catalog, free, service, note, section, system, package, template |
| `apps/web/src/components/quotes/workspace/QuoteMobileAddMenu.tsx` | Same taxonomy via progressive Add menu (no new dock) |
| `apps/web/src/components/quotes/cpq/QuoteSectionDiscountField.tsx` | **New** compact section-discount editor |
| `apps/web/src/components/quotes/cpq/QuoteLinesPanel.tsx` | Section discount wiring; note add in section menu; service→labor on catalog pick |
| `apps/web/src/components/quotes/cpq/QuoteLineRow.tsx` | Note row (description-only); labor badge |
| `apps/web/src/components/quotes/cpq/QuoteSummaryAside.tsx` | Show `section_discount_amount` distinctly from quote discount |
| `apps/web/src/components/quotes/QuoteBuilder.tsx` | Wire note/service/mobile taxonomy; `quickCatalogKind`; section discount patch body |
| `apps/web/src/styles.css` | Section discount + note row presentation |
| `apps/web/tests/quote-composition-a2.test.tsx` | **New** focused A2 tests |
| `apps/web/tests/quote-mobile-actions.test.tsx` | Taxonomy + note add |
| `apps/web/tests/quote-document.test.tsx` | Note rendering regression |
| `Docs/QUOTE-BUILDER-UNIFIED-INTERACTION-ARCHITECTURE.md` | This report |

## Add taxonomy before / after

**Before (QuickAdd):** free, section, build system, add system, catalog, template — no note/service; mobile: item / system / section / build.

**After (same conceptual set on desktop QuickAdd + mobile Add menu):**

| Concept | Hebrew (repo) | Entry |
|---|---|---|
| Catalog product | מוצר מהקטלוג | QuickAdd / mobile |
| Free line | שורה חופשית | QuickAdd / mobile |
| Service / labor | שירות / עבודה | QuickAdd service filter (`kind=service`) / mobile |
| Note | הערה | QuickAdd / mobile / section menu |
| Template | תבנית הצעה | QuickAdd / mobile |
| Package | תבנית / חבילה | QuickAdd addSystem / mobile |
| System planning | תכנון מערכת / בנה מערכת | QuickAdd system / mobile buildSystem |
| Section | סעיף | QuickAdd / mobile (repo term; not מקטע) |

Desktop toolbar secondary buttons retained (no removal of working entry points). No second mobile bottom bar.

## Note implementation / exposure

- First-class Add actions create `item_type: "note"` via existing mutation.
- Editor: description + reorder/delete only (no qty/price/discount UI).
- Server pricing already zeros notes; document already renders notes without commercial columns.
- Customer-document notes / quote header `customer_notes` remain distinct (header notes unchanged).

## Labor / service exposure

- Discoverable “שירות / עבודה” opens QuickAdd in `kind=service` catalog browse mode.
- Pick maps to `item_type: "labor"`; in-panel catalog picks with `product.kind === "service"` also map to labor.
- Labor rows show badge `שירות / עבודה`.
- No new labor engine / hourly math / DB model.

## Section discount exposure

- Per-section editor: percent or amount (existing API values) → apply / clear.
- Hint distinguishes scope: section vs line vs quote.
- Summary shows `section_discount_amount` separately from `cpqQuoteDiscount`.
- Authoritative totals only from mutation response (`applyRow`); no client section-total authority.

## Intentionally NOT exposed / blocked

| Item | Status |
|---|---|
| New note API / pricing.py note changes | Not needed — existing contract used |
| Labor estimation / scheduling | Out of scope |
| Broader discount UX (cascading editors, quote-level redesign) | Quote-level discount UI already existed; left as-is |
| Share / PDF snapshot / send / site / VAT / new System Builders | Explicitly deferred (future passes) |
| Removing duplicate desktop toolbar buttons | Kept per “do not automatically remove working entry points” |

No A2 item required a stop-on-expansion blocker.

## Permission verification

- Add / note / free / section / section-discount: `canEdit` (server `quotes.edit`)
- Catalog / service browse / packages / templates / CCTV: also `canCatalog` where previously required
- No client-side authz invention; `override_price` / `view_cost` unchanged

## Pricing-authority verification

- No edits to `apps/api/**`, `pricing.py`, PDF, snapshot, CCTV, lifecycle, authz, migrations
- Line/section mutations continue to apply server `QuoteOut` totals
- Notes remain zero-priced via existing server `line_net`

## Mobile regression verification

- Existing dock + AppShell nav unchanged
- Add taxonomy via existing Add control → progressive menu
- Primary send short label / overflow architecture unchanged (A1 preserved)
- Mobile actions tests pass including taxonomy + note add

## Tests / build

```text
vitest quote suites (builder, lifecycle, system-apply, cpq, line-row,
  document, composition-a2, mobile-actions) → 72/72 pass
vitest CCTV (build-system, sizing) → 41/41 pass
apps/api tests/test_pricing.py → 7/7 pass
npm run typecheck → pass
npm run build → pass
```

## Business logic untouched (confirmation)

Pricing order, authz engine, send/share/approval, createOnce/autosave, CCTV sizing/recommend/apply, PDF/snapshot, VAT, cost visibility, price override rules, project-from-quote, RLS/migrations — **not modified**.

---

**END — IMPLEMENTATION PASS A2 — STOP**

---

# IMPLEMENTATION PASS A3 — OUTBOUND PROPOSAL INTEGRITY

**Date:** 2026-09-22  
**Scope:** Share=VIEW, Send=DECIDE, staff PDF=sent snapshot, Send concurrency guard. No migrations, no new token types, no pricing/CCTV/composition changes.

## Previous integrity defect

1. `public_quotes._assemble(mark_viewed=True)` promoted **draft → sent** (`public_first_open`) then **sent → viewed**, so a draft Share recipient could approve/reject without staff `/send`.
2. Staff PDF for non-draft rebuilt from **live** items (+ frozen company/template), while public PDF used `quote_versions.snapshot.public` — same “sent version” could diverge.
3. `/send` patched without `status=eq.draft` / version condition and always minted a token after snapshot — concurrent Sends could double-publish.

## Share lifecycle change

- Removed draft→sent promotion from `_assemble`.
- Draft Share open: status stays **draft**; `can_approve=false`, `can_reject=false`; no patch/events.
- Formally **sent** open: preserved **sent → viewed** tracking.

## Server approval/rejection gate

- Unchanged predicate: `status ∈ {sent, viewed}` + version match + signature/terms.
- With promotion removed, draft Share tokens **cannot** reach decision states via open; direct approve/reject on draft → `403 RESOURCE_STATE`.
- Formal Send remains the only draft→sent gateway.

## Share copy changes

| Key | After |
|---|---|
| `quoteShareDialogTitle` | שיתוף לצפייה |
| `quoteShareDialogLead` | קישור מאובטח לצפייה בהצעה — ללא אישור או דחייה של הלקוח |
| `quoteShare` | קישור לצפייה |
| `quoteShareOutcomeNotSent` | Clarifies Share=view; Send required for customer approval |
| Send labels | Unchanged: שליחה לאישור הלקוח / שליחה ללקוח |

## Staff PDF source before / after

| Status | Before | After |
|---|---|---|
| draft | live `_document_payload` | live (unchanged) |
| sent / viewed / approved / rejected / expired | live lines + frozen company/template | **`quote_versions[version].snapshot.public`** when present (same as public); live lifecycle overlays for status/approval timestamps |

## Send concurrency hardening

`_transition_to_sent` order now:

1. validate + persist totals  
2. **Conditional** `PATCH … status=sent WHERE status=eq.draft AND version=eq.N`  
3. If zero rows → `403 RESOURCE_STATE` (`send_already_published`) — **no** snapshot, **no** mint, **no** events  
4. Winner only → upsert sent snapshot → mint token → audit/event  

## Backward compatibility

- Formally sent / approved / rejected tokens: unchanged decision eligibility.
- Draft Share tokens: remain viewable; no longer auto-publish on open.
- No mass revoke; no migration; superseded/version/expiry rules preserved.
- Quotes already promoted historically via Share-open remain in their current lifecycle (no downgrade).

## Files changed

| File | Change |
|---|---|
| `apps/api/app/routers/public_quotes.py` | Remove draft promotion |
| `apps/api/app/routers/quotes.py` | Send conditional publish; staff `_document_payload` snapshot path; Share docstring |
| `apps/web/src/i18n/he.ts` | Share view-only copy |
| `apps/api/tests/test_quote_a3_outbound_integrity.py` | **New** A3 contract tests |
| `Docs/QUOTE-BUILDER-UNIFIED-INTERACTION-ARCHITECTURE.md` | This report |
| `Docs/QUOTE-BUILDER-A3-OUTBOUND-INTEGRITY-PREFLIGHT.md` | Implemented marker only |

## Tests / results

```text
API: test_quote_a3_outbound_integrity + share_truth + public_boundary
     + snapshot + pricing + validation + share_policy → 39 passed
API: test_quote_pdf (non-pymupdf subset) → 7+ passed
     (full plain-text PDF suite needs pymupdf — env missing; not A3 regression)
Web: quote builder/lifecycle/mobile/composition/system-apply + CCTV → 91 passed
typecheck + build → pass
```

## Blocked / deferred

- Token `purpose` column / separate Share token type — not needed  
- Revoke-all-on-Send — deferred (compatibility)  
- Historical `GET …/versions/{n}/pdf` UI — out of scope  
- Full `test_quote_pdf` text extraction — blocked by missing `pymupdf` in local env (pre-existing)

## Protected confirmation

`pricing.py`, CCTV engines, authz catalog/engine rules (aside from Send using existing RESOURCE_STATE), RLS, migrations, A1/A2 composition UX — **untouched**.

### Final verification

| Check | Result |
|---|---|
| A. Draft Share cannot formally publish | Yes — no draft patch on open |
| B. Draft Share cannot approve/reject | Yes — server 403 |
| C. Staff Send is decision gateway | Yes |
| D. Sent staff PDF = public snapshot source | Yes when snapshot.public present |
| E. Concurrent Send single winner | Yes — conditional draft patch |
| F. Pricing unchanged | Yes |
| G. CCTV unchanged | Yes |

---

**END — IMPLEMENTATION PASS A3 — STOP**
