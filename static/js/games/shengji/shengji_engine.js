/**
 * games/shengji/shengji_engine.js
 * Shengji game engine for live 3-bot 1-player play
 *
 * Manages game state, deck, dealing, declaration, basing,
 * round play, scoring, and game flow.
 * Does NOT touch the DOM — all rendering is done by pages/game/index.js.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const GamePhase = {
    IDLE:       'idle',
    DEALING:    'dealing',
    DECLARING:  'declaring',
    BASING:     'basing',
    PLAYING:    'playing',
    COUNTING:   'counting',
    GAME_OVER:  'game_over'
};

const HUMAN_PLAYER   = 0; // South
const TOTAL_CARDS    = 108;
const CARDS_PER_HAND = 25;
const BASE_SIZE      = 8;
const NUM_PLAYERS    = 4;
const TOTAL_ROUNDS   = 25;

// ---------------------------------------------------------------------------
// Preset game configurations (rules spec §12A)
// ---------------------------------------------------------------------------
const PRESET_CONFIGS = {
    'default': {
        deckCount: 2,
        mustDefendLevels: [],
        mustStopLevels: [3, 8, 11], // 5, X, K (indices)
        allowOverbase: false,
        overbaseRestrictions: null,
        doubleDeclarationOrdering: null,
        levelConfiguration: 'default',
        allowCrossings: false,
        knockBackLevels: [],
        baseMultiplierLimit: 4,   // cap: baseMultiplier <= 2^baseMultiplierLimit
        countingSystem: 'default',
        endingCompensation: false,
    },
    'plain': {
        deckCount: 2,
        mustStopLevels: [],
    },
    'high-school': {
        deckCount: 2,
        allowOverbase: true,
        overbaseRestrictions: null,
        doubleDeclarationOrdering: 's-h-c-d',
        levelConfiguration: 'high-school',
        knockBackLevels: [9, 12],
        baseMultiplierLimit: Infinity,
    },
    'Berkeley': {
        deckCount: 2,
        allowOverbase: true,
        overbaseRestrictions: null,
        doubleDeclarationOrdering: 's-h-c-d',
        allowCrossings: true,
        baseMultiplierLimit: Infinity,
    },
    'experimental': {
        deckCount: 2,
        endingCompensation: true,
        countingSystem: '7-3-5',
    },
};

/**
 * Build a full config by merging the default preset with a named preset and optional overrides.
 * §12A.7: load default first → apply preset overrides → apply custom overrides.
 */
function engineBuildConfig(presetName, customOverrides) {
    // Prefer the centralized settings resolver when available.
    if (typeof shengjiResolveGameRuleConfig === 'function') {
        return shengjiResolveGameRuleConfig({
            presetName: presetName || 'default',
            overrides: customOverrides || {}
        });
    }

    let fallback = { ...PRESET_CONFIGS['default'] };
    if (presetName && presetName !== 'default' && PRESET_CONFIGS[presetName]) {
        Object.assign(fallback, PRESET_CONFIGS[presetName]);
    }
    if (customOverrides) {
        Object.assign(fallback, customOverrides);
    }
    return fallback;
}

function engineGetTimingConfigValue(key, fallback) {
    let timing = game && game.gameConfig && game.gameConfig.timing;
    if (timing && timing[key] !== undefined && timing[key] !== null) {
        return timing[key];
    }
    if (TIMING_CONFIG[key] !== undefined && TIMING_CONFIG[key] !== null) {
        return TIMING_CONFIG[key];
    }
    return fallback;
}

// ---------------------------------------------------------------------------
// Centralized timing configuration (note 24 §1)
// ---------------------------------------------------------------------------
const TIMING_CONFIG = {
    baseShotClock:       45,   // seconds — shot clock for set-base moves
    playShotClock:        5,   // seconds — shot clock for play-card moves
    bankTime:            60,   // seconds — bank time per frame per human player
    frameIntermittent:    2,   // seconds — non-interactive intermittent before dealing
    finalDeclareWindow:   5,   // seconds — final declaration window after dealing
    overbaseWindow:      10,   // seconds — overbase calling window after set-base
};

// Player labels (indexed by position)
const PLAYER_NAMES = [t('players.south'), t('players.east'), t('players.north'), t('players.west')];

// Position text relative to South
const POSITION_LABELS = [t('positions.south'), t('positions.east'), t('positions.north'), t('positions.west')];

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------
let game = {
    phase:          GamePhase.IDLE,
    level:          0,       // rank index: 0→'2', 1→'3', … 12→'A'
    strain:         -1,      // -1 undetermined, 0–3 suited, 4 nts
    pivot:          0,       // pivot player position

    deck:           [],
    hands:          [[], [], [], []],
    base:           [],

    currentRound:       0,
    currentLeader:      -1,
    currentTurnIndex:   0,   // 0–3 within a round (offset from leader)
    roundPlayed:        [null, null, null, null],
    leadInfo:           null,

    frameScore:     0,       // attackers' running frame score
    roundHistory:   [],

    defendingTeam:  [],
    attackingTeam:  [],

    declarations:   [],      // { player, suit, count }

    // FailedMultiplayState — aftermath of the most recent failed multiplay
    // { failer, intendedLead, actualElement, blockers, actualBlocker,
    //   revokedCards, exposedCards:{[div]:Card[]}, holdInProgress, revocationApplied }
    failedMultiplay: null,

    // ExposedCardState — all remaining exposed cards
    // { [failer]: { [division]: Card[] } }
    exposedCards: {},

    // ForehandControlChanceState — stored FC chances per failer
    // { [failer]: { forehand: int, count: int } }
    fcChances: {},

    // ForehandControlPendingTriggerState — trigger activated, awaiting decision
    // { forehand, failer, ledDivision, exposedDivisionCards, active, chanceConsuming }
    fcPending: null,

    // Committed FC constraint used by follow-legality checks
    // { mode, selectedCards, target, controller }
    forehandControl: null,

    // Incremental round state (§13b–§13e)
    roundState: null,

    // Active game configuration (§12A)
    gameConfig: null,

    // Per-player levels (§12)
    playerLevels: [0, 0, 0, 0],  // each player's current level (0→'2' … 12→'A')

    // Persistent level-rule clear-state across frames in a session.
    // Cycle-relative semantics are tracked per side (NS / EW) so special marks
    // are independent between sides and consumable once per cycle per side.
    levelRuleState: {
        cycleIndexBySide: [0, 0],
        mustDefendConsumedCycleBySide: [{}, {}],
        mustStopConsumedCycleBySide: [{}, {}],
        mustDefendStartMarkerConsumedBySide: [false, false],
        mustStopStartMarkerConsumedBySide: [false, false],
    },

    // Per-player bank time remaining in seconds (note 24 §9)
    playerBankTimes: [0, 0, 0, 0],
};

// ---------------------------------------------------------------------------
// Deck creation
// ---------------------------------------------------------------------------
function engineCreateDeck(level, strain) {
    let deck = [];
    let cardId = 0;
    let s = (strain >= 0 && strain <= 4) ? strain : 4;
    for (let copy = 0; copy < 2; copy++) {
        for (let suit = 0; suit <= 3; suit++) {
            for (let rank = 0; rank <= 12; rank++) {
                let card = new ShengjiCard(suit, rank, level, s);
                card.cardId = cardId++;
                deck.push(card);
            }
        }
        // Small joker
        let sj = new ShengjiCard(52, 52, level, s);
        sj.cardId = cardId++;
        deck.push(sj);
        // Big joker
        let bj = new ShengjiCard(53, 53, level, s);
        bj.cardId = cardId++;
        deck.push(bj);
    }
    return deck;
}

// ---------------------------------------------------------------------------
// Shuffle (Fisher-Yates)
// ---------------------------------------------------------------------------
function engineShuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ---------------------------------------------------------------------------
// Dealing
// ---------------------------------------------------------------------------
function engineDealCards(deck) {
    let hands = [[], [], [], []];
    let base = [];
    for (let i = 0; i < CARDS_PER_HAND * NUM_PLAYERS; i++) {
        hands[i % NUM_PLAYERS].push(deck[i]);
    }
    for (let i = CARDS_PER_HAND * NUM_PLAYERS; i < TOTAL_CARDS; i++) {
        base.push(deck[i]);
    }
    return { hands, base };
}

// ---------------------------------------------------------------------------
// Card property helpers
// ---------------------------------------------------------------------------
function engineReassignAll(level, strain) {
    let s = (strain >= 0 && strain <= 4) ? strain : 4;
    for (let hand of game.hands) {
        for (let card of hand) card.fillDivisionAndOrder(level, s);
    }
    for (let card of game.base) card.fillDivisionAndOrder(level, s);
}

function engineCompareSuits(s1, s2) {
    let sv = (game.strain >= 0 && game.strain <= 4) ? game.strain : 4;
    return ((s1 < 4 && s1 > sv) ? s1 - 4 : s1)
         - ((s2 < 4 && s2 > sv) ? s2 - 4 : s2);
}

function engineSortHand(hand) {
    hand.sort(function (a, b) {
        return engineCompareSuits(b.division, a.division) * 1000
             + (b.order - a.order) * 10
             + engineCompareSuits(b.suit, a.suit);
    });
}

function engineIsSingleDivision(cards) {
    if (cards.length === 0) return false;
    let d = cards[0].division;
    return cards.every(c => c.division === d);
}

// ---------------------------------------------------------------------------
// Counter / scoring
// ---------------------------------------------------------------------------
function engineCounterValue(card) {
    if (card.rank === 3) return 5;   // 5
    if (card.rank === 8) return 10;  // 10
    if (card.rank === 11) return 10; // K
    return 0;
}

function engineCountScore(cards) {
    return cards.reduce((s, c) => s + engineCounterValue(c), 0);
}

// ---------------------------------------------------------------------------
// Lead decomposition (mirrors legacy resolveLead pattern)
// ---------------------------------------------------------------------------
function engineResolveLead(cards) {
    if (cards.length === 0) return null;
    if (!engineIsSingleDivision(cards)) return null;

    let division = cards[0].division;
    let sorted = [...cards].sort((a, b) => b.order - a.order || a.suit - b.suit || a.cardId - b.cardId);

    // Pick out pairs
    let pairs = [];
    let singles = [];
    let i = 0;
    while (i < sorted.length) {
        if (i + 1 < sorted.length && sorted[i].isSame(sorted[i + 1])) {
            pairs.push([sorted[i], sorted[i + 1]]);
            i += 2;
        } else {
            singles.push(sorted[i]);
            i++;
        }
    }

    // Merge consecutive pairs → tractors
    let elements = [];
    let usedPair = new Array(pairs.length).fill(false);
    for (let p = 0; p < pairs.length; p++) {
        if (usedPair[p]) continue;
        let tractorCards = [...pairs[p]];
        let lastOrder = pairs[p][0].order;
        usedPair[p] = true;
        // Greedy merge downward
        let changed = true;
        while (changed) {
            changed = false;
            for (let q = 0; q < pairs.length; q++) {
                if (usedPair[q]) continue;
                if (pairs[q][0].order === lastOrder - 1) {
                    tractorCards.push(...pairs[q]);
                    lastOrder = pairs[q][0].order;
                    usedPair[q] = true;
                    changed = true;
                    break;
                }
            }
        }
        let span = tractorCards.length / 2;
        elements.push({
            cards: tractorCards,
            copy: 2,
            span: span,
            order: tractorCards[0].order,
            division: division
        });
    }
    for (let s of singles) {
        elements.push({
            cards: [s],
            copy: 1,
            span: 1,
            order: s.order,
            division: division
        });
    }

    // Sort by type desc, then order desc
    elements.sort((a, b) => {
        if (a.copy !== b.copy) return b.copy - a.copy;
        if (a.span !== b.span) return b.span - a.span;
        return b.order - a.order;
    });

    // Build type array: index 0 = singles count, index n = count of n-pair tractors
    let typeArray = new Array(14).fill(0);
    for (let e of elements) {
        if (e.copy === 1) typeArray[0]++;
        else typeArray[e.span]++;
    }

    return {
        division: division,
        elements: elements,
        type: typeArray,
        volume: cards.length,
        coreElement: elements[0]
    };
}

// ---------------------------------------------------------------------------
// Legality checks
// ---------------------------------------------------------------------------
function engineCouldBeatShape(hand, division, copy, span, thresholdOrder) {
    let divCards = hand.filter(c => c.division === division);
    if (!divCards || divCards.length < copy * span) return false;
    let sorted = [...divCards].sort((a, b) => b.order - a.order || a.suit - b.suit || a.cardId - b.cardId);
    
    let pairOrders = [];
    for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].isSame(sorted[i + 1])) {
            pairOrders.push(sorted[i].order);
            i++;
        }
    }
    
    if (copy === 1) {
        return sorted.some(c => c.order > thresholdOrder);
    }
    
    if (copy === 2) {
        if (span === 1) {
            return pairOrders.some(o => o > thresholdOrder);
        }
        
        let currentSpan = 1;
        for (let i = 0; i < pairOrders.length - 1; i++) {
            if (pairOrders[i] === pairOrders[i+1] + 1) {
                currentSpan++;
                let topOrder = pairOrders[i + 1 - (currentSpan - 1)];
                if (currentSpan >= span && topOrder > thresholdOrder) {
                    return true;
                }
            } else {
                currentSpan = 1;
            }
        }
    }
    return false;
}

function engineIsLegalLead(player, cards) {
    if (cards.length === 0) return { valid: false, error: t('errors.selectCards') };
    
    // single-division requirement
    if (!engineIsSingleDivision(cards)) {
        return { valid: false, error: t('errors.sameDivision') };
    }

    // Attempt canonical decomposition
    let leadInfo = engineResolveLead(cards);
    if (!leadInfo || leadInfo.elements.length === 0) {
        return { valid: false, error: t('errors.resolveFailed') };
    }

    // one-element lead → always valid, no multiplay check
    if (leadInfo.elements.length <= 1) {
        return { valid: true };
    }

    // Multiplay: detect blocked elements per Section 9
    // Each element is checked independently against each follower's hand
    let blockedEvents = []; // { element, blockerSeat }
    for (let el of leadInfo.elements) {
        for (let opp = 0; opp < NUM_PLAYERS; opp++) {
            if (opp === player) continue;
            if (engineCouldBeatShape(game.hands[opp], leadInfo.division, el.copy, el.span, el.order)) {
                blockedEvents.push({ element: el, blockerSeat: opp });
            }
        }
    }

    if (blockedEvents.length === 0) {
        // Multiplay survives — all elements pass
        return { valid: true };
    }

    // Failed multiplay: resolve actual blocker and actual led element
    let resolution = engineResolveFailedMultiplay(player, leadInfo, blockedEvents);
    return { valid: true, failedMultiplay: resolution };
}

/**
 * Resolve a failed multiplay per rules Section 9.
 *
 * Determines the actual blocker, the blocked element, and the actual led element.
 *
 * Blocker seat priority (relative to leader): 4th seat, 2nd seat, 3rd seat.
 * If the chosen blocker blocks multiple elements of the same type, reduce to
 * the lowest-ordered among those. The actual led element is that lowest element.
 *
 * @returns {object} { actualElement, blockerSeat, revokedCards, leadInfo (original) }
 */
function engineResolveFailedMultiplay(leader, leadInfo, blockedEvents) {
    // Seat priority: 4th, 2nd, 3rd (relative to leader)
    let seatPriority = [
        (leader + 3) % NUM_PLAYERS, // 4th seat
        (leader + 1) % NUM_PLAYERS, // 2nd seat
        (leader + 2) % NUM_PLAYERS  // 3rd seat
    ];

    // Find the highest-priority seat that has at least one block
    let chosenBlocker = -1;
    for (let seat of seatPriority) {
        if (blockedEvents.some(ev => ev.blockerSeat === seat)) {
            chosenBlocker = seat;
            break;
        }
    }

    // Gather all elements blocked by the chosen blocker
    let blockedByChosen = blockedEvents
        .filter(ev => ev.blockerSeat === chosenBlocker)
        .map(ev => ev.element);

    // If the chosen blocker blocks multiple elements of the same type,
    // keep only the lowest-ordered among each type group.
    // Then pick the actual led element: highest copy wins (per bot rule Section 7 of note).
    let actualElement;
    if (blockedByChosen.length === 1) {
        actualElement = blockedByChosen[0];
    } else {
        // Group by type (copy, span), keep lowest order in each group
        let typeGroups = {};
        for (let el of blockedByChosen) {
            let key = el.copy + ',' + el.span;
            if (!typeGroups[key] || el.order < typeGroups[key].order) {
                typeGroups[key] = el;
            }
        }
        // Among remaining candidates, pick highest copy, then highest span, then lowest order
        let candidates = Object.values(typeGroups);
        candidates.sort((a, b) => {
            if (a.copy !== b.copy) return b.copy - a.copy;
            if (a.span !== b.span) return b.span - a.span;
            return a.order - b.order;
        });
        actualElement = candidates[0];
    }

    // Compute revoked cards: all cards from the attempted lead that are NOT in the actual element
    let actualCardIds = new Set(actualElement.cards.map(c => c.cardId));
    let revokedCards = leadInfo.elements
        .flatMap(el => el.cards)
        .filter(c => !actualCardIds.has(c.cardId));

    // Collect ALL unique blocker seats (for announcement)
    let allBlockerSeats = [...new Set(blockedEvents.map(ev => ev.blockerSeat))];

    return {
        actualElement: actualElement,
        blockerSeat: chosenBlocker,
        allBlockerSeats: allBlockerSeats,
        revokedCards: revokedCards,
        originalLeadInfo: leadInfo
    };
}

// ---------------------------------------------------------------------------
// Fake multiplay detection (pseudocode §12)
// ---------------------------------------------------------------------------

/**
 * Detect if a multiplay is fake under leader-known information state.
 * Returns { isMultiplay, isFakeMultiplay, fakeCause }.
 *
 * Uses simplified individual checks (no joint structured-part search):
 * - single part checked first
 * - structured part compressed by type, each checked individually
 */
function engineDetectFakeMultiplay(leader, leadCards) {
    let resolvedLead = engineResolveLead(leadCards);
    if (!resolvedLead || resolvedLead.elements.length <= 1) {
        return { isMultiplay: false, isFakeMultiplay: false, fakeCause: null };
    }

    let singlePart = resolvedLead.elements.filter(e => e.copy === 1);
    let structuredPart = resolvedLead.elements.filter(e => e.copy >= 2);

    // Build leader-known information
    let info = engineBuildLeaderKnownInfo(leader, leadCards);

    // Single-part check
    if (singlePart.length > 0) {
        if (engineSinglePartIsFake(info, singlePart)) {
            return { isMultiplay: true, isFakeMultiplay: true, fakeCause: 'single-part' };
        }
    }

    // Structured-part check (compressed by type)
    if (structuredPart.length > 0) {
        let compressed = engineCompressStructuredPartByType(structuredPart);
        for (let element of compressed) {
            if (engineStructuredElementIsSurelyBlocked(info, element)) {
                return { isMultiplay: true, isFakeMultiplay: true, fakeCause: 'structured-part' };
            }
        }
    }

    return { isMultiplay: true, isFakeMultiplay: false, fakeCause: null };
}

/**
 * Build leader-known information state for fake multiplay detection.
 */
function engineBuildLeaderKnownInfo(leader, leadCards) {
    let playedCards = [];
    for (let rh of game.roundHistory) {
        for (let hand of rh.played) {
            if (hand) playedCards.push(...hand);
        }
    }

    let followers = [];
    for (let i = 1; i < NUM_PLAYERS; i++) {
        followers.push((leader + i) % NUM_PLAYERS);
    }

    // Track void info: if a player has shown out of a division
    let voidInfo = {};
    for (let p = 0; p < NUM_PLAYERS; p++) voidInfo[p] = {};
    for (let rh of game.roundHistory) {
        if (!rh.played[rh.leader]) continue;
        let leadDiv = rh.played[rh.leader][0] ? rh.played[rh.leader][0].division : null;
        if (leadDiv === null) continue;
        for (let i = 0; i < NUM_PLAYERS; i++) {
            if (i === rh.leader || !rh.played[i]) continue;
            let hasDiv = rh.played[i].some(c => c.division === leadDiv);
            if (!hasDiv) voidInfo[i][leadDiv] = true;
        }
    }

    return {
        leader: leader,
        leaderHandCards: game.hands[leader],
        intendedLeadCards: leadCards,
        playedCards: playedCards,
        knownBaseCards: (leader === game.pivot) ? game.base : [],
        followers: followers,
        currentHandCounts: game.hands.map(h => h.length),
        voidInfo: voidInfo,
        fullDeck: game.deck
    };
}

/**
 * Count all deck copies by value (suit|rank) in a given division.
 */
function engineCountAllDeckCopiesByValue(deck, division) {
    let counts = new Map();
    for (let c of deck) {
        if (c.division !== division) continue;
        let key = c.suit + '|' + c.rank;
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
}

/**
 * Build unknown value counts for a division from leader-known info.
 */
function engineBuildUnknownValueCounts(info, division) {
    let totalCounts = engineCountAllDeckCopiesByValue(info.fullDeck, division);
    let seenCounts = new Map();

    let addSeen = (cards) => {
        for (let c of cards) {
            if (c.division !== division) continue;
            let key = c.suit + '|' + c.rank;
            seenCounts.set(key, (seenCounts.get(key) || 0) + 1);
        }
    };

    addSeen(info.leaderHandCards);
    addSeen(info.intendedLeadCards);
    addSeen(info.playedCards);
    addSeen(info.knownBaseCards);

    let result = new Map();
    for (let [key, total] of totalCounts) {
        let seen = seenCounts.get(key) || 0;
        let remaining = total - seen;
        if (remaining > 0) result.set(key, remaining);
    }
    return result;
}

/**
 * Check if the single part of a multiplay is fake.
 * Fake if a higher same-division single is forced into a follower's hand.
 */
function engineSinglePartIsFake(info, singlePart) {
    let division = singlePart[0].division;
    let minSingleOrder = Math.min(...singlePart.map(e => e.order));
    let unknownCounts = engineBuildUnknownValueCounts(info, division);

    let unknownBaseCapacity = (info.leader === game.pivot)
        ? 0  // pivot knows the base
        : game.base.length - info.knownBaseCards.length;

    let totalRelevantUnknown = 0;

    for (let [key, count] of unknownCounts) {
        // Reconstruct order for this value key
        let parts = key.split('|');
        let suit = parseInt(parts[0]), rank = parseInt(parts[1]);
        // Find a card in the deck with this value to get its order
        let sample = info.fullDeck.find(c => c.suit === suit && c.rank === rank && c.division === division);
        if (!sample) continue;
        if (sample.order <= minSingleOrder) continue;

        totalRelevantUnknown += count;

        // If this value is only possible in follower hands (can't be in base)
        // and it has more copies than base can absorb, it's fake
        if (totalRelevantUnknown > unknownBaseCapacity) return true;
    }

    return false;
}

/**
 * Compress structured part by type: keep only the lowest-ordered element per type.
 */
function engineCompressStructuredPartByType(structuredPart) {
    let grouped = {};
    for (let el of structuredPart) {
        let key = el.copy + ',' + el.span;
        if (!grouped[key] || el.order < grouped[key].order) {
            grouped[key] = el;
        }
    }
    return Object.values(grouped).sort((a, b) => {
        if (a.copy !== b.copy) return b.copy - a.copy;
        if (a.span !== b.span) return b.span - a.span;
        return b.order - a.order;
    });
}

/**
 * Check if a structured element is surely blocked under leader-known info.
 * Uses simplified check: if any follower could form a higher same-type element
 * from unknown cards, the element is not surely blocked.
 * Returns true if surely blocked (meaning element IS fake).
 */
function engineStructuredElementIsSurelyBlocked(info, ledElement) {
    let division = ledElement.division;
    let unknownCounts = engineBuildUnknownValueCounts(info, division);

    // Check if every possible distribution of unknown cards forces at least one
    // follower to hold a blocking element. For simplified approach:
    // if total unknown copies at higher orders can form a blocker,
    // and there aren't enough non-follower slots to absorb them all, it's fake.

    let unknownBaseCapacity = (info.leader === game.pivot)
        ? 0
        : game.base.length - info.knownBaseCards.length;

    // Group unknown values by order
    let byOrder = new Map();
    for (let [key, count] of unknownCounts) {
        let parts = key.split('|');
        let suit = parseInt(parts[0]), rank = parseInt(parts[1]);
        let sample = info.fullDeck.find(c => c.suit === suit && c.rank === rank && c.division === division);
        if (!sample || sample.order <= ledElement.order) continue;
        let o = sample.order;
        if (!byOrder.has(o)) byOrder.set(o, []);
        byOrder.get(o).push({ key, count });
    }

    // For a (copy, span) blocker, we need `span` consecutive orders
    // each with >= `copy` copies of some value.
    // Check if there exists a window of `span` consecutive higher orders
    // where the total copies forced into follower hands can form such a blocker.
    let higherOrders = [...byOrder.keys()].sort((a, b) => a - b);

    for (let startIdx = 0; startIdx <= higherOrders.length - ledElement.span; startIdx++) {
        // Check if higherOrders[startIdx..startIdx+span-1] are consecutive
        let consecutive = true;
        for (let j = 1; j < ledElement.span; j++) {
            if (higherOrders[startIdx + j] !== higherOrders[startIdx] + j) {
                consecutive = false;
                break;
            }
        }
        if (!consecutive) continue;

        // Check if each order in the window has a value with enough copies
        // that can't all be hidden in the base
        let windowBlocks = true;
        for (let j = 0; j < ledElement.span; j++) {
            let o = higherOrders[startIdx + j];
            let values = byOrder.get(o);
            let anyValueForced = false;
            for (let v of values) {
                // If more copies than base can absorb, at least some go to followers
                if (v.count > unknownBaseCapacity) {
                    // At least (count - baseCapacity) copies forced into followers
                    let forced = v.count - unknownBaseCapacity;
                    if (forced >= ledElement.copy) {
                        anyValueForced = true;
                        break;
                    }
                }
            }
            if (!anyValueForced) { windowBlocks = false; break; }
        }

        if (windowBlocks) return true;
    }

    return false;
}

// ---------------------------------------------------------------------------
// Forehand control helpers
// ---------------------------------------------------------------------------

function countMarkedCards(cards, forehandControl) {
    if (!forehandControl || forehandControl.mode === 'none') return 0;
    let selectedIds = new Set(forehandControl.selectedCards.map(c => c.cardId));
    let total = 0;
    for (let card of cards) {
        if (selectedIds.has(card.cardId)) total++;
    }
    return total;
}

function filterCandidatesByForehandControl(candidates, forehandControl) {
    if (!forehandControl || forehandControl.mode === 'none') return candidates;
    if (candidates.length === 0) return candidates;
    let scored = candidates.map(c => ({
        candidate: c,
        overlap: countMarkedCards(c.cards, forehandControl)
    }));
    let target = forehandControl.mode === 'must-play'
        ? Math.max(...scored.map(s => s.overlap))
        : Math.min(...scored.map(s => s.overlap));
    return scored.filter(s => s.overlap === target).map(s => s.candidate);
}

function computeLegalMarkedCountInFillers(poolCards, fillerCount, forehandControl) {
    if (fillerCount < 0 || fillerCount > poolCards.length) return null;
    if (!forehandControl || forehandControl.mode === 'none') return null;
    let markedInPool = countMarkedCards(poolCards, forehandControl);
    let unmarkedInPool = poolCards.length - markedInPool;
    if (forehandControl.mode === 'must-play') {
        return Math.min(fillerCount, markedInPool);
    }
    if (forehandControl.mode === 'must-hold') {
        return Math.max(0, fillerCount - unmarkedInPool);
    }
    return null;
}

// ---------------------------------------------------------------------------
// Exposed card / forehand control chance management
// ---------------------------------------------------------------------------

/**
 * Register a failed multiplay: store FailedMultiplayState, update ExposedCardState,
 * increment ForehandControlChanceState.
 */
function engineRegisterFailedMultiplay(failer, intendedLead, actualElement, allBlockerSeats, actualBlocker, revokedCards) {
    // Group revoked cards by division
    let byDiv = {};
    for (let card of revokedCards) {
        let div = card.division;
        if (!byDiv[div]) byDiv[div] = [];
        byDiv[div].push(card);
    }

    // FailedMultiplayState
    game.failedMultiplay = {
        failer: failer,
        intendedLead: intendedLead,
        actualElement: actualElement,
        blockers: allBlockerSeats,
        actualBlocker: actualBlocker,
        revokedCards: revokedCards,
        exposedCards: byDiv,
        holdInProgress: false,
        revocationApplied: false
    };

    // Update ExposedCardState
    if (!game.exposedCards[failer]) game.exposedCards[failer] = {};
    for (let card of revokedCards) {
        let div = card.division;
        if (!game.exposedCards[failer][div]) game.exposedCards[failer][div] = [];
        // Avoid duplicates by cardId
        if (!game.exposedCards[failer][div].some(c => c.cardId === card.cardId)) {
            game.exposedCards[failer][div].push(card);
        }
    }

    // Increment ForehandControlChanceState
    let forehand = (failer + NUM_PLAYERS - 1) % NUM_PLAYERS;
    if (!game.fcChances[failer]) game.fcChances[failer] = { forehand: forehand, count: 0 };
    game.fcChances[failer].count++;
}

/**
 * Remove played cards from exposed state.
 * Called after any player plays cards to keep exposed state current.
 */
function engineDecayExposedCards(player, playedCards) {
    if (!game.exposedCards[player]) return;
    let playedIds = new Set(playedCards.map(c => c.cardId));
    for (let div in game.exposedCards[player]) {
        game.exposedCards[player][div] = game.exposedCards[player][div]
            .filter(c => !playedIds.has(c.cardId));
        if (game.exposedCards[player][div].length === 0) {
            delete game.exposedCards[player][div];
        }
    }
    if (Object.keys(game.exposedCards[player]).length === 0) {
        delete game.exposedCards[player];
    }
}

/**
 * Check if a forehand-control trigger should fire for a given player about to follow.
 * Returns { shouldTrigger, controller, exposedDivisionCards } or { shouldTrigger: false }.
 */
function engineCheckFCTrigger(failer) {
    if (!game.leadInfo) return { shouldTrigger: false };
    let ledDiv = game.leadInfo.division;

    // Condition 1: failer has exposed cards in the led division
    if (!game.exposedCards[failer] || !game.exposedCards[failer][ledDiv] ||
        game.exposedCards[failer][ledDiv].length === 0) {
        return { shouldTrigger: false };
    }

    // Condition 2: failer has remaining chances (ForehandControlChanceState)
    if (!game.fcChances[failer] || game.fcChances[failer].count <= 0) {
        return { shouldTrigger: false };
    }

    let controller = game.fcChances[failer].forehand;
    let exposedDivisionCards = [...game.exposedCards[failer][ledDiv]];

    // Activate ForehandControlPendingTriggerState
    game.fcPending = {
        forehand: controller,
        failer: failer,
        ledDivision: ledDiv,
        exposedDivisionCards: exposedDivisionCards,
        active: true,
        chanceConsuming: true
    };

    return {
        shouldTrigger: true,
        controller: controller,
        exposedDivisionCards: exposedDivisionCards
    };
}

/**
 * Exercise a forehand-control chance: consume one chance, commit FC constraint,
 * deactivate ForehandControlPendingTriggerState.
 * mode: 'must-play' or 'must-hold'
 * selectedCards: subset of exposed cards in the led division (may be empty).
 */
function engineExerciseFC(failer, mode, selectedCards) {
    // Consume one chance from ForehandControlChanceState
    game.fcChances[failer].count--;
    if (game.fcChances[failer].count <= 0) {
        delete game.fcChances[failer];
    }

    // Create committed FC constraint (used by follow legality pipeline)
    game.forehandControl = {
        mode: mode,
        selectedCards: selectedCards || [],
        target: failer,
        controller: game.fcPending ? game.fcPending.forehand : (failer + NUM_PLAYERS - 1) % NUM_PLAYERS
    };

    // Deactivate ForehandControlPendingTriggerState
    game.fcPending = null;
}

// ---------------------------------------------------------------------------
// Potential element construction (pseudocode §5)
// ---------------------------------------------------------------------------

/**
 * Group cards by order, then by value (suit|rank).
 * Returns Map<order, Map<valueKey, Card[]>>.
 */
function engineGroupByOrderThenValue(cards) {
    let result = new Map();
    for (let card of cards) {
        let o = card.order;
        if (!result.has(o)) result.set(o, new Map());
        let key = card.suit + '|' + card.rank;
        let bucket = result.get(o);
        if (!bucket.has(key)) bucket.set(key, []);
        bucket.get(key).push(card);
    }
    return result;
}

/**
 * Find all potential elements of a given (copy, span) in a set of same-division cards.
 * Precondition: all cards are in the same division.
 * Duplicate counting is by value (suit, rank), not by (division, order).
 * Returns array of element objects { cards, copy, span, order, division }.
 */
function engineFindPotentialElements(cards, copy, span) {
    if (cards.length === 0) return [];
    let division = cards[0].division;
    let grouped = engineGroupByOrderThenValue(cards);
    let orders = [...grouped.keys()].sort((a, b) => b - a); // descending
    let result = [];

    for (let highestOrder of orders) {
        let ordersNeeded = [];
        for (let i = 0; i < span; i++) ordersNeeded.push(highestOrder - i);

        let valid = true;
        let candidateBucketsByOrder = [];

        for (let o of ordersNeeded) {
            if (!grouped.has(o)) { valid = false; break; }
            let validBuckets = [];
            for (let [, bucket] of grouped.get(o)) {
                if (bucket.length >= copy) validBuckets.push(bucket);
            }
            if (validBuckets.length === 0) { valid = false; break; }
            candidateBucketsByOrder.push(validBuckets);
        }

        if (!valid) continue;

        // Cartesian product of bucket choices across orders
        let combos = [[]];
        for (let buckets of candidateBucketsByOrder) {
            let next = [];
            for (let combo of combos) {
                for (let bucket of buckets) {
                    next.push([...combo, bucket]);
                }
            }
            combos = next;
        }

        for (let bucketChoice of combos) {
            let chosenCards = [];
            for (let bucket of bucketChoice) {
                let sorted = [...bucket].sort((a, b) => a.cardId - b.cardId);
                for (let i = 0; i < copy; i++) chosenCards.push(sorted[i]);
            }
            result.push({
                cards: chosenCards,
                division: division,
                copy: copy,
                span: span,
                order: highestOrder
            });
        }
    }
    return result;
}

/**
 * Compute the maximum possible span for elements of a given copy count.
 */
function engineMaxPossibleSpan(cards, copy) {
    let grouped = engineGroupByOrderThenValue(cards);
    let validOrders = new Set();
    for (let [o, valueMap] of grouped) {
        for (let [, bucket] of valueMap) {
            if (bucket.length >= copy) { validOrders.add(o); break; }
        }
    }
    if (validOrders.size === 0) return 0;
    let sorted = [...validOrders].sort((a, b) => a - b);
    let maxSpan = 1, current = 1;
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === sorted[i - 1] + 1) { current++; if (current > maxSpan) maxSpan = current; }
        else current = 1;
    }
    return maxSpan;
}

// ---------------------------------------------------------------------------
// SFP — Structural Follow Procedure (pseudocode §9)
// ---------------------------------------------------------------------------

/**
 * Enumerate all valid SFP outcomes for following one led non-single element.
 * Returns array of arrays of elements (each array is one valid SFP outcome).
 * Forehand control is applied at each recursion layer.
 */
function engineEnumerateSFP(cards, copyBound, residualSpan, forehandControl) {
    if (residualSpan <= 0) return [[]];

    for (let k = copyBound; k >= 2; k--) {
        for (let j = residualSpan; j >= 1; j--) {
            let candidates = engineFindPotentialElements(cards, k, j);
            if (candidates.length === 0) continue;

            // Apply forehand control filter
            candidates = filterCandidatesByForehandControl(candidates, forehandControl);

            let outcomes = [];
            for (let candidate of candidates) {
                let remainingCards = cards.filter(c =>
                    !candidate.cards.some(cc => cc.cardId === c.cardId));
                let suffixes = engineEnumerateSFP(remainingCards, k, residualSpan - j, forehandControl);
                for (let suffix of suffixes) {
                    outcomes.push([candidate, ...suffix]);
                }
            }
            return outcomes; // first (k,j) found → don't search lower
        }
    }
    return [[]]; // no structured obligation possible
}

// ---------------------------------------------------------------------------
// DFP — Division Follow Procedure (pseudocode §10)
// ---------------------------------------------------------------------------

/**
 * Remove cards by cardId from a card array.
 */
function engineRemoveCards(cards, toRemove) {
    let ids = new Set(toRemove.map(c => c.cardId));
    return cards.filter(c => !ids.has(c.cardId));
}

/**
 * Flatten element arrays into a single card array.
 */
function engineUnionOfElementCards(elements) {
    let result = [];
    for (let el of elements) result.push(...el.cards);
    return result;
}

/**
 * Enumerate all DFP outcomes for following a lead.
 * Returns array of DFPOutcome objects.
 */
function engineEnumerateDFPOutcomes(handCards, leadInfo, forehandControl) {
    let ledDivision = leadInfo.division;
    let leadVolume = leadInfo.volume;
    let divisionCards = handCards.filter(c => c.division === ledDivision);

    // Short-division case
    if (divisionCards.length <= leadVolume) {
        let fillerCount = leadVolume - divisionCards.length;
        let fillerPool = handCards.filter(c => c.division !== ledDivision);
        let legalMarkedCount = computeLegalMarkedCountInFillers(fillerPool, fillerCount, forehandControl);

        return [{
            structuredCards: [],
            fillerPool: fillerPool,
            fillerCount: fillerCount,
            legalMarkedCountInFillers: legalMarkedCount,
            forcedDivisionCards: divisionCards,
            shortDivisionCase: true
        }];
    }

    // Non-short-division: process each led element through SFP
    let resolvedLead = leadInfo.elements;
    let states = [{ remainingHand: handCards, structuredPart: [] }];

    for (let ledElement of resolvedLead) {
        let nextStates = [];

        for (let state of states) {
            if (ledElement.copy === 1) {
                // Singles contribute no SFP output
                nextStates.push(state);
            } else {
                let divCardsNow = state.remainingHand.filter(c => c.division === ledElement.division);
                let sfpOutcomes = engineEnumerateSFP(
                    divCardsNow,
                    ledElement.copy,
                    ledElement.span,
                    forehandControl
                );

                for (let sfpOutcome of sfpOutcomes) {
                    let usedCards = engineUnionOfElementCards(sfpOutcome);
                    let newRemaining = engineRemoveCards(state.remainingHand, usedCards);
                    nextStates.push({
                        remainingHand: newRemaining,
                        structuredPart: [...state.structuredPart, ...sfpOutcome]
                    });
                }
            }
        }
        states = nextStates;
    }

    let outcomes = [];
    for (let state of states) {
        let structuredCards = engineUnionOfElementCards(state.structuredPart);
        let fillerCount = leadVolume - structuredCards.length;
        let fillerPool = state.remainingHand.filter(c => c.division === ledDivision);
        let legalMarkedCount = computeLegalMarkedCountInFillers(fillerPool, fillerCount, forehandControl);

        outcomes.push({
            structuredCards: structuredCards,
            fillerPool: fillerPool,
            fillerCount: fillerCount,
            legalMarkedCountInFillers: legalMarkedCount,
            forcedDivisionCards: [],
            shortDivisionCase: false
        });
    }

    return outcomes;
}

// ---------------------------------------------------------------------------
// Follow legality (pseudocode §10c — full existential check)
// ---------------------------------------------------------------------------

/**
 * Check if a set of cards contains all cards from another set (by cardId).
 */
function engineContainsAllCards(bigSet, smallSet) {
    let bigIds = new Map();
    for (let c of bigSet) bigIds.set(c.cardId, (bigIds.get(c.cardId) || 0) + 1);
    for (let c of smallSet) {
        let count = bigIds.get(c.cardId) || 0;
        if (count <= 0) return false;
        bigIds.set(c.cardId, count - 1);
    }
    return true;
}

function engineIsLegalFollow(hand, leadInfo, selectedCards, forehandControl) {
    if (selectedCards.length !== leadInfo.volume)
        return { valid: false, error: t('errors.followCount', { volume: leadInfo.volume }) };

    let handIds = new Set(hand.map(c => c.cardId));
    if (!selectedCards.every(c => handIds.has(c.cardId)))
        return { valid: false, error: t('errors.cardNotInHand') };

    let outcomes = engineEnumerateDFPOutcomes(hand, leadInfo, forehandControl);

    for (let outcome of outcomes) {
        if (outcome.shortDivisionCase) {
            // Must contain all forced division cards
            if (!engineContainsAllCards(selectedCards, outcome.forcedDivisionCards)) continue;

            let fillerCards = engineRemoveCards(selectedCards, outcome.forcedDivisionCards);
            if (fillerCards.length !== outcome.fillerCount) continue;
            if (!engineContainsAllCards(outcome.fillerPool, fillerCards)) continue;

            // Forehand control on fillers
            if (outcome.legalMarkedCountInFillers !== null) {
                if (countMarkedCards(fillerCards, forehandControl) !== outcome.legalMarkedCountInFillers) continue;
            }
            return { valid: true };
        } else {
            // Must contain all structured cards
            if (!engineContainsAllCards(selectedCards, outcome.structuredCards)) continue;

            let fillerCards = engineRemoveCards(selectedCards, outcome.structuredCards);
            if (fillerCards.length !== outcome.fillerCount) continue;

            // All filler cards must be in the led division
            if (fillerCards.some(c => c.division !== leadInfo.division)) continue;

            // Filler cards must come from the filler pool
            if (!engineContainsAllCards(outcome.fillerPool, fillerCards)) continue;

            // Forehand control on fillers
            if (outcome.legalMarkedCountInFillers !== null) {
                if (countMarkedCards(fillerCards, forehandControl) !== outcome.legalMarkedCountInFillers) continue;
            }
            return { valid: true };
        }
    }

    // No valid DFP outcome matched — determine a useful error message
    let divCardsOnHand = hand.filter(c => c.division === leadInfo.division);
    let selectedDivCards = selectedCards.filter(c => c.division === leadInfo.division);

    if (divCardsOnHand.length <= leadInfo.volume) {
        if (selectedDivCards.length !== divCardsOnHand.length) {
            return { valid: false, error: t('errors.mustPlayAllShort') };
        }
        return { valid: false, error: t('errors.forehandControlFillers') };
    }
    if (selectedDivCards.length !== leadInfo.volume) {
        return { valid: false, error: t('errors.mustFollowDivision') };
    }
    // Structural obligation not met
    return { valid: false, error: t('errors.mustFollowStructure') };
}

// ---------------------------------------------------------------------------
// Round winner
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Potential ruff — best admissible core search (pseudocode §13f–§13i)
// ---------------------------------------------------------------------------

/**
 * Build a multiset (Map) of type keys from an array of elements.
 */
function engineMultisetOfTypes(elements) {
    let m = new Map();
    for (let e of elements) {
        let key = e.copy + ',' + e.span;
        m.set(key, (m.get(key) || 0) + 1);
    }
    return m;
}

/**
 * Remove one occurrence of a type from a type multiset. Returns a new Map.
 */
function engineRemoveOneType(typeMultiset, copy, span) {
    let key = copy + ',' + span;
    let m = new Map(typeMultiset);
    let count = m.get(key) || 0;
    if (count <= 1) m.delete(key);
    else m.set(key, count - 1);
    return m;
}

/**
 * Choose the highest type from a type multiset.
 */
function engineChooseHighestType(typeMultiset) {
    let best = null;
    for (let [key] of typeMultiset) {
        let parts = key.split(',');
        let c = parseInt(parts[0]), s = parseInt(parts[1]);
        if (!best || c > best.copy || (c === best.copy && s > best.span)) {
            best = { copy: c, span: s };
        }
    }
    return best;
}

/**
 * Backtrack to check if trumpCards can be decomposed to match the required type multiset.
 */
function engineBacktrackPotentialRuff(remainingCards, remainingTypes) {
    if (remainingCards.length === 0 && remainingTypes.size === 0) return true;
    if (remainingCards.length === 0 || remainingTypes.size === 0) return false;

    let nextType = engineChooseHighestType(remainingTypes);
    let candidates = engineFindPotentialElements(remainingCards, nextType.copy, nextType.span);

    for (let candidate of candidates) {
        let newCards = engineRemoveCards(remainingCards, candidate.cards);
        let newTypes = engineRemoveOneType(remainingTypes, nextType.copy, nextType.span);
        if (engineBacktrackPotentialRuff(newCards, newTypes)) return true;
    }
    return false;
}

/**
 * Find the best possible potential-ruff core element in trump cards.
 * Searches all possible core elements and checks if the remaining cards
 * can fill the rest of the lead type multiset.
 *
 * Returns the best core element, or null if no valid ruff exists.
 */
function engineFindBestPotentialRuffCore(leadTypeMultiset, trumpCards) {
    // Enumerate all possible core elements (highest type first)
    let maxCopy = 1;
    let grouped = engineGroupByOrderThenValue(trumpCards);
    for (let [, valueMap] of grouped) {
        for (let [, bucket] of valueMap) {
            if (bucket.length > maxCopy) maxCopy = bucket.length;
        }
    }

    let possibleCores = [];
    let seen = new Set();
    for (let copy = maxCopy; copy >= 1; copy--) {
        let maxSpan = engineMaxPossibleSpan(trumpCards, copy);
        for (let span = maxSpan; span >= 1; span--) {
            let candidates = engineFindPotentialElements(trumpCards, copy, span);
            for (let c of candidates) {
                let key = copy + ',' + span + ',' + c.order;
                if (!seen.has(key)) {
                    seen.add(key);
                    possibleCores.push(c);
                }
            }
        }
    }

    // Sort by core priority descending: copy desc, span desc, order desc
    possibleCores.sort((a, b) => {
        if (a.copy !== b.copy) return b.copy - a.copy;
        if (a.span !== b.span) return b.span - a.span;
        return b.order - a.order;
    });

    for (let core of possibleCores) {
        let remaining = engineRemoveCards(trumpCards, core.cards);
        let remainingTypes = engineRemoveOneType(leadTypeMultiset, core.copy, core.span);
        if (engineBacktrackPotentialRuff(remaining, remainingTypes)) {
            return core;
        }
    }

    return null;
}

// ---------------------------------------------------------------------------
// Incremental round state tracking (pseudocode §13b–§13e)
// ---------------------------------------------------------------------------

/**
 * Initialize round state when the leader plays (§13b).
 */
function engineInitializeRoundState(leader, leadInfo) {
    let isOneElement = leadInfo.elements.length === 1;
    let coreElement = leadInfo.coreElement;

    game.roundState = {
        leadCards: game.roundPlayed[leader],
        leadDivision: leadInfo.division,
        resolvedLead: leadInfo.elements,
        leadType: engineMultisetOfTypes(leadInfo.elements),
        leadIsOneElement: isOneElement,
        leadCoreElement: coreElement,
        ruffed: false,
        highestPlayer: leader,
        highestOrder: isOneElement ? coreElement.order : null
    };
}

/**
 * Classify a legal follow for cover checking (§13c).
 * Returns { kind: 'DISCARD'|'DIVISION_FOLLOW'|'POTENTIAL_RUFF', orderKey }
 */
function engineClassifyFollowForCover(roundState, followCards) {
    let divSet = new Set(followCards.map(c => c.division));
    let trumpDiv = 4;

    // Mixed divisions including lead division → discard
    if (divSet.has(roundState.leadDivision) && divSet.size > 1) {
        return { kind: 'DISCARD', orderKey: null };
    }

    // All same division as lead
    if (divSet.size === 1 && followCards[0].division === roundState.leadDivision) {
        if (roundState.leadIsOneElement) {
            let followInfo = engineResolveLead(followCards);
            if (followInfo && followInfo.elements.length === 1) {
                let followEl = followInfo.elements[0];
                let leadEl = roundState.resolvedLead[0];
                if (followEl.copy === leadEl.copy && followEl.span === leadEl.span) {
                    return { kind: 'DIVISION_FOLLOW', orderKey: followEl.order };
                }
            }
            // Same division but different type → cannot cover
            return { kind: 'DISCARD', orderKey: null };
        } else {
            // Multiplay division follows can't cover individually
            return { kind: 'DIVISION_FOLLOW', orderKey: null };
        }
    }

    // Trump lead → non-lead-division follow is discard
    if (roundState.leadDivision === trumpDiv) {
        return { kind: 'DISCARD', orderKey: null };
    }

    // Check if all trump (potential ruff)
    for (let c of followCards) {
        if (c.division !== trumpDiv) {
            return { kind: 'DISCARD', orderKey: null };
        }
    }

    let bestCore = engineFindBestPotentialRuffCore(roundState.leadType, followCards);
    if (!bestCore) {
        return { kind: 'DISCARD', orderKey: null };
    }

    return { kind: 'POTENTIAL_RUFF', orderKey: bestCore.order };
}

/**
 * Update round state after an accepted follow (§13e).
 */
function engineUpdateRoundStateAfterFollow(player, acceptedFollow) {
    let rs = game.roundState;
    let followState = engineClassifyFollowForCover(rs, acceptedFollow);

    if (followState.kind === 'DISCARD') return;

    if (followState.kind === 'POTENTIAL_RUFF') {
        if (!rs.ruffed || followState.orderKey > rs.highestOrder) {
            rs.ruffed = true;
            rs.highestOrder = followState.orderKey;
            rs.highestPlayer = player;
        }
        return;
    }

    // DIVISION_FOLLOW
    if (rs.ruffed) return; // ruff beats all division follows
    if (!rs.leadIsOneElement) return; // multiplay: division follows can't cover

    if (followState.orderKey > rs.highestOrder) {
        rs.highestOrder = followState.orderKey;
        rs.highestPlayer = player;
    }
}

// ---------------------------------------------------------------------------
// Round winner (legacy scan — kept for verification)
// ---------------------------------------------------------------------------
function engineDetermineRoundWinner() {
    let leader   = game.currentLeader;
    let leadInfo = game.leadInfo;
    let leadDiv  = leadInfo.division;
    let leadTypeMultiset = engineMultisetOfTypes(leadInfo.elements);
    let leadIsOneElement = leadInfo.elements.length === 1;

    let bestPlayer = leader;
    let bestOrder  = leadInfo.coreElement.order;
    let bestIsRuff = false;

    for (let i = 1; i < NUM_PLAYERS; i++) {
        let player = (leader + i) % NUM_PLAYERS;
        let cards  = game.roundPlayed[player];
        if (!cards || cards.length === 0) continue;

        let isAllTrump    = cards.every(c => c.division === 4);
        let isAllDivision = cards.every(c => c.division === leadDiv);

        // 1. Classify follow
        let classification = 'discard';
        if (isAllDivision) {
            classification = 'division-follow';
        } else if (isAllTrump && leadDiv !== 4) {
            classification = 'potential-ruff';
        }

        if (classification === 'discard') continue;

        if (classification === 'potential-ruff') {
            // Use best admissible ruff core search (§13f)
            let bestCore = engineFindBestPotentialRuffCore(leadTypeMultiset, cards);
            if (!bestCore) continue; // non-covering ruff → discard

            let order = bestCore.order;

            if (!bestIsRuff) {
                bestPlayer = player;
                bestOrder  = order;
                bestIsRuff = true;
            } else if (order > bestOrder) {
                bestPlayer = player;
                bestOrder  = order;
            }
        } else {
            // Division follow
            if (bestIsRuff) continue; // ruff beats all division follows

            if (!leadIsOneElement) continue; // multiplay division follows can't cover

            // One-element round: only same-type can cover
            let followInfo = engineResolveLead(cards);
            if (!followInfo || followInfo.elements.length !== 1) continue;
            let followEl = followInfo.elements[0];
            let leadEl = leadInfo.elements[0];

            if (followEl.copy !== leadEl.copy || followEl.span !== leadEl.span) continue;

            let order = followEl.order;
            if (order > bestOrder) {
                bestPlayer = player;
                bestOrder  = order;
            }
        }
    }
    return bestPlayer;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
function engineGetCurrentPlayer() {
    return (game.currentLeader + game.currentTurnIndex) % NUM_PLAYERS;
}

function engineSetTeams() {
    game.defendingTeam = [game.pivot, (game.pivot + 2) % NUM_PLAYERS];
    game.attackingTeam = [];
    for (let i = 0; i < NUM_PLAYERS; i++) {
        if (!game.defendingTeam.includes(i)) game.attackingTeam.push(i);
    }
}

/**
 * Apply attacker-self-base half-multiplier rule.
 * Rule gate: only applies when attackers set the final base and config enables it.
 * Numeric semantics: preserve float (no integer forcing), lower bounded by 1.
 */
function engineApplyAttackersSelfBaseHalfMultiplier(baseMultiplier, cfg, attackersSetFinalBase) {
    if (cfg && cfg.attackersSelfBaseHalfMultiplier && attackersSetFinalBase) {
        return Math.max(1, baseMultiplier / 2);
    }
    return baseMultiplier;
}

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------

/** Start a new game — shuffles deck but does NOT deal.
 *  The page calls engineDealNextBatch() to animate dealing one round at a time.
 */
function engineStartGame(level, pivot, playerLevels, isQiangzhuang, resolvedRuleConfig) {
    game.phase          = GamePhase.DEALING;
    game.level          = level;
    game.strain         = -1;
    game.pivot          = pivot;
    game.frameScore     = 0;
    game.currentRound   = 0;
    game.roundHistory   = [];
    game.declarations   = [];
    game.dealIndex      = 0;
    game.roundState     = null;
    game.failedMultiplay = null;
    game.exposedCards   = {};
    game.fcChances      = {};
    game.fcPending      = null;
    game.forehandControl = null;
    game.isQiangzhuang  = (isQiangzhuang !== false); // true by default, false only for later frames

    // Per-player levels: use provided or initialize all to 0
    if (playerLevels) {
        game.playerLevels = [...playerLevels];
    } else {
        game.playerLevels = new Array(NUM_PLAYERS).fill(level);
    }

    // Keep level-rule clear-state across frames; reset only on a fresh game.
    if (!playerLevels || !game.levelRuleState) {
        game.levelRuleState = {
            cycleIndexBySide: [0, 0],
            mustDefendConsumedCycleBySide: [{}, {}],
            mustStopConsumedCycleBySide: [{}, {}],
            mustDefendStartMarkerConsumedBySide: [false, false],
            mustStopStartMarkerConsumedBySide: [false, false],
        };
    }

    // Apply authoritative resolved game-rule config (created before game start).
    if (resolvedRuleConfig) {
        game.gameConfig = { ...resolvedRuleConfig };
    } else if (!game.gameConfig) {
        game.gameConfig = engineBuildConfig('default');
    }

    game.deck  = engineCreateDeck(level, 4);
    engineShuffle(game.deck);

    game.hands = [[], [], [], []];
    game.base  = [];

    // Reset bank times from resolved timing config (note 34).
    let bank = engineGetTimingConfigValue('bankTime', TIMING_CONFIG.bankTime);
    game.playerBankTimes = new Array(NUM_PLAYERS).fill(bank);
}

/**
 * Deal one round (one card per player) during animated dealing.
 * Returns [{player, card}, …] for this batch, or null if already done.
 * After all 25 rounds (100 cards), silently assigns the 8 base cards,
 * sorts all hands, and transitions game.phase to DECLARING.
 */
function engineDealNextBatch() {
    if (game.phase !== GamePhase.DEALING) return null;
    const playerCardTotal = CARDS_PER_HAND * NUM_PLAYERS;
    if (game.dealIndex >= playerCardTotal) return null;

    let batch = [];
    for (let i = 0; i < NUM_PLAYERS; i++) {
        let card = game.deck[game.dealIndex];
        game.hands[i].push(card);
        batch.push({ player: i, card: card });
        game.dealIndex++;
    }

    if (game.dealIndex === playerCardTotal) {
        // Assign base cards silently
        for (let i = playerCardTotal; i < TOTAL_CARDS; i++) {
            game.base.push(game.deck[i]);
        }
        // Sort all hands (strain still −1; engineSortHand treats it as NTS)
        for (let h of game.hands) engineSortHand(h);
        game.phase = GamePhase.DECLARING;
    }

    return batch;
}

/** Set strain after declaration resolves */
function engineSetStrain(strain) {
    game.strain = strain;
    engineReassignAll(game.level, strain);
    for (let h of game.hands) engineSortHand(h);
}

/**
 * Check whether a declaration is the highest possible for the current deck count.
 * 2-deck: double W (count=4) is highest.  3-deck: triple W, etc.
 * Returns true if no higher declaration can exist.
 */
function engineIsHighestPossibleDeclaration(declaration) {
    if (!declaration) return false;
    let deckCount = (game.gameConfig && game.gameConfig.deckCount) || 2;
    // Highest possible = deckCount copies of big joker (suit=4, count=deckCount*2 for pairs? no)
    // In 2-deck: double W = count 4 (two big jokers). That's the max.
    // The count field: 1=single, 2=double suited, 3=double small joker, 4=double big joker
    // Highest possible is always count=4 (double W / big joker pair) regardless of deck count for now.
    return declaration.count >= 4;
}

/** Pivot picks up base */
function enginePickUpBase() {
    game.hands[game.pivot] = game.hands[game.pivot].concat(game.base);
    game.base = [];
    engineSortHand(game.hands[game.pivot]);
    game.phase = GamePhase.BASING;
}

/** Pivot sets base (discards BASE_SIZE cards). Returns true on success. */
function engineSetBase(selectedCards) {
    if (selectedCards.length !== BASE_SIZE) return false;
    let hand = game.hands[game.pivot];
    if (!selectedCards.every(c => hand.some(h => h.cardId === c.cardId))) return false;

    let ids = new Set(selectedCards.map(c => c.cardId));
    game.base = selectedCards;
    game.hands[game.pivot] = hand.filter(c => !ids.has(c.cardId));
    engineSortHand(game.hands[game.pivot]);

    engineSetTeams();
    game.currentLeader    = game.pivot;
    game.currentRound     = 1;
    game.currentTurnIndex = 0;
    game.roundPlayed      = [null, null, null, null];
    game.leadInfo         = null;
    game.phase            = GamePhase.PLAYING;
    return true;
}

/** Play cards for a player. Returns {success, roundComplete, error, failedMultiplay}. */
function enginePlayCards(player, cards) {
    if (game.phase !== GamePhase.PLAYING)
        return { success: false, error: t('errors.notPlayingPhase') };
    if (player !== engineGetCurrentPlayer())
        return { success: false, error: t('errors.notYourTurn') };

    let failedMultiplay = null;

    if (game.currentTurnIndex === 0) {
        let leadValid = engineIsLegalLead(player, cards);
        if (!leadValid.valid)
            return { success: false, error: leadValid.error };

        if (leadValid.failedMultiplay) {
            // Failed multiplay — resolve per the continuation protocol
            failedMultiplay = leadValid.failedMultiplay;
            let actual = failedMultiplay.actualElement;

            // The actual led element becomes the real lead
            let actualLeadInfo = engineResolveLead(actual.cards);
            game.leadInfo = actualLeadInfo;

            // Only the actual element cards are played; revoked cards stay in hand
            let actualCardIds = new Set(actual.cards.map(c => c.cardId));
            game.hands[player] = game.hands[player].filter(c => !actualCardIds.has(c.cardId));
            game.roundPlayed[player] = actual.cards;
        } else {
            // Normal lead (single element or surviving multiplay)
            game.leadInfo = engineResolveLead(cards);
            let playedIds = new Set(cards.map(c => c.cardId));
            game.hands[player] = game.hands[player].filter(c => !playedIds.has(c.cardId));
            game.roundPlayed[player] = cards;
        }
        // Initialize incremental round state tracking
        engineInitializeRoundState(player, game.leadInfo);

        // Decay exposed cards for the leader (cards they just played)
        engineDecayExposedCards(player, game.roundPlayed[player]);

        if (leadValid.failedMultiplay) {
            // Register FailedMultiplayState, ExposedCardState, ForehandControlChanceState
            engineRegisterFailedMultiplay(
                player, cards, failedMultiplay.actualElement,
                failedMultiplay.allBlockerSeats, failedMultiplay.blockerSeat,
                failedMultiplay.revokedCards
            );
        }
    } else {
        // Build the active forehand control for this follow
        let fc = game.forehandControl;
        if (fc && fc.target !== player) fc = null;

        let followValid = engineIsLegalFollow(game.hands[player], game.leadInfo, cards, fc);
        if (!followValid.valid)
            return { success: false, error: followValid.error };

        let playedIds = new Set(cards.map(c => c.cardId));
        game.hands[player] = game.hands[player].filter(c => !playedIds.has(c.cardId));
        game.roundPlayed[player] = cards;

        // Update incremental round state after accepted follow
        engineUpdateRoundStateAfterFollow(player, cards);

        // Decay exposed cards for this player
        engineDecayExposedCards(player, cards);

        // Clear active FC after the target follows (one-shot per exercise)
        if (fc) {
            game.forehandControl = null;
        }
    }

    game.currentTurnIndex++;

    return {
        success: true,
        roundComplete: game.currentTurnIndex >= NUM_PLAYERS,
        failedMultiplay: failedMultiplay
    };
}

/** End the current round. Returns {winner, trickPoints, gameOver}. */
function engineEndRound() {
    // Use incremental round state if available, otherwise fall back to legacy scan
    let winner = game.roundState ? game.roundState.highestPlayer : engineDetermineRoundWinner();
    let trickPoints = 0;
    for (let i = 0; i < NUM_PLAYERS; i++) {
        if (game.roundPlayed[i]) trickPoints += engineCountScore(game.roundPlayed[i]);
    }
    if (game.attackingTeam.includes(winner)) game.frameScore += trickPoints;

    game.roundHistory.push({
        round:  game.currentRound,
        leader: game.currentLeader,
        played: [...game.roundPlayed],
        winner: winner,
        trickPoints: trickPoints
    });

    game.currentRound++;
    // Game ends when all hands are empty (not a fixed round count, since
    // pair/tractor/multiplay leads consume more than 1 card per trick)
    let allHandsEmpty = game.hands.every(h => h.length === 0);
    if (allHandsEmpty) {
        game.phase = GamePhase.COUNTING;
        return { winner, trickPoints, gameOver: true };
    }

    game.currentLeader    = winner;
    game.currentTurnIndex = 0;
    game.roundPlayed      = [null, null, null, null];
    game.leadInfo         = null;
    game.roundState       = null;
    return { winner, trickPoints, gameOver: false };
}

/** Counting phase — finalize score. */
function engineFinalize() {
    let lastRound = game.roundHistory[game.roundHistory.length - 1];
    let attackersWonBase = !!(lastRound && game.attackingTeam.includes(lastRound.winner));
    let attackersSetFinalBase = !!(game.attackingTeam && game.attackingTeam.includes(game.pivot));
    let counterScore = game.frameScore;
    let baseScore = 0;
    let baseMultiplier = 1;
    let endingCompensation = 0;
    let multiplayCompensation = 0;
    let finalScore = counterScore;

    if (attackersWonBase) {
        // Attackers win last round: calculate base multiplier per §11.3
        let lastPlayed = lastRound.played[lastRound.winner];
        let decomp = engineResolveLead(lastPlayed);
        let coreEl = (decomp && decomp.elements && decomp.elements.length > 0) ? decomp.elements[0] : null;

        let scheme = (game.gameConfig && game.gameConfig.baseMultiplierScheme) || 'limited';
        let copy = (coreEl && coreEl.copy) ? coreEl.copy : 1;
        let span = (coreEl && coreEl.span) ? coreEl.span : 1;

        if (scheme === 'limited') {
            // single→2, pair→4, any higher type→8
            if (!coreEl || copy === 1) {
                baseMultiplier = 2;
            } else if (copy === 2 && span === 1) {
                baseMultiplier = 4;
            } else {
                baseMultiplier = 8;
            }
        } else if (scheme === 'single-or-not') {
            // single→2, any non-single structure→4
            baseMultiplier = (coreEl && copy >= 2) ? 4 : 2;
        } else if (scheme === 'exponential') {
            // 2^(copy + span - 1)
            baseMultiplier = Math.pow(2, copy + span - 1);
        } else if (scheme === 'power') {
            // 2 * copy^span
            baseMultiplier = 2 * Math.pow(copy, span);
        } else {
            // Fallback: same as limited
            baseMultiplier = (!coreEl || copy === 1) ? 2 : (copy === 2 && span === 1) ? 4 : 8;
        }

        // Apply optional limit cap
        let multiplierLimit = (game.gameConfig && game.gameConfig.baseMultiplierLimit);
        if (multiplierLimit !== undefined && multiplierLimit !== null && multiplierLimit !== Infinity) {
            let cap = Math.pow(2, multiplierLimit);
            if (baseMultiplier > cap) baseMultiplier = cap;
        }

        // Attackers' self-base half multiplier (gated + float-preserving)
        baseMultiplier = engineApplyAttackersSelfBaseHalfMultiplier(baseMultiplier, game.gameConfig, attackersSetFinalBase);

        baseScore = engineCountScore(game.base) * baseMultiplier;
        finalScore += baseScore;
    }

    game.phase = GamePhase.GAME_OVER;

    // Compute ending compensation in canonical frame-score unit.
    // Note 36c: ending compensation = ending length * authoritative base multiplier / 2.
    if (game.gameConfig && game.gameConfig.endingCompensation) {
        let endingLength = 0;
        for (let i = game.roundHistory.length - 1; i >= 0; i--) {
            if (game.attackingTeam.includes(game.roundHistory[i].winner)) {
                endingLength++;
            } else {
                break;
            }
        }
        if (endingLength > 0) {
            endingCompensation = endingLength * (baseMultiplier / 2);
            finalScore += endingCompensation;
        }
    }

    // Keep authoritative total on game state in sync with finalized settlement.
    game.frameScore = finalScore;

    // Compute frame result (§12) — after all score components including ending compensation
    let frameResult = engineComputeFrameResult(finalScore);

    let scoreBreakdown = {
        counterScore,
        baseScore,
        endingCompensation,
        multiplayCompensation,
        totalScore: finalScore,
    };

    return {
        totalScore: finalScore,
        counterScore,
        baseScore,
        baseMultiplier,
        endingCompensation,
        multiplayCompensation,
        scoreBreakdown,
        endingCompensationActive: !!(game.gameConfig && game.gameConfig.endingCompensation),
        multiplayCompensationActive: !!(game.gameConfig && game.gameConfig.multiplayCompensation),
        result: t('results.' + frameResult.resultKey, { n: frameResult.levelDelta }),
        frameResult: frameResult
    };
}

/**
 * Detect if knock-back was triggered: attackers won the last round AND all cards in that round are levelers.
 * Levelers are cards with rank === game.level.
 * Returns true if knock-back condition is met, false otherwise.
 */
function engineIsKnockbackTriggered(frameResult) {
    if (!game.roundHistory || game.roundHistory.length === 0) return false;
    let kbLevels = (game.gameConfig && Array.isArray(game.gameConfig.knockBackLevels)) ? game.gameConfig.knockBackLevels : [];
    if (!kbLevels.includes(game.level)) return false;
    let lastRound = game.roundHistory[game.roundHistory.length - 1];
    
    // Knock-back triggered only if attackers won the last round
    if (!game.attackingTeam.includes(lastRound.winner)) return false;
    
    // Optional gate: when enabled, knock-back only applies if attackers took stage.
    if (game.gameConfig && game.gameConfig.knockBackTakeStageRequired) {
        let projected = frameResult || engineComputeFrameResult(game.frameScore);
        if (projected.defenseHolds) return false;
    }

    let winningCards = lastRound.played[lastRound.winner] || [];
    let mode = (game.gameConfig && game.gameConfig.knockBackConditionMode) ? game.gameConfig.knockBackConditionMode : 'unlimited';
    return engineDoesWinningHandCoreMatchKnockBackCondition(winningCards, mode);
}

function engineGetConfiguredStartLevel() {
    return (game.gameConfig && game.gameConfig.startLevel !== undefined && game.gameConfig.startLevel !== null)
        ? game.gameConfig.startLevel
        : 0;
}

function engineLevelToCycleOffset(level, startLevel) {
    return ((level - startLevel) % 13 + 13) % 13;
}

function engineCycleOffsetToLevel(offset, startLevel) {
    return ((startLevel + offset) % 13 + 13) % 13;
}

function engineGetSideIndexForPlayer(player) {
    // South/North -> 0 (even seats), East/West -> 1 (odd seats)
    return ((player % 2) + 2) % 2;
}

function engineGetPlayersForSide(sideIndex) {
    return sideIndex === 0 ? [0, 2] : [1, 3];
}

function engineCanonicalizeSideLevels(levels) {
    let out = [...levels];
    let ns = out[0];
    let ew = out[1];
    out[2] = ns;
    out[3] = ew;
    return out;
}

function engineGetPlayerCycleIndex(player) {
    let side = engineGetSideIndexForPlayer(player);
    let state = game.levelRuleState || {};
    let arr = state.cycleIndexBySide || [];
    return Number.isInteger(arr[side]) ? arr[side] : 0;
}

function engineSetPlayerCycleIndex(player, cycleIndex) {
    let side = engineGetSideIndexForPlayer(player);
    if (!game.levelRuleState) return;
    if (!Array.isArray(game.levelRuleState.cycleIndexBySide)) {
        game.levelRuleState.cycleIndexBySide = [0, 0];
    }
    game.levelRuleState.cycleIndexBySide[side] = cycleIndex;
}

function engineMarkMustDefendConsumed(player, level, cycleIndex) {
    let side = engineGetSideIndexForPlayer(player);
    if (!game.levelRuleState.mustDefendConsumedCycleBySide) {
        game.levelRuleState.mustDefendConsumedCycleBySide = [{}, {}];
    }
    let store = game.levelRuleState.mustDefendConsumedCycleBySide[side] || {};
    store[level] = cycleIndex;
    game.levelRuleState.mustDefendConsumedCycleBySide[side] = store;
}

function engineMarkMustStopConsumed(player, level, cycleIndex) {
    let side = engineGetSideIndexForPlayer(player);
    if (!game.levelRuleState.mustStopConsumedCycleBySide) {
        game.levelRuleState.mustStopConsumedCycleBySide = [{}, {}];
    }
    let store = game.levelRuleState.mustStopConsumedCycleBySide[side] || {};
    store[level] = cycleIndex;
    game.levelRuleState.mustStopConsumedCycleBySide[side] = store;
}

function engineHasConsumedMustDefend(player, level, cycleIndex) {
    let side = engineGetSideIndexForPlayer(player);
    let store = (game.levelRuleState.mustDefendConsumedCycleBySide || [])[side] || {};
    return store[level] === cycleIndex;
}

function engineHasConsumedMustStop(player, level, cycleIndex) {
    let side = engineGetSideIndexForPlayer(player);
    let store = (game.levelRuleState.mustStopConsumedCycleBySide || [])[side] || {};
    return store[level] === cycleIndex;
}

function engineHasConsumedMustDefendStartMarker(player) {
    let side = engineGetSideIndexForPlayer(player);
    let arr = game.levelRuleState.mustDefendStartMarkerConsumedBySide || [];
    return !!arr[side];
}

function engineHasConsumedMustStopStartMarker(player) {
    let side = engineGetSideIndexForPlayer(player);
    let arr = game.levelRuleState.mustStopStartMarkerConsumedBySide || [];
    return !!arr[side];
}

function engineMarkMustDefendStartMarkerConsumed(player) {
    let side = engineGetSideIndexForPlayer(player);
    if (!game.levelRuleState) return;
    if (!Array.isArray(game.levelRuleState.mustDefendStartMarkerConsumedBySide)) {
        game.levelRuleState.mustDefendStartMarkerConsumedBySide = [false, false];
    }
    game.levelRuleState.mustDefendStartMarkerConsumedBySide[side] = true;
}

function engineMarkMustStopStartMarkerConsumed(player) {
    let side = engineGetSideIndexForPlayer(player);
    if (!game.levelRuleState) return;
    if (!Array.isArray(game.levelRuleState.mustStopStartMarkerConsumedBySide)) {
        game.levelRuleState.mustStopStartMarkerConsumedBySide = [false, false];
    }
    game.levelRuleState.mustStopStartMarkerConsumedBySide[side] = true;
}

function engineGetCycleAwareAbsoluteLevel(player, level) {
    let startLevel = engineGetConfiguredStartLevel();
    let cycleIndex = engineGetPlayerCycleIndex(player);
    return cycleIndex * 13 + engineLevelToCycleOffset(level, startLevel);
}

function engineGetBlockingOccurrenceForPlayerInCycle(player, level, cycleIndex) {
    let cfg = game.gameConfig || {};
    let startLevel = engineGetConfiguredStartLevel();
    let mustStopLevels = Array.isArray(cfg.mustStopLevels) ? cfg.mustStopLevels : [];
    let mustDefendLevels = Array.isArray(cfg.mustDefendLevels) ? cfg.mustDefendLevels : [];
    let mustStopStartMarker = !!cfg.mustStopStartMarker;
    let mustDefendStartMarker = !!cfg.mustDefendStartMarker;

    let stopStartBlocked = mustStopStartMarker
        && cycleIndex === 0
        && level === startLevel
        && !engineHasConsumedMustStopStartMarker(player);
    if (stopStartBlocked) {
        return { markType: 'must-stop-start-marker', level, cycleIndex, semanticStart: true };
    }

    let defendStartBlocked = mustDefendStartMarker
        && cycleIndex === 0
        && level === startLevel
        && !engineHasConsumedMustDefendStartMarker(player);
    if (defendStartBlocked) {
        return { markType: 'must-defend-start-marker', level, cycleIndex, semanticStart: true };
    }

    let stopBlocked = mustStopLevels.includes(level) && !engineHasConsumedMustStop(player, level, cycleIndex);
    if (stopBlocked) {
        return { markType: 'must-stop-level', level, cycleIndex, semanticStart: false };
    }

    let defendBlocked = mustDefendLevels.includes(level) && !engineHasConsumedMustDefend(player, level, cycleIndex);
    if (defendBlocked) {
        return { markType: 'must-defend-level', level, cycleIndex, semanticStart: false };
    }

    return null;
}

function engineConsumeBlockingOccurrenceForPlayer(player, occurrence) {
    if (!occurrence) return;
    if (occurrence.markType === 'must-stop-start-marker') {
        engineMarkMustStopStartMarkerConsumed(player);
    } else if (occurrence.markType === 'must-defend-start-marker') {
        engineMarkMustDefendStartMarkerConsumed(player);
    } else if (occurrence.markType === 'must-stop-level') {
        engineMarkMustStopConsumed(player, occurrence.level, occurrence.cycleIndex);
    } else if (occurrence.markType === 'must-defend-level') {
        engineMarkMustDefendConsumed(player, occurrence.level, occurrence.cycleIndex);
    }
}

function engineDoesWinningHandCoreContainOnlyLevelers(cards) {
    let decomp = engineResolveLead(cards || []);
    let coreElement = decomp && decomp.coreElement ? decomp.coreElement : null;
    if (!coreElement || !Array.isArray(coreElement.cards) || coreElement.cards.length === 0) {
        return false;
    }
    return coreElement.cards.every(card => card.rank === game.level);
}

function engineDoesWinningHandCoreMatchKnockBackCondition(cards, mode) {
    let decomp = engineResolveLead(cards || []);
    let coreElement = decomp && decomp.coreElement ? decomp.coreElement : null;
    if (!coreElement || !Array.isArray(coreElement.cards) || coreElement.cards.length === 0) {
        return false;
    }

    if (mode === 'singleT') {
        if (coreElement.cards.length !== 1) return false;
        let c = coreElement.cards[0];
        return c.rank === game.level && c.division === 4;
    }

    // Default / unlimited: core element cards are all levelers.
    return coreElement.cards.every(card => card.rank === game.level);
}

function engineGetKnockBackDestinationAbsolute(player, currentAbs) {
    let cfg = game.gameConfig || {};
    let startLevel = engineGetConfiguredStartLevel();
    let currentCycle = Math.floor(currentAbs / 13);
    let currentOffset = currentAbs % 13;
    let kbLevels = Array.isArray(cfg.knockBackLevels) ? cfg.knockBackLevels : [];

    let candidates = [currentCycle * 13];
    for (let level of kbLevels) {
        let abs = currentCycle * 13 + engineLevelToCycleOffset(level, startLevel);
        if (abs < currentAbs) candidates.push(abs);
    }

    // If we are already at the cycle start, fall back to the same start marker.
    if (candidates.length === 0) return currentCycle * 13 + currentOffset;
    return Math.max(...candidates);
}

/**
 * Compute frame result from final score (§12 + terminology §15).
 * Authoritative delta model is fully config-driven for both branches:
 *   defenders delta = ceil((stageThreshold - score) / levelThreshold) when score < stageThreshold
 *   attackers delta = floor((score - stageThreshold) / levelThreshold) when score >= stageThreshold
 * with levelUpLimitPerFrame cap applied to both branches when configured.
 * Returns { defenseHolds, levelDelta, resultKey, nextPivot, advancingPlayers }.
 */
function engineComputeFrameResult(finalScore) {
    const stageThreshold = (game.gameConfig && game.gameConfig.stageThreshold != null) ? game.gameConfig.stageThreshold : 80;
    const rawLevelThreshold = (game.gameConfig && game.gameConfig.levelThreshold != null) ? game.gameConfig.levelThreshold : 40;
    const levelThreshold = Math.max(1, Number(rawLevelThreshold) || 1);
    const levelCap = (game.gameConfig && game.gameConfig.levelUpLimitPerFrame != null) ? game.gameConfig.levelUpLimitPerFrame : null;

    let defenseHolds;
    let levelDelta;
    let resultKey;

    if (finalScore < stageThreshold) {
        defenseHolds = true;
        levelDelta = Math.ceil((stageThreshold - finalScore) / levelThreshold);
        // Special boundary rule (note 36i): score 0 belongs to the lower section.
        if (finalScore === 0) levelDelta += 1;
        if (levelCap !== null && levelDelta > levelCap) levelDelta = levelCap;
        if (levelDelta <= 1) resultKey = 'retainStage';
        else if (levelDelta === 2) resultKey = 'smallSlam';
        else if (levelDelta === 3) resultKey = 'grandSlam';
        else resultKey = 'defendUpN';
    } else {
        defenseHolds = false;
        levelDelta = Math.floor((finalScore - stageThreshold) / levelThreshold);
        if (levelCap !== null && levelDelta > levelCap) levelDelta = levelCap;
        if (levelDelta === 0) resultKey = 'takeStage';
        else if (levelDelta === 1) resultKey = 'upOne';
        else if (levelDelta === 2) resultKey = 'upTwo';
        else resultKey = 'upN';
    }

    let advancingPlayers = defenseHolds ? [...game.defendingTeam] : [...game.attackingTeam];

    // Next pivot: defense holds → pivot's ally; attack wins → first attacker clockwise
    let nextPivot;
    if (defenseHolds) {
        nextPivot = (game.pivot + 2) % NUM_PLAYERS;
    } else {
        for (let i = 1; i < NUM_PLAYERS; i++) {
            let p = (game.pivot + i) % NUM_PLAYERS;
            if (game.attackingTeam.includes(p)) {
                nextPivot = p;
                break;
            }
        }
    }

    return { defenseHolds, levelDelta, resultKey, nextPivot, advancingPlayers };
}

/**
 * Advance player levels after a frame and return the updated levels array.
 * Applies must-stop level clamping from game config.
 * Levels cycle endlessly: 0-12 (2 through A), wrapping past A back to 2.
 */
function engineAdvanceLevels(playerLevels, advancingPlayers, delta) {
    let newLevels = engineCanonicalizeSideLevels(playerLevels);
    let startLevel = engineGetConfiguredStartLevel();
    let processedSides = {};

    for (let p of advancingPlayers) {
        let sideIndex = engineGetSideIndexForPlayer(p);
        if (processedSides[sideIndex]) continue;
        processedSides[sideIndex] = true;

        let sidePlayers = engineGetPlayersForSide(sideIndex);
        let sideAnchor = sidePlayers[0];
        let current = newLevels[sideAnchor];
        let currentAbs = engineGetCycleAwareAbsoluteLevel(sideAnchor, current);
        let targetAbs = currentAbs + delta;

        // If currently at an uncleared blocker, cannot advance past it.
        let startOccurrence = targetAbs > currentAbs
            ? engineGetBlockingOccurrenceForPlayerInCycle(sideAnchor, current, engineGetPlayerCycleIndex(sideAnchor))
            : null;
        if (startOccurrence) {
            targetAbs = currentAbs;
        }

        for (let abs = currentAbs + 1; abs <= targetAbs; abs++) {
            let cycleIndex = Math.floor(abs / 13);
            let level = engineCycleOffsetToLevel(abs % 13, startLevel);
            let occurrence = engineGetBlockingOccurrenceForPlayerInCycle(sideAnchor, level, cycleIndex);
            if (occurrence) {
                targetAbs = abs;
                break;
            }
        }

        let nextCycleIndex = Math.floor(targetAbs / 13);
        let nextLevel = engineCycleOffsetToLevel(targetAbs % 13, startLevel);
        for (let sidePlayer of sidePlayers) {
            newLevels[sidePlayer] = nextLevel;
        }
        engineSetPlayerCycleIndex(sideAnchor, nextCycleIndex);
    }

    return newLevels;
}

/**
 * Apply frame result: advance levels, determine next frame parameters.
 * Returns { newLevels, nextPivot, nextLevel, gameWon: false, winners: [] }.
 * Levels cycle endlessly — there is no forced game-end condition.
 */
function engineApplyFrameResult(frameResult) {
    let cfg = game.gameConfig || {};
    let startLevel = engineGetConfiguredStartLevel();

    // Update must-stop / must-defend clear-state based on this frame.
    let pivotTeam = [game.pivot, (game.pivot + 2) % NUM_PLAYERS];
    let mustStopLevels = Array.isArray(cfg.mustStopLevels) ? cfg.mustStopLevels : [];
    let mustDefendLevels = Array.isArray(cfg.mustDefendLevels) ? cfg.mustDefendLevels : [];
    let mustStopStartMarker = !!cfg.mustStopStartMarker;
    let mustDefendStartMarker = !!cfg.mustDefendStartMarker;
    let currentPivotCycle = engineGetPlayerCycleIndex(game.pivot);
    let isFirstCycleStartOccurrence = (currentPivotCycle === 0 && game.level === startLevel);
    if (mustStopLevels.includes(game.level)) {
        for (let p of pivotTeam) engineMarkMustStopConsumed(p, game.level, engineGetPlayerCycleIndex(p));
    }
    if (mustStopStartMarker && isFirstCycleStartOccurrence) {
        for (let p of pivotTeam) engineMarkMustStopStartMarkerConsumed(p);
    }
    if (frameResult.defenseHolds && mustDefendLevels.includes(game.level)) {
        for (let p of pivotTeam) engineMarkMustDefendConsumed(p, game.level, engineGetPlayerCycleIndex(p));
    }
    if (frameResult.defenseHolds && mustDefendStartMarker && isFirstCycleStartOccurrence) {
        for (let p of pivotTeam) engineMarkMustDefendStartMarkerConsumed(p);
    }

    let baseLevels = engineCanonicalizeSideLevels(game.playerLevels);
    let knockBackTriggered = engineIsKnockbackTriggered(frameResult);
    let knockBackAppliedPlayers = [];
    if (knockBackTriggered) {
        // Attackers trigger knock-back on defenders.
        let processedDefendingSides = {};
        for (let p of game.defendingTeam) {
            let sideIndex = engineGetSideIndexForPlayer(p);
            if (processedDefendingSides[sideIndex]) continue;
            processedDefendingSides[sideIndex] = true;

            let sidePlayers = engineGetPlayersForSide(sideIndex);
            let sideAnchor = sidePlayers[0];
            let currentAbs = engineGetCycleAwareAbsoluteLevel(sideAnchor, baseLevels[sideAnchor]);
            let destinationAbs = engineGetKnockBackDestinationAbsolute(sideAnchor, currentAbs);
            let destinationCycle = Math.floor(destinationAbs / 13);
            let destinationLevel = engineCycleOffsetToLevel(destinationAbs % 13, engineGetConfiguredStartLevel());
            for (let sidePlayer of sidePlayers) {
                baseLevels[sidePlayer] = destinationLevel;
            }
            engineSetPlayerCycleIndex(sideAnchor, destinationCycle);
            for (let sidePlayer of sidePlayers) {
                if (!knockBackAppliedPlayers.includes(sidePlayer)) {
                    knockBackAppliedPlayers.push(sidePlayer);
                }
            }
        }
    }

    let newLevels = engineAdvanceLevels(
        baseLevels,
        frameResult.advancingPlayers,
        frameResult.levelDelta
    );

    // Next frame level = next pivot's new level
    let nextLevel = newLevels[frameResult.nextPivot];

    game.playerLevels = newLevels;

    let gameWon = false;
    let winners = [];
    if (cfg.gameMode === 'pass-A') {
        winners = frameResult.advancingPlayers.filter(p => newLevels[p] === 12);
        gameWon = winners.length > 0;
    }

    return {
        newLevels: newLevels,
        nextPivot: frameResult.nextPivot,
        nextLevel: nextLevel,
        knockBackTriggered,
        knockBackAppliedPlayers,
        gameWon,
        winners,
    };
}

// ---------------------------------------------------------------------------
// Declaration helpers
// ---------------------------------------------------------------------------

/** Count how many cards of a given rank a player holds */
function engineCountRankInHand(hand, rank) {
    return hand.filter(c => c.rank === rank).length;
}

/** Count trump cards if a suit were declared strain */
function engineCountTrumpIfStrain(hand, suitStrain, level) {
    let count = 0;
    for (let c of hand) {
        if (c.suit === 4) { count++; continue; }              // jokers
        if (c.rank === level) { count++; continue; }           // level cards
        if (c.suit === suitStrain) { count++; continue; }      // suit match
    }
    return count;
}
