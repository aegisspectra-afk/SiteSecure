# INF-1A ASSET EXPERIENCE REPORT

**Date:** 2026-09-28  
**Status:** Complete. Stopped. No Network/IPAM / Topology / new assets table.

---

## 1. Files changed

| File | Role |
|---|---|
| `apps/api/app/routers/systems.py` | `GET /equipment/{id}` |
| `packages/api-client/src/index.ts` | `getEquipment`, `getCatalogProduct` |
| `apps/web/src/lib/site-assets.ts` | Filter/helpers/status labels |
| `apps/web/src/components/sites/SiteAssetsPanel.tsx` | Site Assets list (desktop table + mobile cards) |
| `apps/web/src/components/sites/AssetDetail.tsx` | Site-scoped Asset detail + edit |
| `apps/web/src/components/sites/SiteDossier.tsx` | Equipment tab → Assets panel |
| `apps/web/src/routes/app/sites/$siteId_.assets.$assetId.tsx` | Route `/app/sites/{siteId}/assets/{assetId}` |
| `apps/web/src/i18n/he.ts` | Assets/detail copy |
| `apps/web/src/styles.css` | Assets table / detail layout |
| `apps/web/tests/site-assets-inf1a.test.tsx` | Focused INF-1A tests |
| `apps/web/tests/site-dossier.test.tsx` | Assets tab coverage |
| `apps/api/tests/test_equipment_asset_inf1.py` | `get_equipment` regression |
| `Docs/inf1a-asset-experience-qa/*` | Live API proof + QA artifacts |

**Not touched:** equipment identity, Quote Builder, project scope, Q8-C create flow, warranty/service schema, Network/IPAM, Topology, AssetType, status enum, authz model. No migration.

---

## 2. Site Assets list changes

Tab label: **ציוד מותקן** (`siteTabAssets`).

Shows: asset_code, name, category, manufacturer/model, serial, status, system, IP, installed_at.

Desktop: dense table. Mobile: compact cards linking to detail.

Manual add form remains (systems.edit), collapsed behind toggle.

---

## 3. Asset detail route

`/app/sites/$siteId/assets/$assetId`  
Flat under `/app` (pathless `$siteId_` escape) so SiteDossier does not need an Outlet.

Auth: `systems.view` (RequirePermission) + existing equipment RLS.

---

## 4. General fields

asset_code (prominent but smaller than name), name, category, manufacturer, model, serial, status. No fabricated description column (not in schema).

---

## 5. Location fields

Site link, System (same-site list), location_note. Zone not editable (no zones list API in product surface).

---

## 6. Basic network fields

IP + MAC only. Explicit note that VLAN/hostname/switch belong later.

---

## 7. Lifecycle/provenance

installed_at; Project link + Quote number/revision when resolvable via `project_id` → project → source quote; catalog product reference when `product_id` resolvable. No duplicated quote/project payloads on equipment.

---

## 8. Warranty integration

Site warranties filtered by `equipment_id`. Shows status, start→end, link to `/app/warranties/$id`. Empty state when none. No auto-create.

---

## 9. Editing/authz

PATCH via existing `patchEquipment`. Edit UI only when `systems.edit`. Same-site systems only in selector (site systems list). Read-only roles: no edit controls.

---

## 10. Search/filter

Client-side within site list: q across asset_code/name/serial/manufacturer/model/IP (+ MAC/location). Filters: status, category, system (incl. “ללא מערכת”).

---

## 11. Legacy compatibility

Null asset_code/serial/IP/system/project/warranty shown as “—” / empty states. No backfill, no invented codes.

---

## 12–17. Viewport / theme / RTL

Layout implemented against existing design system:

| Viewport | Behavior |
|---|---|
| **1440** | Dense operational Assets table |
| **768** | Table → cards breakpoint (`md`) |
| **390 / 360** | Compact cards; collapsible detail sections; ≥44px controls; bottom-nav padding |

Dark / Light: existing tokens. RTL with `dir="ltr"` / `public-mono` isolation for asset_code, IP, MAC, serial.

Artifacts under `Docs/inf1a-asset-experience-qa/` (live-api.json + viewport PNGs). Browser session for screenshots landed on a mismatched Phase1B workspace shell, but Asset Detail route mounts (`טוענים נכס…`). Authoritative functional proof:

- Live API list/get/patch on Q8-C site (`CAM-001`…`CAM-004`, IP patch)
- Unit/UI tests for list, detail, edit, readonly, legacy nulls

---

## 18. Focused tests

- Web INF-1A: **8 passed** (list/filter/warranty helper, panel, detail load/edit/readonly/legacy)
- SiteDossier: **3 passed** (incl. Assets tab)
- API INF-1 + Q8-C: **35 passed**
- Broader warranty/equipment/project/q8 filter: **68 passed**

---

## 19. Typecheck

`npm run web:typecheck` — pass.

---

## 20. Build

`npm run web:build` — pass.

---

## 21. Remaining Asset UX gaps

- No zone picker (no product zones list API wired)
- No firmware / technical extras (by design)
- Search is client-side within loaded site page (limit 100)
- Asset detail does not deep-link Site tab state on back (returns to site overview)
- Playwright screenshot set may be incomplete if login selectors drift — API + unit coverage remain authoritative

---

## 22. Readiness for INF-1B Network/IPAM

**INF-1A ready to close.** Site → Assets → Asset Detail is usable with provenance, warranty, and basic IP/MAC.

**INF-1B Network/IPAM not started.**

**STOP.**
