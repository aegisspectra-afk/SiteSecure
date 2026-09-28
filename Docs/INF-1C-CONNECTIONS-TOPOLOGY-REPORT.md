# INF-1C CONNECTIONS / TOPOLOGY REPORT

**Date:** 2026-09-28  
**Status:** Complete. Stopped. No INF-1D.

---

## 1. Files changed

| Area | Files |
|---|---|
| Migration | `supabase/migrations/20260928104509_asset_connections_topology.sql` |
| API | `apps/api/app/routers/connections.py`, `apps/api/app/main.py` |
| Client | `packages/api-client/src/index.ts` |
| UI | `AssetConnectionsSection.tsx`, `SiteTopologyPanel.tsx`, `AssetDetail.tsx`, `SiteDossier.tsx`, `he.ts` |
| Tests | `apps/api/tests/test_connections_inf1c.py`, `apps/web/tests/site-connections-topology-inf1c.test.tsx` (+ INF-1A/INF-1B/SiteDossier mock updates) |
| QA | `Docs/inf1c-connections-topology-qa/*` |

---

## 2. Existing-equivalent audit

Searched for connection/topology/graph libraries and data models.

- No prior `asset_connections` / topology table or API.
- No React Flow / xyflow / d3 / cytoscape / elk in `apps/web`.
- Asset SoT remains `equipment`.

---

## 3. Data model

Table `asset_connections` (directional source → target):

- `id`, `workspace_id`, `site_id`
- `source_equipment_id`, `target_equipment_id`
- `connection_type`, `source_port`, `target_port`, `notes`
- `created_at`, `updated_at`
- CHECK: source ≠ target

**Directionality:** intentional directed edges (ports / uplink context). Reversed duplicate is allowed if ports/type differ; exact duplicate blocked.

---

## 4. Migration

Applied to production Supabase as `asset_connections_topology`. Additive only.

- Enum `asset_connection_type`
- Unique expression index on `(site_id, source, target, type, COALESCE(ports))`
- Indexes: site / source / target
- RLS enabled + forced; site-visibility + technical roles for write

---

## 5. Connection types

Enum V1: `ethernet | fiber | poe | wireless | uplink | wan | other`

No trunk/access, STP, LACP, routing, or firewall policy.

---

## 6. Validation

Server-side (`systems.edit`):

| Rule | Result |
|---|---|
| Source/target exist | 404 if missing |
| Same workspace + same Site | 400 |
| Self-connection | 400 |
| Exact duplicate | 409 |
| Cross-site | blocked (same-site check / missing equipment) |

Live proof: self → 400, duplicate → 409, topology → 200.

---

## 7. Asset detail integration

New section **חיבורים** after Network:

- Connected to / from peer (code, name, type, ports, IP, notes)
- Create / edit / delete when `systems.edit`
- Read-only roles: list only

---

## 8. Create/edit/delete UX

**Add Connection** from Asset detail:

- Target Asset (same Site picker: code · name · category · IP)
- Connection type
- This Asset port / target port (free text)
- Notes

Incoming edges: peer picker locked; ports/type/notes editable.

---

## 9. Topology route/tab

Site File tab **טופולוגיה** (`topology`) between Network and Systems.

Read-only visualization of equipment nodes + `asset_connections` edges. Node click → Asset detail.

---

## 10. Graph implementation

Custom layered SVG:

- BFS layering from roots (no incoming edges)
- Curved edges + arrow markers + type/port labels
- Pan (pointer drag), zoom +/−, fit-to-view
- Selected node stroke accent
- No health/traffic/discovery/animation

---

## 11. Dependency decision

**No new dependency.** Existing React + SVG is enough for V1 small-site graphs. React Flow / d3 not justified.

---

## 12. IPAM integration

Topology / connection enrichment shows primary assigned IPAM IP when present, else legacy `equipment.ip`.

Connections are **never** inferred from subnet / VLAN / category.

---

## 13. Authz/RLS

Reuse `systems.view` / `systems.edit` + `auth_site_visible`. No new RBAC family.

---

## 14. Empty states

| State | UI |
|---|---|
| No Assets | Prerequisite copy — no fake graph |
| Assets, no connections | “אין חיבורים מוגדרים” + CTA to add from Asset |

---

## 15. 1440 result

Topology tab renders hierarchical graph (FW → Core → CCTV/AC/AP → cams/NVR). Asset detail Connections CRUD visible. Screenshot: `1440-dark-topology.png`, `1440-dark-asset-connections.png`.

---

## 16. 1032 result

Topology tab + canvas usable; fit/zoom controls ≥44px. Screenshot: `1032-dark-topology.png`.

---

## 17. 768 result

Full tree readable with edge labels; bottom nav clear. Screenshot: `768-dark-topology.png`.

---

## 18. 390 result

Topology tab present; canvas pannable. Capture partially header-scrolled in one shot; DOM confirms canvas + 10 nodes. Prefer 360 proof for graph clarity.

---

## 19. 360 result

Topology canvas + edges + bottom nav clearance verified. Screenshot: `360-dark-topology.png`.

---

## 20. Dark / Light

Shell dark sidebar + light content surface (app default). Node fill uses `--color-bg`; edges use `currentColor` / muted. Asset Connections section verified on light content surface. No fake online/offline node colors.

---

## 21. RTL

Hebrew RTL shell verified. Graph layout is LTR-logical (not mirrored). Technical codes/IPs use LTR isolation on labels.

---

## 22. QA fixture / live proof

Workspace `50339413-…`, Site `0e854579-…`.

Created Assets: `FW-QA-01`, `CORE-SW-01`, `SW-CCTV-01`, `NVR-01`, `AC-01`, `AP-01` (+ existing CAM-001/002).

Connections (7):

```
FW-QA-01 --wan--> CORE-SW-01
CORE-SW-01 --uplink--> SW-CCTV-01
SW-CCTV-01 --poe--> CAM-001
SW-CCTV-01 --poe--> CAM-002
SW-CCTV-01 --ethernet--> NVR-01
CORE-SW-01 --ethernet--> AC-01
CORE-SW-01 --ethernet--> AP-01
```

Live API (`Docs/inf1c-connections-topology-qa/live-proof.json`):

- topology 200 — 10 nodes / 7 edges / directional true
- CAM-001 lists 1 connection
- INF-1B overview still 200 (3 networks)

---

## 23. Focused tests

| Suite | Result |
|---|---|
| `test_connections_inf1c.py` | pass (create/same-site/self/dup/edit/delete/list/topology/empty/readonly) |
| `test_ipam_inf1b.py` | pass |
| `test_equipment_asset_inf1.py` | pass |
| `site-connections-topology-inf1c.test.tsx` | pass |
| `site-assets-inf1a.test.tsx` | pass |
| `site-network-ipam-inf1b.test.tsx` | pass |
| `site-dossier.test.tsx` | pass |

---

## 24. Typecheck

`npm run web:typecheck` — pass.

---

## 25. Build

`npm run web:build` — pass.

---

## 26. Remaining gaps

- Activity log for connection create/change/remove deferred (no cheap equipment activity hook) → INF-1D.
- No switch-port inventory entity (ports are text).
- Orphan Assets (no edges) still appear as nodes in topology when any edges exist (honest Site equipment set).
- Heavy auto-layout / collision avoidance not in scope.

---

## 27. Readiness for INF-1D Documents / Service / Warranty / Activity

INF-1C checkpoint complete. Asset Connections + Site Topology foundation is in place for INF-1D to attach documents/service/warranty/activity without rediscovering connectivity.

**STOP. Do not start INF-1D.**
