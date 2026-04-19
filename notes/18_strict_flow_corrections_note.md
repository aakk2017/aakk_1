# Strict Correction Note — Failed Multiplay Flow, Counter Drawer, and Continuous Multi-Frame Flow

This note records observed implementation mismatches and defines the required corrected behavior.

These items are mandatory.
Do not treat them as optional polish.

---

## 1. Failed multiplay and forehand-control flow

The current behavior is wrong.

### 1.1 What is wrong now

Observed wrong behavior:

- the game flow gets stuck once a multiplay fails
- forehand control appears in the next round, instead of the next qualifying exposed-division follow
- the failed-multiplay display/update sequence is incomplete

This must be corrected.

---

## 1.2 Required flow after failed multiplay

The required flow is:

### a) Detect and announce failed multiplay

When multiplay failure is detected:

1. announce that the multiplay failed
2. announce **all players who are blocking**, not only the actual blocker
3. identify the cards to revoke
4. highlight the cards to revoke using a distinct background color in the card objects
   - use the same revoked-card style direction as in the recap page

Important:
- announcing only the actual blocker is insufficient
- all blockers must be announced

### b) Keep intended lead visible briefly

After failed-multiplay detection:

- keep the originally intended lead visible on the desk for **1 second**

Purpose:
- let all players see and remember the intended multiplay before revocation is visually applied

Do not revoke immediately with zero delay.

### c) Replace desk display with actual played cards

After the 1-second hold:

1. leave only the actually played cards on the desk
2. revoke the other cards from the intended lead
3. display the exposed cards as card corners under the failed multiplayer's name bar

Positioning rule for exposed-card display:

- the **top edge** of the card corners aligns with the **bottom edge** of the name bar
- zero vertical margin
- the **left edge** of the first card corner aligns with the **left edge** of `div.name-area`

### c-1) Highlight exposed cards for the failed multiplayer

In the failed multiplayer's own display:

- highlight the exposed cards with a specific background color
- use the same style direction as the recap page for exposed/revoked-style emphasis

### c-2) Remove exposed-card corners when played away

In the displays of the other players:

- if an exposed card is later played, remove the corresponding card corner from the exposed-card area under the name bar

This update must happen dynamically.
Do not leave stale exposed-card corners on screen.

---

## 1.3 Same-round reminder

In the **same round** in which the failed multiplay was resolved:

- make sure the **3rd-seat-low** rule is in effect where applicable

This must not be forgotten.

---

## 1.4 Trigger timing of forehand control

Forehand control does **not** happen in the next round automatically.

Forehand control happens only in the next round satisfying **both** conditions:

1. the failer is going to **follow**, not lead
2. the led division is a currently exposed division for that failer

Therefore:

- forehand control must be tied to the next **exposed-division and failer-follow** round
- not merely the next round in calendar order

This rule must be emphasized in implementation.

---

## 1.5 Forehand-control interaction sequence

When the forehand has already played his own move, and forehand control is triggered:

### f) Selection surface

The forehand must be able to make selections on the card corners displayed below his afterhand's name bar.

Use a different background color to highlight selected card corners.

### f-1) Control buttons

Display two buttons below the card corners:

- `must-play`
- `must-hold`

### g) Commit action

After selection, the forehand clicks either:

- `must-play`
- `must-hold`

to apply forehand control.

Do not auto-apply based on selection alone.
The button click is the commit action.

---

## 1.6 Forehand-control markings after commit

### g-1) In the failed multiplayer's own view

Use signs under the card index to label controlled cards:

- **must-hold**: red forbidden sign
- **must-play**: blue upward triangle

These are icon/sign markers, not just background colors.

### g-2) In other players' views

Use background colors in the exposed card corners:

- **must-hold**: same background style as revoked cards in the recap page
- **must-play**: light blue background color

The two states must be visually distinct.

---

## 1.7 Mandatory invariant for forehand control

The implementation is wrong unless all of the following are true:

1. failed multiplay does not freeze the round
2. intended lead stays visible for 1 second before revocation
3. exposed cards are rendered under the failed multiplayer's name bar
4. exposed cards shrink dynamically when played away
5. 3rd-seat-low remains in effect in the same round where applicable
6. forehand control triggers only on the next qualifying exposed-division follow
7. forehand-control selection happens on card corners
8. the forehand commits by clicking `must-play` or `must-hold`
9. own-view and others'-view markings are both implemented correctly

---

## 2. Counter won area

The current behavior is wrong.

### 2.1 What is wrong now

Observed wrong behavior:

- the counter area covers the score area

This is not acceptable.

### 2.2 Naming correction

The component should be called:

- `counter-drawer`

Do not use:
- `score-drawer`

because that name is misleading.

### 2.3 Required geometry

When the score area is hovered:

- the counter drawer must expand to the **right** of the score area
- it must **not cover** the score area itself

The score area must remain visible.

The drawer must behave as an attached expansion area, not as an overlay on top of the score container.

This overrides any implementation that places the drawer on top of the score area.

---

## 3. Continuous multi-frame flow

The current behavior is wrong.

### 3.1 What is wrong now

Observed wrong behavior:

- after clicking `Ready` in the counting-phase dialog, the game starts over
- level and pivot are not updated according to the result of the last frame

This is wrong.

### 3.2 Required behavior

When `Ready` is clicked:

1. finalize the last frame result
2. update levels of both sides according to the frame result
3. determine the pivot of the new frame from the result of the last frame
4. set the new frame's level to the level of the new pivot's side
5. initialize the new frame using those updated values
6. continue the same game instead of restarting from a fresh initial game state

So:

- `Ready` starts the **next frame**
- it does **not** restart the whole game from scratch

---

## 3.3 Qiangzhuang note

For all variations mentioned so far:

- `qiangzhuang` happens only in the **first frame** of each game

Therefore:

### First frame of a game
- `isQiangzhuang = true`
- pivot belongs to the last declarer

### All later frames in the same game
- `isQiangzhuang = false`
- pivot is determined by the result of the previous frame

This must be implemented explicitly.

Do not re-run competitive declaration for every frame.

---

## 3.4 Required state distinction

The implementation must distinguish clearly between:

- **game initialization**
- **new frame within the same game**
- **fresh new game**

The current wrong behavior suggests that `Ready` is reusing the fresh-new-game path.
That must be corrected.

At minimum, the implementation should preserve across frames:

- current game identity
- updated team levels
- next pivot position
- whether the next frame uses qiangzhuang (`false` after frame 1)

---

## 4. Required correction checklist

The coding agent must not report completion unless all answers below are YES.

### Failed multiplay / forehand control
- Are all blockers announced, not just the actual blocker?
- Are revoked cards highlighted before revocation?
- Is the intended lead kept visible for 1 second?
- Are exposed cards rendered under the failed multiplayer's name bar with the required alignment?
- Are exposed cards removed dynamically when played away?
- Is 3rd-seat-low still applied in the same round where appropriate?
- Does forehand control trigger only on the next qualifying exposed-division follow?
- Does the forehand choose on card corners below afterhand's name bar?
- Are `must-play` and `must-hold` buttons shown and used to commit?
- Are the own-view and others'-view markings correct?

### Counter drawer
- Is the component named/conceptualized as `counter-drawer`?
- Does it expand to the right of the score area?
- Does it avoid covering the score area?

### Continuous multi-frame flow
- Does `Ready` start the next frame instead of restarting the whole game?
- Are levels updated from the previous frame result?
- Is the new pivot determined from the previous frame result?
- Is the new frame level taken from the new pivot's side?
- Is `isQiangzhuang` true only in frame 1 of a game?
- Is `isQiangzhuang` false in all later frames?

If any answer is NO, the implementation is incomplete.

---

## 5. Final instruction

Treat these as strict flow corrections.

Do not patch them partially.
Do not claim success if the visual flow or state transition still behaves like the old implementation.

The implementation is correct only when the actual runtime behavior matches the full sequence specified above.
