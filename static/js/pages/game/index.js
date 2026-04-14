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
const gBtnNewGame  = document.getElementById('btn-new-game');
const gBtnPlay     = document.getElementById('btn-play');
const gBtnDeclare  = document.getElementById('btn-declare');
const gDeclareMatrix = document.getElementById('declare-matrix');
const gDeclBtns    = [0, 1, 2, 3].map(i => document.getElementById('declare-btn-' + i));
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
// Card selection state
// ---------------------------------------------------------------------------
let selectedCardIds = new Set();

// Bot turn delay (ms)
const BOT_DELAY = 600;

// Dealing phase state
let humanPendingDecl = null;   // declaration made by human during dealing
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
    renderHand(HUMAN_PLAYER);
}

function renderHand(player) {
    if (player !== HUMAN_PLAYER) return;
    let el = gShand;
    el.innerHTML = '';

    let hand = game.hands[player];

    // Wrap in a .hand div
    let handRow = document.createElement('div');
    handRow.className = 'hand';

    for (let card of hand) {
        let cc = gameCreateCardContainer(card);
        cc.addEventListener('click', () => toggleCardSelection(card.cardId, cc));
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

    let posArea = document.createElement('div');
    posArea.className = 'game-position-area';
    posArea.textContent = POSITION_LABELS[player];
    namebar.appendChild(posArea);

    let nameArea = document.createElement('div');
    nameArea.className = 'name-area';
    nameArea.textContent = PLAYER_NAMES[player];
    namebar.appendChild(nameArea);

    el.appendChild(handRow);
    el.appendChild(namebar);
}

// ---------------------------------------------------------------------------
// Card selection
// ---------------------------------------------------------------------------

function toggleCardSelection(cardId, el) {
    if (game.phase === GamePhase.PLAYING && engineGetCurrentPlayer() !== HUMAN_PLAYER) return;
    if (game.phase !== GamePhase.PLAYING && game.phase !== GamePhase.BASING) return;

    if (selectedCardIds.has(cardId)) {
        selectedCardIds.delete(cardId);
        el.setAttribute('card-selected', 'false');
    } else {
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
    if (game.phase === GamePhase.BASING) {
        gBtnPlay.disabled = (selectedCardIds.size !== BASE_SIZE);
        gBtnPlay.textContent = '埋底 (' + selectedCardIds.size + '/' + BASE_SIZE + ')';
    } else if (game.phase === GamePhase.PLAYING && engineGetCurrentPlayer() === HUMAN_PLAYER) {
        gBtnPlay.disabled = (selectedCardIds.size === 0);
        gBtnPlay.textContent = '出牌';
    } else {
        gBtnPlay.disabled = true;
        gBtnPlay.textContent = '出牌';
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
    // Desk slots: gDeskSlots[1]=East, gDeskSlots[2]=North, gDeskSlots[3]=West
    if (gLabelNorth) gLabelNorth.textContent = PLAYER_NAMES[2];
    if (gLabelWest)  gLabelWest.textContent  = PLAYER_NAMES[3];
    if (gLabelEast)  gLabelEast.textContent  = PLAYER_NAMES[1];
}

function clearDesk() {
    for (let i = 0; i < gDeskSlots.length; i++) {
        let slot = gDeskSlots[i];
        // Remove only card children; keep .desk-player-label
        slot.querySelectorAll('.card-container, .hand').forEach(el => el.remove());
        slot.removeAttribute('data-active');
        slot.removeAttribute('data-winner');
    }
    if (gDeskInfo) gDeskInfo.textContent = '';
}

function renderDeskCards(player, cards) {
    let slot = gDeskSlots[player];
    // Remove previous cards (not the label)
    slot.querySelectorAll('.card-container, .hand').forEach(el => el.remove());
    let row = document.createElement('div');
    row.className = 'hand';
    for (let card of cards) {
        let cc = gameCreateCardContainer(card);
        // No card-show attribute override — plain face-up (show-inhand default)
        row.appendChild(cc);
    }
    slot.appendChild(row);
}


function highlightActivePlayer(player) {
    for (let i = 0; i < gDeskSlots.length; i++) {
        gDeskSlots[i].removeAttribute('data-active');
    }
    if (player >= 0) gDeskSlots[player].setAttribute('data-active', 'true');
}

// ---------------------------------------------------------------------------
// Score display
// ---------------------------------------------------------------------------

function updateScoreDisplay() {
    if (!gScoreDiv || !gScoreCont) return;
    const s = game.score;
    gScoreDiv.textContent = s;
    // Hue 0→360 for score 0→240, same formula as recap: h = s * 3 / 2
    const h = s * 3 / 2;
    gScoreCont.style.borderColor = 'hsl(' + h + ', 100%, 50%)';
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
    gStatusbar.innerHTML = '<div id="errorbar"></div>' + text;
}

function showError(msg) {
    if (gErrorbar) gErrorbar.textContent = msg;
    setTimeout(() => { if (gErrorbar) gErrorbar.textContent = ''; }, 3000);
}

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------

function startNewGame() {
    // Clean up any in-progress dealing timer
    if (dealingTimer) { clearInterval(dealingTimer); dealingTimer = null; }
    humanPendingDecl = null;

    clearLog();
    clearSelection();
    clearDesk();
    initDeskLabels();
    clearBotDealCounts();
    gDeclareMatrix.style.display = 'none';

    let level = 0; // Start at level 2
    let pivot = Math.floor(Math.random() * NUM_PLAYERS);

    engineStartGame(level, pivot);

    // Display level
    gLevelDiv.textContent = numberToLevel[game.level];

    // Animate dealing, then resolve declaration
    runDealingPhase();
}

// ---------------------------------------------------------------------------
// Dealing phase  (animated, 0.5s per round of 4 cards)
// ---------------------------------------------------------------------------

function clearBotDealCounts() {
    [gBotCountEast, gBotCountNorth, gBotCountWest].forEach(el => {
        if (el) el.textContent = '';
    });
}

function updateBotDealCounts() {
    const map = [
        { el: gBotCountEast,  p: 1 },
        { el: gBotCountNorth, p: 2 },
        { el: gBotCountWest,  p: 3 }
    ];
    for (let { el, p } of map) {
        if (el) el.textContent = game.hands[p].length > 0 ? game.hands[p].length + '张' : '';
    }
}

function updateDeclareMatrix() {
    let hand  = game.hands[HUMAN_PLAYER];
    let level = game.level;
    let currentCount = humanPendingDecl ? humanPendingDecl.count : 0;

    for (let suit = 0; suit < 4; suit++) {
        let levelCards = hand.filter(c => c.rank === level && c.suit === suit);
        let count      = levelCards.length;
        let btn        = gDeclBtns[suit];

        let method = count >= 2 ? '反' : '亮';
        btn.innerHTML  = suitTexts[suit] + '<small>' + method + '</small>';

        if (count === 0) {
            btn.disabled = true;
            btn.removeAttribute('data-declared');
        } else {
            // Can declare if first time, or this count overcalls the current
            let canDeclare = !humanPendingDecl || count > currentCount;
            btn.disabled   = !canDeclare;
            if (humanPendingDecl && humanPendingDecl.suit === suit) {
                btn.setAttribute('data-declared', 'true');
            } else {
                btn.removeAttribute('data-declared');
            }
        }
    }
}

function humanDeclare(suit) {
    let hand  = game.hands[HUMAN_PLAYER];
    let level = game.level;
    let levelCards = hand.filter(c => c.rank === level && c.suit === suit);
    if (levelCards.length === 0) return;

    let count        = Math.min(levelCards.length, 2);
    humanPendingDecl = { player: HUMAN_PLAYER, suit, count };

    // Preview in UI corner
    let suitName = numberToSuitName[suit];
    gDenomArea.setAttribute('strain', suitName);
    gStrainDiv.innerHTML   = '<div class="suit-denomination">' + suitTexts[suit] + '</div>';
    gDeclareSp.textContent = PLAYER_NAMES[HUMAN_PLAYER];
    gDeclMethodSp.textContent = count >= 2 ? '反 ' : '亮 ';
    appendLog(PLAYER_NAMES[HUMAN_PLAYER] + ' 亮 ' + suitName.toUpperCase());

    updateDeclareMatrix();
}

function runDealingPhase() {
    updatePhaseDisplay('发牌中…');
    updateStatus('发牌中，持有目标花色可亮牌');
    gBtnPlay.disabled = true;
    gDeclareMatrix.style.display = 'flex';
    updateDeclareMatrix();

    dealingTimer = setInterval(function () {
        let batch = engineDealNextBatch();
        if (!batch) { clearInterval(dealingTimer); dealingTimer = null; return; }

        // Sort south's partial hand for readability as cards arrive
        engineSortHand(game.hands[HUMAN_PLAYER]);
        renderHand(HUMAN_PLAYER);
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
    updatePhaseDisplay('亮牌阶段');
    updateStatus('亮牌中…');
    gDeclareMatrix.style.display = 'none';

    // Start with what the human declared during dealing (may be null)
    let bestDeclaration = humanPendingDecl;

    // Bots now see their full hand and may overcall
    for (let i = 0; i < NUM_PLAYERS; i++) {
        let p = (game.dealer + i) % NUM_PLAYERS;
        if (p === HUMAN_PLAYER) continue;
        let decl = botChooseDeclaration(p);
        if (decl) {
            let candidate = { player: p, suit: decl.suit, count: decl.count };
            if (!bestDeclaration || candidate.count > bestDeclaration.count) {
                bestDeclaration = candidate;
            }
        }
    }

    if (bestDeclaration) {
        let suitName = numberToSuitName[bestDeclaration.suit];
        engineSetStrain(bestDeclaration.suit);
        game.pivot = bestDeclaration.player;
        game.declarations.push(bestDeclaration);

        gDenomArea.setAttribute('strain', suitName);
        gStrainDiv.innerHTML = '<div class="suit-denomination">' + suitTexts[bestDeclaration.suit] + '</div>';
        gDeclareSp.textContent    = PLAYER_NAMES[bestDeclaration.player];
        gDeclMethodSp.textContent = bestDeclaration.count >= 2 ? '反 ' : '亮 ';

        if (bestDeclaration.player !== HUMAN_PLAYER) {
            appendLog(PLAYER_NAMES[bestDeclaration.player] + ' 亮 ' + suitName.toUpperCase());
        }
    } else {
        engineSetStrain(4);
        gDenomArea.setAttribute('strain', 'v');
        gStrainDiv.innerHTML = ntsHtml;
        appendLog('无人亮牌，无主');
    }

    // Update pivot seat indicator
    let humanRelPivot = (game.pivot + 4 - HUMAN_PLAYER) % 4;
    let pivotPosNames = ['reference', 'afterhand', 'opposite', 'forehand'];
    gSeatsDiv.setAttribute('pivot', pivotPosNames[humanRelPivot]);

    clearBotDealCounts();
    renderAllHands();
    updateScoreDisplay();

    // Move to basing phase
    enginePickUpBase();
    runBasingPhase();
}

// ---------------------------------------------------------------------------
// Basing phase
// ---------------------------------------------------------------------------

function runBasingPhase() {
    updatePhaseDisplay('埋底阶段');
    gBtnDeclare.style.display = 'none';

    if (game.pivot === HUMAN_PLAYER) {
        // Human is pivot — render 33-card hand and wait for selection
        renderHand(HUMAN_PLAYER);
        updatePhaseDisplay('请选择 ' + BASE_SIZE + ' 张底牌');
        updateStatus('选择 ' + BASE_SIZE + ' 张牌埋底');
        gBtnPlay.textContent = '埋底 (0/' + BASE_SIZE + ')';
        gBtnPlay.disabled = true;
    } else {
        // Bot is pivot — auto-base
        let baseCards = botMakeBase(game.pivot);
        engineSetBase(baseCards);
        renderAllHands();
        appendLog(PLAYER_NAMES[game.pivot] + ' 埋好底牌');
        startPlayingPhase();
    }
}

// ---------------------------------------------------------------------------
// Playing phase
// ---------------------------------------------------------------------------

function startPlayingPhase() {
    updatePhaseDisplay('行牌阶段');
    gBtnPlay.textContent = '出牌';
    clearSelection();
    renderAllHands();
    promptCurrentPlayer();
}

function promptCurrentPlayer() {
    let cp = engineGetCurrentPlayer();
    let isLeading = (game.currentTurnIndex === 0);
    if (gDeskInfo)  gDeskInfo.innerHTML = '第 ' + game.currentRound + ' 轮<br>' + PLAYER_NAMES[cp] + (isLeading ? ' 出牌' : ' 跟牌');

    highlightActivePlayer(cp);

    if (cp === HUMAN_PLAYER) {
        updateStatus(isLeading ? '你的出牌' : '请跟牌');
        updatePhaseDisplay(isLeading ? '请出牌' : '请跟牌 (' + game.leadInfo.volume + ' 张)');
        gBtnPlay.disabled = true;
        gBtnPlay.textContent = '出牌';
        updatePlayButton();
    } else {
        updateStatus(PLAYER_NAMES[cp] + ' 思考中…');
        updatePhaseDisplay(PLAYER_NAMES[cp] + ' 出牌中…');
        gBtnPlay.disabled = true;
        // Bot plays after a delay
        setTimeout(() => botTakeTurn(cp), BOT_DELAY);
    }
}

function botTakeTurn(player) {
    let cards = botPlay(player);
    let result = enginePlayCards(player, cards);

    if (!result.success) {
        appendLog('Bot 错误: ' + result.error);
        return;
    }

    renderDeskCards(player, cards);
    renderHand(player);

    if (result.roundComplete) {
        finishRound();
    } else {
        promptCurrentPlayer();
    }
}

function humanPlayCards() {
    let cards = getSelectedCards(HUMAN_PLAYER);

    if (game.phase === GamePhase.BASING) {
        // Basing: set base
        if (cards.length !== BASE_SIZE) {
            showError('请选择 ' + BASE_SIZE + ' 张牌');
            return;
        }
        let ok = engineSetBase(cards);
        if (!ok) {
            showError('底牌设置失败');
            return;
        }
        clearSelection();
        appendLog('你埋好了底牌');
        renderAllHands();
        startPlayingPhase();
        return;
    }

    // Playing phase
    let result = enginePlayCards(HUMAN_PLAYER, cards);
    if (!result.success) {
        showError(result.error);
        return;
    }

    clearSelection();
    renderDeskCards(HUMAN_PLAYER, cards);
    renderHand(HUMAN_PLAYER);

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
    let msg = '第 ' + (game.currentRound - 1) + ' 轮: '
            + winnerName + ' 赢 '
            + (result.roundScore > 0 ? '(+' + result.roundScore + '分)' : '');
    appendLog(msg);
    updatePhaseDisplay(winnerName + ' 赢得本轮');

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
    updatePhaseDisplay('对局结束');
    updateStatus('对局结束');

    let msg = '最终得分: ' + result.totalScore + ' 分';
    if (result.baseScore > 0) msg += ' (底分 +' + result.baseScore + ')';
    appendLog(msg);
    appendLog(result.result);

    gBtnPlay.disabled = true;
    gBtnPlay.textContent = '出牌';
    if (gBaseScoreDiv && result.baseScore > 0) {
        gBaseScoreDiv.textContent = '底×' + result.multiplier + '=' + result.baseScore;
    }
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

gBtnNewGame.addEventListener('click', startNewGame);
gBtnPlay.addEventListener('click', humanPlayCards);

// Declare buttons — human makes a declaration during dealing
gDeclBtns.forEach((btn, suit) => {
    btn.addEventListener('click', () => humanDeclare(suit));
});

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

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------
updatePhaseDisplay('点击「新对局」开始');
updateStatus('准备开始');
