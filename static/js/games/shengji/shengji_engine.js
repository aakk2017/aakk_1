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

// Player labels (indexed by position)
const PLAYER_NAMES = ['南 (你)', '东 (Bot)', '北 (Bot)', '西 (Bot)'];

// Position text relative to South
const POSITION_LABELS = ['南', '东', '北', '西'];

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------
let game = {
    phase:          GamePhase.IDLE,
    level:          0,       // rank index: 0→'2', 1→'3', … 12→'A'
    strain:         -1,      // -1 undetermined, 0–3 suited, 4 nts
    pivot:          0,       // pivot player position
    dealer:         0,       // who dealt first card

    deck:           [],
    hands:          [[], [], [], []],
    base:           [],

    currentRound:       0,
    currentLeader:      -1,
    currentTurnIndex:   0,   // 0–3 within a round (offset from leader)
    roundPlayed:        [null, null, null, null],
    leadInfo:           null,

    score:          0,       // attackers' running score
    roundHistory:   [],

    defendingTeam:  [],
    attackingTeam:  [],

    declarations:   [],      // { player, suit, count }
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
function engineDecomposeLead(cards) {
    if (cards.length === 0) return null;
    if (!engineIsSingleDivision(cards)) return null;

    let division = cards[0].division;
    let sorted = [...cards].sort((a, b) => b.order - a.order || a.cardId - b.cardId);

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
function engineIsLegalLead(cards) {
    if (cards.length === 0) return false;
    return engineIsSingleDivision(cards);
}

function engineIsLegalFollow(hand, leadInfo, selectedCards) {
    if (selectedCards.length !== leadInfo.volume) return false;

    // All selected must be in hand
    let handIds = new Set(hand.map(c => c.cardId));
    if (!selectedCards.every(c => handIds.has(c.cardId))) return false;

    let divCards = hand.filter(c => c.division === leadInfo.division);

    if (divCards.length <= leadInfo.volume) {
        // Short-division: must play ALL division cards
        let divIds = new Set(divCards.map(c => c.cardId));
        let selectedDiv = selectedCards.filter(c => divIds.has(c.cardId));
        if (selectedDiv.length !== divCards.length) return false;
    } else {
        // Full-division: all selected must come from led division
        if (!selectedCards.every(c => c.division === leadInfo.division)) return false;
    }
    return true;
}

// ---------------------------------------------------------------------------
// Round winner
// ---------------------------------------------------------------------------
function engineDetermineRoundWinner() {
    let leader   = game.currentLeader;
    let leadInfo = game.leadInfo;
    let leadDiv  = leadInfo.division;

    let bestPlayer = leader;
    let bestOrder  = leadInfo.coreElement.order;
    let bestIsRuff = (leadDiv === 4); // trump lead = not a ruff situation

    for (let i = 1; i < NUM_PLAYERS; i++) {
        let player = (leader + i) % NUM_PLAYERS;
        let cards  = game.roundPlayed[player];
        if (!cards || cards.length === 0) continue;

        let isAllTrump    = cards.every(c => c.division === 4);
        let isAllDivision = cards.every(c => c.division === leadDiv);
        let followInfo    = engineDecomposeLead(cards);
        if (!followInfo) continue;

        let typeMatch = followInfo.type.every((t, idx) => t === leadInfo.type[idx]);

        if (leadDiv !== 4 && isAllTrump && !bestIsRuff) {
            // Ruff beats non-ruff
            if (typeMatch || cards.length === 1) {
                bestPlayer = player;
                bestOrder  = followInfo.coreElement.order;
                bestIsRuff = true;
            }
        } else if (isAllTrump && bestIsRuff) {
            if (typeMatch && followInfo.coreElement.order > bestOrder) {
                bestPlayer = player;
                bestOrder  = followInfo.coreElement.order;
            }
        } else if (isAllDivision && !bestIsRuff) {
            if (typeMatch && followInfo.coreElement.order > bestOrder) {
                bestPlayer = player;
                bestOrder  = followInfo.coreElement.order;
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

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------

/** Start a new game — shuffles deck but does NOT deal.
 *  The page calls engineDealNextBatch() to animate dealing one round at a time.
 */
function engineStartGame(level, pivot) {
    game.phase          = GamePhase.DEALING;
    game.level          = level;
    game.strain         = -1;
    game.pivot          = pivot;
    game.dealer         = pivot;
    game.score          = 0;
    game.currentRound   = 0;
    game.roundHistory   = [];
    game.declarations   = [];
    game.dealIndex      = 0;

    game.deck  = engineCreateDeck(level, 4);
    engineShuffle(game.deck);

    game.hands = [[], [], [], []];
    game.base  = [];
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

/** Play cards for a player. Returns {success, roundComplete, error}. */
function enginePlayCards(player, cards) {
    if (game.phase !== GamePhase.PLAYING)
        return { success: false, error: '当前不在行牌阶段' };
    if (player !== engineGetCurrentPlayer())
        return { success: false, error: '还没轮到你' };

    if (game.currentTurnIndex === 0) {
        if (!engineIsLegalLead(cards))
            return { success: false, error: '出牌必须来自同一花色' };
        game.leadInfo = engineDecomposeLead(cards);
    } else {
        if (!engineIsLegalFollow(game.hands[player], game.leadInfo, cards))
            return { success: false, error: '跟牌不合法' };
    }

    let playedIds = new Set(cards.map(c => c.cardId));
    game.hands[player] = game.hands[player].filter(c => !playedIds.has(c.cardId));
    game.roundPlayed[player] = cards;
    game.currentTurnIndex++;

    return { success: true, roundComplete: game.currentTurnIndex >= NUM_PLAYERS };
}

/** End the current round. Returns {winner, roundScore, gameOver}. */
function engineEndRound() {
    let winner = engineDetermineRoundWinner();
    let roundScore = 0;
    for (let i = 0; i < NUM_PLAYERS; i++) {
        if (game.roundPlayed[i]) roundScore += engineCountScore(game.roundPlayed[i]);
    }
    if (game.attackingTeam.includes(winner)) game.score += roundScore;

    game.roundHistory.push({
        round:  game.currentRound,
        leader: game.currentLeader,
        played: [...game.roundPlayed],
        winner: winner,
        score:  roundScore
    });

    game.currentRound++;
    if (game.currentRound > TOTAL_ROUNDS) {
        game.phase = GamePhase.COUNTING;
        return { winner, roundScore, gameOver: true };
    }

    game.currentLeader    = winner;
    game.currentTurnIndex = 0;
    game.roundPlayed      = [null, null, null, null];
    game.leadInfo         = null;
    return { winner, roundScore, gameOver: false };
}

/** Counting phase — finalize score. */
function engineFinalize() {
    let lastRound = game.roundHistory[game.roundHistory.length - 1];
    let baseScore = 0;
    let multiplier = 1;

    if (game.attackingTeam.includes(lastRound.winner)) {
        // Attackers win last round → base score counts
        multiplier = 2; // simplified endgame factor
        baseScore = engineCountScore(game.base) * multiplier;
        game.score += baseScore;
    }

    game.phase = GamePhase.GAME_OVER;

    // Simplified result: < 80 defend holds, >= 80 attack advances
    let result;
    if (game.score < 40)       result = '防守大胜 (庄家升3级)';
    else if (game.score < 80)  result = '防守小胜 (庄家升1级)';
    else if (game.score < 120) result = '进攻小胜 (进攻方升1级)';
    else                       result = '进攻大胜 (进攻方升3级)';

    return { totalScore: game.score, baseScore, multiplier, result };
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
