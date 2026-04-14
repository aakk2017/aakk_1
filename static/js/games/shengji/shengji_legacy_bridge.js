// Legacy Shengji bridge
// Contains old shengji_recap.js functions moved into modular load path without changing function internals.

// game info
let pivotPosition = 0;
let level = 5;
let strain = 2;
let baseScore = 0;
let baseRawScore = 0;
let baseMultiplier = 0;

let isQiangzhuang = true;
let declarations = [];

let typeOfCurrentRound = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

let theDeck = createDeck();

// sematic functions
function prevChar(l) {
  return String.fromCharCode(l.charCodeAt(0) - 1);
}

class ShengjiType {
  constructor() {
    this.n = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    this.typeString = '';
  }

  setType(typeArray) {
    if(Array.isArray(typeArray)) {
      if(typeArray.length <= 13 && typeArray.every(t => typeof t === 'number' && t >= 0)) {
        typeArray.forEach((t, index) => {
          this.n[index] = t;
        });
      }
    }
  }
  setTypeFromCards(cards) {
    // input: an Array of ShengjiCard
  }

  fitCards(cards) {

  }
}

// preparation
function createDeck(){
  let deck = [];
  for (let i=0; i<=12; ++i){
    for (let j=0; j<=3; ++j){
      let suitName, rankName;
      switch(j){
        case 3: suitName = "s"; break;
        case 2: suitName = "h"; break;
        case 1: suitName = "c"; break;
        case 0: suitName = "d"; break;
      }
      switch (i) {
        case 8: rankName = "X"; break;
        case 9: rankName = "J"; break;
        case 10: rankName = "Q"; break;
        case 11: rankName = "K"; break;
        case 12: rankName = "A"; break;
        default: rankName = (i+2).toString();
      }
      deck.push({
        suit:j, 
        suitName:suitName, 
        rank:i,
        rankName:rankName, 
        division:j, 
        order:i, 
        played:false
        });
      deck.push({suit:j, suitName:suitName, rank:i, rankName:rankName, division:j, order:i, played:false});
    }
  }
  deck.push({
    suit:4, 
    suitName:"w", 
    rank: 14,
    rankName: "V", 
    division:4, 
    order:14,
    played:false
    });
  deck.push({suit:4, suitName:"w", rank: 14, rankName: "V", division:4, order:14, played:false});
  deck.push({suit:4, suitName:"w", rank: 15, rankName: "W", division:4, order:15, played:false});
  deck.push({suit:4, suitName:"w", rank: 15, rankName: "W", division:4, order:15, played:false});
  return deck;
}

function goToPreviousMove() {
  let currentMove = getCurrentMove();
  // let previousMove = currentMove ? currentMove.previousMove() : moves[0];
  if(currentMove) {
    if(!currentMove.isEnd) {
      handElements[currentMove.player].querySelectorAll('[card-show="show-ondesk"]').forEach((c) => {
        c.setAttribute('card-show', 'show-inhand');
      });
      handElements[currentMove.player].querySelectorAll('[card-show="show-revoked"]').forEach((c) => {
        c.setAttribute('card-show', 'show-inhand');
      });
    }
    let previousMove = currentMove.previousMove();
    if(currentMove.isLead) {
      if(currentMove.moveId.endsWith('a0')) {
        handElements[previousMove.player].querySelectorAll('[card-show="folded-base"]').forEach((c) => {
          c.setAttribute('card-show', 'show-ondesk');
        });
      } else {
        let m = previousMove;
        for(let i = 0; i < 4; i++) {
          m.moveCards.forEach((c) => {
            let qs = '[suit="' + c.suitName + '"][rank="' + c.rankName + '"][card-show="folded"]';
            handElements[m.player].querySelector(qs).setAttribute('card-show', 'show-ondesk');
          });
          if(m.revokedCards) {
            m.revokedCards.forEach((c) => {
              let qs = '[suit="' + c.suitName + '"][rank="' + c.rankName + '"][card-show="show-inhand"]';
              handElements[m.player].querySelector(qs).setAttribute('card-show', 'show-revoked');
            });
          }
          m = m.previousMove();
        }
      }
    }
    if(previousMove) {
      currentMoveId = previousMove.moveId;
      setScore(previousMove);
      if(currentMove.isEnd) {
        clearBaseScore();
      }
    } else {
      currentMoveId = '^';
    }
    // currentMoveId = previousMove.moveId;
  }
}

function goToNextMove() {
  let currentMove = getCurrentMove();
  // let nextMove = currentMove ? currentMove.nextMove() : moves[0];
  let nextMove;
  if(currentMoveId === '^' || currentMoveId === '') {
    nextMove = moves[0];
  } else {
    nextMove = currentMove ? currentMove.nextMove() : undefined;
  }
  if(nextMove) {
    if(nextMove.isLead) {
      let cardShow = nextMove.moveId.endsWith("a0") ? "folded-base" : "folded";
      handElements.forEach((e) => {
          e.querySelectorAll('[card-show="show-ondesk"]').forEach((c) => {
              c.setAttribute('card-show', cardShow);
          });
          e.querySelectorAll('[card-show="show-revoked"]').forEach((c) => {
            c.setAttribute('card-show', 'show-inhand');
          });
      });
    }
    nextMove.moveCards.forEach((c) => {
        let qs = '[suit="' + c.suitName + '"][rank="' + c.rankName + '"][card-show="show-inhand"]';
        handElements[nextMove.player].querySelector(qs).setAttribute('card-show', 'show-ondesk');
    });
    nextMove.revokedCards.forEach((c) => {
        let qs = '[suit="' + c.suitName + '"][rank="' + c.rankName + '"][card-show="show-inhand"]';
        handElements[nextMove.player].querySelector(qs).setAttribute('card-show', 'show-revoked');
    });
    currentMoveId = nextMove.moveId;
    if(nextMove.isEnd) {
      setBaseScore();
      setScoreValue(score + baseScore + penalty);
    } else {
      setScore(nextMove);
    }
  } else {
    // handle error
  }
}

function goToRoundShengji(rid) {
  // input: String rid is the moveId without the last char, e.g. "a"
  // alert(rid);
}

// file reading functions
function cardsToString(c) {
  // c is an Array of ShengjiCards
}

function resolveLead(m) {
  // return: an object {type: Array[13], elements: ShengjiCard[][]}
  let type = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  let pairs = [];
  let elements = [];
  let division = m.moveCards[0].division;
  let moveText = m.moveCards[0].divisionName === "t" ? "" : m.moveCards[0].divisionName;
  let isFromSingleDivision = true;
  m.moveCards.forEach((c) => {
    isFromSingleDivision = isFromSingleDivision && c.division === division;
  });
  if(!isFromSingleDivision) {
    type[0] = m.moveCards.length; 
    elements.push(m);
    return {
      error: "wrong lead",
      type: type,
      division: -2, // -2 is for illegal move, -1 is for discard
      elements: elements,
      moveText: ""
    };
  }
  for(let i = 0; i < m.moveCards.length; i++) {
    if(i+1 < m.moveCards.length && m.moveCards[i].isSame(m.moveCards[i+1])) {
      // first, pick out all pairs
      pairs.push(m.moveCards.slice(i, i+2));
      i++;
    } else {
      // collect all single cards
      elements.push(m.moveCards.slice(i, i+1));
      type[0] += 1;
    }
  }
  for(let i = 0; i < pairs.length; i++) {
    // search for consecutive pairs in pairs
    let j = i + 1;
    let lianZhi = 1;
    while(j < pairs.length) {
      if(pairs[i][2*lianZhi-1].isConsecutive(pairs[j][0])) {
        pairs[i] = pairs[i].concat(pairs[j]);
        pairs.splice(j, 1);
        lianZhi ++;
      } else {
        j++;
      }
    }
    elements.push(pairs[i]);
    type[lianZhi] += 1;
  }
  elements.sort((a, b) => b[0].order - a[0].order);
  elements.forEach((e) => {
    e.forEach((c, index, arr) => {
      let appendMoveText = (index > 0 && arr[index-1].isSame(c)) ? "-" : c.orderName;
      moveText += appendMoveText;
    });
  });
  return {
    type: type,
    division: division,
    elements: elements,
    moveText: moveText
  };
}

function resolveFollow(m, leadInfo) {
  let isAllTrump = true;
  let isAllDivision = true;
  let isFormalRuff = false;
  let isMatch = false; // true if the type can match the lead type and is all trump or is all division
  let pairs = [];
  let elements = [];
  let moveText = '';
  if(leadInfo.division < 0) {
    return {
      error: "wrong lead"
    };
  }
  m.moveCards.forEach((card) => {
    if(card.division !== 4) isAllTrump = false;
    if(card.division !== leadInfo.division) isAllDivision = false;
  });
  if(isAllDivision || isAllTrump) { // if all cards are from the lead division or all from trump division
    let moveInfo = resolveLead(m);
    let isSameType = moveInfo.type.every((t, i) => t === leadInfo.type[i]);
    if(isSameType) {
      return {
        isFormalRuff: isAllTrump,
        isMatch: true,
        elements: moveInfo.elements,
        moveText: moveInfo.moveText
      };
    }
    let numberOfPairs = 0, numberOfPairsInLead = 0;
    for(let i = 1; i < leadInfo.type.length; i++) {
      numberOfPairs += moveInfo.type[i];
      numberOfPairsInLead += leadInfo.type[i];
    }
    if(numberOfPairs < numberOfPairsInLead 
        || (numberOfPairs === numberOfPairsInLead && isAllDivision)) { // if # of pairs followed is less than the lead, then it can't match the type
      moveText = isAllTrump ? "" : m.moveCards[0].divisionName;
      moveText += m.moveCards[0].orderName;
      for(let i = 1; i < m.moveCards.length; i++) {
        moveText += m.moveCards[i].isSame(m.moveCards[i-1]) ? "-" : m.moveCards[i].orderName;
      }
    } else if(numberOfPairs >= numberOfPairsInLead) { // not completed. just placeholder
      moveText = m.moveCards[0].division === 4 ? "" : m.moveCards[0].divisionName;
      moveText += m.moveCards[0].orderName;
      for(let i = 1; i < m.moveCards.length; i++) {
        if(m.moveCards[i].division !== m.moveCards[i-1].division) {
          moveText += (" " + m.moveCards[i].divisionName);
        }
        moveText += m.moveCards[i].orderName;
      }
    }
  } else { // if at least one from side divisions
    moveText = m.moveCards[0].division === 4 ? "" : m.moveCards[0].divisionName;
    moveText += m.moveCards[0].orderName;
    for(let i = 1; i < m.moveCards.length; i++) {
      if(m.moveCards[i].division !== m.moveCards[i-1].division) {
        moveText += (" " + m.moveCards[i].divisionName);
      }
      moveText += m.moveCards[i].orderName;
    }
  }
  return {
    isFormalRuff: false,
    isMatch: false,
    elements: [],
    moveText: moveText
  }
}

function generateEwhandHtmlInClasses() {
    let eFirstRow = createHandElement("n");
    let wFirstRow = createHandElement("n");
    ehandElement.appendChild(eFirstRow);
    whandElement.appendChild(wFirstRow);
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

function renderHands4() {
    for(let hand of handElements) {
      hand.innerHTML = '';
    }
    generateEwhandHtmlInClasses();
    let nRow = createHandElement("n");
    let sRow = createHandElement("n");
    for(const card of initHands[(mainPlayerPosition + 2) %4]) {
      nRow.appendChild(createCardContainer(card));
    }
    for(const card of initHands[mainPlayerPosition]) {
      sRow.appendChild(createCardContainer(card));
    }
    nhandElement.appendChild(nRow);
    shandElement.appendChild(sRow);
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
    for(let i = 0; i < 4; i++) {
        let namebarDiv = document.createElement("div");
        namebarDiv.setAttribute("class", "namebar");
        namebarDiv.setAttribute("show", "show");
        namebarDiv.setAttribute("status", "idle");
        let positionArea = document.createElement("div");
        positionArea.setAttribute("class", "game-position-area");
        if(gameName === 'shengji') {
            positionArea.innerHTML = numberToPositionInGameShengji[(i + 4 - pivotPosition) % 4][0];
        }
        namebarDiv.appendChild(positionArea);
        let nameArea = document.createElement("div");
        nameArea.setAttribute("class", "name-area");
        nameArea.innerHTML = playerNames[i];
        namebarDiv.appendChild(nameArea);
        handElements[i].appendChild(namebarDiv);
    }
}

function viewFile() {
  const file = document.getElementById("open-file").files[0];
  readUpg(file);
  theDeck = createDeck();
}
