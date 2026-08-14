# V2 Row Level Security

**Status:** Mandatory data-plane isolation for SITE SECURE V2  
**Pairs with:** [V2-RBAC.md](./V2-RBAC.md), [V2-DATABASE-DESIGN.md](../database/V2-DATABASE-DESIGN.md)

RBAC decides *whether an action is allowed*.  
RLS decides *which rows exist for this JWT*.

A technician who is denied `quotes.approve` still must not **see** another workspace’s quotes, and must not see unassigned quotes in their own workspace.

---

## 1. Principles

1. RLS enabled on every tenant-owned table.
2. No `USING (true)` on tenant data. Service role bypasses RLS by design in Postgres — it is only used server-side.
3. Policies always include workspace membership.
4. Assignment-scoped roles get extra predicates, not instead of workspace checks.
5. Helper functions are `SECURITY DEFINER`, `SET search_path = public`, and grant `EXECUTE` to `authenticated` only as needed.
6. `anon` has no tenant table privileges.
7. Tests use two users in two workspaces as the acceptance bar.

---

## 2. Helper functions

All helpers read `auth.uid()`. They never trust a client-supplied `workspace_id` without checking membership.

| Function | Returns | Definition (intent) |
|----------|---------|---------------------|
| `auth_workspace_ids()` | set of uuid | memberships where `user_id = auth.uid()` and `status = 'active'` and workspace `status = 'active'` |
| `auth_is_member(workspace_id)` | boolean | id in `auth_workspace_ids()` |
| `auth_role(workspace_id)` | text | `role_key` or null |
| `auth_role_in(workspace_id, keys text[])` | boolean | current role in keys; **`founding_technician` matches `technician` lists** when the list includes technician (same V1 convenience, documented) |
| `auth_is_privileged(workspace_id)` | boolean | role in (`owner`, `administrator`) |
| `auth_is_managerial(workspace_id)` | boolean | privileged or `manager` |
| `auth_feature(workspace_id, feature_key)` | boolean | effective feature from plan ∪ overrides |
| `auth_assigned(workspace_id, resource_type, resource_id)` | boolean | row in `assignments` for this user |
| `auth_site_visible(workspace_id, site_id)` | boolean | see §3 |
| `auth_customer_visible(workspace_id, customer_id)` | boolean | privileged/managerial/sales-with-rules **or** any visible site of that customer |
| `auth_job_visible(workspace_id, job_id)` | boolean | managerial or assigned to job or its site |

`founding_technician` is **not** privileged. It uses assigned helpers only.

---

## 3. Site visibility (core of Model A)

`auth_site_visible(ws, site_id)` is true when:

1. User is member of `ws`, **and**
2. Either:
   - role scope is not `assigned` (owner, administrator, manager, viewer, sales — sales may still be tightened in API to owned customers), **or**
   - `auth_assigned(ws, 'site', site_id)`, **or**
   - assigned to a `job` / `project` / `service_call` whose `site_id` matches

Sales: RLS allows workspace-wide customer/lead/quote **read** if we keep sales scope `owned` only in the API for writes, **or** we add `owner_user_id = auth.uid() OR auth_is_managerial`. V2 chooses **API + RLS alignment for owned**:

- `leads` / `quotes` SELECT: managerial OR `owner_user_id = auth.uid()` OR (technician/FT AND related site visible)
- This closes V1’s gap where FT could still see all quotes at the RLS layer.

---

## 4. Policy pattern

Example shape for a typical table `sites`:

```sql
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites FORCE ROW LEVEL SECURITY;

CREATE POLICY sites_select ON sites
  FOR SELECT TO authenticated
  USING (auth_site_visible(workspace_id, id));

CREATE POLICY sites_insert ON sites
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_is_member(workspace_id)
    AND auth_role_in(workspace_id, ARRAY['owner','administrator','manager','technician','founding_technician'])
  );

CREATE POLICY sites_update ON sites
  FOR UPDATE TO authenticated
  USING (auth_site_visible(workspace_id, id))
  WITH CHECK (auth_site_visible(workspace_id, id));

CREATE POLICY sites_delete ON sites
  FOR DELETE TO authenticated
  USING (auth_is_privileged(workspace_id));
```

Fine-grained “can this role UPDATE” is duplicated in FastAPI. RLS here is **coarse but safe**: a viewer with `sites.view` can SELECT; viewer cannot INSERT (role list). If a viewer JWT hits PostgREST directly, they still cannot write.

**Defense in depth:** FastAPI uses the user JWT so these policies apply to API traffic too.

---

## 5. Table policy matrix (v2.0)

Legend: **W** = member of workspace; **P** = privileged (owner/admin); **M** = managerial (P+manager); **A** = assigned/visible helpers; **O** = owned (`owner_user_id`); **S** = self (`user_id = auth.uid()`).

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| profiles | S or same-workspace member (limited columns via view later) | trigger only | S | none |
| workspaces | W | authenticated (onboarding RPC/API only — prefer RPC `create_workspace`) | P | none (status update by owner) |
| workspace_memberships | W | P / invite-accept RPC | P | P (not last owner) |
| invitations | P | P | P | P |
| assignments | M or S | M | M | M |
| customers | `auth_customer_visible` | M, sales, FT | same as insert + visible | P |
| customer_contacts / notes / activities | via parent customer visible | same as customer edit | same | P / author |
| sites / zones / systems / equipment | `auth_site_visible` | site edit roles + visible parent | visible | P |
| documents | parent visible | upload permission roles + parent visible | author or M | P or author |
| leads | M or O | M or sales | M or O | P |
| products / categories / templates | W | M | M | P |
| quotes / items | M or O or (A via site) | M or sales | M or O or (FT edit + A) | P |
| quote_events / versions | same as quote | same as quote edit | none (append-only) | none |
| projects | M or A | M, tech, FT | M or A | P |
| jobs | `auth_job_visible` | M, tech, FT | visible | P |
| service_calls | M or A | M, tech, FT | visible | P |
| service_contracts | M | M | M | P |
| warranties | site visible | M, tech, FT | M | P |
| tasks | M or assignee | M, sales (own), tech | M or assignee | M |
| checklists / readiness / AAR | site/job visible | field roles | field roles | P |
| knowledge_articles | W | M | M | P |
| notifications | S | service / API | S (read_at) | S |
| audit_logs | P + `audit` feature | service / API | none | none |
| workspace_settings | W | P | P | none |
| subscriptions | P | service | service | none |
| roles / permissions | W (read) | none from clients | none | none |

Append-only tables (`audit_logs`, `quote_events`, `site_timeline_events`) have no UPDATE/DELETE policies for `authenticated`.

---

## 6. Storage policies

Buckets are **private**. Object path must start with `workspace_id/`.

```
authenticated SELECT/INSERT/UPDATE/DELETE
  USING ( auth_is_member( (storage.foldername(name))[1]::uuid ) )
```

Tighter: photos/signatures also require `auth_site_visible` when the following path segment is `sites/{site_id}/...`.

Signed URLs are the product path. Do not set buckets public to “make the app work”.

---

## 7. RPCs

`SECURITY DEFINER` RPCs are allowed only when:

- They assert membership (`auth_is_member`) **or**
- They are public-token functions with **no JWT**, returning a **narrow** view (`get_public_warranty(token)`, `get_public_site(token)`) without other tenants’ rows.

Public RPCs must:

- Take a high-entropy token, not a sequential code alone (code may be displayed; token authorizes)
- Rate-limit at API layer
- Not return cost, internal notes, or other customers

Prefer FastAPI public routes that use the service role **with a single-token lookup** over a zoo of definer functions — if SQL RPCs are used, they are listed here and tested.

Public **marketing** inquiries (contact/pilot) are not tokenized tenant rows and not `leads`. They must not be readable via workspace JWT. When that API exists, it is a SITE SECURE-operator resource, rate-limited, separate from RLS tenant policies.

Workspace creation: `create_workspace` definer RPC **or** API service-role insert after Auth. Either way: no silent create; explicit user action; creator becomes `owner`.

---

## 8. Explicit non-policies

| Anti-pattern | V2 |
|--------------|-----|
| `USING (true)` | Forbidden on tenant tables |
| Disable RLS for “admin debugging” | Forbidden |
| Platform super_admin bypass of tenant RLS | Forbidden (KEEP V1 ADR-002) |
| Policy only on SELECT, writes open | Forbidden |
| Relying on `auth.jwt() -> app_metadata.workspace_id` as the only check | Forbidden — membership table is source of truth |

---

## 9. Tests (SQL / pgTAP or API)

Critical:

1. User A (Workspace A owner) cannot `SELECT` Workspace B customers, sites, quotes, jobs, documents.
2. FT assigned to Site 1 cannot `SELECT` Site 2 in the same workspace.
3. FT cannot `SELECT` unassigned quotes.
4. Viewer cannot `INSERT` customers.
5. Technician cannot `UPDATE` `workspace_memberships`.
6. `anon` cannot `SELECT` customers.
7. After removing membership, previous JWT cannot read (membership status check).
8. Storage object in Workspace B path denied to Workspace A user.

Run these in CI against the migration-applied database.

---

## 10. V1 gaps this design closes

| V1 | V2 |
|----|----|
| FT RLS partial; quotes/leads/catalog company-wide | Assigned visibility on quotes/leads; catalog remains workspace-wide (price list is operational, costs hidden by API not RLS) |
| `invites` table not in 001 | `invitations` created in memberships migration |
| Some feature tables enabled RLS without policies | Every enable has policies in the same file |
| Public warranty PDFs | Private + tokenized access |
| Hybrid restored columns | Clean helpers from migration `0007` |
