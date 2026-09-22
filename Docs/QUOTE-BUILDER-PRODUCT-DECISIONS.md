# Quote Builder — Product Decision Pass

**Date:** 2026-09-22  
**Type:** Classification / product decision surface only  
**Source of facts:** [`Docs/QUOTE-BUILDER-CAPABILITY-AUDIT.md`](./QUOTE-BUILDER-CAPABILITY-AUDIT.md)  
**Scope:** **Zero implementation.** No product code, API, pricing, CPQ, permissions, lifecycle, PDF, CCTV, or test changes.

This document decides **what kind of work** each finding is — not when to build it, and not how.

Classification vocabulary (exactly one per row):

| Class | Meaning |
|---|---|
| **KEEP** | Behavior is coherent; leave as product truth unless explicitly changed later |
| **UX EXPOSURE** | Capability already exists sufficiently; clearer UI/copy/discoverability needed |
| **PRODUCT DECISION REQUIRED** | Technical or partial capability exists; exposing/changing it needs an intentional product call |
| **NEW CAPABILITY** | Meaningful new domain logic, workflow, or calculations |
| **TECHNICAL HARDENING** | Integrity, concurrency, security, reliability — not primarily a feature |

---

## 1. Executive product summary

SITE SECURE Quote Builder today is already a **real operational CPQ workspace**, not a mock form:

- Local → server draft persistence  
- Customer / site context  
- Catalog + free lines + templates/packages  
- **CCTV System Builder** (sizing → recommend → quote lines)  
- Server-authoritative money  
- Customer send → public approve/reject  
- PDF / snapshot / revise / project-from-quote  

The largest product risks are not “missing CRM fields.” They are:

1. **Terminology that misstates authority** (especially **שליחה לאישור** vs customer send).  
2. **UI that suggests System Builder breadth** (alarm/access/…) while only CCTV is real.  
3. **Backend capabilities with weak Builder exposure** (section discounts, note lines, VAT edit, clear customer).  
4. **Hardening** around send idempotency and snapshot dual-path semantics.  
5. **Protecting money/authz/CCTV parity** from casual UI work.

SITE SECURE is a Hebrew-first security operations platform. Quote Builder should eventually be a flagship surface — but next steps must respect what is already implemented vs what would invent new domain engines.

---

## 2. Current Quote Builder product boundary

### In boundary (shipped product truth)

| Area | Boundary |
|---|---|
| Entry | `/app/quotes/new` local draft; persist via `createOnce` |
| Composition | Details, customer, optional site, lines, sections, packages/templates |
| Differentiator | CCTV System Builder → catalog lines |
| Money | Inputs client; totals FastAPI `pricing.recalculate` |
| Commercial | Discounts; cost/margin if `quotes.view_cost`; override if `quotes.override_price` |
| Lifecycle | draft → send → viewed → approved/rejected/expired; revise → draft |
| Documents | Staff preview/PDF; public token PDF from snapshot |
| Post-quote | Project-from-quote when site present |

### Outside boundary (not real product yet)

| Area | Reality |
|---|---|
| Alarm / access / intercom / network / LV / combined System Builders | UI/type stubs only |
| Staff internal approve workflow | Catalog grant; **no staff approve API** |
| Site-driven pricing or CCTV math | Not implemented |
| Browser-dictated totals | Rejected by design |
| Forced multi-step wizard | Stepper scrolls only |

---

## 3. Product decision matrix

### CUSTOMER

| Capability | User-visible | Actual implementation | Class | Evidence | Limitation | Business impact | Pricing risk | Permission risk | Impl risk | Open decision |
|---|---|---|---|---|---|---|---|---|---|---|
| Search existing | Search → pick | `CustomerSelector` → `listCustomers` | **KEEP** | `CustomerSelector.tsx`, QuoteBuilder | Min query length | Core | None | `crm.view` | Low | — |
| Create customer | Inline create | `createCustomer` (`display_name` req.) | **KEEP** | QuoteBuilder create panel | Phone/email optional | Core | None | `crm.create` | Low | — |
| Select / associate | Sets customer on quote | Patch / create header `customer_id` | **KEEP** | `quote-builder.ts` header | Required to send | Core | None | quotes.edit | Low | — |
| Switch customer | Change + site clear confirm | `siteMismatchPending` | **KEEP** | QuoteBuilder | Clears site | Operational | None | Low | Low | — |
| Clear customer in UI | Not available | API can clear; **no remove UI** | **PRODUCT DECISION REQUIRED** | Audit §6; quotes patch clearable | Once set, only change | Workflow purity vs send rules | None | Low | Low–Med | Allow clear to “unassigned”? |
| Edit customer in builder | Link out | Full edit via CRM elsewhere | **PRODUCT DECISION REQUIRED** | Audit §6 | No inline CRM edit | Speed vs context switch | None | `crm.edit` | Med | Inline edit vs profile-only? |
| Duplicate handling | None on create | No create-time dedupe found | **PRODUCT DECISION REQUIRED** | Audit §6 | Possible duplicate customers | Data quality | None | Low | Med | Need dedupe policy? |
| Quote without customer | Draft OK; send blocked | Critical gap `customer` | **KEEP** | `quote_rules.required_field_rule` | Soft draft → hard send | Matches send gate | None | Low | Low | — |

### SITE

| Capability | User-visible | Actual | Class | Evidence | Limitation | Business | Pricing | Security | Impl | Decision |
|---|---|---|---|---|---|---|---|---|---|---|
| Select site | Select after customer | `listSites({ customer_id })` | **KEEP** | QuoteBuilder | Needs customer | Ops | None | sites.* | Low | — |
| Create site | Inline create | `sites.create` | **KEEP** | QuoteBuilder | Gated | Ops | None | sites.create | Low | — |
| Optional for send | Soft readiness warning | Not in critical send rules | **PRODUCT DECISION REQUIRED** | `quote_rules`, readiness | Can send without site | Quote vs install reality | None | Low | Med | Make site send-critical? |
| Required for project-from-quote | Blocked without site | `project_from_quote.py` | **KEEP** (as current rule) | Audit §7 | Friction post-approve | Field ops handoff | None | Low | Low | Keep vs earlier site gate |
| Site → pricing | No effect | Pricing ignores site | **NEW CAPABILITY** if desired | `pricing.py` | Site is contextual only | Future site-based pricing | **High** if added | Med | High | Should site affect price? |
| Site → CCTV sizing | No effect | Recommend ignores site | **NEW CAPABILITY** if desired | CCTV recommend payload | Missed site context | Future site-aware design | Med | Med | High | Should site feed System Builder? |

### QUOTE DETAILS

| Capability | User-visible | Actual | Class | Evidence | Limitation | Business | Pricing | Security | Impl | Decision |
|---|---|---|---|---|---|---|---|---|---|---|
| Title / validity / terms / notes | Editable fields | Header draft → patch | **KEEP** | `quote-builder.ts` | Title/validity/payment_terms send-critical | Core | Low | Low | Low | — |
| Quote-level discount | Amount or % | `discount_type`/`value` | **KEEP** | Header advanced fields | Mutual exclusive UI | Commercial | Med | via edit | Med | — |
| VAT display | Shown in summary/doc | From quote `vat_percent` | **KEEP** | Summary / pricing | Workspace default 18 | Tax display | Low | Low | Low | — |
| VAT edit in builder | Not exposed | API `QuotePatch.vat_percent`; header omits | **PRODUCT DECISION REQUIRED** | Audit §14 | Only settings/API | Per-quote tax exceptions | **High** | Med | Med | Editable in Builder? |

### LINES

| Capability | User-visible | Actual | Class | Evidence | Limitation | Business | Pricing | Security | Impl | Decision |
|---|---|---|---|---|---|---|---|---|---|---|
| Catalog lines | Search / pick / apply | Server fills price/cost + snapshot | **KEEP** | catalog + quotes `_insert_line` | — | Core | Low | catalog+quotes | Med | — |
| Free lines | Add free / empty | `item_type: free` | **KEEP** | QuoteLinesPanel / QuickAdd | Manual price | Flexibility | Med | edit | Low | — |
| Labor/service | Via service catalog kind | Maps to `labor` | **UX EXPOSURE** / **PRODUCT DECISION REQUIRED** | `catalog.py` KIND_TO_ITEM | No first-class Labor CTA | Install labor clarity | Med | Low | Med | First-class labor concept? |
| Note lines | Weak / no primary CTA | Enum + document render | **PRODUCT DECISION REQUIRED** | Audit §11, §31 | Backend yes, UI weak | Doc annotations | Low | Low | Med | First-class note action? |
| Line % discount | Line editor | UI forces percent | **KEEP** | `LINE_ITEM_DISCOUNT_TYPE` | Amount type less exposed | Commercial | Med | via edit | Med | Expose amount type? |
| Price override | Edit unit price | Needs `override_price` vs list | **KEEP** | quotes.py override checks | Sales may lack grant | Commercial control | **High** | **High** | High | — |
| Edit / reorder / delete | Line UI | Item APIs | **KEEP** | QuoteLinesPanel | Draft only | Core | Med | edit | Med | — |

### SECTIONS

| Capability | User-visible | Actual | Class | Evidence | Limitation | Business | Pricing | Security | Impl | Decision |
|---|---|---|---|---|---|---|---|---|---|---|
| Sections | Create/rename/collapse/duplicate/delete | `quote_cpq` sections | **KEEP** | QuoteLinesPanel | — | Structure | Low | edit | Med | — |
| Section discounts | **Not in Builder UI** | API/DB/pricing apply | **PRODUCT DECISION REQUIRED** (+ UX EXPOSURE once decided) | SectionIn; no editor | Hidden value | Bundle discount UX | **High** | via edit | Med | Expose section discounts? |

### PACKAGES / TEMPLATES

| Capability | User-visible | Actual | Class | Evidence | Limitation | Business | Pricing | Security | Impl | Decision |
|---|---|---|---|---|---|---|---|---|---|---|
| Packages / templates | Apply / fast path | `applyQuotePackage` / `applyQuoteTemplate` | **KEEP** | SystemPicker / Template* | Catalog quality dependent | Speed | Med | quotes+catalog | Med | — |

### SYSTEM BUILDER — CCTV

| Capability | User-visible | Actual | Class | Evidence | Limitation | Business | Pricing | Security | Impl | Decision |
|---|---|---|---|---|---|---|---|---|---|---|
| CCTV inputs → sizing | Form | Python `cctv_sizing` authoritative | **KEEP** | `cctv_sizing/`, drawer | TS is parity copy | Differentiator | Low (lines priced later) | catalog.view + quotes | High | — |
| Recommendation | Review roles/candidates | `cctv_recommend` + catalog | **KEEP** | `cctv_recommend/` | Catalog completeness | Differentiator | Med | High | High | — |
| Alternate selection | Swap / remove optional | Projection + review state | **KEEP** | `cctv-recommend-projection.ts` | Partial apply allowed | Control | Med | Med | Med | — |
| Apply to quote | Creates section + lines | `applyCctvBuildLines` | **KEEP** | QuoteBuilder | Fingerprint blocks identical re-apply | Core path | Med | Med | High | — |

### SYSTEM BUILDER — NON-CCTV

| Type | Domain input? | Server calc? | Recommend? | Catalog resolve? | Quote lines? | Class |
|---|---|---|---|---|---|---|
| Alarm | UI option only | No | No | No | No | **NEW CAPABILITY** (today stub) |
| Access control | UI option only | No | No | No | No | **NEW CAPABILITY** (today stub) |
| Intercom | UI option only | No | No | No | No | **NEW CAPABILITY** (today stub) |
| Network | UI option only | No | No | No | No | **NEW CAPABILITY** (today stub) |
| Low voltage | UI option only | No | No | No | No | **NEW CAPABILITY** (today stub) |
| Combined | UI option only | No | No | No | No | **NEW CAPABILITY** (today stub) |

Showing stubs in the type selector is itself a **PRODUCT DECISION REQUIRED** (hide until real vs leave as “soon”).

### PRICING / COMMERCIAL

| Capability | User-visible | Actual | Class | Evidence | Limitation | Business | Pricing | Security | Impl | Decision |
|---|---|---|---|---|---|---|---|---|---|---|
| Server totals | Display `live.total_*` | `pricing.recalculate` | **KEEP** | `pricing.py` | Client preview ≠ authority | Trust | **Critical keep** | High | Critical | — |
| Subtotal / VAT / gross | Summary | Server stored | **KEEP** | QuoteSummaryAside | — | Core | Critical | Low | Critical | — |
| Client preview net | While typing | `previewLineNet` display only | **KEEP** | `quote-line-edit.ts` | Must not become authority | UX | Low if contained | Low | Med | — |
| Cost / margin | Conditional UI | Computed + stripped | **KEEP** | `_strip_cost`, view_cost | Sales cannot see | Commercial | High | **Critical** | High | — |
| view_cost protection | Hidden tab | Server strip + write gates | **KEEP** | quotes/catalog routers | — | Security | High | Critical | High | — |
| override_price | Gated edits | Server enforce | **KEEP** | quotes.py | Role-dependent | Control | High | Critical | High | — |
| Technician commercial block | No quote ops | No grants + deny set | **KEEP** | `TECHNICIAN_COMMERCIAL_DENY` | — | Isolation | High | Critical | High | — |

### SEND / APPROVAL / REVISE

| Capability | User-visible | Actual | Class | Evidence | Limitation | Business | Pricing | Security | Impl | Decision |
|---|---|---|---|---|---|---|---|---|---|---|
| שליחה לאישור | Primary CTA | Staff **send** → `sent` + token | **UX EXPOSURE** (terminology) | `cpqSendForApproval` → `send_quote` | Sounds internal | Trust/clarity | Low | send | Low (copy) | Rename semantics? |
| Customer approve/reject | Public portal | `approvePublicQuote` / reject | **KEEP** | `public_quotes.py` | Token/version | Contract | Low | Token | High | — |
| Staff internal approve | Absent | Catalog `quotes.approve` unused as staff gate | **PRODUCT DECISION REQUIRED** | Audit §18, §23 | Grant≠workflow | Governance | Low | High | High | Build staff approve? |
| Revise | CTA after decision | New draft version | **KEEP** | `revise_quote` | Old tokens superseded | Continuity | Med | create | Med | — |
| Share without full send lock | Share flows | Share can mint without same lock as send | **PRODUCT DECISION REQUIRED** | Audit §18 | Policy nuance | Leak/process | Low | Med | Med | Clarify share vs send? |

### PDF / SNAPSHOT / PAYMENT

| Capability | User-visible | Actual | Class | Evidence | Limitation | Business | Pricing | Security | Impl | Decision |
|---|---|---|---|---|---|---|---|---|---|---|
| Staff preview | `/preview` + live pane | Document / live overlay | **KEEP** | preview route | Empty local disabled | Sales | Low | view | Med | — |
| Staff PDF | Download | Live lines + frozen company/template after send | **PRODUCT DECISION REQUIRED** | Audit §20–21 | Dual semantics | Legal/doc trust | Med | High | High | Always full snapshot? |
| Public PDF | Customer download | Snapshot public | **KEEP** | public PDF | — | Customer truth | Low | High | High | — |
| Snapshot on send | Invisible | `quote_versions` | **KEEP** | quote_snapshot | INSERT path reliable | Immutability | Med | High | High | — |
| Payment details on docs | Settings toggle | `showBankOnDocuments` | **KEEP** | company settings | Separate from `payment_terms` | Payments | Low | Med | Low | — |
| `quotes.export` vs PDF auth | Invisible mismatch | PDF uses `quotes.view` | **TECHNICAL HARDENING** / **PRODUCT DECISION REQUIRED** | catalog vs quote_cpq | Catalog noise | Entitlement clarity | Low | Med | Low | Align grant to PDF? |

### SAVE / PERSISTENCE

| Capability | User-visible | Actual | Class | Evidence | Limitation | Business | Pricing | Security | Impl | Decision |
|---|---|---|---|---|---|---|---|---|---|---|
| Local unsaved | Immediate open | `unsavedQuote` id="" | **KEEP** | quote-builder.ts | Close loses work | Speed | None | Low | Low | — |
| createOnce | Silent | Create gate | **KEEP** | QuoteBuilder | — | Integrity | Low | Low | Med | — |
| Autosave | Indicator | ~900ms debounce | **KEEP** | QuoteBuilder | Empty local skipped | Continuity | Low | Low | Med | — |
| טרם נשמרה | Save pill | `!hasLiveId` only | **UX EXPOSURE** | QuoteSaveIndicator, `he.quoteUnsaved` | Easy to read as “dirty” | Confusion | None | Low | Low | Clearer copy? |

### MOBILE / RESPONSIVE

| Capability | User-visible | Actual | Class | Evidence | Limitation | Business | Pricing | Security | Impl | Decision |
|---|---|---|---|---|---|---|---|---|---|---|
| Mobile dock + AppShell nav | One dock + nav | Clearance model | **KEEP** | Recent mobile UX | Dense bottom | Usability | None | Low | Med | — |
| Summary sheet | Total opens sheet | Docked closed = zero | **KEEP** | QuoteMobileSheet | — | Mobile hierarchy | None | Low | Low | — |
| Stepper | Scroll chrome | Not a wizard | **KEEP** | QuoteStepper | May feel like steps | Guidance | None | Low | Low | — |
| Further mobile polish | — | Presentation | **UX EXPOSURE** | Audit §29 | Not product logic | Adoption | None | Low | Low–Med | Scope of polish |

### PERMISSIONS / RELIABILITY

| Capability | User-visible | Actual | Class | Evidence | Limitation | Business | Pricing | Security | Impl | Decision |
|---|---|---|---|---|---|---|---|---|---|---|
| quotes.create/edit/send/view_cost/override | Role-dependent UI | Server authorize | **KEEP** | catalog.json, engine | — | RBAC | High | Critical | High | — |
| quotes.approve catalog-only | Invisible | No staff API | **PRODUCT DECISION REQUIRED** | Audit §23 | Dead grant | Role design | Low | Med | Med | Keep grant / use / remove? |
| Send idempotency | Double-click risk | UI pending only; no status-conditional send | **TECHNICAL HARDENING** | Audit §28 | Possible multi-token | Reliability | Low | Med | Med | Priority for hardening? |
| Public approve concurrency | Works | status+version filters | **KEEP** | public_quotes | — | Integrity | Low | High | Med | — |
| CCTV apply lock | Prevents double apply | Found | **KEEP** | QuoteBuilder | — | Integrity | Low | Low | Med | — |

---

## 4. Customer / site capability analysis

**Customer** is a **core, shipped** association: search, create, select, change are real. Gaps are intentional product choices, not missing CRUD:

- Clear-to-unassigned is API-capable but UI-hidden → decision, not invention.  
- Full CRM edit belongs either in builder (new UX surface) or stays profile-only (KEEP pattern).  
- Dedupe is a policy product, not a one-line expose.

**Site** is **operational context**, not a pricing driver today:

- Optional at send is coherent if Quote Builder is “commercial proposal first.”  
- Required at project-from-quote is coherent if Site File is “install reality.”  
- Making site drive CCTV/pricing would be **new domain capability**, not exposure.

---

## 5. Quote composition capability analysis

Shipped composition stack:

customer/details → catalog/free lines → sections → packages/templates → CCTV apply → discounts → server totals → preview/send.

Partial / decision-bound composition:

| Item | Why not KEEP-as-exposure only |
|---|---|
| Section discounts | Backend real; exposing changes commercial UX & training |
| Note lines | Type exists; first-class CTA changes document model perception |
| Labor CTA | Exists as catalog kind; elevating it changes mental model |
| VAT in builder | Changes tax control locus (workspace vs quote) |

---

## 6. Pricing / commercial controls

**Keep as non-negotiable product architecture:**

- FastAPI pricing owns totals  
- Client preview is display-only  
- `view_cost` / `override_price` / technician deny are security features, not chrome  

Any future UI that “helps” users by computing gross totals locally must remain **display** and never become the write path.

---

## 7. System Builder — Current Product Boundary

### CCTV (production)

```
User inputs (cameras, MP, retention, mode, PoE, architecture, cable, flags, …)
  → Client validates requirements body
  → POST …/cctv/recommend
  → Python cctv_sizing (engineering)
  → Python cctv_recommend (catalog resolve + packing)
  → Review (swap candidates, remove optional)
  → apply → quote section + catalog lines (prices from quote/catalog APIs)
```

| Step | Exists? |
|---|---|
| Domain input | Yes |
| Server calculation | Yes (Python) |
| Recommendation | Yes |
| Catalog resolution | Yes |
| Quote lines | Yes |

### Non-CCTV types

| Type | Domain input | Server calc | Recommend | Catalog resolve | Quote lines | Reality |
|---|---|---|---|---|---|---|
| Alarm | Selector only | No | No | No | No | Stub |
| Access control | Selector only | No | No | No | No | Stub |
| Intercom | Selector only | No | No | No | No | Stub |
| Network | Selector only | No | No | No | No | Stub |
| Low voltage | Selector only | No | No | No | No | Stub |
| Combined | Selector only | No | No | No | No | Stub |

Evidence: `SystemBuilderDrawer.tsx` (type options + CCTV-gated calculate), `SystemBuilderType` in `system-builder.ts`, API only under `cctv` routers.

**Do not describe non-CCTV as implemented System Builders.**

---

## 8. Send / approval / revision lifecycle

| Actor | Action | Result |
|---|---|---|
| Staff | שליחה לאישור / `sendQuote` | draft → `sent`, snapshot, public token |
| Customer | Approve / reject on public link | `approved` / `rejected` |
| Staff | Revise | New `draft` version; prior tokens superseded by version |

**There is no internal SITE SECURE staff approval workflow in the API.**  
`quotes.approve` in the authz catalog does not equal a staff approve product.

Classification:

- Current customer-approval loop → **KEEP**  
- Label accuracy → **UX EXPOSURE**  
- Whether to add staff approval → **PRODUCT DECISION REQUIRED** / else **NEW CAPABILITY**

---

## 9. PDF / snapshot / document behavior

| Consumer | Truth source |
|---|---|
| Public view/PDF | Version snapshot |
| Staff PDF after send | Live lines/totals + frozen company/template |
| Line catalog fields | `catalog_snapshot` at insert |

This dual path is **product-meaningful**, not merely a bug report: customer sees frozen commercial proposal; staff PDF may still reflect live lines while company branding stays frozen.

Classification: clarify desired policy → **PRODUCT DECISION REQUIRED**; implementing alignment → likely **TECHNICAL HARDENING** + careful product rules.

Payment bank block: settings-driven (`showBankOnDocuments`) — **KEEP**.  
Quote `payment_terms`: commercial terms text, send-critical — **KEEP** (different concept).

---

## 10. Post-quote workflow

| Step | Behavior | Class |
|---|---|---|
| Approved → project | `project-from-quote` | **KEEP** |
| Site required | Hard requirement | **KEEP** as current rule; changing earlier is **PRODUCT DECISION REQUIRED** |
| Carry-forward | Quote/customer/site linkage; not a full Site File merge engine | **KEEP**; richer carry-forward = **NEW CAPABILITY** |

---

## 11. Mobile / responsive behavior

Current architecture after recent work is a coherent **KEEP**:

- Scrollable header on mobile  
- One Quote dock + AppShell nav  
- Summary progressive disclosure  
- Desktop sticky header + summary rail  

Further density/polish is **UX EXPOSURE**, not new CPQ.

---

## 12. Exposed vs hidden product value

| Capability | Issue type |
|---|---|
| Section discounts | **Missing UI** (backend ready) → PRODUCT DECISION then UX EXPOSURE |
| Note lines | **Missing UI** / partial → PRODUCT DECISION |
| Labor | **Discoverability** / mental model (service catalog) → UX EXPOSURE or PRODUCT DECISION |
| VAT edit | **Missing UI** in builder (API/settings exist) → PRODUCT DECISION |
| Cost/margin | **Discoverability** for permitted roles; correctly hidden for others → KEEP security; UX only for entitled roles |
| Project-from-quote needing site | **Discoverability** / sequencing friction → PRODUCT DECISION (when to require site) |
| CCTV recommendation depth | **Discoverability**; engine exists → UX EXPOSURE (careful; do not change math) |
| Site relationship | **Partial product meaning** (context only) → PRODUCT DECISION if site should become design/price input |
| Revision/version | **Discoverability** of superseded tokens → UX EXPOSURE |
| Non-CCTV system options | **UI suggesting functionality that does not exist** → PRODUCT DECISION (hide) or NEW CAPABILITY (build) |

---

## 13. Terminology findings

### שליחה לאישור

| | |
|---|---|
| **UI string** | `he.cpqSendForApproval` = `"שליחה לאישור"` |
| **Actual behavior** | Staff sends quote to **customer** approval portal (`POST …/send` → public token). Not internal staff approval. |
| **Risk** | Users may think another SITE SECURE role must approve before the customer sees it. |
| **Factual alternatives (docs only)** | `שליחה ללקוח`, `שליחה לאישור הלקוח` |
| **This pass** | Document only — **no label change**. |
| **Class** | **UX EXPOSURE** |

### טרם נשמרה

| | |
|---|---|
| **UI string** | `he.quoteUnsaved` |
| **Technical meaning** | Quote has **no server `id`** yet (`!hasLiveId`), i.e. never persisted — not merely dirty. |
| **Distinct from** | “שינויים שלא נשמרו” (has id + dirty header) |
| **Misread risk** | User may think “I typed something but forgot to save” when the truth is “no draft exists on the server yet.” Hint text partially clarifies. |
| **Class** | **UX EXPOSURE** |

---

## 14. Friction map

| Friction | Class |
|---|---|
| Send label vs customer approval | UX EXPOSURE |
| Site optional then required for project | PRODUCT DECISION REQUIRED |
| System Builder shows dead system types | PRODUCT DECISION REQUIRED / NEW CAPABILITY |
| Section discounts invisible | PRODUCT DECISION REQUIRED |
| טרם נשמרה ambiguity | UX EXPOSURE |
| QuoteBuilder concentration of mutations | TECHNICAL HARDENING (structural), not a feature |
| Staff PDF dual freeze semantics | PRODUCT DECISION REQUIRED |
| Share vs send policy nuance | PRODUCT DECISION REQUIRED |

---

## 15. Gap classification (A–F discipline)

| Gap | Bucket |
|---|---|
| Section discounts UI | A / C — existing capability, weak UX; backend not exposed well |
| Note line CTA | A / C |
| VAT in builder | C / PRODUCT DECISION |
| Labor first-class UX | A or E depending on desired model |
| Clear customer UI | C |
| Non-CCTV System Builders | D (UI present) + F/NEW for real engines |
| Staff approve workflow | F (not found as staff API) — building it = NEW CAPABILITY |
| Site→CCTV/pricing | F / NEW |
| Send idempotency | B / TECHNICAL HARDENING |
| quotes.export mismatch | TECHNICAL HARDENING / PRODUCT DECISION |
| Misleading send label | A (terminology) — not a missing capability |

---

## 16. Source-of-truth map

| Domain | Authority |
|---|---|
| Quote lifecycle states | **FASTAPI** (`quotes.py`, `public_quotes.py`) + **AUTHZ** state sets |
| Persistence / createOnce | **CLIENT INPUT** trigger → **FASTAPI** create/patch |
| Line unit price / qty / discounts | **CLIENT INPUT** → stored; nets **FASTAPI** `pricing.py` |
| Quote/section discounts | **CLIENT INPUT** (when exposed) → **FASTAPI** pricing |
| VAT amount / totals | **FASTAPI** pricing; rate stored on quote / workspace default |
| Cost / margin | **FASTAPI** calculate + store; response **AUTHZ** strip |
| Permissions | **AUTHZ** (`authorize`, catalog); UI `can()` = display only |
| CCTV sizing | **PYTHON DOMAIN LOGIC** (`cctv_sizing`); TS = parity |
| Catalog resolution (CCTV) | **PYTHON** `cctv_recommend` + **DATABASE** products |
| Send | **FASTAPI** `send_quote` |
| Public approval | **FASTAPI** public_quotes + **SNAPSHOT** |
| Revisions | **FASTAPI** revise |
| Public PDF/doc | **SNAPSHOT** |
| Staff PDF after send | **FASTAPI** document payload (live lines + frozen company/template) |
| Project-from-quote | **FASTAPI** ops/project_from_quote |

---

## 17. Protected technical areas

Future visual/product tasks must **not casually modify**:

| Area | Why protected |
|---|---|
| `QuoteBuilder.tsx` mutations / createOnce / apply / send | CRITICAL hub; easy to break persistence & money flows |
| Quote/CPQ API contracts | Clients, PDF, public portal depend on stable shapes |
| `pricing.py` / `_persist_totals` | Financial source of truth |
| Send / lifecycle / public approve | Contractual state machine |
| CCTV TS↔Python parity + recommend | Differentiator; silent drift = wrong equipment |
| `authorize()` / RLS / workspace filters | Multi-tenant isolation |
| `view_cost` / `override_price` / technician deny | Commercial security (UI hide ≠ enough) |
| PDF + snapshot/version | Legal/customer document integrity |

Presentation-only restyles (header chrome, spacing, dock layout **without** changing handlers) are safer when they do not touch the above.

---

## 18. Decisions required from Product Owner

Implementation evidence cannot answer these; they need PO calls:

1. Should **שליחה לאישור** be renamed to make **customer** the explicit audience (e.g. שליחה ללקוח / שליחה לאישור הלקוח), or keep current wording?  
2. Should **site** become **required before send**, or remain optional until project-from-quote?  
3. Should **site** eventually influence System Builder and/or pricing, or stay commercial-context only?  
4. Should **VAT** be editable per quote in Builder, or only via workspace settings?  
5. Should **section discounts** be exposed in Builder?  
6. Should **note lines** become a first-class user action?  
7. Should **labor** become a first-class quote concept (not only service catalog kind)?  
8. Should users be able to **clear** customer back to unassigned in UI?  
9. Should customer **dedupe** exist on create-from-quote?  
10. Should approval remain **customer-only**, or should SITE SECURE add an **internal staff approve** workflow (`quotes.approve`)?  
11. Should non-CCTV System Builder options be **hidden** until real engines exist?  
12. Which non-CCTV engines (alarm / access / intercom / network / LV / combined), if any, are actually desired as real System Builders?  
13. Staff PDF after send: keep **live lines + frozen company**, or always render from **full snapshot**?  
14. Clarify product policy for **share** vs **send** (link without lock vs locked send).  
15. Is **send idempotency** a near-term hardening requirement?  
16. Align or retire unused catalog grants (`quotes.approve` staff gate, `quotes.export` vs PDF via `quotes.view`)?  
17. Should **טרם נשמרה** copy be clarified for “never persisted on server”?

---

## 19. Surprising implementation findings

1. **שליחה לאישור** is customer send, not internal approval.  
2. **טרם נשמרה** means never got a server id — empty local drafts intentionally do not create rows.  
3. **CCTV is the only real System Builder**; other types are stubs that still appear in UI.  
4. **Section discounts** and **note** types are backend-real but Builder-weak.  
5. **Site does not feed** pricing or CCTV math.  
6. **Staff PDF ≠ public PDF** truth model after send.  
7. **`quotes.approve` / `quotes.export`** exist in authz catalog without matching product gates as users might assume.  
8. Money is **server-authoritative**; browser cannot dictate stored totals on the FastAPI path.  
9. Sales can discount without `view_cost` — intentional commercial split.  
10. Technicians are commercially isolated from quotes.

---

## 20. Contradictions vs prior audit / current code

Verification against current code for this decision pass:

| Claim | Status |
|---|---|
| Send label → `send_quote` / customer portal | **Confirmed** (`he.cpqSendForApproval`, `send_quote`) |
| Non-CCTV options in System Builder drawer | **Confirmed** (`SystemBuilderDrawer` options; calculate CCTV-gated per audit) |
| No staff `quotes.approve` API gate on send path | **Confirmed** (approve flows in `public_quotes`; staff send is `send_quote`) |
| טרם נשמרה = `!hasLiveId` | **Confirmed** (audit + `he.quoteUnsaved`) |

**No material contradiction** found between [`QUOTE-BUILDER-CAPABILITY-AUDIT.md`](./QUOTE-BUILDER-CAPABILITY-AUDIT.md) and spot-checks of current code for the decision-critical claims above.

Minor nuance (not a contradiction): audit already notes share-vs-send and staff-PDF dual freeze as asymmetries — this decision pass treats them as **PRODUCT DECISION REQUIRED** / hardening, not audit errors.

---

## 21. Explicit confirmation — no product code changed

This task produced **only**:

`Docs/QUOTE-BUILDER-PRODUCT-DECISIONS.md`

No modifications to:

- QuoteBuilder / CPQ UI  
- pricing / APIs / CCTV  
- permissions / RLS  
- PDF / lifecycle  
- tests / migrations  

**No roadmap, phases, or P0/P1 rankings** are included — decision surface only.

---

**END — PRODUCT DECISION PASS — STOP**
