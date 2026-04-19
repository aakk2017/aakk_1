# 22_strict_state_model_note_failed_multiplay_exposed_cards_forehand_control.md

This note is mandatory.

Its purpose is to force the implementation to stop treating failed-multiplay aftermath, exposed-card display, and forehand control as loose UI patches.

These features must be implemented as an explicit state model with explicit transitions, explicit clearing, and explicit UI consumers.

Do not partially apply this note.
Do not answer with a narrative summary.
Do not report success unless the runtime behavior and state transitions match this note exactly.

---

## 0. Reason for this note

Minor issues are being fixed, but the core failed-multiplay aftermath and forehand-control behavior is still wrong.

This strongly suggests that the implementation still lacks a correct authoritative state model for:

- failed-multiplay aftermath
- exposed cards
- delayed forehand-control trigger
- forehand-control interaction and continuation
- reset / clear behavior on new round, new frame, and new game

That must be corrected now.

---

## 1. Mandatory implementation rule

Do **not** implement these features as scattered local UI flags.

Do **not** implement them as ad hoc button states.

Do **not** implement them as one temporary “special mode” without explicit sub-states.

Instead, define explicit authoritative states for the following concepts.

### 1.1 Required state objects

The coding agent must define and use explicit state objects equivalent to:

```text
FailedMultiplayState
ExposedCardState
ForehandControlChanceState
ForehandControlPendingTriggerState
ForehandControlInteractionState
```

Equivalent naming is allowed only if it follows the terminology map and remains one-to-one in meaning.

If these concepts are merged into vague global booleans, the implementation is wrong.

---

## 2. Required meaning of each state

### 2.1 FailedMultiplayState

This state represents the aftermath of one resolved failed multiplay.

It must be able to represent at least:

- failer
- original intended lead
- actual led element
- blockers
- actual blocker
- revoked cards
- exposed cards created by that failed multiplay
- whether the 1-second intended-lead display hold is in progress
- whether revocation has already been visually applied

This state is about the lead move and its aftermath.

### 2.2 ExposedCardState

This state must represent all currently remaining exposed cards.

At minimum, it must support:

```text
ExposedCardState[failer][division] = remaining exposed cards in that division
```

This state must update when:

- a failed multiplay creates exposed cards
- exposed cards are later played
- exposed cards are discarded
- a new frame initializes
- a new game initializes

This must be the authoritative source for exposed-card rendering in all views.

### 2.3 ForehandControlChanceState

This state must represent stored forehand-control chances.

At minimum, it must support:

- which forehand owns the chance
- which failer the chance applies to
- how many chances remain in the current frame

A single failed multiplay grants exactly one chance.

Chances may accumulate within the same frame.

All chances must reset after the playing phase is over.

### 2.4 ForehandControlPendingTriggerState

This state must represent that a trigger condition has been reached and a forehand-control decision is now required before the failer can continue.

At minimum, it must include:

- forehand
- failer
- led division
- exposed cards in the currently led division
- whether the trigger is currently active
- whether exactly one chance is being consumed now

This state must not be activated merely because a failed multiplay happened earlier.
It activates only at the later qualifying follow event.

### 2.5 ForehandControlInteractionState

This state must represent the actual interaction currently in progress.

At minimum, it must include:

- selected exposed cards for the current decision
- mode to be committed (`mustPlay` or `mustHold`)
- whether selection UI is currently mounted
- whether commit buttons are currently mounted

This state begins only when the forehand is making the actual choice.
It ends immediately after commit or explicit loss/use resolution.

---

## 3. Mandatory transition table

The coding agent must explicitly implement and report the following state transitions.

### 3.1 Failed multiplay is resolved

Trigger:
- authoritative lead-resolution pipeline determines failed multiplay

Effects:

1. create/update `FailedMultiplayState`
2. create/update `ExposedCardState` from exposed cards
3. increment `ForehandControlChanceState` by exactly one for the failer's forehand
4. do **not** activate `ForehandControlPendingTriggerState` yet
5. do **not** activate `ForehandControlInteractionState` yet

### 3.2 1-second intended-lead display hold

Trigger:
- failed multiplay just resolved

Effects:

1. keep intended lead visible for 1 second
2. after 1 second:
   - revoke non-actual cards on desk
   - leave only actual led element on desk
   - render exposed cards under the failer's name bar

This must be implemented as a real timed transition, not a comment/TODO.

### 3.3 Later qualifying trigger for forehand control

Trigger:
- later in the frame, the failer is about to **follow**
- the current led division is a division in which that failer still has remaining exposed cards
- the corresponding forehand has at least one unused chance

Effects:

1. activate `ForehandControlPendingTriggerState`
2. mount forehand-control selection UI
3. activate `ForehandControlInteractionState`
4. block the failer's follow selection until the forehand-control decision is resolved

### 3.4 Forehand-control commit

Trigger:
- forehand clicks `must-play` or `must-hold`

Effects:

1. consume exactly one forehand-control chance
2. apply selected cards and chosen mode to the current follow-legality context
3. deactivate `ForehandControlPendingTriggerState`
4. deactivate `ForehandControlInteractionState`
5. allow the failer to continue the follow selection under the resulting condition

### 3.5 Exposed cards later played away

Trigger:
- an exposed card is played or discarded later

Effects:

1. remove that card from `ExposedCardState`
2. update all rendered exposed-card areas
3. if a division becomes empty in `ExposedCardState[failer][division]`, that division no longer qualifies as an exposed division for future forehand-control triggers

### 3.6 New frame initialization

Trigger:
- next frame starts

Effects:

1. clear `FailedMultiplayState`
2. clear `ExposedCardState`
3. clear `ForehandControlChanceState`
4. clear `ForehandControlPendingTriggerState`
5. clear `ForehandControlInteractionState`
6. clear any leftover action buttons such as `确认标记`
7. clear any exposed-card highlight state

### 3.7 New game initialization

Trigger:
- new game starts

Effects:
- everything in 3.6, plus any other game-level interaction leftovers

There must be no leak from prior forehand-control interaction into the new game.

---

## 4. Required UI consumers of the state

The coding agent must explicitly connect the above authoritative states to the UI.

### 4.1 Exposed-card rendering

UI must read `ExposedCardState`.

Required consumers:

- failed multiplayer's own view
- other players' views
- opposite-seat layout, with opposite hand moved upward by one card-corner height
- forehand-control selection UI when triggered

Do not build exposed-card display from stale local DOM assumptions.

### 4.2 Forehand-control selection UI

UI must read `ForehandControlPendingTriggerState` and `ForehandControlInteractionState`.

Required behavior:

- card-corner selection under the failer's name bar / designated area
- selected card corners highlighted
- `must-play` and `must-hold` buttons mounted only during active interaction
- failer blocked from continuing until forehand decision completes

### 4.3 Reset/clear behavior

UI must clear all forehand-control and exposed-card interaction UI from authoritative reset/initialization state, not from ad hoc button cleanup.

---

## 5. Mandatory trigger condition for forehand control

The trigger condition must be implemented exactly.

Forehand control triggers only if **all** of the following are true:

1. the acting player is the failer
2. the acting player is about to **follow**, not lead
3. the current led division is a division where `ExposedCardState[failer][division]` is non-empty
4. the corresponding forehand has at least one unused chance in `ForehandControlChanceState`

Any weaker or earlier trigger is wrong.

In particular:

- failed multiplay itself does not immediately trigger the interaction
- the next round does not automatically trigger it
- the next qualifying exposed-division follow triggers it

---

## 6. Required runtime audit report

The coding agent must not report completion unless it provides this exact report.

```text
Section A — State definitions
FailedMultiplayState defined: YES / NO
ExposedCardState defined: YES / NO
ForehandControlChanceState defined: YES / NO
ForehandControlPendingTriggerState defined: YES / NO
ForehandControlInteractionState defined: YES / NO

Section B — Transition audit
Failed-multiplay resolution transition implemented: YES / NO
1-second hold transition implemented: YES / NO
Later trigger transition implemented: YES / NO
Forehand-control commit transition implemented: YES / NO
Exposed-card removal transition implemented: YES / NO
New-frame clear transition implemented: YES / NO
New-game clear transition implemented: YES / NO

Section C — UI consumers
Exposed cards in own view: YES / NO
Exposed cards in other players' views: YES / NO
Opposite-hand upward offset implemented: YES / NO
Forehand-control selection UI mounted from state: YES / NO
Commit buttons mounted only during active interaction: YES / NO

Section D — Remaining leaks
Any stale forehand-control state after new frame: YES / NO
Any stale forehand-control state after new game: YES / NO
Any stray `确认标记` button outside active interaction: YES / NO

Section E — Final status
All required states authoritative and wired end-to-end: YES / NO
Status: COMPLETE / INCOMPLETE
```

Do not replace this with a narrative summary.

---

## 7. Additional regression correction — reference name bar alignment

A new regression has appeared.

### 7.1 Observed wrong behavior

The reference player's name bar is now placed wrongly.

### 7.2 Required behavior

The bottom edge of the reference player's name bar must align with the bottom edge of the hand cards, as in the recap page.

In other words:

- the name bar should cover a small portion of the hand cards
- it should not sit too low or too far away from the hand

### 7.3 Required invariant

The reference name bar alignment must match the recap-page style baseline.

This issue did not exist before.
Therefore it must be treated as a regression and corrected.

### 7.4 Required report line

The coding agent must also include:

```text
Reference name bar bottom-edge alignment restored: YES / NO
```

in the final report.

---

## 8. Final instruction

Do not continue patching exposed cards and forehand control as local UI fixes.

First make the state model explicit.
Then implement the transitions.
Then wire the UI strictly from those states.
Then verify that reset/clear paths fully clear them.

This note is satisfied only when:
- the state model exists explicitly
- all required transitions exist
- exposed cards render correctly in all required views
- forehand control triggers only in the correct later follow event
- the page does not freeze
- initialization no longer leaks stale control state
- the reference name bar alignment is restored
