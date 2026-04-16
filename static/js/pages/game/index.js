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
const gDeclareSp   = document.getElementById('span-declarer');
const gDeclMethodSp= document.getElementById('span-declare-method');
const gBaseScoreDiv= document.getElementById('div-base-score');

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

// Forehand control exercise state
let forehandControlExercising = false;

// ---------------------------------------------------------------------------
// Card selection state
// ---------------------------------------------------------------------------
let selectedCardIds = new Set();

// Bot turn delay (ms)
const BOT_DELAY = 600;

// Dealing phase state
let currentDeclaration = null;   // declaration made by human during dealing
let dealingTimer     = null;   // setInterval handle for deal animation

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
// Hand rendering — only the human player's hand is displayed
// ---------------------------------------------------------------------------

function renderAllHands() {
    renderHand(activeHumanPlayer);
}

function renderHand(player) {
    if (!isHumanControlled(player)) return;
    if (player !== activeHumanPlayer) return;
    let el = gShand;
    el.innerHTML = '';

    let hand = game.hands[player];

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
        handRow.appendChild(cc);
    }

    // Add namebar
    let namebar = document.createElement('div');
    namebar.className = 'namebar';
    namebar.setAttribute('show', 'show');
    namebar.setAttribute('status', 'idle');
    namebar.style.width = '100%';
    namebar.style.minWidth = 'calc(var(--card-width) * 1.5)';

    let posArea = document.createElement('div');
    posArea.className = 'game-position-area';
    posArea.textContent = POSITION_LABELS[player];
    namebar.appendChild(posArea);

    let nameArea = document.createElement('div');
    nameArea.className = 'name-area';
    let pName = PLAYER_NAMES[player].replace(/^[东南西北]\s*\(?/, '').replace(/\)?$\(?/, '').replace(/\)?$/, '');
    nameArea.textContent = pName;
    namebar.appendChild(nameArea);

    el.appendChild(handRow);
    el.appendChild(namebar);
}

// ---------------------------------------------------------------------------
// Card selection
// ---------------------------------------------------------------------------

function toggleCardSelection(cardId, el) {
    // Allow selection during forehand control exercise — restrict to exposed cards only
    if (forehandControlExercising) {
        if (pendingFCExercise && !pendingFCExercise.exposedCardIds.has(cardId)) return;
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
    if (forehandControlExercising) {
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
        // Remove cards and namebar
        slot.querySelectorAll('.card-container, .hand, .namebar').forEach(el => el.remove());
        slot.removeAttribute('data-active');
        slot.removeAttribute('data-winner');
    }
    if (gDeskInfo) gDeskInfo.textContent = '';
}

function renderDeskCards(player, cards) {
    let slot = gDeskSlots[player];
    // Remove previous cards (not the label)
    slot.querySelectorAll('.card-container, .hand, .namebar').forEach(el => el.remove());
    let row = document.createElement('div');
    row.className = 'hand';
    for (let card of cards) {
        let cc = gameCreateCardContainer(card);
        // No card-show attribute override — plain face-up (show-inhand default)
        row.appendChild(cc);
    }
    slot.appendChild(row);

    if (player !== HUMAN_PLAYER) {
        let namebar = document.createElement('div');
        namebar.className = 'namebar';
        
        let handSize = cards.length;
        if(slot === document.getElementById('desk-west') || slot === document.getElementById('desk-east')) {
             namebar.style.width = `calc(max(var(--card-width) * 1.5, var(--card-width) + (${handSize - 1} * var(--card-width) / 3)))`;
             namebar.style.minWidth = 'calc(var(--card-width) * 1.5)';
        } else {
             namebar.style.width = `calc(max(var(--card-width) * 1.5, var(--card-width) + (${handSize - 1} * var(--card-width) / 3)))`; 
             namebar.style.minWidth = 'calc(var(--card-width) * 1.5)';
        }

        namebar.setAttribute('show', 'show');
        namebar.setAttribute('status', 'played');

        let posArea = document.createElement('div');
        posArea.className = 'game-position-area';
        posArea.textContent = POSITION_LABELS[player];
        namebar.appendChild(posArea);

        let nameArea = document.createElement('div');
        nameArea.className = 'name-area';
        let pName = PLAYER_NAMES[player].replace(/^[东南西北]\s*\(?/, '').replace(/\)?$/, '');
        nameArea.textContent = pName;
        namebar.appendChild(nameArea);

        slot.appendChild(namebar);
    }
}


function highlightActivePlayer(player) {
    for (let i = 0; i < gDeskSlots.length; i++) {
        gDeskSlots[i].removeAttribute('data-active');
    }
    if (player >= 0) gDeskSlots[player].setAttribute('data-active', 'true');
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
    const s = game.score;
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

    clearLog();
    clearSelection();
    clearDesk();
    initDeskLabels();
    clearBotDealCounts();
    gDeclareMatrix.style.display = 'none';

    // Clear corner infos
    gSeatsDiv.setAttribute('pivot', 'undetermined');
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
    document.getElementById('div-penalty').textContent = '';
    if (gBaseScoreDiv) gBaseScoreDiv.textContent = '';

    let level, pivot, playerLevels;
    if (pendingNextFrame) {
        // Continue session: use computed next-frame parameters
        level = pendingNextFrame.level;
        pivot = pendingNextFrame.pivot;
        playerLevels = pendingNextFrame.playerLevels;
        pendingNextFrame = null;
    } else {
        // Fresh game
        level = 0;
        pivot = Math.floor(Math.random() * NUM_PLAYERS);
        playerLevels = null;
    }

    gBtnNewGame.textContent = t('buttons.newGame');
    engineStartGame(level, pivot, playerLevels);

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
    
    gDeclareMatrix.style.display = 'flex';
    updateDeclareMatrix();

    dealingTimer = setInterval(function () {
        let batch = engineDealNextBatch();
        if (!batch) { clearInterval(dealingTimer); dealingTimer = null; return; }

        // Bots consider overcalling as they get cards
        for (let i = 0; i < NUM_PLAYERS; i++) {
            let p = (game.dealer + i) % NUM_PLAYERS;
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
        let p = (game.dealer + i) % NUM_PLAYERS;
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
        game.pivot = bestDeclaration.player;
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

    // Store trigger info for confirmForehandControl
    pendingFCExercise = {
        target: targetPlayer,
        controller: controller,
        exposedDivisionCards: exposedDivCards,
        exposedCardIds: new Set(exposedDivCards.map(c => c.cardId))
    };

    if (!isHumanControlled(controller)) {
        // Bot controller: mustPlay with empty selectedCards (effectively a no-op)
        engineExerciseFC(targetPlayer, 'must-play', []);
        appendLog(t('log.forehandControlBotExercised', { controllerName: PLAYER_NAMES[controller] }));
        pendingFCExercise = null;
        promptCurrentPlayer();
    } else {
        // Human controller: show target's hand, let them select exposed cards in led division
        forehandControlExercising = true;
        activeHumanPlayer = targetPlayer;
        clearSelection();
        highlightActivePlayer(targetPlayer);

        updatePhaseDisplay(t('phase.forehandControl', { controllerName: PLAYER_NAMES[controller], targetName: PLAYER_NAMES[targetPlayer] }));
        updateStatus(t('status.forehandControl', { targetName: PLAYER_NAMES[targetPlayer] }));
        gBtnPlay.textContent = t('buttons.confirmMarks');
        gBtnPlay.disabled = false; // allow confirming with 0 marks (= no constraint)
        // Show mode selector
        let fcModeSel = document.getElementById('fc-mode-selector');
        if (fcModeSel) fcModeSel.style.display = '';
        renderHand(targetPlayer);
    }
}

// Pending FC exercise state (set by exerciseForehandControl, consumed by confirmForehandControl)
let pendingFCExercise = null;

function confirmForehandControl() {
    let pfc = pendingFCExercise;
    let targetPlayer = pfc.target;

    // Get selected cards — only those that are in the exposed set for the led division
    let markedCards = getSelectedCards(targetPlayer)
        .filter(c => pfc.exposedCardIds.has(c.cardId));

    // Determine mode from the UI mode selector (if present), default to must-play
    let mode = 'must-play';
    let modeRadio = document.querySelector('input[name="fc-mode"]:checked');
    if (modeRadio) mode = modeRadio.value;

    engineExerciseFC(targetPlayer, mode, markedCards);
    forehandControlExercising = false;
    pendingFCExercise = null;

    // Hide mode selector and reset
    let fcModeSel = document.getElementById('fc-mode-selector');
    if (fcModeSel) {
        fcModeSel.style.display = 'none';
        let defaultRadio = fcModeSel.querySelector('input[value="must-play"]');
        if (defaultRadio) defaultRadio.checked = true;
    }

    if (markedCards.length > 0) {
        appendLog(t('log.forehandControlMarked', {
            controllerName: PLAYER_NAMES[pfc.controller],
            count: markedCards.length,
            mode: mode === 'must-play' ? t('fc.mustPlay') : t('fc.mustHold')
        }));
    } else {
        appendLog(t('log.forehandControlNoMarks', { controllerName: PLAYER_NAMES[pfc.controller] }));
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

function botTakeTurn(player) {
    let cards = botPlay(player);
    let result = enginePlayCards(player, cards);

    if (!result.success) {
        appendLog(t('log.botError', { error: result.error }));
        return;
    }

    if (result.failedMultiplay) {
        let fm = result.failedMultiplay;
        let shapeType = fm.actualElement.copy === 2 ? t('errors.pairTractor') : t('errors.single');
        appendLog(t('log.multiplayFailed', {
            playerName: PLAYER_NAMES[player],
            blockerName: PLAYER_NAMES[fm.blockerSeat],
            shapeType: shapeType,
            actualVolume: fm.actualElement.cards.length
        }));
        // Render only the actual led element on desk
        renderDeskCards(player, fm.actualElement.cards);
    } else {
        renderDeskCards(player, cards);
    }
    renderHand(player);

    if (result.roundComplete) {
        finishRound();
    } else {
        promptCurrentPlayer();
    }
}

function humanPlayCards() {
    // Handle forehand control exercise mode
    if (forehandControlExercising) {
        confirmForehandControl();
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
        let fm = result.failedMultiplay;
        let shapeType = fm.actualElement.copy === 2 ? t('errors.pairTractor') : t('errors.single');
        appendLog(t('log.multiplayFailed', {
            playerName: PLAYER_NAMES[cp],
            blockerName: PLAYER_NAMES[fm.blockerSeat],
            shapeType: shapeType,
            actualVolume: fm.actualElement.cards.length
        }));
        // Render only the actual led element on desk
        renderDeskCards(cp, fm.actualElement.cards);
    } else {
        renderDeskCards(cp, cards);
    }
    renderHand(cp);

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

    let winnerName = PLAYER_NAMES[result.winner];
    let msg = t('log.roundResult', { round: game.currentRound - 1, playerName: winnerName, score: result.roundScore > 0 ? t('log.roundScore', { points: result.roundScore }) : '' });
    appendLog(msg);
    updatePhaseDisplay(t('phase.roundWinner', { playerName: winnerName }));

    if (result.gameOver) {
        setTimeout(finishGame, BOT_DELAY);
    } else {
        // Short pause then start next round
        setTimeout(() => {
            clearDesk();
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
        gBaseScoreDiv.textContent = t('labels.baseMultiplier', { multiplier: result.multiplier, baseScore: result.baseScore });
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
            // Store next frame info for "Next Frame" button
            pendingNextFrame = {
                pivot: applied.nextPivot,
                level: applied.nextLevel,
                playerLevels: applied.newLevels
            };
            gBtnNewGame.textContent = t('buttons.nextFrame');
        }
    }
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
