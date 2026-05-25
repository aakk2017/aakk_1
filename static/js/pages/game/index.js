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

/**
 * Overall-game / shared in-frame boundary contract.
 *
 * Architecture reality: index.js still contains both local-game orchestration
 * and shared in-frame control paths. Semantic boundary is preserved through
 * naming and helpers; physical file split is deferred.
 */
// Canonical flow boundary:
// build frameContext -> run shared in-frame -> consume frame result -> next frame.
function gameBuildFrameContext(params) {
    return buildFourPositionFrameContext(params);
}

function gameIsDA3PSharedFirstFrameActive() {
    return !!(
        game &&
        game.tableFormat === ShengjiTableFormat.DA3P &&
        game.frameContext &&
        game.frameContext.tableFormat === ShengjiTableFormat.DA3P
    );
}

function gameShouldStopDA3PBeforeBasing() {
    return !!(
        game &&
        game.tableFormat === ShengjiTableFormat.DA3P &&
        game.frameContext &&
        game.frameContext.tableFormat === ShengjiTableFormat.DA3P &&
        game.frameContext.pivotStatus !== 'resolved'
    );
}

function gameShouldAutoPlayFrameActor(actor) {
    return !!(
        gameIsDA3PSharedFirstFrameActive() &&
        isSameFrameActor(actor, 'D')
    );
}

function gameGetFrameActorForSeat(seat) {
    if (gameIsDA3PSharedFirstFrameActive()) {
        const handActors = Array.isArray(game.frameActorByHandSeat)
            ? game.frameActorByHandSeat
            : game.frameActorBySeat;
        if (Array.isArray(handActors)) {
            return handActors[seat];
        }
    }
    return seat;
}

function gameGetDisplaySeatForHandSeat(handSeat) {
    if (!gameIsDA3PSharedFirstFrameActive()) {
        return handSeat;
    }

    const actor = gameGetFrameActorForSeat(handSeat);
    const key = frameActorKey(actor);
    if (game.displaySeatByFrameActorKey && Number.isInteger(game.displaySeatByFrameActorKey[key])) {
        return game.displaySeatByFrameActorKey[key];
    }

    if (Array.isArray(game.frameActorByDisplaySeat)) {
        const fallbackSeat = game.frameActorByDisplaySeat.findIndex(a => isSameFrameActor(a, actor));
        if (fallbackSeat >= 0) return fallbackSeat;
    }
    return handSeat;
}

function gameGetDisplayPositionForHandSeat(handSeat) {
    if (!gameIsDA3PSharedFirstFrameActive()) {
        return getDisplayPositionFor4PActorSeat(handSeat);
    }
    const displaySeat = gameGetDisplaySeatForHandSeat(handSeat);
    const displayPositions = ['bottom', 'right', 'top', 'left'];
    return displayPositions[displaySeat] || 'bottom';
}

function gameGetDeskArtifactSlotForSeat(handSeat) {
    const displayPosition = gameGetDisplayPositionForHandSeat(handSeat);
    return getDeskSlotForDisplayPosition(displayPosition);
}

function gameGetReferenceHandSurfaceForSeat(handSeat) {
    const displayPosition = gameGetDisplayPositionForHandSeat(handSeat);
    return displayPosition === 'bottom' ? gReferenceHandSurface : null;
}

function gameGetDeskSlotForSeat(handSeat) {
    return gameGetDeskArtifactSlotForSeat(handSeat);
}

function gameGetFrameActorLabel(actor, options) {
    const locale = getLocale();
    const opts = options || {};
    const compact = locale === 'en'
        ? { N: 'N', Sw: 'Sw', Se: 'Se', D: 'D' }
        : { N: '子', Sw: '申', Se: '辰', D: '明' };
    if (typeof actor === 'string' && Object.prototype.hasOwnProperty.call(compact, actor)) {
        return compact[actor];
    }
    if (Number.isInteger(actor) && actor >= 0 && actor < NUM_PLAYERS) {
        return opts.long ? PLAYER_NAMES[actor] : POSITION_LABELS[actor];
    }
    return String(actor);
}

function gameGetActorLabelForSeat(seat, options) {
    if (gameIsDA3PSharedFirstFrameActive()) {
        return gameGetFrameActorLabel(gameGetFrameActorForSeat(seat), options);
    }
    return gameGetFrameActorLabel(seat, options);
}

function gameGetPlayerLogNameForSeat(seat) {
    if (gameIsDA3PSharedFirstFrameActive()) {
        return gameGetFrameActorLabel(gameGetFrameActorForSeat(seat));
    }
    return PLAYER_NAMES[seat];
}

function gameCanSeatDeclare(seat) {
    if (!gameIsDA3PSharedFirstFrameActive()) return true;
    return canActorDeclareInFrameContext(gameGetFrameActorForSeat(seat), game.frameContext);
}

function gameApplyDA3PSeatControlFromFrameContext(selectedReferenceActor) {
    const handActors = game && Array.isArray(game.frameActorByHandSeat)
        ? game.frameActorByHandSeat
        : (game ? game.frameActorBySeat : null);
    if (!Array.isArray(handActors)) return;
    let seat = handActors.indexOf(selectedReferenceActor);
    if (seat < 0 || !gameCanSeatDeclare(seat)) {
        seat = handActors.findIndex((_, idx) => gameCanSeatDeclare(idx));
    }
    if (seat < 0) seat = 0;
    localControlledPlayerIndex = seat;
    selectedNaturalPositionIndex = seat;
    activeLocalSeat = seat;
    refreshLocallyControlledSeatsForMode();
}

function gameBuildDA3PSharedFirstFrameContext(options) {
    const selectedReferenceActor = getDraftDA3PReferenceActor();
    const startLevel = (gResolvedGameSettings && gResolvedGameSettings.ruleConfig && gResolvedGameSettings.ruleConfig.startLevel !== undefined)
        ? gResolvedGameSettings.ruleConfig.startLevel
        : 0;
    const frameContext = gameBuildFrameContext({
        tableFormat:               ShengjiTableFormat.DA3P,
        frameKind:                 'da3p',
        isQiangzhuangFrame:        true,
        pivotActor:                null,
        pivotStatus:               'unresolved',
        dealAnchor:                null,
        frameActors:               ['N', 'Sw', 'D', 'Se'],
        realActors:                ['N', 'Sw', 'Se'],
        dummyActor:                'D',
        actorKindByKey:            { N: 'real', Sw: 'real', Se: 'real', D: 'temporary-dummy-pile' },
        declarationEligibleActors: ['N', 'Sw', 'Se'],
        nonDeclaringActors:        ['D'],
    });

    const fixedDealAnchor = options && options.fixedDealAnchor
        ? normalizeDA3PDealAnchor(options.fixedDealAnchor)
        : null;
    const dealAnchor = resolveDealAnchorForFrameContext(
        frameContext,
        fixedDealAnchor ? { fixedDealAnchor } : undefined
    );
    const frameActors = get3PDAQZTempLayout(dealAnchor);

    frameContext.dealAnchor = dealAnchor;
    frameContext.frameActors = frameActors;
    frameContext.dealOrder = frameActors;
    frameContext.temporaryFrameOrder = [...frameActors];
    frameContext.canonicalFrameOrder = null;
    frameContext.playOrderSeats = null;
    frameContext.playOrderActorKeys = null;
    frameContext.declarationResolvedActor = null;
    frameContext.declarationResolvedSeat = null;
    frameContext.frameIndex = 0;
    frameContext.frameNumber = 1;
    frameContext.levelsByActor = { N: startLevel, Sw: startLevel, Se: startLevel };
    frameContext.levelCyclesByActor = { N: 0, Sw: 0, Se: 0 };
    frameContext.displayMapBasis = 'temporary-deal-anchor';
    frameContext.displayMap = createDisplayMapFromFrameOrder(frameActors, selectedReferenceActor);
    frameContext.visibilityPolicy = { dummyInitiallyHidden: true };

    return { frameContext, selectedReferenceActor };
}

const DA3P_REAL_ACTORS = Object.freeze(['N', 'Sw', 'Se']);

function gameCloneDA3PActorLevels(levelsByActor, fallbackLevel) {
    let fallback = Number.isInteger(fallbackLevel) ? fallbackLevel : 0;
    let out = {};
    for (let actor of DA3P_REAL_ACTORS) {
        let level = levelsByActor ? Number(levelsByActor[actor]) : NaN;
        out[actor] = Number.isInteger(level) ? level : fallback;
    }
    return out;
}

function gameCloneDA3PActorCycles(levelCyclesByActor) {
    let out = {};
    for (let actor of DA3P_REAL_ACTORS) {
        let cycleIndex = levelCyclesByActor ? Number(levelCyclesByActor[actor]) : NaN;
        out[actor] = Number.isInteger(cycleIndex) && cycleIndex >= 0 ? cycleIndex : 0;
    }
    return out;
}

function gameCloneDA3PAttackerDeskScoreSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || !snapshot.scoreByActor) return null;
    let successorActor = frameActorKey(snapshot.successorActor);
    let predecessorActor = frameActorKey(snapshot.predecessorActor);
    if (!successorActor || !predecessorActor) return null;

    let scoreByActor = {};
    scoreByActor[successorActor] = Number(snapshot.scoreByActor[successorActor]) || 0;
    scoreByActor[predecessorActor] = Number(snapshot.scoreByActor[predecessorActor]) || 0;

    return {
        frameIndex: Number.isInteger(snapshot.frameIndex) ? snapshot.frameIndex : null,
        frameNumber: Number.isInteger(snapshot.frameNumber) ? snapshot.frameNumber : null,
        pivotActor: frameActorKey(snapshot.pivotActor),
        canonicalFrameOrderKeys: Array.isArray(snapshot.canonicalFrameOrderKeys)
            ? snapshot.canonicalFrameOrderKeys.map(frameActorKey)
            : null,
        successorActor,
        predecessorActor,
        scoreByActor,
        deskScoreTotal: (Number(scoreByActor[successorActor]) || 0) + (Number(scoreByActor[predecessorActor]) || 0),
    };
}

function gameGetDA3PSkipLevelSet() {
    let cfg = game && game.gameConfig ? game.gameConfig : (gResolvedGameSettings ? gResolvedGameSettings.ruleConfig : null);
    let skipLevels = cfg && Array.isArray(cfg.skipLevels) ? cfg.skipLevels : [];
    return new Set(skipLevels.filter(v => Number.isInteger(v) && v >= 0 && v <= 12));
}

function gameAdvanceDA3PLevelState(level, cycleIndex, delta, skipLevelSet) {
    let nextLevel = Number(level);
    if (!Number.isInteger(nextLevel)) nextLevel = 0;
    let nextCycle = Number(cycleIndex);
    if (!Number.isInteger(nextCycle) || nextCycle < 0) nextCycle = 0;

    let steps = Math.max(0, Math.floor(Number(delta) || 0));
    let safety = 0;
    while (steps > 0 && safety < 256) {
        safety++;
        nextLevel = (nextLevel + 1) % 13;
        if (nextLevel === 0) nextCycle += 1;
        if (skipLevelSet && skipLevelSet.size > 0 && skipLevelSet.has(nextLevel)) {
            continue;
        }
        steps -= 1;
    }

    return { level: nextLevel, cycleIndex: nextCycle };
}

function gameBuildDA3PPlayerLevelsForEngine(frameContext) {
    let fallback = (gResolvedGameSettings && gResolvedGameSettings.ruleConfig && Number.isInteger(gResolvedGameSettings.ruleConfig.startLevel))
        ? gResolvedGameSettings.ruleConfig.startLevel
        : 0;
    let actorLevels = gameCloneDA3PActorLevels(frameContext && frameContext.levelsByActor, fallback);
    let frameActors = Array.isArray(frameContext && frameContext.frameActors) ? frameContext.frameActors : [];
    let out = [fallback, fallback, fallback, fallback];
    let pivotActor = frameContext && frameContext.pivotActor;
    let pivotFallback = (pivotActor && Object.prototype.hasOwnProperty.call(actorLevels, pivotActor))
        ? actorLevels[pivotActor]
        : fallback;
    for (let seat = 0; seat < NUM_PLAYERS; seat++) {
        let actor = frameActors[seat];
        if (actor === 'D') {
            out[seat] = pivotFallback;
            continue;
        }
        let level = Number(actorLevels[actor]);
        out[seat] = Number.isInteger(level) ? level : fallback;
    }
    return out;
}

function gameBuildDA3PFrameContextFromProgression(options) {
    const opts = options || {};
    const selectedReferenceActor = normalizeDA3PReferenceActor(
        opts.selectedReferenceActor || (game && game.da3pSelectedReferenceActor) || getDraftDA3PReferenceActor()
    );

    const isQiangzhuangFrame = !!opts.isQiangzhuangFrame;
    const pivotActor = isQiangzhuangFrame ? null : normalizeDA3PDealAnchor(opts.pivotActor);
    const pivotStatus = isQiangzhuangFrame ? 'unresolved' : 'resolved';
    const frameIndex = Number.isInteger(opts.frameIndex) && opts.frameIndex >= 0 ? opts.frameIndex : 0;
    const frameNumber = Number.isInteger(opts.frameNumber) && opts.frameNumber >= 1 ? opts.frameNumber : (frameIndex + 1);

    const fallbackLevel = (gResolvedGameSettings && gResolvedGameSettings.ruleConfig && Number.isInteger(gResolvedGameSettings.ruleConfig.startLevel))
        ? gResolvedGameSettings.ruleConfig.startLevel
        : 0;
    const levelsByActor = gameCloneDA3PActorLevels(opts.levelsByActor, fallbackLevel);
    const levelCyclesByActor = gameCloneDA3PActorCycles(opts.levelCyclesByActor);

    const baseContext = gameBuildFrameContext({
        tableFormat:               ShengjiTableFormat.DA3P,
        frameKind:                 'da3p',
        isQiangzhuangFrame,
        pivotActor,
        pivotStatus,
        dealAnchor:                null,
        frameActors:               ['N', 'Sw', 'D', 'Se'],
        realActors:                ['N', 'Sw', 'Se'],
        dummyActor:                'D',
        actorKindByKey:            { N: 'real', Sw: 'real', Se: 'real', D: 'temporary-dummy-pile' },
        declarationEligibleActors: ['N', 'Sw', 'Se'],
        nonDeclaringActors:        ['D'],
    });

    const fixedDealAnchor = isQiangzhuangFrame ? normalizeDA3PDealAnchor(opts.fixedDealAnchor || generateDA3PDealAnchor()) : null;
    const dealAnchor = resolveDealAnchorForFrameContext(baseContext, fixedDealAnchor ? { fixedDealAnchor } : undefined);
    const frameActors = get3PDAQZTempLayout(dealAnchor);
    const canonicalFrameOrder = pivotStatus === 'resolved' ? createDA3PCanonicalFrameOrderForPivot(pivotActor) : null;
    const displayBasisOrder = Array.isArray(canonicalFrameOrder) ? canonicalFrameOrder : frameActors;
    const displayMap = createDisplayMapFromFrameOrder(displayBasisOrder, selectedReferenceActor);

    baseContext.dealAnchor = dealAnchor;
    baseContext.frameActors = frameActors;
    baseContext.dealOrder = frameActors;
    baseContext.temporaryFrameOrder = [...frameActors];
    baseContext.canonicalFrameOrder = Array.isArray(canonicalFrameOrder) ? [...canonicalFrameOrder] : null;
    baseContext.playOrderSeats = null;
    baseContext.playOrderActorKeys = Array.isArray(canonicalFrameOrder)
        ? canonicalFrameOrder.map(frameActorKey)
        : null;
    baseContext.declarationResolvedActor = pivotStatus === 'resolved' ? pivotActor : null;
    baseContext.declarationResolvedSeat = pivotStatus === 'resolved' ? frameActors.indexOf(pivotActor) : null;
    baseContext.frameIndex = frameIndex;
    baseContext.frameNumber = frameNumber;
    baseContext.levelsByActor = levelsByActor;
    baseContext.levelCyclesByActor = levelCyclesByActor;
    baseContext.displayMapBasis = Array.isArray(canonicalFrameOrder) ? 'canonical-pivot-resolved' : 'temporary-deal-anchor';
    baseContext.displayMap = displayMap;
    baseContext.visibilityPolicy = { dummyInitiallyHidden: true };

    return { frameContext: baseContext, selectedReferenceActor };
}

function gameStartDA3PSharedFrameFromContext(frameContext, selectedReferenceActor) {
    beginNewSessionBoundary(UiSessionKind.DA3P_SHARED_FRAME);
    resetBoardSurfacesForNewSession(UiSessionKind.DA3P_SHARED_FRAME);
    ensureResolvedSettings();
    clearTimers();

    let context = frameContext;
    let referenceActor = normalizeDA3PReferenceActor(selectedReferenceActor || getDraftDA3PReferenceActor());
    if (!context) {
        const built = gameBuildDA3PSharedFirstFrameContext();
        context = built.frameContext;
        referenceActor = built.selectedReferenceActor;
    }

    let levelSourceActor = (context.pivotStatus === 'resolved' && context.pivotActor && context.pivotActor !== 'D')
        ? context.pivotActor
        : 'N';
    let level = Number(context.levelsByActor && context.levelsByActor[levelSourceActor]);
    if (!Number.isInteger(level)) {
        level = (gResolvedGameSettings.ruleConfig && gResolvedGameSettings.ruleConfig.startLevel !== undefined)
            ? gResolvedGameSettings.ruleConfig.startLevel
            : 0;
    }

    frameNumber = Number.isInteger(context.frameNumber) ? context.frameNumber : 1;
    attackersStreak = 0;
    wonCounterCards = [];
    updateCounterDrawer();
    document.getElementById('div-table-number').textContent = frameNumber;

    const declarationOrderAnchor = Array.isArray(context.frameActors)
        ? context.frameActors.indexOf(context.dealAnchor)
        : 0;
    const pivotSeatForEngine = (context.pivotStatus === 'resolved' && Array.isArray(context.frameActors))
        ? context.frameActors.indexOf(context.pivotActor)
        : UNDETERMINED_PIVOT;
    const playerLevelsForEngine = gameBuildDA3PPlayerLevelsForEngine(context);

    engineStartGame(
        level,
        pivotSeatForEngine,
        playerLevelsForEngine,
        !!context.isQiangzhuangFrame,
        gResolvedGameSettings.ruleConfig,
        declarationOrderAnchor >= 0 ? declarationOrderAnchor : 0
    );

    game.tableFormat = ShengjiTableFormat.DA3P;
    game.frameContext = context;
    game.da3pLevelsByActor = gameCloneDA3PActorLevels(context.levelsByActor, level);
    game.da3pLevelCyclesByActor = gameCloneDA3PActorCycles(context.levelCyclesByActor);

    game.frameActorByHandSeat = [...context.frameActors];
    game.handSeatByFrameActorKey = {};
    for (let seat = 0; seat < game.frameActorByHandSeat.length; seat++) {
        game.handSeatByFrameActorKey[frameActorKey(game.frameActorByHandSeat[seat])] = seat;
    }
    game.frameActorByDisplaySeat = [
        context.displayMap.bottom,
        context.displayMap.right,
        context.displayMap.top,
        context.displayMap.left,
    ];
    game.displaySeatByFrameActorKey = {};
    for (let seat = 0; seat < game.frameActorByDisplaySeat.length; seat++) {
        game.displaySeatByFrameActorKey[frameActorKey(game.frameActorByDisplaySeat[seat])] = seat;
    }
    game.frameActorBySeat = game.frameActorByHandSeat;
    game.seatByFrameActorKey = game.handSeatByFrameActorKey;
    game.playOrderSeats = null;
    game.playOrderActorKeys = null;

    game.da3pFlowStatus = context.pivotStatus === 'resolved'
        ? 'shared-basing-playing'
        : 'shared-dealing-declaration';
    game.da3pStopBeforeBasing = context.pivotStatus !== 'resolved';
    game.da3pSelectedReferenceActor = referenceActor;
    game.displaySettings = {
        placeholder: true,
        userNaturalPosition: 'east',
        selectedDA3PReferenceActor: referenceActor,
        ...(gResolvedGameSettings.displaySettings || {})
    };

    if (context.pivotStatus === 'resolved' && context.pivotActor) {
        gameApplyDA3PResolvedPivotReframe(context.pivotActor);
        engineResetDA3PAttackerDeskScoreForCurrentFrame();
    }

    gameApplyDA3PSeatControlFromFrameContext(referenceActor);
    initPersistentNamebars();
    gLevelDiv.textContent = levelDisplayLabel(game.level);
    setSeatsTopLeftBoxView('seats');
    refreshTopLeftSeatAndLevelPositionBoxFromGameState();

    clearDA3PFrameStartBoard();
    gameResetTopDummyRevealState();
    clearTopDummyHandSurface();
    gameResetSideDummyRevealState();
    clearSideDummyHandSurfaces();
    runFrameIntermittent();
    refreshPauseButtonState();
}

function gameStartDA3PSharedFirstFrameFromSettings() {
    ensureResolvedSettings();
    const fixedDealAnchor = (typeof window !== 'undefined' && window.__NOTE111F_TEST_FIXED_DEAL_ANCHOR)
        ? normalizeDA3PDealAnchor(window.__NOTE111F_TEST_FIXED_DEAL_ANCHOR)
        : null;
    const built = gameBuildDA3PSharedFirstFrameContext({ fixedDealAnchor });
    gameStartDA3PSharedFrameFromContext(built.frameContext, built.selectedReferenceActor);
}

function gameStopDA3PBeforeBasing(reasonText, options) {
    const opts = options || {};
    const phaseText = opts.phaseText || t('phase.da3pStoppedBeforeBasing');
    const statusText = opts.statusText || t('status.da3pStoppedBeforeBasing');
    const logText = reasonText || statusText;
    game.dealingStage = DealingStage.NONE;
    game.phase = GamePhase.IDLE;
    game.da3pFlowStatus = 'stopped-before-basing';
    clearSelection();
    removeNoDeclareButton();
    gBtnPlay.disabled = true;
    gBtnPlay.textContent = t('buttons.play');
    updatePhaseDisplay(phaseText);
    updateStatus(statusText);
    if (gDeskInfo) gDeskInfo.textContent = logText;
    appendLog(logText);
    refreshPauseButtonState();
}

function gameApplyDA3PResolvedPivotReframe(pivotActor) {
    if (!gameIsDA3PSharedFirstFrameActive() || !game || !game.frameContext) return false;
    const frameContext = game.frameContext;
    const canonicalFrameOrder = createDA3PCanonicalFrameOrderForPivot(pivotActor);
    if (!Array.isArray(canonicalFrameOrder)) return false;

    const selectedReferenceActor = normalizeDA3PReferenceActor(
        game.da3pSelectedReferenceActor || getDraftDA3PReferenceActor()
    );
    const displayMap = createDisplayMapFromFrameOrder(canonicalFrameOrder, selectedReferenceActor);

    const handActors = Array.isArray(game.frameActorByHandSeat)
        ? game.frameActorByHandSeat
        : (Array.isArray(game.frameActorBySeat) ? game.frameActorBySeat : frameContext.frameActors);

    frameContext.pivotActor = pivotActor;
    frameContext.pivotStatus = 'resolved';
    frameContext.declarationResolvedActor = pivotActor;
    frameContext.declarationResolvedSeat = handActors.indexOf(pivotActor);
    frameContext.temporaryFrameOrder = Array.isArray(frameContext.temporaryFrameOrder)
        ? [...frameContext.temporaryFrameOrder]
        : [...handActors];
    frameContext.canonicalFrameOrder = [...canonicalFrameOrder];
    frameContext.displayMap = { ...displayMap };
    frameContext.displayMapBasis = 'canonical-pivot-resolved';

    game.frameActorByHandSeat = [...handActors];
    game.handSeatByFrameActorKey = {};
    for (let seat = 0; seat < game.frameActorByHandSeat.length; seat++) {
        game.handSeatByFrameActorKey[frameActorKey(game.frameActorByHandSeat[seat])] = seat;
    }

    const playOrderSeats = canonicalFrameOrder.map(actor => game.handSeatByFrameActorKey[frameActorKey(actor)]);
    const validPlayOrder =
        playOrderSeats.length === 4
        && playOrderSeats.every(seat => Number.isInteger(seat) && seat >= 0 && seat < NUM_PLAYERS)
        && (new Set(playOrderSeats)).size === 4;
    if (!validPlayOrder) {
        frameContext.playOrderSeats = null;
        frameContext.playOrderActorKeys = null;
        game.playOrderSeats = null;
        game.playOrderActorKeys = null;
        return false;
    }
    frameContext.playOrderSeats = [...playOrderSeats];
    frameContext.playOrderActorKeys = canonicalFrameOrder.map(frameActorKey);
    game.playOrderSeats = [...playOrderSeats];
    game.playOrderActorKeys = [...frameContext.playOrderActorKeys];

    game.frameActorByDisplaySeat = [displayMap.bottom, displayMap.right, displayMap.top, displayMap.left];
    game.displaySeatByFrameActorKey = {};
    for (let seat = 0; seat < game.frameActorByDisplaySeat.length; seat++) {
        game.displaySeatByFrameActorKey[frameActorKey(game.frameActorByDisplaySeat[seat])] = seat;
    }

    // Compatibility aliases remain ownership-based.
    game.frameActorBySeat = game.frameActorByHandSeat;
    game.seatByFrameActorKey = game.handSeatByFrameActorKey;
    game.da3pStopBeforeBasing = false;
    game.da3pFlowStatus = 'shared-basing-playing';
    return true;
}

function gameResetNormal4PSharedRuntimeFields() {
    if (!game) return;
    game.tableFormat = ShengjiTableFormat.NORMAL_4P;
    game.frameContext = null;
    game.frameActorBySeat = null;
    game.seatByFrameActorKey = null;
    game.frameActorByHandSeat = null;
    game.handSeatByFrameActorKey = null;
    game.frameActorByDisplaySeat = null;
    game.displaySeatByFrameActorKey = null;
    game.playOrderSeats = null;
    game.playOrderActorKeys = null;
    game.da3pFlowStatus = null;
    game.da3pStopBeforeBasing = false;
    game.da3pSelectedReferenceActor = null;
    game.da3pLevelsByActor = null;
    game.da3pLevelCyclesByActor = null;
    gameResetTopDummyRevealState();
    clearTopDummyHandSurface();
    gameResetSideDummyRevealState();
    clearSideDummyHandSurfaces();
}

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------
// gReferenceHandSurface: the bottom display hand surface — reference player's interactive hand.
const gReferenceHandSurface = document.getElementById('hand-bottom');
const gTopDummyHandSurface = document.getElementById('hand-top');
const gLeftDummyHandSurface = document.getElementById('hand-left');
const gRightDummyHandSurface = document.getElementById('hand-right');

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

function getReferencePositionFor4PActorSeat(actorSeat, referenceActorSeat = selectedNaturalPositionIndex) {
    let seat = Number(actorSeat);
    let reference = Number(referenceActorSeat);
    if (!Number.isInteger(seat) || !Number.isInteger(reference)) return 'reference';
    return FOUR_P_REFERENCE_POSITIONS[(seat - reference + NUM_PLAYERS) % NUM_PLAYERS];
}

function getDisplayPositionForReferencePosition(referencePosition) {
    return FOUR_P_REFERENCE_TO_DISPLAY_POSITION[referencePosition] || 'bottom';
}

function getDisplayPositionFor4PActorSeat(actorSeat, referenceActorSeat = selectedNaturalPositionIndex) {
    return getDisplayPositionForReferencePosition(getReferencePositionFor4PActorSeat(actorSeat, referenceActorSeat));
}

function getActorSeatFor4PDisplayPosition(displayPosition, referenceActorSeat = selectedNaturalPositionIndex) {
    let referencePosition = FOUR_P_DISPLAY_TO_REFERENCE_POSITION[displayPosition] || 'reference';
    let offset = FOUR_P_REFERENCE_POSITIONS.indexOf(referencePosition);
    let reference = Number(referenceActorSeat);
    if (!Number.isInteger(reference) || offset < 0) return getActorSeatFor4PNaturalPosition('east');
    return (reference + offset) % NUM_PLAYERS;
}

function getReferencePositionForDisplayPosition(displayPosition) {
    return FOUR_P_DISPLAY_TO_REFERENCE_POSITION[displayPosition] || 'reference';
}

function getActorSeatFor4PReferencePosition(referencePosition, referenceActorSeat = selectedNaturalPositionIndex) {
    let offset = FOUR_P_REFERENCE_POSITIONS.indexOf(referencePosition);
    let reference = Number(referenceActorSeat);
    if (!Number.isInteger(reference) || offset < 0) return reference;
    return (reference + offset) % NUM_PLAYERS;
}

function getHandSurfaceForDisplayPosition(displayPosition) {
    // Only 'bottom' has an interactive hand surface in 4P; top/left/right are desk-slot only.
    return displayPosition === 'bottom' ? gReferenceHandSurface : null;
}

function getNamebarContainerFor4PActorSeat(actorSeat, referenceActorSeat = selectedNaturalPositionIndex) {
    let slot = getDeskSlotFor4PActorSeat(actorSeat, referenceActorSeat);
    return slot ? slot.querySelector('.desk-namebar') : null;
}

function getDeskSlotForDisplayPosition(displayPosition) {
    return gDeskDisplaySlots[displayPosition] || null;
}

function getDeskSlotFor4PActorSeat(actorSeat, referenceActorSeat = selectedNaturalPositionIndex) {
    return getDeskSlotForDisplayPosition(getDisplayPositionFor4PActorSeat(actorSeat, referenceActorSeat));
}

for (let position in gDeskDisplaySlots) {
    if (gDeskDisplaySlots[position]) gDeskDisplaySlots[position].setAttribute('data-display-position', position);
}

function buildLocallyControlledSeatsForCurrentMode() {
    let primary = Number.isInteger(Number(localControlledPlayerIndex)) ? Number(localControlledPlayerIndex) : getActorSeatFor4PNaturalPosition('east');
    if (!TEST_MODE) return new Set([primary]);
    return new Set([primary, (primary + 1) % NUM_PLAYERS]);
}

function refreshLocallyControlledSeatsForMode() {
    locallyControlledSeats = buildLocallyControlledSeatsForCurrentMode();
}

function applyUserNaturalPositionFor4P(userNaturalPosition) {
    let seat = getActorSeatFor4PNaturalPosition(userNaturalPosition);
    localControlledPlayerIndex = seat;        // Note 103b: control identity
    selectedNaturalPositionIndex = seat;      // Note 103b: display/reference perspective matches control in local 4P
    activeLocalSeat = localControlledPlayerIndex;
    refreshLocallyControlledSeatsForMode();
}

// ---------------------------------------------------------------------------
// Test mode: human controls the selected reference seat, plus its afterhand.
// ---------------------------------------------------------------------------
let TEST_MODE = false;
let locallyControlledSeats = buildLocallyControlledSeatsForCurrentMode();
function isLocallyControlledSeat(player) { return locallyControlledSeats.has(player); }

function toggleTestMode() {
    TEST_MODE = !TEST_MODE;
    refreshLocallyControlledSeatsForMode();
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

// Track which locally controlled seat's hand is currently displayed
let activeLocalSeat = localControlledPlayerIndex;

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

// ---------------------------------------------------------------------------
// Card selection state
// ---------------------------------------------------------------------------
let selectedCardIds = new Set();

// Bot turn delay (ms)
const BOT_DELAY = 600;

// Session epoch/token (Note 108a): monotonically increasing value.
// Incremented at every new-session boundary.  Async callbacks capture the
// epoch at scheduling time and return early if the epoch no longer matches.
let gUiSessionEpoch = 0;

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
let gDeskCardsBySeat = [[], [], [], []];

// Sequential overbase decision state (note 41)
let gOverbaseDecision = null;

// Declaration-history hover-box state (note 41f)
let gDeclarationHistoryRows = [];
let gDeclHistoryBox = null;
let gDeclHistoryTbody = null;
let gSeatsHoverLevelPositionBox = null;
let gSeatsTopLeftBoxView = 'seats';
let gDA3PTopDummyRevealState = { revealed: false, reason: '' };
let gDA3PSideDummyRevealState = {
    revealed: false,
    folded: false,
    displayPosition: null,
    dummySeat: null,
    reason: '',
};

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
        let humanRelPivot = (game.pivot + 4 - selectedNaturalPositionIndex) % NUM_PLAYERS;
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
// Session lifecycle (Note 108a)
// ---------------------------------------------------------------------------

/**
 * Session kind identifiers for the new-session boundary.
 * Every active UI session must be one of these kinds.
 */
const UiSessionKind = Object.freeze({
    IDLE:                   'idle',
    NORMAL_4P:              'normal-4p',
    DA3P_SHARED_FRAME:      'da3p-shared-frame',
});

function bumpUiSessionEpoch() {
    gUiSessionEpoch += 1;
    return gUiSessionEpoch;
}

function getCurrentUiSessionEpoch() {
    return gUiSessionEpoch;
}

function isCurrentUiSessionEpoch(epoch) {
    return epoch === gUiSessionEpoch;
}

/**
 * Shared new-session termination boundary (Note 108a).
 *
 * Must be called at the start of every new session/shell before any
 * new UI state is set.  Terminates the previous session by:
 *   1. Bumping the session epoch  (invalidates stale async callbacks).
 *   2. Stopping all active timers.
 *   3. Resetting pause protocol state.
 *   4. Clearing selection and action state.
 *   5. Resetting crossing/overbase state.
 *   6. Clearing the DA3P frame-start board when the next session is not a DA3P session.
 *   7. Clearing shared game-start UI surfaces (Note 105).
 *
 * This function is idempotent and null-safe.
 *
 * @param {string} nextSessionKind  One of UiSessionKind.
 */
function beginNewSessionBoundary(nextSessionKind) {
    // 1. Bump epoch — stale async callbacks will see a mismatch and return early.
    bumpUiSessionEpoch();

    // 2. Stop active timers.
    if (dealingTimer) { clearInterval(dealingTimer); dealingTimer = null; }
    if (gFrameIntermittentTimeout) {
        clearTimeout(gFrameIntermittentTimeout);
        gFrameIntermittentTimeout = null;
        gFrameIntermittentEndsAt = 0;
    }
    clearTimers(); // clears gTimerInterval and shot-clock state

    // 3. Reset pause protocol.
    clearPauseProtocolStateToIdle();
    hidePauseDialog();
    if (pauseState.frozenSnapshot) pauseState.frozenSnapshot = null;
    if (pauseState.pendingResumePrompt) pauseState.pendingResumePrompt = false;

    // 4. Clear selection and action state.
    if (typeof clearSelection === 'function') clearSelection();
    currentDeclaration = null;
    gAutoStrain3rdTriggerCard = null;
    gAutoStrain3rdTriggered = false;

    // 5. Reset crossing/overbase state.
    gCrossingState = null;
    if (typeof hideLocalCrossingActionButtons === 'function') hideLocalCrossingActionButtons();
    if (typeof clearCrossingSeatStatuses === 'function') clearCrossingSeatStatuses();
    gOverbaseDecision = null;

    // 6. Clear DA3P auxiliary board residue unless the next session is itself DA3P shared flow.
    if (nextSessionKind !== UiSessionKind.DA3P_SHARED_FRAME) {
        clearDA3PFrameStartBoard();
    }

    // 7. Clear shared new-game UI surfaces (Note 105 — still applies).
    clearSharedGameStartUiStateForNewGame();
    gameSetFCModeSelectorVisible(false);
}

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
    if (gameIsDA3PSharedFirstFrameActive()) {
        initPersistentNamebarsForFrameContext(game.frameContext);
        return;
    }
    initPersistentNamebarsForNormal4P();
}

function initPersistentNamebarsForNormal4P() {
    [gReferenceHandSurface, ...gDeskSlots].forEach(container => {
        if (container) container.querySelectorAll('.desk-namebar').forEach(el => el.remove());
    });
    gDeskNamebars = [];
    // Create persistent name bars for all players
    for (let p = 0; p < NUM_PLAYERS; p++) {
        let isReferencePlayer = (p === selectedNaturalPositionIndex);
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
        nameArea.textContent = isReferencePlayer
            ? t('players.youShort')
            : t('players.botShort');
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

function initPersistentNamebarsForFrameContext(frameContext) {
    [gReferenceHandSurface, ...gDeskSlots].forEach(container => {
        if (container) container.querySelectorAll('.desk-namebar').forEach(el => el.remove());
    });
    gDeskNamebars = [null, null, null, null];

    const handActors = Array.isArray(game && game.frameActorByHandSeat)
        ? game.frameActorByHandSeat
        : (Array.isArray(game && game.frameActorBySeat) ? game.frameActorBySeat : (frameContext && frameContext.frameActors) || []);
    let displayMap = null;
    if (frameContext && frameContext.displayMap && frameContext.displayMap.bottom !== undefined) {
        displayMap = frameContext.displayMap;
    } else if (Array.isArray(game && game.frameActorByDisplaySeat) && game.frameActorByDisplaySeat.length === 4) {
        displayMap = {
            bottom: game.frameActorByDisplaySeat[0],
            right: game.frameActorByDisplaySeat[1],
            top: game.frameActorByDisplaySeat[2],
            left: game.frameActorByDisplaySeat[3],
        };
    } else {
        const selectedReferenceActor = normalizeDA3PReferenceActor((game && game.da3pSelectedReferenceActor) || getDraftDA3PReferenceActor());
        displayMap = createDisplayMapFromFrameOrder(handActors, selectedReferenceActor);
    }
    const displayOrder = ['bottom', 'right', 'top', 'left'];

    for (let i = 0; i < displayOrder.length; i++) {
        const displayPosition = displayOrder[i];
        const actor = displayMap[displayPosition];
        const seat = handActors.findIndex(a => isSameFrameActor(a, actor));
        const isReferencePlayer = displayPosition === 'bottom';
        const container = isReferencePlayer ? gReferenceHandSurface : getDeskSlotForDisplayPosition(displayPosition);
        if (!container) continue;

        let old = container.querySelector('.desk-namebar');
        if (old) old.remove();

        let nb = document.createElement('div');
        nb.className = isReferencePlayer ? 'desk-namebar reference-hand-namebar' : 'desk-namebar';
        nb.setAttribute('data-status', 'idle');
        if (seat >= 0) nb.setAttribute('data-actor-seat', String(seat));
        nb.setAttribute('data-display-position', displayPosition);
        nb.setAttribute('data-frame-actor', frameActorKey(actor));
        nb.setAttribute('data-actor-kind', getFrameActorKind(frameContext, actor));

        let posArea = document.createElement('div');
        posArea.className = 'game-position-area';
        posArea.textContent = gameGetFrameActorLabel(actor);
        nb.appendChild(posArea);

        let nameArea = document.createElement('div');
        nameArea.className = 'name-area';
        nameArea.textContent = isReferencePlayer ? t('players.youShort') : t('players.botShort');
        nb.appendChild(nameArea);

        if (!isReferencePlayer) {
            let preview = document.createElement('div');
            preview.className = 'exposed-preview';
            nb.appendChild(preview);
        }

        container.appendChild(nb);
        if (seat >= 0 && seat < NUM_PLAYERS) {
            gDeskNamebars[seat] = nb;
            gCrossingSeatStatuses[seat] = null;
        }
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

    // Note 115c: when dummy full hand is visible, suppress hanging-corner preview
    // and render exposed style directly in the visible dummy hand.
    if (gameIsDummyFullHandVisibleForSeat(player)) {
        preview.classList.remove('has-exposed');
        let slot = gameGetDeskSlotForSeat(player);
        if (slot) slot.removeAttribute('data-has-exposed');
        return;
    }

    let exposed = game.exposedCards && game.exposedCards[player];
    if (!exposed || Object.keys(exposed).length === 0) {
        preview.classList.remove('has-exposed');
        let emptySlot = gameGetDeskSlotForSeat(player);
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
    let exposedSlot = gameGetDeskSlotForSeat(player);
    if (exposedSlot) exposedSlot.setAttribute('data-has-exposed', '');
}

function gameIsDummyFullHandVisibleForSeat(playerSeat) {
    if (!Number.isInteger(playerSeat)) return false;
    let dummySeat = gameGetDA3PDummyHandSeat();
    if (!Number.isInteger(dummySeat) || playerSeat !== dummySeat) return false;

    let topVisible = !!(gDA3PTopDummyRevealState && gDA3PTopDummyRevealState.revealed && gameCanRevealTopDummyHandNow());
    let sideVisible = !!(
        gDA3PSideDummyRevealState
        && gDA3PSideDummyRevealState.revealed
        && !gDA3PSideDummyRevealState.folded
        && gameCanRevealSideDummyHandNow()
    );
    return topVisible || sideVisible;
}

function gameShouldUseVisibleDummyHandForFC() {
    if (!gFCInteraction || !Number.isInteger(gFCInteraction.target)) return false;
    if (!isLocallyControlledSeat(gFCInteraction.controller)) return false;
    return gameIsDummyFullHandVisibleForSeat(gFCInteraction.target);
}

function gameIsUnfoldedSideDummyFCLocalMode() {
    if (!gFCInteraction || !gDA3PSideDummyRevealState) return false;
    if (!gDA3PSideDummyRevealState.revealed || gDA3PSideDummyRevealState.folded) return false;
    if (!Number.isInteger(gDA3PSideDummyRevealState.dummySeat)) return false;
    if (gFCInteraction.target !== gDA3PSideDummyRevealState.dummySeat) return false;
    return !!gFCInteraction.useVisibleDummyHand;
}

function gameMountForehandControlOnTargetNamebar(targetPlayer) {
    if (!gFCInteraction) return;
    let nb = gDeskNamebars[targetPlayer];
    if (!nb) return;
    let preview = nb.querySelector('.exposed-preview');
    if (!preview) return;
    preview.classList.add('fc-active');
    renderFCCorners(targetPlayer, preview);
    gFCInteraction.selectionMounted = true;
    gFCInteraction.commitButtonsMounted = true;
}

function gameUnmountForehandControlOnTargetNamebar(targetPlayer) {
    let nb = gDeskNamebars[targetPlayer];
    if (!nb) return;
    let preview = nb.querySelector('.exposed-preview');
    if (!preview) return;
    preview.classList.remove('fc-active');
}

function gameGetCurrentFCModeSelection() {
    let selected = document.querySelector('input[name="fc-mode"]:checked');
    return (selected && selected.value === 'must-hold') ? 'must-hold' : 'must-play';
}

function gameSetFCModeSelectorVisible(visible) {
    let selector = document.getElementById('fc-mode-selector');
    if (!selector) return;
    selector.style.display = visible ? 'flex' : 'none';
}

function gameSetDummyFCSelectionVisual(cardContainer, selected) {
    if (!cardContainer) return;
    let cardEl = cardContainer.querySelector('.card');
    if (!cardEl) return;
    let existing = cardEl.querySelector('.fc-marker-selected');
    if (selected) {
        cardContainer.setAttribute('data-da3p-dummy-fc-selected', 'true');
        if (!existing) {
            let marker = document.createElement('div');
            marker.className = 'fc-marker fc-marker-selected da3p-dummy-fc-checkmark';
            let suitEl = cardEl.querySelector('.card-suit');
            suitEl.after(marker);
        }
    } else {
        cardContainer.removeAttribute('data-da3p-dummy-fc-selected');
        if (existing) existing.remove();
    }
}

function gameSetSideDummyFCSelectionBackgroundVisual(cardContainer, selected) {
    if (!cardContainer) return;
    let cardEl = cardContainer.querySelector('.corner-card, .card');
    let existing = cardEl ? cardEl.querySelector('.fc-marker-selected') : null;
    if (selected) {
        cardContainer.setAttribute('data-da3p-dummy-fc-selected', 'true');
        cardContainer.setAttribute('data-fc-selected', 'true');
        if (cardEl) {
            cardEl.style.setProperty('background-color', '#fff3b0', 'important');
            cardEl.style.setProperty('outline', '0.2vh solid #f0c040', 'important');
        }
    } else {
        cardContainer.removeAttribute('data-da3p-dummy-fc-selected');
        cardContainer.removeAttribute('data-fc-selected');
        if (cardEl) {
            cardEl.style.removeProperty('background-color');
            cardEl.style.removeProperty('outline');
        }
    }
    if (existing) existing.remove();
}

function gameCreateDummyFCActionsRow() {
    let host = document.createElement('div');
    host.className = 'da3p-side-dummy-fc-actions-host';
    host.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    let row = document.createElement('div');
    row.className = 'da3p-dummy-fc-actions';

    let btnPlay = document.createElement('button');
    btnPlay.className = 'button fc-action-btn da3p-dummy-fc-action-btn';
    btnPlay.type = 'button';
    btnPlay.textContent = t('fc.mustPlay');
    btnPlay.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        commitForehandControl('must-play');
    });
    row.appendChild(btnPlay);

    let btnHold = document.createElement('button');
    btnHold.className = 'button fc-action-btn da3p-dummy-fc-action-btn';
    btnHold.type = 'button';
    btnHold.textContent = t('fc.mustHold');
    btnHold.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        commitForehandControl('must-hold');
    });
    row.appendChild(btnHold);

    host.appendChild(row);
    return host;
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
    let slot = gameGetDeskSlotForSeat(player);
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
        let slot = gameGetDeskSlotForSeat(p);
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
// Hand rendering — only the locally controlled seat's hand is displayed
// ---------------------------------------------------------------------------

function renderAllHands() {
    renderHand(activeLocalSeat);
    renderTopDummyHand();
    renderSideDummyHand();
}

function renderHand(player) {
    if (!isLocallyControlledSeat(player)) {
        renderTopDummyHand();
        renderSideDummyHand();
        return;
    }
    if (player !== activeLocalSeat) {
        renderTopDummyHand();
        renderSideDummyHand();
        return;
    }
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
            if (game.phase === GamePhase.PLAYING && isLocallyControlledSeat(engineGetCurrentPlayer())) {
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
    renderTopDummyHand();
    renderSideDummyHand();
}

// ---------------------------------------------------------------------------
// Card selection
// ---------------------------------------------------------------------------

function toggleCardSelection(cardId, el) {
    // Allow selection during forehand control exercise — restrict to exposed cards only
    if (gFCInteraction) {
        if (!gFCInteraction.exposedCardIds.has(cardId)) return;
        let isSideVisibleDummyFC = !!(
            gFCInteraction.useVisibleDummyHand
            && gDA3PSideDummyRevealState
            && gDA3PSideDummyRevealState.revealed
            && !gDA3PSideDummyRevealState.folded
            && Number.isInteger(gFCInteraction.target)
            && gFCInteraction.target === gDA3PSideDummyRevealState.dummySeat
        );
        if (selectedCardIds.has(cardId)) {
            selectedCardIds.delete(cardId);
            el.setAttribute('card-selected', 'false');
            if (gFCInteraction.useVisibleDummyHand) {
                if (isSideVisibleDummyFC) {
                    gameSetSideDummyFCSelectionBackgroundVisual(el, false);
                } else {
                    gameSetDummyFCSelectionVisual(el, false);
                }
            } else {
                el.removeAttribute('data-fc-selected');
            }
        } else {
            selectedCardIds.add(cardId);
            el.setAttribute('card-selected', 'true');
            if (gFCInteraction.useVisibleDummyHand) {
                if (isSideVisibleDummyFC) {
                    gameSetSideDummyFCSelectionBackgroundVisual(el, true);
                } else {
                    gameSetDummyFCSelectionVisual(el, true);
                }
            } else {
                el.setAttribute('data-fc-selected', 'true');
            }
        }
        updatePlayButton();
        return;
    }
    let allowCrossingSelection = isLocalCrossingSelectionMode();
    if (isPauseDialogBlockingGameplay()) return;
    if (game.phase === GamePhase.PLAYING && !allowCrossingSelection && !gameCanLocallyControlActingSeat(engineGetCurrentPlayer(), 'trick-play')) return;
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
    document.querySelectorAll('[data-da3p-dummy-fc-selected="true"]').forEach(el => {
        el.removeAttribute('data-da3p-dummy-fc-selected');
        el.removeAttribute('data-fc-selected');
        let marker = el.querySelector('.da3p-dummy-fc-checkmark');
        if (marker) marker.remove();
    });
}

function getSelectedCards(player) {
    let hand = game.hands[player];
    return hand.filter(c => selectedCardIds.has(c.cardId));
}

function updatePlayButton() {
    if (gFCInteraction) {
        gBtnPlay.disabled = gameIsUnfoldedSideDummyFCLocalMode();
        gBtnPlay.textContent = t('buttons.confirmMarks');
        return;
    }
    let crossingMode = getLocalCrossingActionMode();
    if (crossingMode === 'cross') {
        let actionSeat = (gCrossingState && gCrossingState.localAction) ? gCrossingState.localAction.seat : localControlledPlayerIndex;
        gBtnPlay.disabled = !isValidCrossingSelection(actionSeat, getSelectedCards(actionSeat), true);
        gBtnPlay.textContent = t('buttons.toCross');
        return;
    }
    if (crossingMode === 'crossback') {
        let actionSeat = (gCrossingState && gCrossingState.localAction) ? gCrossingState.localAction.seat : localControlledPlayerIndex;
        gBtnPlay.disabled = !isValidCrossingSelection(actionSeat, getSelectedCards(actionSeat), false);
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
    } else if (game.phase === GamePhase.PLAYING && gameCanLocallyControlActingSeat(engineGetCurrentPlayer(), 'trick-play')) {
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
        slot.removeAttribute('data-da3p-side-dummy-desk-hidden');
        slot.removeAttribute('data-da3p-side-dummy-hidden');
        gDeskCardsBySeat[i] = [];
    }
    if (gDeskInfo) gDeskInfo.textContent = '';
    resetAllNamebars();
    renderSideDummyHand();
}

function gameResetTopDummyRevealState() {
    gDA3PTopDummyRevealState = { revealed: false, reason: '' };
}

function gameGetDA3PDummyHandSeat() {
    if (!gameIsDA3PSharedFirstFrameActive() || !game || !game.handSeatByFrameActorKey) return null;
    let seat = game.handSeatByFrameActorKey[frameActorKey('D')];
    return Number.isInteger(seat) ? seat : null;
}

function gameCanRevealTopDummyHandNow() {
    if (!gameIsDA3PSharedFirstFrameActive() || !game || !game.frameContext) return false;
    if (game.frameContext.pivotStatus !== 'resolved' || !game.frameContext.pivotActor) return false;

    let selectedReferenceActor = normalizeDA3PReferenceActor(
        game.da3pSelectedReferenceActor || getDraftDA3PReferenceActor()
    );
    if (selectedReferenceActor !== game.frameContext.pivotActor) return false;

    let displayMap = game.frameContext.displayMap;
    if (!displayMap || displayMap.top !== 'D') return false;

    let dummySeat = gameGetDA3PDummyHandSeat();
    if (!Number.isInteger(dummySeat)) return false;
    let dummyHand = game.hands && game.hands[dummySeat];
    return Array.isArray(dummyHand);
}

function gameGetTopDummyPivotAuthorityRuntime() {
    if (!gameCanRevealTopDummyHandNow()) return null;
    if (!game || !game.frameContext || !game.handSeatByFrameActorKey) return null;

    let pivotActor = game.frameContext.pivotActor;
    if (!pivotActor) return null;

    let dummySeat = gameGetDA3PDummyHandSeat();
    if (!Number.isInteger(dummySeat)) return null;

    let pivotSeat = game.handSeatByFrameActorKey[frameActorKey(pivotActor)];
    if (!Number.isInteger(pivotSeat)) return null;

    return { pivotActor, pivotSeat, dummySeat };
}

function gameCanLocallyControlActingSeat(actingSeat, decisionType) {
    if (isLocallyControlledSeat(actingSeat)) return true;
    if (!Number.isInteger(actingSeat)) return false;

    let authority = gameGetTopDummyPivotAuthorityRuntime();
    if (!authority) return false;
    if (actingSeat !== authority.dummySeat) return false;
    if (!isLocallyControlledSeat(authority.pivotSeat)) return false;

    if (decisionType === 'trick-play') {
        if (!game || game.phase !== GamePhase.PLAYING) return false;
        if (engineGetCurrentPlayer() !== actingSeat) return false;
        if (gCrossingState && gCrossingState.trickPlayBlocked) return false;
    }

    return true;
}

function gameGetLocalControlSeatForActingSeat(actingSeat, decisionType) {
    if (isLocallyControlledSeat(actingSeat)) return actingSeat;
    if (!gameCanLocallyControlActingSeat(actingSeat, decisionType)) return null;
    let authority = gameGetTopDummyPivotAuthorityRuntime();
    return authority ? authority.pivotSeat : null;
}

function setTopDeskDummyNamebarLabel(active) {
    let deskTop = document.getElementById('desk-top');
    if (!deskTop) return;
    let namebar = deskTop.querySelector('.desk-namebar');
    if (!namebar) return;
    let nameArea = namebar.querySelector('.name-area');
    if (!nameArea) return;
    let isDummyActor = namebar.getAttribute('data-frame-actor') === frameActorKey('D');
    if (!isDummyActor) return;
    nameArea.textContent = t('players.dummy');
}

function clearTopDummyHandSurface() {
    if (!gTopDummyHandSurface) return;
    gTopDummyHandSurface.removeAttribute('data-da3p-top-dummy-active');
    gTopDummyHandSurface.removeAttribute('data-da3p-top-dummy-control-active');
    gTopDummyHandSurface.removeAttribute('data-da3p-fc-select-active');
    gTopDummyHandSurface.removeAttribute('data-da3p-select-active');
    gTopDummyHandSurface.innerHTML = '';
    setTopDeskDummyNamebarLabel(false);
}

function gameMarkDA3PDummyPublicForLegality(reason) {
    if (!gameIsDA3PSharedFirstFrameActive()) return false;
    if (reason === 'crossing-receive') return false;
    if (typeof engineSetHandPublicForLegality !== 'function') return false;
    let dummySeat = gameGetDA3PDummyHandSeat();
    if (!Number.isInteger(dummySeat)) return false;
    return !!engineSetHandPublicForLegality(dummySeat, true, reason || 'da3p-dummy-public-reveal');
}

function gameRevealTopDummyHand(reason) {
    if (!gameCanRevealTopDummyHandNow()) return false;
    gameMarkDA3PDummyPublicForLegality(reason || 'top-dummy-reveal');
    gDA3PTopDummyRevealState.revealed = true;
    gDA3PTopDummyRevealState.reason = reason || '';
    return true;
}

function maybeRevealTopDummyAtFirstTrickStart(currentPlayer, isLeading) {
    if (!gameCanRevealTopDummyHandNow()) return;
    if (gDA3PTopDummyRevealState.revealed) return;
    if (!isLeading) return;
    if (game.currentRound !== 1 || game.currentTurnIndex !== 0) return;
    if (currentPlayer !== game.pivot) return;
    gameRevealTopDummyHand('first-trick-start');
}

function renderTopDummyHand() {
    if (!gTopDummyHandSurface) return;

    let canRevealNow = gameCanRevealTopDummyHandNow();
    let shouldShow = !!(canRevealNow && gDA3PTopDummyRevealState && gDA3PTopDummyRevealState.revealed);
    if (!shouldShow) {
        clearTopDummyHandSurface();
        return;
    }

    let dummySeat = gameGetDA3PDummyHandSeat();
    let hand = (game.hands && Number.isInteger(dummySeat)) ? game.hands[dummySeat] : null;
    if (!Array.isArray(hand)) {
        clearTopDummyHandSurface();
        return;
    }

    gTopDummyHandSurface.setAttribute('data-da3p-top-dummy-active', 'true');
    let fcSelectActive = !!(gFCInteraction && gameShouldUseVisibleDummyHandForFC() && gFCInteraction.target === dummySeat);
    let trickSelectActive = !!gameCanLocallyControlActingSeat(dummySeat, 'trick-play');
    let crossingSelectActive = !!(
        isLocalCrossingSelectionMode()
        && gCrossingState
        && gCrossingState.localAction
        && gCrossingState.localAction.mode === 'crossback'
        && gCrossingState.localAction.seat === dummySeat
    );
    let topDummyControlActive = !!(trickSelectActive || crossingSelectActive);
    let dummySelectActive = !!(fcSelectActive || trickSelectActive || crossingSelectActive);
    if (fcSelectActive) gTopDummyHandSurface.setAttribute('data-da3p-fc-select-active', 'true');
    else gTopDummyHandSurface.removeAttribute('data-da3p-fc-select-active');
    if (topDummyControlActive) gTopDummyHandSurface.setAttribute('data-da3p-top-dummy-control-active', 'true');
    else gTopDummyHandSurface.removeAttribute('data-da3p-top-dummy-control-active');
    if (dummySelectActive) gTopDummyHandSurface.setAttribute('data-da3p-select-active', 'true');
    else gTopDummyHandSurface.removeAttribute('data-da3p-select-active');
    gTopDummyHandSurface.innerHTML = '';

    let handRow = document.createElement('div');
    handRow.className = 'hand';
    handRow.setAttribute('data-da3p-top-dummy-hand', 'true');
    handRow.setAttribute('data-interactive', dummySelectActive ? 'true' : 'false');

    let exposedCardIds = new Set();
    if (game.exposedCards && game.exposedCards[dummySeat]) {
        for (let div in game.exposedCards[dummySeat]) {
            for (let c of game.exposedCards[dummySeat][div]) exposedCardIds.add(c.cardId);
        }
    }

    let fcMarkedIds = null;
    let fcMode = null;
    if (game.forehandControl && game.forehandControl.target === dummySeat && game.forehandControl.selectedCards) {
        fcMode = game.forehandControl.mode;
        fcMarkedIds = new Set(game.forehandControl.selectedCards.map(c => c.cardId));
    }

    for (let card of hand) {
        let cc = gameCreateCardContainer(card);
        cc.setAttribute('data-da3p-dummy-card', 'true');
        cc.setAttribute('data-selectable', dummySelectActive ? 'true' : 'false');
        cc.style.cursor = dummySelectActive ? 'pointer' : 'default';
        if (exposedCardIds.has(card.cardId)) {
            cc.setAttribute('data-exposed', 'true');
        }
        if (fcMarkedIds && fcMarkedIds.has(card.cardId)) {
            let marker = document.createElement('div');
            marker.className = 'fc-marker fc-marker-' + fcMode;
            let cardEl = cc.querySelector('.card');
            let suitEl = cardEl.querySelector('.card-suit');
            suitEl.after(marker);
        }
        let fcCardSelectable = !!(fcSelectActive && gFCInteraction.exposedCardIds.has(card.cardId));
        let playCardSelectable = !!(!fcSelectActive && (trickSelectActive || crossingSelectActive));
        if (fcCardSelectable || playCardSelectable) {
            cc.addEventListener('click', () => toggleCardSelection(card.cardId, cc));
            if (selectedCardIds.has(card.cardId)) {
                cc.setAttribute('card-selected', 'true');
                if (fcCardSelectable) {
                    gameSetDummyFCSelectionVisual(cc, true);
                }
            }
        }
        handRow.appendChild(cc);
    }

    gTopDummyHandSurface.appendChild(handRow);
    setTopDeskDummyNamebarLabel(true);
}

function gameResetSideDummyRevealState() {
    gDA3PSideDummyRevealState = {
        revealed: false,
        folded: false,
        displayPosition: null,
        dummySeat: null,
        reason: '',
    };
}

function gameGetDA3PDummyDisplayPosition() {
    if (!gameIsDA3PSharedFirstFrameActive() || !game || !game.frameContext || !game.frameContext.displayMap) return null;
    let displayMap = game.frameContext.displayMap;
    for (let position of ['bottom', 'right', 'top', 'left']) {
        if (displayMap[position] === 'D') return position;
    }
    return null;
}

function gameGetDummyDisplayPositionForSeat(dummySeat) {
    if (!Number.isInteger(dummySeat)) return null;
    return gameGetDisplayPositionForHandSeat(dummySeat);
}

function gameCanRevealSideDummyHandNow() {
    if (!gameIsDA3PSharedFirstFrameActive() || !game || !game.frameContext) return false;
    if (game.frameContext.pivotStatus !== 'resolved') return false;

    let displayPosition = gameGetDA3PDummyDisplayPosition();
    if (!(displayPosition === 'left' || displayPosition === 'right')) return false;

    let dummySeat = gameGetDA3PDummyHandSeat();
    if (!Number.isInteger(dummySeat)) return false;
    let dummyHand = game.hands && game.hands[dummySeat];
    return Array.isArray(dummyHand);
}

function gameGetDummyLabelText() {
    let txt = t('players.dummy');
    return (txt && txt !== 'players.dummy') ? txt : t('players.dummyShort');
}

function gameGetSideDummyFoldToggleText(folded) {
    return folded ? t('players.dummyClickToUnfold') : t('players.dummyClickToFold');
}

function gameBindSideDummyFoldToggleTarget(namebar, preferredTarget) {
    if (!namebar) return;

    namebar.removeAttribute('data-da3p-side-dummy-toggle');
    namebar.onclick = null;
    namebar.style.cursor = '';

    let oldTargets = namebar.querySelectorAll('[data-da3p-side-dummy-fold-toggle="true"]');
    for (let node of oldTargets) {
        node.removeAttribute('data-da3p-side-dummy-fold-toggle');
        node.onclick = null;
        node.style.cursor = '';
    }

    let toggleTarget = preferredTarget
        || namebar.querySelector('.name-area')
        || namebar.querySelector('.game-position-area');
    if (!toggleTarget) return;

    namebar.setAttribute('data-da3p-side-dummy-toggle', 'true');
    toggleTarget.setAttribute('data-da3p-side-dummy-fold-toggle', 'true');
    toggleTarget.style.cursor = 'pointer';
    toggleTarget.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        gameToggleSideDummyFolded();
    };
}

function applyDA3PSideDummyDeskVisibility(displayPosition, folded, revealed) {
    if (!(displayPosition === 'left' || displayPosition === 'right')) return;
    let slot = getDeskSlotForDisplayPosition(displayPosition);
    if (!slot) return;
    if (revealed && !folded) {
        slot.setAttribute('data-da3p-side-dummy-desk-hidden', 'true');
        slot.setAttribute('data-da3p-side-dummy-hidden', 'true');
    } else {
        slot.removeAttribute('data-da3p-side-dummy-desk-hidden');
        slot.removeAttribute('data-da3p-side-dummy-hidden');
    }
}

function setSideDummyDeskNamebarLabel(displayPosition, folded, revealed) {
    if (!(displayPosition === 'left' || displayPosition === 'right')) return;
    let slot = getDeskSlotForDisplayPosition(displayPosition);
    if (!slot) return;
    let namebar = slot.querySelector('.desk-namebar');
    if (!namebar) return;
    if (namebar.getAttribute('data-frame-actor') !== frameActorKey('D')) return;

    let nameArea = namebar.querySelector('.name-area');
    if (!nameArea) return;
    nameArea.textContent = revealed ? gameGetSideDummyFoldToggleText(!!folded) : gameGetDummyLabelText();

    if (revealed) {
        gameBindSideDummyFoldToggleTarget(namebar, nameArea);
    } else {
        gameBindSideDummyFoldToggleTarget(namebar, null);
    }
}

function clearSideDummyHandSurfaceForDisplayPosition(displayPosition) {
    let surface = displayPosition === 'left' ? gLeftDummyHandSurface : (displayPosition === 'right' ? gRightDummyHandSurface : null);
    if (surface) {
        surface.removeAttribute('data-da3p-side-dummy-active');
        surface.removeAttribute('data-da3p-side-dummy-folded');
        surface.removeAttribute('data-da3p-fc-select-active');
        surface.innerHTML = '';
    }
    applyDA3PSideDummyDeskVisibility(displayPosition, false, false);
    setSideDummyDeskNamebarLabel(displayPosition, false, false);
}

function clearSideDummyHandSurfaces() {
    clearSideDummyHandSurfaceForDisplayPosition('left');
    clearSideDummyHandSurfaceForDisplayPosition('right');
}

function gameRevealSideDummyHand(reason) {
    if (!gameCanRevealSideDummyHandNow()) return false;
    gameMarkDA3PDummyPublicForLegality(reason || 'side-dummy-reveal');
    let displayPosition = gameGetDA3PDummyDisplayPosition();
    let dummySeat = gameGetDA3PDummyHandSeat();
    gDA3PSideDummyRevealState.revealed = true;
    gDA3PSideDummyRevealState.folded = false;
    gDA3PSideDummyRevealState.displayPosition = displayPosition;
    gDA3PSideDummyRevealState.dummySeat = dummySeat;
    gDA3PSideDummyRevealState.reason = reason || '';
    return true;
}

function gameToggleSideDummyFolded() {
    if (!gDA3PSideDummyRevealState.revealed) return;
    if (
        gFCInteraction
        && Number.isInteger(gFCInteraction.target)
        && gFCInteraction.target === gDA3PSideDummyRevealState.dummySeat
    ) {
        // Keep fold/unfold available during FC; clear only unsubmitted temporary selection.
        clearSelection();
    }
    gDA3PSideDummyRevealState.folded = !gDA3PSideDummyRevealState.folded;
    applyDA3PSideDummyDeskVisibility(
        gDA3PSideDummyRevealState.displayPosition,
        !!gDA3PSideDummyRevealState.folded,
        true
    );
    renderSideDummyHand();
    updatePlayButton();
}

function maybeRevealSideDummyAtFirstTrickStart(currentPlayer, isLeading) {
    if (!gameCanRevealSideDummyHandNow()) return;
    if (gDA3PSideDummyRevealState.revealed) return;
    if (!isLeading) return;
    if (game.currentRound !== 1 || game.currentTurnIndex !== 0) return;
    if (currentPlayer !== game.pivot) return;
    gameRevealSideDummyHand('first-trick-start');
}

function gameGetSideDummyRowPlan() {
    let strain = Number(game && game.strain);
    let cycle = ['s', 'h', 'c', 'd'];
    if (strain === 4) {
        return ['n', 's', 'h', 'c', 'd'];
    }

    let strainKey = numberToSuitName && numberToSuitName[strain];
    if (!cycle.includes(strainKey)) {
        return ['n', 's', 'h', 'c', 'd'];
    }

    let plain = [];
    let start = (cycle.indexOf(strainKey) + 1) % cycle.length;
    for (let i = 0; i < cycle.length; i++) {
        let key = cycle[(start + i) % cycle.length];
        if (key !== strainKey) plain.push(key);
    }
    return ['n', strainKey, plain[0], plain[1], plain[2]];
}

function gameIsNaturalTrumpCard(card) {
    if (!card || !game) return false;
    return card.suit === 4 || card.rank === game.level;
}

function gameGetCardDivisionKey(card) {
    if (!card) return null;
    if (Array.isArray(numberToDivisionName) && Number.isInteger(card.division)) {
        return numberToDivisionName[card.division];
    }
    return (Array.isArray(numberToSuitName) && Number.isInteger(card.suit)) ? numberToSuitName[card.suit] : null;
}

function gameBuildSideDummyHandRows(cards) {
    let rowPlan = gameGetSideDummyRowPlan();
    let rows = rowPlan.map(group => ({ sortGroup: group, cards: [] }));
    let bucketByGroup = {};
    for (let row of rows) bucketByGroup[row.sortGroup] = row.cards;

    let strain = Number(game && game.strain);
    let strainKey = (Array.isArray(numberToSuitName) && Number.isInteger(strain)) ? numberToSuitName[strain] : null;

    for (let card of cards) {
        if (gameIsNaturalTrumpCard(card)) {
            bucketByGroup['n'].push(card);
            continue;
        }

        let targetGroup = null;
        if (strain !== 4 && ['s', 'h', 'c', 'd'].includes(strainKey) && card.suit === strain) {
            targetGroup = strainKey;
        } else {
            let divisionKey = gameGetCardDivisionKey(card);
            if (['s', 'h', 'c', 'd'].includes(divisionKey)) {
                targetGroup = divisionKey;
            }
        }

        if (!targetGroup || !bucketByGroup[targetGroup]) {
            let fallback = rowPlan.find(group => group !== 'n') || 's';
            targetGroup = bucketByGroup[fallback] ? fallback : 'n';
        }
        bucketByGroup[targetGroup].push(card);
    }

    return rows;
}

function gameGetDummyDeskCardIdSet(dummySeat) {
    let ids = new Set();
    if (!Number.isInteger(dummySeat)) return ids;
    let deskCards = gDeskCardsBySeat[dummySeat] || [];
    for (let card of deskCards) {
        if (card && card.cardId !== undefined && card.cardId !== null) ids.add(String(card.cardId));
    }
    return ids;
}

function renderSideDummyHandSurface(surface, dummySeat, displayPosition, folded) {
    if (!surface) return;

    surface.innerHTML = '';
    surface.setAttribute('data-da3p-side-dummy-folded', folded ? 'true' : 'false');
    surface.setAttribute('data-da3p-side-dummy-hand', 'true');
    surface.setAttribute('data-interactive', 'false');

    applyDA3PSideDummyDeskVisibility(displayPosition, folded, true);
    setSideDummyDeskNamebarLabel(displayPosition, folded, true);

    if (gFCInteraction && gFCInteraction.target === dummySeat) {
        let shouldUseVisibleDummy = !!(!folded && gameShouldUseVisibleDummyHandForFC());
        gFCInteraction.useVisibleDummyHand = shouldUseVisibleDummy;
        if (shouldUseVisibleDummy) {
            gameUnmountForehandControlOnTargetNamebar(dummySeat);
        } else {
            gameMountForehandControlOnTargetNamebar(dummySeat);
        }
        gameSetFCModeSelectorVisible(false);
    }

    if (folded) {
        surface.removeAttribute('data-da3p-side-dummy-active');
        surface.removeAttribute('data-da3p-fc-select-active');
        return;
    }

    surface.setAttribute('data-da3p-side-dummy-active', 'true');
    let fcSelectActive = !!(gFCInteraction && gFCInteraction.useVisibleDummyHand && gFCInteraction.target === dummySeat);
    if (fcSelectActive) surface.setAttribute('data-da3p-fc-select-active', 'true');
    else surface.removeAttribute('data-da3p-fc-select-active');

    let hand = (game.hands && Number.isInteger(dummySeat)) ? game.hands[dummySeat] : null;
    if (!Array.isArray(hand)) return;

    let deskCards = gDeskCardsBySeat[dummySeat] || [];
    let cards = [...hand];
    let inHandIds = new Set(cards.map(card => String(card.cardId)));
    for (let card of deskCards) {
        let id = String(card.cardId);
        if (!inHandIds.has(id)) {
            cards.push(card);
            inHandIds.add(id);
        }
    }

    let sorted = [...cards];
    engineSortHand(sorted);
    let deskCardIds = gameGetDummyDeskCardIdSet(dummySeat);
    let exposedCardIds = new Set();
    if (game.exposedCards && game.exposedCards[dummySeat]) {
        for (let div in game.exposedCards[dummySeat]) {
            for (let c of game.exposedCards[dummySeat][div]) exposedCardIds.add(c.cardId);
        }
    }
    let fcMarkedIds = null;
    let fcMode = null;
    if (game.forehandControl && game.forehandControl.target === dummySeat && game.forehandControl.selectedCards) {
        fcMode = game.forehandControl.mode;
        fcMarkedIds = new Set(game.forehandControl.selectedCards.map(c => c.cardId));
    }
    let rows = gameBuildSideDummyHandRows(sorted);
    let rowsByGroup = {};
    for (let rowModel of rows) {
        let group = rowModel.sortGroup;
        let row = document.createElement('div');
        row.className = 'hand';
        row.setAttribute('sort-group', group);
        rowsByGroup[group] = { el: row, cards: rowModel.cards };
        surface.appendChild(row);
    }

    for (let rowModel of rows) {
        let group = rowModel.sortGroup;
        let rowInfo = rowsByGroup[group];
        if (!rowInfo) continue;
        for (let card of rowModel.cards) {
            let cc = gameCreateCardContainer(card);
            cc.setAttribute('data-da3p-dummy-card', 'true');
            cc.removeAttribute('data-da3p-dummy-fc-final');
            cc.setAttribute('data-selectable', 'false');
            cc.style.cursor = 'default';
            if (exposedCardIds.has(card.cardId)) {
                cc.setAttribute('data-exposed', 'true');
            }
            if (deskCardIds.has(String(card.cardId))) {
                cc.classList.add('da3p-dummy-card-on-desk');
            }
            if (fcMarkedIds && fcMarkedIds.has(card.cardId)) {
                cc.setAttribute('data-da3p-dummy-fc-final', fcMode);
                let marker = document.createElement('div');
                marker.className = 'fc-marker fc-marker-' + fcMode;
                let cardEl = cc.querySelector('.card');
                let suitEl = cardEl.querySelector('.card-suit');
                suitEl.after(marker);
            }
            if (fcSelectActive && gFCInteraction.exposedCardIds.has(card.cardId)) {
                cc.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleCardSelection(card.cardId, cc);
                });
                if (selectedCardIds.has(card.cardId)) {
                    cc.setAttribute('card-selected', 'true');
                    gameSetSideDummyFCSelectionBackgroundVisual(cc, true);
                }
            }
            rowInfo.el.appendChild(cc);
        }
    }

    let namebar = document.createElement('div');
    namebar.className = 'namebar';
    namebar.setAttribute('show', 'show');
    namebar.setAttribute('status', 'idle');

    let posArea = document.createElement('div');
    posArea.className = 'game-position-area';
    posArea.textContent = gameGetFrameActorLabel('D', { compact: true });
    namebar.appendChild(posArea);

    let nameArea = document.createElement('div');
    nameArea.className = 'name-area';
    nameArea.textContent = gameGetSideDummyFoldToggleText(!!folded);
    namebar.appendChild(nameArea);
    gameBindSideDummyFoldToggleTarget(namebar, nameArea);

    surface.appendChild(namebar);
    if (fcSelectActive) {
        surface.appendChild(gameCreateDummyFCActionsRow());
    }
}

function renderSideDummyHand() {
    let canReveal = gameCanRevealSideDummyHandNow();
    let shouldShow = !!(canReveal && gDA3PSideDummyRevealState.revealed);
    if (!shouldShow) {
        clearSideDummyHandSurfaces();
        return;
    }

    let displayPosition = gameGetDA3PDummyDisplayPosition();
    if (!(displayPosition === 'left' || displayPosition === 'right')) {
        clearSideDummyHandSurfaces();
        return;
    }

    let dummySeat = gameGetDA3PDummyHandSeat();
    if (!Number.isInteger(dummySeat)) {
        clearSideDummyHandSurfaces();
        return;
    }

    gDA3PSideDummyRevealState.displayPosition = displayPosition;
    gDA3PSideDummyRevealState.dummySeat = dummySeat;

    if (displayPosition === 'left') clearSideDummyHandSurfaceForDisplayPosition('right');
    else clearSideDummyHandSurfaceForDisplayPosition('left');

    let surface = displayPosition === 'left' ? gLeftDummyHandSurface : gRightDummyHandSurface;
    renderSideDummyHandSurface(surface, dummySeat, displayPosition, !!gDA3PSideDummyRevealState.folded);
}

function clearDeskForOvercallDecisionStep() {
    for (let i = 0; i < gDeskSlots.length; i++) {
        let slot = gDeskSlots[i];
        // Keep PASS markers across sequential decisions; only clear card-like artifacts.
        slot.querySelectorAll('.card-container, .hand, .namebar:not(.desk-namebar)').forEach(el => el.remove());
        slot.removeAttribute('data-active');
        slot.removeAttribute('data-winner');
        slot.removeAttribute('data-has-exposed');
        slot.removeAttribute('data-da3p-side-dummy-desk-hidden');
        gDeskCardsBySeat[i] = [];
    }
    if (gDeskInfo) gDeskInfo.textContent = '';
    resetAllNamebars();
    renderSideDummyHand();
}

/**
 * Show a PASS marker in a player's desk slot after a no-overcall decision (note 41ea).
 */
function showBasingPassMarker(player) {
    // PASS is authoritative and non-localized for this live-flow marker.
    showDeskEventMarker(player, 'PASS', 'basing-overcall');
}

function renderDeskCards(player, cards) {
    let slot = gameGetDeskSlotForSeat(player);
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
    gDeskCardsBySeat[player] = [...sorted];

    if (player !== localControlledPlayerIndex) {
        // Update persistent namebar width to match cards (§3.3)
        updateNamebarWidth(player, sorted.length);
        updateNamebarStatus(player, 'played');
    }
    renderSideDummyHand();
}


function highlightActivePlayer(player) {
    // Use name bar breathing color for all players including reference player (§6)
    for (let i = 0; i < NUM_PLAYERS; i++) {
        let slot = gameGetDeskSlotForSeat(i);
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

    if (game.phase === GamePhase.IDLE || game.phase === GamePhase.DEALING || game.phase === GamePhase.BASING) {
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
    return getDisplayPositionFor4PActorSeat(seat, selectedNaturalPositionIndex);
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

    if (game.phase === GamePhase.DEALING && game.dealingStage === DealingStage.FINAL_DECLARATION_CALL && !gTimerInterval) {
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

    let seats = Array.from(locallyControlledSeats).filter(seat => seat !== pauseState.requesterSeat);
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
        btnReady.onclick = () => submitResumeReady(localControlledPlayerIndex);
        gPausePrimaryControls.appendChild(btnReady);

        let btnQuit = document.createElement('button');
        btnQuit.className = 'button';
        btnQuit.textContent = t('buttons.quit');
        btnQuit.onclick = () => requestQuitDuringPause(localControlledPlayerIndex);
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
        if (seat === requesterSeat || isLocallyControlledSeat(seat)) continue;
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
        if (isLocallyControlledSeat(seat)) continue;
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
    let slot = gameGetDeskSlotForSeat(player);
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
    if (!gameCanLocallyControlActingSeat(player, moveType === 'play' ? 'trick-play' : null)) return; // bots are untimed (note 24 §2)
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
    if (!isLocallyControlledSeat(player)) return;
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
    if (!gameCanLocallyControlActingSeat(player, 'forehand-control')) return;
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
        gNoDeclareClicked.add(localControlledPlayerIndex);
        gBtnNoDeclare.disabled = true;
        gBtnNoDeclare.style.opacity = '0.4';
        // Bots auto-decline (they've already had their chance)
        for (let i = 0; i < NUM_PLAYERS; i++) {
            if (!isLocallyControlledSeat(i)) gNoDeclareClicked.add(i);
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
        appendLog(t('log.baseDone', { playerName: gameGetPlayerLogNameForSeat(player) }));
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
            if (p !== selectedNaturalPositionIndex) updateExposedPreview(p);
        }
        if (result.roundComplete) finishRound();
        else promptCurrentPlayer();
    }
}

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------

/**
 * Clear stale shared UI surfaces at new-game entry (Note 105).
 *
 * Idempotent and null-safe. Must run before any new-game state is rendered.
 * Clears: phase/status text, reference-hand cards, denomination/declaration
 * display, hint areas.
 * Does NOT mutate deck/deal/engine/rules/scoring state.
 * Safe to call from any game mode entry path.
 */
function clearSharedGameStartUiStateForNewGame() {
    // Phase and status: clear stale previous-game text immediately
    updatePhaseDisplay('');
    updateStatus(t('status.ready'));

    // Reference hand: clear stale cards from previous game/frame
    if (gReferenceHandSurface) gReferenceHandSurface.innerHTML = '';
    clearTopDummyHandSurface();
    clearSideDummyHandSurfaces();
    gameResetTopDummyRevealState();
    gameResetSideDummyRevealState();

    // Denomination/declaration display: clear stale strain icon and text
    if (gDenomArea)    gDenomArea.removeAttribute('strain');
    if (gStrainDiv)    gStrainDiv.innerHTML = '';
    if (gDeclareSp)    gDeclareSp.textContent = '';
    if (gDeclMethodSp) gDeclMethodSp.textContent = '';

    // Hint areas: clear stale per-frame content
    if (gHint1Div) gHint1Div.textContent = '';
    if (gHint2Div) { gHint2Div.textContent = ''; gHint2Div.style.display = 'none'; }
}

/**
 * Shared new-session board-surface reset (Note 108b).
 * Clears visible and invisibly-coupled stale board/UI surfaces before any new
 * session or shell renders. UI/surface only — does not start the engine, deal
 * cards, or activate gameplay. Idempotent and null-safe.
 *
 * Layer 2 of the two-layer new-session boundary:
 *   Layer 1: beginNewSessionBoundary (108a) — lifecycle/timer/epoch termination
 *   Layer 2: resetBoardSurfacesForNewSession (108b) — visible/UI surface cleanup
 *
 * @param {string} nextSessionKind  One of UiSessionKind.
 */
function resetBoardSurfacesForNewSession(nextSessionKind) {
    // 1. Desk slots: clear played cards; reset namebar data-status to idle.
    clearDesk();
    clearTopDummyHandSurface();
    clearSideDummyHandSurfaces();

    // 2. For non-4P sessions (e.g. 3PDA shell): also remove persistent .desk-namebar
    //    elements so stale 4P player labels do not remain in the desk slots.
    if (nextSessionKind !== UiSessionKind.NORMAL_4P) {
        [gReferenceHandSurface, ...gDeskSlots].forEach(container => {
            if (container) container.querySelectorAll('.desk-namebar').forEach(el => el.remove());
        });
        gDeskNamebars = [null, null, null, null];
    }

    // 3. Selection state (also cleared in beginNewSessionBoundary; defensive repeat).
    if (typeof clearSelection === 'function') clearSelection();

    // 4. Declaration history rows.
    resetDeclarationHistoryRows();

    // 5. Forehand-control interaction state.
    gFCInteraction = null;

    // 6. Log.
    if (typeof clearLog === 'function') clearLog();

    // 7. Bot deal count display.
    clearBotDealCounts();

    // 8. Declaration matrix.
    if (gDeclareMatrix) gDeclareMatrix.style.display = 'none';

    // 9. Counting dialog.
    if (typeof hideCountingDialog === 'function') hideCountingDialog();

    // 10. Play button.
    if (gBtnPlay) {
        gBtnPlay.disabled = true;
        gBtnPlay.textContent = t('buttons.play');
    }

    // 11. Pause button state.
    if (typeof refreshPauseButtonState === 'function') refreshPauseButtonState();

    // 12. Show-base button and base preview.
    if (gBtnShowBase) gBtnShowBase.style.display = 'none';
    if (gBasePreview) gBasePreview.innerHTML = '';

    // 13. Score box.
    if (gScoreDiv) gScoreDiv.textContent = '0';
    if (gScoreCont) {
        gScoreCont.style.backgroundColor = 'transparent';
        gScoreCont.style.borderColor = '#f8f8f8';
    }

    // 14. Attackers streak display (reset to zero before updating).
    attackersStreak = 0;
    updateAttackersStreakDisplay();

    // 15. New-game button text.
    if (gBtnNewGame) gBtnNewGame.textContent = t('buttons.newGame');

    // 16. Top-left seats/level-position box reset.
    resetTopLeftSeatBoxForNewSession();
}

function startNewGame() {
    // Note 108a: shared new-session boundary — terminates previous session before
    // setting any new-game state (epoch bump, timer clear, pause reset, etc.)
    beginNewSessionBoundary(UiSessionKind.NORMAL_4P);

    // Note 108b: shared board-surface reset — clears visible and invisible stale
    // board/UI surfaces (desk, namebars, score, buttons, declaration, etc.)
    // before the new 4P session renders.
    resetBoardSurfacesForNewSession(UiSessionKind.NORMAL_4P);

    ensureResolvedSettings();
    applyUserNaturalPositionFor4P(gResolvedGameSettings.displaySettings && gResolvedGameSettings.displaySettings.userNaturalPosition);

    // Clear all active timers (note 24) — redundant safety, also in beginNewSessionBoundary.
    clearTimers();

    // §3: Clear forehand-control and failed-multiplay aftermath UI state
    // (gFCInteraction and crossing already cleared by resetBoardSurfacesForNewSession / beginNewSessionBoundary)

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

    // Corner infos and score/streak/button text are all cleared by
    // beginNewSessionBoundary (→ clearSharedGameStartUiStateForNewGame) and
    // resetBoardSurfacesForNewSession above.

    let declarationOrderAnchor = isQiangzhuang ? Math.floor(Math.random() * NUM_PLAYERS) : pivot;
    engineStartGame(level, pivot, playerLevels, isQiangzhuang, gResolvedGameSettings.ruleConfig, declarationOrderAnchor);
    gameResetNormal4PSharedRuntimeFields();
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

    // Display current denomination level as rank-only (note 51b).
    gLevelDiv.textContent = levelDisplayLabel(game.level);
    setSeatsTopLeftBoxView('seats');

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
        let pivotPosition = gameGetActorLabelForSeat(game.pivot);
        displayText = t('timing.intermittentNormal', { position: pivotPosition, level: numberToLevel[game.level] });
    }

    gDeskInfo.innerHTML = '<div class="timer-intermittent">' + displayText + '</div>';

    let delayMs = Math.max(0, Number.isFinite(remainingMs) ? remainingMs : (getTimingConfigForPage().frameIntermittent * 1000));
    gFrameIntermittentEndsAt = Date.now() + delayMs;
    const _fiEpoch = getCurrentUiSessionEpoch(); // Note 108a: capture epoch for stale-callback guard
    gFrameIntermittentTimeout = setTimeout(() => {
        if (!isCurrentUiSessionEpoch(_fiEpoch)) return; // Note 108a: stale session — abort
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
        who: gameGetActorLabelForSeat(row.player),
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
    let hand  = game.hands[localControlledPlayerIndex];
    let level = game.level;
    let currentCount = currentDeclaration ? currentDeclaration.count : 0;
    if (!gameCanSeatDeclare(localControlledPlayerIndex)) {
        for (let suit = 0; suit <= 4; suit++) {
            let btnS = gDeclBtnsSingle[suit];
            let btnD = gDeclBtnsDouble[suit];
            if (btnS) {
                btnS.innerHTML = suit === 4 ? 'VV' : suitTexts[suit];
                btnS.disabled = true;
                btnS.onclick = null;
            }
            if (btnD) {
                btnD.innerHTML = suit === 4 ? 'WW' : (suitTexts[suit] + suitTexts[suit]);
                btnD.disabled = true;
                btnD.onclick = null;
            }
        }
        return;
    }

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
                if (currentDeclaration && currentDeclaration.player === localControlledPlayerIndex && currentDeclaration.suit !== 4) {
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
                if (currentDeclaration && currentDeclaration.player === localControlledPlayerIndex && currentDeclaration.suit !== 4) {
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
                if (currentDeclaration && currentDeclaration.player === localControlledPlayerIndex && currentDeclaration.suit !== suit) {
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
    if (!gameCanSeatDeclare(localControlledPlayerIndex)) return;
    currentDeclaration = {
        player: localControlledPlayerIndex,
        frameActor: gameGetFrameActorForSeat(localControlledPlayerIndex),
        suit,
        count
    };

    // Preview in UI corner
    let suitName = suit === 4 ? (count >= 4 ? 'w' : 'v') : numberToSuitName[suit];
    gDenomArea.setAttribute('strain', suitName);
    gStrainDiv.innerHTML   = getDenominationHtml(suit, count);
    gDeclareSp.textContent = gameGetActorLabelForSeat(localControlledPlayerIndex);
    let methodText = t('labels.declareMethod');
    gDeclMethodSp.textContent = methodText;
    appendLog(t('log.declare', { playerName: gameGetPlayerLogNameForSeat(localControlledPlayerIndex), strain: suit === 4 ? t('strain.noTrump') : suitName.toUpperCase() }));

    showDeclaredCardsOnDesk(localControlledPlayerIndex, suit, count);
    recordDealingDeclarationHistory(localControlledPlayerIndex, suit, count);
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

    const _dpEpoch = getCurrentUiSessionEpoch(); // Note 108a: capture epoch for stale-callback guard
    dealingTimer = setInterval(function () {
        if (!isCurrentUiSessionEpoch(_dpEpoch)) { clearInterval(dealingTimer); dealingTimer = null; return; } // Note 108a
        let batch = engineDealNextBatch();
        if (!batch) { clearInterval(dealingTimer); dealingTimer = null; return; }

        // Bots consider overcalling as they get cards
        for (let i = 0; i < NUM_PLAYERS; i++) {
            let p = (getDeclarationOrderAnchor() + i) % NUM_PLAYERS;
            if (p === localControlledPlayerIndex) continue;
            if (!gameCanSeatDeclare(p)) continue;

            let decl = botChooseDeclaration(p, currentDeclaration, 'dealing');
            if (decl) {
                let currentCount = currentDeclaration ? currentDeclaration.count : 0;
                if (currentDeclaration ? botCompareDeclarations(decl, currentDeclaration, botGetEffectiveDeclarationOrdering()) > 0 : (decl.count > currentCount)) {
                    currentDeclaration = { player: p, frameActor: gameGetFrameActorForSeat(p), suit: decl.suit, count: decl.count };
                    
                    let suitName = (decl.suit === 4) ? (decl.count >= 4 ? 'w' : 'v') : numberToSuitName[decl.suit];
                    gDenomArea.setAttribute('strain', suitName);
                    gStrainDiv.innerHTML = getDenominationHtml(decl.suit, decl.count);
                    gDeclareSp.textContent = gameGetActorLabelForSeat(p);
                    gDeclMethodSp.textContent = t('labels.declareMethod');
                    appendLog(t('log.declare', { playerName: gameGetPlayerLogNameForSeat(p), strain: decl.suit === 4 ? t('strain.noTrump') : suitName.toUpperCase() }));
                    showDeclaredCardsOnDesk(p, decl.suit, decl.count);
                    recordDealingDeclarationHistory(p, decl.suit, decl.count);
                }
            }
        }

        // Sort locally-controlled players' hands for readability as cards arrive
        for (let hp of locallyControlledSeats) {
            engineSortHand(game.hands[hp]);
        }
        renderHand(activeLocalSeat);
        updateBotDealCounts();
        updateDeclareMatrix();

        // Update dealt count display (§4.1)
        let dealtPerPlayer = Math.floor(game.dealIndex / NUM_PLAYERS);
        gDeskInfo.innerHTML = '<div class="dealt-count">' + dealtPerPlayer + '</div>'
            + '<div class="dealt-count-label">' + t('dealing.dealtCount', { count: dealtPerPlayer }) + '</div>';

        if (game.dealingStage === DealingStage.FINAL_DECLARATION_CALL) {
            clearInterval(dealingTimer);
            dealingTimer = null;
            // Clear dealt-count display (§4.1 — replaced by timer after dealing)
            gDeskInfo.innerHTML = '';
            // Note 24 §5: check if highest-possible declaration was already made
            if (engineIsHighestPossibleDeclaration(currentDeclaration)) {
                // §5.1: skip final declaration window, enter basing directly
                const _epoch51 = getCurrentUiSessionEpoch(); // Note 108a
                setTimeout(() => { if (!isCurrentUiSessionEpoch(_epoch51)) return; resolveDeclaredPhase(); }, 400);
            } else {
                // §5.2: start 5s final declaration window
                const _epoch52 = getCurrentUiSessionEpoch(); // Note 108a
                setTimeout(() => { if (!isCurrentUiSessionEpoch(_epoch52)) return; runFinalDeclarationWindow(); }, 400);
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
    updatePhaseDisplay(t('phase.finalDeclarationCall'));
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
        if (isLocallyControlledSeat(p)) continue;
        if (!gameCanSeatDeclare(p)) continue;
        let decl = botChooseDeclaration(p, currentDeclaration, 'dealing');
        if (decl) {
            let currentCount = currentDeclaration ? currentDeclaration.count : 0;
            if (currentDeclaration ? botCompareDeclarations(decl, currentDeclaration, botGetEffectiveDeclarationOrdering()) > 0 : (decl.count > currentCount)) {
                currentDeclaration = { player: p, frameActor: gameGetFrameActorForSeat(p), suit: decl.suit, count: decl.count };
                let suitName = (decl.suit === 4) ? (decl.count >= 4 ? 'w' : 'v') : numberToSuitName[decl.suit];
                gDenomArea.setAttribute('strain', suitName);
                gStrainDiv.innerHTML = getDenominationHtml(decl.suit, decl.count);
                gDeclareSp.textContent = gameGetActorLabelForSeat(p);
                gDeclMethodSp.textContent = t('labels.declareMethod');
                appendLog(t('log.declare', { playerName: gameGetPlayerLogNameForSeat(p), strain: decl.suit === 4 ? t('strain.noTrump') : suitName.toUpperCase() }));
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
// Final declaration call resolution (resolves after dealing animation completes)
// ---------------------------------------------------------------------------

function resolveDeclaredPhase() {
    if (isPauseDialogBlockingGameplay()) return;
    updatePhaseDisplay(t('phase.finalDeclarationCall'));
    updateStatus(t('status.finalDeclarationCall'));
    gDeclareMatrix.style.display = 'none';

    let bestDeclaration = currentDeclaration;

    if (bestDeclaration) {
        let suitName = bestDeclaration.suit === 4 ? (bestDeclaration.count >= 4 ? 'w' : 'v') : numberToSuitName[bestDeclaration.suit];
        engineSetStrain(bestDeclaration.suit);
        // In qiangzhuang frames, the declarer becomes the pivot;
        // in later frames, the pivot is already determined from the previous frame result
        if (game.isQiangzhuang) {
            game.pivot = bestDeclaration.player;
            if (gameIsDA3PSharedFirstFrameActive() && game.frameContext) {
                const resolvedActor = bestDeclaration.frameActor || gameGetFrameActorForSeat(bestDeclaration.player);
                const reframed = gameApplyDA3PResolvedPivotReframe(resolvedActor);
                if (reframed) {
                    engineResetDA3PAttackerDeskScoreForCurrentFrame();
                    initPersistentNamebarsForFrameContext(game.frameContext);
                    refreshTopLeftSeatAndLevelPositionBoxFromGameState();
                } else {
                    gameStopDA3PBeforeBasing(t('status.da3pStoppedBeforeBasing'));
                    return;
                }
                game.frameContext.pivotSeat = bestDeclaration.player;
                game.frameContext.declarationResolvedSeat = bestDeclaration.player;
            }
        }
        game.declarations.push(bestDeclaration);

        gDenomArea.setAttribute('strain', suitName);
        gStrainDiv.innerHTML = getDenominationHtml(bestDeclaration.suit, bestDeclaration.count);
        gDeclareSp.textContent    = gameGetActorLabelForSeat(bestDeclaration.player);
        gDeclMethodSp.textContent = t('labels.declareMethod');

        // Only log if they did it at the very end
        if (bestDeclaration.player !== localControlledPlayerIndex && (!currentDeclaration || bestDeclaration.count !== currentDeclaration.count)) {
            appendLog(t('log.declare', { playerName: gameGetPlayerLogNameForSeat(bestDeclaration.player), strain: bestDeclaration.suit === 4 ? t('strain.noTrump') : suitName.toUpperCase() }));
            showDeclaredCardsOnDesk(bestDeclaration.player, bestDeclaration.suit, bestDeclaration.count);
        }
    } else if (game && game.isQiangzhuang && !gameIsDA3PSharedFirstFrameActive()) {
        redealQiangzhuangNoDeclarationFrame();
        return;
    } else if (game && game.isQiangzhuang && gameIsDA3PSharedFirstFrameActive()) {
        appendLog(t('log.nobodyDeclared'));
        recordAutoStrainHistoryRow();
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
        if (gameShouldStopDA3PBeforeBasing()) {
            gameStopDA3PBeforeBasing(t('status.da3pStoppedBeforeBasing'));
            return;
        }
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

    if (gameShouldStopDA3PBeforeBasing()) {
        const resolved = gameIsDA3PSharedFirstFrameActive() && game.frameContext && game.frameContext.pivotStatus === 'resolved';
        if (resolved) {
            initPersistentNamebarsForFrameContext(game.frameContext);
            gameApplyDA3PSeatControlFromFrameContext(game.da3pSelectedReferenceActor || getDraftDA3PReferenceActor());
            renderAllHands();
            clearDesk();
            gameStopDA3PBeforeBasing(t('status.da3pPivotResolvedStoppedBeforeBasing'), {
                phaseText: t('phase.da3pPivotResolvedStoppedBeforeBasing'),
                statusText: t('status.da3pPivotResolvedStoppedBeforeBasing'),
            });
            return;
        }
        gameStopDA3PBeforeBasing(t('status.da3pStoppedBeforeBasing'));
        return;
    }

    // Move to basing phase
    if (!enginePickUpBase()) {
        showError(t('errors.baseFailed'));
        return;
    }
    game.dealingStage = DealingStage.NONE; // Note 103a: dealing substage complete
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

    if (isLocallyControlledSeat(baser)) {
        // Locally controlled player is the active baser — render their hand and wait for selection.
        activeLocalSeat = baser;
        clearSelection();
        renderHand(baser);
        updatePhaseDisplay(t('phase.selectBase', { n: BASE_SIZE }) + (TEST_MODE ? ' (' + gameGetActorLabelForSeat(baser) + ')' : ''));
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
            appendLog(t('log.baseDone', { playerName: gameGetPlayerLogNameForSeat(baser) }));
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

function gameGetAdvancingSeatSequenceFrom(startSeat) {
    let start = Number.isInteger(startSeat) ? startSeat : 0;
    if (start < 0 || start >= NUM_PLAYERS) start = 0;
    if (gameIsDA3PSharedFirstFrameActive() && Array.isArray(game.playOrderSeats) && game.playOrderSeats.length === NUM_PLAYERS) {
        let leaderIndex = game.playOrderSeats.indexOf(start);
        if (leaderIndex >= 0) {
            let out = [];
            for (let i = 0; i < NUM_PLAYERS; i++) {
                out.push(game.playOrderSeats[(leaderIndex + i) % NUM_PLAYERS]);
            }
            return out;
        }
    }
    let out = [];
    for (let i = 0; i < NUM_PLAYERS; i++) {
        out.push((start + i) % NUM_PLAYERS);
    }
    return out;
}

function gameCanSeatOverbase(player) {
    if (!gameIsDA3PSharedFirstFrameActive()) return true;
    return !isSameFrameActor(gameGetFrameActorForSeat(player), 'D');
}

/**
 * Start timer for an overcall decision step.
 * Overcall decisions are play-timed and separate from set-base timing.
 * Special rule (shot+bank + no legal overcall): no bank drain, auto-pass on shot expiry.
 */
function startOvercallDecisionTimer(player, hasLegalOvercall, onTimeout) {
    let timingMode = getTimingModeForRuntime();
    if (isLocallyControlledSeat(player) && timingMode === 'shot + bank' && !hasLegalOvercall) {
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
    if (!gameCanSeatOverbase(player)) return false;
    if (player === baser) return false;
    if (declarationHolder !== null && declarationHolder !== undefined && player === declarationHolder) return false;
    return true;
}

function buildPostDealingOverbaseActorOrder(startPlayer) {
    let order = [];
    // After an accepted overbase + set-base, restart from the afterhand of the last baser (note 41ec).
    // If startPlayer is provided, begin from that player; otherwise use afterhand of pivot.
    if (startPlayer === undefined) {
        startPlayer = engineGetPlayerAtTurnOffset(game.pivot, 1);
    }
    // Use the table's advancing sequence starting from startPlayer.
    // Eligibility is then filtered from authoritative current baser/declaration-holder state.
    let sequence = gameGetAdvancingSeatSequenceFrom(startPlayer);
    for (let i = 0; i < sequence.length; i++) {
        let player = sequence[i];
        if (!isEligiblePostDealingOverbaseActor(player)) continue;
        order.push(player);
    }
    return order;
}

function runSequentialOverbaseFlow() {
    let baser = getActiveBaserPlayer();
    let declarationHolder = getCurrentDeclarationHolder();
    // Restart post-dealing sequence from the afterhand of the last baser (note 41ec)
    let startPlayer = engineGetPlayerAtTurnOffset(baser, 1);
    
    // Build full advancing sequence including all players (for automatic PASS display in note 41ec)
    let fullSequence = gameGetAdvancingSeatSequenceFrom(startPlayer);
    
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
    currentDeclaration = { player: player, frameActor: gameGetFrameActorForSeat(player), suit: decl.suit, count: decl.count };
    let suitName = (decl.suit === 4) ? (decl.count >= 4 ? 'w' : 'v') : numberToSuitName[decl.suit];
    gDenomArea.setAttribute('strain', suitName);
    gStrainDiv.innerHTML = getDenominationHtml(decl.suit, decl.count);
    gDeclareSp.textContent = gameGetActorLabelForSeat(player);
    gDeclMethodSp.textContent = t('labels.declareMethod');
    appendLog(t('log.declare', { playerName: gameGetPlayerLogNameForSeat(player), strain: decl.suit === 4 ? t('strain.noTrump') : suitName.toUpperCase() }));
    // note 41h / 41ha: restriction is only active when the overbaseRestrictions setting is 'default'.
    let restrictionSettingEnabled = !!(game && game.gameConfig && game.gameConfig.overbaseRestrictions === 'default');
    let isNonOverbase = !!(!gameIsDA3PSharedFirstFrameActive()
        && restrictionSettingEnabled
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
    if (isLocallyControlledSeat(player)) {
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
            && !gameIsDA3PSharedFirstFrameActive()
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
                && !gameIsDA3PSharedFirstFrameActive()
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

    if (!isLocallyControlledSeat(player)) {
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

    activeLocalSeat = player;
    clearSelection();
    renderHand(player);
    updatePhaseDisplay(t('phase.overcallDecision'));
    updateStatus(t('status.overcallDecision'));

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

function getCrossingPartnerSeat(player) {
    if (game && Array.isArray(game.defendingTeam) && game.defendingTeam.includes(player)) {
        return game.defendingTeam.find(seat => seat !== player);
    }
    if (game && Array.isArray(game.attackingTeam) && game.attackingTeam.includes(player)) {
        return game.attackingTeam.find(seat => seat !== player);
    }
    return getOppositeSeat(player);
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

function gameCanSeatClaimCrossing(player, snapshot) {
    if (gameIsDA3PSharedFirstFrameActive() && isSameFrameActor(gameGetFrameActorForSeat(player), 'D')) {
        return false;
    }
    if (!snapshot) return false;
    return !!snapshot[player];
}

function createCrossingEligibilitySnapshot() {
    let snapshot = {};
    for (let player = 0; player < NUM_PLAYERS; player++) {
        if (gameIsDA3PSharedFirstFrameActive() && isSameFrameActor(gameGetFrameActorForSeat(player), 'D')) {
            snapshot[player] = false;
            continue;
        }
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
    return (mode === 'cross' || mode === 'crossback') && gCrossingState.localAction.controlSeat === localControlledPlayerIndex;
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

    let localResolved = !!gCrossingState.resolvedBySeat[localControlledPlayerIndex];
    let localEligible = gameCanSeatClaimCrossing(localControlledPlayerIndex, gCrossingState.eligibilityBySeat);
    setCrossingClaimControlsVisible(true);

    gBtnCrossClaim.style.display = '';
    gBtnCrossClaim.textContent = t('buttons.toCross');
    gBtnCrossClaim.disabled = localResolved || !localEligible;
    gBtnCrossClaim.onclick = gBtnCrossClaim.disabled ? null : (() => {
        resolveCrossingClaimWindowSeat(localControlledPlayerIndex, 'claim', 'click');
    });

    gBtnCrossDecline.style.display = '';
    gBtnCrossDecline.textContent = t('buttons.noCrossing');
    gBtnCrossDecline.disabled = localResolved;
    gBtnCrossDecline.onclick = gBtnCrossDecline.disabled ? null : (() => {
        resolveCrossingClaimWindowSeat(localControlledPlayerIndex, 'no-crossing', 'click');
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
        if (!gameCanSeatClaimCrossing(player, gCrossingState.eligibilityBySeat)) return false;
        if (!teamState.claimed) {
            teamState.claimed = true;
            teamState.claimantSeat = player;
            teamState.partnerSeat = getCrossingPartnerSeat(player);
            if (!Number.isInteger(teamState.partnerSeat) || teamState.partnerSeat === player) return false;
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
    let dummySeat = gameGetDA3PDummyHandSeat();
    if (Number.isInteger(dummySeat) && ts.partnerSeat === dummySeat) {
        gameRevealTopDummyHand('crossing-receive');
    }
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
            if (ts.phase === 'waiting-cross' && ts.claimantSeat === localControlledPlayerIndex) {
                nextAction = { mode: 'cross', teamKey, seat: localControlledPlayerIndex, controlSeat: localControlledPlayerIndex };
                break;
            }
            if (ts.phase === 'waiting-crossback') {
                let controlSeat = gameGetLocalControlSeatForActingSeat(ts.partnerSeat, 'crossback');
                if (Number.isInteger(controlSeat) && controlSeat === localControlledPlayerIndex) {
                    nextAction = { mode: 'crossback', teamKey, seat: ts.partnerSeat, controlSeat };
                    break;
                }
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
    let enteredNewAction = (!prev || prev.mode !== nextAction.mode || prev.teamKey !== nextAction.teamKey || prev.seat !== nextAction.seat || prev.controlSeat !== nextAction.controlSeat);
    if (enteredNewAction) {
        clearSelection();
        if (nextAction.mode === 'cross' && nextAction.seat === localControlledPlayerIndex) {
            let hand = game.hands[localControlledPlayerIndex] || [];
            for (let card of hand) {
                if (isCardTrumpForCurrentFrame(card)) selectedCardIds.add(card.cardId);
            }
        }
    }
    activeLocalSeat = localControlledPlayerIndex;
    renderHand(localControlledPlayerIndex);
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
        if (ts.phase === 'waiting-cross' && ts.claimantSeat !== localControlledPlayerIndex) {
            scheduleBotCrossingAction(teamKey, 'cross');
        } else if (ts.phase === 'waiting-crossback' && !gameCanLocallyControlActingSeat(ts.partnerSeat, 'crossback')) {
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
    if (action.controlSeat !== localControlledPlayerIndex) return false;
    if (action.mode !== 'cross' && action.mode !== 'crossback') return false;

    let cards = getSelectedCards(action.seat);
    let requireAllTrumps = (action.mode === 'cross');
    if (!isValidCrossingSelection(action.seat, cards, requireAllTrumps)) {
        showError(requireAllTrumps ? t('errors.crossingRequireAllTrumps') : t('errors.crossingSelectFive'));
        return true;
    }

    stopPlayerMoveTimer(action.seat);
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
        if (player === localControlledPlayerIndex) continue;
        let delay = 260 + (player * 80);
        setTimeout(() => {
            if (!gCrossingState || !gCrossingState.claimWindowActive) return;
            if (gCrossingState.resolvedBySeat[player]) return;
            let eligible = gameCanSeatClaimCrossing(player, gCrossingState.eligibilityBySeat);
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
    if (gBtnShowBase && canSeatSeeBaseInPlayingPhase(localControlledPlayerIndex) && game.base) {
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
        controllerName: gameGetPlayerLogNameForSeat(controller),
        targetName: gameGetPlayerLogNameForSeat(targetPlayer)
    }));

    // Create ForehandControlInteractionState
    gFCInteraction = {
        target: targetPlayer,
        controller: controller,
        exposedDivisionCards: exposedDivCards,
        exposedCardIds: new Set(exposedDivCards.map(c => c.cardId)),
        selectedCornerIds: new Set(),
        useVisibleDummyHand: false,
        mode: null,
        selectionMounted: false,
        commitButtonsMounted: false
    };

    if (!gameCanLocallyControlActingSeat(controller, 'forehand-control')) {
        // Bot controller: must-play with empty selectedCards (effectively a no-op)
        engineExerciseFC(targetPlayer, 'must-play', []);
        appendLog(t('log.forehandControlBotExercised', { controllerName: gameGetPlayerLogNameForSeat(controller) }));
        gFCInteraction = null;
        promptCurrentPlayer();
    } else {
        // Human controller: mount selection UI on the target's namebar
        highlightActivePlayer(targetPlayer);

        updatePhaseDisplay(t('phase.forehandControl', { controllerName: gameGetPlayerLogNameForSeat(controller), targetName: gameGetPlayerLogNameForSeat(targetPlayer) }));
        updateStatus(t('status.forehandControl', { targetName: gameGetPlayerLogNameForSeat(targetPlayer) }));

        gFCInteraction.useVisibleDummyHand = gameShouldUseVisibleDummyHandForFC();
        if (gFCInteraction.useVisibleDummyHand) {
            clearSelection();
            gameSetFCModeSelectorVisible(false);
            gameUnmountForehandControlOnTargetNamebar(targetPlayer);
            renderAllHands();
            gFCInteraction.commitButtonsMounted = true;
        } else {
            gameMountForehandControlOnTargetNamebar(targetPlayer);
            gameSetFCModeSelectorVisible(false);
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
    preview.addEventListener('click', (event) => {
        event.stopPropagation();
    });

    // Render selectable corner cards
    for (let card of fci.exposedDivisionCards) {
        let el = createCornerCard(card);
        if (fci.selectedCornerIds.has(card.cardId)) {
            el.setAttribute('data-fc-selected', '');
        }
        el.style.cursor = 'pointer';
        el.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
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
    btnPlay.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        commitForehandControl('must-play');
    });
    btnRow.appendChild(btnPlay);

    let btnHold = document.createElement('button');
    btnHold.className = 'button fc-action-btn';
    btnHold.textContent = t('fc.mustHold');
    btnHold.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        commitForehandControl('must-hold');
    });
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

    let selectedMode = mode || gameGetCurrentFCModeSelection();

    // Get selected cards from either visible dummy hand selection or corner selection.
    let markedCards = null;
    if (fci.useVisibleDummyHand) {
        markedCards = fci.exposedDivisionCards.filter(c => selectedCardIds.has(c.cardId));
    } else {
        markedCards = fci.exposedDivisionCards.filter(c => fci.selectedCornerIds.has(c.cardId));
    }

    engineExerciseFC(targetPlayer, selectedMode, markedCards);

    // Clean up FC-active preview — deactivate ForehandControlInteractionState
    if (!fci.useVisibleDummyHand) {
        gameUnmountForehandControlOnTargetNamebar(targetPlayer);
    }
    gameSetFCModeSelectorVisible(false);

    if (markedCards.length > 0) {
        appendLog(t('log.forehandControlMarked', {
            controllerName: gameGetPlayerLogNameForSeat(fci.controller),
            count: markedCards.length,
            mode: selectedMode === 'must-play' ? t('fc.mustPlay') : t('fc.mustHold')
        }));
    } else {
        appendLog(t('log.forehandControlNoMarks', { controllerName: gameGetPlayerLogNameForSeat(fci.controller) }));
    }

    gFCInteraction = null;

    // Update exposed previews with FC markings
    for (let p = 0; p < NUM_PLAYERS; p++) {
        if (p !== selectedNaturalPositionIndex) updateExposedPreview(p);
    }

    clearSelection();
    renderAllHands();
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
    let cpFrameActor = gameGetFrameActorForSeat(cp);
    let isLeading = (game.currentTurnIndex === 0);
    maybeRevealSideDummyAtFirstTrickStart(cp, isLeading);
    maybeRevealTopDummyAtFirstTrickStart(cp, isLeading);

    // Check if forehand control needs to be exercised before this player follows
    // At most one FC exercise per follow event — skip if already active
    if (!isLeading && !game.forehandControl) {
        let fcTrigger = engineCheckFCTrigger(cp);
        if (fcTrigger.shouldTrigger) {
            exerciseForehandControl(cp, fcTrigger);
            return;
        }
    }

    if (gDeskInfo)  gDeskInfo.innerHTML = t('desk.roundInfo', { round: game.currentRound, playerName: gameGetActorLabelForSeat(cp), action: isLeading ? t('desk.leadAction') : t('desk.followAction') });

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

    if (gameCanLocallyControlActingSeat(cp, 'trick-play')) {
        // Switch displayed hand to the active human player
        let controlSeat = gameGetLocalControlSeatForActingSeat(cp, 'trick-play');
        activeLocalSeat = Number.isInteger(controlSeat) ? controlSeat : cp;
        clearSelection();

        if (isLeading) {
            updateStatus(t('status.yourLead'));
        } else {
            let li = describeLeadInfo(game.leadInfo);
            updateStatus(t('status.follow', { division: t('division.' + li.divisionKey), leadType: t('leadType.' + li.leadTypeKey), volume: game.leadInfo.volume }));
        }
        updatePhaseDisplay((TEST_MODE ? gameGetActorLabelForSeat(cp) + ' - ' : '') + (isLeading ? t('phase.lead') : t('phase.follow', { volume: game.leadInfo.volume })));
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
                const _hpcEpoch = getCurrentUiSessionEpoch(); // Note 108a
                setTimeout(() => { if (!isCurrentUiSessionEpoch(_hpcEpoch)) return; humanPlayCards(); }, 400); // automatically submit
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
        updateStatus(t('status.botThinking', { playerName: gameGetPlayerLogNameForSeat(cp) }));
        updatePhaseDisplay(t('phase.botPlaying', { playerName: gameGetPlayerLogNameForSeat(cp) }));
        gBtnPlay.disabled = true;
        if (shouldClearCrossingResolvedMarkers) {
            clearCrossingSeatStatuses();
            gCrossingState.resolvedMarkersClearedAtFirstLead = true;
        }
        // Bot plays after a delay
        const _btEpoch = getCurrentUiSessionEpoch(); // Note 108a
        setTimeout(() => { if (!isCurrentUiSessionEpoch(_btEpoch)) return; botTakeTurn(cp); }, BOT_DELAY);
    }
}

function gameStopDA3PAtCountingEntry(result) {
    game.phase = GamePhase.IDLE;
    game.da3pFlowStatus = 'stopped-at-counting-entry';
    gBtnPlay.disabled = true;
    gBtnPlay.textContent = t('buttons.play');
    updatePhaseDisplay(t('phase.da3pStoppedAtCountingEntry'));
    updateStatus(t('status.da3pStoppedAtCountingEntry'));
    appendLog(t('status.da3pStoppedAtCountingEntry'));
    if (gDeskInfo && result && Number.isFinite(result.totalScore)) {
        gDeskInfo.textContent = t('status.da3pStoppedAtCountingEntryScore', { totalScore: result.totalScore });
    }
}

function gameComputeDA3PResultCore(finalScore, gameConfig) {
    const cfg = gameConfig || {};
    const stageThreshold = (cfg.stageThreshold != null) ? Number(cfg.stageThreshold) : 80;
    const rawLevelThreshold = (cfg.levelThreshold != null) ? Number(cfg.levelThreshold) : 40;
    const levelThreshold = Math.max(1, Number(rawLevelThreshold) || 1);
    const levelCap = (cfg.levelUpLimitPerFrame != null) ? Number(cfg.levelUpLimitPerFrame) : null;

    let defenseHolds;
    let levelDelta;
    let resultKey;
    if (finalScore < stageThreshold) {
        defenseHolds = true;
        levelDelta = Math.ceil((stageThreshold - finalScore) / levelThreshold);
        if (finalScore === 0) levelDelta += 1;
        if (Number.isFinite(levelCap) && levelCap >= 0 && levelDelta > levelCap) levelDelta = levelCap;
        if (levelDelta <= 1) resultKey = 'retainStage';
        else if (levelDelta === 2) resultKey = 'smallSlam';
        else if (levelDelta === 3) resultKey = 'grandSlam';
        else resultKey = 'defendUpN';
    } else {
        defenseHolds = false;
        levelDelta = Math.floor((finalScore - stageThreshold) / levelThreshold);
        if (Number.isFinite(levelCap) && levelCap >= 0 && levelDelta > levelCap) levelDelta = levelCap;
        if (levelDelta === 0) resultKey = 'takeStage';
        else if (levelDelta === 1) resultKey = 'upOne';
        else if (levelDelta === 2) resultKey = 'upTwo';
        else resultKey = 'upN';
    }
    return { defenseHolds, levelDelta, resultKey };
}

function gameGetDA3PSuccessorActor(pivotActor) {
    let order = createDA3PCanonicalFrameOrderForPivot(pivotActor);
    return Array.isArray(order) ? order[1] : null;
}

function gameBuildDA3PFrameResultFromFinalize(result) {
    if (!gameIsDA3PSharedFirstFrameActive() || !game || !game.frameContext) return null;
    let frameContext = game.frameContext;
    let pivotActor = frameContext.pivotActor;
    let canonical = Array.isArray(frameContext.canonicalFrameOrder)
        ? [...frameContext.canonicalFrameOrder]
        : createDA3PCanonicalFrameOrderForPivot(pivotActor);
    if (!Array.isArray(canonical) || canonical.length !== 4) return null;

    let successorActor = canonical[1];
    let predecessorActor = canonical[3];
    let defendingActors = [pivotActor, 'D'];
    let attackingActors = [successorActor, predecessorActor];

    let oldLevelsByActor = gameCloneDA3PActorLevels(game.da3pLevelsByActor || frameContext.levelsByActor, game.level);
    let oldCyclesByActor = gameCloneDA3PActorCycles(game.da3pLevelCyclesByActor || frameContext.levelCyclesByActor);

    let settlement = gameComputeDA3PResultCore(result.totalScore, game.gameConfig || {});
    let da3pAttackerDeskScore = gameCloneDA3PAttackerDeskScoreSnapshot(result && result.da3pAttackerDeskScore);
    let deskScoreTotal = Number.isFinite(Number(result && result.deskScoreTotal))
        ? Number(result.deskScoreTotal)
        : Number(result && result.counterScore) || 0;
    let sharedScore = {
        baseScore: Number(result && result.baseScore) || 0,
        compensationScore: Number(result && result.multiplayCompensation) || 0,
        endingCompensationScore: Number(result && result.endingCompensation) || 0,
        otherSharedAdjustments: 0,
    };
    let levelDeltaByActor = { N: 0, Sw: 0, Se: 0 };
    if (settlement.defenseHolds) {
        levelDeltaByActor[pivotActor] = settlement.levelDelta;
    } else {
        levelDeltaByActor[successorActor] = settlement.levelDelta;
        levelDeltaByActor[predecessorActor] = settlement.levelDelta;
    }

    let skipLevelSet = gameGetDA3PSkipLevelSet();
    let newLevelsByActor = gameCloneDA3PActorLevels(oldLevelsByActor, game.level);
    let newCyclesByActor = gameCloneDA3PActorCycles(oldCyclesByActor);
    for (let actor of DA3P_REAL_ACTORS) {
        let step = Number(levelDeltaByActor[actor]) || 0;
        if (step <= 0) continue;
        let advanced = gameAdvanceDA3PLevelState(newLevelsByActor[actor], newCyclesByActor[actor], step, skipLevelSet);
        newLevelsByActor[actor] = advanced.level;
        newCyclesByActor[actor] = advanced.cycleIndex;
    }

    let pivotPassMode = (game.gameConfig && game.gameConfig.pivotPassMode) || 'rotate-pivot';
    let nextPivotActor;
    if (pivotPassMode === 'rotate-pivot') {
        nextPivotActor = successorActor;
    } else {
        nextPivotActor = settlement.defenseHolds ? pivotActor : successorActor;
    }

    let nextContextBuilt = gameBuildDA3PFrameContextFromProgression({
        isQiangzhuangFrame: false,
        pivotActor: nextPivotActor,
        frameIndex: (Number.isInteger(frameContext.frameIndex) ? frameContext.frameIndex : 0) + 1,
        frameNumber: (Number.isInteger(frameContext.frameNumber) ? frameContext.frameNumber : 1) + 1,
        levelsByActor: newLevelsByActor,
        levelCyclesByActor: newCyclesByActor,
        selectedReferenceActor: game.da3pSelectedReferenceActor || getDraftDA3PReferenceActor(),
    });

    return {
        kind: 'frame-result',
        tableFormat: ShengjiTableFormat.DA3P,
        frameKind: 'da3p',
        frameIndex: Number.isInteger(frameContext.frameIndex) ? frameContext.frameIndex : 0,
        frameNumber: Number.isInteger(frameContext.frameNumber) ? frameContext.frameNumber : 1,
        pivotActor,
        canonicalFrameOrder: canonical,
        realActors: [...DA3P_REAL_ACTORS],
        dummyActor: 'D',
        totalFrameScore: result.totalScore,
        levelAdvanceBasisScore: Number.isFinite(Number(result.levelAdvanceBasisScore))
            ? Number(result.levelAdvanceBasisScore)
            : Number(result.totalScore) || 0,
        finalCounterScore: result.totalScore,
        deskScoreTotal,
        da3pAttackerDeskScore,
        sharedScore,
        attackingActors,
        defendingActors,
        defenseHolds: settlement.defenseHolds,
        levelDelta: settlement.levelDelta,
        resultKey: settlement.resultKey,
        levelDeltaByActor,
        oldLevelsByActor,
        oldLevelCyclesByActor: oldCyclesByActor,
        newLevelsByActor,
        newLevelCyclesByActor: newCyclesByActor,
        nextPivotActor,
        nextFrameContextDraft: nextContextBuilt.frameContext,
    };
}

function gameConsumeDA3PFrameResult(frameResult) {
    if (!frameResult || frameResult.tableFormat !== ShengjiTableFormat.DA3P) return null;
    if (!Array.isArray(frameResult.realActors) || frameResult.realActors.join(',') !== DA3P_REAL_ACTORS.join(',')) return null;
    if (!frameResult.levelDeltaByActor || Object.prototype.hasOwnProperty.call(frameResult.levelDeltaByActor, 'D')) return null;

    game.da3pLevelsByActor = gameCloneDA3PActorLevels(frameResult.newLevelsByActor, game.level);
    game.da3pLevelCyclesByActor = gameCloneDA3PActorCycles(frameResult.newLevelCyclesByActor);

    let nextContext = frameResult.nextFrameContextDraft;
    if (!nextContext) return null;
    nextContext.levelsByActor = gameCloneDA3PActorLevels(game.da3pLevelsByActor, game.level);
    nextContext.levelCyclesByActor = gameCloneDA3PActorCycles(game.da3pLevelCyclesByActor);

    pendingNextFrame = {
        tableFormat: ShengjiTableFormat.DA3P,
        da3pFrameContext: nextContext,
        selectedReferenceActor: game.da3pSelectedReferenceActor || getDraftDA3PReferenceActor(),
    };

    let cfg = game.gameConfig || {};
    let gameWon = false;
    let winners = [];
    if (cfg.gameMode === 'pass-A') {
        winners = DA3P_REAL_ACTORS.filter(actor => game.da3pLevelsByActor[actor] === 12);
        gameWon = winners.length > 0;
    }

    return {
        gameWon,
        winners,
        nextFrameContext: nextContext,
        newLevelsByActor: gameCloneDA3PActorLevels(game.da3pLevelsByActor, game.level),
        newLevelCyclesByActor: gameCloneDA3PActorCycles(game.da3pLevelCyclesByActor),
    };
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
    let allBlockerNames = fm.allBlockerSeats.map(s => gameGetPlayerLogNameForSeat(s)).join(', ');
    appendLog(t('log.multiplayFailed', {
        playerName: gameGetPlayerLogNameForSeat(player),
        blockerName: gameGetPlayerLogNameForSeat(fm.blockerSeat),
        allBlockerNames: allBlockerNames,
        actualVolume: fm.actualElement.cards.length
    }));

    // Simplified status bar message (note 25 §9)
    updateStatus(t('hints.multiplayFailedShort'));

    // 2) Show all intended cards on desk, with revoked cards highlighted
    let revokedIds = new Set(fm.revokedCards.map(c => c.cardId));
    let slot = gameGetDeskSlotForSeat(player);
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
    if (player !== localControlledPlayerIndex) {
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
            if (p !== selectedNaturalPositionIndex) updateExposedPreview(p);
        }
        renderHand(player);
        onContinue();
    }, 1000);
}

function maybeShowFakeMultiplayWarning(player, fakeMeta) {
    if (!fakeMeta || !fakeMeta.isFakeMultiplay) return;
    let cause = fakeMeta.fakeCause || 'unknown';
    let evidence = fakeMeta.evidenceSource || 'existing-known-info';
    let blockerSeat = Number.isInteger(fakeMeta.blockerSeat) ? fakeMeta.blockerSeat : null;
    let blockerName = blockerSeat !== null ? gameGetPlayerLogNameForSeat(blockerSeat) : '-';
    let warningKey = evidence.indexOf('public-dummy') >= 0 ? 'hints.fakeMultiplayWarningPublicDummy' : 'hints.fakeMultiplayWarningGeneric';
    appendLog(t('log.fakeMultiplayWarning', {
        playerName: gameGetPlayerLogNameForSeat(player),
        cause,
        evidence,
        blockerName
    }));
    updateStatus(t(warningKey));
}

function botTakeTurn(player) {
    if (isPauseDialogBlockingGameplay()) return;
    let cards = botPlay(player);
    let result = enginePlayCards(player, cards);

    if (!result.success) {
        appendLog(t('log.botError', { error: result.error }));
        return;
    }

    maybeShowFakeMultiplayWarning(player, result.fakeMultiplay);

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
        if (p !== selectedNaturalPositionIndex) updateExposedPreview(p);
    }

    if (result.roundComplete) {
        finishRound();
    } else {
        promptCurrentPlayer();
    }
}

function humanPlayCards() {
    if (isPauseDialogBlockingGameplay()) return;
    // During forehand control exercise, the main play button commits FC with selected mode.
    if (gFCInteraction) {
        if (gameIsUnfoldedSideDummyFCLocalMode()) return;
        commitForehandControl(gameGetCurrentFCModeSelection());
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

// Table-format enum (Note 107 / Note 110a).
// Canonical values: 'normal-4p' and 'da3p'.
const ShengjiTableFormat = Object.freeze({
    NORMAL_4P: 'normal-4p',  // canonical normal 4-player table format (was 'normal-4P')
    DA3P:      'da3p',        // canonical 3-player dummy-ally format (Note 110a)
});

/**
 * Normalize a raw tableFormat value to its canonical form.
 * Accepts legacy 'three-pda' → 'da3p', legacy 'normal-4P' → 'normal-4p'.
 * @param {string} value
 * @returns {string} canonical tableFormat
 */
function normalizeTableFormat(value) {
    // Legacy input normalization only; do not emit this value.
    if (value === 'three-pda') return ShengjiTableFormat.DA3P;
    if (value === 'da3p')      return ShengjiTableFormat.DA3P;
    if (value === 'normal-4p') return ShengjiTableFormat.NORMAL_4P;
    // Legacy input normalization only; do not emit this value.
    if (value === 'normal-4P') return ShengjiTableFormat.NORMAL_4P;
    return ShengjiTableFormat.NORMAL_4P;
}

// 3PDA start shell state (Note 108).  Null when not in 3PDA shell mode.
// This is a UI/model boundary state only — no card dealing, no gameplay.

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

function commitResolvedSettingsFromDraft() {
    let draftRule = cloneRuleConfig(gSettingsDraftRuleConfig || {}) || {};
    let presetName = draftRule.presetName || 'default';
    delete draftRule.presetName;

    let draftDisplay = { ...(gSettingsDraftDisplaySettings || {}) };

    if (typeof shengjiResolveGameSettings === 'function') {
        gResolvedGameSettings = shengjiResolveGameSettings({
            presetName,
            overrides: draftRule,
            displayOverrides: draftDisplay,
        });
    } else {
        gResolvedGameSettings = {
            presetName,
            ruleConfig: engineBuildConfig(presetName, draftRule),
            displaySettings: { ...draftDisplay },
        };
    }

    if (gResolvedGameSettings && gResolvedGameSettings.ruleConfig) {
        gResolvedGameSettings.ruleConfig.tableFormat = normalizeTableFormat(
            gResolvedGameSettings.ruleConfig.tableFormat
        );
    }
    if (gResolvedGameSettings && gResolvedGameSettings.displaySettings) {
        gResolvedGameSettings.displaySettings.userNaturalPosition = normalize4PUserNaturalPosition(
            gResolvedGameSettings.displaySettings.userNaturalPosition
        );
        gResolvedGameSettings.displaySettings.selectedDA3PReferenceActor = normalizeDA3PReferenceActor(
            gResolvedGameSettings.displaySettings.selectedDA3PReferenceActor
        );
    }

    return gResolvedGameSettings;
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
    let referenceActorSeat = Number.isInteger(Number(selectedNaturalPositionIndex)) ? Number(selectedNaturalPositionIndex) : getActorSeatFor4PNaturalPosition('east');
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
        : selectedNaturalPositionIndex;
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

function renderDA3PLevelPositionSquare(host, options) {
    if (!host) return;
    host.innerHTML = '';

    let box = document.createElement('div');
    box.className = 'level-position-box' + (options.boxClassName ? (' ' + options.boxClassName) : '');
    if (options.boxId) box.id = options.boxId;

    let square = document.createElement('div');
    square.className = 'level-position-square' + (options.squareClassName ? (' ' + options.squareClassName) : '');
    if (options.squareId) square.id = options.squareId;

    let displayMap = options.displayMap || { bottom: null, right: null, top: null, left: null };
    let levelsByActor = gameCloneDA3PActorLevels(options.levelsByActor || {}, Number.isInteger(game && game.level) ? game.level : 0);
    let levelCyclesByActor = gameCloneDA3PActorCycles(options.levelCyclesByActor || {});
    let pivotActor = options.pivotActor || null;

    ['top', 'right', 'bottom', 'left'].forEach((position) => {
        let section = document.createElement('div');
        section.className = 'level-position-triangle' + (options.triangleClassName ? (' ' + options.triangleClassName) : '');
        section.setAttribute('data-pos', position);

        let actor = displayMap[position];
        if (actor === 'D') {
            section.setAttribute('data-team', 'ally');
            square.appendChild(section);
            return;
        }

        if (pivotActor && actor === pivotActor) section.setAttribute('data-team', 'pivot');
        else section.setAttribute('data-team', 'other');

        renderLevelWithCycle(section, levelsByActor[actor], levelCyclesByActor[actor]);
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

    if (gameIsDA3PSharedFirstFrameActive()) {
        let frameContext = game.frameContext || {};
        let displayMap = frameContext.displayMap;
        if (!displayMap) {
            let order = Array.isArray(frameContext.canonicalFrameOrder)
                ? frameContext.canonicalFrameOrder
                : (Array.isArray(frameContext.frameActors) ? frameContext.frameActors : ['N', 'Sw', 'D', 'Se']);
            let selectedReferenceActor = normalizeDA3PReferenceActor((game && game.da3pSelectedReferenceActor) || getDraftDA3PReferenceActor());
            displayMap = createDisplayMapFromFrameOrder(order, selectedReferenceActor);
        }

        renderDA3PLevelPositionSquare(gSeatsHoverLevelPositionBox, {
            boxId: 'seats-toggle-level-position-box-root',
            boxClassName: 'seats-toggle-level-position-box-root',
            squareId: 'seats-toggle-level-position-square',
            squareClassName: 'seats-toggle-level-position-square',
            triangleClassName: 'seats-toggle-level-position-triangle',
            displayMap,
            levelsByActor: game.da3pLevelsByActor || (frameContext && frameContext.levelsByActor),
            levelCyclesByActor: game.da3pLevelCyclesByActor || (frameContext && frameContext.levelCyclesByActor),
            pivotActor: frameContext.pivotStatus === 'resolved' ? frameContext.pivotActor : null,
        });
        return;
    }

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
        referenceActorSeat: selectedNaturalPositionIndex,
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

function resetTopLeftSeatBoxForNewSession() {
    gSeatsTopLeftBoxView = 'seats';
    if (!gSeatsDiv) return;
    gSeatsDiv.setAttribute('data-box-view', 'seats');
    gSeatsDiv.setAttribute('pivot', 'undetermined');
    let tableNumber = document.getElementById('div-table-number');
    if (tableNumber) tableNumber.style.display = '';
    let pivotMark = gSeatsDiv.querySelector('.div-pivot-mark');
    if (pivotMark) pivotMark.style.display = '';
    ensureSeatsHoverLevelPositionBox();
    if (gSeatsHoverLevelPositionBox) {
        gSeatsHoverLevelPositionBox.style.display = 'none';
        gSeatsHoverLevelPositionBox.innerHTML = '';
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

const VALID_3PDA_REFERENCE_ACTORS = ['N', 'Sw', 'Se'];

// Note 110a: canonical naming — normalizeDA3PReferenceActor / getDraftDA3PReferenceActor
function normalizeDA3PReferenceActor(value) {
    return VALID_3PDA_REFERENCE_ACTORS.includes(value) ? value : 'N';
}

function getDraftDA3PReferenceActor() {
    let source = gSettingsDraftDisplaySettings
        || (gResolvedGameSettings && gResolvedGameSettings.displaySettings)
        || {};
    // Accept canonical selectedDA3PReferenceActor; fall back to legacy selected3PDAReferenceActor
    let v = (source.selectedDA3PReferenceActor !== undefined)
        ? source.selectedDA3PReferenceActor
        : source.selected3PDAReferenceActor;
    return normalizeDA3PReferenceActor(v);
}

// Note 108 — 3PDA start shell helpers

function normalizeDA3PDealAnchor(value) {
    return VALID_3PDA_REFERENCE_ACTORS.includes(value) ? value : 'N';
}

/**
 * Generate a random deal anchor from real 3PDA actors.
 * @param {Object} [options] - { fixed: 'N'|'Sw'|'Se' } for deterministic override
 * @returns {string}
 */
function generateDA3PDealAnchor(options) {
    if (options && options.fixed) {
        return normalizeDA3PDealAnchor(options.fixed);
    }
    return VALID_3PDA_REFERENCE_ACTORS[Math.floor(Math.random() * VALID_3PDA_REFERENCE_ACTORS.length)];
}

/**
 * Get a stable string key for a frame actor ID (Note 110b).
 * Supports both numeric (normal 4P) and string (DA3P) actor IDs.
 * @param {number|string} actor
 * @returns {string}
 */
function frameActorKey(actor) {
    return String(actor);
}

/**
 * Stable equality check for frame actor IDs (Note 110b).
 * Works for both numeric (normal 4P) and string (DA3P) actor IDs.
 * Numeric '2' and string '2' are considered the same actor.
 * 'D' does not collide with any numeric seat (0-3 → '0','1','2','3').
 * @param {number|string} a
 * @param {number|string} b
 * @returns {boolean}
 */
function isSameFrameActor(a, b) {
    return frameActorKey(a) === frameActorKey(b);
}

/**
 * Check whether an actor is in a list, using stable key comparison (Note 110b).
 * Supports both numeric (normal 4P) and string (DA3P) actor IDs.
 * @param {number|string} actor
 * @param {Array<number|string>} list
 * @returns {boolean}
 */
function isFrameActorInList(actor, list) {
    return Array.isArray(list) && list.some(x => isSameFrameActor(x, actor));
}

/**
 * Build a shared 4-position in-frame context object (Note 110b).
 * Used as the primary source of truth for in-frame actor layout,
 * deal order, and declaration eligibility.
 *
 * Normal 4P: dummyActor=null, realActors=[0,1,2,3], all actors declare.
 * DA3P:      dummyActor='D', realActors=['N','Sw','Se'], D cannot declare.
 *
 * @param {Object} params
 * @param {string}         params.tableFormat
 * @param {string}         params.frameKind
 * @param {boolean}        params.isQiangzhuangFrame
 * @param {*|null}         params.pivotActor
 * @param {string}         params.pivotStatus        - 'resolved' | 'unresolved'
 * @param {*}              params.dealAnchor
 * @param {Array}          params.frameActors         - 4-entry array in deal order
 * @param {Array}          params.realActors
 * @param {*|null}         params.dummyActor          - null for normal 4P, 'D' for DA3P
 * @param {Object}         params.actorKindByKey
 * @param {Array}          params.declarationEligibleActors
 * @param {Array}          params.nonDeclaringActors
 * @returns {Object} frameContext with kind 'four-position-frame-context'
 */
function buildFourPositionFrameContext(params) {
    return {
        kind:                       'four-position-frame-context',
        tableFormat:                params.tableFormat,
        frameKind:                  params.frameKind,
        isQiangzhuangFrame:         params.isQiangzhuangFrame,
        pivotActor:                 params.pivotActor,
        pivotStatus:                params.pivotStatus,
        dealAnchor:                 params.dealAnchor,
        frameActors:                params.frameActors,
        dealOrder:                  params.frameActors,  // deal order == frame actors in round sequence
        realActors:                 params.realActors,
        dummyActor:                 params.dummyActor,
        actorKindByKey:             params.actorKindByKey,
        declarationEligibleActors:  params.declarationEligibleActors,
        nonDeclaringActors:         params.nonDeclaringActors,
        // Future variant hooks (not yet active — placeholders for control/visibility/scoring):
        controlActorByFrameActorKey: {},
        visibilityPolicy:            {},
        scoringPolicy:               {},
    };
}

/**
 * Shared dealAnchor resolver for any 4-position-in-frame Shengji game (Notes 110a, 110b).
 * Contract: qz frame → random real actor (or fixed override); non-qz frame → pivot.
 *
 * Examples:
 *   normal 4P qz:  dealAnchor = random from realActors [0,1,2,3]
 *   normal 4P non-qz (pivot=1): dealAnchor = 1
 *   DA3P qz:       dealAnchor = random from ['N','Sw','Se'] (never 'D')
 *   DA3P non-qz (pivot='Sw'): dealAnchor = 'Sw'
 *
 * @param {Object} frameContext - { isQiangzhuangFrame, pivotActor, realActors }
 * @param {Object} [options]    - { fixedDealAnchor } for deterministic test override
 * @returns {*|null}
 */
function resolveDealAnchorForFrameContext(frameContext, options) {
    if (frameContext.isQiangzhuangFrame) {
        if (options && options.fixedDealAnchor) {
            return normalizeDA3PDealAnchor(options.fixedDealAnchor);
        }
        let realActors = frameContext.realActors || VALID_3PDA_REFERENCE_ACTORS;
        return realActors[Math.floor(Math.random() * realActors.length)];
    }
    return frameContext.pivotActor || null;
}

/**
 * Check whether an actor is eligible to declare in a frame context (Notes 110a, 110b).
 * DA3P hook: D cannot declare. For normal 4P, all frame actors can declare.
 * Uses isFrameActorInList for stable numeric/string actor comparison.
 *
 * @param {number|string} actor
 * @param {Object} frameContext - { declarationEligibleActors: Array }
 * @returns {boolean}
 */
function canActorDeclareInFrameContext(actor, frameContext) {
    if (!frameContext || !Array.isArray(frameContext.declarationEligibleActors)) return true;
    return isFrameActorInList(actor, frameContext.declarationEligibleActors);
}

// ---------------------------------------------------------------------------
// Note 111a — Shared ordered dealing event stream and timing contract
// ---------------------------------------------------------------------------

/**
 * Per-card timing constants for the shared dealing event stream (Note 111a).
 * - normalPerCardMs: 100 ms between card events in normal mode.
 * - testPerCardMs:   1 ms between card events in test mode (intentionally
 *   nonzero — declaration timing depends on per-card spacing).
 */
const SHARED_DEALING_TIMING = Object.freeze({
    normalPerCardMs: 100,
    testPerCardMs:   1,
});

/**
 * Resolve the per-card dealing delay in ms (Note 111a).
 *
 * Priority:
 *   1. options.perCardDelayMs  — explicit override (clamped to ≥ 1 ms)
 *   2. options.testMode === true → 1 ms
 *   3. default → 100 ms
 *
 * The delay is never allowed to fall below 1 ms because declaration/bot
 * timing logic may depend on the existence of a nonzero per-card interval.
 *
 * @param {Object} [options]
 * @param {number}  [options.perCardDelayMs]   - explicit ms override
 * @param {boolean} [options.testMode]         - true for 1 ms test delay
 * @returns {number}
 */
function getSharedDealingPerCardDelayMs(options) {
    if (options && Number.isFinite(options.perCardDelayMs)) {
        return Math.max(1, Math.floor(options.perCardDelayMs));
    }
    if (options && options.testMode === true) {
        return SHARED_DEALING_TIMING.testPerCardMs;   // 1
    }
    return SHARED_DEALING_TIMING.normalPerCardMs;     // 100
}

/**
 * Derive the 4-position deal order from a frameContext (Note 111a).
 * Returns frameContext.dealOrder if present (set by buildFourPositionFrameContext),
 * otherwise falls back to frameContext.frameActors.
 * @param {Object} frameContext
 * @returns {Array}
 */
function buildFourPositionDealOrder(frameContext) {
    return frameContext.dealOrder || frameContext.frameActors || [];
}

/**
 * Return the per-frame-position card count for the given frameContext (Note 111a).
 * For both normal 4P and DA3P, the current 2-deck config gives 25 cards per position.
 * Falls back to CARDS_PER_HAND (25) if not derivable from context.
 * @param {Object} frameContext
 * @returns {number}
 */
function getCardsPerFramePositionForFrameContext(frameContext) {
    // Currently config-derived global constant is the authoritative source.
    // frameContext does not yet carry a per-position card count; use global.
    return CARDS_PER_HAND; // 25
}

/**
 * Return the actor kind for a given actor in a frameContext (Note 111a).
 * Uses frameContext.actorKindByKey if present; otherwise classifies as:
 *   - real              (actor is in realActors)
 *   - temporary-dummy-pile (actor === dummyActor)
 *   - unknown
 * @param {Object} frameContext
 * @param {number|string} actor
 * @returns {string}
 */
function getFrameActorKind(frameContext, actor) {
    if (frameContext.actorKindByKey) {
        const key = frameActorKey(actor);
        if (Object.prototype.hasOwnProperty.call(frameContext.actorKindByKey, key)) {
            return frameContext.actorKindByKey[key];
        }
    }
    if (frameContext.dummyActor !== null && frameContext.dummyActor !== undefined &&
            isSameFrameActor(actor, frameContext.dummyActor)) {
        return 'temporary-dummy-pile';
    }
    if (Array.isArray(frameContext.realActors) &&
            isFrameActorInList(actor, frameContext.realActors)) {
        return 'real';
    }
    return 'unknown';
}

/**
 * Build the ordered dealing event stream for a four-position frame (Note 111a).
 *
 * Produces a pure metadata sequence — one event per card-to-recipient pairing —
 * in the round-robin order defined by frameContext.dealOrder.  For current 2-deck
 * config: 25 rounds × 4 positions = 100 recipient events.
 *
 * Contract:
 *   - purely functional: no mutation, no timers, no card objects;
 *   - supports numeric normal-4P actors and string DA3P actors;
 *   - D appears in the DA3P stream as recipientKind='temporary-dummy-pile';
 *   - base cards are represented only as remainder metadata, not as events.
 *
 * @param {Object} frameContext  - four-position-frame-context
 * @param {Object} [options]
 * @param {number} [options.rounds]  - override deal-round count (default CARDS_PER_HAND=25)
 * @returns {{ events: Array<Object>, recipientEventCount: number, expectedBaseCardCount: number }}
 */
function buildSharedOrderedDealEvents(frameContext, options) {
    const dealOrder = buildFourPositionDealOrder(frameContext);
    const rounds    = (options && options.rounds != null)
        ? options.rounds
        : getCardsPerFramePositionForFrameContext(frameContext);

    const events = [];

    for (let dealRoundIndex = 0; dealRoundIndex < rounds; dealRoundIndex += 1) {
        for (let withinRoundIndex = 0; withinRoundIndex < dealOrder.length; withinRoundIndex += 1) {
            const recipientActor = dealOrder[withinRoundIndex];
            events.push({
                kind:                    'deal-card-event',
                eventIndex:              events.length,
                dealRoundIndex,
                withinRoundIndex,
                recipientActor,
                recipientKey:            frameActorKey(recipientActor),
                recipientKind:           getFrameActorKind(frameContext, recipientActor),
                frameActorIndex:         withinRoundIndex,
                cardOrdinalForRecipient: dealRoundIndex + 1,
                cardGlobalOrdinal:       events.length + 1,
            });
        }
    }

    const recipientEventCount   = events.length;                         // 100
    const expectedBaseCardCount = TOTAL_CARDS - recipientEventCount;     // 8

    return { events, recipientEventCount, expectedBaseCardCount };
}

// ---------------------------------------------------------------------------
// Note 111e: DA3P mini-engine deleted from production source.
// ---------------------------------------------------------------------------
function clearDA3PFrameStartBoard() {
    // Legacy cleanup helper: remove stale obsolete DA3P preview DOM residue.
    const sentinel = document.getElementById('da3p-frame-start-sentinel');
    if (sentinel) {
        if (sentinel._onKeydown) document.removeEventListener('keydown', sentinel._onKeydown);
        sentinel.remove();
    }
    const container = document.querySelector('.container');
    if (container) container.classList.remove('da3p-frame-start-active');
    [gReferenceHandSurface, ...gDeskSlots].forEach(el => {
        if (el) el.querySelectorAll('.desk-namebar[data-da3p-actor]').forEach(c => c.remove());
    });
    if (gScoreCont) gScoreCont.classList.remove('da3p-score-hidden');
    const actionsDiv = document.getElementById('da3p-frame-start-actions');
    if (actionsDiv) actionsDiv.remove();
    const gameActions = document.getElementById('game-actions');
    if (gameActions) gameActions.classList.remove('da3p-frame-start-actions-active');
    const legacyBoard = document.getElementById('three-pda-board');
    if (legacyBoard) legacyBoard.remove();
}

function setDisplaySettingFieldValue(field, value) {
    if (!gSettingsDraftDisplaySettings) gSettingsDraftDisplaySettings = { placeholder: true };
    if (field === 'userNaturalPosition') {
        gSettingsDraftDisplaySettings.userNaturalPosition = normalize4PUserNaturalPosition(value);
    } else if (field === 'selectedDA3PReferenceActor' || field === 'selected3PDAReferenceActor') {
        // Accept canonical selectedDA3PReferenceActor and legacy selected3PDAReferenceActor (Note 110a)
        gSettingsDraftDisplaySettings.selectedDA3PReferenceActor = normalizeDA3PReferenceActor(value);
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

// Note 110a: canonical name — createDA3PReferenceActorSelector
function createDA3PReferenceActorSelector(readOnly) {
    let wrapper = document.createElement('div');
    wrapper.className = 'settings-field';

    let label = document.createElement('label');
    label.textContent = t('settingsDialog.fields.selectedDA3PReferenceActor');
    wrapper.appendChild(label);

    let radioGroup = document.createElement('div');
    radioGroup.className = 'settings-radio-group';
    let current = getDraftDA3PReferenceActor();
    for (let value of VALID_3PDA_REFERENCE_ACTORS) {
        let radioLabel = document.createElement('label');
        radioLabel.className = 'settings-radio-option';

        let radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'selectedDA3PReferenceActor';
        radio.value = value;
        radio.checked = (value === current);
        radio.disabled = !!readOnly;
        radio.setAttribute('data-settings-field', 'selectedDA3PReferenceActor');

        if (!readOnly) {
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    setDisplaySettingFieldValue('selectedDA3PReferenceActor', value);
                    renderSettingsDialog();
                }
            });
        }

        radioLabel.appendChild(radio);
        radioLabel.appendChild(document.createTextNode(t('settingsDialog.fields.referenceActorOptionLabels.' + value)));
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
    let tableFormat = getRuleConfigFieldValue('tableFormat');
    if (tableFormat === ShengjiTableFormat.DA3P) {
        grid.appendChild(createDA3PReferenceActorSelector(readOnly));
    } else {
        grid.appendChild(createUserNaturalPositionSelector(readOnly));
    }
    container.appendChild(grid);
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
        let raw = (gSettingsDraftRuleConfig && gSettingsDraftRuleConfig.tableFormat) || ShengjiTableFormat.NORMAL_4P;
        return normalizeTableFormat(raw);
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
            let normalized = normalizeTableFormat(rawValue);
            gSettingsDraftRuleConfig.tableFormat = normalized;
            // DA3P requires rotate-pivot; force it when switching to da3p.
            if (normalized === ShengjiTableFormat.DA3P &&
                    gSettingsDraftRuleConfig.pivotPassMode === 'winner-pivot') {
                gSettingsDraftRuleConfig.pivotPassMode = 'rotate-pivot';
            }
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
    let sel = document.createElement('select');
    sel.className = 'settings-table-format-select';
    sel.setAttribute('data-settings-field', 'tableFormat');
    const opts = [
        { value: ShengjiTableFormat.NORMAL_4P, labelKey: 'normalFourPlayer' },
        { value: ShengjiTableFormat.DA3P,      labelKey: 'threePDA' },
    ];
    for (let opt of opts) {
        let op = document.createElement('option');
        op.value = opt.value;
        op.textContent = t('settingsDialog.options.' + opt.labelKey);
        sel.appendChild(op);
    }
    sel.value = getRuleConfigFieldValue('tableFormat');
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
        let isDisabled = !!readOnly;
        // DA3P requires rotate-pivot; disable winner-pivot under DA3P.
        if (opt.value === 'winner-pivot' &&
                getRuleConfigFieldValue('tableFormat') === ShengjiTableFormat.DA3P) {
            isDisabled = true;
        }
        radio.disabled = isDisabled;
        if (!readOnly && !isDisabled) {
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

    commitResolvedSettingsFromDraft();

    pendingNextFrame = null;
    closeSettingsDialog();

    let tableFormat = normalizeTableFormat(
        gResolvedGameSettings && gResolvedGameSettings.ruleConfig
            ? gResolvedGameSettings.ruleConfig.tableFormat
            : ShengjiTableFormat.NORMAL_4P
    );

    // Note 111f: DA3P first frame routes through shared dealing/declaration flow.
    if (tableFormat === ShengjiTableFormat.DA3P) {
        gameStartDA3PSharedFirstFrameFromSettings();
        return;
    }

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
    if (!gameCanLocallyControlActingSeat(cp, game.phase === GamePhase.PLAYING ? 'trick-play' : null)) return;
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

    maybeShowFakeMultiplayWarning(cp, result.fakeMultiplay);

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
        if (p !== selectedNaturalPositionIndex) updateExposedPreview(p);
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
    let winnerSlot = gameGetDeskSlotForSeat(result.winner);
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
        if (p !== selectedNaturalPositionIndex) updateExposedPreview(p);
    }

    let winnerName = gameGetPlayerLogNameForSeat(result.winner);
    let msg = t('log.roundResult', { round: game.currentRound - 1, playerName: winnerName, score: result.trickPoints > 0 ? t('log.trickPoints', { points: result.trickPoints }) : '' });
    appendLog(msg);
    updatePhaseDisplay(t('phase.roundWinner', { playerName: winnerName }));

    if (result.gameOver) {
        const _rrEpoch = getCurrentUiSessionEpoch(); // Note 108a
        setTimeout(() => { if (!isCurrentUiSessionEpoch(_rrEpoch)) return; finishGame(); }, BOT_DELAY);
    } else {
        // Short pause then start next round
        const _rrEpoch2 = getCurrentUiSessionEpoch(); // Note 108a
        setTimeout(() => {
            if (!isCurrentUiSessionEpoch(_rrEpoch2)) return; // Note 108a
            clearDesk();
            // Restore exposed-card previews that clearDesk() wiped
            for (let p = 0; p < NUM_PLAYERS; p++) {
                if (p !== selectedNaturalPositionIndex) updateExposedPreview(p);
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

    if (gameIsDA3PSharedFirstFrameActive()) {
        let da3pFrameResult = gameBuildDA3PFrameResultFromFinalize(result);
        let consumed = gameConsumeDA3PFrameResult(da3pFrameResult);
        if (!da3pFrameResult || !consumed) {
            gameStopDA3PAtCountingEntry(result);
            return;
        }

        appendLog(t('log.levelAdvance', {
            players: (da3pFrameResult.defenseHolds
                ? [da3pFrameResult.pivotActor]
                : da3pFrameResult.attackingActors
            ).join(', '),
            delta: da3pFrameResult.levelDelta,
        }));

        if (consumed.gameWon) {
            appendLog(t('log.gameWon', { players: consumed.winners.join(', ') }));
            updatePhaseDisplay(t('phase.gameWon'));
        } else {
            gBtnNewGame.textContent = t('buttons.nextFrame');
        }

        showCountingDialog(result, da3pFrameResult, consumed);
        return;
    }

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

function getDA3PResultActorsForCountingSummary(frameResult) {
    if (!frameResult) return [];

    if (frameResult.defenseHolds) {
        return [frameResult.pivotActor].filter(actor => actor && actor !== 'D');
    }

    let canonical = Array.isArray(frameResult.canonicalFrameOrder)
        ? frameResult.canonicalFrameOrder
        : [];
    let successorActor = canonical[1];
    let predecessorActor = canonical[3];
    let actors = [successorActor, predecessorActor].filter(actor => actor && actor !== 'D');

    if (actors.length > 0) return actors;

    let fallback = Array.isArray(frameResult.attackingActors)
        ? frameResult.attackingActors.filter(actor => actor && actor !== 'D')
        : [];
    return fallback.slice(0, 2);
}

function getDA3PCountingResultPhrase(frameResult, actorCount) {
    if (!frameResult) return '';

    let count = Number.isInteger(actorCount) ? actorCount : 1;
    let delta = Math.max(0, Math.floor(Number(frameResult.levelDelta) || 0));
    let takeStage = !frameResult.defenseHolds && (delta === 0 || frameResult.resultKey === 'takeStage');
    let locale = getLocale();

    if (takeStage) {
        return locale === 'en' ? ' take stage' : '上台';
    }
    if (delta <= 0) {
        return locale === 'en' ? (' ' + t('counting.noLevelChange')) : t('counting.noLevelChange');
    }
    if (locale === 'en') {
        if (delta === 1) return (count > 1) ? ' advance 1 level' : ' advances 1 level';
        return (count > 1) ? (' advance ' + String(delta) + ' levels') : (' advances ' + String(delta) + ' levels');
    }
    return '升' + String(delta) + '级';
}

function getDA3PCountingResultSummary(frameResult) {
    if (!frameResult) return '';
    let locale = getLocale();
    let actors = getDA3PResultActorsForCountingSummary(frameResult);
    let labels = actors.map(actor => gameGetFrameActorLabel(actor)).filter(Boolean);
    let phrase = getDA3PCountingResultPhrase(frameResult, labels.length);
    if (labels.length === 0) return phrase.trim();
    let joined = (locale === 'en') ? labels.join(' ') : labels.join('');
    return joined + phrase;
}

function getCountingDialogResultDetail(frameResult) {
    if (!frameResult) return '';
    if (frameResult.tableFormat === ShengjiTableFormat.DA3P) {
        return getDA3PCountingResultSummary(frameResult);
    }
    if (!Array.isArray(frameResult.advancingPlayers) || frameResult.advancingPlayers.length === 0) return '';
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
    if (!applied) return;

    if (gameIsDA3PSharedFirstFrameActive()) {
        let nextContext = pendingNextFrame && pendingNextFrame.da3pFrameContext
            ? pendingNextFrame.da3pFrameContext
            : null;
        if (!nextContext || !nextContext.displayMap) return;
        renderDA3PLevelPositionSquare(host, {
            boxId: 'cd-next-frame-box',
            boxClassName: 'cd-next-frame-box',
            squareId: 'cd-next-frame-square',
            squareClassName: 'cd-next-frame-square',
            triangleClassName: 'cd-next-frame-triangle',
            displayMap: nextContext.displayMap,
            levelsByActor: nextContext.levelsByActor,
            levelCyclesByActor: nextContext.levelCyclesByActor,
            pivotActor: nextContext.pivotStatus === 'resolved' ? nextContext.pivotActor : null,
        });
        return;
    }

    if (!Array.isArray(applied.newLevels)) return;

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
        referenceActorSeat: selectedNaturalPositionIndex,
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
    let da3pDesk = (frameResult && frameResult.da3pAttackerDeskScore)
        || result.da3pAttackerDeskScore
        || breakdown.da3pAttackerDeskScore
        || null;
    let isDA3PSplit = !!(frameResult && frameResult.tableFormat === ShengjiTableFormat.DA3P && da3pDesk && da3pDesk.scoreByActor);
    if (isDA3PSplit) {
        let successorActor = da3pDesk.successorActor;
        let predecessorActor = da3pDesk.predecessorActor;
        let successorScore = Number(da3pDesk.scoreByActor[successorActor]) || 0;
        let predecessorScore = Number(da3pDesk.scoreByActor[predecessorActor]) || 0;
        addScoreRow(cdScore, t('counting.deskScore'), '');
        addScoreRow(cdScore, t('counting.deskScoreSuccessor'), successorScore, { indentLevel: 1 });
        addScoreRow(cdScore, t('counting.deskScorePredecessor'), predecessorScore, { indentLevel: 1 });
    } else {
        addScoreRow(cdScore, t('counting.deskScore'), deskScore);
    }
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
        if (pendingNextFrame && pendingNextFrame.tableFormat === ShengjiTableFormat.DA3P && pendingNextFrame.da3pFrameContext) {
            gameStartDA3PSharedFrameFromContext(
                pendingNextFrame.da3pFrameContext,
                pendingNextFrame.selectedReferenceActor
            );
            pendingNextFrame = null;
            return;
        }
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

function addScoreRow(parent, label, value, options) {
    let opts = options || {};
    let row = document.createElement('div');
    row.className = 'cd-score-row';
    if (Number.isInteger(opts.indentLevel) && opts.indentLevel > 0) {
        row.style.paddingLeft = String(opts.indentLevel * 12) + 'px';
    }
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
    gBtnPause.addEventListener('click', () => requestPause(localControlledPlayerIndex));
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
        confirmQuitDuringPause(pauseState.quitRequesterSeat !== null ? pauseState.quitRequesterSeat : localControlledPlayerIndex);
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
    if (game && game.phase === GamePhase.PLAYING && isLocallyControlledSeat(engineGetCurrentPlayer()) && !gBtnPlay.disabled) {
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
