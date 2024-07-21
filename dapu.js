// controlling values
// html elements
nhandElement = document.getElementById("nhand");
shandElement = document.getElementById("shand");
whandElement = document.getElementById("whand");
ehandElement = document.getElementById("ehand");
handElements = []

// game info
var dateTime;
var playerNames = []; 
var mainPlayerPosition = 0; 

// game parameters
var game = "shengji";
var initHands = [];
var moves = [];
var dipai = [];
var score = 0;

// true when writing comments or typing hands. controlling shortcuts will not trigger if true.
var isTyping = false;
var keyboardModeOn = false;

// controlling key events
var controlDown = false;
var altDown = false;
var metaDown = false;
var tabDown = false;
var shiftDown = false;

// view
var showHands = [];
var statusbar = document.getElementById('statusbar');
var errorbar = document.getElementById('errorbar');
var infoSection = document.getElementById('corner-lt');
var scoringSection = document.getElementById('corner-rt');
var dipaiSection = document.getElementById('corner-lb');
var tableRecord = document.getElementById('table-record');
var tableRecordBody = tableRecord.getElementsByTagName('tbody')[0];

// view options
var showTableRecordOn = false;
var showPlayedOn = false;
var showOnDeskOn = false;
var markTrumpsOn = false;
var markHighestOn = false;
var markCounterCardsOn = false;

// card selection
var selectedSuit = -1;
var selectedRank = -1;
var selectedCards = [];

// card play
var currentMoveId = "^";
var currentPlayer = -1;
var currentRound = "";
var currentBranch = "";

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
function getCurrentMove() {
    return moves.find((m) => m.moveId === currentMoveId);
}
function goToMove(mid) {
    // input: the moveId of a move
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
}

// table record handlers
function handleClickOnTd(e) {
    goToMove(e.target.id);
}

// keyboard events handlers

function handleKeyboardMode(e) {
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
        case 'Backquote':
            handleExitKeyboardMode();
            break;
    }
}

function handleEnterKeyboardMode(e) {
    if(e.code === "Backquote") {
        window.removeEventListener("keydown", handleEnterKeyboardMode);
        keyboardModeOn = true;
        window.addEventListener("keydown", handleKeyboardMode);
    }
}

function handleExitKeyboardMode() {
    window.removeEventListener("keydown", handleKeyboardMode);
    keyboardModeOn = false;
    window.addEventListener("keydown", handleEnterKeyboardMode);
}

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

window.addEventListener("keydown", handleEnterKeyboardMode);


// file handlers

