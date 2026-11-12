# Contracts between roles (DRAFT: needs sign-off from Roles II, III and IV)

This file explains the three agreements the team builds against: the state data
format, the function interfaces (including undo), and the log events. `spec.md`
sections 7-8 are the short version; this is the long one. If you want to change
anything here, tell the other two first, then edit this file.

Status: proposed by Role I. Sign-off: Role II [ ]  Role III [ ]  Role IV [ ]

Shared TypeScript types live in one file, `src/shared/types.ts` (already created and mirroring this file; the stack is
chosen). Everything below is meant to be copied into it.

---

## 1. State data format

### 1.1 Types

```ts
type NodeId = "card_1" | "card_2" | "card_3" | "overview";
type CardId = "card_1" | "card_2" | "card_3";
type Gear = "worn" | "standard" | "fine";
type Temperament = "cautious" | "reckless" | "loyal" | "cunning" | "cheerful" | "brooding";
type CharacterClass = "Ranger" | "Berserker" | "Cleric" | "Mage" | "Rogue" | "Paladin" | "Bard" | "Druid";
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
interface Quest { id: string; title: string; brief: string; requirements: Requirement[] }
interface State {
  quest: Quest;                               // read-only: no edit or model output may change it
  nodes: { card_1: CardNode; card_2: CardNode; card_3: CardNode; overview: OverviewNode };
}

// One pending edit at a time. A union, so `value` always matches `param`.
type Edit =
  | { cardId: CardId; param: "cls"; value: CharacterClass }   // a hero can appear once per party
  | { cardId: CardId; param: "power"; value: number }
  | { cardId: CardId; param: "temperament"; value: Temperament }
  | { cardId: CardId; param: "gear"; value: Gear };
```

### 1.2 Example

```json
{
  "quest": { "id": "siege", "title": "Siege of Blackrock Keep", "brief": "...", "requirements": [ ] },
  "nodes": {
    "card_1": {
      "params":  { "cls": "Ranger", "power": 6, "temperament": "cautious", "gear": "standard" },
      "derived":  { "name": "Mira", "role": "Damage", "attack": 7, "defense": 8 },
      "content": { "backstory": "Raised on the northern marches...",
                   "abilities": ["Longbow volley", "Track prey"] }
    },
    "card_2": { "params": { "cls": "Berserker", "power": 7, "temperament": "reckless", "gear": "standard" }, "content": { } },
    "card_3": { "params": { "cls": "Cleric", "power": 5, "temperament": "loyal", "gear": "standard" },    "content": { } },
    "overview": {
      "derived": { "totalPower": 18, "totalAttack": 21, "totalDefense": 21,
                   "rating": "A", "findings": ["Balanced party."], "requirements": [ ] },
      "content": { "summary": "A balanced party led by..." }
    }
  }
}
```

### 1.3 Rules

| Layer | Who writes it | Notes |
|---|---|---|
| `params` | Only the UI (via `Edit`) | Includes the class `cls`, which picks the hero (name, role, portrait). The model must never change them. The validator rejects output whose params differ from what the app set. |
| `quest` | Fixed per task | The task background and requirements. Read-only: give it to the model as context; the validator rejects output that changes it. Chosen by `questFor(participantId, taskId)`. |
| `content` | Only the LLM | This is what is replaced (affected nodes) or preserved verbatim (all others). |
| `derived` | Only code (`withDerived`) | Card role/attack/defense and the party evaluation (totals, rating, findings); formulas in `spec.md` section 3.1. Recomputed after every successful update. Never read from model output; the model must not write it. |

- Node IDs are fixed. The model never invents, renames or reorders them.
- **Portraits are static and have nothing to do with the model.** The UI picks a
  portrait from `params.cls` (exhaustive map in `CharacterCard.tsx`). A portrait is
  not a node, is not in the dependency graph, and never changes on an update. The
  backend must not generate, return or validate image data.
- The party evaluation (rating, findings) is computed by code. Give it to the model as
  read-only context so the overview `summary` agrees with it. The model may still
  disagree; that is a limitation to report, not something the validator checks.
- `power` is an integer 1-10. `gear` is `worn`, `standard` or `fine` (`GEARS` in `src/shared/types.ts`). `temperament` is one of a fixed list; the list lives in
  `src/shared/types.ts` as `TEMPERAMENTS` (proposal: cautious, reckless, loyal, cunning, cheerful, brooding).
- `State` is immutable by convention: functions return a new object and never mutate
  the one passed in. This is what makes snapshots and "unchanged" checks reliable.
- "Unchanged" means deep-equal on the whole node (params, content, derived).

---

## 2. Function interfaces

| Function | Owner | Used by |
|---|---|---|
| `affectedSet(edit)` | Role I | UI preview, backend validator |
| `diff(before, after)` | Role I | backend (fills `changed`), UI (highlighting) |
| `generateParty(initialParams)` | Role II | app start, study setup |
| `applyEdit(state, edit)` | Role II + III | UI, bounded condition |
| `regenerateAll(state, edit)` | Role II + III | UI, baseline condition |
| `undo()` / `canUndo()` / `resetHistory()` | Role III | UI |
| `logEvent(e)` / `setSession(s)` | Role IV | UI |

### 2.1 `affectedSet(edit: Edit): NodeId[]`

Pure and synchronous. No network, no UI imports. Returns the dependency closure:
the directly affected nodes plus every node that (transitively) reads them.
Example: `affectedSet({cardId:"card_2", param:"power", value:4})` returns
`["card_2", "overview"]`. Order is not significant; no duplicates.

### 2.2 `diff(before: State, after: State): NodeId[]`

Pure. Returns the IDs of nodes that are not deep-equal between the two states.
One shared implementation, so the backend's `changed` and the UI's highlight agree.
Field-level highlighting inside a changed node is a UI concern and may use a
separate helper.

### 2.3 `generateParty(initialParams): Promise<State>`

`initialParams` is `{ quest, card_1: {cls, power, temperament, gear}, card_2: {...}, card_3: {...} }`; the hero name comes from `cls`.
Calls the model once to write all `content`, computes `derived`, validates, and returns
a full `State`. Also clears undo history. Rejects (throws) on unrecoverable failure;
this only happens at setup, not during a study task. The study uses a **fixed
pre-generated initial party** (saved as JSON) so every participant starts identically.

### 2.4 `applyEdit(state: State, edit: Edit): Promise<UpdateResult>`  (bounded condition)

```ts
type UpdateResult =
  | { ok: true;  state: State; affected: NodeId[]; changed: NodeId[]; latencyMs: number }
  | { ok: false; state: State; error: UpdateError; latencyMs: number };

interface UpdateError { code: ErrorCode; message: string }
type ErrorCode =
  | "MODEL_ERROR"       // network / API failure after the internal retry
  | "TIMEOUT"
  | "INVALID_JSON"      // output did not parse
  | "SCHEMA_MISMATCH"   // fields missing or wrongly typed
  | "OFF_SCOPE_ID"      // returned an ID outside affectedSet(edit)
  | "PARAM_MISMATCH"    // returned params differ from what the app set
  | "OUT_OF_RANGE";     // e.g. power outside 1-10
```

Behavior:

1. Does not mutate `state`.
2. Applies `edit` to the relevant `params` itself (the caller passes the *old* state and the edit).
3. Computes `affected = affectedSet(edit)`. Sends only those nodes to the model; the others go as read-only context.
4. Validates (checks above). On a validation or network failure it retries **once** internally, then fails.
5. On success: recomputes `derived`, pushes the **previous** state onto the undo stack, returns the new state, `affected`, `changed = diff(state, newState)`, and `latencyMs` (Apply to result, including the retry).
6. On failure: pushes nothing, returns the **original** `state` untouched, so the UI needs no rollback logic apart from resetting the widget.
7. If `edit.value` equals the current param value, returns `ok: true` immediately with `changed: []` and no model call.
8. All affected nodes commit together, or none do.

`changed` and `affected` are different things: `affected` is what the graph says
should change; `changed` is what actually differs. In the bounded condition
`changed` is a subset of `affected` by construction.

### 2.5 `regenerateAll(state: State, edit: Edit): Promise<UpdateResult>`  (baseline condition)

Same signature, same result shape, same error codes (except `OFF_SCOPE_ID`, which
cannot occur). Sends the complete state plus the edit and gets the complete structured
response back. Differences:

- Validation still requires valid schema, fixed IDs and `params` equal to the app-set values; `derived` is recomputed.
- `affected` is still computed from `affectedSet(edit)` even though everything was regenerated, so that
  **off-scope changes = `changed` minus `affected`** can be computed for both conditions.
- Pushes to the same undo stack on success, so undo behaves identically in both conditions.

**Prompt (proposed baseline: full regeneration with a preservation instruction).** Draft
for Role II to refine; the signature does not change:

> You edit a party of three characters and an overview. You receive the full current party
> as JSON and one change the user made. Return the full party as JSON in the same schema.
> Change only what the edit requires. Keep every other field, including all text of the
> parts the edit does not concern, exactly as it is. Do not change `id`s, the quest,
> `params` or `derived`.

Fairness rules: (1) the prompt must not list the affected nodes (that is the thing under
test); (2) it must use the same schema, the same read-only evaluation context and the same
example/format instructions as the `applyEdit` prompt; (3) only the scope and the
preservation sentence may differ. Open decision: `spec.md` section 12.

### 2.6 Undo

```ts
undo(): State | null     // pops the most recent snapshot and returns it; null if empty
canUndo(): boolean
resetHistory(): void     // clears the stack; call at task start and after generateParty
```

- The stack lives in the backend state manager (Role III). The UI only calls these and
  then displays the returned state.
- Only successful `applyEdit` / `regenerateAll` push a snapshot. Failed calls push nothing.
- `undo()` is synchronous and makes no model call; it restores the exact previous
  `State`, so undone content is byte-identical to before.
- No redo in the core scope. If a participant needs it, that is a finding, not a bug.
- After `undo()` the UI also resets the widgets to the restored `params`.
- Undo is logged (`undo_click`) but is not an `UpdateResult`.

### 2.7 Logging functions

```ts
setSession(s: { participantId: string; condition: Condition; taskId: string }): void
logEvent(e: LogEvent): void
```

`setSession` is called once per task so the UI does not pass those fields on every event.
`logEvent` appends the event with the session fields and a `timestamp` (ms since epoch).

### 2.8 How the UI presents errors and undo (Role I's side of the contract)

**Errors.** On `ok: false` the UI keeps the pending edit, shows a red bar with the
message below plus "Nothing was changed. Try Apply again, or Cancel.", and renames
Apply to "Retry". It does no rollback because `state` is the unchanged original.
`error.message` is for developers and logs; the user sees the mapped text. The
text lives in `ERROR_TEXT` in `src/client/App.tsx`.

| `code` | Text shown to the user |
|---|---|
| `MODEL_ERROR` | Couldn't reach the model. |
| `TIMEOUT` | The model took too long to answer. |
| `INVALID_JSON`, `SCHEMA_MISMATCH` | The model's answer was malformed. |
| `OFF_SCOPE_ID` | The model tried to change something outside the affected parts. |
| `PARAM_MISMATCH` | The model's answer didn't match your settings. (Also used for a changed quest.) |
| `OUT_OF_RANGE` | The model's answer had an out-of-range value. |
| `INVALID_EDIT` | That change isn't allowed (a hero can appear only once in the party). Returned before any model call, by `isEditAllowed`. |

If you add an error code, add its text to `ERROR_TEXT` (the type forces you to).

**Undo.** The Undo button calls `undo()`. It is disabled when `canUndo()` is false,
when an edit is pending, or while an update is running. After undo the UI replaces
its state with the returned one and clears any error. No redo.

**Testing the error state without a real backend:** open the app with `?fail` in the
URL; the fake backend then fails every update.

---

## 3. Log events

```ts
type Condition = "bounded" | "baseline";

interface LogBase {
  participantId: string;
  condition: Condition;
  taskId: string;
  timestamp: number;     // added by logEvent
}
```

| Event | Fired by | When | Extra fields |
|---|---|---|---|
| `task_start` | UI | participant begins a task | |
| `task_end` | UI | participant says done / task submitted | |
| `card_enter` | UI | pointer enters a card, or a card receives focus | `cardId` (includes `"overview"`) |
| `card_leave` | UI | pointer leaves a card, or it loses focus | `cardId` |
| `param_preview` | UI | a widget changes before Apply | `cardId, param, from, to, previewedAffected` (bounded: the previewed set; baseline: `[]`) |
| `apply_click` | UI | Apply pressed | `edit` |
| `apply_result` | UI | the promise from `applyEdit`/`regenerateAll` settles | `ok, latencyMs, affected, changed, offScope, errorCode?` |
| `undo_click` | UI | Undo pressed | |

Definitions and rules:

- `offScope` = `changed` minus `affected`, computed once in the UI wrapper (so it is the same for both conditions). Expected `[]` in the bounded condition.
- **Dwell time** is derived in analysis from `card_enter`/`card_leave` timestamps. Overlapping pairs are summed per card. A card counts as *unaffected* for dwell purposes if it was not in `affected` of the most recent `apply_result`. Dwell before the first Apply is excluded from the "unaffected" measure.
- Hover/focus dwell is a proxy, not gaze. State this in the paper.
- **Completion time** = `task_end` minus `task_start`.
- **Latency** = `latencyMs` on each `apply_result`.
- Events are append-only. The study role owns persistence (one JSON-lines file per participant per task) and the analysis scripts. Do not log participant names; `participantId` is an opaque code.
- Session fields come from the URL: `?condition=bounded|baseline&participant=P01&task=t1`. The page calls `setSession` with them on load.
- The UI already fires every event above except `task_start` / `task_end`, which belong to the task harness.
- `previewedAffected` is `affectedSet(edit)` in the bounded condition and `[]` in the baseline (no scope preview there).

---

## 4. Changing these contracts

1. Say it in the group chat first, with the exact change.
2. Update this file and `spec.md` sections 7-8 in the same commit.
3. Bump nothing silently: renamed fields or events break other people's code.

## 5. Decisions that need a yes/no from the team

1. One pending edit at a time (so `Edit` is a single object, not an array).
2. Undo history lives in the backend, not the UI.
3. Failed updates return the original state, so the UI needs no rollback.
4. Retry exactly once, inside `applyEdit` / `regenerateAll`.
5. Fixed pre-generated initial party for the study.
6. No redo in the core scope.
