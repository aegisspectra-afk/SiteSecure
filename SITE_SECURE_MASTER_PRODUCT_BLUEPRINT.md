# SITE SECURE — MASTER PRODUCT BLUEPRINT

**Document type:** Product + System Architecture (planning only)  
**Status:** DRAFT — Revision Pass (decisions locked below); awaiting final approval before implementation  
**Created:** 2026-08-29  
**Revised:** 2026-08-29 (Revision Pass — product decisions applied)  
**Current-state SoT:** `SITE_SECURE_CURRENT_STATE_AUDIT.txt` (Pass 2, Commit `a26be56b…`, Branch `feat/quote-cpq-phase-ab`)  
**Rule:** This document describes TARGET STATE. Nothing here is shipped unless Audit marks it EXISTS/WORKING.

---

## How to read this document

| Label | Meaning |
|-------|---------|
| **EXISTS** | Audit: working. Keep; do not rebuild. |
| **IMPROVE** | Audit: partial / thin / incomplete. Extend existing. |
| **BUILD** | Needed for product vision; no adequate implementation. |
| **FUTURE** | Valuable later; not for near-term product version. |
| **KEEP / IMPROVE / BUILD / FUTURE / REMOVE** | Matrix actions (capability matrix §34). |

**Non-implementation rule:** No code, migrations, UI, routes, RBAC/plan code changes in this phase.

**Audit gap cross-refs:** `G-XXX` / `R-XXX` from Audit Master Gap Registry / Security Risk Model.

### Locked product decisions (Revision Pass)

| # | Topic | Status |
|---|--------|--------|
| 1 | Quotas → **HARD ENFORCEMENT** server-side | RESOLVED |
| 2 | Trial → Solo/Business/Enterprise; no Free near-term | RESOLVED FOR NEAR-TERM / REVISIT POST-LAUNCH |
| 3 | Calendar + Dispatch v1 = Phase 1 MUST HAVE | RESOLVED |
| 4 | Installed Asset SoT = extend `equipment` (no parallel assets table) | RESOLVED |
| 5 | Cyber packaging Business vs Enterprise | RESOLVED |
| 6 | Secrets Vault before any credential storage feature | RESOLVED |
| 7 | Customer Portal post-launch; Public Quote stays separate | RESOLVED |
| 8 | `founding_technician` keep through Founding Beta | DEFERRED UNTIL POST-BETA |
| 9 | Mobile = Responsive + PWA; Native FUTURE | RESOLVED |
| 10 | No generic Finance/ERP; hide misleading finance promises | RESOLVED |

---

# 1. PRODUCT VISION

## 1.1 What SITE SECURE is

SITE SECURE is a **Security Operations Platform for security installation, service & infrastructure companies**.

It connects in one workspace:

- **Business operations** (CRM, CPQ, projects, billing readiness)
- **Physical security** (CCTV, alarm, access, intercom as installed systems / equipment assets)
- **Field service** (jobs, technicians, service, dispatch)
- **Site Digital Twin** (structured truth of the real site)
- **Networking + cabling documentation** (IP/VLAN/ports/PoE/patch — documentation-first)
- **Cyber posture for installed sites** (explainable findings & health — not SOC)
- **Cloud references** (cloud VMS/NVR/backups tied to sites)
- **Automation & AI** (context-aware assistants and workflows — permissions-bound)

**Spine of the product:** the **Site** — every sales, install, network, cyber, and service object should eventually hang off a Site (and its Customer).

## 1.2 What SITE SECURE is NOT

| Not this | Why |
|----------|-----|
| Full SIEM / SOC | Wrong buyer, wrong ops model |
| EDR / endpoint agent platform | Not installer ICP |
| Video Management System replacing NVR/VMS | We document & operate around devices; we don’t become the video plane |
| Alarm monitoring central station | Different regulated product |
| Generic ERP / Finance module | **RESOLVED:** no Finance/ERP; Billing ≠ Finance |
| Generic CRM (Salesforce clone) | CRM is a means; Site+Field is the core |
| Penetration-testing / offensive security tool | Explicit non-goal |
| AWS Management Console | Cloud refs for site posture only |
| Full CAD / cabling-design suite | Documentation of plant only |
| Consumer smart-home app | B2B integrator focus |

## 1.3 Target market

Hebrew-first (RTL) companies that **design, sell, install, commission, maintain** physical security and low-voltage / networking infrastructure:

- Solo / founding technicians  
- CCTV companies  
- Alarm companies  
- Access Control integrators  
- Low-voltage contractors  
- Full security systems integrators  
- Networking / infrastructure contractors adjacent to security  
- Service & maintenance companies  
- Later: Enterprise orgs with internal technical security teams  

**Not all ICPs share the same workflow depth** — Solo needs speed; Enterprise needs twin + cyber governance + SSO.

## 1.4 Ideal Customer Profile (ICP)

**Primary ICP (near-term):** Israeli security integrator, 1–40 people, sells CCTV/access/alarm (+ light networking), needs quotes → install → service in one system, Hebrew UI, mobile-usable field day.

**Secondary ICP:** Multi-branch integrator needing inventory, dispatch, audit, reports, API.

**Tertiary ICP (later):** Enterprise internal security ops team managing many sites with digital twin + security health.

## 1.5 Primary personas

| Persona | Role keys (current) | Needs |
|---------|---------------------|--------|
| Owner / Admin | `owner`, `administrator` | Whole business, billing, team, risk |
| Ops Manager | `manager` | Dispatch, projects, service SLAs, site health |
| Sales | `sales` | Leads, quotes, approvals, margins (gated) |
| Field Technician | `technician`, `founding_technician` | Today, jobs, site truth, photos, checklists |
| Viewer / Office read | `viewer` | Observe without mutate |
| End Customer (portal) | *future portal identity — post-launch* | Quotes, docs, service status — limited |
| Platform Admin | `is_platform_admin` | Beta/org ops (platform) |

## 1.6–1.9 Problems, UVP, differentiation

Unchanged in substance: integrators lose site truth across WhatsApp/Excel; technical gap is tenant-scoped Site Digital Twin linking commercial ↔ physical/network ↔ field with RBAC/audit/plans.

**UVP:** One Site spine from Lead → Operational Site → Lifecycle, keeping working CPQ + field jobs, extending `equipment` as installed-asset SoT.

**Differentiation:** Hebrew field-first CPQ (EXISTS) + Twin + Network/cabling docs + **explainable** Site Cyber Health (Business+) — not FSM clone, not SOC.

---

# 2. PRODUCT OPERATING MODEL

## 2.1 Canonical lifecycle (TARGET)

```
Lead → Customer → Site → Survey/Visit → Quote/CPQ → Approval/Signature
  → Project → Installation Job → Commissioning → Operational Site
  → Maintenance → Service → Upgrade/Expansion → (loop)
```

**Readiness overlays (TARGET):** Pre-Installation Readiness before install; Operational Readiness before/at Site Operational (§16B).

## 2.2 Current vs Target (high level)

| Stage | CURRENT (Audit) | TARGET Action |
|-------|-----------------|---------------|
| Lead | EXISTS | IMPROVE (activities/tags later) |
| Customer | EXISTS | IMPROVE (Customer 360 — Phase 1) |
| Site | EXISTS (dossier) | IMPROVE → Digital Twin (BUILD layers Phases 3–4) |
| Survey/Visit | IMPROVE (tasks type=visit) | IMPROVE + Calendar (Phase 1) |
| Quote/CPQ | EXISTS (strong) | IMPROVE (delivery, system builder types) |
| Approval/Sign | EXISTS (public) | KEEP — do not rebuild as Portal |
| Project | EXISTS | IMPROVE (commissioning link) |
| Installation Job | EXISTS (detail) | IMPROVE (list, assign, dispatch — Phase 1) |
| Commissioning | MISSING | **BUILD first-class — Phase 1 MUST** |
| Site Readiness | schema `site_readiness` | **BUILD productize — Phase 1** |
| Operational Site | implicit | BUILD via commissioning + operational readiness |
| Maintenance | thin / contracts schema | BUILD (PM + contracts — later Phase 1–2) |
| Service | PARTIAL (list) | IMPROVE full desk — Phase 1 |
| Upgrade/Expansion | via new quote | IMPROVE (explicit link from twin) |

## 2.3 Entity transitions (TARGET design)

| Entity | Created by | Trigger to next | Status model | Automation (later) | Audit | Primary role |
|--------|------------|-----------------|--------------|--------------------|-------|--------------|
| Lead | Sales/Owner/FT | Convert / create customer+site | Keep + refine | Reminder on stale | lead.* | sales |
| Customer | Sales/Owner | Create site / quote | active/inactive/archive EXISTS | — | crm.* | sales/manager |
| Site | Sales/Tech/Manager | Survey / pre-install readiness | installation_status EXISTS; + operational | — | sites.* | manager/tech |
| Visit/Survey | Sales/Tech | Quote ready | task/visit + calendar | — | calendar.* | sales/tech |
| Quote | Sales | Send → approve | EXISTS enums | On approve → project | quotes.* | sales |
| Project | Manager/Sales | Start installation | EXISTS | From quote approve | projects.* | manager |
| Job | Manager | Start/complete | EXISTS | Assign notify | jobs.* | manager/tech |
| Commissioning | Manager/Tech | Sign-off → operational | NEW | Checklist gate | commissioning.* | manager |
| Service Call | Any permitted | Resolve/close | IMPROVE statuses | SLA alerts | service.* | manager/tech |
| Finding | System/manual | Remediate/accept | NEW | Critical → task | security.* | manager |
| Equipment (Installed Asset) | Tech/Manager | From stock install / twin | EXTEND equipment | — | systems/sites | tech |

---

# 3. INFORMATION ARCHITECTURE

## 3.1 Area classification (vs Audit)

| Area | Action | Audit basis |
|------|--------|-------------|
| Dashboard | IMPROVE | EXISTS ops; sales variant G-007 |
| CRM (Customers/Leads) | IMPROVE | EXISTS; tags/activities G-016/017 |
| Sales (Quotes/Catalog) | IMPROVE | EXISTS strong; G-027/028 |
| Sites / Digital Twin | IMPROVE→BUILD | Site dossier EXISTS; twin BUILD Phases 3–4 |
| Site Readiness | BUILD (activate schema) | G-018 `site_readiness` |
| Quotes | EXISTS | G-W06 |
| Projects | IMPROVE | EXISTS |
| Jobs | IMPROVE | EXISTS detail; G-005 |
| Service | IMPROVE | G-003 G-019 |
| Calendar / Dispatch | **BUILD Phase 1 MUST** | G-004 |
| Commissioning | **BUILD Phase 1 MUST** | absent |
| Technicians | IMPROVE→BUILD | role only G-035 |
| Inventory | BUILD Phase 2 | G-009 |
| Documents | IMPROVE Phase 1 | G-W09; G-024 |
| Reports | BUILD Phase 2 | G-011 |
| Network + Cabling docs | BUILD Phase 4 | IP fields only today |
| Cyber Security | BUILD Phase 5; **Business+** | absent |
| AI | FUTURE→BUILD Phase 6 | G-014 |
| Team | IMPROVE | EXISTS; G-001 |
| Billing | BUILD Phase 2 | G-012 |
| Finance (generic) | **REMOVE / hide promises** | G-010 — not a module |
| Settings | IMPROVE | EXISTS thin |
| Audit | IMPROVE | G-025 |
| Integrations | BUILD/FUTURE | G-028 |
| Notifications | BUILD Phase 1 | G-008 |
| Knowledge / Warranties | IMPROVE | G-026 |
| Customer Portal | **FUTURE post-launch** | absent; Public Quote KEEP separate |
| Mobile | Responsive+PWA IMPROVE; Native FUTURE | G-015 |

## 3.2 Proposed Sidebar (Desktop)

```
Overview
  Home (Dashboard | Today by role)
  Calendar & Dispatch          [BUILD Phase 1 — replace false “יומן”]

Sales
  Customers
  Leads
  Quotes
  Catalog

Sites
  Sites (list → Twin detail)

Operations
  Projects
  Jobs                         [IMPROVE — add list Phase 1]
  Service
  Technicians                  [BUILD directory]
  Inventory                    [BUILD Phase 2 — plan gated]

Intelligence
  Network (multi-site hub; detail in Twin)
  Security Health (Business+)
  Reports (Phase 2)

Workspace
  Team
  Documents
  Notifications                [BUILD Phase 1]
  Billing                      [BUILD Phase 2]
  Settings
  Audit
```

**No Finance nav item.** Network/Cyber primarily inside Site Twin; sidebar hubs for multi-site views.

## 3.3 Mobile IA

`Home · Sites/Customers · Work · Calendar · More`  
Technician home remains **Today**. Calendar replaces fake “יומן/משימות” as primary schedule entry once Phase 1 ships (tasks may live under More).

---

# 4. CUSTOMER 360

## 4.1 EXISTS today (Audit)

Profile tabs: overview, sites, quotes, projects, service, warranties, documents; contacts; notes; billing_address (address only — not payments).

## 4.2 TARGET (Phase 1 polish + later depth)

| Block | Action |
|-------|--------|
| Contacts | EXISTS → IMPROVE (roles) |
| Sites / Quotes / Projects / Jobs / Service | EXISTS → IMPROVE density |
| Contracts (service) | BUILD (schema G-019) — not Paid Launch blocker |
| Documents | EXISTS → IMPROVE categories Phase 1 |
| Invoices / AR / Finance module | **OUT** — no Finance module; optional FUTURE accounting *integrations* only |
| Warranties | IMPROVE G-026 |
| Installed equipment rollup | IMPROVE (aggregate `equipment` from sites) |
| Activity timeline | IMPROVE carefully G-017 |
| Communication log | BUILD (metadata — not full inbox) |
| Security findings rollup | BUILD Phase 5 (Business+) |
| Account health score | FUTURE |

---

# 5. SITE DIGITAL TWIN

**Action:** IMPROVE Site File → BUILD twin hierarchy. **Pillar capability.**

## 5.1 EXISTS today

`sites` + `systems` + `equipment` + documents + service filter + field actions.  
Schema-only: `site_zones`, `site_timeline_events`, `site_readiness` (G-018).

## 5.2 ASSET STRATEGY — RESOLVED

**Canonical installed asset = `equipment` (extended over time).**  
**No parallel `assets` table** in this blueprint horizon.

Domain/UI may say **“Asset”**; persistence SoT remains **`equipment`**.

```
Catalog Product
  → Inventory / Serialized Stock Unit
  → installation
  → Equipment / Installed Asset   ← SoT
  → Site Digital Twin
```

A future parallel SoT requires a **new proven Product Decision** (not assumed).

## 5.3 TARGET structural model

```
Site
 ├─ Building(s)
 │   └─ Floor(s)
 │       └─ Area / Zone / Room
 │           └─ Rack / Cabinet
 ├─ System(s)                 [EXISTING — extend]
 ├─ Equipment (Installed Asset) [EXISTING — EXTEND; UI label “Asset” OK]
 ├─ Physical plant (cabling)  [NEW — docs-first §6.4]
 ├─ Network domain            [NEW]
 ├─ Site Readiness            [EXTEND site_readiness — Phase 1]
 ├─ Documents                 [EXISTING]
 └─ Service / Jobs / Findings / Commissioning history
```

**Product behavior:** Twin is **documentation-first**. Auto-discovery = FUTURE.

## 5.4 Physical security / networking equipment types

Map from EXISTING `system_type` / `equipment_category`; extend taxonomy carefully (CCTV, NVR/DVR, alarm, access, intercom, sensors, locks, readers, panels, power, UPS, router, firewall, switch, AP, server, NAS, gateway, controller, patch panel, cabinet, fiber/copper plant).

## 5.5 Equipment (Asset) field model (TARGET)

manufacturer, model, serial, MAC, IP, hostname, firmware, installed_at, warranty, status, physical location path, network location, VLAN, subnet, connected switch, port, PoE, docs, photos, service history.

**EXISTS partial** on `equipment` today.  
**Forbidden:** credentials/passwords in notes or generic document fields (§9).

## 5.6 Why / deps

Technician finds “Camera 17” with port/PoE; sellable documentation; Findings attach to equipment; deps: extend equipment → activate zones (G-018) → network → cabling docs.

---

# 6. NETWORK MANAGEMENT LAYER

**Action:** BUILD (documentation/management). Auto scan/monitor = **FUTURE**.

## 6.1 Capabilities

| Capability | Phase | Action |
|------------|-------|--------|
| Network Overview per Site | 4 | BUILD |
| IP Address Management (IPAM lite) | 4 | BUILD |
| VLAN Management | 4 | BUILD |
| Port Mapping (switch↔equipment) | 4 | BUILD |
| Topology view (logical) | 4–5 | BUILD |
| Device connectivity graph | 4 | BUILD |
| Structured cabling / patch docs | 4 | BUILD (§6.4) |
| Active discovery / SNMP / scanning | — | FUTURE |
| Live monitoring / alerting plane | — | FUTURE (≠ SIEM) |

## 6.2 Example relationship (TARGET)

`Camera 17 → IP 192.168.30.117 → VLAN 30 CCTV → SW-02 Port 17 PoE → Rack B → NVR-01`

## 6.3 Relevance rule

Only network objects that **support security/LV sites** — not enterprise campus NMS.

**Network documentation does not wait for Secrets Vault.**  
**Credential storage does** (§9).

## 6.4 Cabling / physical network (documentation-first)

**Not** a CAD/cabling-design product.

Conceptual chain:

```
Device (equipment)
  → Switch Port
  → Patch Panel Port
  → Cable
  → Outlet / Endpoint
  → Physical Location
```

Support concepts: Rack, Cabinet, Patch Panel, Patch Port, Copper Cable, Fiber, Cable ID, type/category, Origin, Destination, Termination, Label, Test result/reference, Photos/Documents.

---

# 7. CYBER SECURITY LAYER

**Action:** BUILD as **Site Security Health** for integrators. **Not SOC/SIEM/EDR.**  
**Packaging RESOLVED:** Cyber is **not Enterprise-only**.

## 7.1 Packaging (RESOLVED)

| Plan | Cyber capability |
|------|------------------|
| **Solo** | Limited / deferred packaging TBD at implementation (not full Business cyber) — **remaining open:** exact Solo cyber surface |
| **Business** | Site Security Health; Findings; **Standard** baselines; Firmware/lifecycle posture; Network segmentation posture |
| **Enterprise** | Custom baselines; Custom security policies; Cross-site governance; Advanced security reporting; Longer audit/retention; Enterprise integrations |

## 7.2 Product surfaces

- Explainable Site Security Health (not magic score)  
- Findings backlog with evidence  
- Baseline comparison → Findings  
- Drill-down: Overall → Category → Finding  

## 7.3 Security Health model (principles only — no formula yet)

**Architecture:**

```
Finding
  → Security Category
  → Severity / Weight
  → Category Health
  → Overall Site Security Health
```

**Categories (minimum):**

1. Identity & Access  
2. Network Segmentation  
3. Remote Access  
4. Firmware & Lifecycle  
5. Backup & Recovery  
6. Logging  
7. Configuration  
8. Exposure  

**Rules:**

- Every score reduction must be **explainable** via Findings/evidence.  
- Users drill Overall → Category → Finding.  
- **Accepted Risk** remains **visible and auditable** (does not silently inflate health).  
- Do **not** invent unexplained composite magic.  
- Scoring formula = future implementation spec (out of scope here).

## 7.4 Finding object (TARGET)

severity, category (one of above), equipment/site refs, evidence, recommendation, status, owner, created_at, resolved_at, accepted_risk, verification.

## 7.5 Explicit exclusions

No automated offensive scanning as core; no SOC threat-intel; no agent EDR.

---

# 8. SECURITY BASELINES

**Action:** BUILD templates after twin+network richness; earlier as manual checklists.

Templates: Small CCTV, Enterprise CCTV, Alarm, Access Control, Mixed.

Compare CURRENT vs EXPECTED → Findings.

**Plan:** **Standard baselines = Business**; **Custom baselines/policies = Enterprise** (RESOLVED §7.1).

---

# 9. FIREWALL / REMOTE ACCESS + SECRETS

**Action:** BUILD documentation model (Phase 4–5). Live firewall management = FUTURE/non-goal.

Document: firewall device, rule refs, NAT, VPN, management access, port-forward, external exposure summaries.

### Secrets — RESOLVED

| Rule | Decision |
|------|----------|
| Store passwords in equipment notes / site notes / generic document fields | **FORBIDDEN** |
| Network documentation (IPs, VLANs, ports, cabling) without credentials | **Allowed without Vault** |
| Any **structured credential storage** product feature | **Blocked until Secrets Vault ships** |
| Vault requirements | Encryption, strict RBAC, audit, masked display, rotation metadata |

**Vault timing:** BEFORE credential-management features; **not** a blocker for Network docs Phase 4.  
Matrix priority: Vault when credential UX is planned (typically with or just before Remote Access credential features / Phase 4–5).

---

# 10. CLOUD LAYER

**Action:** BUILD light references on Site/System/Equipment (cloud VMS, remote mgmt, backup location, IAM note refs).  
**Non-goal:** AWS console clone.  
Contributes to Security Health categories (e.g. Backup & Recovery) when relevant.  
Cloud API keys → Secrets Vault rules apply.

---

# 11. SERVICE & MAINTENANCE

## 11.1 CURRENT

`service_calls` statuses: `open | in_progress | waiting | closed`; UI list-only (G-003).  
`service_contracts` schema only (G-019).

## 11.2 TARGET lifecycle (additive mapping)

```
OPEN → TRIAGE → ASSIGNED → SCHEDULED → EN_ROUTE → IN_PROGRESS
  → WAITING_PARTS → RESOLVED → CUSTOMER_APPROVAL → CLOSED
```

Future migration mapping only — **no migration now**.

## 11.3 Capabilities

Service Call, Incident, Maintenance Visit, PM, SLA, Contract, Assignment, Scheduling, Parts, Labor, Photos, Checklist, Resolution, Signature, Service Report.

**Action:** IMPROVE desk **Phase 1 MUST**; contracts/PM/SLA BUILD follow-on.

---

# 12. TECHNICIAN OPERATIONS

EXISTS: TodayHome, FieldJob, assigned-scope RBAC.  
TARGET field workspace + office dispatch/skills.  
**Action:** IMPROVE field; BUILD skills (G-035) Phase 1–2; **Calendar/Dispatch Phase 1 MUST**.  
**`founding_technician`:** KEEP through Founding Beta (DEFERRED post-beta role review).

---

# 13. CALENDAR & DISPATCH — RESOLVED

**CURRENT:** Tasks mislabeled as calendar (G-004).  
**TARGET:** BUILD Day/Week/Month + Technician schedule + Dispatch board + DnD + unassigned pool.  
**Mobile:** day agenda + assign-to-me.

| Beta | Calendar requirement |
|------|----------------------|
| Internal Beta | May ship briefly **without** full Calendar (rename honesty if delayed) |
| **Founding Customer operational beta** | **Calendar/Dispatch usable REQUIRED** |
| Rename-only | **Not** the target solution |

**Deps:** Jobs/Service detail + assign UI (G-005); assign API EXISTS.

---

# 14. INVENTORY & ASSET LIFECYCLE

| Concept | CURRENT | TARGET |
|---------|---------|--------|
| Catalog Product | EXISTS | KEEP |
| Inventory Item (SKU stock) | MISSING G-009 | BUILD Phase 2 |
| Serialized Stock Unit | MISSING | BUILD Phase 2 |
| Installed Asset | **`equipment` EXISTS** | **IMPROVE/EXTEND only — RESOLVED** |

Flow: Supplier → Receive → Warehouse → Tech van → Project → **Equipment on Site** → Service → RMA/Disposal.

**Plan:** Business+. No parallel assets SoT.

---

# 15. DOCUMENT MANAGEMENT

**EXISTS:** polymorphic documents + signed URLs.  
**IMPROVE Phase 1:** categories including Commissioning Report / Site Handover Package; versioning as needed; storage ACL (G-024).  
**No secrets in generic document content fields.**

---

# 16. COMMISSIONING — FIRST-CLASS CORE WORKFLOW

**Action:** **BUILD Phase 1 MUST HAVE** (not a Phase 3-only afterthought).

## 16.1 Target flow

```
Installation Complete
  → Commissioning
  → Equipment Verification
  → Network Verification
  → System Functional Tests
  → Recording / Alarm / Access tests (where applicable)
  → Firmware verification
  → Remote Access verification
  → Backup / config verification
  → Security Checklist
  → Documentation completeness
  → Photos
  → Customer handover / training
  → Outstanding Issues
  → Customer Signature
  → SITE OPERATIONAL
```

## 16.2 Deliverable

**Commissioning Report / Site Handover Package** — generated business deliverable (PDF/pack): equipment list, serials, IPs, firmware, network summary, tests, photos, security checklist outcome, outstanding issues, customer sign-off.

**Why:** Closes “job done” vs “site trustworthy & handed over.”  
**Deps:** Jobs complete + Site + equipment (+ readiness). Twin depth can deepen later; commissioning v1 can start with existing equipment fields.

---

# 16B. SITE READINESS — PRODUCTIZE

**CURRENT:** `site_readiness` schema exists (G-018) — not a product surface.  
**Action:** **BUILD / activate in Phase 1** — explainable checklist-derived status (not a fake magic %).

## Pre-Installation Readiness (examples)

- Survey complete  
- Quote approved  
- Equipment available  
- Network info ready  
- Access permission  
- Site contact  
- Technician assigned  
- Required equipment/tools  

## Operational Readiness (examples)

- Installation complete  
- Commissioning complete  
- Documentation complete  
- Network documented (as applicable)  
- Security baseline complete (as applicable / plan)  
- Customer sign-off  
- No **blocking** findings  

**Rule:** Percentage/status = f(explicit checklist requirements met). Users see which items block readiness.

---

# 17. REPORTS & ANALYTICS

**CURRENT:** Dashboard ≠ Reports (G-011).  
**BUILD Phase 2:** Business, Ops, Sales, Service, Technician, Inventory, Security (Business+), Site Health.  
Enterprise: advanced security reporting (§7.1).

---

# 18. NOTIFICATIONS

**CURRENT:** Schema only (G-008).  
**BUILD Phase 1:** In-app + email; Push with PWA later; WhatsApp honest (G-028).

---

# 19. AI LAYER

**FUTURE → Phase 6.** Permissions-aware, tenant-isolated, cite sources; never bypass RBAC; never invent equipment facts.

---

# 20. AUTOMATION ENGINE

**FUTURE Phase 6.** Feature flag `automation` on Business — keep honest until built.

---

# 21. CUSTOMER PORTAL — RESOLVED

| Decision | Detail |
|----------|--------|
| Paid Launch blocker? | **No** |
| Timing | **Post-launch** / later Business+Enterprise capability |
| Public Quote approval | **KEEP separate** — do **not** rebuild into Portal |

Portal content (later): limited sites/quotes/projects/service/docs/warranties/health **summary**; no topology/secrets/internal findings by default.

---

# 22. RBAC FUTURE MODEL

**KEEP** 7 roles + `authorize()` + catalog.json. Additive permissions when building twin/network/cyber/commissioning/dispatch/secrets/inventory.

| Extension | Recommendation |
|-----------|----------------|
| `founding_technician` | **KEEP through Founding Beta**; **post-beta review** keep dedicated role vs `technician` + program flag |
| Editable ACL UI | Catalog-driven; custom = Enterprise FUTURE |
| Portal user | Separate identity FUTURE post-launch |

---

# 23. PLANS & COMMERCIAL MODEL

## 23.1 CURRENT (code)

**Solo / Business / Enterprise**. Quotas today soft (G-002) → **TARGET HARD ENFORCEMENT (RESOLVED)**.

## 23.2 Near-term commercial path — RESOLVED

```
Trial → Solo / Business / Enterprise
```

- **No Free plan near-term.**  
- Free tier possible only via **separate Product Decision after** Billing + Hard Quotas + abuse controls (REVISIT POST-LAUNCH).  
- Reject Option C rename to Free/Pro (breaks keys). Option A plan keys **KEEP**.

## 23.3 TARGET packaging (not code)

| Capability | Solo | Business | Enterprise |
|------------|------|----------|------------|
| CRM + Quotes + Sites basic + Jobs + Commissioning/Readiness core | ✓ | ✓ | ✓ |
| Twin hierarchy + Network/cabling docs | Limited | ✓ | ✓ |
| Cyber: Health, Findings, standard baselines, firmware/lifecycle, segmentation posture | Limited/TBD | ✓ | ✓ + custom baselines/policies, cross-site governance, advanced reporting, retention, integrations |
| Inventory | — | ✓ | ✓ |
| Reports / Audit / API | — | ✓ | ✓ + longer retention |
| Automation / AI | — | Automation when built | AI |
| Portal | — | Post-launch | Post-launch + Ent depth |
| SSO / SCIM / branches | — | — | ✓ |
| Finance module | — | **None** | **None** |
| Seats / storage / clients / quotes | **Hard limits** | **Hard limits** | Unlimited (0) |

**Phase 0:** Implement hard enforcement paths for displayed commercial quotas (seats already hard; add storage/clients/quotes server-side).  
**Phase 2:** Wire enforcement to Billing/subscription lifecycle + trial.

---

# 24. BILLING

**BUILD Phase 2:** Subscription, Plan, Trial, Upgrade/Downgrade, Cancel, Provider, Invoices, Usage, Seat/Storage billing, webhooks.  
**Separate from Finance module** (there is none).  
**Deps:** Phase 0 hard quotas + invite accept; Phase 1 ops stability.

---

# 25. ENTERPRISE

SSO, SCIM, Advanced RBAC, Audit retention, API keys, Webhooks, Branches, workspace switcher (G-006), custom security policies, retention, support, integrations — Phase 7 (+ cyber Ent capabilities Phase 5+).

---

# 26. SECURITY ARCHITECTURE (Target)

| Control | Current | Target | Gap | Priority |
|---------|---------|--------|-----|----------|
| Authentication | Supabase email JWT | Verified prod settings; SSO Ent later | NOT VERIFIED | P0 |
| Authorization | authorize()+can() | Keep; additive perms | G-022 | P0 |
| Tenant isolation | RLS + membership | Live proven | NOT VERIFIED | P0 |
| RLS / Storage ACL | FORCE; coarse storage | Align docs ACL | G-024 | P1 |
| API / ServiceClient | Concentration risk | Negative tests + harden | R-001 | P0 |
| Rate limiting | In-memory | Shared store | G-029 | P1 |
| **Quotas** | Soft meters | **HARD server-side for all displayed commercial quotas** | G-002 | **P0** |
| Invite seats | Create only | Re-check on accept | G-001 | P0 |
| Entitlements | RPC ≠ overrides | Align | G-021 | P0 |
| Secrets | None; notes risk | Vault before credential features; forbid plain secrets | §9 | P1 (before cred UX) |
| Audit | Partial | Required events; Accepted Risk auditable | G-025 | P1 |
| Admin seed | Email in migration | Controlled bootstrap | G-030 | P0 |
| Sessions | not_built | List/revoke | R-012 | P2 |

---

# 27. DATA MODEL (Conceptual — no migrations)

| Entity | Classification |
|--------|----------------|
| workspace, profiles, memberships, invitations | EXISTING |
| subscriptions, plans, features, plan_limits | EXISTING |
| customers, contacts, leads | EXISTING |
| sites | EXISTING |
| site_zones, site_timeline_events | EXISTING schema → EXTEND |
| **site_readiness** | EXISTING schema → **EXTEND / productize Phase 1** |
| systems | EXISTING |
| **equipment** | EXISTING → **EXTEND as Installed Asset SoT (RESOLVED)** |
| building, floor, room/area, rack | NEW (Twin Phase 3) |
| network, subnet, vlan, ip_address, switch_port | NEW (Phase 4) |
| patch_panel, patch_port, cable, outlet | NEW (Phase 4 cabling docs) |
| firewall_doc, remote_access_doc | NEW |
| security_finding, security_baseline | NEW (Phase 5) |
| cloud_link | NEW |
| projects, jobs, checklists | EXISTING |
| **commissioning_run / commissioning_report** | NEW Phase 1 |
| service_calls / service_contracts | EXISTING / schema → EXTEND |
| technician_profile | NEW |
| catalog* | EXISTING |
| inventory_item, warehouse, stock_movement, serial_unit | NEW Phase 2 |
| documents, notifications* | EXISTING → EXTEND |
| secrets_vault_item | NEW — **before credential features** |
| quote* / public_access | EXISTING KEEP |
| ~~assets~~ / ~~finance_* module~~ | **NOT PLANNED** |

**Principle:** EXTEND `equipment` only; inventory serials are stock entities that **become** equipment on install — not a second installed SoT.

---

# 28. API DOMAIN MAP

| Domain | Status |
|--------|--------|
| Existing CRM/Sites/Quotes/Jobs/Service/Docs/Dashboard/Search | EXISTS |
| /calendar, /dispatch | BUILD Phase 1 |
| /commissioning, readiness APIs | BUILD Phase 1 |
| /notifications | BUILD Phase 1 |
| /billing | BUILD Phase 2 |
| /inventory | BUILD Phase 2 |
| /reports | BUILD Phase 2 |
| /networks, /ipam, /cabling | BUILD Phase 4 |
| /security (findings, health, baselines) | BUILD Phase 5; Business+ |
| /secrets | BUILD before cred UX |
| /automations, /ai | FUTURE Phase 6 |
| /portal | FUTURE post-launch |
| /finance | **Do not add** |

Public quotes domain: **KEEP**.

---

# 29. STATUS / WORKFLOW MODEL

| Object | CURRENT | TARGET |
|--------|---------|--------|
| Lead / Quote / Project / Job | EXISTS | KEEP (+ commissioning link on project/job) |
| Service Call | 4 statuses | EXTEND mapped §11 |
| Equipment | planned/installed/replaced/removed | KEEP + extend carefully |
| Security Finding | — | open→in_progress→resolved→accepted→verified |
| Site | installation_status | + operational via commissioning |
| Site Readiness | schema | checklist-derived states Phase 1 |
| Commissioning | — | NEW workflow states |
| Inventory | — | NEW Phase 2 |

---

# 30. AUDIT & EVENT MODEL

IMPROVE G-025. Must include: role changes; **secret access**; quote approve; equipment/network changes; **finding accepted_risk**; document delete; plan/subscription changes; admin actions; **commissioning sign-off**; readiness overrides; service close.

---

# 31. SEARCH

IMPROVE: Customer, Site, Equipment, Serial, IP, MAC, Quote, Project, Job, Service Call, Cable ID (later).

---

# 32. MOBILE STRATEGY — RESOLVED

| Direction | Decision |
|-----------|----------|
| **Responsive Web + PWA** | **Approved** near/mid-term |
| **Native** | **FUTURE** until evidence shows offline/push/device integrations justify cost |

Barcode/QR with inventory Phase 2–3. NFC FUTURE.

---

# 33. UX PRINCIPLES

Role-based · Context-aware (Customer→Site→Equipment) · Field-first · Fast · RTL-first · Mobile-first techs · Desktop-first office · Progressive disclosure · Explainable readiness & security health · No magic scores · No secrets in notes · No Finance theater · No SOC chrome.

---

# 34. MASTER CAPABILITY MATRIX

| Domain | Capability | Current | Target | Action | Priority | Plan | Dependencies | Audit Gap |
|--------|------------|---------|--------|--------|----------|------|--------------|-----------|
| Foundation | Invite accept | PARTIAL | Complete | IMPROVE | P0 | all | Auth | G-001 |
| Foundation | **Hard quotas** | PARTIAL soft | **Hard enforce all displayed quotas** | IMPROVE | P0 | all | Plans | G-002 |
| Foundation | Entitlements sync | PARTIAL | Aligned | IMPROVE | P0 | all | — | G-021 |
| Foundation | ServiceClient harden | RISK | Tested | IMPROVE | P0 | all | API | G-023 |
| CRM | Customer 360 | WORKING | Deeper | IMPROVE | P1 | crm | — | G-W04 |
| Sales | Quotes/Public | WORKING | Keep | KEEP | P0–P1 | quotes | — | G-W06/07 |
| Ops | Service detail | PARTIAL | Full | IMPROVE | P1 | service | — | G-003 |
| Ops | Job assign/list | PARTIAL | Usable | IMPROVE | P1 | — | — | G-005 |
| Ops | **Calendar/Dispatch** | MISSING | **v1 usable** | BUILD | P1 | — | Jobs/Service | G-004 |
| Ops | **Commissioning** | MISSING | First-class | BUILD | P1 | — | Jobs/Site | — |
| Ops | **Site Readiness** | Schema | Explainable | BUILD | P1 | — | site_readiness | G-018 |
| Comms | Notifications | Schema | Center | BUILD | P1 | — | — | G-008 |
| Docs | Categories/ACL | PARTIAL | Strong | IMPROVE | P1 | — | Storage | G-024 |
| Commercial | Billing+Trial | Stub | Provider | BUILD | P2 | all | Hard quotas | G-012 |
| Inventory | Stock/serials | MISSING | v1 | BUILD | P2 | Biz+ | Catalog→equipment | G-009 |
| Insights | Reports | MISSING | v1 | BUILD | P2 | Biz+ | — | G-011 |
| Finance | Generic module | Flag only | **None** | **REMOVE** promises | P0 UX honesty | — | — | G-010 |
| Twin | Hierarchy/equipment extend | PARTIAL | Twin | IMPROVE/BUILD | P2–3 | — | equipment SoT | G-W05 |
| Network | IPAM/ports/cabling | MISSING | Docs | BUILD | P2–4 | Biz+ | Twin | — |
| Secrets | Vault | MISSING | Before cred UX | BUILD | P1–2 gate | — | — | §9 |
| Cyber | Health/Findings/baselines | MISSING | Business pack | BUILD | P2–5 | **Biz+** | Twin/Network | — |
| Cyber | Custom gov/reporting | MISSING | Ent pack | BUILD | P3–7 | **Ent** | Cyber Biz | — |
| Portal | Customer portal | MISSING | Post-launch | FUTURE | P3 | Biz+/Ent | Public quote KEEP | — |
| Mobile | PWA | PARTIAL web | Approved path | IMPROVE | P1–2 | — | — | G-015 |
| Mobile | Native | MISSING | Evidence-gated | FUTURE | P3 | — | — | G-015 |
| AI/Auto | Assistant/rules | Rules only | Phase 6 | FUTURE | P3 | Ent/Biz | Twin | G-014 |
| Team | founding_technician | EXISTS | Keep beta | KEEP | — | — | Post-beta review | — |

---

# 35. ROADMAP

*Relative phases — no fake calendar estimates.*

## PHASE 0 — FOUNDATION HARDENING

**Objective:** Trustworthy Internal Beta foundation.  
**Capabilities:**  
- G-001 invite accept + seat re-check on accept  
- **G-002 HARD ENFORCEMENT** for seats (already) + storage + clients + quotes (and any other displayed commercial quota) **server-side**  
- G-021 entitlements/overrides align  
- R-001 ServiceClient negative tests  
- G-030 admin seed hygiene  
- Auth + tenant isolation verification  
- G-022 catalog CI  
- **Hide/remove misleading Finance capability promises/flags from product surfaces** (G-010)  
- Calendar: if not started, use honest labeling (tasks ≠ calendar) until Phase 1  

**Exit:** Internal Beta foundation green.  
**NOT yet:** Twin/Network/Cyber depth, Billing provider, AI, Portal, Native.

## PHASE 1 — OPERATIONAL CORE

**Objective:** Founding Customer can run Lead → Operational Site without Excel.  
**MUST include:**  
- Service Detail  
- Job Assignment (+ jobs list as needed)  
- **Calendar / Dispatch v1**  
- Notifications (in-app + email)  
- **Commissioning** (first-class + Handover Package)  
- **Site Readiness** (pre-install + operational, explainable)  
- Customer 360 polish  
- Documents categories / ACL improvements  

**Also:** Quote delivery honesty improvements as capacity allows.  
**Deps:** Phase 0.  
**Exit:** Founding Customer **operational** beta criteria (Calendar/Dispatch usable).  
**NOT yet:** Full IPAM, Cyber scoring product, Inventory warehouses, Billing provider, Portal, Native.

## PHASE 2 — COMMERCIAL SAAS

**Objective:** Paid Public Launch readiness.  
**Capabilities:** Billing provider; Subscription management; Trial UX; **Hard usage enforcement integrated with billing**; Inventory v1; Reports v1; feature honesty for shipped modules.  
**Deps:** Phase 0 hard quotas; Phase 1 stability.  
**Exit:** Paid Public Launch.  
**NOT yet:** Portal (post-launch), SSO, AI production, Free plan.

## PHASE 3 — SITE DIGITAL TWIN

Buildings/floors/zones; extend equipment; location paths; timeline; deepen commissioning↔twin; serial search.  
**NOT:** auto discovery; parallel assets table.

## PHASE 4 — NETWORK INTELLIGENCE

IPAM/VLAN/ports/PoE/topology; firewall/remote-access **docs**; cabling/patch documentation; Secrets Vault **before** credential features.  
**NOT:** SNMP/live monitoring.

## PHASE 5 — CYBER SECURITY LAYER

Explainable Security Health + Findings; Business standard baselines & postures; Enterprise custom/governance/advanced reporting.  
**NOT:** SIEM/EDR/pentest automation.

## PHASE 6 — AI & AUTOMATION

Permissions-aware assistant; automation rules.  
**NOT:** autonomous remediation.

## PHASE 7 — ENTERPRISE PLATFORM

SSO/SCIM/branches/webhooks/API keys/retention/advanced RBAC/workspace switcher; Portal depth as approved post-launch.

---

# 36. BETA READINESS CHECKLIST

| Item | Internal Beta | Founding Customer Beta | Paid Public Launch | Enterprise Ready |
|------|---------------|------------------------|--------------------|------------------|
| Auth verified | READY req | READY req | READY req | READY |
| Invite accept + seats | BLOCKED G-001 | BLOCKED | BLOCKED | READY |
| **Hard quotas server-side** | BLOCKED G-002 | BLOCKED | BLOCKED | READY |
| Entitlements aligned | BLOCKED G-021 | BLOCKED | BLOCKED | READY |
| ServiceClient tests | BLOCKED R-001 | BLOCKED | BLOCKED | READY |
| Finance promises hidden | READY req | READY req | READY req | READY |
| Core CRM+Quotes+Sites+Jobs | READY | READY | READY | READY |
| Service detail | PARTIAL ok | READY req | READY req | READY |
| **Calendar/Dispatch** | NOT REQUIRED (short) | **READY req** | READY | READY |
| **Commissioning** | NOT REQUIRED | READY req / PARTIAL min | READY preferred | READY |
| **Site Readiness** | NOT REQUIRED | READY preferred | READY preferred | READY |
| Notifications | NOT REQUIRED | PARTIAL→READY | READY | READY |
| Billing + Trial | NOT REQUIRED | NOT REQUIRED | **BLOCKED until live** | READY |
| Inventory/Reports | NOT REQUIRED | NOT REQUIRED | READY preferred | READY |
| Twin/Network | NOT REQUIRED | NOT REQUIRED | NOT REQUIRED | PARTIAL→READY |
| Cyber Business pack | NOT REQUIRED | NOT REQUIRED | NOT REQUIRED | READY (Biz+) |
| Cyber Ent pack | NOT REQUIRED | NOT REQUIRED | NOT REQUIRED | READY |
| Customer Portal | NOT REQUIRED | NOT REQUIRED | **NOT REQUIRED** | OPTIONAL/READY |
| Public Quote | READY | READY | READY | READY |
| PWA path | PARTIAL | PARTIAL | READY preferred | READY |
| Native | NOT REQUIRED | NOT REQUIRED | NOT REQUIRED | OPTIONAL |
| SSO | NOT REQUIRED | NOT REQUIRED | NOT REQUIRED | READY req |
| founding_technician | KEEP | KEEP | KEEP | Post-beta review |

---

# 37. NON-GOALS

- Full SIEM / SOC / XDR / EDR  
- NVR/VMS replacement / live video wall  
- Alarm monitoring central station  
- **Generic Finance / ERP module**  
- Offensive security / automated pentest  
- AWS/GCP console  
- Generic horizontal CRM  
- Full CAD / cabling-design product  
- Parallel `assets` SoT without new decision  
- Free plan near-term  
- Rebuilding Public Quote into Customer Portal  
- Magic unexplained Security Health scores  
- Storing credentials in notes/documents  

---

# 38. FINAL BLUEPRINT SUMMARY

### What exists today
Auth, Workspace, RBAC, Solo/Business/Enterprise (soft quotas), CRM, Site dossier + systems/**equipment**, strong CPQ + public sign, Projects + Field Jobs, thin Service/Tasks, Documents, Dashboard/Today, Audit viewer.

### What we keep
CPQ, Public Quote, authorize()+catalog, **equipment as installed-asset SoT**, field Today/Job, Hebrew RTL, plan keys Solo/Business/Enterprise, `founding_technician` through Founding Beta.

### What we improve
Invite accept; **hard quotas**; entitlements; service desk; job assign; documents ACL; customer 360; audit; hide Finance theater; PWA path.

### What we build (near)
Phase 1 Operational Core: Calendar/Dispatch, Commissioning, Site Readiness, Notifications, Service/Job depth.  
Phase 2: Billing, Trial, Inventory, Reports.  
Later: Twin, Network+cabling, Cyber (Biz then Ent), Vault before creds, AI/Automation, Enterprise, Portal post-launch.

### What we postpone
Native; Free plan; Portal at Paid Launch; auto discovery; SIEM; Finance module; parallel assets table; post-beta FT role redesign.

### Differentiators
Site-centric Security Operations: CPQ + Field + Twin + Network/cabling docs + **explainable** Business+ Cyber Health.

### Before Internal Beta
Phase 0 complete.

### Before Founding Customer operational beta
Phase 0 + Phase 1 MUST list (incl. Calendar/Dispatch).

### Before Paid Launch
Phase 0–2: billing+trial live, hard quotas enforced, ops core complete, security negatives green. Portal not required.

### Enterprise readiness
Phases 5–7 + Ent cyber/governance + SSO/API/branches + retention/secrets discipline.

---

# DECISIONS REGISTER

## RESOLVED DECISIONS

1. **Quotas:** Target = **HARD ENFORCEMENT** server-side for every commercial quota shown to users (seats, storage, customers, quotes, …). No UI-only limits. (Phase 0 implement enforcement; Phase 2 integrate with Billing.)  
2. **Trial/Free (near-term):** Trial → Solo / Business / Enterprise. **No Free plan now.** Revisit Free only post-launch after Billing + Hard Quotas + abuse controls.  
3. **Calendar:** Calendar + Dispatch v1 is **Phase 1 MUST HAVE**. Rename-only is not the target. Internal Beta may omit briefly; Founding Customer operational beta requires usable Calendar/Dispatch.  
4. **Asset strategy:** Canonical installed asset = extend **`equipment`**. No parallel `assets` table. UI may say “Asset”.  
5. **Cyber packaging:** Business gets Health/Findings/standard baselines/firmware-lifecycle/segmentation posture. Enterprise adds custom baselines/policies, cross-site governance, advanced reporting, longer retention, Ent integrations. Cyber ≠ Enterprise-only.  
6. **Secrets:** No plain credentials in notes/docs. **Vault before** any structured credential storage. Network docs without creds do not wait for Vault.  
7. **Customer Portal:** Not a Paid Launch blocker; post-launch Business+Enterprise. Public Quote remains separate.  
8. **Mobile:** Responsive Web + **PWA** approved. Native FUTURE until evidence justifies cost.  
9. **Finance:** Do not build Finance/ERP. Hide/remove misleading finance promises/flags. Billing is separate (Phase 2). Future accounting integrations ≠ Finance module.  

## DEFERRED DECISIONS

1. **`founding_technician` long-term:** Keep through Founding Beta. **Post-beta review:** dedicated role vs `technician` + program/entitlement flag.  

## REMAINING OPEN DECISIONS

1. **Solo cyber surface:** How limited is Solo vs “no cyber” vs read-only summary? (Business pack is resolved; Solo exact scope open.)  
2. **Pre-Installation vs Operational readiness item set (v1 checklist freeze):** which items are mandatory blockers for Founding Beta vs nice-to-have?  
3. **Commissioning v1 minimum:** which verification steps are required vs optional by system type (CCTV vs alarm vs access)?  
4. **Multi-workspace switcher (G-006):** document single-workspace product rule vs build switcher — timing?  
5. **Quote transactional email / WhatsApp provider** vs honest mailto/wa.me indefinitely (G-028)?  
6. **When exactly to schedule Secrets Vault** relative to Phase 4 remote-access docs (must precede credential UX — calendar slot open)?  
7. **Inventory serial → equipment** link UX rules at install (auto-create equipment vs manual attach)?  
8. **Accepted Risk effect on Security Health display** (visible penalty vs separate badge — principles forbid silent hide; exact UI treatment open)?  

---

## Consistency conflicts checked (Revision Pass)

| Topic | Result |
|-------|--------|
| Soft vs hard quotas | Updated everywhere to HARD ENFORCEMENT |
| Free plan | Near-term no; revisit post-launch only |
| Calendar Phase 1 / Beta | MUST for Founding ops beta; Internal may omit briefly |
| Parallel assets table | Removed; equipment SoT locked |
| Cyber Ent-only | Removed; Business pack explicit |
| Secrets vs Network | Split: docs OK; creds need Vault |
| Portal vs Paid Launch | Portal not required; Public Quote KEEP |
| Finance vs Billing | Separated; Finance REMOVE promises |
| Phase 1 name/contents | Renamed OPERATIONAL CORE with MUST list + Readiness |
| Phase 2 | Billing/Trial/Hard enforcement integration/Inventory/Reports; Portal removed from Phase 2 exit |
| Mobile | PWA approved; Native FUTURE |
| founding_technician | Deferred post-beta — not unresolved redesign |

**No unresolved contradiction found** against the ten locked decisions after this pass.

---

## Document control

| Field | Value |
|-------|-------|
| Depends on | `SITE_SECURE_CURRENT_STATE_AUDIT.txt` |
| Implementation | **FORBIDDEN** until explicit approval |
| Next artifact after approval | Phase 0 implementation specs (small Cursor tasks) |

**STOP.** No implementation in this phase.
