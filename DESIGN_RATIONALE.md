# Design rationale: why the interaction works this way

For the teammates who write the report. It starts from the problem a player has, says which
theory guides the design, shows what in the demo answers each part of it, how we differ from
the closest related work, and how we would evaluate it. Nothing here changes the code or the
data format. For the rules of the demo see `RULES.md`; for what each role does see `NOTICE.md`.

**Writing rule for the report (from the instructor's feedback on the proposal):** talk about
the party builder from the first sentence, in plain words. Do not use the code's terms
(see the glossary at the end) before explaining them.

Status words: **built** (in the demo now), **future work** (only mentioned in the report).
The claims about the three papers were checked against the PDFs (page numbers are those of the
PDFs). The references in section 8 still need their details verified before citing.

---

## 1. The problem

A tabletop-RPG player builds a party of three heroes for a quest. Each hero has a few settings
(which hero, how strong, temperament, gear) and a short written story with abilities. When the
player changes one setting, for example makes Brann weaker, two things should be rewritten:
Brann's story, and the party summary that talks about Brann. The other two heroes should stay
exactly as they are.

If a language model (LLM) writes the text, the easy way is to ask it to rewrite the whole party.
Then three things go wrong for the player:

- **They cannot say "change only this hero."** Nothing in the tool lets them say it.
- **They have to hunt for what changed.** Every card may be different, so they re-read all of
  them.
- **Text they liked may be gone.** A hero they were happy with has been reworded for no reason.

Our demo changes only the cards that depend on the setting the player touched. The player sees
which cards before pressing Apply, and which changed and why after. (In the code this rule is
called "local consistency". Say the plain sentence first in the report, and name it only after.)

## 2. The guiding theory

We use Donald Norman's idea of two gaps between a person and a tool:

- **Gap between wanting and doing (gulf of execution).** The player knows what they want ("only
  change Brann") but the tool gives no way to say it, or no way to know what it will do.
- **Gap between the result and understanding (gulf of evaluation).** The tool did something,
  but the player cannot tell what changed or why.

Direct manipulation (Shneiderman 1981; Hutchins, Hollan and Norman 1985) says how to shrink
both gaps: objects you can see, small reversible actions, and immediate visible results. An
LLM that rewrites text breaks these promises. You cannot predict what an edit will touch, the
result is not a small visible step, and you cannot tell what the edit changed. So both gaps get
wider.

Our design answers each gap with one thing the player can see:

- **Before Apply, a preview** shows which cards will change (shrinks the first gap).
- **After Apply, a marked-up result** shows what changed and why (shrinks the second gap).
- **Undo** keeps every action reversible.

(Technical name for the preview: *feedforward*, information shown before an action about what
it will do. See the note below on where this term comes from.)

### How the closest papers use theory

| Paper | Theory | How it becomes design |
|---|---|---|
| Zhang et al., *From Words to Widgets for Controllable LLM Generation* (UIST 2026), "Malleable Prompting" | Norman's two gaps; direct manipulation | Two design goals, one per gap (DG1 for the first, DG2 for the second); each feature is tagged with its goal |
| Chung et al., *TaleBrush* (CHI 2022) | Norman's two gaps (its section 8.1) | Explains why each control and each visualization exists |
| Suh et al., *Luminate* (CHI 2024) | Divergent and convergent thinking, design space | Five numbered design goals, each feature tagged |

We follow the first paper: **two design goals, one per gap, with each feature tagged by its
goal.** (Checked: that paper names the two gaps in its introduction, derives DG1 and DG2 from
them in section 3.3, p. 4, and says its prototype is guided by the two goals and by direct
manipulation. It cites Hutchins, Hollan and Norman 1985 for the first gap and Norman 1986 for
the second. TaleBrush section 8.1, p. 14, cites Norman's *The Design of Everyday Things*.)

**"Feedforward" is our word, not theirs.** None of the three papers uses it, and the closest
paper has no preview of a control's effect before it is applied. It needs its own source in the
report (the usual one is the HCI literature on feedforward; see section 8). A bridge to the
closest paper: its discussion (section 7.2, p. 11) says future designs could show previews to
help users picture what a control will do. So the claim is: **we build the preview that paper
names as future work, for a different kind of control.**

**Our weak point.** Those papers test their goals with users. We pick the same two goals but
have not run a study. Say plainly that the goals come from Norman's framework and the closest
paper, and that testing them is the planned study.

## 3. Design goals and what the demo does

### DG1: say what you want to change, and know what it will touch

| What the player sees | Detail | Status |
|---|---|---|
| Direct controls | Hero picker with portraits and names, a power slider, temperament, gear. No prompt to write. | built |
| Hero list | A list of all heroes grouped by role, with the ones in the party marked, so the quest's requirements can be matched to heroes without leaving the page | built |
| Preview before Apply | The cards that will be rewritten are outlined, each with a reason ("Reads Brann, which is changing"); the others say they stay as they are | built |
| Numbers now, text later | Attack, Defense, the rating and the quest ticks update while you drag (plain arithmetic). The text waits for Apply, because the model writes it. | built |

### DG2: see what changed and why, with less to check

| What the player sees | Detail | Status |
|---|---|---|
| Change marks | New text underlined in green, removed text struck through in red. Untouched cards say "Unchanged". | built |
| Untouched cards stay identical | Only the dependent cards are sent to the model. The others are carried over by the app, so this does not depend on the model behaving. | built |
| Reason for each change | After Apply, each rewritten card says why: "Updated because you changed Brann's power from 7 to 3"; the overview says "Updated because it reads Brann: …". In the whole-party version, a card that was rewritten without depending on the edit says "Rewritten by the whole-party update, though it doesn't depend on your edit." | built |
| Arrow from edited card to overview | Labelled "reads Brann". Dashed while previewing (our version only; the whole-party version previews nothing), solid after Apply in both. It is the same arrow before and after, so what was promised and what happened can be compared. | built |
| Undo | Goes back one step | built |
| Best party so far | A small block under the quest keeps the highest-rated party of the session (best rating first, then most requirements met; ties kept, up to 3). Restore brings one back with one click, without rewriting anything; Undo reverses it. | built |

The last row has a precedent: the closest paper's DG2 asks to organize drafts around
configurations instead of a linear history, so users can compare, revert and branch. In its
study, 8 of 12 participants said its version control and attribution features together helped
them evaluate outputs (p. 10; the paper does not separate the two). Our best-party block is a
much smaller version of that idea.

## 4. How this differs from the closest work

The closest paper (Malleable Prompting) turns style wishes in a prompt (tone, length, format)
into sliders and toggles, steers the model while it writes, and shows which words of the output
each control influenced.

| | Malleable Prompting | Ours |
|---|---|---|
| What a control does | Changes **how** one text is written | Changes a **setting** of a multi-part thing, and that decides **which parts** are rewritten |
| When the effect is shown | **After** writing; word-level, based on probabilities, and the authors say it is not a causal explanation | **Before** (which cards, from a fixed hand-written table) and after (what changed and why) |
| Unit | Words and sentences | Cards, plus a word-level mark-up inside each card |
| Guarantee | None; the model may change anything | Untouched cards never reach the model, so they stay identical |
| Kind of contribution | A new decoding method and a user study (12 participants) | An interaction design and a plan for a study |

Say it as complementary: they let people steer **how** a text reads; we let players know
**where** an edit will land. The sharpest claim: **a preview that is exact, because the scope
comes from a fixed table, instead of an approximate explanation afterwards.** Do not claim to
be the first to turn controls into widgets.

Points from that paper we can use:

- Some participants (3 of 12) preferred coarser attribution to word-level highlights, and the
  authors suggest choosing the level by type of attribute. A whole card is a coarse unit by
  design.
- Its discussion suggests showing previews so users can picture what a control will do (it
  cites Subramonyam et al. on the "gulf of envisioning"). Our preview is one such preview.
- Participants preferred plain language for simple, well-defined tasks. State this as a limit:
  our task is structured, so the result may not carry over.

Other papers:

- **Luminate** helps people explore many ideas first. We support the next step: after choosing
  a party, change one thing about it without disturbing the rest. Its future work asks whether
  interaction with LLMs can go beyond writing prompts; our controls are one answer.
- **TaleBrush** also explains its interaction with Norman's two gaps. It names tabletop
  role-playing games as a place where generating several stories is useful, which supports our
  scenario.

## 5. Evaluation plan (to be described in the report, not run)

We follow the closest paper: it compared its system with a plain chat interface using the same
model, 12 participants, each trying both, with the order balanced, about 90 minutes per
session, a task with a clear target, a questionnaire tied to the design goals, and a short
interview.

**Design.** 8 to 10 participants, each trying both versions. Each does two tasks (two quests,
`?task=t1|t2`), one with each version, with the order balanced across participants (the
`?admin` page suggests it). Both versions use the same model.

- **Our version** (`bounded` in the code): only the dependent cards are rewritten.
- **Whole-party version** (`baseline`): all three cards are rewritten, with the instruction to
  keep everything else unchanged. Changes are marked in both versions
  (`HIGHLIGHT_CHANGES_IN_BASELINE`), so the comparison is about how much is rewritten, not
  about the marks.

**Task.** A quest with requirements that can be checked, like the target-based ("Jeopardy")
tasks of the closest paper: players are given a target and must reach it.

**Research questions (same shape as the closest paper).**

- RQ1. Does knowing in advance which cards an edit will touch help players control the result?
- RQ2. Does it help them see what an edit changed, and why?
- RQ3. How do players use the preview, the marks and undo, and what goes wrong?

**Measures, tied to the goals.** Most come from the log events defined in `contracts.md`
(`apply_result` with `offScope`, `card_enter`, `card_leave`, `undo_click`, `restore_best`).

| Goal | Question | Measure |
|---|---|---|
| DG1 | Could players tell what would change? | Rating "I could tell what would change before I pressed Apply"; Apply results followed by undo |
| DG2 | Could they tell what changed and why? | Time on cards after Apply; whether they noticed unexpected changes (whole-party version); rating "I could tell what changed and why" |
| DG2 | Did they have less to check? | Count of changes outside the cards the edit depends on (`changed` minus `affected`); time on untouched cards |
| DG2 | Did they dare to try? | Number of Apply, undo and restore actions per task; rating "I felt free to try different options" |
| Overall | Task result | Quest requirements met at Finish, and the rating |
| Overall | Experience | Perceived control, transparency and trust, on a 7-point scale |

**Analysis.** Paired comparison for a small sample (the closest paper used the Wilcoxon
signed-rank test with a correction for several tests), plus the log counts above.

**Interview.** Adapt the closest paper's questions, for example: "When you changed a setting,
how easy was it to tell what changed and why? Can you give an example?" and "Tell me about a
time you felt stuck or confused."

## 6. Known limits to state honestly

- **Small edit, big rewrite.** TaleBrush found that when players made small changes the
  generation felt unresponsive, because a whole sentence was replaced and they expected a slight
  change. We have the same issue inside a card: changing Power by one can rewrite the whole
  backstory. Our rule limits which cards change, not how much of a card changes. The marks make
  the amount visible. A "revise minimally" instruction in the prompt is a possible fix (Role II).
- **The preview shows where, not what.** It says which cards will be rewritten, not what the
  new text will say, because that only exists after the model runs.
- **A structured task.** The closest paper found that people preferred plain language for
  simple, well-defined tasks. Our task is structured, and a four-setting game is small. The
  claim is about this case, not about all generative tools.

## 7. What not to claim

- Do not describe future-work items as built; check the status column above.
- Do not use the code's terms (glossary below) before explaining them in plain words.
- Do not claim to be the first to turn controls into widgets.

## 8. References to cite (verify details before use)

- Zhang, Liu, Nie, Rzeszotarski, Huang, August. *From Words to Widgets for Controllable LLM
  Generation.* UIST 2026.
- Chung, Kim, Kim, Lee, Chang, Kim. *TaleBrush: Sketching Stories with Generative Pretrained
  Language Models.* CHI 2022.
- Suh, Min, Heo, Liu, Han, Choi, Yoo, Jin, Lee, Kim, Kim. *Luminate: Structured Generation and
  Exploration of Design Space with Large Language Models for Human-AI Co-Creation.* CHI 2024.
- Norman. *Cognitive Engineering.* In *User Centered System Design*, 1986.
- Hutchins, Hollan, Norman. *Direct Manipulation Interfaces.* Human-Computer Interaction,
  1985.
- Shneiderman. *Direct Manipulation: A Step beyond Programming Languages.* 1981.
- Subramonyam, Pea, Pondoc, Agrawala, Seifert. *Bridging the Gulf of Envisioning.* CHI 2024.
- For "feedforward" (not in the three papers; from memory, look up and verify): Djajadiningrat,
  Overbeeke, Wensveen. *But how, Donald, tell us how?* DIS 2002; Vermeulen, Luyten, van den
  Hoven, Coninx. *Crossing the Bridge over Norman's Gulf of Execution: Revealing Feedforward's
  True Identity.* CHI 2013.

## Glossary: code term, plain words

| In the code and other docs | In the report, say |
|---|---|
| local consistency | only the cards that depend on the changed setting are rewritten; the rest stay identical |
| node | card (a hero card or the party overview) |
| affected set, closure | the cards the edit depends on ("will change") |
| dependency table | a short hand-written list of which card reads which |
| `bounded` | our version (rewrites only the dependent cards) |
| `baseline` | the whole-party version (rewrites all cards) |
| off-scope change | a change to a card that does not depend on the edit |
| feedforward | the preview before Apply |
| attribution | the line saying why a card was rewritten |
| gulf of execution / evaluation | the gap between wanting and doing / between the result and understanding it |
