var windowWidth = window.innerWidth
|| document.documentElement.clientWidth
|| document.body.clientWidth;
var windowHeight = window.innerHeight
|| document.documentElement.clientHeight
|| document.body.clientHeight;
var cardWidth = 0.1 * windowWidth;
var cardSpace = 0.02 * windowWidth;

var theDeck = createDeck();
// var zHand = [], zInitialHand = [];
// var tSuit = -1;
var level = 5;
var denomination = 2;
const numberToDivisionName = ["d", "c", "h", "s", "t"];
const divisonNameToNumber = {d: 0, c: 1, h: 2, s: 3, t: 4};
const suitTexts = ["&#9830;", "&#9827;", "&#9829;", "&#9824;", ""];
const jokerHtml = '<span class="joker"></span>';

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
        suitname:suitName, 
        rank:i,
        rankname:rankName, 
        division:j, 
        order:i, 
        played:1
        });
      deck.push({suit:j, suitname:suitName, rank:i, rankname:rankName, division:j, order:i, played:1});
    }
  }
  deck.push({
    suit:4, 
    suitname:"w", 
    rank: 14,
    rankname: "V", 
    division:4, 
    order:14,
    played:1
    });
  deck.push({suit:4, suitname:"w", rank: 14, rankname: "V", division:4, order:14, played:1});
  deck.push({suit:4, suitname:"w", rank: 15, rankname: "W", division:4, order:15, played:1});
  deck.push({suit:4, suitname:"w", rank: 15, rankname: "W", division:4, order:15, played:1});
  return deck;
}

// parameter l: integer from 0 (deal with 2) to 12 (deal with A)
function setLevel(l) {
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
function setDenomination(d) {
    if(d < 4) {
        for(let i = 0; i < theDeck.length; i++) {
            if(theDeck[i].suit === d) {
                theDeck[i].division = 4;
            }
        }
    }
}

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

function compareSuits(s1, s2) {
    return ((s1 < 4 && s1 > denomination) ? s1 - 4 : s1) - ((s2 < 4 && s2 > denomination) ? s2 - 4 : s2);
}

function sortHand(hand) {
  hand.sort(function(a, b){
        return compareSuits(b.division, a.division) * 1000 + (b.order - a.order) * 10 + compareSuits(b.suit, a.suit);
    });
}

function sortMove(move, leaddivision){

}

function createCardContainer(card) {
    let cardContainer = document.createElement("div");
    let thisCard = document.createElement("div");
    cardContainer.appendChild(thisCard);
    cardContainer.className = "card-container";
    cardContainer.setAttribute("suit", card.suitname);
    cardContainer.setAttribute("rank", card.rankname);
    thisCard.className = "card";
    let cardRank = document.createElement("div");
    cardRank.innerHTML = card.rankname === "X" ? "1O" : card.rankname;
    cardRank.className = "card-rank";
    let cardSuit = document.createElement("div");
    cardSuit.innerHTML = card.suitname === "w" ? jokerHtml : suitTexts[card.suit];
    cardSuit.className = "card-suit";
    let cardFace = document.createElement("div");
    cardFace.innerHTML = card.suitname === "w" ? jokerHtml : suitTexts[card.suit];
    cardFace.className = "card-face";
    thisCard.appendChild(cardRank);
    thisCard.appendChild(cardSuit);
    thisCard.appendChild(cardFace);
    return cardContainer;
}

function createHandElement(sortGroup) {
    let hand = document.createElement("div");
    hand.className = "hand";
    hand.setAttribute("sort-group", sortGroup);
    return hand;
}
function generateEwhandHtml() {
    const ehand = document.getElementById("ehand");
    const whand = document.getElementById("whand");
    let eFirstRow = createHandElement("n");
    let wFirstRow = createHandElement("n");
    ehand.appendChild(eFirstRow);
    whand.appendChild(wFirstRow);
    if(denomination === 4) {
        for(let i = 3; i >= 0; i--) {
            let eRow = createHandElement(numberToDivisionName[i]);
            let wRow = createHandElement(numberToDivisionName[i]);
            ehand.appendChild(eRow);
            whand.appendChild(wRow);
        }
    } else {
        let eSecondRow = createHandElement("t");
        let wSecondRow = createHandElement("t");
        ehand.appendChild(eSecondRow);
        whand.appendChild(wSecondRow);
        for(let i = (denomination+3)%4; i !== denomination; i = (i+3)%4) {
            let eRow = createHandElement(numberToDivisionName[i]);
            let wRow = createHandElement(numberToDivisionName[i]);
            ehand.appendChild(eRow);
            whand.appendChild(wRow);
        }
    }
}

function selectCard(hand, i){
  hand[i].played = -hand[i].played;
  if(hand[i].played != 0){
    document.getElementById("card"+i.toString()).style.bottom =
      document.getElementById("card"+i.toString()).style.bottom == "100px" ? "60px" : "100px";
    //this.style.bottom = (this.style.bottom == "100px" ? "60px" : "100px");
  }
}


function test() {
    shuffle(theDeck);
    setLevel(level);
    setDenomination(denomination);
    const nhand = theDeck.slice(0,25);
    const whand = theDeck.slice(25,50);
    const ehand = theDeck.slice(50,75);
    const shand = theDeck.slice(75,108);
    const nhandElement = document.getElementById("nhand");
    const shandElement = document.getElementById("shand");
    const whandElement = document.getElementById("whand");
    const ehandElement = document.getElementById("ehand");
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

window.addEventListener("keydown", (e) => {
    if(e.key === 'd') {
        test();
    }
});
