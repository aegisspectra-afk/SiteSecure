# V2 Threat Model

**Status:** Architecture-level threats for SITE SECURE V2  
**Controls:** [V2-RBAC.md](./V2-RBAC.md), [V2-RLS.md](./V2-RLS.md), [V2-API.md](../architecture/V2-API.md)

---

## 1. Assets

| Asset | Why it matters |
|-------|----------------|
| Customer PII, site addresses, gate codes | Privacy, physical security of customer sites |
| Equipment serials, IPs, MACs, panel IDs | Attack surface of installed systems |
| Quote costs and margins | Commercial confidentiality |
| Warranties and documents | Legal / customer trust |
| Auth sessions | Account takeover |
| Service role key | Full data plane bypass |
| Audit logs | Accountability |

---

## 2. Actors

- Authenticated member (various roles)
- Founding Technician (assigned, semi-trusted)
- Customer with public token
- Anonymous internet
- Insider (owner/admin)
- Compromised technician device (lost phone)
- Malicious client (modified mobile/web app)

---

## 3. Trust boundaries

```
[Browser / Phone]  --JWT-->  [FastAPI]  --user JWT-->  [Postgres RLS]
                              --service role-->        [Postgres]   (webhooks/cron only)
[Browser]          --anon key--> [Supabase Auth / Realtime / Storage signed]
```

The client is **untrusted**. All money, role, and tenant checks happen on the server and in RLS.

---

## 4. Key threats and mitigations

| Threat | Mitigation |
|--------|------------|
| Cross-tenant read/write | RLS + workspace in path + 404 masking |
| Privilege escalation via role string in body | Role only from memberships table |
| FT reads all quotes (V1 gap) | Assigned RLS on quotes/leads |
| Client-side quote total tampering | Server recalculate; ignore client totals |
| Public bucket enumeration | Private buckets; signed URLs; tokenized public API |
| Sequential site codes guessed | Public access by high-entropy token, not code alone |
| Service role in a client bundle | Never ship it; CI grep |
| Invite token theft | Hash at rest, expiry 14d, single accept |
| Lost technician phone | Remote logout (Supabase), wipe local DB on next lock, short-lived signed URLs |
| Offline replay / duplicate complete | Idempotency keys |
| Sync overwrite | Conflicts, not LWW |
| IDOR on `/customers/{id}` | RLS + authorize; id not enough |
| Realtime leaking rows | RLS on publications |
| Storage path traversal | API mints paths `{workspace_id}/...` only |
| XSS in Hebrew notes in PDF/HTML | Escape; PDF from structured templates |
| Email bombing invites | Rate limit + permission |
| Billing webhook forgery | Provider signature; service role only after verify |

---

## 5. Non-goals (yet)

- Formal STRIDE workshop with external pentest (Phase 16)
- Customer-hosted on-prem
- Zero-knowledge encryption of site notes (would break search/ops)

---

## 6. Incident expectations

Audit `audit_logs` for: invite, role change, quote approve, job assign, settings, plan change.  
Structured API logs with `request_id`. Do not log secrets.
