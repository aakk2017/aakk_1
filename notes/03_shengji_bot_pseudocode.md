# Shengji Bot Pseudo Code

This file describes a **test bot**, not a master bot.

Principles:

- The bot is designed to generate legal and varied scenarios for testing.
- It does **not** always seek the objectively best move.
- Random choice is used whenever a tie breaker is not explicitly specified.
- The bot should show a **tendency** to preserve structures in hand, so that non-single plays remain likely later.

---

## Section 0 — Terminology used by the bot

### 0.1 Top single

A **top single** in a division is a single card whose order is the highest possible among all cards in that division in the current frame.

Examples:
- in a plain division, this is usually `A`
- if `A` is the level and absent from the plain-division order, this becomes `K`
- in trump, this is `W`

### 0.2 Established single

An **established single** in a division is a single card such that every card of higher order in that division is already known not to be in any follower's hand, according to player-known information.

Equivalently, it is a single that is currently known to be the highest remaining single in that division.

### 0.3 Grade of a non-single element

For a non-single element `E`, its **grade** is:

    1 + number of different higher elements of the same type and division
        that are still possible from player-known information

So:
- 1st-grade = no higher same-type element is still possible
- 2nd-grade = exactly one higher same-type element is still possible
- etc.

An element is **no worse than 4th-grade** if its grade is at most 4.

Different higher elements are counted by **value**, not by physical duplicate identity.

---

## Section 1 — Structure-preservation heuristic

This is a **tendency**, not a strict rule.

The bot should prefer moves that preserve potential non-single structures in hand.

### 1.1 Simple preservation rule

Among candidate legal moves, the bot prefers those that avoid consuming cards that belong to any currently existing potential non-single element, unless every legal candidate does so.

### 1.2 Practical scoring heuristic

A simple heuristic score for the remaining hand after a candidate move:

```text
preservationScore(handAfterMove):
    score = 0

    // reward surviving non-single potential elements
    for each division in handAfterMove:
        for each potential element E in that division with copy >= 2:
            score += structureWeight(E)

    // reward preserved top / established singles
    for each single card s in handAfterMove:
        if isTopSingle(s):
            score += 3
        else if isEstablishedSingle(s):
            score += 2

    return score
```

A suggested weight for one potential element:

```text
structureWeight(E):
    return 10 * E.copy + E.span
```

This is only a heuristic; exact values may be tuned.

### 1.3 Candidate filtering by preservation tendency

```text
chooseStructurePreservingCandidates(handBeforeMove, candidateMoves):
    bestScore = null
    bestMoves = []

    for each move in candidateMoves:
        handAfterMove = removeCards(handBeforeMove, move)
        score = preservationScore(handAfterMove)

        if bestScore is null or score > bestScore:
            bestScore = score
            bestMoves = [move]
        else if score == bestScore:
            bestMoves.append(move)

    return bestMoves
```

The bot then chooses randomly among `bestMoves`, unless a different tie breaker is explicitly specified elsewhere.

### 1.4 Cheap shortcut version

If computing `preservationScore(...)` is too expensive, use this weaker rule instead:

```text
breaksStructure(handBeforeMove, move):
    // returns true if move consumes any card belonging to a currently existing
    // potential non-single element in handBeforeMove

    existingStructureCards = union of cards belonging to all current potential
                             non-single elements in handBeforeMove

    for each card in move:
        if card in existingStructureCards:
            return true

    return false
```

Then:

```text
preferNonBreakingMoves(handBeforeMove, candidateMoves):
    safeMoves = []

    for each move in candidateMoves:
        if breaksStructure(handBeforeMove, move) == false:
            safeMoves.append(move)

    if length(safeMoves) > 0:
        return safeMoves
    else:
        return candidateMoves
```

This shortcut is enough for the first implementation.

---

## Section 2 — Declaration phase bot logic

### 2.1 Declaration rule

When declaration is available, the bot behaves as follows:

1. If an overcall is available, always overcall.
2. Otherwise, consider suited declarations only. The bot never makes an initial NTS declaration.
3. The bot declares suit `e` if, when `e` is taken as the strain, the trump count is at least one third of the current hand.
4. If both single and double declaration of that suit are available, use the double declaration.

Use the integer-safe threshold:

```text
3 * trumpCount(strain = e, currentHand) >= currentHandSize
```

### 2.2 Choose declaration suit

If more than one suit satisfies the threshold:
- choose the suit with the largest trump count
- if still tied, choose randomly

### 2.3 Pseudo code

```text
botChooseDeclaration(playerState, declarationState):
    legalDeclarations = getLegalDeclarations(playerState, declarationState)

    overcalls = all declarations in legalDeclarations that are overcalls
    if length(overcalls) > 0:
        return randomChoice(overcalls)

    candidateSuits = []

    for each suit e in ["s", "h", "c", "d"]:
        if declarationOfSuitIsLegal(legalDeclarations, e):
            trumpCount = countTrumpIfSuit(playerState.hand, e, playerState.level)
            handSize = length(playerState.hand)

            if 3 * trumpCount >= handSize:
                candidateSuits.append(e)

    if length(candidateSuits) == 0:
        return null

    bestTrumpCount = maximum countTrumpIfSuit(playerState.hand, e, playerState.level)
                     over e in candidateSuits

    bestSuits = [e in candidateSuits where countTrumpIfSuit(playerState.hand, e, playerState.level) == bestTrumpCount]
    chosenSuit = randomChoice(bestSuits)

    if doubleDeclarationOfSuitIsLegal(legalDeclarations, chosenSuit):
        return makeDoubleDeclaration(chosenSuit)
    else:
        return makeSingleDeclaration(chosenSuit)
```

---

## Section 3 — Base-making bot logic

### 3.1 Base rule

When making the base:

1. If there exists a plain division with no more than 8 cards:
   - fold all cards in one such division
   - choose the smallest such division size
   - if tied, choose randomly among them
   - fill the remaining base slots with random cards from the rest of the hand

2. Otherwise:
   - choose a random plain division
   - fold 8 random cards from that division

This is a test bot, so “fill with random other cards” really means **any remaining cards**.

### 3.2 Pseudo code

```text
botMakeBase(pivotHand, frameState):
    plainDivisions = getPlainDivisions(frameState)

    smallDivisions = []
    for each division in plainDivisions:
        cards = cardsInDivision(pivotHand, division)
        if length(cards) <= 8:
            smallDivisions.append((division, cards))

    if length(smallDivisions) > 0:
        minSize = minimum length(cards) over entries in smallDivisions
        candidates = all entries in smallDivisions with length(cards) == minSize
        (chosenDivision, chosenCards) = randomChoice(candidates)

        baseCards = copy of chosenCards
        remainingHand = removeCards(pivotHand, baseCards)

        while length(baseCards) < 8:
            x = randomChoice(remainingHand)
            baseCards.append(x)
            remainingHand = removeCards(remainingHand, [x])

        return baseCards

    chosenDivision = randomChoice(plainDivisions)
    divisionCards = cardsInDivision(pivotHand, chosenDivision)
    return randomSubsetOfSize(divisionCards, 8)
```

---

## Section 4 — On-lead bot logic

### 4.1 Overview

When on lead, the bot acts in the following order:

1. If any structured potential element exists, play the highest-type one.
2. If that structured element is accompanied by top or established single(s) in the same division, and the structured element is no worse than 4th-grade, then multiplay it with those single(s).
3. Otherwise, if there is a plain division where all three other players have shown out, and the bot holds multiple cards in it, lead all those cards.
4. Otherwise, play the lowest trump.
5. If there is no trump, play the lowest card in a random division.

### 4.2 Find highest-type structured potential element

```text
findHighestTypeStructuredElement(hand, strain):
    best = null

    for each division in divisionsPresent(hand):
        divisionCards = cardsInDivision(hand, division)
        maxCopy = maximum duplicate count by value in divisionCards

        for copy from maxCopy down to 2:
            maxSpan = maxPossibleSpan(divisionCards, copy)

            for span from maxSpan down to 1:
                candidates = findPotentialElements(divisionCards, copy, span)

                if length(candidates) > 0:
                    chosen = highestOrderedElement(candidates)
                    if best is null:
                        best = chosen
                    else if compareTypeThenOrder(chosen, best) > 0:
                        best = chosen

    return best
```

### 4.3 Gather companion singles

```text
getCompanionSinglesForStructuredLead(hand, structuredElement, playerKnownInfo):
    divisionCards = cardsInDivision(hand, structuredElement.division)
    remaining = removeCards(divisionCards, structuredElement.cards)

    singles = []

    for each card in remaining:
        if isTopSingle(card, playerKnownInfo) or isEstablishedSingle(card, playerKnownInfo):
            singles.append(card)

    return singles
```

### 4.4 Bot lead choice

```text
botChooseLead(hand, playerKnownInfo, frameState):
    structured = findHighestTypeStructuredElement(hand, frameState.globalStrain)

    if structured is not null:
        companions = getCompanionSinglesForStructuredLead(hand, structured, playerKnownInfo)

        if length(companions) > 0 and getElementGrade(structured, playerKnownInfo) <= 4:
            return structured.cards + companions

        return structured.cards

    for each plainDivision in getPlainDivisions(frameState):
        if allOtherPlayersShownOut(playerKnownInfo, plainDivision):
            held = cardsInDivision(hand, plainDivision)
            if length(held) > 1:
                return held

    trumps = cardsInDivision(hand, getTrumpDivisionId())
    if length(trumps) > 0:
        return [lowestOrderedCard(trumps)]

    presentDivisions = distinct divisions in hand
    chosenDivision = randomChoice(presentDivisions)
    divisionCards = cardsInDivision(hand, chosenDivision)
    return [lowestOrderedCard(divisionCards)]
```

---

## Section 5 — Following a single-card lead

### 5.1 Policy

When following a single card:

1. If a covering ruff is possible, ruff with a random covering trump.
2. Else if following trump division and a cover is possible, cover with the highest legal card, while avoiding breaking structures if possible.
3. Else if following plain division, or not able to cover, play the lowest-ordered legal card, while avoiding breaking structures if possible.
4. If discarding, discard a random legal card, but avoid breaking structures if possible.

### 5.2 Bot follow for a single lead

```text
botFollowSingle(hand, roundState, forehandControl, playerKnownInfo):
    legalFollows = enumerateLegalFollows(hand, roundState.leadCards, forehandControl)

    coveringRuffs = []
    coveringTrumpFollowers = []
    lowFollowers = []
    discards = []

    for each move in legalFollows:
        state = classifyFollowForCover(roundState, move)

        if state.kind == "POTENTIAL_RUFF":
            if isCover(roundState, move):
                coveringRuffs.append(move)

        else if state.kind == "DIVISION_FOLLOWER":
            if roundState.leadDivision == getTrumpDivisionId() and isCover(roundState, move):
                coveringTrumpFollowers.append(move)
            else:
                lowFollowers.append(move)

        else:
            discards.append(move)

    if length(coveringRuffs) > 0:
        return randomChoice(coveringRuffs)

    if length(coveringTrumpFollowers) > 0:
        bestOrder = maximum(getCoreElement(decomposeLead(move)).order for move in coveringTrumpFollowers)
        highestMoves = [move in coveringTrumpFollowers where getCoreElement(decomposeLead(move)).order == bestOrder]
        bestMoves = chooseStructurePreservingCandidates(hand, highestMoves)
        return randomChoice(bestMoves)

    if length(lowFollowers) > 0:
        minOrder = minimum(getCoreElement(decomposeLead(move)).order for move in lowFollowers)
        lowestMoves = [move in lowFollowers where getCoreElement(decomposeLead(move)).order == minOrder]
        bestMoves = chooseStructurePreservingCandidates(hand, lowestMoves)
        return randomChoice(bestMoves)

    bestDiscards = chooseStructurePreservingCandidates(hand, discards)
    return randomChoice(bestDiscards)
```

---

## Section 6 — Following a complex lead

### 6.1 Policy

When following a complex hand:

1. If a covering ruff is possible, ruff with a random covering ruff.
2. Else if the lead has exactly one non-single element, and a covering DFP outcome exists, choose a random covering DFP outcome.
3. Else play low in DFP:
   - at each SFP layer, randomly choose among admissible candidates
   - fillers random, but avoid breaking structures if possible
   - discard random off-division cards, but avoid breaking structures if possible

### 6.2 Check whether the lead has exactly one non-single element

```text
leadHasExactlyOneNonSingleElement(roundState):
    count = 0
    for each element in roundState.resolvedLead:
        if element.copy >= 2:
            count += 1
    return count == 1
```

### 6.3 Random low DFP

```text
botChooseLowDFPOutcome(hand, roundState, forehandControl):
    legalFollows = enumerateLegalFollows(hand, roundState.leadCards, forehandControl)

    nonCoveringFollowers = []

    for each move in legalFollows:
        if isCover(roundState, move) == false:
            state = classifyFollowForCover(roundState, move)
            if state.kind == "DIVISION_FOLLOWER" or state.kind == "DISCARD":
                nonCoveringFollowers.append(move)

    bestMoves = chooseStructurePreservingCandidates(hand, nonCoveringFollowers)
    return randomChoice(bestMoves)
```

### 6.4 Bot follow for a complex lead

```text
botFollowComplex(hand, roundState, forehandControl, playerKnownInfo):
    legalFollows = enumerateLegalFollows(hand, roundState.leadCards, forehandControl)

    coveringRuffs = []
    coveringDFP = []

    for each move in legalFollows:
        state = classifyFollowForCover(roundState, move)

        if state.kind == "POTENTIAL_RUFF" and isCover(roundState, move):
            coveringRuffs.append(move)

        else if leadHasExactlyOneNonSingleElement(roundState) and isCover(roundState, move):
            coveringDFP.append(move)

    if length(coveringRuffs) > 0:
        return randomChoice(coveringRuffs)

    if length(coveringDFP) > 0:
        return randomChoice(coveringDFP)

    return botChooseLowDFPOutcome(hand, roundState, forehandControl)
```

---

## Section 7 — Unified bot follow entry

```text
botChooseFollow(hand, roundState, forehandControl, playerKnownInfo):
    if roundState.leadIsOneElement and roundState.resolvedLead[0].copy == 1:
        return botFollowSingle(hand, roundState, forehandControl, playerKnownInfo)
    else:
        return botFollowComplex(hand, roundState, forehandControl, playerKnownInfo)
```

---

## Section 8 — Helper terminology functions

These are referenced by the bot logic and should be implemented elsewhere.

```text
isTopSingle(card, playerKnownInfo)
isEstablishedSingle(card, playerKnownInfo)
getElementGrade(element, playerKnownInfo)

compareTypeThenOrder(e1, e2)
highestOrderedElement(elements)
lowestOrderedCard(cards)

allOtherPlayersShownOut(playerKnownInfo, division)
enumerateLegalFollows(hand, leadCards, forehandControl)
randomChoice(list)
randomSubsetOfSize(cards, k)
```

---

## Section 9 — Bot mode reminder

This is a **test bot**:

- random choices are acceptable unless a tie breaker is explicitly specified
- its role is to create legal and varied scenarios
- it is not intended to be strategically optimal

For reproducible tests, the implementation should support a stored random seed.
