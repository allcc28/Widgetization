# CLAUDE.md

IFT6077 course project: "Local-Consistency Widgetization", a character-builder prototype
where editing one widget regenerates only its dependent nodes via an LLM.

## Read first

- `RULES.md`: what the demo is, written like board-game rules (part 1 for players and study participants, part 2 for the team). Keep it in sync when scoring, parameters, heroes or quests change.
- `spec.md`: engineering spec (data model, dependency graph, update flow, interfaces, logging, roles). Follow it.
- `CREDITS.md`: attribution and terms for the portraits (WarheadDnC, itch.io; the pack is silent on redistribution, so keep the repo private). Keep it and the page footer in sync if a portrait changes.
- `NOTICE.md`: what each teammate must know, by role: improvements made while building (data-format changes to follow), what exists, what is not implemented, and (section 8) how the demo differs from `proposal.tex` and why.
- `contracts.md`: detailed state format, function semantics (`applyEdit`, `regenerateAll`, undo) and log events. Draft until Roles II-IV sign off.
- `proposal.tex`: research framing (ACM acmart, 2 pages, `refs.bib`). Do not edit it unless asked; if the spec and proposal diverge, say so.

## Rules that matter

- The model never decides what depends on what. Dependencies are a static, hand-written table.
- `params` (power, temperament, gear) are written only by the UI. `derived` values are computed in code. The model writes only `content`.
- Node IDs are fixed (`card_1..3`, `overview`). Never let the model create or rename them.
- The class (`params.cls`) is a UI parameter that picks one of 8 named heroes; the hero's name, role and portrait follow from it by static tables, never from the model. A hero appears once per party (`isEditAllowed`). The model writes only `content`.
- The quest is read-only context from a hand-written library (`src/shared/quests.ts`); its requirements are checked in code and each unmet one lowers the rating.
- Portraits are static, chosen by `params.cls`, and unrelated to the model or the dependency graph.
- Reject any model output that contains an ID outside `affectedSet(edit)`.
- Unaffected nodes must not pass through the model, so preservation never depends on model compliance.
- `affectedSet` is a pure module (no UI, no network) shared by the frontend preview and the backend validator.
- Both conditions (bounded and baseline) must return `affected` and `changed`; off-scope = `changed` minus `affected`.
- Keep the core scope. Stretch items in `spec.md` section 2 (and anything beyond the demo described there) come only after the core is done and piloted.
- Do not change the interface signatures in `spec.md` section 7 or the log event names in section 8 without telling the other two team members.

## Status

Stack: Vite + React + TypeScript (strict), Vitest. Needs Node (`brew install node`). The backend is TypeScript on Node as well, so it can import `src/shared/`.

```
npm install        # once
npm run dev        # dev server; prints the address (usually http://localhost:5173/, your own machine only)
npm test           # vitest run
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build
```

Layout:

- `src/shared/`: `types.ts` (contracts), `dependencies.ts` (`affectedSet`, `explainAffected`), `diff.ts`, `textDiff.ts`, `derived.ts`, `applyParam.ts` (`isEditAllowed`), `heroes.ts`, `quests.ts`, `session.ts`, `sampleState.ts`. Pure, no UI/network imports.
- `src/backend/fakeApi.ts`: FAKE `applyEdit`/`regenerateAll`/`undo` with the contract's signatures, for UI development. The UI still imports it until the swap to `api.ts` (one import line in `App.tsx`).
- `src/backend/api.ts` (Role III): real `applyEdit`/`regenerateAll`/`undo`/`canUndo`/`resetHistory`, same signatures, plus `setModel(fn, timeoutMs)` for Role II's model. One retry, per-attempt timeout, atomic commit, original state on failure. `validate.ts`: `parseOutput` (only schema-dependent part, temporary shape until Role II's schema) and `checkOutput` (contract rules). `devModel.ts`: stand-in model until Role II's lands.
- `src/client/`: React UI (cards, hero picker and widgets, quest panel, scope preview with reasons, Apply, undo, error bar, red/green text diff, dark-fantasy theme with `Scenery.tsx`, both conditions via `?condition=baseline|bounded&participant=P01&task=t1|t2`), `AdminPanel.tsx` (`?admin`, researcher setup page), `logger.ts` (stub) and `condition.ts`.
- `tests/`: Vitest tests.

Not built yet: the real LLM model adapter, prompts and output schema (Role II), the Groq proxy server and `POST /api/log`, and the real logger (Role IV).

Integration notes:

- **Role II:** The model adapter must forward the provided `AbortSignal` to its underlying API/fetch request so timed-out calls are actually cancelled rather than continuing to consume resources.

## LaTeX

`proposal.tex` builds with `latexmk -pdf proposal.tex`. The two font lines near the top
(mathptmx, helvet) are a local substitute and should be deleted on Overleaf or a full TeX Live.
Build artifacts (`*.aux`, `*.log`, etc.) are not source.
