# Brand Guidelines

**Brand:** NORTHSTAR INTELLIGENCE — a product of Northstar Acquisitions LLC. *Working name: trademark, corporate-name, and domain clearance have not been performed; do not represent availability as verified.*

## 1. Positioning & voice
- **Primary tagline:** The intelligence infrastructure for real estate.
- **Secondary lines:** Real Estate. Intelligence. Execution. · Intelligence Behind Every Acquisition. · One Platform. Connected Intelligence. Autonomous Execution. · Built for Decisions. Engineered for Execution.
- **Personality:** institutional, precise, authoritative, dependable, discreetly premium.
- **Voice rules:** state facts plainly; show the math; never overclaim ("estimate", not "guaranteed value"); no hype words ("revolutionary", "magic"); label AI output honestly; numbers in tabular mono.
- **Message hierarchy:** (1) Speed to lead (2) Know your number (3) Compliance you can prove (4) Keep your CRM.

## 2. Logo system
- **Symbol:** an original four-point north-oriented star built from two offset chevron pairs around a central node. The north point is Signal Blue (direction); east/west points are Titanium (structure); the south point is muted (grounding); the center node is Arctic White (the connected core). It reads as navigation + interconnected data, avoiding house/roof shapes, generic AI glyphs, gradients, and ornament. Source: `apps/web/src/components/Logo.tsx` (SVG, 32-unit grid).
- **Wordmark:** "NORTHSTAR" in Geist Semibold, tracking +0.22em, with "INTELLIGENCE" below in Geist Medium at ~73 % size, tracking +0.34em, Muted color.
- **Lockups:** horizontal (symbol left, 10px gap at 28px symbol); symbol-only for favicons/app icons (min 16px).
- **Clear space:** ≥ the symbol's center-node diameter × 4 on all sides. **Don't:** recolor the north point, add gradients/shadows, rotate, outline, or place on busy imagery.

## 3. Color
| Token | Hex | Use |
|---|---|---|
| Obsidian | `#10151E` | App background |
| Graphite | `#1B2533` | Surfaces, panels |
| Graphite-2 | `#233042` | Raised/hover surfaces |
| Line | `#2C3A4F` | Borders, dividers |
| Titanium | `#DCE4EE` | Primary text on dark |
| Muted | `#8A99AE` | Secondary text, labels |
| Arctic White | `#F7F9FC` | Headings, emphasis; light-mode background |
| Signal Blue | `#5689FF` | Primary action, focus, key figures (use sparingly) |
| Positive / Caution / Critical | `#3FB68B` / `#E0A84A` / `#E5636B` | Status only — never decoration |

Restraint: ≥ 90 % of any screen is neutrals; Signal Blue marks the single most important action or number. Status colors always pair with a text label (accessibility).

## 4. Typography
- **Geist** (UI/marketing; Inter fallback): headings semibold, tight tracking; labels uppercase 10–11px with +0.12–0.18em tracking.
- **IBM Plex Mono** (financial data, IDs, codes) with tabular numerals (`.num`).
- Scale: 11 / 13 / 14 / 18 / 24 / 32 / 48.

## 5. Iconography & data visualization
Thin 1.5px stroke icons, geometric, no fills. Charts: single-hue Signal Blue for primary series, neutrals for context, status colors only for status. No 3D, no gradients, label values directly.

## 6. Product UI components (implemented in `apps/web/src/components/ui.tsx`)
Panel, Stat tile, Table (sticky-style headers, dividers, hover), Pill (status), **OriginBadge** (Verified / Assumption / Third-party / AI · review / Calculated — each with confidence where applicable), PageHeader (eyebrow + title). Focus rings in Signal Blue; motion ≤ 240 ms and disabled under `prefers-reduced-motion`.

## 7. Provenance language (mandatory in UI and reports)
| Origin | Label |
|---|---|
| verified | Verified |
| user_assumption | Assumption |
| third_party_estimate | Third-party |
| ai_generated | AI · review |
| calculated | Calculated |

## 8. Marketing materials
Dark-first layouts (Obsidian), generous whitespace, one idea per section, real product screenshots (labeled demo data), transparent methodology links. Never show real seller PII or imply guaranteed returns.
