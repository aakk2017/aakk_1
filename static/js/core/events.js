/**
 * core/events.js
 * Generic event handlers for recap page
 * Keyboard, mouse, and UI event handling that is game-agnostic
 */

/**
 * Generic view toggle handlers
 */
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

/**
 * Keyboard event handling
 */
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
        case 'ArrowLeft':
            if(typeof handlePreviousMove === 'function') handlePreviousMove();
            break;
        case 'ArrowRight':
            if(typeof handleNextMove === 'function') handleNextMove();
            break;
        case 'ArrowUp':
            if(typeof handlePreviousOfReference === 'function') handlePreviousOfReference();
            break;
        case 'ArrowDown':
            if(typeof handleNextOfReference === 'function') handleNextOfReference();
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
            if(typeof handlePreviousOfReference === 'function') handlePreviousOfReference();
            break;
        case 'KeyJ':
            if(typeof handlePreviousMove === 'function') handlePreviousMove();
            break;
        case 'KeyK':
            if(typeof handleNextMove === 'function') handleNextMove();
            break;
        case 'KeyL':
            if(typeof handleNextOfReference === 'function') handleNextOfReference();
            break;
    }
}

function handleControlCombinations(e) {}
function handleMetaCombinations(e) {}

/**
 * Keyboard mode toggle
 */
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

/**
 * Table record click handler - delegates to game-specific router
 */
function handleClickOnTd(e) {
    const mid = e.target.id.slice(3);
    goToMove(mid);
}

/**
 * Initialize event listeners
 * Game-specific functions (handlePreviousMove, etc.) are expected to be defined
 * by the game-specific layer before this is called
 */
function initializeEventListeners() {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    
    // Menu items
    const saveMenu = document.getElementById('menu-save');
    if(saveMenu && typeof saveAsUpg === 'function') {
        saveMenu.onclick = saveAsUpg;
    }

    if(saveUpgBtn) {
        saveUpgBtn.onclick = (e) => {
            const href = saveUpgBtn.getAttribute('href') || '';
            if(!href.startsWith('blob:')) {
                if(e && typeof e.preventDefault === 'function') {
                    e.preventDefault();
                }
                if(errorbar) {
                    errorbar.innerHTML = t('errors.openBeforeSave');
                }
                return false;
            }
            return true;
        };
    }
    
    // Toolbar items
    const previousMoveButton = document.getElementById('button-previous-move');
    const nextMoveButton = document.getElementById('button-next-move');
    if(previousMoveButton && typeof handlePreviousMove === 'function') {
        previousMoveButton.onclick = handlePreviousMove;
    }
    if(nextMoveButton && typeof handleNextMove === 'function') {
        nextMoveButton.onclick = handleNextMove;
    }
}
