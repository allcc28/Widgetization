# Spec: Local-Consistency Widgetization (character-builder prototype)

Course project for IFT6077.
Source of truth for the research framing is `proposal.tex`; this file is the
engineering spec. If the two disagree, fix the disagreement, don't pick silently.

## 1. Goal

Prototype a tabletop-RPG character builder (a party of three characters plus an overview) where an LLM fills a structured party
(3 character cards + 1 overview). The user edits a parameter with a widget; only
the nodes that depend on that parameter are regenerated. Every other node is
preserved verbatim, enforced by application code, not by asking the model nicely.

We compare two conditions in a within-subjects formative study (8-10 people):

- **Bounded (ours):** dependency closure -> regenerate only those nodes.
- **Baseline:** regenerate the complete structured response, with a prompt instruction to keep everything else unchanged (proposed; pending team agreement and a `proposal.tex` update).

Both share widgets, layout, progress feedback, undo, initial party and model.
They differ only in update scope.

**Local consistency** = stored content outside the dependency closure is
unchanged. It does NOT promise semantic coherence or game balance.

## 2. Scope

In scope (core):

- Parameters: `power` (slider, 1-10), `temperament` (dropdown), `gear` (segmented control: worn / standard / fine), `cls` (hero picker: the class chooses one of 8 named heroes, each at most once per party).
- A **quest** (task background with checkable requirements) from a hand-written library, picked by a seeded hash of the participant and task. The party's rating loses a grade for each unmet requirement.
- One domain (character builder), three hard-coded cards `card_1..card_3` + `overview`.
- Scope preview, Apply, change highlighting, undo.
- Baseline condition, event logging, study protocol.

Out of scope: free-form follow-up prompts, automatic dependency discovery,
dynamically generated widgets, adding/removing cards, any second domain.

Stretch, strictly in this order and only if the core is done and piloted
(adding 1 or 3 also requires updating the abstract/evaluation text in `proposal.tex`):

1. Preservation-instructed baseline prompt ("keep everything else unchanged"). Now proposed as the default baseline (see section 12).
2. Diff-based change highlighting shared by both conditions.
3. Party-wide `tone` parameter (closure = all nodes; expected no benefit, on purpose).
4. Pair-level `relationship` parameter (closure = two cards + overview). Costliest, last.

## 3. Data model

Layers per node: `params` (UI-written, including the class `cls`), `derived` (code-computed:
the hero name, role, stats, party evaluation, quest requirements) and `content` (model-written
prose). The hero's name, role and static portrait all follow from `params.cls`. The `State` also
holds a read-only `quest`. Never mix the layers.

- `params`: user-set values. Single source of truth. The model must never change them.
- `content`: LLM-written prose. This is what gets replaced or preserved.
- `derived`: computed by code (e.g. total power). Never computed by the model.

Node IDs are fixed (`card_1`, `card_2`, `card_3`, `overview`). The model never
invents or renames IDs.

```ts
type CardId = "card_1" | "card_2" | "card_3";
type NodeId = CardId | "overview";
type Temperament = "cautious" | "reckless" | "loyal" | "cunning" | "cheerful" | "brooding";
type CharacterClass = "Ranger" | "Berserker" | "Cleric" | "Mage" | "Rogue" | "Paladin" | "Bard" | "Druid";
type Gear = "worn" | "standard" | "fine";
type Role = "Tank" | "Damage" | "Support";
type Rating = "S" | "A" | "B" | "C" | "D";   // best to worst

interface CardNode {
  params:  { cls: CharacterClass; power: number; temperament: Temperament; gear: Gear };
  derived:  { name: string; role: Role; attack: number; defense: number };   // computed in code; name follows from cls
  content:  { backstory: string; abilities: string[] };
}
interface OverviewNode {
  derived: {                                  // the party evaluation, computed in code
    totalPower: number; totalAttack: number; totalDefense: number;
    rating: Rating; findings: string[];
    requirements: { text: string; met: boolean }[];   // the quest, checked in code
  };
  content: { summary: string };
}
type Requirement =                            // all checked in code
  | { kind: "roleCount"; role: Role; min: number } | { kind: "minAttack"; value: number }
  | { kind: "minDefense"; value: number } | { kind: "include"; cls: CharacterClass }
  | { kind: "exclude"; cls: CharacterClass } | { kind: "maxGap"; value: number };
interface Quest { id: string; title: string; brief: string; requirements: Requirement[] }   // read-only
interface State {
  quest: Quest;
  nodes: { card_1: CardNode; card_2: CardNode; card_3: CardNode; overview: OverviewNode };
}
type Edit =
  | { cardId: CardId; param: "cls"; value: CharacterClass }   // a hero can appear once per party
  | { cardId: CardId; param: "power"; value: number }
  | { cardId: CardId; param: "temperament"; value: Temperament }
  | { cardId: CardId; param: "gear"; value: Gear };
```

Granularity is node-level, not field-level. Rewriting a bit more than strictly
needed is an accepted cost.

### 3.1 Derived stats and the party evaluation (what the parameters are for)

Without a consequence, changing Power, Temperament or Gear would be a meaningless edit. So the
app computes stats and a party evaluation **in code** (`withDerived`, `src/shared/derived.ts`).
No model call is involved, so they update instantly while a widget is dragged, and the
user can see why a change matters. The goal of the demo is to tune a party until it works.

- **Role** comes from the fixed class: Tank = Paladin, Berserker; Damage = Ranger, Mage,
  Rogue; Support = Cleric, Bard, Druid.
- **Attack** = power + role bonus (Damage +2) + temperament modifier + gear modifier.
  **Defense** = power + role bonus (Tank +2) + temperament modifier + gear modifier. Minimum 1.
- **Temperament modifiers (attack / defense):** cautious -1/+2, reckless +2/-2, loyal 0/+1,
  cunning +1/0, cheerful 0/0, brooding +1/-1.
- **Gear modifiers (attack / defense):** worn -2/-2, standard 0/0, fine +2/+2.
- **Party:** total power, total attack, total defense, and a **rating** S/A/B/C/D from the
  average strength, where a card's strength is (attack + defense) / 2 (>=8 S, >=6.5 A, >=5 B,
  >=3.5 C, else D), one grade worse for each missing
  role, one for a power gap above 4, and one for each **unmet quest requirement**.
- **Quest requirements** (checked in code, listed in `overview.derived.requirements`): at
  least N of a role, total attack or total defense at least X, includes or excludes a class,
  power gap at most Z.
- **Findings:** short code-written sentences, e.g. "No support in the party.", "Power gap:
  Mira (10) vs Sela (2).", "Brann can't hold the front line (defense 3).", or "Balanced party."

The rating is a transparent heuristic, not a claim about real game balance. The overview's
model-written `summary` can disagree with it; that is a known limitation and a possible
RQ2 observation (the preserved cards and the regenerated text drifting apart).

Because the overview reads every card, any card edit changes the overview's evaluation, so
`overview` stays in every edit's dependency closure (see section 4).

**Study tasks can now be goal-directed**, for example: "Raise the party rating to A without
changing Mira" or "Fix the weak front line with at most two changes."

## 4. Dependency graph

Hand-authored by developers, static, in one pure module with no UI or network
imports (the frontend preview AND the backend validator both import it).

Two kinds of edges:

```ts
// parameter -> nodes it directly affects ("self" = the edited card)
const paramDeps = {
  "character.cls":         ["self", "overview"],
  "character.power":       ["self", "overview"],
  "character.temperament": ["self", "overview"],
  "character.gear":        ["self", "overview"],
};
// node -> nodes it reads; if a read node is affected, this node is affected too
const nodeDeps = { overview: ["card_1", "card_2", "card_3"] };
```

`affectedSet(edit)` = direct targets plus everything that transitively reads them.
Example: editing `card_2.power` -> `{card_2, overview}`; `card_1`, `card_3` are not in it.

The LLM never decides what depends on what. That is the central claim.

## 5. Update flow (bounded condition)

1. User changes a widget -> UI calls `affectedSet(edit)` and previews the set
   (dashed highlight). No network call while dragging.
2. User clicks **Apply** (only one pending edit at a time; Cancel resets the widget).
3. Affected nodes show "updating"; all others stay readable and untouched.
4. Backend sends the model: affected nodes (new params + old content as the base)
   and all other nodes as read-only context. Instruct it to return ONLY affected IDs.
5. Validate (see section 6). On failure: retry once, then return `ok: false`
   with the original state.
6. Recompute `derived` values in code. Take a snapshot for undo. Commit all
   affected nodes together (atomic: all or nothing).
7. UI highlights what changed. Undo restores the snapshot.

Unaffected nodes never pass through the model, so their preservation does not
depend on model compliance.

### 5.1 UI behavior (Role I)

**Portraits.** Each card shows a static portrait chosen by `params.cls`. It is never
generated by the model, is not a node and not part of the dependency graph, and
never changes on an update. The class-to-portrait map is exhaustive
(`CLASS_PORTRAITS` in `CharacterCard.tsx`), so adding a class without a portrait
is a type error. The portraits are AI-generated images by WarheadDnC (itch.io; the pack is silent on
redistribution, so the repo stays private); the credits are in `CREDITS.md` and in the page
footer. Keep both if a portrait is replaced.

**Hero picker.** Each card has a row of the 8 portraits (a radio group). Choosing one sets
`params.cls`; the hero's name, role and portrait follow. Heroes already used by another card
are greyed out and disabled (each hero once per party). While an edit is pending, only that
control stays live; the others are locked. The portrait row shows `from → to` as the hero
name and class.

**Quest panel.** Above the cards: the quest title and background, a live checklist of its
requirements (tick or cross, not colour alone; it updates while a control is dragged because
the requirements are computed in code), and a "Finish task" button. The page fires
`task_start` on load and `task_end` on Finish; after Finish all controls are locked. The quest
comes from `questFor(participantId, taskId)`: 8 hand-written quests in 4 matched pairs,
picked by a seeded hash, so a session is reproducible and a participant's two tasks are
comparable (`src/shared/quests.ts`). With no `participant`/`task` in the URL (dev), a quest is
still chosen from `dev`.

**Researcher panel.** `?admin` shows a setup page instead of the task page: a participant
id, two suggested sessions with the quest each gets (condition order balanced by participant
number via `conditionOrderFor`: odd ids start with bounded, even with baseline; session 1 is
task `t1`, session 2 is `t2`), a custom session (condition and task dropdowns), and
Start / Copy link buttons that build the session URL (`sessionSearch`). The task page never links
to it and cannot change the condition.

**Scope preview details.** In the bounded condition each card also shows why it is or is not
in the closure ("This is the card you are editing.", "Reads Brann, which is changing.",
"Doesn't depend on this edit.") from the pure `explainAffected` in `dependencies.ts`. In the
baseline every card says "May change" and the bar says the whole party is regenerated.

**Power slider.** A custom slider coloured by the card's tone. At 1 or 10 it turns amber and
shows "min"/"max" (amber, not red: red is reserved for removed text and errors; the label
means the state is not shown by colour alone).

**Scoring explanation.** The overview card has a "How is this scored?" disclosure. It
shows the role bonus and temperament modifier tables, a term-by-term calculation of each
character's attack and defense as currently shown (e.g. `7 + 2 − 2 = 7`), and the rating
rules. Every number is read from the same tables the calculation uses
(`src/shared/derived.ts`), and a test checks the explanation against the calculation for
every class, temperament and power, so the two cannot drift apart.

**Errors.** When `applyEdit` returns `ok: false`:
- The state is unchanged (guaranteed by the contract), so the UI does no rollback.
- The pending edit is kept so the user can retry or cancel.
- The top bar turns red with a warning mark and shows a plain-language message
  mapped from the error code, followed by "Nothing was changed. Try Apply again, or Cancel."
- The Apply button reads "Retry". Cancel clears the error. Any new edit clears it.
- To see this state in the fake backend, add `?fail` to the page URL.

**Undo.** An Undo button sits in the top bar and calls `undo()`.
- Disabled when `canUndo()` is false, when an edit is pending, or while updating.
- On click, the returned state replaces the committed state; the widgets re-derive
  their values from it and any error is cleared.
- Single-step history stack, no redo (core scope).

**Change highlighting (both conditions by default).** After a successful Apply, cards whose
content changed get a green "Changed" tag, changed numbers are highlighted, and changed text is
shown as an inline **diff** (a rewrite that shares fewer than half its words is shown as the whole old text removed and the whole new text added, so it stays readable): removed words struck through in red, new words underlined in
green, removed or added ability chips marked likewise. A "Hide changes / Show changes" link
toggles it. Cards that did not change get an "Unchanged" tag (guaranteed by code in bounded,
only observed in baseline). It clears when the user starts the next edit or undoes. The bar
also says which cards were updated. The pure diff is `src/shared/textDiff.ts`.

**Visual style.** A moonlit dark-fantasy theme to match the portraits: dark rounded panels
over a night sky (red crescent moon, stars, a dead branch, a castle silhouette, bats, mist,
rising embers, and a rare soft lightning flash), all CSS and inline SVG in
`src/client/components/Scenery.tsx` and `styles.css`. Status colours: blue = will change /
primary action, green = added, red = removed or error, amber = limit, grey = preserved. Each
card has its own tone (amethyst, ember copper, moon silver; gold for the overview) chosen away
from the status colours. Headings use Cinzel, body text a classical serif stack. Animations stop
under `prefers-reduced-motion`, and the lightning is slow and dim by design (no fast flashing).

**Conditions.** The page reads `?condition=bounded|baseline&participant=<id>&task=<id>`
and calls `setSession` with them.

| | bounded | baseline |
|---|---|---|
| Scope preview | yes, per card with a reason line | whole-party only: every card "May change" |
| Apply calls | `applyEdit` | `regenerateAll` |
| "Updating…" | affected cards | all cards |
| Change highlight | yes | yes by default; can be switched off with `HIGHLIGHT_CHANGES_IN_BASELINE` |
| Quest panel, hero picker, controls | same | same |

Widgets, layout, undo, error bar, quest and subtitle are identical in both.

**Log instrumentation.** The UI calls `logEvent` for `task_start` (on load), `task_end` (on
Finish), `card_enter/leave`, `param_preview`, `apply_click`, `apply_result` and `undo_click`. `src/client/logger.ts` is an in-memory
stub; the study role replaces its internals and keeps its signatures.

## 6. Validation (backend)

Reject the whole result if any check fails:

- Output parses as JSON and matches the schema (Groq JSON mode does NOT enforce schemas).
- Every returned ID is in `affectedSet(edit)`. Any extra ID -> reject.
- Returned `params` equal the values the app set; ranges valid (`power` 1-10); the quest unchanged; no hero used twice (`INVALID_EDIT`).
- `derived` is never read from the model output; it is recomputed.

## 7. Interfaces between roles

Agree on these in week 1 and change them only by telling everyone.
The detailed explanation (semantics, error codes, undo rules, log event timing) is in
`contracts.md`; this section is the short version.

```ts
// Role I (frontend), pure, shared with the validator
affectedSet(edit: Edit): NodeId[]

// Roles II and III (backend)
generateParty(initialParams): Promise<State>
applyEdit(state: State, edit: Edit): Promise<UpdateResult>      // bounded condition
regenerateAll(state: State, edit: Edit): Promise<UpdateResult>  // baseline condition
undo(): State | null
canUndo(): boolean

type UpdateResult =
  | { ok: true;  state: State; affected: NodeId[]; changed: NodeId[]; latencyMs: number }
  | { ok: false; state: State; error: { code: string; message: string } };  // state = unchanged original
```

Both conditions MUST return both `affected` (from the graph) and `changed`
(from a before/after diff). Off-scope changes = `changed` minus `affected`. It
should be 0 in the bounded condition and may be > 0 in the baseline. This is the
objective comparison metric.

The UI develops against a fake `applyEdit` returning hard-coded results until the
real one exists.

## 8. Logging (Role IV records, Role I instruments)

Every event carries `{ participantId, condition, taskId, timestamp }`.

| Event | Extra fields |
|---|---|
| `task_start`, `task_end` | |
| `card_enter`, `card_leave` | `cardId` |
| `param_preview` | `cardId, param, from, to, previewedAffected` |
| `apply_click` | `edit` |
| `apply_result` | `ok, latencyMs, affected, changed, offScope` |
| `undo_click` | |

Hover/focus dwell on unaffected cards is a rough proxy, not proof of re-reading.
Say so in the paper.

## 9. Study design (summary)

- Within-subjects, 8-10 LLM-chat users; condition order counterbalanced.
- 2-3 short tasks per condition, different task content per condition
  (e.g. "make character 2 weaker", "make character 3 more reckless"); same initial party.
- Measures: off-scope changes, completion time, latency, dwell on unaffected cards,
  Likert (predictability, control), preference, short interview.
- RQ1: does bounded updating improve perceived predictability/control and reduce
  re-inspection of unaffected cards? RQ2: what costs does it add (missed
  dependencies, confusion about scope)? Include at least one task where the
  user's intent crosses a dependency boundary so RQ2 can actually be observed.
- Report descriptive differences only, no significance claims.
- Run a 2-person pilot before the formal sessions.

## 10. Roles and timeline (4 weeks)

Four roles; the team decides who takes which.

| Role | Owns |
|---|---|
| Role I: Frontend + dependency graph | UI, widgets, `affectedSet`, preview, Apply flow, change highlight, undo button, log instrumentation |
| Role II: LLM integration | schema, prompts, model calls, structured JSON, API errors, proxy server |
| Role III: Validation + backend state | validation, `applyEdit` / `regenerateAll` orchestration, atomic update, snapshots/undo, unit tests |
| Role IV: User study | baseline condition, log recording, tasks, questionnaire, sessions, analysis |

Everyone writes the paper section closest to their work.

| Week | Role I | Role II | Role III | Role IV |
|---|---|---|---|---|
| 1 | dependency module, static UI on fake data | schema, generation prompt | state shape, validation design, test setup | protocol draft, logging design |
| 2 | preview, Apply flow, wire real `applyEdit` | model calls, update prompt, API errors | bounded update + validation, undo stack | baseline wiring, real logger |
| 3 | highlight, undo, errors, logging | prompt fixes | tests, fixes | pilot (2 people), adjust tasks |
| 4 | UI fixes, support sessions | support sessions | support sessions | formal sessions, analysis |

## 11. Definition of done (core)

- Editing `card_2.power` leaves `card_1` and `card_3` byte-identical (automated test).
- A model response containing any ID outside the affected set is rejected (test).
- A failed or rejected update leaves the visible state unchanged.
- One participant can complete both conditions end to end and the log file is
  analyzable.

## 12. Open questions

- Tech stack (TypeScript/React assumed, not decided).
- Exact model and hosting (proposal mentions open-source models via Groq).
- Baseline prompt: proposed to be the preservation-instructed one (stretch 1), pending
  agreement of Roles II-IV. Baseline highlighting: default is on in both conditions; revertible via `HIGHLIGHT_CHANGES_IN_BASELINE`.
