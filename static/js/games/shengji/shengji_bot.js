/**
 * games/shengji/shengji_bot.js
 * Bot AI for Shengji — test-level bot (not strategically optimal).
 *
 * Follows the bot pseudocode specification:
 *   - Declaration: overcall if possible; else declare if 3*trumpCount >= handSize
 *   - Base: fold shortest plain division + fill random
 *   - Lead: highest-type structured element, else lowest trump/card
 *   - Follow single: cover ruff > cover same division > play low > discard
 *   - Follow complex: cover ruff > play low
 *
 * All functions are pure (read game state, return chosen cards).
 */

// ---------------------------------------------------------------------------
// Declaration
// ---------------------------------------------------------------------------

/**
 * Choose a declaration for a bot player.
 * Returns { suit, count } or null if no declaration.
 */
function botChooseDeclaration(player, currentDeclaration = null) {
    let hand = game.hands[player];
    let level = game.level;
    let handSize = hand.length;

    let candidates = [];
    for (let suit = 0; suit <= 4; suit++) {
        let count = 0;
        if (suit === 4) {
            let sj = hand.filter(c => c.rank === 14).length;
            let bj = hand.filter(c => c.rank === 15).length;
            // Hierarchy: Double Big Joker (4) > Double Small Joker (3)
            if (bj >= 2) count = 4;
            else if (sj >= 2) count = 3;
        } else {
            let levelCardsOfSuit = hand.filter(c => c.rank === level && c.suit === suit);
            count = levelCardsOfSuit.length;
        }
        
        if (count === 0) continue;
        
        // Disallow self-overcalling with a different suit
        if (currentDeclaration && currentDeclaration.player === player && currentDeclaration.suit !== suit) {
            continue;
        }

        let trumpCount = engineCountTrumpIfStrain(hand, suit, level);
        if (3 * trumpCount >= handSize) {
            // Favor NTS heavily if we meet criteria
            let weight = (suit === 4) ? trumpCount + 2 : trumpCount;
            candidates.push({
                suit: suit,
                count: count,
                trumpCount: weight
            });
        }
    }

    if (candidates.length === 0) return null;

    // Pick suit with highest trump count
    candidates.sort((a, b) => b.trumpCount - a.trumpCount);
    let best = candidates[0];
    return { suit: best.suit, count: Math.min(best.count, 2) };
}

// ---------------------------------------------------------------------------
// Base making
// ---------------------------------------------------------------------------

/**
 * Choose 8 cards for the base.
 * Strategy: fold shortest plain division entirely, fill remaining with random.
 */
function botMakeBase(player) {
    let hand = game.hands[player];
    let strain = game.strain;
    let base = [];

    // Find plain divisions and their sizes
    let plainDivisions = [];
    for (let d = 0; d <= 3; d++) {
        if (d === strain) continue; // skip strain suit (it's trump)
        let cards = hand.filter(c => c.division === d);
        if (cards.length > 0 && cards.length <= BASE_SIZE) {
            plainDivisions.push({ division: d, cards: cards });
        }
    }

    if (plainDivisions.length > 0) {
        // Sort by size ascending
        plainDivisions.sort((a, b) => a.cards.length - b.cards.length);
        let chosen = plainDivisions[0];
        base = [...chosen.cards];
    }

    // Fill remaining slots
    if (base.length < BASE_SIZE) {
        let baseIds = new Set(base.map(c => c.cardId));
        let remaining = hand.filter(c => !baseIds.has(c.cardId));

        // Prefer non-trump, low-value cards
        remaining.sort((a, b) => {
            if (a.division === 4 && b.division !== 4) return 1;
            if (a.division !== 4 && b.division === 4) return -1;
            return a.order - b.order;
        });

        while (base.length < BASE_SIZE && remaining.length > 0) {
            base.push(remaining.shift());
        }
    }

    // If we still overshot (plain division > 8), take first 8
    if (base.length > BASE_SIZE) {
        base = base.slice(0, BASE_SIZE);
    }

    return base;
}

// ---------------------------------------------------------------------------
// Lead choice
// ---------------------------------------------------------------------------

/**
 * Collect all cards visible to the bot from past rounds (player-known information).
 * Includes: all cards from roundHistory + cards in the current roundPlayed.
 * Does NOT include other players' current hands or unseen base cards.
 * @returns {Set<number>} set of cardIds that have been played
 */
function botGetPlayedCardIds() {
    let played = new Set();
    for (let rh of game.roundHistory) {
        for (let hand of rh.played) {
            if (hand) hand.forEach(c => played.add(c.cardId));
        }
    }
    for (let hand of game.roundPlayed) {
        if (hand) hand.forEach(c => played.add(c.cardId));
    }
    return played;
}

/**
 * Build a map of all possible orders in a division, and how many copies
 * of each order are still "unseen" (not in bot's hand, not played).
 * For grade computation, we care about how many higher same-type elements
 * could still exist from unseen cards.
 *
 * @param {number} player - bot player index
 * @param {number} division - target division
 * @returns {Map<number, number>} order → count of unseen cards at that order
 */
function botGetUnseenByOrder(player, division) {
    let playedIds = botGetPlayedCardIds();
    let myIds = new Set(game.hands[player].map(c => c.cardId));

    // Count unseen per order in the target division
    let unseenMap = new Map();
    for (let c of game.deck) {
        if (c.division !== division) continue;
        if (playedIds.has(c.cardId) || myIds.has(c.cardId)) continue;
        let count = unseenMap.get(c.order) || 0;
        unseenMap.set(c.order, count + 1);
    }
    return unseenMap;
}

/**
 * Find all structured elements (pairs, tractors) in a set of cards within one division.
 * Returns array of { cards, copy, span, order, division }.
 */
function botFindAllStructuredElements(cards, division) {
    let sorted = [...cards].sort((a, b) => b.order - a.order || a.cardId - b.cardId);
    let pairs = [];
    let i = 0;
    while (i < sorted.length) {
        if (i + 1 < sorted.length && sorted[i].isSame(sorted[i + 1])) {
            pairs.push({ cards: [sorted[i], sorted[i + 1]], order: sorted[i].order });
            i += 2;
        } else {
            i++;
        }
    }

    // Merge consecutive pairs into tractors greedily (highest order first)
    pairs.sort((a, b) => b.order - a.order);
    let elements = [];
    let usedPair = new Array(pairs.length).fill(false);
    for (let p = 0; p < pairs.length; p++) {
        if (usedPair[p]) continue;
        let tractor = [...pairs[p].cards];
        let lastOrder = pairs[p].order;
        let span = 1;
        usedPair[p] = true;

        for (let q = p + 1; q < pairs.length; q++) {
            if (usedPair[q]) continue;
            if (pairs[q].order === lastOrder - 1) {
                tractor.push(...pairs[q].cards);
                lastOrder = pairs[q].order;
                span++;
                usedPair[q] = true;
            }
        }

        elements.push({
            cards: tractor,
            copy: 2,
            span: span,
            order: tractor[0].order,
            division: division
        });
    }
    return elements;
}

/**
 * Compute the grade of a structured element.
 * Grade = 1 + number of distinct higher same-type elements possible from unseen cards.
 *
 * For a pair (copy=2, span=1): count unseen orders in the same division
 *   where unseen count >= 2 and order > element.order.
 * For a tractor (copy=2, span=s): count consecutive runs of length >= s
 *   among unseen orders where each has count >= 2, with top order > element.order.
 *
 * @returns {number} grade (1 = top, higher = weaker)
 */
function botComputeGrade(element, unseenMap) {
    let higherCount = 0;

    if (element.copy === 2 && element.span === 1) {
        // Pair: count unseen orders with >= 2 copies above this order
        for (let [order, count] of unseenMap) {
            if (order > element.order && count >= 2) {
                higherCount++;
            }
        }
    } else if (element.copy === 2 && element.span > 1) {
        // Tractor: count how many consecutive pair runs of length >= span
        // exist above this element's order among unseen cards
        let pairOrders = [];
        for (let [order, count] of unseenMap) {
            if (count >= 2) pairOrders.push(order);
        }
        pairOrders.sort((a, b) => a - b); // ascending

        // Sliding window: find consecutive runs of length >= element.span
        // whose top order > element.order
        for (let i = 0; i <= pairOrders.length - element.span; i++) {
            // Check if pairOrders[i..i+span-1] are consecutive
            let isConsecutive = true;
            for (let j = 1; j < element.span; j++) {
                if (pairOrders[i + j] !== pairOrders[i] + j) {
                    isConsecutive = false;
                    break;
                }
            }
            if (isConsecutive) {
                let topOrder = pairOrders[i + element.span - 1];
                if (topOrder > element.order) higherCount++;
            }
        }
    }

    return 1 + higherCount;
}

/**
 * Find top/established singles in a division from the bot's hand.
 *
 * A "top single" has no unseen card at a higher order in that division.
 * An "established single" is currently the highest remaining single
 * after accounting for played cards — i.e., no unseen card at a higher order.
 *
 * In practice for this bot, both reduce to the same check:
 * a single card at order O is top/established if unseenMap has no entry
 * with order > O (meaning no unseen card can beat it).
 *
 * @param {Card[]} divCards - all cards the bot holds in one division
 * @param {Map<number,number>} unseenMap - unseen card counts by order
 * @returns {Card[]} top/established single cards
 */
function botFindTopEstablishedSingles(divCards, unseenMap) {
    // Find the highest unseen order
    let maxUnseenOrder = -1;
    for (let [order] of unseenMap) {
        if (order > maxUnseenOrder) maxUnseenOrder = order;
    }

    // Identify singles (cards that don't form a pair)
    let sorted = [...divCards].sort((a, b) => b.order - a.order || a.cardId - b.cardId);
    let singles = [];
    let i = 0;
    while (i < sorted.length) {
        if (i + 1 < sorted.length && sorted[i].isSame(sorted[i + 1])) {
            i += 2; // skip pair
        } else {
            singles.push(sorted[i]);
            i++;
        }
    }

    // A single is top/established if its order > maxUnseenOrder
    return singles.filter(c => c.order > maxUnseenOrder);
}

/**
 * Attempt to build a multiplay for the bot in one division.
 *
 * Multiplay = all eligible structured elements (grade <= 4) +
 *             all top/established singles in the same division.
 *
 * Returns the multiplay cards array, or null if conditions not met.
 */
function botBuildMultiplay(player, divCards, division) {
    let unseenMap = botGetUnseenByOrder(player, division);

    // Find all structured elements
    let allElements = botFindAllStructuredElements(divCards, division);

    // Filter to grade <= 4
    let eligible = allElements.filter(el => botComputeGrade(el, unseenMap) <= 4);

    if (eligible.length === 0) return null;

    // Find top/established singles
    // First, remove cards used by eligible structured elements
    let structuredIds = new Set(eligible.flatMap(el => el.cards.map(c => c.cardId)));
    let remainingDivCards = divCards.filter(c => !structuredIds.has(c.cardId));
    let topSingles = botFindTopEstablishedSingles(remainingDivCards, unseenMap);

    // Check multiplay condition: need at least one of:
    // (a) top/established singles exist, or
    // (b) more than one eligible structured element
    if (topSingles.length === 0 && eligible.length <= 1) return null;

    // Build the multiplay
    let multiplayCards = [];
    for (let el of eligible) {
        multiplayCards.push(...el.cards);
    }
    multiplayCards.push(...topSingles);

    // A multiplay must have more than one element after decomposition
    // (otherwise it's just a single element, not a multiplay)
    if (eligible.length + topSingles.length <= 1) return null;

    return multiplayCards;
}

/**
 * Find a potential pair or tractor in a hand.
 * Returns {cards, copy, span, order, division} or null.
 */
function botFindBestStructuredElement(hand) {
    // Group by division
    let divGroups = {};
    for (let c of hand) {
        let d = c.division;
        if (!divGroups[d]) divGroups[d] = [];
        divGroups[d].push(c);
    }

    let best = null;

    for (let d in divGroups) {
        let cards = divGroups[d];
        // Find pairs
        let sorted = [...cards].sort((a, b) => b.order - a.order || a.cardId - b.cardId);
        let pairs = [];
        let i = 0;
        while (i < sorted.length) {
            if (i + 1 < sorted.length && sorted[i].isSame(sorted[i + 1])) {
                pairs.push({ cards: [sorted[i], sorted[i + 1]], order: sorted[i].order });
                i += 2;
            } else {
                i++;
            }
        }

        // Try to merge consecutive pairs into tractors
        pairs.sort((a, b) => b.order - a.order);
        let usedPair = new Array(pairs.length).fill(false);
        for (let p = 0; p < pairs.length; p++) {
            if (usedPair[p]) continue;
            let tractor = [...pairs[p].cards];
            let lastOrder = pairs[p].order;
            let span = 1;
            usedPair[p] = true;

            for (let q = p + 1; q < pairs.length; q++) {
                if (usedPair[q]) continue;
                if (pairs[q].order === lastOrder - 1) {
                    tractor.push(...pairs[q].cards);
                    lastOrder = pairs[q].order;
                    span++;
                    usedPair[q] = true;
                }
            }

            let element = {
                cards: tractor,
                copy: 2,
                span: span,
                order: tractor[0].order,
                division: parseInt(d)
            };

            if (!best
                || element.copy > best.copy
                || (element.copy === best.copy && element.span > best.span)
                || (element.copy === best.copy && element.span === best.span && element.order > best.order)) {
                best = element;
            }
        }
    }

    return best;
}

/**
 * Choose cards to lead.
 */
function botChooseLead(player) {
    let hand = game.hands[player];
    if (hand.length === 0) return [];

    // 1. Try multiplay: group hand by division, attempt multiplay in each
    let divGroups = {};
    for (let c of hand) {
        let d = c.division;
        if (!divGroups[d]) divGroups[d] = [];
        divGroups[d].push(c);
    }

    let bestMultiplay = null;
    let bestMultiplayVolume = 0;
    for (let d in divGroups) {
        let mp = botBuildMultiplay(player, divGroups[d], parseInt(d));
        if (mp && mp.length > bestMultiplayVolume) {
            bestMultiplay = mp;
            bestMultiplayVolume = mp.length;
        }
    }
    if (bestMultiplay) return bestMultiplay;

    // 2. Try highest structured element (single element lead)
    let structured = botFindBestStructuredElement(hand);
    if (structured) return structured.cards;

    // 3. Lead lowest trump
    let trumps = hand.filter(c => c.division === 4);
    if (trumps.length > 0) {
        trumps.sort((a, b) => a.order - b.order);
        return [trumps[0]];
    }

    // 4. Lead lowest card in any division
    let sorted = [...hand].sort((a, b) => a.order - b.order);
    return [sorted[0]];
}

// ---------------------------------------------------------------------------
// Follow choice (bot pseudocode §5–§7)
// ---------------------------------------------------------------------------

/**
 * Structure preservation score (bot pseudocode §1.2).
 * Rewards surviving non-single elements and top/established singles.
 */
function botPreservationScore(player, handAfterMove) {
    let score = 0;
    let divGroups = {};
    for (let c of handAfterMove) {
        let d = c.division;
        if (!divGroups[d]) divGroups[d] = [];
        divGroups[d].push(c);
    }

    for (let d in divGroups) {
        let divCards = divGroups[d];
        let elements = botFindAllStructuredElements(divCards, parseInt(d));
        for (let el of elements) {
            score += 10 * el.copy + el.span;
        }

        // Reward top/established singles
        let unseenMap = botGetUnseenByOrder(player, parseInt(d));
        let topSingles = botFindTopEstablishedSingles(divCards, unseenMap);
        for (let s of topSingles) {
            score += 3;
        }
    }
    return score;
}

/**
 * Among candidate moves, choose those with the best preservation score.
 */
function botChooseStructurePreserving(player, hand, candidates) {
    if (candidates.length <= 1) return candidates;

    let bestScore = -Infinity;
    let bestMoves = [];

    for (let move of candidates) {
        let moveIds = new Set(move.map(c => c.cardId));
        let handAfter = hand.filter(c => !moveIds.has(c.cardId));
        let score = botPreservationScore(player, handAfter);

        if (score > bestScore) {
            bestScore = score;
            bestMoves = [move];
        } else if (score === bestScore) {
            bestMoves.push(move);
        }
    }
    return bestMoves;
}

/**
 * Enumerate all legal follow card combinations.
 * For efficiency, uses DFP outcomes and generates concrete card selections.
 */
function botEnumerateLegalFollows(hand, leadInfo, forehandControl) {
    let outcomes = engineEnumerateDFPOutcomes(hand, leadInfo, forehandControl);
    let results = [];
    let seen = new Set();

    for (let outcome of outcomes) {
        if (outcome.shortDivisionCase) {
            // Forced division cards + choose fillers from pool
            let forced = outcome.forcedDivisionCards;
            let pool = outcome.fillerPool;
            let need = outcome.fillerCount;

            if (need === 0) {
                let key = forced.map(c => c.cardId).sort().join(',');
                if (!seen.has(key)) { seen.add(key); results.push([...forced]); }
            } else {
                // Generate filler combinations
                let fillerCombos = botGenerateCombinations(pool, need);
                for (let filler of fillerCombos) {
                    // Forehand control check on fillers
                    if (outcome.legalMarkedCountInFillers !== null) {
                        if (countMarkedCards(filler, forehandControl) !== outcome.legalMarkedCountInFillers) continue;
                    }
                    let move = [...forced, ...filler];
                    let key = move.map(c => c.cardId).sort().join(',');
                    if (!seen.has(key)) { seen.add(key); results.push(move); }
                }
            }
        } else {
            // Structured cards + choose fillers from division pool
            let structured = outcome.structuredCards;
            let pool = outcome.fillerPool;
            let need = outcome.fillerCount;

            if (need === 0) {
                let key = structured.map(c => c.cardId).sort().join(',');
                if (!seen.has(key)) { seen.add(key); results.push([...structured]); }
            } else {
                let fillerCombos = botGenerateCombinations(pool, need);
                for (let filler of fillerCombos) {
                    if (outcome.legalMarkedCountInFillers !== null) {
                        if (countMarkedCards(filler, forehandControl) !== outcome.legalMarkedCountInFillers) continue;
                    }
                    let move = [...structured, ...filler];
                    let key = move.map(c => c.cardId).sort().join(',');
                    if (!seen.has(key)) { seen.add(key); results.push(move); }
                }
            }
        }
    }

    // Safety: if enumeration produced nothing, fall back to simple selection
    if (results.length === 0) {
        results.push(botFallbackFollow(hand, leadInfo));
    }
    return results;
}

/**
 * Generate all combinations of `k` cards from `cards`.
 * Limits to avoid combinatorial explosion.
 */
function botGenerateCombinations(cards, k) {
    if (k <= 0) return [[]];
    if (k >= cards.length) return [[...cards]];

    // Cap combinations to prevent perf issues
    let MAX_COMBOS = 200;
    let results = [];

    function recurse(start, current) {
        if (current.length === k) {
            results.push([...current]);
            return results.length >= MAX_COMBOS;
        }
        for (let i = start; i < cards.length; i++) {
            current.push(cards[i]);
            if (recurse(i + 1, current)) return true;
            current.pop();
        }
        return false;
    }

    recurse(0, []);
    return results;
}

/**
 * Fallback follow: play lowest division cards + lowest fillers.
 */
function botFallbackFollow(hand, leadInfo) {
    let volume = leadInfo.volume;
    let leadDiv = leadInfo.division;
    let divCards = hand.filter(c => c.division === leadDiv);
    let selected = [];

    if (divCards.length >= volume) {
        let sorted = [...divCards].sort((a, b) => a.order - b.order);
        return sorted.slice(0, volume);
    }

    selected = [...divCards];
    let remaining = hand.filter(c => c.division !== leadDiv)
        .sort((a, b) => a.order - b.order);
    let need = volume - selected.length;
    for (let i = 0; i < need && i < remaining.length; i++) {
        selected.push(remaining[i]);
    }
    return selected;
}

/**
 * Classify a follow for the bot's covering logic.
 * Returns { kind: 'DISCARD'|'DIVISION_FOLLOW'|'POTENTIAL_RUFF', orderKey }.
 */
function botClassifyFollow(leadInfo, followCards) {
    let leadDiv = leadInfo.division;
    let isAllDiv = followCards.every(c => c.division === leadDiv);
    let isAllTrump = followCards.every(c => c.division === 4);
    let leadIsOneElement = leadInfo.elements.length === 1;
    let leadTypeMultiset = engineMultisetOfTypes(leadInfo.elements);

    if (isAllDiv) {
        if (!leadIsOneElement) return { kind: 'DIVISION_FOLLOW', orderKey: null };

        let followInfo = engineResolveLead(followCards);
        if (!followInfo || followInfo.elements.length !== 1) return { kind: 'DISCARD', orderKey: null };

        let fEl = followInfo.elements[0], lEl = leadInfo.elements[0];
        if (fEl.copy === lEl.copy && fEl.span === lEl.span) {
            return { kind: 'DIVISION_FOLLOW', orderKey: fEl.order };
        }
        return { kind: 'DISCARD', orderKey: null };
    }

    if (isAllTrump && leadDiv !== 4) {
        let bestCore = engineFindBestPotentialRuffCore(leadTypeMultiset, followCards);
        if (bestCore) return { kind: 'POTENTIAL_RUFF', orderKey: bestCore.order };
    }

    return { kind: 'DISCARD', orderKey: null };
}

/**
 * Check if a follow is a cover given the current round state.
 */
function botIsCover(leadInfo, followCards, ruffed, highestOrder) {
    let cls = botClassifyFollow(leadInfo, followCards);

    if (cls.kind === 'DISCARD') return false;
    if (cls.kind === 'POTENTIAL_RUFF') {
        return !ruffed || cls.orderKey > highestOrder;
    }
    // DIVISION_FOLLOW
    if (ruffed) return false;
    if (leadInfo.elements.length > 1) return false; // multiplay can't be covered by div-follow
    return cls.orderKey !== null && cls.orderKey > highestOrder;
}

/**
 * Choose cards to follow a lead (bot pseudocode §5–§7).
 */
function botChooseFollow(player) {
    let hand = game.hands[player];
    let leadInfo = game.leadInfo;
    let volume = leadInfo.volume;
    let leadDiv = leadInfo.division;

    // Build forehand control if applicable
    let fc = null;
    if (game.forehandControl && game.forehandControl.target === player) {
        fc = game.forehandControl;
    }

    // Get current round best state for cover checking
    let ruffed = false;
    let highestOrder = leadInfo.coreElement.order;
    for (let i = 1; i < game.currentTurnIndex; i++) {
        let p = (game.currentLeader + i) % NUM_PLAYERS;
        let played = game.roundPlayed[p];
        if (!played) continue;
        let cls = botClassifyFollow(leadInfo, played);
        if (cls.kind === 'POTENTIAL_RUFF') {
            if (!ruffed || cls.orderKey > highestOrder) {
                ruffed = true;
                highestOrder = cls.orderKey;
            }
        } else if (cls.kind === 'DIVISION_FOLLOW' && !ruffed) {
            if (cls.orderKey !== null && cls.orderKey > highestOrder) {
                highestOrder = cls.orderKey;
            }
        }
    }

    // Enumerate all legal follows
    let legalFollows = botEnumerateLegalFollows(hand, leadInfo, fc);

    // Classify each legal follow
    let coveringRuffs = [];
    let coveringDivFollows = [];
    let lowFollows = [];
    let discards = [];

    for (let move of legalFollows) {
        let cls = botClassifyFollow(leadInfo, move);

        if (cls.kind === 'POTENTIAL_RUFF' && botIsCover(leadInfo, move, ruffed, highestOrder)) {
            coveringRuffs.push(move);
        } else if (cls.kind === 'DIVISION_FOLLOW' && botIsCover(leadInfo, move, ruffed, highestOrder)) {
            coveringDivFollows.push(move);
        } else if (cls.kind === 'DIVISION_FOLLOW' || cls.kind === 'POTENTIAL_RUFF') {
            lowFollows.push(move);
        } else {
            discards.push(move);
        }
    }

    // Priority: covering ruff > covering div-follow > play low > discard
    if (coveringRuffs.length > 0) {
        return coveringRuffs[Math.floor(Math.random() * coveringRuffs.length)];
    }

    if (coveringDivFollows.length > 0) {
        let best = botChooseStructurePreserving(player, hand, coveringDivFollows);
        return best[Math.floor(Math.random() * best.length)];
    }

    if (lowFollows.length > 0) {
        let best = botChooseStructurePreserving(player, hand, lowFollows);
        return best[Math.floor(Math.random() * best.length)];
    }

    if (discards.length > 0) {
        let best = botChooseStructurePreserving(player, hand, discards);
        return best[Math.floor(Math.random() * best.length)];
    }

    // Shouldn't reach here, but fallback
    return botFallbackFollow(hand, leadInfo);
}

/**
 * Select 'volume' cards from division cards to follow.
 * Kept for backward compatibility; delegates to the main follow logic.
 */
function botSelectFromDivision(divCards, leadInfo, volume) {
    let sorted = [...divCards].sort((a, b) => a.order - b.order || a.cardId - b.cardId);

    if (volume === 1) return [sorted[0]];

    let selected = [];
    let remaining = [...sorted];

    let leadPairs = leadInfo.elements.reduce((acc, el) => acc + (el.copy === 2 ? el.span : 0), 0);
    if (leadPairs > 0) {
        let pairs = [];
        for (let i = 0; i < remaining.length - 1; i++) {
            if (remaining[i].isSame(remaining[i+1])) {
                pairs.push([remaining[i], remaining[i+1]]);
                i++;
            }
        }
        
        let pairsToPlay = Math.min(leadPairs, pairs.length);
        for (let i = 0; i < pairsToPlay; i++) {
            selected.push(pairs[i][0], pairs[i][1]);
            let idx1 = remaining.findIndex(c => c.cardId === pairs[i][0].cardId);
            remaining.splice(idx1, 1);
            let idx2 = remaining.findIndex(c => c.cardId === pairs[i][1].cardId);
            remaining.splice(idx2, 1);
        }
    }

    while (selected.length < volume && remaining.length > 0) {
        selected.push(remaining.shift());
    }

    return selected;
}

// ---------------------------------------------------------------------------
// Unified bot action
// ---------------------------------------------------------------------------

/**
 * Get the bot's play for the current turn.
 * Returns an array of cards.
 */
function botPlay(player) {
    if (game.currentTurnIndex === 0) {
        return botChooseLead(player);
    } else {
        return botChooseFollow(player);
    }
}
