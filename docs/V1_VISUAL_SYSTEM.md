# Frequency Healer V1 Visual System

Status: Phase 3B.3A foundation proposal. No product screens are migrated in this slice.

## Product principle

Frequency Healer uses **simple above, rigor below**. The default view explains the next human action. Exact frequencies, ratios, signatures, provenance and formulas remain available through progressive disclosure.

The product UI should inherit the landing page's restraint, typography, blue-ice accent and editorial spacing. It should use calmer surfaces and less cinematic motion than the landing page.

## Proposed tokens

Tokens should live in `frontend/src/app/globals.css` and be consumed through CSS variables or Tailwind arbitrary properties during gradual migration.

| Role | Token | Proposed value | Use |
| --- | --- | --- | --- |
| Canvas | `--fh-bg` | `#080d18` | Application background |
| Raised canvas | `--fh-bg-raised` | `#0b1220` | Sidebar and grouped regions |
| Surface | `--fh-surface` | `#101827` | Standard content surface |
| Strong surface | `--fh-surface-strong` | `#151f31` | Selected or dominant card |
| Border | `--fh-border` | `rgba(169,199,217,.16)` | Default boundary |
| Strong border | `--fh-border-strong` | `rgba(169,199,217,.34)` | Hover, focus-adjacent or selected boundary |
| Primary text | `--fh-text` | `#f4f2ec` | Titles and primary values |
| Secondary text | `--fh-text-secondary` | `#c2c8d2` | Body copy |
| Muted text | `--fh-text-muted` | `#8994a6` | Metadata and supporting labels |
| Primary accent | `--fh-accent` | `#a9c7d9` | Primary action, focus, active navigation |
| Accent ink | `--fh-accent-ink` | `#08111d` | Text on primary accent |
| Harmonic accent | `--fh-harmonic` | `#73d7cc` | Exact harmonic relationships and valid structure |
| Saved/success | `--fh-success` | `#74c69d` | Saved and complete states |
| Exploratory | `--fh-exploratory` | `#d7aa61` | Exploratory and historical material |
| Error/safety | `--fh-danger` | `#ef7777` | Actual error, stop and safety state only |
| Landing punctuation | `--fh-coral` | `#f05c5c` | Sparse brand punctuation; generally absent from product controls |

Proposed geometry and motion:

- spacing base: 4 px; primary rhythm: 8, 12, 16, 24, 32, 48, 64 px;
- controls: 10 px radius; surfaces: 16 px; dominant cards: 20 px;
- page width: 1120 px default, 1280 px for the Lab, 760 px for the guided journey;
- shadow: `0 18px 48px rgba(0,0,0,.18)` only for dominant or floating surfaces;
- transition: 160 ms for controls, 240 ms for disclosure and page-state changes;
- reduced motion removes transforms and nonessential animation.

## Typography

- **Display:** Geist Sans, 36–56 px responsive, regular/medium, tight tracking. Use once per primary page state.
- **Heading:** Geist Sans, 20–28 px, medium. Use for sections and dominant cards.
- **Body:** Geist Sans, 15–17 px with 1.6 line height. Avoid core instructions below 14 px.
- **Label:** Geist Mono, 11–12 px, uppercase with restrained letter spacing. Use for eyebrow and classification metadata.
- **Technical:** Geist Mono for Hz, ratios, signatures, IDs, durations and mathematical values only.

The global body should use `var(--font-geist-sans)` instead of the current Arial override.

## Surfaces and hierarchy

`FHPageShell` sets the responsive width and page spacing. `FHPageHeader` supplies an optional eyebrow, one H1 and a concise explanation. `FHSurface` provides the common border, background and radius with `default`, `strong` and `subtle` variants. `FHPrimaryCard` is the single visually dominant task on a page. `FHSection` supplies vertical rhythm without forcing a border around every group.

Do not stack borders around a surface, nested panel and field group unless the boundary changes meaning. Whitespace and heading hierarchy should separate ordinary content.

## Actions

- `FHPrimaryAction`: filled ice accent, dark text, minimum 44 px target; one dominant action per state.
- `FHSecondaryAction`: quiet outlined surface for reversible secondary actions.
- `FHDangerAction`: red, reserved for stop/delete/safety actions.
- Text links remain visually distinct and receive the same focus treatment.

Apply/confirm/play remain separate actions wherever the current product separates them. Styling must never imply that selection starts playback.

## Badges

`FHEvidenceBadge` maps the existing evidence taxonomy without changing its values:

- `MATHEMATICAL`, `ACOUSTIC`, `PROTOCOL_DESIGN`: neutral/ice;
- `TRADITIONAL_HISTORICAL`, `EXPLORATORY`: amber;
- `PERSONAL_N1`: teal;
- `PUBLISHED_EVIDENCE`: blue-green;
- `UNSUPPORTED_LEGACY_CLAIM`: muted red.

`FHStateBadge` presents saved, active, prepared, exploratory, historical and deprecated states. Color is supported by visible text and never carries meaning alone.

## Metrics and sessions

`FHMetric` pairs a short label, a technical value and optional context. It is appropriate for Hz, duration, N and HCI. HCI is always titled **Complejidad estructural** and includes: “HCI describe la complejidad de la estructura armónica; no mide efectividad terapéutica.”

`FHSessionCard` summarizes intention, recommended structure, duration and lifecycle state. Exact configuration belongs in a disclosure unless required for confirmation.

## Disclosure

`FHDisclosure` builds on native `details/summary`, preserving keyboard and screen-reader behavior. It is used for signatures, generation version, exact IDs, full HIP/HCI details, provenance, technical interpretation and advanced controls. Summary text must describe what opens; focus remains visible.

## Navigation

The application frame should use four groups with unequal visual weight:

1. **Principal:** Inicio, Sesión guiada.
2. **Explorar:** Laboratorio Armónico, Atlas de frecuencias, Protocolos históricos, Generador manual.
3. **Personal:** Historial or Diario where the current data source applies.
4. **Avanzado:** Exploración OBE and its diary.

Routes remain unchanged. The active item uses the primary accent plus a text/shape cue. Emoji should be reduced or replaced by a small coherent line-icon set using existing inline SVG, without a new dependency.

## Motion

Motion communicates entry, disclosure, selection, progress, active harmonic member and save confirmation. Product surfaces avoid ambient particles, perpetual glow, parallax and pseudo-energy animation. The active stop control remains immediately reachable.

## Responsive rules

- below 768 px: one column, 16 px page gutters, 44 px controls, no horizontal overflow;
- tablet: one or two columns based on task dependency, never compressed three-column panels;
- desktop Lab: build/listen/understand regions may form three columns when each remains at least 280 px;
- technical strings wrap with `overflow-wrap:anywhere` or scroll inside a clearly labeled technical block;
- sticky playback controls must not cover content or browser safe areas.

## Accessibility

- one H1 per page and sequential headings;
- semantic landmarks and explicit accessible names;
- 44 px minimum interactive target;
- visible 2–3 px focus ring with offset;
- AA contrast for text and controls;
- error/success/exploratory meaning uses text as well as color;
- native inputs and disclosures preferred;
- focus follows guided-session step changes as it does today;
- `prefers-reduced-motion` disables nonessential motion.

## Foundation component proposal

Create only these initial primitives:

- `FHPageShell`, `FHPageHeader`, `FHSurface`, `FHSection`;
- `FHPrimaryAction`, `FHSecondaryAction`;
- `FHEvidenceBadge`, `FHStateBadge`;
- `FHMetric`, `FHDisclosure`, `FHEmptyState`.

Add `FHSessionCard` only when the Home and Guided Session migrations establish its real shared contract. Keep the harmonic visualization local to the Lab until another surface actually reuses it.

