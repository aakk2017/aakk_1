# Regression-Prevention Note — Mandatory Invariant Preservation and Recheck Protocol

This note is mandatory for all future implementation work.

Its purpose is to prevent the coding agent from:

- fixing one issue while breaking another
- changing shared helpers without rechecking dependent behavior
- claiming completion without regression verification
- introducing hidden divergence from the authoritative spec

This note must be treated as a standing rule.
Future correction notes should explicitly follow it.

---

## 0. Core non-negotiable rule

Every patch must preserve previously-correct behavior.

A patch is not acceptable if:

- the target issue is improved but another already-correct behavior becomes wrong
- shared logic is changed without rechecking dependent behaviors
- the coding agent reports completion without explicit regression recheck

Do not optimize for:
- “code was modified”
- “new feature was added”
- “one visible bug was reduced”

Instead optimize for:
- target issue fixed
- prior invariants preserved
- no regression introduced
- no hidden drift introduced

---

## 1. Mandatory pre-change protocol

Before changing code, the coding agent must explicitly write:

```text
Target issue:
Authoritative source(s):
Invariants that must remain true:
Shared helper/state likely affected:
Dependent behaviors that must be rechecked:
```

Do not start patching without writing this.

If the patch touches shared logic, the “shared helper/state likely affected” line is mandatory and must not be omitted.

---

## 2. Mandatory post-change protocol

After changing code, the coding agent must explicitly write:

```text
Files changed:
Old behavior/value:
New behavior/value:
Invariants rechecked:
Dependent behaviors rechecked:
Any regression introduced: YES / NO
Any unresolved mismatch: YES / NO
```

Do not replace this with a narrative summary.

If any regression exists, the patch is incomplete.

---

## 3. Invariant categories that must always be checked

For every patch, the coding agent must consider whether the change affects any of the following categories.

### 3.1 Rule invariants
Examples:
- failed multiplay is not a legality error
- failed multiplay is detected only after laying down a single-division intended lead
- one-element rounds require same-type comparison
- forehand-control trigger timing is correct
- 3rd-seat-low applies in the correct context
- qiangzhuang only occurs in frame 1 of a game

### 3.2 Preset/config invariants
Examples:
- must-stop levels
- must-defend level
- level threshold
- stage threshold
- ending compensation
- multiplay compensation
- declaration ordering
- preset flags

### 3.3 Sorting invariants
Examples:
- `W > V`
- all displayed card sequences use Shengji order
- all sorting paths share the correct comparator logic

### 3.4 Phase/state invariants
Examples:
- game initialization vs frame initialization
- frame-to-frame pivot carry-over
- counting-phase transition
- exposed-card state update
- declaration-stage visibility
- ready-button starts next frame instead of restarting the whole game

### 3.5 UI invariants
Examples:
- declaration controls remain visible in the correct stage
- declaration display keeps all required sub-fields
- counter drawer alignment remains correct
- exposed-card areas remain mounted and updated
- score area remains visible when the counter drawer opens

### 3.6 Terminology invariants
Examples:
- internal names follow the terminology map
- display text comes from localization/message files
- no unapproved synonyms are introduced

---

## 4. Shared-helper warning — high regression risk

If a patch touches any shared helper or shared state path, treat it as high regression risk.

High-risk examples:

- sort comparator
- preset config object
- frame initialization logic
- card rendering helper
- name-bar component
- phase transition logic
- declaration display component
- score/counter state
- exposed-card state
- lead-resolution pipeline

For any such patch, the coding agent must explicitly list:

```text
Shared helper/state touched:
Dependent features rechecked:
```

Do not omit this.

---

## 5. Standing anti-regression sentence for future notes

Future correction/addendum notes should explicitly contain a statement equivalent to:

> This change must not break any previously-correct behavior. After implementation, recheck all affected invariants and do not report success if any regression appears.

This requirement is mandatory unless a stronger equivalent sentence is already present.

---

## 6. Completion rule for every nontrivial patch

A patch is complete only if all of the following are true:

1. the target issue is fixed
2. previously-correct invariants still hold
3. dependent behaviors were rechecked
4. no regression was introduced
5. no hidden spec drift was introduced
6. no unresolved mismatch remains unreported

If any item above is false, the patch is incomplete.

---

## 7. Forbidden completion behavior

Do not report success merely because:

- files were edited
- helper functions were added
- comments were updated
- UI changed in one place
- one visible symptom improved

Those are not completion criteria.

Completion requires explicit regression-free closure.

---

## 8. Required final report format

For every nontrivial patch, the coding agent must provide:

```text
Target issue:
Authoritative source(s):
Files changed:
Old behavior/value:
New behavior/value:
Invariants rechecked:
Dependent behaviors rechecked:
Any regression introduced: YES / NO
Any unresolved mismatch: YES / NO
Status: COMPLETE / INCOMPLETE
```

Do not omit any line.

---

## 9. Final instruction

From now on, treat regression prevention as part of the patch itself.

A correct patch is not merely:
- implemented
- plausible
- partially visible

A correct patch is:
- spec-conformant
- invariant-preserving
- regression-free
- explicitly rechecked
