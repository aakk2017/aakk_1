# Non-Omission Instruction for Coding AI — Lead / Follow / Multiplay Legality

This instruction exists to prevent the coding AI from omitting mandatory legality checks.

The Shengji project is a **strict rules engine**.
The implementation must not skip legality checking for leads, follows, multiplays, or evaluation-critical edge cases.

---

## 1. Mandatory rule-engine checks

Before an action is accepted by the authoritative engine, the implementation must explicitly perform the following checks.

### 1.1 Lead legality

A lead must be checked for:

- single-division requirement
- correct canonical decomposition
- one-element vs multiplay distinction
- failed-multiplay handling
- fake-multiplay handling according to the current project policy

A mixed-division intended lead is illegal.

A one-element lead is **not** a multiplay.

### 1.2 Follow legality

A follow must be checked with the full follow-legality pipeline, including:

- exact volume match with the lead
- short-division rule
- DFP (Division Follow Procedure)
- SFP (Structural Follow Procedure) for non-single led elements
- filler handling after structured obligations
- forehand control effects when active
- existential legality of the selected cards

Do **not** replace this with a loose heuristic like “same suit first” or “same division if possible”.

### 1.3 Cover / ruff evaluation

After a follow is accepted as legal, evaluation must still distinguish among:

- discard
- division-follower
- potential ruff

For one-element rounds, order comparison is allowed only for **same-type** covers.

A same-division follow of a different type may be legal, but it is lower and cannot cover.

A non-covering potential ruff must be treated as a discard.

### 1.4 Round winner determination

The round winner must be determined using the cover/ruff logic, not by naïve highest-card comparison.

### 1.5 Counting phase

The frame score must not stop at trick score only.

The implementation must run the counting phase and add:

- trick score won by attackers
- base score if attackers win the base
- endgame-factor / compensation logic if enabled by the preset

Only after that may the implementation produce the final frame score.

---

## 2. Functions that must exist explicitly

The implementation should contain explicit functions or equivalent modules for at least the following responsibilities.

### 2.1 Lead-side legality / evaluation functions

- resolve lead canonically
- detect failed multiplay
- detect fake multiplay under current project policy

### 2.2 Follow-side legality functions

- SFP for one non-single led element
- DFP for the whole lead
- full follow legality check

### 2.3 Round evaluation functions

- classify follow as discard / division-follower / potential ruff
- determine whether a legal follow is a cover
- update round state after each accepted follow
- determine round winner

### 2.4 Counting/finalization functions

- count counters in tricks
- compute base score
- apply endgame factor / ending compensation / preset-dependent logic
- finalize frame score

If these functions are missing, the implementation is incomplete.

---

## 3. Specific omissions to avoid

The coding AI must not omit any of the following.

### 3.1 Do not omit DFP/SFP

Do not simplify follow legality into informal matching.
DFP and SFP are core rule procedures and must be implemented.

### 3.2 Do not omit failed-multiplay handling

A multiplay cannot be treated as automatically accepted just because the cards are selected.
Its failure/blocking logic must be evaluated.

### 3.3 Do not omit one-element same-type restriction

In a one-element round, a same-division follow of a different type must not be allowed to cover merely because its core order is high.

### 3.4 Do not omit base score from final frame score

The final frame score must include counting-phase updates, not just running trick score.

### 3.5 Do not omit event emission after authoritative decisions

The authoritative engine must emit or otherwise expose decision results such as:

- lead accepted / rejected
- follow accepted / rejected
- failed multiplay detected
- fake multiplay detected
- cover occurred
- ruff occurred
- round ended
- frame score changed

---

## 4. Minimum acceptance pipeline

The authoritative engine should follow this minimum action pipeline.

### 4.1 Lead pipeline

1. receive intended lead
2. check mechanical validity
3. check lead legality
4. resolve canonical lead
5. detect failed multiplay
6. detect fake multiplay under current policy
7. accept/reject lead
8. emit authoritative event

### 4.2 Follow pipeline

1. receive intended follow
2. check mechanical validity
3. run full follow legality check
4. accept/reject follow
5. classify accepted follow for evaluation
6. update round state
7. emit authoritative event

### 4.3 End-of-round pipeline

1. determine winner from round state
2. add trick counters to frame score if attackers won
3. update attacking streak
4. emit round-ended event

### 4.4 End-of-frame pipeline

1. reveal/score base if needed
2. apply base multiplier / endgame factor / compensation according to preset
3. compute final frame score
4. update level result
5. emit frame-ended event

---

## 5. Instruction to coding AI

If any legality or counting module is not yet implemented, do **not** silently substitute a weaker rule.

Instead:

- leave a clearly marked TODO
- document what is incomplete
- do not pretend the implementation is rules-complete

This project values correctness over partial hidden shortcuts.
