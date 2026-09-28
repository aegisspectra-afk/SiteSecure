# SaaS Phase 2 — Plan & Usage UI + Platform Admin Visibility

**Status:** SCOPED / NOT FULLY IMPLEMENTED in this pass  
**Depends on:** Phase 1 meters (`max_members`, `max_technicians`) + `GET …/usage`

## Already exists (reuse)

- Settings → Users: plan label + usage meters + invite capacity  
- Dashboard UsageSnapshot / threshold banner  
- Admin organizations: `plan_key` + subscription status columns

## Remaining for Phase 2 implementation

1. Settings IA: «חבילה וחיוב» + «שימוש ומכסות» (Hebrew RTL, truthful loading/error ≠ zero)  
2. Upgrade CTA: truthful “needs billing provider” / manage — **no fake checkout**  
3. Quota warning bands 80% / 95% / 100% on Settings Usage  
4. Admin: members/techs/storage used÷limit columns  
5. Audited plan override create/expire using `subscriptions.source` + `override_expires_at` + audit event

## Blockers

- Self-service upgrade blocked until billing provider decision (Phase 4)
