# Failed Multiplay Continuation Note and Rules Bridge

This document has two parts:

1. a practical note to the coding agent
2. a formal bridge section to add to the rules/specification

Its purpose is to clarify what happens:

- inside the lead move when a failed multiplay is resolved
- after that, when the round continues from the actual led element

---

# Part I — Note to Coding Agent

## 1. Core distinction

Failed-multiplay handling has two layers:

### Layer A — inside the lead move
This is the resolution of the attempted multiplay itself.

It includes:

1. accept the intended lead into the authoritative lead pipeline
2. canonically decompose the intended lead
3. detect blocked elements
4. determine the actual blocker
5. determine the actual led element
6. record revoked / non-led cards from the attempted multiplay
7. announce / emit the failed-multiplay result
8. finalize the lead move so that the **actual led element** becomes the real lead of the round

At this stage, do **not** yet apply later-seat follow rules such as:
- 3rd-seat-low
- forehand control
- normal later follow decisions

Those belong to Layer B.

### Layer B — after the lead move is resolved
This is the continuation of the round after the failed multiplay has already been resolved.

At this stage:

1. the actual led element becomes the authoritative live lead state
2. the next player in seat order follows that actual led element
3. all later follow legality is computed against that actual led element
4. if the relevant seat and situation trigger **3rd-seat-low**, apply it here
5. if **forehand control** is active, apply it here in the normal follow-legality pipeline
6. evaluate later follows as discard / division follow / potential ruff / cover using the actual led element as the lead reference

So:

- failed-multiplay resolution happens first
- then the round continues normally from the actual led element
- 3rd-seat-low and forehand control are part of this continuation stage, not part of selecting the blocker or selecting the actual led element

---

## 2. Strict invariant

After a failed multiplay:

> the attempted multiplay no longer serves as the live lead for follow legality; only the **actual led element** serves as the live lead for the rest of the round.

This invariant must be enforced in code.

Do not continue to evaluate later follows against the whole attempted multiplay.

---

## 3. Correct implementation split

The implementation should use two explicit conceptual stages:

```text
resolveFailedMultiplayLead(...)
continueRoundFromActualLead(...)
```

### `resolveFailedMultiplayLead(...)`
Should handle:

- canonical decomposition of intended lead
- blocked-element detection
- actual-blocker determination
- actual-led-element determination
- revoke bookkeeping
- failed-multiplay announcement/event emission
- replacement of live lead state with the actual led element

### `continueRoundFromActualLead(...)`
Should handle:

- next-seat follow legality
- later-seat special rules such as 3rd-seat-low
- forehand control, if active
- cover / ruff / discard evaluation
- round-state progression
- winner determination

---

## 4. Timing warning

Do **not** throw “multiplay failed” as a local pre-submit error when the player clicks **Play**.

Correct timing:

- local UI may only reject obvious mechanical issues such as mixed-division intended lead
- failed multiplay must be detected only inside the authoritative lead-resolution pipeline
- after failed-multiplay resolution, the round must continue from the actual led element

So failed multiplay is:

- not a malformed-selection error
- not a local to-play validation message
- not an action rejection

It is an authoritative gameplay result that changes the live lead state.

---

## 5. 3rd-seat-low and forehand control

These are **not** part of selecting the blocker or selecting the actual led element.

They are part of the later continuation of the round after failed-multiplay resolution.

Therefore:

- 3rd-seat-low must be checked when the relevant later seat is about to follow the actual led element
- forehand control must be applied in the normal follow-legality pipeline after the actual led element has become the live lead state

Do not apply either of them during blocker selection.

---

## 6. Bot rule for forehand control

For the bot performing **forehand control**, always create:

```text
ForehandControl:
    mode = "mustPlay"
    selectedCards = []
```

This is the fixed bot behavior unless later overridden.

---

## 7. Bot choice rule when one bot blocks multiple different element types

If a single bot is the chosen blocker and can block multiple candidate led elements of different types, then the bot must choose the blocked element with the **highest copy**.

Priority order:

1. highest `copy`
2. then normal type ranking
3. then existing deterministic tie-break if needed

Do **not** replace this with random choice.

---

# Part II — Bridge Section for Rules / Specification

The following section may be inserted into the rules/specification after the failed-multiplay section.

---

## Failed-multiplay continuation protocol

After a failed multiplay is detected and the actual blocker and actual led element are determined, the game does not reject the action. Instead, the round continues according to the following protocol.

### 1. Live lead replacement

The **actual led element** replaces the attempted multiplay as the authoritative live lead for the remainder of the round.

From this point onward:

- follow legality
- cover evaluation
- ruff evaluation
- round-state progression

must all be computed against the actual led element, not against the original attempted multiplay as a whole.

### 2. Status of the attempted multiplay

The originally selected multiplay remains part of the move history as the player’s attempted lead.

However, for live round logic, only the actual led element is used as the real lead.

Any cards from the attempted multiplay that are not part of the actual led element are treated according to the failed-multiplay revoke / non-led handling rules.

### 3. Seat-order continuation

After the actual led element is established as the live lead:

1. the next player in seat order follows the actual led element
2. then the remaining later seats follow in normal order

The round does not restart.

The round continues from the same lead move, now resolved to the actual led element.

### 4. Application of later follow rules

Any later-seat special rules apply in their normal follow timing after the actual led element has become the live lead.

This includes, when applicable:

- 3rd-seat-low
- forehand control
- normal DFP / SFP follow legality
- discard / division follow / potential ruff classification
- cover determination

These rules are not part of blocker selection.
They apply only during later follows after failed-multiplay resolution.

### 5. Authoritative result nature

Failed multiplay is an authoritative gameplay result.

It is not:

- a local selection-format error
- a local to-play rejection
- a cancellation of the lead action

It is a state transition that converts the attempted multiplay into a round whose real lead is the actual led element.

### 6. Required engine behavior

An implementation is correct only if it does all of the following:

1. resolves failed multiplay inside the authoritative lead pipeline
2. replaces live lead state with the actual led element
3. continues later follow logic from that actual led element
4. applies 3rd-seat-low and forehand control only in the subsequent follow stage
5. does not treat failed multiplay as a local Play-button error

---

## Short implementation summary

A practical engine may treat the post-failure flow as:

```text
attemptedLead
-> failedMultiplayResolution
-> actualLedElement
-> normalRoundContinuation(actualLedElement)
```

where `normalRoundContinuation(...)` includes all later-seat follow rules, including 3rd-seat-low and forehand control when applicable.
