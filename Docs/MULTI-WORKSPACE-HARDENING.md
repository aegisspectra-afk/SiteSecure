# Multi-Workspace Hardening — Discovery

**Status:** CURRENT LIMITATION documented · switcher NOT built

## Finding

Authenticated AppShell and most feature surfaces use `session.memberships[0]` (~56 call sites under `apps/web/src`).  
`profiles.last_workspace_id` exists and invite accept updates it, but the client does not consistently treat active workspace as an explicit, server-verified selection.

## Product policy (current cohort)

Prefer **one operational workspace** per Founding Technician / external user.

## Target architecture (future)

```
user → memberships[] → active_workspace_id (UX state)
server verifies membership for every workspace-scoped request
```

Client-selected workspace ID is never security authority.

## Smallest safe next steps (when prioritized)

1. Inventory all `memberships[0]` call sites with severity  
2. Session contract: ordered memberships + `active_workspace_id` echo  
3. Single “active workspace” setter with membership check  
4. AppShell consumer migration  
5. Deny cross-workspace ID tampering tests

Do not fold a full switcher rewrite into SaaS entitlements work.
