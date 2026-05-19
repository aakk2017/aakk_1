/**
 * pages/game/index.js
 * Entry point for the Shengji 3-bot 1-player game page.
 *
 * Handles:
 *   - DOM references and rendering
 *   - Card click / selection
 *   - Action button handlers
 *   - Game flow orchestration with bot turns
 */

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------
// gReferenceHandSurface: the bottom display hand surface — reference player's interactive hand.
const gReferenceHandSurface = document.getElementById('hand-bottom');

const gDeskSlots = [
    document.getElementById('desk-bottom'),
    document.getElementById('desk-right'),
    document.getElementById('desk-top'),
    document.getElementById('desk-left')
];
const gDeskDisplaySlots = {
    bottom: gDeskSlots[0],
    right: gDeskSlots[1],
    top: gDeskSlots[2],
    left: gDeskSlots[3],
};

const gDeskCenter  = document.getElementById('desk-center');
const gDeskInfo    = document.getElementById('desk-center-info');
const gBtnNewGame  = document.getElementById('btn-new-game');
const gBtnPlay     = document.getElementById('btn-play');
const gBtnPause    = document.getElementById('btn-pause');
const gGameActions = document.getElementById('game-actions');
// gBtnDeclare removed
const gDeclareMatrix = document.getElementById('declare-matrix');
const gDeclBtnsSingle = [0, 1, 2, 3, 4].map(i => document.getElementById('declare-btn-s' + i));
const gDeclBtnsDouble = [0, 1, 2, 3, 4].map(i => document.getElementById('declare-btn-d' + i));
const gPhaseInfo   = document.getElementById('game-phase-info');
const gGameLog     = document.getElementById('game-log');
const gStatusbar   = document.getElementById('statusbar');
const gErrorbar    = document.getElementById('errorbar');
const gScoreDiv    = document.getElementById('div-score');
const gScoreCont   = document.getElementById('div-score-container');
const gLevelDiv    = document.getElementById('div-denomination-level');
const gStrainDiv   = document.getElementById('div-denomination-strain');
const gDenomArea   = document.getElementById('div-denomination-area');
const gSeatsDiv    = document.getElementById('div-seats');
const gDeclareSp   = document.getElementById('span-declaration');
const gDeclMethodSp= document.getElementById('span-declare-method');
const gHint1Div    = document.getElementById('div-hint-1');
const gHint2Div    = document.getElementById('div-hint-2');
const gCounterDrawerInner = document.getElementById('counter-drawer-inner');
const gCounterDrawer = document.getElementById('counter-drawer');
const gBtnShowBase = document.getElementById('btn-show-base');
const gBasePreview = document.getElementById('base-preview');
const gCountingDialog  = document.getElementById('counting-dialog');
const gCountingOverlay = document.getElementById('counting-overlay');
const gDeskCenterLeft  = document.getElementById('desk-center-left');
const gDeskCenterRight = document.getElementById('desk-center-right');
const gBtnNoDeclare    = document.getElementById('btn-no-declare');
const gBtnGameSettings = document.getElementById('btn-game-settings');
const gBotPassiveDeclarationSwitch = document.getElementById('switch-bot-passive-declaration');
const gBotPassiveDeclarationState = document.getElementById('span-bot-passive-declaration-state');
const gSettingsOverlay = document.getElementById('settings-overlay');
const gSettingsDialog  = document.getElementById('settings-dialog');
const gSettingsTitle   = document.getElementById('settings-title');
const gSettingsSubtitle= document.getElementById('settings-subtitle');
const gSettingsBody    = document.getElementById('settings-body');
const gSettingsDisplayPlaceholder = document.getElementById('settings-display-placeholder');
const gSettingsPlaceholderPanel = document.getElementById('settings-placeholder-panel');
const gSettingsTabRow  = document.getElementById('settings-tab-row');
const gBtnSettingsCancel = document.getElementById('btn-settings-cancel');
const gBtnSettingsConfirm = document.getElementById('btn-settings-confirm');
const gSettingsTabs = Array.from(document.querySelectorAll('#settings-tab-row .settings-tab'));
const gSettingsTopLevelTabs = Array.from(document.querySelectorAll('#settings-toplevel-tabs .settings-toplevel-tab'));
const gPauseOverlay = document.getElementById('pause-overlay');
const gPauseDialog = document.getElementById('pause-dialog');
const gPauseDialogTitle = document.getElementById('pause-dialog-title');
const gPauseDialogMessage = document.getElementById('pause-dialog-message');
const gPauseDialogCountdown = document.getElementById('pause-dialog-countdown');
const gPauseAgreementHost = document.getElementById('pause-agreement-host');
const gPauseHumanControls = document.getElementById('pause-human-controls');
const gPausePrimaryControls = document.getElementById('pause-primary-controls');
const gPauseQuitConfirm = document.getElementById('pause-quit-confirm');
const gPauseQuitConfirmText = document.getElementById('pause-quit-confirm-text');
const gBtnPauseQuitCancel = document.getElementById('btn-pause-quit-cancel');
const gBtnPauseQuitConfirm = document.getElementById('btn-pause-quit-confirm');

// ---------------------------------------------------------------------------
// 4P display-position mapping
// ---------------------------------------------------------------------------
const FOUR_P_NATURAL_POSITIONS = ['south', 'east', 'north', 'west'];

// ---------------------------------------------------------------------------
// 3PDA position helpers (Note 62 — placeholder + pure helper model)
//
// These constants and functions are INERT in Note 62.
// No 3PDA game state is created; gameplay start is blocked in
// confirmCreateGameFromSettings when tableFormat === 'three-player-dummy-ally'.
// ---------------------------------------------------------------------------

// The three real natural positions for 3PDA.
// Dummy/Ay is NOT a real natural position — it is a frame role.
const THREE_PDA_REAL_NATURAL_POSITIONS = ['N', 'Sw', 'Se'];

// Dummy/ally is a frame-role label, not a natural position.
const THREE_PDA_DUMMY_ROLE    = 'Ay';
const THREE_PDA_DUMMY_LABEL_EN = 'Ay';
const THREE_PDA_DUMMY_LABEL_ZH = '明';

// i18n labels for real natural positions.
// NOTE (Note 62a): these constants are retained as semantic helper-test labels only.
// Display labels for UI are now owned by i18n (naturalPositions3PDA / dummyRoles namespaces).
const THREE_PDA_NATURAL_POSITION_LABELS = {
    en: { N: 'N', Sw: 'Sw', Se: 'Se' },
    zh: { N: '子', Sw: '申', Se: '辰' },   // corrected per Note 62b: Sw=申, Se=辰
};

// Inter-frame pivot-passing order: N → Sw → Se → N (CCW real-player cycle).
const THREE_PDA_PIVOT_NEXT = { N: 'Sw', Sw: 'Se', Se: 'N' };

/**
 * Returns the next 3PDA pivot natural position in the inter-frame cycle.
 * Throws if the input is not a valid real natural position (Ay/dummy is rejected).
 */
function getNext3PDAPivotNaturalPosition(currentPivotNaturalPosition) {
    if (!(currentPivotNaturalPosition in THREE_PDA_PIVOT_NEXT)) {
        throw new Error(
            'getNext3PDAPivotNaturalPosition: invalid pivot "' + currentPivotNaturalPosition +
            '". Must be one of N/Sw/Se (Ay/dummy is not eligible as pivot).'
        );
    }
    return THREE_PDA_PIVOT_NEXT[currentPivotNaturalPosition];
}

/**
 * Returns true if value is a valid 3PDA real natural position (N, Sw, or Se).
 * Ay/dummy and all 4P positions return false.
 */
function is3PDARealNaturalPosition(value) {
    return THREE_PDA_REAL_NATURAL_POSITIONS.includes(value);
}

/**
 * Validates and returns the value as a 3PDA real natural position.
 * Throws for Ay, 4P positions south/east/north/west, numeric indices, or any other input.
 */
function normalize3PDAPivotNaturalPosition(value) {
    if (!THREE_PDA_REAL_NATURAL_POSITIONS.includes(value)) {
        throw new Error(
            'normalize3PDAPivotNaturalPosition: "' + value + '"' +
            ' is not a valid 3PDA real natural position. Must be N, Sw, or Se.' +
            ' Ay/dummy is not eligible as pivot; 4P positions are not valid.'
        );
    }
    return value;
}

/**
 * Creates an immutable 3PDA pivot-passing state object.
 * State update policy: immutable — advance3PDAPivotPassingState returns a new object
 * and does not mutate the input.
 * @param {string} initialPivotNaturalPosition - N, Sw, or Se
 * @returns {Readonly<{ currentPivot: string }>}
 */
function create3PDAPivotPassingState(initialPivotNaturalPosition) {
    normalize3PDAPivotNaturalPosition(initialPivotNaturalPosition);
    return Object.freeze({ currentPivot: initialPivotNaturalPosition });
}

/**
 * Returns the current pivot natural position from a pivot-passing state.
 */
function getCurrent3PDAPivotNaturalPosition(pivotState) {
    return pivotState.currentPivot;
}

/**
 * Returns the next pivot natural position without advancing the state.
 */
function peekNext3PDAPivotNaturalPosition(pivotState) {
    return getNext3PDAPivotNaturalPosition(pivotState.currentPivot);
}

/**
 * Returns a new pivot-passing state advanced by one inter-frame step.
 * The original state is NOT mutated (immutable update policy).
 * @param {Readonly<{ currentPivot: string }>} pivotState
 * @returns {Readonly<{ currentPivot: string }>}
 */
function advance3PDAPivotPassingState(pivotState) {
    return Object.freeze({ currentPivot: getNext3PDAPivotNaturalPosition(pivotState.currentPivot) });
}

/**
 * Returns an array of frameCount pivot natural positions starting from initialPivotNaturalPosition.
 * @param {string} initialPivotNaturalPosition - N, Sw, or Se
 * @param {number} frameCount
 * @returns {string[]}
 */
function get3PDAPivotSequence(initialPivotNaturalPosition, frameCount) {
    normalize3PDAPivotNaturalPosition(initialPivotNaturalPosition);
    let sequence = [];
    let current = initialPivotNaturalPosition;
    for (let i = 0; i < frameCount; i++) {
        sequence.push(current);
        current = THREE_PDA_PIVOT_NEXT[current];
    }
    return sequence;
}

/**
 * Developer-only simulation helper — not user-facing, not reachable via normal UI.
 * Returns an array of pivot positions for frameCount frames starting from initialPivot.
 */
function simulate3PDAPivotPassing(initialPivot, frameCount) {
    return get3PDAPivotSequence(initialPivot, frameCount);
}

// In-frame action cycle for a given pivot: pivot -> successor -> ally(Ay) -> predecessor -> pivot.
// Real-player cycle determines the successor/predecessor.
const THREE_PDA_PIVOT_FRAME_ROLES = {
    N:  { pivot: 'N',  successor: 'Sw', ally: 'Ay', predecessor: 'Se' },
    Sw: { pivot: 'Sw', successor: 'Se', ally: 'Ay', predecessor: 'N'  },
    Se: { pivot: 'Se', successor: 'N',  ally: 'Ay', predecessor: 'Sw' },
};

/**
 * Returns the in-frame roles object for the given real pivot natural position.
 * { pivot, successor, ally, predecessor }
 * ally is always 'Ay' (dummy).
 */
function get3PDAFrameRolesForPivot(pivotNaturalPosition) {
    if (!(pivotNaturalPosition in THREE_PDA_PIVOT_FRAME_ROLES)) {
        throw new Error(
            'get3PDAFrameRolesForPivot: invalid pivot "' + pivotNaturalPosition +
            '". Must be one of N/Sw/Se.'
        );
    }
    return { ...THREE_PDA_PIVOT_FRAME_ROLES[pivotNaturalPosition] };
}

/**
 * Returns the reference-relative display position for a given frame actor,
 * given a reference actor, within the frame defined by pivotNaturalPosition.
 *
 * The in-frame action cycle is:
 *   pivot -> successor -> ally(Ay) -> predecessor -> pivot
 * which maps to reference positions:
 *   reference -> afterhand -> opposite -> forehand -> reference
 *
 * @param {string} frameActor     - N, Sw, Se, or Ay
 * @param {string} referenceActor - N, Sw, Se, or Ay (the observer)
 * @param {string} pivotNaturalPosition - N, Sw, or Se
 * @returns {'reference'|'afterhand'|'opposite'|'forehand'}
 */
function get3PDAReferencePositionForActor(frameActor, referenceActor, pivotNaturalPosition) {
    let roles = get3PDAFrameRolesForPivot(pivotNaturalPosition);
    // Build ordered frame sequence: pivot, successor, ally, predecessor
    let frameOrder = [roles.pivot, roles.successor, roles.ally, roles.predecessor];
    let refPositions = ['reference', 'afterhand', 'opposite', 'forehand'];
    let refIndex = frameOrder.indexOf(referenceActor);
    let actorIndex = frameOrder.indexOf(frameActor);
    if (refIndex < 0) {
        throw new Error('get3PDAReferencePositionForActor: reference "' + referenceActor + '" not in frame');
    }
    if (actorIndex < 0) {
        throw new Error('get3PDAReferencePositionForActor: actor "' + frameActor + '" not in frame');
    }
    let offset = (actorIndex - refIndex + 4) % 4;
    return refPositions[offset];
}

// ---------------------------------------------------------------------------
// Note 64 — 3PDA in-frame construction model
// Constructs a 4-actor frame model: N, Sw, Se (real) + Ay (dummy/ally).
// These helpers are INERT — no live game is created from them.
// ---------------------------------------------------------------------------

const THREE_PDA_FRAME_ACTOR_IDS = ['N', 'Sw', 'Se', 'Ay'];

/**
 * Constructs a 3PDA in-frame model for the given pivot natural position.
 * Returns a frozen frame model object with full role/actor/cycle mappings.
 * @param {string} pivotNaturalPosition - must be N, Sw, or Se (Ay and 4P positions are rejected)
 */
function create3PDAFrameModel(pivotNaturalPosition) {
    if (!THREE_PDA_REAL_NATURAL_POSITIONS.includes(pivotNaturalPosition)) {
        throw new Error(
            'create3PDAFrameModel: invalid pivot "' + pivotNaturalPosition + '".' +
            ' Must be one of N/Sw/Se. Ay/dummy is not eligible as pivot;' +
            ' 4P positions (north/south/east/west) and numeric indices are not valid.'
        );
    }
    let roles = get3PDAFrameRolesForPivot(pivotNaturalPosition);
    // pivot -> successor -> ally(Ay) -> predecessor -> pivot
    let actionCycle = [roles.pivot, roles.successor, roles.ally, roles.predecessor];

    let frameActors = [
        { frameActorId: roles.pivot,       actorKind: 'real',  realNaturalPosition: roles.pivot,       frameRole: 'pivot'       },
        { frameActorId: roles.successor,   actorKind: 'real',  realNaturalPosition: roles.successor,   frameRole: 'successor'   },
        { frameActorId: 'Ay',              actorKind: 'dummy', realNaturalPosition: null,               frameRole: 'ally'        },
        { frameActorId: roles.predecessor, actorKind: 'real',  realNaturalPosition: roles.predecessor, frameRole: 'predecessor' },
    ];

    let roleToActor = {
        pivot:       roles.pivot,
        successor:   roles.successor,
        ally:        'Ay',
        predecessor: roles.predecessor,
    };

    let actorToRole = {};
    actorToRole[roles.pivot]       = 'pivot';
    actorToRole[roles.successor]   = 'successor';
    actorToRole['Ay']              = 'ally';
    actorToRole[roles.predecessor] = 'predecessor';

    return Object.freeze({
        tableFormat:             'three-player-dummy-ally',
        pivotNaturalPosition:    pivotNaturalPosition,
        realNaturalPositions:    ['N', 'Sw', 'Se'],
        dummyActorId:            'Ay',
        frameActors:             Object.freeze(frameActors.map(Object.freeze)),
        actionCycle:             Object.freeze(actionCycle),
        roleToActor:             Object.freeze(roleToActor),
        actorToRole:             Object.freeze(actorToRole),
    });
}

/**
 * Constructs a 3PDA frame model from a pivot-passing state (from Note 63).
 * Does NOT mutate or advance the pivot state.
 */
function create3PDAFrameModelFromPivotState(pivotPassingState) {
    let pivot = getCurrent3PDAPivotNaturalPosition(pivotPassingState);
    return create3PDAFrameModel(pivot);
}

/** Returns the array of 4 frame actor descriptors. */
function get3PDAFrameActors(frameModel) {
    return frameModel.frameActors;
}

/** Returns the action cycle array [pivot, successor, ally, predecessor]. */
function get3PDAFrameActionCycle(frameModel) {
    return frameModel.actionCycle;
}

/** Returns the frameActorId for the given frameRole. Throws for invalid role. */
function get3PDAFrameActorForRole(frameModel, frameRole) {
    if (!(frameRole in frameModel.roleToActor)) {
        throw new Error('get3PDAFrameActorForRole: invalid role "' + frameRole + '". Must be pivot/successor/ally/predecessor.');
    }
    return frameModel.roleToActor[frameRole];
}

/** Returns the frameRole for the given frameActorId. Throws for invalid actor. */
function get3PDAFrameRoleForActor(frameModel, frameActorId) {
    if (!(frameActorId in frameModel.actorToRole)) {
        throw new Error('get3PDAFrameRoleForActor: invalid actor "' + frameActorId + '". Must be one of N/Sw/Se/Ay present in this frame.');
    }
    return frameModel.actorToRole[frameActorId];
}

/** Returns true if frameActorId is one of the four frame actors in this frame. */
function is3PDAFrameActor(frameModel, frameActorId) {
    return frameActorId in frameModel.actorToRole;
}

/** Returns true if frameActorId is a real (non-dummy) frame actor. */
function is3PDAFrameRealActor(frameModel, frameActorId) {
    let actor = frameModel.frameActors.find(a => a.frameActorId === frameActorId);
    return actor != null && actor.actorKind === 'real';
}

/** Returns true only if frameActorId is 'Ay' (dummy actor). */
function is3PDAFrameDummyActor(frameModel, frameActorId) {
    let actor = frameModel.frameActors.find(a => a.frameActorId === frameActorId);
    return actor != null && actor.actorKind === 'dummy';
}

/**
 * Returns the realNaturalPosition for a frame actor, or null for Ay.
 * Throws for an invalid actor.
 */
function get3PDARealNaturalPositionForFrameActor(frameModel, frameActorId) {
    let actor = frameModel.frameActors.find(a => a.frameActorId === frameActorId);
    if (!actor) {
        throw new Error('get3PDARealNaturalPositionForFrameActor: "' + frameActorId + '" is not a frame actor in this frame.');
    }
    return actor.realNaturalPosition; // null for Ay
}

/**
 * Returns the reference-relative position of frameActorId relative to referenceFrameActorId.
 * Uses the frame action cycle: reference -> afterhand -> opposite -> forehand.
 * Delegates to the existing get3PDAReferencePositionForActor which uses pivotNaturalPosition.
 */
function get3PDAReferencePositionForFrameActor(frameModel, frameActorId, referenceFrameActorId) {
    return get3PDAReferencePositionForActor(frameActorId, referenceFrameActorId, frameModel.pivotNaturalPosition);
}

// ---------------------------------------------------------------------------
// End of Note 64 helpers
// ---------------------------------------------------------------------------

const FOUR_P_REFERENCE_POSITIONS = ['reference', 'afterhand', 'opposite', 'forehand'];
const FOUR_P_REFERENCE_TO_DISPLAY_POSITION = {
    reference: 'bottom',
    afterhand: 'right',
    opposite: 'top',
    forehand: 'left',
};
const FOUR_P_DISPLAY_TO_REFERENCE_POSITION = {
    bottom: 'reference',
    right: 'afterhand',
    top: 'opposite',
    left: 'forehand',
};

function normalize4PUserNaturalPosition(value) {
    return ['east', 'north', 'west', 'south'].includes(value) ? value : 'east';
}

function getActorSeatFor4PNaturalPosition(naturalPosition) {
    let normalized = normalize4PUserNaturalPosition(naturalPosition);
    let seat = FOUR_P_NATURAL_POSITIONS.indexOf(normalized);
    return seat >= 0 ? seat : 1;
}

function getNaturalPositionFor4PActorSeat(actorSeat) {
    let seat = Number(actorSeat);
    return FOUR_P_NATURAL_POSITIONS[seat] || 'east';
}

function getReferencePositionFor4PActorSeat(actorSeat, referenceActorSeat = HUMAN_PLAYER) {
    let seat = Number(actorSeat);
    let reference = Number(referenceActorSeat);
    if (!Number.isInteger(seat) || !Number.isInteger(reference)) return 'reference';
    return FOUR_P_REFERENCE_POSITIONS[(seat - reference + NUM_PLAYERS) % NUM_PLAYERS];
}

function getDisplayPositionForReferencePosition(referencePosition) {
    return FOUR_P_REFERENCE_TO_DISPLAY_POSITION[referencePosition] || 'bottom';
}

function getDisplayPositionFor4PActorSeat(actorSeat, referenceActorSeat = HUMAN_PLAYER) {
    return getDisplayPositionForReferencePosition(getReferencePositionFor4PActorSeat(actorSeat, referenceActorSeat));
}

function getActorSeatFor4PDisplayPosition(displayPosition, referenceActorSeat = HUMAN_PLAYER) {
    let referencePosition = FOUR_P_DISPLAY_TO_REFERENCE_POSITION[displayPosition] || 'reference';
    let offset = FOUR_P_REFERENCE_POSITIONS.indexOf(referencePosition);
    let reference = Number(referenceActorSeat);
    if (!Number.isInteger(reference) || offset < 0) return getActorSeatFor4PNaturalPosition('east');
    return (reference + offset) % NUM_PLAYERS;
}

function getReferencePositionForDisplayPosition(displayPosition) {
    return FOUR_P_DISPLAY_TO_REFERENCE_POSITION[displayPosition] || 'reference';
}

function getActorSeatFor4PReferencePosition(referencePosition, referenceActorSeat = HUMAN_PLAYER) {
    let offset = FOUR_P_REFERENCE_POSITIONS.indexOf(referencePosition);
    let reference = Number(referenceActorSeat);
    if (!Number.isInteger(reference) || offset < 0) return reference;
    return (reference + offset) % NUM_PLAYERS;
}

function getHandSurfaceForDisplayPosition(displayPosition) {
    // Only 'bottom' has an interactive hand surface in 4P; top/left/right are desk-slot only.
    return displayPosition === 'bottom' ? gReferenceHandSurface : null;
}

function getNamebarContainerFor4PActorSeat(actorSeat, referenceActorSeat = HUMAN_PLAYER) {
    let slot = getDeskSlotFor4PActorSeat(actorSeat, referenceActorSeat);
    return slot ? slot.querySelector('.desk-namebar') : null;
}

function getDeskSlotForDisplayPosition(displayPosition) {
    return gDeskDisplaySlots[displayPosition] || null;
}

function getDeskSlotFor4PActorSeat(actorSeat, referenceActorSeat = HUMAN_PLAYER) {
    return getDeskSlotForDisplayPosition(getDisplayPositionFor4PActorSeat(actorSeat, referenceActorSeat));
}

for (let position in gDeskDisplaySlots) {
    if (gDeskDisplaySlots[position]) gDeskDisplaySlots[position].setAttribute('data-display-position', position);
}

function buildHumanPlayerSetForCurrentMode() {
    let primary = Number.isInteger(Number(HUMAN_PLAYER)) ? Number(HUMAN_PLAYER) : getActorSeatFor4PNaturalPosition('east');
    if (!TEST_MODE) return new Set([primary]);
    return new Set([primary, (primary + 1) % NUM_PLAYERS]);
}

function refreshHumanPlayersForMode() {
    HUMAN_PLAYERS = buildHumanPlayerSetForCurrentMode();
}

function applyUserNaturalPositionFor4P(userNaturalPosition) {
    HUMAN_PLAYER = getActorSeatFor4PNaturalPosition(userNaturalPosition);
    activeHumanPlayer = HUMAN_PLAYER;
    refreshHumanPlayersForMode();
}

// ---------------------------------------------------------------------------
// Test mode: human controls the selected reference seat, plus its afterhand.
// ---------------------------------------------------------------------------
let TEST_MODE = false;
let HUMAN_PLAYERS = buildHumanPlayerSetForCurrentMode();
function isHumanControlled(player) { return HUMAN_PLAYERS.has(player); }

function toggleTestMode() {
    TEST_MODE = !TEST_MODE;
    refreshHumanPlayersForMode();
    const btn = document.getElementById('btn-toggle-test');
    if (btn) btn.textContent = t(TEST_MODE ? 'buttons.testModeOn' : 'buttons.testModeOff');
}

let gBotDeclarationMode = 'normal';

function isPassiveDeclarationBotMode() {
    return gBotDeclarationMode === 'passive';
}

function syncBotDeclarationModeSwitchUi() {
    if (gBotPassiveDeclarationSwitch) {
        gBotPassiveDeclarationSwitch.checked = isPassiveDeclarationBotMode();
    }
    if (gBotPassiveDeclarationState) {
        gBotPassiveDeclarationState.textContent = t(isPassiveDeclarationBotMode()
            ? 'buttons.botDeclarationModePassive'
            : 'buttons.botDeclarationModeNormal');
    }
}

function setBotDeclarationMode(mode) {
    gBotDeclarationMode = (mode === 'passive') ? 'passive' : 'normal';
    syncBotDeclarationModeSwitchUi();
}

window.isPassiveDeclarationBotMode = isPassiveDeclarationBotMode;
window.getBotDeclarationMode = function() { return gBotDeclarationMode; };

// Track which human-controlled player's hand is currently displayed
let activeHumanPlayer = HUMAN_PLAYER;

// ForehandControlInteractionState
// When active: { target, controller, exposedDivisionCards, exposedCardIds: Set,
//   selectedCornerIds: Set, mode: string|null, selectionMounted: bool, commitButtonsMounted: bool }
let gFCInteraction = null;

// Settings dialog state (note 34 / 35c)
let gSettingsMode = 'create'; // 'create' | 'inspect'
let gSettingsActiveTab = 'table';
let gSettingsTopLevelTab = 'game'; // 'game' | 'seat' | 'display' | 'file' | 'accounts'
let gSettingsDraftRuleConfig = null;
let gSettingsDraftDisplaySettings = { placeholder: true };
let gResolvedGameSettings = null;
let gLevelsMatrixDraftState = null;

// Note 65 — 3PDA preview local UI state (not live game state; pure draft only)
let g3PDAPreviewPivot = 'N';     // default preview pivot
let g3PDAPreviewReference = 'Sw'; // default reference (successor of N)

// Note 68 — 3PDA selected real natural seat (separate from 4P selected seat and debug reference).
// Valid values: N, Sw, Se (Ay is never a valid real seat).
// Stored in gSettingsDraftDisplaySettings.user3PDARealNaturalPosition.
// 4P selected seat is stored in gSettingsDraftDisplaySettings.userNaturalPosition (east/north/west/south).
// These two must never be conflated.

const THREE_PDA_REAL_NATURAL_POSITIONS_SET = new Set(['N', 'Sw', 'Se']);

/**
 * Normalizes a candidate value to a valid 3PDA real natural position.
 * Returns 'N' for any invalid value (including Ay, null, undefined, 4P positions).
 */
function normalize3PDARealNaturalPosition(value) {
    return THREE_PDA_REAL_NATURAL_POSITIONS_SET.has(value) ? value : 'N';
}

/** Returns the draft selected 3PDA real natural seat (N/Sw/Se). Never returns Ay. */
function getDraftUser3PDARealNaturalPosition() {
    let source = gSettingsDraftDisplaySettings || {};
    return normalize3PDARealNaturalPosition(source.user3PDARealNaturalPosition);
}

/** Sets the draft selected 3PDA real natural seat. Normalizes and rejects Ay. */
function setDraftUser3PDARealNaturalPosition(value) {
    if (!gSettingsDraftDisplaySettings) gSettingsDraftDisplaySettings = { placeholder: true };
    gSettingsDraftDisplaySettings.user3PDARealNaturalPosition = normalize3PDARealNaturalPosition(value);
}

/**
 * Returns the real-game 3PDA reference actor ID for the given shell state.
 * Uses the stored selected3PDARealNaturalPosition — never returns Ay.
 * Does not depend on current pivot, successor, or debug reference.
 * @param {Object} shellState
 * @returns {'N'|'Sw'|'Se'}
 */
function get3PDARealGameReferenceActorId(shellState) {
    return normalize3PDARealNaturalPosition(shellState && shellState.selected3PDARealNaturalPosition);
}

// ---------------------------------------------------------------------------
// Note 69 — Phase guard helpers for 3PDA shell / frame-start boundary
// ---------------------------------------------------------------------------

/** Returns true if state is a 3PDA shell state (not a 4P game state). */
function isThreePDAShellState(state) {
    return !!(state && state.kind === 'three-player-dummy-ally-shell');
}

/**
 * Returns true if state is a 3PDA shell state in the non-card frame-start shell phase.
 * Phase 'three-pda-frame-start-shell' is distinct from all 4P playable phases:
 * dealing / declaring / basing / playing / counting / paused / game-over
 */
function isThreePDAFrameStartShellPhase(state) {
    return isThreePDAShellState(state) && state.phase === 'three-pda-frame-start-shell';
}

/**
 * Asserts that state is a 3PDA non-card frame-start shell.
 * Throws if called on a 4P game state or wrong/missing phase.
 * Use before any code that must not run on playable/card game state.
 */
function assertThreePDAFrameStartShellPhase(state) {
    if (!isThreePDAFrameStartShellPhase(state)) {
        throw new Error('Expected 3PDA frame-start shell phase but got: ' +
            (state ? JSON.stringify({ kind: state.kind, phase: state.phase }) : String(state)));
    }
}

// ---------------------------------------------------------------------------
// Note 70 — 3PDA deck / hand-count / card-zone planning only
//
// These helpers define the future card-zone schema and count formulas.
// PLANNING ONLY: no actual deck, hand, or card arrays are created here.
// No dealing, shuffling, qz, scoring, or card-phase logic.
// Legacy internal name for base/bottom cards: kitty (engine). User-facing: base/bottom/底牌.
// ---------------------------------------------------------------------------

/**
 * Returns total card count for a given deck count.
 * Formula: 54 * deckCount (each standard deck has 54 cards including 2 jokers).
 * For deckCount=2: 108.
 * PLANNING ONLY — does not produce card objects.
 */
function get3PDATotalCardCount(deckCount) {
    return 54 * (Number(deckCount) || 2);
}

/**
 * Returns the base/bottom card count for a given deck count.
 * Uses the same fixed BASE_SIZE=8 as the existing 4P Shengji engine (shengji_engine.js line 26).
 * The engine constant BASE_SIZE is fixed at 8 regardless of deck count.
 * Note: legacy internal name 'kitty' = base/bottom cards (user-facing term).
 * PLANNING ONLY — does not assign actual base cards.
 * @param {number} deckCount - number of decks (typically 2)
 * @returns {number} base card count (8 for standard game)
 */
function get3PDABaseCardCount(deckCount) {
    // Mirrors engine's BASE_SIZE = 8 (fixed, not scaled by deck count).
    // If the project ever changes BASE_SIZE per deck count, update here too.
    void deckCount; // currently not used — fixed per engine convention
    return 8;
}

/**
 * Creates a planning-only 3PDA card-zone schema.
 * Returns metadata about future card zones and count formulas.
 * PLANNING ONLY: cardZonePlanOnly=true; no card arrays, no live state.
 *
 * @param {{ deckCount?: number }} [settings] - optional; defaults to deckCount=2
 * @returns {Object} planning schema (immutable-style plain object)
 */
function create3PDACardZonePlan(settings) {
    let deckCount = Number((settings && settings.deckCount) || 2);
    let totalCards = get3PDATotalCardCount(deckCount);
    let baseCardCount = get3PDABaseCardCount(deckCount);
    let dealtToHandsTotal = totalCards - baseCardCount;
    let handZoneCount = 4; // N, Sw, Se, Ay
    let cardsPerHandZone = dealtToHandsTotal / handZoneCount;

    return {
        // Planning marker — must remain true. Never set to false without implementing real cards.
        cardZonePlanOnly: true,

        tableFormat: 'three-player-dummy-ally',

        // Deck configuration
        deckCount: deckCount,
        totalCards: totalCards,

        // Real player hand zones (natural positions, pivot-eligible)
        realPlayerHandZones: ['N', 'Sw', 'Se'],

        // Dummy/ally hand zone (not a real natural position, not pivot-eligible)
        dummyHandZone: 'Ay',

        // All actor hand zones combined (real players + dummy)
        actorHandZones: ['N', 'Sw', 'Se', 'Ay'],

        // Non-actor zones (base/bottom cards — not a player, not Ay)
        nonActorZones: ['base'],

        // Base/bottom zone identifier (user-facing: base/bottom/底牌; legacy internal: kitty)
        baseZone: 'base',

        // Pivot-eligible actors (real natural positions only — Ay excluded)
        pivotEligibleActors: ['N', 'Sw', 'Se'],

        // Non-pivot actors (dummy — not a real natural position)
        nonPivotActors: ['Ay'],

        // Count formulas (planning only — no arrays allocated)
        baseCardCount: baseCardCount,
        dealtToHandsTotal: dealtToHandsTotal,
        handZoneCount: handZoneCount,
        cardsPerHandZone: cardsPerHandZone,

        // Notes for documentation
        notes: {
            Ay: 'dummy/ally hand zone — not a real natural position, not pivot-eligible',
            base: 'base/bottom cards — not an actor, not a hand zone (legacy internal: kitty)',
            cardZonePlanOnly: 'No cards allocated. This schema is planning metadata only.',
        },
    };
}

/**
 * Validates a 3PDA card-zone plan object.
 * Returns { valid: true } or { valid: false, errors: [...] }.
 * PLANNING ONLY.
 */
function validate3PDACardZonePlan(plan) {
    let errors = [];
    if (!plan || !plan.cardZonePlanOnly)
        errors.push('cardZonePlanOnly must be true');
    if (!Array.isArray(plan.realPlayerHandZones) || !['N','Sw','Se'].every(z => plan.realPlayerHandZones.includes(z)))
        errors.push('realPlayerHandZones must include N, Sw, Se');
    if (plan.dummyHandZone !== 'Ay')
        errors.push('dummyHandZone must be Ay');
    if (plan.realPlayerHandZones && plan.realPlayerHandZones.includes('Ay'))
        errors.push('Ay must not be in realPlayerHandZones');
    if (!Array.isArray(plan.pivotEligibleActors) || plan.pivotEligibleActors.includes('Ay'))
        errors.push('Ay must not be in pivotEligibleActors');
    if (!Array.isArray(plan.nonActorZones) || !plan.nonActorZones.includes('base'))
        errors.push('nonActorZones must include base');
    if (plan.baseZone !== 'base')
        errors.push('baseZone must be base');
    if (plan.dealtToHandsTotal % plan.handZoneCount !== 0)
        errors.push('dealtToHandsTotal must be divisible by handZoneCount');
    if (plan.totalCards !== 54 * plan.deckCount)
        errors.push('totalCards must equal 54 * deckCount');
    return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

// ---------------------------------------------------------------------------
// Note 71 — 3PDA planned hand/base state shape, no card allocation
//
// These helpers define the future hand/base state shape as planning metadata.
// PLANNING ONLY: planOnly=true; zones have cards=null; no card objects generated.
// Depends on Note 70 helpers: create3PDACardZonePlan, get3PDATotalCardCount,
// get3PDABaseCardCount.
// ---------------------------------------------------------------------------

/**
 * Creates a planning-only 3PDA hand/base state shape.
 * All zone `cards` fields are null — no card objects are created.
 * Future dealing will fill these zones; this note only defines their shape.
 *
 * @param {Object|{ deckCount?: number }} [settingsOrPlan]
 *   Either a raw settings object (with optional .deckCount) or the output of
 *   create3PDACardZonePlan(). Both paths produce the same result.
 * @returns {Object} planned card state shape (plain object, planOnly=true)
 */
function create3PDAPlannedCardStateShape(settingsOrPlan) {
    // Accept either a card-zone plan (Note 70) or a raw settings object.
    let plan = (settingsOrPlan && settingsOrPlan.cardZonePlanOnly)
        ? settingsOrPlan
        : create3PDACardZonePlan(settingsOrPlan);

    let cpz = plan.cardsPerHandZone; // 25 for standard 2-deck
    let bcc = plan.baseCardCount;    // 8 for standard 2-deck

    return {
        kind: 'three-pda-planned-card-state',
        // PLANNING ONLY marker — must remain true until real cards are implemented.
        planOnly: true,

        tableFormat: 'three-player-dummy-ally',

        // Formula-driven count fields (see Note 70)
        deckCount:          plan.deckCount,
        totalCards:         plan.totalCards,
        baseCardCount:      bcc,
        dealtToHandsTotal:  plan.dealtToHandsTotal,
        cardsPerHandZone:   cpz,

        // Ordered list of hand zones (actor zones only; base is separate)
        handZoneOrder: ['N', 'Sw', 'Se', 'Ay'],

        // Base zone identifier
        baseZoneId: 'base',

        // Zone definitions — cards: null in all zones (no card allocation)
        zones: {
            N: {
                zoneId:              'N',
                zoneKind:            'real-player-hand',
                frameActorId:        'N',
                realNaturalPosition: 'N',
                isRealPlayer:        true,
                isDummy:             false,
                isActorZone:         true,
                isBaseZone:          false,
                expectedCount:       cpz,
                cards:               null, // Note 71: no card allocation
            },
            Sw: {
                zoneId:              'Sw',
                zoneKind:            'real-player-hand',
                frameActorId:        'Sw',
                realNaturalPosition: 'Sw',
                isRealPlayer:        true,
                isDummy:             false,
                isActorZone:         true,
                isBaseZone:          false,
                expectedCount:       cpz,
                cards:               null,
            },
            Se: {
                zoneId:              'Se',
                zoneKind:            'real-player-hand',
                frameActorId:        'Se',
                realNaturalPosition: 'Se',
                isRealPlayer:        true,
                isDummy:             false,
                isActorZone:         true,
                isBaseZone:          false,
                expectedCount:       cpz,
                cards:               null,
            },
            Ay: {
                zoneId:              'Ay',
                zoneKind:            'dummy-hand',
                frameActorId:        'Ay',
                realNaturalPosition: null,  // Ay is not a real natural position
                isRealPlayer:        false,
                isDummy:             true,
                isActorZone:         true,
                isBaseZone:          false,
                expectedCount:       cpz,
                cards:               null,
            },
            base: {
                zoneId:              'base',
                zoneKind:            'base-bottom',
                frameActorId:        null,  // base is not an actor
                realNaturalPosition: null,
                isRealPlayer:        false,
                isDummy:             false,
                isActorZone:         false,
                isBaseZone:          true,
                expectedCount:       bcc,
                cards:               null,
            },
        },
    };
}

/**
 * Validates a planned 3PDA hand/base state shape.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 * Rejects any shape that contains actual card arrays or card IDs.
 * PLANNING ONLY.
 */
function validate3PDAPlannedCardStateShape(state) {
    let errors = [];
    if (!state || !state.planOnly)
        errors.push('planOnly must be true');
    if (!state || state.kind !== 'three-pda-planned-card-state')
        errors.push('kind must be three-pda-planned-card-state');
    if (!state || !state.zones)
        return { valid: false, errors: errors.concat(['zones missing']) };

    // Exactly five zones
    let zoneKeys = Object.keys(state.zones).sort();
    let expectedZones = ['Ay', 'N', 'Se', 'Sw', 'base'];
    if (JSON.stringify(zoneKeys) !== JSON.stringify(expectedZones))
        errors.push('zones must be exactly N, Sw, Se, Ay, base — got: ' + zoneKeys.join(','));

    // Zone semantics
    for (let zid of ['N', 'Sw', 'Se']) {
        let z = state.zones[zid];
        if (!z) { errors.push(zid + ' zone missing'); continue; }
        if (!z.isRealPlayer)   errors.push(zid + ' must have isRealPlayer=true');
        if (z.isDummy)         errors.push(zid + ' must have isDummy=false');
        if (!z.isActorZone)    errors.push(zid + ' must have isActorZone=true');
        if (z.isBaseZone)      errors.push(zid + ' must have isBaseZone=false');
        if (z.realNaturalPosition !== zid) errors.push(zid + ' realNaturalPosition must equal ' + zid);
    }
    let ay = state.zones['Ay'];
    if (ay) {
        if (ay.isRealPlayer)   errors.push('Ay must have isRealPlayer=false');
        if (!ay.isDummy)       errors.push('Ay must have isDummy=true');
        if (!ay.isActorZone)   errors.push('Ay must have isActorZone=true');
        if (ay.isBaseZone)     errors.push('Ay must have isBaseZone=false');
        if (ay.realNaturalPosition !== null) errors.push('Ay realNaturalPosition must be null');
    }
    let base = state.zones['base'];
    if (base) {
        if (base.isRealPlayer) errors.push('base must have isRealPlayer=false');
        if (base.isDummy)      errors.push('base must have isDummy=false');
        if (base.isActorZone)  errors.push('base must have isActorZone=false');
        if (!base.isBaseZone)  errors.push('base must have isBaseZone=true');
        if (base.frameActorId !== null) errors.push('base frameActorId must be null');
    }

    // Expected-count sum
    let total = Object.values(state.zones).reduce((s, z) => s + (z ? z.expectedCount : 0), 0);
    if (total !== state.totalCards)
        errors.push('expected counts sum ' + total + ' must equal totalCards ' + state.totalCards);

    // Hand zones must have equal expected counts
    let handCounts = ['N','Sw','Se','Ay'].map(z => state.zones[z] && state.zones[z].expectedCount);
    if (handCounts.some(c => c !== handCounts[0]))
        errors.push('all hand zone expectedCounts must be equal');

    // Reject any zone with a card array or card IDs
    for (let [zid, z] of Object.entries(state.zones)) {
        if (!z) continue;
        if (Array.isArray(z.cards))
            errors.push(zid + ': cards must be null, not an array');
        if (z.cards !== null && z.cards !== undefined)
            errors.push(zid + ': cards must be null (got ' + typeof z.cards + ')');
    }

    return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

// ---------------------------------------------------------------------------
// Note 72 — 3PDA dry-run deck manifest, no shuffle/deal
//
// Defines the future 3PDA deck composition as a manifest/specification.
// MANIFEST ONLY: manifestOnly=true; no shuffle, no deal, no zone assignment,
// no live deck, no hand arrays, no base arrays.
// Project card model: suits d/c/h/s (0-3), ranks 2-A (0-12),
//   jokers V (small) / W (big); suit names from core/cards.js numberToSuitName.
//
// TEMPORARY 3PDA SCAFFOLDING:
// These dry-run manifest helpers are scoped under 3PDA only to keep the
// current implementation isolated from stable 4P code during development.
// They must follow shared Shengji card identity conventions:
//   ranks: 2 3 4 5 6 7 8 9 X J Q K A
//   jokers: V = small joker, W = big joker
//   suits: standard Shengji suits
//
// These helpers must not become a permanent separate 3PDA card model.
// After 3PDA works end-to-end, redirect generic card/deck identity logic to
// shared Shengji utilities and remove or rename this scaffold.
// ---------------------------------------------------------------------------

/** Ordered suit keys used in the manifest (aligns with numberToSuitName 0-3). */
const THREE_PDA_MANIFEST_SUITS = ['d', 'c', 'h', 's'];

/** Ordered rank keys used in the manifest (aligns with numberToRankName 0-12). */
const THREE_PDA_MANIFEST_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'X', 'J', 'Q', 'K', 'A'];

/**
 * Returns 54 manifest entries for a single deck ordinal.
 * 52 suited cards (4 suits × 13 ranks) + small joker (V) + big joker (W).
 * Cards contain no zone assignment, shuffle order, or live state.
 * @param {number} deckOrdinal  1-based deck ordinal (e.g. 1 or 2 for 2-deck)
 * @returns {Object[]}
 */
function getStandardSingleDeckCardIdentities(deckOrdinal) {
    let entries = [];
    for (let si = 0; si < THREE_PDA_MANIFEST_SUITS.length; si++) {
        let suit = THREE_PDA_MANIFEST_SUITS[si];
        for (let ri = 0; ri < THREE_PDA_MANIFEST_RANKS.length; ri++) {
            let rank = THREE_PDA_MANIFEST_RANKS[ri];
            entries.push({
                manifestCardId:           'D' + deckOrdinal + '-' + suit + '-' + rank,
                deckOrdinal:              deckOrdinal,
                suit:                     suit,
                rank:                     rank,
                copyOrdinalWithinDeck:    0,
                isJoker:                  false,
            });
        }
    }
    // Small joker (V)
    entries.push({
        manifestCardId:        'D' + deckOrdinal + '-w-V',
        deckOrdinal:           deckOrdinal,
        suit:                  'w',
        rank:                  'V',
        copyOrdinalWithinDeck: 0,
        isJoker:               true,
    });
    // Big joker (W)
    entries.push({
        manifestCardId:        'D' + deckOrdinal + '-w-W',
        deckOrdinal:           deckOrdinal,
        suit:                  'w',
        rank:                  'W',
        copyOrdinalWithinDeck: 0,
        isJoker:               true,
    });
    return entries; // 54 entries
}

/**
 * Creates a dry-run deck manifest for a 3PDA game.
 * MANIFEST ONLY — not a live deck; no shuffle; no zone assignment.
 *
 * @param {Object|{ deckCount?: number }} [settingsOrPlan]
 *   Either a raw settings object (with optional .deckCount) or the output of
 *   create3PDACardZonePlan() (Note 70).
 * @returns {Object} manifest object (plain object, manifestOnly=true)
 */
function create3PDADryRunDeckManifest(settingsOrPlan) {
    let deckCount;
    if (settingsOrPlan && settingsOrPlan.cardZonePlanOnly) {
        // Accept Note 70 card-zone plan directly
        deckCount = settingsOrPlan.deckCount;
    } else {
        deckCount = Number((settingsOrPlan && settingsOrPlan.deckCount) || 2);
    }
    if (!Number.isFinite(deckCount) || deckCount < 1) deckCount = 2;

    let totalCards = 54 * deckCount;
    let cardIdentities = [];
    for (let d = 1; d <= deckCount; d++) {
        cardIdentities = cardIdentities.concat(getStandardSingleDeckCardIdentities(d));
    }

    return {
        kind:           'three-pda-dry-run-deck-manifest',
        // MANIFEST ONLY marker — must remain true until live deck is implemented.
        manifestOnly:   true,
        deckCount:      deckCount,
        totalCards:     totalCards,
        cardIdentities: cardIdentities,
    };
}

/**
 * Validates a dry-run deck manifest.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 * Rejects any manifest that contains zone assignments, shuffle orders,
 * duplicate IDs, or incorrect card counts.
 * MANIFEST ONLY.
 */
function validate3PDADryRunDeckManifest(manifest) {
    let errors = [];
    if (!manifest || !manifest.manifestOnly)
        errors.push('manifestOnly must be true');
    if (!manifest || manifest.kind !== 'three-pda-dry-run-deck-manifest')
        errors.push('kind must be three-pda-dry-run-deck-manifest');
    if (!manifest) return { valid: false, errors };

    let dc = manifest.deckCount;
    if (!Number.isFinite(dc) || dc < 1)
        errors.push('deckCount must be a positive integer');
    let expectedTotal = 54 * dc;
    if (manifest.totalCards !== expectedTotal)
        errors.push('totalCards must equal 54 * deckCount (' + expectedTotal + '), got ' + manifest.totalCards);

    if (!Array.isArray(manifest.cardIdentities))
        return { valid: false, errors: errors.concat(['cardIdentities must be an array']) };

    if (manifest.cardIdentities.length !== expectedTotal)
        errors.push('cardIdentities.length must equal ' + expectedTotal + ', got ' + manifest.cardIdentities.length);

    // Check uniqueness of manifestCardId
    let idSet = new Set();
    for (let card of manifest.cardIdentities) {
        if (!card || !card.manifestCardId)
            { errors.push('every card must have a manifestCardId'); continue; }
        if (idSet.has(card.manifestCardId))
            errors.push('duplicate manifestCardId: ' + card.manifestCardId);
        idSet.add(card.manifestCardId);

        // Reject zone-assignment fields
        for (let banned of ['zoneId', 'owner', 'dealtTo', 'hand', 'base', 'shuffleIndex']) {
            if (banned in card)
                errors.push('card ' + card.manifestCardId + ' must not have field: ' + banned);
        }
    }

    // Per-deck-ordinal checks
    for (let d = 1; d <= dc; d++) {
        let deckCards = manifest.cardIdentities.filter(c => c.deckOrdinal === d);
        if (deckCards.length !== 54)
            errors.push('deck ordinal ' + d + ' must have 54 cards, got ' + deckCards.length);

        let jokers = deckCards.filter(c => c.isJoker);
        if (jokers.length !== 2)
            errors.push('deck ordinal ' + d + ' must have exactly 2 jokers, got ' + jokers.length);

        let suited = deckCards.filter(c => !c.isJoker);
        if (suited.length !== 52)
            errors.push('deck ordinal ' + d + ' must have 52 suited cards, got ' + suited.length);

        // Check all 4 suits × 13 ranks are present
        for (let suit of THREE_PDA_MANIFEST_SUITS) {
            let suitCards = suited.filter(c => c.suit === suit);
            if (suitCards.length !== 13)
                errors.push('deck ' + d + ' suit ' + suit + ' must have 13 cards, got ' + suitCards.length);
        }

        // Check joker types
        let hasSmall = jokers.some(c => c.rank === 'V');
        let hasBig   = jokers.some(c => c.rank === 'W');
        if (!hasSmall) errors.push('deck ordinal ' + d + ' missing small joker (V)');
        if (!hasBig)   errors.push('deck ordinal ' + d + ' missing big joker (W)');
    }

    return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

// ---------------------------------------------------------------------------
// Note 73 — 3PDA dry-run shuffle order, no dealing/assignment
//
// Produces a permutation of manifest card IDs derived from a Note 72 manifest.
// SHUFFLE ORDER ONLY: shuffleOrderOnly=true; no dealing, no zone assignment,
// no live deck, no hand arrays, no base arrays.
// Supports deterministic seeded testing via a local LCG PRNG.
// ---------------------------------------------------------------------------

/**
 * Minimal LCG (linear-congruential) PRNG for deterministic seeded shuffles.
 * Returns a next() function that yields floats in [0, 1).
 * Parameters from Numerical Recipes / Knuth.
 * @param {number|string} seed
 * @returns {{ next: function(): number }}
 */
function createSeededRandom(seed) {
    // Fold seed to a 32-bit positive integer
    let s = (Math.abs(Number(seed) | 0) || 1) >>> 0;
    return {
        next() {
            // LCG parameters (Park-Miller variant, safe for 32-bit)
            s = (Math.imul(1664525, s) + 1013904223) >>> 0;
            return s / 0x100000000;
        },
    };
}

/**
 * Creates a dry-run shuffle order from a Note 72 deck manifest.
 * Returns an ordered list of manifestCardIds — a permutation of the manifest.
 * DRY-RUN ONLY: no cards dealt, no zones assigned, manifest not mutated.
 *
 * @param {Object} manifest       Output of create3PDADryRunDeckManifest().
 * @param {{ seed?: number|string }} [options]  Optional seed for reproducibility.
 * @returns {Object} shuffle-order object (plain object, shuffleOrderOnly=true)
 */
function create3PDADryRunShuffleOrder(manifest, options) {
    // Work on a copy of the ID list — never mutate manifest.cardIdentities
    let ids = manifest.cardIdentities.map(c => c.manifestCardId);

    let seed  = options && options.seed != null ? options.seed : null;
    let rng   = seed != null ? createSeededRandom(seed) : null;
    let randFn = rng ? () => rng.next() : () => Math.random();

    // Fisher-Yates shuffle on the copied ID array
    for (let i = ids.length - 1; i > 0; i--) {
        let j = Math.floor(randFn() * (i + 1));
        let tmp = ids[i]; ids[i] = ids[j]; ids[j] = tmp;
    }

    return {
        kind:                   'three-pda-dry-run-shuffle-order',
        // DRY-RUN markers — must remain true until live dealing is implemented.
        shuffleOrderOnly:       true,
        manifestOnly:           true,
        deckCount:              manifest.deckCount,
        totalCards:             manifest.totalCards,
        seed:                   seed != null ? String(seed) : null,
        orderedManifestCardIds: ids,
        sourceManifestKind:     manifest.kind,
    };
}

/**
 * Validates a dry-run shuffle order against its source manifest.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 * Rejects any shuffle order that has zone-assignment fields, phase-transition
 * fields, duplicate IDs, unknown IDs, or missing manifest IDs.
 * DRY-RUN ONLY.
 *
 * @param {Object} shuffleOrder  Output of create3PDADryRunShuffleOrder().
 * @param {Object} manifest      The source Note 72 manifest.
 * @returns {{ valid: boolean, errors?: string[] }}
 */
function validate3PDADryRunShuffleOrder(shuffleOrder, manifest) {
    let errors = [];
    if (!shuffleOrder || !shuffleOrder.shuffleOrderOnly)
        errors.push('shuffleOrderOnly must be true');
    if (!shuffleOrder || shuffleOrder.kind !== 'three-pda-dry-run-shuffle-order')
        errors.push('kind must be three-pda-dry-run-shuffle-order');
    if (!shuffleOrder) return { valid: false, errors };

    if (shuffleOrder.deckCount !== manifest.deckCount)
        errors.push('deckCount must match manifest deckCount');
    if (shuffleOrder.totalCards !== manifest.totalCards)
        errors.push('totalCards must match manifest totalCards');

    if (!Array.isArray(shuffleOrder.orderedManifestCardIds))
        return { valid: false, errors: errors.concat(['orderedManifestCardIds must be an array']) };

    let ordered = shuffleOrder.orderedManifestCardIds;
    if (ordered.length !== manifest.totalCards)
        errors.push('orderedManifestCardIds.length must equal ' + manifest.totalCards + ', got ' + ordered.length);

    // Build expected ID set from manifest
    let manifestIdSet = new Set(manifest.cardIdentities.map(c => c.manifestCardId));

    // Check every ordered ID is in manifest
    let seen = new Set();
    for (let id of ordered) {
        if (!manifestIdSet.has(id))
            errors.push('ordered ID not in manifest: ' + id);
        if (seen.has(id))
            errors.push('duplicate ordered ID: ' + id);
        seen.add(id);
    }

    // Check every manifest ID appears exactly once
    for (let id of manifestIdSet) {
        if (!seen.has(id))
            errors.push('missing manifest ID in order: ' + id);
    }

    // Reject zone-assignment and phase-transition fields
    for (let banned of ['zoneId', 'owner', 'dealtTo', 'hand', 'base', 'assignedZone',
                        'cardZones', 'hands', 'baseCards', 'dealingSequence',
                        'dealtCards', 'phase', 'nextPhase']) {
        if (banned in shuffleOrder)
            errors.push('shuffle order must not have field: ' + banned);
    }

    return errors.length === 0 ? { valid: true } : { valid: false, errors };
}


// ---------------------------------------------------------------------------
// Note 74 — 3PDA dry-run deal plan, no live hand/base assignment
// ---------------------------------------------------------------------------

/**
 * Creates a dry-run deal plan by distributing shuffled manifest IDs across
 * hand zones (N/Sw/Se/Ay) and the base zone, using round-robin dealing policy.
 * Counts are derived from Note 70/71 formulas via cardZonePlan.
 * Does NOT mutate manifest, shuffleOrder, or any shell/game state.
 * DRY-RUN ONLY — returns pure planning metadata.
 *
 * @param {Object} shuffleOrder   Output of create3PDADryRunShuffleOrder().
 * @param {Object} cardZonePlan   Output of create3PDACardZonePlan() (Note 70).
 * @returns {Object}  Dry-run deal plan (dryRunDealOnly: true).
 */
function create3PDADryRunDealPlan(shuffleOrder, cardZonePlan) {
    let handZoneOrder = ['N', 'Sw', 'Se', 'Ay'];
    let cardsPerHandZone = cardZonePlan.cardsPerHandZone;
    let baseCardCount   = cardZonePlan.baseCardCount;
    let dealtToHandsTotal = cardsPerHandZone * handZoneOrder.length;

    // Work on a copy so neither input is mutated
    let ids = shuffleOrder.orderedManifestCardIds.slice();

    let plannedAssignments = { N: [], Sw: [], Se: [], Ay: [], base: [] };

    // Round-robin to hand zones
    for (let i = 0; i < dealtToHandsTotal; i++) {
        let zone = handZoneOrder[i % handZoneOrder.length];
        plannedAssignments[zone].push(ids[i]);
    }

    // Remaining cards go to base
    for (let i = dealtToHandsTotal; i < ids.length; i++) {
        plannedAssignments.base.push(ids[i]);
    }

    return {
        kind: 'three-pda-dry-run-deal-plan',
        dryRunDealOnly: true,
        manifestOnly: true,

        deckCount:  shuffleOrder.deckCount,
        totalCards: shuffleOrder.totalCards,

        cardsPerHandZone: cardsPerHandZone,
        baseCardCount:    baseCardCount,

        handZoneOrder: handZoneOrder.slice(),
        baseZoneId: 'base',

        plannedAssignments: plannedAssignments,

        assignmentPolicy: 'round-robin-hands-then-base',
    };
}

/**
 * Validates a dry-run deal plan against its source shuffle order and
 * card-zone plan.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 * Rejects duplicate/missing/unknown IDs, wrong counts, card objects,
 * phase-transition fields, and qz/scoring/play fields.
 * DRY-RUN ONLY.
 *
 * @param {Object} dealPlan      Output of create3PDADryRunDealPlan().
 * @param {Object} shuffleOrder  Source shuffle order (Note 73).
 * @param {Object} cardZonePlan  Source card-zone plan (Note 70).
 * @returns {{ valid: boolean, errors?: string[] }}
 */
function validate3PDADryRunDealPlan(dealPlan, shuffleOrder, cardZonePlan) {
    let errors = [];
    if (!dealPlan) return { valid: false, errors: ['dealPlan is null/undefined'] };

    if (!dealPlan.dryRunDealOnly)
        errors.push('dryRunDealOnly must be true');
    if (dealPlan.kind !== 'three-pda-dry-run-deal-plan')
        errors.push('kind must be three-pda-dry-run-deal-plan');
    if (dealPlan.deckCount !== shuffleOrder.deckCount)
        errors.push('deckCount must match shuffleOrder deckCount');
    if (dealPlan.totalCards !== shuffleOrder.totalCards)
        errors.push('totalCards must match shuffleOrder totalCards');

    // Validate zone structure
    let expectedHands = ['N', 'Sw', 'Se', 'Ay'];
    let pa = dealPlan.plannedAssignments;
    if (!pa || typeof pa !== 'object') {
        errors.push('plannedAssignments must be an object');
    } else {
        for (let zone of expectedHands) {
            if (!Array.isArray(pa[zone]))
                errors.push('plannedAssignments.' + zone + ' must be an array');
            else if (pa[zone].length !== cardZonePlan.cardsPerHandZone)
                errors.push(zone + ' must have ' + cardZonePlan.cardsPerHandZone +
                            ' IDs, got ' + pa[zone].length);
        }
        if (!Array.isArray(pa.base)) {
            errors.push('plannedAssignments.base must be an array');
        } else if (pa.base.length !== cardZonePlan.baseCardCount) {
            errors.push('base must have ' + cardZonePlan.baseCardCount +
                        ' IDs, got ' + pa.base.length);
        }

        // Build full assigned list
        let allAssigned = [];
        for (let z of expectedHands) {
            if (Array.isArray(pa[z])) allAssigned = allAssigned.concat(pa[z]);
        }
        if (Array.isArray(pa.base)) allAssigned = allAssigned.concat(pa.base);

        // Build manifest ID set from shuffleOrder
        let manifestIdSet = new Set(shuffleOrder.orderedManifestCardIds);

        // Check total count
        if (allAssigned.length !== shuffleOrder.totalCards)
            errors.push('total assigned IDs (' + allAssigned.length +
                        ') must equal totalCards (' + shuffleOrder.totalCards + ')');

        // Check for card objects (no objects allowed — strings only)
        for (let id of allAssigned) {
            if (typeof id !== 'string')
                errors.push('assigned values must be manifest ID strings, got ' + typeof id);
        }

        // Check for duplicates and unknown/missing IDs
        let seen = new Set();
        for (let id of allAssigned) {
            if (!manifestIdSet.has(id))
                errors.push('assigned ID not in manifest: ' + id);
            if (seen.has(id))
                errors.push('duplicate assigned ID: ' + id);
            seen.add(id);
        }
        for (let id of manifestIdSet) {
            if (!seen.has(id))
                errors.push('manifest ID not assigned: ' + id);
        }
    }

    // Reject live-state/phase-transition/qz/scoring/play fields
    for (let banned of ['hands', 'base', 'hand', 'liveDeck', 'phase', 'nextPhase',
                        'dealing', 'dealingSequence', 'dealtCards',
                        'declaration', 'qz', 'scoring', 'tricks', 'play',
                        'zoneId', 'owner', 'dealtTo', 'assignedZone']) {
        if (banned in dealPlan)
            errors.push('deal plan must not have field: ' + banned);
    }

    return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

// ---------------------------------------------------------------------------
// Note 75 — 3PDA live frame card-state container, empty/no cards
// ---------------------------------------------------------------------------

/**
 * Creates an empty live 3PDA frame card-state container.
 * Zones are present but all card fields are null — no cards, no manifest IDs,
 * no card objects, no live deck.
 * Counts are derived from Note 70 helpers via cardZonePlan.
 * Does NOT mutate shell/game state, call shuffle/deal helpers, or render cards.
 * EMPTY CONTAINER ONLY — not a dealing phase, not live hands/base.
 *
 * @param {Object} cardZonePlan  Output of create3PDACardZonePlan() (Note 70).
 * @returns {Object}  Empty live card-state container (containsLiveCards: false).
 */
function create3PDAEmptyLiveCardState(cardZonePlan) {
    let dc  = cardZonePlan.deckCount;
    let tc  = cardZonePlan.totalCards;
    let cph = cardZonePlan.cardsPerHandZone;
    let bcc = cardZonePlan.baseCardCount;

    return {
        kind: 'three-pda-live-card-state',
        tableFormat: 'three-player-dummy-ally',
        initialized: true,
        containsLiveCards: false,

        deckCount:        dc,
        totalCards:       tc,
        cardsPerHandZone: cph,
        baseCardCount:    bcc,

        handZoneOrder: ['N', 'Sw', 'Se', 'Ay'],
        baseZoneId: 'base',

        zones: {
            N:    { zoneKind: 'real-player-hand', isRealPlayer: true,  isDummy: false, isBaseZone: false, realNaturalPosition: 'N',  frameActorId: 'N',   expectedCount: cph, cards: null },
            Sw:   { zoneKind: 'real-player-hand', isRealPlayer: true,  isDummy: false, isBaseZone: false, realNaturalPosition: 'Sw', frameActorId: 'Sw',  expectedCount: cph, cards: null },
            Se:   { zoneKind: 'real-player-hand', isRealPlayer: true,  isDummy: false, isBaseZone: false, realNaturalPosition: 'Se', frameActorId: 'Se',  expectedCount: cph, cards: null },
            Ay:   { zoneKind: 'dummy-hand',       isRealPlayer: false, isDummy: true,  isBaseZone: false, realNaturalPosition: null, frameActorId: 'Ay',  expectedCount: cph, cards: null },
            base: { zoneKind: 'base-bottom',      isRealPlayer: false, isDummy: false, isBaseZone: true,  realNaturalPosition: null, frameActorId: null,  expectedCount: bcc, cards: null },
        },
    };
}

/**
 * Validates an empty 3PDA live card-state container.
 * Rejects any state that contains cards, manifest IDs, card arrays,
 * live-deck/hands/deal/phase/gameplay fields.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 *
 * @param {Object} cardState  Output of create3PDAEmptyLiveCardState().
 * @returns {{ valid: boolean, errors?: string[] }}
 */
function validate3PDAEmptyLiveCardState(cardState) {
    let errors = [];
    if (!cardState) return { valid: false, errors: ['cardState is null/undefined'] };

    if (cardState.kind !== 'three-pda-live-card-state')
        errors.push('kind must be three-pda-live-card-state');
    if (cardState.tableFormat !== 'three-player-dummy-ally')
        errors.push('tableFormat must be three-player-dummy-ally');
    if (cardState.containsLiveCards !== false)
        errors.push('containsLiveCards must be false');

    // Count consistency
    if (typeof cardState.totalCards !== 'number' || cardState.totalCards !== 54 * cardState.deckCount)
        errors.push('totalCards must equal 54 * deckCount');
    if (typeof cardState.baseCardCount !== 'number')
        errors.push('baseCardCount must be a number');
    if (typeof cardState.cardsPerHandZone !== 'number')
        errors.push('cardsPerHandZone must be a number');

    // Zone presence
    let zones = cardState.zones;
    if (!zones || typeof zones !== 'object')
        return { valid: false, errors: errors.concat(['zones must be an object']) };

    let expectedZones = ['N', 'Sw', 'Se', 'Ay', 'base'];
    for (let z of expectedZones) {
        if (!zones[z]) errors.push('missing zone: ' + z);
    }
    for (let z of Object.keys(zones)) {
        if (!expectedZones.includes(z)) errors.push('unexpected zone: ' + z);
    }

    // Zone semantics
    for (let z of ['N', 'Sw', 'Se']) {
        if (zones[z] && zones[z].isRealPlayer !== true)
            errors.push(z + ' must be isRealPlayer=true');
        if (zones[z] && zones[z].isDummy !== false)
            errors.push(z + ' must be isDummy=false');
        if (zones[z] && zones[z].isBaseZone !== false)
            errors.push(z + ' must be isBaseZone=false');
    }
    if (zones.Ay) {
        if (zones.Ay.isRealPlayer !== false)
            errors.push('Ay must be isRealPlayer=false');
        if (zones.Ay.isDummy !== true)
            errors.push('Ay must be isDummy=true');
        if (zones.Ay.realNaturalPosition !== null)
            errors.push('Ay realNaturalPosition must be null');
        if (zones.Ay.isBaseZone !== false)
            errors.push('Ay must be isBaseZone=false');
    }
    if (zones.base) {
        if (zones.base.isBaseZone !== true)
            errors.push('base must be isBaseZone=true');
        if (zones.base.isRealPlayer !== false)
            errors.push('base must be isRealPlayer=false');
        if (zones.base.frameActorId !== null)
            errors.push('base frameActorId must be null');
    }

    // No cards in any zone
    for (let z of expectedZones) {
        let zone = zones[z];
        if (!zone) continue;
        if (zone.cards !== null && zone.cards !== undefined)
            errors.push(z + '.cards must be null or absent, got: ' + JSON.stringify(zone.cards));
        // Reject manifest IDs (strings in any card-like field)
        for (let field of ['manifestId', 'manifestCardId', 'cardId', 'id']) {
            if (field in zone) errors.push(z + ' must not have field: ' + field);
        }
    }

    // Reject live-deal/deck/hands/gameplay fields on container
    for (let banned of ['liveDeck', 'deck', 'shuffleOrder', 'dealPlan',
                        'hands', 'baseCards', 'dealtCards', 'dealingSequence',
                        'phase', 'nextPhase', 'dealing', 'declaration', 'qz',
                        'scoring', 'tricks', 'play', 'orderedManifestCardIds',
                        'plannedAssignments']) {
        if (banned in cardState)
            errors.push('cardState must not have field: ' + banned);
    }

    return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

// ---------------------------------------------------------------------------
// Note 77 — Attach 3PDA manifest/shuffle metadata to shell cardState, still no hand/base assignment
//
// Adds manifest/shuffle metadata to the live card-state container.
// METADATA ONLY: containsLiveCards remains false; all zone cards remain null.
// No cards are assigned to N/Sw/Se/Ay/base. No dealing phase. No rendering.
// TEMPORARY 3PDA SCAFFOLDING — redirect generic card/deck identity logic to
// shared Shengji utilities when a shared module is established.
// ---------------------------------------------------------------------------

/**
 * Default deterministic debug seed for 3PDA shell metadata.
 * Tests may override via options.seed.
 */
const THREE_PDA_SHELL_DEBUG_SEED = 'three-pda-shell-debug-seed';

// ---------------------------------------------------------------------------
// Note 96 — 3PDA deal-instance seed/state
// A deal instance is a lifecycle descriptor that owns the seed/policy/source
// for one 3PDA scaffold deal/frame.  It is distinct from:
//   manifest        — full deck identity list
//   shuffle order   — permutation produced from a seed
//   deal plan       — dry-run zone assignment
//   activated cardState — renderable manifest-ID payload in zones
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Note 97 — generated-local seed policy
// ---------------------------------------------------------------------------

/**
 * Note 97: Creates a generated-local seed for one 3PDA deal instance.
 * Called ONLY at the deal-instance lifecycle boundary (never inside
 * shuffle/deal/cardState creation or render helpers).
 * Uses crypto.getRandomValues if available; documented monotonic-counter
 * fallback otherwise (no hidden nondeterminism in either path).
 * Returns a non-empty string.  No card IDs, player info, or manifest IDs embedded.
 *
 * @returns {string}  Generated seed string.
 */
function create3PDAGeneratedDealSeed() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        let buf = new Uint32Array(3);
        crypto.getRandomValues(buf);
        return '3pda-gen-' +
            buf[0].toString(16).padStart(8, '0') +
            buf[1].toString(16).padStart(8, '0') +
            buf[2].toString(16).padStart(8, '0');
    }
    // Fallback: documented monotonic counter — auditable, not crypto-quality.
    // Only reached when crypto.getRandomValues is unavailable (unusual environments).
    create3PDAGeneratedDealSeed._counter = (create3PDAGeneratedDealSeed._counter || 0) + 1;
    let ts = (typeof performance !== 'undefined' && performance.now)
        ? Math.floor(performance.now() * 1000)
        : Date.now();
    return '3pda-gen-fb-' + create3PDAGeneratedDealSeed._counter + '-' + ts;
}

/**
 * Note 96: Creates a 3PDA deal-instance descriptor.
 * Pure helper — does not mutate shell state, cardState, or game engine state.
 * Does not create live card objects, assign cards, or render UI.
 * Returns a plain metadata object that owns the seed/policy for one scaffold deal/frame.
 *
 * @param {{ seedPolicy?: string, seed?: string|number,
 *           frameIndex?: number, pivotActorId?: string,
 *           referenceActorId?: string }} [options]
 * @returns {Object} Deal-instance descriptor.
 */
function create3PDADealInstance(options) {
    let opts = options || {};
    let seedPolicy = opts.seedPolicy || 'fixed-debug';

    // Allowed seed policies:
    // 'fixed-debug'      — deterministic debug default (THREE_PDA_SHELL_DEBUG_SEED).
    // 'explicit-test'    — tests may pass an explicit seed; must not be used for production randomness.
    // 'generated-local'  — Note 97: production/local generated seed; calls create3PDAGeneratedDealSeed().
    // 'future-generated' — reserved placeholder; still inactive (see Note 96); uses fixed-debug seed.
    const ALLOWED_POLICIES = ['fixed-debug', 'explicit-test', 'generated-local', 'future-generated'];
    if (!ALLOWED_POLICIES.includes(seedPolicy)) {
        throw new Error('Note 96/97: invalid seedPolicy: ' + seedPolicy);
    }

    let seed;
    if (seedPolicy === 'fixed-debug') {
        seed = THREE_PDA_SHELL_DEBUG_SEED;
    } else if (seedPolicy === 'explicit-test') {
        if (opts.seed == null) throw new Error('Note 96: explicit-test seedPolicy requires explicit seed');
        seed = opts.seed;
    } else if (seedPolicy === 'generated-local') {
        // Note 97: call seed-generation helper ONLY at deal-instance lifecycle boundary.
        // Never called inside shuffle/deal/cardState creation or render helpers.
        seed = create3PDAGeneratedDealSeed();
    } else {
        // future-generated: still reserved — not active production randomness.
        // Uses fixed-debug seed until a future note defines its own lifecycle.
        seed = THREE_PDA_SHELL_DEBUG_SEED;
    }

    let frameIndex = (opts.frameIndex != null && typeof opts.frameIndex === 'number') ? opts.frameIndex : 1;
    // Deterministic id — no Math.random / Date.now.
    let dealInstanceId = '3pda-di-' + String(seed).replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 12) + '-f' + frameIndex;

    return {
        kind:             'three-pda-deal-instance',
        tableFormat:      'three-player-dummy-ally',
        dealInstanceId:   dealInstanceId,
        seed:             seed,
        seedPolicy:       seedPolicy,
        frameIndex:       frameIndex,
        pivotActorId:     (opts.pivotActorId != null) ? opts.pivotActorId : null,
        referenceActorId: (opts.referenceActorId != null) ? opts.referenceActorId : null,
        createdForShellOnly: true,
    };
}

/**
 * Note 96: Validates a 3PDA deal-instance descriptor.
 * Checks kind/tableFormat, seedPolicy, seed, dealInstanceId, frameIndex, createdForShellOnly.
 * Rejects live card/hand/base/gameplay fields.
 * Does not check consistency with shuffle/deal metadata (use validate3PDAShellDealInstanceConsistency for that).
 *
 * @param {Object} dealInstance  Output of create3PDADealInstance().
 * @returns {{ valid: boolean, errors?: string[] }}
 */
function validate3PDADealInstance(dealInstance) {
    if (!dealInstance || typeof dealInstance !== 'object')
        return { valid: false, errors: ['dealInstance is null/undefined or not an object'] };
    let errors = [];
    if (dealInstance.kind !== 'three-pda-deal-instance')
        errors.push('kind must be three-pda-deal-instance');
    if (dealInstance.tableFormat !== 'three-player-dummy-ally')
        errors.push('tableFormat must be three-player-dummy-ally');
    const ALLOWED_POLICIES = ['fixed-debug', 'explicit-test', 'generated-local', 'future-generated'];
    if (!ALLOWED_POLICIES.includes(dealInstance.seedPolicy))
        errors.push('invalid seedPolicy: ' + dealInstance.seedPolicy);
    if (dealInstance.seed == null || (typeof dealInstance.seed !== 'string' && typeof dealInstance.seed !== 'number'))
        errors.push('seed must be a non-null string or number');
    if (!dealInstance.dealInstanceId || typeof dealInstance.dealInstanceId !== 'string')
        errors.push('dealInstanceId must be a non-empty string');
    if (typeof dealInstance.frameIndex !== 'number' || dealInstance.frameIndex < 1)
        errors.push('frameIndex must be a number >= 1');
    if (dealInstance.createdForShellOnly !== true)
        errors.push('createdForShellOnly must be true');
    // Reject live card/gameplay fields
    for (let banned of ['cards', 'hands', 'base', 'liveDeck', 'declaration', 'qz', 'scoring', 'tricks', 'play']) {
        if (dealInstance[banned] != null) errors.push('dealInstance must not contain live field: ' + banned);
    }
    return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/**
 * Note 96: Validates consistency between a shell state's dealInstance and its cardState shuffle metadata.
 * Confirms dealInstance.seed matches cardState.shuffleMetadata.seed.
 * Does not validate gameplay fields (those are handled by validate3PDAActivatedCardState).
 *
 * @param {Object} shellState  Output of createThreePDAShellState().
 * @returns {{ valid: boolean, errors?: string[] }}
 */
function validate3PDAShellDealInstanceConsistency(shellState) {
    if (!shellState || typeof shellState !== 'object')
        return { valid: false, errors: ['shellState is null/undefined or not an object'] };
    let errors = [];
    let di = shellState.dealInstance;
    if (!di || typeof di !== 'object') { return { valid: false, errors: ['dealInstance missing from shellState'] }; }
    let diV = validate3PDADealInstance(di);
    if (!diV.valid) { return { valid: false, errors: ['dealInstance invalid: ' + (diV.errors || []).join(', ')] }; }
    let cs = shellState.cardState;
    if (!cs || typeof cs !== 'object') { return { valid: false, errors: ['cardState missing from shellState'] }; }
    let sm = cs.shuffleMetadata;
    if (!sm || typeof sm !== 'object') { errors.push('cardState.shuffleMetadata missing'); }
    else if (sm.seed !== di.seed) {
        errors.push('dealInstance.seed (' + di.seed + ') does not match shuffleMetadata.seed (' + sm.seed + ')');
    }
    // Confirm no gameplay/card-assignment mutation
    if (cs.hands != null) errors.push('cardState must not have hands field');
    if (cs.liveDeck != null) errors.push('cardState must not have liveDeck field');
    return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

// ---------------------------------------------------------------------------
// Note 99 — 3PDA deal lifecycle shell
// Represents an explicit instant undealt-shell -> dealt-shell lifecycle
// transition.  The transition is synchronous/instant; no animation, no timer,
// no new top-level phase.
// Distinct from dealInstance (seed/policy owner) and cardState (payload).
// ---------------------------------------------------------------------------

/**
 * Note 99: Creates a 3PDA deal lifecycle state descriptor.
 * Pure helper — returns a plain metadata object.
 * Does not render UI, mutate cardState, assign cards, or generate seeds.
 *
 * @param {Object} dealInstance        Output of create3PDADealInstance().
 * @param {string} lifecycleStage      'undealt-shell' | 'dealt-shell'.
 * @param {string} transitionPolicy    'instant-scaffold'.
 * @param {{ containsDealtCardState?: boolean }} [options]
 * @returns {Object} Deal lifecycle descriptor.
 */
function create3PDADealLifecycleState(dealInstance, lifecycleStage, transitionPolicy, options) {
    return {
        kind:                  'three-pda-deal-lifecycle',
        tableFormat:           'three-player-dummy-ally',
        lifecycleStage:        lifecycleStage,
        transitionPolicy:      transitionPolicy,
        dealInstanceId:        dealInstance ? dealInstance.dealInstanceId : null,
        frameIndex:            dealInstance ? dealInstance.frameIndex : null,
        containsDealtCardState: (options && options.containsDealtCardState === true) ? true : false,
        animationEnabled:      false,
        gameplayEnabled:       false,
    };
}

/**
 * Note 99: Creates a dealt-shell lifecycle state (instant undealt->dealt transition).
 * Called after cardState has been activated from the dealInstance seed.
 * Records instant-scaffold as the transitionPolicy.
 * Pure helper — does not render, mutate cardState, assign cards, or generate seeds.
 *
 * @param {Object} dealInstance  Output of create3PDADealInstance().
 * @param {Object} cardState     Activated cardState (activationStatus='manifest-ids-in-zones').
 * @returns {Object} Dealt-shell lifecycle descriptor.
 */
function create3PDAInstantScaffoldDealLifecycle(dealInstance, cardState) {
    // Instant undealt-shell -> dealt-shell.  No animation, no timer, no top-level phase.
    return create3PDADealLifecycleState(dealInstance, 'dealt-shell', 'instant-scaffold', {
        containsDealtCardState: !!(cardState && cardState.activationStatus === 'manifest-ids-in-zones'),
    });
}

/**
 * Note 99: Validates a 3PDA deal lifecycle state descriptor.
 * Checks kind/tableFormat, lifecycleStage, transitionPolicy, and safety flags.
 * Rejects animation/gameplay/card-payload fields.
 *
 * @param {Object} lifecycle  Output of create3PDADealLifecycleState() or create3PDAInstantScaffoldDealLifecycle().
 * @returns {{ valid: boolean, errors?: string[] }}
 */
function validate3PDADealLifecycleState(lifecycle) {
    if (!lifecycle || typeof lifecycle !== 'object')
        return { valid: false, errors: ['lifecycle is null/undefined or not an object'] };
    let errors = [];
    if (lifecycle.kind !== 'three-pda-deal-lifecycle')
        errors.push('kind must be three-pda-deal-lifecycle');
    if (lifecycle.tableFormat !== 'three-player-dummy-ally')
        errors.push('tableFormat must be three-player-dummy-ally');
    const ALLOWED_STAGES = ['undealt-shell', 'dealt-shell'];
    if (!ALLOWED_STAGES.includes(lifecycle.lifecycleStage))
        errors.push('invalid lifecycleStage: ' + lifecycle.lifecycleStage);
    const ALLOWED_POLICIES = ['instant-scaffold'];
    if (!ALLOWED_POLICIES.includes(lifecycle.transitionPolicy))
        errors.push('invalid transitionPolicy: ' + lifecycle.transitionPolicy);
    if (lifecycle.animationEnabled !== false)
        errors.push('animationEnabled must be false');
    if (lifecycle.gameplayEnabled !== false)
        errors.push('gameplayEnabled must be false');
    if (!lifecycle.dealInstanceId || typeof lifecycle.dealInstanceId !== 'string')
        errors.push('dealInstanceId must be a non-empty string');
    if (typeof lifecycle.frameIndex !== 'number' || lifecycle.frameIndex < 1)
        errors.push('frameIndex must be a number >= 1');
    // Reject card-payload / forbidden fields
    for (let banned of ['cards', 'hands', 'base', 'liveDeck', 'shuffleOrder',
                        'dealPlan', 'manifest', 'orderedManifestCardIds']) {
        if (lifecycle[banned] != null)
            errors.push('lifecycle must not contain payload field: ' + banned);
    }
    return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/**
 * Note 99: Validates consistency between shellState.dealLifecycle, shellState.dealInstance,
 * shellState.cardState, and shellState.frameIndex.
 *
 * @param {Object} shellState  Output of createThreePDAShellState() or mutated by advanceThreePDAShellFrame().
 * @returns {{ valid: boolean, errors?: string[] }}
 */
function validate3PDAShellDealLifecycleConsistency(shellState) {
    if (!shellState || typeof shellState !== 'object')
        return { valid: false, errors: ['shellState is null/undefined or not an object'] };
    let errors = [];
    let lc = shellState.dealLifecycle;
    if (!lc || typeof lc !== 'object') { return { valid: false, errors: ['dealLifecycle missing from shellState'] }; }
    let lcV = validate3PDADealLifecycleState(lc);
    if (!lcV.valid) { return { valid: false, errors: ['dealLifecycle invalid: ' + (lcV.errors || []).join(', ')] }; }
    let di = shellState.dealInstance;
    if (!di || typeof di !== 'object') { errors.push('dealInstance missing from shellState'); }
    else if (lc.dealInstanceId !== di.dealInstanceId) {
        errors.push('dealLifecycle.dealInstanceId (' + lc.dealInstanceId +
                    ') does not match dealInstance.dealInstanceId (' + di.dealInstanceId + ')');
    }
    if (typeof shellState.frameIndex === 'number' && lc.frameIndex !== shellState.frameIndex) {
        errors.push('dealLifecycle.frameIndex (' + lc.frameIndex +
                    ') does not match shellState.frameIndex (' + shellState.frameIndex + ')');
    }
    let cs = shellState.cardState;
    if (lc.lifecycleStage === 'dealt-shell') {
        if (!cs || cs.activationStatus !== 'manifest-ids-in-zones') {
            errors.push('dealt-shell lifecycle requires cardState.activationStatus=manifest-ids-in-zones');
        }
        if (lc.containsDealtCardState !== true) {
            errors.push('dealt-shell lifecycle must have containsDealtCardState=true');
        }
    }
    return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

// ---------------------------------------------------------------------------
// Note 100 — 3PDA hidden-zone placeholder display contract, no card backs
//
// Formalizes the hidden-zone display contract for 3PDA:
//     reference zone             = visible card faces
//     afterhand/opposite/forehand = abstract placeholder/count display only
//     base                       = abstract placeholder/count display only
//     no card backs
//     no hidden per-card DOM
//
// hidden-placeholder does NOT mean card backs.
// hidden-placeholder does NOT mean per-card hidden DOM.
// hidden-placeholder means abstract display only.
//
// This block adds a classification helper and a shell validator.
// No new visual rendering is introduced.
// ---------------------------------------------------------------------------

/**
 * THREE_PDA_ZONE_DISPLAY_CONTRACT
 *
 * Canonical display contract tokens for 3PDA placement slots.
 *   reference-face       : reference slot; resolved card faces visible.
 *   hidden-placeholder   : afterhand/opposite/forehand slots; abstract count/placeholder only.
 *   base-placeholder     : base slot/zone; abstract count/placeholder only.
 *
 * Not card backs. Not hidden per-card DOM. Abstract display only.
 */
const THREE_PDA_ZONE_DISPLAY_CONTRACT = Object.freeze({
    REFERENCE_FACE:     'reference-face',
    HIDDEN_PLACEHOLDER: 'hidden-placeholder',
    BASE_PLACEHOLDER:   'base-placeholder',
});

/**
 * get3PDAZoneDisplayMode(slotNameOrZoneId)
 *
 * Returns the display contract mode for a 3PDA placement slot name.
 * Accepts: 'reference', 'afterhand', 'opposite', 'forehand', 'base'.
 * Returns one of: 'reference-face', 'hidden-placeholder', 'base-placeholder', or null.
 *
 * Pure — no DOM mutation, no cardState mutation, no card object creation,
 * no selected-seat recomputation. Limited to display-contract classification.
 *
 * @param {string} slotNameOrZoneId
 * @returns {string|null}
 */
function get3PDAZoneDisplayMode(slotNameOrZoneId) {
    switch (slotNameOrZoneId) {
        case 'reference': return THREE_PDA_ZONE_DISPLAY_CONTRACT.REFERENCE_FACE;
        case 'afterhand':
        case 'opposite':
        case 'forehand':  return THREE_PDA_ZONE_DISPLAY_CONTRACT.HIDDEN_PLACEHOLDER;
        case 'base':      return THREE_PDA_ZONE_DISPLAY_CONTRACT.BASE_PLACEHOLDER;
        default:          return null;
    }
}

/**
 * validate3PDAHiddenZonePlaceholderContract(shellState)
 *
 * Validates that shellState conforms to the hidden-zone placeholder display contract:
 *   - animationEnabled and gameplayEnabled are false (lifecycle safety flags);
 *   - cardState zone payloads are manifest ID strings, not card objects or DOM;
 *   - no card-back/face-down/hiddenCardDom fields on zones, cardState, or shellState;
 *   - no hidden per-card DOM state embedded in zone or cardState fields;
 *   - base zone conforms to base-placeholder contract (string IDs only).
 *
 * Does not query the DOM. Does not mutate shellState or cardState.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 *
 * @param {object} shellState
 * @returns {{ valid: boolean, errors?: string[] }}
 */
function validate3PDAHiddenZonePlaceholderContract(shellState) {
    if (!shellState || typeof shellState !== 'object')
        return { valid: false, errors: ['shellState is null/undefined'] };
    let errors = [];

    // 1. Lifecycle safety flags
    let lc = shellState.dealLifecycle;
    if (!lc) {
        errors.push('dealLifecycle missing — cannot confirm no-animation/no-gameplay contract');
    } else {
        if (lc.animationEnabled !== false)
            errors.push('contract violation: animationEnabled must be false');
        if (lc.gameplayEnabled !== false)
            errors.push('contract violation: gameplayEnabled must be false');
    }

    // 2. cardState zone payload contract: string manifest IDs only, no card objects
    let cs = shellState.cardState;
    if (!cs || typeof cs !== 'object') {
        errors.push('cardState missing');
    } else {
        if (cs.activationStatus !== 'manifest-ids-in-zones') {
            errors.push('cardState.activationStatus must be manifest-ids-in-zones; got: ' + cs.activationStatus);
        }
        let allZones = ['N', 'Sw', 'Se', 'Ay', 'base'];
        for (let zid of allZones) {
            let zone = cs.zones && cs.zones[zid];
            if (!zone) { errors.push('zone missing: ' + zid); continue; }
            let cards = zone.cards;
            if (!Array.isArray(cards)) { errors.push(zid + ': zone.cards must be an array'); continue; }
            // Each card must be a manifest ID string, not a card object
            for (let i = 0; i < cards.length; i++) {
                if (typeof cards[i] !== 'string') {
                    errors.push(zid + '[' + i + ']: zone payload must be a manifest ID string, not ' + typeof cards[i]);
                    break; // one error per zone is enough
                }
            }
            // Forbidden DOM/card-object/card-back fields on zone
            let forbiddenZoneFields = ['domElements', 'htmlElement', 'cardBackRendering',
                                       'faceDownCards', 'hiddenCardDom', 'renderObjects'];
            for (let f of forbiddenZoneFields) {
                if (f in zone) errors.push(zid + ': forbidden field on zone: ' + f);
            }
        }
        // Forbidden hidden-zone rendering fields on cardState itself
        let forbiddenCSFields = ['cardBackRendering', 'faceDownCards', 'hiddenCardDom',
                                 'renderObjects', 'liveHands', 'liveBase'];
        for (let f of forbiddenCSFields) {
            if (f in cs) errors.push('cardState: forbidden field: ' + f);
        }
    }

    // 3. Forbidden card-back/animation fields on shellState itself
    let forbiddenShellFields = ['cardBackRendering', 'faceDownCards', 'hiddenCardDom',
                                'renderObjects', 'dealingAnimation'];
    for (let f of forbiddenShellFields) {
        if (f in shellState) errors.push('shellState: forbidden field: ' + f);
    }

    return errors.length === 0 ? { valid: true } : { valid: false, errors };
}
// END Note 100 scaffolding

// ---------------------------------------------------------------------------
// Note 101 — 3PDA qz/declaration state shell, no declaration logic, no UI controls
//
// Adds a neutral qz/declaration metadata container for the future qiangzhuang/declaration
// lifecycle layer.  strain/trump/declarer remain null.  availableActions is empty.
// logicImplemented / uiControlsEnabled / botActionsEnabled are all false.
// No declaration rules, no UI controls, no top-level declaring phase.
// ---------------------------------------------------------------------------

/**
 * Note 101 — Creates a neutral, unresolved qz/declaration state shell.
 * Pure factory — returns a plain metadata object.  Does not render UI, does not mutate
 * cardState or dealLifecycle, does not determine strain/trump/declarer, does not call
 * bot logic, and does not create declaration actions.
 *
 * @param {Object} shellState  Parent 3PDA shell (used only to read frameIndex/dealInstanceId).
 * @returns {Object}  Unresolved qz/declaration state descriptor.
 */
function create3PDAQZDeclarationState(shellState) {
    // Note 101: pure neutral metadata — no strain, no declarer, no logic/UI/bot.
    // hidden-placeholder does NOT mean card backs.
    // qz-declaration-unresolved means declaration layer is not yet implemented in this scaffold.
    return {
        kind:                   'three-pda-qz-declaration-state',
        tableFormat:            'three-player-dummy-ally',
        status:                 'not-started',
        lifecycleStage:         'qz-declaration-unresolved',
        strainEstablished:      false,
        strain:                 null,
        trumpDivision:          null,
        declarerActorId:        null,
        lastDeclarationActorId: null,
        availableActions:       [],
        logicImplemented:       false,
        uiControlsEnabled:      false,
        botActionsEnabled:      false,
        frameIndex:             (shellState && typeof shellState.frameIndex === 'number')
                                    ? shellState.frameIndex : null,
        dealInstanceId:         (shellState && shellState.dealInstance)
                                    ? shellState.dealInstance.dealInstanceId : null,
    };
}

/**
 * Note 101 — Validates a 3PDA qz/declaration state descriptor.
 * Checks kind/tableFormat, lifecycle stage, null semantics for strain/trump/declarer,
 * empty availableActions, false logic/UI/bot flags, and absence of forbidden gameplay fields.
 *
 * @param {Object} qzState  Output of create3PDAQZDeclarationState().
 * @returns {{ valid: boolean, errors?: string[] }}
 */
function validate3PDAQZDeclarationState(qzState) {
    if (!qzState || typeof qzState !== 'object')
        return { valid: false, errors: ['qzState is null/undefined or not an object'] };
    let errors = [];
    if (qzState.kind !== 'three-pda-qz-declaration-state')
        errors.push('kind must be three-pda-qz-declaration-state');
    if (qzState.tableFormat !== 'three-player-dummy-ally')
        errors.push('tableFormat must be three-player-dummy-ally');
    const ALLOWED_STATUSES = ['not-started', 'unresolved'];
    if (!ALLOWED_STATUSES.includes(qzState.status))
        errors.push('status must be not-started or unresolved, got: ' + qzState.status);
    if (qzState.lifecycleStage !== 'qz-declaration-unresolved')
        errors.push('lifecycleStage must be qz-declaration-unresolved');
    if (qzState.strainEstablished !== false)
        errors.push('strainEstablished must be false in initial shell');
    if (qzState.strain !== null)
        errors.push('strain must be null in initial shell');
    if (qzState.trumpDivision !== null)
        errors.push('trumpDivision must be null in initial shell');
    if (qzState.declarerActorId !== null)
        errors.push('declarerActorId must be null in initial shell');
    if (!Array.isArray(qzState.availableActions) || qzState.availableActions.length !== 0)
        errors.push('availableActions must be an empty array');
    if (qzState.logicImplemented !== false)
        errors.push('logicImplemented must be false');
    if (qzState.uiControlsEnabled !== false)
        errors.push('uiControlsEnabled must be false');
    if (qzState.botActionsEnabled !== false)
        errors.push('botActionsEnabled must be false');
    // Reject premature/forbidden gameplay fields
    const FORBIDDEN_FIELDS = [
        'declarationHistory', 'overcallCandidates', 'selectedDeclaration',
        'qzWinner', 'basingState', 'scoreState', 'trickState',
        'playableActions', 'botDecision', 'timerState',
    ];
    for (let f of FORBIDDEN_FIELDS) {
        if (qzState[f] != null)
            errors.push('qzState must not contain gameplay field: ' + f);
    }
    return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/**
 * Note 101 — Validates consistency between shellState.qzDeclarationState,
 * shellState.frameIndex, and shellState.dealInstance.dealInstanceId.
 *
 * @param {Object} shellState  Output of createThreePDAShellState() or mutated by advanceThreePDAShellFrame().
 * @returns {{ valid: boolean, errors?: string[] }}
 */
function validate3PDAShellQZDeclarationConsistency(shellState) {
    if (!shellState || typeof shellState !== 'object')
        return { valid: false, errors: ['shellState is null/undefined or not an object'] };
    let qz = shellState.qzDeclarationState;
    if (!qz || typeof qz !== 'object')
        return { valid: false, errors: ['qzDeclarationState missing from shellState'] };
    let qzV = validate3PDAQZDeclarationState(qz);
    if (!qzV.valid)
        return { valid: false, errors: ['qzDeclarationState invalid: ' + (qzV.errors || []).join(', ')] };
    let errors = [];
    if (typeof shellState.frameIndex === 'number' && qz.frameIndex !== null &&
            qz.frameIndex !== shellState.frameIndex) {
        errors.push('qzDeclarationState.frameIndex (' + qz.frameIndex +
                    ') does not match shellState.frameIndex (' + shellState.frameIndex + ')');
    }
    let di = shellState.dealInstance;
    if (di && qz.dealInstanceId !== null && qz.dealInstanceId !== di.dealInstanceId) {
        errors.push('qzDeclarationState.dealInstanceId (' + qz.dealInstanceId +
                    ') does not match dealInstance.dealInstanceId (' + di.dealInstanceId + ')');
    }
    return errors.length === 0 ? { valid: true } : { valid: false, errors };
}
// END Note 101 scaffolding

// ---------------------------------------------------------------------------
// Note 102 — 3PDA basing/bottom state shell, no basing logic, no UI controls
//
// Adds a neutral basing/bottom metadata container for the future base/bottom
// lifecycle layer.  Base cards remain internal assigned manifest-IDs only.
// basingActorId/controllingActorId are null.  availableActions is empty.
// logicImplemented / uiControlsEnabled / botActionsEnabled / scoringEnabled are false.
// No base reveal, pickup, bury/exchange, actor selection, scoring, or top-level phase.
// ---------------------------------------------------------------------------

/**
 * Note 102 — Creates a neutral, unresolved basing/bottom state shell.
 * Pure factory — returns a plain metadata object.  Does not render UI, does not mutate
 * cardState, dealLifecycle, or qzDeclarationState, does not reveal base cards, does not
 * determine basing actor, does not call bot/scoring logic.
 *
 * @param {Object} shellState  Parent 3PDA shell (used only to read frameIndex/dealInstanceId/cardState).
 * @returns {Object}  Unresolved basing/bottom state descriptor.
 */
function create3PDABasingBottomState(shellState) {
    // Derive base card count from activated cardState if available; fall back to formula constant.
    let baseCardCount = 8; // default from create3PDACardZonePlan
    if (shellState && shellState.cardState &&
            shellState.cardState.zones && shellState.cardState.zones.base &&
            Array.isArray(shellState.cardState.zones.base.cards)) {
        baseCardCount = shellState.cardState.zones.base.cards.length;
    }
    let baseCardsAssigned = !!(shellState && shellState.cardState &&
        shellState.cardState.activationStatus === 'manifest-ids-in-zones');
    return {
        kind:                 'three-pda-basing-bottom-state',
        tableFormat:          'three-player-dummy-ally',
        status:               'not-started',
        lifecycleStage:       'basing-unresolved',
        baseZoneId:           'base',
        baseCardCount:        baseCardCount,
        baseCardsAssigned:    baseCardsAssigned,
        baseCardsRevealed:    false,
        baseCardsPickedUp:    false,
        baseCardsBuried:      false,
        basingActorId:        null,
        controllingActorId:   null,
        availableActions:     [],
        logicImplemented:     false,
        uiControlsEnabled:    false,
        botActionsEnabled:    false,
        scoringEnabled:       false,
        frameIndex:           (shellState && typeof shellState.frameIndex === 'number')
                                  ? shellState.frameIndex : null,
        dealInstanceId:       (shellState && shellState.dealInstance)
                                  ? shellState.dealInstance.dealInstanceId : null,
    };
}

/**
 * Note 102 — Validates a 3PDA basing/bottom state descriptor.
 * Checks kind/tableFormat, lifecycle stage, false flags, null actor/control,
 * empty availableActions, and absence of forbidden gameplay fields.
 *
 * @param {Object} basingState  Output of create3PDABasingBottomState().
 * @returns {{ valid: boolean, errors?: string[] }}
 */
function validate3PDABasingBottomState(basingState) {
    if (!basingState || typeof basingState !== 'object')
        return { valid: false, errors: ['basingState is null/undefined or not an object'] };
    let errors = [];
    if (basingState.kind !== 'three-pda-basing-bottom-state')
        errors.push('kind must be three-pda-basing-bottom-state');
    if (basingState.tableFormat !== 'three-player-dummy-ally')
        errors.push('tableFormat must be three-player-dummy-ally');
    const ALLOWED_STATUSES = ['not-started', 'unresolved'];
    if (!ALLOWED_STATUSES.includes(basingState.status))
        errors.push('status must be not-started or unresolved, got: ' + basingState.status);
    if (basingState.lifecycleStage !== 'basing-unresolved')
        errors.push('lifecycleStage must be basing-unresolved');
    if (basingState.baseZoneId !== 'base')
        errors.push('baseZoneId must be base');
    if (basingState.baseCardsRevealed !== false)
        errors.push('baseCardsRevealed must be false');
    if (basingState.baseCardsPickedUp !== false)
        errors.push('baseCardsPickedUp must be false');
    if (basingState.baseCardsBuried !== false)
        errors.push('baseCardsBuried must be false');
    if (basingState.basingActorId !== null)
        errors.push('basingActorId must be null');
    if (basingState.controllingActorId !== null)
        errors.push('controllingActorId must be null');
    if (!Array.isArray(basingState.availableActions) || basingState.availableActions.length !== 0)
        errors.push('availableActions must be an empty array');
    if (basingState.logicImplemented !== false)
        errors.push('logicImplemented must be false');
    if (basingState.uiControlsEnabled !== false)
        errors.push('uiControlsEnabled must be false');
    if (basingState.botActionsEnabled !== false)
        errors.push('botActionsEnabled must be false');
    if (basingState.scoringEnabled !== false)
        errors.push('scoringEnabled must be false');
    // Reject premature/forbidden gameplay fields
    const FORBIDDEN_FIELDS = [
        'revealedBaseCards', 'pickedUpBaseCards', 'buriedCards', 'burySelection',
        'basingActor', 'baseOwner', 'baseScoreCards', 'baseScore',
        'basingTimer', 'basingPrompt', 'playableActions', 'botDecision',
        'trickState', 'scoreState',
    ];
    for (let f of FORBIDDEN_FIELDS) {
        if (basingState[f] != null)
            errors.push('basingState must not contain gameplay field: ' + f);
    }
    return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/**
 * Note 102 — Validates consistency between shellState.basingBottomState,
 * shellState.frameIndex, shellState.dealInstance.dealInstanceId, and
 * shellState.cardState base zone count.
 *
 * @param {Object} shellState  Output of createThreePDAShellState() or mutated by advanceThreePDAShellFrame().
 * @returns {{ valid: boolean, errors?: string[] }}
 */
function validate3PDAShellBasingBottomConsistency(shellState) {
    if (!shellState || typeof shellState !== 'object')
        return { valid: false, errors: ['shellState is null/undefined or not an object'] };
    let bs = shellState.basingBottomState;
    if (!bs || typeof bs !== 'object')
        return { valid: false, errors: ['basingBottomState missing from shellState'] };
    let bsV = validate3PDABasingBottomState(bs);
    if (!bsV.valid)
        return { valid: false, errors: ['basingBottomState invalid: ' + (bsV.errors || []).join(', ')] };
    let errors = [];
    if (typeof shellState.frameIndex === 'number' && bs.frameIndex !== null &&
            bs.frameIndex !== shellState.frameIndex) {
        errors.push('basingBottomState.frameIndex (' + bs.frameIndex +
                    ') does not match shellState.frameIndex (' + shellState.frameIndex + ')');
    }
    let di = shellState.dealInstance;
    if (di && bs.dealInstanceId !== null && bs.dealInstanceId !== di.dealInstanceId) {
        errors.push('basingBottomState.dealInstanceId (' + bs.dealInstanceId +
                    ') does not match dealInstance.dealInstanceId (' + di.dealInstanceId + ')');
    }
    // baseCardCount consistency
    let cs = shellState.cardState;
    if (cs && cs.zones && cs.zones.base && Array.isArray(cs.zones.base.cards)) {
        let actualCount = cs.zones.base.cards.length;
        if (bs.baseCardCount !== actualCount) {
            errors.push('basingBottomState.baseCardCount (' + bs.baseCardCount +
                        ') does not match cardState base zone count (' + actualCount + ')');
        }
    }
    return errors.length === 0 ? { valid: true } : { valid: false, errors };
}
// END Note 102 scaffolding

/**
 * Creates a metadata-bearing empty 3PDA live card-state container.
 * Attaches manifest metadata (Note 72), shuffle metadata (Note 73), and
 * dry-run deal-plan metadata (Note 78 / Note 74).
 * All hand/base zones remain empty (cards=null). containsLiveCards remains false.
 * Pure helper — does not mutate shell state, render cards, or change phase.
 *
 * @param {Object} cardZonePlan  Output of create3PDACardZonePlan() (Note 70).
 * @param {{ seed?: string|number }} [options]  Optional seed for shuffle; defaults to THREE_PDA_SHELL_DEBUG_SEED.
 * @returns {Object}  Metadata-bearing empty live card-state container.
 */
function create3PDAMetadataBearingEmptyCardState(cardZonePlan, options) {
    let seed = (options && options.seed != null) ? options.seed : THREE_PDA_SHELL_DEBUG_SEED;

    // Step 1: empty container (Note 75) — zones null, no live cards
    let cardState = create3PDAEmptyLiveCardState(cardZonePlan);

    // Step 2: deck manifest (Note 72) — manifest IDs only, no zone assignment
    let manifest = create3PDADryRunDeckManifest(cardZonePlan);
    let mResult = validate3PDADryRunDeckManifest(manifest);
    if (!mResult.valid) {
        throw new Error('Note 77: manifest invalid: ' + (mResult.errors || []).join(', '));
    }

    // Step 3: shuffle order (Note 73) — permutation of manifest IDs, no zone assignment
    let shuffleOrder = create3PDADryRunShuffleOrder(manifest, { seed: seed });
    let sResult = validate3PDADryRunShuffleOrder(shuffleOrder, manifest);
    if (!sResult.valid) {
        throw new Error('Note 77: shuffle order invalid: ' + (sResult.errors || []).join(', '));
    }

    // Step 4 (Note 78): dry-run deal plan (Note 74) — plannedAssignments as metadata only.
    // IDs are stored in dealPlanMetadata.plannedAssignments, NOT copied into zone cards.
    // Zone cards remain null. containsLiveCards remains false.
    let dealPlan = create3PDADryRunDealPlan(shuffleOrder, cardZonePlan);
    let dpResult = validate3PDADryRunDealPlan(dealPlan, shuffleOrder, cardZonePlan);
    if (!dpResult.valid) {
        throw new Error('Note 78: deal plan invalid: ' + (dpResult.errors || []).join(', '));
    }

    // Step 5: attach all metadata — IDs stored in metadata, NOT in zone cards.
    // Zone cards remain null. containsLiveCards remains false.
    cardState.manifestMetadata = {
        kind:              manifest.kind,
        manifestOnly:      manifest.manifestOnly,
        deckCount:         manifest.deckCount,
        totalCards:        manifest.totalCards,
        cardIdentityCount: manifest.cardIdentities.length,
        manifestCardIds:   manifest.cardIdentities.map(function(c) { return c.manifestCardId; }),
    };
    cardState.shuffleMetadata = {
        kind:                   shuffleOrder.kind,
        shuffleOrderOnly:       shuffleOrder.shuffleOrderOnly,
        manifestOnly:           shuffleOrder.manifestOnly,
        seed:                   shuffleOrder.seed,
        deckCount:              shuffleOrder.deckCount,
        totalCards:             shuffleOrder.totalCards,
        orderedManifestCardIds: shuffleOrder.orderedManifestCardIds,
        sourceManifestKind:     shuffleOrder.sourceManifestKind,
    };
    // Note 78: deal-plan metadata only — plannedAssignments are dry-run IDs, never live zone cards.
    cardState.dealPlanMetadata = {
        kind:             dealPlan.kind,
        dryRunDealOnly:   dealPlan.dryRunDealOnly,
        manifestOnly:     dealPlan.manifestOnly,
        deckCount:        dealPlan.deckCount,
        totalCards:       dealPlan.totalCards,
        cardsPerHandZone: dealPlan.cardsPerHandZone,
        baseCardCount:    dealPlan.baseCardCount,
        assignmentPolicy: dealPlan.assignmentPolicy,
        handZoneOrder:    dealPlan.handZoneOrder,
        baseZoneId:       dealPlan.baseZoneId,
        plannedAssignments: {
            N:    dealPlan.plannedAssignments.N.slice(),
            Sw:   dealPlan.plannedAssignments.Sw.slice(),
            Se:   dealPlan.plannedAssignments.Se.slice(),
            Ay:   dealPlan.plannedAssignments.Ay.slice(),
            base: dealPlan.plannedAssignments.base.slice(),
        },
    };

    return cardState;
}

/**
 * Validates a metadata-bearing empty 3PDA live card-state container.
 * Runs base Note 75 validation plus metadata field checks.
 * Ensures manifest/shuffle metadata is present and valid while zones remain empty.
 * Rejects live cards, zone assignment, deal plan, hands/base, and gameplay fields.
 *
 * @param {Object} cardState  Output of create3PDAMetadataBearingEmptyCardState().
 * @returns {{ valid: boolean, errors?: string[] }}
 */
function validate3PDAMetadataBearingEmptyCardState(cardState) {
    // Base empty-container checks (zones, containsLiveCards, count formulas)
    let baseResult = validate3PDAEmptyLiveCardState(cardState);
    if (!baseResult.valid) return baseResult;

    let errors = [];

    // Validate manifestMetadata
    let mm = cardState.manifestMetadata;
    if (!mm || typeof mm !== 'object') {
        errors.push('manifestMetadata must be present as an object');
    } else {
        if (mm.kind !== 'three-pda-dry-run-deck-manifest')
            errors.push('manifestMetadata.kind must be three-pda-dry-run-deck-manifest');
        if (mm.manifestOnly !== true)
            errors.push('manifestMetadata.manifestOnly must be true');
        if (typeof mm.deckCount !== 'number' || mm.deckCount < 1)
            errors.push('manifestMetadata.deckCount must be a positive number');
        if (mm.totalCards !== 54 * mm.deckCount)
            errors.push('manifestMetadata.totalCards must equal 54*deckCount');
        if (!Array.isArray(mm.manifestCardIds))
            errors.push('manifestMetadata.manifestCardIds must be an array');
        else if (mm.manifestCardIds.length !== mm.totalCards)
            errors.push('manifestMetadata.manifestCardIds.length must equal totalCards');
        if (typeof mm.cardIdentityCount !== 'number' || mm.cardIdentityCount !== mm.totalCards)
            errors.push('manifestMetadata.cardIdentityCount must equal totalCards');
    }

    // Validate shuffleMetadata
    let sm = cardState.shuffleMetadata;
    if (!sm || typeof sm !== 'object') {
        errors.push('shuffleMetadata must be present as an object');
    } else {
        if (sm.kind !== 'three-pda-dry-run-shuffle-order')
            errors.push('shuffleMetadata.kind must be three-pda-dry-run-shuffle-order');
        if (sm.shuffleOrderOnly !== true)
            errors.push('shuffleMetadata.shuffleOrderOnly must be true');
        if (sm.manifestOnly !== true)
            errors.push('shuffleMetadata.manifestOnly must be true');
        if (!Array.isArray(sm.orderedManifestCardIds))
            errors.push('shuffleMetadata.orderedManifestCardIds must be an array');
        else {
            let mmTotal = (mm && mm.totalCards) || 0;
            if (sm.orderedManifestCardIds.length !== mmTotal)
                errors.push('shuffleMetadata.orderedManifestCardIds.length must equal ' + mmTotal);
            // Permutation check against manifest IDs
            if (mm && Array.isArray(mm.manifestCardIds)) {
                let mSet = new Set(mm.manifestCardIds);
                let seen = new Set();
                for (let id of sm.orderedManifestCardIds) {
                    if (!mSet.has(id)) errors.push('shuffleMetadata unknown ID: ' + id);
                    if (seen.has(id))  errors.push('shuffleMetadata duplicate ID: ' + id);
                    seen.add(id);
                }
                for (let id of mSet) {
                    if (!seen.has(id)) errors.push('shuffleMetadata missing manifest ID: ' + id);
                }
            }
        }
    }

    // Validate dealPlanMetadata (Note 78)
    let dm = cardState.dealPlanMetadata;
    if (!dm || typeof dm !== 'object') {
        errors.push('dealPlanMetadata must be present as an object');
    } else {
        if (dm.kind !== 'three-pda-dry-run-deal-plan')
            errors.push('dealPlanMetadata.kind must be three-pda-dry-run-deal-plan');
        if (dm.dryRunDealOnly !== true)
            errors.push('dealPlanMetadata.dryRunDealOnly must be true');
        if (dm.manifestOnly !== true)
            errors.push('dealPlanMetadata.manifestOnly must be true');
        if (typeof dm.cardsPerHandZone !== 'number' || dm.cardsPerHandZone < 1)
            errors.push('dealPlanMetadata.cardsPerHandZone must be a positive number');
        if (typeof dm.baseCardCount !== 'number' || dm.baseCardCount < 1)
            errors.push('dealPlanMetadata.baseCardCount must be a positive number');
        let pa = dm.plannedAssignments;
        if (!pa || typeof pa !== 'object') {
            errors.push('dealPlanMetadata.plannedAssignments must be an object');
        } else {
            // Count checks
            for (let z of ['N','Sw','Se','Ay']) {
                if (!Array.isArray(pa[z]))
                    errors.push('dealPlanMetadata.plannedAssignments.' + z + ' must be an array');
                else if (pa[z].length !== dm.cardsPerHandZone)
                    errors.push('dealPlanMetadata.' + z + ' count must equal cardsPerHandZone');
            }
            if (!Array.isArray(pa.base))
                errors.push('dealPlanMetadata.plannedAssignments.base must be an array');
            else if (pa.base.length !== dm.baseCardCount)
                errors.push('dealPlanMetadata.base count must equal baseCardCount');
            // Consistency: every ID in dealPlanMetadata must be in shuffleMetadata
            if (sm && Array.isArray(sm.orderedManifestCardIds)) {
                let sSet = new Set(sm.orderedManifestCardIds);
                let allAssigned = [];
                for (let z of ['N','Sw','Se','Ay','base']) {
                    if (Array.isArray(pa[z])) allAssigned = allAssigned.concat(pa[z]);
                }
                let seen = new Set();
                for (let id of allAssigned) {
                    if (!sSet.has(id)) errors.push('dealPlanMetadata unknown ID: ' + id);
                    if (seen.has(id))  errors.push('dealPlanMetadata duplicate ID: ' + id);
                    seen.add(id);
                }
                for (let id of sSet) {
                    if (!seen.has(id)) errors.push('dealPlanMetadata missing shuffle ID: ' + id);
                }
            }
        }
    }

    // Belt-and-suspenders: reject live/deal/hands/base fields on container root
    for (let banned of ['liveDeck', 'deck', 'hands', 'baseCards', 'dealtCards',
                        'dealingSequence', 'dealing', 'declaration', 'qz',
                        'scoring', 'tricks', 'play', 'plannedAssignments', 'dealPlan']) {
        if (banned in cardState) errors.push('cardState must not have field: ' + banned);
    }

    return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

// ---------------------------------------------------------------------------
// Note 79 — Activation helper: copy dealPlanMetadata into live zone IDs
// ---------------------------------------------------------------------------

/**
 * Activates a metadata-bearing empty 3PDA cardState by copying
 * dealPlanMetadata.plannedAssignments into zone.cards as manifest ID arrays.
 * Pure helper — does not mutate the input cardState.
 * Sets containsLiveCards=true, activationStatus='manifest-ids-in-zones',
 * liveCardPayloadKind='manifest-id'.
 * Does not create card objects, render cards, change phase, or start gameplay.
 *
 * @param {Object} cardState  Output of create3PDAMetadataBearingEmptyCardState().
 * @returns {Object}  Activated cardState with manifest ID arrays in zone.cards.
 */
function activate3PDADealPlanMetadataIntoCardState(cardState) {
    let vr = validate3PDAMetadataBearingEmptyCardState(cardState);
    if (!vr.valid) {
        throw new Error('Note 79: input cardState invalid: ' + (vr.errors || []).join(', '));
    }
    let pa = cardState.dealPlanMetadata.plannedAssignments;
    // Build new zones — manifest ID strings only, no card objects
    let oldZones = cardState.zones;
    let newZones = {
        N:    Object.assign({}, oldZones.N,    { cards: pa.N.slice() }),
        Sw:   Object.assign({}, oldZones.Sw,   { cards: pa.Sw.slice() }),
        Se:   Object.assign({}, oldZones.Se,   { cards: pa.Se.slice() }),
        Ay:   Object.assign({}, oldZones.Ay,   { cards: pa.Ay.slice() }),
        base: Object.assign({}, oldZones.base, { cards: pa.base.slice() }),
    };
    // Return new object — input cardState is not mutated
    return Object.assign({}, cardState, {
        containsLiveCards:   true,
        activationStatus:    'manifest-ids-in-zones',
        liveCardPayloadKind: 'manifest-id',
        zones:               newZones,
    });
}

/**
 * Validates an activated 3PDA card-state produced by activate3PDADealPlanMetadataIntoCardState.
 * Confirms containsLiveCards=true, manifest-ID-only payloads, correct zone counts,
 * one-time assignment from dealPlanMetadata, metadata preserved, no gameplay fields.
 *
 * @param {Object} cardState  Output of activate3PDADealPlanMetadataIntoCardState().
 * @returns {{ valid: boolean, errors?: string[] }}
 */
function validate3PDAActivatedCardState(cardState) {
    let errors = [];
    if (!cardState || typeof cardState !== 'object') return { valid: false, errors: ['cardState is null/undefined'] };
    if (cardState.containsLiveCards !== true)
        errors.push('containsLiveCards must be true');
    if (cardState.activationStatus !== 'manifest-ids-in-zones')
        errors.push('activationStatus must be manifest-ids-in-zones');
    if (cardState.liveCardPayloadKind !== 'manifest-id')
        errors.push('liveCardPayloadKind must be manifest-id');

    // Zones must exist with card arrays
    let zones = cardState.zones;
    if (!zones || typeof zones !== 'object') {
        errors.push('zones must be an object');
        return { valid: false, errors };
    }
    let expectedZones = ['N', 'Sw', 'Se', 'Ay', 'base'];
    for (let z of expectedZones) {
        if (!zones[z]) { errors.push('missing zone: ' + z); continue; }
        if (!Array.isArray(zones[z].cards)) errors.push(z + '.cards must be an array');
    }
    for (let z of Object.keys(zones)) {
        if (!expectedZones.includes(z)) errors.push('unexpected zone: ' + z);
    }

    // Retrieve metadata for validation
    let dm = cardState.dealPlanMetadata;
    let sm = cardState.shuffleMetadata;
    let mm = cardState.manifestMetadata;

    // Metadata must still be present
    if (!mm || typeof mm !== 'object') errors.push('manifestMetadata must be present');
    if (!sm || typeof sm !== 'object') errors.push('shuffleMetadata must be present');
    if (!dm || typeof dm !== 'object') errors.push('dealPlanMetadata must be present');

    if (dm && typeof dm === 'object' && dm.plannedAssignments) {
        let pa = dm.plannedAssignments;
        let cph = dm.cardsPerHandZone;
        let bcc = dm.baseCardCount;
        // Count checks
        for (let z of ['N', 'Sw', 'Se', 'Ay']) {
            if (zones[z] && Array.isArray(zones[z].cards)) {
                if (zones[z].cards.length !== cph)
                    errors.push(z + '.cards.length must equal cardsPerHandZone (' + cph + ')');
                // Exact match against plannedAssignments
                if (Array.isArray(pa[z])) {
                    for (let i = 0; i < pa[z].length; i++) {
                        if (zones[z].cards[i] !== pa[z][i])
                            errors.push(z + '.cards[' + i + '] does not match plannedAssignments');
                    }
                }
            }
        }
        if (zones.base && Array.isArray(zones.base.cards)) {
            if (zones.base.cards.length !== bcc)
                errors.push('base.cards.length must equal baseCardCount (' + bcc + ')');
            if (Array.isArray(pa.base)) {
                for (let i = 0; i < pa.base.length; i++) {
                    if (zones.base.cards[i] !== pa.base[i])
                        errors.push('base.cards[' + i + '] does not match plannedAssignments');
                }
            }
        }
    }

    // All zone card entries must be strings; no card objects or DOM objects
    let allAssigned = [];
    for (let z of expectedZones) {
        if (zones[z] && Array.isArray(zones[z].cards)) {
            for (let entry of zones[z].cards) {
                if (typeof entry !== 'string')
                    errors.push(z + ' zone contains non-string entry: ' + typeof entry);
                allAssigned.push(entry);
            }
        }
    }

    // One-time assignment: every shuffle ID appears exactly once
    if (sm && Array.isArray(sm.orderedManifestCardIds)) {
        let sSet = new Set(sm.orderedManifestCardIds);
        let seen = new Set();
        for (let id of allAssigned) {
            if (!sSet.has(id)) errors.push('unknown manifest ID in zones: ' + id);
            if (seen.has(id))  errors.push('duplicate manifest ID in zones: ' + id);
            seen.add(id);
        }
        for (let id of sSet) {
            if (!seen.has(id)) errors.push('missing shuffle ID from zones: ' + id);
        }
    }

    // Reject gameplay/dealing fields
    for (let banned of ['liveDeck', 'deck', 'hands', 'baseCards', 'dealtCards',
                        'dealingSequence', 'dealing', 'declaration', 'qz',
                        'scoring', 'tricks', 'play', 'plannedAssignments', 'dealPlan',
                        'timerHandle', 'botState']) {
        if (banned in cardState) errors.push('activated cardState must not have field: ' + banned);
    }

    return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

// ---------------------------------------------------------------------------
// TEMPORARY 3PDA SCAFFOLDING — Note 82: manifest-ID card identity resolver helpers
// Pure read-only helpers. Do not mutate cardState or zone arrays.
// ---------------------------------------------------------------------------

/**
 * Build a read-only Map from manifestCardId -> manifest identity record.
 * Source: cardState.manifestMetadata.cardIdentities (or reconstructed from manifestCardIds).
 * Validates uniqueness and X/V/W conventions.
 * Does not mutate cardState.
 * @param {object} cardState - activated 3PDA live card state
 * @returns {Map<string,object>}
 */
function create3PDAManifestIdentityMap(cardState) {
    if (!cardState || typeof cardState !== 'object')
        throw new Error('Note 82: cardState must be an object');
    let mm = cardState.manifestMetadata;
    if (!mm || typeof mm !== 'object')
        throw new Error('Note 82: cardState.manifestMetadata missing');
    if (!Array.isArray(mm.manifestCardIds))
        throw new Error('Note 82: manifestMetadata.manifestCardIds must be an array');

    // Prefer full cardIdentities if present (available from raw manifest), else reconstruct
    // from manifestCardIds using ID parsing.
    let identities = Array.isArray(mm.cardIdentities) ? mm.cardIdentities : null;

    let map = new Map();
    if (identities) {
        // Full identity records available
        for (let rec of identities) {
            if (!rec || typeof rec.manifestCardId !== 'string')
                throw new Error('Note 82: identity record missing manifestCardId string');
            if (map.has(rec.manifestCardId))
                throw new Error('Note 82: duplicate manifestCardId in identities: ' + rec.manifestCardId);
            // Validate rank/joker conventions
            if (rec.rank === '10')
                throw new Error('Note 82: rank "10" found; must use "X": ' + rec.manifestCardId);
            map.set(rec.manifestCardId, Object.freeze(Object.assign({}, rec)));
        }
    } else {
        // Reconstruct from manifestCardIds using ID string format D<d>-<suit>-<rank> or D<d>-V/W
        for (let id of mm.manifestCardIds) {
            if (typeof id !== 'string')
                throw new Error('Note 82: manifestCardIds entry not a string');
            if (map.has(id))
                throw new Error('Note 82: duplicate manifestCardId: ' + id);
            // Parse: D1-h-X  D1-w-V  D1-w-W  D2-s-A
            let m = id.match(/^D(\d+)-([dchsw])-?(.+)?$/);
            if (!m) throw new Error('Note 82: cannot parse manifestCardId: ' + id);
            let deckOrdinal = Number(m[1]);
            let rawSuit = m[2];
            let rawRank = m[3] || null;
            let isJoker = (rawRank === 'V' || rawRank === 'W') && rawSuit === 'w';
            if (rawRank === '10') throw new Error('Note 82: rank "10" found; must use "X": ' + id);
            let rec = Object.freeze({
                manifestCardId: id,
                deckOrdinal,
                suit: rawSuit,
                rank: rawRank,
                isJoker,
                jokerKind: isJoker ? (rawRank === 'V' ? 'small' : 'big') : null,
            });
            map.set(id, rec);
        }
    }

    if (map.size !== mm.manifestCardIds.length)
        throw new Error('Note 82: map size mismatch (duplicates removed)');
    return map;
}

/**
 * Resolve a single manifest ID to its manifest identity record.
 * Rejects unknown IDs and non-string IDs.
 * Does not mutate cardState.
 * @param {object} cardState
 * @param {string} manifestCardId
 * @returns {object} frozen manifest identity record
 */
function resolve3PDAManifestCardIdentity(cardState, manifestCardId) {
    if (typeof manifestCardId !== 'string')
        throw new Error('Note 82: manifestCardId must be a string, got: ' + typeof manifestCardId);
    let map = create3PDAManifestIdentityMap(cardState);
    if (!map.has(manifestCardId))
        throw new Error('Note 82: unknown manifestCardId: ' + manifestCardId);
    return map.get(manifestCardId);
}

const THREE_PDA_VALID_ZONE_IDS = ['N', 'Sw', 'Se', 'Ay', 'base'];

/**
 * Return the manifest ID list for a zone. Does not mutate zone.cards.
 * @param {object} cardState
 * @param {string} zoneId - one of N/Sw/Se/Ay/base
 * @returns {string[]} copy of zone.cards
 */
function get3PDAZoneManifestIds(cardState, zoneId) {
    if (!THREE_PDA_VALID_ZONE_IDS.includes(zoneId))
        throw new Error('Note 82: invalid zoneId: ' + zoneId);
    if (!cardState || !cardState.zones || !cardState.zones[zoneId])
        throw new Error('Note 82: zone missing: ' + zoneId);
    let cards = cardState.zones[zoneId].cards;
    if (!Array.isArray(cards))
        throw new Error('Note 82: zone.cards not an array for zone: ' + zoneId);
    return cards.slice(); // copy, never mutate
}

/**
 * Resolve all manifest IDs in a zone to manifest identity records.
 * Rejects unknown IDs and duplicate IDs within the zone.
 * Does not mutate zone.cards or store objects in zones.
 * @param {object} cardState
 * @param {string} zoneId - one of N/Sw/Se/Ay/base
 * @returns {object[]} array of frozen manifest identity records (same order as zone.cards)
 */
function resolve3PDAZoneManifestCardIdentities(cardState, zoneId) {
    let ids = get3PDAZoneManifestIds(cardState, zoneId);
    let map = create3PDAManifestIdentityMap(cardState);
    let seen = new Set();
    let result = [];
    for (let id of ids) {
        if (!map.has(id))
            throw new Error('Note 82: unknown manifestCardId in zone ' + zoneId + ': ' + id);
        if (seen.has(id))
            throw new Error('Note 82: duplicate manifestCardId in zone ' + zoneId + ': ' + id);
        seen.add(id);
        result.push(map.get(id));
    }
    return result;
}

/**
 * Validate resolved zone identities.
 * Checks: count, order, no unknown IDs, no duplicates, no render/owner/DOM fields.
 * @param {object} cardState
 * @param {string} zoneId
 * @param {object[]} resolvedIdentities
 * @returns {{ valid: boolean, errors?: string[] }}
 */
function validate3PDAResolvedZoneIdentities(cardState, zoneId, resolvedIdentities) {
    let errors = [];
    if (!THREE_PDA_VALID_ZONE_IDS.includes(zoneId)) {
        errors.push('invalid zoneId: ' + zoneId);
        return { valid: false, errors };
    }
    if (!Array.isArray(resolvedIdentities)) {
        errors.push('resolvedIdentities must be an array');
        return { valid: false, errors };
    }
    let zoneIds;
    try { zoneIds = get3PDAZoneManifestIds(cardState, zoneId); }
    catch (e) { errors.push('zone error: ' + e.message); return { valid: false, errors }; }

    if (resolvedIdentities.length !== zoneIds.length)
        errors.push('resolved count ' + resolvedIdentities.length + ' != zone count ' + zoneIds.length);

    let seenIds = new Set();
    let map;
    try { map = create3PDAManifestIdentityMap(cardState); } catch (e) { errors.push('map error: ' + e.message); }

    for (let i = 0; i < resolvedIdentities.length; i++) {
        let rec = resolvedIdentities[i];
        if (!rec || typeof rec !== 'object') { errors.push('[' + i + '] not an object'); continue; }
        // Must have manifestCardId
        if (typeof rec.manifestCardId !== 'string') { errors.push('[' + i + '] missing manifestCardId string'); continue; }
        // Must match zone order
        if (i < zoneIds.length && rec.manifestCardId !== zoneIds[i])
            errors.push('[' + i + '] manifestCardId ' + rec.manifestCardId + ' != zone ID ' + zoneIds[i]);
        // No duplicates
        if (seenIds.has(rec.manifestCardId)) errors.push('[' + i + '] duplicate: ' + rec.manifestCardId);
        seenIds.add(rec.manifestCardId);
        // Unknown ID
        if (map && !map.has(rec.manifestCardId)) errors.push('[' + i + '] unknown ID: ' + rec.manifestCardId);
        // Forbidden render/owner/DOM fields
        for (let f of ['owner', 'dealtTo', 'zoneId', 'displayCard', 'selected', 'element',
                       'innerHTML', 'className', 'style', 'nodeType', 'renderPayload']) {
            if (f in rec) errors.push('[' + i + '] forbidden field: ' + f);
        }
        // Rank must not be "10"
        if (rec.rank === '10') errors.push('[' + i + '] rank "10" found; must use "X"');
    }
    return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

// TEMPORARY 3PDA SCAFFOLDING — Note 83: read-only zone snapshot helpers
// Pure, non-mutating. No rendering, no selection, no zone conversion.

// Zone-kind metadata (sealed, used only by snapshot helpers).
const THREE_PDA_ZONE_KIND_META = Object.freeze({
    N:    Object.freeze({ zoneKind: 'real-player-hand', isActorZone: true,  isRealPlayer: true,  isDummy: false, isBaseZone: false, frameActorId: 'N',   realNaturalPosition: 'N'   }),
    Sw:   Object.freeze({ zoneKind: 'real-player-hand', isActorZone: true,  isRealPlayer: true,  isDummy: false, isBaseZone: false, frameActorId: 'Sw',  realNaturalPosition: 'Sw'  }),
    Se:   Object.freeze({ zoneKind: 'real-player-hand', isActorZone: true,  isRealPlayer: true,  isDummy: false, isBaseZone: false, frameActorId: 'Se',  realNaturalPosition: 'Se'  }),
    Ay:   Object.freeze({ zoneKind: 'dummy-hand',       isActorZone: true,  isRealPlayer: false, isDummy: true,  isBaseZone: false, frameActorId: 'Ay',  realNaturalPosition: null  }),
    base: Object.freeze({ zoneKind: 'base-bottom',      isActorZone: false, isRealPlayer: false, isDummy: false, isBaseZone: true,  frameActorId: null,  realNaturalPosition: null  }),
});

/**
 * create3PDAZoneSnapshot(cardState, zoneId)
 * Returns a read-only plain snapshot of one zone. Does not mutate cardState.
 */
function create3PDAZoneSnapshot(cardState, zoneId) {
    if (!THREE_PDA_VALID_ZONE_IDS.includes(zoneId)) {
        throw new Error('create3PDAZoneSnapshot: invalid zoneId: ' + zoneId);
    }
    if (!cardState || typeof cardState !== 'object') {
        throw new Error('create3PDAZoneSnapshot: cardState must be an object');
    }
    if (!cardState.zones || !cardState.zones[zoneId]) {
        throw new Error('create3PDAZoneSnapshot: zone missing: ' + zoneId);
    }
    // Use Note 82 resolvers — both return copies, no mutation
    const manifestCardIds    = get3PDAZoneManifestIds(cardState, zoneId);
    const resolvedIdentities = resolve3PDAZoneManifestCardIdentities(cardState, zoneId);

    const meta          = THREE_PDA_ZONE_KIND_META[zoneId];
    const expectedCount = cardState.zones[zoneId].expectedCount;

    return Object.freeze({
        kind:                  'three-pda-zone-snapshot',
        snapshotOnly:          true,
        renderingEnabled:      false,

        zoneId,
        zoneKind:              meta.zoneKind,
        isActorZone:           meta.isActorZone,
        isRealPlayer:          meta.isRealPlayer,
        isDummy:               meta.isDummy,
        isBaseZone:            meta.isBaseZone,
        frameActorId:          meta.frameActorId,
        realNaturalPosition:   meta.realNaturalPosition,

        expectedCount,
        actualCount:           manifestCardIds.length,

        payloadKind:           cardState.liveCardPayloadKind || 'manifest-id',
        manifestCardIds:       Object.freeze(manifestCardIds),
        resolvedIdentityCount: resolvedIdentities.length,
        resolvedIdentities:    Object.freeze(resolvedIdentities),
    });
}

/**
 * create3PDAAllZoneSnapshot(cardState)
 * Returns a read-only snapshot of all five zones in canonical order.
 * Throws if totalAssignedCount !== cardState.totalCards.
 * Does not mutate cardState.
 */
function create3PDAAllZoneSnapshot(cardState) {
    if (!cardState || typeof cardState !== 'object') {
        throw new Error('create3PDAAllZoneSnapshot: cardState must be an object');
    }
    const zoneOrder = ['N', 'Sw', 'Se', 'Ay', 'base'];
    const zones = {};
    let totalAssignedCount = 0;
    for (const zid of zoneOrder) {
        const snap = create3PDAZoneSnapshot(cardState, zid);
        zones[zid] = snap;
        totalAssignedCount += snap.actualCount;
    }
    const expectedTotalCards = typeof cardState.totalCards === 'number' ? cardState.totalCards : null;
    if (expectedTotalCards !== null && totalAssignedCount !== expectedTotalCards) {
        throw new Error(
            'create3PDAAllZoneSnapshot: totalAssignedCount ' + totalAssignedCount +
            ' !== expectedTotalCards ' + expectedTotalCards
        );
    }
    return Object.freeze({
        kind:               'three-pda-all-zone-snapshot',
        snapshotOnly:       true,
        renderingEnabled:   false,

        zoneOrder:          Object.freeze(zoneOrder.slice()),
        zones:              Object.freeze(zones),

        totalAssignedCount,
        expectedTotalCards,
    });
}
// END Note 83 scaffolding

// TEMPORARY 3PDA SCAFFOLDING — Note 84: card-zone display-placement snapshot helpers
// Pure, non-mutating. No rendering, no selection, no zone conversion.

/**
 * create3PDARawCardZoneDisplayPlacementSnapshot(frameModel, cardState, referenceFrameActorId)
 *
 * Maps activated card zones to semantic reference-relative display slots.
 * referenceFrameActorId must be a real player position: N, Sw, or Se (never Ay).
 * Does not mutate frameModel, cardState, or any zone snapshot.
 */
function create3PDARawCardZoneDisplayPlacementSnapshot(frameModel, cardState, referenceFrameActorId) {
    if (!frameModel || typeof frameModel !== 'object') {
        throw new Error('create3PDARawCardZoneDisplayPlacementSnapshot: frameModel required');
    }
    if (!THREE_PDA_REAL_NATURAL_POSITIONS_SET.has(referenceFrameActorId)) {
        throw new Error(
            'create3PDARawCardZoneDisplayPlacementSnapshot: referenceFrameActorId must be N/Sw/Se; got: ' +
            referenceFrameActorId
        );
    }

    // Build all-zone snapshot (Note 83 helper) — copies, no mutation
    const allZoneSnap = create3PDAAllZoneSnapshot(cardState);

    // Map each actor zone to its reference-relative display slot
    const actorZoneIds = ['N', 'Sw', 'Se', 'Ay'];
    const displaySlots = {};
    for (const frameActorId of actorZoneIds) {
        const refPos = get3PDAReferencePositionForFrameActor(
            frameModel, frameActorId, referenceFrameActorId
        );
        const zoneSnap = allZoneSnap.zones[frameActorId];
        displaySlots[refPos] = Object.freeze({
            frameActorId,
            zoneId:       frameActorId,
            zoneSnapshot: zoneSnap,
            count:        zoneSnap.actualCount,
        });
    }

    // Verify all four semantic slots are populated
    for (const slot of ['reference', 'afterhand', 'opposite', 'forehand']) {
        if (!displaySlots[slot]) {
            throw new Error(
                'create3PDARawCardZoneDisplayPlacementSnapshot: slot "' + slot + '" not populated'
            );
        }
    }

    // Base zone is non-actor metadata only
    const baseSnap = allZoneSnap.zones.base;
    const baseZone = Object.freeze({
        zoneId:          'base',
        zoneSnapshot:    baseSnap,
        count:           baseSnap.actualCount,
        displayAsCards:  false,
    });

    return Object.freeze({
        kind:                   'three-pda-card-zone-display-placement-snapshot',
        snapshotOnly:           true,
        renderingEnabled:       false,
        selectionEnabled:       false,

        referenceFrameActorId,

        displaySlots:           Object.freeze(displaySlots),
        baseZone,

        totalAssignedCount:     allZoneSnap.totalAssignedCount,
        expectedTotalCards:     allZoneSnap.expectedTotalCards,
    });
}

/**
 * create3PDACardZoneDisplayPlacementSnapshot(shellState)
 *
 * Shell-level wrapper. Uses shellState.selected3PDARealNaturalPosition as the
 * fixed reference (never shellReferenceActorId, which is debug-only).
 */
function create3PDACardZoneDisplayPlacementSnapshot(shellState) {
    if (!shellState || typeof shellState !== 'object') {
        throw new Error('create3PDACardZoneDisplayPlacementSnapshot: shellState required');
    }
    const referenceFrameActorId = get3PDARealGameReferenceActorId(shellState);
    return create3PDARawCardZoneDisplayPlacementSnapshot(
        shellState.currentFrameModel,
        shellState.cardState,
        referenceFrameActorId
    );
}
// END Note 84 scaffolding

// false = compact/collapsed (default); true = expanded (full details).
// Must not affect pivot state, frame model, or reference-position mapping.
let gThreePDAShellPanelExpanded = false;

// ---------------------------------------------------------------------------
// Card selection state
// ---------------------------------------------------------------------------
let selectedCardIds = new Set();

// Bot turn delay (ms)
const BOT_DELAY = 600;

// Dealing phase state
let currentDeclaration = null;   // declaration made by human during dealing
let gAutoStrain3rdTriggerCard = null; // 3rd undealt card used for auto-strain (note 44a)
let gAutoStrain3rdTriggered = false;
let dealingTimer     = null;   // setInterval handle for deal animation
let gFrameIntermittentTimeout = null;
let gFrameIntermittentEndsAt = 0;

// Frame number within current game (starts at 1, increments per frame)
let frameNumber = 0;

// Attackers' consecutive-attack streak counter (reset when pivot changes teams)
let attackersStreak = 0;

// Attackers' won counter cards (temporal order, reset per frame) — for §2 drawer
let wonCounterCards = [];

// Persistent name bar DOM refs [south, east, north, west]
let gDeskNamebars = [null, null, null, null];
let gCrossingSeatStatuses = [null, null, null, null];
let gCrossingState = null;
let gCrossingClaimControlsHost = null;
let gBtnCrossClaim = null;
let gBtnCrossDecline = null;

// Sequential overbase decision state (note 41)
let gOverbaseDecision = null;

// Declaration-history hover-box state (note 41f)
let gDeclarationHistoryRows = [];
let gDeclHistoryBox = null;
let gDeclHistoryTbody = null;
let gSeatsHoverLevelPositionBox = null;
let gSeatsTopLeftBoxView = 'seats';

function getDeclarationOrderAnchor() {
    if (game && typeof isPivotResolved === 'function' && isPivotResolved(game.pivot)) {
        return game.pivot;
    }
    let anchor = game && Number.isInteger(game.declarationOrderAnchor) ? game.declarationOrderAnchor : 0;
    if (anchor < 0 || anchor >= NUM_PLAYERS) return 0;
    return anchor;
}

function renderSeatsBoxFromGameState() {
    if (!gSeatsDiv || !game) return;
    if (typeof isPivotResolved === 'function' && isPivotResolved(game.pivot)) {
        let humanRelPivot = (game.pivot + 4 - HUMAN_PLAYER) % NUM_PLAYERS;
        let pivotPosNames = ['reference', 'afterhand', 'opposite', 'forehand'];
        gSeatsDiv.setAttribute('pivot', pivotPosNames[humanRelPivot]);
        return;
    }
    gSeatsDiv.setAttribute('pivot', 'undetermined');
}

function refreshTopLeftSeatAndLevelPositionBoxFromGameState() {
    renderSeatsBoxFromGameState();
    if (gSeatsTopLeftBoxView === 'level-position') {
        renderSeatsHoverLevelPositionSquare();
    }
}

// ---------------------------------------------------------------------------
// Timing state (note 24)
// ---------------------------------------------------------------------------

/**
 * Active timing context — structurally distinct timer phases (note 24 §17).
 * Possible timingPhase values:
 *   'intermittent'          — 2s frame-start non-interactive
 *   'finalDeclare'          — 5s final declaration window
 *   'overbaseWindow'        — 10s overbase calling window
 *   'playerMove'            — timed player move (set-base or play-card)
 *   'blockChoice'           — block-type choice (play-card timing)
 *   'fcContinuation'        — forehand-control continuation (same timing unit)
 *   null                    — no active timer
 */
let gTimingPhase = null;

// Timer interval handle (runs every 100ms for smooth countdown)
let gTimerInterval = null;

// Current countdown values (seconds, float)
let gShotClockRemaining = 0;
let gBankTimeRemaining  = 0;

// Whether shot clock or bank time is currently counting
// 'shot' = shot clock phase, 'bank' = bank time phase
let gTimerStage = 'shot';

// Timer DOM elements (created dynamically)
let gTimerOverlayEl  = null;   // desk-slot timer overlay
let gTimerCenterEl   = null;   // center-area timer
let gShotClockEl     = null;   // shot clock digit element
let gBankTimeEl      = null;   // bank time digit element

// "No declaration" tracking: which players have clicked "不亮" in current window
let gNoDeclareClicked = new Set();

// Callback to invoke when a timed window expires or is broken
let gTimerExpireCallback = null;
let gLiveTimerMeta = null;

// Pause/resume unanimous-agreement protocol state (note 52)
let pauseState = {
    phase: 'idle', // idle | waitingPauseAgreements | paused | waitingQuitConfirm | finished
    requesterSeat: null,
    agreementBySeat: ['neutral', 'neutral', 'neutral', 'neutral'],
    readyBySeat: ['neutral', 'neutral', 'neutral', 'neutral'],
    waitingRemainingMs: 0,
    waitingTimerId: null,
    rejectFlashTimerId: null,
    frozenSnapshot: null,
    pendingResumePrompt: false,
    quitRequesterSeat: null,
};

// ---------------------------------------------------------------------------
// Card rendering
// ---------------------------------------------------------------------------
function gameCreateCardContainer(card) {
    let cc = document.createElement('div');
    let tc = document.createElement('div');
    cc.appendChild(tc);
    cc.className = 'card-container';
    cc.setAttribute('suit', card.suitName);
    cc.setAttribute('rank', card.rankName);
    cc.setAttribute('data-card-id', card.cardId);
    cc.setAttribute('card-show', 'show-inhand');
    tc.className = 'card';

    let cr = document.createElement('div');
    cr.innerHTML = card.rankName === 'X' ? '1O' : card.rankName;
    cr.className = 'card-rank';

    let cs = document.createElement('div');
    cs.innerHTML = card.suitName === 'w' ? jokerHtml : suitTexts[card.suit];
    cs.className = 'card-suit';

    let cf = document.createElement('div');
    cf.innerHTML = card.suitName === 'w' ? jokerHtml : suitTexts[card.suit];
    cf.className = 'card-face';

    tc.appendChild(cr);
    tc.appendChild(cs);
    tc.appendChild(cf);
    return cc;
}

// ---------------------------------------------------------------------------
// Corner-card rendering (§1)
// ---------------------------------------------------------------------------
function createCornerCard(card, fcMode) {
    let el = document.createElement('div');
    el.className = 'corner-card';
    el.setAttribute('suit', card.suitName);
    el.setAttribute('rank', card.rankName);
    if (fcMode) el.setAttribute('data-fc', fcMode);
    let r = document.createElement('div');
    r.className = 'cc-rank';
    r.textContent = card.rankName === 'X' ? '1O' : card.rankName;
    let s = document.createElement('div');
    s.className = 'cc-suit';
    s.innerHTML = card.suitName === 'w' ? jokerHtml : suitTexts[card.suit];
    el.appendChild(r);
    el.appendChild(s);
    return el;
}

// ---------------------------------------------------------------------------
// Counter drawer (§2) — attackers' won counters
// ---------------------------------------------------------------------------
function updateCounterDrawer() {
    if (!gCounterDrawerInner) return;
    gCounterDrawerInner.innerHTML = '';
    for (let card of wonCounterCards) {
        gCounterDrawerInner.appendChild(createCornerCard(card));
    }
    // Multiplay compensation rows — one per event (note 39d §2)
    for (let el of Array.from(gCounterDrawer.querySelectorAll('.counter-mp-comp'))) el.remove();
    let events = (game && Array.isArray(game.multiplayCompensationEvents)) ? game.multiplayCompensationEvents : [];
    for (let evt of events) {
        let compRow = document.createElement('div');
        compRow.className = 'counter-mp-comp';
        let sign = evt.signed >= 0 ? '+' : '-';
        compRow.setAttribute('data-sign', sign);
        compRow.textContent = sign + Math.abs(evt.signed);
        gCounterDrawer.appendChild(compRow);
    }
    // Zero-space rule (note 25 §8)
    let hasContent = wonCounterCards.length > 0 || events.length > 0;
    gCounterDrawer.setAttribute('data-has-content', hasContent ? 'true' : 'false');
}

/**
 * Describe the lead type from leadInfo for status-bar display.
 * Returns { divisionKey, leadTypeKey } for i18n lookup.
 */
function describeLeadInfo(leadInfo) {
    let divisionKey = numberToDivisionName[leadInfo.division];
    let leadTypeKey;
    if (leadInfo.elements.length > 1) {
        leadTypeKey = 'multiplay';
    } else {
        let e = leadInfo.elements[0];
        if (e.copy === 1) leadTypeKey = 'single';
        else if (e.span === 1) leadTypeKey = 'pair';
        else leadTypeKey = 'tractor';
    }
    return { divisionKey, leadTypeKey };
}

/**
 * Update attackers' streak display in div-hint-2 (note 26b §4).
 * Attackers' streak = consecutive rounds won by attackers within the current frame.
 * Display only when positive (hide when zero).
 * Its value resets to zero when attackers lose a round.
 */
function updateAttackersStreakDisplay() {
    if (!gHint2Div) return;
    if (attackersStreak > 0) {
        gHint2Div.textContent = t('hints.attackersStreak', { streak: attackersStreak });
        gHint2Div.style.display = '';
    } else {
        gHint2Div.textContent = '';
        gHint2Div.style.display = 'none';
    }
}

// ---------------------------------------------------------------------------
// Persistent name bars (§3)
// ---------------------------------------------------------------------------
function initPersistentNamebars() {
    [gReferenceHandSurface, ...gDeskSlots].forEach(container => {
        if (container) container.querySelectorAll('.desk-namebar').forEach(el => el.remove());
    });
    gDeskNamebars = [];
    // Create persistent name bars for all players
    for (let p = 0; p < NUM_PLAYERS; p++) {
        let isReferencePlayer = (p === HUMAN_PLAYER);
        let naturalPosition = getNaturalPositionFor4PActorSeat(p);
        let displayPosition = isReferencePlayer ? 'bottom' : getDisplayPositionFor4PActorSeat(p);
        let container = isReferencePlayer ? gReferenceHandSurface : getDeskSlotFor4PActorSeat(p);
        if (!container) continue;

        // Remove any old persistent namebar
        let old = container.querySelector('.desk-namebar');
        if (old) old.remove();

        let nb = document.createElement('div');
        nb.className = isReferencePlayer ? 'desk-namebar reference-hand-namebar' : 'desk-namebar';
        nb.setAttribute('data-status', 'idle');
        nb.setAttribute('data-actor-seat', String(p));
        nb.setAttribute('data-natural-position', naturalPosition);
        nb.setAttribute('data-display-position', displayPosition);
        nb.setAttribute('data-reference-position', getReferencePositionFor4PActorSeat(p));

        let posArea = document.createElement('div');
        posArea.className = 'game-position-area';
        posArea.textContent = POSITION_LABELS[p];
        nb.appendChild(posArea);

        let nameArea = document.createElement('div');
        nameArea.className = 'name-area';
        nameArea.textContent = isReferencePlayer ? t('players.youShort') : t('players.botShort');
        nb.appendChild(nameArea);

        if (!isReferencePlayer) {
            // Exposed-card preview container (non-human only)
            let preview = document.createElement('div');
            preview.className = 'exposed-preview';
            nb.appendChild(preview);
        }

        container.appendChild(nb);
        gDeskNamebars[p] = nb;
        gCrossingSeatStatuses[p] = null;
    }
}

function updateNamebarStatus(player, status) {
    let nb = gDeskNamebars[player];
    if (nb) nb.setAttribute('data-status', status);
}

function updateNamebarWidth(player, cardCount) {
    let nb = gDeskNamebars[player];
    if (!nb) return;
    if (cardCount >= 4) {
        nb.style.width = `calc(var(--card-width) + (${cardCount - 1} * var(--card-width) / 3))`;
    } else {
        nb.style.width = '';
    }
}

function updateExposedPreview(player) {
    let nb = gDeskNamebars[player];
    if (!nb) return;
    let preview = nb.querySelector('.exposed-preview');
    if (!preview) return;
    preview.innerHTML = '';
    let exposed = game.exposedCards && game.exposedCards[player];
    if (!exposed || Object.keys(exposed).length === 0) {
        preview.classList.remove('has-exposed');
        let emptySlot = getDeskSlotFor4PActorSeat(player);
        if (emptySlot) emptySlot.removeAttribute('data-has-exposed');
        return;
    }
    // Build a set of FC-selected cardIds and the FC mode (if active for this player)
    let fc = game.forehandControl;
    let fcSelectedIds = null;
    let fcMode = null;
    if (fc && fc.target === player && fc.selectedCards) {
        fcMode = fc.mode;
        fcSelectedIds = new Set(fc.selectedCards.map(c => c.cardId));
    }
    for (let div in exposed) {
        for (let card of exposed[div]) {
            let cardFc = null;
            if (fcSelectedIds) {
                cardFc = fcSelectedIds.has(card.cardId) ? fcMode : null;
            }
            preview.appendChild(createCornerCard(card, cardFc));
        }
    }
    preview.classList.add('has-exposed');
    let exposedSlot = getDeskSlotFor4PActorSeat(player);
    if (exposedSlot) exposedSlot.setAttribute('data-has-exposed', '');
}

function resetAllNamebars() {
    for (let p = 0; p < NUM_PLAYERS; p++) {
        if (gDeskNamebars[p]) {
            gDeskNamebars[p].setAttribute('data-status', 'idle');
            gDeskNamebars[p].style.width = '';
            let preview = gDeskNamebars[p].querySelector('.exposed-preview');
            if (preview) {
                preview.innerHTML = '';
                preview.classList.remove('has-exposed');
            }
        }
    }
}

function ensureCrossingClaimControlsHost() {
    if (gCrossingClaimControlsHost) return gCrossingClaimControlsHost;
    if (!gDeskCenterRight) return null;
    let host = document.createElement('div');
    host.className = 'crossing-claim-controls-desk';
    host.setAttribute('data-visible', 'false');
    gDeskCenterRight.appendChild(host);
    gCrossingClaimControlsHost = host;
    return gCrossingClaimControlsHost;
}

function setCrossingClaimControlsVisible(visible) {
    let host = ensureCrossingClaimControlsHost();
    if (!host) return;
    host.setAttribute('data-visible', visible ? 'true' : 'false');
}

function showDeskEventMarker(player, text, scopeKey) {
    let slot = getDeskSlotFor4PActorSeat(player);
    if (!slot) return;
    slot.querySelectorAll('.basing-pass-marker[data-marker-scope="' + scopeKey + '"]').forEach(el => el.remove());
    let marker = document.createElement('div');
    marker.className = 'basing-pass-marker';
    marker.setAttribute('data-marker-scope', scopeKey);
    marker.textContent = text;
    slot.appendChild(marker);
}

function clearDeskEventMarkersByScope(scopeKey) {
    for (let p = 0; p < NUM_PLAYERS; p++) {
        let slot = getDeskSlotFor4PActorSeat(p);
        if (!slot) continue;
        slot.querySelectorAll('.basing-pass-marker[data-marker-scope="' + scopeKey + '"]').forEach(el => el.remove());
    }
}

function ensureLocalCrossingActionButtons() {
    let host = ensureCrossingClaimControlsHost();
    if (!host) return;
    if (!gBtnCrossClaim) {
        gBtnCrossClaim = document.createElement('button');
        gBtnCrossClaim.type = 'button';
        gBtnCrossClaim.className = 'button game-btn crossing-action-btn';
        gBtnCrossClaim.style.display = 'none';
        host.appendChild(gBtnCrossClaim);
    }
    if (!gBtnCrossDecline) {
        gBtnCrossDecline = document.createElement('button');
        gBtnCrossDecline.type = 'button';
        gBtnCrossDecline.className = 'button game-btn crossing-action-btn';
        gBtnCrossDecline.style.display = 'none';
        host.appendChild(gBtnCrossDecline);
    }
}

function hideLocalCrossingActionButtons() {
    ensureLocalCrossingActionButtons();
    setCrossingClaimControlsVisible(false);
    if (gBtnCrossClaim) {
        gBtnCrossClaim.style.display = 'none';
        gBtnCrossClaim.disabled = true;
        gBtnCrossClaim.onclick = null;
    }
    if (gBtnCrossDecline) {
        gBtnCrossDecline.style.display = 'none';
        gBtnCrossDecline.disabled = true;
        gBtnCrossDecline.onclick = null;
    }
}

// ---------------------------------------------------------------------------
// Hand rendering — only the human player's hand is displayed
// ---------------------------------------------------------------------------

/**
 * Note 95a: Clear stale card contents from the reference-hand surface at new-game boundaries,
 * while preserving the persistent namebar placed by initPersistentNamebars().
 * Null-safe and idempotent. Does not mutate game engine state.
 */
function clearReferenceHandCardsPreservingNamebar() {
    if (!gReferenceHandSurface) return;
    const nb = gReferenceHandSurface.querySelector('.desk-namebar');
    gReferenceHandSurface.innerHTML = '';
    if (nb) gReferenceHandSurface.appendChild(nb);
}

function renderAllHands() {
    renderHand(activeHumanPlayer);
}

function renderHand(player) {
    if (!isHumanControlled(player)) return;
    if (player !== activeHumanPlayer) return;
    let el = gReferenceHandSurface;
    // Preserve persistent namebar; clear only hand content
    let existingNb = el.querySelector('.desk-namebar');
    el.innerHTML = '';
    if (existingNb) el.appendChild(existingNb);

    let hand = game.hands[player];

    // Build set of exposed cardIds for own-view highlighting
    let exposedCardIds = new Set();
    if (game.exposedCards && game.exposedCards[player]) {
        for (let div in game.exposedCards[player]) {
            for (let c of game.exposedCards[player][div]) {
                exposedCardIds.add(c.cardId);
            }
        }
    }

    // Build set of FC-marked cardIds and mode for own-view icons
    let fcMarkedIds = null;
    let fcMode = null;
    if (game.forehandControl && game.forehandControl.target === player && game.forehandControl.selectedCards) {
        fcMode = game.forehandControl.mode;
        fcMarkedIds = new Set(game.forehandControl.selectedCards.map(c => c.cardId));
    }

    // Wrap in a .hand div
    let handRow = document.createElement('div');
    handRow.className = 'hand';

    for (let card of hand) {
        let cc = gameCreateCardContainer(card);
        cc.addEventListener('click', () => toggleCardSelection(card.cardId, cc));
        cc.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (game.phase === GamePhase.PLAYING && isHumanControlled(engineGetCurrentPlayer())) {
                clearSelection();
                updatePlayButton();
            }
        });
        if (selectedCardIds.has(card.cardId)) {
            cc.setAttribute('card-selected', 'true');
        }
        if (exposedCardIds.has(card.cardId)) {
            cc.setAttribute('data-exposed', 'true');
        }
        // FC marking icons in own view
        if (fcMarkedIds && fcMarkedIds.has(card.cardId)) {
            let marker = document.createElement('div');
            marker.className = 'fc-marker fc-marker-' + fcMode;
            let cardEl = cc.querySelector('.card');
            let suitEl = cardEl.querySelector('.card-suit');
            suitEl.after(marker);
        }
        handRow.appendChild(cc);
    }

    el.insertBefore(handRow, existingNb);
}

// ---------------------------------------------------------------------------
// Card selection
// ---------------------------------------------------------------------------

function toggleCardSelection(cardId, el) {
    // Allow selection during forehand control exercise — restrict to exposed cards only
    if (gFCInteraction) {
        if (!gFCInteraction.exposedCardIds.has(cardId)) return;
        if (selectedCardIds.has(cardId)) {
            selectedCardIds.delete(cardId);
            el.setAttribute('card-selected', 'false');
        } else {
            selectedCardIds.add(cardId);
            el.setAttribute('card-selected', 'true');
        }
        return;
    }
    let allowCrossingSelection = isLocalCrossingSelectionMode();
    if (isPauseDialogBlockingGameplay()) return;
    if (game.phase === GamePhase.PLAYING && !allowCrossingSelection && !isHumanControlled(engineGetCurrentPlayer())) return;
    if (game.phase !== GamePhase.PLAYING && game.phase !== GamePhase.BASING) return;
    if (gCrossingState && gCrossingState.trickPlayBlocked && !allowCrossingSelection) return;

    if (selectedCardIds.has(cardId)) {
        selectedCardIds.delete(cardId);
        el.setAttribute('card-selected', 'false');
    } else {
        // Auto-deselect rule: if following a single-card lead and one card is already selected
        if (!allowCrossingSelection && game.phase === GamePhase.PLAYING && game.currentTurnIndex > 0 && game.leadInfo && game.leadInfo.volume === 1) {
            if (selectedCardIds.size === 1) {
                clearSelection();
            }
        }
        selectedCardIds.add(cardId);
        el.setAttribute('card-selected', 'true');
    }
    updatePlayButton();
}

function clearSelection() {
    selectedCardIds.clear();
    document.querySelectorAll('[card-selected="true"]').forEach(el => {
        el.setAttribute('card-selected', 'false');
    });
}

function getSelectedCards(player) {
    let hand = game.hands[player];
    return hand.filter(c => selectedCardIds.has(c.cardId));
}

function updatePlayButton() {
    if (gFCInteraction) {
        gBtnPlay.disabled = false;
        gBtnPlay.textContent = t('buttons.confirmMarks');
        return;
    }
    let crossingMode = getLocalCrossingActionMode();
    if (crossingMode === 'cross') {
        gBtnPlay.disabled = !isValidCrossingSelection(HUMAN_PLAYER, getSelectedCards(HUMAN_PLAYER), true);
        gBtnPlay.textContent = t('buttons.toCross');
        return;
    }
    if (crossingMode === 'crossback') {
        gBtnPlay.disabled = !isValidCrossingSelection(HUMAN_PLAYER, getSelectedCards(HUMAN_PLAYER), false);
        gBtnPlay.textContent = t('buttons.toCrossBack');
        return;
    }
    if (gCrossingState && gCrossingState.trickPlayBlocked) {
        gBtnPlay.disabled = true;
        gBtnPlay.textContent = t('buttons.play');
        return;
    }
    if (game.phase === GamePhase.BASING) {
        gBtnPlay.disabled = (selectedCardIds.size !== BASE_SIZE);
        gBtnPlay.textContent = t('buttons.baseProgress', { current: selectedCardIds.size, total: BASE_SIZE });
    } else if (game.phase === GamePhase.PLAYING && isHumanControlled(engineGetCurrentPlayer())) {
        gBtnPlay.disabled = (selectedCardIds.size === 0);
        gBtnPlay.textContent = t('buttons.play');
    } else {
        gBtnPlay.disabled = true;
        gBtnPlay.textContent = t('buttons.play');
    }
}

// ---------------------------------------------------------------------------
// Desk rendering
// ---------------------------------------------------------------------------

function clearDesk() {
    for (let i = 0; i < gDeskSlots.length; i++) {
        let slot = gDeskSlots[i];
        // Remove cards, transient namebar, and basing-pass markers, but keep persistent .desk-namebar
        slot.querySelectorAll('.card-container, .hand, .namebar:not(.desk-namebar), .basing-pass-marker').forEach(el => el.remove());
        slot.removeAttribute('data-active');
        slot.removeAttribute('data-winner');
        slot.removeAttribute('data-has-exposed');
    }
    if (gDeskInfo) gDeskInfo.textContent = '';
    resetAllNamebars();
}

function clearDeskForOvercallDecisionStep() {
    for (let i = 0; i < gDeskSlots.length; i++) {
        let slot = gDeskSlots[i];
        // Keep PASS markers across sequential decisions; only clear card-like artifacts.
        slot.querySelectorAll('.card-container, .hand, .namebar:not(.desk-namebar)').forEach(el => el.remove());
        slot.removeAttribute('data-active');
        slot.removeAttribute('data-winner');
        slot.removeAttribute('data-has-exposed');
    }
    if (gDeskInfo) gDeskInfo.textContent = '';
    resetAllNamebars();
}

/**
 * Show a PASS marker in a player's desk slot after a no-overcall decision (note 41ea).
 */
function showBasingPassMarker(player) {
    // PASS is authoritative and non-localized for this live-flow marker.
    showDeskEventMarker(player, 'PASS', 'basing-overcall');
}

function renderDeskCards(player, cards) {
    let slot = getDeskSlotFor4PActorSeat(player);
    if (!slot) return;
    // Remove previous cards (not persistent namebar)
    slot.querySelectorAll('.card-container, .hand, .namebar:not(.desk-namebar)').forEach(el => el.remove());

    // §6: Auto-sort played cards before display
    let sorted = [...cards];
    engineSortHand(sorted);

    let row = document.createElement('div');
    row.className = 'hand';
    for (let card of sorted) {
        let cc = gameCreateCardContainer(card);
        row.appendChild(cc);
    }
    slot.appendChild(row);

    if (player !== HUMAN_PLAYER) {
        // Update persistent namebar width to match cards (§3.3)
        updateNamebarWidth(player, sorted.length);
        updateNamebarStatus(player, 'played');
    }
}


function highlightActivePlayer(player) {
    // Use name bar breathing color for all players including reference player (§6)
    for (let i = 0; i < NUM_PLAYERS; i++) {
        let slot = getDeskSlotFor4PActorSeat(i);
        if (slot) slot.removeAttribute('data-active');
        if (gDeskNamebars[i] && gDeskNamebars[i].getAttribute('data-status') === 'on-play') {
            gDeskNamebars[i].setAttribute('data-status', 'idle');
        }
    }
    if (player >= 0 && gDeskNamebars[player]) {
        gDeskNamebars[player].setAttribute('data-status', 'on-play');
    }
}

function showDeclaredCardsOnDesk(player, suit, count) {
    let hand = game.hands[player];
    let toShow = [];
    if (suit === 4) {
        let rank = (count >= 4) ? 15 : 14;
        let cToFind = (count >= 3) ? 2 : count;
        toShow = hand.filter(c => c.rank === rank).slice(0, cToFind);
    } else {
        toShow = hand.filter(c => c.rank === game.level && c.suit === suit).slice(0, count);
    }
    renderDeskCards(player, toShow);
}



// ---------------------------------------------------------------------------
// Score display
// ---------------------------------------------------------------------------

function updateScoreDisplay() {
    if (!gScoreDiv || !gScoreCont) return;
    const s = game.frameScore;
    gScoreDiv.textContent = s;

    if (game.phase === GamePhase.IDLE || game.phase === GamePhase.DEALING || game.phase === GamePhase.DECLARING || game.phase === GamePhase.BASING) {
        gScoreCont.style.borderColor = '#f8f8f8';
    } else {
        gScoreCont.style.borderColor = getScoreBorderColorForValue(s);
    }
}

function getScoreBorderColorForValue(score) {
    // Hue 0->60 for score 0->40, same formula as recap: h = s * 3 / 2
    const h = score * 3 / 2;
    return 'hsl(' + h + ', 100%, 50%)';
}

// ---------------------------------------------------------------------------
// Log
// ---------------------------------------------------------------------------

function appendLog(msg) {
    let line = document.createElement('div');
    line.textContent = msg;
    gGameLog.appendChild(line);
    gGameLog.scrollTop = gGameLog.scrollHeight;
}

function clearLog() {
    gGameLog.innerHTML = '';
}

// ---------------------------------------------------------------------------
// Phase display
// ---------------------------------------------------------------------------

function updatePhaseDisplay(text) {
    gPhaseInfo.textContent = text;
    refreshPauseButtonState();
}

function updateStatus(text) {
    let statustext = document.getElementById('statustext');
    if (statustext) {
        statustext.textContent = text;
    } else {
        gStatusbar.innerHTML = '<div id="errorbar"></div><span id="statustext">' + text + '</span>';
    }
}

function showError(msg) {
    let eb = document.getElementById('errorbar');
    if (eb) {
        eb.textContent = msg;
        // add flashing class or color
        eb.style.color = '#ff4444';
        eb.style.animation = 'flashError 0.25s infinite';
        eb.style.fontWeight = 'bold';
        
        setTimeout(() => {
            let currentEb = document.getElementById('errorbar');
            if (currentEb) {
                currentEb.textContent = '';
                currentEb.style.animation = '';
                currentEb.style.color = '';
            }
        }, 2000);
    }
}

function isPauseDialogBlockingGameplay() {
    return pauseState.phase === 'waitingPauseAgreements'
        || pauseState.phase === 'paused'
        || pauseState.phase === 'waitingQuitConfirm';
}

function canRequestPauseNow() {
    if (!gBtnPause || !game) return false;
    if (pauseState.phase !== 'idle') return false;
    if (game.phase === GamePhase.COUNTING || game.phase === GamePhase.GAME_OVER) return false;
    if (game.phase === GamePhase.IDLE && frameNumber <= 0) return false;
    return true;
}

function refreshPauseButtonState() {
    if (!gBtnPause) return;
    gBtnPause.disabled = !canRequestPauseNow();
}

function seatToPauseBoxPosition(seat) {
    return getDisplayPositionFor4PActorSeat(seat, HUMAN_PLAYER);
}

function getPauseBoxStateMap(sourceBySeat) {
    let mapped = {
        top: 'neutral',
        right: 'neutral',
        bottom: 'neutral',
        left: 'neutral',
    };
    for (let seat = 0; seat < NUM_PLAYERS; seat++) {
        mapped[seatToPauseBoxPosition(seat)] = sourceBySeat[seat] || 'neutral';
    }
    return mapped;
}

function renderPauseAgreementBox(host, sourceBySeat) {
    if (!host) return;
    host.innerHTML = '';

    let box = document.createElement('div');
    box.className = 'pause-agreement-box';

    let square = document.createElement('div');
    square.className = 'pause-agreement-square';
    box.appendChild(square);

    let diagonalSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    diagonalSvg.setAttribute('class', 'pause-agreement-diagonals');
    diagonalSvg.setAttribute('viewBox', '0 0 100 100');
    diagonalSvg.setAttribute('preserveAspectRatio', 'none');
    diagonalSvg.setAttribute('aria-hidden', 'true');

    let diagA = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    diagA.setAttribute('class', 'pause-agreement-diagonal');
    diagA.setAttribute('x1', '0');
    diagA.setAttribute('y1', '0');
    diagA.setAttribute('x2', '100');
    diagA.setAttribute('y2', '100');

    let diagB = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    diagB.setAttribute('class', 'pause-agreement-diagonal');
    diagB.setAttribute('x1', '100');
    diagB.setAttribute('y1', '0');
    diagB.setAttribute('x2', '0');
    diagB.setAttribute('y2', '100');

    diagonalSvg.appendChild(diagA);
    diagonalSvg.appendChild(diagB);
    square.appendChild(diagonalSvg);

    let byPos = getPauseBoxStateMap(sourceBySeat);
    let clipByPos = {
        top: 'polygon(0 0, 100% 0, 50% 50%)',
        right: 'polygon(100% 0, 100% 100%, 50% 50%)',
        bottom: 'polygon(0 100%, 100% 100%, 50% 50%)',
        left: 'polygon(0 0, 0 100%, 50% 50%)',
    };
    ['top', 'right', 'bottom', 'left'].forEach((pos) => {
        let tri = document.createElement('div');
        tri.className = 'pause-agreement-triangle';
        tri.setAttribute('data-pos', pos);
        tri.setAttribute('data-state', byPos[pos]);
        tri.style.clipPath = clipByPos[pos];
        tri.style.webkitClipPath = clipByPos[pos];
        let markText = '';
        if (byPos[pos] === 'agree' || byPos[pos] === 'ready') markText = '\u2713';
        if (byPos[pos] === 'reject') markText = '\u00D7';
        if (markText) {
            let mark = document.createElement('span');
            mark.className = 'pause-agreement-mark';
            mark.textContent = markText;
            tri.appendChild(mark);
        }
        square.appendChild(tri);
    });

    host.appendChild(box);
}

function hidePauseDialog() {
    if (gPauseDialog) gPauseDialog.style.display = 'none';
    if (gPauseOverlay) gPauseOverlay.style.display = 'none';
    if (gPauseQuitConfirm) gPauseQuitConfirm.style.display = 'none';
}

function showPauseDialog() {
    if (gPauseOverlay) gPauseOverlay.style.display = 'block';
    if (gPauseDialog) gPauseDialog.style.display = 'block';
}

function clearPauseTimersOnly() {
    if (pauseState.waitingTimerId) {
        clearInterval(pauseState.waitingTimerId);
        pauseState.waitingTimerId = null;
    }
    if (pauseState.rejectFlashTimerId) {
        clearTimeout(pauseState.rejectFlashTimerId);
        pauseState.rejectFlashTimerId = null;
    }
}

function captureTimerSnapshotForPause() {
    if (!gTimerInterval || !gLiveTimerMeta) return null;
    return {
        kind: gLiveTimerMeta.kind,
        phase: gTimingPhase,
        player: gLiveTimerMeta.player,
        moveType: gLiveTimerMeta.moveType,
        hasLegalOvercall: gLiveTimerMeta.hasLegalOvercall,
        onExpire: gTimerExpireCallback,
        shot: gShotClockRemaining,
        bank: gBankTimeRemaining,
        stage: gTimerStage,
    };
}

function resumeTimerFromPauseSnapshot(snapshot) {
    if (!snapshot) return;

    if (snapshot.kind === 'callingWindow') {
        clearTimers();
        gTimingPhase = snapshot.phase;
        gShotClockRemaining = snapshot.shot;
        gTimerExpireCallback = snapshot.onExpire;
        let digitEl = showCenterTimer(snapshot.shot);
        gLiveTimerMeta = { kind: 'callingWindow' };
        gTimerInterval = setInterval(() => {
            if (isPauseDialogBlockingGameplay()) return;
            gShotClockRemaining -= 0.1;
            if (digitEl) digitEl.textContent = Math.max(0, Math.ceil(gShotClockRemaining));
            if (gShotClockRemaining <= 0) {
                clearTimers();
                if (snapshot.onExpire) snapshot.onExpire();
            }
        }, 100);
        return;
    }

    if (snapshot.kind === 'playerMove' || snapshot.kind === 'overcallDecision') {
        clearTimers();
        gTimingPhase = snapshot.phase;
        gShotClockRemaining = Math.max(0, Number(snapshot.shot) || 0);
        gBankTimeRemaining = Math.max(0, Number(snapshot.bank) || 0);
        gTimerStage = snapshot.stage === 'bank' ? 'bank' : 'shot';
        gTimerExpireCallback = snapshot.onExpire;
        gLiveTimerMeta = {
            kind: snapshot.kind,
            player: snapshot.player,
            moveType: snapshot.moveType,
            hasLegalOvercall: snapshot.hasLegalOvercall,
        };
        showTimerOverlay(snapshot.player);
        gTimerInterval = setInterval(() => {
            if (isPauseDialogBlockingGameplay()) return;
            if (gTimerStage === 'shot') {
                gShotClockRemaining -= 0.1;
                if (gShotClockRemaining <= 0) {
                    gShotClockRemaining = 0;
                    if (gBankTimeRemaining > 0) {
                        gTimerStage = 'bank';
                    } else {
                        clearTimers();
                        if (snapshot.onExpire) snapshot.onExpire();
                        return;
                    }
                }
            } else {
                gBankTimeRemaining -= 0.1;
                if (snapshot.player !== null && snapshot.player !== undefined) {
                    game.playerBankTimes[snapshot.player] = Math.max(0, gBankTimeRemaining);
                }
                if (gBankTimeRemaining <= 0) {
                    gBankTimeRemaining = 0;
                    if (snapshot.player !== null && snapshot.player !== undefined) {
                        game.playerBankTimes[snapshot.player] = 0;
                    }
                    clearTimers();
                    if (snapshot.onExpire) snapshot.onExpire();
                    return;
                }
            }
            updateTimerDisplay();
        }, 100);
    }
}

function freezeGameForPauseProtocol() {
    let snapshot = {
        hadDealingTimer: !!dealingTimer,
        timerSnapshot: captureTimerSnapshotForPause(),
        gamePhase: game ? game.phase : null,
        intermittentRemainingMs: gFrameIntermittentTimeout ? Math.max(0, gFrameIntermittentEndsAt - Date.now()) : 0,
    };

    if (dealingTimer) {
        clearInterval(dealingTimer);
        dealingTimer = null;
    }
    if (gFrameIntermittentTimeout) {
        clearTimeout(gFrameIntermittentTimeout);
        gFrameIntermittentTimeout = null;
        gFrameIntermittentEndsAt = 0;
    }

    if (gTimerInterval) {
        clearInterval(gTimerInterval);
        gTimerInterval = null;
    }

    gBtnPlay.disabled = true;

    pauseState.frozenSnapshot = snapshot;
    pauseState.pendingResumePrompt = true;
}

function resumeGameAfterPauseProtocol() {
    let snapshot = pauseState.frozenSnapshot;
    pauseState.frozenSnapshot = null;

    if (!snapshot || !game) return;

    if (snapshot.intermittentRemainingMs > 0) {
        runFrameIntermittent(snapshot.intermittentRemainingMs);
        pauseState.pendingResumePrompt = false;
        return;
    }

    if (snapshot.hadDealingTimer && game.phase === GamePhase.DEALING) {
        runDealingPhase();
        pauseState.pendingResumePrompt = false;
        return;
    }

    if (snapshot.timerSnapshot) {
        resumeTimerFromPauseSnapshot(snapshot.timerSnapshot);
        pauseState.pendingResumePrompt = false;
    }

    if (!pauseState.pendingResumePrompt) return;
    pauseState.pendingResumePrompt = false;

    if (game.phase === GamePhase.PLAYING || game.phase === GamePhase.BASING) {
        promptCurrentPlayer();
        return;
    }

    if (game.phase === GamePhase.DECLARING && !gTimerInterval) {
        runFinalDeclarationWindow();
    }
}

function updatePauseWaitingCountdownUi() {
    if (!gPauseDialogCountdown) return;
    let sec = Math.max(0, Math.ceil(pauseState.waitingRemainingMs / 1000));
    gPauseDialogCountdown.innerHTML = '';
    let digit = document.createElement('span');
    digit.className = 'timer-primary';
    digit.textContent = String(sec);
    gPauseDialogCountdown.appendChild(digit);
}

function renderPauseHumanAgreementControls() {
    if (!gPauseHumanControls) return;
    gPauseHumanControls.innerHTML = '';

    if (pauseState.phase !== 'waitingPauseAgreements') return;

    let seats = Array.from(HUMAN_PLAYERS).filter(seat => seat !== pauseState.requesterSeat);
    for (let seat of seats) {
        if (pauseState.agreementBySeat[seat] !== 'pending') continue;
        let row = document.createElement('div');
        row.className = 'pause-human-row';

        let seatText = document.createElement('span');
        seatText.className = 'pause-human-seat';
        seatText.textContent = PLAYER_NAMES[seat];
        row.appendChild(seatText);

        let btnWrap = document.createElement('div');
        btnWrap.className = 'pause-human-buttons';

        let btnAgree = document.createElement('button');
        btnAgree.className = 'pause-human-btn';
        btnAgree.textContent = t('buttons.agree');
        btnAgree.onclick = () => submitPauseAgreement(seat, 'agree');

        let btnDisagree = document.createElement('button');
        btnDisagree.className = 'pause-human-btn';
        btnDisagree.setAttribute('data-kind', 'disagree');
        btnDisagree.textContent = t('buttons.disagree');
        btnDisagree.onclick = () => submitPauseAgreement(seat, 'reject');

        btnWrap.appendChild(btnAgree);
        btnWrap.appendChild(btnDisagree);
        row.appendChild(btnWrap);
        gPauseHumanControls.appendChild(row);
    }
}

function renderPausePrimaryControls() {
    if (!gPausePrimaryControls) return;
    gPausePrimaryControls.innerHTML = '';

    if (pauseState.phase === 'paused') {
        let btnReady = document.createElement('button');
        btnReady.className = 'button';
        btnReady.textContent = t('buttons.ready');
        btnReady.onclick = () => submitResumeReady(HUMAN_PLAYER);
        gPausePrimaryControls.appendChild(btnReady);

        let btnQuit = document.createElement('button');
        btnQuit.className = 'button';
        btnQuit.textContent = t('buttons.quit');
        btnQuit.onclick = () => requestQuitDuringPause(HUMAN_PLAYER);
        gPausePrimaryControls.appendChild(btnQuit);
    }
}

function renderPauseDialogByState() {
    if (!gPauseDialog) return;

    if (pauseState.phase === 'idle' || pauseState.phase === 'finished') {
        hidePauseDialog();
        refreshPauseButtonState();
        return;
    }

    showPauseDialog();

    if (pauseState.phase === 'waitingPauseAgreements') {
        gPauseDialogTitle.textContent = t('pause.waitingTitle');
        gPauseDialogMessage.textContent = t('pause.waitingMessage', { playerName: PLAYER_NAMES[pauseState.requesterSeat] });
        updatePauseWaitingCountdownUi();
        renderPauseAgreementBox(gPauseAgreementHost, pauseState.agreementBySeat);
        renderPauseHumanAgreementControls();
        renderPausePrimaryControls();
        if (gPauseQuitConfirm) gPauseQuitConfirm.style.display = 'none';
    } else {
        gPauseDialogTitle.textContent = t('pause.pausedTitle');
        gPauseDialogMessage.textContent = t('pause.pausedMessage');
        gPauseDialogCountdown.textContent = '';
        renderPauseAgreementBox(gPauseAgreementHost, pauseState.readyBySeat);
        if (gPauseHumanControls) gPauseHumanControls.innerHTML = '';
        renderPausePrimaryControls();
        if (gPauseQuitConfirm) {
            gPauseQuitConfirm.style.display = (pauseState.phase === 'waitingQuitConfirm') ? 'block' : 'none';
            if (gPauseQuitConfirmText) gPauseQuitConfirmText.textContent = t('pause.quitConfirm');
        }
    }

    refreshPauseButtonState();
}

function clearPauseProtocolStateToIdle() {
    clearPauseTimersOnly();
    pauseState.phase = 'idle';
    pauseState.requesterSeat = null;
    pauseState.agreementBySeat = ['neutral', 'neutral', 'neutral', 'neutral'];
    pauseState.readyBySeat = ['neutral', 'neutral', 'neutral', 'neutral'];
    pauseState.waitingRemainingMs = 0;
    pauseState.quitRequesterSeat = null;
    renderPauseDialogByState();
}

function requestPause(requesterSeat) {
    if (!canRequestPauseNow()) return;
    appendLog(t('log.pauseRequested', { playerName: PLAYER_NAMES[requesterSeat] }));
    receivePauseAgreementRequest(requesterSeat);
}

function receivePauseAgreementRequest(requesterSeat) {
    pauseState.phase = 'waitingPauseAgreements';
    pauseState.requesterSeat = requesterSeat;
    pauseState.agreementBySeat = ['pending', 'pending', 'pending', 'pending'];
    pauseState.readyBySeat = ['neutral', 'neutral', 'neutral', 'neutral'];
    pauseState.agreementBySeat[requesterSeat] = 'agree';
    pauseState.waitingRemainingMs = 10000;
    clearPauseTimersOnly();
    freezeGameForPauseProtocol();
    renderPauseDialogByState();

    pauseState.waitingTimerId = setInterval(() => {
        if (pauseState.phase !== 'waitingPauseAgreements') return;
        pauseState.waitingRemainingMs -= 100;
        if (pauseState.waitingRemainingMs <= 0) {
            pauseState.waitingRemainingMs = 0;
            updatePauseWaitingCountdownUi();
            resolvePauseRequest('timeout');
            return;
        }
        updatePauseWaitingCountdownUi();
    }, 100);

    for (let seat = 0; seat < NUM_PLAYERS; seat++) {
        if (seat === requesterSeat || isHumanControlled(seat)) continue;
        setTimeout(() => submitPauseAgreement(seat, 'agree'), 220);
    }
}

function submitPauseAgreement(seat, response) {
    if (pauseState.phase !== 'waitingPauseAgreements') return;
    if (pauseState.agreementBySeat[seat] !== 'pending') return;

    if (response === 'agree') {
        pauseState.agreementBySeat[seat] = 'agree';
        renderPauseDialogByState();
        let allAgreed = pauseState.agreementBySeat.every(v => v === 'agree');
        if (allAgreed) resolvePauseRequest('approved');
        return;
    }

    pauseState.agreementBySeat[seat] = 'reject';
    appendLog(t('log.pauseRejected', { playerName: PLAYER_NAMES[seat] }));
    renderPauseDialogByState();
    clearPauseTimersOnly();
    pauseState.rejectFlashTimerId = setTimeout(() => {
        resolvePauseRequest('rejected');
    }, 1000);
}

function resolvePauseRequest(result) {
    clearPauseTimersOnly();
    if (pauseState.phase !== 'waitingPauseAgreements') return;

    if (result === 'approved') {
        enterPausedState();
        return;
    }

    if (result === 'timeout') {
        appendLog(t('log.pauseTimeout'));
    }

    clearPauseProtocolStateToIdle();
    resumeGameAfterPauseProtocol();
}

function enterPausedState() {
    pauseState.phase = 'paused';
    pauseState.readyBySeat = ['pending', 'pending', 'pending', 'pending'];
    appendLog(t('log.pauseEntered'));
    updateStatus(t('status.paused'));
    renderPauseDialogByState();

    for (let seat = 0; seat < NUM_PLAYERS; seat++) {
        if (isHumanControlled(seat)) continue;
        setTimeout(() => submitResumeReady(seat), 200);
    }
}

function submitResumeReady(seat) {
    if (pauseState.phase !== 'paused') return;
    if (pauseState.readyBySeat[seat] !== 'pending') return;

    pauseState.readyBySeat[seat] = 'ready';
    renderPauseDialogByState();

    let allReady = pauseState.readyBySeat.every(v => v === 'ready');
    if (allReady) completeResume();
}

function completeResume() {
    appendLog(t('log.pauseResumed'));
    clearPauseProtocolStateToIdle();
    resumeGameAfterPauseProtocol();
}

function requestQuitDuringPause(seat) {
    if (pauseState.phase !== 'paused') return;
    pauseState.phase = 'waitingQuitConfirm';
    pauseState.quitRequesterSeat = seat;
    renderPauseDialogByState();
}

function confirmQuitDuringPause(seat) {
    if (pauseState.phase !== 'waitingQuitConfirm') return;
    endGameByQuit(seat);
}

function endGameByQuit(seat) {
    clearPauseTimersOnly();
    clearTimers();
    if (dealingTimer) { clearInterval(dealingTimer); dealingTimer = null; }

    pauseState.phase = 'finished';
    pauseState.quitRequesterSeat = seat;
    hidePauseDialog();

    if (game) game.phase = GamePhase.GAME_OVER;
    let reason = t('pause.quitReason', { playerName: PLAYER_NAMES[seat] });
    updatePhaseDisplay(t('phase.gameOver'));
    updateStatus(reason);
    if (gDeskInfo) gDeskInfo.textContent = reason;
    appendLog(t('log.quitDuringPause', { playerName: PLAYER_NAMES[seat] }));

    gBtnPlay.disabled = true;
    gBtnPlay.textContent = t('buttons.play');
    refreshPauseButtonState();
}

window.pauseState = pauseState;
window.requestPause = requestPause;
window.receivePauseAgreementRequest = receivePauseAgreementRequest;
window.submitPauseAgreement = submitPauseAgreement;
window.resolvePauseRequest = resolvePauseRequest;
window.enterPausedState = enterPausedState;
window.submitResumeReady = submitResumeReady;
window.completeResume = completeResume;
window.requestQuitDuringPause = requestQuitDuringPause;
window.confirmQuitDuringPause = confirmQuitDuringPause;
window.endGameByQuit = endGameByQuit;

// ---------------------------------------------------------------------------
// Timing utilities (note 24)
// ---------------------------------------------------------------------------

/**
 * Clear all active timers and timer UI elements.
 */
function clearTimers() {
    if (gTimerInterval) { clearInterval(gTimerInterval); gTimerInterval = null; }
    gTimingPhase = null;
    gTimerStage = 'shot';
    gTimerExpireCallback = null;
    gLiveTimerMeta = null;
    gNoDeclareClicked.clear();
    removeTimerOverlay();
    removeTimerCenter();
}

/**
 * Remove desk-slot timer overlay from DOM.
 */
function removeTimerOverlay() {
    if (gTimerOverlayEl && gTimerOverlayEl.parentNode) {
        gTimerOverlayEl.parentNode.removeChild(gTimerOverlayEl);
    }
    gTimerOverlayEl = null;
    gShotClockEl = null;
    gBankTimeEl = null;
}

/**
 * Remove center-area timer from DOM.
 */
function removeTimerCenter() {
    if (gTimerCenterEl && gTimerCenterEl.parentNode) {
        gTimerCenterEl.parentNode.removeChild(gTimerCenterEl);
    }
    gTimerCenterEl = null;
}

/**
 * Create and show a primary timer in the center area (for declaration calling windows).
 * Returns the timer digit element.
 */
function showCenterTimer(seconds) {
    removeTimerCenter();
    let el = document.createElement('div');
    el.className = 'timer-center';
    let digit = document.createElement('span');
    digit.className = 'timer-primary';
    digit.textContent = Math.ceil(seconds);
    el.appendChild(digit);
    gDeskCenterLeft.appendChild(el);
    gTimerCenterEl = el;
    return digit;
}

/**
 * Create and show shot clock + bank time overlay on a desk slot.
 * @param {number} player - player index (0–3)
 */
function showTimerOverlay(player) {
    removeTimerOverlay();
    let slot = getDeskSlotFor4PActorSeat(player);
    if (!slot) return;
    let overlay = document.createElement('div');
    overlay.className = 'timer-overlay';
    let timingMode = getTimingModeForRuntime();
    overlay.setAttribute('data-timing-mode', timingMode);

    // bank-time-only refinement (note 38c): render only bank-time visual element.
    if (timingMode !== 'bank-time-only') {
        let shotEl = document.createElement('span');
        shotEl.className = 'timer-primary';
        shotEl.textContent = Math.ceil(gShotClockRemaining);
        overlay.appendChild(shotEl);
        gShotClockEl = shotEl;
    } else {
        gShotClockEl = null;
    }

    // shot+bank refinement (note 38c): do not show exhausted bank-time visual element.
    let shouldShowBank = (timingMode === 'bank-time-only') || gBankTimeRemaining > 0;
    if (shouldShowBank) {
        let bankEl = document.createElement('span');
        bankEl.className = 'timer-secondary';
        bankEl.textContent = Math.ceil(gBankTimeRemaining);
        overlay.appendChild(bankEl);
        gBankTimeEl = bankEl;
    } else {
        gBankTimeEl = null;
    }

    slot.appendChild(overlay);
    gTimerOverlayEl = overlay;
}

/**
 * Update timer display digits.
 */
function updateTimerDisplay() {
    if (gShotClockEl) {
        gShotClockEl.textContent = Math.max(0, Math.ceil(gShotClockRemaining));
    }
    if (gBankTimeEl) {
        gBankTimeEl.textContent = Math.max(0, Math.ceil(gBankTimeRemaining));
    }

    // shot+bank exhausted-bank refinement: once bank reaches zero, remove bank element
    // for the remainder of this frame.
    if (gTimerOverlayEl && gTimerOverlayEl.getAttribute('data-timing-mode') === 'shot + bank' && gBankTimeRemaining <= 0) {
        if (gBankTimeEl && gBankTimeEl.parentNode) {
            gBankTimeEl.parentNode.removeChild(gBankTimeEl);
        }
        gBankTimeEl = null;
    }
}

/**
 * Start a countdown timer for a declaration calling window (center area).
 * @param {string} phase - 'finalDeclare' or 'overbaseWindow'
 * @param {number} seconds - countdown duration
 * @param {Function} onExpire - called when timer reaches 0 or is broken
 */
function startCallingWindowTimer(phase, seconds, onExpire) {
    clearTimers();
    gTimingPhase = phase;
    gShotClockRemaining = seconds;
    gTimerExpireCallback = onExpire;
    gLiveTimerMeta = { kind: 'callingWindow' };

    let digitEl = showCenterTimer(seconds);

    gTimerInterval = setInterval(() => {
        if (isPauseDialogBlockingGameplay()) return;
        gShotClockRemaining -= 0.1;
        if (digitEl) digitEl.textContent = Math.max(0, Math.ceil(gShotClockRemaining));
        if (gShotClockRemaining <= 0) {
            clearTimers();
            onExpire();
        }
    }, 100);
}

/**
 * Break the current calling window timer immediately.
 */
function breakCallingWindowTimer() {
    let cb = gTimerExpireCallback;
    clearTimers();
    if (cb) cb();
}

/**
 * Start shot clock + bank time for a human player's move.
 * @param {number} player - player index
 * @param {string} moveType - 'base' or 'play' (determines shot clock duration)
 * @param {Function} onTimeout - called when both shot clock and bank time expire
 */
function startPlayerMoveTimer(player, moveType, onTimeout) {
    if (!isHumanControlled(player)) return; // bots are untimed (note 24 §2)
    clearTimers();
    gTimingPhase = moveType === 'base' ? 'playerMove' : 'playerMove';
    let timingCfg = getTimingConfigForPage();
    let timingMode = getTimingModeForRuntime();
    let shotDuration = (moveType === 'base') ? timingCfg.baseShotClock : timingCfg.playShotClock;
    gShotClockRemaining = (timingMode === 'bank-time-only') ? 0 : shotDuration;
    gBankTimeRemaining = game.playerBankTimes[player];
    gTimerStage = (timingMode === 'bank-time-only') ? 'bank' : 'shot';
    gTimerExpireCallback = onTimeout;
    gLiveTimerMeta = { kind: 'playerMove', player: player, moveType: moveType };

    showTimerOverlay(player);

    gTimerInterval = setInterval(() => {
        if (isPauseDialogBlockingGameplay()) return;
        if (gTimerStage === 'shot') {
            gShotClockRemaining -= 0.1;
            if (gShotClockRemaining <= 0) {
                gShotClockRemaining = 0;
                if (gBankTimeRemaining > 0) {
                    gTimerStage = 'bank';
                } else {
                    // Both expired — auto-play as bot
                    clearTimers();
                    game.playerBankTimes[player] = 0;
                    onTimeout();
                    return;
                }
            }
        } else {
            // bank time stage
            gBankTimeRemaining -= 0.1;
            game.playerBankTimes[player] = Math.max(0, gBankTimeRemaining);
            if (gBankTimeRemaining <= 0) {
                gBankTimeRemaining = 0;
                game.playerBankTimes[player] = 0;
                clearTimers();
                onTimeout();
                return;
            }
        }
        updateTimerDisplay();
    }, 100);
}

/**
 * Stop the current player move timer (player made their move in time).
 * Saves remaining bank time back to game state.
 * @param {number} player - player index
 */
function stopPlayerMoveTimer(player) {
    if (gTimerInterval) {
        // Save bank time
        if (gTimerStage === 'bank') {
            game.playerBankTimes[player] = Math.max(0, gBankTimeRemaining);
        }
        clearTimers();
    }
}

function applyBaseTimeIncrementAfterBaseCompletion(player) {
    if (!isHumanControlled(player)) return;
    if (getTimingModeForRuntime() !== 'bank-time-only') return;
    let timingCfg = getTimingConfigForPage();
    let inc = Math.floor(Number(timingCfg.baseTimeIncrement) || 0);
    if (inc <= 0) return;
    game.playerBankTimes[player] = Math.max(0, Number(game.playerBankTimes[player]) || 0) + inc;
}

/**
 * Continue the current timing unit for FC (no new shot clock — note 24 §12).
 * The forehand's move and FC decision are one continuous timing unit.
 * If the timer was already stopped (controller already played), restart it
 * using remaining bank time so the timer remains visible during FC selection.
 */
function continueFCTimingUnit(player, onTimeout) {
    if (!isHumanControlled(player)) return;
    gTimingPhase = 'fcContinuation';
    gTimerExpireCallback = onTimeout;

    if (!gTimerInterval) {
        // Timer was stopped after controller's play — restart with bank time
        gShotClockRemaining = 0;
        gBankTimeRemaining = game.playerBankTimes[player];
        gTimerStage = 'bank';

        showTimerOverlay(player);

        if (gBankTimeRemaining <= 0) {
            // No bank time left — auto-commit immediately
            clearTimers();
            onTimeout();
            return;
        }

        gTimerInterval = setInterval(() => {
            if (isPauseDialogBlockingGameplay()) return;
            gBankTimeRemaining -= 0.1;
            game.playerBankTimes[player] = Math.max(0, gBankTimeRemaining);
            if (gBankTimeRemaining <= 0) {
                gBankTimeRemaining = 0;
                game.playerBankTimes[player] = 0;
                clearTimers();
                onTimeout();
                return;
            }
            updateTimerDisplay();
        }, 100);
    }
}

/**
 * Start timer for block-type choice (uses play-card shot clock — note 24 §13).
 */
function startBlockChoiceTimer(player, onTimeout) {
    startPlayerMoveTimer(player, 'play', onTimeout);
    gTimingPhase = 'blockChoice';
}

/**
 * Show "No declaration" button in center area for human player.
 * @param {Function} onAllDeclined - called when all players have clicked
 */
function showNoDeclareButton(onAllDeclined) {
    if (!gBtnNoDeclare) return;
    gBtnNoDeclare.disabled = false;
    gBtnNoDeclare.style.opacity = '';
    gBtnNoDeclare.textContent = t('timing.noDeclaration');
    gBtnNoDeclare.onclick = () => {
        gNoDeclareClicked.add(HUMAN_PLAYER);
        gBtnNoDeclare.disabled = true;
        gBtnNoDeclare.style.opacity = '0.4';
        // Bots auto-decline (they've already had their chance)
        for (let i = 0; i < NUM_PLAYERS; i++) {
            if (!isHumanControlled(i)) gNoDeclareClicked.add(i);
        }
        if (gNoDeclareClicked.size >= NUM_PLAYERS) {
            onAllDeclined();
        }
    };
}

/**
 * Remove "No declaration" button — disable it.
 */
function removeNoDeclareButton() {
    if (!gBtnNoDeclare) return;
    gBtnNoDeclare.disabled = true;
    gBtnNoDeclare.onclick = null;
}

function getActiveBaserPlayer() {
    return (game.currentBaser !== null && game.currentBaser !== undefined) ? game.currentBaser : game.pivot;
}

function getFinalBaserSeat() {
    if (!game) return null;
    if (game.finalBaserSeat !== null && game.finalBaserSeat !== undefined) return game.finalBaserSeat;
    if (game.finalBaser !== null && game.finalBaser !== undefined) return game.finalBaser;
    return game.pivot;
}

function canSeatSeeBaseInPlayingPhase(localSeat) {
    if (!game || game.phase !== GamePhase.PLAYING) return false;
    return localSeat === getFinalBaserSeat();
}

/**
 * Auto-play as bot when human player's time runs out.
 */
function autoPlayAsBot(player) {
    if (isPauseDialogBlockingGameplay()) return;
    if (game.phase === GamePhase.BASING && player === getActiveBaserPlayer()) {
        // Auto-base
        let baseCards = botMakeBase(player);
        let deferPlaying = !!(game && game.gameConfig && game.gameConfig.allowOverbase);
        let ok = engineSetBase(baseCards, { deferPlaying });
        if (!ok) {
            showError(t('errors.baseFailed'));
            appendLog(t('errors.baseFailed'));
            return;
        }
        applyBaseTimeIncrementAfterBaseCompletion(player);
        clearSelection();
        clearDesk();
        renderAllHands();
        appendLog(t('log.baseDone', { playerName: PLAYER_NAMES[player] }));
        afterBasingComplete();
    } else if (game.phase === GamePhase.PLAYING) {
        // Auto-play card(s)
        let cards = botPlay(player);
        let result = enginePlayCards(player, cards);
        if (!result.success) return;

        clearSelection();
        if (result.failedMultiplay) {
            handleFailedMultiplay(player, result.failedMultiplay, cards, result, () => {
                if (result.roundComplete) finishRound();
                else promptCurrentPlayer();
            });
            return;
        }
        renderDeskCards(player, cards);
        renderHand(player);
        for (let p = 0; p < NUM_PLAYERS; p++) {
            if (p !== HUMAN_PLAYER) updateExposedPreview(p);
        }
        if (result.roundComplete) finishRound();
        else promptCurrentPlayer();
    }
}

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------

function startNewGame() {
    // Note 66: Clear any active 3PDA shell when 4P game starts.
    clearThreePDAShell();

    ensureResolvedSettings();
    applyUserNaturalPositionFor4P(gResolvedGameSettings.displaySettings && gResolvedGameSettings.displaySettings.userNaturalPosition);

    // Clean up any in-progress dealing timer
    if (dealingTimer) { clearInterval(dealingTimer); dealingTimer = null; }
    if (gFrameIntermittentTimeout) { clearTimeout(gFrameIntermittentTimeout); gFrameIntermittentTimeout = null; gFrameIntermittentEndsAt = 0; }
    clearPauseProtocolStateToIdle();
    currentDeclaration = null;
    gAutoStrain3rdTriggerCard = null;
    gAutoStrain3rdTriggered = false;
    resetDeclarationHistoryRows();

    // Clear all active timers (note 24)
    clearTimers();

    // §3: Clear forehand-control and failed-multiplay aftermath UI state
    gFCInteraction = null;
    gCrossingState = null;
    hideLocalCrossingActionButtons();
    clearCrossingSeatStatuses();

    clearLog();
    clearSelection();
    clearDesk();
    clearBotDealCounts();
    gDeclareMatrix.style.display = 'none';
    hideCountingDialog();
    gBtnPlay.disabled = true;
    gBtnPlay.textContent = t('buttons.play');
    refreshPauseButtonState();

    // Hide show-base button (§5)
    if (gBtnShowBase) gBtnShowBase.style.display = 'none';
    if (gBasePreview) gBasePreview.innerHTML = '';

    let level, pivot, playerLevels, isQiangzhuang;
    let pendingCycleIndexBySide = null;
    if (pendingNextFrame) {
        // Continue session: use computed next-frame parameters
        level = pendingNextFrame.level;
        pivot = pendingNextFrame.pivot;
        playerLevels = pendingNextFrame.playerLevels;
        pendingCycleIndexBySide = Array.isArray(pendingNextFrame.cycleIndexBySide)
            ? [...pendingNextFrame.cycleIndexBySide]
            : null;
        isQiangzhuang = false;
        pendingNextFrame = null;
        // Increment frame number within game
        frameNumber++;
        // Reset within-frame attackers' streak
        attackersStreak = 0;
    } else {
        // Fresh game: use configured starting level
        level = (gResolvedGameSettings.ruleConfig && gResolvedGameSettings.ruleConfig.startLevel !== undefined)
            ? gResolvedGameSettings.ruleConfig.startLevel
            : 0;
        pivot = UNDETERMINED_PIVOT;
        playerLevels = null;
        isQiangzhuang = true;
        // Reset frame number for new game
        frameNumber = 1;
        attackersStreak = 0;
    }

    // Display frame number
    document.getElementById('div-table-number').textContent = frameNumber;

    // Clear corner infos
    gDenomArea.removeAttribute('strain');
    gStrainDiv.innerHTML = '';
    gDeclareSp.textContent = '';
    gDeclMethodSp.textContent = '';
    gScoreDiv.textContent = '0';
    if (gScoreCont) {
        gScoreCont.style.backgroundColor = 'transparent';
        gScoreCont.style.borderColor = '#f8f8f8';
    }
    if (gHint1Div) gHint1Div.textContent = '';
    if (gHint2Div) updateAttackersStreakDisplay();

    gBtnNewGame.textContent = t('buttons.newGame');
    let declarationOrderAnchor = isQiangzhuang ? Math.floor(Math.random() * NUM_PLAYERS) : pivot;
    engineStartGame(level, pivot, playerLevels, isQiangzhuang, gResolvedGameSettings.ruleConfig, declarationOrderAnchor);
    if (pendingCycleIndexBySide && game && game.levelRuleState) {
        game.levelRuleState.cycleIndexBySide = pendingCycleIndexBySide.map(v =>
            (Number.isInteger(v) && v >= 0) ? v : 0
        );
    }
    game.displaySettings = { placeholder: true, userNaturalPosition: 'east', ...(gResolvedGameSettings.displaySettings || {}) };
    refreshTopLeftSeatAndLevelPositionBoxFromGameState();

    // Reset won counters and refresh drawer only after authoritative new-frame state reset.
    wonCounterCards = [];
    updateCounterDrawer();

    // Initialize persistent name bars (§3)
    initPersistentNamebars();

    // Note 95a: Clear stale card contents from the reference-hand surface before the
    // frame-intermittent delay.  initPersistentNamebars() above has just placed a fresh
    // namebar, so this call preserves it while removing old hand cards.
    clearReferenceHandCardsPreservingNamebar();

    // Display current denomination level as rank-only (note 51b).
    gLevelDiv.textContent = levelDisplayLabel(game.level);
    setSeatsTopLeftBoxView('seats');

    // Note 95: Clear stale phase/status text immediately, before the 2-second frame-intermittent
    // delay (LEAK-1, LEAK-2 from Note 94 audit).  runDealingPhase() will overwrite these with
    // the live dealing-phase text once dealing begins.
    updatePhaseDisplay(t('phase.initial'));
    updateStatus(t('status.ready'));

    // Frame-start 2s intermittent (note 24 §3)
    runFrameIntermittent();
    refreshPauseButtonState();
}

// ---------------------------------------------------------------------------
// Dealing phase  (animated, 0.5s per round of 4 cards)
// ---------------------------------------------------------------------------

/**
 * Frame-start 2s non-interactive intermittent (note 24 §3).
 * Displays pivot/level info or qiangzhuang text, then starts dealing.
 */
function runFrameIntermittent(remainingMs) {
    gTimingPhase = 'intermittent';
    gBtnPlay.disabled = true;
    gDeclareMatrix.style.display = 'none';
    refreshPauseButtonState();

    // Central display text
    let displayText;
    if (game.isQiangzhuang) {
        displayText = t('timing.intermittentQiangzhuang');
    } else {
        let pivotPosition = POSITION_LABELS[game.pivot];
        displayText = t('timing.intermittentNormal', { position: pivotPosition, level: numberToLevel[game.level] });
    }

    gDeskInfo.innerHTML = '<div class="timer-intermittent">' + displayText + '</div>';

    let delayMs = Math.max(0, Number.isFinite(remainingMs) ? remainingMs : (getTimingConfigForPage().frameIntermittent * 1000));
    gFrameIntermittentEndsAt = Date.now() + delayMs;
    gFrameIntermittentTimeout = setTimeout(() => {
        gFrameIntermittentTimeout = null;
        gFrameIntermittentEndsAt = 0;
        gTimingPhase = null;
        gDeskInfo.innerHTML = '';
        runDealingPhase();
    }, delayMs);
}

function clearBotDealCounts() {
    // Card counts removed per user request
}

function updateBotDealCounts() {
    // Card counts removed per user request
}

function getDenominationHtml(suit, count) {
    if (suit === 4) {
        // No-trump in the denomination widget should use the dedicated NTS display.
        return ntsHtml;
    }
    let s = '<div class="suit-denomination">' + suitTexts[suit] + '</div>';
    return s.repeat(count);
}

function getNaturalPositionShort(player) {
    let locale = getLocale();
    if (locale === 'en') {
        // Runtime player order: 0=S, 1=E, 2=N, 3=W
        return ['S', 'E', 'N', 'W'][player] || '';
    }
    return ['南', '东', '北', '西'][player] || '';
}

function getDeclarationWhatHtml(suit, count) {
    if (suit === 4) {
        return count >= 4 ? 'WW' : 'VV';
    }
    let multiplicity = Math.max(1, Number(count) || 1);
    let out = '';
    for (let i = 0; i < multiplicity; i++) {
        out += '<span class="decl-history-suit-mark" data-suit="' + numberToSuitName[suit] + '">' + suitTexts[suit] + '</span>';
    }
    return out;
}

function getBasingWhenHowLabel(mode) {
    let locale = getLocale();
    if (mode === 'oc') {
        return locale === 'en' ? 'OC' : '反';
    }
    return locale === 'en' ? 'OB' : '炒';
}

function getHistoryAutoStrainText() {
    return getLocale() === 'en' ? 'auto strain' : '自动名目';
}

function getCurrentDealtCountForHistory() {
    if (gTimingPhase === 'finalDeclare') return 25;
    let dealt = Math.floor((game && game.dealIndex ? game.dealIndex : 0) / NUM_PLAYERS);
    if (dealt < 0) dealt = 0;
    if (dealt > 25) dealt = 25;
    return dealt;
}

function ensureDeclarationHistoryHoverBox() {
    if (!gDenomArea) return;
    if (gDeclHistoryBox && gDeclHistoryTbody) return;

    let box = gDenomArea.querySelector('.decl-history-hover-box');
    if (!box) {
        box = document.createElement('div');
        box.className = 'decl-history-hover-box';
        box.innerHTML = '<table class="decl-history-table"><tbody></tbody></table>';
        gDenomArea.appendChild(box);
    }

    gDeclHistoryBox = box;
    gDeclHistoryTbody = gDeclHistoryBox.querySelector('tbody');
    gDenomArea.setAttribute('data-decl-history-empty', '1');
}

function buildDeclarationHistoryCellValues(row) {
    if (row.type === 'auto-strain') {
        return {
            who: '',
            whatHtml: row.what || t('log.nobodyDeclared'),
            whenHow: row.whenHow || '',
            strainKey: '',
            autoNoDeclaration: true,
        };
    }
    return {
        who: getNaturalPositionShort(row.player),
        whatHtml: getDeclarationWhatHtml(row.suit, row.count),
        whenHow: row.phase === 'dealing' ? String(row.whenHow || '') : getBasingWhenHowLabel(row.basingMode || 'ob'),
        strainKey: row.suit === 4 ? (row.count >= 4 ? 'w' : 'v') : numberToSuitName[row.suit],
        autoNoDeclaration: false,
    };
}

function renderDeclarationHistoryRows() {
    ensureDeclarationHistoryHoverBox();
    if (!gDeclHistoryTbody) return;

    gDeclHistoryTbody.innerHTML = '';
    for (let i = 0; i < gDeclarationHistoryRows.length; i++) {
        let row = gDeclarationHistoryRows[i];
        let values = buildDeclarationHistoryCellValues(row);
        let tr = document.createElement('tr');
        if (values.autoNoDeclaration) tr.className = 'decl-history-row-auto';
        if (values.strainKey) tr.setAttribute('data-strain', values.strainKey);

        if (values.autoNoDeclaration) {
            let tdAuto = document.createElement('td');
            tdAuto.className = 'decl-history-col-auto';
            tdAuto.colSpan = 3;
            tdAuto.innerHTML = values.whatHtml;
            tr.appendChild(tdAuto);
        } else {
            let tdWho = document.createElement('td');
            tdWho.className = 'decl-history-col-who';
            tdWho.textContent = values.who;

            let tdWhat = document.createElement('td');
            tdWhat.className = 'decl-history-col-what';
            tdWhat.innerHTML = values.whatHtml;

            let tdWhenHow = document.createElement('td');
            tdWhenHow.className = 'decl-history-col-whenhow';
            tdWhenHow.textContent = values.whenHow;

            tr.appendChild(tdWho);
            tr.appendChild(tdWhat);
            tr.appendChild(tdWhenHow);
        }
        gDeclHistoryTbody.appendChild(tr);
    }

    if (gDenomArea) {
        gDenomArea.setAttribute('data-decl-history-empty', gDeclarationHistoryRows.length > 0 ? '0' : '1');
    }
}

function appendDeclarationHistoryRow(row) {
    gDeclarationHistoryRows.push({ ...row });
    renderDeclarationHistoryRows();
}

function resetDeclarationHistoryRows() {
    gDeclarationHistoryRows = [];
    renderDeclarationHistoryRows();
}

function recordDealingDeclarationHistory(player, suit, count) {
    appendDeclarationHistoryRow({
        type: 'declaration',
        phase: 'dealing',
        player,
        suit,
        count,
        whenHow: String(getCurrentDealtCountForHistory()),
    });
}

function recordBasingDeclarationHistory(player, suit, count, mode) {
    appendDeclarationHistoryRow({
        type: 'declaration',
        phase: 'basing',
        player,
        suit,
        count,
        basingMode: mode,
        whenHow: getBasingWhenHowLabel(mode),
    });
}

function recordAutoStrainHistoryRow() {
    appendDeclarationHistoryRow({
        type: 'auto-strain',
        phase: 'auto-strain',
        who: '',
        what: t('log.nobodyDeclared'),
        whenHow: '',
    });
}

function redealQiangzhuangNoDeclarationFrame() {
    // In qiangzhuang, no declaration means pivot is unresolved; redeal immediately.
    removeNoDeclareButton();
    clearDesk();
    gDeclareSp.textContent = '';
    gDeclMethodSp.textContent = '';
    gAutoStrain3rdTriggerCard = null;
    gAutoStrain3rdTriggered = false;
    resetDeclarationHistoryRows();
    startNewGame();
}

function renderResolvedStrainDisplay() {
    if (!gDenomArea || !gStrainDiv) return;

    // Prefer resolved declaration detail (suit + count) when available.
    let resolved = (game && Array.isArray(game.declarations) && game.declarations.length > 0)
        ? game.declarations[game.declarations.length - 1]
        : null;

    if (resolved) {
        let suitName = resolved.suit === 4 ? (resolved.count >= 4 ? 'w' : 'v') : numberToSuitName[resolved.suit];
        gDenomArea.setAttribute('strain', suitName);
        gStrainDiv.innerHTML = getDenominationHtml(resolved.suit, resolved.count);
        return;
    }

    // Fallback to authoritative resolved game strain.
    if (game && game.strain === 4) {
        gDenomArea.setAttribute('strain', 'v');
        gStrainDiv.innerHTML = ntsHtml;
        return;
    }
    if (game && game.strain >= 0 && game.strain <= 3) {
        gDenomArea.setAttribute('strain', numberToSuitName[game.strain]);
        gStrainDiv.innerHTML = getDenominationHtml(game.strain, 1);
    }
}

function updateDeclareMatrix() {
    let hand  = game.hands[HUMAN_PLAYER];
    let level = game.level;
    let currentCount = currentDeclaration ? currentDeclaration.count : 0;

    for (let suit = 0; suit <= 4; suit++) {
        let count = 0;
        let sj = hand.filter(c => c.rank === 14).length;
        let bj = hand.filter(c => c.rank === 15).length;
        if (suit === 4) {
            count = Math.max(sj, bj);
        } else {
            count = hand.filter(c => c.rank === level && c.suit === suit).length;
        }

        let btnS = gDeclBtnsSingle[suit];
        let btnD = gDeclBtnsDouble[suit];

        if (suit === 4) {
            // NTS buttons: Top button is Double V (count=3 equivalent), Bottom is Double W (count=4 equivalent)
            if (btnS) {
                btnS.innerHTML = 'VV';
                btnS.style.fontFamily = '"Roboto Mono"';
                let canDoubleV = (sj >= 2) && (currentCount < 3);
                if (currentDeclaration && currentDeclaration.player === HUMAN_PLAYER && currentDeclaration.suit !== 4) {
                    canDoubleV = false; // cannot overcall own declaration with different suit
                }
                if (currentDeclaration && currentDeclaration.suit === 4 && currentDeclaration.count === 3) {
                    canDoubleV = false;
                }
                btnS.disabled = !canDoubleV;
                btnS.onclick = () => { if (!btnS.disabled) executeDeclaration(4, 3); };
            }
            if (btnD) {
                btnD.innerHTML = 'WW';
                btnD.style.fontFamily = '"Roboto Mono"';
                let canDoubleW = (bj >= 2) && (currentCount < 4);
                if (currentDeclaration && currentDeclaration.player === HUMAN_PLAYER && currentDeclaration.suit !== 4) {
                    canDoubleW = false; // cannot overcall own declaration with different suit
                }
                if (currentDeclaration && currentDeclaration.suit === 4 && currentDeclaration.count === 4) {
                    canDoubleW = false;
                }
                btnD.disabled = !canDoubleW;
                btnD.onclick = () => { if (!btnD.disabled) executeDeclaration(4, 4); };
            }
        } else {
            // Normal suits
            if (btnS) {
                btnS.innerHTML = suitTexts[suit];
                let canS = (count >= 1) && (!currentDeclaration);
                btnS.disabled = !canS;
                btnS.onclick = () => { if (!btnS.disabled) executeDeclaration(suit, 1); };
            }
            if (btnD) {
                btnD.innerHTML = suitTexts[suit] + suitTexts[suit];
                let canD = (count >= 2) && (currentCount < 2);
                if (currentDeclaration && currentDeclaration.player === HUMAN_PLAYER && currentDeclaration.suit !== suit) {
                    canD = false; // cannot overcall own declaration with different suit
                }
                if (currentDeclaration && currentDeclaration.suit === suit && currentDeclaration.count >= 2) {
                    canD = false;
                }
                btnD.disabled = !canD;
                btnD.onclick = () => { if (!btnD.disabled) executeDeclaration(suit, 2); };
            }
        }
    }
}

function executeDeclaration(suit, count) {
    currentDeclaration = { player: HUMAN_PLAYER, suit, count };

    // Preview in UI corner
    let suitName = suit === 4 ? (count >= 4 ? 'w' : 'v') : numberToSuitName[suit];
    gDenomArea.setAttribute('strain', suitName);
    gStrainDiv.innerHTML   = getDenominationHtml(suit, count);
    gDeclareSp.textContent = POSITION_LABELS[HUMAN_PLAYER];
    let methodText = t('labels.declareMethod');
    gDeclMethodSp.textContent = methodText;
    appendLog(t('log.declare', { playerName: PLAYER_NAMES[HUMAN_PLAYER], strain: suit === 4 ? t('strain.noTrump') : suitName.toUpperCase() }));

    showDeclaredCardsOnDesk(HUMAN_PLAYER, suit, count);
    recordDealingDeclarationHistory(HUMAN_PLAYER, suit, count);
    updateDeclareMatrix();

    // If this is the highest possible declaration, break any active final-declaration window (note 24 §5.3)
    if (gTimingPhase === 'finalDeclare' && engineIsHighestPossibleDeclaration(currentDeclaration)) {
        breakCallingWindowTimer();
    }
}

function runDealingPhase() {
    if (isPauseDialogBlockingGameplay()) return;
    updatePhaseDisplay(t('phase.dealing'));
    updateStatus(t('status.dealingHint'));
    gBtnPlay.disabled = true;
    
    // Always show declaration UI during dealing (declaration is part of all frame-start flows)
    gDeclareMatrix.style.display = 'grid';
    updateDeclareMatrix();

    // No-declaration button disabled during dealing (§3.3)
    if (gBtnNoDeclare) {
        gBtnNoDeclare.textContent = t('timing.noDeclaration');
        gBtnNoDeclare.disabled = true;
        gBtnNoDeclare.onclick = null;
    }

    // Show dealt count in left box (§4.1)
    let dealtPerPlayer = game.dealIndex ? Math.floor(game.dealIndex / NUM_PLAYERS) : 0;
    gDeskInfo.innerHTML = '<div class="dealt-count">' + dealtPerPlayer + '</div>'
        + '<div class="dealt-count-label">' + t('dealing.dealtCount', { count: dealtPerPlayer }) + '</div>';

    dealingTimer = setInterval(function () {
        let batch = engineDealNextBatch();
        if (!batch) { clearInterval(dealingTimer); dealingTimer = null; return; }

        // Bots consider overcalling as they get cards
        for (let i = 0; i < NUM_PLAYERS; i++) {
            let p = (getDeclarationOrderAnchor() + i) % NUM_PLAYERS;
            if (p === HUMAN_PLAYER) continue;

            let decl = botChooseDeclaration(p, currentDeclaration, 'dealing');
            if (decl) {
                let currentCount = currentDeclaration ? currentDeclaration.count : 0;
                if (currentDeclaration ? botCompareDeclarations(decl, currentDeclaration, botGetEffectiveDeclarationOrdering()) > 0 : (decl.count > currentCount)) {
                    currentDeclaration = { player: p, suit: decl.suit, count: decl.count };
                    
                    let suitName = (decl.suit === 4) ? (decl.count >= 4 ? 'w' : 'v') : numberToSuitName[decl.suit];
                    gDenomArea.setAttribute('strain', suitName);
                    gStrainDiv.innerHTML = getDenominationHtml(decl.suit, decl.count);
                    gDeclareSp.textContent = POSITION_LABELS[p];
                    gDeclMethodSp.textContent = t('labels.declareMethod');
                    appendLog(t('log.declare', { playerName: PLAYER_NAMES[p], strain: decl.suit === 4 ? t('strain.noTrump') : suitName.toUpperCase() }));
                    showDeclaredCardsOnDesk(p, decl.suit, decl.count);
                    recordDealingDeclarationHistory(p, decl.suit, decl.count);
                }
            }
        }

        // Sort human-controlled players' hands for readability as cards arrive
        for (let hp of HUMAN_PLAYERS) {
            engineSortHand(game.hands[hp]);
        }
        renderHand(activeHumanPlayer);
        updateBotDealCounts();
        updateDeclareMatrix();

        // Update dealt count display (§4.1)
        let dealtPerPlayer = Math.floor(game.dealIndex / NUM_PLAYERS);
        gDeskInfo.innerHTML = '<div class="dealt-count">' + dealtPerPlayer + '</div>'
            + '<div class="dealt-count-label">' + t('dealing.dealtCount', { count: dealtPerPlayer }) + '</div>';

        if (game.phase === GamePhase.DECLARING) {
            clearInterval(dealingTimer);
            dealingTimer = null;
            // Clear dealt-count display (§4.1 — replaced by timer after dealing)
            gDeskInfo.innerHTML = '';
            // Note 24 §5: check if highest-possible declaration was already made
            if (engineIsHighestPossibleDeclaration(currentDeclaration)) {
                // §5.1: skip final declaration window, enter basing directly
                setTimeout(resolveDeclaredPhase, 400);
            } else {
                // §5.2: start 5s final declaration window
                setTimeout(runFinalDeclarationWindow, 400);
            }
        }
    }, 500);
}

// ---------------------------------------------------------------------------
// Final declaration window (note 24 §5–§6)
// ---------------------------------------------------------------------------

/**
 * Run a 5s final declaration window after all 25 cards are dealt.
 * Players may still declare/overcall. Breaks on highest-possible or unanimous "No declaration".
 */
function runFinalDeclarationWindow() {
    if (isPauseDialogBlockingGameplay()) return;
    updatePhaseDisplay(t('phase.declaring'));
    gDeclareMatrix.style.display = 'grid';
    updateDeclareMatrix();
    gNoDeclareClicked.clear();

    startCallingWindowTimer('finalDeclare', getTimingConfigForPage().finalDeclareWindow, () => {
        // Timer expired or broken — resolve
        removeNoDeclareButton();
        gDeclareMatrix.style.display = 'none';
        resolveDeclaredPhase();
    });

    // Bots take their last chance to overcall during the window
    for (let i = 0; i < NUM_PLAYERS; i++) {
        let p = (getDeclarationOrderAnchor() + i) % NUM_PLAYERS;
        if (isHumanControlled(p)) continue;
        let decl = botChooseDeclaration(p, currentDeclaration, 'dealing');
        if (decl) {
            let currentCount = currentDeclaration ? currentDeclaration.count : 0;
            if (currentDeclaration ? botCompareDeclarations(decl, currentDeclaration, botGetEffectiveDeclarationOrdering()) > 0 : (decl.count > currentCount)) {
                currentDeclaration = { player: p, suit: decl.suit, count: decl.count };
                let suitName = (decl.suit === 4) ? (decl.count >= 4 ? 'w' : 'v') : numberToSuitName[decl.suit];
                gDenomArea.setAttribute('strain', suitName);
                gStrainDiv.innerHTML = getDenominationHtml(decl.suit, decl.count);
                gDeclareSp.textContent = POSITION_LABELS[p];
                gDeclMethodSp.textContent = t('labels.declareMethod');
                appendLog(t('log.declare', { playerName: PLAYER_NAMES[p], strain: decl.suit === 4 ? t('strain.noTrump') : suitName.toUpperCase() }));
                showDeclaredCardsOnDesk(p, decl.suit, decl.count);
                recordDealingDeclarationHistory(p, decl.suit, decl.count);

                // If bot made highest-possible, break immediately (§5.3)
                if (engineIsHighestPossibleDeclaration(currentDeclaration)) {
                    breakCallingWindowTimer();
                    return;
                }
            }
        }
        // Bots auto-decline for "No declaration" purposes
        gNoDeclareClicked.add(p);
    }

    // Show "No declaration" button for human (§6)
    showNoDeclareButton(() => {
        // All players declined — break immediately (§6.2)
        breakCallingWindowTimer();
    });
}

// ---------------------------------------------------------------------------
// Declaration phase  (resolves after dealing animation completes)
// ---------------------------------------------------------------------------

function resolveDeclaredPhase() {
    if (isPauseDialogBlockingGameplay()) return;
    updatePhaseDisplay(t('phase.declaring'));
    updateStatus(t('status.declaring'));
    gDeclareMatrix.style.display = 'none';

    let bestDeclaration = currentDeclaration;

    if (bestDeclaration) {
        let suitName = bestDeclaration.suit === 4 ? (bestDeclaration.count >= 4 ? 'w' : 'v') : numberToSuitName[bestDeclaration.suit];
        engineSetStrain(bestDeclaration.suit);
        // In qiangzhuang frames, the declarer becomes the pivot;
        // in later frames, the pivot is already determined from the previous frame result
        if (game.isQiangzhuang) {
            game.pivot = bestDeclaration.player;
        }
        game.declarations.push(bestDeclaration);

        gDenomArea.setAttribute('strain', suitName);
        gStrainDiv.innerHTML = getDenominationHtml(bestDeclaration.suit, bestDeclaration.count);
        gDeclareSp.textContent    = POSITION_LABELS[bestDeclaration.player];
        gDeclMethodSp.textContent = t('labels.declareMethod');

        // Only log if they did it at the very end
        if (bestDeclaration.player !== HUMAN_PLAYER && (!currentDeclaration || bestDeclaration.count !== currentDeclaration.count)) {
            appendLog(t('log.declare', { playerName: PLAYER_NAMES[bestDeclaration.player], strain: bestDeclaration.suit === 4 ? t('strain.noTrump') : suitName.toUpperCase() }));
            showDeclaredCardsOnDesk(bestDeclaration.player, bestDeclaration.suit, bestDeclaration.count);
        }
    } else if (game && game.isQiangzhuang) {
        redealQiangzhuangNoDeclarationFrame();
        return;
    } else if (game.gameConfig && game.gameConfig.autoStrain === true && game.base && game.base.length >= 3) {
        let triggerCard = game.base[2];
        let resolvedStrain;
        if (triggerCard.isJoker()) {
            resolvedStrain = 4;
        } else {
            resolvedStrain = triggerCard.suit;
        }
        engineSetStrain(resolvedStrain);
        if (resolvedStrain === 4) {
            gDenomArea.setAttribute('strain', 'v');
            gStrainDiv.innerHTML = ntsHtml;
        } else {
            let suitName = numberToSuitName[resolvedStrain];
            gDenomArea.setAttribute('strain', suitName);
            gStrainDiv.innerHTML = getDenominationHtml(resolvedStrain, 1);
        }
        gDeclareSp.textContent = '';
        gDeclMethodSp.textContent = t('labels.thirdBase');
        appendLog(t('log.nobodyDeclared'));
        recordAutoStrainHistoryRow();
        gAutoStrain3rdTriggerCard = triggerCard;
        gAutoStrain3rdTriggered = true;
    } else {
        engineSetStrain(4);
        gDenomArea.setAttribute('strain', 'v');
        gStrainDiv.innerHTML = ntsHtml;
        gDeclareSp.textContent = '';
        gDeclMethodSp.textContent = t('labels.autoNts');
        appendLog(t('log.noDeclaration'));
        recordAutoStrainHistoryRow();
    }

    if (typeof isPivotResolved === 'function' && !isPivotResolved(game.pivot)) {
        if (game && game.isQiangzhuang) {
            redealQiangzhuangNoDeclarationFrame();
            return;
        }
        showError(t('errors.baseFailed'));
        return;
    }

    refreshTopLeftSeatAndLevelPositionBoxFromGameState();

    clearBotDealCounts();
    renderAllHands();
    updateScoreDisplay();

    clearDesk(); // Clear exposed declaration cards

    // Show 3rd-base trigger card in pivot's desk area (note 44a)
    if (gAutoStrain3rdTriggerCard) {
        renderDeskCards(game.pivot, [gAutoStrain3rdTriggerCard]);
    }

    // Move to basing phase
    if (!enginePickUpBase()) {
        showError(t('errors.baseFailed'));
        return;
    }
    runBasingPhase();
}

// ---------------------------------------------------------------------------
// Basing phase
// ---------------------------------------------------------------------------

function runBasingPhase() {
    if (isPauseDialogBlockingGameplay()) return;
    let baser = getActiveBaserPlayer();
    updatePhaseDisplay(t('phase.basing'));
    renderResolvedStrainDisplay();
    gOverbaseDecision = null;
    gDeclareMatrix.style.display = 'none';
    removeNoDeclareButton();

    if (isHumanControlled(baser)) {
        // Human-controlled player is the active baser — render their hand and wait for selection.
        activeHumanPlayer = baser;
        clearSelection();
        renderHand(baser);
        updatePhaseDisplay(t('phase.selectBase', { n: BASE_SIZE }) + (TEST_MODE ? ' (' + PLAYER_NAMES[baser] + ')' : ''));
        updateStatus(t('status.selectBase', { n: BASE_SIZE }));
        gBtnPlay.textContent = t('buttons.baseProgress', { current: 0, total: BASE_SIZE });
        gBtnPlay.disabled = true;

        // Start base shot clock (note 24 §10.1)
        startPlayerMoveTimer(baser, 'base', () => {
            autoPlayAsBot(baser);
        });
    } else {
        // Bot is the active baser — auto-base after 0.5 s delay (note 41e)
        setTimeout(function() {
            let baseCards = botMakeBase(baser);
            let deferPlaying = !!(game && game.gameConfig && game.gameConfig.allowOverbase);
            let ok = engineSetBase(baseCards, { deferPlaying });
            if (!ok) {
                showError(t('errors.baseFailed'));
                appendLog(t('errors.baseFailed'));
                return;
            }
            gAutoStrain3rdTriggerCard = null;
            clearDesk();
            renderAllHands();
            appendLog(t('log.baseDone', { playerName: PLAYER_NAMES[baser] }));
            afterBasingComplete();
        }, 500);
    }
}

// ---------------------------------------------------------------------------
// Sequential overbase decisions (note 41)
// ---------------------------------------------------------------------------

/**
 * After set-base, run sequential overcall decisions if overbase is enabled.
 * Otherwise, proceed directly to playing phase.
 */
function afterBasingComplete() {
    if (gAutoStrain3rdTriggered) {
        gAutoStrain3rdTriggered = false;
        startPlayingPhase();
    } else if (game.gameConfig && game.gameConfig.allowOverbase) {
        runSequentialOverbaseFlow();
    } else {
        startPlayingPhase();
    }
}

/**
 * Start timer for an overcall decision step.
 * Overcall decisions are play-timed and separate from set-base timing.
 * Special rule (shot+bank + no legal overcall): no bank drain, auto-pass on shot expiry.
 */
function startOvercallDecisionTimer(player, hasLegalOvercall, onTimeout) {
    let timingMode = getTimingModeForRuntime();
    if (isHumanControlled(player) && timingMode === 'shot + bank' && !hasLegalOvercall) {
        clearTimers();
        gTimingPhase = 'overcallDecision';
        let timingCfg = getTimingConfigForPage();
        gShotClockRemaining = timingCfg.playShotClock;
        gBankTimeRemaining = game.playerBankTimes[player];
        gTimerStage = 'shot';
        gTimerExpireCallback = onTimeout;
        gLiveTimerMeta = { kind: 'overcallDecision', player: player, moveType: 'play', hasLegalOvercall: hasLegalOvercall };
        showTimerOverlay(player);

        gTimerInterval = setInterval(() => {
            if (isPauseDialogBlockingGameplay()) return;
            gShotClockRemaining -= 0.1;
            if (gShotClockRemaining <= 0) {
                gShotClockRemaining = 0;
                clearTimers();
                onTimeout();
                return;
            }
            updateTimerDisplay();
        }, 100);
        return;
    }

    startPlayerMoveTimer(player, 'play', onTimeout);
    gTimingPhase = 'overcallDecision';
    gLiveTimerMeta = { kind: 'overcallDecision', player: player, moveType: 'play', hasLegalOvercall: hasLegalOvercall };
}

function getCurrentDeclarationHolder() {
    if (currentDeclaration && currentDeclaration.player !== null && currentDeclaration.player !== undefined) {
        return currentDeclaration.player;
    }
    if (game && Array.isArray(game.declarations) && game.declarations.length > 0) {
        let last = game.declarations[game.declarations.length - 1];
        if (last && last.player !== null && last.player !== undefined) return last.player;
    }
    return null;
}

function isEligiblePostDealingOverbaseActor(player) {
    let baser = getActiveBaserPlayer();
    let declarationHolder = getCurrentDeclarationHolder();
    if (player === baser) return false;
    if (declarationHolder !== null && declarationHolder !== undefined && player === declarationHolder) return false;
    return true;
}

function buildPostDealingOverbaseActorOrder(startPlayer) {
    let order = [];
    // After an accepted overbase + set-base, restart from the afterhand of the last baser (note 41ec).
    // If startPlayer is provided, begin from that player; otherwise use afterhand of pivot.
    if (startPlayer === undefined) {
        startPlayer = (game.pivot + 1) % NUM_PLAYERS;
    }
    // Use the table's advancing sequence starting from startPlayer.
    // Eligibility is then filtered from authoritative current baser/declaration-holder state.
    for (let i = 0; i < NUM_PLAYERS; i++) {
        let player = (startPlayer + i) % NUM_PLAYERS;
        if (!isEligiblePostDealingOverbaseActor(player)) continue;
        order.push(player);
    }
    return order;
}

function runSequentialOverbaseFlow() {
    let baser = getActiveBaserPlayer();
    let declarationHolder = getCurrentDeclarationHolder();
    // Restart post-dealing sequence from the afterhand of the last baser (note 41ec)
    let startPlayer = (baser + 1) % NUM_PLAYERS;
    
    // Build full advancing sequence including all players (for automatic PASS display in note 41ec)
    let fullSequence = [];
    for (let i = 0; i < NUM_PLAYERS; i++) {
        fullSequence.push((startPlayer + i) % NUM_PLAYERS);
    }
    
    // Build eligible-only order for decision-making
    let order = buildPostDealingOverbaseActorOrder(startPlayer);
    
    gOverbaseDecision = {
        order,
        fullSequence,
        index: 0,
        basePivot: game.pivot,
        baser: baser,
        declarationHolder: declarationHolder,
        // note 41h: restriction state — set true when latest baser's afterhand passes
        latestBaserAfterhandPassed: false,
    };
    runNextOvercallDecisionStep();
}

function buildOvercallOptionKey(opt) {
    return String(opt.suit) + ':' + String(opt.count);
}

function applyOvercallDecision(player, decl) {
    let previousDeclaration = currentDeclaration ? { ...currentDeclaration } : null;
    currentDeclaration = { player: player, suit: decl.suit, count: decl.count };
    let suitName = (decl.suit === 4) ? (decl.count >= 4 ? 'w' : 'v') : numberToSuitName[decl.suit];
    gDenomArea.setAttribute('strain', suitName);
    gStrainDiv.innerHTML = getDenominationHtml(decl.suit, decl.count);
    gDeclareSp.textContent = POSITION_LABELS[player];
    gDeclMethodSp.textContent = t('labels.declareMethod');
    appendLog(t('log.declare', { playerName: PLAYER_NAMES[player], strain: decl.suit === 4 ? t('strain.noTrump') : suitName.toUpperCase() }));
    // note 41h / 41ha: restriction is only active when the overbaseRestrictions setting is 'default'.
    let restrictionSettingEnabled = !!(game && game.gameConfig && game.gameConfig.overbaseRestrictions === 'default');
    let isNonOverbase = !!(restrictionSettingEnabled
        && gOverbaseDecision
        && gOverbaseDecision.latestBaserAfterhandPassed
        && game.finalBaserSeat !== null && game.finalBaserSeat !== undefined
        && player === (game.finalBaserSeat + 2) % NUM_PLAYERS);

    // note 41f + 41h: basingMode 'oc' for any non-overbase event, 'ob' for true overbase
    let basingMode;
    if (isNonOverbase) {
        basingMode = 'oc';
    } else {
        basingMode = (previousDeclaration && previousDeclaration.suit === decl.suit) ? 'oc' : 'ob';
    }
    recordBasingDeclarationHistory(player, decl.suit, decl.count, basingMode);

    gDeclareMatrix.style.display = 'none';
    removeNoDeclareButton();

    if (isNonOverbase) {
        // note 41ha: clear other players' artifacts first, then show this declaration,
        // then advance with a brief pause so the declaration is visibly rendered.
        clearDeskForOvercallDecisionStep();
        showDeclaredCardsOnDesk(player, decl.suit, decl.count);
        engineApplyNonOverbaseDeclaration(player, decl);
        setTimeout(function() {
            if (gOverbaseDecision) {
                gOverbaseDecision.index++;
                runNextOvercallDecisionStep();
            } else {
                startPlayingPhase();
            }
        }, 500);
    } else {
        showDeclaredCardsOnDesk(player, decl.suit, decl.count);
        engineApplyOverbaseDeclaration(player, decl);
        runBasingPhase();
    }
}

function finishOvercallDecisionStep(player, result) {
    if (isHumanControlled(player)) {
        stopPlayerMoveTimer(player);
    }
    gDeclareMatrix.style.display = 'none';
    removeNoDeclareButton();

    if (result && result.type === 'overcall' && result.declaration) {
        applyOvercallDecision(player, result.declaration);
        return;
    }

    // note 41h: track whether the latest baser's afterhand explicitly passes
    // note 41h / 41ha: only set when overbaseRestrictions is enabled
    if (gOverbaseDecision
            && game.gameConfig && game.gameConfig.overbaseRestrictions === 'default'
            && game.finalBaserSeat !== null && game.finalBaserSeat !== undefined) {
        if (player === (game.finalBaserSeat + 1) % NUM_PLAYERS) {
            gOverbaseDecision.latestBaserAfterhandPassed = true;
        }
    }

    // Show PASS marker in this player's desk slot (note 41e)
    showBasingPassMarker(player);

    if (!gOverbaseDecision) {
        startPlayingPhase();
        return;
    }
    gOverbaseDecision.index++;
    runNextOvercallDecisionStep();
}

function runNextOvercallDecisionStep() {
    if (!gOverbaseDecision) {
        startPlayingPhase();
        return;
    }
    if (gOverbaseDecision.index >= gOverbaseDecision.order.length) {
        // Render trailing mandatory/automatic PASS actors that occur after the
        // last eligible decision actor in full advancing sequence (note 41ed).
        if (gOverbaseDecision.lastProcessedFullSequenceIndex === undefined) {
            gOverbaseDecision.lastProcessedFullSequenceIndex = -1;
        }
        for (let i = gOverbaseDecision.lastProcessedFullSequenceIndex + 1; i < gOverbaseDecision.fullSequence.length; i++) {
            let trailingMandatoryPassActor = gOverbaseDecision.fullSequence[i];
            if (trailingMandatoryPassActor === gOverbaseDecision.baser) continue;
            showBasingPassMarker(trailingMandatoryPassActor);
        }

        // Final PASS display and linger before PLAYING (note 41ec §5)
        gOverbaseDecision = null;
        // After the last PASS is shown, linger for ~500ms before entering PLAYING
        setTimeout(function() {
            startPlayingPhase();
        }, 500);
        return;
    }

    // Show PASS for automatically passed ineligible actors before the next eligible actor (note 41ec §4)
    let nextEligiblePlayer = gOverbaseDecision.order[gOverbaseDecision.index];
    let nextEligibleIndex = gOverbaseDecision.fullSequence.indexOf(nextEligiblePlayer);
    
    // Check for and show PASS for any ineligible actors that come before nextEligiblePlayer
    if (gOverbaseDecision.lastProcessedFullSequenceIndex === undefined) {
        gOverbaseDecision.lastProcessedFullSequenceIndex = -1;
    }
    
    // Show PASS for all ineligible actors between last processed and next eligible
    let didShowAutomaticPass = false;
    for (let i = gOverbaseDecision.lastProcessedFullSequenceIndex + 1; i < nextEligibleIndex; i++) {
        let ineligiblePlayer = gOverbaseDecision.fullSequence[i];
        if (ineligiblePlayer === gOverbaseDecision.baser) continue;
        // note 41h: automatic pass for ineligible actor also counts as afterhand pass
        // note 41h / 41ha: only set when overbaseRestrictions is enabled
        if (game.gameConfig && game.gameConfig.overbaseRestrictions === 'default'
                && game.finalBaserSeat !== null && game.finalBaserSeat !== undefined
                && ineligiblePlayer === (game.finalBaserSeat + 1) % NUM_PLAYERS) {
            gOverbaseDecision.latestBaserAfterhandPassed = true;
        }
        showBasingPassMarker(ineligiblePlayer);
        didShowAutomaticPass = true;
    }
    
    if (didShowAutomaticPass) {
        // If we showed automatic pass, give it a moment to be visible before proceeding
        gOverbaseDecision.lastProcessedFullSequenceIndex = nextEligibleIndex - 1;
        setTimeout(function() {
            runNextOvercallDecisionStep();
        }, 250);
        return;
    }
    
    gOverbaseDecision.lastProcessedFullSequenceIndex = nextEligibleIndex;

    let player = nextEligiblePlayer;
    gOverbaseDecision.activeActor = player;

    // Sequential visual discipline: clear stale actor visuals and render only
    // the current authoritative declaration state before this actor decides.
    clearDeskForOvercallDecisionStep();
    highlightActivePlayer(player);

    let legal = botGetLegalOvercallDeclarations(player, currentDeclaration, 'basing-overcall');
    let hasLegal = legal.length > 0;

    if (!isHumanControlled(player)) {
        // 0.5 s delay before bot overcall decision is committed (note 41e)
        setTimeout(function() {
            let choice = botChooseDeclaration(player, currentDeclaration, 'basing-overcall');
            if (choice) {
                finishOvercallDecisionStep(player, { type: 'overcall', declaration: choice });
            } else {
                appendLog(t('timing.noDeclaration') + ' - ' + PLAYER_NAMES[player]);
                finishOvercallDecisionStep(player, { type: 'pass' });
            }
        }, 500);
        return;
    }

    activeHumanPlayer = player;
    clearSelection();
    renderHand(player);
    updatePhaseDisplay(t('phase.declaring'));
    updateStatus(t('status.declaring'));

    gDeclareMatrix.style.display = 'grid';
    for (let btn of gDeclBtnsSingle) {
        if (btn) {
            btn.disabled = true;
            btn.onclick = null;
        }
    }
    for (let btn of gDeclBtnsDouble) {
        if (btn) {
            btn.disabled = true;
            btn.onclick = null;
        }
    }

    let legalSet = new Set(legal.map(buildOvercallOptionKey));
    for (let suit = 0; suit <= 4; suit++) {
        // note 41ha: suit=4 (NTS/joker) — VV and WW are separate, independent choices.
        // Single button (VV) covers count=1/2/3; double button (WW) covers count=4 only.
        if (suit === 4) {
            let btnS4 = gDeclBtnsSingle[4];
            if (btnS4) {
                btnS4.innerHTML = 'VV';
                btnS4.disabled = !legalSet.has('4:1') && !legalSet.has('4:2') && !legalSet.has('4:3');
                if (!btnS4.disabled) {
                    btnS4.onclick = () => {
                        let picked = legal.find(o => o.suit === 4 && (o.count === 1 || o.count === 2 || o.count === 3));
                        if (!picked) return;
                        finishOvercallDecisionStep(player, { type: 'overcall', declaration: picked });
                    };
                }
            }
            let btnD4 = gDeclBtnsDouble[4];
            if (btnD4) {
                btnD4.innerHTML = 'WW';
                btnD4.disabled = !legalSet.has('4:4');
                if (!btnD4.disabled) {
                    btnD4.onclick = () => {
                        let picked = legal.find(o => o.suit === 4 && o.count === 4);
                        if (!picked) return;
                        finishOvercallDecisionStep(player, { type: 'overcall', declaration: picked });
                    };
                }
            }
            continue;
        }
        let btnS = gDeclBtnsSingle[suit];
        if (btnS) {
            btnS.innerHTML = suitTexts[suit];
            btnS.disabled = !legalSet.has(String(suit) + ':1') && !legalSet.has(String(suit) + ':3');
            if (!btnS.disabled) {
                btnS.onclick = () => {
                    let picked = legal.find(o => o.suit === suit && (o.count === 1 || o.count === 3));
                    if (!picked) return;
                    finishOvercallDecisionStep(player, { type: 'overcall', declaration: picked });
                };
            }
        }
        let btnD = gDeclBtnsDouble[suit];
        if (btnD) {
            btnD.innerHTML = suitTexts[suit] + suitTexts[suit];
            btnD.disabled = !legalSet.has(String(suit) + ':2') && !legalSet.has(String(suit) + ':4');
            if (!btnD.disabled) {
                btnD.onclick = () => {
                    let picked = legal.find(o => o.suit === suit && (o.count === 2 || o.count === 4));
                    if (!picked) return;
                    finishOvercallDecisionStep(player, { type: 'overcall', declaration: picked });
                };
            }
        }
    }

    showNoDeclareButton(() => {
        finishOvercallDecisionStep(player, { type: 'pass' });
    });

    startOvercallDecisionTimer(player, hasLegal, () => {
        finishOvercallDecisionStep(player, { type: 'pass' });
    });
}

// ---------------------------------------------------------------------------
// Crossing claim window and move progression (note 42b)
// ---------------------------------------------------------------------------

function getCrossingTeamKeyForSeat(player) {
    if (game && Array.isArray(game.defendingTeam) && game.defendingTeam.includes(player)) return 'defending';
    return 'attacking';
}

function getOppositeSeat(player) {
    return (player + 2) % NUM_PLAYERS;
}

function buildCrossingTeamRuntimeState() {
    return {
        claimed: false,
        claimantSeat: null,
        partnerSeat: null,
        phase: 'no-claim',
        botPending: false,
    };
}

function canOpenCrossingClaimWindow() {
    return !!(game && game.gameConfig && game.gameConfig.allowCrossings && game.strain !== 4);
}

function createCrossingEligibilitySnapshot() {
    let snapshot = {};
    for (let player = 0; player < NUM_PLAYERS; player++) {
        let trumpCount = engineCountTrumpIfStrain(game.hands[player], game.strain, game.level);
        snapshot[player] = trumpCount <= 5;
    }
    return snapshot;
}

function isCardTrumpForCurrentFrame(card) {
    if (!card || !game) return false;
    if (game.strain === 4) return true;
    return card.suit === 4 || card.rank === game.level || card.suit === game.strain;
}

function getLocalCrossingActionMode() {
    return (gCrossingState && gCrossingState.localAction) ? gCrossingState.localAction.mode : null;
}

function isLocalCrossingSelectionMode() {
    if (!gCrossingState || !gCrossingState.localAction || !gCrossingState.trickPlayBlocked) return false;
    let mode = gCrossingState.localAction.mode;
    return (mode === 'cross' || mode === 'crossback') && gCrossingState.localAction.seat === HUMAN_PLAYER;
}

function crossingHasAnyActiveTeamProcess() {
    if (!gCrossingState || !gCrossingState.teamState) return false;
    return ['defending', 'attacking'].some(teamKey => {
        let phase = gCrossingState.teamState[teamKey].phase;
        return phase !== 'no-claim' && phase !== 'done';
    });
}

function refreshCrossingTrickPlayBlocked() {
    if (!gCrossingState) return false;
    gCrossingState.trickPlayBlocked = !!(gCrossingState.claimWindowActive || crossingHasAnyActiveTeamProcess());
    return gCrossingState.trickPlayBlocked;
}

function clearCrossingSeatStatuses() {
    for (let player = 0; player < NUM_PLAYERS; player++) {
        clearDeskEventMarkersByScope('crossing-claim-seat-' + player);
    }
    if (gCrossingState) {
        gCrossingState.resolvedMarkersActive = false;
        gCrossingState.resolvedMarkersClearedAtFirstLead = false;
    }
}

function renderCrossingSeatStatuses() {
    if (!gCrossingState || !gCrossingState.claimWindowActive) return;
    for (let player = 0; player < NUM_PLAYERS; player++) {
        let resolved = gCrossingState.resolvedBySeat[player];
        if (!resolved) {
            clearDeskEventMarkersByScope('crossing-claim-seat-' + player);
            continue;
        }
        let isCross = (resolved.action === 'claim' || resolved.action === 'claim-ignored');
        let markerText = isCross ? t('buttons.toCross') : 'PASS';
        showDeskEventMarker(player, markerText, 'crossing-claim-seat-' + player);
        gCrossingState.resolvedMarkersActive = true;
        gCrossingState.resolvedMarkersClearedAtFirstLead = false;
    }
}

function clearCrossingClaimControls() {
    hideLocalCrossingActionButtons();
}

function refreshCrossingClaimControls() {
    ensureLocalCrossingActionButtons();
    renderCrossingSeatStatuses();

    if (!gCrossingState || !gCrossingState.claimWindowActive) {
        hideLocalCrossingActionButtons();
        return;
    }

    let localResolved = !!gCrossingState.resolvedBySeat[HUMAN_PLAYER];
    let localEligible = !!gCrossingState.eligibilityBySeat[HUMAN_PLAYER];
    setCrossingClaimControlsVisible(true);

    gBtnCrossClaim.style.display = '';
    gBtnCrossClaim.textContent = t('buttons.toCross');
    gBtnCrossClaim.disabled = localResolved || !localEligible;
    gBtnCrossClaim.onclick = gBtnCrossClaim.disabled ? null : (() => {
        resolveCrossingClaimWindowSeat(HUMAN_PLAYER, 'claim', 'click');
    });

    gBtnCrossDecline.style.display = '';
    gBtnCrossDecline.textContent = t('buttons.noCrossing');
    gBtnCrossDecline.disabled = localResolved;
    gBtnCrossDecline.onclick = gBtnCrossDecline.disabled ? null : (() => {
        resolveCrossingClaimWindowSeat(HUMAN_PLAYER, 'no-crossing', 'click');
    });
}

function crossingAllSeatsResolved() {
    if (!gCrossingState) return false;
    for (let player = 0; player < NUM_PLAYERS; player++) {
        if (!gCrossingState.resolvedBySeat[player]) return false;
    }
    return true;
}

function crossingAllTeamProcessesDone() {
    if (!gCrossingState || !gCrossingState.teamState) return true;
    return ['defending', 'attacking'].every(teamKey => {
        let phase = gCrossingState.teamState[teamKey].phase;
        return phase === 'no-claim' || phase === 'done';
    });
}

function recordCrossingSeatResolution(player, action, reason) {
    if (!gCrossingState || gCrossingState.resolvedBySeat[player]) return false;

    let resolvedAction = action;
    if (action === 'claim') {
        let teamKey = getCrossingTeamKeyForSeat(player);
        let teamState = gCrossingState.teamState[teamKey];
        if (!gCrossingState.eligibilityBySeat[player]) return false;
        if (!teamState.claimed) {
            teamState.claimed = true;
            teamState.claimantSeat = player;
            teamState.partnerSeat = getOppositeSeat(player);
            teamState.phase = 'claim-accepted';
            appendLog(t('log.crossingClaimAccepted', { playerName: PLAYER_NAMES[player] }));
        } else {
            resolvedAction = 'claim-ignored';
            appendLog(t('log.crossingClaimIgnored', { playerName: PLAYER_NAMES[player] }));
        }
    } else if (reason === 'timeout') {
        appendLog(t('log.crossingTimedOutNoClaim', { playerName: PLAYER_NAMES[player] }));
    }

    gCrossingState.resolvedBySeat[player] = { action: resolvedAction, reason, at: Date.now() };
    return true;
}

function resolveCrossingClaimWindowSeat(player, action, reason) {
    if (!gCrossingState || !gCrossingState.claimWindowActive) return false;
    let didResolve = recordCrossingSeatResolution(player, action, reason);
    if (!didResolve) return false;
    refreshCrossingClaimControls();
    if (crossingAllSeatsResolved()) {
        breakCallingWindowTimer();
    }
    return true;
}

function sortCardsHighToLow(cards) {
    let out = cards.slice();
    out.sort((a, b) => {
        if (a.order !== b.order) return b.order - a.order;
        if (a.rank !== b.rank) return b.rank - a.rank;
        return b.suit - a.suit;
    });
    return out;
}

function pickRandomArrayItem(items) {
    if (!items || items.length === 0) return null;
    return items[Math.floor(Math.random() * items.length)];
}

function pickByShortestPlainDivision(cards, count) {
    let buckets = {};
    for (let card of cards) {
        if (isCardTrumpForCurrentFrame(card)) continue;
        let key = String(card.suit);
        if (!buckets[key]) buckets[key] = [];
        buckets[key].push(card);
    }
    let groups = Object.keys(buckets).map(key => ({ key, cards: sortCardsHighToLow(buckets[key]) }));
    let chosen = [];
    while (chosen.length < count) {
        groups = groups.filter(group => group.cards.length > 0);
        if (groups.length === 0) break;
        let minLen = Math.min(...groups.map(group => group.cards.length));
        let shortest = groups.filter(group => group.cards.length === minLen);
        let g = pickRandomArrayItem(shortest);
        if (!g) break;
        chosen.push(g.cards.shift());
    }
    return chosen;
}

function pickBotCrossCards(player) {
    let hand = game.hands[player] || [];
    let selected = sortCardsHighToLow(hand.filter(card => isCardTrumpForCurrentFrame(card)));
    if (selected.length > 5) return null;
    if (selected.length < 5) {
        selected = selected.concat(pickByShortestPlainDivision(hand, 5 - selected.length));
    }
    if (selected.length < 5) {
        let ids = new Set(selected.map(c => c.cardId));
        let fallback = sortCardsHighToLow(hand.filter(c => !ids.has(c.cardId)));
        selected = selected.concat(fallback.slice(0, 5 - selected.length));
    }
    return selected.slice(0, 5);
}

function pickBotCrossbackCards(player) {
    let hand = game.hands[player] || [];
    let selected = pickByShortestPlainDivision(hand, 5);
    if (selected.length < 5) {
        let ids = new Set(selected.map(c => c.cardId));
        let fallback = sortCardsHighToLow(hand.filter(c => !ids.has(c.cardId)));
        selected = selected.concat(fallback.slice(0, 5 - selected.length));
    }
    return selected.slice(0, 5);
}

function isValidCrossingSelection(player, cards, requireAllTrumps) {
    if (!Array.isArray(cards) || cards.length !== 5) return false;
    let hand = game.hands[player] || [];
    let handIds = new Set(hand.map(c => c.cardId));
    let selectedIds = new Set(cards.map(c => c.cardId));
    if (selectedIds.size !== cards.length) return false;
    for (let card of cards) {
        if (!handIds.has(card.cardId)) return false;
    }
    if (!requireAllTrumps) return true;
    let trumps = hand.filter(c => isCardTrumpForCurrentFrame(c));
    for (let trump of trumps) {
        if (!selectedIds.has(trump.cardId)) return false;
    }
    return true;
}

function transferCardsBetweenSeats(fromSeat, toSeat, cards) {
    let ids = new Set(cards.map(card => card.cardId));
    game.hands[fromSeat] = (game.hands[fromSeat] || []).filter(card => !ids.has(card.cardId));
    game.hands[toSeat] = (game.hands[toSeat] || []).concat(cards);
    engineSortHand(game.hands[fromSeat]);
    engineSortHand(game.hands[toSeat]);
}

function performCrossMove(teamKey, cards) {
    if (!gCrossingState || !gCrossingState.teamState || !gCrossingState.teamState[teamKey]) return false;
    let ts = gCrossingState.teamState[teamKey];
    if (ts.phase !== 'waiting-cross') return false;
    if (!isValidCrossingSelection(ts.claimantSeat, cards, true)) return false;

    transferCardsBetweenSeats(ts.claimantSeat, ts.partnerSeat, cards);
    ts.phase = 'waiting-crossback';
    ts.botPending = false;
    appendLog(t('log.crossingMoveDone', { playerName: PLAYER_NAMES[ts.claimantSeat], partnerName: PLAYER_NAMES[ts.partnerSeat] }));
    renderAllHands();
    return true;
}

function performCrossbackMove(teamKey, cards) {
    if (!gCrossingState || !gCrossingState.teamState || !gCrossingState.teamState[teamKey]) return false;
    let ts = gCrossingState.teamState[teamKey];
    if (ts.phase !== 'waiting-crossback') return false;
    if (!isValidCrossingSelection(ts.partnerSeat, cards, false)) return false;

    transferCardsBetweenSeats(ts.partnerSeat, ts.claimantSeat, cards);
    ts.phase = 'done';
    ts.botPending = false;
    appendLog(t('log.crossingCrossbackDone', { playerName: PLAYER_NAMES[ts.partnerSeat], partnerName: PLAYER_NAMES[ts.claimantSeat] }));
    renderAllHands();
    return true;
}

function refreshCrossingLocalActionState() {
    if (!gCrossingState) return;
    let nextAction = null;
    if (!gCrossingState.claimWindowActive) {
        for (let teamKey of ['defending', 'attacking']) {
            let ts = gCrossingState.teamState[teamKey];
            if (!ts) continue;
            if (ts.phase === 'waiting-cross' && ts.claimantSeat === HUMAN_PLAYER) {
                nextAction = { mode: 'cross', teamKey, seat: HUMAN_PLAYER };
                break;
            }
            if (ts.phase === 'waiting-crossback' && ts.partnerSeat === HUMAN_PLAYER) {
                nextAction = { mode: 'crossback', teamKey, seat: HUMAN_PLAYER };
                break;
            }
        }
    }

    let prev = gCrossingState.localAction;
    gCrossingState.localAction = nextAction;
    if (!nextAction) {
        hideLocalCrossingActionButtons();
        updatePlayButton();
        return;
    }
    let enteredNewAction = (!prev || prev.mode !== nextAction.mode || prev.teamKey !== nextAction.teamKey || prev.seat !== nextAction.seat);
    if (enteredNewAction) {
        clearSelection();
        if (nextAction.mode === 'cross' && nextAction.seat === HUMAN_PLAYER) {
            let hand = game.hands[HUMAN_PLAYER] || [];
            for (let card of hand) {
                if (isCardTrumpForCurrentFrame(card)) selectedCardIds.add(card.cardId);
            }
        }
    }
    activeHumanPlayer = HUMAN_PLAYER;
    renderHand(HUMAN_PLAYER);
    hideLocalCrossingActionButtons();
    updatePlayButton();
}

function maybeFinalizeCrossingProcesses() {
    if (!gCrossingState || gCrossingState.claimWindowActive) return false;
    if (!crossingAllTeamProcessesDone()) return false;

    gCrossingState.localAction = null;
    clearSelection();
    hideLocalCrossingActionButtons();
    game.currentLeader = game.pivot;
    game.currentTurnIndex = 0;
    appendLog(t('log.crossingAllDone'));
    refreshCrossingTrickPlayBlocked();
    promptCurrentPlayer();
    return true;
}

function scheduleBotCrossingAction(teamKey, mode) {
    if (!gCrossingState || !gCrossingState.teamState || !gCrossingState.teamState[teamKey]) return;
    let ts = gCrossingState.teamState[teamKey];
    if (ts.botPending) return;
    ts.botPending = true;

    setTimeout(() => {
        if (!gCrossingState || !gCrossingState.teamState || !gCrossingState.teamState[teamKey]) return;
        let state = gCrossingState.teamState[teamKey];
        state.botPending = false;

        if (mode === 'cross' && state.phase === 'waiting-cross') {
            let cards = pickBotCrossCards(state.claimantSeat) || (game.hands[state.claimantSeat] || []).slice(0, 5);
            performCrossMove(teamKey, cards);
        } else if (mode === 'crossback' && state.phase === 'waiting-crossback') {
            let cards = pickBotCrossbackCards(state.partnerSeat) || (game.hands[state.partnerSeat] || []).slice(0, 5);
            performCrossbackMove(teamKey, cards);
        }

        driveCrossingProcesses();
    }, BOT_DELAY);
}

function driveCrossingProcesses() {
    if (!gCrossingState || gCrossingState.claimWindowActive) return;
    refreshCrossingTrickPlayBlocked();
    refreshCrossingLocalActionState();

    if (!crossingHasAnyActiveTeamProcess()) {
        maybeFinalizeCrossingProcesses();
        return;
    }

    for (let teamKey of ['defending', 'attacking']) {
        let ts = gCrossingState.teamState[teamKey];
        if (!ts) continue;
        if (ts.phase === 'waiting-cross' && ts.claimantSeat !== HUMAN_PLAYER) {
            scheduleBotCrossingAction(teamKey, 'cross');
        } else if (ts.phase === 'waiting-crossback' && ts.partnerSeat !== HUMAN_PLAYER) {
            scheduleBotCrossingAction(teamKey, 'crossback');
        }
    }

    highlightActivePlayer(-1);
    updatePhaseDisplay(t('phase.crossingPending'));
    updateStatus(t('status.crossingPending'));
    updatePlayButton();
}

function trySubmitLocalCrossingSelection() {
    if (!gCrossingState || !gCrossingState.localAction) return false;
    let action = gCrossingState.localAction;
    if (action.seat !== HUMAN_PLAYER) return false;
    if (action.mode !== 'cross' && action.mode !== 'crossback') return false;

    let cards = getSelectedCards(HUMAN_PLAYER);
    let requireAllTrumps = (action.mode === 'cross');
    if (!isValidCrossingSelection(HUMAN_PLAYER, cards, requireAllTrumps)) {
        showError(requireAllTrumps ? t('errors.crossingRequireAllTrumps') : t('errors.crossingSelectFive'));
        return true;
    }

    stopPlayerMoveTimer(HUMAN_PLAYER);
    let ok = (action.mode === 'cross') ? performCrossMove(action.teamKey, cards) : performCrossbackMove(action.teamKey, cards);
    if (!ok) {
        showError(t('errors.playFailed'));
        return true;
    }

    clearSelection();
    driveCrossingProcesses();
    return true;
}

function scheduleBotClaimWindowDecisions() {
    for (let player = 0; player < NUM_PLAYERS; player++) {
        if (player === HUMAN_PLAYER) continue;
        let delay = 260 + (player * 80);
        setTimeout(() => {
            if (!gCrossingState || !gCrossingState.claimWindowActive) return;
            if (gCrossingState.resolvedBySeat[player]) return;
            let eligible = !!gCrossingState.eligibilityBySeat[player];
            resolveCrossingClaimWindowSeat(player, eligible ? 'claim' : 'no-crossing', 'bot');
        }, delay);
    }
}

function finalizeCrossingClaimWindow() {
    if (!gCrossingState || gCrossingState.claimWindowClosed) return;
    gCrossingState.claimWindowClosed = true;
    gCrossingState.claimWindowActive = false;

    for (let player = 0; player < NUM_PLAYERS; player++) {
        if (!gCrossingState.resolvedBySeat[player]) {
            recordCrossingSeatResolution(player, 'no-crossing', 'timeout');
        }
    }

    for (let teamKey of ['defending', 'attacking']) {
        let ts = gCrossingState.teamState[teamKey];
        if (ts.phase === 'claim-accepted') ts.phase = 'waiting-cross';
    }

    clearCrossingClaimControls();
    refreshCrossingTrickPlayBlocked();
    updatePlayButton();

    if (gCrossingState.trickPlayBlocked) {
        driveCrossingProcesses();
        return;
    }
    promptCurrentPlayer();
}

function openCrossingClaimWindow() {
    gCrossingState = {
        claimWindowActive: true,
        claimWindowClosed: false,
        claimWindowDeadline: Date.now() + 5000,
        eligibilityBySeat: createCrossingEligibilitySnapshot(),
        resolvedBySeat: { 0: null, 1: null, 2: null, 3: null },
        teamState: {
            defending: buildCrossingTeamRuntimeState(),
            attacking: buildCrossingTeamRuntimeState(),
        },
        localAction: null,
        trickPlayBlocked: true,
        resolvedMarkersActive: false,
        resolvedMarkersClearedAtFirstLead: false,
    };

    clearSelection();
    highlightActivePlayer(-1);
    updatePlayButton();
    updatePhaseDisplay(t('phase.crossingClaim'));
    updateStatus(t('status.crossingClaim'));
    refreshCrossingClaimControls();
    scheduleBotClaimWindowDecisions();
    startCallingWindowTimer('crossingClaimWindow', 5, () => finalizeCrossingClaimWindow());
}

function setCrossingTeamPhase(teamKey, phase) {
    if (!gCrossingState || !gCrossingState.teamState || !gCrossingState.teamState[teamKey]) return false;
    gCrossingState.teamState[teamKey].phase = phase;
    refreshCrossingTrickPlayBlocked();
    if (!gCrossingState.claimWindowActive && gCrossingState.trickPlayBlocked) {
        driveCrossingProcesses();
    } else if (!gCrossingState.claimWindowActive && !gCrossingState.trickPlayBlocked && game && game.phase === GamePhase.PLAYING) {
        clearCrossingClaimControls();
        promptCurrentPlayer();
    }
    return true;
}

// ---------------------------------------------------------------------------
// Playing phase
// ---------------------------------------------------------------------------

function startPlayingPhase() {
    clearDesk();
    if (!engineCommitBasingToPlaying()) {
        showError('Cannot enter playing phase: invalid hand/base card counts.');
        appendLog('Cannot enter playing phase: invalid hand/base card counts.');
        return;
    }
    updatePhaseDisplay(t('phase.playing'));
    renderResolvedStrainDisplay();
    gBtnPlay.textContent = t('buttons.play');
    clearSelection();
    renderAllHands();

    // Show-base button only for the final baser during playing phase.
    if (gBtnShowBase && canSeatSeeBaseInPlayingPhase(HUMAN_PLAYER) && game.base) {
        gBtnShowBase.style.display = 'block';
        // Populate base preview
        if (gBasePreview) {
            gBasePreview.innerHTML = '';
            let row = document.createElement('div');
            row.className = 'hand';
            let sorted = [...game.base];
            engineSortHand(sorted);
            for (let c of sorted) {
                row.appendChild(gameCreateCardContainer(c));
            }
            gBasePreview.appendChild(row);
        }
    }

    if (canOpenCrossingClaimWindow()) {
        openCrossingClaimWindow();
        return;
    }

    promptCurrentPlayer();
}

// ---------------------------------------------------------------------------
// Forehand control exercise
// ---------------------------------------------------------------------------

function exerciseForehandControl(targetPlayer, fcTrigger) {
    let controller = fcTrigger.controller;
    let exposedDivCards = fcTrigger.exposedDivisionCards;

    appendLog(t('log.forehandControlActivated', {
        controllerName: PLAYER_NAMES[controller],
        targetName: PLAYER_NAMES[targetPlayer]
    }));

    // Create ForehandControlInteractionState
    gFCInteraction = {
        target: targetPlayer,
        controller: controller,
        exposedDivisionCards: exposedDivCards,
        exposedCardIds: new Set(exposedDivCards.map(c => c.cardId)),
        selectedCornerIds: new Set(),
        mode: null,
        selectionMounted: false,
        commitButtonsMounted: false
    };

    if (!isHumanControlled(controller)) {
        // Bot controller: must-play with empty selectedCards (effectively a no-op)
        engineExerciseFC(targetPlayer, 'must-play', []);
        appendLog(t('log.forehandControlBotExercised', { controllerName: PLAYER_NAMES[controller] }));
        gFCInteraction = null;
        promptCurrentPlayer();
    } else {
        // Human controller: mount selection UI on the target's namebar
        highlightActivePlayer(targetPlayer);

        updatePhaseDisplay(t('phase.forehandControl', { controllerName: PLAYER_NAMES[controller], targetName: PLAYER_NAMES[targetPlayer] }));
        updateStatus(t('status.forehandControl', { targetName: PLAYER_NAMES[targetPlayer] }));

        // Show exposed-preview in interactive FC mode on the target's namebar
        let nb = gDeskNamebars[targetPlayer];
        if (nb) {
            let preview = nb.querySelector('.exposed-preview');
            if (preview) {
                preview.classList.add('fc-active');
                renderFCCorners(targetPlayer, preview);
                gFCInteraction.selectionMounted = true;
                gFCInteraction.commitButtonsMounted = true;
            }
        }

        // Enable main play button as FC commit fallback (must-play with current selection)
        updatePlayButton();

        // FC is same timing unit as the controller's own move (note 24 §12)
        continueFCTimingUnit(controller, () => {
            // Time expired during FC — auto-commit must-play with empty selection
            commitForehandControl('must-play');
        });
    }
}

/**
 * Render selectable corner cards and FC action buttons inside the exposed-preview.
 */
function renderFCCorners(targetPlayer, preview) {
    let fci = gFCInteraction;
    preview.innerHTML = '';

    // Render selectable corner cards
    for (let card of fci.exposedDivisionCards) {
        let el = createCornerCard(card);
        if (fci.selectedCornerIds.has(card.cardId)) {
            el.setAttribute('data-fc-selected', '');
        }
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => {
            if (fci.selectedCornerIds.has(card.cardId)) {
                fci.selectedCornerIds.delete(card.cardId);
            } else {
                fci.selectedCornerIds.add(card.cardId);
            }
            renderFCCorners(targetPlayer, preview);
        });
        preview.appendChild(el);
    }

    // Action buttons row
    let btnRow = document.createElement('div');
    btnRow.className = 'fc-btn-row';

    let btnPlay = document.createElement('button');
    btnPlay.className = 'button fc-action-btn';
    btnPlay.textContent = t('fc.mustPlay');
    btnPlay.addEventListener('click', () => commitForehandControl('must-play'));
    btnRow.appendChild(btnPlay);

    let btnHold = document.createElement('button');
    btnHold.className = 'button fc-action-btn';
    btnHold.textContent = t('fc.mustHold');
    btnHold.addEventListener('click', () => commitForehandControl('must-hold'));
    btnRow.appendChild(btnHold);

    preview.appendChild(btnRow);
}

/**
 * Commit forehand control: consume chance, apply constraint, deactivate interaction.
 */
function commitForehandControl(mode) {
    let fci = gFCInteraction;
    if (!fci) return;

    // Stop the FC continuation timing unit (note 24 §12.2)
    stopPlayerMoveTimer(fci.controller);
    let targetPlayer = fci.target;

    // Get selected cards from the corner selection
    let markedCards = fci.exposedDivisionCards.filter(c => fci.selectedCornerIds.has(c.cardId));

    engineExerciseFC(targetPlayer, mode, markedCards);

    // Clean up FC-active preview — deactivate ForehandControlInteractionState
    let nb = gDeskNamebars[targetPlayer];
    if (nb) {
        let preview = nb.querySelector('.exposed-preview');
        if (preview) {
            preview.classList.remove('fc-active');
        }
    }

    if (markedCards.length > 0) {
        appendLog(t('log.forehandControlMarked', {
            controllerName: PLAYER_NAMES[fci.controller],
            count: markedCards.length,
            mode: mode === 'must-play' ? t('fc.mustPlay') : t('fc.mustHold')
        }));
    } else {
        appendLog(t('log.forehandControlNoMarks', { controllerName: PLAYER_NAMES[fci.controller] }));
    }

    gFCInteraction = null;

    // Update exposed previews with FC markings
    for (let p = 0; p < NUM_PLAYERS; p++) {
        if (p !== HUMAN_PLAYER) updateExposedPreview(p);
    }

    clearSelection();
    promptCurrentPlayer();
}

function promptCurrentPlayer() {
    if (isPauseDialogBlockingGameplay()) {
        updateStatus(t('status.paused'));
        refreshPauseButtonState();
        return;
    }
    if (gCrossingState && gCrossingState.trickPlayBlocked) {
        driveCrossingProcesses();
        highlightActivePlayer(-1);
        updatePhaseDisplay(gCrossingState.claimWindowActive ? t('phase.crossingClaim') : t('phase.crossingPending'));
        updateStatus(gCrossingState.claimWindowActive ? t('status.crossingClaim') : t('status.crossingPending'));
        updatePlayButton();
        return;
    }

    let cp = engineGetCurrentPlayer();
    let isLeading = (game.currentTurnIndex === 0);

    // Check if forehand control needs to be exercised before this player follows
    // At most one FC exercise per follow event — skip if already active
    if (!isLeading && !game.forehandControl) {
        let fcTrigger = engineCheckFCTrigger(cp);
        if (fcTrigger.shouldTrigger) {
            exerciseForehandControl(cp, fcTrigger);
            return;
        }
    }

    if (gDeskInfo)  gDeskInfo.innerHTML = t('desk.roundInfo', { round: game.currentRound, playerName: PLAYER_NAMES[cp], action: isLeading ? t('desk.leadAction') : t('desk.followAction') });

    let shouldClearCrossingResolvedMarkers = !!(
        gCrossingState
        && gCrossingState.resolvedMarkersActive
        && !gCrossingState.resolvedMarkersClearedAtFirstLead
        && isLeading
        && cp === game.pivot
        && game.currentRound === 1
        && game.currentTurnIndex === 0
    );

    highlightActivePlayer(cp);

    if (isHumanControlled(cp)) {
        // Switch displayed hand to the active human player
        activeHumanPlayer = cp;
        clearSelection();

        if (isLeading) {
            updateStatus(t('status.yourLead'));
        } else {
            let li = describeLeadInfo(game.leadInfo);
            updateStatus(t('status.follow', { division: t('division.' + li.divisionKey), leadType: t('leadType.' + li.leadTypeKey), volume: game.leadInfo.volume }));
        }
        updatePhaseDisplay((TEST_MODE ? PLAYER_NAMES[cp] + ' — ' : '') + (isLeading ? t('phase.lead') : t('phase.follow', { volume: game.leadInfo.volume })));
        gBtnPlay.disabled = true;
        gBtnPlay.textContent = t('buttons.play');
        
        // Auto-pop strictly forced cards
        if (!isLeading && game.leadInfo) {
            let h = game.hands[cp];
            
            // Auto-play for the last round (when volume to follow equals remaining cards)
            if (h.length > 0 && h.length === game.leadInfo.volume) {
                h.forEach(c => selectedCardIds.add(c.cardId));
                renderHand(cp);
                updatePlayButton();
                setTimeout(() => humanPlayCards(), 400); // automatically submit
                return;
            }
            
            let divCards = h.filter(c => c.division === game.leadInfo.division);
            
            // For single-card division follow or less cards than volume
            if (divCards.length > 0 && divCards.length <= game.leadInfo.volume) {
                divCards.forEach(c => selectedCardIds.add(c.cardId));
            } 
            // Auto-pop unique structured part via DFP (UI addendum §3)
            else if (game.leadInfo.elements && game.leadInfo.elements.some(e => e.copy >= 2)) {
                let outcomes = engineEnumerateDFPOutcomes(h, game.leadInfo, game.forehandControl);
                let nonShort = outcomes.filter(o => !o.shortDivisionCase);

                if (nonShort.length > 0) {
                    // Collect distinct structured card sets
                    let seen = new Map();
                    for (let outcome of nonShort) {
                        let key = outcome.structuredCards.map(c => c.cardId).sort((a, b) => a - b).join(',');
                        if (!seen.has(key)) {
                            seen.set(key, outcome.structuredCards);
                        }
                    }

                    // If exactly one unique structured part, auto-pop it
                    if (seen.size === 1) {
                        let cards = seen.values().next().value;
                        cards.forEach(c => selectedCardIds.add(c.cardId));
                    }
                }
            }
        }
        
        renderHand(cp);
        updatePlayButton();

        if (shouldClearCrossingResolvedMarkers) {
            clearCrossingSeatStatuses();
            gCrossingState.resolvedMarkersClearedAtFirstLead = true;
        }

        // Start play-card shot clock (note 24 §10.2)
        startPlayerMoveTimer(cp, 'play', () => {
            autoPlayAsBot(cp);
        });
    } else {
        updateStatus(t('status.botThinking', { playerName: PLAYER_NAMES[cp] }));
        updatePhaseDisplay(t('phase.botPlaying', { playerName: PLAYER_NAMES[cp] }));
        gBtnPlay.disabled = true;
        if (shouldClearCrossingResolvedMarkers) {
            clearCrossingSeatStatuses();
            gCrossingState.resolvedMarkersClearedAtFirstLead = true;
        }
        // Bot plays after a delay
        setTimeout(() => botTakeTurn(cp), BOT_DELAY);
    }
}

/**
 * Handle failed multiplay display sequence:
 * 1) Announce all blockers
 * 2) Show intended lead (with revoked cards highlighted) for 1 second
 * 3) Replace desk with actual led element, show exposed corners, re-render hand
 * 4) Continue game flow
 */
function handleFailedMultiplay(player, fm, allIntendedCards, result, onContinue) {
    // Mark FailedMultiplayState hold in progress
    game.failedMultiplay.holdInProgress = true;

    // Immediate visible updates at failed-multiplay registration time (note 39e).
    updateScoreDisplay();
    updateCounterDrawer();

    // 1) Announce all blockers
    let allBlockerNames = fm.allBlockerSeats.map(s => PLAYER_NAMES[s]).join(', ');
    appendLog(t('log.multiplayFailed', {
        playerName: PLAYER_NAMES[player],
        blockerName: PLAYER_NAMES[fm.blockerSeat],
        allBlockerNames: allBlockerNames,
        actualVolume: fm.actualElement.cards.length
    }));

    // Simplified status bar message (note 25 §9)
    updateStatus(t('hints.multiplayFailedShort'));

    // 2) Show all intended cards on desk, with revoked cards highlighted
    let revokedIds = new Set(fm.revokedCards.map(c => c.cardId));
    let slot = getDeskSlotFor4PActorSeat(player);
    if (!slot) return;
    slot.querySelectorAll('.card-container, .hand, .namebar:not(.desk-namebar)').forEach(el => el.remove());
    let sorted = [...allIntendedCards];
    engineSortHand(sorted);
    let row = document.createElement('div');
    row.className = 'hand';
    for (let card of sorted) {
        let cc = gameCreateCardContainer(card);
        if (revokedIds.has(card.cardId)) {
            cc.setAttribute('card-show', 'show-revoked');
        }
        row.appendChild(cc);
    }
    slot.appendChild(row);
    if (player !== HUMAN_PLAYER) {
        updateNamebarWidth(player, sorted.length);
        updateNamebarStatus(player, 'played');
    }

    // 3) After 1 second: revoke display, replace desk with actual element
    setTimeout(() => {
        game.failedMultiplay.holdInProgress = false;
        game.failedMultiplay.revocationApplied = true;

        renderDeskCards(player, fm.actualElement.cards);
        // Update exposed-card previews from ExposedCardState
        for (let p = 0; p < NUM_PLAYERS; p++) {
            if (p !== HUMAN_PLAYER) updateExposedPreview(p);
        }
        renderHand(player);
        onContinue();
    }, 1000);
}

function botTakeTurn(player) {
    if (isPauseDialogBlockingGameplay()) return;
    let cards = botPlay(player);
    let result = enginePlayCards(player, cards);

    if (!result.success) {
        appendLog(t('log.botError', { error: result.error }));
        return;
    }

    if (result.failedMultiplay) {
        handleFailedMultiplay(player, result.failedMultiplay, cards, result, () => {
            if (result.roundComplete) {
                finishRound();
            } else {
                promptCurrentPlayer();
            }
        });
        return;
    }

    renderDeskCards(player, cards);
    renderHand(player);

    // Update exposed previews after each play
    for (let p = 0; p < NUM_PLAYERS; p++) {
        if (p !== HUMAN_PLAYER) updateExposedPreview(p);
    }

    if (result.roundComplete) {
        finishRound();
    } else {
        promptCurrentPlayer();
    }
}

function humanPlayCards() {
    if (isPauseDialogBlockingGameplay()) return;
    // During forehand control exercise, the main play button commits FC with must-play
    if (gFCInteraction) {
        commitForehandControl('must-play');
        return;
    }

    if (trySubmitLocalCrossingSelection()) {
        return;
    }

    let cp = (game.phase === GamePhase.BASING) ? getActiveBaserPlayer() : engineGetCurrentPlayer();
    humanPlayCardsCore(cp);
}

// ---------------------------------------------------------------------------
// Settings dialog (note 34)
// ---------------------------------------------------------------------------

const SETTINGS_FIELDS_BY_TAB = {
    table: ['tableFormat', 'deckCount', 'pivotPassMode', 'presetName'],
    general: ['autoStrain', 'allowOverbase', 'overbaseRestrictions', 'attackersSelfBaseHalfMultiplier', 'failedMultiplayHandling', 'multiplayCompensationAmount', 'allowCrossings'],
    scoring: ['scoringPreset', 'endingCompensation', 'endingCompensationUnit', 'stageThreshold', 'levelThreshold', 'levelUpLimitPerFrame', 'baseMultiplierScheme'],
    levels: ['levelsPreset', 'startLevel', 'mustDefendLevels', 'mustStopLevels', 'knockBackLevels', 'skipLevels', 'knockBackConditionMode', 'knockBackTakeStageRequired', 'nonSingleKnockBackTwoSteps', 'gameMode'],
    timing: ['timingPreset', 'timingMode', 'playShotClock', 'baseShotClock', 'bankTime', 'baseTimeIncrement'],
};

const SETTINGS_SELECT_OPTIONS = {
    presetName: () => Object.keys(window.shengjiSettingsPresets || { 'default': {} }),
    autoStrain: ['false', 'true'],
    pivotPassMode: ['winner-pivot', 'rotate-pivot'],
    allowOverbase: ['false', 'true'],
    overbaseRestrictions: ['none', 'default'],
    failedMultiplayHandling: ['default', 'compensation', 'lian-zhong-compensation'],
    allowCrossings: ['false', 'true'],
    scoringPreset: ['', 'traditional', 'traditional-power', '7-3-5', '8-4-4'],
    baseMultiplierScheme: ['limited', 'single-or-not', 'exponential', 'power'],
    levelsPreset: ['', 'default', 'high-school', 'plain', 'skip-468'],
    gameMode: ['endless', 'pass-A'],
    timingPreset: ['', 'normal', '180+30'],
    timingMode: ['shot + bank', 'bank-time-only'],
};

const PRESET_RULE_DROPDOWN_OPTIONS = [
    { value: 'custom', labelKey: 'custom' },
    { value: 'default', labelKey: 'default' },
    { value: 'high-school', labelKey: 'highSchool' },
    { value: 'Berkeley', labelKey: 'berkeley' },
    { value: 'experimental', labelKey: 'experimental' },
    { value: 'plain', labelKey: 'plain' },
    { value: 'short-level rotate-pivot', labelKey: 'shortLevelRotatePivot' },
];

const MAIN_PRESET_BUILTIN_NAMES = PRESET_RULE_DROPDOWN_OPTIONS.map(opt => opt.value).filter(v => v !== 'custom');
const MAIN_PRESET_COMPARISON_FIELDS = [
    // 'deckCount' and 'pivotPassMode' are table-level fields (independent);
    // they are not included in rule-bundle comparison (see TABLE_LEVEL_FIELDS).
    'autoStrain',
    'allowOverbase',
    'overbaseRestrictions',
    'allowCrossings',
    'failedMultiplayHandling',
    'multiplayCompensationAmount',
    // 'scoringPreset' is a derived label updated by syncScoringPresetLabel; individual
    // scoring fields below are the authoritative comparison values.
    'countingSystem',
    'endingCompensation',
    'endingCompensationUnit',
    'stageThreshold',
    'levelThreshold',
    'levelUpLimitPerFrame',
    'baseMultiplierScheme',
    'attackersSelfBaseHalfMultiplier',
    'baseMultiplierLimit',
    'levelsPreset',
    'levelConfiguration',
    'startLevel',
    'mustDefendStartMarker',
    'mustDefendLevels',
    'mustStopStartMarker',
    'mustStopLevels',
    'knockBackLevels',
    'knockBackConditionMode',
    'knockBackTakeStageRequired',
    'nonSingleKnockBackTwoSteps',
    'gameMode',
    'doubleDeclarationOrdering',
];

// Table-level fields are independent from the rule bundle and are not part of
// rule-bundle comparison for preset matching.  Each preset may declare
// table-level constraints; a preset is "enabled" only when those constraints
// are satisfied by the current draft config.
const TABLE_LEVEL_FIELDS = ['deckCount', 'tableFormat', 'pivotPassMode'];

// Per-preset table-level constraints.  Key = preset value string.
// Value = function(draftCfg) → bool.  Returns true if the preset is compatible
// with the current table-level settings and may be considered for matching.
const MAIN_PRESET_CONSTRAINTS = {
    // short-level rotate-pivot requires rotate-pivot pivot-pass mode.
    'short-level rotate-pivot': cfg => !!(cfg && cfg.pivotPassMode === 'rotate-pivot'),
};

let gMainPresetSyncGuard = false;

function cloneRuleConfig(cfg) {
    if (!cfg) return null;
    return {
        ...cfg,
        mustDefendLevels: Array.isArray(cfg.mustDefendLevels) ? [...cfg.mustDefendLevels] : [],
        mustStopLevels: Array.isArray(cfg.mustStopLevels) ? [...cfg.mustStopLevels] : [],
        knockBackLevels: Array.isArray(cfg.knockBackLevels) ? [...cfg.knockBackLevels] : [],
        timing: { ...(cfg.timing || {}) },
    };
}

function getDefaultResolvedSettings() {
    if (typeof shengjiResolveGameSettings === 'function') {
        return shengjiResolveGameSettings({ presetName: 'default' });
    }
    return {
        presetName: 'default',
        ruleConfig: engineBuildConfig('default'),
        displaySettings: { placeholder: true, userNaturalPosition: 'east' },
    };
}

function ensureResolvedSettings() {
    if (!gResolvedGameSettings) {
        gResolvedGameSettings = getDefaultResolvedSettings();
    }
}

function getTimingConfigForPage() {
    let fromRule = game && game.gameConfig && game.gameConfig.timing ? game.gameConfig.timing : null;
    return {
        ...TIMING_CONFIG,
        ...(fromRule || {})
    };
}

function getTimingModeForRuntime() {
    if (game && game.gameConfig && game.gameConfig.timingMode) {
        return game.gameConfig.timingMode;
    }
    if (gResolvedGameSettings && gResolvedGameSettings.ruleConfig && gResolvedGameSettings.ruleConfig.timingMode) {
        return gResolvedGameSettings.ruleConfig.timingMode;
    }
    return 'shot + bank';
}

const LEVEL_VALUE_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const LEVEL_MATRIX_COUNTER_LEVELS = new Set([3, 8, 11]);
const LEVEL_MATRIX_KEY_SPACER = '__SPACER__';
const LEVEL_MATRIX_KEY_START_MARKER = '__START_MARKER__';

function levelDisplayLabel(level) {
    if (Array.isArray(numberToLevel) && numberToLevel[level] !== undefined) {
        return numberToLevel[level];
    }
    return String(level);
}

function normalizeCycleIndexForDisplay(cycleIndex) {
    let numeric = Number(cycleIndex);
    return Number.isInteger(numeric) && numeric >= 0 ? numeric : 0;
}

function getSideCycleIndex(cycleIndexBySide, sideIndex) {
    if (!Array.isArray(cycleIndexBySide)) return 0;
    return normalizeCycleIndexForDisplay(cycleIndexBySide[sideIndex]);
}

function renderLevelWithCycle(hostElement, level, cycleIndex) {
    if (!hostElement) return;

    hostElement.innerHTML = '';

    let wrap = document.createElement('span');
    wrap.className = 'level-with-cycle';

    let rank = document.createElement('span');
    rank.className = 'level-with-cycle-rank';
    rank.textContent = levelDisplayLabel(level);
    wrap.appendChild(rank);

    let normalizedCycleIndex = normalizeCycleIndexForDisplay(cycleIndex);
    if (normalizedCycleIndex >= 1) {
        let sub = document.createElement('span');
        sub.className = 'level-with-cycle-subscript';
        sub.textContent = String(normalizedCycleIndex + 1);
        wrap.appendChild(sub);
    }

    hostElement.appendChild(wrap);
}

function getPivotAndAllyPositions(pivotSeat) {
    let referenceActorSeat = Number.isInteger(Number(HUMAN_PLAYER)) ? Number(HUMAN_PLAYER) : getActorSeatFor4PNaturalPosition('east');
    return {
        pivotPos: getDisplayPositionFor4PActorSeat(pivotSeat, referenceActorSeat),
        allyPos: getDisplayPositionFor4PActorSeat((Number(pivotSeat) + 2) % NUM_PLAYERS, referenceActorSeat),
    };
}

function isUndefinedPivot(pivotSeat) {
    if (typeof isPivotResolved === 'function') return !isPivotResolved(pivotSeat);
    if (pivotSeat === null || pivotSeat === undefined) return true;
    return !Number.isInteger(Number(pivotSeat));
}

function renderLevelPositionSquare(host, options) {
    if (!host) return;
    host.innerHTML = '';

    let box = document.createElement('div');
    box.className = 'level-position-box' + (options.boxClassName ? (' ' + options.boxClassName) : '');
    if (options.boxId) box.id = options.boxId;
    
    // Sizing and font-size are handled entirely by CSS using vh-based responsive variables.
    // Do not set hard-coded pixel dimensions as inline styles.

    let square = document.createElement('div');
    square.className = 'level-position-square' + (options.squareClassName ? (' ' + options.squareClassName) : '');
    if (options.squareId) square.id = options.squareId;

    let referenceActorSeat = Number.isInteger(Number(options.referenceActorSeat))
        ? Number(options.referenceActorSeat)
        : HUMAN_PLAYER;
    let levelFallback = Number.isInteger(Number(options.nsLevel)) ? Number(options.nsLevel) : 0;
    let levelsByActor = Array.isArray(options.levelsByActor)
        ? options.levelsByActor
        : [Number(options.nsLevel), Number(options.ewLevel), Number(options.nsLevel), Number(options.ewLevel)];
    let cycleIndexBySide = Array.isArray(options.cycleIndexBySide)
        ? options.cycleIndexBySide
        : [options.nsCycleIndex, options.ewCycleIndex];

    let axisLevelByPosition = {};
    let axisCycleByPosition = {};
    ['top', 'right', 'bottom', 'left'].forEach((position) => {
        let actorSeat = getActorSeatFor4PDisplayPosition(position, referenceActorSeat);
        let actorLevel = Number(levelsByActor[actorSeat]);
        axisLevelByPosition[position] = Number.isInteger(actorLevel) ? actorLevel : levelFallback;
        axisCycleByPosition[position] = getSideCycleIndex(cycleIndexBySide, actorSeat % 2);
    });

    // Check if pivot is undefined
    let pivotUndefined = isUndefinedPivot(options.pivotSeat);
    let seat = Number(options.pivotSeat);
    let pivotSeat = (!pivotUndefined && typeof isPivotResolved === 'function' && isPivotResolved(seat)) ? seat : undefined;
    let markers = pivotUndefined ? { pivotPos: undefined, allyPos: undefined } : {
        pivotPos: getDisplayPositionFor4PActorSeat(pivotSeat, referenceActorSeat),
        allyPos: getDisplayPositionFor4PActorSeat((pivotSeat + 2) % NUM_PLAYERS, referenceActorSeat),
    };

    ['top', 'right', 'bottom', 'left'].forEach((position) => {
        let section = document.createElement('div');
        section.className = 'level-position-triangle' + (options.triangleClassName ? (' ' + options.triangleClassName) : '');
        section.setAttribute('data-pos', position);
        
        if (pivotUndefined) {
            section.setAttribute('data-team', 'undefined');
        } else {
            if (position === markers.pivotPos) section.setAttribute('data-team', 'pivot');
            else if (position === markers.allyPos) section.setAttribute('data-team', 'ally');
            else section.setAttribute('data-team', 'other');
        }
        
        renderLevelWithCycle(section, axisLevelByPosition[position], axisCycleByPosition[position]);
        square.appendChild(section);
    });

    box.appendChild(square);
    host.appendChild(box);
}

function ensureSeatsHoverLevelPositionBox() {
    if (!gSeatsDiv) return;
    if (gSeatsHoverLevelPositionBox) return;

    let box = gSeatsDiv.querySelector('.seats-toggle-level-position-box');
    if (!box) {
        box = document.createElement('div');
        box.className = 'seats-toggle-level-position-box level-position-box';
        gSeatsDiv.appendChild(box);
    }
    gSeatsHoverLevelPositionBox = box;
}

function getCurrentFrameSideLevelAndCycleState() {
    let levelFallback = (game && Number.isInteger(game.level)) ? game.level : 0;
    let levels = (game && Array.isArray(game.playerLevels)) ? game.playerLevels : [levelFallback, levelFallback, levelFallback, levelFallback];
    let cycleBySide = (game && game.levelRuleState && Array.isArray(game.levelRuleState.cycleIndexBySide))
        ? game.levelRuleState.cycleIndexBySide
        : [0, 0];
    let pivotSeat = (game && typeof isPivotResolved === 'function' && isPivotResolved(game.pivot)) ? game.pivot : UNDETERMINED_PIVOT;

    let levelsByActor = [];
    for (let seat = 0; seat < NUM_PLAYERS; seat++) {
        let actorLevel = Number(levels[seat]);
        levelsByActor[seat] = Number.isInteger(actorLevel) ? actorLevel : levelFallback;
    }

    return {
        levelsByActor,
        cycleIndexBySide: [
            getSideCycleIndex(cycleBySide, 0),
            getSideCycleIndex(cycleBySide, 1),
        ],
        pivotSeat,
    };
}

function renderSeatsHoverLevelPositionSquare() {
    ensureSeatsHoverLevelPositionBox();
    if (!gSeatsHoverLevelPositionBox) return;

    let state = getCurrentFrameSideLevelAndCycleState();
    
    // Compute box dimensions from the seats-box outer size
    let boxRect = gSeatsHoverLevelPositionBox.getBoundingClientRect();
    let boxWidthPx = boxRect.width > 0 ? boxRect.width : 15 * (window.innerHeight / 100); // fallback to 15vh in pixels
    let boxHeightPx = boxRect.height > 0 ? boxRect.height : 15 * (window.innerHeight / 100);
    
    renderLevelPositionSquare(gSeatsHoverLevelPositionBox, {
        boxId: 'seats-toggle-level-position-box-root',
        boxClassName: 'seats-toggle-level-position-box-root',
        boxWidthPx,
        boxHeightPx,
        squareId: 'seats-toggle-level-position-square',
        squareClassName: 'seats-toggle-level-position-square',
        triangleClassName: 'seats-toggle-level-position-triangle',
        levelsByActor: state.levelsByActor,
        cycleIndexBySide: state.cycleIndexBySide,
        pivotSeat: state.pivotSeat,
        referenceActorSeat: HUMAN_PLAYER,
    });
}

function setSeatsTopLeftBoxView(view) {
    if (!gSeatsDiv) return;
    gSeatsTopLeftBoxView = (view === 'level-position') ? 'level-position' : 'seats';

    let tableNumber = document.getElementById('div-table-number');
    let pivotMark = gSeatsDiv.querySelector('.div-pivot-mark');
    let showingLevelPosition = (gSeatsTopLeftBoxView === 'level-position');

    gSeatsDiv.setAttribute('data-box-view', showingLevelPosition ? 'level-position' : 'seats');
    if (tableNumber) tableNumber.style.display = showingLevelPosition ? 'none' : '';
    if (pivotMark) pivotMark.style.display = showingLevelPosition ? 'none' : '';

    ensureSeatsHoverLevelPositionBox();
    if (gSeatsHoverLevelPositionBox) {
        gSeatsHoverLevelPositionBox.style.display = showingLevelPosition ? 'block' : 'none';
        if (showingLevelPosition) {
            renderSeatsHoverLevelPositionSquare();
        }
    }
}

function toggleSeatsTopLeftBoxView() {
    if (gSeatsTopLeftBoxView === 'level-position') setSeatsTopLeftBoxView('seats');
    else setSeatsTopLeftBoxView('level-position');
}

function settingsOptionLabel(value) {
    const map = {
        'true': 'yes',
        'false': 'no',
        'winner-pivot': 'winnerPivot',
        'rotate-pivot': 'rotatePivot',
        'Infinity': 'unlimited',
        'none': 'none',
        '': 'noPreset',
        'custom': 'custom',
        'default': 'default',
        'experimental': 'experimental',
        'plain': 'plain',
        'high-school': 'highSchool',
        'Berkeley': 'berkeley',
        'endless': 'endless',
        'pass-A': 'passA',
        'shot + bank': 'shotPlusBank',
        'bank-time-only': 'bankTimeOnly',
        'normal': 'normal',
        '180+30': 'timing180Plus30',
        // scoring preset values
        'traditional': 'traditional',
        'traditional-power': 'traditionalPower',
        '7-3-5': 'sevenThreeFive',
        '8-4-4': 'eightFourFour',
        // levels preset values
        'skip-468': 'skip468',
        // base multiplier schemes
        'limited': 'limited',
        'single-or-not': 'singleOrNot',
        'exponential': 'exponential',
        'power': 'power',
    };
    let key = map[String(value)] || String(value);
    return t('settingsDialog.options.' + key);
}

function getDraftUserNaturalPosition() {
    let source = gSettingsDraftDisplaySettings || {};
    return normalize4PUserNaturalPosition(source.userNaturalPosition);
}

function setDisplaySettingFieldValue(field, value) {
    if (!gSettingsDraftDisplaySettings) gSettingsDraftDisplaySettings = { placeholder: true };
    if (field === 'userNaturalPosition') {
        gSettingsDraftDisplaySettings.userNaturalPosition = normalize4PUserNaturalPosition(value);
    } else {
        gSettingsDraftDisplaySettings[field] = value;
    }
}

function settingsUserNaturalPositionLabel(value) {
    let actorSeat = getActorSeatFor4PNaturalPosition(value);
    return POSITION_LABELS[actorSeat];
}

function createUserNaturalPositionSelector(readOnly) {
    let wrapper = document.createElement('div');
    wrapper.className = 'settings-field';

    let label = document.createElement('label');
    label.textContent = t('settingsDialog.fields.userNaturalPosition');
    wrapper.appendChild(label);

    let radioGroup = document.createElement('div');
    radioGroup.className = 'settings-radio-group';
    let current = getDraftUserNaturalPosition();
    for (let value of ['east', 'north', 'west', 'south']) {
        let radioLabel = document.createElement('label');
        radioLabel.className = 'settings-radio-option';

        let radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'userNaturalPosition';
        radio.value = value;
        radio.checked = (value === current);
        radio.disabled = !!readOnly;
        radio.setAttribute('data-settings-field', 'userNaturalPosition');

        if (!readOnly) {
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    setDisplaySettingFieldValue('userNaturalPosition', value);
                    renderSettingsDialog();
                }
            });
        }

        radioLabel.appendChild(radio);
        radioLabel.appendChild(document.createTextNode(settingsUserNaturalPositionLabel(value)));
        radioGroup.appendChild(radioLabel);
    }

    wrapper.appendChild(radioGroup);
    return wrapper;
}

function renderSeatSettingsPanel(container, readOnly) {
    if (!container) return;
    container.innerHTML = '';
    let grid = document.createElement('div');
    grid.className = 'settings-grid settings-display-grid';
    // Note 68: show 3PDA seat selector when table format is 3PDA; 4P selector otherwise.
    let tableFormat = (gSettingsDraftRuleConfig && gSettingsDraftRuleConfig.tableFormat) || 'normal-4P';
    if (tableFormat === 'three-player-dummy-ally') {
        grid.appendChild(create3PDARealNaturalPositionSelector(readOnly));
    } else {
        grid.appendChild(createUserNaturalPositionSelector(readOnly));
    }
    container.appendChild(grid);
}

/**
 * Creates the 3PDA real natural seat selector (N/Sw/Se only — Ay excluded).
 * Note 68: stored in gSettingsDraftDisplaySettings.user3PDARealNaturalPosition.
 */
function create3PDARealNaturalPositionSelector(readOnly) {
    let wrapper = document.createElement('div');
    wrapper.className = 'settings-field';

    let label = document.createElement('label');
    label.textContent = t('settingsDialog.fields.userNaturalPosition3PDA');
    wrapper.appendChild(label);

    let radioGroup = document.createElement('div');
    radioGroup.className = 'settings-radio-group';
    let current = getDraftUser3PDARealNaturalPosition();
    for (let value of ['N', 'Sw', 'Se']) {
        let radioLabel = document.createElement('label');
        radioLabel.className = 'settings-radio-option';

        let radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'user3PDARealNaturalPosition';
        radio.value = value;
        radio.checked = (value === current);
        radio.disabled = !!readOnly;
        radio.setAttribute('data-settings-field', 'user3PDARealNaturalPosition');

        if (!readOnly) {
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    setDraftUser3PDARealNaturalPosition(value);
                    renderSettingsDialog();
                }
            });
        }

        radioLabel.appendChild(radio);
        radioLabel.appendChild(document.createTextNode(get3PDAActorLabel(value)));
        radioGroup.appendChild(radioLabel);
    }

    wrapper.appendChild(radioGroup);
    return wrapper;
}

function renderDisplaySettingsPanel(container, readOnly) {
    if (!container) return;
    container.innerHTML = '';
    let p = document.createElement('p');
    p.textContent = t('settingsDialog.placeholders.display');
    p.style.padding = '1em';
    container.appendChild(p);
}

function getRuleConfigFieldValue(field) {
    if (field === 'tableFormat') {
        return (gSettingsDraftRuleConfig && gSettingsDraftRuleConfig.tableFormat) || 'normal-4P';
    }
    if (field in (gSettingsDraftRuleConfig.timing || {})) {
        return gSettingsDraftRuleConfig.timing[field];
    }
    return gSettingsDraftRuleConfig[field];
}

// Check whether the current scoring fields match a known scoring preset; update scoringPreset label.
function syncScoringPresetLabel() {
    let scoringPresets = window.shengjiScoringPresets;
    if (!scoringPresets) return;
    let cfg = gSettingsDraftRuleConfig;
    let matched = '';
    for (let key of Object.keys(scoringPresets)) {
        let sp = scoringPresets[key];
        let ok = true;
        if (sp.endingCompensation !== undefined && !!cfg.endingCompensation !== sp.endingCompensation) ok = false;
        if (sp.endingCompensationUnit !== undefined && Number(cfg.endingCompensationUnit) !== Number(sp.endingCompensationUnit)) ok = false;
        if (sp.stageThreshold !== undefined && cfg.stageThreshold !== sp.stageThreshold) ok = false;
        if (sp.levelThreshold !== undefined && cfg.levelThreshold !== sp.levelThreshold) ok = false;
        if (sp.levelUpLimitPerFrame !== undefined && cfg.levelUpLimitPerFrame !== sp.levelUpLimitPerFrame) ok = false;
        if (sp.baseMultiplierScheme !== undefined && cfg.baseMultiplierScheme !== sp.baseMultiplierScheme) ok = false;
        if (ok) { matched = key; break; }
    }
    gSettingsDraftRuleConfig.scoringPreset = matched;
}

function syncLevelsPresetLabel() {
    let levelsPresets = window.shengjiLevelsPresets;
    if (!levelsPresets) return;
    let detected = window.shengjiDetectLevelsPreset(gSettingsDraftRuleConfig);
    gSettingsDraftRuleConfig.levelsPreset = detected || '';
}

function syncTimingPresetLabel() {
    let detected = '';
    if (typeof window.shengjiDetectTimingPreset === 'function') {
        detected = window.shengjiDetectTimingPreset(gSettingsDraftRuleConfig) || '';
    }
    gSettingsDraftRuleConfig.timingPreset = detected;
}

function getRuleConfigValueByPath(cfg, path) {
    if (!cfg) return undefined;
    let parts = path.split('.');
    let cur = cfg;
    for (let key of parts) {
        if (cur === null || cur === undefined) return undefined;
        cur = cur[key];
    }
    return cur;
}

function normalizeRuleConfigForMainPresetMatch(cfg) {
    let overrides = cloneRuleConfig(cfg || {});
    if (!overrides) return null;
    delete overrides.presetName;
    if (typeof shengjiResolveGameRuleConfig === 'function') {
        return shengjiResolveGameRuleConfig({ presetName: 'default', overrides });
    }
    return overrides;
}

function buildMainPresetComparisonSnapshot(cfg) {
    let out = {};
    for (let path of MAIN_PRESET_COMPARISON_FIELDS) {
        let value = getRuleConfigValueByPath(cfg, path);
        if (Array.isArray(value)) {
            out[path] = value.slice();
        } else if (value && typeof value === 'object') {
            out[path] = JSON.parse(JSON.stringify(value));
        } else {
            out[path] = value;
        }
    }
    return out;
}

function snapshotsExactMatch(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

// Returns true when the given preset's table-level constraints are satisfied
// by the current draft config.  Presets with no constraints are always enabled.
function isPresetEnabled(presetName, cfg) {
    const constraint = MAIN_PRESET_CONSTRAINTS[presetName];
    if (typeof constraint === 'function') return constraint(cfg);
    return true;
}

function syncMainPresetSelectionByExactMatch() {
    if (!gSettingsDraftRuleConfig) return;

    let normalizedCurrent = normalizeRuleConfigForMainPresetMatch(gSettingsDraftRuleConfig);
    if (!normalizedCurrent) return;
    let currentSnap = buildMainPresetComparisonSnapshot(normalizedCurrent);

    let matched = 'custom';
    for (let presetName of MAIN_PRESET_BUILTIN_NAMES) {
        if (!window.shengjiSettingsPresets || !window.shengjiSettingsPresets[presetName]) continue;
        // Skip presets whose table-level constraints are not satisfied by the
        // current draft config (e.g. short-level rotate-pivot requires rotate-pivot).
        if (!isPresetEnabled(presetName, gSettingsDraftRuleConfig)) continue;
        let canonical = (typeof shengjiResolveGameRuleConfig === 'function')
            ? shengjiResolveGameRuleConfig({ presetName })
            : null;
        if (!canonical) continue;
        let canonicalSnap = buildMainPresetComparisonSnapshot(canonical);
        if (snapshotsExactMatch(currentSnap, canonicalSnap)) {
            matched = presetName;
            break;
        }
    }

    gSettingsDraftRuleConfig.presetName = matched;
}

function syncPresetCouplingStateAfterFieldEdit(editedField) {
    if (editedField === 'presetName') return;
    if (gMainPresetSyncGuard) return;

    syncScoringPresetLabel();
    syncLevelsPresetLabel();
    syncTimingPresetLabel();
    syncMainPresetSelectionByExactMatch();
}

function createEmptyLevelsMatrixState() {
    return {
        mustDefendStartMarker: false,
        mustDefendLiteralLevels: [],
        mustStopStartMarker: false,
        mustStopLiteralLevels: [],
        knockBackLiteralLevels: [],
    };
}

function normalizeLevelArrayForMatrix(arr) {
    let list = Array.isArray(arr) ? [...arr] : [];
    return [...new Set(list.map(x => Number(x)).filter(x => Number.isInteger(x) && x >= 0 && x <= 12))].sort((a, b) => a - b);
}

function buildLevelsMatrixStateFromRuleConfig(cfg) {
    let defend = normalizeLevelArrayForMatrix(cfg && cfg.mustDefendLevels);
    let stop = normalizeLevelArrayForMatrix(cfg && cfg.mustStopLevels);
    let knock = normalizeLevelArrayForMatrix(cfg && cfg.knockBackLevels);
    let skip = normalizeLevelArrayForMatrix(cfg && cfg.skipLevels);
    return {
        mustDefendStartMarker: !!(cfg && cfg.mustDefendStartMarker),
        mustDefendLiteralLevels: defend,
        mustStopStartMarker: !!(cfg && cfg.mustStopStartMarker),
        mustStopLiteralLevels: stop,
        knockBackLiteralLevels: knock,
        skipLiteralLevels: skip,
    };
}

function ensureLevelsMatrixDraftState() {
    if (!gLevelsMatrixDraftState) {
        gLevelsMatrixDraftState = buildLevelsMatrixStateFromRuleConfig(gSettingsDraftRuleConfig || {});
    }
}

function levelsMatrixStateToRuleArrays() {
    ensureLevelsMatrixDraftState();

    let defend = normalizeLevelArrayForMatrix(gLevelsMatrixDraftState.mustDefendLiteralLevels);
    let stop = normalizeLevelArrayForMatrix(gLevelsMatrixDraftState.mustStopLiteralLevels);
    let skip = normalizeLevelArrayForMatrix(gLevelsMatrixDraftState.skipLiteralLevels);
    if (skip.length >= 13) {
        skip = skip.filter(x => x !== 0);
    }

    // Conflict on literal ranks
    let defendLiteralSet = new Set(normalizeLevelArrayForMatrix(gLevelsMatrixDraftState.mustDefendLiteralLevels));
    stop = stop.filter(x => !defendLiteralSet.has(x));

    // Remove skip levels from other level sets (already handled in UI, but ensure consistency)
    let skipSet = new Set(skip);
    defend = defend.filter(x => !skipSet.has(x));
    stop = stop.filter(x => !skipSet.has(x));
    let knock = normalizeLevelArrayForMatrix(gLevelsMatrixDraftState.knockBackLiteralLevels).filter(x => !skipSet.has(x));

    return {
        mustDefendLevels: [...new Set(defend)].sort((a, b) => a - b),
        mustStopLevels: [...new Set(stop)].sort((a, b) => a - b),
        knockBackLevels: knock,
        skipLevels: skip,
        mustDefendStartMarker: !!gLevelsMatrixDraftState.mustDefendStartMarker,
        mustStopStartMarker: !!gLevelsMatrixDraftState.mustStopStartMarker,
    };
}

function applyLevelsMatrixStateToRuleConfig() {
    if (!gSettingsDraftRuleConfig) return;
    let mapped = levelsMatrixStateToRuleArrays();
    gSettingsDraftRuleConfig.mustDefendLevels = mapped.mustDefendLevels;
    gSettingsDraftRuleConfig.mustStopLevels = mapped.mustStopLevels;
    gSettingsDraftRuleConfig.knockBackLevels = mapped.knockBackLevels;
    gSettingsDraftRuleConfig.skipLevels = mapped.skipLevels;
    gSettingsDraftRuleConfig.mustDefendStartMarker = mapped.mustDefendStartMarker;
    gSettingsDraftRuleConfig.mustStopStartMarker = mapped.mustStopStartMarker;

    let skipSet = new Set(mapped.skipLevels);
    let relocated = relocateStartLevelAgainstSkip(gSettingsDraftRuleConfig.startLevel, skipSet);
    gSettingsDraftRuleConfig.startLevel = relocated;
}

function resetLevelsMatrixStateFromRuleConfig() {
    gLevelsMatrixDraftState = buildLevelsMatrixStateFromRuleConfig(gSettingsDraftRuleConfig || {});
}

function setRuleConfigFieldValue(field, rawValue) {
    try {
        if (field === 'presetName') {
            if (rawValue === 'custom' || rawValue === '') {
                gSettingsDraftRuleConfig = cloneRuleConfig(gSettingsDraftRuleConfig || {});
                // custom is a non-matching state — does not apply any preset bundle.
                gSettingsDraftRuleConfig.presetName = 'custom';
                // Keep scoring sub-preset selector consistent with actual scoring fields.
                syncScoringPresetLabel();
                return;
            }
            if (typeof shengjiResolveGameRuleConfig === 'function' && window.shengjiSettingsPresets && window.shengjiSettingsPresets[rawValue]) {
                gMainPresetSyncGuard = true;
                let previousTiming = {
                    timingMode: gSettingsDraftRuleConfig && gSettingsDraftRuleConfig.timingMode,
                    timingPreset: gSettingsDraftRuleConfig && gSettingsDraftRuleConfig.timingPreset,
                    timing: { ...((gSettingsDraftRuleConfig && gSettingsDraftRuleConfig.timing) || {}) },
                };
                gSettingsDraftRuleConfig = cloneRuleConfig(shengjiResolveGameRuleConfig({ presetName: rawValue }));
                gSettingsDraftRuleConfig.timingMode = previousTiming.timingMode;
                gSettingsDraftRuleConfig.timingPreset = previousTiming.timingPreset;
                gSettingsDraftRuleConfig.timing = { ...previousTiming.timing };
                // Recompute scoring sub-preset by exact scoring-bundle match, rather than keeping a stale preset string.
                syncScoringPresetLabel();
                resetLevelsMatrixStateFromRuleConfig();
                gMainPresetSyncGuard = false;
            } else {
                gSettingsDraftRuleConfig = cloneRuleConfig(gSettingsDraftRuleConfig || {});
                gSettingsDraftRuleConfig.presetName = String(rawValue);
            }
            return;
        }

        if (field === 'scoringPreset') {
            gSettingsDraftRuleConfig[field] = rawValue;
            let scoringPresets = window.shengjiScoringPresets;
            if (scoringPresets && scoringPresets[rawValue]) {
                let sp = scoringPresets[rawValue];
                // Apply all authoritative preset fields
                if (sp.endingCompensation !== undefined) gSettingsDraftRuleConfig.endingCompensation = sp.endingCompensation;
                if (sp.endingCompensationUnit !== undefined) gSettingsDraftRuleConfig.endingCompensationUnit = Number(sp.endingCompensationUnit);
                if (sp.stageThreshold !== undefined) gSettingsDraftRuleConfig.stageThreshold = sp.stageThreshold;
                if (sp.levelThreshold !== undefined) gSettingsDraftRuleConfig.levelThreshold = sp.levelThreshold;
                if (sp.levelUpLimitPerFrame !== undefined) gSettingsDraftRuleConfig.levelUpLimitPerFrame = sp.levelUpLimitPerFrame;
                if (sp.baseMultiplierScheme !== undefined) gSettingsDraftRuleConfig.baseMultiplierScheme = sp.baseMultiplierScheme;
            }
            // If '' was chosen, keep the current individual fields unchanged (intentional custom state).
            return;
        }

        if (field === 'levelsPreset') {
            gSettingsDraftRuleConfig[field] = rawValue;
            let levelsPresets = window.shengjiLevelsPresets;
            if (levelsPresets && levelsPresets[rawValue]) {
                let lp = levelsPresets[rawValue];
                // Apply all authoritative preset fields
                if (lp.startLevel !== undefined) gSettingsDraftRuleConfig.startLevel = lp.startLevel;
                if (lp.mustDefendStartMarker !== undefined) gSettingsDraftRuleConfig.mustDefendStartMarker = !!lp.mustDefendStartMarker;
                if (lp.mustStopStartMarker !== undefined) gSettingsDraftRuleConfig.mustStopStartMarker = !!lp.mustStopStartMarker;
                if (lp.mustDefendLevels !== undefined) gSettingsDraftRuleConfig.mustDefendLevels = Array.isArray(lp.mustDefendLevels) ? [...lp.mustDefendLevels] : [];
                if (lp.mustStopLevels !== undefined) gSettingsDraftRuleConfig.mustStopLevels = Array.isArray(lp.mustStopLevels) ? [...lp.mustStopLevels] : [];
                if (lp.knockBackLevels !== undefined) gSettingsDraftRuleConfig.knockBackLevels = Array.isArray(lp.knockBackLevels) ? [...lp.knockBackLevels] : [];
                if (lp.skipLevels !== undefined) gSettingsDraftRuleConfig.skipLevels = Array.isArray(lp.skipLevels) ? [...lp.skipLevels] : [];
                if (lp.knockBackConditionMode !== undefined) gSettingsDraftRuleConfig.knockBackConditionMode = lp.knockBackConditionMode;
                if (lp.knockBackTakeStageRequired !== undefined) gSettingsDraftRuleConfig.knockBackTakeStageRequired = !!lp.knockBackTakeStageRequired;
                if (lp.nonSingleKnockBackTwoSteps !== undefined) gSettingsDraftRuleConfig.nonSingleKnockBackTwoSteps = !!lp.nonSingleKnockBackTwoSteps;
                if (lp.gameMode !== undefined) gSettingsDraftRuleConfig.gameMode = lp.gameMode;
                resetLevelsMatrixStateFromRuleConfig();
            }
            // If '' was chosen, keep the current individual fields unchanged (intentional custom state).
            return;
        }

        if (field === 'timingPreset') {
            gSettingsDraftRuleConfig[field] = rawValue;
            let timingPresets = window.shengjiTimingPresets;
            if (timingPresets && timingPresets[rawValue]) {
                let tp = timingPresets[rawValue];
                if (tp.timingMode !== undefined) gSettingsDraftRuleConfig.timingMode = tp.timingMode;
                if (tp.playShotClock !== undefined) gSettingsDraftRuleConfig.timing.playShotClock = Number(tp.playShotClock);
                if (tp.baseShotClock !== undefined) gSettingsDraftRuleConfig.timing.baseShotClock = Number(tp.baseShotClock);
                if (tp.bankTime !== undefined) gSettingsDraftRuleConfig.timing.bankTime = Number(tp.bankTime);
                if (tp.baseTimeIncrement !== undefined) gSettingsDraftRuleConfig.timing.baseTimeIncrement = Number(tp.baseTimeIncrement);
            }
            return;
        }

        if (field === 'timingMode') {
            gSettingsDraftRuleConfig.timingMode = rawValue;
            syncTimingPresetLabel();
            return;
        }

        if (field === 'failedMultiplayHandling') {
            gSettingsDraftRuleConfig.failedMultiplayHandling = rawValue;
            gSettingsDraftRuleConfig.multiplayCompensation = (
                rawValue === 'compensation'
                || rawValue === 'lian-zhong-compensation'
            );
            return;
        }

        if (field === 'tableFormat') {
            gSettingsDraftRuleConfig.tableFormat = rawValue;
            return;
        }

        let value = rawValue;
        if (rawValue === 'true') value = true;
        if (rawValue === 'false') value = false;
        if (rawValue === true || rawValue === false) value = rawValue;

        if (field in (gSettingsDraftRuleConfig.timing || {})) {
            let n = Math.floor(Number(rawValue));
            let min = null;
            let max = null;
            if (field === 'playShotClock') { min = 1; max = 10; }
            if (field === 'baseShotClock') { min = 1; max = 60; }
            if (field === 'bankTime') { min = 10; max = 300; }
            if (field === 'baseTimeIncrement') { min = 1; max = 60; }

            if (!Number.isFinite(n)) {
                n = Number(gSettingsDraftRuleConfig.timing[field]);
            }
            if (!Number.isFinite(n)) n = (min !== null ? min : 0);
            if (min !== null && n < min) n = min;
            if (max !== null && n > max) n = max;

            gSettingsDraftRuleConfig.timing[field] = n;
            syncTimingPresetLabel();
            return;
        }

        if (['deckCount', 'multiplayCompensationAmount', 'endingCompensationUnit', 'stageThreshold', 'levelThreshold', 'startLevel'].includes(field)) {
            let numeric = Number(rawValue);
            if (!Number.isFinite(numeric)) {
                numeric = Number(gSettingsDraftRuleConfig[field]);
            }
            numeric = Math.floor(numeric);

            if (field === 'stageThreshold' || field === 'levelThreshold') {
                let deckCount = Number(gSettingsDraftRuleConfig.deckCount) || 2;
                let dcMax = deckCount * 100;
                let min = (field === 'stageThreshold') ? 1 : 2;
                if (!Number.isFinite(numeric)) numeric = min;
                if (numeric < min) numeric = min;
                if (numeric > dcMax) numeric = dcMax;
            }

            if (field === 'multiplayCompensationAmount') {
                if (!Number.isFinite(numeric)) numeric = 5;
                if (numeric < 1) numeric = 1;
                if (numeric > 10) numeric = 10;
            }

            if (field === 'endingCompensationUnit') {
                if (!Number.isFinite(numeric)) numeric = 2;
                if (numeric < 1) numeric = 1;
                if (numeric > 10) numeric = 10;
            }

            gSettingsDraftRuleConfig[field] = numeric;
            if (['stageThreshold', 'levelThreshold'].includes(field)) syncScoringPresetLabel();
            if (['startLevel'].includes(field)) {
                applyLevelsMatrixStateToRuleConfig();
                syncLevelsPresetLabel();
            }
            return;
        }

        if (field === 'levelUpLimitPerFrame') {
            gSettingsDraftRuleConfig[field] = (rawValue === '' || rawValue === null) ? null : Number(rawValue);
            syncScoringPresetLabel();
            return;
        }

        if (field === 'mustDefendLevels' || field === 'mustStopLevels' || field === 'knockBackLevels') {
            gSettingsDraftRuleConfig[field] = Array.isArray(rawValue) ? [...rawValue].sort((a, b) => a - b) : [];
            // Mutual exclusion with repeated bidirectional switching support.
            if (field === 'mustDefendLevels') {
                let defend = new Set(gSettingsDraftRuleConfig.mustDefendLevels || []);
                gSettingsDraftRuleConfig.mustStopLevels = (gSettingsDraftRuleConfig.mustStopLevels || []).filter(x => !defend.has(x));
            } else if (field === 'mustStopLevels') {
                let stop = new Set(gSettingsDraftRuleConfig.mustStopLevels || []);
                gSettingsDraftRuleConfig.mustDefendLevels = (gSettingsDraftRuleConfig.mustDefendLevels || []).filter(x => !stop.has(x));
            }
            resetLevelsMatrixStateFromRuleConfig();
            syncLevelsPresetLabel();
            return;
        }

        if (field === 'mustDefendStartMarker' || field === 'mustStopStartMarker') {
            gSettingsDraftRuleConfig[field] = !!rawValue;
            if (gSettingsDraftRuleConfig.mustDefendStartMarker && gSettingsDraftRuleConfig.mustStopStartMarker) {
                gSettingsDraftRuleConfig.mustStopStartMarker = false;
            }
            resetLevelsMatrixStateFromRuleConfig();
            syncLevelsPresetLabel();
            return;
        }

        if (field === 'gameMode') {
            gSettingsDraftRuleConfig.gameMode = rawValue;
            syncLevelsPresetLabel();
            return;
        }

        if (field === 'knockBackConditionMode') {
            gSettingsDraftRuleConfig.knockBackConditionMode = rawValue;
            if (rawValue === 'singleT') {
                gSettingsDraftRuleConfig.nonSingleKnockBackTwoSteps = false;
            } else if (gSettingsDraftRuleConfig.nonSingleKnockBackTwoSteps === undefined || gSettingsDraftRuleConfig.nonSingleKnockBackTwoSteps === null) {
                gSettingsDraftRuleConfig.nonSingleKnockBackTwoSteps = true;
            }
            syncLevelsPresetLabel();
            return;
        }

        if (field === 'knockBackTakeStageRequired') {
            gSettingsDraftRuleConfig.knockBackTakeStageRequired = !!rawValue;
            syncLevelsPresetLabel();
            return;
        }

        if (field === 'nonSingleKnockBackTwoSteps') {
            gSettingsDraftRuleConfig.nonSingleKnockBackTwoSteps = !!rawValue;
            syncLevelsPresetLabel();
            return;
        }

        gSettingsDraftRuleConfig[field] = value;
        if (['endingCompensation', 'baseMultiplierScheme'].includes(field)) {
            syncScoringPresetLabel();
        }
    } finally {
        if (field === 'presetName') {
            gMainPresetSyncGuard = false;
        }
        syncPresetCouplingStateAfterFieldEdit(field);
    }
}

function createLevelSingleSelector(field, currentValue, readOnly) {
    let radioGroup = document.createElement('div');
    radioGroup.className = 'settings-radio-group settings-level-selector';
    let current = Number(currentValue);
    for (let lv of LEVEL_VALUE_OPTIONS) {
        let radioLabel = document.createElement('label');
        radioLabel.className = 'settings-radio-option';
        let radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = field;
        radio.value = String(lv);
        radio.checked = (lv === current);
        radio.disabled = !!readOnly;
        if (!readOnly) {
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    setRuleConfigFieldValue(field, lv);
                    renderSettingsDialog();
                }
            });
        }
        radioLabel.appendChild(radio);
        radioLabel.appendChild(document.createTextNode(levelDisplayLabel(lv)));
        radioGroup.appendChild(radioLabel);
    }
    return radioGroup;
}

function levelMatrixSpecialLabel() {
    return getLocale && getLocale() === 'zh-CN' ? '初' : 'SL';
}

function createLevelsMatrixCell(opts) {
    let {
        rowField,
        rowType,
        levelKey,
        displayLabel,
        interactive,
        disabled,
        counterLevel,
        selected,
        readOnly,
        onClick,
    } = opts;

    let cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'levels-matrix-cell levels-matrix-cell-' + rowType;
    if (!interactive) cell.classList.add('is-spacer-cell');
    if (selected) cell.classList.add('is-selected');
    if (counterLevel) {
        cell.classList.add('is-counter-level');
    }
    cell.setAttribute('data-row-field', rowField);
    cell.setAttribute('data-level', String(levelKey));
    cell.setAttribute('aria-pressed', selected ? 'true' : 'false');
    cell.disabled = !!readOnly || !interactive || !!disabled;
    cell.textContent = displayLabel;

    if (!readOnly && interactive) {
        cell.addEventListener('click', () => {
            onClick(levelKey);
        });
    }

    return cell;
}

function relocateStartLevelAgainstSkip(startLevel, skipSet) {
    let current = Number(startLevel);
    if (!Number.isInteger(current) || current < 0 || current > 12) current = 0;
    if (!(skipSet instanceof Set) || skipSet.size === 0 || !skipSet.has(current)) return current;
    for (let offset = 1; offset < 13; offset++) {
        let candidate = (current + offset) % 13;
        if (!skipSet.has(candidate)) return candidate;
    }
    return current;
}

function isLevelsCellDisabledBySkip(rowField, levelKey) {
    if (!Number.isInteger(Number(levelKey))) return false;
    if (!gLevelsMatrixDraftState) return false;
    if (rowField === 'skipLevels') {
        return false;
    }
    let skipSet = new Set(normalizeLevelArrayForMatrix(gLevelsMatrixDraftState.skipLiteralLevels));
    return skipSet.has(Number(levelKey));
}

function levelsMatrixToggleSemantic(rowName) {
    ensureLevelsMatrixDraftState();
    if (rowName === 'mustDefendLevels') {
        gLevelsMatrixDraftState.mustDefendStartMarker = !gLevelsMatrixDraftState.mustDefendStartMarker;
        if (gLevelsMatrixDraftState.mustDefendStartMarker) {
            gLevelsMatrixDraftState.mustStopStartMarker = false;
        }
    } else if (rowName === 'mustStopLevels') {
        gLevelsMatrixDraftState.mustStopStartMarker = !gLevelsMatrixDraftState.mustStopStartMarker;
        if (gLevelsMatrixDraftState.mustStopStartMarker) {
            gLevelsMatrixDraftState.mustDefendStartMarker = false;
        }
    }
}

function levelsMatrixToggleLiteral(rowName, level) {
    ensureLevelsMatrixDraftState();
    let n = Number(level);
    if (!Number.isInteger(n) || n < 0 || n > 12) return;

    let rowKey = rowName === 'mustDefendLevels'
        ? 'mustDefendLiteralLevels'
        : rowName === 'mustStopLevels'
            ? 'mustStopLiteralLevels'
            : 'knockBackLiteralLevels';

    let current = new Set(normalizeLevelArrayForMatrix(gLevelsMatrixDraftState[rowKey]));
    if (current.has(n)) current.delete(n);
    else current.add(n);
    gLevelsMatrixDraftState[rowKey] = [...current].sort((a, b) => a - b);

    if (rowName === 'mustDefendLevels' && current.has(n)) {
        gLevelsMatrixDraftState.mustStopLiteralLevels = normalizeLevelArrayForMatrix(gLevelsMatrixDraftState.mustStopLiteralLevels).filter(x => x !== n);
    }
    if (rowName === 'mustStopLevels' && current.has(n)) {
        gLevelsMatrixDraftState.mustDefendLiteralLevels = normalizeLevelArrayForMatrix(gLevelsMatrixDraftState.mustDefendLiteralLevels).filter(x => x !== n);
    }
}

function levelsMatrixToggleLiteralWithMutualExclusion(rowName, level) {
    ensureLevelsMatrixDraftState();
    let n = Number(level);
    if (!Number.isInteger(n) || n < 0 || n > 12) return;

    let rowKey = rowName === 'skipLevels' ? 'skipLiteralLevels' : rowName;

    let current = new Set(normalizeLevelArrayForMatrix(gLevelsMatrixDraftState[rowKey]));
    let isSelecting = !current.has(n);

    if (isSelecting) {
        if (rowName === 'skipLevels') {
            // Patched all-skipped behavior:
            // accept this click, then deselect the lowest previously checked rank.
            let previousChecked = [...current].sort((a, b) => a - b);
            current.add(n);
            if (current.size >= 13 && previousChecked.length > 0) {
                current.delete(previousChecked[0]);
            }
        } else {
            current.add(n);
        }

        if (rowName === 'skipLevels') {
            // Mutual exclusion: clear same-column must-stop, must-defend, knock-back
            gLevelsMatrixDraftState.mustDefendLiteralLevels = normalizeLevelArrayForMatrix(gLevelsMatrixDraftState.mustDefendLiteralLevels).filter(x => x !== n);
            gLevelsMatrixDraftState.mustStopLiteralLevels = normalizeLevelArrayForMatrix(gLevelsMatrixDraftState.mustStopLiteralLevels).filter(x => x !== n);
            gLevelsMatrixDraftState.knockBackLiteralLevels = normalizeLevelArrayForMatrix(gLevelsMatrixDraftState.knockBackLiteralLevels).filter(x => x !== n);

            // If start level is the skipped rank, relocate it
            let startLevel = Number(getRuleConfigFieldValue('startLevel'));
            let skipSet = new Set(current);
            let relocated = relocateStartLevelAgainstSkip(startLevel, skipSet);
            if (relocated !== startLevel) {
                setRuleConfigFieldValue('startLevel', relocated);
            }
        }
    } else {
        current.delete(n);
    }

    gLevelsMatrixDraftState[rowKey] = [...current].sort((a, b) => a - b);
}

function createLevelsSpecialMatrix(readOnly) {
    let matrix = document.createElement('div');
    matrix.className = 'levels-special-matrix';

    ensureLevelsMatrixDraftState();
    let startLevel = Number(getRuleConfigFieldValue('startLevel'));

    const rows = [
        {
            field: 'startLevel',
            type: 'start',
            cells: [
                { key: LEVEL_MATRIX_KEY_SPACER, label: '', interactive: false, counterLevel: false },
                ...LEVEL_VALUE_OPTIONS.map(level => ({ key: level, label: levelDisplayLabel(level), interactive: true, counterLevel: LEVEL_MATRIX_COUNTER_LEVELS.has(level) })),
            ],
            onClick: (levelKey) => {
                if (isLevelsCellDisabledBySkip('startLevel', levelKey)) return;
                let attempted = Number(levelKey);
                let skipSet = new Set(normalizeLevelArrayForMatrix(gLevelsMatrixDraftState.skipLiteralLevels));
                let relocated = relocateStartLevelAgainstSkip(attempted, skipSet);
                setRuleConfigFieldValue('startLevel', relocated);
                renderSettingsDialog();
            },
            isSelected: (levelKey) => Number(levelKey) === startLevel,
        },
        {
            field: 'mustDefendLevels',
            type: 'must-defend',
            cells: [
                { key: LEVEL_MATRIX_KEY_START_MARKER, label: levelMatrixSpecialLabel(), interactive: true, counterLevel: false },
                ...LEVEL_VALUE_OPTIONS.map(level => ({ key: level, label: levelDisplayLabel(level), interactive: true, counterLevel: LEVEL_MATRIX_COUNTER_LEVELS.has(level) })),
            ],
            onClick: (levelKey) => {
                if (isLevelsCellDisabledBySkip('mustDefendLevels', levelKey)) return;
                if (levelKey === LEVEL_MATRIX_KEY_START_MARKER) {
                    levelsMatrixToggleSemantic('mustDefendLevels');
                } else {
                    levelsMatrixToggleLiteral('mustDefendLevels', levelKey);
                }
                applyLevelsMatrixStateToRuleConfig();
                syncPresetCouplingStateAfterFieldEdit('mustDefendLevels');
                renderSettingsDialog();
            },
            isSelected: (levelKey) => {
                if (levelKey === LEVEL_MATRIX_KEY_START_MARKER) return !!gLevelsMatrixDraftState.mustDefendStartMarker;
                return normalizeLevelArrayForMatrix(gLevelsMatrixDraftState.mustDefendLiteralLevels).includes(Number(levelKey));
            },
        },
        {
            field: 'mustStopLevels',
            type: 'must-stop',
            cells: [
                { key: LEVEL_MATRIX_KEY_START_MARKER, label: levelMatrixSpecialLabel(), interactive: true, counterLevel: false },
                ...LEVEL_VALUE_OPTIONS.map(level => ({ key: level, label: levelDisplayLabel(level), interactive: true, counterLevel: LEVEL_MATRIX_COUNTER_LEVELS.has(level) })),
            ],
            onClick: (levelKey) => {
                if (isLevelsCellDisabledBySkip('mustStopLevels', levelKey)) return;
                if (levelKey === LEVEL_MATRIX_KEY_START_MARKER) {
                    levelsMatrixToggleSemantic('mustStopLevels');
                } else {
                    levelsMatrixToggleLiteral('mustStopLevels', levelKey);
                }
                applyLevelsMatrixStateToRuleConfig();
                syncPresetCouplingStateAfterFieldEdit('mustStopLevels');
                renderSettingsDialog();
            },
            isSelected: (levelKey) => {
                if (levelKey === LEVEL_MATRIX_KEY_START_MARKER) return !!gLevelsMatrixDraftState.mustStopStartMarker;
                return normalizeLevelArrayForMatrix(gLevelsMatrixDraftState.mustStopLiteralLevels).includes(Number(levelKey));
            },
        },
        {
            field: 'knockBackLevels',
            type: 'knock-back',
            cells: [
                { key: LEVEL_MATRIX_KEY_SPACER, label: '', interactive: false, counterLevel: false },
                ...LEVEL_VALUE_OPTIONS.map(level => ({ key: level, label: levelDisplayLabel(level), interactive: true, counterLevel: LEVEL_MATRIX_COUNTER_LEVELS.has(level) })),
            ],
            onClick: (levelKey) => {
                if (isLevelsCellDisabledBySkip('knockBackLevels', levelKey)) return;
                levelsMatrixToggleLiteral('knockBackLevels', levelKey);
                applyLevelsMatrixStateToRuleConfig();
                syncPresetCouplingStateAfterFieldEdit('knockBackLevels');
                renderSettingsDialog();
            },
            isSelected: (levelKey) => {
                if (levelKey === LEVEL_MATRIX_KEY_SPACER) return false;
                return normalizeLevelArrayForMatrix(gLevelsMatrixDraftState.knockBackLiteralLevels).includes(Number(levelKey));
            },
        },
        {
            field: 'skipLevels',
            type: 'skip',
            cells: [
                { key: LEVEL_MATRIX_KEY_SPACER, label: '', interactive: false, counterLevel: false },
                ...LEVEL_VALUE_OPTIONS.map(level => ({ key: level, label: levelDisplayLabel(level), interactive: true, counterLevel: LEVEL_MATRIX_COUNTER_LEVELS.has(level) })),
            ],
            onClick: (levelKey) => {
                levelsMatrixToggleLiteralWithMutualExclusion('skipLevels', levelKey);
                applyLevelsMatrixStateToRuleConfig();
                syncPresetCouplingStateAfterFieldEdit('skipLevels');
                renderSettingsDialog();
            },
            isSelected: (levelKey) => {
                if (levelKey === LEVEL_MATRIX_KEY_SPACER) return false;
                return normalizeLevelArrayForMatrix(gLevelsMatrixDraftState.skipLiteralLevels).includes(Number(levelKey));
            },
        },
    ];

    for (let row of rows) {
        let rowEl = document.createElement('div');
        rowEl.className = 'levels-matrix-row levels-matrix-row-' + row.type;
        rowEl.setAttribute('data-matrix-row', row.field);

        let rowLabel = document.createElement('div');
        rowLabel.className = 'levels-matrix-row-label';
        rowLabel.textContent = t('settingsDialog.fields.' + row.field);
        rowEl.appendChild(rowLabel);

        let rowCells = document.createElement('div');
        rowCells.className = 'levels-matrix-row-cells';
        for (let cellDef of row.cells) {
            rowCells.appendChild(createLevelsMatrixCell({
                rowField: row.field,
                rowType: row.type,
                levelKey: cellDef.key,
                displayLabel: cellDef.label,
                interactive: !!cellDef.interactive,
                disabled: row.field !== 'skipLevels' && isLevelsCellDisabledBySkip(row.field, cellDef.key),
                counterLevel: !!cellDef.counterLevel,
                selected: row.isSelected(cellDef.key),
                readOnly,
                onClick: row.onClick,
            }));
        }
        rowEl.appendChild(rowCells);
        matrix.appendChild(rowEl);
    }

    return matrix;
}

function createLevelMultiSelector(field, currentValues, readOnly) {
    let wrap = document.createElement('div');
    wrap.className = 'settings-checkbox-group settings-level-selector';
    let selected = new Set(Array.isArray(currentValues) ? currentValues : []);
    for (let lv of LEVEL_VALUE_OPTIONS) {
        let optLabel = document.createElement('label');
        optLabel.className = 'settings-checkbox-option';
        let checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = selected.has(lv);
        checkbox.disabled = !!readOnly;
        if (!readOnly) {
            checkbox.addEventListener('change', () => {
                let next = new Set(Array.isArray(getRuleConfigFieldValue(field)) ? getRuleConfigFieldValue(field) : []);
                if (checkbox.checked) next.add(lv);
                else next.delete(lv);
                setRuleConfigFieldValue(field, [...next]);
                renderSettingsDialog();
            });
        }
        optLabel.appendChild(checkbox);
        optLabel.appendChild(document.createTextNode(levelDisplayLabel(lv)));
        wrap.appendChild(optLabel);
    }
    return wrap;
}

function createGameModeRadioSelector(currentValue, readOnly) {
    let radioGroup = document.createElement('div');
    radioGroup.className = 'settings-radio-group';
    const opts = [
        { value: 'endless', label: t('settingsDialog.options.endless') },
        { value: 'pass-A', label: t('settingsDialog.options.passA') }
    ];
    for (let opt of opts) {
        let radioLabel = document.createElement('label');
        radioLabel.className = 'settings-radio-option';
        let radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'gameMode';
        radio.value = opt.value;
        radio.checked = (opt.value === String(currentValue));
        radio.disabled = !!readOnly;
        if (!readOnly) {
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    setRuleConfigFieldValue('gameMode', opt.value);
                    renderSettingsDialog();
                }
            });
        }
        radioLabel.appendChild(radio);
        radioLabel.appendChild(document.createTextNode(opt.label));
        radioGroup.appendChild(radioLabel);
    }
    return radioGroup;
}

function createTimingModeRadioSelector(currentValue, readOnly) {
    let radioGroup = document.createElement('div');
    radioGroup.className = 'settings-radio-group';
    const opts = [
        { value: 'shot + bank', label: t('settingsDialog.options.shotPlusBank') },
        { value: 'bank-time-only', label: t('settingsDialog.options.bankTimeOnly') }
    ];
    for (let opt of opts) {
        let radioLabel = document.createElement('label');
        radioLabel.className = 'settings-radio-option';
        let radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'timingMode';
        radio.value = opt.value;
        radio.checked = (opt.value === String(currentValue));
        radio.disabled = !!readOnly;
        if (!readOnly) {
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    setRuleConfigFieldValue('timingMode', opt.value);
                    renderSettingsDialog();
                }
            });
        }
        radioLabel.appendChild(radio);
        radioLabel.appendChild(document.createTextNode(opt.label));
        radioGroup.appendChild(radioLabel);
    }
    return radioGroup;
}

function createKnockBackConditionRow(readOnly) {
    let row = document.createElement('div');
    row.className = 'levels-row levels-row-knock-back-condition';
    row.setAttribute('data-settings-field-group', 'knockBackCondition');

    let hasKnockBackLevels = Array.isArray(gSettingsDraftRuleConfig.knockBackLevels)
        && gSettingsDraftRuleConfig.knockBackLevels.length > 0;
    if (!hasKnockBackLevels) return row;

    let label = document.createElement('div');
    label.className = 'levels-row-inline-label';
    label.textContent = t('settingsDialog.fields.knockBackCondition');
    row.appendChild(label);

    let radioGroup = document.createElement('div');
    radioGroup.className = 'settings-radio-group levels-row-inline-group';

    let mode = gSettingsDraftRuleConfig.knockBackConditionMode || 'unlimited';
    let nonSingleTwoStepValue = (gSettingsDraftRuleConfig.nonSingleKnockBackTwoSteps === undefined || gSettingsDraftRuleConfig.nonSingleKnockBackTwoSteps === null)
        ? (mode !== 'singleT')
        : !!gSettingsDraftRuleConfig.nonSingleKnockBackTwoSteps;
    const radioOptions = [
        { value: 'unlimited', text: t('settingsDialog.options.unlimited') },
        { value: 'singleT', text: t('settingsDialog.options.singleT') },
    ];

    for (let opt of radioOptions) {
        let radioLabel = document.createElement('label');
        radioLabel.className = 'settings-radio-option';
        let radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'knockBackConditionMode';
        radio.value = opt.value;
        radio.checked = mode === opt.value;
        radio.disabled = !!readOnly;
        radio.setAttribute('data-settings-field', 'knockBackConditionMode');
        if (!readOnly) {
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    setRuleConfigFieldValue('knockBackConditionMode', opt.value);
                    renderSettingsDialog();
                }
            });
        }
        radioLabel.appendChild(radio);
        radioLabel.appendChild(document.createTextNode(opt.text));
        radioGroup.appendChild(radioLabel);
    }
    row.appendChild(radioGroup);

    let checkboxWrap = document.createElement('div');
    checkboxWrap.className = 'settings-checkbox-group levels-row-inline-group';
    let checkboxLabel = document.createElement('label');
    checkboxLabel.className = 'settings-checkbox-option';
    let checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !!gSettingsDraftRuleConfig.knockBackTakeStageRequired;
    checkbox.disabled = !!readOnly;
    checkbox.setAttribute('data-settings-field', 'knockBackTakeStageRequired');
    if (!readOnly) {
        checkbox.addEventListener('change', () => {
            setRuleConfigFieldValue('knockBackTakeStageRequired', checkbox.checked);
            renderSettingsDialog();
        });
    }
    checkboxLabel.appendChild(checkbox);
    checkboxLabel.appendChild(document.createTextNode(t('settingsDialog.options.takeStageRequired')));
    checkboxWrap.appendChild(checkboxLabel);
    row.appendChild(checkboxWrap);

    let twoStepWrap = document.createElement('div');
    twoStepWrap.className = 'settings-checkbox-group levels-row-inline-group';
    let twoStepLabel = document.createElement('label');
    twoStepLabel.className = 'settings-checkbox-option';
    let twoStepCheckbox = document.createElement('input');
    twoStepCheckbox.type = 'checkbox';
    twoStepCheckbox.checked = nonSingleTwoStepValue;
    twoStepCheckbox.disabled = !!readOnly || mode === 'singleT';
    twoStepCheckbox.setAttribute('data-settings-field', 'nonSingleKnockBackTwoSteps');
    if (!readOnly && mode !== 'singleT') {
        twoStepCheckbox.addEventListener('change', () => {
            setRuleConfigFieldValue('nonSingleKnockBackTwoSteps', twoStepCheckbox.checked);
            renderSettingsDialog();
        });
    }
    twoStepLabel.appendChild(twoStepCheckbox);
    twoStepLabel.appendChild(document.createTextNode(t('settingsDialog.options.nonSingleKnockBackTwoSteps')));
    twoStepWrap.appendChild(twoStepLabel);
    row.appendChild(twoStepWrap);

    return row;
}

function createPresetRulesDropdown(currentValue, readOnly) {
    let current = (currentValue === undefined || currentValue === null || currentValue === '') ? 'custom' : String(currentValue);

    let sel = document.createElement('select');
    sel.className = 'settings-preset-rules-select';
    sel.setAttribute('data-settings-field', 'presetName');
    sel.disabled = !!readOnly;

    for (let opt of PRESET_RULE_DROPDOWN_OPTIONS) {
        let op = document.createElement('option');
        op.value = opt.value;
        op.textContent = t('settingsDialog.presetRuleLabels.' + opt.labelKey);
        // Disable options whose table-level constraints are not satisfied.
        // 'custom' has no constraints and is always selectable.
        if (opt.value !== 'custom') {
            op.disabled = !isPresetEnabled(opt.value, gSettingsDraftRuleConfig);
        }
        sel.appendChild(op);
    }

    sel.value = current;

    if (!readOnly) {
        sel.addEventListener('change', () => {
            setRuleConfigFieldValue('presetName', sel.value);
            renderSettingsDialog();
        });
    }

    return sel;
}

function createPresetRuleHint() {
    let hint = document.createElement('div');
    hint.className = 'settings-field-hint';
    let preset = (gSettingsDraftRuleConfig && gSettingsDraftRuleConfig.presetName) || 'custom';
    if (preset === '' || preset === null || preset === undefined) preset = 'custom';
    const hintKeyMap = {
        'custom': 'custom',
        'default': 'default',
        'high-school': 'highSchool',
        'Berkeley': 'berkeley',
        'experimental': 'experimental',
        'plain': 'plain',
        'short-level rotate-pivot': 'shortLevelRotatePivot',
    };
    let hintKey = hintKeyMap[preset] || 'custom';
    hint.textContent = t('settingsDialog.presetRuleHints.' + hintKey);
    return hint;
}

function createTableFormatSelector(readOnly) {
    let currentFormat = (gSettingsDraftRuleConfig && gSettingsDraftRuleConfig.tableFormat) || 'normal-4P';
    let sel = document.createElement('select');
    sel.className = 'settings-table-format-select';
    sel.setAttribute('data-settings-field', 'tableFormat');

    // normal-4P option (always available)
    let opNormal = document.createElement('option');
    opNormal.value = 'normal-4P';
    opNormal.textContent = t('settingsDialog.options.normalFourPlayer');
    sel.appendChild(opNormal);

    // three-player-dummy-ally option (placeholder in Note 62 — selectable but gameplay is blocked)
    let op3PDA = document.createElement('option');
    op3PDA.value = 'three-player-dummy-ally';
    op3PDA.textContent = t('settingsDialog.options.threePDA');
    sel.appendChild(op3PDA);

    sel.value = currentFormat;
    sel.disabled = !!readOnly;

    if (!readOnly) {
        sel.addEventListener('change', () => {
            setRuleConfigFieldValue('tableFormat', sel.value);
            renderSettingsDialog();
        });
    }

    return sel;
}

function createSettingsFieldEl(field, readOnly) {
    let wrapper = document.createElement('div');
    wrapper.className = 'settings-field';

    let label = document.createElement('label');
    label.textContent = t('settingsDialog.fields.' + field);
    wrapper.appendChild(label);

    let el;
    let currentValue = getRuleConfigFieldValue(field);

    // Checkbox fields
    if (field === 'endingCompensation' || field === 'attackersSelfBaseHalfMultiplier') {
        el = document.createElement('input');
        el.type = 'checkbox';
        el.checked = !!currentValue;
        let isDisabled = readOnly;
        if (field === 'attackersSelfBaseHalfMultiplier' && !gSettingsDraftRuleConfig.allowOverbase) {
            isDisabled = true;
        }
        el.setAttribute('data-settings-field', field);
        el.disabled = isDisabled;
        if (!readOnly && !isDisabled) {
            el.addEventListener('change', () => {
                setRuleConfigFieldValue(field, el.checked);
                renderSettingsDialog();
            });
        }
        wrapper.appendChild(el);
        return wrapper;
    }

    // Radio group for levelUpLimitPerFrame
    if (field === 'levelUpLimitPerFrame') {
        let radioGroup = document.createElement('div');
        radioGroup.className = 'settings-radio-group';
        const opts = [{ value: '', label: t('settingsDialog.options.unlimited') }, { value: '3', label: '3' }, { value: '4', label: '4' }, { value: '5', label: '5' }, { value: '6', label: '6' }];
        let currentStr = (currentValue === null || currentValue === undefined) ? '' : String(currentValue);
        for (let opt of opts) {
            let radioLabel = document.createElement('label');
            radioLabel.className = 'settings-radio-option';
            let radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'levelUpLimitPerFrame';
            radio.value = opt.value;
            radio.checked = (opt.value === currentStr);
            radio.disabled = !!readOnly;
            if (!readOnly) {
                radio.addEventListener('change', () => {
                    if (radio.checked) {
                        setRuleConfigFieldValue('levelUpLimitPerFrame', opt.value);
                        renderSettingsDialog();
                    }
                });
            }
            radioLabel.appendChild(radio);
            radioLabel.appendChild(document.createTextNode(opt.label));
            radioGroup.appendChild(radioLabel);
        }
        wrapper.appendChild(radioGroup);
        wrapper.setAttribute('data-settings-field', field);
        return wrapper;
    }

    if (field === 'startLevel') {
        wrapper.appendChild(createLevelSingleSelector(field, currentValue, readOnly));
        wrapper.setAttribute('data-settings-field', field);
        return wrapper;
    }

    if (field === 'mustDefendLevels' || field === 'mustStopLevels' || field === 'knockBackLevels') {
        wrapper.appendChild(createLevelMultiSelector(field, currentValue, readOnly));
        wrapper.setAttribute('data-settings-field', field);
        return wrapper;
    }

    if (field === 'gameMode') {
        wrapper.appendChild(createGameModeRadioSelector(currentValue, readOnly));
        wrapper.setAttribute('data-settings-field', field);
        return wrapper;
    }

    if (field === 'timingMode') {
        wrapper.appendChild(createTimingModeRadioSelector(currentValue, readOnly));
        wrapper.setAttribute('data-settings-field', field);
        return wrapper;
    }

    if (field === 'presetName') {
        wrapper.appendChild(createPresetRulesDropdown(currentValue, readOnly));
        wrapper.setAttribute('data-settings-field', field);
        return wrapper;
    }

    let optionsProvider = SETTINGS_SELECT_OPTIONS[field];

    if (optionsProvider) {
        el = document.createElement('select');
        let options = (typeof optionsProvider === 'function') ? optionsProvider() : optionsProvider;
        for (let opt of options) {
            let op = document.createElement('option');
            op.value = String(opt);
            op.textContent = settingsOptionLabel(opt);
            el.appendChild(op);
        }
        let target = (currentValue === Infinity) ? 'Infinity' : String(currentValue);
        el.value = target;
    } else {
        el = document.createElement('input');
        el.type = 'number';
        if (field === 'stageThreshold') {
            el.min = '1';
            el.step = '1';
        }
        if (field === 'levelThreshold') {
            el.min = '2';
            el.step = '1';
        }
        if (field === 'playShotClock') {
            el.min = '1';
            el.max = '10';
            el.step = '1';
        }
        if (field === 'baseShotClock') {
            el.min = '1';
            el.max = '60';
            el.step = '1';
        }
        if (field === 'bankTime') {
            el.min = '10';
            el.max = '300';
            el.step = '1';
        }
        if (field === 'baseTimeIncrement') {
            el.min = '1';
            el.max = '60';
            el.step = '1';
        }
        if (field === 'endingCompensationUnit') {
            el.min = '1';
            el.max = '10';
            el.step = '1';
        }
        if (currentValue !== null && currentValue !== undefined && currentValue !== Infinity) {
            el.value = String(currentValue);
        }
    }

    el.setAttribute('data-settings-field', field);
    wrapper.setAttribute('data-settings-field', field);
    el.disabled = !!readOnly;
    if (!readOnly) {
        el.addEventListener('change', () => {
            setRuleConfigFieldValue(field, el.value);
            renderSettingsDialog();
        });
    }

    wrapper.appendChild(el);
    return wrapper;
}

function createScoringPresetHint() {
    let hint = document.createElement('div');
    hint.className = 'settings-field-hint';
    let st = gSettingsDraftRuleConfig.stageThreshold;
    let lt = gSettingsDraftRuleConfig.levelThreshold;
    let lim = gSettingsDraftRuleConfig.levelUpLimitPerFrame;
    let limText = (lim === null || lim === undefined) ? t('settingsDialog.options.unlimited') : String(lim);
    hint.textContent = t('settingsDialog.scoringPresetHint', { stage: st, level: lt, limit: limText });
    return hint;
}

function createBaseMultiplierSchemeHint() {
    let scheme = gSettingsDraftRuleConfig.baseMultiplierScheme || 'limited';
    // Map scheme value to the i18n key used in baseMultiplierSchemeHints
    const schemeKeyMap = { 'limited': 'limited', 'single-or-not': 'singleOrNot', 'exponential': 'exponential', 'power': 'power' };
    let hintKey = schemeKeyMap[scheme] || 'limited';
    let hintText = t('settingsDialog.baseMultiplierSchemeHints.' + hintKey);
    let hint = document.createElement('div');
    hint.className = 'settings-field-hint';
    hint.textContent = hintText;
    return hint;
}

function createLevelsPresetHint() {
    let hint = document.createElement('div');
    hint.className = 'settings-field-hint';
    let cfg = gSettingsDraftRuleConfig || {};
    let toLabels = function(arr) {
        if (!Array.isArray(arr) || arr.length === 0) return t('settingsDialog.options.none');
        return arr.map(levelDisplayLabel).join(', ');
    };
    hint.textContent = t('settingsDialog.levelsPresetHint', {
        start: levelDisplayLabel(cfg.startLevel),
        defend: toLabels(cfg.mustDefendLevels),
        stop: toLabels(cfg.mustStopLevels),
        knockBack: toLabels(cfg.knockBackLevels)
    });
    return hint;
}

function createGameModeHint() {
    let hint = document.createElement('div');
    hint.className = 'settings-field-hint';
    let mode = gSettingsDraftRuleConfig && gSettingsDraftRuleConfig.gameMode ? gSettingsDraftRuleConfig.gameMode : 'endless';
    let key = (mode === 'pass-A') ? 'passA' : 'endless';
    hint.textContent = t('settingsDialog.gameModeHints.' + key);
    return hint;
}

function createTimingPresetHint() {
    let hint = document.createElement('div');
    hint.className = 'settings-field-hint';
    let preset = gSettingsDraftRuleConfig && gSettingsDraftRuleConfig.timingPreset ? gSettingsDraftRuleConfig.timingPreset : '';
    if (preset === 'normal') {
        hint.textContent = t('settingsDialog.timingPresetHints.normal');
    } else if (preset === '180+30') {
        hint.textContent = t('settingsDialog.timingPresetHints.timing180Plus30');
    } else {
        hint.textContent = t('settingsDialog.timingPresetHints.custom');
    }
    return hint;
}

function createGeneralAutoStrainSelector(currentValue, readOnly) {
    let radioGroup = document.createElement('div');
    radioGroup.className = 'settings-radio-group';
    const opts = [
        { value: 'false', label: t('settingsDialog.options.nts'), disabled: false },
        { value: 'true', label: t('settingsDialog.options.thirdInitBase'), disabled: false }
    ];
    let current = String(!!currentValue);
    for (let opt of opts) {
        let radioLabel = document.createElement('label');
        radioLabel.className = 'settings-radio-option';
        let radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'autoStrain';
        radio.value = opt.value;
        radio.checked = (opt.value === current);
        radio.disabled = !!readOnly || !!opt.disabled;
        if (opt.disabled) radioLabel.classList.add('is-option-disabled');
        if (!readOnly && !opt.disabled) {
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    setRuleConfigFieldValue('autoStrain', radio.value);
                    renderSettingsDialog();
                }
            });
        }
        radioLabel.appendChild(radio);
        radioLabel.appendChild(document.createTextNode(opt.label));
        radioGroup.appendChild(radioLabel);
    }
    return radioGroup;
}

function createPivotPassModeRadioSelector(currentValue, readOnly) {
    let radioGroup = document.createElement('div');
    radioGroup.className = 'settings-radio-group';
    const opts = [
        { value: 'winner-pivot', label: t('settingsDialog.options.winnerPivot') },
        { value: 'rotate-pivot', label: t('settingsDialog.options.rotatePivot') },
    ];
    let current = String(currentValue || 'winner-pivot');
    for (let opt of opts) {
        let radioLabel = document.createElement('label');
        radioLabel.className = 'settings-radio-option';
        let radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'pivotPassMode';
        radio.value = opt.value;
        radio.checked = (opt.value === current);
        radio.disabled = !!readOnly;
        if (!readOnly) {
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    setRuleConfigFieldValue('pivotPassMode', opt.value);
                    renderSettingsDialog();
                }
            });
        }
        radioLabel.appendChild(radio);
        radioLabel.appendChild(document.createTextNode(opt.label));
        radioGroup.appendChild(radioLabel);
    }
    return radioGroup;
}

function createGeneralHint(text, extraClass = '') {
    let hint = document.createElement('div');
    hint.className = 'settings-field-hint';
    if (extraClass) hint.classList.add(extraClass);
    hint.textContent = text;
    return hint;
}

function renderGeneralTabBody(container, readOnly) {
    let rows = document.createElement('div');
    rows.className = 'general-tab-rows';

    // Row 1: auto strain radios + hint.
    let row1 = document.createElement('div');
    row1.className = 'general-row';
    let autoField = document.createElement('div');
    autoField.className = 'settings-field';
    autoField.setAttribute('data-settings-field', 'autoStrain');
    let autoLabel = document.createElement('label');
    autoLabel.textContent = t('settingsDialog.fields.autoStrain');
    autoField.appendChild(autoLabel);
    autoField.appendChild(createGeneralAutoStrainSelector(getRuleConfigFieldValue('autoStrain'), readOnly));
    row1.appendChild(autoField);
    row1.appendChild(createGeneralHint(t('settingsDialog.generalHints.autoStrain'), 'general-hint-auto-strain'));
    rows.appendChild(row1);

    // Row 2: overbase + conditional restriction + conditional attackers-self-base-half + conditional hint.
    let row2 = document.createElement('div');
    row2.className = 'general-row';

    let overbaseField = document.createElement('div');
    overbaseField.className = 'settings-field';
    overbaseField.setAttribute('data-settings-field', 'allowOverbase');
    let overbaseLabel = document.createElement('label');
    overbaseLabel.textContent = t('settingsDialog.fields.allowOverbase');
    let overbaseInput = document.createElement('input');
    overbaseInput.type = 'checkbox';
    overbaseInput.checked = !!getRuleConfigFieldValue('allowOverbase');
    overbaseInput.disabled = !!readOnly;
    overbaseInput.setAttribute('data-settings-field', 'allowOverbase');
    if (!readOnly) {
        overbaseInput.addEventListener('change', () => {
            setRuleConfigFieldValue('allowOverbase', overbaseInput.checked);
            if (!overbaseInput.checked) {
                setRuleConfigFieldValue('overbaseRestrictions', 'none');
            }
            renderSettingsDialog();
        });
    }
    overbaseField.appendChild(overbaseLabel);
    overbaseField.appendChild(overbaseInput);
    row2.appendChild(overbaseField);

    let showRestriction = !!getRuleConfigFieldValue('allowOverbase');
    let restrictionChecked = String(getRuleConfigFieldValue('overbaseRestrictions')) === 'default';
    if (showRestriction) {
        let restrictionField = document.createElement('div');
        restrictionField.className = 'settings-field';
        restrictionField.setAttribute('data-settings-field', 'overbaseRestrictions');
        let restrictionLabel = document.createElement('label');
        restrictionLabel.textContent = t('settingsDialog.fields.overbaseRestrictions');
        let restrictionInput = document.createElement('input');
        restrictionInput.type = 'checkbox';
        restrictionInput.checked = restrictionChecked;
        restrictionInput.disabled = !!readOnly;
        restrictionInput.setAttribute('data-settings-field', 'overbaseRestrictions');
        if (!readOnly) {
            restrictionInput.addEventListener('change', () => {
                setRuleConfigFieldValue('overbaseRestrictions', restrictionInput.checked ? 'default' : 'none');
                renderSettingsDialog();
            });
        }
        restrictionField.appendChild(restrictionLabel);
        restrictionField.appendChild(restrictionInput);
        row2.appendChild(restrictionField);

        let attackersHalfField = document.createElement('div');
        attackersHalfField.className = 'settings-field';
        attackersHalfField.setAttribute('data-settings-field', 'attackersSelfBaseHalfMultiplier');
        let attackersHalfLabel = document.createElement('label');
        attackersHalfLabel.textContent = t('settingsDialog.fields.attackersSelfBaseHalfMultiplier');
        let attackersHalfInput = document.createElement('input');
        attackersHalfInput.type = 'checkbox';
        attackersHalfInput.checked = !!getRuleConfigFieldValue('attackersSelfBaseHalfMultiplier');
        attackersHalfInput.disabled = !!readOnly;
        attackersHalfInput.setAttribute('data-settings-field', 'attackersSelfBaseHalfMultiplier');
        if (!readOnly) {
            attackersHalfInput.addEventListener('change', () => {
                setRuleConfigFieldValue('attackersSelfBaseHalfMultiplier', attackersHalfInput.checked);
                renderSettingsDialog();
            });
        }
        attackersHalfField.appendChild(attackersHalfLabel);
        attackersHalfField.appendChild(attackersHalfInput);
        row2.appendChild(attackersHalfField);

        if (restrictionChecked) {
            row2.appendChild(createGeneralHint(t('settingsDialog.generalHints.overbaseRestriction'), 'general-hint-overbase-restriction'));
        }
    }
    rows.appendChild(row2);

    // Row 3: crossing + hint.
    let row3 = document.createElement('div');
    row3.className = 'general-row';
    let crossingField = document.createElement('div');
    crossingField.className = 'settings-field';
    crossingField.setAttribute('data-settings-field', 'allowCrossings');
    let crossingLabel = document.createElement('label');
    crossingLabel.textContent = t('settingsDialog.fields.allowCrossings');
    let crossingInput = document.createElement('input');
    crossingInput.type = 'checkbox';
    crossingInput.checked = !!getRuleConfigFieldValue('allowCrossings');
    crossingInput.disabled = !!readOnly;
    crossingInput.setAttribute('data-settings-field', 'allowCrossings');
    if (!readOnly) {
        crossingInput.addEventListener('change', () => {
            setRuleConfigFieldValue('allowCrossings', crossingInput.checked);
            renderSettingsDialog();
        });
    }
    crossingField.appendChild(crossingLabel);
    crossingField.appendChild(crossingInput);
    row3.appendChild(crossingField);
    row3.appendChild(createGeneralHint(t('settingsDialog.generalHints.crossing'), 'general-hint-crossing'));
    rows.appendChild(row3);

    // Row 4: failed multiplay + conditional compensation amount + hint.
    let row4 = document.createElement('div');
    row4.className = 'general-row';

    let failedField = document.createElement('div');
    failedField.className = 'settings-field';
    failedField.setAttribute('data-settings-field', 'failedMultiplayHandling');
    let failedLabel = document.createElement('label');
    failedLabel.textContent = t('settingsDialog.fields.failedMultiplayHandling');
    let failedSelect = document.createElement('select');
    failedSelect.setAttribute('data-settings-field', 'failedMultiplayHandling');
    const failOptions = [
        { value: 'default', key: 'failedMultiplayNormal' },
        { value: 'compensation', key: 'failedMultiplayCompensation' },
        { value: 'lian-zhong-compensation', key: 'failedMultiplayLianZhongCompensation' },
    ];
    for (let opt of failOptions) {
        let op = document.createElement('option');
        op.value = opt.value;
        op.textContent = t('settingsDialog.options.' + opt.key);
        failedSelect.appendChild(op);
    }
    failedSelect.value = String(getRuleConfigFieldValue('failedMultiplayHandling') || 'default');
    failedSelect.disabled = !!readOnly;
    if (!readOnly) {
        failedSelect.addEventListener('change', () => {
            setRuleConfigFieldValue('failedMultiplayHandling', failedSelect.value);
            renderSettingsDialog();
        });
    }
    failedField.appendChild(failedLabel);
    failedField.appendChild(failedSelect);
    row4.appendChild(failedField);

    let showComp = (String(getRuleConfigFieldValue('failedMultiplayHandling') || 'default') === 'compensation');
    if (showComp) {
        let compField = document.createElement('div');
        compField.className = 'settings-field';
        compField.setAttribute('data-settings-field', 'multiplayCompensationAmount');
        let compLabel = document.createElement('label');
        compLabel.textContent = t('settingsDialog.fields.multiplayCompensationAmount');
        let compInput = document.createElement('input');
        compInput.type = 'number';
        compInput.min = '1';
        compInput.max = '10';
        compInput.step = '1';
        compInput.value = String(getRuleConfigFieldValue('multiplayCompensationAmount'));
        compInput.disabled = !!readOnly;
        compInput.setAttribute('data-settings-field', 'multiplayCompensationAmount');
        if (!readOnly) {
            compInput.addEventListener('change', () => {
                setRuleConfigFieldValue('multiplayCompensationAmount', compInput.value);
                renderSettingsDialog();
            });
        }
        compField.appendChild(compLabel);
        compField.appendChild(compInput);
        row4.appendChild(compField);
        row4.appendChild(createGeneralHint(t('settingsDialog.generalHints.multiplayCompensationAmount'), 'general-hint-multiplay-compensation'));
    }

    rows.appendChild(row4);

    container.appendChild(rows);
}

function renderScoringTabBody(container, readOnly) {
    let rows = document.createElement('div');
    rows.className = 'scoring-tab-rows';

    // Row 1: scoring preset + hint (right neighbor)
    let row1 = document.createElement('div');
    row1.className = 'scoring-row';
    row1.appendChild(createSettingsFieldEl('scoringPreset', readOnly));
    row1.appendChild(createScoringPresetHint());
    rows.appendChild(row1);

    // Row 2: ending compensation
    let row2 = document.createElement('div');
    row2.className = 'scoring-row';
    row2.appendChild(createSettingsFieldEl('endingCompensation', readOnly));
    if (!!getRuleConfigFieldValue('endingCompensation')) {
        row2.appendChild(createSettingsFieldEl('endingCompensationUnit', readOnly));
    }
    rows.appendChild(row2);

    // Row 3: stage threshold + level threshold + level-up limit (all in one row)
    let row3 = document.createElement('div');
    row3.className = 'scoring-row';
    row3.appendChild(createSettingsFieldEl('stageThreshold', readOnly));
    row3.appendChild(createSettingsFieldEl('levelThreshold', readOnly));
    row3.appendChild(createSettingsFieldEl('levelUpLimitPerFrame', readOnly));
    rows.appendChild(row3);

    // Row 4: base multiplier scheme + hint (right neighbor)
    let row4 = document.createElement('div');
    row4.className = 'scoring-row';
    row4.appendChild(createSettingsFieldEl('baseMultiplierScheme', readOnly));
    row4.appendChild(createBaseMultiplierSchemeHint());
    rows.appendChild(row4);

    container.appendChild(rows);
}

function renderLevelsTabBody(container, readOnly) {
    let rows = document.createElement('div');
    rows.className = 'levels-tab-rows';

    // Row 1: levels preset
    let row1 = document.createElement('div');
    row1.className = 'levels-row';
    row1.appendChild(createSettingsFieldEl('levelsPreset', readOnly));
    row1.appendChild(createLevelsPresetHint());
    rows.appendChild(row1);

    // Row 2: special matrix for start / must-defend / must-stop / knock-back
    let row2 = document.createElement('div');
    row2.className = 'levels-row levels-row-matrix';
    row2.appendChild(createLevelsSpecialMatrix(readOnly));
    rows.appendChild(row2);

    // Row 3: knock-back condition (visible only when knock-back levels is non-empty)
    let row3 = createKnockBackConditionRow(readOnly);
    if (row3.childElementCount > 0) rows.appendChild(row3);

    // Row 4: game mode + hint
    let row4 = document.createElement('div');
    row4.className = 'levels-row';
    row4.appendChild(createSettingsFieldEl('gameMode', readOnly));
    row4.appendChild(createGameModeHint());
    rows.appendChild(row4);

    container.appendChild(rows);
}

function renderTimingTabBody(container, readOnly) {
    let rows = document.createElement('div');
    rows.className = 'timing-tab-rows';

    // Row 1: timing preset + right hint.
    let row1 = document.createElement('div');
    row1.className = 'timing-row';
    row1.appendChild(createSettingsFieldEl('timingPreset', readOnly));
    row1.appendChild(createTimingPresetHint());
    rows.appendChild(row1);

    // Row 2: timing mode radios.
    let row2 = document.createElement('div');
    row2.className = 'timing-row';
    row2.appendChild(createSettingsFieldEl('timingMode', readOnly));
    rows.appendChild(row2);

    // Row 3: numeric fields in one row with mode-based visibility.
    let row3 = document.createElement('div');
    row3.className = 'timing-row timing-row-numbers';
    let mode = gSettingsDraftRuleConfig && gSettingsDraftRuleConfig.timingMode
        ? gSettingsDraftRuleConfig.timingMode
        : 'shot + bank';

    if (mode === 'shot + bank') {
        row3.appendChild(createSettingsFieldEl('playShotClock', readOnly));
        row3.appendChild(createSettingsFieldEl('baseShotClock', readOnly));
        row3.appendChild(createSettingsFieldEl('bankTime', readOnly));
    } else {
        row3.appendChild(createSettingsFieldEl('bankTime', readOnly));
        row3.appendChild(createSettingsFieldEl('baseTimeIncrement', readOnly));
    }
    rows.appendChild(row3);

    container.appendChild(rows);
}

// ---------------------------------------------------------------------------
// Note 65 — 3PDA non-playable frame preview panel
// Renders inside the settings Table tab when 3PDA is selected.
// All state is local UI draft; no live game state is created or mutated.
// ---------------------------------------------------------------------------

/**
 * Helper: return the i18n label for a 3PDA frame actor (N/Sw/Se/Ay).
 */
function get3PDAActorLabel(actorId) {
    if (actorId === 'Ay') return t('dummyRoles.Ay');
    return t('naturalPositions3PDA.' + actorId);
}

/**
 * Render the 3PDA non-playable frame preview panel into container.
 * Called from renderTableTabBody when tableFormat === 'three-player-dummy-ally'.
 * Reads/writes g3PDAPreviewPivot and g3PDAPreviewReference (local draft state).
 */
function render3PDAPreviewPanel(container) {
    let panel = document.createElement('div');
    panel.className = 'pda3-preview-panel';
    panel.id = 'pda3-preview-panel';

    // Title
    let title = document.createElement('div');
    title.className = 'pda3-preview-title';
    title.textContent = t('settingsDialog.threePDAPreview.title');
    panel.appendChild(title);

    // Not-playable notice
    let notice = document.createElement('div');
    notice.className = 'pda3-preview-notice';
    notice.textContent = t('settingsDialog.threePDAPreview.notPlayable');
    panel.appendChild(notice);

    // Pivot selector
    let pivotRow = document.createElement('div');
    pivotRow.className = 'pda3-preview-row';
    let pivotLbl = document.createElement('label');
    pivotLbl.className = 'pda3-preview-label';
    pivotLbl.textContent = t('settingsDialog.threePDAPreview.pivotSelector') + ':';
    let pivotSel = document.createElement('select');
    pivotSel.className = 'pda3-preview-select';
    pivotSel.id = 'pda3-pivot-select';
    for (let p of THREE_PDA_REAL_NATURAL_POSITIONS) {
        let op = document.createElement('option');
        op.value = p;
        op.textContent = get3PDAActorLabel(p);
        pivotSel.appendChild(op);
    }
    pivotSel.value = g3PDAPreviewPivot;
    pivotSel.addEventListener('change', () => {
        g3PDAPreviewPivot = pivotSel.value;
        // Reset reference to successor of new pivot to keep the example meaningful
        let frame = create3PDAFrameModel(g3PDAPreviewPivot);
        g3PDAPreviewReference = frame.roleToActor.successor;
        // Re-render: just rebuild the panel content
        let existing = document.getElementById('pda3-preview-panel');
        if (existing && existing.parentNode) {
            let parent = existing.parentNode;
            let newPanel = document.createElement('div');
            render3PDAPreviewPanel(newPanel);
            parent.replaceChild(newPanel.firstChild, existing);
        }
    });
    pivotRow.appendChild(pivotLbl);
    pivotRow.appendChild(pivotSel);
    panel.appendChild(pivotRow);

    // Build frame model from accepted helper (no live state)
    let frame = create3PDAFrameModel(g3PDAPreviewPivot);

    // Frame roles table
    let rolesTable = document.createElement('table');
    rolesTable.className = 'pda3-preview-table';
    let roleNames = ['pivot', 'successor', 'ally', 'predecessor'];
    for (let role of roleNames) {
        let actorId = frame.roleToActor[role];
        let tr = document.createElement('tr');
        let tdRole = document.createElement('td');
        tdRole.className = 'pda3-preview-role';
        tdRole.textContent = t('frameRoles.' + role);
        let tdActor = document.createElement('td');
        tdActor.className = 'pda3-preview-actor';
        tdActor.textContent = get3PDAActorLabel(actorId);
        tr.appendChild(tdRole);
        tr.appendChild(tdActor);
        rolesTable.appendChild(tr);
    }
    panel.appendChild(rolesTable);

    // Action cycle
    let cycleRow = document.createElement('div');
    cycleRow.className = 'pda3-preview-row';
    let cycleLbl = document.createElement('span');
    cycleLbl.className = 'pda3-preview-label';
    cycleLbl.textContent = t('settingsDialog.threePDAPreview.actionCycle') + ':';
    let cycleVal = document.createElement('span');
    cycleVal.className = 'pda3-preview-value';
    cycleVal.textContent = frame.actionCycle.map(get3PDAActorLabel).join(' \u2192 ');
    cycleRow.appendChild(cycleLbl);
    cycleRow.appendChild(cycleVal);
    panel.appendChild(cycleRow);

    // Next pivot
    let nextPivotRow = document.createElement('div');
    nextPivotRow.className = 'pda3-preview-row';
    let nextPivotLbl = document.createElement('span');
    nextPivotLbl.className = 'pda3-preview-label';
    nextPivotLbl.textContent = t('settingsDialog.threePDAPreview.nextPivot') + ':';
    let nextPivotVal = document.createElement('span');
    nextPivotVal.className = 'pda3-preview-value';
    nextPivotVal.textContent = get3PDAActorLabel(getNext3PDAPivotNaturalPosition(g3PDAPreviewPivot));
    nextPivotRow.appendChild(nextPivotLbl);
    nextPivotRow.appendChild(nextPivotVal);
    panel.appendChild(nextPivotRow);

    // Reference selector
    let refRow = document.createElement('div');
    refRow.className = 'pda3-preview-row';
    let refLbl = document.createElement('label');
    refLbl.className = 'pda3-preview-label';
    refLbl.textContent = t('settingsDialog.threePDAPreview.referenceSelector') + ':';
    let refSel = document.createElement('select');
    refSel.className = 'pda3-preview-select';
    refSel.id = 'pda3-reference-select';
    for (let actorId of frame.actionCycle) {
        let op = document.createElement('option');
        op.value = actorId;
        op.textContent = get3PDAActorLabel(actorId);
        refSel.appendChild(op);
    }
    // Ensure reference is a valid frame actor for this pivot
    if (!frame.actorToRole[g3PDAPreviewReference]) {
        g3PDAPreviewReference = frame.roleToActor.successor;
    }
    refSel.value = g3PDAPreviewReference;
    refSel.addEventListener('change', () => {
        g3PDAPreviewReference = refSel.value;
        let existing = document.getElementById('pda3-preview-panel');
        if (existing && existing.parentNode) {
            let parent = existing.parentNode;
            let newPanel = document.createElement('div');
            render3PDAPreviewPanel(newPanel);
            parent.replaceChild(newPanel.firstChild, existing);
        }
    });
    refRow.appendChild(refLbl);
    refRow.appendChild(refSel);
    panel.appendChild(refRow);

    // Reference-position matrix for current reference selection
    let refMatTable = document.createElement('table');
    refMatTable.className = 'pda3-preview-table';
    let refPositionNames = ['reference', 'afterhand', 'opposite', 'forehand'];
    // Build actor-to-refPos map
    for (let actorId of frame.actionCycle) {
        let refPos = get3PDAReferencePositionForFrameActor(frame, actorId, g3PDAPreviewReference);
        let tr = document.createElement('tr');
        let tdActor = document.createElement('td');
        tdActor.className = 'pda3-preview-actor';
        tdActor.textContent = get3PDAActorLabel(actorId);
        let tdRefPos = document.createElement('td');
        tdRefPos.className = 'pda3-preview-refpos';
        tdRefPos.textContent = t('referencePositions.' + refPos);
        tr.appendChild(tdActor);
        tr.appendChild(tdRefPos);
        refMatTable.appendChild(tr);
    }
    panel.appendChild(refMatTable);

    container.appendChild(panel);
}

// ---------------------------------------------------------------------------
// Note 66 — 3PDA non-card live frame shell
// Creates and renders a distinct shell state separate from 4P engine/game.
// ---------------------------------------------------------------------------

/**
 * Creates a new 3PDA shell state object.
 * The shell state is entirely separate from the 4P game engine state.
 * It contains no hands, deck, base, scoring, or trick state.
 * @param {string} initialPivot - N, Sw, or Se
 * @param {string} [selectedRealSeat] - N, Sw, or Se (from user 3PDA seat selection; defaults to 'N')
 * @returns {Object} shell state (plain mutable object; not frozen)
 */
function createThreePDAShellState(initialPivot, selectedRealSeat, options) {
    normalize3PDAPivotNaturalPosition(initialPivot || 'N');
    let pivotPassingState = create3PDAPivotPassingState(initialPivot || 'N');
    let currentPivot = getCurrent3PDAPivotNaturalPosition(pivotPassingState);
    // Note 68: selected3PDARealNaturalPosition is the fixed real-game reference —
    // separate from shellReferenceActorId (debug-only) and from successor default.
    let realSeat = normalize3PDARealNaturalPosition(selectedRealSeat);
    // Note 96/97: create deal-instance descriptor — owns seed/policy for this scaffold deal/frame.
    // Default: generated-local policy (Note 97 — new 3PDA game gets a generated seed).
    // Tests/dev may pass options.seedPolicy='fixed-debug' or 'explicit-test'.
    let dealInstance = create3PDADealInstance({
        seedPolicy:       (options && options.seedPolicy) ? options.seedPolicy : 'generated-local',
        seed:             (options && options.seed != null) ? options.seed : undefined,
        frameIndex:       1,
        pivotActorId:     currentPivot,
        referenceActorId: realSeat,
    });
    let diValidation = validate3PDADealInstance(dealInstance);
    if (!diValidation.valid) {
        throw new Error('Note 96: deal instance invalid at shell creation: ' + (diValidation.errors || []).join(', '));
    }
    // Note 80: create metadata-bearing empty cardState then activate into manifest-ID zone arrays.
    // Result: zones.*.cards = [manifestCardId, ...], containsLiveCards=true,
    // liveCardPayloadKind='manifest-id', activationStatus='manifest-ids-in-zones'.
    // Manifest IDs only — no card objects, no rendering, no phase change.
    let cardZonePlan = create3PDACardZonePlan({ deckCount: 2 });
    // Note 96: seed comes from dealInstance, not hard-coded global directly.
    let metadataCardState = create3PDAMetadataBearingEmptyCardState(cardZonePlan, { seed: dealInstance.seed });
    let cardState = activate3PDADealPlanMetadataIntoCardState(metadataCardState);
    // Note 96: attach lightweight deal-instance metadata to cardState for diagnostics/validation.
    // No raw seed exposed (seedPolicy + dealInstanceId only); no card IDs.
    cardState = Object.assign({}, cardState, {
        dealInstanceMetadata: {
            kind:           dealInstance.kind,
            dealInstanceId: dealInstance.dealInstanceId,
            seedPolicy:     dealInstance.seedPolicy,
            frameIndex:     dealInstance.frameIndex,
        },
    });
    let csValidation = validate3PDAActivatedCardState(cardState);
    if (!csValidation.valid) {
        throw new Error('Note 80: activated cardState failed validation at shell creation: ' +
            (csValidation.errors || []).join(', '));
    }
    let shellState = {
        kind: 'three-player-dummy-ally-shell',
        tableFormat: 'three-player-dummy-ally',
        // Note 69: explicit non-card frame-start shell phase.
        // Distinct from all 4P playable phases (dealing/declaring/basing/playing/counting/paused/game-over).
        // No cards/deck/hands/scoring/qz/timers are initialized at this boundary.
        phase: 'three-pda-frame-start-shell',
        frameIndex: 1,
        pivotPassingState: pivotPassingState,
        currentPivotNaturalPosition: currentPivot,
        currentFrameModel: create3PDAFrameModel(currentPivot),
        // Note 68: fixed real-game reference — user's selected real natural seat.
        selected3PDARealNaturalPosition: realSeat,
        // Debug-only reference for diagnostic matrix in expanded panel (may be any actor incl Ay).
        shellReferenceActorId: create3PDAFrameModel(currentPivot).roleToActor.successor,
        // Note 76: empty live card-state container. containsLiveCards=false; zones all cards=null.
        cardState: cardState,
        // Note 96: deal-instance descriptor — owns seed/policy for this scaffold deal/frame.
        dealInstance: dealInstance,
        createdAt: Date.now(),
    };
    // Note 96: validate seed/cardState consistency.
    let consV = validate3PDAShellDealInstanceConsistency(shellState);
    if (!consV.valid) {
        throw new Error('Note 96: deal-instance consistency check failed: ' + (consV.errors || []).join(', '));
    }
    // Note 99: instant undealt-to-dealt lifecycle transition.
    // Synchronous — no animation, no timer, no new top-level phase.
    let dealLifecycle = create3PDAInstantScaffoldDealLifecycle(dealInstance, cardState);
    let lcV = validate3PDADealLifecycleState(dealLifecycle);
    if (!lcV.valid) {
        throw new Error('Note 99: deal lifecycle invalid at shell creation: ' + (lcV.errors || []).join(', '));
    }
    shellState.dealLifecycle = dealLifecycle;
    let lcConsV = validate3PDAShellDealLifecycleConsistency(shellState);
    if (!lcConsV.valid) {
        throw new Error('Note 99: deal lifecycle consistency check failed: ' + (lcConsV.errors || []).join(', '));
    }
    // Note 101: attach fresh unresolved qz/declaration state metadata.
    // Pure metadata — no strain/trump/declarer, no logic/UI/bot, no top-level phase.
    shellState.qzDeclarationState = create3PDAQZDeclarationState(shellState);
    let qzConsV = validate3PDAShellQZDeclarationConsistency(shellState);
    if (!qzConsV.valid) {
        throw new Error('Note 101: qz/declaration state consistency check failed: ' + (qzConsV.errors || []).join(', '));
    }
    // Note 102: attach fresh unresolved basing/bottom state metadata.
    // Pure metadata — base cards assigned but not revealed, basing actor/control null,
    // no logic/UI/bot/scoring, no top-level phase.
    shellState.basingBottomState = create3PDABasingBottomState(shellState);
    let bsConsV = validate3PDAShellBasingBottomConsistency(shellState);
    if (!bsConsV.valid) {
        throw new Error('Note 102: basing/bottom state consistency check failed: ' + (bsConsV.errors || []).join(', '));
    }
    return shellState;
}

/**
 * Advances the shell state to the next frame.
 * Mutates the shell state in place (no live game state is touched).
 * Note 68: selected3PDARealNaturalPosition is preserved unchanged across frame transitions.
 * Note 98: creates a new dealInstance and regenerates cardState at the next-frame lifecycle boundary.
 *   options.seed  — optional explicit seed for the next frame; used when seedPolicy is 'explicit-test'.
 * @param {Object} shellState
 * @param {{ seed?: string }} [options]
 */
function advanceThreePDAShellFrame(shellState, options) {
    let newPivotState = advance3PDAPivotPassingState(shellState.pivotPassingState);
    let newPivot = getCurrent3PDAPivotNaturalPosition(newPivotState);
    shellState.pivotPassingState = newPivotState;
    shellState.currentPivotNaturalPosition = newPivot;
    shellState.currentFrameModel = create3PDAFrameModel(newPivot);
    // Debug reference resets to successor each frame (frame-relative).
    shellState.shellReferenceActorId = shellState.currentFrameModel.roleToActor.successor;
    // selected3PDARealNaturalPosition is NOT reset — it is fixed by user real-seat selection.
    // Note 69: phase is NOT reset — shell next-frame is a debug frame-boundary transition, not a scoring transition.
    // phase remains 'three-pda-frame-start-shell' across all frame advances.
    shellState.frameIndex += 1;
    // Note 96/98: create new deal-instance for the advanced frame, deriving seedPolicy from the
    // existing shell's dealInstance.
    // generated-local: new generated seed each frame (via create3PDAGeneratedDealSeed inside create3PDADealInstance).
    // fixed-debug:     same fixed-debug seed each frame (deterministic).
    // explicit-test:   caller may supply options.seed for this frame; falls back to prevDealInstance.seed.
    let prevDealInstance = shellState.dealInstance;
    let nextSeed = (prevDealInstance && prevDealInstance.seedPolicy === 'explicit-test')
        ? ((options && options.seed != null) ? options.seed : prevDealInstance.seed)
        : undefined;
    let newDealInstance = create3PDADealInstance({
        seedPolicy:       prevDealInstance ? prevDealInstance.seedPolicy : 'fixed-debug',
        seed:             nextSeed,
        frameIndex:       shellState.frameIndex,
        pivotActorId:     newPivot,
        referenceActorId: shellState.selected3PDARealNaturalPosition,
    });
    shellState.dealInstance = newDealInstance;
    // Note 80/98: recreate activated manifest-ID cardState for the new frame through the accepted pipeline.
    // Zones contain manifest ID arrays; containsLiveCards=true; no rendering/phase change.
    // Note 96/98: seed comes from dealInstance, not hard-coded global directly.
    let cardZonePlan = create3PDACardZonePlan({ deckCount: 2 });
    let metadataCardState = create3PDAMetadataBearingEmptyCardState(cardZonePlan, { seed: newDealInstance.seed });
    let cardState = activate3PDADealPlanMetadataIntoCardState(metadataCardState);
    // Note 96/98: attach lightweight deal-instance metadata.
    cardState = Object.assign({}, cardState, {
        dealInstanceMetadata: {
            kind:           newDealInstance.kind,
            dealInstanceId: newDealInstance.dealInstanceId,
            seedPolicy:     newDealInstance.seedPolicy,
            frameIndex:     newDealInstance.frameIndex,
        },
    });
    let csv = validate3PDAActivatedCardState(cardState);
    if (!csv.valid) {
        throw new Error('Note 80: activated cardState failed validation at frame advance: ' +
            (csv.errors || []).join(', '));
    }
    shellState.cardState = cardState;
    // Note 98: validate seed/cardState consistency after frame advance (mirrors createThreePDAShellState check).
    let consV = validate3PDAShellDealInstanceConsistency(shellState);
    if (!consV.valid) {
        throw new Error('Note 98: deal-instance consistency check failed after frame advance: ' +
            (consV.errors || []).join(', '));
    }
    // Note 99: instant undealt-to-dealt lifecycle transition for new frame.
    // Synchronous — no animation, no timer, no new top-level phase.
    let newDealLifecycle = create3PDAInstantScaffoldDealLifecycle(newDealInstance, shellState.cardState);
    let lcV = validate3PDADealLifecycleState(newDealLifecycle);
    if (!lcV.valid) {
        throw new Error('Note 99: deal lifecycle invalid at frame advance: ' + (lcV.errors || []).join(', '));
    }
    shellState.dealLifecycle = newDealLifecycle;
    let lcConsV = validate3PDAShellDealLifecycleConsistency(shellState);
    if (!lcConsV.valid) {
        throw new Error('Note 99: deal lifecycle consistency check failed after frame advance: ' + (lcConsV.errors || []).join(', '));
    }
    // Note 101: attach fresh unresolved qz/declaration state for the new frame.
    shellState.qzDeclarationState = create3PDAQZDeclarationState(shellState);
    let qzConsV = validate3PDAShellQZDeclarationConsistency(shellState);
    if (!qzConsV.valid) {
        throw new Error('Note 101: qz/declaration state consistency check failed after frame advance: ' + (qzConsV.errors || []).join(', '));
    }
    // Note 102: attach fresh unresolved basing/bottom state for the new frame.
    shellState.basingBottomState = create3PDABasingBottomState(shellState);
    let bsConsV2 = validate3PDAShellBasingBottomConsistency(shellState);
    if (!bsConsV2.valid) {
        throw new Error('Note 102: basing/bottom state consistency check failed after frame advance: ' + (bsConsV2.errors || []).join(', '));
    }
}

/**
 * Clears the 3PDA shell: hides the shell host and panel, resets shell state to null.
 * Note 66a: uses #pda3-shell-host (dedicated container outside desk grid).
 */
function clearThreePDAShell() {
    gThreePDAShellState = null;
    gThreePDAShellPanelExpanded = false; // Note 67a: reset fold state on clear
    let host = document.getElementById('pda3-shell-host');
    if (host) host.classList.remove('pda3-shell-host-active');
    let panel = document.getElementById('pda3-shell-panel');
    if (panel) panel.style.display = 'none';
    // Note 67: also hide the board-position display layer
    let boardLayer = document.getElementById('pda3-board-shell-layer');
    if (boardLayer) boardLayer.classList.remove('pda3-board-shell-active');
    // Note 88: also hide the board-area zone layer
    let boardZoneLayer = document.getElementById('pda3-board-zone-layer');
    if (boardZoneLayer) boardZoneLayer.classList.remove('pda3-board-zone-layer-active');
}

/**
 * Note 91 — End (deactivate) any active normal 4P game mode before entering 3PDA scaffold.
 * Cancels active 4P timers, clears visible 4P UI artifacts, and marks the 4P game
 * phase as idle so no 4P session remains active underneath the 3PDA scaffold.
 * Null-safe and idempotent: safe to call when 4P was active or when no 4P game is active.
 * Does not mutate 3PDA cardState, alter 4P rules/dealing/scoring, or add any gameplay.
 * Called from confirmCreateGameFromSettings() before createThreePDAShellState().
 */
function exitNormal4PModeFor3PDAScaffold() {
    // Cancel active 4P deal-animation and frame-intermittent timers.
    if (dealingTimer) { clearInterval(dealingTimer); dealingTimer = null; }
    if (gFrameIntermittentTimeout) {
        clearTimeout(gFrameIntermittentTimeout);
        gFrameIntermittentTimeout = null;
        gFrameIntermittentEndsAt = 0;
    }
    clearTimers(); // shot clock, timer overlays

    // Clear 4P-only transient interaction state (null-safe, idempotent).
    gFCInteraction = null;
    gCrossingState = null;
    currentDeclaration = null;
    gAutoStrain3rdTriggerCard = null;
    gAutoStrain3rdTriggered = false;
    pendingNextFrame = null;

    // Clear crossing/forehand UI artifacts (idempotent).
    hideLocalCrossingActionButtons();
    clearCrossingSeatStatuses();

    // Clear pause protocol UI (null-safe via internal guard).
    clearPauseProtocolStateToIdle();

    // Clear visible 4P card/hand/desk artifacts.
    clearSelection();
    clearDesk();
    // Clear the reference hand surface (human player hand cards), including any persistent namebar.
    if (gReferenceHandSurface) {
        gReferenceHandSurface.innerHTML = '';
    }

    // Note 91a: Hide persistent 4P namebars so they do not remain visible underneath 3PDA.
    // gDeskNamebars entries live inside desk slots (mounted by initPersistentNamebars).
    // Hiding avoids DOM removal; initPersistentNamebars() will recreate/show them on next 4P start.
    if (Array.isArray(gDeskNamebars)) {
        for (let i = 0; i < gDeskNamebars.length; i++) {
            if (gDeskNamebars[i]) {
                gDeskNamebars[i].style.display = 'none';
            }
        }
    }
    // Also hide any .desk-namebar elements left in desk slots (null-safe fallback).
    for (let i = 0; i < gDeskSlots.length; i++) {
        if (gDeskSlots[i]) {
            gDeskSlots[i].querySelectorAll('.desk-namebar').forEach(function(el) {
                el.style.display = 'none';
            });
        }
    }

    // Hide 4P-specific UI controls.
    gDeclareMatrix.style.display = 'none';
    gBtnPlay.disabled = true;
    hideCountingDialog();
    if (gBtnShowBase) gBtnShowBase.style.display = 'none';
    if (gBasePreview) gBasePreview.innerHTML = '';

    // Note 95: Clear stale shared 4P UI surfaces before entering 3PDA scaffold
    // (LEAK-1 through LEAK-4 from Note 94 audit).
    updatePhaseDisplay(t('phase.initial'));
    updateStatus(t('status.ready'));
    if (gDenomArea) gDenomArea.removeAttribute('strain');   // LEAK-3
    if (gStrainDiv) gStrainDiv.innerHTML = '';              // LEAK-3
    if (gDeclareSp) gDeclareSp.textContent = '';           // LEAK-3
    if (gDeclMethodSp) gDeclMethodSp.textContent = '';     // LEAK-3
    resetDeclarationHistoryRows();                          // LEAK-4

    // Mark 4P game session as idle/inactive. game is always non-null (global in shengji_engine.js).
    // Setting game.phase to IDLE establishes the invariant: no 4P session is active under 3PDA.
    if (game.phase !== GamePhase.IDLE) {
        game.phase = GamePhase.IDLE;
    }
}

/**
 * Renders the 3PDA non-card live frame shell panel into desk-center.
 * Shows frame model, action cycle, next pivot, reference preview, and
 * a "Next shell frame" button. Does not render cards/hands/desks.
 */
function renderThreePDAShell() {
    if (!gThreePDAShellState) return;
    let shell = gThreePDAShellState;
    let frame = shell.currentFrameModel;

    // Note 66a/b: render into #pda3-shell-host (dedicated container outside desk grid),
    // which ensures the panel is not clipped or overlapped by desk-slot grid cells.
    // Note 66b: use active class (not style.display='') so the CSS display:none is overridden.
    let host = document.getElementById('pda3-shell-host');
    if (host) {
        host.classList.add('pda3-shell-host-active');
    }

    let existing = document.getElementById('pda3-shell-panel');
    let panel;
    if (existing) {
        panel = existing;
        panel.innerHTML = '';
        panel.style.display = '';
    } else {
        panel = document.createElement('div');
        panel.id = 'pda3-shell-panel';
        let target = host || document.getElementById('desk-center') || document.body;
        target.appendChild(panel);
    }

    // Note 67a: compact/foldable panel
    // The panel has a slim compact bar always visible.
    // Expanded details are shown/hidden via gThreePDAShellPanelExpanded.
    if (gThreePDAShellPanelExpanded) {
        panel.className = 'pda3-shell-panel';
    } else {
        panel.className = 'pda3-shell-panel pda3-shell-compact';
    }

    // --- Compact bar (always rendered) ---
    let bar = document.createElement('div');
    bar.className = 'pda3-shell-compact-bar';

    let barTitle = document.createElement('span');
    barTitle.className = 'pda3-shell-compact-title';
    barTitle.textContent = t('settingsDialog.threePDAShell.title');
    bar.appendChild(barTitle);

    let barFrame = document.createElement('span');
    barFrame.className = 'pda3-shell-compact-item';
    barFrame.innerHTML = t('settingsDialog.threePDAShell.frameIndex') + '\u00a0<span>' + shell.frameIndex + '</span>';
    bar.appendChild(barFrame);

    let barPivot = document.createElement('span');
    barPivot.className = 'pda3-shell-compact-item';
    barPivot.innerHTML = t('settingsDialog.threePDAShell.currentPivot') + '\u00a0<span>' + get3PDAActorLabel(shell.currentPivotNaturalPosition) + '</span>';
    bar.appendChild(barPivot);

    let barNextPivot = document.createElement('span');
    barNextPivot.className = 'pda3-shell-compact-item';
    barNextPivot.innerHTML = t('settingsDialog.threePDAShell.nextPivot') + '\u00a0<span>' + get3PDAActorLabel(getNext3PDAPivotNaturalPosition(shell.currentPivotNaturalPosition)) + '</span>';
    bar.appendChild(barNextPivot);

    // Note 69: phase/status display in compact bar
    let barPhase = document.createElement('span');
    barPhase.className = 'pda3-shell-compact-item';
    barPhase.innerHTML = t('settingsDialog.threePDAShell.phaseLabel') + '\u00a0<span>' + t('settingsDialog.threePDAShell.phaseFrameStartShell') + '</span>';
    bar.appendChild(barPhase);

    let btnNext = document.createElement('button');
    btnNext.type = 'button'; // Note 66a: explicit type prevents unintended form submission
    btnNext.className = 'pda3-shell-compact-btn';
    btnNext.textContent = t('settingsDialog.threePDAShell.nextShellFrame');
    btnNext.addEventListener('click', () => {
        advanceThreePDAShellFrame(gThreePDAShellState);
        renderThreePDAShell();
    });
    bar.appendChild(btnNext);

    let btnToggle = document.createElement('button');
    btnToggle.type = 'button';
    btnToggle.className = 'pda3-shell-compact-btn';
    btnToggle.textContent = gThreePDAShellPanelExpanded
        ? t('settingsDialog.threePDAShell.collapseDetails')
        : t('settingsDialog.threePDAShell.expandDetails');
    btnToggle.addEventListener('click', () => {
        gThreePDAShellPanelExpanded = !gThreePDAShellPanelExpanded;
        renderThreePDAShell();
    });
    bar.appendChild(btnToggle);

    panel.appendChild(bar);

    // --- Expanded details (only when expanded) ---
    if (gThreePDAShellPanelExpanded) {
        let details = document.createElement('div');
        details.className = 'pda3-shell-details';

        // Subtitle (non-playable notice)
        let subtitle = document.createElement('div');
        subtitle.className = 'pda3-shell-subtitle';
        subtitle.textContent = t('settingsDialog.threePDAShell.subtitle');
        details.appendChild(subtitle);

        // Frame roles table
        let rolesTable = document.createElement('table');
        rolesTable.className = 'pda3-shell-table';
        let roleNames = ['pivot', 'successor', 'ally', 'predecessor'];
        for (let role of roleNames) {
            let actorId = frame.roleToActor[role];
            let tr = document.createElement('tr');
            let tdRole = document.createElement('td');
            tdRole.className = 'pda3-shell-role';
            tdRole.textContent = t('frameRoles.' + role);
            let tdActor = document.createElement('td');
            tdActor.className = 'pda3-shell-actor';
            tdActor.textContent = get3PDAActorLabel(actorId);
            tr.appendChild(tdRole);
            tr.appendChild(tdActor);
            rolesTable.appendChild(tr);
        }
        details.appendChild(rolesTable);

        // Action cycle
        let cycleRow = document.createElement('div');
        cycleRow.className = 'pda3-shell-row';
        let cycleLbl = document.createElement('span');
        cycleLbl.className = 'pda3-shell-label';
        cycleLbl.textContent = t('settingsDialog.threePDAShell.actionCycle') + ':';
        let cycleVal = document.createElement('span');
        cycleVal.className = 'pda3-shell-value';
        cycleVal.textContent = frame.actionCycle.map(get3PDAActorLabel).join(' \u2192 ');
        cycleRow.appendChild(cycleLbl);
        cycleRow.appendChild(cycleVal);
        details.appendChild(cycleRow);

        // Reference preview section title
        let refTitle = document.createElement('div');
        refTitle.className = 'pda3-shell-section-title';
        refTitle.textContent = t('settingsDialog.threePDAShell.referencePreview');
        details.appendChild(refTitle);

        // Reference selector
        let refSelRow = document.createElement('div');
        refSelRow.className = 'pda3-shell-row';
        let refLbl = document.createElement('label');
        refLbl.className = 'pda3-shell-label';
        refLbl.textContent = t('settingsDialog.threePDAPreview.referenceSelector') + ':';
        let refSel = document.createElement('select');
        refSel.className = 'pda3-shell-select';
        for (let actorId of frame.actionCycle) {
            let op = document.createElement('option');
            op.value = actorId;
            op.textContent = get3PDAActorLabel(actorId);
            refSel.appendChild(op);
        }
        if (!frame.actorToRole[shell.shellReferenceActorId]) {
            shell.shellReferenceActorId = frame.roleToActor.successor;
        }
        refSel.value = shell.shellReferenceActorId;
        refSel.addEventListener('change', () => {
            shell.shellReferenceActorId = refSel.value;
            renderThreePDAShell();
        });
        refSelRow.appendChild(refLbl);
        refSelRow.appendChild(refSel);
        details.appendChild(refSelRow);

        // Reference-position matrix
        let refMatTable = document.createElement('table');
        refMatTable.className = 'pda3-shell-table';
        for (let actorId of frame.actionCycle) {
            let refPos = get3PDAReferencePositionForFrameActor(frame, actorId, shell.shellReferenceActorId);
            let tr = document.createElement('tr');
            let tdActor = document.createElement('td');
            tdActor.className = 'pda3-shell-actor';
            tdActor.textContent = get3PDAActorLabel(actorId);
            let tdRefPos = document.createElement('td');
            tdRefPos.className = 'pda3-shell-refpos';
            tdRefPos.textContent = t('referencePositions.' + refPos);
            tr.appendChild(tdActor);
            tr.appendChild(tdRefPos);
            refMatTable.appendChild(tr);
        }
        details.appendChild(refMatTable);

        // Note 81: count-only cardState diagnostic (no card rendering)
        let csTitle = document.createElement('div');
        csTitle.className = 'pda3-shell-section-title';
        csTitle.textContent = t('settingsDialog.threePDAShell.cardStateStatus');
        details.appendChild(csTitle);

        let cs = shell.cardState;
        let csActive = cs && cs.containsLiveCards && cs.activationStatus === 'manifest-ids-in-zones';

        let csStatusRow = document.createElement('div');
        csStatusRow.className = 'pda3-shell-row';
        let csStatusLbl = document.createElement('span');
        csStatusLbl.className = 'pda3-shell-label';
        csStatusLbl.textContent = t('settingsDialog.threePDAShell.cardStateStatus') + ':';
        let csStatusVal = document.createElement('span');
        csStatusVal.className = 'pda3-shell-value';
        csStatusVal.textContent = csActive
            ? t('settingsDialog.threePDAShell.cardStateActiveManifestIds')
            : (cs && cs.containsLiveCards === false ? 'empty' : '\u2014');
        csStatusRow.appendChild(csStatusLbl);
        csStatusRow.appendChild(csStatusVal);
        details.appendChild(csStatusRow);

        let csPayloadRow = document.createElement('div');
        csPayloadRow.className = 'pda3-shell-row';
        let csPayloadLbl = document.createElement('span');
        csPayloadLbl.className = 'pda3-shell-label';
        csPayloadLbl.textContent = t('settingsDialog.threePDAShell.cardStatePayload') + ':';
        let csPayloadVal = document.createElement('span');
        csPayloadVal.className = 'pda3-shell-value';
        csPayloadVal.textContent = (cs && cs.liveCardPayloadKind) ? cs.liveCardPayloadKind : '\u2014';
        csPayloadRow.appendChild(csPayloadLbl);
        csPayloadRow.appendChild(csPayloadVal);
        details.appendChild(csPayloadRow);

        let csZonesRow = document.createElement('div');
        csZonesRow.className = 'pda3-shell-row';
        let csZonesLbl = document.createElement('span');
        csZonesLbl.className = 'pda3-shell-label';
        csZonesLbl.textContent = t('settingsDialog.threePDAShell.cardStateZones') + ':';
        let csZonesVal = document.createElement('span');
        csZonesVal.className = 'pda3-shell-value';
        let csZoneText = '\u2014';
        if (cs && cs.zones) {
            let zn = function(z) {
                return cs.zones[z] && Array.isArray(cs.zones[z].cards) ? cs.zones[z].cards.length : 0;
            };
            csZoneText = [
                get3PDAActorLabel('N')  + '\u00a0' + zn('N'),
                get3PDAActorLabel('Sw') + '\u00a0' + zn('Sw'),
                get3PDAActorLabel('Se') + '\u00a0' + zn('Se'),
                get3PDAActorLabel('Ay') + '\u00a0' + zn('Ay'),
                t('settingsDialog.threePDAShell.baseZone') + '\u00a0' + zn('base'),
            ].join(' / ');
        }
        csZonesVal.textContent = csZoneText;
        csZonesRow.appendChild(csZonesLbl);
        csZonesRow.appendChild(csZonesVal);
        details.appendChild(csZonesRow);

        let csAssignedRow = document.createElement('div');
        csAssignedRow.className = 'pda3-shell-row';
        let csAssignedLbl = document.createElement('span');
        csAssignedLbl.className = 'pda3-shell-label';
        csAssignedLbl.textContent = t('settingsDialog.threePDAShell.cardStateAssigned') + ':';
        let csAssignedVal = document.createElement('span');
        csAssignedVal.className = 'pda3-shell-value';
        let csAssignedText = '\u2014';
        if (cs && cs.zones) {
            let csTotal = 0;
            for (let cz of ['N', 'Sw', 'Se', 'Ay', 'base'])
                csTotal += (cs.zones[cz] && Array.isArray(cs.zones[cz].cards)) ? cs.zones[cz].cards.length : 0;
            let csExpected = (cs && cs.totalCards) ? cs.totalCards : '?';
            csAssignedText = csTotal + ' / ' + csExpected;
        }
        csAssignedVal.textContent = csAssignedText;
        csAssignedRow.appendChild(csAssignedLbl);
        csAssignedRow.appendChild(csAssignedVal);
        details.appendChild(csAssignedRow);

        // Note 86: card-zone containers — reference-relative zone display, container-only, no cards
        let czTitle = document.createElement('div');
        czTitle.className = 'pda3-shell-section-title';
        czTitle.textContent = t('settingsDialog.threePDAShell.cardZoneContainers');
        details.appendChild(czTitle);

        let czLayer = document.createElement('div');
        czLayer.className = 'pda3-card-zone-layer';
        try {
            let placement = create3PDACardZoneDisplayPlacementSnapshot(shell);
            let actorSlots = [
                { slotName: 'reference', labelKey: 'slotReference', slot: placement.displaySlots.reference },
                { slotName: 'afterhand', labelKey: 'slotAfterhand', slot: placement.displaySlots.afterhand },
                { slotName: 'opposite',  labelKey: 'slotOpposite',  slot: placement.displaySlots.opposite  },
                { slotName: 'forehand',  labelKey: 'slotForehand',  slot: placement.displaySlots.forehand  },
            ];
            for (let { slotName, labelKey, slot } of actorSlots) {
                let container = document.createElement('div');
                container.className = 'pda3-card-zone-container pda3-card-zone-slot-' + slotName;
                container.dataset.slotName = slotName;
                container.dataset.zoneId   = slot.zoneId;
                let slotLbl = document.createElement('span');
                slotLbl.className = 'pda3-cz-slot-label';
                slotLbl.textContent = t('settingsDialog.threePDAShell.' + labelKey);
                let sep1 = document.createElement('span');
                sep1.className = 'pda3-cz-sep';
                sep1.textContent = '\u2014';
                let actorLbl = document.createElement('span');
                actorLbl.className = 'pda3-cz-actor-label';
                actorLbl.textContent = get3PDAActorLabel(slot.zoneId);
                let sep2 = document.createElement('span');
                sep2.className = 'pda3-cz-sep';
                sep2.textContent = '\u2014';
                let countLbl = document.createElement('span');
                countLbl.className = 'pda3-cz-count-label';
                countLbl.textContent = String(slot.count);
                container.appendChild(slotLbl);
                container.appendChild(sep1);
                container.appendChild(actorLbl);
                container.appendChild(sep2);
                container.appendChild(countLbl);
                // Note 87: zone-level count badge (one per container, not per card)
                let badge = document.createElement('span');
                badge.className = 'pda3-card-zone-count-badge';
                badge.textContent = String(slot.count) + '\u00a0' + t('settingsDialog.threePDAShell.zoneCardsShort');
                container.appendChild(badge);
                czLayer.appendChild(container);
            }
            // Base zone container
            let baseContainer = document.createElement('div');
            baseContainer.className = 'pda3-card-zone-container pda3-card-zone-slot-base';
            baseContainer.dataset.slotName = 'base';
            baseContainer.dataset.zoneId   = 'base';
            let baseLbl = document.createElement('span');
            baseLbl.className = 'pda3-cz-slot-label';
            baseLbl.textContent = t('settingsDialog.threePDAShell.slotBase');
            let baseSep1 = document.createElement('span');
            baseSep1.className = 'pda3-cz-sep';
            baseSep1.textContent = '\u2014';
            let baseActorLbl = document.createElement('span');
            baseActorLbl.className = 'pda3-cz-actor-label';
            baseActorLbl.textContent = t('settingsDialog.threePDAShell.baseZone');
            let baseSep2 = document.createElement('span');
            baseSep2.className = 'pda3-cz-sep';
            baseSep2.textContent = '\u2014';
            let baseCountLbl = document.createElement('span');
            baseCountLbl.className = 'pda3-cz-count-label';
            baseCountLbl.textContent = String(placement.baseZone.count);
            baseContainer.appendChild(baseLbl);
            baseContainer.appendChild(baseSep1);
            baseContainer.appendChild(baseActorLbl);
            baseContainer.appendChild(baseSep2);
            baseContainer.appendChild(baseCountLbl);
            // Note 87: zone-level count badge for base zone
            let baseBadge = document.createElement('span');
            baseBadge.className = 'pda3-card-zone-count-badge';
            baseBadge.textContent = String(placement.baseZone.count) + '\u00a0' + t('settingsDialog.threePDAShell.zoneCardsShort');
            baseContainer.appendChild(baseBadge);
            czLayer.appendChild(baseContainer);
        } catch (e) {
            let czErr = document.createElement('div');
            czErr.className = 'pda3-cz-error';
            czErr.textContent = 'card-zone snapshot error: ' + e.message;
            czLayer.appendChild(czErr);
        }
        details.appendChild(czLayer);

        // Note 93: read-only reference-hand layout diagnostics
        let rhDiagTitle = document.createElement('div');
        rhDiagTitle.className = 'pda3-shell-section-title';
        rhDiagTitle.textContent = t('settingsDialog.threePDAShell.refHandDiagTitle');
        details.appendChild(rhDiagTitle);

        try {
            let rhPlacement = create3PDACardZoneDisplayPlacementSnapshot(shell);
            let rhRefSlot   = rhPlacement && rhPlacement.displaySlots && rhPlacement.displaySlots.reference;
            let rhSorted    = rhRefSlot && rhRefSlot.zoneSnapshot && rhRefSlot.zoneSnapshot.resolvedIdentities
                ? create3PDAReferenceZoneDisplaySortedIdentities(rhRefSlot.zoneSnapshot.resolvedIdentities)
                : null;
            let rhDiag = create3PDAReferenceHandRenderDiagnostic(rhPlacement, rhSorted);

            function makeRhRow(labelKey, valueText) {
                let row = document.createElement('div');
                row.className = 'pda3-shell-row';
                let lbl = document.createElement('span');
                lbl.className = 'pda3-shell-label';
                lbl.textContent = t('settingsDialog.threePDAShell.' + labelKey) + ':';
                let val = document.createElement('span');
                val.className = 'pda3-shell-value';
                val.textContent = valueText != null ? String(valueText) : '\u2014';
                row.appendChild(lbl);
                row.appendChild(val);
                return row;
            }

            details.appendChild(makeRhRow('refHandDiagActor',         rhDiag.zoneId != null ? get3PDAActorLabel(rhDiag.zoneId) + '\u00a0(' + rhDiag.zoneId + ')' : '\u2014'));
            details.appendChild(makeRhRow('refHandDiagExpected',      rhDiag.expectedCount));
            details.appendChild(makeRhRow('refHandDiagRendered',      rhDiag.renderedCount));
            details.appendChild(makeRhRow('refHandDiagVisibleNote',   t('settingsDialog.threePDAShell.refHandDiagVisibleNoteVal')));
            details.appendChild(makeRhRow('refHandDiagDisplayOrder',  t('settingsDialog.threePDAShell.refHandDiagDisplayOrderVal')));
            details.appendChild(makeRhRow('refHandDiagDirection',     t('settingsDialog.threePDAShell.refHandDiagDirectionVal')));
            details.appendChild(makeRhRow('refHandDiagMutation',      t('settingsDialog.threePDAShell.refHandDiagMutationVal')));
            details.appendChild(makeRhRow('refHandDiagDeterministic', t('settingsDialog.threePDAShell.refHandDiagDeterministicVal')));

            if (rhDiag.nonRefCounts) {
                let nc = rhDiag.nonRefCounts;
                let nonRefRow = document.createElement('div');
                nonRefRow.className = 'pda3-shell-row';
                let nonRefLbl = document.createElement('span');
                nonRefLbl.className = 'pda3-shell-label';
                nonRefLbl.textContent = t('settingsDialog.threePDAShell.refHandDiagNonRef') + ':';
                let nonRefVal = document.createElement('span');
                nonRefVal.className = 'pda3-shell-value';
                nonRefVal.textContent = [
                    t('settingsDialog.threePDAShell.slotAfterhand') + '\u00a0' + (nc.afterhand != null ? nc.afterhand : '\u2014'),
                    t('settingsDialog.threePDAShell.slotOpposite')  + '\u00a0' + (nc.opposite  != null ? nc.opposite  : '\u2014'),
                    t('settingsDialog.threePDAShell.slotForehand')  + '\u00a0' + (nc.forehand  != null ? nc.forehand  : '\u2014'),
                    t('settingsDialog.threePDAShell.slotBase')      + '\u00a0' + (nc.base      != null ? nc.base      : '\u2014'),
                ].join(' / ');
                nonRefRow.appendChild(nonRefLbl);
                nonRefRow.appendChild(nonRefVal);
                details.appendChild(nonRefRow);
            }
        } catch (e) {
            let rhErr = document.createElement('div');
            rhErr.className = 'pda3-cz-error';
            rhErr.textContent = 'ref-hand diagnostic error: ' + e.message;
            details.appendChild(rhErr);
        }

        panel.appendChild(details);
    }

    // Note 67: also render board-position display layer (Note 88a: count badges integrated here)
    renderThreePDABoardShell();
}

/**
 * Note 93 — Returns a read-only diagnostic record for the reference-zone rendering state.
 * Pure/null-safe: does not mutate placement, sortedIdentities, cardState, or zone arrays.
 * @param {object|null} placement  — result of create3PDACardZoneDisplayPlacementSnapshot, or null.
 * @param {object[]|null} sortedIdentities — display-sorted copy from create3PDAReferenceZoneDisplaySortedIdentities, or null.
 * @returns {object} diagnostic record with aggregate fields only (no manifest IDs / deck ordinals / identity JSON).
 */
function create3PDAReferenceHandRenderDiagnostic(placement, sortedIdentities) {
    let refSlot = placement && placement.displaySlots && placement.displaySlots.reference;
    let expectedCount  = (refSlot && typeof refSlot.count === 'number') ? refSlot.count : null;
    let zoneId         = (refSlot && refSlot.zoneId) ? refSlot.zoneId : null;
    let renderedCount  = (sortedIdentities && Array.isArray(sortedIdentities)) ? sortedIdentities.length : null;
    let nonRefCounts = null;
    if (placement && placement.displaySlots) {
        let s = placement.displaySlots;
        nonRefCounts = {
            afterhand: (s.afterhand && typeof s.afterhand.count === 'number') ? s.afterhand.count : null,
            opposite:  (s.opposite  && typeof s.opposite.count  === 'number') ? s.opposite.count  : null,
            forehand:  (s.forehand  && typeof s.forehand.count  === 'number') ? s.forehand.count  : null,
            base:      (placement.baseZone && typeof placement.baseZone.count === 'number') ? placement.baseZone.count : null,
        };
    }
    return {
        zoneId:          zoneId,
        expectedCount:   expectedCount,
        renderedCount:   renderedCount,
        displayOrder:    'read-only sorted',
        displayDirection:'high-left',
        stateMutation:   'none; display-only',
        deterministicScaffold: 'enabled',
        nonRefCounts:    nonRefCounts,
    };
}

/**
 * Note 92 — Returns a display-sorted copy of reference-zone resolved identities.
 * PROVISIONAL/SCAFFOLD: display-only sorting until real 3PDA qz/declaration/trump lifecycle exists.
 * Does NOT mutate the source array, cardState, zone arrays, or manifest/deal metadata.
 * Sort order (provisional):
 *   1. Non-joker suited cards, grouped by suit (d/c/h/s), then ascending rank within suit.
 *   2. Jokers last: V (small) then W (big).
 * Tie-break for duplicate same-identity cards: deckOrdinal then manifestCardId (hidden, display-stable).
 * @param {ReadonlyArray} referenceIdentities — frozen resolvedIdentities from zoneSnapshot.
 * @returns {object[]} new sorted array (copy); source is not modified.
 */
function create3PDAReferenceZoneDisplaySortedIdentities(referenceIdentities) {
    // Provisional display sort context (read-only display order, not final trump sorting).
    const SUIT_ORDER = { d: 0, c: 1, h: 2, s: 3 }; // aligns with THREE_PDA_MANIFEST_SUITS
    const RANK_ORDER = { '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6,
                         '9': 7, 'X': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12,
                         'V': 13, 'W': 14 };
    return referenceIdentities.slice().sort(function(a, b) {
        let aJoker = a.isJoker ? 1 : 0;
        let bJoker = b.isJoker ? 1 : 0;
        if (aJoker !== bJoker) return aJoker - bJoker; // jokers last
        // Same joker/non-joker bucket
        if (!a.isJoker) {
            // Group by suit first
            let aSuit = (SUIT_ORDER[a.suit] !== undefined) ? SUIT_ORDER[a.suit] : 99;
            let bSuit = (SUIT_ORDER[b.suit] !== undefined) ? SUIT_ORDER[b.suit] : 99;
            if (aSuit !== bSuit) return aSuit - bSuit;
        }
        // Within suit (or within jokers): sort by rank
        let aRank = (RANK_ORDER[a.rank] !== undefined) ? RANK_ORDER[a.rank] : 99;
        let bRank = (RANK_ORDER[b.rank] !== undefined) ? RANK_ORDER[b.rank] : 99;
        if (aRank !== bRank) return aRank - bRank;
        // Stable tie-breaker for duplicates: deckOrdinal then manifestCardId (hidden from display)
        let aDeck = typeof a.deckOrdinal === 'number' ? a.deckOrdinal : 0;
        let bDeck = typeof b.deckOrdinal === 'number' ? b.deckOrdinal : 0;
        if (aDeck !== bDeck) return aDeck - bDeck;
        let aId = typeof a.manifestCardId === 'string' ? a.manifestCardId : '';
        let bId = typeof b.manifestCardId === 'string' ? b.manifestCardId : '';
        return aId < bId ? -1 : aId > bId ? 1 : 0;
    }).reverse(); // Note 92a: reversed to match live 4P high-left convention (highest/jokers on the left).
}

/**
 * Note 90 — Creates a single non-interactive 3PDA reference-zone card face element.
 * Scoped to 3PDA only. Does not affect 4P card rendering.
 * pointer-events: none (enforced by CSS .pda3-ref-card-face).
 * No click/hover/drag/selection handlers. No playability markers.
 * @param {Object} identity — resolved manifest identity record (Note 82).
 *   Required fields: rank (string), suit (string), isJoker (boolean)
 * @returns {HTMLElement}
 */
function create3PDAReferenceZoneCardFaceEl(identity) {
    let suitIdx = numberToSuitName.indexOf(identity.suit);
    let el = document.createElement('span');
    el.className = 'pda3-ref-card-face';
    el.setAttribute('data-suit', identity.suit);
    el.setAttribute('data-rank', identity.rank);

    let rankEl = document.createElement('span');
    rankEl.className = 'pda3-ref-card-rank';
    rankEl.textContent = identity.rank === 'X' ? '10' : identity.rank;

    let suitEl = document.createElement('span');
    suitEl.className = 'pda3-ref-card-suit';
    if (identity.isJoker) {
        suitEl.innerHTML = jokerHtml;
    } else {
        suitEl.innerHTML = suitTexts[suitIdx >= 0 ? suitIdx : 4];
    }

    el.appendChild(rankEl);
    el.appendChild(suitEl);
    return el;
}

/**
 * Renders the 3PDA non-card board-position display layer (#pda3-board-shell-layer).
 * Shows one label box per actor in each board display slot (top/left/right/bottom)
 * indicating: actor name, frame role, reference position, real/dummy status.
 * Called from renderThreePDAShell(); cleared by clearThreePDAShell().
 * Note 67: no cards, no hands, no dealing — shell-only display.
 * Note 90: reference slot renders card faces; all other slots keep empty placeholders.
 */
function renderThreePDABoardShell() {
    let layer = document.getElementById('pda3-board-shell-layer');
    if (!layer) return;

    if (!gThreePDAShellState) {
        layer.classList.remove('pda3-board-shell-active');
        return;
    }

    let shell = gThreePDAShellState;
    let frame = shell.currentFrameModel;
    // Note 68: board shell uses fixed real-game reference (selected 3PDA natural seat),
    // NOT the debug shellReferenceActorId (which is for diagnostic matrix only).
    let refId = get3PDARealGameReferenceActorId(shell);

    layer.classList.add('pda3-board-shell-active');
    layer.innerHTML = '';

    // Note 88a: get placement snapshot to integrate count badges into shell slots (no separate overlay layer)
    let placement = null;
    try { placement = create3PDACardZoneDisplayPlacementSnapshot(shell); } catch (_) { /* ignore */ }

    for (let actorId of frame.actionCycle) {
        let refPos = get3PDAReferencePositionForFrameActor(frame, actorId, refId);
        let dispPos = getDisplayPositionForReferencePosition(refPos);
        let isDummy = (actorId === 'Ay');

        let box = document.createElement('div');
        box.className = 'pda3-board-label pda3-board-label-' + dispPos;
        box.dataset.displayPosition = dispPos;

        let nameEl = document.createElement('div');
        nameEl.className = 'pda3-board-label-name';
        nameEl.textContent = get3PDAActorLabel(actorId);
        box.appendChild(nameEl);

        let roleEl = document.createElement('div');
        roleEl.className = 'pda3-board-label-role';
        roleEl.textContent = t('frameRoles.' + frame.actorToRole[actorId]);
        box.appendChild(roleEl);

        let refPosEl = document.createElement('div');
        refPosEl.className = 'pda3-board-label-refpos';
        refPosEl.textContent = t('referencePositions.' + refPos);
        box.appendChild(refPosEl);

        let kindEl = document.createElement('div');
        kindEl.className = 'pda3-board-label-kind';
        kindEl.textContent = isDummy
            ? t('settingsDialog.threePDABoardShell.dummyActor')
            : t('settingsDialog.threePDABoardShell.realActor');
        box.appendChild(kindEl);

        // Note 88a: integrated count badge from placement snapshot
        if (placement && placement.displaySlots[refPos]) {
            let badge = document.createElement('span');
            badge.className = 'pda3-board-zone-count-badge';
            badge.textContent = String(placement.displaySlots[refPos].count) + '\u00a0' + t('settingsDialog.threePDAShell.zoneCardsShort');
            box.appendChild(badge);

            // Note 90: reference slot → card faces; other slots → empty placeholders (Note 89).
            let slotData = placement.displaySlots[refPos];
            if (refPos === 'reference') {
                // Note 90a: dedicated readable reference hand strip (not a placeholder strip).
                // Source: placement/snapshot/resolver pipeline (Note 82/83/84).
                // Note 92: use display-sorted copy (provisional read-only display order, no mutation).
                let strip = document.createElement('div');
                strip.className = 'pda3-ref-hand-strip';
                let identities = create3PDAReferenceZoneDisplaySortedIdentities(
                    slotData.zoneSnapshot.resolvedIdentities);
                for (let i = 0; i < identities.length; i++) {
                    strip.appendChild(create3PDAReferenceZoneCardFaceEl(identities[i]));
                }
                box.appendChild(strip);
            } else {
                // Note 89: empty placeholder strip for afterhand/opposite/forehand.
                let count = slotData.count;
                let strip = document.createElement('div');
                strip.className = 'pda3-board-zone-slot-placeholder-strip pda3-board-zone-slot-placeholder-hand';
                for (let i = 0; i < count; i++) {
                    let ph = document.createElement('span');
                    ph.className = 'pda3-board-zone-slot-placeholder';
                    strip.appendChild(ph);
                }
                box.appendChild(strip);
            }
        }

        layer.appendChild(box);
    }

    // Note 88a: integrated base zone box in center (no separate overlay layer)
    if (placement) {
        let baseBox = document.createElement('div');
        baseBox.className = 'pda3-board-label pda3-board-label-center';
        baseBox.dataset.displayPosition = 'center';
        let baseLbl = document.createElement('div');
        baseLbl.className = 'pda3-board-label-name';
        baseLbl.textContent = t('settingsDialog.threePDAShell.slotBase');
        baseBox.appendChild(baseLbl);
        let baseBadge = document.createElement('span');
        baseBadge.className = 'pda3-board-zone-count-badge';
        baseBadge.textContent = String(placement.baseZone.count) + '\u00a0' + t('settingsDialog.threePDAShell.zoneCardsShort');
        baseBox.appendChild(baseBadge);
        // Note 89: per-zone empty slot placeholders for base
        let baseCount = placement.baseZone.count;
        let baseStrip = document.createElement('div');
        baseStrip.className = 'pda3-board-zone-slot-placeholder-strip pda3-board-zone-slot-placeholder-base';
        for (let i = 0; i < baseCount; i++) {
            let ph = document.createElement('span');
            ph.className = 'pda3-board-zone-slot-placeholder';
            baseStrip.appendChild(ph);
        }
        baseBox.appendChild(baseStrip);
        layer.appendChild(baseBox);
    }
}

/**
 * Note 88 — Renders 3PDA board-area zone containers/placeholders (no cards, no per-card slots, no selection).
 * Creates or reuses #pda3-board-zone-layer (sibling of #pda3-board-shell-layer).
 * Shows one semantic zone container per reference-relative slot: reference/afterhand/opposite/forehand/base.
 * Uses create3PDACardZoneDisplayPlacementSnapshot for rendering input.
 */
function renderThreePDABoardZoneLayer() {
    // Find or create #pda3-board-zone-layer as sibling of #pda3-board-shell-layer
    let shellLayer = document.getElementById('pda3-board-shell-layer');
    let parent = shellLayer ? shellLayer.parentNode : null;
    if (!parent) return;
    let layer = document.getElementById('pda3-board-zone-layer');
    if (!layer) {
        layer = document.createElement('div');
        layer.id = 'pda3-board-zone-layer';
        parent.appendChild(layer);
    }
    layer.innerHTML = '';
    if (!gThreePDAShellState) {
        layer.classList.remove('pda3-board-zone-layer-active');
        return;
    }
    try {
        let placement = create3PDACardZoneDisplayPlacementSnapshot(gThreePDAShellState);
        layer.classList.add('pda3-board-zone-layer-active');
        let actorSlots = [
            { slotName: 'reference', labelKey: 'slotReference', slot: placement.displaySlots.reference },
            { slotName: 'afterhand', labelKey: 'slotAfterhand', slot: placement.displaySlots.afterhand },
            { slotName: 'opposite',  labelKey: 'slotOpposite',  slot: placement.displaySlots.opposite  },
            { slotName: 'forehand',  labelKey: 'slotForehand',  slot: placement.displaySlots.forehand  },
        ];
        let shell = gThreePDAShellState;
        let frame = shell.currentFrameModel;
        let refId  = get3PDARealGameReferenceActorId(shell);
        for (let { slotName, labelKey, slot } of actorSlots) {
            let refPos  = get3PDAReferencePositionForFrameActor(frame, slot.zoneId, refId);
            let dispPos = getDisplayPositionForReferencePosition(refPos);
            let ctr = document.createElement('div');
            ctr.className = 'pda3-board-zone-container pda3-board-zone-slot-' + slotName;
            ctr.dataset.slotName = slotName;
            ctr.dataset.zoneId   = slot.zoneId;
            ctr.dataset.displayPosition = dispPos;
            let slotLbl = document.createElement('span');
            slotLbl.className = 'pda3-bz-slot-label';
            slotLbl.textContent = t('settingsDialog.threePDAShell.' + labelKey);
            ctr.appendChild(slotLbl);
            let actorLbl = document.createElement('span');
            actorLbl.className = 'pda3-bz-actor-label';
            actorLbl.textContent = get3PDAActorLabel(slot.zoneId);
            ctr.appendChild(actorLbl);
            let badge = document.createElement('span');
            badge.className = 'pda3-board-zone-count-badge';
            badge.textContent = String(slot.count) + '\u00a0' + t('settingsDialog.threePDAShell.zoneCardsShort');
            ctr.appendChild(badge);
            layer.appendChild(ctr);
        }
        // Base zone container
        let baseCtr = document.createElement('div');
        baseCtr.className = 'pda3-board-zone-container pda3-board-zone-slot-base';
        baseCtr.dataset.slotName = 'base';
        baseCtr.dataset.zoneId   = 'base';
        baseCtr.dataset.displayPosition = 'center';
        let baseLbl = document.createElement('span');
        baseLbl.className = 'pda3-bz-slot-label';
        baseLbl.textContent = t('settingsDialog.threePDAShell.slotBase');
        baseCtr.appendChild(baseLbl);
        let baseActorLbl = document.createElement('span');
        baseActorLbl.className = 'pda3-bz-actor-label';
        baseActorLbl.textContent = t('settingsDialog.threePDAShell.baseZone');
        baseCtr.appendChild(baseActorLbl);
        let baseBadge = document.createElement('span');
        baseBadge.className = 'pda3-board-zone-count-badge';
        baseBadge.textContent = String(placement.baseZone.count) + '\u00a0' + t('settingsDialog.threePDAShell.zoneCardsShort');
        baseCtr.appendChild(baseBadge);
        layer.appendChild(baseCtr);
    } catch (e) {
        layer.classList.add('pda3-board-zone-layer-active');
        let errDiv = document.createElement('div');
        errDiv.className = 'pda3-bz-error';
        errDiv.textContent = 'board zone error: ' + e.message;
        layer.appendChild(errDiv);
    }
}

function renderTableTabBody(container, readOnly) {
    let rows = document.createElement('div');
    rows.className = 'table-tab-rows';

    // Row 1: deck count with disabled 1/3/4 options visible.
    let row1 = document.createElement('div');
    row1.className = 'table-row';
    let deckField = document.createElement('div');
    deckField.className = 'settings-field';
    deckField.setAttribute('data-settings-field', 'deckCount');
    let deckLabel = document.createElement('label');
    deckLabel.textContent = t('settingsDialog.fields.deckCount');
    let deckSel = document.createElement('select');
    deckSel.setAttribute('data-settings-field', 'deckCount');
    const deckOptions = [
        { value: '1', disabled: true },
        { value: '2', disabled: false },
        { value: '3', disabled: true },
        { value: '4', disabled: true },
    ];
    for (let opt of deckOptions) {
        let op = document.createElement('option');
        op.value = opt.value;
        op.textContent = opt.value;
        op.disabled = !!opt.disabled;
        deckSel.appendChild(op);
    }
    deckSel.value = String(getRuleConfigFieldValue('deckCount'));
    deckSel.disabled = !!readOnly;
    if (!readOnly) {
        deckSel.addEventListener('change', () => {
            setRuleConfigFieldValue('deckCount', deckSel.value);
            renderSettingsDialog();
        });
    }
    deckField.appendChild(deckLabel);
    deckField.appendChild(deckSel);
    row1.appendChild(deckField);
    rows.appendChild(row1);

    // Row 2: table format (normal 4P only; select always disabled).
    let row2 = document.createElement('div');
    row2.className = 'table-row';
    let tableFormatField = document.createElement('div');
    tableFormatField.className = 'settings-field';
    tableFormatField.setAttribute('data-settings-field', 'tableFormat');
    let tableFormatLabel = document.createElement('label');
    tableFormatLabel.textContent = t('settingsDialog.fields.tableFormat');
    tableFormatField.appendChild(tableFormatLabel);
    tableFormatField.appendChild(createTableFormatSelector(readOnly));
    row2.appendChild(tableFormatField);
    rows.appendChild(row2);

    // Note 65: 3PDA non-playable preview panel — appears only when 3PDA is selected.
    let currentTableFormat = (gSettingsDraftRuleConfig && gSettingsDraftRuleConfig.tableFormat) || 'normal-4P';
    if (currentTableFormat === 'three-player-dummy-ally') {
        let previewRow = document.createElement('div');
        previewRow.className = 'table-row pda3-preview-row-wrapper';
        render3PDAPreviewPanel(previewRow);
        rows.appendChild(previewRow);
    }

    // Row 3: pivot-pass mode radios.
    let row3 = document.createElement('div');
    row3.className = 'table-row';
    let pivotPassField = document.createElement('div');
    pivotPassField.className = 'settings-field';
    pivotPassField.setAttribute('data-settings-field', 'pivotPassMode');
    let pivotPassLabel = document.createElement('label');
    pivotPassLabel.textContent = t('settingsDialog.fields.pivotPassMode');
    pivotPassField.appendChild(pivotPassLabel);
    pivotPassField.appendChild(createPivotPassModeRadioSelector(getRuleConfigFieldValue('pivotPassMode'), readOnly));
    row3.appendChild(pivotPassField);
    rows.appendChild(row3);

    // Row 4: preset rules dropdown + hint.
    let row4 = document.createElement('div');
    row4.className = 'table-row';
    let presetField = document.createElement('div');
    presetField.className = 'settings-field';
    presetField.setAttribute('data-settings-field', 'presetName');
    let presetLabel = document.createElement('label');
    presetLabel.textContent = t('settingsDialog.fields.presetName');
    presetField.appendChild(presetLabel);
    presetField.appendChild(createPresetRulesDropdown(getRuleConfigFieldValue('presetName'), readOnly));
    row4.appendChild(presetField);
    row4.appendChild(createPresetRuleHint());
    rows.appendChild(row4);

    container.appendChild(rows);
}

function renderSettingsDialog() {
    if (!gSettingsDialog || !gSettingsBody) return;

    let readOnly = (gSettingsMode === 'inspect');
    gSettingsTitle.textContent = readOnly ? t('settingsDialog.inspectTitle') : t('settingsDialog.createTitle');
    gSettingsSubtitle.textContent = readOnly ? t('settingsDialog.readOnlySubtitle') : t('settingsDialog.editableSubtitle');
    gSettingsDisplayPlaceholder.textContent = t('settingsDialog.displayPlaceholder');

    gBtnSettingsCancel.textContent = readOnly ? t('settingsDialog.close') : t('settingsDialog.cancel');
    gBtnSettingsConfirm.textContent = t('settingsDialog.confirm');
    gBtnSettingsConfirm.style.display = readOnly ? 'none' : '';

    // Update top-level tab active states
    for (let tlTab of gSettingsTopLevelTabs) {
        tlTab.setAttribute('data-active', tlTab.getAttribute('data-toplevel') === gSettingsTopLevelTab ? 'true' : 'false');
    }

    // Non-game top-level tabs: show placeholder, hide game-settings panels
    let isGameTab = (gSettingsTopLevelTab === 'game');
    if (gSettingsTabRow)   gSettingsTabRow.style.display   = isGameTab ? '' : 'none';
    if (gSettingsBody)     gSettingsBody.style.display     = isGameTab ? '' : 'none';
    if (gSettingsDisplayPlaceholder) gSettingsDisplayPlaceholder.style.display = isGameTab ? '' : 'none';
    if (gSettingsPlaceholderPanel) {
        gSettingsPlaceholderPanel.style.display = isGameTab ? 'none' : 'block';
        if (!isGameTab) {
            if (gSettingsTopLevelTab === 'seat') {
                renderSeatSettingsPanel(gSettingsPlaceholderPanel, readOnly);
            } else if (gSettingsTopLevelTab === 'display') {
                renderDisplaySettingsPanel(gSettingsPlaceholderPanel, readOnly);
            } else {
                gSettingsPlaceholderPanel.textContent = t('settingsDialog.placeholders.' + gSettingsTopLevelTab);
            }
            return;
        }
    }

    // Second-level tab active states
    for (let tab of gSettingsTabs) {
        let tabName = tab.getAttribute('data-tab');
        tab.textContent = t('settingsDialog.tabs.' + tabName);
        tab.setAttribute('data-active', tabName === gSettingsActiveTab ? 'true' : 'false');
    }

    gSettingsBody.className = readOnly ? 'settings-readonly' : '';
    gSettingsBody.innerHTML = '';

    if (gSettingsActiveTab === 'table') {
        renderTableTabBody(gSettingsBody, readOnly);
    } else if (gSettingsActiveTab === 'scoring') {
        renderScoringTabBody(gSettingsBody, readOnly);
    } else if (gSettingsActiveTab === 'general') {
        renderGeneralTabBody(gSettingsBody, readOnly);
    } else if (gSettingsActiveTab === 'levels') {
        renderLevelsTabBody(gSettingsBody, readOnly);
    } else if (gSettingsActiveTab === 'timing') {
        renderTimingTabBody(gSettingsBody, readOnly);
    } else {
        let grid = document.createElement('div');
        grid.className = 'settings-grid';
        let fields = SETTINGS_FIELDS_BY_TAB[gSettingsActiveTab] || [];
        for (let field of fields) {
            grid.appendChild(createSettingsFieldEl(field, readOnly));
        }
        gSettingsBody.appendChild(grid);
    }
}

function openSettingsDialog(mode) {
    ensureResolvedSettings();
    gSettingsMode = mode;
    gSettingsActiveTab = 'table';
    gSettingsTopLevelTab = 'game';

    if (mode === 'inspect') {
        let sourceRule = (game && game.gameConfig) ? game.gameConfig : gResolvedGameSettings.ruleConfig;
        gSettingsDraftRuleConfig = cloneRuleConfig(sourceRule);
        gSettingsDraftDisplaySettings = { ...(game && game.displaySettings ? game.displaySettings : gResolvedGameSettings.displaySettings) };
    } else {
        gSettingsDraftRuleConfig = cloneRuleConfig(gResolvedGameSettings.ruleConfig);
        gSettingsDraftDisplaySettings = { ...gResolvedGameSettings.displaySettings };
    }
    gSettingsDraftDisplaySettings.userNaturalPosition = normalize4PUserNaturalPosition(gSettingsDraftDisplaySettings.userNaturalPosition);

    // Sync preset labels to current config state
    syncScoringPresetLabel();
    syncLevelsPresetLabel();
    syncTimingPresetLabel();
    syncMainPresetSelectionByExactMatch();
    resetLevelsMatrixStateFromRuleConfig();

    renderSettingsDialog();
    gSettingsOverlay.style.display = 'block';
    gSettingsDialog.style.display = 'flex';
}

function closeSettingsDialog() {
    if (gSettingsOverlay) gSettingsOverlay.style.display = 'none';
    if (gSettingsDialog) gSettingsDialog.style.display = 'none';
}

function confirmCreateGameFromSettings() {
    if (gSettingsMode !== 'create') {
        closeSettingsDialog();
        return;
    }

    // Note 66: Route 3PDA to non-card live frame shell (replaces Note 62 placeholder block).
    let tableFormat = (gSettingsDraftRuleConfig && gSettingsDraftRuleConfig.tableFormat) || 'normal-4P';
    if (tableFormat === 'three-player-dummy-ally') {
        // Note 91: End any active normal 4P game mode before entering 3PDA scaffold.
        exitNormal4PModeFor3PDAScaffold();
        // Note 68: read user's selected 3PDA real natural seat from settings draft.
        let selectedRealSeat = getDraftUser3PDARealNaturalPosition();
        gThreePDAShellState = createThreePDAShellState('N', selectedRealSeat);
        gThreePDAShellPanelExpanded = false; // Note 67a: default to compact on new shell start
        closeSettingsDialog();
        renderThreePDAShell();
        return;
    }

    let presetName = gSettingsDraftRuleConfig.presetName || 'default';
    let overrides = cloneRuleConfig(gSettingsDraftRuleConfig);
    delete overrides.presetName;

    if (typeof shengjiResolveGameSettings === 'function') {
        gResolvedGameSettings = shengjiResolveGameSettings({
            presetName,
            overrides,
            displayOverrides: gSettingsDraftDisplaySettings,
        });
    } else {
        gResolvedGameSettings = {
            presetName,
            ruleConfig: engineBuildConfig(presetName, overrides),
            displaySettings: { ...gSettingsDraftDisplaySettings },
        };
    }

    pendingNextFrame = null;
    closeSettingsDialog();
    startNewGame();
}

function onFooterSettingsClick() {
    if (game && game.phase && game.phase !== GamePhase.IDLE) {
        openSettingsDialog('inspect');
    } else {
        openSettingsDialog('create');
    }
}

function onNewGameButtonClick() {
    openSettingsDialog('create');
}

function humanPlayCardsCore(cp) {
    if (isPauseDialogBlockingGameplay()) return;
    if (!isHumanControlled(cp)) return;
    if (gCrossingState && gCrossingState.trickPlayBlocked) {
        trySubmitLocalCrossingSelection();
        return;
    }
    let cards = getSelectedCards(cp);

    if (game.phase === GamePhase.BASING) {
        // Basing: set base
        if (cards.length !== BASE_SIZE) {
            showError(t('errors.selectBaseCount', { n: BASE_SIZE }));
            return;
        }
        let deferPlaying = !!(game && game.gameConfig && game.gameConfig.allowOverbase);
        let ok = engineSetBase(cards, { deferPlaying });
        if (!ok) {
            showError(t('errors.baseFailed'));
            return;
        }
        stopPlayerMoveTimer(cp);
        applyBaseTimeIncrementAfterBaseCompletion(cp);
        clearSelection();
        gAutoStrain3rdTriggerCard = null;
        clearDesk();
        appendLog(t('log.humanBaseDone'));
        renderAllHands();
        afterBasingComplete();
        return;
    }

    // Playing phase
    let result = enginePlayCards(cp, cards);
    if (!result.success) {
        showError(result.error);
        return;
    }

    stopPlayerMoveTimer(cp);
    clearSelection();

    if (result.failedMultiplay) {
        handleFailedMultiplay(cp, result.failedMultiplay, cards, result, () => {
            if (result.roundComplete) {
                finishRound();
            } else {
                promptCurrentPlayer();
            }
        });
        return;
    }

    renderDeskCards(cp, cards);
    renderHand(cp);

    // Update exposed previews after each play
    for (let p = 0; p < NUM_PLAYERS; p++) {
        if (p !== HUMAN_PLAYER) updateExposedPreview(p);
    }

    if (result.roundComplete) {
        finishRound();
    } else {
        promptCurrentPlayer();
    }
}

// ---------------------------------------------------------------------------
// Round end
// ---------------------------------------------------------------------------

function finishRound() {
    if (isPauseDialogBlockingGameplay()) return;
    let result = engineEndRound();
    highlightActivePlayer(-1);
    let winnerSlot = getDeskSlotFor4PActorSeat(result.winner);
    if (winnerSlot) winnerSlot.setAttribute('data-winner', 'true');
    updateScoreDisplay();

    // Update attackers' streak (within-frame consecutive attacker round wins)
    if (game.attackingTeam.includes(result.winner)) {
        attackersStreak++;
    } else {
        // Its value resets to zero when attackers lose a round
        attackersStreak = 0;
    }
    updateAttackersStreakDisplay();

    // Track counters won by attackers (§2)
    if (game.attackingTeam.includes(result.winner)) {
        let lastRound = game.roundHistory[game.roundHistory.length - 1];
        for (let i = 0; i < NUM_PLAYERS; i++) {
            if (lastRound.played[i]) {
                for (let c of lastRound.played[i]) {
                    if (engineCounterValue(c) > 0) wonCounterCards.push(c);
                }
            }
        }
        updateCounterDrawer();
    }

    // Update exposed-card previews on name bars (§3.5)
    for (let p = 0; p < NUM_PLAYERS; p++) {
        if (p !== HUMAN_PLAYER) updateExposedPreview(p);
    }

    let winnerName = PLAYER_NAMES[result.winner];
    let msg = t('log.roundResult', { round: game.currentRound - 1, playerName: winnerName, score: result.trickPoints > 0 ? t('log.trickPoints', { points: result.trickPoints }) : '' });
    appendLog(msg);
    updatePhaseDisplay(t('phase.roundWinner', { playerName: winnerName }));

    if (result.gameOver) {
        setTimeout(finishGame, BOT_DELAY);
    } else {
        // Short pause then start next round
        setTimeout(() => {
            clearDesk();
            // Restore exposed-card previews that clearDesk() wiped
            for (let p = 0; p < NUM_PLAYERS; p++) {
                if (p !== HUMAN_PLAYER) updateExposedPreview(p);
            }
            promptCurrentPlayer();
        }, BOT_DELAY * 2);
    }
}

// ---------------------------------------------------------------------------
// Game over
// ---------------------------------------------------------------------------

function finishGame() {
    if (isPauseDialogBlockingGameplay()) return;
    let result = engineFinalize();
    updateScoreDisplay();
    updatePhaseDisplay(t('phase.gameOver'));
    updateStatus(t('status.gameOver'));

    let msg = t('log.finalScore', { totalScore: result.totalScore });
    if (result.baseScore > 0) msg += t('log.baseScoreBonus', { baseScore: result.baseScore });
    appendLog(msg);
    appendLog(result.result);

    gBtnPlay.disabled = true;
    gBtnPlay.textContent = t('buttons.play');
    // Base-score no longer shown in right-top corner (note 25 §2.1)

    // Apply level update (§12)
    if (result.frameResult) {
        let fr = result.frameResult;
        let applied = engineApplyFrameResult(fr);

        // Log level advancement
        let advNames = fr.advancingPlayers.map(p => PLAYER_NAMES[p]).join(', ');
        appendLog(t('log.levelAdvance', { players: advNames, delta: fr.levelDelta }));

        if (applied.gameWon) {
            let winnerNames = applied.winners.map(p => PLAYER_NAMES[p]).join(', ');
            appendLog(t('log.gameWon', { players: winnerNames }));
            updatePhaseDisplay(t('phase.gameWon'));
        } else {
            // Store next frame info
            pendingNextFrame = {
                pivot: applied.nextPivot,
                level: applied.nextLevel,
                playerLevels: applied.newLevels,
                cycleIndexBySide: Array.isArray(applied.newCycleIndexBySide)
                    ? [...applied.newCycleIndexBySide]
                    : null,
            };
            gBtnNewGame.textContent = t('buttons.nextFrame');
        }

        // Show counting-phase dialog (§7)
        showCountingDialog(result, fr, applied);
    }
}

// ---------------------------------------------------------------------------
// Counting-phase dialog (§7)
// ---------------------------------------------------------------------------
function numberToChineseNumeral(n) {
    const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    let value = Math.max(0, Math.floor(Number(n) || 0));
    if (value < 10) return digits[value];
    if (value < 20) return value === 10 ? '十' : ('十' + digits[value - 10]);
    let tens = Math.floor(value / 10);
    let ones = value % 10;
    return digits[tens] + '十' + (ones === 0 ? '' : digits[ones]);
}

function getNaturalSideLabelByPlayer(player) {
    return (player % 2 === 0) ? '南北' : '东西';
}

function countingDialogUsesLightName(gameConfig, levelDelta) {
    if (levelDelta !== 2 && levelDelta !== 3) return false;
    let stageThreshold = (gameConfig && gameConfig.stageThreshold != null) ? Number(gameConfig.stageThreshold) : 80;
    let levelThreshold = (gameConfig && gameConfig.levelThreshold != null) ? Number(gameConfig.levelThreshold) : 40;
    return (
        (stageThreshold === 80 && levelThreshold === 40)
        || (stageThreshold === 76 && levelThreshold === 38)
    );
}

function getCountingDialogResultName(frameResult, gameConfig) {
    if (!frameResult) return '';
    if (frameResult.defenseHolds) {
        if (countingDialogUsesLightName(gameConfig, frameResult.levelDelta) && frameResult.levelDelta === 3) return '大光';
        if (countingDialogUsesLightName(gameConfig, frameResult.levelDelta) && frameResult.levelDelta === 2) return '小光';
        return '下' + numberToChineseNumeral(frameResult.levelDelta);
    }
    if (frameResult.levelDelta === 0) return '上台';
    return '上' + numberToChineseNumeral(frameResult.levelDelta);
}

function getCountingDialogResultDetail(frameResult) {
    if (!frameResult || !Array.isArray(frameResult.advancingPlayers) || frameResult.advancingPlayers.length === 0) return '';
    let sideLabel = getNaturalSideLabelByPlayer(frameResult.advancingPlayers[0]);
    if (!frameResult.defenseHolds && frameResult.levelDelta === 0) return sideLabel + '上台';
    return sideLabel + '升' + String(frameResult.levelDelta) + '级';
}

function renderCountingDialogBase(cdBase) {
    cdBase.innerHTML = '<div id="cd-base-label" class="text">' + t('counting.baseLabel') + '</div>';
    let cardsWrap = document.createElement('div');
    cardsWrap.id = 'cd-base-cards';
    cardsWrap.className = 'hand';
    let sorted = Array.isArray(game.base) ? [...game.base] : [];
    engineSortHand(sorted);
    sorted.forEach((card, index) => {
        let cardEl = gameCreateCardContainer(card);
        cardEl.classList.add('cd-base-card');
        cardEl.style.zIndex = String(index + 1);
        cardsWrap.appendChild(cardEl);
    });
    cdBase.appendChild(cardsWrap);
}

function renderCountingDialogScoreCircle(totalScore) {
    let host = document.getElementById('cd-score-circle');
    if (!host) return;
    host.innerHTML = '';
    let circle = document.createElement('div');
    circle.id = 'cd-score-circle-ring';
    circle.style.borderColor = getScoreBorderColorForValue(totalScore);
    let digits = String(totalScore).length;
    if (digits >= 3) circle.setAttribute('data-digit-fit', 'three');
    else circle.setAttribute('data-digit-fit', 'two');

    let value = document.createElement('div');
    value.id = 'cd-score-circle-value';
    value.textContent = String(totalScore);
    let scoreDigits = String(Math.max(0, Number(totalScore) || 0)).length;
    value.setAttribute('data-score-digits', String(scoreDigits));
    if (scoreDigits >= 3) value.setAttribute('data-score-digit-group', 'three-plus');
    else value.setAttribute('data-score-digit-group', 'one-two');
    circle.appendChild(value);
    host.appendChild(circle);
}

function renderCountingDialogNextFrameSquare(applied) {
    let host = document.getElementById('cd-next-frame');
    if (!host) return;
    if (!applied || !Array.isArray(applied.newLevels)) return;

    let nextCycleIndexBySide = Array.isArray(applied.newCycleIndexBySide)
        ? applied.newCycleIndexBySide
        : (game && game.levelRuleState ? game.levelRuleState.cycleIndexBySide : [0, 0]);
    
    // Get next pivot, allowing it to be undefined
    let nextPivot = (applied && typeof isPivotResolved === 'function' && isPivotResolved(applied.nextPivot))
        ? applied.nextPivot
        : UNDETERMINED_PIVOT;

    renderLevelPositionSquare(host, {
        boxId: 'cd-next-frame-box',
        boxClassName: 'cd-next-frame-box',
        squareId: 'cd-next-frame-square',
        squareClassName: 'cd-next-frame-square',
        triangleClassName: 'cd-next-frame-triangle',
        levelsByActor: applied.newLevels,
        cycleIndexBySide: [
            getSideCycleIndex(nextCycleIndexBySide, 0),
            getSideCycleIndex(nextCycleIndexBySide, 1),
        ],
        pivotSeat: nextPivot,
        referenceActorSeat: HUMAN_PLAYER,
    });
}

function showCountingDialog(result, frameResult, applied) {
    if (!gCountingDialog) return;

    // Canonical settlement source of truth (note 35e): all displayed rows and total
    // must come from the same finalized score-breakdown object.
    let breakdown = result.scoreBreakdown || {
        counterScore: result.counterScore,
        baseScoreBeforeSelfBaseHalf: (result.baseScoreBeforeSelfBaseHalf !== undefined ? result.baseScoreBeforeSelfBaseHalf : result.baseScore),
        baseScoreAfterSelfBaseHalf: (result.baseScoreAfterSelfBaseHalf !== undefined ? result.baseScoreAfterSelfBaseHalf : result.baseScore),
        baseScoreSelfBaseHalfApplied: !!result.baseScoreSelfBaseHalfApplied,
        baseScore: result.baseScore,
        endingCompensation: result.endingCompensation,
        multiplayCompensation: result.multiplayCompensation,
        totalScore: result.totalScore,
    };
    let hasFailedMultiplayEvents = Array.isArray(game.multiplayCompensationEvents) && game.multiplayCompensationEvents.length > 0;
    let handling = (game.gameConfig && game.gameConfig.failedMultiplayHandling) || 'default';
    let multiplayCompEnabled = (handling === 'compensation' || handling === 'lian-zhong-compensation' || !!(game.gameConfig && game.gameConfig.multiplayCompensation));

    // Size: match #desk-bottom width × 2× height
    let deskBottom = document.getElementById('desk-bottom');
    if (deskBottom) {
        let w = deskBottom.offsetWidth;
        let h = deskBottom.offsetHeight * 2;
        gCountingDialog.style.width = Math.round(w * 1.08) + 'px';
        gCountingDialog.style.height = h + 'px';
    }

    let cdBase = document.getElementById('cd-base');
    renderCountingDialogBase(cdBase);

    renderCountingDialogScoreCircle(breakdown.totalScore);

    let cdScore = document.getElementById('cd-score');
    cdScore.innerHTML = '<div class="cd-score-label text">' + t('counting.scoreLabel') + '</div>';
    let deskScore = breakdown.counterScore;
    addScoreRow(cdScore, t('counting.deskScore'), deskScore);
    if (result.attackersWonBase) {
        let baseScoreLabel = t('counting.baseScore');
        addScoreRow(cdScore, baseScoreLabel, breakdown.baseScore);
    }
    if (result.attackersWonBase && breakdown.endingCompensation > 0) {
        addScoreRow(cdScore, t('counting.endingCompensation'), breakdown.endingCompensation);
    }
    if (multiplayCompEnabled && hasFailedMultiplayEvents) {
        addScoreRow(cdScore, t('counting.multiplayCompensation'), breakdown.multiplayCompensation);
    }
    let cdResultName = document.getElementById('cd-result-name');
    cdResultName.textContent = getCountingDialogResultName(frameResult, game.gameConfig || {});
    let cdLevels = document.getElementById('cd-result-levels');
    cdLevels.textContent = getCountingDialogResultDetail(frameResult);

    gCountingOverlay.style.display = 'block';
    gCountingDialog.style.display = 'block';

    renderCountingDialogNextFrameSquare(applied);

    let btnReady = document.getElementById('cd-btn-ready');
    let btnSave = document.getElementById('cd-btn-save');
    let btnLeave = document.getElementById('cd-btn-leave');
    if (btnSave) btnSave.disabled = true;
    btnReady.onclick = () => {
        hideCountingDialog();
        startNewGame();
    };
    btnLeave.onclick = () => {
        hideCountingDialog();
        pendingNextFrame = null;
        // Reset page to initial state
        clearDesk();
        clearLog();
        gReferenceHandSurface.innerHTML = '';
        gBtnNewGame.textContent = t('buttons.newGame');
        updatePhaseDisplay(t('phase.initial'));
        updateStatus(t('status.ready'));
    };

}

function addScoreRow(parent, label, value) {
    let row = document.createElement('div');
    row.className = 'cd-score-row';
    row.innerHTML = '<span class="text">' + label + '</span><span class="cd-score-row-value">' + value + '</span>';
    parent.appendChild(row);
}

function hideCountingDialog() {
    if (gCountingDialog) gCountingDialog.style.display = 'none';
    if (gCountingOverlay) gCountingOverlay.style.display = 'none';
}

// Pending next-frame parameters (set by finishGame, consumed by startNewGame)
let pendingNextFrame = null;

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

gBtnNewGame.addEventListener('click', onNewGameButtonClick);
gBtnPlay.addEventListener('click', humanPlayCards);
if (gBtnPause) {
    gBtnPause.addEventListener('click', () => requestPause(HUMAN_PLAYER));
}
if (gBtnPauseQuitCancel) {
    gBtnPauseQuitCancel.addEventListener('click', () => {
        if (pauseState.phase !== 'waitingQuitConfirm') return;
        pauseState.phase = 'paused';
        renderPauseDialogByState();
    });
}
if (gBtnPauseQuitConfirm) {
    gBtnPauseQuitConfirm.addEventListener('click', () => {
        confirmQuitDuringPause(pauseState.quitRequesterSeat !== null ? pauseState.quitRequesterSeat : HUMAN_PLAYER);
    });
}

if (gBtnGameSettings) {
    gBtnGameSettings.addEventListener('click', onFooterSettingsClick);
}

if (gBotPassiveDeclarationSwitch) {
    gBotPassiveDeclarationSwitch.addEventListener('change', () => {
        setBotDeclarationMode(gBotPassiveDeclarationSwitch.checked ? 'passive' : 'normal');
    });
}

if (gBtnSettingsCancel) {
    gBtnSettingsCancel.addEventListener('click', closeSettingsDialog);
}

if (gBtnSettingsConfirm) {
    gBtnSettingsConfirm.addEventListener('click', confirmCreateGameFromSettings);
}

if (gSettingsOverlay) {
    gSettingsOverlay.addEventListener('click', closeSettingsDialog);
}

for (let tabBtn of gSettingsTabs) {
    tabBtn.addEventListener('click', () => {
        gSettingsActiveTab = tabBtn.getAttribute('data-tab');
        renderSettingsDialog();
    });
}

for (let tlTabBtn of gSettingsTopLevelTabs) {
    tlTabBtn.addEventListener('click', () => {
        gSettingsTopLevelTab = tlTabBtn.getAttribute('data-toplevel');
        renderSettingsDialog();
    });
}

const gBtnGotoRecap = document.getElementById('btn-goto-recap');
if (gBtnGotoRecap) {
    gBtnGotoRecap.addEventListener('click', function (e) {
        e.preventDefault();
        window.location.href = 'index.html';
    });
}

// Keyboard shortcuts
window.addEventListener('keydown', function (e) {
    if (e.code === 'Enter' || e.code === 'Space') {
        if (!gBtnPlay.disabled) {
            e.preventDefault();
            humanPlayCards();
        }
    }
});

// Double click out of cards -> play
window.addEventListener('dblclick', function(e) {
    if (e.target.closest('.card, .card-container, button')) return;
    if (game && game.phase === GamePhase.PLAYING && isHumanControlled(engineGetCurrentPlayer()) && !gBtnPlay.disabled) {
        e.preventDefault();
        humanPlayCards();
    }
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------
ensureDeclarationHistoryHoverBox();
ensureSeatsHoverLevelPositionBox();
if (gDenomArea) {
    gDenomArea.addEventListener('mouseenter', renderDeclarationHistoryRows);
}
if (gSeatsDiv) {
    gSeatsDiv.addEventListener('click', function(e) {
        e.preventDefault();
        toggleSeatsTopLeftBoxView();
    });
}
ensureResolvedSettings();
setSeatsTopLeftBoxView('seats');
syncBotDeclarationModeSwitchUi();
updatePhaseDisplay(t('phase.initial'));
updateStatus(t('status.ready'));
refreshPauseButtonState();
