# Task 13 — Complete Build System V1 Architecture Audit

**Status:** Audit only. No implementation. No migration. No implementation commit.  
**Scope:** Sections 1–55 (base Build System V1 + accepted Design→Twin continuity).  
**Evidence date:** 2026-09-05 · Repository inspection of SiteSecureV1.  
**Dashboard workstream:** Separate (`f695f8d` Dashboard V2.1). Not in scope here.

---

## 1. Executive assessment

**What Build System is today**

A client-only guided CCTV recommender inside Quote CPQ: `SystemBuilderDrawer` + `buildCctvRecommendation()` in `apps/web/src/lib/system-builder.ts`. It keyword-scores ≤100 catalog products, presents a review list, then inserts quote lines one HTTP POST at a time.

It is **not** a Design layer, not a sizing engine, and not a twin/project materializer.

**Prototype vs production**

**Prototype-level for trustworthy CCTV engineering.** Usable as a commercial “suggest lines from catalog text” helper. Not production-ready as an installer-trusted design tool.

**Biggest technical weaknesses**

1. Keyword matching ignores structured `attributes`, categories, manufacturer, bitrate, ports, capacity.
2. Catalog truncated at `limit=100` with no server-side role filtering.
3. No storage/PoE/channel compatibility math.
4. Cable qty = camera count (not meters); labor qty = 1 always.
5. Role/reason discarded on insert; no Design persistence seam types beyond `SystemBuilderLine`.

**Biggest product opportunity**

Become the first concrete **Design surface** of the Commercial engine: Requirements → SystemRecommendation → Quote projection, with a future path Design → Project → Installed Assets → Twin — without trapping domain logic inside Quote UI props.

**Can it evolve without major rewrite?**

**Yes**, if V1 introduces: (a) typed recommendation domain separate from Quote UI, (b) structured catalog attributes for CCTV roles, (c) deterministic sizing before catalog resolution. The drawer + review-before-insert UX can remain. The matcher must be replaced, not polished.

---

## 2. Current Build System architecture

### Relevant modules

| Area | Path |
|------|------|
| Domain | `apps/web/src/lib/system-builder.ts` |
| UI | `apps/web/src/components/quotes/cpq/SystemBuilderDrawer.tsx` |
| Host | `apps/web/src/components/quotes/QuoteBuilder.tsx` (`systemCatalogQuery`, `addSystemBuilderLines`) |
| Entries | `QuoteLinesPanel`, `LeadRequirementsCard`, `QuoteQuickAdd`, `QuoteMobileAddMenu` |
| Attrs | `apps/api/app/catalog_attrs.py` (unused by matcher) |
| Packages (adjacent) | `SystemPickerModal`, `quote_cpq.apply-package` |
| Validation (adjacent) | `apps/api/app/quote_validation.py`, `quote_rules` |

### UI / drawer flow

1. Open (gated `canEdit && canCatalog`) → reset plan; force `systemType=cctv`; seed input from lead; request catalog.
2. Edit CCTV inputs (non-CCTV types show “soon”).
3. Show recommendation → `buildCctvRecommendation(input, catalog)`.
4. Review lines; Adjust returns to form (**no per-line product replacement UI today**).
5. Confirm → sequential `addQuoteItem` for configured products only.

### Quote Builder integration

- Catalog: `listCatalogProducts(workspaceId, { limit: 100 })` after drawer open.
- Apply: one request per line; no `section_id` / `package_id`.
- Contrast: saved Systems (`quote_packages`) use server batch `apply-package`.

### Line types

`SystemBuilderLine`: `{ role, label, qty, product, configured, reason }`.  
Roles: `camera | nvr | storage | poe | cabling | installation | remote`.

---

## 3. Current CCTV inputs

| Field | UI | Type | Default | Required | Effect | Lead-prefilled | Persisted |
|-------|-----|------|---------|----------|--------|----------------|-----------|
| `cameraCount` | number input | number | 4 | informal | camera/cable qty; NVR tier | `camera_count` | No (React only) |
| `cameraType` | select | dome/bullet/mixed | mixed | no | camera keyword set | **No** | No |
| `needsRecorder` | checkbox | bool | true | no | NVR line | No (forced true) | No |
| `needsStorage` | checkbox | bool | true unless recording=false | no | HDD line | `recording` | No |
| `needsPoe` | checkbox | bool | true | no | PoE switch line | No | No |
| `needsCabling` | checkbox | bool | true if new/partial/missing infra | no | cable line | `infrastructure` | No |
| `needsInstallation` | checkbox | bool | true | no | labor line | No | No |
| `needsRemote` | checkbox | bool | false | no | remote line | `remote_viewing` | No |
| `systemType` | select | enum | cctv | no | non-cctv blocks | No | No |

**Not present:** resolution, indoor/outdoor split, retention, FPS, codec, hours/day, PoE architecture, UPS, manufacturer, cable meters, expansion headroom.

Lead `location` exists on lead requirements UI but is **not** consumed by builder.

---

## 4. Catalog technical-data readiness

### A. Structured today (schema keys exist; fill quality varies)

**Camera:** `resolution`, `lens`, `ir`, `color_at_night`, `audio`, `poe`, `ip_rating`, `ik_rating`  
**NVR:** `channels`, `hdd_bays`, `poe_ports`  
**Switch:** `ports`, `poe`, `poe_plus`, `poe_plusplus`, `poe_budget`, `gigabit`, `sfp`  
**Cable:** `length_m`, `outdoor`, `shielded`  
**Product columns:** `manufacturer`, `model`, `attributes` JSONB, `unit`

### B. Only inferable from text today (matcher reality)

Resolution MP, outdoor, form factor, channel count, TB capacity, port count, CAT grade, install vs service — **all** via name/sku/description substrings in Build System.

### C. Missing (no schema or wrong mapping)

| Domain | Gap |
|--------|-----|
| Camera | wattage, codec, FPS, ONVIF, form_factor as enum, structured MP number |
| NVR | poe_budget_w, max_hdd_tb, bandwidth, codecs |
| HDD | **no leaf schema** (`hdd_recorders` falls through to camera attrs); no `capacity_tb`, surveillance_grade |
| Switch | uplink speed as typed field (only bools/text) |
| Services | empty attribute schema |
| Bitrate | nowhere |

**Assessment:** Schema foundation exists for cameras/NVR/switches/cables but is **unused by Build System** and incomplete for engineering sizing (especially HDD + power + bitrate).

---

## 5. Current matching algorithm

- Filter: none by category — full first page catalog.
- Score: +1 per needle hit in `name+sku+description` lowercase.
- Tie-break: first higher score only (`>`), so earlier `name.asc` wins ties.
- Limit: implicit ≤100 products.
- Fallback: `configured: false`, product null.

**Conceptual wrong selections**

| Intent | Failure |
|--------|---------|
| 4MP outdoor camera | No MP/outdoor scoring; any `camera`/`מצלמ` can win |
| 16-ch NVR | `"16"` substring false-positives; DVR in same pool |
| 8TB HDD | any `tb`/`hdd` wins; capacity ignored |
| 16-port PoE switch | any `poe`/`switch` wins; ports ignored |
| CAT6 | generic `cable`/`כבל` can beat CAT6 |
| Camera install | any `service`/`labor`; qty=1 not × cameras |

---

## 6. Engine boundary

| Model | Fit |
|-------|-----|
| Client-only (today) | Fast UX; weak testability of tenant rules; catalog page truncation; no audit trail; hard for mobile reuse/AI later |
| Server-side | Best for RBAC, isolation, indexing, audit, AI boundary |
| Hybrid | Client collects inputs; server `buildCctvDesign` + resolve products |

**Recommend V1:** **Hybrid** — pure deterministic sizing as shared/portable domain (testable without HTTP); product resolution + permission checks on server API; client owns review UX and apply projection.

---

## 7. CCTV V1 input model

### REQUIRED

- Camera count (≥1)
- Environment intent: indoor / outdoor / mixed (counts or ratio)
- Recording on/off (if on → retention days)
- PoE architecture preference: NVR integrated vs external switch vs unknown

### OPTIONAL ADVANCED

- Target resolution (e.g. 2/4/5/8 MP)
- FPS, codec preference
- Recording hours/day, continuous vs motion
- Remote viewing
- UPS
- Cabling: unknown / existing / new (if new → require average run meters **or** mark unresolved)
- Installation / commissioning services
- Expansion headroom % or camera reserve
- Manufacturer preference / workspace default override

### DEFAULTS (≈1-minute flow)

- Count from lead or 4
- Mixed environment if unknown
- Retention 30 days
- Continuous 24h recording assumption (documented)
- Needs recorder + storage on
- PoE: prefer NVR PoE if ports/budget suffice else external
- Installation on; remote from lead

---

## 8. Camera selection

Evaluate:

| Option | Trust |
|--------|-------|
| A. Auto-select one | Fast; opaque; risky with incomplete attrs |
| B. Recommend top 3 | Better trust; still needs structured filter |
| C. Workspace preferred vendor | Strong for installers with preferred brands |
| D. Combination | **Recommended:** structured filter → ranked top 3 (preferred vendor boost) → user confirms one; unresolved if none |

---

## 9. Recorder sizing

Deterministic tiers: 1–4 → 4ch; 5–8 → 8; 9–16 → 16; 17–32 → 32; 33–64 → 64 (matches current `nvrChannelsForCameras`).

**Expansion:** if headroom requested (e.g. +25%) or user flags “future cameras”, bump one tier when near ceiling (e.g. 14 cams → 16 ok; 15–16 with expansion → 32).

**Integrated PoE:** only when `poe_ports ≥ cameras` **and** PoE budget ≥ required; else external switch path.

---

## 10. Storage formula

```
required_TB = cameras × bitrate_Mbps × seconds_recorded_per_day × retention_days
              / 8 / 1024 / 1024
              × (1 + overhead)
```

**Bitrate source order**

1. Structured product bitrate (when exists)
2. Resolution-based engineering default table (document assumptions; MP alone is imperfect)
3. User override

**Assumptions to surface:** codec, FPS, scene complexity, motion %, audio stream. Never claim MP→bitrate as exact.

---

## 11. HDD selection

Given `required_TB`, NVR `hdd_bays`, `max_hdd_tb` (when known):

1. Prefer fewest disks that fit capacity within max size and bay count.
2. Prefer surveillance-grade SKUs when attributed.
3. If impossible → unresolved / warning.

**Example A:** 12 cams × 4 Mbps × 86400 × 30 / 8 / 1024² × 1.2 ≈ **17.8 TB** → e.g. 2×10TB if 2 bays & max≥10; else 3×8TB if 3+ bays.

**Example B:** 4 cams × 2 Mbps × 86400 × 14 / 8 / 1024² × 1.2 ≈ **1.7 TB** → 1×2TB or 1×4TB.

---

## 12. PoE sizing

```
required_budget_W = sum(device_max_power_W) × (1 + headroom)
```

Example: 12 × 8W = 96W; +20% → **115.2W** minimum.

Compare NVR integrated PoE budget/ports vs external PoE switch. Missing wattage → WARNING not silent guess presented as fact.

---

## 13. Network switch logic

Require external switch when any:

- NVR PoE ports < camera count
- NVR PoE budget < required
- Non-PoE recorder
- Distributed topology flag / multi-IDFs (V1: simple boolean)
- User prefers switching architecture

Do not design full topology in V1.

---

## 14. Infrastructure / cabling

**Current:** qty = camera count; unit ignored (`m`/`roll` treated as unit count).

**Correct V1 separation**

| Kind | Semantics |
|------|-----------|
| Cable material | catalog product (CAT6 etc.) |
| Meters | requires run length input or unresolved |
| Boxes/spools | packing from meters + spool length |
| RJ45 / boxes / conduit / rack / consumables | optional catalog lines or unresolved |
| Labor | separate service roles |

**Do not invent 640m from 9 cameras.** Unknown distance → input or unresolved assumption.

---

## 15. Labor logic

Prefer catalog service products:

- Camera install × camera count (if unit/job semantics allow)
- NVR setup ×1
- Remote access ×1
- Testing / commissioning ×1 when toggled

Avoid free-text generated price lines; use catalog snapshot pricing (Task 09).

---

## 16. Compatibility

| Check | Class |
|-------|-------|
| cameras > NVR channels | BLOCKING |
| PoE ports < cameras (when PoE path) | BLOCKING or WARNING if unknown ports |
| PoE budget insufficient | BLOCKING if watts known; WARNING if not |
| HDD count > bays | BLOCKING |
| HDD > max supported | BLOCKING if known |
| Codec unsupported | WARNING if structured; else advisory |
| Mixed vendor | ADVISORY |

Reuse quote gap shape: `{ severity: critical|warning|info, code, message, action }`.

---

## 17. Manufacturer strategy

Today: stored & searchable; **ignored by builder**.

V1 recommend: workspace preferred vendor (settings) + user override per build; filter/boost candidates; never cross-workspace. No supplier-management module.

---

## 18. Missing technical data — confidence

| State | Meaning |
|-------|---------|
| STRUCTURED MATCH | attributes confirm requirement |
| TEXT-ASSISTED MATCH | name/description heuristic — must label as inferred |
| UNRESOLVED | user must pick manually |

Never present text inference as verified engineering data.

---

## 19. Recommendation model

Align with §54. Transient (not Quote UI props):

```text
SystemRecommendation
  systemType
  engineVersion
  inputs
  summary
  components[]   # role, label, qty, requirements, selectedProduct?,
                 # candidates?, reason, source/confidence, editable, optional
  warnings[]
  assumptions[]
  unresolved[]
```

Derive from today’s `SystemBuilderLine` but **decouple** from drawer props. Current code is the seed, not the final contract.

---

## 20. Review UX

Keep review-before-insert. Group: Cameras / Recording / Network·PoE / Infrastructure / Services.

Allow: product replace, qty edit, remove optional. Do not rebuild Quote Builder inside drawer. **Gap today:** Adjust only resets form — no inline replace.

---

## 21. Quote insertion

Flow: Build → Review → Confirm → create/reuse System section → insert catalog lines.

Preserve: server pricing, catalog snapshot, history, Task 09 reliability, Task 10 System terminology.

**Sequential one-request-per-line:** adequate for V1 CCTV (typically <10 lines). Batch endpoint optional later if latency hurts; packages already prove batch pattern. Prefer applying into a named System section for mental model consistency.

---

## 22. Build System / System / Template

| Concept | Meaning | Backing |
|---------|---------|---------|
| בנה מערכת | Dynamic configurator | Build System (transient) |
| מערכת | Reusable static scope | `quote_packages` |
| תבנית הצעה | Whole quote starter | `quote_templates` |

Future optional: Build → Review → Add → Save as System. No implementation in Task 13.

---

## 23. Product attribute architecture

| Option | Verdict |
|--------|---------|
| A. `products.attributes` JSONB | **Already exists** — best V1 |
| B. Category relational tables | Higher migration cost |
| C. Category schema + JSON values | **Current pattern** (`catalog_attrs` + JSONB) — extend |
| D. Compatibility graph | Premature |

**Recommend C/A as today:** extend `_LEAF_SCHEMAS` + typed validation; no new graph DB.

---

## 24. CCTV attribute schemas (proposed, repo-aligned)

Naming follows existing `key` / `label_he` / `type` style.

**Camera:** `device_type`, `resolution_mp` (number), `environment` (indoor|outdoor|both), `form_factor`, `poe` (bool), `max_power_w` (number), `codec`, `fps`, `lens`, `onvif` (bool) — keep/migrate existing text `resolution` carefully.

**NVR:** `channels`, `poe_ports`, `poe_budget_w`, `drive_bays` (alias/migrate `hdd_bays`), `max_hdd_tb`, `bandwidth_mbps`, `codecs`.

**HDD:** new leaf schema: `capacity_tb`, `surveillance_grade` (bool).

**PoE Switch:** `ports`, `poe_ports`, `poe_budget_w`, `port_speed`, `uplink`.

---

## 25. Attribute validation

- Category-aware admin fields from schema (no raw JSON for normal users).
- API validate on write against schema version.
- Nullable allowed; missing → TEXT-ASSISTED / UNRESOLVED downstream.
- Clear validation errors.

No implementation in this task.

---

## 26. Catalog backfill

Safest V1: **manual admin editing** + optional CSV for bulk with human review.

Do **not** auto-write technical values from description parsing. Later: manufacturer/model mapping; reviewed parser; AI suggestion (human approve).

---

## 27. Rule versioning

V1 minimal reproducibility:

- Store `engineVersion` + inputs + assumptions on the **transient recommendation** and optionally in quote metadata / audit event when applying.
- Quote line snapshot preserves commercial output, not full reasoning.

Do not invent Design DB solely for versioning.

---

## 28. Explainability

Every component `reason` must answer **Why?** in Hebrew, e.g.:

- `12 מצלמות → NVR 16 ערוצים`
- `30 ימים × 4Mbps × 12 → נפח משוער`
- `96W + 20% → מינימום 115W PoE`

Structured `reason` string + optional machine `reasonCode` for tests.

---

## 29. AI boundary

**Deterministic:** recorder sizing, storage, PoE, ports, HDD packing, compatibility, product constraints.

**AI later:** survey NL parse, missing-requirement suggestions, enrichment proposals, explanation polish.

No LLM required for correct CCTV V1 recommendation.

---

## 30. Failure modes

| Failure | Severity | UX | Recovery |
|---------|----------|-----|----------|
| Empty catalog | blocking | cannot configure | add products |
| No camera candidate | unresolved | camera row unresolved | manual pick |
| No adequate NVR | unresolved/warning | show needed channels | pick larger / add SKU |
| No valid storage combo | unresolved | show TB needed | manual HDD |
| Insufficient PoE hardware | warning/blocking | explain budget/ports | external switch / different NVR |
| Incomplete attributes | warning | confidence=text/unresolved | enrich catalog |
| Mixed vendor uncertainty | advisory | note | override vendor |
| Incomplete user input | blocking form | highlight required | complete inputs |

---

## 31. Tenant isolation / RBAC

Future engine must:

- Use current workspace catalog only
- Respect catalog + quote permissions
- Re-validate quote workspace on apply
- Never resolve products across workspaces

No new roles.

---

## 32. Performance

| Catalog size | Client scan of full set |
|--------------|-------------------------|
| 100 | Acceptable (today max page) |
| 1,000 | Client full download unacceptable; need server filter by role/attrs |
| 10,000 | Requires indexed server resolution |

V1: server-side candidate query by category + attribute filters; avoid premature micro-optimization beyond replacing `limit=100` blind page.

---

## 33. Test strategy

- **Pure calc:** tiers, storage, HDD pack, PoE
- **Resolution:** structured exact, ranked, fallback, unresolved
- **Compatibility:** channels, ports, budget, bays, codecs
- **Integration:** Requirements → Recommendation → Review projection → Quote payload
- **Isolation:** workspace catalog only

Keep/extend `quote-cpq.test.ts` system builder suite; add pure domain unit tests without React.

---

## 34. Strict V1 scope

### MUST SHIP V1

- Typed `SystemRecommendation` seam (§54)
- Deterministic camera count → NVR tier
- Structured attribute filters for camera/NVR/HDD/switch where data exists
- Confidence labeling; unresolved rows
- PoE ports/budget checks when attributes present
- Review UX with replace/qty; insert with live prices
- Explicit cable meters input or unresolved (no fake meters)

### CAN WAIT V1.1

- Top-3 camera picker UX polish
- Workspace preferred vendor
- Batch insert endpoint
- Save recommendation as System (`quote_packages`)
- Bitrate tables refinement / motion recording modes

### MUST NOT SHIP YET

- Persistent Design DB / twin / topology / IPAM / monitoring / AI ops (§55)
- Auto Quote→Equipment materialization
- Non-CCTV system types as “complete”

---

## 35. Implementation phases

Derived from repo (not assumed 13A–D blindly):

### 13A — Catalog technical foundation

Extend HDD leaf schema + numeric attrs (channels, ports, budget_w, capacity_tb, max_power_w, resolution_mp). Admin validation. Backfill process (manual). Tests for `catalog_attrs`.

### 13B — Deterministic CCTV sizing domain

Pure functions: tiers, storage estimate, PoE budget, HDD packing, compatibility classification. No UI. No API yet.

### 13C — Recommendation resolver API (hybrid)

`buildCctvDesign(input, workspace catalog scope) → SystemRecommendation` server-side resolution + confidence. Client may call API; keep domain testable.

### 13D — Review / apply integration

Refactor drawer onto recommendation model; product replace; optional System section; sequential insert OK; preserve Task 09/10.

Each phase: commit-sized, testable, reversible.

---

## 36. Likely files/modules by phase

| Phase | Likely touch |
|-------|----------------|
| 13A | `catalog_attrs.py`, catalog admin UI, migrations (if schema keys need defaults), `test_catalog_attrs.py` |
| 13B | new `apps/web/src/lib/cctv-sizing.ts` and/or `apps/api/app/cctv_design/` pure module + unit tests |
| 13C | new API router; replace/augment `system-builder.ts` resolution; RBAC via existing catalog/quote deps |
| 13D | `SystemBuilderDrawer.tsx`, `QuoteBuilder.tsx` apply path, i18n, `quote-cpq.test.ts` |

No edits in this audit.

---

## 37. Schema verdict

### Can trustworthy CCTV V1 ship with **no** migration?

**Mostly no for trust.** Existing JSONB + schemas can hold new keys **without** new tables, but:

- HDD has **wrong/missing** leaf schema today — requires `catalog_attrs.py` change (code) and preferably data backfill.
- Numeric typing is soft (many fields `type: text`) — workable with parsing, better with number types in schema metadata.

**Smallest schema change:** extend `_LEAF_SCHEMAS` (add HDD; add numeric keys); **no new tables**. Optional migration only if enforcing DB check constraints (not required for V1).

### Do NOT add yet

`design_components`, topology edges, VLAN/IPAM, telemetry, commissioning, findings, environments — unless a future dedicated task.

---

## 38. Final Build System architecture (target V1)

```text
Requirements (CCTV input)
  → Design / SystemRecommendation (transient)
  → deterministic sizing (channels, TB, PoE, ports)
  → technical requirements per role
  → catalog resolution (structured → text-assisted → unresolved)
  → review (group, edit, confidence)
  → commercial quote projection (catalog lines + snapshot pricing)
```

Preserve future continuity:

```text
Design → Project → Deployment → Digital Twin
```

---

# Accepted extension — Sections 39–55

*(Merged as accepted. Repository inspection did not contradict; evidence reinforces.)*

## 39. Existing Design-layer assessment

No persistent/productized Design layer. Closest: transient Build System; `quote_packages`; planned status on Site File equipment; transient `SystemBuilderLine.role`. Quote items are commercial lines. Systems/equipment are Site File SoT. Projects link engagement (`source_quote_id`) without quote-scope materialization.

## 40. Requirements → Design → Quote → Project → Twin

Ideal: Requirements → System Design → Commercial BOM → Quote → Approved → Project → Deployment → Installed Assets → Site Twin. One Design should support commercial, operational, and twin projections without duplicating SoT.

## 41. Quote Line vs Design Component

V1 engine reasons over internal role/component model before quote lines. Do **not** create persistent `design_components` in Task 13.

## 42. Planned vs Installed Assets

`equipment` remains preferred installed-asset SoT. Future stages PLANNED→…→RETIRED not in Task 13.

## 43. Site File → Digital Twin

Long-term Site File → Digital Infrastructure Twin (Physical, Security Systems, Network, Compute, Cloud, Operations). Not now.

## 44. Device identity — current gaps

Future identity may include asset code, manufacturer, model, serial, hostname, IP, MAC, VLAN, firmware, location, rack, switch/port, PoE, lifecycle.

**Today:** `equipment` has manufacturer/model-style fields via site systems API; **no** `product_id` / `quote_item_id` FK; network identity fields largely absent; Build System does not emit identity.

## 45. Topology

Future: relational typed edges + containment FKs — not canvas geometry alone. No graph DB by default.

## 46. Network domain

Future entities: interface, switch port, VLAN, subnet, IP assignment. No IPAM in Task 13.

## 47. Inventory vs Configuration vs Telemetry

Keep separate. Never claim monitoring from static inventory.

## 48. Troubleshooting requirements

Truthful OSI diagnostics need inventory topology + configuration + live telemetry. Distinguish manual docs / imported config / live observation.

## 49. Configuration snapshots

Asset → Configuration Snapshot → Normalized Facts → Findings. Raw vendor config ≠ normalized facts.

## 50. Security findings

Asset/Config → Finding → Severity → Evidence → Recommendation → Remediation. AI may summarize; must not fabricate SoT findings.

## 51. Cloud / operational environment

Do not globally rename Site. Broader Environment abstraction waits for real cloud-only need.

## 52. Platform AI boundary

Deterministic SoT: assets, topology, IP/VLAN, configs, telemetry, sizing, compatibility, findings. AI-assisted: survey extraction, explanation, troubleshooting guidance, enrichment suggestions. AI must not fabricate technical state.

## 53. Traceability — where it breaks today

Target: Lead → Survey → Requirement → Design → Quote → Quote Line → Project → Deployment → Asset → Incident → Service → Upgrade Quote.

| Link | Today |
|------|-------|
| Lead → Quote | `lead_id` + partial requirement prefill |
| Survey → Design | **Missing** (no survey/design entities) |
| Design → Quote Line | **Breaks** — builder roles/reasons not persisted |
| Quote → Project | Header only (`source_quote_id`); **no lines** |
| Project → Deployment → Asset | **Breaks** — no auto equipment from quote; no product_id on equipment |
| Asset → Incident/Service | Future |

## 54. Smallest V1 architectural seam

```text
buildCctvDesign(input, catalog) → SystemRecommendation
projectRecommendationToQuoteItems(recommendation) → QuoteItem payloads
```

Do not persist Design merely because the seam exists. Formalize types so Build System is not trapped in Quote UI.

## 55. Explicit future scope (out of Task 13 V1)

Digital Twin hierarchy; topology engine; IPAM; SNMP/live monitoring; Cisco/Palo/Check Point/AWS integrations; firewall/vuln platforms; AI operations; incident engine; commissioning module; persistent Design DB; global Site→Environment rename; graph database; automatic Quote→Equipment materialization — unless a future dedicated task approves.

---

## Recommended next implementation task

**13A — Catalog technical foundation (HDD leaf schema + numeric CCTV attributes + admin validation).**

**Why first:** Every trustworthy sizing and matching decision depends on structured fields the matcher currently ignores and HDD lacks entirely. Shipping domain math (13B) or a resolver API (13C) against text-only catalog would encode false confidence. Extending existing `catalog_attrs` JSONB schemas is the smallest reversible seam, aligns with §23/§37 (no new tables), and unblocks deterministic V1 without Design DB or Twin scope.

**STOP.** Do not start implementation from this audit alone.
