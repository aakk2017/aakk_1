/**
 * games/shengji/shengji_engine.js
 * Shengji game engine for live 3-bot 1-player play
 *
 * Manages game state, deck, dealing, declaration, basing,
 * round play, scoring, and game flow.
 * Does NOT touch the DOM — all rendering is done by pages/game/index.js.
 *
 * Note 111d boundary acknowledgement:
 * - This file is NOT yet the complete shared in-frame engine.
 * - pages/game/index.js still contains backend-like in-frame orchestration
 *   (dealing/declaration/basing/playing/counting flow coordination) due to
 *   current local-browser architecture.
 * - Physical split into dedicated game-engine/frame-engine modules is deferred
 *   to future cleanup notes after shared DA3P routing stabilizes.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const GamePhase = {
    IDLE:       'idle',
    DEALING:    'dealing',
    BASING:     'basing',
    PLAYING:    'playing',
    COUNTING:   'counting',
    GAME_OVER:  'game_over'
};

// Note 103a: dealing substage/action-window.
// The final declaration call/window stays inside GamePhase.DEALING; it is not a top-level phase.
const DealingStage = {
    NONE:                   'none',
    DEALING_CARDS:          'dealing_cards',
    FINAL_DECLARATION_CALL: 'final_declaration_call'
};

let localControlledPlayerIndex = 1;  // Note 103b: local control identity — which actor/seat is controlled by the local user.
let selectedNaturalPositionIndex = 1;  // Note 103b: display/reference perspective — which seat is shown at the bottom reference position.

// Deck/count configuration (Note 103c)
const SHENGJI_DECK_COUNT_CONFIGS = Object.freeze({
    '1deck': Object.freeze({ deckCount: 1, totalCards:  54, baseSize:  4, framePositionCount: 4, realActorCount: 4, cardsPerFramePosition: 12, supported: false }),
    '2deck': Object.freeze({ deckCount: 2, totalCards: 108, baseSize: 8,  framePositionCount: 4, realActorCount: 4, cardsPerFramePosition: 25, supported: true  }),
    '3deck': Object.freeze({ deckCount: 3, totalCards: 162, baseSize: 12, framePositionCount: 4, realActorCount: 4, cardsPerFramePosition: 37, supported: false }),
});

function engineValidateGameSizeConfig(config) {
    if (!config || typeof config !== 'object') return false;
    if (!config.supported) return false;
    if ((config.totalCards - config.baseSize) % config.framePositionCount !== 0) return false;
    if (typeof config.realActorCount !== 'number' || config.realActorCount < 1) return false;
    if (typeof config.framePositionCount !== 'number' || config.framePositionCount < 1) return false;
    return true;
}

const ACTIVE_GAME_SIZE_CONFIG      = SHENGJI_DECK_COUNT_CONFIGS['2deck'];

// Config-derived semantic constants (Note 103c)
const TOTAL_CARD_COUNT = ACTIVE_GAME_SIZE_CONFIG.totalCards;
const CARDS_PER_FRAME_POSITION = ACTIVE_GAME_SIZE_CONFIG.cardsPerFramePosition;
const FRAME_BASE_SIZE = ACTIVE_GAME_SIZE_CONFIG.baseSize;
const FRAME_POSITION_COUNT = ACTIVE_GAME_SIZE_CONFIG.framePositionCount;
const REAL_ACTOR_COUNT = ACTIVE_GAME_SIZE_CONFIG.realActorCount;
const EXPECTED_TRICK_COUNT = CARDS_PER_FRAME_POSITION;

// Legacy aliases (Note 103c: quarantine — keep for all existing reference sites)
const TOTAL_CARDS = TOTAL_CARD_COUNT;
const CARDS_PER_HAND = CARDS_PER_FRAME_POSITION;
const BASE_SIZE = FRAME_BASE_SIZE;
const NUM_PLAYERS = FRAME_POSITION_COUNT;
// Note 103c: round-count global removed; derive per-game from EXPECTED_TRICK_COUNT

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

const UNDETERMINED_PIVOT = -1;

function isPivotResolved(pivotSeat) {
    return Number.isInteger(pivotSeat) && pivotSeat >= 0 && pivotSeat < REAL_ACTOR_COUNT;
}

window.UNDETERMINED_PIVOT = UNDETERMINED_PIVOT;
window.isPivotResolved = isPivotResolved;

// ---------------------------------------------------------------------------
// Position-system contract helpers (Note 104)
// ---------------------------------------------------------------------------
//
// POSITION SYSTEM SEPARATION CONTRACT:
//
//   naturalPosition  — stable actor identity (e.g. E, N, W, S; or N, Sw, Se, D)
//   referencePosition — relative to selected reference perspective
//                       (reference, afterhand, opposite, forehand)
//   framePosition /
//   frameRole        — relative to pivot/frame structure
//                       (pivot, successor, ally, predecessor)
//   roundPosition    — order within the current trick/round
//                       (leader, secondSeat, thirdSeat, fourthSeat)
//   displayPosition  — screen layout slot (bottom, right, top, left)
//
// CURRENT NORMAL 4P DISPLAY CONTRACT:
//   naturalPositionOrder + selectedNaturalPositionIndex
//       -> referencePosition -> displayPosition (bottom/right/top/left)
//   NOT routed through pivot/framePosition/frameOrder.
//
// FUTURE 3PDA-STYLE DISPLAY CONTRACT (specification only, not activated):
//   frameOrder + referenceActor -> displayPosition (bottom/right/top/left)
//
// The helpers below encode the future 3PDA-style contract as pure functions.
// They have no side effects, no DOM access, and do not affect live gameplay.

/**
 * Generic frame-order → display-position mapper (future 3PDA-style contract).
 * Contract:
 *   bottom = referenceActor
 *   right  = next actor in frameOrder after reference
 *   top    = actor two steps after reference
 *   left   = actor one step before reference
 * @param {string[]} frameOrder - ordered array of actor IDs in frame play order
 * @param {string} referenceActor - must appear in frameOrder
 * @returns {{ bottom, right, top, left }} display-position → actor-ID map
 */
function createDisplayMapFromFrameOrder(frameOrder, referenceActor) {
    const referenceIndex = frameOrder.indexOf(referenceActor);
    if (referenceIndex < 0) {
        throw new Error('referenceActor must be present in frameOrder');
    }
    const n = frameOrder.length;
    return {
        bottom: frameOrder[referenceIndex],
        right:  frameOrder[(referenceIndex + 1) % n],
        top:    frameOrder[(referenceIndex + 2) % n],
        left:   frameOrder[(referenceIndex + n - 1) % n],
    };
}

// Future 3PDA constants (specification only — not used in live gameplay)
const REAL_ACTORS_3PDA = Object.freeze(['N', 'Sw', 'Se']);
const DUMMY_ACTOR_3PDA = 'D';

/**
 * Future 3PDA frame-order builder (specification only).
 * frameOrder = [pivot, successor, dummy, predecessor]
 * @param {string} pivotActor - must be one of REAL_ACTORS_3PDA
 * @returns {string[]} frame play order for 3PDA
 */
function create3PDAFrameOrder(pivotActor) {
    const pivotIndex = REAL_ACTORS_3PDA.indexOf(pivotActor);
    if (pivotIndex < 0) {
        throw new Error('Invalid 3PDA pivot actor');
    }
    return [
        REAL_ACTORS_3PDA[pivotIndex],             // pivot
        REAL_ACTORS_3PDA[(pivotIndex + 1) % 3],   // successor
        DUMMY_ACTOR_3PDA,                          // dummy ally
        REAL_ACTORS_3PDA[(pivotIndex + 2) % 3],   // predecessor
    ];
}

/**
 * Canonical DA3P frame order helper used by runtime pivot resolution (Note 112).
 * Returns [pivot, successor, D, predecessor] for pivots N/Sw/Se.
 * Invalid pivots return null (controlled failure) instead of silently producing
 * a wrong order.
 * @param {string} pivotActor
 * @returns {string[]|null}
 */
function createDA3PCanonicalFrameOrderForPivot(pivotActor) {
    if (REAL_ACTORS_3PDA.indexOf(pivotActor) < 0) {
        return null;
    }
    return create3PDAFrameOrder(pivotActor);
}

/**
 * Future 3PDA display map (specification only).
 * referenceActor must be a real actor (not dummy D).
 * @param {string} pivotActor - must be one of REAL_ACTORS_3PDA
 * @param {string} referenceActor - must be one of REAL_ACTORS_3PDA
 * @returns {{ bottom, right, top, left }} display-position → actor-ID map
 */
function create3PDADisplayMap(pivotActor, referenceActor) {
    if (REAL_ACTORS_3PDA.indexOf(referenceActor) < 0) {
        throw new Error('referenceActor must be a real 3PDA actor, not dummy');
    }
    const frameOrder = create3PDAFrameOrder(pivotActor);
    return createDisplayMapFromFrameOrder(frameOrder, referenceActor);
}

/**
 * Future 3PDA inter-frame pivot rotation (specification only).
 * @param {string} initialPivotActor - must be one of REAL_ACTORS_3PDA
 * @param {number} frameIndex - 0-based frame number
 * @returns {string} pivot actor for that frame
 */
function get3PDAPivotForFrame(initialPivotActor, frameIndex) {
    const start = REAL_ACTORS_3PDA.indexOf(initialPivotActor);
    if (start < 0) {
        throw new Error('Invalid initial pivot actor');
    }
    return REAL_ACTORS_3PDA[(start + frameIndex) % 3];
}

// Export position-system contract helpers for test access
window.createDisplayMapFromFrameOrder = createDisplayMapFromFrameOrder;
window.create3PDAFrameOrder            = create3PDAFrameOrder;
window.createDA3PCanonicalFrameOrderForPivot = createDA3PCanonicalFrameOrderForPivot;
window.create3PDADisplayMap            = create3PDADisplayMap;
window.get3PDAPivotForFrame            = get3PDAPivotForFrame;
window.REAL_ACTORS_3PDA                = REAL_ACTORS_3PDA;
window.DUMMY_ACTOR_3PDA                = DUMMY_ACTOR_3PDA;

// ---------------------------------------------------------------------------
// 3PDA rule/model contract (Note 106 — specification only, not activated)
// ---------------------------------------------------------------------------
//
// Count model:
//   REAL_ACTOR_COUNT_3PDA      = 3   (N, Sw, Se)
//   FRAME_POSITION_COUNT_3PDA  = 4   (three real actors + dummy D)
//   Do NOT collapse these into the current normal 4P config.
//   Real actors and frame positions must remain separate degrees of freedom
//   to support the 3PDA variant alongside normal 4P (Note 103c).
//
// dealAnchor concept (shared 4P/3PDA dealing-start — minimal introduction only):
//   dealAnchor = the frame's dealing start point.
//   In qiangzhuang frames:      dealAnchor is generated/randomized before pivot is known.
//   In non-qiangzhuang frames:  dealAnchor is always the pivot.
//   NOTE: Full shared dealAnchor implementation (bot timing, 4P dealing order etc.)
//         is deferred to a future note. This note introduces the concept only for
//         3PDA qz temporary layout purposes. No 4P dealing behavior is changed.
//
// In-frame vs. out-of-frame reference positions:
//   In-frame (4 positions):    D is counted as the fourth position.
//     Use createDisplayMapFromFrameOrder for in-frame display mapping.
//   Out-of-frame (3 positions): Only N/Sw/Se are counted; dummy is not counted.
//     Out-of-frame positions: { reference, afterhand, forehand }.  No "opposite".

// 3PDA count model (Note 106)
const REAL_ACTOR_COUNT_3PDA     = 3;
const FRAME_POSITION_COUNT_3PDA = 4;

/**
 * Display labels for dummy actor in 3PDA (Note 106).
 * English: 'D', Chinese: '明'.
 * Dummy has no natural position; D is a frame actor/hand/desk slot only.
 */
const DUMMY_LABELS_3PDA = Object.freeze({ en: 'D', zh: '明' });

/**
 * Default multiplier for pivot's initial bank time in 3PDA (Note 106).
 * Pivot controls dummy, so pivot's initial bank time is scaled up.
 * Default factor: 1.5.  Adjustable later in timing settings.
 * Factor does NOT apply to set-base increment.
 */
const PIVOT_BANK_TIME_FACTOR_3PDA = 1.5;

// ---------------------------------------------------------------------------
// 3PDA rule/model documentation (Note 106 — all sections below are spec-only)
// ---------------------------------------------------------------------------
//
// BASING / OVERBASE CONTRACT (Note 106 §9):
//   Pivot makes the first base as usual.
//   Overbase can run as in normal 4P if allowed.
//   D cannot make overcalls; overbase declaration eligibility belongs only to real actors.
//   D is still unrevealed during basing/overbase.
//
// CROSSING / REVEAL CONTRACT (Note 106 §10):
//   If crossing is enabled: crossing claims happen before revealing D.
//   D is revealed right before the first lead (not after the lead, unlike bridge).
//   D never claims crossing.
//   If pivot crosses, pivot sees D and crosses back.
//   D is not shown to attackers during crossing.
//   After crossing is resolved, D is revealed before first lead.
//
// PLAYING / DUMMY CONTROL CONTRACT (Note 106 §11):
//   D is played by the pivot.
//   Pivot controls D's card play.
//   Pivot performs D's forehand-control choices against predecessor.
//   Pivot chooses D's block type when D must choose how to block.
//   D's timing units belong to the pivot player.
//   D can block and be blocked normally.  D can block pivot; pivot can block D.
//
// MULTIPLAY / PUBLIC INFORMATION CONTRACT (Note 106 §12):
//   After D is revealed, D's hand is public exposed information.
//   If D has a high element in a division, another player's lower multiplay
//   in that division may be fake as usual (same fake-multiplay rules apply).
//
// TIMING CONTRACT (Note 106 §13):  see PIVOT_BANK_TIME_FACTOR_3PDA above.
//
// SCORING / LEVEL CONTRACT (Note 106 §14):
//   All three real players have independent levels.  There is no fixed team.
//   Pivot defends own level in each frame.
//   If defense succeeds, pivot advances; if defense fails, both attackers advance.
//   Attackers can advance by zero if score threshold says so.
//   Track successor desk score separately and predecessor desk score separately.
//   Shared base score and ending compensation apply to both attacker desk-score totals.
//   Per-player visible frame scores in individual tournament context:
//     pivot view:      successor desk score + predecessor desk score + shared base + shared end comp
//     successor view:  successor desk score + shared base + shared ending compensation
//     predecessor view: predecessor desk score + shared base + shared ending compensation
//
// UI CONTRACT (Note 106 §15 — spec-only, no UI implemented in this note):
//   Settings — Table format / 牌桌形式 options: normal 4P vs 3P dummy-ally (3PDA).
//     3PDA: winner-pivot disabled; pivot-pass mode forced to rotate-pivot.
//     normal 4P: winner-pivot option enabled.
//   Dynamic display: in-frame reference positions using createDisplayMapFromFrameOrder.
//   Dummy hand display: click-show preferred; D desk hidden when D hand shown.
//   Position-level box: remove text in dummy triangle area; attackers' levels may differ.

/**
 * 3PDA qiangzhuang temporary dealing layout (Note 106, spec-only).
 *
 * In a 3PDA qz frame, pivot is not yet known when dealing starts.
 * Cards are dealt to a temporary 4-position layout where the dummy pile
 * is placed opposite the dealAnchor.
 *
 * Temporary layout = [dealAnchor, nextRealAfterDealAnchor, tempDummyPile, previousRealBeforeDealAnchor]
 *
 * After pivot is determined:
 *   - real hands remain attached to their real actors N/Sw/Se;
 *   - temporary dummy pile becomes D ('明');
 *   - canonical frame order is rebuilt as [pivot, successor, D, predecessor].
 *
 * @param {string} dealAnchor - must be one of REAL_ACTORS_3PDA
 * @returns {string[]} temporary qz layout (4 positions; 'D' at index 2)
 */
function get3PDAQZTempLayout(dealAnchor) {
    const idx = REAL_ACTORS_3PDA.indexOf(dealAnchor);
    if (idx < 0) throw new Error('dealAnchor must be a 3PDA real actor');
    return [
        REAL_ACTORS_3PDA[idx],             // dealAnchor
        REAL_ACTORS_3PDA[(idx + 1) % 3],   // next real after dealAnchor
        DUMMY_ACTOR_3PDA,                  // temporary dummy pile (opposite dealAnchor)
        REAL_ACTORS_3PDA[(idx + 2) % 3],   // previous real before dealAnchor
    ];
}

/**
 * Returns true if actor is a real 3PDA actor (N/Sw/Se) — i.e. eligible to declare.
 * Declaration eligibility: only real actors may declare; D cannot declare (Note 106).
 * In qz frames: only N/Sw/Se may declare.
 * In non-qz frames: pivot/successor/predecessor may declare (they are the real actors).
 * @param {string} actor
 * @returns {boolean}
 */
function is3PDARealActor(actor) {
    return REAL_ACTORS_3PDA.indexOf(actor) >= 0;
}

/**
 * Out-of-frame reference positions for 3PDA (Note 106, spec-only).
 * Outside a frame, only the 3 real actors are counted; dummy is not counted.
 * There is NO "opposite" among 3 real actors.
 * @param {string} referenceActor - must be one of REAL_ACTORS_3PDA
 * @returns {{ reference: string, afterhand: string, forehand: string }}
 */
function get3PDAOutOfFramePositions(referenceActor) {
    const idx = REAL_ACTORS_3PDA.indexOf(referenceActor);
    if (idx < 0) throw new Error('referenceActor must be a real 3PDA actor');
    return {
        reference: REAL_ACTORS_3PDA[idx],
        afterhand: REAL_ACTORS_3PDA[(idx + 1) % 3],
        forehand:  REAL_ACTORS_3PDA[(idx + 2) % 3],
    };
}

/**
 * Named frame roles for a given 3PDA pivot (Note 106, spec-only).
 * @param {string} pivotActor - must be one of REAL_ACTORS_3PDA
 * @returns {{ pivot: string, successor: string, dummy: string, predecessor: string }}
 */
function get3PDARolesForPivot(pivotActor) {
    const idx = REAL_ACTORS_3PDA.indexOf(pivotActor);
    if (idx < 0) throw new Error('pivotActor must be a real 3PDA actor');
    return {
        pivot:       REAL_ACTORS_3PDA[idx],
        successor:   REAL_ACTORS_3PDA[(idx + 1) % 3],
        dummy:       DUMMY_ACTOR_3PDA,
        predecessor: REAL_ACTORS_3PDA[(idx + 2) % 3],
    };
}

// Export 3PDA rule/model contract helpers for test access (Note 106)
window.REAL_ACTOR_COUNT_3PDA       = REAL_ACTOR_COUNT_3PDA;
window.FRAME_POSITION_COUNT_3PDA   = FRAME_POSITION_COUNT_3PDA;
window.DUMMY_LABELS_3PDA           = DUMMY_LABELS_3PDA;
window.PIVOT_BANK_TIME_FACTOR_3PDA = PIVOT_BANK_TIME_FACTOR_3PDA;
window.get3PDAQZTempLayout         = get3PDAQZTempLayout;
window.is3PDARealActor             = is3PDARealActor;
window.get3PDAOutOfFramePositions  = get3PDAOutOfFramePositions;
window.get3PDARolesForPivot        = get3PDARolesForPivot;

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------
let game = {
    phase:          GamePhase.IDLE,
    dealingStage:   DealingStage.NONE,  // Note 103a: substage within GamePhase.DEALING
    playOrderSeats: null,
    playOrderActorKeys: null,
    level:          0,       // rank index: 0→'2', 1→'3', … 12→'A'
    strain:         -1,      // -1 undetermined, 0–3 suited, 4 nts
    pivot:          UNDETERMINED_PIVOT,
    declarationOrderAnchor: 0,

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

    // Overbase baser tracking (note 41a / 41g):
    // currentBaser = actor currently responsible for setting base in basing flow.
    // finalBaserSeat = seat that last accepted set-base move committed before playing.
    // finalBaser is kept as a compatibility alias for older consumers.
    currentBaser: null,
    finalBaserSeat: null,
    finalBaser: null,

    // FailedMultiplayState — aftermath of the most recent failed multiplay
    // { failer, intendedLead, actualElement, blockers, actualBlocker,
    //   revokedCards, exposedCards:{[div]:Card[]}, holdInProgress, revocationApplied }
    failedMultiplay: null,

    // Running compensation total from failed-multiplay revocations in this frame.
    multiplayCompensation: 0,

    // Per-event signed compensation entries for this frame (note 39d).
    // Each entry: { signed: number }
    multiplayCompensationEvents: [],

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

function engineIsValidPlayOrderSeats(order) {
    if (!Array.isArray(order) || order.length !== NUM_PLAYERS) return false;
    if (!order.every(seat => Number.isInteger(seat) && seat >= 0 && seat < NUM_PLAYERS)) return false;
    return (new Set(order)).size === NUM_PLAYERS;
}

function engineGetFramePlayOrderSeats() {
    if (engineIsValidPlayOrderSeats(game.playOrderSeats)) {
        return game.playOrderSeats;
    }
    return [0, 1, 2, 3];
}

function engineGetPlayerAtTurnOffset(leaderSeat, turnIndex) {
    const order = engineGetFramePlayOrderSeats();
    const leaderIndex = order.indexOf(leaderSeat);
    if (leaderIndex < 0) {
        return (leaderSeat + turnIndex) % NUM_PLAYERS;
    }
    const n = order.length;
    const normalizedOffset = ((turnIndex % n) + n) % n;
    return order[(leaderIndex + normalizedOffset) % n];
}

function engineGetPreviousPlayerInPlayOrder(playerSeat) {
    const order = engineGetFramePlayOrderSeats();
    const idx = order.indexOf(playerSeat);
    if (idx < 0) {
        return (playerSeat + NUM_PLAYERS - 1) % NUM_PLAYERS;
    }
    return order[(idx + order.length - 1) % order.length];
}

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

// Returns the deal layout for a given size config (Note 103c)
function engineGetDealLayoutFor(sizeConfig) {
    return {
        framePositionCount:    sizeConfig.framePositionCount,
        cardsPerFramePosition: sizeConfig.cardsPerFramePosition,
        realActorCount:        sizeConfig.realActorCount,
        baseSize:              sizeConfig.baseSize,
    };
}

function engineDealCards(deck) {
    let hands = [[], [], [], []];
    let base = [];
    for (let i = 0; i < CARDS_PER_FRAME_POSITION * FRAME_POSITION_COUNT; i++) {
        hands[i % NUM_PLAYERS].push(deck[i]);
    }
    for (let i = CARDS_PER_FRAME_POSITION * FRAME_POSITION_COUNT; i < TOTAL_CARDS; i++) {
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
        engineGetPlayerAtTurnOffset(leader, 3), // 4th seat
        engineGetPlayerAtTurnOffset(leader, 1), // 2nd seat
        engineGetPlayerAtTurnOffset(leader, 2)  // 3rd seat
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
        followers.push(engineGetPlayerAtTurnOffset(leader, i));
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

    // Increment ForehandControlChanceState only in default mode
    let handling = (game.gameConfig && game.gameConfig.failedMultiplayHandling) || 'default';
    let useForehandControl = handling === 'default';
    
    let forehand = engineGetPreviousPlayerInPlayOrder(failer);
    if (useForehandControl) {
        if (!game.fcChances[failer]) game.fcChances[failer] = { forehand: forehand, count: 0 };
        game.fcChances[failer].count++;
    }

    // Failed-multiplay compensation runtime semantics (note 39c/39d/48c):
    // compensation applies in supported compensation modes.
    // - compensation: revokedCardCount * amount
    // - lian-zhong-compensation: intendedLeadCardCount * 5
    // Sign: negative when the failing side is the attackers; positive when the failing side is the defenders.
    let compensationEnabled =
        (handling === 'compensation')
        || (handling === 'lian-zhong-compensation')
        || !!(game.gameConfig && game.gameConfig.multiplayCompensation);
    if (compensationEnabled) {
        let magnitude = 0;
        if (handling === 'lian-zhong-compensation') {
            let intendedCount = Array.isArray(intendedLead) ? intendedLead.length : 0;
            magnitude = Math.max(0, Math.floor(intendedCount)) * 5;
        } else {
            let revokedCount = Array.isArray(revokedCards) ? revokedCards.length : 0;
            let amount = Number(game.gameConfig && game.gameConfig.multiplayCompensationAmount);
            if (!Number.isFinite(amount)) amount = 0;
            amount = Math.max(0, Math.floor(amount));
            magnitude = revokedCount * amount;
        }
        if (magnitude !== 0) {
            // Determine sign: attacker failure reduces frame score; defender failure increases it.
            let failerIsAttacker = Array.isArray(game.attackingTeam) && game.attackingTeam.includes(failer);
            let signedDelta = failerIsAttacker ? -magnitude : magnitude;
            game.multiplayCompensationEvents.push({ signed: signedDelta });
            game.multiplayCompensation += signedDelta;
            game.frameScore += signedDelta;
        }
    }
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
        controller: game.fcPending ? game.fcPending.forehand : engineGetPreviousPlayerInPlayOrder(failer)
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
        let player = engineGetPlayerAtTurnOffset(leader, i);
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
    return engineGetPlayerAtTurnOffset(game.currentLeader, game.currentTurnIndex);
}

function engineIsDA3PResolvedRuntimeFrame() {
    return !!(
        game
        && game.tableFormat === 'da3p'
        && game.frameContext
        && game.frameContext.tableFormat === 'da3p'
        && game.frameContext.pivotStatus === 'resolved'
    );
}

function engineGetHandSeatByFrameActorKeyMap() {
    let map = {};
    if (game && game.handSeatByFrameActorKey && typeof game.handSeatByFrameActorKey === 'object') {
        Object.assign(map, game.handSeatByFrameActorKey);
    }
    if (game && Array.isArray(game.frameActorByHandSeat)) {
        for (let seat = 0; seat < game.frameActorByHandSeat.length; seat++) {
            map[frameActorKey(game.frameActorByHandSeat[seat])] = seat;
        }
    }
    return map;
}

function engineArrayEqualsByFrameActorKey(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (frameActorKey(a[i]) !== frameActorKey(b[i])) return false;
    }
    return true;
}

function engineIsValidSeatSet(seats) {
    if (!Array.isArray(seats) || seats.length !== 2) return false;
    if (!seats.every(seat => Number.isInteger(seat) && seat >= 0 && seat < NUM_PLAYERS)) return false;
    return (new Set(seats)).size === seats.length;
}

function engineBuildDA3PTeamSeatsFromFrameContext(frameContext) {
    if (!engineIsDA3PResolvedRuntimeFrame() || !frameContext) return null;

    const order = frameContext.canonicalFrameOrder;
    if (!Array.isArray(order) || order.length !== 4) return null;

    const pivotActor = frameContext.pivotActor;
    if (!pivotActor || frameActorKey(pivotActor) === frameActorKey('D')) return null;

    const expected = createDA3PCanonicalFrameOrderForPivot(pivotActor);
    if (!Array.isArray(expected) || !engineArrayEqualsByFrameActorKey(order, expected)) return null;

    const pivotActorInOrder = order[0];
    const successorActor = order[1];
    const dummyActor = order[2];
    const predecessorActor = order[3];
    if (frameActorKey(dummyActor) !== frameActorKey('D')) return null;

    const seatByActorKey = engineGetHandSeatByFrameActorKeyMap();
    const seatOf = actor => seatByActorKey[frameActorKey(actor)];

    const pivotSeat = seatOf(pivotActorInOrder);
    const successorSeat = seatOf(successorActor);
    const dummySeat = seatOf(dummyActor);
    const predecessorSeat = seatOf(predecessorActor);

    const defendingTeam = [pivotSeat, dummySeat];
    const attackingTeam = [successorSeat, predecessorSeat];
    if (!engineIsValidSeatSet(defendingTeam) || !engineIsValidSeatSet(attackingTeam)) return null;

    const allSeats = [...defendingTeam, ...attackingTeam];
    if ((new Set(allSeats)).size !== NUM_PLAYERS) return null;

    return { defendingTeam, attackingTeam };
}

function engineSetTeams() {
    if (!isPivotResolved(game.pivot)) {
        game.defendingTeam = [];
        game.attackingTeam = [];
        return false;
    }

    if (engineIsDA3PResolvedRuntimeFrame()) {
        const teams = engineBuildDA3PTeamSeatsFromFrameContext(game.frameContext);
        if (!teams) {
            game.defendingTeam = [];
            game.attackingTeam = [];
            return false;
        }
        game.defendingTeam = [...teams.defendingTeam];
        game.attackingTeam = [...teams.attackingTeam];
        return true;
    }

    game.defendingTeam = [game.pivot, (game.pivot + 2) % NUM_PLAYERS];
    game.attackingTeam = [];
    for (let i = 0; i < NUM_PLAYERS; i++) {
        if (!game.defendingTeam.includes(i)) game.attackingTeam.push(i);
    }
    return true;
}

/**
 * Apply attacker-self-base half rule to base score only.
 * Rule gate: only applies when attackers set the final base and config enables it.
 * Numeric semantics: preserve float (no integer forcing), lower bounded by 0.
 */
function engineApplyAttackersSelfBaseHalfToBaseScore(baseScore, cfg, attackersSetFinalBase) {
    if (cfg && cfg.attackersSelfBaseHalfMultiplier && attackersSetFinalBase) {
        return Math.max(0, baseScore / 2);
    }
    return baseScore;
}

function engineResetFailedMultiplayCompensationState() {
    game.failedMultiplay = null;
    game.multiplayCompensation = 0;
    game.multiplayCompensationEvents = [];
}

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------

/** Start a new game — shuffles deck but does NOT deal.
 *  The page calls engineDealNextBatch() to animate dealing one round at a time.
 */
function engineStartGame(level, pivot, playerLevels, isQiangzhuang, resolvedRuleConfig, declarationOrderAnchor) {
    game.phase          = GamePhase.DEALING;
    game.dealingStage   = DealingStage.DEALING_CARDS;  // Note 103a
    game.level          = level;
    game.strain         = -1;
    game.pivot          = isPivotResolved(pivot) ? pivot : UNDETERMINED_PIVOT;
    game.declarationOrderAnchor = Number.isInteger(declarationOrderAnchor) && declarationOrderAnchor >= 0 && declarationOrderAnchor < NUM_PLAYERS
        ? declarationOrderAnchor
        : (isPivotResolved(game.pivot) ? game.pivot : 0);
    game.playOrderSeats = null;
    game.playOrderActorKeys = null;
    game.frameScore     = 0;
    game.currentRound   = 0;
    game.roundHistory   = [];
    game.declarations   = [];
    game.currentBaser   = null;
    game.finalBaserSeat = null;
    game.finalBaser     = null;
    game.dealIndex      = 0;
    game.roundState     = null;
    engineResetFailedMultiplayCompensationState();
    game.exposedCards   = {};
    game.fcChances      = {};
    game.fcPending      = null;
    game.forehandControl = null;
    game.isQiangzhuang  = (isQiangzhuang !== false); // true by default, false only for later frames
    game.defendingTeam  = [];
    game.attackingTeam  = [];

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
        // Note 103a: stay in DEALING phase; advance substage to final declaration call/window.
        game.dealingStage = DealingStage.FINAL_DECLARATION_CALL;
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
    if (!isPivotResolved(game.pivot)) return false;
    game.hands[game.pivot] = game.hands[game.pivot].concat(game.base);
    game.base = [];
    engineSortHand(game.hands[game.pivot]);
    game.currentBaser = game.pivot;
    game.phase = GamePhase.BASING;
    game.dealingStage = DealingStage.NONE;  // Note 103a
    return true;
}

function engineInitPlayingStateFromCommittedBase() {
    if (!isPivotResolved(game.pivot)) return false;
    if (Array.isArray(game.playOrderSeats) && !engineIsValidPlayOrderSeats(game.playOrderSeats)) {
        return false;
    }
    if (!engineSetTeams()) return false;
    game.currentLeader    = game.pivot;
    game.currentRound     = 1;
    game.currentTurnIndex = 0;
    game.roundPlayed      = [null, null, null, null];
    game.leadInfo         = null;
    game.phase            = GamePhase.PLAYING;
    game.dealingStage     = DealingStage.NONE;  // Note 103a
    return true;
}

function engineGetPlayingEntryCardinalityState() {
    let handSizes = game.hands.map(hand => hand.length);
    let baseSize = game.base.length;
    let totalCards = handSizes.reduce((sum, size) => sum + size, 0) + baseSize;
    let handsOk = handSizes.every(size => size === CARDS_PER_HAND);
    let baseOk = baseSize === BASE_SIZE;
    let totalOk = totalCards === TOTAL_CARDS;

    return {
        handSizes,
        baseSize,
        totalCards,
        handsOk,
        baseOk,
        totalOk,
        isValid: handsOk && baseOk && totalOk,
    };
}

/** Current baser (pivot or overbaser) sets base (discards BASE_SIZE cards). Returns true on success. */
function engineSetBase(selectedCards, options) {
    if (selectedCards.length !== BASE_SIZE) return false;
    // Use currentBaser if set (overbase case), else fall back to game.pivot (normal case).
    let activeBaser = (game.currentBaser !== null && game.currentBaser !== undefined) ? game.currentBaser : game.pivot;
    if (!isPivotResolved(activeBaser)) return false;
    let hand = game.hands[activeBaser];
    if (!selectedCards.every(c => hand.some(h => h.cardId === c.cardId))) return false;

    let ids = new Set(selectedCards.map(c => c.cardId));
    game.base = selectedCards;
    game.hands[activeBaser] = hand.filter(c => !ids.has(c.cardId));
    engineSortHand(game.hands[activeBaser]);
    // finalBaserSeat tracks who set the accepted base — updated here, not at overbase-declaration time.
    game.finalBaserSeat = activeBaser;
    game.finalBaser = activeBaser;

    let deferPlaying = !!(options && options.deferPlaying);
    if (deferPlaying) {
        game.phase = GamePhase.BASING;
        game.dealingStage = DealingStage.NONE;  // Note 103a
        return true;
    }

    return engineInitPlayingStateFromCommittedBase();
}

function engineCommitBasingToPlaying() {
    if (game.phase === GamePhase.PLAYING) return true;
    if (game.phase !== GamePhase.BASING) return false;
    let cardinality = engineGetPlayingEntryCardinalityState();
    if (!cardinality.isValid) return false;
    return engineInitPlayingStateFromCommittedBase();
}

function engineApplyOverbaseDeclaration(player, declaration) {
    if (!declaration) return false;
    // Do NOT rewrite game.pivot — the frame pivot is fixed for the whole frame.
    // Only update currentBaser to track the active base-setter.
    game.currentBaser = player;
    engineSetStrain(declaration.suit);
    game.declarations.push({ player: player, suit: declaration.suit, count: declaration.count });
    game.hands[player] = game.hands[player].concat(game.base);
    game.base = [];
    engineSortHand(game.hands[player]);
    game.phase = GamePhase.BASING;
    game.dealingStage = DealingStage.NONE;  // Note 103a
    return true;
}

/**
 * Non-overbase declaration (note 41h): restricted partner of latest baser may change
 * the strain/declaration state but does NOT pick up the base and does NOT become
 * the new latest baser. currentBaser and finalBaserSeat are left unchanged.
 */
function engineApplyNonOverbaseDeclaration(player, declaration) {
    if (!declaration) return false;
    engineSetStrain(declaration.suit);
    game.declarations.push({ player: player, suit: declaration.suit, count: declaration.count });
    // phase stays BASING — the current baser still holds the committed base
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
        game.dealingStage = DealingStage.NONE;  // Note 103a
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
    let effectiveFinalBaser = (game.finalBaserSeat !== null && game.finalBaserSeat !== undefined)
        ? game.finalBaserSeat
        : ((game.finalBaser !== null && game.finalBaser !== undefined) ? game.finalBaser : game.pivot);
    let attackersSetFinalBase = !!(game.attackingTeam && game.attackingTeam.includes(effectiveFinalBaser));
    let multiplayCompensation = Number(game.multiplayCompensation) || 0;
    let counterScore = game.frameScore - multiplayCompensation;
    let baseScore = 0;
    let baseScoreBeforeSelfBaseHalf = 0;
    let baseScoreAfterSelfBaseHalf = 0;
    let baseScoreSelfBaseHalfApplied = false;
    let baseMultiplier = 1;
    let endingCompensation = 0;
    let finalScore = counterScore + multiplayCompensation;

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

        baseScoreBeforeSelfBaseHalf = engineCountScore(game.base) * baseMultiplier;
        baseScoreAfterSelfBaseHalf = engineApplyAttackersSelfBaseHalfToBaseScore(
            baseScoreBeforeSelfBaseHalf,
            game.gameConfig,
            attackersSetFinalBase
        );
        baseScoreSelfBaseHalfApplied = baseScoreAfterSelfBaseHalf !== baseScoreBeforeSelfBaseHalf;
        baseScore = baseScoreAfterSelfBaseHalf;
        finalScore += baseScore;
    }

    game.phase = GamePhase.GAME_OVER;

    // Compute ending compensation in canonical frame-score unit.
    // Note 48a: ending compensation = ending length * authoritative base multiplier / 2 * unit.
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
            let endingCompensationUnit = Number(game.gameConfig.endingCompensationUnit);
            if (!Number.isFinite(endingCompensationUnit)) endingCompensationUnit = 2;
            if (endingCompensationUnit < 1) endingCompensationUnit = 1;
            if (endingCompensationUnit > 10) endingCompensationUnit = 10;
            endingCompensation = endingLength * (baseMultiplier / 2) * endingCompensationUnit;
            finalScore += endingCompensation;
        }
    }

    // Keep authoritative total on game state in sync with finalized settlement.
    game.frameScore = finalScore;

    // Compute frame result (§12) — after all score components including ending compensation
    let frameResult = engineComputeFrameResult(finalScore);

    let scoreBreakdown = {
        counterScore,
        baseScoreBeforeSelfBaseHalf,
        baseScoreAfterSelfBaseHalf,
        baseScoreSelfBaseHalfApplied,
        baseScore,
        endingCompensation,
        multiplayCompensation,
        totalScore: finalScore,
    };

    return {
        totalScore: finalScore,
        counterScore,
        attackersWonBase,
        baseScoreBeforeSelfBaseHalf,
        baseScoreAfterSelfBaseHalf,
        baseScoreSelfBaseHalfApplied,
        baseScore,
        baseMultiplier,
        finalBaserSeat: effectiveFinalBaser,
        finalBaser: effectiveFinalBaser,
        attackersSetFinalBase,
        endingCompensation,
        multiplayCompensation,
        scoreBreakdown,
        endingCompensationActive: !!(game.gameConfig && game.gameConfig.endingCompensation),
        multiplayCompensationActive: multiplayCompensation !== 0,
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

function engineGetWinningHandCoreElement(cards) {
    let decomp = engineResolveLead(cards || []);
    let coreElement = decomp && decomp.coreElement ? decomp.coreElement : null;
    if (!coreElement || !Array.isArray(coreElement.cards) || coreElement.cards.length === 0) {
        return null;
    }
    return coreElement;
}

function engineIsValidKnockBackDestinationAbsolute(abs, startLevel, kbLevelSet) {
    if (abs < 0) return false;
    let cycleIndex = Math.floor(abs / 13);
    let level = engineCycleOffsetToLevel(abs % 13, startLevel);

    // Rigid floor: first-cycle start level is always the minimum destination.
    if (cycleIndex === 0 && level === startLevel) return true;

    // Same-rank-as-start in second+ cycles is never a destination.
    if (cycleIndex > 0 && level === startLevel) return false;

    return kbLevelSet.has(level);
}

function engineGetKnockBackDestinationAbsolute(player, currentAbs, stepCount = 1) {
    let cfg = game.gameConfig || {};
    let startLevel = engineGetConfiguredStartLevel();
    let kbLevels = Array.isArray(cfg.knockBackLevels) ? cfg.knockBackLevels : [];
    let kbLevelSet = new Set(kbLevels);
    let rigidFloorAbs = 0;
    let steps = Math.max(1, Math.floor(Number(stepCount) || 1));
    let cursor = currentAbs;

    for (let i = 0; i < steps; i++) {
        let found = null;
        for (let cand = cursor - 1; cand >= rigidFloorAbs; cand--) {
            if (engineIsValidKnockBackDestinationAbsolute(cand, startLevel, kbLevelSet)) {
                found = cand;
                break;
            }
        }

        if (found === null) {
            // Clamp at rigid SL boundary.
            return rigidFloorAbs;
        }
        cursor = found;
        if (cursor <= rigidFloorAbs) return rigidFloorAbs;
    }

    return Math.max(cursor, rigidFloorAbs);
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

    let pivotPassMode = (game.gameConfig && game.gameConfig.pivotPassMode) || 'winner-pivot';

    // Rotate mode: successor is always relative to current pivot and advancing direction.
    let nextPivot;
    if (pivotPassMode === 'rotate-pivot') {
        nextPivot = (game.pivot + 1) % NUM_PLAYERS;
    } else {
        // Winner mode (existing behavior): defense holds -> pivot's ally; attack wins -> first attacker in advancing direction.
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
    let cfg = game.gameConfig || {};
    let skipLevels = Array.isArray(cfg.skipLevels) ? new Set(cfg.skipLevels) : new Set();
    let processedSides = {};

    for (let p of advancingPlayers) {
        let sideIndex = engineGetSideIndexForPlayer(p);
        if (processedSides[sideIndex]) continue;
        processedSides[sideIndex] = true;

        let sidePlayers = engineGetPlayersForSide(sideIndex);
        let sideAnchor = sidePlayers[0];
        let current = newLevels[sideAnchor];
        let currentAbs = engineGetCycleAwareAbsoluteLevel(sideAnchor, current);

        // If currently at an uncleared blocker, cannot advance past it.
        let startOccurrence = delta > 0
            ? engineGetBlockingOccurrenceForPlayerInCycle(sideAnchor, current, engineGetPlayerCycleIndex(sideAnchor))
            : null;
        if (startOccurrence) {
            continue;  // Cannot advance, stay in place
        }

        // Count non-skipped steps, skipping over skipped ranks
        let targetAbs = currentAbs;
        let stepsAllowed = Math.abs(delta);
        let direction = delta > 0 ? 1 : -1;

        while (stepsAllowed > 0) {
            let nextAbs = targetAbs + direction;
            let cycleIndex = Math.floor(nextAbs / 13);
            let level = engineCycleOffsetToLevel(nextAbs % 13, startLevel);

            // Skip over skipped levels without counting them as a step
            if (skipLevels.has(level)) {
                targetAbs = nextAbs;
                continue;
            }

            // Land on the next level
            targetAbs = nextAbs;

            // Check for blocking occurrence (must-stop/must-defend/knock-back)
            let occurrence = engineGetBlockingOccurrenceForPlayerInCycle(sideAnchor, level, cycleIndex);
            if (occurrence) {
                break;  // Landed on blocker; do not pass it
            }

            stepsAllowed--;
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
    let knockBackStepCount = 1;
    if (knockBackTriggered) {
        let mode = (cfg && cfg.knockBackConditionMode) ? cfg.knockBackConditionMode : 'unlimited';
        let allowTwoStep = !!cfg.nonSingleKnockBackTwoSteps && mode !== 'singleT';
        if (allowTwoStep) {
            let lastRound = (game.roundHistory && game.roundHistory.length > 0)
                ? game.roundHistory[game.roundHistory.length - 1]
                : null;
            let winningCards = (lastRound && lastRound.played)
                ? (lastRound.played[lastRound.winner] || [])
                : [];
            let coreElement = engineGetWinningHandCoreElement(winningCards);
            let isNonSingleLevelerOnlyCore = !!(
                coreElement
                && Array.isArray(coreElement.cards)
                && coreElement.cards.length >= 2
                && coreElement.cards.every(card => card.rank === game.level)
            );
            if (isNonSingleLevelerOnlyCore) {
                knockBackStepCount = 2;
            }
        }
    }
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
            let destinationAbs = engineGetKnockBackDestinationAbsolute(sideAnchor, currentAbs, knockBackStepCount);
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

    let newCycleIndexBySide = (game.levelRuleState && Array.isArray(game.levelRuleState.cycleIndexBySide))
        ? game.levelRuleState.cycleIndexBySide.map(v => (Number.isInteger(v) && v >= 0 ? v : 0))
        : [0, 0];

    return {
        newLevels: newLevels,
        newCycleIndexBySide,
        nextPivot: frameResult.nextPivot,
        nextLevel: nextLevel,
        knockBackTriggered,
        knockBackStepCount,
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
