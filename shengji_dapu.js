// code for shengji specifically
// code for game must include goToPreviousMove(), goToNextMove()

// game info
let zhuangPosition = 0;
let level = 5;
let strain = 2;
let dipaiScore = 0;
let dipaiRawScore = 0;
let dipaiMultiplier = 0;

let isQiangzhuang = true;
let declarations = [];

let typeOfCurrentRound = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

let theDeck = createDeck();
const numberToDivisionName = ["d", "c", "h", "s", "t"];
const divisonNameToNumber = {d: 0, c: 1, h: 2, s: 3, t: 4};
const numberToLevel = ["2", "3", "4", "5", "6", "7", "8", "9", "X", "J", "Q", "K", "A"];
const ntsHtml = '<div id="div-denomination-nts-text">无主</div>';
const numberToPositionInGame = ['庄家', '右家', '前家', '左家'];
const numberToNaturalPositionText = ['东', '北', '西', '南'];
const numberToRelativePositionText = ['本家', '下家', '对家', '上家'];

// view
const seatsDiv = document.getElementById("div-seats");
const tableNumberDiv = document.getElementById("div-table-number");
const denominationAreaDiv = document.getElementById("div-denomination-area");
const levelDiv = document.getElementById("div-denomination-level");
const strainDiv = document.getElementById("div-denomination-strain");
const declarationDiv = document.getElementById("div-declaration");
const declarerSpan = document.getElementById("span-declarer");
const declareMethodSpan = document.getElementById("span-declare-method");
const scoreDiv = document.getElementById("div-score");
const scoreContainerDiv = document.getElementById("div-score-container");
const penaltyDiv = document.getElementById("div-penalty");
const dipaiScoreDiv = document.getElementById("div-dipai-score");

// sematic functions
function nextChar(l) {
  return String.fromCharCode(l.charCodeAt(0) + 1);
}
function prevChar(l) {
  return String.fromCharCode(l.charCodeAt(0) - 1);
}

class ShengjiCard extends Card {
  constructor(suit, rank, level, strain) {
    super(suit, rank);
    this.orderName = this.rankName;
    if(this.isJoker() || this.suit === strain || this.rank === level) {
      this.division = 4;
    } else {
      let theSuit = this.suit;
      this.division = theSuit;
    }
    if(this.isJoker()) {
      let theRank = this.rank;
      this.order = theRank;
    } else if(this.rank === level) {
      this.order = 13;
      this.orderName = "T";
      if(strain !== 4 && this.suit !== strain) {
        this.order = 12;
        this.orderName = this.suitName.toUpperCase();
      }
      if(strain === 4) {
        this.orderName = this.suitName.toUpperCase();
      }
    } else if(this.rank > level) {
      this.order = this.rank - 1;
    } else {
      this.order = this.rank;
    }
    switch(this.rank) {
      case 8:
      case 11:
        this.score = 10;
        break;
      case 3:
        this.score = 5;
        break;
      default:
        this.score = 0;
    }
    this.divisionName = numberToDivisionName[this.division];
  }

  fillDivisionAndOrder(l, s) {
    if(this.isJoker() || this.suit === s || this.rank === l) {
      this.division = 4;
    } else {
      let theSuit = this.suit;
      this.division = theSuit;
    }
    if(this.isJoker()) {
      let theRank = this.rank;
      this.order = theRank;
    } else if(this.rank === l) {
      this.order = 13;
      if(s !== 4 && this.suit !== s) {
        this.order = 12;
      }
    } else if(this.rank > l) {
      this.order = this.rank - 1;
    } else {
      this.order = this.rank;
    }
  }

  setCardByString(cardString) {}

  isTrump() {
    return this.division === 4;
  }
  isCounter() {
    return this.score > 0;
  }
  isSameDivision(card) {
    return this.division === card.division;
  }
  isConsecutive(card) {
    let delta = this.order - card.order;
    return this.division === card.division && (delta === 1 || delta === -1);
  }
  isNextLower(card) {
    return this.division === card.division && card.order - this.order === 1;
  }
  isHigherThan(card) {}
  isLowerThan(card) {}
}

class ShengjiMove extends Move {
    constructor(player, id, cards, isDipai, isLead){
      super(player, id, cards);
      this.isDipai = isDipai;
      this.isLead = isLead;
      this.revokedCards = [];
      this.moveText = '';
    }

    setId(newId) {
      this.moveId = newId;
    }
    setMoveText(isLead, leadType) {

    }

    isTypeFollow(){}
    isDivisionFollow(){}
    isRuff(){}
    isHighest(){}
    isMultiplay(){}
    isWrongMultiplay(){}
    isIllegalMultiplay(){}

    type(){}
    score(){}

    // temporary searching methods
    isAfter(m) {
      // input: m is a moveId
      if(m === '' || m === '^') return true;
      let ids1 = this.moveId.split('-');
      let ids2 = m.split('-');
      let mid1 = ids1[ids1.length - 1];
      let mid2 = ids2[ids2.length - 1];
      let branch1 = ids1.toSpliced(ids1.length - 1, 1).join('-');
      let branch2 = ids2.toSpliced(ids2.length - 1, 1).join('-');
      let a = false;
      if(mid1 !== '_') {
        if(mid2 === '_' || mid2[0] < mid1[0] || (mid2[0] === mid1[0] && mid2[1] < mid1[1])) {
          a = true;
        }
      }
      return branch1.includes(branch2) && a;
    }
    isBefore(m) {
      // input: m is a moveId
      let ids1 = this.moveId.split('-');
      let ids2 = m.split('-');
      let mid1 = ids1[ids1.length - 1];
      let mid2 = ids2[ids2.length - 1];
      let branch1 = ids1.toSpliced(ids1.length - 1, 1).join('-');
      let branch2 = ids2.toSpliced(ids2.length - 1, 1).join('-');
      let a = false;
      if(mid2 !== '_') {
        if(mid1 === '_' || mid1[0] < mid2[0] || (mid1[0] === mid2[0] && mid1[1] < mid2[1])) {
          a = true;
        }
      }
      return branch2.includes(branch1) && a;
    }
    previousMove() {
      return moves.find((m) => m.moveId === previousMoveId(this.moveId));
    }
    // previousMoveId() {
    //   // temporary
    // }
    nextMove() {
      return moves.find((m) => m.moveId === nextMoveId(this.moveId));
    }
    // nextMoveId(){}
    // nextMoveList(){}
    // nextMoveIdList(){}
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
  zhuangPosition = -1;
  mainPlayerPosition = 0;
  observedPlayerPosition = 0;
  declarations = [];
  initHands = [];
  moves = [];
  // moves.push(Move.startMove());
  dipai = [];
  score = 0;
  penalty = 0;
  currentMoveId = "^";
  currentRound = "";
  currentBranch = "";
  declarerSpan.innerHTML = "";
  declareMethodSpan.innerHTML = "";
  scoreDiv.innerHTML = "";
  scoreContainerDiv.removeAttribute("style");
  seatsDiv.setAttribute("zhuang", "undetermined");
  penaltyDiv.innerHTML = "";
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
        strainDiv.innerHTML = suitTexts[s];
        if(declarations.length > 1) {
          strainDiv.innerHTML += suitTexts[s];
        }
        denominationAreaDiv.setAttribute("strain", numberToSuitName[s]);
    } else if(s === 52) {
        strain = 4;
        strainDiv.innerHTML = ntsHtml;
        denominationAreaDiv.setAttribute("strain", "v");
    } else if(s === 53) {
        strain = 4;
        strainDiv.innerHTML = ntsHtml;
        denominationAreaDiv.setAttribute("strain", "w");
    }
}
function setZhuang(z) {
  zhuangPosition = z;
}
function setObservedPlayer(o) {
  observedPlayerPosition = o;
  let relativeZhuangPosition = (zhuangPosition + 4 - o) % 4;
  seatsDiv.setAttribute("zhuang", numberToPositionString[relativeZhuangPosition]);
}
function setScoreValue(s) {
  if(s === -404) {
    scoreContainerDiv.style = "border-color: azure";
    scoreDiv.innerHTML = ""
  } else {
    const h = s * 1.5;
    scoreContainerDiv.style = "border-color: hsl(" + h + ", 100%, 50%, 100%)";
    scoreDiv.innerHTML = s.toString();
    score = s;
    // if(s > 99) {
    //   scoreDiv.setAttribute("range", "high");
    // } else {
    //   scoreDiv.removeAttribute("range");
    // }
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
function setDipaiScore() {
  if(dipaiScore) {
    dipaiScoreDiv.innerHTML = dipaiScore.toString();
  }
}
function clearDipaiScore() {
  dipaiScoreDiv.innerHTML = "";
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
        handElements[previousMove.player].querySelectorAll('[card-show="folded-dipai"]').forEach((c) => {
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
        clearDipaiScore();
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
      let cardShow = nextMove.moveId.endsWith("a0") ? "folded-dipai" : "folded";
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
      setDipaiScore();
      setScoreValue(score + dipaiScore + penalty);
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


// function selectCard(hand, i){
//   hand[i].played = -hand[i].played;
//   if(hand[i].played != 0){
//     document.getElementById("card"+i.toString()).style.bottom =
//       document.getElementById("card"+i.toString()).style.bottom == "100px" ? "60px" : "100px";
//     //this.style.bottom = (this.style.bottom == "100px" ? "60px" : "100px");
//   }
// }

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
      roundTds[0].onclick = handleClickOnRoundNumber;
      for(let j = 0; j < 4; j++) {
        if(aMove.nextMove()) {
          aMove = aMove.nextMove();
          if(aMove.isEnd) break;
          let moveText = '';
          for(let c of aMove.moveCards) {
            moveText += (c.suitName + c.rankName);
          }
          roundTds[(aMove.player+4-zhuangPosition) % 4 +1].innerHTML = aMove.moveInfo.moveText;
          roundTds[(aMove.player+4-zhuangPosition) % 4 +1].id = 'td-' + aMove.moveId;
          roundTds[(aMove.player+4-zhuangPosition) % 4 +1].onclick = handleClickOnTd;
          if(j === 0) {
            roundTds[(aMove.player+4-zhuangPosition) % 4 +1].className = 'td-lead';
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
    let dipaiString = '';
    for(let c of firstMove.moveCards) {
      dipaiString += (c.suitName + c.rankName + " ");
    }
    let dipaiTr = document.createElement('tr');
    let dipaiTd = document.createElement('td');
    let dipaiDivInTable = document.getElementsByClassName('dipai-div-in-table')[0];
    dipaiTd.id = 'td-' + aMove.moveId;
    dipaiTd.setAttribute('colspan', '5');
    dipaiTd.innerHTML = dipaiString;
    dipaiTd.onclick = handleClickOnTd;
    dipaiTr.appendChild(dipaiTd);
    tableRecordBody.appendChild(dipaiTr);
    dipaiDivInTable.innerHTML = dipaiString;
    dipaiDivInTable.id = 'td-_';
    dipaiDivInTable.onclick = handleClickOnTd;
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
function readDeclaration(b) {
  const player = b[1] % 256;
  const shown = b[2];
  declarations.push({
    player: player,
    shown: shown
  });
  const declarerPosition = (player + 4 - zhuangPosition) % 4;
  if(!isQiangzhuang) {
    declarerSpan.innerHTML = numberToPositionInGame[declarerPosition];
  }
  setStrain(shown);
}
function readZhuangAndLevel(b) {
  zhuangPosition = b[2];
  level = b[3];
  setLevel(b[3]);
}
function readMove(b) {
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
function readDipai(b) {
  for(let i = 11; i < b.length; i += 7) {
    let card = new ShengjiCard(b[i+1], b[i+2], level, strain);
    // let card = new Card(b[i+1], b[i+2]);
    dipai.push(card);
  }
  let dipaiMove = new ShengjiMove(zhuangPosition, '_', dipai, true, false);
  dipaiMove.deskScore = 0;
  moves.splice(0, 0, dipaiMove);
  dipaiScore = b[5] - moves[moves.length - 1].deskScore;
  // moves[moves.length - 1].deskScore = b[5];
}
function read8218(b) {
  // const fileText = document.getElementById("file-text");
  // fileText.innerHTML += (b[1]%256 + ', ' + parseInt(b[1]/256)%256 + ', ' + parseInt(b[1]/65536) + '<br>');
}
function parseUpgBodyBuffer(b) {
  const bodyLength = b.length;
  let i = 0;
  while(i < bodyLength) {
    switch(b[i]) {
      // case 8195:
      case 8204:
        readZhuangAndLevel(b.slice(i+1, i+2+b[i+1]/4));
        i += (1 + b[i+1] / 4);
        break;
      case 8205:
        readMove(b.slice(i+1, i+2+b[i+1]/4));
        i += (1 + b[i+1] / 4);
        break;
      case 8209:
        readDeclaration(b.slice(i+1, i+2+b[i+1]/4));
        i += (1 + b[i+1] / 4);
        break;
      case 8213:
        readDipai(b.slice(i+1, i+2+b[i+1]/4));
        i += (1 + b[i+1] / 4);
        break;
      // case 8214:
      // case 8216:
      case 8218:
        read8218(b.slice(i+1, i+2+b[i+1]/4));
        i += (1 + b[i+1] / 4);
        break;
      default: i++;
    }
  }
}
// read and parse .upg file
function readUpg(file) {
  // const fileText = document.getElementById("file-text");
  // fileText.innerHTML = '';
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    const length = reader.result.byteLength;
    const headBuffer = reader.result.slice(0, 8);
    const dateTimeBuffer = reader.result.slice(8, 32);
    const metaBuffer = reader.result.slice(32, 104);
    const nameBuffer = reader.result.slice(104, 184);
    const infoBuffer = reader.result.slice(184, 240);
    const unknownBuffer = reader.result.slice(240, 265);
    const bodyBuffer = reader.result.slice(265, length);
    const intInfo = new Int32Array(infoBuffer);
    const intBody = new Int32Array(bodyBuffer);
    dateTime = new Date(bufferToString(dateTimeBuffer) + 'GMT+0800');
    for(let i = 0; i < 4; i++) {
      playerNames[i] = bufferToString(nameBuffer.slice(i * 20, (i+1)*20));
    }
    mainPlayerPosition = intInfo[0];
    observedPlayerPosition = intInfo[0];
    level = intInfo[5];
    zhuangPosition = intInfo[11];
    handElements = new Array(4);
    handElements[mainPlayerPosition] = shandElement;
    handElements[(mainPlayerPosition + 1) %4] = ehandElement;
    handElements[(mainPlayerPosition + 2) %4] = nhandElement;
    handElements[(mainPlayerPosition + 3) %4] = whandElement;
    if(intInfo[11] >= 0) {
      isQiangzhuang = false;
      declareMethodSpan.innerHTML = "亮主：";
    } else {
      isQiangzhuang = true;
      declareMethodSpan.innerHTML = "抢庄";
    }
    parseUpgBodyBuffer(intBody);
    setObservedPlayer(intInfo[0]);
    normalizeMoves(moves);
    generateInitialHands(moves);
    generateTableRecord(moves);
    renderHands();
  });
  if(file) {
    reader.readAsArrayBuffer(file);
  }
}
function viewFile() {
  const file = document.getElementById("open-file").files[0];
  initializePage();
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
    generateEwhandHtml();
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
