# UI Requirements Addendum 01 — Interaction Rules

This addendum extends the base UI requirements file.

It records newly added interaction requirements for the Shengji project.

Status of items in this addendum:
- mandatory unless later overridden by a newer addendum

Precedence:
- if this addendum conflicts with the earlier base UI requirements file, this addendum takes priority
- otherwise, the base UI requirements file still applies

---

## 1. Scope

This addendum defines additional interaction behavior for:

- card selection
- follow assistance
- play confirmation
- illegal-selection feedback

These rules apply to the UI layer.
They do not replace the authoritative engine legality checks.

---

## 2. Auto-pop full led division in forced short-division follow

When the player is following a lead, and the number of cards in the led division in hand is no more than the number of cards required to follow, the UI should automatically pop up all cards in that division.

Purpose:
- visually indicate the forced short-division follow case
- help the player see that those cards must be included if they play

Important:
- this is a UI assistance rule, not a replacement for legality checking
- the authoritative engine must still enforce the short-division rule

Suggested implementation condition:

```text
if following and count(cardsInLedDivisionInHand) <= leadVolume:
    visuallyPopUp(cardsInLedDivisionInHand)
```

---

## 3. Auto-pop the unique legal structured part

When following a lead, if exactly one legal structured part exists under DFP/SFP, the UI should automatically pop up that structured part.

Purpose:
- show the forced structured obligation clearly
- reduce player confusion in deterministic follow situations

Important:
- this applies only to the structured part, not to fillers
- if there is more than one legal structured part, do not auto-pop any one of them as if it were forced

Suggested implementation condition:

```text
structuredParts = enumerateLegalStructuredParts(...)
if length(structuredParts) == 1:
    visuallyPopUp(structuredParts[0])
```

---

## 4. Single-follow overflow selection rule

This rule applies only when the player is following a **single-card** lead.

If the player is following one card, and one card is already selected, then when the player selects another card, the previously selected card should be deselected automatically.

In other words:
- this rule applies only for `n = 1`
- do not generalize this rule to arbitrary follow volume

Purpose:
- keep single-follow selection friction low
- make card replacement quick during single-card follow

Suggested behavior:

```text
if followingSingleCardLead:
    if selectedCardCount == 1 and userSelectsAnotherCard:
        deselect(firstSelectedCard)
        select(newCard)
```

---

## 5. Mouse interaction shortcuts

### 5.1 Right click clears selection

Right click should clear the current selection.

This should be treated as a fast interaction shortcut.

Suggested behavior:

```text
onRightClick:
    clearCurrentSelection()
```

### 5.2 Double click emits play intent

Double click on a valid currently selected card set should trigger the same action as pressing the Play button.

In other words:
- double click does not bypass the normal to-play pipeline
- it emits the same **to-play event**
- the same legality checks and error handling must still run

Suggested behavior:

```text
onDoubleClick:
    emitToPlayIntent(currentSelection)
```

---

## 6. Error timing for illegal selection

Error feedback for illegal selection should be shown when the **to-play event** is emitted, not merely during card selection.

Examples of to-play events:
- clicking the Play button
- double clicking to play

Examples of illegal selection cases:
- intended lead mixes divisions
- follow volume does not match the lead
- selected cards are not a legal follow
- malformed declaration/base action if applicable

This means:

- selection itself may remain flexible
- but once the player attempts to commit the action, the UI must show an error if the selection is invalid

Suggested behavior:

```text
onToPlayIntent(selection):
    if obviousMechanicalCheckFails(selection) or localLegalityCheckFails(selection):
        showSelectionError(...)
        doNotSendAction()
    else:
        sendActionToAuthoritativeEngine(...)
```

Important:
- local error display does not replace authoritative engine judgment
- authoritative rejection must still be handled if the local layer missed something

---

## 7. Relationship to engine legality

These UI behaviors are assistive only.

They must not replace:

- lead legality checks
- follow legality checks
- failed-multiplay detection
- fake-multiplay handling
- authoritative accept/reject logic

The UI may:
- guide
- highlight
- pre-check obvious cases
- show local error on to-play intent

But the authoritative engine must still decide legality.

---

## 8. Suggested implementation notes for coding AI

1. Keep the selection model separate from the authoritative game state.
2. Use visual pop-up / raised-card state only as an interaction aid.
3. Do not silently auto-submit a move just because cards are auto-popped.
4. Double click should use the same to-play pathway as the Play button.
5. Right click clear-selection should not affect authoritative game state until a commit action occurs.

---

## 9. Summary of newly added requirements

This addendum adds the following mandatory UI interaction rules:

1. auto-pop all cards in the led division if short-division follow is forced
2. auto-pop the unique legal structured part if exactly one exists
3. when following a single-card lead, selecting a new card replaces the old selection
4. right click clears selection
5. double click emits the same to-play event as the Play button
6. illegal-selection error is shown when the to-play event is emitted
