# V2 Mobile Architecture

**Status:** Native-capable field client  
**Package:** `apps/mobile` — Expo + React Native + TypeScript  
**Same platform as web:** same FastAPI, Supabase Auth user, workspace, RBAC catalog, RLS, storage, notifications. A technician who signed up on Public Web → `/register` uses this app with that same account.

Mobile is **not** a shrunk dashboard. It is the technician’s workbench.

---

## 1. Primary users

Technician and Founding Technician.  
Managers may log in to assign/check, but IA is optimized for field completion.

---

## 2. Stack

| Layer | Choice |
|-------|--------|
| Runtime | Expo (dev client when native modules require it) |
| Nav | Expo Router |
| Server state | TanStack Query |
| Local DB | Expo SQLite |
| Sync | Outbox + `/api/v1/sync` (see [V2-OFFLINE-SYNC.md](../mobile/V2-OFFLINE-SYNC.md)) |
| Auth | Supabase Auth (secure store for session) |
| HTTP | `packages/api-client` |
| UI | Shared tokens from `packages/design-system` adapted to RN |
| Icons | Lucide React Native |
| Maps | Deep link Waze/Google Maps (do not build a map product in v2.0) |

---

## 3. Navigation (priority)

Tab bar (RTL-aware). Items appear only when the module exists **and** `can(permission)`:

1. **היום (Today)** — default. Next job, start/navigate.  
2. **עבודות (Jobs)** — assigned list, filters: today / week / open  
3. **אתרים (Sites)** — assigned site files  
4. **לקוחות (Customers)** — assigned customers (field list/peek, not the desktop 360 clone)  
5. **שירות (Service)** — when service-call API/UI exists  
6. **התראות**  
7. **פרופיל**

If the tab bar cannot hold all items honestly, **התראות** and **שירות** may sit behind עוד — Today, Jobs, Sites, Customers stay first. Do not add a marketing/landing tab.

Customer **360, leads, quotes** remain authenticated **web** CRM ([V2-CRM-SPEC.md](../ux/V2-CRM-SPEC.md)). Mobile Customers is assigned field access to the same `customers` rows.

Secondary (not tabs): Service call create as a follow-up from a job, Knowledge (later).

The **primary action** on Today is a single obvious button: Start job / Navigate / Complete — whichever is next.

---

## 4. Core workflow (minimal taps)

```
Today → open job
  → Navigate (external maps)
  → Start
  → Checklist
  → Notes
  → Photos
  → Equipment (scan/add)
  → Customer signature
  → Complete
  → optional follow-up task / AAR
```

If offline, the same flow writes locally and shows Sync status (pending / failed / synced). Never a silent success.

---

## 5. Today screen contract

Primary: current / next job (customer, site, time, address, phone).  
Secondary: remaining jobs today as a short list.  
Supporting: sync state, overdue count.

Not: company-wide KPIs, quote margins, billing.

---

## 6. Site File on mobile

Read-optimized dossier: overview, systems, equipment, last service, documents, capture photo.

Editing is in-context (add equipment during a job), not a desktop settings clone.

---

## 7. Security on device

- Session in OS secure storage
- SQLite not world-readable; consider SQLCipher in Phase 16 if threat model requires
- Photos queued encrypted at rest if feasible; otherwise OS app sandbox + delete after confirmed upload
- No service role, no other tenants’ cache
- On logout / workspace switch: drop local DB for the previous tenant

---

## 8. Push

Architecture: `devices` registration table (Phase 12) with platform token.  
API fans out `JOB_ASSIGNED` etc.  
Until then, in-app + pull on foreground is acceptable.

---

## 9. What mobile will not do in v2.0

- Full quote builder (may **view** an assigned quote PDF)
- User admin / billing
- Inventory stocktakes (unless Phase 11 explicitly adds a field consume-from-job flow)
- Public marketing website (that is [V2-PUBLIC-WEB.md](./V2-PUBLIC-WEB.md) on the SITE SECURE origin)
- Desktop Customer 360 / leads pipeline (web CRM)

---

## 10. Testing

- Unit: job state machine helpers, sync merger
- Workflow: start → checklist → photo → signature → complete (offline then online)
- Isolation: cached Workspace A data gone after switch
