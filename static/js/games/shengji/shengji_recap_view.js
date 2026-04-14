/**
 * games/shengji/shengji_recap_view.js
 * Rendering functions for Shengji recap page
 * Handles table record display, declarations, scores, penalties, etc.
 */

/**
 * Render the declaration information with strain display
 */
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
    } else if(d.shown === 53) {
      strainDiv.innerHTML = ntsHtml;
    }
    setStrain(d.shown);
  }
}

/**
 * Set the score display value with color coding
 */
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

/**
 * Set the penalty display value
 */
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

/**
 * Update score and penalty based on a move
 */
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

/**
 * Display the base score
 */
function setBaseScore() {
  if(baseScore) {
    baseScoreDiv.innerHTML = baseScore.toString();
  }
}

/**
 * Clear the base score display
 */
function clearBaseScore() {
  baseScoreDiv.innerHTML = "";
}

/**
 * Generate the HTML table record of all moves
 */
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
