/**
 * core/recap_view.js
 * Generic rendering helpers for the recap page
 * Does not include game-specific rendering logic
 */

// Hand elements array - will be populated with DOM elements
let handElements = [];

/**
 * Create a card container DOM element
 * @param {Card} card - The card to render
 * @returns {HTMLElement} Card container element
 */
function createCardContainer(card) {
    let cardContainer = document.createElement("div");
    let thisCard = document.createElement("div");
    cardContainer.appendChild(thisCard);
    cardContainer.className = "card-container";
    cardContainer.setAttribute("suit", card.suitName);
    cardContainer.setAttribute("rank", card.rankName);
    cardContainer.setAttribute("card-show", "show-inhand");
    thisCard.className = "card";
    
    let cardRank = document.createElement("div");
    cardRank.innerHTML = card.rankName === "X" ? "1O" : card.rankName;
    cardRank.className = "card-rank";
    
    let cardSuit = document.createElement("div");
    cardSuit.innerHTML = card.suitName === "w" ? jokerHtml : suitTexts[card.suit];
    cardSuit.className = "card-suit";
    
    let cardFace = document.createElement("div");
    cardFace.innerHTML = card.suitName === "w" ? jokerHtml : suitTexts[card.suit];
    cardFace.className = "card-face";
    
    thisCard.appendChild(cardRank);
    thisCard.appendChild(cardSuit);
    thisCard.appendChild(cardFace);
    return cardContainer;
}

/**
 * Create a hand element (a row of cards)
 * @param {string} sortGroup - The sort group identifier for this hand row
 * @returns {HTMLElement} Hand element
 */
function createHandElement(sortGroup) {
    let hand = document.createElement("div");
    hand.className = "hand";
    hand.setAttribute("sort-group", sortGroup);
    return hand;
}

/**
 * Update table record highlight to show the current move
 */
function updateTableRecordHighlight() {
    const currentMoveTd = document.getElementById('td-' + currentMoveId);
    const highlightedMoveTd = document.querySelector('[highlight="current"]');
    if(highlightedMoveTd) {
        highlightedMoveTd.removeAttribute('highlight');
        highlightedMoveTd.blur();
    }
    if(currentMoveTd) {
        currentMoveTd.setAttribute('highlight', 'current');
        currentMoveTd.focus();
    }
}

/**
 * Get the current move object from the moves array
 * @returns {Move} The current Move object
 */
function getCurrentMove() {
    return moves.find((m) => m.moveId === currentMoveId);
}

/**
 * Navigate to a specific move
 * @param {string} mid - The moveId to navigate to
 */
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
    updateTableRecordHighlight();
}

function handlePreviousMove() {
    goToPreviousMove();
    updateTableRecordHighlight();
}

function handlePreviousOfReference() {
    // let p = getCurrentMove().player;
    goToPreviousMove();
    for(let i = 0; i < 8; i++) {
        if(currentMoveId === '^' || currentMoveId === '') {
            updateTableRecordHighlight();
            return;
        }
        if(getCurrentMove().player === referencePlayerPosition) {
            updateTableRecordHighlight();
            return;
        }
        goToPreviousMove();
    }
    // updateTableRecordHighlight();
}

function handleNextMove() {
    goToNextMove();
    updateTableRecordHighlight();
}

function handleNextOfReference() {
    // let p = getCurrentMove().player;
    for(let i = 0; i < 8; i++) {
        // if(getCurrentMove().isEnd) return;
        goToNextMove();
        if(getCurrentMove().player === referencePlayerPosition) break;
    }
    updateTableRecordHighlight();
}

/**
 * Utility functions for move IDs
 */
function previousLetter(l) {
    let a = l.charCodeAt(0) - 1;
    return String.fromCharCode(a);
}

function nextLetter(l) {
    let a = l.charCodeAt(0) + 1;
    return String.fromCharCode(a);
}
