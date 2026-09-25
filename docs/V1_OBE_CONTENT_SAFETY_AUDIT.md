# V1 OBE Content & Command Cards Safety Audit

## Scope and classification

This audit covers the 21 existing command cards, their six phase descriptions, the OBE preparation screen, the command-card introduction, and the existing OBE diary labels and guidance. The whole OBE content area is classified as `EXPLORATORY` under the existing Phase 3C/3D evidence taxonomy.

OBE terms are retained where they identify the established feature, saved fields, card IDs, historical traditions, or a user's own language. They are presented as reports, imagery, or subjective interpretation. They do not establish literal body separation, external contact, telepathy, an energy body, or a physiological mechanism.

## Files audited

- `frontend/src/lib/commandCards.ts`
- `frontend/src/components/CommandCardItem.tsx`
- `frontend/src/app/biblioteca/page.tsx`
- `frontend/src/app/sesion-nueva/page.tsx`
- `frontend/src/app/diario/page.tsx`
- `frontend/src/components/SessionLogForm.tsx`
- `frontend/src/components/SessionLogItem.tsx`
- `frontend/src/lib/sessionLog.ts`
- `frontend/src/lib/focusLevels.ts`
- `frontend/src/app/generador/page.tsx`
- `frontend/src/components/Sidebar.tsx`
- `frontend/src/app/page.tsx`

The audit also checked `frontend/src/lib/types.ts` and the existing OBE route, storage, UI and regression tests to confirm that copy changes did not alter contracts.

## Card audit

| Card group | Count | Previous claim pattern | V1 treatment |
| --- | ---: | --- | --- |
| Preparation | 5 | REM efficiency, autonomic and attentional mechanisms | Preserved actions and timing; described as traditional practice or attentional ritual |
| Induction | 3 | magnetic return, guaranteed signals, brainstem/NREM mechanisms | Reframed as perceived sensations, voluntary attention, comfort and stop choice |
| Active exit | 3 | literal separation, soul body, cortical extrusion, inverse-square force | Reframed as imagery and subjective change of focus |
| Stabilization | 4 | detached consciousness, soul hands/voice, physical snap-back | Reframed as perceived scenes and attentional cues |
| Exploration | 3 | instant travel, cortical explanation, verified telepathy/contact | Reframed as narrative structure and interpretation of subjective content |
| Post-session | 3 | quantified memory loss, autonomic drain, cortical resynchronization | Reframed as prompt recording and conservative self-care |

All 21 primary card claim groups were changed. Card IDs, phase order, command strings, operational sequence, stored references, and explicit timing values remain unchanged. Titles changed only where a title itself asserted an unverified entity.

The claim inventory found literal or implied body separation, energetic or magnetic return, soul-body and soul-voice entities, verified telepathy or remote contact, autonomic and neurological mechanisms, guaranteed state transitions, and quantified memory or burnout effects. These claims were removed or attributed to a historical or personal interpretive framework. The card detail label is `Propósito subjetivo`; it does not imply that a mechanism is established.

## Diary and preparation

The diary still reads and writes the original `OBESessionLog` shape. Existing boolean fields remain intact, but labels now distinguish perceived paralysis, vibratory sensations, perceived separation, and perceived return. Notes invite memories, sensations, images, and interpretations without asserting external events. The established cooldown calculation and thresholds remain unchanged; its explanation is now a conservative pause recommendation rather than a nervous-system claim.

The preparation flow keeps its route, preset selection, duration, WBTB clock values, intention value, local-storage key, and launch behavior. WBTB is identified as a traditional practice rather than a proven physiological window. The original intention command is preserved verbatim because it is part of the established command contract, with nearby copy clarifying its symbolic, personal use.

## Protected behavior

No audio file, oscillator, frequency, binaural value, timing constant, route, storage key, schema, diary field, card ID, command string, or session transition was changed. No new health, neurological, energetic, or metaphysical claim was introduced.

## Residual terms

Legacy identifiers such as `separation`, `paralysisAchieved`, `vibrations`, `lookedBack`, and card IDs remain for storage and code compatibility. Tags such as `telepatia`, `soul-body`, and `magnetic-pull` remain unchanged as internal discovery metadata. Their surrounding user-facing copy now supplies the exploratory context. Renaming those identifiers or tags would be a schema/search migration and is outside this audit.

## V1 copy-freeze classification

| Status | Content | Result |
| --- | --- | --- |
| Approved for V1 | Acoustic values, route labels, diary prompts, comfort and stop guidance | Clear factual or operational wording |
| Exploratory but allowed | OBE framework, imagery exercises, perceived separation, traditional WBTB practice, retained command strings | Allowed only with the existing subjective or historical context |
| Deprecated / historical | Unsupported physiological, neurological, energetic and metaphysical explanations removed from visible copy | Retained only where an identifier, search tag, command contract or historical reference requires it |
| Unresolved | None | Zero unresolved high-risk user-facing claims found |

Residual risk is limited to established OBE terminology and the three exact command strings. A reader could interpret those phrases literally when separated from their surrounding disclosure, so the contextual `EXPLORATORY` framing must remain. No repository source supports promoting any OBE outcome to `PUBLISHED_EVIDENCE`.

## Copy-freeze recommendation

Freeze the audited V1 OBE copy with the 21-card identity, route, diary-schema and acoustic-value tests. Future changes should preserve the contextual `EXPLORATORY` label, distinguish a user's report from an external fact, and require a separate evidence review before introducing physiological or therapeutic explanations. The OBE visual migration can proceed as a separate phase if it preserves this copy and the protected behavior above.
