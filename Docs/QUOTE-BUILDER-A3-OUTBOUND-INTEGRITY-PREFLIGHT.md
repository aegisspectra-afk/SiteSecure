# QUOTE BUILDER — A3 OUTBOUND INTEGRITY PREFLIGHT

**Date:** 2026-09-22  
**Mode:** RESEARCH + IMPLEMENTATION PLAN ONLY  
**Product code changed:** ZERO  
**Artifact:** this document only

Locked product semantics for future A3:

| Action | Meaning |
|---|---|
| **PREVIEW** | Internal/staff inspection of current draft — no publication, no lifecycle transition |
| **SHARE** | VIEW only — no formal approval publication; recipient must not approve/reject |
| **SEND** | Formal publication — validate → immutable sent snapshot/version → customer may DECIDE |

Rule: **SHARE = VIEW. SEND = DECIDE.**

Once formally sent, that version is immutable customer truth. For the same sent version: Public View = Public PDF = Staff PDF = same snapshot.

---

## 1. Executive finding

The current code **does not** implement the locked Share/Send/snapshot contracts.

Critical contradictions already present in production logic:

1. **Draft Share can become formal Send without staff `/send`.**  
   Public `GET /{token}` with `mark_viewed=True` promotes `draft → sent` (“public_first_open”), then `sent → viewed`.

2. **After that promotion, the same Share token can approve/reject.**  
   `can_approve` / `can_reject` are true whenever live status ∈ `{sent, viewed}` and token version matches. There is **no** “formal Send required” flag.

3. **Staff PDF ≠ public PDF for non-draft states.**  
   Public path reads `quote_versions.snapshot.public`. Staff PDF rebuilds from **live** items/totals and only freezes company (and optionally PDF template) from the snapshot.

4. **Share-then-edit-then-open creates split truth.**  
   Share freezes a version snapshot; staff may still edit the draft; customer open promotes lifecycle while continuing to show the older snapshot; staff PDF then uses live lines + frozen company → **three different truths**.

5. **Send is not concurrency-safe.**  
   `/send` patches status without `status=eq.draft` optimistic guard and always mints a **new** token without revoking prior access rows.

**Recommended A3 posture:** minimal server enforcement first (remove draft promotion; gate decisions on formal Send-origin status; align staff PDF to snapshot for non-draft), then small idempotency guard on Send. **No migration required** for the minimum safe path.

**Overall A3 risk if implemented carefully:** **HIGH** (touches public lifecycle + PDF truth). Current *status quo* risk to product integrity: **CRITICAL**.

> **A3 implemented 2026-09-22** — see `Docs/QUOTE-BUILDER-UNIFIED-INTERACTION-ARCHITECTURE.md` § IMPLEMENTATION PASS A3. Findings above remain the pre-fix research record.

---

## 2. Current Preview behavior

### Staff surfaces

| Surface | Path | Publication? | Lifecycle mutation? |
|---|---|---|---|
| Live preview pane in QuoteBuilder | Client-side `QuoteDocument` from live quote | No | No |
| Route `/app/quotes/$quoteId/preview` | Staff UI; loads quote + can also Share/PDF/WhatsApp | Preview itself no; Share actions yes | Via Share/open only |
| API `GET …/quotes/{id}/preview` | Alias of document payload (`preview_quote` → `_document_payload`) | No | No |
| API `GET …/quotes/{id}/document` (CPQ) | Same `_document_payload` pattern | No | No |

Preview is **not** a public token. It is authenticated `quotes.view` and uses the **staff document path** (live lines; company freeze rules below).

### Product gap

UI copy for Share still says “צפייה ואישור הלקוח” (`quoteShareDialogLead`), blurring Preview/Share/Send.

---

## 3. Current Share behavior

### End-to-end chain

```
QuoteBuilder / preview route
  → api.shareQuote (POST …/quotes/{id}/share)
  → share_quote()
  → require(quotes.send)  [capability; draft also resource-state draft]
  → _prepare_share_link(require_complete=True if draft)
       → _persist_totals
       → validate_for_send (draft only)
       → _upsert_version_snapshot(snapshot_status="draft"|current)
       → new_public_token() + _mint_access (quote_public_access)
  → returns public_url / public_token; status unchanged; auto_sent=false
  → customer opens /q/{token} → GET /api/v1/public/quotes/{token}
       → _assemble(mark_viewed=True)
       → **if status==draft: patch → sent** (public_first_open)
       → if status==sent: patch → viewed
       → can_approve/can_reject = status ∈ {sent, viewed} && !superseded
  → POST …/approve | …/reject allowed when status ∈ {sent, viewed}
```

WhatsApp / mailto / Share dialog all mint via the same `shareQuote` API (or reuse minted URL). They do **not** call `/send`.

### Answers to Part 1 questions

| # | Question | Answer |
|---|---|---|
| 1 | Can Share mint while quote remains draft? | **Yes.** Explicit draft branch in `share_quote`. |
| 2 | Status/version/snapshot for that token? | Live status stays **draft** at mint time. Token stores `version = quote.version`. Snapshot upserted with `snapshot.status = "draft"` under `quote_versions` for that version. |
| 3 | Can Share token reach approve/reject? | **Yes, after first customer GET open** (promotes to sent/viewed). Direct approve while still draft fails (`status not in DECISION_STATES`). |
| 4 | Server validation that allows it? | `_assemble` draft→sent promotion; then `approve_public_quote` / `reject_public_quote` only require `status ∈ {sent, viewed}` + version match — **not** “staff called /send”. |
| 5 | Does opening Share change status? | **Yes:** draft→sent (event `sent`, audit `quotes.send_public`), then sent→viewed. |
| 6 | Can viewing shared draft cause draft→sent/viewed? | **Yes.** That is the intentional `public_first_open` path today. |
| 7 | Approval/reject without staff Send? | **Yes**, via Share + open (+ decide). |
| 8 | Staff edits after Share before Send? | Allowed while still draft (`quotes.edit` only for draft). Snapshot from Share is **not** auto-refreshed on edit. Customer still sees Share-time snapshot until Share/Send upserts again. |
| 9 | Recipient sees live / snapshot / mixed? | **Document body = version snapshot.public.** Lifecycle fields (`status`, `can_approve`, …) come from **live quote** + access version. Mixed path. |
| 10 | Tokens after Send / Revise / re-Share / reject / approve? | **Send/Share remint:** new access row; **old tokens not revoked** (unless `revoke-link`). **Revise:** version++; old token `superseded=true`, view snapshot of old version, cannot decide. **Approve/reject:** status terminal; `can_decide=false`. |
| 11 | Same token mechanism as Send? | **Yes.** Same `quote_public_access` + `hash_public_token` + public routes. |
| 12 | Tests defining behavior? | `test_quote_share_truth.py` (draft Share allowed; must not mark sent **in share_quote itself**). `test_quote_item_sku_and_share_policy.py`. `test_public_quote_boundary.py` (token binding). **No test asserts “Share open must not promote” or “Share cannot approve”.** Docstring of `share_quote` even acknowledges “or customer first-open promotion”. |

---

## 4. Current Send behavior

### Order of operations (`_transition_to_sent`)

1. `require(quotes.send)` with resource state **must be draft** (`QUOTE_SENDABLE = {draft}`).
2. Load items → `_persist_totals` (server pricing.recalculate).
3. `validate_for_send` → `QUOTE_INCOMPLETE` if gaps (advisories never block).
4. `_upsert_version_snapshot(..., snapshot_status="sent")` for **current** `quote.version`.
5. Patch quote `{status: sent, sent_at: now}` — **no `status=eq.draft` filter**.
6. `new_public_token()` + `_mint_access` (does **not** revoke prior tokens).
7. Event `sent` + audit `quotes.send`.

### Mutation after send

- `quotes.edit` denied unless status ∈ `{draft}` → lines locked after send/viewed/approved/…
- Changes require `revise` → new draft version, clears sent/viewed/approved fields.

### Concurrency / idempotency weakness

| Scenario | Effect today |
|---|---|
| Double-click `/send` while draft | Both may succeed; two tokens; snapshot written twice; status sent |
| Retry after success | Second call: `quotes.send` with resource state `sent` → **RESOURCE_STATE** deny (good) |
| Two tabs concurrent | Race: both see draft; both mint; no single-winner guard |
| Remint via Share after send | Allowed (`SHAREABLE_STATES`); refreshes snapshot from **live** (locked, so usually same); new token; old tokens remain |

Repeated Send after success is blocked by authz state — but **first concurrent wave is not idempotent**.

---

## 5. Current token model

| Field (conceptual) | Source |
|---|---|
| Table | `quote_public_access` |
| Binding | `workspace_id`, `quote_id`, `version`, `token_hash`, `expires_at`, `revoked_at` |
| Mint | `_mint_access` on Share and Send |
| Hash | `hash_public_token` |
| URL | `{web_public_url}/q/{token}` |
| Purpose / channel | **None** — no `purpose`, `kind`, or `origin` column |
| Revoke | `POST …/revoke-link` sets `revoked_at` on all active rows for quote |

Supersession = `access.version != live quote.version` (after revise).

---

## 6. Current customer approval gate

### Decision gate (`public_quotes.py`)

```text
DECISION_STATES = {sent, viewed}

can_decide = (!superseded) && (live_status ∈ DECISION_STATES)

approve/reject additionally require:
  - version match
  - status ∈ DECISION_STATES (optimistic patch filter)
  - approve: terms_accepted + name + signature data URL
```

### Does “only formally sent version may decide” exist?

**No.** Formal Send and Share-open-promotion both produce `sent`/`viewed`. The gate cannot distinguish them.

### Exact path: Share token → approval without staff Send

1. Staff `POST /share` on draft (complete quote) → token T, snapshot draft, status still draft.  
2. Customer `GET /public/quotes/T` → status becomes **sent** then **viewed**.  
3. UI shows `can_approve=true`.  
4. Customer `POST /T/approve` with signature → **approved**.

UI hiding cannot stop this; it is server-authorized.

---

## 7. Current snapshot / version model

| Concept | Behavior |
|---|---|
| Version integer | On quote row; increments on **revise** only |
| `quote_versions` row | One per (quote_id, version); holds `snapshot` JSON |
| Upsert timing | Share (`_prepare_share_link`) and Send (`_transition_to_sent`) |
| Snapshot contents | `version_snapshot` → `{status, quote, items, sections, public}` where `public` is customer document via `public_payload` |
| Draft Share freeze company? | `freeze_company = status not in {draft}` → **false** for draft Share |
| Sent freeze company? | **true** |
| Public read | Always `_public_from_version(access.version)` — never live lines |
| Overwrite | Re-Share / Send **patches** existing version snapshot in place |

Historical versions remain after revise; public old tokens still resolve old snapshots as superseded views.

---

## 8. Current staff PDF behavior

Path:

```text
api.downloadQuotePdf
→ GET …/quotes/{id}/pdf  (quote_cpq.quote_pdf)
→ _document_payload(client, workspace, quote, live_items)
→ render_quote_pdf(document)
```

### `_document_payload` truth source by status

| Status | Lines / totals | Company | PDF template |
|---|---|---|---|
| **draft** | **Live** items via `public_payload` | Live workspace/branding | Current default template |
| **sent** | **Live** items | Frozen from `quote_versions[version].snapshot.public` company(_snapshot) if present | Frozen template if present else current default |
| **viewed** | Live | Frozen as above | Frozen / default |
| **approved** | Live | Frozen as above | Frozen / default |
| **rejected** | Live | Frozen as above | Frozen / default |
| **expired** | Live | Frozen as above | Frozen / default |
| **cancelled / superseded draft after revise** | Live (new draft version) | Live (draft rules) | Live |

Staff PDF never takes a `version` query param. It always means **“PDF of current quote row + live items”**, with partial freeze for non-draft.

Staff-only fields: costs/margins stripped before render in `quote_pdf` handler (`cost_total`, etc. popped). Snapshot public path also excludes cost. **No intentional staff-only commercial fields in PDF.**

### Can renderer render full snapshot today?

**Yes.** Public PDF already does: `_assemble` → `snapshot.public` → `render_quote_pdf`. Staff PDF can call the same payload source for non-draft without PDF renderer changes.

### Would snapshot staff PDF remove legitimate content?

Unlikely for customer document parity. Risk: if live post-send mutations somehow existed they would disappear — but edits are already blocked; any divergence today is a **bug**, not a feature. Payment terms / branding / template are already intended to freeze in snapshot at Share/Send.

### Historical version staff PDF?

`GET …/versions/compare` exists; **no** `GET …/versions/{n}/pdf`. Do not invent history UI in A3 — only align **current** non-draft staff PDF to current version snapshot.

---

## 9. Current public PDF behavior

```text
GET /api/v1/public/quotes/{token}/pdf
→ _assemble(mark_viewed=False)   # does NOT promote draft→sent
→ strip cost fields
→ render_quote_pdf(snapshot.public)
```

Public PDF uses **immutable snapshot for access.version**. Opening PDF alone does not promote draft (unlike GET JSON with `mark_viewed=True`).

---

## 10. Share vs Send contradiction map

| Concern | Share today | Send today | Locked product |
|---|---|---|---|
| Marks sent at mint? | No | Yes | Send only |
| Marks sent on open? | **Yes (draft)** | N/A | **Must not** for Share |
| Creates snapshot? | Yes (draft or current) | Yes (sent) | Send = formal immutable; Share may freeze view-only |
| Allows approve? | **Yes after open** | Yes | **Send only** |
| Authz mint | `quotes.send` | `quotes.send` | OK to keep capability; semantics differ |
| UI copy | Implies approval | Formal send | Must diverge |

`share_quote` docstring claims mint does not mark sent, but **public route undoes that product claim**.

---

## 11. Staff / public PDF contradiction map

| State | Public View/PDF | Staff PDF | Same document? |
|---|---|---|---|
| Draft | N/A (or draft Share snapshot if token) | Live | N/A / possibly divergent if Share snapshot stale |
| Sent (clean Send, no later edit) | Snapshot at Send | Live lines ≈ snapshot + frozen company | **Usually similar, not guaranteed identical** |
| Sent after Share→edit→open | Snapshot at Share | Live post-edit lines + frozen company from snapshot | **No — material divergence** |
| Approved / rejected | Snapshot (+ approval freeze on version) | Live + frozen company | **Can diverge** if anything drifted |
| After revise (new draft) | Old token → old snapshot superseded | New draft live | Correctly different generations |

---

## 12. Target Share contract

**SHARE = VIEW ONLY.**

Minimum product rules:

1. Minting Share must not set `sent` / `viewed` / `approved`.
2. Opening Share must not set `sent` / `viewed`.
3. Share recipient must receive `can_approve=false` and `can_reject=false` while quote was never formally Sent (status remains `draft`, or a future explicit share-purpose token).
4. Share may still upsert a **view snapshot** so the link is stable while staff edits (define behavior: either refresh-on-share-only, or optionally refresh — recommend **snapshot at last Share**, edits not visible until re-Share; document in UX).
5. Share must not be an authz bypass: keep `quotes.send` (or later split permission) + completeness rules as product decides.
6. After formal Send, reminting a link is “share of sent proposal” — still view; decisions already gated by status (approve only while sent/viewed).

### Architecture recommendation (smallest safe)

**Option C — existing token model + server status enforcement** (primary).

Optional later (not required for A3 minimum): Option A purpose column on `quote_public_access`.

**Reject for A3 minimum:** Option B separate preview token table (larger surface, migration).

**Exact minimum server changes (design only):**

1. **Delete / disable** `draft → sent` promotion in `_assemble`.  
2. Keep `sent → viewed` only when status is already formally `sent`.  
3. Ensure `can_decide` remains `status ∈ {sent, viewed}` only — with (1), draft Share tokens never become decidable.  
4. Update Share UI copy to “view only”, not approval.  
5. Tests that fail today become the A3 contract tests.

**Migration required for minimum?** **No.**

---

## 13. Target Send contract

SEND remains the **only** transition draft→sent:

1. Validate readiness (`validate_for_send`).
2. Recalculate totals.
3. Upsert immutable snapshot with `snapshot_status="sent"` for current version.
4. Patch status to `sent` with **optimistic `status=eq.draft`**.
5. Mint token (recommend: revoke prior draft-share tokens for that quote/version **or** leave them view-only — prefer revoke-or-supersede draft-origin tokens once formally sent to avoid dual links; see §16).
6. Customer may view → viewed → approve/reject that version.

Revise remains the only path back to editable draft + new version.

---

## 14. Target immutable-version contract

For a given formally sent `version` N:

| Consumer | Source of truth |
|---|---|
| Public GET | `quote_versions[N].snapshot.public` |
| Public PDF | same |
| Staff PDF (while live quote.version == N and status non-draft) | **same snapshot.public** |
| After revise to N+1 draft | Staff PDF of current quote = live draft; public old tokens still N snapshot |

No silent live-line drift for staff PDF while referring to sent version N.

---

## 15. Minimum safe implementation design

### A3 proposed boundaries (ordered)

**A3a — Approval gate integrity (CRITICAL)**  
- Remove `public_first_open` draft→sent in `public_quotes._assemble`.  
- Add/adjust tests: draft Share open leaves status draft; `can_approve=false`; approve 403.  
- Copy fixes: Share dialog lead / outcomes.

**A3b — Staff PDF snapshot alignment (HIGH)**  
- In `_document_payload` or `quote_pdf`: if status ∉ `{draft}`, return `snapshot.public` for `quote.version` when present; else fall back to current hybrid (legacy).  
- Prefer full snapshot payload over live items.  
- Draft unchanged (live).

**A3c — Send idempotency (MEDIUM–HIGH)**  
- Patch send with `status=eq.draft`; if no row, reload and return stable already-sent response (existing token remint policy explicit).  
- Optionally revoke non-revoked access rows before mint on successful Send.

**A3d — Snapshot refresh policy clarity (MEDIUM)**  
- Document: draft Share snapshot is last Share upsert; edits invisible to Share until re-Share.  
- Optionally: on draft Share, always refresh snapshot (already does).  
- Do **not** refresh sent snapshot from Share remint without product confirmation (today Share remint after send **does** overwrite snapshot from live — lock sends already, but A3 should freeze overwrite after first sent snapshot unless explicit remint policy).

### Not in A3

- New System Builders, pricing, CCTV, VAT, section discounts, QuoteBuilder refactor  
- New history PDF UI  
- Generic idempotency platform  
- Authz catalog redesign (`quotes.share` permission) unless needed later  
- DB migration for token purpose (optional follow-up)

---

## 16. Send idempotency design

**Smallest server guard:**

```text
PATCH quotes SET status=sent, sent_at=now
WHERE id=… AND workspace_id=… AND status=eq.draft

if no row updated:
  reload quote
  if status in {sent, viewed, approved, …}:
    return existing public access for current version (or remint once under clear policy)
  else:
    error
```

Also:

- Wrap snapshot upsert + status patch + mint in a clear order; on race, loser takes idempotent return path.  
- Consider revoking previous access rows for the quote when formal Send succeeds so only the Send token is current (Share draft tokens die). **Compatibility note:** old draft Share URLs would 404 after Send — usually desirable under SHARE≠SEND.

No distributed idempotency keys required for v1.

---

## 17. Backward compatibility

| Population | Impact of A3a (remove promotion) | Impact of A3b (staff PDF snapshot) |
|---|---|---|
| Already formally Sent/Viewed/Approved/Rejected | Unchanged decision gate | Staff PDF may **change** to match public snapshot (intended fix) |
| Draft Share tokens never opened | Remain view-only; **lose** accidental approval path | N/A |
| Draft Share tokens already opened (now sent/viewed without staff Send) | Already in lifecycle; behave as sent quotes | Staff PDF alignment applies |
| Revised quotes / old tokens | Superseded behavior preserved | Historical tokens unchanged |
| Existing snapshots | Reused; no migration | Read path change only |
| Clients checking `auto_sent` | Already always false on Share response | — |

**Do not** mass-revoke historical approved proposals.  
**Do** accept that “Share used as Send” workflows break by design — that is the product correction.

---

## 18. Security / authz considerations

| Control | Preserve |
|---|---|
| `quotes.send` for mint Share/Send | Yes (or split later) |
| `quotes.view` for staff preview/PDF | Yes |
| Token hash lookup | Yes |
| Workspace + quote binding on access row | Yes |
| Version supersession | Yes |
| Expiry via `expires_at` / `valid_until` → expired | Yes |
| Cost/margin never on public/PDF | Yes (keep strip + public_payload) |
| RLS / service client boundaries | Do not widen service writes beyond current patterns |
| Share as bypass | Removing promotion **reduces** bypass; do not add weaker gates |

Customer approval remains server-authoritative; A3 must keep signature/terms checks.

---

## 19. Exact future files likely to change

| File | Likely A3 touch |
|---|---|
| `apps/api/app/routers/public_quotes.py` | Remove draft→sent; tests for view-only Share |
| `apps/api/app/routers/quotes.py` | Send optimistic status guard; optional revoke-on-send; Share docstring |
| `apps/api/app/routers/quote_cpq.py` | Staff PDF source selection (or via shared `_document_payload`) |
| `apps/api/app/quote_snapshot.py` | Possibly helper “staff_document_from_version” — only if needed |
| `apps/web/src/i18n/he.ts` | Share copy (view ≠ approve) |
| `apps/web/src/components/quotes/QuoteShareDialog.tsx` | Copy / hints |
| `apps/web/src/components/quotes/QuoteBuilder.tsx` | Outcome strings only if needed |
| `apps/api/tests/test_public_quote_*.py` / new integrity tests | Contract tests |
| `apps/api/tests/test_quote_share_truth.py` | Extend to open-must-not-promote |
| `Docs/…` | A3 implementation report |

**Unlikely / do not touch in A3:** `pricing.py`, CCTV, authz catalog (unless send guard needs it), migrations (minimum path), RLS SQL.

---

## 20. Exact regression test plan

### SHARE

- [ ] Draft Share mints token; quote status remains `draft`.
- [ ] `GET` public JSON on draft Share: status stays draft (or explicit non-decision state); `can_approve=false`, `can_reject=false`.
- [ ] `POST` approve/reject on draft Share token → 403 RESOURCE_STATE.
- [ ] Public PDF on draft Share does not promote status.
- [ ] Staff may still `quotes.edit` after Share (still draft).
- [ ] After edit, public Share view still shows last Share snapshot until re-Share (assert frozen description/total).
- [ ] Re-Share refreshes draft snapshot.

### SEND

- [ ] Send from draft → status sent; snapshot status sent; token works; `can_approve=true` after open→viewed path.
- [ ] Readiness gaps still block Send.
- [ ] Concurrent/double Send: only one transition; stable response; no duplicate lifecycle events storm (or second is idempotent).
- [ ] After Send, edit denied; revise required.

### SNAPSHOT / PDF

- [ ] Sent public view totals/lines == snapshot.public.
- [ ] Sent public PDF body matches snapshot.public fields.
- [ ] Sent staff PDF body matches same snapshot.public (not divergent live lines).
- [ ] Simulate impossible live drift (test double) → staff PDF still snapshot if implemented.

### REVISE

- [ ] Revise → draft version+1; old token superseded; old snapshot intact.
- [ ] New Send → new snapshot for new version; decisions on new token only.

### AUTHZ

- [ ] Public payload never includes cost/margin.
- [ ] Cross-workspace token hash cannot load other tenant quote.
- [ ] Share mint still requires `quotes.send`.
- [ ] Draft Share cannot escalate to approve without Send.

---

## 21. Risk map

| Change | Risk | Why |
|---|---|---|
| Remove `public_first_open` | **CRITICAL → intended** | Breaks workflows that used Share as Send; correct per lock |
| Gate approve on formal Send only (via status) | **HIGH** | Depends on promotion removal; simple if status stays draft |
| Staff PDF full snapshot | **HIGH** | Changes PDF bytes for existing sent quotes if live≠snapshot |
| Send `status=eq.draft` guard | **MEDIUM** | Behavior change under concurrency; safer |
| Revoke tokens on Send | **MEDIUM** | Old Share URLs die; usually good |
| Token purpose column / migration | **HIGH** (scope) | Avoid in minimum A3 |
| Touch `pricing.py` / CCTV / RLS | **CRITICAL** | Out of bounds — do not |
| UI copy only | **LOW** | Needed but insufficient alone |

---

## 22. Blockers / migrations

| Item | Blocker? |
|---|---|
| Product confirmation that Share-as-Send must break | Soft blocker — already locked in this brief |
| DB migration for minimum Share/PDF/idempotency | **Not required** |
| Optional `quote_public_access.purpose` | Future; not needed if status enforcement enough |
| Backfill staff PDF | None — read-time switch to snapshot |
| Existing promoted-via-Share quotes | Treat as already sent; no automatic downgrade |

---

## 23. Recommended A3 implementation boundaries

**In scope for A3**

1. Server: stop draft Share open from formalizing Send.  
2. Server: keep approve/reject only for formally sent/viewed (consequence of 1).  
3. Server: staff PDF for non-draft current version = snapshot.public when available.  
4. Server: Send optimistic concurrency / idempotent already-sent handling.  
5. Web: Share terminology = view-only (no approval promise).  
6. Tests: all scenarios in §20 that protect the above.  
7. Doc: A3 implementation report appended to interaction architecture or sibling.

**Out of scope for A3**

- Share permission split, token purpose migration  
- Historical version PDF UI  
- Pricing, CCTV, authz engine redesign, RLS, QuoteBuilder refactor  
- Section discounts / notes / composition (done in A2)  
- Changing revise semantics beyond verifying supersession still works  

**Suggested implementation order inside A3:** A3a → tests → A3b → A3c → copy.

**Stop condition:** After A3 lands, Share cannot decide; Send is the only formal publication; staff/public PDFs match for the sent version; concurrent Send is safe.

---

## Appendix A — Key code anchors (read-only citation)

| Anchor | Location |
|---|---|
| Draft Share mint | `quotes.share_quote` draft branch + `_prepare_share_link` |
| Snapshot upsert | `quotes._upsert_version_snapshot` |
| Token mint | `quotes._mint_access` |
| Send transition | `quotes._transition_to_sent` |
| Draft→sent on open | `public_quotes._assemble` (`status == "draft"` block) |
| Decision states | `public_quotes.DECISION_STATES` |
| Approve/reject | `public_quotes.approve_public_quote` / `reject_public_quote` |
| Staff PDF | `quote_cpq.quote_pdf` → `quotes._document_payload` |
| Public PDF | `public_quotes.get_public_quote_pdf` |
| Edit lock | `authz.engine.QUOTE_EDITABLE = {draft}` |
| Send lock | `authz.engine.QUOTE_SENDABLE = {draft}` |

---

## Appendix B — Confirmation

This preflight produced **only**:

`Docs/QUOTE-BUILDER-A3-OUTBOUND-INTEGRITY-PREFLIGHT.md`

**ZERO** changes to `apps/web/**`, `apps/api/**`, migrations, pricing, CCTV, authz, PDF, snapshot, or tests.

---

**END — A3 OUTBOUND INTEGRITY PREFLIGHT — STOP**
