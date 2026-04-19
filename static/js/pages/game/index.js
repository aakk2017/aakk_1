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
const gBaseScoreDiv= document.getElementById('div-base-score');
const gCounterDrawerInner = document.getElementById('counter-drawer-inner');
const gCounterDrawer = document.getElementById('counter-drawer');
const gBtnShowBase = document.getElementById('btn-show-base');
const gBasePreview = document.getElementById('base-preview');
const gCountingDialog  = document.getElementById('counting-dialog');
const gCountingOverlay = document.getElementById('counting-overlay');

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

// ---------------------------------------------------------------------------
// Card selection state
// ---------------------------------------------------------------------------
let selectedCardIds = new Set();

// Bot turn delay (ms)
const BOT_DELAY = 600;

// Dealing phase state
let currentDeclaration = null;   // declaration made by human during dealing
let dealingTimer     = null;   // setInterval handle for deal animation

// Attackers' won counter cards (temporal order, reset per frame) — for §2 drawer
let wonCounterCards = [];

// Persistent name bar DOM refs [south, east, north, west]
let gDeskNamebars = [null, null, null, null];

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
            cc.querySelector('.card').appendChild(marker);
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
        // Remove cards and transient namebar, but keep persistent .desk-namebar
        slot.querySelectorAll('.card-container, .hand, .namebar:not(.desk-namebar)').forEach(el => el.remove());
        slot.removeAttribute('data-active');
        slot.removeAttribute('data-winner');
        slot.removeAttribute('data-has-exposed');
    }
    if (gDeskInfo) gDeskInfo.textContent = '';
    resetAllNamebars();
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
// Game flow
// ---------------------------------------------------------------------------

function startNewGame() {
    // Clean up any in-progress dealing timer
    if (dealingTimer) { clearInterval(dealingTimer); dealingTimer = null; }
    currentDeclaration = null;

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

    // Reset won counters (§2)
    wonCounterCards = [];
    updateCounterDrawer();

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
    } else {
        // Fresh game
        level = 0;
        pivot = Math.floor(Math.random() * NUM_PLAYERS);
        playerLevels = null;
        isQiangzhuang = true;
    }

    // Clear corner infos
    document.getElementById('div-table-number').textContent = '';
    gDenomArea.removeAttribute('strain');
    gStrainDiv.innerHTML = '';
    gDeclareSp.textContent = '';
    gDeclMethodSp.textContent = '';
    gScoreDiv.textContent = '0';
    if (gScoreCont) {
        gScoreCont.style.backgroundColor = 'transparent';
        gScoreCont.style.borderColor = '#f8f8f8';
    }
    document.getElementById('div-mp-compensation').textContent = '';
    if (gBaseScoreDiv) gBaseScoreDiv.textContent = '';

    // Seat marks: frame 2+ shows pivot immediately; frame 1 starts undetermined
    if (!isQiangzhuang) {
        let humanRelPivot = (pivot + 4 - HUMAN_PLAYER) % 4;
        let pivotPosNames = ['reference', 'afterhand', 'opposite', 'forehand'];
        gSeatsDiv.setAttribute('pivot', pivotPosNames[humanRelPivot]);
    } else {
        gSeatsDiv.setAttribute('pivot', 'undetermined');
    }

    gBtnNewGame.textContent = t('buttons.newGame');
    engineStartGame(level, pivot, playerLevels, isQiangzhuang);

    // Initialize persistent name bars (§3)
    initPersistentNamebars();

    // Display level
    gLevelDiv.textContent = numberToLevel[game.level];

    // Animate dealing, then resolve declaration
    runDealingPhase();
}

// ---------------------------------------------------------------------------
// Dealing phase  (animated, 0.5s per round of 4 cards)
// ---------------------------------------------------------------------------

function clearBotDealCounts() {
    // Card counts removed per user request
}

function updateBotDealCounts() {
    // Card counts removed per user request
}

function getDenominationHtml(suit, count) {
    if (suit === 4) {
        let numIcons = count >= 3 ? 2 : count;
        let s = '<div class="suit-denomination">' + jokerHtml + '</div>';
        return s.repeat(numIcons);
    }
    let s = '<div class="suit-denomination">' + suitTexts[suit] + '</div>';
    return s.repeat(count);
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
                btnS.innerHTML = 'vv';
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
    updateDeclareMatrix();
}

function runDealingPhase() {
    updatePhaseDisplay(t('phase.dealing'));
    updateStatus(t('status.dealingHint'));
    gBtnPlay.disabled = true;
    
    // Always show declaration UI during dealing (declaration is part of all frame-start flows)
    gDeclareMatrix.style.display = 'flex';
    updateDeclareMatrix();

    dealingTimer = setInterval(function () {
        let batch = engineDealNextBatch();
        if (!batch) { clearInterval(dealingTimer); dealingTimer = null; return; }

        // Bots consider overcalling as they get cards
        for (let i = 0; i < NUM_PLAYERS; i++) {
            let p = (game.pivot + i) % NUM_PLAYERS;
            if (p === HUMAN_PLAYER) continue;

            let decl = botChooseDeclaration(p, currentDeclaration);
            if (decl) {
                let currentCount = currentDeclaration ? currentDeclaration.count : 0;
                if (decl.count > currentCount) {
                    currentDeclaration = { player: p, suit: decl.suit, count: decl.count };
                    
                    let suitName = (decl.suit === 4) ? (decl.count >= 4 ? 'w' : 'v') : numberToSuitName[decl.suit];
                    gDenomArea.setAttribute('strain', suitName);
                    gStrainDiv.innerHTML = getDenominationHtml(decl.suit, decl.count);
                    gDeclareSp.textContent = POSITION_LABELS[p];
                    gDeclMethodSp.textContent = t('labels.declareMethod');
                    appendLog(t('log.declare', { playerName: PLAYER_NAMES[p], strain: decl.suit === 4 ? t('strain.noTrump') : suitName.toUpperCase() }));
                    showDeclaredCardsOnDesk(p, decl.suit, decl.count);
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

        if (game.phase === GamePhase.DECLARING) {
            clearInterval(dealingTimer);
            dealingTimer = null;
            setTimeout(resolveDeclaredPhase, 400);
        }
    }, 500);
}

// ---------------------------------------------------------------------------
// Declaration phase  (resolves after dealing animation completes)
// ---------------------------------------------------------------------------

function resolveDeclaredPhase() {
    updatePhaseDisplay(t('phase.declaring'));
    updateStatus(t('status.declaring'));
    gDeclareMatrix.style.display = 'none';

    let bestDeclaration = currentDeclaration;

    // Bots have one last chance to overcall once dealt (if rules allow doing it at the very end of deal)
    for (let i = 0; i < NUM_PLAYERS; i++) {
        let p = (game.pivot + i) % NUM_PLAYERS;
        if (p === HUMAN_PLAYER) continue;
        let decl = botChooseDeclaration(p, bestDeclaration);
        if (decl) {
            let candidate = { player: p, suit: decl.suit, count: decl.count };
            if (!bestDeclaration || candidate.count > bestDeclaration.count) {
                bestDeclaration = candidate;
            }
        }
    }

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
    updatePhaseDisplay(t('phase.basing'));

    if (isHumanControlled(game.pivot)) {
        // Human-controlled player is pivot — render their hand and wait for selection
        activeHumanPlayer = game.pivot;
        clearSelection();
        renderHand(game.pivot);
        updatePhaseDisplay(t('phase.selectBase', { n: BASE_SIZE }) + (TEST_MODE ? ' (' + PLAYER_NAMES[game.pivot] + ')' : ''));
        updateStatus(t('status.selectBase', { n: BASE_SIZE }));
        gBtnPlay.textContent = t('buttons.baseProgress', { current: 0, total: BASE_SIZE });
        gBtnPlay.disabled = true;
    } else {
        // Bot is pivot — auto-base
        let baseCards = botMakeBase(game.pivot);
        engineSetBase(baseCards);
        renderAllHands();
        appendLog(t('log.baseDone', { playerName: PLAYER_NAMES[game.pivot] }));
        startPlayingPhase();
    }
}

// ---------------------------------------------------------------------------
// Playing phase
// ---------------------------------------------------------------------------

function startPlayingPhase() {
    updatePhaseDisplay(t('phase.playing'));
    gBtnPlay.textContent = t('buttons.play');
    clearSelection();
    renderAllHands();

    // Show-base button if reference player is the baser (§5)
    if (gBtnShowBase && game.pivot === HUMAN_PLAYER && game.base) {
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

        updateStatus(isLeading ? t('status.yourLead') : t('status.follow'));
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

    // 1) Announce all blockers
    let allBlockerNames = fm.allBlockerSeats.map(s => PLAYER_NAMES[s]).join(', ');
    appendLog(t('log.multiplayFailed', {
        playerName: PLAYER_NAMES[player],
        blockerName: PLAYER_NAMES[fm.blockerSeat],
        allBlockerNames: allBlockerNames,
        actualVolume: fm.actualElement.cards.length
    }));

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

    let cp = (game.phase === GamePhase.BASING) ? game.pivot : engineGetCurrentPlayer();
    if (!isHumanControlled(cp)) return;
    let cards = getSelectedCards(cp);

    if (game.phase === GamePhase.BASING) {
        // Basing: set base
        if (cards.length !== BASE_SIZE) {
            showError(t('errors.selectBaseCount', { n: BASE_SIZE }));
            return;
        }
        let ok = engineSetBase(cards);
        if (!ok) {
            showError(t('errors.baseFailed'));
            return;
        }
        clearSelection();
        appendLog(t('log.humanBaseDone'));
        renderAllHands();
        startPlayingPhase();
        return;
    }

    // Playing phase
    let result = enginePlayCards(cp, cards);
    if (!result.success) {
        showError(result.error);
        return;
    }

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
    if (gBaseScoreDiv && result.baseScore > 0) {
        gBaseScoreDiv.textContent = t('labels.endgameFactor', { endgameFactor: result.endgameFactor, baseScore: result.baseScore });
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
    let deskScore = result.totalScore - result.baseScore;
    addScoreRow(cdScore, t('counting.deskScore'), deskScore);
    if (result.baseScore > 0) {
        addScoreRow(cdScore, t('counting.baseScore'), result.baseScore);
    }
    if (result.endingCompensationActive) {
        addScoreRow(cdScore, t('counting.endingCompensation'), result.endingCompensation);
    }
    if (result.multiplayCompensationActive) {
        addScoreRow(cdScore, t('counting.multiplayCompensation'), result.multiplayCompensation);
    }
    let totalDiv = document.createElement('div');
    totalDiv.className = 'cd-score-row cd-score-total';
    totalDiv.innerHTML = '<span>' + t('counting.totalScore') + '</span><span>' + result.totalScore + '</span>';
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

gBtnNewGame.addEventListener('click', startNewGame);
gBtnPlay.addEventListener('click', humanPlayCards);

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
updatePhaseDisplay(t('phase.initial'));
updateStatus(t('status.ready'));
