# Shengji Engine Pseudo Code (Combined Strict Version)

This file consolidates the pseudo codes discussed so far.

Principles used in this file:

- Rules are interpreted **strictly**.
- A **one-element lead is not a multiplay**.
- Equality for duplicate counting is by **value** = `(suit, rank)`, not by `(division, order)`.
- A lead is assumed to be **single-divisioned** if legal.
- Event placeholders use `emitEvent(eventName, payload)`.
- UI / network / replay / testing layers may subscribe to engine events.

---

## Section 0 — Core data model

```text
Card:
    suit
    rank
    order
    division
    cardId

Element:
    cards
    division
    copy
    span
    order

ForehandControl:
    mode            // "none", "must-play", "must-hold"
    selectedCards

RoundState:
    leadCards
    leadDivision
    leadType
    resolvedLead
    leadIsOneElement
    leadCoreElement

    ruffed
    highestOrder
    highestPlayer

FrameState:
    pivot
    frameScore
    attackingWinningStreak
    nextLeader
```

---

## Section 1 — Event emission placeholders

```text
function emitEvent(eventName, payload):
    // placeholder only
    // UI, network, replay, and test modules may subscribe to events
    return
```

Suggested event names:

```text
DECLARATION_AVAILABLE
DECLARATION_MADE
GLOBAL_STRAIN_SET

BASE_PICKED_UP
BASE_SET

LEAD_INTENDED
LEAD_ACCEPTED
LEAD_REJECTED

FOLLOW_INTENDED
FOLLOW_ACCEPTED
FOLLOW_REJECTED

FAILED_MULTIPLAY_DETECTED
FAKE_MULTIPLAY_DETECTED

ROUND_STATE_INITIALIZED
COVER_OCCURRED
RUFF_OCCURRED
ROUND_ENDED

FRAME_SCORE_CHANGED
ATTACKING_STREAK_CHANGED

BASE_REVEALED
COUNTING_PHASE_STARTED
FRAME_ENDED
NEXT_PIVOT_DETERMINED
```

---

## Section 2 — Suit ordering

```text
function getSuitPriority(suit, strain):
    // higher value = higher priority

    if strain == "h":
        if suit == "h": return 3
        if suit == "c": return 2
        if suit == "d": return 1
        if suit == "s": return 0

    else if strain == "c":
        if suit == "c": return 3
        if suit == "d": return 2
        if suit == "s": return 1
        if suit == "h": return 0

    else if strain == "d":
        if suit == "d": return 3
        if suit == "s": return 2
        if suit == "h": return 1
        if suit == "c": return 0

    else:
        // strain == "s" or "nts"
        if suit == "s": return 3
        if suit == "h": return 2
        if suit == "c": return 1
        if suit == "d": return 0
```

---

## Section 3 — Basic comparators and helpers

```text
function compareDescending(a, b):
    if a > b: return +1
    if a < b: return -1
    return 0

function compareAscending(a, b):
    if a < b: return +1
    if a > b: return -1
    return 0
```

```text
function valueKey(card):
    return card.suit + "|" + card.rank

function typeKey(element):
    return "(" + element.copy + "," + element.span + ")"
```

```text
function containsCard(cards, targetCard):
    for each card in cards:
        if card.cardId == targetCard.cardId:
            return true
    return false
```

```text
function containsAllCards(bigSet, smallSet):
    bigCount = multiset of cardId from bigSet
    smallCount = multiset of cardId from smallSet

    for each id in smallCount:
        if count(id in bigCount) < count(id in smallCount):
            return false

    return true
```

```text
function removeCards(cards, cardsToRemove):
    removeIds = set of cardId from cardsToRemove
    result = []

    for each card in cards:
        if card.cardId not in removeIds:
            result.append(card)

    return result
```

```text
function cardsInDivision(cards, division):
    result = []
    for each card in cards:
        if card.division == division:
            result.append(card)
    return result
```

```text
function isSingleDivision(cards):
    if cards is empty:
        return false

    division = cards[0].division
    for each card in cards:
        if card.division != division:
            return false

    return true
```

```text
function getLeadDivision(leadCards):
    if isSingleDivision(leadCards) == false:
        throw Error("lead is not single-divisioned")

    return leadCards[0].division
```

```text
function unionOfElementCards(elements):
    result = []
    for each element in elements:
        append all element.cards to result
    return result
```

---

## Section 4 — Card and element comparison

```text
function compareCards(c1, c2, strain):
    if c1.division != c2.division:
        return compareDescending(c1.division, c2.division)

    if c1.order != c2.order:
        return compareDescending(c1.order, c2.order)

    if c1.suit != c2.suit:
        p1 = getSuitPriority(c1.suit, strain)
        p2 = getSuitPriority(c2.suit, strain)
        return compareDescending(p1, p2)

    return compareAscending(c1.cardId, c2.cardId)
```

```text
function chooseHighestCard(cards, strain):
    best = cards[0]

    for each card in cards:
        if compareCards(card, best, strain) > 0:
            best = card

    return best
```

```text
function compareSameTypeElements(e1, e2, strain):
    if e1.copy != e2.copy or e1.span != e2.span:
        throw Error("compareSameTypeElements: type mismatch")

    if e1.order != e2.order:
        return compareDescending(e1.order, e2.order)

    if e1.cards[0].suit != e2.cards[0].suit:
        p1 = getSuitPriority(e1.cards[0].suit, strain)
        p2 = getSuitPriority(e2.cards[0].suit, strain)
        return compareDescending(p1, p2)

    return compareAscending(minCardId(e1.cards), minCardId(e2.cards))
```

```text
function sortElementsByCorePriority(elements, strain):
    sort elements by:
        copy descending,
        span descending,
        order descending,
        getSuitPriority(first card suit, strain) descending,
        minCardId ascending

    return elements
```

```text
function getCoreElement(elements, strain):
    sortedElements = sortElementsByCorePriority(elements, strain)
    return sortedElements[0]
```

```text
function minCardId(cards):
    best = cards[0].cardId
    for each card in cards:
        if card.cardId < best:
            best = card.cardId
    return best
```

---

## Section 5 — Potential element construction

A potential element must be formed within **one division**.
Duplicate counting is by **value** `(suit, rank)`, not by `(division, order)`.

```text
function groupByOrderThenValue(cards):
    result = empty map

    for each card in cards:
        order = card.order
        key = valueKey(card)

        if order not in result:
            result[order] = empty map

        if key not in result[order]:
            result[order][key] = empty list

        result[order][key].append(card)

    return result
```

```text
function findPotentialElements(cards, copy, span):
    // PRECONDITION: all cards are in the same division

    if cards is empty:
        return []

    division = cards[0].division

    for each card in cards:
        if card.division != division:
            throw Error("findPotentialElements: mixed divisions")

    grouped = groupByOrderThenValue(cards)
    result = []

    orders = sorted keys of grouped descending

    for each highestOrder in orders:
        ordersNeeded = []
        for i from 0 to span - 1:
            ordersNeeded.append(highestOrder - i)

        valid = true
        candidateBucketsByOrder = []

        for each o in ordersNeeded:
            if o not in grouped:
                valid = false
                break

            validBuckets = []
            for each key in grouped[o]:
                if length(grouped[o][key]) >= copy:
                    validBuckets.append(grouped[o][key])

            if length(validBuckets) == 0:
                valid = false
                break

            candidateBucketsByOrder.append(validBuckets)

        if valid:
            for each bucketChoice in cartesianProduct(candidateBucketsByOrder):
                chosenCards = []

                for each bucket in bucketChoice:
                    sort bucket by cardId ascending
                    take first `copy` cards from bucket
                    append them to chosenCards

                element = new Element:
                    cards = chosenCards
                    division = division
                    copy = copy
                    span = span
                    order = highestOrder

                result.append(element)

    return result
```

---

## Section 6 — Lead decomposition

```text
function makeSingleElement(card):
    return new Element:
        cards = [card]
        division = card.division
        copy = 1
        span = 1
        order = card.order
```

```text
function findHighestPotentialElement(cards, strain):
    maxCopy = maximum duplicate count by value in cards
    bestElement = null

    for copy from maxCopy down to 2:
        maxSpan = maxPossibleSpan(cards, copy)

        for span from maxSpan down to 1:
            candidates = findPotentialElements(cards, copy, span)

            if length(candidates) > 0:
                best = candidates[0]
                for each candidate in candidates:
                    if compareSameTypeElements(candidate, best, strain) > 0:
                        best = candidate
                return best

    bestCard = chooseHighestCard(cards, strain)
    return makeSingleElement(bestCard)
```

```text
function decomposeLead(leadCards, strain):
    remaining = copy of leadCards
    resolved = []

    while length(remaining) > 0:
        element = findHighestPotentialElement(remaining, strain)
        resolved.append(element)
        remaining = removeCards(remaining, element.cards)

    return resolved
```

```text
function multisetOfTypes(elements):
    result = empty multiset
    for each element in elements:
        result.add((element.copy, element.span))
    return result
```

---

## Section 7 — Declaration and frame/global-strain placeholders

```text
function updateDeclarationButtons(playerState, declarationState):
    emitEvent("DECLARATION_AVAILABLE", {
        player: playerState.player,
        enabledButtons: computeEnabledDeclarationButtons(playerState, declarationState)
    })
```

```text
function setGlobalStrain(frameState, strain):
    frameState.globalStrain = strain
    reassignOrdersAndDivisionsToAllCards(frameState)
    emitEvent("GLOBAL_STRAIN_SET", { strain: strain })
```

```text
function onPivotPicksUpBase(frameState, pivot):
    emitEvent("BASE_PICKED_UP", { pivot: pivot })
```

```text
function onBaseSet(frameState, pivot, newBase):
    emitEvent("BASE_SET", {
        pivot: pivot,
        baseCardCount: length(newBase)
    })
```

---

## Section 8 — Forehand-control helpers

```text
function countMarkedCards(cards, forehandControl):
    if forehandControl.mode == "none":
        return 0

    selectedIds = set of cardId from forehandControl.selectedCards
    total = 0

    for each card in cards:
        if card.cardId in selectedIds:
            total += 1

    return total
```

```text
function filterCandidatesByForehandControl(candidates, forehandControl):
    if forehandControl.mode == "none":
        return candidates

    scored = []

    for each candidate in candidates:
        overlap = countMarkedCards(candidate.cards, forehandControl)
        scored.append((candidate, overlap))

    if forehandControl.mode == "must-play":
        target = maximum overlap in scored
    else:
        target = minimum overlap in scored

    result = []
    for each (candidate, overlap) in scored:
        if overlap == target:
            result.append(candidate)

    return result
```

```text
function computeLegalMarkedCountInFillers(poolCards, fillerCount, forehandControl):
    if fillerCount < 0 or fillerCount > length(poolCards):
        throw Error("invalid fillerCount")

    if forehandControl.mode == "none":
        return null

    markedInPool = countMarkedCards(poolCards, forehandControl)
    unmarkedInPool = length(poolCards) - markedInPool

    if forehandControl.mode == "must-play":
        return min(fillerCount, markedInPool)

    if forehandControl.mode == "must-hold":
        return max(0, fillerCount - unmarkedInPool)
```

---

## Section 9 — SFP (Structural Follow Procedure)

SFP is used only for following a led element with `copy >= 2`.
A led single `(1,1)` does not use SFP.

### 9a. Conceptual one-path SFP (for bots/tests)

```text
function SFP(cards, copyBound, residualSpan, playerChoice, forehandControl):
    // PRECONDITION: all cards are in the led division

    if residualSpan == 0:
        return []

    for k from copyBound down to 2:
        for j from residualSpan down to 1:
            candidates = findPotentialElements(cards, k, j)

            if length(candidates) > 0:
                candidates = filterCandidatesByForehandControl(candidates, forehandControl)

                chosen = playerChoice(candidates)
                remainingCards = removeCards(cards, chosen.cards)

                suffix = SFP(
                    remainingCards,
                    k,
                    residualSpan - j,
                    playerChoice,
                    forehandControl
                )

                return [chosen] + suffix

    return []
```

### 9b. Enumerate all SFP outcomes (for referee legality checking)

```text
function enumerateSFP(cards, copyBound, residualSpan, forehandControl):
    if residualSpan == 0:
        return [ [] ]

    for k from copyBound down to 2:
        for j from residualSpan down to 1:
            candidates = findPotentialElements(cards, k, j)

            if length(candidates) > 0:
                candidates = filterCandidatesByForehandControl(candidates, forehandControl)

                outcomes = []

                for each candidate in candidates:
                    remainingCards = removeCards(cards, candidate.cards)

                    suffixes = enumerateSFP(
                        remainingCards,
                        k,
                        residualSpan - j,
                        forehandControl
                    )

                    for each suffix in suffixes:
                        outcomes.append([candidate] + suffix)

                return outcomes

    return [ [] ]
```

---

## Section 10 — DFP (Division Follow Procedure) and follow legality

### 10a. DFP outcome object

```text
DFPOutcome:
    structuredCards
    fillerPool
    fillerCount
    legalMarkedCountInFillers
    forcedDivisionCards
    shortDivisionCase
```

### 10b. Enumerate DFP outcomes

```text
function enumerateDFPOutcomes(handCards, leadCards, forehandControl, strain):
    if isSingleDivision(leadCards) == false:
        throw Error("DFP: lead is not single-divisioned")

    ledDivision = getLeadDivision(leadCards)
    leadVolume = length(leadCards)
    divisionCards = cardsInDivision(handCards, ledDivision)

    outcomes = []

    // short-division case
    if length(divisionCards) <= leadVolume:
        fillerCount = leadVolume - length(divisionCards)
        fillerPool = removeCards(handCards, divisionCards)

        legalMarkedCount = computeLegalMarkedCountInFillers(
            fillerPool,
            fillerCount,
            forehandControl
        )

        outcome = new DFPOutcome:
            structuredCards = []
            fillerPool = fillerPool
            fillerCount = fillerCount
            legalMarkedCountInFillers = legalMarkedCount
            forcedDivisionCards = divisionCards
            shortDivisionCase = true

        outcomes.append(outcome)
        return outcomes

    resolvedLead = decomposeLead(leadCards, strain)

    states = [ (handCards, []) ]

    for each ledElement in resolvedLead:
        nextStates = []

        for each (remainingHand, structuredPart) in states:
            if ledElement.copy == 1:
                nextStates.append((remainingHand, structuredPart))
            else:
                divisionCardsNow = cardsInDivision(remainingHand, ledElement.division)

                sfpOutcomes = enumerateSFP(
                    divisionCardsNow,
                    ledElement.copy,
                    ledElement.span,
                    forehandControl
                )

                for each sfpOutcome in sfpOutcomes:
                    usedCards = unionOfElementCards(sfpOutcome)
                    newRemaining = removeCards(remainingHand, usedCards)

                    nextStates.append((newRemaining, structuredPart + sfpOutcome))

        states = nextStates

    for each (remainingHand, structuredPart) in states:
        structuredCards = unionOfElementCards(structuredPart)
        fillerCount = leadVolume - length(structuredCards)
        fillerPool = cardsInDivision(remainingHand, ledDivision)

        legalMarkedCount = computeLegalMarkedCountInFillers(
            fillerPool,
            fillerCount,
            forehandControl
        )

        outcome = new DFPOutcome:
            structuredCards = structuredCards
            fillerPool = fillerPool
            fillerCount = fillerCount
            legalMarkedCountInFillers = legalMarkedCount
            forcedDivisionCards = []
            shortDivisionCase = false

        outcomes.append(outcome)

    return outcomes
```

### 10c. Full legality check of a selected follow

```text
function isLegalFollow(handCards, leadCards, selectedFollow, forehandControl, strain):
    if containsAllCards(handCards, selectedFollow) == false:
        return false

    if length(selectedFollow) != length(leadCards):
        return false

    if isSingleDivision(leadCards) == false:
        throw Error("lead is not single-divisioned")

    ledDivision = getLeadDivision(leadCards)
    outcomes = enumerateDFPOutcomes(handCards, leadCards, forehandControl, strain)

    for each outcome in outcomes:
        if outcome.shortDivisionCase:
            if containsAllCards(selectedFollow, outcome.forcedDivisionCards) == false:
                continue

            fillerCards = removeCards(selectedFollow, outcome.forcedDivisionCards)

            if length(fillerCards) != outcome.fillerCount:
                continue

            if containsAllCards(outcome.fillerPool, fillerCards) == false:
                continue

            if outcome.legalMarkedCountInFillers is not null:
                if countMarkedCards(fillerCards, forehandControl) != outcome.legalMarkedCountInFillers:
                    continue

            return true

        else:
            if containsAllCards(selectedFollow, outcome.structuredCards) == false:
                continue

            fillerCards = removeCards(selectedFollow, outcome.structuredCards)

            if length(fillerCards) != outcome.fillerCount:
                continue

            for each card in fillerCards:
                if card.division != ledDivision:
                    goto nextOutcome

            if containsAllCards(outcome.fillerPool, fillerCards) == false:
                goto nextOutcome

            if outcome.legalMarkedCountInFillers is not null:
                if countMarkedCards(fillerCards, forehandControl) != outcome.legalMarkedCountInFillers:
                    goto nextOutcome

            return true

        label nextOutcome:

    return false
```

---

## Section 11 — Failed multiplay detection

### 11a. Highest possible same-type element in one follower hand

```text
function highestPossibleElementOfType(handCards, division, copy, span, strain):
    divisionCards = cardsInDivision(handCards, division)
    candidates = findPotentialElements(divisionCards, copy, span)

    if length(candidates) == 0:
        return null

    best = candidates[0]
    for each candidate in candidates:
        if compareSameTypeElements(candidate, best, strain) > 0:
            best = candidate

    return best
```

### 11b. Block event

```text
BlockEvent:
    follower
    blockedLeadElement
    blockingElement
```

### 11c. Find all block events

```text
function findBlockEvents(leadCards, otherPlayersInRoundOrder, strain):
    resolvedLead = decomposeLead(leadCards, strain)

    if length(resolvedLead) <= 1:
        return []

    events = []

    for each ledElement in resolvedLead:
        for each followerState in otherPlayersInRoundOrder:
            follower = followerState.player
            handCards = followerState.handCards

            blockingElement = highestPossibleElementOfType(
                handCards,
                ledElement.division,
                ledElement.copy,
                ledElement.span,
                strain
            )

            if blockingElement is not null:
                if compareSameTypeElements(blockingElement, ledElement, strain) > 0:
                    event = new BlockEvent:
                        follower = follower
                        blockedLeadElement = ledElement
                        blockingElement = blockingElement
                    events.append(event)

    return events
```

### 11d. Get blocked elements

```text
function getBlockedElements(blockEvents):
    blocked = []
    seen = empty set

    for each event in blockEvents:
        key = canonicalElementKey(event.blockedLeadElement)
        if key not in seen:
            blocked.append(event.blockedLeadElement)
            seen.add(key)

    return blocked
```

### 11e. Blocker priority

```text
function blockerPriority(roundSeat):
    if roundSeat == 4: return 3
    if roundSeat == 2: return 2
    if roundSeat == 3: return 1
    throw Error("invalid blocker seat")
```

### 11f. Resolve failed multiplay

```text
function resolveFailedMultiplay(leadCards, otherPlayersInRoundOrder, strain):
    resolvedLead = decomposeLead(leadCards, strain)

    if length(resolvedLead) <= 1:
        return {
            isFailed: false,
            blockedElements: [],
            actualLedElement: null,
            actualBlocker: null
        }

    blockEvents = findBlockEvents(leadCards, otherPlayersInRoundOrder, strain)

    if length(blockEvents) == 0:
        return {
            isFailed: false,
            blockedElements: [],
            actualLedElement: null,
            actualBlocker: null
        }

    blockedElements = getBlockedElements(blockEvents)

    eventsByFollower = map follower -> list of events
    for each event in blockEvents:
        if event.follower not in eventsByFollower:
            eventsByFollower[event.follower] = []
        eventsByFollower[event.follower].append(event)

    actualBlocker = null
    bestPriority = -1

    for each followerState in otherPlayersInRoundOrder:
        follower = followerState.player
        if follower in eventsByFollower:
            p = blockerPriority(followerState.roundSeat)
            if p > bestPriority:
                bestPriority = p
                actualBlocker = follower

    blockerEvents = eventsByFollower[actualBlocker]
    candidateBlocked = []

    for each event in blockerEvents:
        candidateBlocked.append(event.blockedLeadElement)

    groupedByType = map typeKey -> list of elements
    for each element in candidateBlocked:
        key = typeKey(element)
        if key not in groupedByType:
            groupedByType[key] = []
        groupedByType[key].append(element)

    reducedCandidates = []
    for each key in groupedByType:
        sameTypeBlocked = groupedByType[key]

        lowest = sameTypeBlocked[0]
        for each element in sameTypeBlocked:
            if compareSameTypeElements(element, lowest, strain) < 0:
                lowest = element

        reducedCandidates.append(lowest)

    actualLedElement = blockerChoosesOne(actualBlocker, reducedCandidates)

    emitEvent("FAILED_MULTIPLAY_DETECTED", {
        blockedElements: blockedElements,
        actualLedElement: actualLedElement,
        actualBlocker: actualBlocker
    })

    return {
        isFailed: true,
        blockedElements: blockedElements,
        actualLedElement: actualLedElement,
        actualBlocker: actualBlocker
    }
```

---

## Section 12 — Fake multiplay detection (current simplified version)

Current policy:
- do **not** run the joint structured-part check in any mode
- do **individual** checks only
- if all pass, return safe
- if any fails, return foul / fake

### 12a. Top-level fake-multiplay check

```text
function detectFakeMultiplay(info, mode, strain):
    resolvedLead = decomposeLead(info.intendedLeadCards, strain)

    // one-element lead is not a multiplay
    if length(resolvedLead) <= 1:
        return {
            isMultiplay: false,
            isFakeMultiplay: false,
            fakeCause: null
        }

    singlePart = []
    structuredPart = []

    for each element in resolvedLead:
        if element.copy == 1:
            singlePart.append(element)
        else:
            structuredPart.append(element)

    if length(singlePart) > 0:
        if singlePartIsFake(info, singlePart):
            emitEvent("FAKE_MULTIPLAY_DETECTED", {
                cause: "single-part"
            })
            return {
                isMultiplay: true,
                isFakeMultiplay: true,
                fakeCause: "single-part"
            }

    if length(structuredPart) > 0:
        compressedStructuredPart = compressStructuredPartByType(structuredPart, strain)

        for each element in compressedStructuredPart:
            if individualStructuredElementIsSurelyBlocked(info, element, strain):
                emitEvent("FAKE_MULTIPLAY_DETECTED", {
                    cause: "structured-part"
                })
                return {
                    isMultiplay: true,
                    isFakeMultiplay: true,
                    fakeCause: "structured-part"
                }

    return {
        isMultiplay: true,
        isFakeMultiplay: false,
        fakeCause: null
    }
```

### 12b. Compress structured part by type

```text
function compressStructuredPartByType(structuredPart, strain):
    grouped = map typeKey -> list of elements

    for each element in structuredPart:
        key = typeKey(element)
        if key not in grouped:
            grouped[key] = []
        grouped[key].append(element)

    result = []

    for each key in grouped:
        lowest = grouped[key][0]
        for each element in grouped[key]:
            if compareSameTypeElements(element, lowest, strain) < 0:
                lowest = element
        result.append(lowest)

    sort result by:
        copy descending,
        span descending,
        order descending,
        minCardId ascending

    return result
```

### 12c. Single-part fake check

```text
function singlePartIsFake(info, singlePart):
    division = singlePart[0].division

    minSingleOrder = minimum(element.order for element in singlePart)
    unknownCounts = buildUnknownValueCounts(info, division)
    unknownBaseCapacity = getUnknownBaseSlots(info)

    totalRelevantUnknownCopies = 0

    for each key in unknownCounts:
        cardTemplate = valueKeyToCardTemplate(key)

        if cardTemplate.division != division:
            continue

        if cardTemplate.order <= minSingleOrder:
            continue

        if isValueKnownInAnyFollowerHand(info, key):
            return true

        totalRelevantUnknownCopies += unknownCounts[key]

        if valueMayStillBeInBase(info, key) == false:
            return true

    if totalRelevantUnknownCopies > unknownBaseCapacity:
        return true

    return false
```

### 12d. Individual structured element surely blocked

```text
function individualStructuredElementIsSurelyBlocked(info, ledElement, strain):
    if exactSingleStructuredElementSafeSearch(info, ledElement, strain):
        return false
    return true
```

### 12e. Exact search for one structured element

```text
function exactSingleStructuredElementSafeSearch(info, ledElement, strain):
    division = ledElement.division
    unknownCounts = buildUnknownValueCounts(info, division)
    domains = buildValueDomains(info, division, unknownCounts)
    state = buildInitialSearchState(info, division)
    valueKeys = sortRelevantValueKeysForElement(unknownCounts, ledElement)

    return backtrackSafeSingleElement(
        valueKeys,
        0,
        unknownCounts,
        domains,
        state,
        ledElement,
        strain
    )
```

### 12f. Build unknown value counts

```text
function buildUnknownValueCounts(info, division):
    totalCounts = countAllDeckCopiesByValue(info.fullDeck, division)
    seenCounts = empty map valueKey -> 0

    for each card in info.leaderHandCards:
        if card.division == division:
            seenCounts[valueKey(card)] += 1

    for each card in info.intendedLeadCards:
        if card.division == division:
            seenCounts[valueKey(card)] += 1

    for each card in info.playedCards:
        if card.division == division:
            seenCounts[valueKey(card)] += 1

    for each card in info.knownBaseCards:
        if card.division == division:
            seenCounts[valueKey(card)] += 1

    for each follower in info.knownCardsByPlayer:
        for each card in info.knownCardsByPlayer[follower]:
            if card.division == division:
                seenCounts[valueKey(card)] += 1

    result = empty map

    for each key in totalCounts:
        remaining = totalCounts[key] - seenCounts[key]
        if remaining < 0:
            throw Error("negative remaining count")
        if remaining > 0:
            result[key] = remaining

    return result
```

### 12g. Build value domains

```text
function buildValueDomains(info, division, unknownCounts):
    domains = empty map

    for each key in unknownCounts:
        recipients = []

        for each follower in getFollowersAfterLeader(info):
            if followerMayStillHoldDivision(info, follower, division):
                recipients.append(follower)

        if valueMayStillBeInBase(info, key):
            recipients.append("BASE")

        if length(recipients) == 0:
            throw Error("no recipient for value")

        domains[key] = recipients

    return domains
```

### 12h. Build initial search state

```text
function buildInitialSearchState(info, division):
    state = {}
    state.countsByFollower = map follower -> map valueKey -> count
    state.remainingSlotsByFollower = map follower -> integer
    state.remainingBaseSlots = getUnknownBaseSlots(info)

    for each follower in getFollowersAfterLeader(info):
        state.countsByFollower[follower] = empty map

        for each card in info.knownCardsByPlayer[follower]:
            if card.division == division:
                state.countsByFollower[follower][valueKey(card)] += 1

        knownCount = 0
        for each key in state.countsByFollower[follower]:
            knownCount += state.countsByFollower[follower][key]

        state.remainingSlotsByFollower[follower] =
            info.currentHandCounts[follower] - knownCount

        if state.remainingSlotsByFollower[follower] < 0:
            throw Error("negative follower slots")

    return state
```

### 12i. Relevant value keys

```text
function sortRelevantValueKeysForElement(unknownCounts, ledElement):
    relevant = []

    for each key in unknownCounts:
        cardTemplate = valueKeyToCardTemplate(key)
        if canValueContributeToHigherBlocker(cardTemplate, ledElement):
            relevant.append(key)

    sort relevant by:
        card order descending,
        valueKey ascending

    return relevant
```

### 12j. Value relevance test

```text
function canValueContributeToHigherBlocker(cardTemplate, ledElement):
    if cardTemplate.division != ledElement.division:
        return false

    return cardTemplate.order > ledElement.order
```

### 12k. Enumerate count distributions

This avoids double-counting equal-valued copies.

```text
function enumerateCountDistributions(totalCopies, recipients, slotState, baseSlots):
    result = []

    function backtrack(i, remaining, partial):
        if i == length(recipients):
            if remaining == 0:
                result.append(copy of partial)
            return

        recipient = recipients[i]

        if recipient == "BASE":
            maxAssign = min(remaining, baseSlots)
        else:
            maxAssign = min(remaining, slotState[recipient])

        for x from 0 to maxAssign:
            partial[recipient] = x
            backtrack(i + 1, remaining - x, partial)

        remove partial[recipient]

    backtrack(0, totalCopies, {})
    return result
```

### 12l. Backtrack safe single element

```text
function backtrackSafeSingleElement(valueKeys, index, unknownCounts, domains, state, ledElement, strain):
    if index == length(valueKeys):
        return noFollowerBlocksElement(state, ledElement, strain)

    key = valueKeys[index]
    count = unknownCounts[key]
    recipients = domains[key]

    distributions = enumerateCountDistributions(
        count,
        recipients,
        state.remainingSlotsByFollower,
        state.remainingBaseSlots
    )

    for each dist in distributions:
        applyDistributionToState(state, key, dist)

        if partialStateMayStillAvoidElementBlock(state, ledElement, strain):
            if backtrackSafeSingleElement(
                valueKeys,
                index + 1,
                unknownCounts,
                domains,
                state,
                ledElement,
                strain
            ):
                undoDistributionFromState(state, key, dist)
                return true

        undoDistributionFromState(state, key, dist)

    return false
```

### 12m. Apply / undo distribution

```text
function applyDistributionToState(state, valueKey, dist):
    for each recipient in dist:
        x = dist[recipient]

        if recipient == "BASE":
            state.remainingBaseSlots -= x
        else:
            state.countsByFollower[recipient][valueKey] += x
            state.remainingSlotsByFollower[recipient] -= x
```

```text
function undoDistributionFromState(state, valueKey, dist):
    for each recipient in dist:
        x = dist[recipient]

        if recipient == "BASE":
            state.remainingBaseSlots += x
        else:
            state.countsByFollower[recipient][valueKey] -= x
            state.remainingSlotsByFollower[recipient] += x
```

### 12n. Block tests from counts

```text
function noFollowerBlocksElement(state, ledElement, strain):
    for each follower in state.countsByFollower:
        if followerCanBlockElementByCounts(state.countsByFollower[follower], ledElement, strain):
            return false
    return true
```

```text
function partialStateMayStillAvoidElementBlock(state, ledElement, strain):
    for each follower in state.countsByFollower:
        if followerCanBlockElementByCounts(state.countsByFollower[follower], ledElement, strain):
            return false
    return true
```

```text
function followerCanBlockElementByCounts(countsByValue, ledElement, strain):
    division = ledElement.division
    copy = ledElement.copy
    span = ledElement.span
    ledOrder = ledElement.order

    grouped = groupValueCountsByOrder(countsByValue, division)
    maxOrder = maximum key in grouped

    if maxOrder is null:
        return false

    for highestOrder from maxOrder down to ledOrder + 1:
        ok = true

        for i from 0 to span - 1:
            currentOrder = highestOrder - i

            if currentOrder not in grouped:
                ok = false
                break

            existsValueWithEnoughCopies = false
            for each key in grouped[currentOrder]:
                if grouped[currentOrder][key] >= copy:
                    existsValueWithEnoughCopies = true
                    break

            if existsValueWithEnoughCopies == false:
                ok = false
                break

        if ok:
            return true

    return false
```

```text
function groupValueCountsByOrder(countsByValue, division):
    result = empty map

    for each key in countsByValue:
        count = countsByValue[key]

        if count <= 0:
            continue

        cardTemplate = valueKeyToCardTemplate(key)
        if cardTemplate.division != division:
            continue

        order = cardTemplate.order

        if order not in result:
            result[order] = empty map

        result[order][key] = count

    return result
```

### 12o. Small fake-check helpers

```text
function getFollowersAfterLeader(info):
    followers = []
    for each state in info.actualFollowerStates:
        followers.append(state.player)
    return followers
```

```text
function getUnknownBaseSlots(info):
    return info.baseCapacityTotal - length(info.knownBaseCards)
```

```text
function isValueKnownInAnyFollowerHand(info, key):
    for each follower in info.knownCardsByPlayer:
        for each card in info.knownCardsByPlayer[follower]:
            if valueKey(card) == key:
                return true
    return false
```

```text
function followerMayStillHoldDivision(info, follower, division):
    if info.voidInfo[follower][division] == true:
        return false

    knownCount = length(info.knownCardsByPlayer[follower])

    if info.currentHandCounts[follower] <= knownCount:
        return false

    return true
```

---

## Section 13 — Potential ruff and cover checking

### 13a. Trump division id

```text
function getTrumpDivisionId():
    return 6
```

### 13b. Initialize round state

```text
function initializeRoundState(leader, leadCards, strain):
    roundState = new RoundState

    roundState.leadCards = leadCards
    roundState.leadDivision = getLeadDivision(leadCards)
    roundState.resolvedLead = decomposeLead(leadCards, strain)
    roundState.leadType = multisetOfTypes(roundState.resolvedLead)
    roundState.leadIsOneElement = (length(roundState.resolvedLead) == 1)
    roundState.leadCoreElement = getCoreElement(roundState.resolvedLead, strain)

    roundState.ruffed = false
    roundState.highestPlayer = leader

    if roundState.leadIsOneElement:
        roundState.highestOrder = roundState.leadCoreElement.order
    else:
        roundState.highestOrder = null

    emitEvent("ROUND_STATE_INITIALIZED", {
        leader: leader
    })

    return roundState
```

### 13c. Classify a legal follow for cover checking

```text
function classifyFollowForCover(roundState, followCards, strain):
    followDivisions = distinct divisions in followCards
    trumpDivision = getTrumpDivisionId()

    if roundState.leadDivision in followDivisions and length(followDivisions) > 1:
        return {
            kind: "DISCARD",
            orderKey: null
        }

    if length(followDivisions) == 1 and followDivisions[0] == roundState.leadDivision:
        if roundState.leadIsOneElement:
            followResolved = decomposeLead(followCards, strain)

            if length(followResolved) == 1:
                followElement = followResolved[0]
                leadElement = roundState.resolvedLead[0]

                if followElement.copy == leadElement.copy and followElement.span == leadElement.span:
                    return {
                        kind: "DIVISION_FOLLOWER",
                        orderKey: followElement.order
                    }

            // same-division but different type: legal follow may still exist,
            // but it is lower than every same-type division-follower and cannot cover
            return {
                kind: "DISCARD",
                orderKey: null
            }

        else:
            return {
                kind: "DIVISION_FOLLOWER",
                orderKey: null
            }

    if roundState.leadDivision == trumpDivision:
        return {
            kind: "DISCARD",
            orderKey: null
        }

    for each card in followCards:
        if card.division != trumpDivision:
            return {
                kind: "DISCARD",
                orderKey: null
            }

    bestCore = findBestPotentialRuffCore(roundState, followCards, strain)

    if bestCore is null:
        return {
            kind: "DISCARD",
            orderKey: null
        }

    return {
        kind: "POTENTIAL_RUFF",
        orderKey: bestCore.order
    }


### 13d. Is a legal follow a cover

```text
function isCover(roundState, candidateFollow, strain):
    followState = classifyFollowForCover(roundState, candidateFollow, strain)

    if followState.kind == "DISCARD":
        return false

    if followState.kind == "POTENTIAL_RUFF":
        if roundState.ruffed == false:
            return true
        return followState.orderKey > roundState.highestOrder

    if roundState.ruffed == true:
        return false

    if roundState.leadIsOneElement == false:
        return false

    return followState.orderKey > roundState.highestOrder
```

### 13e. Update round state after an accepted follow

```text
function updateRoundStateAfterFollow(roundState, player, acceptedFollow, strain):
    followState = classifyFollowForCover(roundState, acceptedFollow, strain)

    if followState.kind == "DISCARD":
        return

    if followState.kind == "POTENTIAL_RUFF":
        if roundState.ruffed == false or followState.orderKey > roundState.highestOrder:
            roundState.ruffed = true
            roundState.highestOrder = followState.orderKey
            roundState.highestPlayer = player

            emitEvent("RUFF_OCCURRED", {
                player: player,
                order: roundState.highestOrder
            })

        return

    if roundState.ruffed == false and roundState.leadIsOneElement:
        if followState.orderKey > roundState.highestOrder:
            roundState.highestOrder = followState.orderKey
            roundState.highestPlayer = player

            emitEvent("COVER_OCCURRED", {
                player: player,
                order: roundState.highestOrder
            })
```

### 13f. Best possible potential-ruff core

Do not enumerate all decompositions. Search only for the best possible core element.

```text
function findBestPotentialRuffCore(roundState, trumpCards, strain):
    possibleCoreElements = enumeratePossibleCoreElements(trumpCards, strain)

    sort possibleCoreElements by core priority descending using strain

    for each coreElement in possibleCoreElements:
        if canRealizePotentialRuffWithCore(roundState.leadType, trumpCards, coreElement):
            return coreElement

    return null
```

### 13g. Enumerate possible core elements

```text
function enumeratePossibleCoreElements(trumpCards, strain):
    result = []
    seen = empty set

    maxCopy = maximum duplicate count by value in trumpCards

    for copy from maxCopy down to 1:
        maxSpan = maxPossibleSpan(trumpCards, copy)

        for span from maxSpan down to 1:
            candidates = findPotentialElements(trumpCards, copy, span)

            for each candidate in candidates:
                key = canonicalElementKey(candidate)
                if key not in seen:
                    seen.add(key)
                    result.append(candidate)

    return result
```

### 13h. Check whether a fixed core can realize a potential ruff

```text
function canRealizePotentialRuffWithCore(leadType, trumpCards, coreElement):
    remainingCards = removeCards(trumpCards, coreElement.cards)
    remainingTypes = removeOneTypeFromMultiset(leadType, (coreElement.copy, coreElement.span))

    return backtrackPotentialRuffByTypes(remainingCards, remainingTypes)
```

### 13i. Backtrack by required types only

```text
function backtrackPotentialRuffByTypes(remainingCards, remainingTypes):
    if length(remainingCards) == 0 and remainingTypes is empty:
        return true

    if length(remainingCards) == 0 or remainingTypes is empty:
        return false

    nextType = chooseHighestTypeFromMultiset(remainingTypes)
    copy = nextType.copy
    span = nextType.span

    candidates = findPotentialElements(remainingCards, copy, span)

    for each candidate in candidates:
        newRemainingCards = removeCards(remainingCards, candidate.cards)
        newRemainingTypes = removeOneTypeFromMultiset(remainingTypes, nextType)

        if backtrackPotentialRuffByTypes(newRemainingCards, newRemainingTypes):
            return true

    return false
```

---

## Section 14 — Round winner, counting phase, and frame score

### 14a. Counter value

```text
function counterValue(card):
    if card.rank == "5":
        return 5

    if card.rank == "X" or card.rank == "K":
        return 10

    return 0
```

### 14b. Count counters in round

```text
function countCountersInRound(playedHandsInOrder):
    total = 0

    for each hand in playedHandsInOrder:
        for each card in hand:
            total += counterValue(card)

    return total
```

### 14c. Count counters in base

```text
function countCountersInBase(baseCards):
    total = 0

    for each card in baseCards:
        total += counterValue(card)

    return total
```

### 14d. Defending team

```text
function defendingTeam(pivot):
    if pivot == "South":
        return ["South", "North"]
    if pivot == "North":
        return ["North", "South"]
    if pivot == "East":
        return ["East", "West"]
    if pivot == "West":
        return ["West", "East"]
```

### 14e. Is attacking side

```text
function isAttackingSide(frameState, player):
    return player not in defendingTeam(frameState.pivot)
```

### 14f. Update attacking streak

```text
function updateAttackingStreak(frameState, roundWinner):
    if isAttackingSide(frameState, roundWinner):
        frameState.attackingWinningStreak += 1
    else:
        frameState.attackingWinningStreak = 0

    emitEvent("ATTACKING_STREAK_CHANGED", {
        streak: frameState.attackingWinningStreak
    })
```

### 14g. Resolve round and update running trick score

Assumes all hands in the round were already accepted as legal.

```text
function resolveRoundAndUpdateScore(frameState, roundState, playedHandsInOrder):
    winner = roundState.highestPlayer
    trickPoints = countCountersInRound(playedHandsInOrder)

    if isAttackingSide(frameState, winner):
        frameState.frameScore += trickPoints

        emitEvent("FRAME_SCORE_CHANGED", {
            frameScore: frameState.frameScore
        })

    updateAttackingStreak(frameState, winner)
    frameState.nextLeader = winner

    emitEvent("ROUND_ENDED", {
        winner: winner,
        trickPoints: trickPoints,
        runningFrameScoreAfterRound: frameState.frameScore
    })

    return {
        winner: winner,
        trickPoints: trickPoints,
        runningFrameScoreAfterRound: frameState.frameScore
    }
```

### 14h. Resolve counting phase and finalize frame score

```text
function finalizeFrameScoreAfterCounting(frameState, baseCards, lastRoundWinner, endgameFactor):
    basePoints = countCountersInBase(baseCards)
    baseWinner = lastRoundWinner

    addedBaseScore = 0

    if isAttackingSide(frameState, baseWinner):
        addedBaseScore = basePoints * endgameFactor
        frameState.frameScore += addedBaseScore

        emitEvent("FRAME_SCORE_CHANGED", {
            frameScore: frameState.frameScore
        })

    emitEvent("COUNTING_PHASE_STARTED", {
        basePoints: basePoints,
        endgameFactor: endgameFactor
    })

    emitEvent("BASE_REVEALED", {
        baseCardCount: length(baseCards),
        basePoints: basePoints,
        baseWinner: baseWinner,
        addedBaseScore: addedBaseScore,
        finalFrameScore: frameState.frameScore
    })

    return {
        baseWinner: baseWinner,
        basePoints: basePoints,
        endgameFactor: endgameFactor,
        addedBaseScore: addedBaseScore,
        finalFrameScore: frameState.frameScore
    }
```

---

## Section 15 — Placeholder helpers not expanded here

The following helper functions are referenced above but their bodies are omitted in this file:

```text
maxPossibleSpan(cards, copy)
countAllDeckCopiesByValue(fullDeck, division)
valueKeyToCardTemplate(valueKey)
valueMayStillBeInBase(info, valueKey)

canonicalElementKey(element)
chooseHighestTypeFromMultiset(typeMultiset)
removeOneTypeFromMultiset(typeMultiset, oneType)

blockerChoosesOne(actualBlocker, reducedCandidates)
computeEnabledDeclarationButtons(playerState, declarationState)
reassignOrdersAndDivisionsToAllCards(frameState)
cartesianProduct(listOfLists)
```

---

## Section 16 — Engine timing reminders

Timing guideline:

- **Local pre-send timing**:
  - warn about obvious mechanical issues only
  - e.g. mixed-division intended lead
  - do **not** announce fake multiplay here

- **Server / authoritative timing after receiving intended lead**:
  - resolve failed multiplay
  - in test mode, also run fake-multiplay check
  - emit authoritative events to listeners
