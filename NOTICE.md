# NOTICE for teammates

Read this first, then `RULES.md` (what the demo is, like board-game rules), `contracts.md` (exact types and function behavior) and `spec.md`
(why). Every item is tagged with the role that owns it. Decide among yourselves who takes
which role.

| Role | Scope |
|---|---|
| **Role I** | Frontend + dependency graph (UI, widgets, `affectedSet`, preview, highlighting, undo button, log instrumentation) |
| **Role II** | LLM integration (model calls, structured JSON, prompts, API errors) |
| **Role III** | Validation + backend state (validation, atomic update, undo stack, unit tests) |
| **Role IV** | User study (baseline condition, log recording, tasks, sessions, analysis) |

Status of the contracts: **draft, not yet signed off by Role II, III and IV.** If something
below does not work for you, say so now; it is cheap to change before the real backend exists.

---

## 0. Framing: the game is one instance, not the point (everyone: read this)

The character builder is only the **testbed**. The contribution is a general pattern: a
structured artifact made of nodes, each with parameters; a hand-declared dependency graph;
on an edit, only the dependency closure is regenerated and everything else is preserved by
app code, not by the model. Do not describe the project as "a game card tool" in the report.

**To do in the report (owner: Role IV with Role I; decide among yourselves):**

1. State the general pattern in the introduction or method, with the character builder as
   the demonstrated instance.
2. **Map one or two other domains on paper (no implementation).** For each: list the nodes,
   the parameters, and the dependency edges. Examples:
   - Travel itinerary: changing day 2's hotel affects day 2's transport and the total
     budget, not days 1 and 3.
   - Slide deck: changing one slide's data affects that slide's chart and the summary
     slide, not the other slides.
3. In the discussion, state the limits honestly: the graph is hand-written per schema, and
   a wrong or too wide closure has a cost. Do not claim that it generalizes automatically.
4. Keep the game simple. Do not add more game mechanics; extra domains stay a paper
   mapping (anything more is a stretch item, `spec.md` section 2).

---

## 1. Improvements I made to the proposal while building (everyone: read this)

None of these contradicts a decision we had made: the first contracts draft was never signed
off, and the proposal did not fix the details. They are what I found worth changing while
building the demo, and the reason is given for each (section 8 collects them against the
proposal). Because they change the data format, **the schema, prompts and validation you write
should follow them**. If you disagree with any item, tell me and I will change it, or change it
yourself and keep the docs in sync.

1. **The class is now an editable parameter, and it picks the hero. (This replaces the earlier
   "fixed `identity`" design; there is no `identity` field any more.)**
   Cards are now `{ params: { cls, power, temperament, gear }, derived: { name, role, attack,
   defense }, content: { backstory, abilities } }`. The UI writes `params.cls` (a hero picker).
   The hero's **name, role and portrait follow from the class** through static tables
   (`src/shared/heroes.ts`, `derived.ts`, `src/client/portraits.ts`): one named hero per
   class. The model never writes or changes the name, and `derived.name` is never read from
   model output. Editing `cls` is a normal edit: its closure is the edited card plus the
   overview. When the class changes, the model must rewrite that card's `backstory` and
   `abilities` for the new hero (same name rule as before: the name comes from the app).
   Reason: with a portrait that is a specific face, a name that does not change with the
   class looks wrong; and without a choice of class, the 8 classes would have no purpose.
2. **`cls` is one of 8 fixed classes** (`Ranger, Berserker, Cleric, Mage, Rogue, Paladin,
   Bard, Druid`), not a free string. Heroes: Ranger Mira, Berserker Brann, Cleric Sela, Mage
   Orin, Rogue Vex, Paladin Aldric, Bard Tobin, Druid Rowan.
   **A hero can appear once per party**: an edit whose `cls` is already used by another card
   is invalid (`isEditAllowed` in `src/shared/applyParam.ts`; the UI disables such heroes).
   The new error code **`INVALID_EDIT`** is returned for it and for out-of-range values.
3. **`temperament` is one of 6 fixed values** (`cautious, reckless, loyal, cunning,
   cheerful, brooding`), not a free string.
4. **`Edit` is a union**, so `value` always matches `param`:
   power takes a number, temperament takes a `Temperament`, gear takes a `Gear`.
5. **Portraits are static and unrelated to the model.** The UI picks one from
   `params.cls`. The backend must not generate, return or validate image data.
5b. **New third parameter `gear`** (`worn | standard | fine`, segmented control). It changes
   attack and defense by -2 / 0 / +2 and, like the others, affects its own card and the
   overview only. Prompts, schema checks and the PARAM_MISMATCH check must include it.
6. **`generateParty` takes `cls` (and the other params) per card** in `initialParams`, plus
   the quest. The name comes from the class.
6b. **New: the quest (task background).** `State` now has a read-only `quest: { id, title,
   brief, requirements[] }`. Requirements are code-checkable (`roleCount`, `minAttack`,
   `minDefense`, `include`, `exclude`, `maxGap`) and are evaluated by `withDerived` into
   `overview.derived.requirements: { text, met }[]`; **each unmet requirement lowers the rating
   one more grade**. The quest comes from a hand-written library (`src/shared/quests.ts`, 8
   quests in 4 matched pairs). `questFor(participantId, taskId)` picks one by a seeded hash
   (`?participant=P01&task=t1|t2`), so a session is reproducible and a participant's two
   tasks are the two quests of one matched pair. Role II: give the quest to the model as
   read-only context (it should shape the prose). Role III: the quest must come back
   unchanged; a model output may not touch it. Role IV: the quest list and its difficulty
   balance are yours to finalize.

7. **`derived` now exists on every card, and the overview carries a party evaluation.**
   Cards: `derived: { name, role, attack, defense }`. Overview: `derived: { totalPower,
   totalAttack, totalDefense, rating (S-D), findings[], requirements[] }`. All of it is computed in code by
   `withDerived` (formulas: `spec.md` section 3.1). The model must never write it, and it
   is never read from model output. Reason: this is what makes editing Power, Temperament and Gear
   mean something (attack/defense and the party rating change) and gives study tasks a goal.

The single source for types is `src/shared/types.ts`. Do not redefine them elsewhere.

---

## 2. What exists now (in the repo, tested)

| Item | File | What it does | Used by |
|---|---|---|---|
| `isEditAllowed(state, edit)`, `isClassTaken`, `applyParam` | `src/shared/applyParam.ts` | Validity of one edit (range, fixed lists, no duplicate hero) and the pure setter. Role III should call `isEditAllowed` first and return `INVALID_EDIT`. | UI (I), validator (III) |
| `explainAffected(edit)` | `src/shared/dependencies.ts` | `affectedSet` with a reason per node (edited / reads X), for the preview text. Pure. | UI (I) |
| `affectedSet(edit)` | `src/shared/dependencies.ts` | Dependency closure of an edit, e.g. card_2 power -> `[card_2, overview]`. Pure. | UI preview (I), validator (III) |
| `diff(before, after)` | `src/shared/diff.ts` | IDs of nodes that are not deep-equal between two states. | fills `changed` (III), UI (I), off-scope metric (IV) |
| `diffWords`, `diffTokens` | `src/shared/textDiff.ts` | Word-level and list diff of old vs new text, for the red/green change view. Pure. | UI (I) |
| `changedFieldsOf(before, after, id)` | `src/shared/diff.ts` | Which fields of one node differ (power, backstory, ...), for field-level highlighting. | UI (I) |
| `withDerived(state)` | `src/shared/derived.ts` | Recomputes every `derived` value (card role/attack/defense; party totals, rating, findings) from params and the quest. Never mutates. | UI draft preview (I), backend after update (III) |
| `applyParam(state, edit)` | `src/shared/applyParam.ts` | Sets one param on one card, returns a new state. Does not touch `content`/`derived`. | UI, backend |
| `sampleState` | `src/shared/sampleState.ts` | Placeholder party for development. The study will use a fixed pre-generated one. | UI, tests |
| Fake `applyEdit`, `regenerateAll`, `undo`, `canUndo`, `resetHistory` | `src/backend/fakeApi.ts` | **Fake**: waits 0.8 s, appends " (revised)" to prose (`regenerateAll` rewrites every node). Same names and result shape as the contract. `?fail` in the URL makes it fail. | UI (I) |
| **Stub** `setSession`, `logEvent` | `src/client/logger.ts` | In-memory only. Same signatures the real logger must keep. | UI (I) |
| UI | `src/client/` | Cards, widgets, scope preview, Apply, Cancel, Undo, error bar, change highlighting with an inline red/green text diff and a dark theme, both conditions, log instrumentation, and a "How is this scored?" panel that explains attack/defense and the rating from the live tables. See `spec.md` section 5.1. | |
| Researcher panel | `src/client/AdminPanel.tsx`, `src/shared/session.ts` | Open `http://localhost:5173/?admin`. Enter a participant id; it shows the two suggested sessions (condition order balanced by participant number: odd starts with bounded, even with baseline; session 1 = task t1, session 2 = t2) with the quest each gets, and Start / Copy link buttons. A custom session (condition and task dropdowns) is below. Participants never see it: the task page has no link to it and cannot change the condition. | study (IV), setup |
| Quests | `src/shared/quests.ts`, `src/client/components/QuestPanel.tsx` | 8 hand-written quests in 4 matched pairs; `questFor(participantId, taskId)`; each has 2 code-checked requirements. Tests prove every quest starts unsolved and is solvable. | UI (I), study (IV) |
| Heroes | `src/shared/heroes.ts`, `src/client/portraits.ts` | One named hero per class; hero picker in each card; `isEditAllowed` rejects a duplicate hero. | UI (I), validation (III) |
| Portraits | `src/client/assets/portraits/` | Eight static AI-generated portraits (WarheadDnC, "385 Free Fantasy Portraits", itch.io), one per class. Credit is optional under the pack's terms but we give it; the pack is silent on redistribution, so keep the repository private. Keep `CREDITS.md` and the page footer in sync. | UI |
| Tests | `tests/` | `affectedSet`, `diff`, `changedFieldsOf`, fake API, stub logger. | |

Commands (`brew install node` first): `npm install`, `npm run dev`, `npm test`,
`npm run typecheck`, `npm run build`.

**Language and stack: everything is TypeScript** (strict mode), with React and Vite for the UI and
Vitest for tests, and Node to run it. The backend should be **TypeScript on Node too**, not Python:
`affectedSet`, `isEditAllowed`, `withDerived` (all the arithmetic) and the quest checks are pure
TypeScript modules in `src/shared/`, and both the UI and your validator must call the *same*
code, so they cannot disagree about the dependency graph or the numbers. A Python backend would
have to re-implement them and keep them in sync by hand. If you strongly prefer another language,
tell me first.

**Why I chose TypeScript** (my choice as Role I; tell me if you see it differently):
1. **One language, one copy of the logic.** The UI and the backend validator import the same
   modules (the dependency graph, the arithmetic, the quest checks), so there is a single source
   of truth instead of two implementations to keep in sync. This is the main reason.
2. **The types are the contract.** `src/shared/types.ts` is the data format. `Edit` is a union
   so a value always matches its parameter; maps over the 8 classes, the error codes and the
   portraits are exhaustive, so forgetting one is a compile error, not a bug found in the study.
   That is exactly what a team of three changing the same format needs.
3. **Safer handling of model output.** The model returns JSON that we must validate. Having the
   expected shape as a type (and later a schema derived from it) makes the validation code
   shorter and harder to get wrong.
4. **The UI needs it anyway.** React and Vite are JavaScript tools; keeping the rest in the same
   language avoids a second toolchain, a second test runner and a second package manager.
5. **Small project, short time.** A few API calls to a hosted model (Groq) need no Python machine-learning
   library, so Python's main advantage does not apply here, and one language lowers the cost of
   any of us reading or fixing another's code.

The honest trade-off: if a teammate is much more fluent in Python, TypeScript costs them some
time at the start. The shared modules are small and heavily tested (`npm test`), and the types
catch most mistakes early, which should make it quicker to pick up.

**About `http://localhost:5173/`:** `localhost` means *your own computer*. It only works after you
run `npm run dev` yourself, and it is not a shared link: nobody else can open the page running on
your machine. The terminal prints the real address; if port 5173 is busy it picks the next free
one (5174, ...), so use what the terminal shows. Every example URL in this repo starts with
`http://localhost:5173/`, so replace the port if yours differs. The app is not deployed anywhere
(and the portraits must not be published, see `CREDITS.md`).

**Swapping the fake for the real backend:** `src/client/App.tsx` imports
`applyEdit, canUndo, regenerateAll, undo` from `../backend/fakeApi`. The real module must
export the same names and result shapes (`contracts.md` section 2); then change that one
import. The UI should need no other change.

**Swapping the stub logger:** keep `setSession(s)` and `logEvent(body)` in
`src/client/logger.ts` with the same signatures and replace what is inside.

### Launching a study session

Session settings come from the URL, so one link starts one session:

```
http://localhost:5173/?condition=baseline&participant=P01&task=t1
```

`condition` is `bounded` (default) or `baseline`; `participant` and `task` default to `dev`.
The page calls `setSession` with them on load.

### What differs between the two conditions in the UI

| | `bounded` (ours) | `baseline` |
|---|---|---|
| Scope preview ("Will change" / "Stays as is", a reason line per card, sentence in the bar) | yes, per card, with the reason (e.g. "Reads Brann, which is changing.") | honest whole-party version: every card says "May change" and the bar says "Applying regenerates the whole party, so any part may change." (no per-card scope; `previewedAffected` is still `[]` in the log) |
| Apply calls | `applyEdit` | `regenerateAll` |
| "Updating…" tag | affected cards only | every card |
| Highlight of what changed after Apply | yes | **yes, by default** (`HIGHLIGHT_CHANGES_IN_BASELINE = true` in `src/client/condition.ts`; **can be changed to `false`**) |
| Widgets, layout, Undo, error bar, subtitle | same | same |

### How the baseline works, and where to see it

**Definition (proposed by Role I, pending Role II-IV agreement):** the baseline is **full
regeneration with a preservation instruction**. The whole state (all 3 cards and the
overview) plus the edit go to the model, the whole structured response comes back, and the
prompt says "change only what the edit requires, keep everything else exactly as it is".
It is the strong baseline: it is what a sensible developer would do without our mechanism.
The only difference from `bounded` is who guarantees preservation: the model's compliance
(baseline) or app code (bounded). The prompt must **not** list the affected nodes, or it
would stop being a baseline. Draft prompt: `contracts.md` section 2.5.

Where to see it:

| What | Where |
|---|---|
| Run it | `http://localhost:5173/?condition=baseline&participant=P01&task=t1` |
| UI differences | `src/client/App.tsx` (`bounded ? applyEdit : regenerateAll`, `scope`, `updatingFor`) |
| Highlight switch | `src/client/condition.ts` (`HIGHLIGHT_CHANGES_IN_BASELINE`) |
| Fake backend (now) | `src/backend/fakeApi.ts` `regenerateAll`: rewrites every node, to simulate a model that ignores the instruction, so off-scope changes appear in the UI and the log |
| Real backend (to build) | `regenerateAll`, `contracts.md` section 2.5 (Role II prompt, Role III validation) |
| What is measured | `apply_result.offScope` = `changed` minus `affected`; 0 by construction for `bounded` |

If the baseline prompt changes from plain regeneration, the abstract and evaluation text in
`proposal.tex` must be updated too (not done; Role I did not edit it).

The "highlight in baseline" row is **set to yes by default, but can be changed** with one constant (see section 7, item 8), not a final decision. With
highlighting off, the baseline is easier to beat. Turning it on (spec stretch item 2) makes
the comparison fairer but shrinks the expected difference in re-inspection. Decide before
the pilot, not during the study.

---

## 3. What is NOT implemented, by role

### Role I
- The quest panel (title, background, live requirement checklist, "Finish task" button) fires `task_start` on load and `task_end` on Finish. Role IV may want to replace this with their own harness.
- Narrow-screen and phone layout: **dropped on purpose** (the study runs on a laptop). Do not rely on it.
- Nothing else is open for Role I. Everything in this list that remains belongs to the other roles below.

### Role II (LLM integration)
- **Schema in the new structure** (params / content / derived, plus the read-only quest), including a JSON
  schema or zod type used to validate model output.
- **Generation prompt for `generateParty`:** the app supplies `cls` (the hero name follows
  from it), `power`, `temperament`, `gear` and the quest; the model writes only `backstory`, `abilities` and the overview `summary`.
  There is no `generateParty` function yet, only `sampleState`.
- **Update prompt:** affected nodes (new params + old content as the base) plus all other
  nodes as read-only context; instruct it to return only the affected IDs and not to
  change `params`, `derived` or the quest. If the edit is a class change, rewrite that
  card's text for the new hero.
- **Baseline prompt** for `regenerateAll` (full state in, full state out, with the
  preservation instruction). Draft in `contracts.md` section 2.5. Write it with the same
  care and the same wording as the `applyEdit` prompt; only the scope and the
  preservation sentence may differ.
- **Give the model the evaluation as read-only context** (each card's role/attack/defense and
  the party rating/findings) so the overview `summary` agrees with it. The model must not
  write or alter any `derived` value.
- **API call and error handling:** map failures to `MODEL_ERROR` / `TIMEOUT`; retry once.
- **Do not put the Groq key in the browser.** A small proxy server is needed (e.g. Hono or
  Express) that forwards requests and holds the key. Not built yet. The same server can
  host `POST /api/log` for Role IV.
- Groq JSON mode does not enforce a schema, so Role III's validation is mandatory.

### Role III (validation + state)
- **Real `applyEdit` and `regenerateAll`** following `contracts.md` sections 2.4-2.5, including:
  does not mutate input; no-op short-circuit when the value is unchanged; one internal retry;
  returns the original state on failure; commits all affected nodes atomically; recomputes
  `derived` in code; fills `affected` (from `affectedSet`) and `changed` (from `diff`) in
  **both** conditions; measures `latencyMs` including the retry.
- **Validation** (reject the whole result on any failure):
  JSON parses; matches schema; every returned ID is in `affectedSet(edit)` (`OFF_SCOPE_ID`);
  returned `params` equal what the app set and are in range (`PARAM_MISMATCH` /
  `OUT_OF_RANGE`); **the quest unchanged** (use `PARAM_MISMATCH`); `derived` (including the
  hero name) is never read from the model. Reject an edit that duplicates a hero with
  `INVALID_EDIT` (call `isEditAllowed` before anything else).
- **Real undo stack** replacing the fake one: `undo()`, `canUndo()`, `resetHistory()`;
  only successful updates push a snapshot.
- **Unit tests** for the above. Must-haves: editing card_2 leaves card_1 and card_3
  deep-equal; an extra ID in model output is rejected; a changed quest is rejected; a duplicate hero is rejected with `INVALID_EDIT`;
  a failed update returns the original state and pushes nothing to history.

### Role IV (user study)
- **The real logger:** persistence of events (one JSON-lines file per participant per task)
  behind the existing `setSession` / `logEvent`. Not started.
- **Analysis:** dwell on unaffected cards, completion time, latency, off-scope changes.
- **Comparison figures for the final report (required, otherwise the report has no
  bounded-vs-baseline evidence).** A script that reads the logs and plots, per condition,
  one point per participant with a line joining each participant's two conditions (n is only
  8-10, so no bar chart of means alone):
  1. off-scope changes per update (`apply_result.offScope`; 0 by design for `bounded`);
  2. update latency (`apply_result.latencyMs`);
  3. cards inspected per update (count of `card_enter`, especially on unaffected cards).
  Plus one **method figure**: the same edit shown in both conditions (e.g. Mira's Power
  changes; in `bounded` Brann and Sela stay identical, in `baseline` some of their text
  changes). A screenshot of both pages or fake-backend output is enough. No in-app
  side-by-side comparison view: it would contaminate the study and is out of scope.
- A way to run tasks and fire `task_start` / `task_end`; the tasks themselves (including one
  that crosses a dependency boundary); questionnaire; interview guide; recruiting; a pilot
  with 2 people.
- Confirm the highlight decision in section 2 (default is on in both conditions).

---

## 4. What the functions are for (plain language)

- **`affectedSet`**: "if the user changes this, which cards must be rewritten?" It is a
  hand-written lookup, not an LLM decision. The whole project rests on this.
- **`diff`**: "which nodes actually differ between before and after?" Used to show what
  changed and to measure off-scope changes.
- **`changedFieldsOf`**: the same question for one node, field by field, so the UI can
  highlight the exact text that changed.
- **`withDerived`**: recomputes numbers like total power in code, so the model never does
  arithmetic.
- **`applyEdit`**: the bounded update. Regenerate only the affected nodes, validate,
  commit together. This is our condition.
- **`regenerateAll`**: the baseline. Regenerate the whole response. Same signature and
  result shape as `applyEdit` so the UI and logging treat both alike.
- **`undo` / `canUndo` / `resetHistory`**: restore the previous state exactly. Only
  successful updates are recorded. `resetHistory` is called at task start.
- **`generateParty`**: create the initial party once, at setup. Not implemented.
- **`setSession` / `logEvent`**: record what participants do. Stub only.

---

## 5. What "log instrumentation" means

The study compares the two conditions using data logged while participants work. Three
pieces are needed:

1. **Recording (Role IV):** `setSession({participantId, condition, taskId})` is called once
   per task; `logEvent(e)` stamps each event with those fields and a timestamp, and saves it.
   Only an in-memory stub exists.
2. **Instrumentation (Role I) — done:** the UI already calls `logEvent` at these points:
   - `card_enter` / `card_leave` when the pointer or keyboard focus enters/leaves a card
     (pointer and focus are merged, so there are no duplicate or overlapping pairs)
   - `param_preview` when a widget changes before Apply (`previewedAffected` is `[]` in baseline)
   - `apply_click`, `apply_result` (with `ok, latencyMs, affected, changed, offScope, errorCode?`), `undo_click`
   - Not yet: `task_start` / `task_end` (see Role IV).
3. **Analysis (Role IV):** dwell time on **unaffected** cards from `card_enter`/`card_leave`
   pairs; completion time; latency; off-scope changes = `changed` minus `affected`
   (expected empty for our condition, possibly non-empty for the baseline).

Hover/focus dwell is a rough proxy for re-checking, not gaze. Say so in the paper. Event
names and fields: `contracts.md` section 3 and `LogEvent` in `src/shared/types.ts`. Do not
log participant names; use an opaque `participantId`.

---

## 6. Rules to keep

- The model never decides what depends on what. Dependencies are the static table in
  `src/shared/dependencies.ts`.
- `params` are written only by the UI; `derived` only by code; `content` only by the model;
  the hero name, role and portrait only follow from `params.cls` (static tables).
- Unaffected nodes must not pass through the model.
- Never mutate a `State`; return a new one.
- Keep the core scope. Stretch items (spec section 2) only after the core is piloted.
- Changing a type, function signature or event name: tell the group first, then update
  `contracts.md`, `spec.md` and `src/shared/types.ts` together.

## 7. Open decisions awaiting a yes/no

1. One pending edit at a time.
2. Undo history in the backend; no redo.
3. Failed updates return the original state (UI does no rollback).
4. Exactly one internal retry.
5. Fixed pre-generated initial party for the study.
6. Class as an editable parameter (8 named heroes, each once per party), 6 temperaments, 3 gear levels, and the quest library listed above.
7. Baseline prompt: **proposed: "keep everything else unchanged"** (strong baseline, was spec stretch item 1). Role I recommends it; needs a yes from Role II-IV and a `proposal.tex` update.
8. **Default now: highlight in both conditions (Role I's choice); can be reverted.** (spec stretch item 2): then the
   comparison isolates preview plus guarantee, and the baseline is not a straw man. The
   baseline shows the honest whole-party preview ("May change" on every card), not a per-card scope. To revert, set `HIGHLIGHT_CHANGES_IN_BASELINE`
   to `false`; Role II-IV can veto before the pilot.

---

## 8. How this differs from the proposal, and why (Role I's rationale; for the report)

The research claim is **unchanged**: local consistency through a developer-declared dependency
graph, preview, highlight, undo; RQ1 (predictability, control, less re-inspection) and RQ2
(costs); a within-subjects study of 8-10 people; one domain. `proposal.tex` is not edited.
What changed is how rich the demo and the study tasks are.

| Topic | Proposal | Now | Why |
|---|---|---|---|
| Parameters | power slider, temperament dropdown | plus **gear** (segmented control) and **hero/class** (picker of 8 portraits) | A slider and a dropdown alone are too thin an interaction to study: they do not exercise different widget types or any real choice. Three kinds of widget (slider, dropdown, segmented, picker) show that the mechanism does not depend on the control. Closures stay the same (own card + overview), so the claim is untouched. |
| Class and names | not specified | 8 named heroes, one per class, each once per party; name, role and portrait follow from the class | Without a choice of class the 8 classes have no purpose, and a portrait is a specific face, so the name must follow it. This also gives a good local-consistency demo: swap one hero and the other two stay identical. |
| Overview | "total power recomputed without a model call" | also attack, defense, rating, findings, and quest requirements, all computed in code | An edit needs a visible consequence, or it is a meaningless edit. Computing it in code keeps the model out of the numbers and makes the consequence instant while dragging. It is a transparent heuristic, **not** a claim about real game balance (the proposal already says it does not guarantee balance). |
| Tasks | not specified | a **quest** (background and requirements) from a hand-written library, picked by a seeded hash | With no goal, participants just play with sliders and the 8 classes do not matter. A goal such as "meet these requirements" makes them explore, so they make more edits, and more edits means more chances for drift to show. Hand-written, not LLM-generated: requirements must be checkable by code, and every participant and both conditions need comparable difficulty (matched pairs, seeded order). LLM-drafted text that we then curate and freeze is fine. |
| Baseline | "regeneration of the complete structured response" | same, **plus** the prompt line "change only what the edit requires, keep everything else as is", and the same highlight as bounded | See the next section. |
| Baseline preview | not specified | every card says "May change" | It is the honest version of "no scope preview". It keeps the two UIs structurally the same, so the only difference is the update scope. |
| Look | not specified | dark fantasy theme, static AI portraits (credits in `CREDITS.md`) | Makes the demo legible and engaging for participants; it does not touch the mechanism. |

### Why the baseline is built this way

- **No straw man.** A baseline whose prompt invites the model to rewrite things ("you may
  revise any description") would inflate the off-scope changes and make our method look
  better than it is. The baseline is what a sensible developer would do without our mechanism:
  send the whole party and say "keep everything else unchanged".
- **No weakening it to get a result.** If this stronger baseline rarely drifts, that is a
  finding, not a failure. We report it, and the claim becomes "preservation by code is a
  guarantee, preservation by prompt is a probability".
- **Same everything else.** Same widgets, layout, undo, error handling, schema, model, initial
  party and highlighting. The prompt must not list the affected nodes (that is the thing
  under test) and must use the same schema and evaluation context as the bounded prompt.
- The baseline still has validation (schema, IDs present, `params` equal to what the user
  set, ranges). It only lacks the scope check and the preservation guarantee.

### Risks to keep in view
- More features means more work and more risk of drifting into game design. The report
  should present these as implementation and task-design details; the contribution stays
  local consistency.
- The quest rating is a heuristic. Say so in the report.
- Class changes make semantic coupling visible: another card's backstory can mention a hero
  who was just swapped out (the sample party does this on purpose: Sela's text names Mira).
  The dependency graph does not cover that. Keep one such case as an RQ2 observation.
