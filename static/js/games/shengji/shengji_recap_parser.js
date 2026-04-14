/**
 * games/shengji/shengji_recap_parser.js
 * Parses .upg (Shengji game replay) files
 * Handles binary buffer parsing and move construction
 */

/**
 * Convert buffer to string (GBK encoding)
 */
function bufferToString(b) {
  let s = "";
  let i = new Uint8Array(b);
  for(const c of i) {
    s += String.fromCharCode(c);
  }
  return s;
}

/**
 * Convert buffer to Int32
 */
function bufferToInt32(b) {
  if(b.byteLength < 4) {
    return 0;
  }
  const i = new Int32Array(b.slice(0, 4));
  return i[0];
}

/**
 * Parse a pivot/level record from the buffer
 */
function readPivotAndLevel(buffer) {
  const b = new Int32Array(buffer.slice(0, 20));
  pivotPosition = b[2];
  level = b[3];
  setLevel(b[3]);
}

/**
 * Parse a move record from the buffer
 */
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

/**
 * Parse a declaration record from the buffer
 */
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

/**
 * Parse a base (kitty) record from the buffer
 */
function readBase(buffer) {
  const b = new Int32Array(buffer);
  for(let i = 11; i < b.length; i += 7) {
    let card = new ShengjiCard(b[i+1], b[i+2], level, strain);
    base.push(card);
  }
  let baseMove = new ShengjiMove(pivotPosition, '_', base, true, false);
  baseMove.deskScore = 0;
  moves.splice(0, 0, baseMove);
  baseScore = b[5] - moves[moves.length - 1].deskScore;
}

/**
 * Parse an 8214 record (declaration method)
 */
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

/**
 * Parse an 8218 record
 */
function read8218(b) {
  // Currently unused
}

/**
 * Parse the entire .upg file body buffer
 * Dispatches to appropriate parsing functions based on item key
 */
function parseUpgBodyBuffer(b) {
  const bodyLength = b.byteLength;
  let i = 0;
  let itemByteLength, itemKey;
  while(i+8 < bodyLength) {
    itemByteLength = bufferToInt32(b.slice(i, i+4));
    itemKey = bufferToInt32(b.slice(i+4, i+8));
    switch(itemKey) {
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
        i += (4 + itemByteLength);
        break;
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

/**
 * Read and parse a .upg file
 */
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
