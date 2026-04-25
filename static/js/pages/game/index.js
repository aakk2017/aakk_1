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
const gShand   = document.getElementById('shand');

const gDeskSlots = [
    document.getElementById('desk-south'),
    document.getElementById('desk-east'),
    document.getElementById('desk-north'),
    document.getElementById('desk-west')
];

const gDeskCenter  = document.getElementById('desk-center');
const gDeskInfo    = document.getElementById('desk-center-info');
const gLabelNorth  = document.getElementById('label-north');
const gLabelWest   = document.getElementById('label-west');
const gLabelEast   = document.getElementById('label-east');
const gLabelSouth  = document.getElementById('label-south');
const gBtnNewGame  = document.getElementById('btn-new-game');
const gBtnPlay     = document.getElementById('btn-play');
// gBtnDeclare removed
const gDeclareMatrix = document.getElementById('declare-matrix');
const gDeclBtnsSingle = [0, 1, 2, 3, 4].map(i => document.getElementById('declare-btn-s' + i));
const gDeclBtnsDouble = [0, 1, 2, 3, 4].map(i => document.getElementById('declare-btn-d' + i));
const gBotCountEast  = document.getElementById('count-east');
const gBotCountNorth = document.getElementById('count-north');
const gBotCountWest  = document.getElementById('count-west');
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
const gBtnNoDeclare    = document.getElementById('btn-no-declare');
const gBtnGameSettings = document.getElementById('btn-game-settings');
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

// ---------------------------------------------------------------------------
// Test mode: human controls both South (0) and East (1)
// ---------------------------------------------------------------------------
let TEST_MODE = false;
let HUMAN_PLAYERS = TEST_MODE ? new Set([0, 1]) : new Set([0]);
function isHumanControlled(player) { return HUMAN_PLAYERS.has(player); }

function toggleTestMode() {
    TEST_MODE = !TEST_MODE;
    HUMAN_PLAYERS = TEST_MODE ? new Set([0, 1]) : new Set([0]);
    const btn = document.getElementById('btn-toggle-test');
    if (btn) btn.textContent = t(TEST_MODE ? 'buttons.testModeOn' : 'buttons.testModeOff');
}

// Track which human-controlled player's hand is currently displayed
let activeHumanPlayer = HUMAN_PLAYER;

// ForehandControlInteractionState
// When active: { target, controller, exposedDivisionCards, exposedCardIds: Set,
//   selectedCornerIds: Set, mode: string|null, selectionMounted: bool, commitButtonsMounted: bool }
let gFCInteraction = null;

// Settings dialog state (note 34 / 35c)
let gSettingsMode = 'create'; // 'create' | 'inspect'
let gSettingsActiveTab = 'presets';
let gSettingsTopLevelTab = 'game'; // 'game' | 'display' | 'file' | 'accounts'
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

// Dealing phase state
let currentDeclaration = null;   // declaration made by human during dealing
let dealingTimer     = null;   // setInterval handle for deal animation

// Frame number within current game (starts at 1, increments per frame)
let frameNumber = 0;

// Attackers' consecutive-attack streak counter (reset when pivot changes teams)
let attackersStreak = 0;

// Attackers' won counter cards (temporal order, reset per frame) — for §2 drawer
let wonCounterCards = [];

// Persistent name bar DOM refs [south, east, north, west]
let gDeskNamebars = [null, null, null, null];

// Sequential overbase decision state (note 41)
let gOverbaseDecision = null;

// Declaration-history hover-box state (note 41f)
let gDeclarationHistoryRows = [];
let gDeclHistoryBox = null;
let gDeclHistoryTbody = null;

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
    // Create persistent name bars for all players
    for (let p = 0; p < NUM_PLAYERS; p++) {
        let container = (p === HUMAN_PLAYER) ? gShand : gDeskSlots[p];
        if (!container) continue;

        // Remove any old persistent namebar
        let old = container.querySelector('.desk-namebar');
        if (old) old.remove();

        let nb = document.createElement('div');
        nb.className = (p === HUMAN_PLAYER) ? 'desk-namebar shand-namebar' : 'desk-namebar';
        nb.setAttribute('data-status', 'idle');

        let posArea = document.createElement('div');
        posArea.className = 'game-position-area';
        posArea.textContent = POSITION_LABELS[p];
        nb.appendChild(posArea);

        let nameArea = document.createElement('div');
        nameArea.className = 'name-area';
        let pName = PLAYER_NAMES[p].replace(/^[\u4e1c\u5357\u897f\u5317]\s*\(?/, '').replace(/\)?$/, '');
        nameArea.textContent = pName;
        nb.appendChild(nameArea);

        if (p !== HUMAN_PLAYER) {
            // Exposed-card preview container (non-human only)
            let preview = document.createElement('div');
            preview.className = 'exposed-preview';
            nb.appendChild(preview);
        }

        container.appendChild(nb);
        gDeskNamebars[p] = nb;
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
        if (gDeskSlots[player]) gDeskSlots[player].removeAttribute('data-has-exposed');
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
    if (gDeskSlots[player]) gDeskSlots[player].setAttribute('data-has-exposed', '');
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

// ---------------------------------------------------------------------------
// Hand rendering — only the human player's hand is displayed
// ---------------------------------------------------------------------------

function renderAllHands() {
    renderHand(activeHumanPlayer);
}

function renderHand(player) {
    if (!isHumanControlled(player)) return;
    if (player !== activeHumanPlayer) return;
    let el = gShand;
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
    if (game.phase === GamePhase.PLAYING && !isHumanControlled(engineGetCurrentPlayer())) return;
    if (game.phase !== GamePhase.PLAYING && game.phase !== GamePhase.BASING) return;

    if (selectedCardIds.has(cardId)) {
        selectedCardIds.delete(cardId);
        el.setAttribute('card-selected', 'false');
    } else {
        // Auto-deselect rule: if following a single-card lead and one card is already selected
        if (game.phase === GamePhase.PLAYING && game.currentTurnIndex > 0 && game.leadInfo && game.leadInfo.volume === 1) {
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

/**
 * Populate N/W/E player name labels in desk slots.
 * South (human) has no label — the namebar on shand serves that purpose.
 * Called once per game start (labels remain until next game).
 */
function initDeskLabels() {
    // Players: 0=South(human), 1=East, 2=North, 3=West
    if (gLabelNorth) gLabelNorth.textContent = PLAYER_NAMES[2];
    if (gLabelWest)  gLabelWest.textContent  = PLAYER_NAMES[3];
    if (gLabelEast)  gLabelEast.textContent  = PLAYER_NAMES[1];
    if (gLabelSouth) gLabelSouth.textContent = PLAYER_NAMES[0];
}

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
    let slot = gDeskSlots[player];
    // Remove any existing marker for this player
    slot.querySelectorAll('.basing-pass-marker').forEach(el => el.remove());
    let marker = document.createElement('div');
    marker.className = 'basing-pass-marker';
    // PASS is authoritative and non-localized for this live-flow marker.
    marker.textContent = 'PASS';
    slot.appendChild(marker);
}

function renderDeskCards(player, cards) {
    let slot = gDeskSlots[player];
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
        gDeskSlots[i].removeAttribute('data-active');
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
        // Hue 0->60 for score 0->40, same formula as recap: h = s * 3 / 2
        const h = s * 3 / 2;
        gScoreCont.style.borderColor = 'hsl(' + h + ', 100%, 50%)';
    }
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
    let slot = gDeskSlots[player];
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

    let digitEl = showCenterTimer(seconds);

    gTimerInterval = setInterval(() => {
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

    showTimerOverlay(player);

    gTimerInterval = setInterval(() => {
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
    ensureResolvedSettings();

    // Clean up any in-progress dealing timer
    if (dealingTimer) { clearInterval(dealingTimer); dealingTimer = null; }
    currentDeclaration = null;
    resetDeclarationHistoryRows();

    // Clear all active timers (note 24)
    clearTimers();

    // §3: Clear forehand-control and failed-multiplay aftermath UI state
    gFCInteraction = null;

    clearLog();
    clearSelection();
    clearDesk();
    initDeskLabels();
    clearBotDealCounts();
    gDeclareMatrix.style.display = 'none';
    hideCountingDialog();
    gBtnPlay.disabled = true;
    gBtnPlay.textContent = t('buttons.play');

    // Hide show-base button (§5)
    if (gBtnShowBase) gBtnShowBase.style.display = 'none';
    if (gBasePreview) gBasePreview.innerHTML = '';

    let level, pivot, playerLevels, isQiangzhuang;
    if (pendingNextFrame) {
        // Continue session: use computed next-frame parameters
        level = pendingNextFrame.level;
        pivot = pendingNextFrame.pivot;
        playerLevels = pendingNextFrame.playerLevels;
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
        pivot = Math.floor(Math.random() * NUM_PLAYERS);
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

    // Seat marks: frame 2+ shows pivot immediately; frame 1 starts undetermined
    if (!isQiangzhuang) {
        let humanRelPivot = (pivot + 4 - HUMAN_PLAYER) % 4;
        let pivotPosNames = ['reference', 'afterhand', 'opposite', 'forehand'];
        gSeatsDiv.setAttribute('pivot', pivotPosNames[humanRelPivot]);
    } else {
        gSeatsDiv.setAttribute('pivot', 'undetermined');
    }

    gBtnNewGame.textContent = t('buttons.newGame');
    engineStartGame(level, pivot, playerLevels, isQiangzhuang, gResolvedGameSettings.ruleConfig);
    game.displaySettings = { ...(gResolvedGameSettings.displaySettings || { placeholder: true }) };

    // Reset won counters and refresh drawer only after authoritative new-frame state reset.
    wonCounterCards = [];
    updateCounterDrawer();

    // Initialize persistent name bars (§3)
    initPersistentNamebars();

    // Display level
    gLevelDiv.textContent = numberToLevel[game.level];

    // Frame-start 2s intermittent (note 24 §3)
    runFrameIntermittent();
}

// ---------------------------------------------------------------------------
// Dealing phase  (animated, 0.5s per round of 4 cards)
// ---------------------------------------------------------------------------

/**
 * Frame-start 2s non-interactive intermittent (note 24 §3).
 * Displays pivot/level info or qiangzhuang text, then starts dealing.
 */
function runFrameIntermittent() {
    gTimingPhase = 'intermittent';
    gBtnPlay.disabled = true;
    gDeclareMatrix.style.display = 'none';

    // Central display text
    let displayText;
    if (game.isQiangzhuang) {
        displayText = t('timing.intermittentQiangzhuang');
    } else {
        let pivotPosition = POSITION_LABELS[game.pivot];
        displayText = t('timing.intermittentNormal', { position: pivotPosition, level: numberToLevel[game.level] });
    }

    gDeskInfo.innerHTML = '<div class="timer-intermittent">' + displayText + '</div>';

    setTimeout(() => {
        gTimingPhase = null;
        gDeskInfo.innerHTML = '';
        runDealingPhase();
    }, getTimingConfigForPage().frameIntermittent * 1000);
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
            whatHtml: row.what || getHistoryAutoStrainText(),
            whenHow: row.whenHow || '',
            strainKey: '',
        };
    }
    return {
        who: getNaturalPositionShort(row.player),
        whatHtml: getDeclarationWhatHtml(row.suit, row.count),
        whenHow: row.phase === 'dealing' ? String(row.whenHow || '') : getBasingWhenHowLabel(row.basingMode || 'ob'),
        strainKey: row.suit === 4 ? (row.count >= 4 ? 'w' : 'v') : numberToSuitName[row.suit],
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
        if (values.strainKey) tr.setAttribute('data-strain', values.strainKey);

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
        what: getHistoryAutoStrainText(),
        whenHow: '',
    });
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
            let p = (game.pivot + i) % NUM_PLAYERS;
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
        let p = (game.pivot + i) % NUM_PLAYERS;
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
    } else {
        engineSetStrain(4);
        gDenomArea.setAttribute('strain', 'v');
        gStrainDiv.innerHTML = ntsHtml;
        appendLog(t('log.noDeclaration'));
        recordAutoStrainHistoryRow();
    }

    // Update pivot seat indicator
    let humanRelPivot = (game.pivot + 4 - HUMAN_PLAYER) % 4;
    let pivotPosNames = ['reference', 'afterhand', 'opposite', 'forehand'];
    gSeatsDiv.setAttribute('pivot', pivotPosNames[humanRelPivot]);

    clearBotDealCounts();
    renderAllHands();
    updateScoreDisplay();

    clearDesk(); // Clear exposed declaration cards

    // Move to basing phase
    enginePickUpBase();
    runBasingPhase();
}

// ---------------------------------------------------------------------------
// Basing phase
// ---------------------------------------------------------------------------

function runBasingPhase() {
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
    if (game.gameConfig && game.gameConfig.allowOverbase) {
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
        showTimerOverlay(player);

        gTimerInterval = setInterval(() => {
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

        // Start play-card shot clock (note 24 §10.2)
        startPlayerMoveTimer(cp, 'play', () => {
            autoPlayAsBot(cp);
        });
    } else {
        updateStatus(t('status.botThinking', { playerName: PLAYER_NAMES[cp] }));
        updatePhaseDisplay(t('phase.botPlaying', { playerName: PLAYER_NAMES[cp] }));
        gBtnPlay.disabled = true;
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
    let slot = gDeskSlots[player];
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
    // During forehand control exercise, the main play button commits FC with must-play
    if (gFCInteraction) {
        commitForehandControl('must-play');
        return;
    }

    let cp = (game.phase === GamePhase.BASING) ? getActiveBaserPlayer() : engineGetCurrentPlayer();
    humanPlayCardsCore(cp);
}

// ---------------------------------------------------------------------------
// Settings dialog (note 34)
// ---------------------------------------------------------------------------

const SETTINGS_FIELDS_BY_TAB = {
    presets: ['presetName'],
    general: ['deckCount', 'autoStrain', 'allowOverbase', 'overbaseRestrictions', 'failedMultiplayHandling', 'multiplayCompensationAmount', 'allowCrossings'],
    scoring: ['scoringPreset', 'endingCompensation', 'stageThreshold', 'levelThreshold', 'levelUpLimitPerFrame', 'baseMultiplierScheme', 'attackersSelfBaseHalfMultiplier'],
    levels: ['levelsPreset', 'startLevel', 'mustDefendLevels', 'mustStopLevels', 'knockBackLevels', 'gameMode'],
    timing: ['timingPreset', 'timingMode', 'playShotClock', 'baseShotClock', 'bankTime', 'baseTimeIncrement'],
};

const SETTINGS_SELECT_OPTIONS = {
    presetName: () => Object.keys(window.shengjiSettingsPresets || { 'default': {} }),
    autoStrain: ['false', 'true'],
    allowOverbase: ['false', 'true'],
    overbaseRestrictions: ['none', 'default'],
    failedMultiplayHandling: ['default', 'compensation'],
    allowCrossings: ['false', 'true'],
    scoringPreset: ['', 'traditional', 'traditional-power', '7-3-5', '8-4-4'],
    baseMultiplierScheme: ['limited', 'single-or-not', 'exponential', 'power'],
    levelsPreset: ['', 'default', 'high-school', 'slow', 'plain', 'short'],
    gameMode: ['endless', 'pass-A'],
    timingPreset: ['', 'normal', '180+30'],
    timingMode: ['shot + bank', 'bank-time-only'],
};

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
        displaySettings: { placeholder: true },
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

function settingsOptionLabel(value) {
    const map = {
        'true': 'yes',
        'false': 'no',
        'Infinity': 'unlimited',
        'none': 'none',
        '': 'noPreset',
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
        'slow': 'slow',
        'short': 'short',
        // base multiplier schemes
        'limited': 'limited',
        'single-or-not': 'singleOrNot',
        'exponential': 'exponential',
        'power': 'power',
    };
    let key = map[String(value)] || String(value);
    return t('settingsDialog.options.' + key);
}

function getRuleConfigFieldValue(field) {
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
        if (sp.stageThreshold !== undefined && cfg.stageThreshold !== sp.stageThreshold) ok = false;
        if (sp.levelThreshold !== undefined && cfg.levelThreshold !== sp.levelThreshold) ok = false;
        if (sp.levelUpLimitPerFrame !== undefined && cfg.levelUpLimitPerFrame !== sp.levelUpLimitPerFrame) ok = false;
        if (sp.baseMultiplierScheme !== undefined && cfg.baseMultiplierScheme !== sp.baseMultiplierScheme) ok = false;
        if (sp.attackersSelfBaseHalfMultiplier !== undefined && !!cfg.attackersSelfBaseHalfMultiplier !== sp.attackersSelfBaseHalfMultiplier) ok = false;
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
    return {
        mustDefendStartMarker: !!(cfg && cfg.mustDefendStartMarker),
        mustDefendLiteralLevels: defend,
        mustStopStartMarker: !!(cfg && cfg.mustStopStartMarker),
        mustStopLiteralLevels: stop,
        knockBackLiteralLevels: knock,
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

    // Conflict on literal ranks
    let defendLiteralSet = new Set(normalizeLevelArrayForMatrix(gLevelsMatrixDraftState.mustDefendLiteralLevels));
    stop = stop.filter(x => !defendLiteralSet.has(x));

    return {
        mustDefendLevels: [...new Set(defend)].sort((a, b) => a - b),
        mustStopLevels: [...new Set(stop)].sort((a, b) => a - b),
        knockBackLevels: normalizeLevelArrayForMatrix(gLevelsMatrixDraftState.knockBackLiteralLevels),
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
    gSettingsDraftRuleConfig.mustDefendStartMarker = mapped.mustDefendStartMarker;
    gSettingsDraftRuleConfig.mustStopStartMarker = mapped.mustStopStartMarker;
}

function resetLevelsMatrixStateFromRuleConfig() {
    gLevelsMatrixDraftState = buildLevelsMatrixStateFromRuleConfig(gSettingsDraftRuleConfig || {});
}

function setRuleConfigFieldValue(field, rawValue) {
    if (field === 'presetName') {
        if (typeof shengjiResolveGameRuleConfig === 'function') {
            gSettingsDraftRuleConfig = cloneRuleConfig(shengjiResolveGameRuleConfig({ presetName: rawValue }));
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
            if (sp.stageThreshold !== undefined) gSettingsDraftRuleConfig.stageThreshold = sp.stageThreshold;
            if (sp.levelThreshold !== undefined) gSettingsDraftRuleConfig.levelThreshold = sp.levelThreshold;
            if (sp.levelUpLimitPerFrame !== undefined) gSettingsDraftRuleConfig.levelUpLimitPerFrame = sp.levelUpLimitPerFrame;
            if (sp.baseMultiplierScheme !== undefined) gSettingsDraftRuleConfig.baseMultiplierScheme = sp.baseMultiplierScheme;
            if (sp.attackersSelfBaseHalfMultiplier !== undefined) {
                gSettingsDraftRuleConfig.attackersSelfBaseHalfMultiplier = sp.attackersSelfBaseHalfMultiplier;
                // Presets that require attackersSelfBaseHalfMultiplier must also enable allowOverbase
                // so normalizeRuleConfig does not force the value back to false.
                if (sp.attackersSelfBaseHalfMultiplier) gSettingsDraftRuleConfig.allowOverbase = true;
            }
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
            if (lp.knockBackConditionMode !== undefined) gSettingsDraftRuleConfig.knockBackConditionMode = lp.knockBackConditionMode;
            if (lp.knockBackTakeStageRequired !== undefined) gSettingsDraftRuleConfig.knockBackTakeStageRequired = !!lp.knockBackTakeStageRequired;
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
        gSettingsDraftRuleConfig.multiplayCompensation = (rawValue === 'compensation');
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

    if (['deckCount', 'multiplayCompensationAmount', 'stageThreshold', 'levelThreshold', 'startLevel'].includes(field)) {
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
        syncLevelsPresetLabel();
        return;
    }

    if (field === 'knockBackTakeStageRequired') {
        gSettingsDraftRuleConfig.knockBackTakeStageRequired = !!rawValue;
        syncLevelsPresetLabel();
        return;
    }

    gSettingsDraftRuleConfig[field] = value;
    if (['endingCompensation', 'baseMultiplierScheme', 'attackersSelfBaseHalfMultiplier'].includes(field)) {
        syncScoringPresetLabel();
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
    cell.disabled = !!readOnly || !interactive;
    cell.textContent = displayLabel;

    if (!readOnly && interactive) {
        cell.addEventListener('click', () => {
            onClick(levelKey);
        });
    }

    return cell;
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
                setRuleConfigFieldValue('startLevel', Number(levelKey));
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
                if (levelKey === LEVEL_MATRIX_KEY_START_MARKER) {
                    levelsMatrixToggleSemantic('mustDefendLevels');
                } else {
                    levelsMatrixToggleLiteral('mustDefendLevels', levelKey);
                }
                applyLevelsMatrixStateToRuleConfig();
                syncLevelsPresetLabel();
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
                if (levelKey === LEVEL_MATRIX_KEY_START_MARKER) {
                    levelsMatrixToggleSemantic('mustStopLevels');
                } else {
                    levelsMatrixToggleLiteral('mustStopLevels', levelKey);
                }
                applyLevelsMatrixStateToRuleConfig();
                syncLevelsPresetLabel();
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
                levelsMatrixToggleLiteral('knockBackLevels', levelKey);
                applyLevelsMatrixStateToRuleConfig();
                syncLevelsPresetLabel();
                renderSettingsDialog();
            },
            isSelected: (levelKey) => {
                if (levelKey === LEVEL_MATRIX_KEY_SPACER) return false;
                return normalizeLevelArrayForMatrix(gLevelsMatrixDraftState.knockBackLiteralLevels).includes(Number(levelKey));
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

    return row;
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
        { value: 'true', label: t('settingsDialog.options.thirdInitBase'), disabled: true }
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

    // Row 1: deck count with disabled 1/3/4 options visible.
    let row1 = document.createElement('div');
    row1.className = 'general-row';
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

    // Row 2: auto strain radios + hint.
    let row2 = document.createElement('div');
    row2.className = 'general-row';
    let autoField = document.createElement('div');
    autoField.className = 'settings-field';
    autoField.setAttribute('data-settings-field', 'autoStrain');
    let autoLabel = document.createElement('label');
    autoLabel.textContent = t('settingsDialog.fields.autoStrain');
    autoField.appendChild(autoLabel);
    autoField.appendChild(createGeneralAutoStrainSelector(getRuleConfigFieldValue('autoStrain'), readOnly));
    row2.appendChild(autoField);
    row2.appendChild(createGeneralHint(t('settingsDialog.generalHints.autoStrain'), 'general-hint-auto-strain'));
    rows.appendChild(row2);

    // Row 3: overbase + conditional restriction + conditional hint.
    let row3 = document.createElement('div');
    row3.className = 'general-row';

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
    row3.appendChild(overbaseField);

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
        row3.appendChild(restrictionField);

        if (restrictionChecked) {
            row3.appendChild(createGeneralHint(t('settingsDialog.generalHints.overbaseRestriction'), 'general-hint-overbase-restriction'));
        }
    }
    rows.appendChild(row3);

    // Row 4: crossing + hint.
    let row4 = document.createElement('div');
    row4.className = 'general-row';
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
    row4.appendChild(crossingField);
    row4.appendChild(createGeneralHint(t('settingsDialog.generalHints.crossing'), 'general-hint-crossing'));
    rows.appendChild(row4);

    // Row 5: failed multiplay + conditional compensation amount + hint.
    let row5 = document.createElement('div');
    row5.className = 'general-row';

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
    row5.appendChild(failedField);

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
        row5.appendChild(compField);
        row5.appendChild(createGeneralHint(t('settingsDialog.generalHints.multiplayCompensationAmount'), 'general-hint-multiplay-compensation'));
    }

    rows.appendChild(row5);

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

    // Row 5: attackers' self-base half multiplier
    let row5 = document.createElement('div');
    row5.className = 'scoring-row';
    row5.appendChild(createSettingsFieldEl('attackersSelfBaseHalfMultiplier', readOnly));
    rows.appendChild(row5);

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
            gSettingsPlaceholderPanel.textContent = t('settingsDialog.placeholders.' + gSettingsTopLevelTab);
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

    if (gSettingsActiveTab === 'scoring') {
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
    gSettingsActiveTab = 'presets';
    gSettingsTopLevelTab = 'game';

    if (mode === 'inspect') {
        let sourceRule = (game && game.gameConfig) ? game.gameConfig : gResolvedGameSettings.ruleConfig;
        gSettingsDraftRuleConfig = cloneRuleConfig(sourceRule);
        gSettingsDraftDisplaySettings = { ...(game && game.displaySettings ? game.displaySettings : gResolvedGameSettings.displaySettings) };
    } else {
        gSettingsDraftRuleConfig = cloneRuleConfig(gResolvedGameSettings.ruleConfig);
        gSettingsDraftDisplaySettings = { ...gResolvedGameSettings.displaySettings };
    }

    // Sync preset labels to current config state
    syncScoringPresetLabel();
    syncLevelsPresetLabel();
    syncTimingPresetLabel();
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
    if (!isHumanControlled(cp)) return;
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
    let result = engineEndRound();
    highlightActivePlayer(-1);
    gDeskSlots[result.winner].setAttribute('data-winner', 'true');
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
                playerLevels: applied.newLevels
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
function showCountingDialog(result, frameResult, applied) {
    if (!gCountingDialog) return;

    // Canonical settlement source of truth (note 35e): all displayed rows and total
    // must come from the same finalized score-breakdown object.
    let breakdown = result.scoreBreakdown || {
        counterScore: result.counterScore,
        baseScore: result.baseScore,
        endingCompensation: result.endingCompensation,
        multiplayCompensation: result.multiplayCompensation,
        totalScore: result.totalScore,
    };

    // Size: match #desk-south width × 2× height
    let deskSouth = document.getElementById('desk-south');
    if (deskSouth) {
        let w = deskSouth.offsetWidth;
        let h = deskSouth.offsetHeight * 2;
        gCountingDialog.style.width = w + 'px';
        gCountingDialog.style.height = h + 'px';
    }

    // Row 1 left: base cards as corner-cards
    let cdBase = document.getElementById('cd-base');
    cdBase.innerHTML = '<div id="cd-base-label">' + t('counting.baseLabel') + '</div>';
    if (game.base) {
        let sorted = [...game.base];
        engineSortHand(sorted);
        for (let c of sorted) {
            cdBase.appendChild(createCornerCard(c));
        }
    }

    // Row 1 right: score breakdown
    let cdScore = document.getElementById('cd-score');
    cdScore.innerHTML = '<div style="font-weight:bold;margin-bottom:0.5vh;">' + t('counting.scoreLabel') + '</div>';
    let deskScore = breakdown.counterScore;
    addScoreRow(cdScore, t('counting.deskScore'), deskScore);
    if (breakdown.baseScore > 0) {
        addScoreRow(cdScore, t('counting.baseScore'), breakdown.baseScore);
    }
    if (result.endingCompensationActive) {
        addScoreRow(cdScore, t('counting.endingCompensation'), breakdown.endingCompensation);
    }
    if (result.multiplayCompensationActive) {
        addScoreRow(cdScore, t('counting.multiplayCompensation'), breakdown.multiplayCompensation);
    }
    let totalDiv = document.createElement('div');
    totalDiv.className = 'cd-score-row cd-score-total';
    totalDiv.innerHTML = '<span>' + t('counting.totalScore') + '</span><span>' + breakdown.totalScore + '</span>';
    cdScore.appendChild(totalDiv);

    // Row 2 left: result summary
    let cdResultName = document.getElementById('cd-result-name');
    cdResultName.textContent = result.result;
    let cdLevels = document.getElementById('cd-result-levels');
    cdLevels.innerHTML = '';
    if (frameResult) {
        let chLine = document.createElement('div');
        if (frameResult.levelDelta > 0) {
            chLine.textContent = t('counting.levelChange', { delta: frameResult.levelDelta });
        } else {
            chLine.textContent = t('counting.noLevelChange');
        }
        cdLevels.appendChild(chLine);
        if (applied && applied.newLevels) {
            // Use stable natural team labels (南北 = seats 0,2; 东西 = seats 1,3)
            let nsLevel = applied.newLevels[0]; // South/North team
            let ewLevel = applied.newLevels[1]; // East/West team
            let teamLine = document.createElement('div');
            teamLine.setAttribute('data-result-ns-level', String(nsLevel));
            teamLine.setAttribute('data-result-ew-level', String(ewLevel));
            teamLine.textContent = t('counting.teamLevels', {
                nsLevel: numberToLevel[nsLevel] || nsLevel,
                ewLevel: numberToLevel[ewLevel] || ewLevel
            });
            cdLevels.appendChild(teamLine);
        }
    }

    // Row 2 right: buttons (already in HTML)
    let btnReady = document.getElementById('cd-btn-ready');
    let btnLeave = document.getElementById('cd-btn-leave');
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
        gShand.innerHTML = '';
        gBtnNewGame.textContent = t('buttons.newGame');
        updatePhaseDisplay(t('phase.initial'));
        updateStatus(t('status.ready'));
    };

    gCountingOverlay.style.display = 'block';
    gCountingDialog.style.display = 'block';
}

function addScoreRow(parent, label, value) {
    let row = document.createElement('div');
    row.className = 'cd-score-row';
    row.innerHTML = '<span>' + label + '</span><span>' + value + '</span>';
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

if (gBtnGameSettings) {
    gBtnGameSettings.addEventListener('click', onFooterSettingsClick);
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
if (gDenomArea) {
    gDenomArea.addEventListener('mouseenter', renderDeclarationHistoryRows);
}
ensureResolvedSettings();
updatePhaseDisplay(t('phase.initial'));
updateStatus(t('status.ready'));
