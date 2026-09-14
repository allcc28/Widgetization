# Local-Consistency Widgetization: Direct Manipulation of Structured Parameters in LLM Responses

## 1. Motivation

Conversational interfaces have become the default way people interact with large language models, but this modality is poorly suited to *iterative, parametric refinement* — a common pattern in tasks like trip planning, budget allocation, or outline drafting, where a user wants to tweak one specific value (a budget, a tone, an ordering) without re-describing the entire request. Prior work has documented that non-expert users struggle to translate an intended change into an effective natural-language edit (Zamfirescu-Pereira et al., 2023), and that purely textual re-prompting breaks the sense of control and predictability that direct manipulation interfaces are designed to preserve (Shneiderman's classic principles, as revisited by Masson et al., 2024 in DirectGPT).

At the same time, systems that generate structured, malleable UIs from LLM output (Cao et al., 2025; Zhang et al., 2026, "Words to Widgets") show that exposing tunable parameters as GUI controls can restore some of this control — but a key open problem, visible in both systems' future-work discussions, is **how to update only the parts of the output that are actually affected by a parameter change**, without regenerating (and silently altering) everything else. Naively re-querying the LLM on every widget interaction causes unrelated text to drift, undermining the very predictability that motivated widgetization in the first place.

This project narrows that problem to a single, well-scoped question: **can a data-model-mediated architecture make parametric edits to LLM responses both interactive and locally consistent — and does this show early evidence of reducing user confusion and re-reading effort compared to whole-response regeneration?**

## 2. Related Work

- **From Words to Widgets for Controllable LLM Generation** (Zhang et al., 2026) — motivates extracting controllable parameters from LLM output as UI widgets; this project narrows their app-level scope to single-turn response editing with an explicit local-update mechanism.
- **Generative and Malleable User Interfaces (Jelly)** (Cao et al., 2025) — introduces task-driven data models as the substrate for generative UI; this project adapts a similar data-model layer but focuses specifically on the regeneration-consistency problem left as future work.
- **DirectGPT** (Masson et al., 2024) — grounds the design in classic direct-manipulation principles (visibility, predictability, reversibility), which this project uses as the basis for evaluation criteria.
- **Why Johnny Can't Prompt** (Zamfirescu-Pereira et al., 2023) — establishes the empirical motivation that non-expert users struggle with iterative re-prompting.

**Novelty claim.** We are not the first to propose widgetizing LLM output — that framing is established by Zhang et al. (2026) and Cao et al. (2025). Our contribution is narrower and more concrete: we treat *local consistency under partial edits* as the primary design goal and system-level mechanism (a dependency-graph-mediated re-render, rather than a general-purpose generative UI), and we evaluate it directly against full-response regeneration — a comparison neither prior system reports.

## 3. System Design

**Two-layer architecture** (data model → rendering), rather than direct text generation:

1. **Structured generation.** For a given request, an open-source LLM (Qwen2.5 or Llama 3.1, hosted via Groq's free-tier API for inference speed and evaluation-session reliability, using JSON mode with an explicit schema-and-example prompt) produces a JSON data model composed of independently addressable nodes (e.g., `Day1 {budget, pace, activities[]}`, `Day2 {...}`). Each node stores both raw values and a rendered text span. Because Groq's JSON mode does not strictly enforce a schema, generated output is validated client-side with a fallback re-prompt on malformed JSON — an explicit, discussable design decision rather than a hidden failure mode.

2. **Parameter taxonomy (MVP scoped to 2 types, feasible for a 2-person team; drag-to-reorder is a stretch goal if the timeline allows):**
   - *Numeric* (budget, duration) → slider, with LLM-suggested min/max.
   - *Categorical* (tone, pace, style) → segmented control / dropdown, with LLM-suggested option set.
   - *(Stretch) Ordered list* (itinerary order, outline items) → drag-to-reorder list, added only after the MVP pipeline is stable.

3. **Dependency graph: hand-authored per domain, not inferred by the LLM at runtime.** Because the deployment is scoped to a single domain (trip-itinerary planning), the edges between parameters and the text nodes they affect are declared once, by the developers, as part of the domain schema — e.g., `Day[i].budget → Day[i].activities_text` (never `Day[j]`), `tone → all_prose_spans`. The LLM fills values into this structure at generation time; it never decides *what depends on what*. This is a deliberate choice: letting the LLM infer its own dependency graph per generation would just relocate the "should this text change?" judgment rather than remove it, undermining the project's central claim.

4. **Local update on interaction.** When a widget changes, two things can happen, and the UI distinguishes them explicitly:
   - **Instant, value-only widgets** (numeric fields): the corresponding raw value in the data model updates deterministically client-side with no LLM call — this is the only case where "instant feedback" is literal.
   - **Pending, prose-dependent widgets** (categorical, and later ordered-list): the raw value updates instantly, but any text node linked to it via the schema's dependency graph is marked "updating" in the UI while it is re-rendered by the LLM. Untouched nodes are passed back into the re-render prompt as style/content anchors ("keep consistent with the following unchanged sections: ...") to prevent stylistic drift.

This turns "should this text change?" into a static dependency-graph lookup, authored once at design time, rather than an implicit judgment the LLM re-makes on every edit — the project's core technical contribution.

**Scope constraint:** single domain (trip-itinerary planning) to keep the parameter taxonomy and dependency graph tractable within the term, given a two-person team.

## 4. Evaluation Plan

**Design:** Within-subjects comparison, 8–10 participants (colleagues/classmates familiar with LLM chat tools), recruited and run jointly by both team members.

- **Condition A (baseline):** parameter change → full response regenerated via re-prompt.
- **Condition B (proposed):** parameter change → local-consistency update as described above.

**Tasks:** 2–3 short itinerary-adjustment tasks per condition (e.g., "lower the budget for day 2," "reorder days 1 and 3").

**Measures:**
- Re-inspection of unrelated sections, operationalized as cumulative hover/focus dwell time on unchanged text nodes during each task (lightweight event logging built into the prototype UI), supplemented by post-task self-report.
- Post-task confidence/predictability rating (Likert).
- Preference ranking and think-aloud comments, coded qualitatively against direct-manipulation criteria (visibility, predictability, reversibility).

**Expected contribution:** a lightweight architectural pattern for local-consistency updates in parameter-driven LLM interfaces, plus early evidence on whether it improves perceived control relative to full regeneration — framed as a design contribution rather than a claim of statistical significance, given the small-N formative study.

## 5. Task Division (Team of 2)

*To be finalized with teammate; two natural splits to consider:*

- **By module:** Member A owns structured generation + dependency graph (backend/data model); Member B owns widget UI + local-render pipeline (frontend). Both co-design the parameter taxonomy.
- **By phase:** Both members co-build the core prototype together, then split evaluation logistics (recruiting, running sessions, coding qualitative data) roughly in half.

Either split works with the architecture above since the data-model layer and the rendering/widget layer are already separated by design.

## 6. Tentative Timeline

| Milestone | Target |
|---|---|
| Proposal validation with instructor | Week 3 |
| Structured-generation pipeline (data model + 2 MVP parameter types) | Week 5 |
| Widget UI + dependency-graph local update (MVP) | Week 8 |
| Stretch: ordered-list widget + dependency edges (if on schedule) | Week 9 |
| Pilot testing & refinement | Week 10 |
| Formal 8–10 participant study | Week 12 |
| Final report + video demo | Week 14