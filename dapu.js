// controlling values
// html elements
nhandElement = document.getElementById("nhand");
shandElement = document.getElementById("shand");
whandElement = document.getElementById("whand");
ehandElement = document.getElementById("ehand");
handElements = []

// game info
let dateTime;
let playerNames = []; 
let mainPlayerPosition = 0; 
let observedPlayerPosition = 0;

// game parameters
let gameName = "shengji";
let initHands = [];
let moves = [];
let dipai = [];
let score = 0;

// true when writing comments or typing hands. controlling shortcuts will not trigger if true.
let isTyping = false;
let keyboardModeOn = true;

// controlling key events
let controlDown = false;
let altDown = false;
let metaDown = false;
let tabDown = false;
let shiftDown = false;

// view
let showHands = [];
const statusbar = document.getElementById('statusbar');
const errorbar = document.getElementById('errorbar');
const infoSection = document.getElementById('corner-lt');
const scoringSection = document.getElementById('corner-rt');
const dipaiSection = document.getElementById('corner-lb');
const tableRecord = document.getElementById('table-record');
const tableRecordBody = tableRecord.getElementsByTagName('tbody')[0];

// toolbar items
const toStartButton = document.getElementById('button-to-start');
const previousOfObservedButton = document.getElementById('button-previous-of-observed');
const previousMoveButton = document.getElementById('button-previous-move');
previousMoveButton.onclick = handlePreviousMove;
const nextMoveButton = document.getElementById('button-next-move');
nextMoveButton.onclick = handleNextMove;
const nextOfObservedButton = document.getElementById('button-next-of-observed');

// view options
let showTableRecordOn = false;
let showPlayedOn = false;
let showOnDeskOn = false;
let markTrumpsOn = false;
let markHighestOn = false;
let markCounterCardsOn = false;
let currentStage = 'play';

// card selection
let selectedSuit = -1;
let selectedRank = -1;
let selectedCards = [];

// card play
let currentMoveId = "^";
let currentPlayer = -1;
let currentRound = "";
let currentBranch = "";

// cards
const numberToSuitName = ['d', 'c', 'h', 's', 'w'];
const numberToRankName = ['2', '3', '4', '5', '6', '7', '8', '9', 'X', 'J', 'Q', 'K', 'A', '', 'V', 'W'];
const suitTexts = ["&#9830;", "&#9827;", "&#9829;", "&#9824;", ""];
const jokerHtml = '<span class="joker"></span>';


class Card {
    constructor(s, r) {
        switch(s) {
            case 0:
            case 1:
            case 2:
            case 3:
                this.suit = s;
                this.suitName = numberToSuitName[s];
                break;
            case 4:
            case 52:
            case 53:
                this.suit = 4;
                this.suitName = 'w';
                break;
            default:
                this.suit = -4;
                this.suitName = 'o';
        }
        switch(r) {
            case 0:
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
            case 8:
            case 9:
            case 10:
            case 11:
            case 12:
                this.rank = r;
                this.rankName = numberToRankName[r];
                break;
            case 14:
            case 52:
                this.rank = 14;
                this.rankName = 'V';
                break;
            case 15:
            case 53:
                this.rank = 15;
                this.rankName = 'W';
                break;
            default:
                this.rank = -13;
                this.rankName = 'O';
        }
        this.played = false;
    }

    setCardByString(cardString) {

    }

    isSuit(s) {
        return this.suit === s;
    }
    isRank(r) {
        return this.rank === r;
    }
    isJoker() {
        return this.suit === 'w';
    }
    isCard(cardString) {

    }
    isSame(card) {
        return this.suit === card.suit && this.rank === card.rank;
    }
}


class Move {
    constructor(player, id, cards) {
        this.player = player;
        this.moveId = id;
        this.moveCards = cards;
        // this.revokedCards = [];
        this.comment = "";
    }

    static startMove() {
        let s = new Move(-1, '^', []);
        s.isStart = true;
        return s;
    }

    writeComment(c) {
        this.comment = c;
    }
    appendComment(c) {
        this.comment += c;
    }
    clearComment(c) {
        this.comment = "";
    }

    previousMove(){}
    nextMove(){}
    nextMoveList(){}

    include(card) {}
}



// move id functions

function isPrevious(id1, id2) {

}

function previousLetter(l) {
    let a = l.charCodeAt(0) - 1;
    return String.fromCharCode(a);
}

function nextLetter(l) {
    let a = l.charCodeAt(0) + 1;
    return String.fromCharCode(a);
}

// render functions
function generateEwhandHtml() {
    let eFirstRow = createHandElement("n");
    let wFirstRow = createHandElement("n");
    ehand.appendChild(eFirstRow);
    whand.appendChild(wFirstRow);
    if(strain === 4) {
        for(let i = 3; i >= 0; i--) {
            let eRow = createHandElement(numberToDivisionName[i]);
            let wRow = createHandElement(numberToDivisionName[i]);
            ehandElement.appendChild(eRow);
            whandElement.appendChild(wRow);
        }
    } else {
        let eSecondRow = createHandElement("t");
        let wSecondRow = createHandElement("t");
        ehandElement.appendChild(eSecondRow);
        whandElement.appendChild(wSecondRow);
        for(let i = (strain+3)%4; i !== strain; i = (i+3)%4) {
            let eRow = createHandElement(numberToDivisionName[i]);
            let wRow = createHandElement(numberToDivisionName[i]);
            ehandElement.appendChild(eRow);
            whandElement.appendChild(wRow);
        }
    }
}
function renderHands() {
    for(let hand of handElements) {
      hand.innerHTML = '';
    }
    generateEwhandHtml();
    for(const card of initHands[(mainPlayerPosition + 2) %4]) {
      nhandElement.appendChild(createCardContainer(card));
    }
    for(const card of initHands[mainPlayerPosition]) {
      shandElement.appendChild(createCardContainer(card));
    }
    for(const card of initHands[(mainPlayerPosition + 3) %4]) {
      let sortGroup = card.order >= 12 ? "n" : numberToDivisionName[card.division];
      let row = whandElement.querySelector("[sort-group='" + sortGroup + "']");
      row.appendChild(createCardContainer(card));
    }
    for(const card of initHands[(mainPlayerPosition + 1) %4]) {
      let sortGroup = card.order >= 12 ? "n" : numberToDivisionName[card.division];
      let row = ehandElement.querySelector("[sort-group='" + sortGroup + "']");
      row.appendChild(createCardContainer(card));
    }
}

// card-play
// game-specified js file must include functions goToNextMove() and goToPreviousMove()
function updateTableRecordHighlight() {
    const currentMoveTd = document.getElementById('td-' + currentMoveId);
    const highlightedMoveTd = tableRecordBody.querySelector('[highlight="current"]');
    if(highlightedMoveTd) {
        highlightedMoveTd.removeAttribute('highlight');
        highlightedMoveTd.blur();
    }
    if(currentMoveTd) {
        currentMoveTd.setAttribute('highlight', 'current');
        currentMoveTd.focus();
    }
}
function getCurrentMove() {
    return moves.find((m) => m.moveId === currentMoveId);
}
function goToMove(mid) {
    // input: the moveId of a move
    let currentMoveTd = document.getElementById('td-' + currentMoveId);
    let targetMove = moves.find((m) => m.moveId === mid);
    if(targetMove.isAfter(currentMoveId)) {
        for(let i = 0; i < 104; i++) {
            if(currentMoveId !== mid) {
                goToNextMove();
            }
        }
    } else if(targetMove.isBefore(currentMoveId)) {
        for(let i = 0; i < 104; i++) {
            if(currentMoveId !== mid) {
                goToPreviousMove();
            }
        }
    } else {}
    updateTableRecordHighlight();
}
function handlePreviousMove() {
    goToPreviousMove();
    updateTableRecordHighlight();
}
function handlePreviousOfObserved() {
    // let p = getCurrentMove().player;
    for(let i = 0; i < 8; i++) {
        if(currentMoveId === '^' || currentMoveId === '') {
            updateTableRecordHighlight();
            return;
        }
        goToPreviousMove();
        if(getCurrentMove().player === observedPlayerPosition) {
            updateTableRecordHighlight();
            return;
        }
    }
    // updateTableRecordHighlight();
}
function handleNextMove() {
    goToNextMove();
    updateTableRecordHighlight();
}
function handleNextOfObserved() {
    // let p = getCurrentMove().player;
    for(let i = 0; i < 8; i++) {
        // if(getCurrentMove().isEnd) return;
        goToNextMove();
        if(getCurrentMove().player === observedPlayerPosition) break;
    }
    updateTableRecordHighlight();
}

// table record handlers
function handleClickOnTd(e) {
    const mid = e.target.id.slice(3);
    goToMove(mid);
}
function handleClickOnRoundNumber(e) {
    switch(gameName) {
        case 'shengji':
            const rid = e.target.id.slice(3);
            goToRoundShengji(rid);
            break;
    }
}

// view handlers
function handleShowTableRecord() {
    let tableRecord = document.getElementById("table-record-container");
    let areaShow = tableRecord.getAttribute("area-show") === "hide" ? "show" : "hide";
    tableRecord.setAttribute("area-show", areaShow);
}
function handleShowComment() {
    let commentElement = document.getElementById("comment");
    let areaShow = commentElement.getAttribute("area-show") === "hide" ? "show" : "hide";
    commentElement.setAttribute("area-show", areaShow);
}

// keyboard events handlers
function handleKeyDown(e) {
    if(tabDown) {
        return;
    }
    if(shiftDown) {
        handleShiftCombinations(e);
        return;
    }
    if(altDown) {
        return;
    }
    if(controlDown) {
        return;
    }
    if(metaDown) {
        return;
    }
    handleSingleKeyDown(e);
}
function handleKeyUp(e) {
    switch (e.code) {
        case 'Tab':
            tabDown = false;
            break;
        case 'ShiftLeft':
        case 'ShiftRight':
            shiftDown = false;
            break;
        case 'ControlLeft':
        case 'ControlRight':
            controlDown = false;
            break;
        case 'AltLeft':
        case 'AltRight':
            altDown = false;
            break;
        case 'MetaLeft':
        case 'MetaRight':
            metaDown = false;
            break;
    }
}
function handleSingleKeyDown(e) {
    switch (e.code) {
        case 'Quote':
            handleShowTableRecord();
            break;
        case 'Slash':
            handleShowComment();
            break;
        case 'KeyQ':
            test();
            break;
        case 'ArrowLeft':
            handlePreviousMove();
            break;
        case 'ArrowRight':
            handleNextMove();
            break;
        case 'ArrowUp':
            handlePreviousOfObserved();
            break;
        case 'ArrowDown':
            handleNextOfObserved();
            break;
        case 'Backquote':
            handleExitKeyboardMode();
            break;
        case 'Tab':
            tabDown = true;
            break;
        case 'ShiftLeft':
        case 'ShiftRight':
            shiftDown = true;
            break;
        case 'ControlLeft':
        case 'ControlRight':
            controlDown = true;
            break;
        case 'AltLeft':
        case 'AltRight':
            altDown = true;
            break;
        case 'MetaLeft':
        case 'MetaRight':
            metaDown = true;
            break;
    }
}
function handleTabCombinations(e) {}
function handleAltCombinations(e) {}
function handleShiftCombinations(e) {
    switch(e.code) {
        case 'KeyH':
            handlePreviousOfObserved();
            break;
        case 'KeyJ':
            handlePreviousMove();
            break;
        case 'KeyK':
            handleNextMove();
            break;
        case 'KeyL':
            handleNextOfObserved();
            break;
    }
}
function handleControlCombinations(e) {}
function handleMetaCombinations(e) {}

function handleEnterKeyboardMode(e) {
    if(e.code === "Backquote") {
        window.removeEventListener("keydown", handleEnterKeyboardMode);
        keyboardModeOn = true;
        window.addEventListener("keydown", handleKeyDown);
    }
}
function handleExitKeyboardMode() {
    window.removeEventListener("keydown", handleKeyDown);
    keyboardModeOn = false;
    window.addEventListener("keydown", handleEnterKeyboardMode);
}

window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);


// file handlers

