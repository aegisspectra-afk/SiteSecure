# SITE SECURE V2 — Target Information Architecture

**Status:** Binding target IA for authenticated `/app` navigation  
**Shell UX:** [V2-APP-SHELL.md](../ux/V2-APP-SHELL.md)  
**Web routes:** [V2-WEB.md](./V2-WEB.md)  
**Runtime nav:** `apps/web/src/lib/app-nav.ts` (`TARGET_IA` + live filter)  
**Security:** Sidebar / `can()` is UX only. Enforcement remains `authorize()` + RLS.

---

## 1. Product map rule

The sidebar is the **product map** of SITE SECURE — the lifecycle of a security-systems business — not a dump of whatever screens exist today.

```
לקוח → ליד → הצעת מחיר → אישור → פרויקט → אתר → התקנה → שירות → אחריות
```

**Lock the Target IA now.** Do not rebuild group structure every time a module ships.

**Ship only Live destinations.** If UI + API + RBAC + RLS + flow are incomplete, the item stays out of the sidebar. No “Coming Soon.” No fake routes.

---

## 2. Target sidebar (final structure)

```
SITE SECURE
SECURITY OPERATIONS PLATFORM

[ Workspace ]
שם הסביבה
Role · Plan

────────────────────

סקירה
  לוח בקרה
  היום
  יומן ומשימות

מכירות ולקוחות
  לקוחות
  לידים
  הצעות מחיר
  קטלוג

תפעול
  פרויקטים
  תיקי אתר
  קריאות שירות
  אחריות
  מודיעין טכני

ניהול
  צוות
  תפקידים והרשאות

מערכת
  אבטחה
  הגדרות

────────────────────

חיצוני
  ↗ אתר Aegis

[ User ]
שם · אימייל
```

### Group intent

| Group | Role in the business |
|-------|----------------------|
| **סקירה** | Command / day / calendar — what matters now |
| **מכירות ולקוחות** | Demand → quote → catalog |
| **תפעול** | Delivery after win — project, site dossier, service, warranty, technical intelligence |
| **ניהול** | People and RBAC |
| **מערכת** | Trust and workspace configuration |
| **חיצוני** | Brand / company site (Aegis) — not an app module |

### Module notes (target meaning)

| Item | Meaning |
|------|---------|
| לוח בקרה | Executive / Command Center |
| היום | Field-oriented day board (jobs, visits, service starts) |
| יומן ומשימות | Calendar, tasks, assignments, deadlines |
| לקוחות | Customer 360 — contacts, sites, quotes, activity |
| לידים | Funnel → won → customer |
| הצעות מחיר | CPQ loop: Create → Preview → Send → Portal → Approve/Reject |
| קטלוג | Products, SKU, cost/sell, categories, templates |
| פרויקטים | Quote approved → project (site, gear, techs, jobs, docs) |
| **תיקי אתר** | Single source of truth for a customer site (systems, equipment, visits, docs, warranty, service, history, technical intelligence). Prefer this label over bare “אתרים”. |
| קריאות שירות | Open → in progress → waiting → done; tied to customer → site → visit |
| אחריות | Coverage tied to equipment → site → customer |
| מודיעין טכני | Device/site technical knowledge — manuals, wiring, config, troubleshooting — not a generic KB dump |
| צוות | Members, invites, office/field seats |
| תפקידים והרשאות | RBAC catalog surface |
| אבטחה | Auth, RBAC posture, isolation, audit signals |
| הגדרות | Workspace / branding / quote defaults / notifications (sections grow when real) |

---

## 3. Explicitly out of the sidebar (for now)

Do **not** put these in Target IA primary nav — even as planned top-level groups — until a deliberate IA revision:

- מלאי / מחסן  
- חשבוניות / הנהלת חשבונות  
- דוחות מתקדמים  
- Billing  
- AI  
- API admin  
- Customer portal (tokenized `/p/*` is not sidebar CRM)

These may become Business / Enterprise capabilities later without bloating the core map.

---

## 4. Live vs Target (current production)

| Target item | Status |
|-------------|--------|
| לוח בקרה | **Live** (ops/sales/viewer homes) |
| היום | **Live** (field roles) |
| יומן ומשימות | Planned |
| לקוחות | Planned — **next IA investment after quote revenue loop** |
| לידים | Planned (after customers) |
| הצעות מחיר | **Live** |
| קטלוג | **Live** |
| פרויקטים | Planned |
| תיקי אתר | Planned — pair with customers (customer → site → quote → project → service → history) |
| קריאות שירות | Planned |
| אחריות | Planned |
| מודיעין טכני | Planned |
| צוות | **Live** (`/app/settings/users`) |
| תפקידים והרשאות | **Live** |
| אבטחה | **Live** |
| הגדרות | **Live** |
| אתר Aegis | **Live** (external) |

When a Planned module ships: add route + permission gate + set `status: "live"` in `TARGET_IA`. Do not invent a new group taxonomy.

---

## 5. Role-shaped views (UX only)

Same Target IA; different **visible** subsets via `can()` + features + live routes.

| Role | Typical Live spine (grows with modules) |
|------|----------------------------------------|
| Owner / Admin | Dashboard, sales, ops (when live), team, roles, security, settings |
| Sales | Dashboard, customers/leads/quotes/catalog (as live) |
| Technician | Today, calendar/tasks, projects/jobs, site files, service, technical intelligence (as live) |
| Viewer | Read-only destinations allowed by RBAC |

Hidden ≠ secured. Server `authorize()` and RLS remain mandatory.

---

## 6. Next build priority (after quote loop)

1. **לקוחות**  
2. **תיקי אתר** (with customer linkage)  
3. Then לידים / פרויקטים / שירות as the loop demands  

Do not open a full Sidebar of empty ops modules first.

---

## 7. Diagram

```text
                    SITE SECURE
                         │
        ┌────────────────┼────────────────┐
        │                │                │
      סקירה           מכירות            תפעול
        │                │                │
    Dashboard         לקוחות           פרויקטים
    Today             לידים            תיקי אתר
    Calendar          Quotes           שירות
                      Catalog           אחריות
                                        מודיעין
        │
        ├────────── ניהול
        │             │
        │           צוות
        │           RBAC
        │
        └────────── מערכת
                      │
                   אבטחה
                   הגדרות
```
