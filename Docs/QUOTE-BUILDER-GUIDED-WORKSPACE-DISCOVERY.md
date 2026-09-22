# Quote Builder — Guided Multi-Stage Workspace Discovery

**Date:** 2026-09-22  
**Type:** UX / product architecture discovery only  
**Code changes:** **ZERO** (`apps/**`, `packages/**`, `supabase/**`, `tests/**` untouched)

**Inputs audited (code + docs):**
- `apps/web/src/components/quotes/QuoteBuilder.tsx`
- `apps/web/src/components/quotes/workspace/{types,QuoteStepper,QuoteHeader,QuoteContextBar,UnifiedReadiness,QuoteMobileActionsBar}.tsx`
- `apps/web/src/components/quotes/cpq/{QuoteLinesPanel,QuoteQuickAdd,QuoteSummaryAside,SystemBuilderDrawer,TemplateFastPath}.tsx`
- `apps/web/src/lib/{quote-readiness,quote-cpq,quote-builder}.ts`
- `Docs/QUOTE-BUILDER-UNIFIED-INTERACTION-ARCHITECTURE.md`
- `Docs/QUOTE-BUILDER-KAI-PREMIUM-RESPONSIVE-POLISH.md`
- Existing QA screenshots under `Docs/quote-builder-kai-*qa/`

---

## 1. Executive UX problem

Kai polish improved **visual quality**. It did not solve **attention architecture**.

The Quote Builder still presents nearly the entire commercial workflow on one scrollable surface. The user must simultaneously hold:

customer context · metadata · templates · composition · System Builder · commercial editing · totals · readiness · outbound actions

**Result:** Even with premium surfaces, the page feels like a dense professional ERP form rather than a focused proposal-building session.

**Thesis:** Decompose **user attention** into guided stages. Keep **one Quote**, **one state model**, **one domain**.

**Anti-goal:** A restrictive checkout wizard that blocks exploration.

---

## 2. Current-page cognitive-load audit

### What exists today

| Layer | Reality |
| --- | --- |
| Visual hierarchy | Stronger after Kai polish (header / composition / summary) |
| Attention model | Still **one long page** |
| Stepper | Already exists: `details \| items \| pricing \| review` — but only **scrolls** within the same page |
| Mobile | Stepper icons + closed dock; content still largely stacked |
| Progressive disclosure | Partial (terms, project-more, context accordion on mobile) — insufficient |

### Cognitive load sources (ranked)

1. **Composition + context + summary visible together** on desktop  
2. **Secondary metadata** (lead, validity, template, terms) competing with “what am I selling?”  
3. **Outbound + readiness + totals** always present while composing  
4. **System Builder + catalog + packages** competing as peer entry points when empty  
5. **Mobile:** details form + stepper + dock + AppShell nav compete for first viewport  

### What is already working (do not discard)

- Unified composition (`הוסף להצעה` / quick-add taxonomy)  
- Server-owned pricing  
- Lazy `createOnce()` for `/app/quotes/new`  
- Closed mobile dock architecture  
- Free jump via existing `QuoteStepper` (`goToStep` does not persist)  
- Readiness mapped to real gaps  

---

## 3. Complete current field/action inventory

### Context / header metadata

| Control | Notes |
| --- | --- |
| Customer picker / create | Required for Send (critical gap) |
| Site select / create | Recommended in UX readiness; not hard Send blocker in soft treatment |
| Lead | Optional |
| Title | Often critical via server gaps |
| Project name | Optional |
| Valid until | Soft warning in readiness; may be critical in gaps |
| Project address / summary / key points | Progressive (“פרטי פרויקט נוספים”) |
| Quote discount amount/percent | Header commercial fields (often buried in project-more) |
| Payment terms / warranty / general terms / customer notes / internal notes | Progressive (“תנאים ומסמכים”) |
| Quote-level template select + apply | Composition scope applicator |
| Save as template / save as package | Manager overflow / template menu |

### Composition

| Control | Notes |
| --- | --- |
| `הוסף להצעה` / quick-add | Catalog, free, service/labor, note, section, build system, package, quote template |
| Catalog search | Empty progressive / quick-add |
| System Builder drawer | Nested CCTV/design workflow; `ensureQuoteId` → `createOnce` |
| System/package picker | Applies package into section |
| Sections rename/discount/duplicate/delete/collapse | Line organization |
| Line qty / unit price / discount / desc / sku | Commercial edit |
| Reorder / delete lines | |

### Commercial / outbound / global

| Control | Notes |
| --- | --- |
| Summary rail (subtotal, VAT, total, margin if permitted) | Sticky desktop |
| Unified readiness | Sticky desktop + mobile sheet |
| Preview (`תצוגת לקוח`) | Staff-only route; may save first |
| Live preview pane | Optional desktop |
| Send | Draft only; blocked by critical gaps |
| Share / WhatsApp / copy link / revoke | Overflow; post-send oriented |
| PDF / print | Overflow |
| Revise | Non-draft |
| Version history / profit tab | Overflow / tabs |
| Save / autosave / save indicator | Global |
| Status / version / number | Global header |
| Undo/redo header draft history | Local draft history |
| Cancel quote | Overflow |
| Mobile dock: total · primary CTA · overflow (add/preview) | Architecture closed |
| Stepper | Scroll targeting only |

### Lifecycle / state

| State | Behavior |
| --- | --- |
| Local unsaved (`/app/quotes/new`) | No server id until `createOnce` |
| Draft with id | Editable; autosave header; send possible when ready |
| Sent / viewed | Locked edit (`canEdit` false); show link / activity CTAs |
| Approved / rejected | Lifecycle banner; project handoff when applicable |
| Revised | New draft version via revise API |

---

## 4. Proposed stage architecture

### Recommendation: **four stages**, with adjusted Hebrew names

Align proposed product language with the **existing** stepper model (already four steps), but redefine stage **content ownership** so each stage is a focused workspace—not a scroll bookmark.

| # | Hebrew name (recommended) | Internal id (existing) | Job |
| --- | --- | --- | --- |
| 1 | **פרטי ההצעה** | `details` | Who / where / proposal identity |
| 2 | **תכנון וציוד** | `items` (rename UX label) | What we offer (systems, catalog, labor, notes) |
| 3 | **הצעה ומחיר** | `pricing` | How the commercial proposal reads & costs |
| 4 | **תנאים ושליחה** | `review` | Terms readiness + Preview + Send |

### Why not 3 or 5?

- **3** collapses “build the offer” with “price the offer” → recreates current overload.  
- **5** splits terms from send or planning from equipment → wizard fatigue + nested System Builder risk.  
- **4** matches existing `QuoteWorkspaceStep` and natural commercial narrative.

### Label adjustments vs proposal draft

| Draft proposal | Recommendation | Why |
| --- | --- | --- |
| פרטי ההצעה | Keep | Better than current stepper “לקוח ואתר” (includes title/validity/template) |
| תכנון וציוד | Keep (replace “היקף ופריטים”) | Emphasizes System Builder + equipment intent |
| הצעה ומחיר | Keep (replace bare “תמחור”) | Commercial document, not only numbers |
| תנאים ושליחה | Prefer over “בדיקה ואישור” | Customer-outbound framing |

---

## 5. Stage 1 — פרטי ההצעה

**Question:** למי ולאיזה פרויקט ההצעה?

### Belongs here (primary)

- Customer select / create  
- Site (optional but encouraged)  
- Lead (optional, progressive)  
- Title  
- Project name  
- Validity date  
- Quote-level **template selection / apply** (scope starter)

### Progressive / secondary

- Extra project details (address, summary, key points)  
- Header-level discount fields (or defer to Stage 3 — **PO decision**)  

### Does **not** belong as primary Stage 1 content

- Line composition, System Builder, catalog browsing  
- Full pricing rail  
- Payment terms / documents (Stage 4)  
- Preview / Send as primary CTAs (available globally muted)

### Required vs optional (current rules, not invented)

| Field | Send impact today |
| --- | --- |
| Customer | **Blocking** (critical) |
| Items | Blocking — but completed in Stages 2–3 |
| Payment terms | Often **blocking** |
| Title | Often blocking via gaps |
| Valid until | Soft recommended / may be critical in gaps |
| Site | Recommended (not treated as Send failure in soft UX) |

Stage 1 should make customer + title + validity calm and clear; it should **not** force site/lead completion before Stage 2.

---

## 6. Stage 2 — תכנון וציוד

**Question:** מה אנחנו מציעים ללקוח?

### Belongs here

- Empty onboarding: `הוסף פריט` / `בנה מערכת` / secondary catalog  
- Unified quick-add (catalog, free, service/labor, note, package, section, System Builder)  
- System Builder drawer (nested)  
- Catalog search / pick  
- Package (“תבנית / חבילה”) apply  
- Initial section creation when applying systems  

### Stage 2 posture

- Emphasize **equipment & services intent**  
- Show lines in a **planning-forward** presentation (name, spec, qty)  
- De-emphasize deep commercial editing (unit price / discounts) — still editable if needed, but Stage 3 is the commercial desk  

### Does not dominate here

- Full VAT/total control center  
- Terms / Send readiness checklist  
- Quote-level template (already Stage 1) — though “apply composition template” may appear in quick-add (see §17)

---

## 7. Stage 3 — הצעה ומחיר

**Question:** איך ההצעה המסחרית נראית וכמה היא עולה?

### Belongs here

- Sections as proposal groups  
- Line commercial fields: qty, unit price, discount, line total  
- Notes as customer-facing proposal text (if not placed earlier)  
- Quote/section discounts  
- **Full** summary: subtotal, discounts, VAT, **סה״כ לתשלום**  
- Optional cost/margin (permission-gated)  

### Authority

**No client pricing formulas.** Display server totals only (current contract).

### Relationship to Stage 2

Same lines, different **attention mode**:

- Stage 2: “Did we include the right system?”  
- Stage 3: “Is the commercial document correct?”

Users may jump freely; state is shared.

---

## 8. Stage 4 — תנאים ושליחה

**Question:** האם ההצעה מוכנה ללקוח?

### Belongs here

- Payment terms, warranty, general terms  
- Customer-facing notes  
- Documents / attachments if/when product supports them in builder  
- Validity confirmation (if not finalized in Stage 1)  
- **Full readiness** (primary home)  
- Preview (strong)  
- Send (strongest)  
- Share/PDF as secondary after readiness  

### Preserve semantics

| Action | Meaning |
| --- | --- |
| Preview | Staff-only |
| Share | View link / distribution |
| Send | Customer decision |

---

## 9. Global persistent context

### Minimum useful persistent chrome (recommended)

| Element | Why |
| --- | --- |
| Quote number / unsaved identity | Where am I? |
| Status · version | Lifecycle trust |
| Quiet save state | Confidence |
| Compact customer (or “לא נבחר לקוח”) | Context without Stage 1 |
| Compact **סה״כ** (running total) | Continuous commercial orientation |
| Stage navigator | Where in process? |
| Overflow for rare actions | Power without clutter |

### Do **not** keep globally by default

- Full summary rail (subtotal/VAT/margin/readiness list)  
- Entire context form  
- Full readiness checklist  

**Desktop Stage 3–4:** full summary + readiness return as stage content (or Stage 4 sheet).  
**Desktop Stage 1–2:** compact total chip only.

---

## 10. Desktop stage navigation

### Pattern

Horizontal **text stage navigator** (evolve current `QuoteStepper`):

`פרטי ההצעה → תכנון וציוד → הצעה ומחיר → תנאים ושליחה`

### Visual rules (Kai restraint)

- Current stage: clear weight  
- Completed: subtle check / muted  
- Attention: restrained dot only when **blocking** gaps map to that stage  
- No giant numbered circles / checkout chrome  

### Behavior

- Click stage → switch focused workspace (show/hide major regions)  
- Does **not** save, create, send, or revise  
- Existing scroll helpers can remain as progressive enhancement during migration  

---

## 11. Mobile stage navigation

### Pattern

Compact header strip:

`שלב 2 מתוך 4`  
**תכנון וציוד**

+ existing icon stepper (relabeled) as secondary jump control.

### Viewport rule

Only current stage’s primary content dominates. Other stages are not stacked below.

### Dock

Keep **one** Quote dock + AppShell nav. No new bar.

---

## 12. Next / Back behavior

| Surface | Recommendation |
| --- | --- |
| Desktop | Optional contextual `המשך` / `חזרה` near stage footer; **not** exclusive |
| Mobile | Stronger utility — primary path after completing obvious Stage work |
| Both | Stage tabs/navigator remain free jump |

`המשך` never means Submit/Send.

---

## 13. Free stage jumping

**YES — free jump is the default.**

Rationale from real sales work:

- Equipment may start before optional site/lead  
- Pricing tweaks after terms draft  
- Returning to Stage 1 must not destroy lines/designs  

### What does **not** block stage entry

- Missing optional fields  
- Empty lines (user may open Stage 3 early)  
- Unsaved local draft  

### What blocks **Send** (not stage entry)

Existing critical gaps only (`canSendWithGaps` / readiness critical). Stage navigation must not invent new gates.

Optional soft nudge: “חסר לקוח” chip on Stage 1 when jumping to Stage 2 — never a hard stop.

---

## 14. Autosave implications

Current behavior (`QuoteBuilder`):

- Header autosave after ~900ms when `dirty` and (`live.id` **or** `draftHasContent`)  
- Stage change (`goToStep`) today: **setActiveStep + scroll only** — no save  

### Staged UX must preserve

| Rule | Requirement |
| --- | --- |
| Stage change ≠ submit | Mandatory |
| Stage change ≠ createOnce | Mandatory |
| Stage change ≠ new version | Mandatory |
| Dirty state survives jumps | Mandatory |
| Autosave continues regardless of stage | Mandatory |

If a stage hides dirty fields, autosave must still flush the same draft model.

---

## 15. createOnce implications

### Does changing stage call `createOnce()`?

**No — and it must not.**

Today `goToStep` does not call it. Keep that contract.

### Actions that **do** call `createOnce()` today (verified)

| Action | Location intent |
| --- | --- |
| Header persist / save when no id | `persistHeader` / save mutation |
| Add / patch / delete / reorder lines | item mutations |
| Create / patch / delete / duplicate sections | section mutations |
| Apply quote template | `applyTemplate` |
| Apply package/system | `applySystem` |
| CCTV / System Builder apply + `ensureQuoteId` | design persist / apply |
| Explicit save / Preview path that saves | save / `goCustomerView` |

### Local draft (`/app/quotes/new`)

User may browse all four stages with empty/local draft **without** creating a server Quote — until a createOnce-triggering action occurs (or header becomes contentful and autosave fires).

**Do not** create server Quotes on stage click.

---

## 16. System Builder nested-flow treatment

System Builder is already a nested guided flow:

דרישות → תכנון הנדסי → ציוד → Apply to Quote

### Risk

Wizard-inside-wizard fatigue if Quote stages + System Builder stages both feel like modal checkouts.

### Recommendation

| Layer | Presentation |
| --- | --- |
| Quote stages | Primary horizontal navigator |
| System Builder | **Drawer / focused overlay** opened from Stage 2 — not a fifth Quote stage |
| After Apply | Land in Stage 2 (or Stage 3 if commercial review is next) with ordinary lines |

### Visual relation

- System Builder progress is **local to the drawer**  
- Quote stage navigator stays visible but inactive/dimmed while drawer open  
- Do not map CCTV internal steps onto Quote stage tabs  

Preserve R1–R3 / Apply semantics untouched.

---

## 17. Template placement

| Kind | Placement |
| --- | --- |
| **Quote-level template** (apply proposal template to scope) | **Stage 1** primary; also reachable from Stage 2 quick-add (existing) as secondary |
| **Package / system template** (“תבנית / חבילה”) | **Stage 2** composition |
| Save as template / save as package | Overflow / Stage 2–3 manager actions — not Stage 1 primary |

Do not conflate the two template concepts in UI copy.

---

## 18. Catalog placement

| Mode | Stage |
| --- | --- |
| Browse/search/add catalog products | Stage 2 primary |
| After lines exist, add more catalog | Stage 2 (and allowed from Stage 3 via add) |
| Catalog as empty-state secondary | Stage 2 only |

APIs unchanged.

---

## 19. Services / labor placement

| Item | Stage |
| --- | --- |
| Add service/labor via quick-add | Stage 2 |
| Edit labor commercial rates | Stage 3 emphasis |
| Notes | Stage 2 (content) / Stage 3 (customer-facing polish) |

---

## 20. Sections / notes placement

| Concern | Stage |
| --- | --- |
| Create/rename sections while building systems | Stage 2 |
| Section as proposal structure + section discounts | Stage 3 |
| Notes as engineering/context lines | Stage 2 |
| Notes as customer proposal language | Stage 3 review |

Same data; different emphasis.

---

## 21. Pricing-summary behavior by stage

| Stage | Summary presentation |
| --- | --- |
| 1 | None or tiny “טרם חושב” / ₪0 chip |
| 2 | **Compact running total** only (סה״כ) |
| 3 | **Full commercial summary** (subtotal, discount, VAT, due) |
| 4 | Final due + readiness + Send |

Desktop today always shows full rail — staged UX should demote Stages 1–2.

Mobile dock already exposes compact total — keep across stages; enrich sheet content by stage.

---

## 22. Readiness behavior

| Surface | Behavior |
| --- | --- |
| Stage navigator | Optional subtle attention marks mapped from **existing** gaps only |
| Stages 1–3 | Lightweight chips (“חסר לקוח”) — not full checklist |
| Stage 4 | **Primary readiness home** (current UnifiedReadiness content) |
| Send blocked | Jump/focus Stage 4 + relevant field (evolve today’s `focusValidation` / `focusReadinessField`) |

Do not invent validation.

### Stage ↔ gap mapping (for indicators only)

| Gap family | Stage mark |
| --- | --- |
| customer, title, valid_until, site | Stage 1 |
| items | Stage 2 (and 3 if empty commercial) |
| payment_terms / terms completeness | Stage 4 |

---

## 23. Existing Quote behavior

Opening `/app/quotes/:id` (draft, populated):

| Decision | Recommendation |
| --- | --- |
| Initial stage | **Smart default:** Stage 2 if items exist; Stage 1 if no customer; Stage 4 if `canSend` false with only terms gaps; else Stage 3 if items exist and user last priced — V1 simplest: **Stage 2 if items else Stage 1** |
| Navigation | All stages available |
| State | Full quote hydrated; no data loss on stage switch |

---

## 24. Sent / read-only Quote behavior

When `status !== draft` (`canEdit` false):

| Behavior | Recommendation |
| --- | --- |
| Stages | Browsable read-only workspaces (or collapsed to Stage 3+4 view) |
| Primary CTA | Existing lifecycle CTAs (show link / activity / revise / project) — not Send |
| Stage 4 | Becomes “סטטוס ושיתוף” presentation |
| Do not | Fake editability |

---

## 25. Revise behavior

Revise creates a new editable draft version (existing semantics).

| After revise | Open Stage **3** or **2** (items exist) — not Stage 4 Send immediately |
| --- | --- |
| Stage model | Same four stages on the new draft |

No lifecycle semantic change.

---

## 26. Refresh / deep-link strategy

### V1 recommendation: **query parameter**

Example: `/app/quotes/:id?stage=items`

| Option | Pros | Cons | V1 verdict |
| --- | --- | --- | --- |
| Local React state only | Simple | Lost on refresh; weak deep link | Insufficient alone |
| **Query `?stage=`** | Refresh-safe; testable; no new routes | Must validate enum | **Recommended** |
| Nested routes `/quotes/:id/items` | Clean URLs | Feels like four resources; more router risk | Later if needed |

### Rules

- Invalid/missing stage → smart default  
- Browser back updates stage without remounting Quote  
- `/app/quotes/new?stage=pricing` allowed without createOnce  
- **One Quote resource** always  

---

## 27. RTL / accessibility

| Requirement | Approach |
| --- | --- |
| RTL navigator | Native order; chevrons mirrored |
| Keyboard | Arrow keys / Tab across stage buttons; Enter activates |
| Screen readers | `aria-current="step"` (already on stepper); announce stage title on change |
| Focus | Move focus to stage main `h2` on change |
| Touch | Stage targets ≥ 44px; mobile “שלב X מתוך 4” tappable |
| Reduced motion | Instant stage swap if preferred |

---

## 28. Mobile dock implications

Architecture remains closed:

- One Quote dock  
- One AppShell nav  
- Existing clearance / z-index / FAB offset  
- Summary-on-demand sheet  

### Per-stage behavioral polish (allowed)

| Stage | Dock emphasis |
| --- | --- |
| 1 | Total muted; primary CTA may be “המשך” **or** keep Send disabled + overflow Add hidden/less relevant |
| 2 | Overflow **Add** most relevant; total compact |
| 3 | Total strongest; Add still in overflow |
| 4 | Send strongest; sheet opens to readiness+summary |

**Do not** add a second persistent bar for Next/Back — place those in content chrome.

---

## 29. Migration strategy from current UI

Phased evolution of **existing** stepper — not a greenfield builder.

1. **Presentation hide/show** by `activeStep` (same QuoteBuilder tree)  
2. Relabel stepper strings  
3. Relocate terms block into Stage 4 region  
4. Split Stage 2 vs 3 emphasis (CSS/layout + optional field grouping) without splitting state  
5. Query param persistence  
6. Stage-aware summary density  
7. Mobile header “שלב X מתוך 4”  
8. Soft completion indicators  

Avoid rewriting QuoteBuilder domain logic.

---

## 30. Risks

| Risk | Mitigation |
| --- | --- |
| Wizard fatigue / feeling trapped | Free jump + non-blocking Next |
| createOnce on navigation | Explicit prohibition + tests |
| Losing fields “hidden” off-stage | Single draft model; autosave unchanged |
| System Builder nested confusion | Drawer-only nested flow |
| Mobile dock regression | Architecture freeze; visual-only dock changes |
| Power users slower | Desktop jump + keyboard shortcuts retained |
| Readiness orphaned | Stage 4 home + navigator dots |
| Template confusion | Distinct copy/placement (§17) |
| Sent quotes awkward | Read-only stage browsing + lifecycle CTAs |

---

## 31. PO decisions

1. Confirm **four** stages and Hebrew names in §4.  
2. Header-level discounts: Stage 1 progressive vs Stage 3 only?  
3. Stage 2 vs 3: soft emphasis only, or actually hide price inputs in Stage 2?  
4. Initial stage heuristic for existing quotes (§23).  
5. Dock Stage 1 primary: keep Send-disabled vs temporary `המשך`?  
6. Query param key name (`stage` vs `step`).  
7. Whether Quote-level template remains on Stage 1 when Stage 2 quick-add already offers it.  

---

## 32. Minimum safe implementation phases

| Phase | Scope | Risk |
| --- | --- | --- |
| **P0** | Stage show/hide in QuoteBuilder + relabeled stepper; free jump; no URL yet | Low |
| **P1** | Move terms into Stage 4 region; Stage 4 owns readiness; compact total Stages 1–2 | Low–med |
| **P2** | `?stage=` persistence + focus management + a11y | Med |
| **P3** | Mobile stage header + dock emphasis matrix | Med (dock visual only) |
| **P4** | Stage 2/3 commercial emphasis split; completion dots from real gaps | Med |
| **P5** | Polish Next/Back; analytics | Low |

Each phase: Quote Builder + mobile action + readiness tests; no pricing/R1–R3/lifecycle changes.

---

## 33. Protected systems

| System | Constraint |
| --- | --- |
| Pricing / VAT / discounts authority | Server-owned; UI display only |
| Autosave / createOnce | Semantics preserved; stage ≠ create |
| Lifecycle Preview / Share / Send | Unchanged meanings |
| PDF / snapshot / public approval | Untouched |
| CCTV / Durable System Design R1–R3 / Apply | Untouched; nested drawer only |
| RLS / authz | Untouched |
| Mobile dock architecture | Frozen |
| Equipment Intent / catalog-independent R3 | Out of scope |
| DB production verification | Deferred; not part of this discovery |

---

## Explicit answers (required questions)

1. **Four stages correct?** Yes — matches existing model and commercial narrative.  
2. **Hebrew names?** פרטי ההצעה · תכנון וציוד · הצעה ומחיר · תנאים ושליחה  
3. **Mapping?** §§5–8 + inventory §3  
4. **Global?** Number, status/version, save, compact customer, compact total, navigator, overflow  
5. **Any order?** Yes  
6. **Blocks forward?** Nothing hard for stage entry; Send blocked only by existing critical gaps  
7. **Stage → createOnce?** No  
8. **Quote template?** Stage 1 (primary); Stage 2 quick-add secondary  
9. **Package template?** Stage 2  
10. **System Builder nesting?** Drawer inside Stage 2; local progress; return to Quote lines  
11. **Full pricing summary?** Stage 3 (and Stage 4 final)  
12. **Readiness?** Stage 4 primary; light navigator marks earlier  
13. **Preview?** Strongest Stage 4; available muted globally  
14. **Send?** Strongest Stage 4; dock may show disabled Send earlier  
15. **Mobile dock?** Same architecture; emphasis/total/Add relevance per stage  
16. **Existing populated open?** Prefer Stage 2 if items else Stage 1 (V1)  
17. **Sent/read-only?** Browse stages read-only; lifecycle CTAs replace Send  
18. **Stage storage?** Query `?stage=` V1  
19. **Safest sequence?** §32 P0→P5  
20. **Regressions?** createOnce leaks, dock occlusion, lost fields, wizard lock-in, template confusion, readiness orphaning  

---

## Final recommendation

### **HYBRID → evolve into a guided multi-stage workspace**

**Not** “keep pure single-page forever.”  
**Not** “build four separate Quote systems.”

**Do this:**

Keep **one QuoteBuilder / one Quote / one state**, and transform the **existing four-step stepper** from scroll bookmarks into **focused stage workspaces** with free navigation, preserved autosave/createOnce, Stage-4 outbound strength, and Stage-2 System Builder nesting via drawer.

**Why:**

- Cognitive load is real after visual polish  
- Infrastructure already hints at four stages (`QuoteWorkspaceStep`)  
- Unified composition + R1–R3 + pricing contracts stay intact  
- Lowest-risk path to “WHERE AM I / WHAT NEXT” without wizard prison  

---

*End of discovery. ZERO product code changed.*
