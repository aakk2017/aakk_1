# Immediate Correction Required — Preset Drift, Sorting Error, and Full Dangerous-Drift Audit

This note combines two already observed implementation failures:

1. `PRESET_CONFIGS.default.mustStopLevels` is still wrong
2. card sorting is wrong (`V` appeared ahead of `W`)

These are not isolated cosmetic issues.
They are evidence that the implementation still contains hidden spec drift.

The coding agent must treat this as a strict correction task, not as a minor patch.

---

## 1. Failure 1 — `mustStopLevels` is still wrong

The field

```text
PRESET_CONFIGS.default.mustStopLevels
```

still contains values that do not match the authoritative rule/spec files.

Therefore:

- the preset audit is incomplete
- the code is still non-conformant
- the implementation must not be considered finished

### Required action

1. Locate the authoritative rule/spec definition for the default preset's `mustStopLevels`.
2. Replace the current code value with the exact authoritative value.
3. Search the entire codebase for every other occurrence of:
   - `mustStopLevels`
   - hardcoded must-stop-level arrays
   - derived must-stop-level logic
   - comments that still describe old values
4. Correct all of them.

### Required report format

Reply in this exact format:

```text
Authoritative spec value:
Old code value:
New code value:
All files changed:
Any remaining occurrences of old values: YES / NO
```

### Strict rule

Do not answer with vague claims such as:

- "I modified a lot of things"
- "the preset system was updated"
- "it should now be aligned"

unless the exact field above has been corrected and all remaining old occurrences have been removed or explicitly listed.

---

## 2. Failure 2 — `W` must sort above `V`

A visible sorting bug is present.

Observed issue:
- `V` is displayed ahead of `W`

This is wrong.

In Shengji sorting, `W` must be higher than `V`.

Therefore:

- if display order is descending, `W` must appear before `V`
- if display order is ascending, `V` must appear before `W`

The current display order is inconsistent with the intended hand ordering rule.

### Required diagnosis

Check all of the following:

1. card order assignment for jokers
2. sort comparator used for hand rendering
3. sort comparator used for move rendering
4. any fallback sort by raw rank / label / string
5. any separate sort path for trump cards

### Required correction

The rendered order must be based on authoritative Shengji `order`, not on:

- raw rank
- card label string
- lexical comparison
- legacy deck index

The joker order must satisfy:

```text
W > V
```

under the project's Shengji order model.

### Required audit scope

Search for every place that sorts cards, including:

- hand rendering
- played-move rendering
- exposed-card rendering
- compact card-corner rendering if sorted
- counting-phase dialog rendering
- helper functions reused by bot logic

### Required report format

Reply in this exact format:

```text
Bug source:
Old comparator / old order logic:
New comparator / new order logic:
Files changed:
All sorting paths audited: YES / NO
Any remaining rank-based or string-based sorting: YES / NO
```

### Completion rule

This issue is not fixed until:

- `W` sorts above `V` correctly
- all card-render sorting paths are audited
- no fallback path still uses the wrong ordering logic

---

## 3. These two bugs imply broader hidden danger

The two observed bugs prove that the code may still contain many silent mismatches between:

- code
- authoritative rule/spec files
- terminology map
- UI addenda
- bot instructions

Therefore, the coding agent must now perform a **thorough dangerous-drift audit** across the full codebase.

This is mandatory.

---

## 4. Full dangerous-drift audit — required command/checklist

The coding agent must perform a full search-and-compare audit across the whole project.

At minimum, run the equivalent of the following searches/checks.

### 4.1 Search for preset/config drift

Search all occurrences of:

```text
mustStopLevels
mustDefendLevel
levelThreshold
stageThreshold
allowOverbase
overbaseRestrictions
doubleDeclarationOrdering
levelConfiguration
allowCrossings
knockBack
endgameFactor
endingCompensation
multiplayCompensation
countingSystem
PRESET_CONFIGS
```

For each occurrence:
- compare code value against authoritative rule/spec files
- correct any mismatch
- remove stale comments that still describe old values

### 4.2 Search for sorting drift

Search all occurrences of:

```text
sort(
sorted
compare
comparator
order
rank
joker
bigJoker
smallJoker
W
V
```

For each sorting path:
- verify it uses authoritative Shengji `order`
- verify it does not fall back to raw rank/string unless explicitly intended
- verify `W > V`
- verify the same sorting logic is used consistently across all UI paths

### 4.3 Search for terminology drift

Search all occurrences of likely bad synonyms such as:

```text
endingBonus
multiplayPenalty
bonus
penalty
dealer
bid
follower
divisionFollower
```

For each occurrence:
- compare against the terminology map
- normalize internal names to the recommended code names
- normalize display text through the localization/message files

### 4.4 Search for phase/state drift

Search all occurrences related to phase transitions:

```text
playingPhase
countingPhase
dialog
showDialog
allHandsEmpty
finalScore
baseScore
wonCounters
exposedState
forehandControl
failedMultiplay
fakeMultiplay
```

For each occurrence:
- verify the state transition is actually reachable
- verify the render path exists
- verify the DOM is mounted
- verify the visible result appears on the page

---

## 5. Minimum command-style instruction to the coding agent

Use this exact operational mindset:

```text
1. grep/search all spec-sensitive identifiers
2. compare each occurrence against the authoritative spec
3. compare each user-facing label against the terminology map and localization files
4. compare each sorting path against the authoritative Shengji order model
5. list every mismatch explicitly
6. fix every mismatch explicitly
7. search again to confirm no stale old values remain
```

Do not stop after patching only the two currently visible bugs.

---

## 6. Required final audit report

After corrections, the coding agent must provide a strict final report in this format:

```text
Section A — Preset/config audit
Items audited:
Mismatches found:
Files changed:
Any unresolved mismatches: YES / NO

Section B — Sorting audit
Sorting paths audited:
Mismatches found:
Files changed:
Any remaining wrong-order risks: YES / NO

Section C — Terminology audit
Terms normalized:
Files changed:
Any remaining forbidden synonyms: YES / NO

Section D — Phase/state audit
State flows audited:
Missing render paths found:
Files changed:
Any still-unreachable required feature: YES / NO

Section E — Final confirmation
Codebase re-searched after fixes: YES / NO
Known remaining dangers: [list or NONE]
```

Do not replace this with a narrative summary.

---

## 7. Final instruction

Treat this as a strict correction and hidden-danger audit.

Do not assume that fixing only the currently visible bugs is enough.

The task is incomplete until:

- `mustStopLevels` exactly matches the authoritative spec
- sorting is correct, including `W > V`
- all spec-sensitive duplicates and stale comments are cleaned up
- all sorting paths are audited
- all terminology drift is audited
- the full codebase is re-searched after the fixes
