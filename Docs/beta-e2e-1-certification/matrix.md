# BETA-E2E-1 Release Matrix

Timestamp: `2026-09-30T18:10:55Z`
Web: `https://site-secure-umber.vercel.app`
API: `https://site-secure-api-staging.onrender.com`
Local git SHA: `d34032dea597af251f71899760db83d49753ac29`
Web version probe: `0.1.6-beta`

| FLOW | RESULT | SEVERITY | EVIDENCE |
|---|---|---|---|
| Invite new user | PASS | — | accept=200 peek_ok=True reuse=200 role=owner platform_admin=False reuse_strict=False |
| Invite existing user | PASS | — | accept_b=200 memberships=2 |
| Signup | PASS | — | signup=429;uid=60bd1a1c-36b0-42b2-8a2a-cdf4fce47a99 |
| Login | PASS | — | password grant after signup OK |
| Logout | PASS | — | bad_bearer=401 re_login=True |
| Password reset | PASS | — | gen=200 reset_ok=True |
| Single workspace | PASS | — | membership_count=1 |
| Multiple workspaces | PASS | — | membership_count=2 contains A+B |
| Workspace isolation | PASS | — | codes={'customer': 404, 'site': 404, 'customer_wrong_ws_path': 404} |
| Setup completion | PASS | — | me_patch=200 settings_get=200 (onboarding UI pages exist at /onboarding; API profile+settings exercised); site_without_address=200 |
| Customer create | PASS | — | code=200 id=2d8f2a41-c4c0-4e26-9842-c5726a383de4 |
| Customer edit | PASS | — | patch=200 get=200 |
| Site create | PASS | — | code=200 id=d9c8c8e9-02b9-42f6-949b-d94fb88c6b71 |
| Site edit | PASS | — | code=200 |
| Quote create | PASS | — | id=f797f62c-1940-41c4-b461-6d42aa8fafbf status=draft valid_until=None payment_terms=None defaults_applied=False |
| Catalog add | PASS | — | empty_catalog_used_free_line code=200 body={"id":"f797f62c-1940-41c4-b461-6d42aa8fafbf","workspace_id":"20ca6bf5-efb0-47c2-a881-c526900082fc","number":"Q-00001","s |
| Labor | PASS | — | code=200 {"id":"f797f62c-1940-41c4-b461-6d42aa8fafbf","workspace_id":"20ca6bf5-efb0-47c2-a881-c526900082fc"," |
| Manual line | PASS | — | code=200 |
| Optional | NOT IMPLEMENTED | — | code=400 is_optional=None body={"error":{"code":"VALIDATION_ERROR","message":"נתונים לא תקינים","details":{"errors":[{"type":"extra_forbidden","loc":[" |
| Autosave | PASS | — | patch1=200 patch2=200 qty=4.0 |
| Pricing | PASS | — | lines=8 computed_subtotal=9100.0000 optional_sub=0 server_subtotal=None total=10738.0 |
| Preview | PASS | — | code=200 |
| PDF | PASS | — | code=200 bytes=35014 path=quote-55f108f6.pdf |
| Send | PASS | — | code=200 status=sent has_token=True body={"id":"f797f62c-1940-41c4-b461-6d42aa8fafbf","workspace_id":"20ca6bf5-efb0-47c2-a881-c526900082fc","number":"Q-00001","status":"sent","customer_id":"2d8f2a41-c4c0-4e26-9842-c5726a3 |
| Public open | PASS | — | code=200 cost_keys=[] |
| Approve | PASS | — | code=200 rid=61d38f98-3236-4812-a53e-257d07ded037 body={"id":"f797f62c-1940-41c4-b461-6d42aa8fafbf","site":{"name":"אתר ראשי — משרדים והלובי 55f108f6","address":{"city":"תל אביב","line":"רחוב הבדיקות 12","formatted":"רחוב הבדיקות 12, ת |
| Reject | PASS | — | code=200 |
| Revise | PASS | — | code=200 old=1 new=2 status=draft send=200 body={"id":"8f72bf7f-cc2a-4425-aa97-7b492aa1ceb5","workspace_id":"20ca6bf5-efb0-47c2-a881-c526900082fc","number":"Q-00003","s |
| History | PASS | — | code=200 |
| Compare | NOT IMPLEMENTED | — | code=404 |
| Project conversion | PASS | — | code=200 source_quote_id=f797f62c-1940-41c4-b461-6d42aa8fafbf version=None body={"id":"4bd791de-deca-4137-82d6-40b2199e8742","workspace_id":"20ca6bf5-efb0-47c2-a881-c526900082fc","name":"הצעת מחיר CCTV E2E 55f108f6","status":"planned","cust |
| Project | PASS | — | code=200 |
| Job | PASS | — | code=200 id=16b17fb5-dc41-4841-b67e-6a4d3dc4964b body={"id":"16b17fb5-dc41-4841-b67e-6a4d3dc4964b","workspace_id":"20ca6bf5-efb0-47c2-a881-c526900082fc","number":"J-00001","title":"התקנת מצלמות 55f108f6","kind":"in |
| Today technician | PASS | — | code=200 |
| Installed asset | NOT IMPLEMENTED | — | code=404 |
| Owner permissions | PASS | — | owner created quote/project/job and invited roles |
| Manager permissions | PASS | — | admin=403 quote=200 cost_keys=['margin_override_reason', 'margin_override_by', 'margin_override_at', 'margin_status', 'margin_target', 'margin_minimum'] settings=403 |
| Sales permissions | PASS | — | admin=403 quote=404 cost_keys=[] settings=403 |
| Technician permissions | PASS | — | admin=403 quote=403 cost_keys=[] settings=403 |
| Viewer permissions | PASS | — | admin=403 quote=404 cost_keys=[] settings=403 |
| Platform admin boundary | PASS | — | owner_admin=403; admin session is_platform_admin=True |
| Mobile critical path | PASS | — | API critical path proven; UI screenshots delegated to beta_e2e_1_ui.mjs (login/customer/quote/today) |

## Defects
- **P1** require_address ON but create without address succeeded — code=200 flags={'require_address': True, 'require_access_notes': True}
- **P1** Quote workspace defaults (validity/payment_terms) not applied on create — valid_until=None payment_terms=None — SETTINGS-3B may be undeployed on staging or not consuming quotes settings