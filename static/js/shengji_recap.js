// code for shengji specifically
// code for game must include goToPreviousMove(), goToNextMove()

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

// Shengji-specific DOM refs are now centralized in core/dom_refs.js

// sematic functions
function nextChar(l) {
  return String.fromCharCode(l.charCodeAt(0) + 1);
}
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
function initializePage(){
  pivotPosition = -1;
  mainPlayerPosition = 0;
  referencePlayerPosition = 0;
  declarations = [];
  initHands = [];
  moves = [];
  // moves.push(Move.startMove());
  base = [];
  score = 0;
  penalty = 0;
  currentMoveId = "^";
  currentRound = "";
  currentBranch = "";
  declarerSpan.innerHTML = "";
  declareMethodSpan.innerHTML = "";
  scoreDiv.innerHTML = "";
  scoreContainerDiv.removeAttribute("style");
  seatsDiv.setAttribute("pivot", "undetermined");
  penaltyDiv.innerHTML = "";
  baseScoreDiv.innerHTML = "";
  fileNameDiv.innerHTML = "";
}
// parameter l: integer from 0 (deal with 2) to 12 (deal with A)
function setLevel(l) {
    level = l;
    levelDiv.innerHTML = numberToLevel[l];
    for(let i = 0; i < theDeck.length; i++) {
        if(theDeck[i].rank === l) {
            theDeck[i].division = 4;
            theDeck[i].order = 13;
        } else if (theDeck[i].rank > l) {
            theDeck[i].order = theDeck[i].rank - 1;
        }
    }
}
// parameter d: integer from 0 to 4
function setStrain(s) {
    if(s < 4) {
        strain = s;
        for(let i = 0; i < theDeck.length; i++) {
            if(theDeck[i].suit === s) {
                theDeck[i].division = 4;
            }
        }
        // strainDiv.innerHTML = "<span class='suit-strain'>" + suitTexts[s] + "</span>";
        // if(declarations.length > 1) {
        //   strainDiv.getElementsByClassName("suit-strain")[0].innerHTML += suitTexts[s];
        // }
        denominationAreaDiv.setAttribute("strain", numberToSuitName[s]);
    } else if(s === 52) {
        strain = 4;
        // strainDiv.innerHTML = ntsHtml;
        denominationAreaDiv.setAttribute("strain", "v");
    } else if(s === 53) {
        strain = 4;
        // strainDiv.innerHTML = ntsHtml;
        denominationAreaDiv.setAttribute("strain", "w");
    }
}
function renderDeclarations() {
    if(declarations.length) {
      let d = declarations[declarations.length - 1];
      strainDiv.innerHTML = "";
      if(d.shown < 4) {
        for(let i = 0; i < d.diezhi; i++) {
          let suitDenominationDiv = document.createElement("div");
          suitDenominationDiv.innerHTML = suitTexts[d.shown];
          suitDenominationDiv.setAttribute("class", "suit-denomination");
          strainDiv.appendChild(suitDenominationDiv);
        }
      } else if(d.shown === 52) {
        strainDiv.innerHTML = ntsHtml;
        // denominationAreaDiv.setAttribute("strain", "v");
      } else if(d.shown === 53) {
        strainDiv.innerHTML = ntsHtml;
        // denominationAreaDiv.setAttribute("strain", "w");
      }
      setStrain(d.shown);
    }
}
function setPivot(z) {
  pivotPosition = z;
}
function setReferencePlayer(o) {
  referencePlayerPosition = o;
  let relativePivotPosition = (pivotPosition + 4 - o) % 4;
  seatsDiv.setAttribute("pivot", numberToPositionString[relativePivotPosition]);
}
function setScoreValue(s) {
  if(s === -404) {
    scoreContainerDiv.style = "border-color: azure";
    scoreDiv.innerHTML = ""
  } else {
    const h = s * 3 / gameVariation;
    scoreContainerDiv.style = "border-color: hsl(" + h + ", 100%, 50%, 100%)";
    scoreDiv.innerHTML = s.toString();
    score = s;
  }
}
function setPenaltyValue(p) {
  if(p > 0) {
    penaltyDiv.setAttribute("sign", "+");
    penaltyDiv.innerHTML = "+" + p.toString();
  } else if(p < 0) {
    penaltyDiv.setAttribute("sign", "-");
    penaltyDiv.innerHTML = p.toString();
  } else {
    penaltyDiv.innerHTML = "";
  }
}
function setScore(move) {
  if(move.deskScore || move.deskScore === 0) {
    setScoreValue(move.deskScore);
  } else {
    setScoreValue(-404);
  }
  if(move.penalty) {
    penalty = move.penalty;
    setPenaltyValue(penalty);
  } else {
    penalty = 0;
    setPenaltyValue(0);
  }
}
function setBaseScore() {
  if(baseScore) {
    baseScoreDiv.innerHTML = baseScore.toString();
  }
}
function clearBaseScore() {
  baseScoreDiv.innerHTML = "";
}

// sort cards
function compareSuits(s1, s2) {
    return ((s1 < 4 && s1 > strain) ? s1 - 4 : s1) - ((s2 < 4 && s2 > strain) ? s2 - 4 : s2);
}
function sortHand(hand) {
  hand.sort(function(a, b){
        return compareSuits(b.division, a.division) * 1000 + (b.order - a.order) * 10 + compareSuits(b.suit, a.suit);
    });
}
function sortMove(move, leadDivision){

}


// moves
// OLD IMPLEMENTATIONS - now in shengji_game_controller.js
function previousMoveId(mid) {
  // temporary
  // input: moveId of a move, string
  let ids = mid.split('-');
  let ending = ids[ids.length - 1];
  let previousEnding;
  switch(ending) {
    case 'a0':
      previousEnding = '_';
      break;
    case '_':
      previousEnding = '^';
      break;
    case '^':
    case '':
      previousEnding = '^';
      break;
    default:
      if(ending[1] === '0') {
        previousEnding = String.fromCharCode(ending.charCodeAt(0) - 1) + '3';
      } else {
        previousEnding = ending[0] + String.fromCharCode(ending.charCodeAt(1) - 1);
      }
  }
  if(ids.length === 1) {
    return previousEnding;
  }
  let parentNodeEnding = ids[ids.length - 2];
  if(previousEnding === parentNodeEnding.slice(0, parentNodeEnding.length-1)) {
    ids[ids.length - 2] = previousEnding;
    ids.splice(ids.length-1, 1);
  }
  return ids.join('-');
} 
function nextMoveId(mid) {
  // temporary
  // input: moveId of a move, string
  let ids = mid.split('-');
  let ending = ids.length ? ids[ids.length - 1] : '';
  let nextEnding;
  let branch = ids.toSpliced(ids.length-1, 1).join('-');
  switch(ending) {
    case '':
    case '^':
      nextEnding = '_';
      break;
    case '_':
      nextEnding = 'a0';
      break;
    default:
      if(ending[1] === '3') {
        nextEnding = String.fromCharCode(ending.charCodeAt(0) + 1) + '0';
      } else {
        nextEnding = ending[0] + String.fromCharCode(ending.charCodeAt(1) + 1);
      }
  }
  if(!currentBranch) {
    return nextEnding;
  }
  if(currentBranch.includes(mid)) {
    return mid + currentBranch.replace(mid, '')[0] + '-' + nextEnding;
  }
  return branch + '-' + nextEnding;
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
// OLD IMPLEMENTATION - now in shengji_game_controller.js
function normalizeMoves(m) {
  // m is an array of ShengjiMove object
  let roundId = 'a';
  for(let i = 1; i < m.length; i += 4) {
    m[i].isLead = true;
    let leadInfo = resolveLead(m[i]);
    if(m[i].moveCards.length > m[i+1].moveCards.length) {
      let actualCards = leadInfo.elements.findLast((a) => a.length === m[i+1].moveCards.length);
      m[i].revokedCards = m[i].moveCards.filter((a) => !actualCards.includes(a));
      m[i].moveCards = actualCards;
    }
    leadInfo = resolveLead(m[i]);
    m[i].moveInfo = leadInfo;
    m[i].setId(roundId + '0');
    for(let j = 1; j < 4; j++) {
      m[i+j].setId(roundId + j);
      m[i+j].moveInfo = resolveFollow(m[i+j], leadInfo);
    }
    roundId = nextChar(roundId);
  }
  let endMoveId = roundId + '0';
  let endMove = new ShengjiMove(-1, endMoveId, [], false, false);
  endMove.isEnd = true;
  m.push(endMove);
}
// OLD IMPLEMENTATION - now in shengji_game_controller.js
function generateInitialHands(m) {
  // m is an Array of ShengjiMove
  initHands = [[], [], [], []]; // index is the absolute position in upg file
  for(let move of m) {
    if(!move.isStart && !move.isEnd){
      initHands[move.player] = initHands[move.player].concat(move.moveCards);
    }
  }
  for(let hand of initHands) {
    sortHand(hand);
  }
}
// OLD IMPLEMENTATION - now in shengji_recap_view.js
function generateTableRecord(m) {
  let firstMove = m.find((move) => move.moveId === nextMoveId('^'));
  if(firstMove) {
    tableRecordBody.innerHTML = '';
    let aMove = firstMove;
    for(let i = 0; i < 25; i++) {
      if(aMove.nextMove() && aMove.nextMove().isEnd) break;
      let roundTds = [];
      for(let j = 0; j < 5; j++) {
        roundTds.push(document.createElement('td'));
      }
      roundTds[0].innerText = i + 1;
      roundTds[0].className = 'round-number';
      roundTds[0].id = 'td-' + String.fromCharCode(i + 97);
      if(typeof handleClickOnRoundNumber === 'function') {
        roundTds[0].onclick = handleClickOnRoundNumber;
      }
      for(let j = 0; j < 4; j++) {
        if(aMove.nextMove()) {
          aMove = aMove.nextMove();
          if(aMove.isEnd) break;
          let moveText = '';
          for(let c of aMove.moveCards) {
            moveText += (c.suitName + c.rankName);
          }
          roundTds[(aMove.player+4-pivotPosition) % 4 +1].innerHTML = aMove.moveInfo.moveText;
          roundTds[(aMove.player+4-pivotPosition) % 4 +1].id = 'td-' + aMove.moveId;
          if(typeof handleClickOnTd === 'function') {
            roundTds[(aMove.player+4-pivotPosition) % 4 +1].onclick = handleClickOnTd;
          }
          if(j === 0) {
            roundTds[(aMove.player+4-pivotPosition) % 4 +1].className = 'td-lead';
          }
        } else {
          break;
        }
      }
      let newRound = document.createElement('tr');
      for(let td of roundTds) {
        newRound.appendChild(td);
      }
      tableRecordBody.appendChild(newRound);
      if(!aMove.nextMove()) break;
    }
    aMove = aMove.nextMove();
    if(aMove) {
      let baseString = '';
      for(let c of firstMove.moveCards) {
        baseString += (c.suitName + c.rankName + " ");
      }
      let baseTr = document.createElement('tr');
      let baseTd = document.createElement('td');
      let baseDivInTable = document.getElementsByClassName('base-div-in-table')[0];
      baseTd.id = 'td-' + aMove.moveId;
      baseTd.setAttribute('colspan', '5');
      baseTd.innerHTML = baseString;
      if(typeof handleClickOnTd === 'function') {
        baseTd.onclick = handleClickOnTd;
      }
      baseTr.appendChild(baseTd);
      tableRecordBody.appendChild(baseTr);
      baseDivInTable.innerHTML = baseString;
      baseDivInTable.id = 'td-_';
      if(typeof handleClickOnTd === 'function') {
        baseDivInTable.onclick = handleClickOnTd;
      }
    }
  }
}
function bufferToString(b) {
  let s = "";
  let i = new Uint8Array(b);
  for(const c of i) {
    s += String.fromCharCode(c);
  }
  return s;
}
function bufferToInt32(b) {
  if(b.byteLength < 4) {
    return 0;
  }
  const i = new Int32Array(b.slice(0, 4));
  return i[0];
}
function readDeclaration(buffer) {
  const b = new Int32Array(buffer);
  const player = b[1] % 256;
  const shown = b[2];
  const diezhi = b[3];
  declarations.push({
    player: player,
    shown: shown,
    diezhi: diezhi
  });
  const declarerPosition = (player + 4 - pivotPosition) % 4;
  if(!isQiangzhuang) {
    declarerSpan.innerHTML = numberToPositionInGameShengji[declarerPosition];
  }
  renderDeclarations();
}
function readPivotAndLevel(buffer) {
  const b = new Int32Array(buffer.slice(0, 20));
  pivotPosition = b[2];
  level = b[3];
  setLevel(b[3]);
}
function readMove(buffer) {
  const b = new Int32Array(buffer);
  let player = b[1];
  let numberOfCards = b[2];
  let cards = [];
  for(let i = 8; i < b.length; i += 7) {
    let c = new ShengjiCard(b[i+1], b[i+2], level, strain);
    cards.push(c);
  }
  sortHand(cards);
  let m = new ShengjiMove(player, '', cards, false, false);
  m.penalty = b[4];
  m.deskScore = b[7];
  moves.push(m);
}
function readBase(buffer) {
  const b = new Int32Array(buffer);
  for(let i = 11; i < b.length; i += 7) {
    let card = new ShengjiCard(b[i+1], b[i+2], level, strain);
    // let card = new Card(b[i+1], b[i+2]);
    base.push(card);
  }
  let baseMove = new ShengjiMove(pivotPosition, '_', base, true, false);
  baseMove.deskScore = 0;
  moves.splice(0, 0, baseMove);
  baseScore = b[5] - moves[moves.length - 1].deskScore;
}
function read8214(buffer) {
  const b = new Int32Array(buffer.slice(0, 20));
  pivotPosition = b[2];
  if(b[2] >= 0) {
    isQiangzhuang = false;
    declareMethodSpan.innerHTML = "亮主：";
  } else {
    isQiangzhuang = true;
    declareMethodSpan.innerHTML = "抢庄";
  }
}
function read8218(b) {
  // const fileText = document.getElementById("file-text");
  // fileText.innerHTML += (b[1]%256 + ', ' + parseInt(b[1]/256)%256 + ', ' + parseInt(b[1]/65536) + '<br>');
}
function parseUpgBodyBuffer(b) {
  const bodyLength = b.byteLength;
  let i = 0;
  let itemByteLength, itemKey;
  while(i+8 < bodyLength) {
    itemByteLength = bufferToInt32(b.slice(i, i+4));
    itemKey = bufferToInt32(b.slice(i+4, i+8));
    switch(itemKey) {
      // case 8195:
      case 8204:
        readPivotAndLevel(b.slice(i+8, i+4+itemByteLength));
        i += (4 + itemByteLength);
        break;
      case 8205:
        readMove(b.slice(i+8, i+4+itemByteLength));
        i += (4 + itemByteLength);
        break;
      case 8209:
        readDeclaration(b.slice(i+8, i+4+itemByteLength));
        i += (4 + itemByteLength);
        break;
      case 8213:
        readBase(b.slice(i+8, i+4+itemByteLength));
        i += (4 + itemByteLength);
        break;
      case 8214:
        read8214(b.slice(i+8, i+4+itemByteLength));
      // case 8216:
      case 8218:
        read8218(b.slice(i+8, i+4+itemByteLength));
        i += (4 + itemByteLength);
        break;
      case 8195:
      case 8216:
        i += (4 + itemByteLength);
        break;
      default: i += 4;
    }
  }
}
// OLD readUpg - now in shengji_recap_parser.js
function readUpg(file) {
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    recordBuffer = reader.result;
    saveUpgBtn.setAttribute('href', URL.createObjectURL(new Blob([recordBuffer], {type: 'text/plain'})));
    saveUpgBtn.setAttribute('download', recordName);
    const length = reader.result.byteLength;
    const headBuffer = reader.result.slice(0, 8);
    const dateTimeBuffer = reader.result.slice(8, 32);
    const metaBuffer = reader.result.slice(32, 104);
    const nameBuffer = reader.result.slice(104, 184);
    const infoBuffer = reader.result.slice(184, 212);
    const bodyBuffer = reader.result.slice(212, length);
    const intInfo = new Int32Array(infoBuffer);
    const decoder = new TextDecoder("gbk");
    dateTime = new Date(bufferToString(dateTimeBuffer) + 'GMT+0800');
    mainPlayerPosition = intInfo[0];
    referencePlayerPosition = intInfo[0];
    tableNumber = intInfo[1] % 100;
    gameVariation = intInfo[3];
    level = intInfo[5];
    for(let i = 0; i < 4; i++) {
      playerNames[(i+1+mainPlayerPosition)%4] = decoder.decode(nameBuffer.slice(i * 20, (i+1)*20));
    }
    handElements = new Array(4);
    handElements[mainPlayerPosition] = shandElement;
    handElements[(mainPlayerPosition + 1) %4] = ehandElement;
    handElements[(mainPlayerPosition + 2) %4] = nhandElement;
    handElements[(mainPlayerPosition + 3) %4] = whandElement;
    parseUpgBodyBuffer(bodyBuffer);
    setReferencePlayer(intInfo[0]);
    normalizeMoves(moves);
    generateInitialHands(moves);
    generateTableRecord(moves);
    renderHands4();
  });
  if(file) {
  initializePage();
  recordName = file.name;
  fileNameDiv.innerHTML = file.name;
  reader.readAsArrayBuffer(file);
  }
}

// Game-specific render functions
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


// rules
function isLegalFollow(leadInfo, followCards, handCards) {

}
function legalFollowShapes(leadType, divisionShape, isExternal) {
  // leadType: Array[13]; divisionShape: Array[13] of lead division; isExternal: if true, continue and notify error, if false, return error

}


// test
function shuffle(deck){
  for (i=deck.length-1; i>0; --i){
    let j = Math.floor((i + 1) * Math.random());
    let k = deck[j];
    deck[j] = deck[i];
    deck[i] = k;
  }
//       item.division = item.suit;
//     }
//     if(item.order == 12){
//       item.order = 13;
//     }
//   });
}
function test() {
    shuffle(theDeck);
    setLevel(level);
    setStrain(strain);
    const nhand = theDeck.slice(0,25);
    const whand = theDeck.slice(25,50);
    const ehand = theDeck.slice(50,75);
    const shand = theDeck.slice(75,108);
    sortHand(nhand);
    sortHand(shand);
    sortHand(whand);
    sortHand(ehand);
    nhandElement.innerHTML = "";
    shandElement.innerHTML = "";
    ehandElement.innerHTML = "";
    whandElement.innerHTML = "";
    if(typeof generateEwhandHtml === 'function') {
        generateEwhandHtml();
    } else if(typeof generateEwhandHtmlInClasses === 'function') {
        generateEwhandHtmlInClasses();
    }
    for(const card of nhand) {
        nhandElement.appendChild(createCardContainer(card));
    }
    for(const card of shand) {
        shandElement.appendChild(createCardContainer(card));
    }
    for(const card of whand) {
        let sortGroup = card.order >= 12 ? "n" : numberToDivisionName[card.division];
        let row = whandElement.querySelector("[sort-group='" + sortGroup + "']");
        row.appendChild(createCardContainer(card));
    }
    for(const card of ehand) {
        let sortGroup = card.order >= 12 ? "n" : numberToDivisionName[card.division];
        let row = ehandElement.querySelector("[sort-group='" + sortGroup + "']");
        row.appendChild(createCardContainer(card));
    }
}
