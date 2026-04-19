# UI Requirements for Coding AI — Shengji Project

This document describes the UI requirements already implied by the current Shengji rules, algorithms, and discussion.
It is intended for coding AI.

This is a **requirements file**, not a visual mockup and not a CSS file.

---

## 1. Scope

The project needs at least two distinct UI modes:

1. **Real game page**
2. **Recap / replay page**

These are not the same page with minor cosmetic differences.
They have different information-visibility rules and different central layouts.

---

## 2. Global design direction

The UI should continue the style of the existing handwritten-recap webpage:

- desktop-first
- card-table centered
- information-dense
- low-animation
- practical / serious
- suitable for real play, testing, and replay

Do not redesign it as a mobile-first casual card app.

---

## 3. Persistent four-corner structure

Keep four persistent corner regions in both real-game and recap modes.

Recommended contents:

- **top-left**: strain, level, pivot / seat relation, table number
- **top-right**: frame score, penalty, base score, related status
- **bottom-left**: base / dipai / counting-related info
- **bottom-right**: comments, controls, or contextual panel

Exact content may vary by mode, but the four-corner structure should remain.

---

## 4. Two mode-specific layouts

## 4.1 Real game page

Requirements:

- keep four corners
- hide the other 3 hands
- hide the recap/history chart
- use the **bulk of the screen** for the current round table
- show only information that is legal for the current player to see

The center area of the real game page should primarily show:

- the current lead
- follows played in the current round
- current highest hand / current winner of the round
- ruff state
- selected cards waiting to be confirmed
- current turn / action prompt

## 4.2 Recap / replay page

Requirements:

- show all 4 hands
- show the recap / history chart
- allow stepping through moves
- allow jumping by move / round / reference player
- keep replay state synchronized with visible hand states and score display

The center area of the recap page is a **history/analysis surface**, not the live round table.

---

## 5. Information visibility rules

The UI must respect information boundaries.

It must distinguish among:

- public table-visible information
- seat-private information
- leader-known information used internally by rule evaluation
- hidden information

Examples:

- in real play, other 3 hands are hidden
- base is shown only when legal
- fake-multiplay detection may use leader-known information internally, but that does not imply all players may see that information

The coding AI must not leak hidden information through the UI.

---

## 6. Declaration UI

Declaration must be implemented as a **legality-driven matrix of buttons**.

Do not implement declaration as:

- free text input
- ad hoc button list without structure
- manual typing of declaration content

Requirements:

1. show all declaration options in a structured matrix/grid
2. dynamically enable only legal declarations
3. disable illegal declarations clearly
4. show overcalls whenever legal
5. support single vs double declaration distinction
6. update the displayed declaration state immediately after a declaration is accepted

The declaration controls should be driven by the current hand and current declaration state.

---

## 7. Card selection and action confirmation

Use a standard card-table interaction model:

- click card to select / deselect
- selected cards are visually highlighted
- a separate confirm action is required

There must be separate confirm flows for at least:

- declaration
- base setting
- lead
- follow

Do not auto-play immediately on card click.

The UI must clearly show the currently selected cards before confirmation.

---

## 8. Local input feedback vs authoritative result

This distinction is mandatory.

## 8.1 Local pre-check feedback

Before sending an action, the local client may warn only about **obvious mechanical issues**, such as:

- mixed-division intended lead
- malformed selection
- impossible card count
- selecting cards not in hand

## 8.2 Authoritative game result feedback

After the server / authoritative engine processes the action, the UI must display authoritative outcomes such as:

- lead accepted / rejected
- follow accepted / rejected
- failed multiplay detected
- fake multiplay detected
- cover occurred
- ruff occurred
- round winner
- score update

Do not present local speculative referee decisions as final game results.

---

## 9. Event-driven UI integration

The UI should react to emitted engine events, not direct UI-only hooks.

Use an event layer so that the same state changes can feed:

- local UI
- server communication
- other players' browsers
- replay logger
- test harness

Representative event names include:

- DECLARATION_MADE
- GLOBAL_STRAIN_SET
- LEAD_INTENDED
- LEAD_ACCEPTED
- LEAD_REJECTED
- FOLLOW_INTENDED
- FOLLOW_ACCEPTED
- FOLLOW_REJECTED
- FAILED_MULTIPLAY_DETECTED
- FAKE_MULTIPLAY_DETECTED
- ROUND_STATE_INITIALIZED
- COVER_OCCURRED
- RUFF_OCCURRED
- ROUND_ENDED
- FRAME_SCORE_CHANGED
- ATTACKING_STREAK_CHANGED
- BASE_REVEALED
- COUNTING_PHASE_STARTED
- FRAME_ENDED

The UI layer should subscribe to events rather than embedding rule logic.

---

## 10. Current-round table in real-game mode

The center of the real-game page should be a **current-round table**, not a recap grid.

It should visually show:

- lead cards
- subsequent plays in the round
- player/seat association for each played hand
- current highest player
- whether the round has been ruffed
- selected cards before confirmation

This area should be large and readable, because it is the main play surface.

---

## 11. Replay history table in recap mode

The center of the recap page should remain a **history/analysis table**.

Requirements:

- one row per round
- columns aligned by seat
- clear lead highlight
- current move highlight
- scrollable body
- fixed readable grid
- move text compact but legible

This replay chart should stay visible in recap mode and hidden in real-game mode.

---

## 12. Round-state visibility

At all times, the UI should make it possible to identify:

- whose turn it is
- current strain
- current level
- pivot / side identity
- frame score
- penalty
- base score when relevant
- current selected cards
- current highest player in the round
- whether the round has been ruffed
- whether an action was rejected and why

This information may be split across the table and corner widgets.

---

## 13. Sorting and readability

The UI must always display cards in a strict, rules-aware sorted order.

Requirements:

- all hands sorted
- all played moves sorted
- sorting must follow current Shengji order/division logic
- display should be readable enough for debugging rule mistakes

This is not optional cosmetic polish. It is part of correctness support.

---

## 14. Rule-heavy feedback

This UI must support precise rule-state feedback.

Examples of messages / status indications that should be possible:

- illegal lead
- illegal follow
- failed multiplay
- fake multiplay
- non-covering potential ruff treated as discard
- one-element round same-type cover requirement
- follow accepted
- action rejected with reason

Do not reduce the UI to only generic “invalid move” feedback.

---

## 15. Controls and navigation

## 15.1 Real game page

Needed controls include:

- confirm selected cards
- cancel / clear selection
- declaration action
- base-setting action
- optional menu/settings access

## 15.2 Recap / replay page

Needed controls include:

- previous move
- next move
- previous move of reference player
- next move of reference player
- jump to move / round
- open / save recap file
- toggle recap views if needed

---

## 16. Animation policy

Use minimal animation.

Allowed:

- selection highlight
- current-row / current-hand highlight
- subtle state transitions
- small hover feedback

Avoid:

- large motion
- decorative card physics
- flashy transitions
- animation that hides exact state

This is a rules-heavy interface, not a cinematic one.

---

## 17. CSS / component organization expectation

The coding AI should preserve a layered UI structure.

Shared visual primitives should live separately from page-specific layout.

Recommended conceptual split:

- shared tokens/theme
- shared card component
- shared widgets
- recap-page layout
- game-page layout

Do not collapse recap and game layout into one giant page stylesheet.

---

## 18. What is already required but still needs future detail

These items are required in principle, but exact details may be refined later:

- exact declaration button matrix layout
- exact real-game center-table geometry
- exact seat-relative naming display
- exact error/status message placement
- exact selection tray / selected-card area
- exact responsive behavior
- exact spectator mode behavior, if any

---

## 19. Implementation warning

The coding AI must not omit legality-aware UI flows.

The UI must assume:

- actions are selected locally
- checked mechanically locally
- judged authoritatively by the engine/server
- then reflected through events

This project is not a loose card sandbox. The UI must align with the strict engine.

---

## 20. Summary

The intended UI is:

- desktop-first
- event-driven
- four-corner persistent structure
- live current-round table for real play
- separate recap/history mode for replay
- legality-driven declaration controls
- strict visibility rules
- precise referee/result feedback
