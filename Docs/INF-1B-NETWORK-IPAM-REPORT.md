# INF-1B NETWORK / IPAM REPORT

**Date:** 2026-09-28  
**Status:** Complete. Stopped. No Topology / Connections / Discovery.

---

## 1. Files changed

| Area | Files |
|---|---|
| Migration | `supabase/migrations/20260928103052_site_network_ipam_foundation.sql` |
| API | `apps/api/app/ipam.py`, `apps/api/app/routers/ipam.py`, `apps/api/app/main.py` |
| Client | `packages/api-client/src/index.ts` |
| UI | `SiteNetworkPanel.tsx`, `SiteDossier.tsx` (Network tab), `AssetDetail.tsx` (IPAM-aware network), `he.ts` |
| Tests | `apps/api/tests/test_ipam_inf1b.py`, `apps/web/tests/site-network-ipam-inf1b.test.tsx` |
| QA | `Docs/inf1b-network-ipam-qa/live-proof.json` |

---

## 2. New tables/entities

- `site_vlans`
- `site_networks`
- `site_ip_addresses`
- Enums: `ip_assignment_type` (`static|dhcp|reserved`), `ip_address_status` (`available|assigned|reserved`)

---

## 3. Migrations

Applied to production Supabase (`site_network_ipam_foundation`). Additive only. Equipment table untouched.

---

## 4. Network model

`site_networks`: workspace/site, name, cidr, vlan_id, gateway, dhcp_enabled/start/end, dns_primary/secondary, purpose, notes, timestamps. Optional assigned IP counts on list.

---

## 5. VLAN model

`site_vlans`: vlan_number 1–4094, name, purpose, description. Unique `(site_id, vlan_number)`.

---

## 6. IPAddress model

`site_ip_addresses`: network_id, optional vlan_id/equipment_id, ip_address, hostname, mac_address, assignment_type, status, notes. Unique `(site_id, ip_address)`.

---

## 7. Validation rules

Stdlib `ipaddress`:

- CIDR normalize/reject invalid
- IP must belong to selected subnet
- DHCP range must sit inside subnet when provided
- VLAN number range
- Equipment/VLAN/network same-site checks
- MAC format when provided

---

## 8. Duplicate-IP enforcement

DB unique constraint `site_ip_addresses_site_ip_uidx` + API 409 `כתובת IP כבר קיימת באתר`. Live proof: duplicate → 409.

---

## 9. Legacy equipment.ip/mac compatibility

Unchanged columns. Transition:

- IPAM is canonical for managed assignments
- Asset detail prefers IPAM rows
- Falls back to `equipment.ip` / `equipment.mac` when no IPAM assignment
- No dual-write / no destructive backfill

---

## 10. Site Network UI

New tab **רשת**: compact overview counts + VLAN list + Networks list + create forms (systems.edit).

---

## 11. IPAM UI

**כתובות IP**: desktop dense table, mobile cards, search, add, assign asset, unassign. No scanner/discovery.

---

## 12. Asset integration

Network section: IPAM primary IP + MAC + network + VLAN; multi-IP listed; legacy fallback labeled.

---

## 13. Authz/RLS

`systems.view` / `systems.edit` + `auth_site_visible` RLS (same pattern as equipment). Privileged delete.

---

## 14. QA fixture/live proof

Site `0e854579-…`:

| Entity | Result |
|---|---|
| VLANs | 10 Management, 20 CCTV, 30 Access |
| Networks | 10.10.10/20/30.0/24 |
| IPs | 10.10.20.10 (available), .101→CAM-001, .102→CAM-002 |
| Overview | 3/3/3 nets/vlans/ips; assigned 2 / available 1 |
| Outside subnet | 400 |
| Duplicate IP | 409 |
| CAM-001 IPAM | 10.10.20.101 + VLAN 20 CCTV |

(No NVR Asset on site — `.10` left unassigned intentionally.)

---

## 15–21. Responsive / theme / RTL

Implemented against existing design system:

- **1440**: dense IP table + overview strip
- **1032 / 768**: table→cards at `md`
- **390 / 360**: cards, min-h-11 controls, bottom-nav padding via existing site layout
- Dark/Light tokens
- RTL with LTR isolation for IP/MAC/CIDR/hostname

---

## 22. Focused tests

- API IPAM: **10** (+ INF-1/Q8-C → **45** combined focused)
- Broader filter suite: **78**
- Web IPAM: **3**; INF-1A/SiteDossier: **11**

---

## 23. Typecheck

Pass.

## 24. Build

Pass.

---

## 25. Remaining gaps

- No ISP/WAN/firewall overview (deferred)
- No bulk IP allocation / host calculator
- Activity/audit for IP assign deferred (Phase 1D)
- Technician delete of IPs requires privileged role (same as equipment delete)
- NVR fixture IP left without Asset (no NVR row on QA site)

---

## 26. Readiness for INF-1C Connections / Topology

**INF-1B ready to close.** Manual subnet/VLAN/IPAM foundation is live with Asset integration and legacy fallback.

**INF-1C Connections / Topology not started.**

**STOP.**
