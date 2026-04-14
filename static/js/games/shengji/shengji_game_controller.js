/**
 * games/shengji/shengji_game_controller.js
 * Game logic for Shengji - move navigation, normalization, hand generation
 */

/**
 * Helper: Get next character
 */
function nextChar(l) {
  return String.fromCharCode(l.charCodeAt(0) + 1);
}

/**
 * Initialize the page by resetting all game state
 */
function initializePage(){
  pivotPosition = -1;
  mainPlayerPosition = 0;
  referencePlayerPosition = 0;
  declarations = [];
  initHands = [];
  moves = [];
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

/**
 * Update the global theDeck when level changes
 */
function updateDeckForLevel(l) {
  for(let i = 0; i < theDeck.length; i++) {
    if(theDeck[i].rank === l) {
      theDeck[i].division = 4;
      theDeck[i].order = 13;
    } else if(theDeck[i].rank > l) {
      theDeck[i].order = theDeck[i].rank - 1;
    }
  }
}

/**
 * Update the global theDeck when strain changes
 */
function updateDeckForStrain(s) {
  if(s < 4) {
    for(let i = 0; i < theDeck.length; i++) {
      if(theDeck[i].suit === s) {
        theDeck[i].division = 4;
      }
    }
  }
}

/**
 * Compare two suits for sorting
 */
function compareSuits(s1, s2) {
  return ((s1 < 4 && s1 > strain) ? s1 - 4 : s1) - ((s2 < 4 && s2 > strain) ? s2 - 4 : s2);
}

/**
 * Sort a hand of cards by division and order
 */
function sortHand(hand) {
  hand.sort(function(a, b){
    return compareSuits(b.division, a.division) * 1000 + (b.order - a.order) * 10 + compareSuits(b.suit, a.suit);
  });
}

/**
 * Sort moves within a round
 */
function sortMove(move, leadDivision){
  // Not yet implemented
}

/**
 * Get the previous move ID from the current move ID
 * For 'a0', returns '^'
 */
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

/**
 * Get the next move ID from the current move ID
 * For '^', returns the first move ID ('a0')
 */
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

/**
 * Normalize the move tree and compute moveInfo for all moves
 * Assigns moveIds and move text for display
 */
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

/**
 * Generate initial hands from moves
 * Collects all cards from moves into hand arrays for each player
 */
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

/**
 * Navigate to previous move
 */
// OLD IMPLEMENTATION in shengji_recap.js
// function goToPreviousMove() {}

/**
 * Navigate to next move
 */
// OLD IMPLEMENTATION in shengji_recap.js
// function goToNextMove() {}

/**
 * Go to a specific round
 */
// OLD IMPLEMENTATION in shengji_recap.js
// function goToRoundShengji(rid) {}

/**
 * Set the reference player
 */
function setReferencePlayer(o) {
  referencePlayerPosition = o;
  let relativePivotPosition = (pivotPosition + 4 - o) % 4;
  seatsDiv.setAttribute("pivot", numberToPositionString[relativePivotPosition]);
}

/**
 * Set the game level
 */
function setLevel(l) {
  level = l;
  levelDiv.innerHTML = numberToLevel[l];
  updateDeckForLevel(l);
}

/**
 * Set the game strain/trump suit
 */
function setStrain(s) {
  if(s < 4) {
    strain = s;
    updateDeckForStrain(s);
    denominationAreaDiv.setAttribute("strain", numberToSuitName[s]);
  } else if(s === 52) {
    strain = 4;
    denominationAreaDiv.setAttribute("strain", "v");
  } else if(s === 53) {
    strain = 4;
    denominationAreaDiv.setAttribute("strain", "w");
  }
}

/**
 * Set the pivot player
 */
function setPivot(z) {
  pivotPosition = z;
}
