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
function botChooseDeclaration(player) {
    let hand = game.hands[player];
    let level = game.level;
    let handSize = hand.length;

    let candidates = [];
    for (let suit = 0; suit <= 3; suit++) {
        let levelCardsOfSuit = hand.filter(c => c.rank === level && c.suit === suit);
        if (levelCardsOfSuit.length === 0) continue;

        let trumpCount = engineCountTrumpIfStrain(hand, suit, level);
        if (3 * trumpCount >= handSize) {
            candidates.push({
                suit: suit,
                count: levelCardsOfSuit.length,
                trumpCount: trumpCount
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

    // 1. Try highest structured element
    let structured = botFindBestStructuredElement(hand);
    if (structured) return structured.cards;

    // 2. Lead lowest trump
    let trumps = hand.filter(c => c.division === 4);
    if (trumps.length > 0) {
        trumps.sort((a, b) => a.order - b.order);
        return [trumps[0]];
    }

    // 3. Lead lowest card in any division
    let sorted = [...hand].sort((a, b) => a.order - b.order);
    return [sorted[0]];
}

// ---------------------------------------------------------------------------
// Follow choice
// ---------------------------------------------------------------------------

/**
 * Choose cards to follow a lead.
 */
function botChooseFollow(player) {
    let hand = game.hands[player];
    let leadInfo = game.leadInfo;
    let volume = leadInfo.volume;
    let leadDiv = leadInfo.division;

    let divCards = hand.filter(c => c.division === leadDiv);

    if (divCards.length >= volume) {
        // Have enough cards in led division — play from division
        return botSelectFromDivision(divCards, leadInfo, volume);
    }

    // Short division — play all division cards + fill
    let selected = [...divCards];
    let remaining = hand.filter(c => c.division !== leadDiv);
    let need = volume - selected.length;

    // Fill with lowest non-trump, then lowest trump
    remaining.sort((a, b) => {
        if (a.division === 4 && b.division !== 4) return 1;
        if (a.division !== 4 && b.division === 4) return -1;
        return a.order - b.order;
    });

    // Try to ruff: if lead is plain and we have trump, try trump
    if (leadDiv !== 4) {
        let trumpFill = remaining.filter(c => c.division === 4);
        let nonTrumpFill = remaining.filter(c => c.division !== 4);
        if (trumpFill.length >= need && selected.length === 0) {
            // Full ruff: play trumps
            trumpFill.sort((a, b) => a.order - b.order);
            for (let i = 0; i < need; i++) selected.push(trumpFill[i]);
            return selected;
        }
    }

    for (let i = 0; i < need && i < remaining.length; i++) {
        selected.push(remaining[i]);
    }
    return selected;
}

/**
 * Select 'volume' cards from division cards to follow.
 * Tries to play low (preserve high cards).
 */
function botSelectFromDivision(divCards, leadInfo, volume) {
    // Sort ascending
    let sorted = [...divCards].sort((a, b) => a.order - b.order || a.cardId - b.cardId);

    if (volume === 1) {
        // Single follow: play lowest
        return [sorted[0]];
    }

    // For multi-card follows: play lowest cards
    return sorted.slice(0, volume);
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
