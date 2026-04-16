/**
 * pages/recap/index.js
 * Entry point for the Shengji recap page
 * Orchestrates the generic replay layer with Shengji-specific layer
 * 
 * This file imports and initializes both generic replay functionality
 * and Shengji-specific rules/parsing/rendering
 */

// ============================================================================
// LAYER 1: GENERIC REPLAY CORE (game-agnostic)
// ============================================================================

// Import generic card model and constants
// (cards.js - Card, Move, numberToSuitName, numberToRankName, etc.)

// Import centralized state management
// (replay_state.js - game state variables, ReplayState object)

// Import DOM element references
// (dom_refs.js - all document.getElementById() calls, DOM object)

// Import generic rendering helpers
// (recap_view.js - createCardContainer, updateTableRecordHighlight, etc.)

// Import generic event handlers
// (events.js - keyboard, mouse, UI event handling)

// ============================================================================
// LAYER 2: SHENGJI-SPECIFIC LAYER
// ============================================================================

// Import Shengji types and constants
// (shengji_types.js - Shengji enums, game-specific constants)

// Import Shengji card model
// (shengji_cards.js - ShengjiCard, ShengjiMove classes)

// Import Shengji replay parser
// (shengji_replay_parser.js - .upg file parsing, move generation)

// Import Shengji rules and evaluation
// (shengji_rules.js - card evaluation, trump logic, scoring)

// Import Shengji-specific rendering and formatting
// (shengji_recap_view.js - hand rendering, table generation)
// (shengji_formatters.js - move text, display formatting)

// ============================================================================
// PAGE INITIALIZATION
// ============================================================================

/**
 * Initialize the recap page
 * Sets up the replay system with all game-specific components
 */
function initializeRecapPage() {
    // Initialize event listeners
    initializeEventListeners();
    
    // Set up initial game state
    // This will be populated by file loading
    
    // Initialize hand rendering
    handElements = getHandElements();
    
    // Attach menu/toolbar handlers
    attachGameMenuHandlers();
}

function saveAsUpg(e) {
    if(e && typeof e.preventDefault === 'function') {
        e.preventDefault();
    }
    if(!saveUpgBtn) {
        return false;
    }
    const href = saveUpgBtn.getAttribute('href') || '';
    if(!href.startsWith('blob:')) {
        if(errorbar) {
            errorbar.innerHTML = t('errors.openBeforeSave');
        }
        return false;
    }
    saveUpgBtn.click();
    return false;
}

/**
 * Attach game-specific menu handlers
 */
function attachGameMenuHandlers() {
    const saveMenu = document.getElementById('menu-save');
    if(saveMenu) {
        saveMenu.onclick = (e) => {
            if(e && typeof e.preventDefault === 'function') {
                e.preventDefault();
            }
            switch(gameName) {
                case 'shengji':
                    return saveAsUpg(e);
                    break;
            }
            return false;
        };
    }
}

// ============================================================================
// GAME-SPECIFIC DISPATCH
// These functions delegate to game-specific implementations
// ============================================================================

// NOTE:
// The actual game-specific implementations are provided by
// games/shengji/shengji_game_controller.js and shengji_recap.js.
// Do not redefine dispatch wrappers here, otherwise global handlers
// such as goToNextMove/goToPreviousMove/saveAsUpg are overridden.

// ============================================================================
// LEGACY COMPATIBILITY LAYER
// These variables and functions remain for backward compatibility
// with the old single-file structure during migration
// ============================================================================

// Reuse hand elements array from recap_view.js (already declared there)

// Pass through functions to view update logic
function testFnc() {
    console.log("Test function called");
}

// ============================================================================
// INITIALIZATION on Page Load
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    initializeRecapPage();

    const btnGotoGame = document.getElementById('btn-goto-game');
    if (btnGotoGame) {
        btnGotoGame.addEventListener('click', function (e) {
            e.preventDefault();
            window.location.href = 'game.html';
        });
    }

    console.log("Shengji Recap Page Initialized");
});

// ============================================================================
// MIGRATION NOTE
// This file serves as the entry point after refactoring the monolithic
// recap.js and shengji_recap.js files into a modular two-layer architecture:
//
// GENERIC LAYER (core/):
//   - Replay timeline management
//   - Card and move model
//   - Generic UI/rendering
//   - Event handling
//
// SHENGJI LAYER (games/shengji/):
//   - Card evaluation under level/strain
//   - Move parsing from .upg files
//   - Trump/follow/scoring logic
//   - Shengji-specific hand grouping and display
//
// ADVANTAGE: Shengji-specific code can be reused by:
//   - The game play page
//   - Rule testing/validation
//   - Bot logic
//   - Future server synchronization
// ============================================================================
