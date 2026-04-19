# 03_strict_correction_note_failed_multiplay_aftermath_and_frame_transition.md

This note is mandatory.

It records the current implementation status and the remaining incorrect behaviors.
Do not reinterpret it loosely.
Do not partially apply it.
Do not report success unless the runtime behavior matches the required behavior exactly.

---

## 0. Current status summary

The following items are now considered implemented correctly:

1. seat mark
2. counter area
3. declaration buttons and declarer
4. multiplay failure detection

The following area is still not implemented correctly:

- failed-multiplay aftermath

In addition, several frame-transition and display issues remain.

This note covers only the remaining incorrect behaviors listed below.

---

## 1. Failed-multiplay aftermath — exposed cards missing in other players' views

### 1.1 Observed wrong behavior

After another player fails a multiplay, exposed cards are still absent in other players' views.

No card corners appear hanging below the name bar of the failed multiplayer.

### 1.2 Required behavior

After failed-multiplay resolution:

- exposed cards must be displayed in other players' views as compact card-corner objects
- these card corners must hang directly below the failed multiplayer's name bar
- the top edge of the card corners aligns with the bottom edge of the name bar
- zero vertical margin
- the left edge of the first card corner aligns with the left edge of `div.name-area`

### 1.3 Opposite-seat layout requirement

Move the opposite player's hand upward by the amount of one card-corner height so that exposed cards can be displayed below that name bar without collision.

This is mandatory.

### 1.4 Mandatory invariant

The implementation is wrong unless exposed cards are visible in all appropriate non-self views after a failed multiplay.

---

## 2. Failed-multiplay aftermath — flow stuck at forehand control trigger

### 2.1 Observed wrong behavior

After a failed multiplay, when forehand control is supposed to occur, the webpage gets stuck.

Example:
- East failed a multiplay in spades
- now it is South's turn to apply forehand control on East
- the page stops there and does not progress

### 2.2 Required behavior

When forehand control is triggered:

1. the round must remain live
2. the forehand must be able to select on the exposed card corners of the failer in the currently led exposed division
3. the `must-play` and `must-hold` commit buttons must be available
4. after commit, the failer must be allowed to continue the follow under the resulting forehand-control condition

The page must not freeze.

### 2.3 Required audit

The coding agent must explicitly audit:

- the trigger condition for forehand control
- the UI state entered when forehand control begins
- the DOM mounting of selection controls
- the event binding of `must-play` and `must-hold`
- the exit path after forehand-control commit
- the continuation into the failer's follow selection

### 2.4 Mandatory invariant

Forehand control is wrong unless the round continues after the forehand makes his control decision.

---

## 3. New-frame / new-game initialization leak after stuck forehand control

### 3.1 Observed wrong behavior

After a stuck state caused by failed multiplay / forehand control, clicking "new game" reaches a page state where:

- the normal `to play` button is gone
- the `确认标记` button remains
- this suggests that forehand-control state was not cleared

This implies that state from the previous frame/game leaked into the new initialization.

### 3.2 Required behavior

Starting a new frame or a new game must fully clear temporary interaction states that belong only to the previous round/frame.

At minimum, the following must be cleared:

- forehand-control pending state
- marked-card selection state
- `must-play` / `must-hold` pending UI state
- failed-multiplay aftermath UI state
- exposed-card temporary highlight state
- any phase-specific action buttons not belonging to the new state

### 3.3 Required audit

The coding agent must explicitly audit initialization/reset logic for:

- new round
- new frame
- new game

and list all states cleared in each case.

### 3.4 Mandatory invariant

After starting a new frame or a new game, no UI state from prior forehand-control interaction may remain mounted or active.

If `确认标记` remains when the page is not in a forehand-control interaction, the implementation is wrong.

---

## 4. Wrong pivot position after successful defense

### 4.1 Observed wrong behavior

When the defense is successful, the pivot remains the same pivot in the next frame.

This is wrong.

### 4.2 Required behavior

When the defense is successful:

- the pivot must pass to the pivot's ally for the next frame

Do not keep the same pivot position.

### 4.3 Mandatory invariant

Next-frame pivot transfer after successful defense must follow the authoritative frame-result rule exactly.

If the pivot does not pass to the ally after a successful defense, the implementation is wrong.

---

## 5. Counting-phase dialog — team labels should use natural teams

### 5.1 Observed wrong behavior

In the counting-phase dialog, levels are displayed as:

- `守方：level`
- `攻方：level`

This is not ideal because defender/attackers roles change by frame.

### 5.2 Required behavior

In the counting-phase dialog, the two team levels should be displayed using stable natural teams:

- `南北`
- `东西`

Do not use defender/attacker labels there.

### 5.3 Mandatory invariant

Counting-phase level display is wrong unless it uses stable natural team labels rather than frame-relative roles.

---

## 6. Breathing color — reference player must also breathe when to play

### 6.1 Observed wrong behavior

The breathing color is not applied to the reference player's name bar when the reference player is on play.

### 6.2 Required behavior

When the reference player is to play:

- the reference player's name bar must also use the breathing background color

This requirement is the same as for the other seats.

Do not exclude the reference player's name bar from the breathing-color rule.

### 6.3 Mandatory invariant

On-play indication is incomplete unless the reference player's name bar also breathes when it is his turn.

---

## 7. Required correction checklist

The coding agent must not report completion unless every answer below is YES.

### Failed-multiplay aftermath
- Are exposed cards rendered below the failed multiplayer's name bar in other players' views?
- Is the opposite player's hand moved upward by one card-corner height to make room for exposed cards?
- Does forehand control no longer freeze the page?
- Can the forehand select exposed card corners and commit with `must-play` / `must-hold`?
- Does the failer continue the follow after forehand-control commit?

### Reset / initialization
- Is all forehand-control temporary state cleared on new frame?
- Is all forehand-control temporary state cleared on new game?
- Is the stray `确认标记` button removed outside actual forehand-control interaction?

### Pivot transition
- Does successful defense pass pivot to the ally in the next frame?

### Counting-phase labels
- Does the counting-phase dialog display levels as `南北` and `东西` rather than `守方` and `攻方`?

### Breathing color
- Does the reference player's name bar also breathe when the reference player is to play?

If any answer is NO, the implementation is incomplete.

---

## 8. Required report format

For every corrected item, the coding agent must report:

```text
Item:
Observed old behavior:
Required behavior:
Files changed:
States cleared/rechecked:
Invariant rechecked:
Status: COMPLETE / INCOMPLETE
```

Do not replace this with a narrative summary.

---

## 9. Final instruction

Treat these as strict runtime-behavior corrections.

Do not report success unless:

- the failed-multiplay aftermath is complete and non-stuck
- exposed cards are visible in all required views
- no prior forehand-control state leaks into new initialization
- pivot transition is correct
- counting-phase team labels are stable
- the reference player's name bar also uses breathing color when on play
