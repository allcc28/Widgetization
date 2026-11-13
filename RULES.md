# Character Builder: the rules

What this is, explained like the rules of a board game. Part 1 is for players (it can be read
to a study participant as is: it does not mention the two study conditions). Part 2 is for the
team.

---

## Part 1. How to play

### The goal
Put together a party of three heroes that can complete a **quest**. The quest names what the
party needs (for example "at least 2 tanks" and "total defense at least 24"). Change your
heroes until every requirement has a tick, then press **Finish task**.

### What you have
- **Three slots**, each holding one hero card.
- **Eight heroes**, one per class. Each hero has a fixed name, portrait and role. A hero can be
  in the party **once**: a hero already in another slot is greyed out.
- Each card has four things you can change, called **parameters**:

| Parameter | What it is | Choices |
|---|---|---|
| Hero | Which hero holds this slot | 8 heroes (pick a portrait) |
| Power | How strong the hero is | slider, 1 to 10 |
| Temperament | How the hero behaves | cautious, reckless, loyal, cunning, cheerful, brooding |
| Gear | The hero's equipment | worn, standard, fine |

### The heroes
A **Heroes** panel under the quest always shows all eight heroes grouped by role, with the ones
already in your party greyed out and marked with their slot. It is for reference only. You pick
heroes on the cards, where each portrait also shows its role.


| Hero | Class | Role |
|---|---|---|
| Aldric | Paladin | Tank |
| Brann | Berserker | Tank |
| Mira | Ranger | Damage |
| Orin | Mage | Damage |
| Vex | Rogue | Damage |
| Sela | Cleric | Support |
| Tobin | Bard | Support |
| Rowan | Druid | Support |

### Taking a turn
1. **Change one control.** The page shows what *would* change before anything happens: the
   cards that will be updated are outlined, and each card says why ("This is the card you are
   editing", "Reads Brann, which is changing", "Doesn't depend on this edit").
2. **Look at the numbers.** Attack, Defense, the rating and the quest ticks update at once while
   you drag, because they are simple sums (see below). Nothing has been rewritten yet.
3. **Press Apply** to commit the change, or **Cancel** to drop it. Only one change can wait at
   a time.
4. **See what changed.** After Apply, new text is underlined in green and removed text is struck
   through in red; cards that did not change say "Unchanged". "Hide changes" shows the plain text.
5. **Undo** goes back one step if you do not like the result.

If an update fails, you see a message, nothing is changed, and you can retry or cancel.

### How the numbers work
Everything in this section is plain arithmetic done by the app. No AI is involved.

**Attack** = Power + role bonus + temperament modifier + gear modifier.
**Defense** is built the same way. Neither goes below 1.

| Role | Attack | Defense |
|---|---|---|
| Tank | 0 | +2 |
| Damage | +2 | 0 |
| Support | 0 | 0 |

| Temperament | Attack | Defense |
|---|---|---|
| cautious | −1 | +2 |
| reckless | +2 | −2 |
| loyal | 0 | +1 |
| cunning | +1 | 0 |
| cheerful | 0 | 0 |
| brooding | +1 | −1 |

| Gear | Attack | Defense |
|---|---|---|
| worn | −2 | −2 |
| standard | 0 | 0 |
| fine | +2 | +2 |

Example: Brann (Berserker, so Tank), Power 7, reckless, standard gear. Defense = 7 + 2 − 2 + 0 = 7.

The overview card has a **"How is this scored?"** panel that shows this, term by term, for
your current party.

### The rating
The party gets a rating from **S** (best) to **D**. Start from the average of the three heroes'
strength, where a hero's strength is (Attack + Defense) ÷ 2: 8 or more is S, 6.5 or more is A, 5
or more is B, 3.5 or more is C, below that is D. Then drop **one grade** for each of these:

- a missing role (no Tank, no Damage, or no Support);
- a gap of more than 4 between the strongest and weakest Power;
- each quest requirement that is not met.

A tank whose Defense is below 6 is pointed out as a warning, with no grade lost. The rating is
a simple guide, not a claim about real game balance.

### The quests
Each task gives you one quest with two requirements.

| Quest | Requirements |
|---|---|
| Siege of Blackrock Keep | at least 2 tanks; total defense at least 24 |
| The Plague Village | at least 2 supports; no Berserker |
| The Dragon's Hoard | at least 2 damage heroes; total attack at least 26 |
| The Moonlit Heist | includes the Rogue; total attack at least 24 |
| The Haunted Wood | includes the Druid; total defense at least 22 |
| The Council of Elders | includes the Bard; at least 2 supports |
| The Ember Arena | total attack at least 28; no Cleric |
| The Frozen Pass | includes the Paladin; power gap at most 2 |

Every quest can be solved, and none is solved at the start.

---

## Part 2. For the team: how it works underneath

### Three kinds of data on a card
| Layer | Written by | Examples |
|---|---|---|
| `params` | the player, through the controls | hero (class), power, temperament, gear |
| `derived` | the app, by arithmetic | hero name, role, attack, defense, party rating, quest ticks |
| `content` | the AI model | each hero's backstory and abilities, the overview summary |

The model writes only `content`. It never sets a parameter, a name, a number or the quest.

### What is local consistency here
Changing one control **regenerates only the nodes that depend on it**: that hero's card and the
party overview. The other cards are not sent to the model at all, so they stay word for word the
same, and this does not rely on the model behaving. Which nodes depend on which is a short
hand-written table (`src/shared/dependencies.ts`). The model never decides it.

### One update, step by step
1. **Preview** (no model call, instant): compute the affected set from the table.
2. **Apply**: ask the model to rewrite only the affected nodes, giving the others as read-only context.
3. **Validate**: JSON and schema valid; every returned ID is inside the affected set; the
   parameters match what the player set; values in range; the quest unchanged. Anything else
   is rejected and nothing changes.
4. **Commit** all affected nodes together, keeping a snapshot for Undo.
5. **Highlight** what changed.

### Study sessions
A session is one participant doing one task in one condition, launched with
`?condition=bounded|baseline&participant=P01&task=t1|t2`. The researcher sets it up on the
`?admin` page, which also suggests a balanced condition order. The two conditions differ only
in how much is regenerated on Apply: only the dependent nodes, or the whole party (with the
instruction to keep everything else unchanged). Everything else, including the quest, is the same.
More in `NOTICE.md` section 8.

### Where to look
`NOTICE.md` (what to do, by role) · `contracts.md` (exact formats) · `spec.md` (design) ·
`CREDITS.md` (portrait credits and terms).
