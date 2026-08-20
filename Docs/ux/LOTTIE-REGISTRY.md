# Lottie registry

**Rule:** Do not add Lottie to a screen unless this file is updated first.

SITE SECURE is an enterprise security-operations product. Motion must stay subtle, short, and tied to a real wait or a completed action. Copy and status text remain the source of truth. Animation never replaces an icon in navigation, a spinner on every page, or content inside a data table.

**Lottie is a functional UX layer, not a decorative layer.**

Source library (all originals): `lottiefiles/`  
Production copies used by the app: `apps/web/src/assets/lottie/`  
Runtime: `apps/web/src/components/lottie/` (`lottie-web` light, JSON only — no `.lottie` files exist)

---

## Governance

Adding motion is not “there is a JSON file, put it somewhere.” The sequence is:

1. **Need** — a real wait or a completed server action the user must feel.
2. **UX justification** — write `purpose` first. If the purpose is decoration, stop.
3. **Registry** — add the entry here and in `lottie-registry.ts`.
4. **Implementation** — only then use `<LottieAnimation name="…" />`.

Do not import `lottie-web` from a page. Do not add a production animation without updating this document in the same change.

Production animations stay limited. Unused files in `lottiefiles/` stay in the library and stay out of the app unless they pass Need → UX justification first.

`scan` only appears while Security Center data is actually loading. If the fetch finishes immediately, the animation does not show. Do not add an artificial delay so the motion can be seen.

`cloud data backup store.json` stays out of production. There is no backup/sync probe. Showing “Cloud Synced” would be fake.

`Networking with pepole.json` stays out. It is a 1MB hero illustration, not an operational signal.

---

## Production placement

| Key | File | Screen | Route / component | Size | When it appears |
|---|---|---|---|---|---|
| `securityShield` | `security-shield.json` | Security Center header | `/app/settings/security` | 48px | After signals load, beside the page title |
| `scan` | `scan.json` | Security Center loading | `/app/settings/security` | 80px | Only while `getSecurityCenter` is loading. Unmounts as soon as data or error arrives |
| `success` | `success.json` | Onboarding ready | `OnboardingForm` (register / onboarding flow) | 72px | After workspace create succeeds. Enter-workspace button is already enabled |
| `success` | `success.json` | Public quote approved | `/public/quotes/$token` | 64px | When quote status is `approved`. Thanks copy is next to it |
| `sentEmail` | `sent-email.json` | Quote sent | `QuoteBuilder` | 48px | After `sendQuote` succeeds, next to the public URL |
| `sentEmail` | `sent-email.json` | Password reset sent | `/forgot-password` | 72px | After reset email succeeds. Continue-to-login is already enabled |
| `networkConnecting` | `network-connecting.json` | Workspace header, offline only | `WorkspaceSystemStatus` | 28px chip / 36px popover | Only while `navigator.onLine` is false. Unmounts when the browser is back online |

Dev preview of registered keys: `/dev/ui` (local only). Not a product screen. The System Status offline card on that page forces `online: false` so the Network Lottie can be inspected without disconnecting the machine. Production still follows `navigator.onLine`.

---

## UX purpose

Every production animation must have a purpose. `where / trigger / loop / duration` describe the mechanic. **Purpose** answers why it exists at all.

| Key | UX purpose |
|---|---|
| `securityShield` | Marks the Security Center as a security surface on mount, without decorating the signal list or competing with status copy. |
| `scan` | Makes a real security-data wait feel like the product is checking, then stops the instant signals resolve. |
| `success` | Confirms an irreversible completed step. Heading and the next button stay available immediately — the animation does not gate progress. |
| `sentEmail` | Provides immediate visual confirmation that the server successfully completed an outbound email action. |
| `networkConnecting` | Signals a real browser-offline state in the workspace header. Does not appear when the network is connected. |

---

## Production usage

| Animation | Registry key | Place | Why | Trigger | Loop | Duration |
|---|---|---|---|---|---|---|
| `security-shield.json` | `securityShield` | Security Center header | Identifies the security surface without decorating the signal list | Page mount (after load) | No | 2.8s |
| `scan.json` | `scan` | Security Center loading | Meaningful wait on a security screen. Does not replace global `LoadingBlock` | While signals load | Yes | 3.0s |
| `success.json` | `success` | Onboarding “workspace ready”; public quote approved | Confirms a completed step. Heading/body still explain what happened | Success | No | 2.0s |
| `sent-email.json` | `sentEmail` | Quote send confirmation; forgot-password email sent | The action is dispatching a message | After send succeeds | No | 1.5s |
| `network-connecting.json` | `networkConnecting` | Workspace header, offline only | Live connectivity failure | Browser offline | Yes | 1.2s |

---

## Inventory of every file in `lottiefiles/`

All files are Bodymovin **JSON**. There are no `.lottie` / dotLottie files.

| File | Size | Canvas | Duration | Style | Production SaaS? | Verdict |
|---|---|---|---|---|---|---|
| `alert.json` | 7 KB | 32×32 | 3.0s | Tiny red alert glyph | Yes, as a micro-icon | **Not used.** Errors stay on the static `ErrorState` icon so failure is never motion-only. |
| `ChatBotAnimatedIcon.json` | 29 KB | 512×512 | 6.4s | Chatbot character | No — no AI/chat product surface | **Not used.** |
| `cloud data backup store.json` | 21 KB | 530×530 | 2.0s | Cloud backup, blue | Yes, when real sync exists | **Not used.** No sync/backup UI in P0. |
| `Login.json` | 64 KB | 2000×2000 | 3.0s | Oversized login lock, warm accent | Weak fit | **Not used.** Auth already has a custom network panel; 2000px canvas is too heavy. |
| `Network Connecting.json` | 9 KB | 101×84 | 1.2s | Small node link, blue | Yes, when actually offline | **Used** — workspace header, only while `navigator.onLine` is false. |
| `Networking with pepole.json` | 1.07 MB | 1200×920 | 11.6s | Hero illustration of people | No — cartoon/hero, too large | **Not used.** |
| `networking.json` | 232 KB | 1600×1200 | 3.0s | Wide infrastructure composition | Too heavy for app chrome | **Not used.** Would hurt navigation and CWV. |
| `scan.json` | 29 KB | 160×160 | 3.0s | Radar/scan | Yes | **Used** — Security Center loading. |
| `Security Shield.json` | 27 KB | 500×500 | 2.8s | Shield | Yes | **Used** — Security Center header, play once. |
| `Security.json` | 66 KB | 1000×1000 | 3.1s | Larger security lock/shield | Overlaps the shield | **Not used.** Shield is smaller and enough. |
| `sent email.json` | 45 KB | 120×120 | 1.5s | Envelope send | Yes | **Used** — quote send + password reset email. |
| `success.json` | 16 KB | 300×300 | 2.0s | Checkmark | Yes | **Used** — onboarding ready + quote approved. |

No camera, alarm, access-control, quote-document, signature, installation, inventory, or site animations exist in this folder. Those keys were **not** invented in the registry.

---

## Explicit non-use

Do not place Lottie on:

- Primary or bottom navigation
- Dense tables (quotes list, audit log, catalog, users)
- Dashboard cards (including Security Status on the home)
- Global `LoadingBlock` / route shells
- Empty quote lists (no quote artwork exists; the current copy already explains the flow)
- Every success of a save/autosave

---

## How to add a future animation

1. Prove the **Need** (wait or completed server action).
2. Write **UX purpose** — one sentence. If it is decorative, do not add it.
3. Put the source file in `lottiefiles/`.
4. Copy the production file into `apps/web/src/assets/lottie/` with a kebab-case name.
5. Add a registry entry in `lottie-registry.ts` with `purpose / where / why / trigger / loop / durationMs`.
6. Update this document in the same change.
7. Use `<LottieAnimation name="…" />` only. Do not import `lottie-web` from a page.
