# Frequency Healer V1 Visual Modernization Audit

Status: Phase 3B.3A audit and foundation proposal. No product behavior or page styling was changed.

## Current visual inconsistencies

The landing page already supplies the strongest product identity: Geist typography, a dark navy canvas, soft white text, blue-ice accent, sparse coral punctuation, thin translucent rules, generous spacing and editorial labels. Its motion is concentrated in the cinematic hero and remains appropriate to the public page.

The application currently diverges in these ways:

- `globals.css` declares a small token set but most screens bypass it with direct hex values. Source inspection finds more than 40 distinct hex values and repeated raw uses of `#1f2937`, `#60a5fa`, `#111827` and `#0d1117`.
- the global body overrides Geist with Arial despite loading Geist in `layout.tsx`;
- Home combines the primary journey, legacy domain marketing, quick frequencies, protocols, statistics and category breakdown with similar visual weight;
- domain cards use red, purple, cyan, emoji and gradients, recreating the legacy body/soul/spirit framing more prominently than the product method;
- sidebar gives every route comparable prominence and uses pulsing domain indicators unrelated to current state;
- Guided Session has the correct linear behavior, but every state uses the same generic bordered panel and button treatment;
- Harmonic Lab is a long one-column stream. Build, listen and understand content are functionally complete but visually interleaved;
- Library mixes the frequency archive and OBE command cards under one title, and historical frequency labels can dominate classification;
- Protocols is correctly named “Protocolos históricos,” but filters, cards and player still share the generic legacy treatment;
- Generator says “Generador de Tonos” and references electromagnetic coils in its lead, which makes the manual tool appear more authoritative than the guided journey;
- many interfaces rely on 9–11 px copy, repeated borders and `rounded-xl` rather than a deliberate type and surface hierarchy;
- semantic states reuse many unrelated colors; red appears in domain identity as well as error/safety contexts;
- repeated page headers, surfaces, buttons, metrics, badges and empty states are implemented independently.

## Pages reviewed

| Surface | Current strength | Primary issue | Planned slice |
| --- | --- | --- | --- |
| Landing | Established premium identity | Remains intentionally more cinematic | Reference only |
| Home | Guided CTA already present | Legacy catalog and domain panels dominate below it | 3B.3B |
| Guided Session | Correct six-step behavior and disclosure | Weak visual focus between states | 3B.3B |
| Harmonic Lab | Complete advanced feature set | Long undifferentiated vertical stream | 3B.3B |
| Library | Search/filter and evidence data exist | Archive and OBE tools compete; legacy labels dominate | 3B.3C |
| Protocols | Historical framing already present | State and playback hierarchy remain generic | 3B.3C |
| Generator | Functional manual signal tool | Positioning and visual authority are too strong | 3B.3C |
| Diary/history | Existing records and empty states | Inconsistent metric/status/card styles | 3B.3C or 3B.3D by data source |
| OBE preparation/cards | Safety language audited in 3D.1 | Visual migration should follow core surfaces | 3B.3D |

## Proposed shared components

The initial component set is deliberately small: page shell/header, generic surface/section, primary and secondary actions, evidence/state badges, metric, disclosure and empty state. Session cards and harmonic graphics should be extracted only after real usage proves a shared API.

Recommended locations:

- `frontend/src/components/ui/FHLayout.tsx`
- `frontend/src/components/ui/FHActions.tsx`
- `frontend/src/components/ui/FHBadges.tsx`
- `frontend/src/components/ui/FHMetric.tsx`
- `frontend/src/components/ui/FHDisclosure.tsx`
- `frontend/src/components/ui/FHEmptyState.tsx`
- `frontend/src/components/ui/fh-ui.module.css`

Components remain presentational. They accept children, semantic element choices and visual variants; they do not read storage, feature flags, engines or domain records.

## Proposed navigation treatment

The existing sidebar remains the application frame and retains every URL. It becomes quieter, removes pulsing body/soul/spirit indicators and groups routes as Principal, Explorar, Personal and Avanzado. Inicio and Sesión guiada receive the clearest position; Lab remains prominent but secondary. Historical and OBE routes remain discoverable without competing with the first-use path.

Mobile keeps the current drawer model. The migration must preserve `Menu`, `Cerrar`, `Navegación principal`, active-route logic and every current href because browser tests depend on those contracts.

## Home redesign plan

Structural hierarchy:

```text
FHPageShell
├── FHPageHeader: Frequency Healer / personal acoustic exploration
├── FHPrimaryCard: ¿Qué quieres explorar hoy?
│   ├── short guided explanation
│   └── Comenzar sesión guiada
├── Recent activity (only from validated existing records)
│   └── first-use empty state when absent
├── Personal learning (only when existing evidence qualifies)
├── Advanced exploration
│   ├── Laboratorio Armónico
│   ├── Atlas de frecuencias
│   └── Protocolos históricos / Generador manual
└── Advanced/OBE entry, visually subordinate
```

The current fabricated-looking catalog totals and domain marketing blocks should not occupy the primary dashboard. Existing data can remain accessible through the Library and Protocols routes. No personalized module renders unless the current validated stores provide it.

## Guided Session redesign plan

```text
FHPageShell (narrow)
├── eyebrow: Exploración sonora · reglas locales
├── calm progress line + 02 / 06
├── FHPrimaryCard
│   ├── current-state H1/H2
│   ├── conversational summary
│   ├── one primary action
│   └── necessary secondary action
├── FHDisclosure: interpretation or harmonic details
├── sticky stop control only while active
└── history disclosure after the primary task
```

The orchestrator state machine, focus movement, consent, confirmation, audio lifecycle, explicit saving and all field labels remain unchanged. Migration should first wrap existing state blocks rather than rewrite their JSX logic.

## Harmonic Lab redesign plan

```text
FHPageShell (wide)
├── FHPageHeader: Laboratorio Armónico
├── status/playback rail
├── responsive instrument workspace
│   ├── Build: current manual controls and explorer apply actions
│   ├── Listen/visualize: exact current schedule or constellation
│   └── Understand: rationale, HIP/HCI, evidence and provenance
├── Saved constellation and experiment sections
└── sticky stop control while active
```

The first visualization should be lightweight SVG derived exclusively from the already validated constellation/schedule objects. Sequence mode uses an ordered map; simultaneous mode uses a central seed with member nodes. It must preserve order and multiplicity, label exact values and never compute new relationships.

Signature, generation version, IDs, HCI formula and raw provenance move behind disclosures. Confirmation, consent and stop controls stay visible when relevant.

## Library, Protocols and Generator plans

**Atlas de frecuencias:** keep `/biblioteca`; make frequency, classification and neutral description the card hierarchy. OBE command cards remain a secondary tab. Existing data does not currently provide a universal exact “harmonic relationships” field for every historical entry, so the UI must not invent one. An “Explorar en laboratorio” action should only be added later if an exact existing adapter supports that entry.

**Protocolos históricos:** keep `/protocolos`; add consistent HISTÓRICO, EXPLORATORIO and DEPRECADO badges from current dispositions. Separate archive browsing from the active player. Do not relabel or alter protocol IDs, steps or schedules.

**Generador manual:** keep `/generador`; rename the visible heading and explain its advanced/manual role. Preserve both tone and multilayer tabs, all presets, output modes and safety flow. Playback/stop remains the dominant local control, while the guided-session link explains the recommended ordinary entry.

## Exact files likely to change

Foundation (3B.3A implementation after approval):

- `frontend/src/app/globals.css`
- `frontend/src/components/AppFrame.tsx`
- `frontend/src/components/Sidebar.tsx`
- new `frontend/src/components/ui/*`
- focused component tests and existing UI navigation expectations

Primary surfaces (3B.3B):

- `frontend/src/app/page.tsx`
- `frontend/src/components/voice/VoiceJourney.tsx`
- `frontend/src/components/voice/voice.module.css`
- `frontend/src/components/voice/HarmonicLab.tsx`
- selected `frontend/src/components/lab/*`
- a local lightweight harmonic visualization component and styles

Legacy surfaces (3B.3C):

- `frontend/src/app/biblioteca/page.tsx`
- `frontend/src/app/protocolos/page.tsx`
- `frontend/src/app/generador/page.tsx`
- `frontend/src/app/diario/page.tsx`
- `frontend/src/components/SessionLogForm.tsx`
- `frontend/src/components/SessionLogItem.tsx`
- `frontend/src/components/CommandCardItem.tsx`

Advanced/OBE surfaces (3B.3D):

- `frontend/src/app/sesion-nueva/page.tsx`
- OBE-specific presentation components only after primary and legacy review

Protected logic files should not change, including audio engines, harmonic math/compiler/signatures, recommendation/discovery/personalization/profile logic, schemas and storage modules.

## Regression risks

1. Styling wrappers could alter accessible names or heading order used by UI tests.
2. Reordering Lab sections could accidentally move confirmation or stop controls outside reachable mobile flow.
3. Replacing buttons with links or vice versa could change keyboard and submit behavior.
4. Home recent-activity work could broaden or corrupt reads across V1/V2 namespaces if not kept read-only.
5. A constellation visualization could accidentally deduplicate members or derive unsupported relationships.
6. CSS overflow and sticky controls could hide technical values or cover actions on mobile.
7. Removing old classes too early could disturb active/error/disabled semantics.
8. Feature-flag OFF builds must retain the legacy route gating and fallback navigation.

## Controlled implementation sequence

1. Approve tokens, typography, component inventory and navigation hierarchy from this audit.
2. Implement tokens and presentation-only primitives; add a small component showcase or apply them to one nonfunctional shell for visual review.
3. Validate desktop/mobile, reduced motion, focus and contrast; run full ON/OFF regression and publish Preview.
4. Migrate Home in one reversible commit.
5. Migrate Guided Session without changing its state machine.
6. Migrate Harmonic Lab layout, then add exact-data visualization in a separate commit.
7. Review 3B.3B Preview before touching legacy surfaces.
8. Migrate Atlas, Protocols, Generator and compatible history surfaces separately.
9. Modernize OBE presentation only in 3B.3D, preserving the completed 3D.1 safety language.

## Phase 3B.3A decision gate

No material conflict with the current landing direction was found. The main design choice requiring approval is whether the proposed product canvas should use the landing's warmer navy (`#0b1020`) exactly or the slightly darker proposed `#080d18` for better separation between working surfaces. The recommendation is `#080d18` for the application while retaining `#0b1020` on the cinematic landing.

No preview or screenshots were produced because this slice intentionally contains audit documentation and a foundation proposal only. The current application UI remains unchanged.
