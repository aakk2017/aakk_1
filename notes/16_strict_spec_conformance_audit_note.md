# Note to Coding Agent — Strict Spec-Conformance Audit and Hidden-Drift Check

This note exists because visible implementation gaps were found, and hidden config/logic drift was also found.

Example:
- `mustStopLevels` in code was set to values inconsistent with the authoritative rule files

This is dangerous.
Hidden spec drift is not acceptable, even if it is not yet visible on the webpage.

---

## 1. Authority order

Implementation must follow this authority order:

1. authoritative rule/spec files
2. authoritative terminology map
3. authoritative addenda / correction notes
4. codebase

Code is **not** the source of truth when it conflicts with the rule/spec files.

If code and spec disagree, code must be corrected.

---

## 2. Hidden drift is a failure

The following are all implementation failures, even if not immediately visible:

- wrong preset values
- wrong must-stop levels
- wrong stage threshold logic
- wrong level threshold logic
- wrong result ranges
- wrong counting formulas
- wrong terminology in variable names
- wrong bot conditions
- wrong trigger timing
- wrong UI-state transitions

Do not postpone these merely because the webpage still loads.

---

## 3. Mandatory audit scope

The coding agent must run a strict audit on all spec-sensitive implementation areas.

At minimum, audit these categories:

### 3.1 Preset configuration
- deck count
- must-stop levels
- allow overbase
- overbase restrictions
- double-declaration ordering
- level configuration
- allow crossings
- knock-back settings
- endgame factor settings
- ending compensation
- counting system
- multiplay compensation if applicable

### 3.2 Core rule logic
- single-division lead requirement
- lead canonical decomposition
- one-element vs multiplay distinction
- failed-multiplay logic
- fake-multiplay logic
- DFP / SFP
- follow legality
- same-type restriction in one-element rounds
- cover / ruff evaluation
- counting-phase finalization

### 3.3 Forehand-control logic
- trigger timing
- must-use-or-lose behavior
- one failed multiplay gives one chance
- chance accumulation within frame only
- reset after playing phase
- led-division-only selection scope
- timing before failer's follow selection

### 3.4 Bot logic
- multiplay activation rule
- grade threshold logic
- same-division companion logic
- forehand-control bot behavior
- blocker choice rule by highest copy

### 3.5 UI-driven rule behavior
- declaration matrix legality
- local pre-check vs authoritative result separation
- failed-multiplay timing
- counting-phase dialog trigger
- exposed-card rendering
- counter drawer behavior

---

## 4. Required audit method

For each audited item, the coding agent must explicitly compare:

- current implementation value / behavior
vs
- authoritative rule/spec value / behavior

Required output format:

```text
Item:
Spec says:
Code currently says:
Match: YES / NO
Action required:
Files to change:
```

Do not use loose summaries like:
- "looks correct"
- "seems aligned"
- "mostly matches"

This audit must be exact.

---

## 5. Preset configuration audit is mandatory

The coding agent must explicitly audit the preset configuration object(s).

This is not optional.

For each preset, compare every field against the authoritative rule files.

This includes the `default` preset.

Important:
- do not infer values from comments in code
- do not invent replacement values
- do not keep legacy values if they conflict with the rule/spec files

If a preset value is uncertain, stop and mark it as unresolved instead of guessing.

---

## 6. Hidden config mismatch example

If code contains:

```text
mustStopLevels = [...]
```

and that list does not match the authoritative rule/spec files exactly, then the implementation is wrong.

This is true even if:
- the setting is not yet exposed in the UI
- the bug is not visible in the current page
- no user has triggered that path yet

The coding agent must treat such mismatches as real failures.

---

## 7. Naming audit is also mandatory

The coding agent must also audit concept naming against the terminology map.

Examples of forbidden drift:
- `endingBonus` instead of `endingCompensation`
- `multiplayPenalty` instead of `multiplayCompensation`
- near-synonyms not approved by the terminology map

Required rule:
- internal names must follow the terminology map
- display text must follow localization/message files
- do not invent alternate synonyms in code

---

## 8. No invisible TODO completion

Do not respond as if the audit is complete merely because:
- some files were opened
- some values were inspected
- some mismatches were noticed

The audit is complete only after:
1. every scoped item has been compared
2. every mismatch is listed
3. every mismatch is either fixed or explicitly marked unresolved

---

## 9. Optional but recommended implementation safeguard

A good implementation safeguard is to centralize spec-sensitive values so they are not scattered.

Examples:
- one preset config source
- one result-range definition source
- one terminology map source
- one counting-rule source

This reduces future drift.

However, centralization does not replace the required audit.

---

## 10. Final instruction

Treat this as a strict spec-conformance audit.

Do not assume that hidden mismatches are harmless.
Do not leave silent divergence between code and rule/spec files.
Do not report success until the audit is explicit, exact, and resolved.
