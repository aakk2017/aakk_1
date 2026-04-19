# Shengji Rules — AI-Accessible Rewrite

This document rewrites the current rule set in a stricter, implementation-oriented language.  
It is meant to be read by coding agents and by humans who want an unambiguous engine spec.

This document is a **rules/specification file**, not a bot policy file and not a pseudo-code file.  
Where useful, it names procedures such as **SFP** and **DFP**, but it does not replace the separate pseudo-code modules.

---

## 1. Scope and principles

1. The game state is interpreted **strictly**. There is no tolerance for “close enough” interpretations.
2. A card combination is legal only if it satisfies the exact definitions below.
3. For evaluation and legality:
   - a **lead** is interpreted **canonically**
   - a **follow** is interpreted **existentially**
4. A **one-element lead is not a multiplay**.
5. Unless a section explicitly says otherwise, all comparisons are made using the current frame’s:
   - `division`
   - `order`
   - `type`
   - suit order
   - deterministic card identity tie-break if needed

---

## 2. Card model

Each physical card has these properties:

- `suit`
- `rank`
- `order`
- `division`
- `cardId`

### 2.1 Value, order, and division

A card’s **value** is defined by:

- `(suit, rank)`

A card’s **order** and **division** are defined by the current frame state:

- level
- global strain
- trump rules

### 2.2 Equality rules

Cards may share the same `division` and `order` without being equal-valued.

However, cards with the same `suit` and `rank` always share the same `division` and `order`.

Therefore:

- duplicate counting for the **copy** of an element is by **value** `(suit, rank)`,
- not by `(division, order)`.

This matters especially for plain levelers in a suited frame.  
For example, with level `7` and strain `h`, the cards `s7`, `c7`, and `d7` may all be plain levelers in trump, with the same division and order, but they are **not** the same value and cannot form duplicates of one another.

### 2.3 `cardId`

Every physical card object must have a unique `cardId`.

This is used only for deterministic implementation purposes such as:

- tie-breaking between otherwise equal cards
- stable sorting
- distinguishing physical duplicates of the same value

`cardId` does **not** affect rules of value, order, copy, or span.

---

## 3. Frame phases

A frame proceeds through these phases:

1. dealing
2. declaration
3. basing
4. playing
5. counting
6. frame result / level update

---

## 4. Declaration phase

### 4.1 General rule

Any player may declare, provided the declaration is legal under the current declaration rules.

Declaration legality and button availability depend on:

- the player’s current hand
- the current declaration state
- the overcall rules

### 4.2 Global strain

The **global strain** is determined after declaration closes.

Until the global strain is finalized, temporary UI representations are allowed, but all playing-phase legality and evaluation must use the finalized reassigned `order` and `division`.

---

## 5. Basing phase

The pivot picks up the base, then sets the final base.

The final baser may know the exact base contents. This matters for later **leader-known information** in fake-multiplay detection.

---

## 6. Playing phase — card combinations

## 6.1 Single division requirement

A legal lead is always **single-divisioned**.

A legal lead may not mix cards from different divisions.

If mixed divisions appear in an intended lead, that is an illegal lead, not a special case to reinterpret.

---

## 6.2 Element

An **element** is the indivisible object in hand evaluation.

An element is either:

- a single card, or
- duplicates of consecutive orders in one division

### 6.2.1 Element properties

For an element:

- `volume` = number of cards in the element
- `copy` = number of duplicates of each order
- `span` = number of consecutive orders
- `division` = inherited from the cards
- `order` = the highest order in the element

The type of an element is:

- `(copy, span)`

### 6.2.2 Copy and span restrictions

- `copy` is a positive integer
- if `copy = 1`, then `span` must be `1`
- if `copy > 1`, then `span` may be any positive integer
- in the default 2-deck game, `copy` can only be `1` or `2`

Also:

- `volume = copy × span`

### 6.2.3 Duplicate counting

To realize an element of type `(copy, span)`, each order in the consecutive run must contain at least `copy` cards of the **same value** `(suit, rank)`.

It is not enough that cards merely share the same `division` and `order`.

### 6.2.4 Type ranking

Types are ranked lexicographically by:

1. `copy` first
2. then `span`

So `(3,1)` is higher than `(2,100)`, and `(2,3)` is higher than `(2,2)`.

### 6.2.5 Element comparison

Only elements of the **same type** are directly comparable.

Between elements of the same type:

- compare `order`
- if still tied, use suit ordering
- if still tied, use deterministic identity tie-break

### 6.2.6 Examples

- `(1,1)` = single
- `(2,1)` = pair
- `(2,n)` with `n > 1` = consecutive pairs / tractor

---

## 6.3 Potential element

A **potential `(c, s)` element** in a set of cards means:

- all cards are in one division
- the element uses `s` consecutive orders
- for each order, there are at least `c` copies of one value `(suit, rank)` at that order

A potential element is a candidate element that can be constructed from the current card set.

---

## 6.4 Lead and resolved lead

### 6.4.1 Canonical decomposition of a lead

A lead is decomposed **canonically** and **greedily**.

Procedure:

1. find the potential element of the highest type in the lead
2. if multiple exist, choose the highest one by:
   - order
   - suit
   - deterministic tie-break
3. remove its cards
4. repeat on the remaining cards
5. stop when no cards remain

The set of extracted elements is the **resolved lead**.

Once an element is extracted, its cards are removed and may not be reused.

### 6.4.2 Lead volume

The volume of a lead is the total number of cards in it.

This equals the sum of volumes of the elements in the resolved lead.

### 6.4.3 Lead type

The type of a lead is the multiset of the element types in the resolved lead.

### 6.4.4 Core element

Sort the elements in the resolved lead by:

1. type descending
2. order descending
3. suit order
4. deterministic tie-break

The top element is the **core element**.

Its type is the **core type**.

---

## 6.5 Multiplay

A lead is a **multiplay** if and only if its resolved lead contains **more than one element**.

Therefore:

- one-element lead = **not** a multiplay
- two or more elements = multiplay

---

## 7. Following a lead

A follow must satisfy both:

1. **volume requirement**
2. **division / structure requirement**

---

## 7.1 Volume requirement

A follow must contain exactly as many cards as the lead.

---

## 7.2 Short-division rule

If the follower holds no more cards in the led division than the lead volume, then:

1. all cards in the led division must be played
2. the remaining volume gap is filled with cards from other divisions

This is the forced short-division case.

---

## 7.3 Structural Follow Procedure (SFP)

### 7.3.0 Scope of SFP

SFP is used only for following a led element with `copy >= 2`.

A led single `(1,1)` does **not** use SFP.

### 7.3.1 Purpose

SFP determines the **structured part** of the follow for one led non-single element.

It does **not** fill the remaining volume gap. Fillers are handled later.

### 7.3.2 Search priority

To follow a led element of type `(c, s)`:

- search `k = c, c-1, ..., 2`
- for each `k`, search `j = s, s-1, ..., 1`

For the first `(k, j)` type that exists:

- the player may choose any candidate element of that type
- once such a `(k, j)` is found at this recursion layer, smaller `j` at that `k` and all lower `k` are not considered at that layer
- recurse with residual requirement `(k, s-j)`

The procedure terminates when `s = 0`, or when no candidate exists for any `k >= 2`.

### 7.3.3 Output of SFP

The output of SFP is the **structured part** for that led element.  
All elements produced by SFP have `copy >= 2`.

Singles are not part of SFP output.

---

## 7.4 Division Follow Procedure (DFP)

The procedure for following a **whole lead** is the **Division Follow Procedure (DFP)**.

### 7.4.1 DFP structure

1. resolve the lead into elements
2. process the resolved lead elements in order
3. for each non-single led element, run SFP
4. singles in the lead contribute no SFP output
5. after all structured parts are determined, fill the remaining volume gap

### 7.4.2 Deferred fillers

Fillers are chosen only **after all structured obligations are processed**.

This prevents the follower from consuming cards prematurely and then claiming to be unable to satisfy later led elements.

---

## 7.5 Existential legality of a follow

A follow is legal if and only if the chosen cards admit a decomposition into:

- a **structured part**
- and a **filler part**

such that:

1. the structured part is exactly one valid DFP/SFP outcome
2. the filler part satisfies the remaining volume requirement
3. division constraints are satisfied

Important:

- the selected follow is **not** first greedily decomposed as if it were a lead
- legality is **existential**, not canonical

So a follow is legal if there exists at least one valid interpretation that matches the rule.

---

## 7.6 Forehand control

Forehand control applies to follow selection when active.

Modes:

- `none`
- `must-play`
- `must-hold`

### 7.6.1 Structured part

At each SFP recursion layer, among equal-type admissible candidates:

- `must-play` keeps only those containing the **maximum** number of marked cards
- `must-hold` keeps only those containing the **minimum** number of marked cards
- ties remain free choice

### 7.6.2 Filler part

Forehand control also applies to fillers.

Among legal filler choices:

- `must-play` requires the filler part to contain as many marked cards as possible
- `must-hold` requires the filler part to contain as few marked cards as possible
- ties remain free choice

---

## 8. Evaluation of a round

Evaluation distinguishes these kinds of hands relative to the lead:

- discard
- division-follower
- potential ruff

---

## 8.1 Discard

A follow is a **discard** if it is lower than every division-follower under the evaluation rules.

Examples include:

- off-division follow in a trump-led round
- partial-discard hands
- non-covering potential ruffs

---

## 8.2 Division-follower

A follow is a **division-follower** if it fully follows the led division.

In a one-element round, only **same-type** division-followers are comparable by order.  
A same-division follow of a different type may still be a legal follow, but it is lower than every same-type division-follower and cannot cover.

In a multiplay round, division-followers are always below the lead unless a valid covering ruff appears.

---

## 8.3 Potential ruff

A follow is a **potential ruff** only if:

- the lead division is plain
- the follow is all trump
- the volume matches
- the trump follow admits some decomposition into elements whose type multiset matches the lead type multiset

Important:

- potential-ruff decomposition is **not** required to be the natural decomposition
- only existence of an admissible decomposition matters

Among all admissible ruff decompositions, use the one whose **core element** has the highest order.

A non-covering potential ruff does **not** count as a ruff in evaluation; it is treated as a discard.

---

## 8.4 Covers

A follow is a **cover** if it is higher than all earlier hands already played in the same round.

In a one-element round:
- a same-type division-follower may cover by higher order
- a same-division follow of a different type cannot cover
- ties do not cover, because earlier play wins the tie

The engine may track this incrementally with round-global state such as:

- `ruffed`
- `highestOrder`
- `highestPlayer`

---

## 8.5 Winner of the round

After all four hands are accepted:

- the winner is the player currently recorded as the highest hand in the round
- the next leader is the winner

---

## 9. Failed multiplay

A multiplay fails if at least one element in the resolved lead is lower than a same-type, same-division possible element in some follower’s hand.

### 9.1 Detection

Each resolved led element is checked independently against each follower’s current hand.

If a follower can form a strictly higher same-type blocker for that element, that element is blocked.

### 9.2 Blocked elements

The blocked elements are the distinct led elements for which such block events exist.

### 9.3 Actual blocker

If multiple blockers exist:

1. blocker seat priority is:
   - 4th seat
   - 2nd seat
   - 3rd seat
2. if the chosen blocker blocks multiple elements of the same type, reduce them to the **lowest** among those same-type elements
3. if multiple candidates remain, the blocker chooses which one is actually led

The result is:

- failed or not
- blocked elements
- actual led element
- actual blocker

---

## 10. Fake multiplay

Fake multiplay is conceptually different from ordinary failed multiplay.

A failed multiplay depends on the **actual current hands**.  
A fake multiplay depends on the **leader-known information state**.

---

## 10.1 Leader-known information state

For fake-multiplay checking, the relevant information is the union of:

- all table-visible information
- the leader’s own current hand
- the base, if known to the leader (for example, if the leader is the final baser)

This is the information set used for fake detection.

---

## 10.2 Definition of fake multiplay

A multiplay is **fake** if, according to the leader-known information state, the intended resolved lead cannot survive.

In this current simplified implementation policy:

- the single part is checked
- the structured part is compressed by type
- each remaining structured type is checked individually
- if any checked part is surely blocked, the multiplay is fake
- if all checked parts pass, the multiplay is treated as safe

Current policy:

- do **not** run the joint structured-part search
- use only individual checks

Also:

- if the resolved lead has only one element, do **not** run fake-multiplay check

### 10.2.1 Compression by type

If multiple structured elements in the structured part have the same type, keep only the **lowest-ordered** one for fake checking.

This is sufficient for element-wise fake detection.

### 10.2.2 Single-part check

The single part is fake if a higher same-division single is forced into a follower’s hand under leader-known information.

### 10.2.3 Structured-part check

A structured element is individually fake if it is surely blocked under leader-known information.

In the current simplified rule handling, fake detection of structured parts is done **element by element** after type compression.

---

## 10.3 Formal vs casual use

Conceptually:

- fake multiplay should be a foul in formal matches
- in casual or current-project handling, it may be treated like an ordinary failed multiplay

Timing rule:

- local pre-send UI should not warn about fake multiplay
- fake detection should occur at authoritative lead handling time
- in test/formal contexts, the referee may announce it at the same time as failed-multiplay resolution

---

## 11. Counting phase

At the end of the playing phase:

1. reveal the base if required
2. determine who wins the base
3. compute base score if attackers win the base
4. add base score with the proper endgame factor
5. obtain final frame score

---

## 11.1 Counter cards

Counter values:

- `5` = 5 points
- `X` = 10 points
- `K` = 10 points

### 11.1.1 Base update requirement

If the attackers win the base, the base counters must be added to the frame score with the correct endgame factor before frame result and level update are determined.

---

## 11.2 Frame score

The frame score is the attackers’ total points.

At the end of each round:

- if the round winner is on the attacking side, add the trick’s counter points to the frame score
- otherwise do not add them

An attacking winning streak may also be updated after each round if the ending rules need it.

Important:

- this running round-by-round total is **not yet the final frame score**
- the counting phase must still resolve the base winner, base score, and endgame factor
- only after that counting-phase update is the final frame score obtained

---

## 12. Frame result and level update

The frame result is determined from the final frame score under the chosen scoring system.

This determines:

- whether defense holds or fails
- how many levels the attackers advance
- whether defenders advance
- who becomes the next pivot

---


## 12A. Preset game configurations

All preset configurations below assume a **two-deck game**.

A preset configuration sets a named bundle of rule parameters.  
If a parameter is not explicitly changed by the preset, it uses the default value from the main rule set.

### 12A.1 `default`

Use the default settings defined by the main rule set.

### 12A.2 `plain`

Use default settings, except:

- no must-stop levels

### 12A.3 `high-school`

Use default settings, except:

- allow overbase
- no restrictions on overbase
- double-declaration ordering: `s-h-c-d`
- level configuration: `high-school`
- unlimited knock-back
- unlimited endgame factor

### 12A.4 `Berkeley`

Use default settings, except:

- allow overbase
- no restrictions on overbase
- double-declaration ordering: `s-h-c-d`
- allow crossings
- unlimited endgame factor

### 12A.5 `experimental`

Use default settings, except:

- turn on ending compensation
- counting uses the `7-3-5` system

### 12A.6 Suggested implementation shape

A preset configuration may be represented as a configuration object, for example:

```text
PresetConfig:
    deckCount = 2

    mustStopLevels
    allowOverbase
    overbaseRestrictions
    doubleDeclarationOrdering
    levelConfiguration
    allowCrossings
    knockBackLimit
    endgameFactorLimit
    countingSystem
```

### 12A.7 Recommended inheritance rule

To avoid ambiguity in implementation:

1. load the `default` configuration first
2. apply the named preset overrides
3. apply any explicit table / room custom overrides last

This makes preset handling deterministic.


## 13. Implementation notes

1. Leads are canonical; follows are existential.
2. Duplicate counting is by value `(suit, rank)`.
3. Equal-valued physical copies must not be double-counted in count-based search.
4. Potential ruffs use admissible type-preserving decompositions, not natural decomposition.
5. A one-element lead is not a multiplay.
6. A legal lead must be single-divisioned.
7. For deterministic implementation, use `cardId` only as a stable tie-break, never as part of game value.

---

## 14. Out of scope here

This document does not define:

- bot behavior
- network synchronization
- UI behavior
- pseudo-code function bodies

Those belong in separate files.
