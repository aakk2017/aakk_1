/**
 * core/dom_refs.js
 * Centralized DOM element references
 * Makes DOM dependencies explicit and easy to locate
 */

// Hand container elements
const nhandElement = document.getElementById("nhand");
const shandElement = document.getElementById("shand");
const whandElement = document.getElementById("whand");
const ehandElement = document.getElementById("ehand");

// Status and info sections
const statusbar = document.getElementById('statusbar');
const errorbar = document.getElementById('errorbar');
const infoSection = document.getElementById('corner-lt');
const scoringSection = document.getElementById('corner-rt');
const commentSection = document.getElementById('corner-rb');

// Table record elements
const tableRecord = document.getElementById('table-record');
const tableRecordBody = tableRecord.getElementsByTagName('tbody')[0];
const tableRecordContainer = document.getElementById('table-record-container');

// Menu items
const saveMenu = document.getElementById('menu-save');
const menuOpen = document.getElementById('menu-open');
const menuSettings = document.getElementById('menu-settings');
const menuDisplay = document.getElementById('menu-display');
const menuPlay = document.getElementById('menu-play');
const menuEdit = document.getElementById('menu-edit');
const menuHelp = document.getElementById('menu-help');

// Toolbar items
const toStartButton = document.getElementById('button-to-start');
const previousOfReferenceButton = document.getElementById('button-previous-of-reference');
const previousMoveButton = document.getElementById('button-previous-move');
const nextMoveButton = document.getElementById('button-next-move');
const nextOfReferenceButton = document.getElementById('button-next-of-reference');

// Comment section
const commentElement = document.getElementById('comment');
const treeRecord = document.getElementById('tree-record');

// Shengji-specific DOM elements
const seatsDiv = document.getElementById("div-seats");
const tableNumberDiv = document.getElementById("div-table-number");
const denominationAreaDiv = document.getElementById("div-denomination-area");
const levelDiv = document.getElementById("div-denomination-level");
const strainDiv = document.getElementById("div-denomination-strain");
const declarationDiv = document.getElementById("div-declaration");
const declarerSpan = document.getElementById("span-declaration");
const declareMethodSpan = document.getElementById("span-declare-method");
const scoreDiv = document.getElementById("div-score");
const scoreContainerDiv = document.getElementById("div-score-container");
const mpCompensationDiv = document.getElementById("div-mp-compensation");
const baseScoreDiv = document.getElementById("div-base-score");
const fileNameDiv = document.getElementById("file-name-container");
const saveUpgBtn = document.getElementById("save-upg-btn");

// Export all DOM references as an object for organizational clarity
const DOM = {
    hands: {
        n: nhandElement,
        s: shandElement,
        w: whandElement,
        e: ehandElement,
    },
    sections: {
        status: statusbar,
        error: errorbar,
        info: infoSection,
        scoring: scoringSection,
        comment: commentSection,
        table: tableRecordContainer,
    },
    tableRecord: {
        table: tableRecord,
        body: tableRecordBody,
    },
    menu: {
        save: saveMenu,
        open: menuOpen,
        settings: menuSettings,
        display: menuDisplay,
        play: menuPlay,
        edit: menuEdit,
        help: menuHelp,
    },
    toolbar: {
        toStart: toStartButton,
        previousOfReference: previousOfReferenceButton,
        previousMove: previousMoveButton,
        nextMove: nextMoveButton,
        nextOfReference: nextOfReferenceButton,
    },
    comment: {
        element: commentElement,
        tree: treeRecord,
    }
};

// Helper function to collect all hand elements as an array
function getHandElements() {
    return [whandElement, ehandElement, nhandElement, shandElement];
}
