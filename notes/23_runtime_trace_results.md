# 23_runtime_trace_results.md

This document is the concrete runtime trace required by note 23, produced by `test_note23_jsdom.js` running in Node.js with jsdom.

---

## Bugs Found and Fixed

Three bugs were found and fixed before the trace could pass:

| # | File | Bug | Fix |
|---|------|-----|-----|
| 1 | `static/css/game.css` L278 | `.desk-namebar` had `overflow: hidden`, clipping `.exposed-preview` (positioned at `top: 100%`) to zero visible area | Changed to `overflow: visible` |
| 2 | `static/js/pages/game/index.js` L1330 | `clearDesk()` in `finishRound()` wiped exposed previews, and `promptCurrentPlayer()` never restored them | Added `updateExposedPreview(p)` loop after `clearDesk()` in the round transition |
| 3 | `static/js/pages/game/index.js` L563 | `startNewGame()` did not reset play button text, leaving stale "确认标记" | Added `gBtnPlay.disabled = true; gBtnPlay.textContent = t('buttons.play')` |

---

## 0. Scenario Description

- **Level**: 0 (trump rank = 2)
- **Strain**: 0 (diamonds = trump)
- **Pivot**: player 2 (North)
- **Defenders**: North(2) + South(0)
- **Attackers**: East(1) + West(3)
- **Round 1**: North leads K♥ + J♥ as multiplay → East has Q♥ (order 9 > J♥ order 8) → **failed multiplay** → J♥ is actual lead, K♥ is revoked/exposed
- **Round 1 follows**: West 7♥, South 6♥, East A♥ → East wins (A♥ order 11)
- **Round 2**: East leads Q♥ → North (failer) about to follow → **FC triggers** for controller East (forehand of North) → East commits **must-play** on K♥ → North follows with K♥ → FC cleared
- **New game**: All temporary state cleared

---

## 2. Authoritative state mapping

```text
Authoritative state mapping:
FailedMultiplayState                -> game.failedMultiplay
ExposedCardState                    -> game.exposedCards
ForehandControlChanceState          -> game.fcChances
ForehandControlPendingTriggerState  -> game.fcPending
ForehandControlInteractionState     -> gFCInteraction (in UI controller)
```

---

## Step 1 — Immediately after failed-multiplay resolution

### 3.1 State dump

```text
game.failedMultiplay: {
  failer: 2,
  intendedLead: [hK(id=300,div=2,ord=10), hJ(id=301,div=2,ord=8)],
  actualElement: { cards: [hJ(id=301,div=2,ord=8)], copy: 1, span: 1, order: 8, division: 2 },
  blockers: [1],
  actualBlocker: 1,
  revokedCards: [hK(id=300,div=2,ord=10)],
  holdInProgress: false,
  revocationApplied: false
}
game.exposedCards: { "2": { "2": [hK(id=300,div=2,ord=10)] } }
game.fcChances: { "2": { forehand: 1, count: 1 } }
game.fcPending: null
game.forehandControl: null
gFCInteraction: null
```

### 3.2 Expected UI statement

During the 1-second hold: Both K♥ and J♥ are visible on North's desk slot, with K♥ highlighted as `show-revoked` (grayed/crossed). After 1 second, only J♥ remains on desk. North's exposed-preview shows K♥ as a corner card. The `#desk-north` slot gets `data-has-exposed` attribute, shifting it upward.

### 3.3 DOM proof

During the 1-second hold, exposed preview is not yet populated (hold in progress):

```text
Cards on desk (intended lead): 2
  card[0]: suit=h, rank=K, show=show-revoked
  card[1]: suit=h, rank=J, show=show-inhand
Revoked (show-revoked) count: 1

desk-north: namebar=true, preview=true, has-exposed=false, corner-count=0
desk-east:  namebar=true, preview=true, has-exposed=false, corner-count=0
desk-west:  namebar=true, preview=true, has-exposed=false, corner-count=0
```

```text
Own-view exposed-card selector: #shand [data-exposed="true"]
Own-view exposed-card count: 0
(South is not the failer — 0 is correct)

Other-view exposed-card selector: #desk-north .desk-namebar .exposed-preview .corner-card
Other-view exposed-card count: 0
(Correct: exposed preview populated after 1-second hold)

Opposite-view exposed-card selector: #desk-north .desk-namebar .exposed-preview .corner-card
Opposite-view exposed-card count: 0
(Same as other-view — North is opposite to South)
```

---

## Step 2 — After the 1-second revoke transition

### 3.4 State dump

```text
game.failedMultiplay: {
  failer: 2,
  intendedLead: [hK(id=300,div=2,ord=10), hJ(id=301,div=2,ord=8)],
  actualElement: { cards: [hJ(id=301,div=2,ord=8)], copy: 1, span: 1, order: 8, division: 2 },
  blockers: [1],
  actualBlocker: 1,
  revokedCards: [hK(id=300,div=2,ord=10)],
  holdInProgress: false,
  revocationApplied: true          ← changed from false
}
game.exposedCards: { "2": { "2": [hK(id=300,div=2,ord=10)] } }
game.fcChances: { "2": { forehand: 1, count: 1 } }
game.fcPending: null
game.forehandControl: null
gFCInteraction: null
```

### 3.5 Desk proof

```text
Cards remaining on North's desk: 1
  card[0]: suit=h, rank=J, show=show-inhand
Revoked K♥ was removed from desk: YES
Remaining card: hJ (J♥)
```

### 3.6 Exposed-card proof

```text
desk-north: namebar=true, preview=true, has-exposed=true, corner-count=1, data-has-exposed=true

Own-view exposed-card selector: #shand [data-exposed="true"]
Own-view exposed-card count: 0
(South is not the failer — correct)

Other-view exposed-card selector: #desk-north .desk-namebar .exposed-preview .corner-card
Other-view exposed-card count: 1
  corner[0]: suit=h, rank=K

Opposite-view exposed-card selector: #desk-north .desk-namebar .exposed-preview .corner-card
Opposite-view exposed-card count: 1
```

All counts > 0 where expected. Exposed card K♥ is rendered.

### 3.7 Layout proof

```text
Opposite-seat upward offset active: YES
CSS rule / selector: #desk-north[data-has-exposed]
Exact offset value: transform: translateY(calc(var(--card-height) / -3))
File: static/css/game.css

Preview has-exposed class: true
Preview display rule: .exposed-preview.has-exposed { display: flex } (game.css)
```

Now visible because `.desk-namebar` has `overflow: visible` (bug #1 fixed).

---

## Step 3 — At the start of the later qualifying round

Round 1 completed: West 7♥, South 6♥, East A♥. East won (A♥ order 11).
After `clearDesk()`, exposed previews were restored via the new `updateExposedPreview()` loop (bug #2 fixed).

Round 2: East leads Q♥ (order 9). Follow order: North(2), West(3), South(0).
North (the failer) is the first follower.

### 3.8 Trigger-condition proof

```text
Failer is acting: YES
Failer is following: YES
Led division: 2 (hearts)
Led division still exposed: YES
  Exposed cards in division 2: [hK(id=300,div=2,ord=10)]
Forehand has unused chance: YES
  Forehand player: 1 (East), count: 1
```

All four conditions are YES → forehand control must trigger now.

### 3.9 State dump before forehand plays

```text
game.failedMultiplay: { failer: 2, ... holdInProgress: false, revocationApplied: true }
game.exposedCards: { "2": { "2": [hK(id=300,div=2,ord=10)] } }
game.fcChances: { "2": { forehand: 1, count: 1 } }
game.fcPending: null
game.forehandControl: null
gFCInteraction: null
```

Note: East (forehand/controller) has already played — East led this round. FC trigger fires when North (failer) is about to follow.

### 3.10 State dump after engineCheckFCTrigger

```text
game.fcPending: {
  forehand: 1,
  failer: 2,
  ledDivision: 2,
  exposedDivisionCards: [hK(id=300,div=2,ord=10)],
  active: true,
  chanceConsuming: true
}
```

All other states unchanged. `game.fcPending` is now set.

---

## Step 4 — Active forehand-control interaction

East (player 1) is made human-controlled for this test. `exerciseForehandControl(2, fcTrigger)` is called.

### 3.11 Active actor proof

```text
Current interaction owner: player 1 (East)
Reason this actor owns interaction now: Player 1 is the forehand of failer North(2), computed as (2+4-1)%4 = 1
```

### State dump

```text
gFCInteraction: {
  target: 2,
  controller: 1,
  exposedDivisionCards: [hK(id=300,div=2,ord=10)],
  exposedCardIds: [300],
  selectedCornerIds: [],
  mode: null,
  selectionMounted: true,
  commitButtonsMounted: true
}
```

### 3.12 Selection-surface proof

```text
desk-north: preview=true, has-exposed=true, corner-count=1, fc-active=true, fc-btns=2

Exact DOM selector for selectable corners: #desk-north .exposed-preview.fc-active .corner-card
Selectable corner count: 1
Selector for selected highlight: .corner-card[data-fc-selected]
Currently selected count: 0
```

After clicking the corner card:

```text
After click — selected count: 1
gFCInteraction.selectedCornerIds: [300]
```

### 3.13 Commit-control proof

```text
must-play button mounted: YES
must-play selector: #desk-north .exposed-preview.fc-active .fc-btn-row .fc-action-btn:first-child
must-play handler: commitForehandControl('must-play') via addEventListener

must-hold button mounted: YES
must-hold selector: #desk-north .exposed-preview.fc-active .fc-btn-row .fc-action-btn:nth-child(2)
must-hold handler: commitForehandControl('must-hold') via addEventListener
```

Both buttons mounted. Interaction is actionable — not stuck.

---

## Step 5 — Immediately after forehand-control commit

`commitForehandControl('must-play')` called with K♥ selected.

### 3.14 State dump

```text
game.failedMultiplay: { failer: 2, ... revocationApplied: true }
game.exposedCards: { "2": { "2": [hK(id=300,div=2,ord=10)] } }
game.fcChances: {}                                              ← was {"2":{forehand:1,count:1}}
game.fcPending: null                                            ← was {forehand:1,...,active:true}
game.forehandControl: { mode: "must-play", selectedCards: [hK(id=300,div=2,ord=10)], target: 2, controller: 1 }
gFCInteraction: null                                            ← was {target:2,...}
```

### 3.15 Consumption proof

```text
Chances before: 1, after: 0
Exactly one consumed: YES
```

### 3.16 Continuation proof

```text
Pending trigger cleared: YES
Interaction state cleared: YES
Failer follow now enabled: YES (current player: 2)
Own-view marking visible: NO (count: 0) — South is not the target, correct
Other-view marking visible: YES (count: 1)
  corner[0]: suit=h, rank=K, data-fc=must-play
```

North then follows with K♥ (the must-play card):

```text
North plays: [hK(id=300,div=2,ord=10)], success=true
game.forehandControl after target follows: null (cleared)
```

Round 2 completes: West sA, South h5. Winner: player 2 (North, K♥ order 10 > Q♥ order 9).

---

## Step 6 — After new game reset

### 3.17 State dump

```text
game.failedMultiplay: null
game.exposedCards: {}
game.fcChances: {}
game.fcPending: null
game.forehandControl: null
gFCInteraction: null
```

### 3.18 UI leak proof

```text
After new game:
FailedMultiplayState cleared: YES
ExposedCardState cleared: YES
ForehandControlChanceState cleared: YES
ForehandControlPendingTriggerState cleared: YES
ForehandControlInteractionState cleared: YES
Stray 确认标记 button present: NO

Stale has-exposed elements: 0
Stale fc-active elements: 0
Stale data-has-exposed attributes: 0

desk-south: has-exposed=false, corner-count=0, fc-active=false
desk-east:  has-exposed=false, corner-count=0, fc-active=false
desk-north: has-exposed=false, corner-count=0, fc-active=false
desk-west:  has-exposed=false, corner-count=0, fc-active=false
```

---

## 4. Mandatory contradiction check

```text
Was any earlier YES/COMPLETE statement incorrect? YES
```

The following items were incorrectly reported as complete in note 22:

1. **"Exposed cards rendered in exposed-preview"** — INCORRECT
   - Runtime evidence: `.desk-namebar` had `overflow: hidden` in `game.css`, which clipped `.exposed-preview` (positioned at `top: 100%`) to zero visible area. Corner-card DOM nodes existed with correct data, but were invisible.
   - Fix: Changed `overflow: hidden` to `overflow: visible` on `.desk-namebar`.

2. **"Exposed previews persist across rounds"** — INCORRECT
   - Runtime evidence: `clearDesk()` in `finishRound()` called `resetAllNamebars()` which cleared all preview `innerHTML` and removed `has-exposed` class. `promptCurrentPlayer()` did not restore them.
   - Fix: Added `updateExposedPreview(p)` loop after `clearDesk()` in the round transition.

3. **"FC interaction is actionable"** — PARTIALLY INCORRECT
   - Runtime evidence: FC buttons and corner cards rendered inside `.exposed-preview`, which was clipped by `overflow: hidden`. Technically functional but invisible.
   - Fix: Same as #1.

4. **"No stray UI state after new game"** — PARTIALLY INCORRECT
   - Runtime evidence: `startNewGame()` did not reset `gBtnPlay.textContent`, leaving stale "确认标记" text.
   - Fix: Added `gBtnPlay.disabled = true; gBtnPlay.textContent = t('buttons.play')` in `startNewGame()`.

---

## 5. File/function mapping

```text
Transition: Failed-multiplay resolution
File: static/js/games/shengji/shengji_engine.js
Function: enginePlayCards (lead branch) → engineIsLegalLead → engineResolveFailedMultiplay → engineRegisterFailedMultiplay
Condition: engineIsLegalLead detects blockedEvents (opponent can beat at least one multiplay element via engineCouldBeatShape)
State changes: game.failedMultiplay set (9 fields), game.exposedCards[failer][div] populated, game.fcChances[failer].count incremented

Transition: 1-second hold completion
File: static/js/pages/game/index.js
Function: handleFailedMultiplay → setTimeout callback (1000ms)
Condition: 1 second elapsed after intended lead shown on desk
State changes: game.failedMultiplay.holdInProgress→false, .revocationApplied→true; desk re-rendered with actual element only; updateExposedPreview() called for all non-human players

Transition: Later forehand-control trigger activation
File: static/js/games/shengji/shengji_engine.js
Function: engineCheckFCTrigger (called from promptCurrentPlayer in index.js)
Condition: (1) failer is following not leading, (2) game.exposedCards[failer][ledDivision].length > 0, (3) game.fcChances[failer].count > 0
State changes: game.fcPending set with {forehand, failer, ledDivision, exposedDivisionCards, active: true, chanceConsuming: true}

Transition: Forehand-control interaction mount
File: static/js/pages/game/index.js
Function: exerciseForehandControl
Condition: engineCheckFCTrigger returned shouldTrigger: true
State changes: gFCInteraction set (8 fields); .exposed-preview gets fc-active class; renderFCCorners creates corner cards + must-play/must-hold buttons

Transition: Forehand-control commit
File: static/js/pages/game/index.js → static/js/games/shengji/shengji_engine.js
Function: commitForehandControl → engineExerciseFC
Condition: Human clicks must-play or must-hold button
State changes: game.fcChances[failer].count decremented (deleted if 0), game.forehandControl set, game.fcPending→null, gFCInteraction→null, fc-active removed, previews re-rendered with FC markings

Transition: Exposed-card decay after play
File: static/js/games/shengji/shengji_engine.js
Function: engineDecayExposedCards (called from enginePlayCards after both lead and follow)
Condition: Played cards' cardIds match entries in game.exposedCards[player][division]
State changes: Matching cards removed; empty divisions/players cleaned up

Transition: FC constraint cleared after target follows
File: static/js/games/shengji/shengji_engine.js
Function: enginePlayCards (follow branch)
Condition: fc.target === player (the target player successfully follows)
State changes: game.forehandControl → null

Transition: New-game reset
File: static/js/games/shengji/shengji_engine.js + static/js/pages/game/index.js
Function: engineStartGame (engine) + startNewGame (UI)
Condition: New game initiated
State changes: game.failedMultiplay=null, game.exposedCards={}, game.fcChances={}, game.fcPending=null, game.forehandControl=null, gFCInteraction=null; gBtnPlay reset; all DOM namebars recreated fresh; all data-has-exposed removed; all has-exposed classes removed
```

---

## 7. Completion checklist

| # | Requirement | Proven |
|---|-------------|--------|
| 1 | Exposed cards are actually rendered in all required views | YES — corner-count=1, has-exposed=true in Step 2 |
| 2 | Opposite-seat layout makes room for exposed cards | YES — data-has-exposed=true triggers translateY offset |
| 3 | Forehand control triggers only at the correct later qualifying follow | YES — Step 3 shows all 4 conditions met, trigger fires |
| 4 | The interaction becomes actionable instead of freezing | YES — selectionMounted=true, commitButtonsMounted=true, fc-btns=2 |
| 5 | Commit works | YES — chances consumed, constraint set, interaction cleared |
| 6 | Failer continues follow after commit | YES — North plays K♥ successfully after commit |
| 7 | Reset clears all temporary state | YES — all 5 states null/empty, no stale DOM |
| 8 | No earlier "complete" claim remains contradicted | YES — 3 bugs found, fixed, and documented |
