# 23_runtime_trace_note_failed_multiplay_exposed_cards_forehand_control.md

This note is mandatory.

Its purpose is to stop vague self-reported completion and force a concrete runtime proof for:

- failed-multiplay aftermath
- exposed-card rendering
- delayed forehand-control trigger
- active forehand-control interaction
- reset/clear behavior

Do not answer this note with:
- “implemented”
- “rewired”
- “audited”
- “complete”
- “should work now”

This note requires an exact runtime trace with exact state and exact DOM evidence.

---

## 0. Reason for this note

The coding agent reported that:

- the state model exists
- transitions exist
- UI consumers are wired
- status is COMPLETE

But the observed runtime still shows:

- exposed cards are not displayed
- forehand control gets stuck

Therefore, self-reported audit output is not sufficient.

From now on, the coding agent must prove the behavior using a concrete traced scenario.

---

## 1. One fixed scenario must be traced end-to-end

Use one concrete scenario in which all of the following occur:

1. a failed multiplay happens
2. exposed cards should appear
3. a later qualifying exposed-division follow occurs
4. forehand control should trigger
5. the forehand commits must-play or must-hold
6. the failer continues follow
7. a new frame or new game then clears all temporary state

The coding agent may choose a deterministic scenario, but it must contain all of the above.

Do not use a vague synthetic description.
Use a single concrete trace.

---

## 2. Mandatory authoritative state objects to inspect

The runtime trace must explicitly show the exact values of the authoritative states that correspond to these concepts:

- failed-multiplay aftermath
- exposed cards
- forehand-control chances
- pending forehand-control trigger
- active forehand-control interaction

If the actual code uses different names, map them one-to-one and state that mapping explicitly.

Required format:

```text
Authoritative state mapping:
FailedMultiplayState -> [actual code path]
ExposedCardState -> [actual code path]
ForehandControlChanceState -> [actual code path]
ForehandControlPendingTriggerState -> [actual code path]
ForehandControlInteractionState -> [actual code path]
```

Do not omit this mapping.

---

## 3. Mandatory runtime trace steps

The coding agent must provide the following exact trace sections.

---

## Step 1 — Immediately after failed-multiplay resolution

Provide:

### 3.1 State dump
Exact values of:

- failed-multiplay aftermath state
- exposed-card state
- forehand-control chance state
- pending forehand-control trigger state
- active forehand-control interaction state

### 3.2 Expected UI statement
State exactly what should be visible now.

### 3.3 DOM proof
Provide the exact DOM selector(s) that should contain the exposed-card display and the exact number of rendered exposed-card corner nodes in:

- failed multiplayer's own view
- another player's view
- opposite-seat view

Required format:

```text
Own-view exposed-card selector:
Own-view exposed-card count:

Other-view exposed-card selector:
Other-view exposed-card count:

Opposite-view exposed-card selector:
Opposite-view exposed-card count:
```

If any count is zero when exposed cards should already be displayed, the implementation is incomplete.

---

## Step 2 — After the 1-second revoke transition

Provide:

### 3.4 State dump
Exact values again after the 1-second hold completes.

### 3.5 Desk proof
State exactly which cards remain on the desk and which were revoked.

### 3.6 Exposed-card proof
Again provide selectors and counts for exposed-card corner nodes in all relevant views.

### 3.7 Layout proof
For the opposite-seat layout, explicitly state:

- whether the opposite hand was moved upward
- by what exact CSS rule / transform / offset
- in which file/selector that is implemented

Required format:

```text
Opposite-seat upward offset active: YES / NO
CSS rule / selector:
Exact offset value:
```

---

## Step 3 — At the start of the later qualifying round

This is the round in which forehand control should trigger.

Provide:

### 3.8 Trigger-condition proof
Explicitly show whether all of the following are true:

1. acting player is the failer
2. acting player is about to follow, not lead
3. led division is currently exposed for that failer
4. corresponding forehand has at least one unused chance

Required format:

```text
Failer is acting: YES / NO
Failer is following: YES / NO
Led division still exposed: YES / NO
Forehand has unused chance: YES / NO
```

If all are YES, then forehand control must trigger now.

### 3.9 State dump before forehand plays
Show all relevant states immediately before the forehand's own move.

### 3.10 State dump immediately after forehand plays
Show all relevant states immediately after the forehand's own move.

This is critical because the note requires the trigger to occur after the forehand has played, before the failer selects follow.

---

## Step 4 — At active forehand-control interaction

Provide proof that the interaction is truly active and usable.

### 3.11 Active actor proof
State who the UI now expects to act.

Required format:

```text
Current interaction owner:
Reason this actor owns interaction now:
```

### 3.12 Selection-surface proof
Provide:

- exact DOM selector for selectable exposed-card corners
- exact count of selectable exposed-card corners
- exact selector for selected card-corner highlight state

### 3.13 Commit-control proof
Provide:

- exact DOM selector for `must-play` button
- exact DOM selector for `must-hold` button
- whether they are mounted now
- whether clicking them is bound to a commit handler

Required format:

```text
must-play button mounted: YES / NO
must-play selector:
must-play handler:

must-hold button mounted: YES / NO
must-hold selector:
must-hold handler:
```

If the page is stuck here, this section must identify the exact missing link:
- no mounted selector
- wrong owner
- no handler
- blocked transition
- wrong condition

Do not answer vaguely.

---

## Step 5 — Immediately after forehand-control commit

Provide:

### 3.14 State dump
Exact values of all authoritative states after clicking `must-play` or `must-hold`.

### 3.15 Consumption proof
Show that exactly one forehand-control chance was consumed.

### 3.16 Continuation proof
Show that:

- pending trigger state is cleared
- active interaction state is cleared
- failer is now allowed to select follow
- resulting must-play / must-hold markings are visible in the correct views

Required format:

```text
Pending trigger cleared: YES / NO
Interaction state cleared: YES / NO
Failer follow now enabled: YES / NO
Own-view marking visible: YES / NO
Other-view marking visible: YES / NO
```

If any answer is NO, the implementation is incomplete.

---

## Step 6 — After new frame / new game reset

Provide exact proof that all temporary control states are gone.

### 3.17 State dump
Exact values of all relevant states after:

- new frame
- new game

### 3.18 UI leak proof
Explicitly confirm:

- no stale exposed-card highlight remains
- no stale forehand-control pending state remains
- no stale active forehand-control interaction remains
- no stray `确认标记` button remains when not in active interaction

Required format:

```text
After new frame:
FailedMultiplayState cleared: YES / NO
ExposedCardState cleared: YES / NO
ForehandControlChanceState cleared: YES / NO
ForehandControlPendingTriggerState cleared: YES / NO
ForehandControlInteractionState cleared: YES / NO
Stray 确认标记 button present: YES / NO

After new game:
FailedMultiplayState cleared: YES / NO
ExposedCardState cleared: YES / NO
ForehandControlChanceState cleared: YES / NO
ForehandControlPendingTriggerState cleared: YES / NO
ForehandControlInteractionState cleared: YES / NO
Stray 确认标记 button present: YES / NO
```

---

## 4. Mandatory contradiction check

Because earlier self-reported audit output was inconsistent with observed runtime, the coding agent must also explicitly answer:

```text
Was any earlier YES/COMPLETE statement incorrect? YES / NO
If YES, which item(s) were incorrectly reported as complete?
What exact runtime evidence now shows the real status?
```

Do not omit this.

---

## 5. Required file/function mapping

For every state transition in the trace, the coding agent must state:

- exact file
- exact function
- exact condition that causes the transition

Required format:

```text
Transition:
File:
Function:
Condition:
State changes:
```

At minimum, do this for:

- failed-multiplay resolution
- 1-second hold completion
- later forehand-control trigger activation
- forehand-control commit
- exposed-card removal after later play
- new-frame reset
- new-game reset

---

## 6. Forbidden answer patterns

Do not answer with any of the following:

- “I think it is wired now”
- “the states are there”
- “the DOM should render”
- “it should be visible”
- “I audited the code”
- “all checks pass”

without the exact runtime trace required above.

This note is about proof, not intention.

---

## 7. Completion rule

This task is complete only if the runtime trace proves all of the following:

1. exposed cards are actually rendered in all required views
2. opposite-seat layout makes room for exposed cards
3. forehand control triggers only at the correct later qualifying follow
4. the interaction becomes actionable instead of freezing
5. commit works
6. failer continues follow after commit
7. reset clears all temporary state
8. no earlier “complete” claim remains contradicted by runtime evidence

If any one of these is not proven, the implementation is incomplete.

---

## 8. Final instruction

Stop giving abstract refactor summaries.

Provide one concrete end-to-end runtime trace with exact state values, exact DOM selectors, exact mounted node counts, and exact transition ownership.

Only that will count as proof of correctness.
