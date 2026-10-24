# OSS Reference Licenses

Retrieval dates (UTC): **2026-09-28** · **2026-09-29** (Brainwave)  
Local path: `.external-reference/` (gitignored — inspection only)

This note is for engineering planning. It is **not** legal advice. Mark unclear items for counsel review before any code reuse.

| Project | License (as found) | Source URL | Commit SHA | Reuse appearance | Attribution / copyleft concerns |
|---|---|---|---|---|---|
| **PostHog** | Dual: **MIT** for content outside `ee/`; **PostHog Enterprise License** for `ee/` | https://github.com/PostHog/posthog | `40eeb716559d19325eb82b381663dd07ba9c8020` | Core/MIT portions look permissive for small adaptations; **do not** treat `ee/` as freely reusable | Keep MIT copyright notice if copying MIT-licensed snippets. **`ee/` restricted** — production use requires PostHog subscription terms. Prefer PostHog Cloud SDK + docs over forking the monorepo. |
| **PostHog Docs / site** | Split: site chrome/design **restricted** (“do not duplicate”); `/contents/` **MIT** | https://github.com/PostHog/posthog.com | `9607e30be4b116b511e4fdab0c9b17e22bf1d3b8` | Docs under `/contents/` appear permissive for learning / paraphrased guidance | Do **not** copy site design/UI. Prefer linking or paraphrasing MIT docs content with attribution if reused. |
| **Unleash** | **AGPL-3.0** | https://github.com/Unleash/unleash | `2923286c2ff8497ee43169556fe6f8a5f8ae96c2` | Architecture study OK; **direct code reuse into proprietary SaaS appears restricted / copyleft** | Network-use copyleft: linking/shipping modified AGPL server code typically forces source disclosure. **Mark for legal review** before any copy. Prefer Unleash as a **hosted/separate service** or conceptual reference only. |
| **OpenTelemetry JS** | **Apache-2.0** | https://github.com/open-telemetry/opentelemetry-js | `acd385fc533af33ccf3f0a0e2d23a1bd3627a848` | Generally permissive for dependency use and adapted snippets with NOTICE/attribution | Preserve copyright/NOTICE on redistribution. Compatible with typical proprietary apps when used as a library. |
| **Papra** | **AGPL-3.0** | https://github.com/papra-hq/papra | `2181983bcafa9739ab9065b9ddf386388b404527` | UX/product patterns OK to study; **wholesale code reuse into SITE SECURE appears restricted** | Same AGPL concerns as Unleash. **Mark for legal review**. Extract ideas; do not vendor the app. |
| **Brainwave** | **MIT** (`LICENSE`, © 2024 Sanidhya Kumar Verma) | https://github.com/sanidhyy/brainwave | `601d552de7c10b686f3a7b6e7fa7a034a5c6ec6e` | Permissive for study and small adapted snippets with copyright notice | Prefer **conceptual pattern adaptation** over copying large JSX/CSS/asset blocks. Do not ship Brainwave brand identity, robot/AI art, or purple neon palette as SITE SECURE. If any MIT-licensed snippet is reused, retain the copyright notice. |
| **UI/UX Design Pro Skill** | **MIT** (`LICENSE`, © 2025 saifyxpro) | https://github.com/saifyxpro/ui-ux-design-pro-skill | `3c24c74446e37634d33332e77db4445e2a9cac5b` | Methodology / reference docs OK to study; prompts and CSV data are not a product design system | **Do not** adopt “light mode by default.” Do not run CLI to regenerate SITE SECURE tokens. Prefer paraphrased principles in `Docs/design/SITE-SECURE-UI-DESIGN-RULES.md`. Keep MIT notice if copying substantial text. |

## Summary

- **Safest for future dependency use:** OpenTelemetry JS (Apache-2.0); PostHog **client SDKs** via npm (separate packages — verify their licenses at integration time).
- **Safest for reading patterns:** PostHog `/contents/` docs (MIT); PostHog core outside `ee/` (MIT) as reference only; Brainwave (MIT) for **marketing visual patterns only**; UI/UX Design Pro Skill (MIT) for **craft principles only** (dark mode strategy stays SITE SECURE’s).
- **Treat as reference-only unless counsel approves:** Unleash (AGPL), Papra (AGPL), PostHog `ee/`, PostHog.com design shell.
- **SITE SECURE policy:** never automatically merge or vendor these repos into the product tree.
