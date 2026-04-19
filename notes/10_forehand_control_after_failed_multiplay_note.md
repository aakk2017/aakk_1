# Note to Coding Agent — Forehand Control After Failed Multiplay

This note clarifies the exact meaning, timing, and usage of **forehand control** after a failed multiplay.

The purpose of this note is to eliminate implementation ambiguity.

---

## 1. Core concept

A failed multiplay may create:

1. an **exposed-card set** on the failer
2. one **forehand-control chance** granted to the failer's forehand

A single failed multiplay grants exactly **one** forehand-control chance.

The exposed-card set consists of the failer's exposed non-led cards from that failed multiplay.

---

## 2. What forehand control is

Forehand control is a one-time control right that the failer's forehand may apply later when the failer is about to **follow** an exposed division.

When forehand control is used, the forehand chooses:

1. a control mode:
   - `mustPlay`
   - `mustHold`
2. a selected subset of exposed cards from the relevant division
   - the selected set may be empty

Then the failer's follow in that division is judged under that forehand-control condition.

---

## 3. Trigger timing

Forehand control does **not** trigger immediately when the failed multiplay happens.

It triggers only at a later time:

> when the failer is going to **follow** a division that is currently still an exposed division for that failer

This is not always the next round.

If the next round is not led in an exposed division, forehand control is not activated then.

The failer may even reduce or remove exposed cards before forehand control is triggered, for example by discarding them before that division is led again.

---

## 4. Exact timing inside the later round

The timing is:

1. the forehand plays his own hand
2. immediately after that, if the next player to act is the failer and the failer is about to follow a currently exposed division, the forehand-control decision must be made
3. only after that decision is made does the failer select and commit the follow under the resulting forehand-control condition

So the forehand chooses **before** the failer selects his follow.

Do **not** implement forehand control as something chosen after the failer has already selected cards.

---

## 5. Must-use-or-lose rule

Forehand control is a **must-use** trigger.

If the trigger condition is met, then the forehand must either:

- use one forehand-control chance immediately, or
- lose that chance immediately

The forehand may choose an empty selected-card set.
That still counts as **using** the chance.

There is no postponement.

---

## 6. One failed multiplay gives one chance

Each failed multiplay grants exactly **one** forehand-control chance in the frame.

These chances may accumulate across the same frame.

All such chances reset when the playing phase is over.

Do **not** let one failed multiplay produce multiple uses.

Do **not** carry unused chances into the next frame.

---

## 7. Multiple failed multiplays and multiple exposed divisions

A player may fail multiplays in multiple divisions within the same frame.

Example:
- East failed once in clubs, exposing club cards
- East later failed once in hearts, exposing heart cards

Then:

- East has two forehand-control chances total
- clubs and hearts may both be exposed divisions at that time

When East is later going to follow one of those divisions, one forehand-control chance may be used then.

A second chance may be used later when another valid trigger occurs.

However, if all exposed cards of one division have already been played away, then that division no longer counts as an exposed division for trigger purposes.

---

## 8. Selection scope — led division only

This point is mandatory and must be implemented exactly.

When forehand control is triggered, the forehand may select marked cards **only from the exposed cards in the currently led division**.

Not from all exposed cards globally.

Example:

- East has exposed clubs `{cA, cK}` and exposed hearts `{hA, hK}`
- clubs and hearts are both exposed divisions
- now East is going to follow **clubs**

Then the forehand may choose marked cards only from:

- `{cA, cK}`

and not from:

- `{hA, hK}`

This restriction is necessary, especially when the failer is not able to fully follow the led division and must use discards.

Do **not** let marked-card selection cross from the currently led exposed division into other exposed divisions.

---

## 9. Trigger condition in precise form

A forehand-control trigger occurs only if **all** of the following are true:

1. the acting player is the failer
2. the acting player is about to **follow**, not lead
3. the current led division is a division in which that failer still has remaining exposed cards
4. the failer's forehand currently has at least one unused forehand-control chance for that frame

If these conditions are met, the forehand must use or lose exactly one chance immediately.

---

## 10. Consumption rule

When the trigger occurs and the forehand makes a choice:

- exactly one forehand-control chance is consumed

This is true even if:

- the selected marked-card set is empty
- the practical effect on the failer's eventual legal follow is minimal

Using an empty marked set is still a valid use and still consumes the chance.

---

## 11. Relationship to follow legality

Forehand control does not replace normal follow legality.

It modifies the follow-choice priority within the existing follow-legality framework.

So after the forehand chooses:

- mode = `mustPlay` or `mustHold`
- selected cards from the exposed cards of the currently led division

the failer's follow must still be checked by the normal pipeline, including:

- volume requirement
- short-division rule
- DFP / SFP
- filler handling
- existential legality

Forehand control changes the priority/filtering within legal outcomes.
It does not create a separate legality system.

---

## 12. Required implementation model

A correct implementation should track at least:

- remaining exposed cards by failer and by division
- remaining forehand-control chances by forehand/failer/frame
- trigger timing before the failer's follow selection
- control mode
- selected marked cards from the currently led exposed division only

A practical model is:

```text
ExposedState[failer][division] = set of remaining exposed cards
ForehandControlChances[forehand][failer] = integer count for current frame
```

At trigger time:

```text
if failer is about to follow ledDivision
   and ExposedState[failer][ledDivision] is non-empty
   and ForehandControlChances[forehand][failer] > 0:
       forehand must choose now:
           mode in {mustPlay, mustHold}
           selectedCards subset of ExposedState[failer][ledDivision]
       consume exactly one chance
       apply that forehand control to this follow
```

---

## 13. Things that must NOT be implemented incorrectly

Do **not** make any of the following mistakes:

1. triggering forehand control immediately when the failed multiplay happens
2. assuming the next round always triggers it
3. allowing the forehand to postpone the decision
4. allowing one failed multiplay to grant multiple uses
5. carrying chances into the next frame
6. allowing marked-card selection from exposed cards of other divisions
7. letting the failer select his follow before the forehand chooses
8. treating forehand control as a separate legality system instead of a modifier inside normal follow legality

---

## 14. Final invariant

The correct invariant is:

> After a failed multiplay, each failed multiplay grants one forehand-control chance; that chance is triggered later only when the failer is about to follow a still-exposed division, and the forehand must immediately use or lose it by choosing `mustPlay` or `mustHold` together with a subset of exposed cards from the currently led division only.
