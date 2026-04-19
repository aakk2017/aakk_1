/**
 * core/replay_state.js
 * Centralizes all replay and game state variables
 * Makes state management explicit and easier to debug
 */

// File information
let recordName = "";
let recordBuffer = new ArrayBuffer();
let tableNumber = "";
let dateTime = null;
let playerNames = [];

// Game parameters
let gameName = "shengji";
let gameVariation = 2;

// Player and observation state
let mainPlayerPosition = 0;
let referencePlayerPosition = 0;

// Replay state
let initHands = [];
let moves = [];
let base = [];
let currentMoveId = "^";
let currentPlayer = -1;

// Game state
let frameScore = 0;
let penalty = 0;

// Keyboard and input state
let isTyping = false;
let keyboardModeOn = true;
let controlDown = false;
let altDown = false;
let metaDown = false;
let tabDown = false;
let shiftDown = false;

// View state
let showTableRecordOn = false;
let showPlayedOn = false;
let showOnDeskOn = false;
let markTrumpsOn = false;
let markHighestOn = false;
let markCounterCardsOn = false;
let currentStage = 'play';
let highlightLeaderOrWinner = true;

// Card selection state
let selectedSuit = -1;
let selectedRank = -1;
let selectedCards = [];

// View rendering
let showHands = [];

/**
 * ReplayState - organized state object
 * Groups related state variables for clarity
 */
const ReplayState = {
    file: {
        name: () => recordName,
        buffer: () => recordBuffer,
        number: () => tableNumber,
        dateTime: () => dateTime,
        playerNames: () => playerNames,
    },
    game: {
        name: () => gameName,
        variation: () => gameVariation,
    },
    players: {
        main: () => mainPlayerPosition,
        reference: () => referencePlayerPosition,
    },
    replay: {
        initHands: () => initHands,
        moves: () => moves,
        base: () => base,
        currentMoveId: () => currentMoveId,
        currentPlayer: () => currentPlayer,
        getCurrentMove: function() {
            return this.moves().find((m) => m.moveId === this.currentMoveId());
        },
    },
    gameState: {
        score: () => frameScore,
        penalty: () => penalty,
    },
    keyboard: {
        isTyping: () => isTyping,
        modeOn: () => keyboardModeOn,
        controlDown: () => controlDown,
        altDown: () => altDown,
        metaDown: () => metaDown,
        tabDown: () => tabDown,
        shiftDown: () => shiftDown,
    },
    view: {
        showTableRecord: () => showTableRecordOn,
        showPlayed: () => showPlayedOn,
        showOnDesk: () => showOnDeskOn,
        markTrumps: () => markTrumpsOn,
        markHighest: () => markHighestOn,
        markCounterCards: () => markCounterCardsOn,
        currentStage: () => currentStage,
        highlightLeaderOrWinner: () => highlightLeaderOrWinner,
        showHands: () => showHands,
    },
    selection: {
        suit: () => selectedSuit,
        rank: () => selectedRank,
        cards: () => selectedCards,
    }
};

// Position mapping helpers (generic, can be extended by game-specific layer)
const numberToPositionString = ['reference', 'afterhand', 'opposite', 'forehand'];
const numberToPositionReference = [t('relative.self'), t('relative.afterhand'), t('relative.opposite'), t('relative.forehand')];
