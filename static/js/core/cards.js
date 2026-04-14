/**
 * core/cards.js
 * Generic card and move classes for any game
 * Reusable replay layer - does not depend on Shengji rules
 */

// Generic card constants (shared across games)
const numberToSuitName = ['d', 'c', 'h', 's', 'w'];
const numberToRankName = ['2', '3', '4', '5', '6', '7', '8', '9', 'X', 'J', 'Q', 'K', 'A', '', 'V', 'W'];
const suitTexts = ["&#9830;", "&#9827;", "&#9829;", "&#9824;", ""];
const jokerHtml = '<span class="joker"></span>';

/**
 * Generic Card class
 * Base representation of a playing card
 * Does not include Shengji-specific concepts like division, order, or trump
 */
class Card {
    constructor(s, r) {
        switch(s) {
            case 0:
            case 1:
            case 2:
            case 3:
                this.suit = s;
                this.suitName = numberToSuitName[s];
                break;
            case 4:
            case 52:
            case 53:
                this.suit = 4;
                this.suitName = 'w';
                break;
            default:
                this.suit = -4;
                this.suitName = 'o';
        }
        switch(r) {
            case 0:
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
            case 8:
            case 9:
            case 10:
            case 11:
            case 12:
                this.rank = r;
                this.rankName = numberToRankName[r];
                break;
            case 14:
            case 52:
                this.rank = 14;
                this.rankName = 'V';
                break;
            case 15:
            case 53:
                this.rank = 15;
                this.rankName = 'W';
                break;
            default:
                this.rank = -13;
                this.rankName = 'O';
        }
        this.played = false;
    }

    setCardByString(cardString) {
        // Placeholder for future implementation
    }

    isSuit(s) {
        return this.suit === s;
    }
    
    isRank(r) {
        return this.rank === r;
    }
    
    isJoker() {
        return this.suit === 4;
    }
    
    isCard(cardString) {
        // Placeholder for future implementation
    }
    
    isSame(card) {
        return this.suit === card.suit && this.rank === card.rank;
    }
}

/**
 * Generic Move class
 * Represents a move/action in a replay timeline
 * Does not include Shengji-specific semantics
 */
class Move {
    constructor(player, id, cards) {
        this.player = player;
        this.moveId = id;
        this.moveCards = cards;
        this.comment = "";
    }

    static startMove() {
        let s = new Move(-1, '^', []);
        s.isStart = true;
        return s;
    }

    writeComment(c) {
        this.comment = c;
    }
    
    appendComment(c) {
        this.comment += c;
    }
    
    clearComment(c) {
        this.comment = "";
    }

    isAfter(mid) {
        if(this.moveId === mid) {
            return false;
        }
        if(mid === '^') {
            return true;
        }
        const thisIndex = moves.findIndex((m) => m.moveId === this.moveId);
        const targetIndex = moves.findIndex((m) => m.moveId === mid);
        if(thisIndex < 0 || targetIndex < 0) {
            return false;
        }
        return thisIndex > targetIndex;
    }

    isBefore(mid) {
        if(this.moveId === mid) {
            return false;
        }
        if(mid === '^') {
            return false;
        }
        const thisIndex = moves.findIndex((m) => m.moveId === this.moveId);
        if(thisIndex < 0) {
            return false;
        }
        if(mid === '^') {
            return false;
        }
        const targetIndex = moves.findIndex((m) => m.moveId === mid);
        if(targetIndex < 0) {
            return false;
        }
        return thisIndex < targetIndex;
    }

    previousMove(){
        if(typeof previousMoveId !== 'function' || !Array.isArray(moves)) {
            return undefined;
        }
        const previousId = previousMoveId(this.moveId);
        return moves.find((m) => m.moveId === previousId);
    }
    nextMove(){
        if(typeof nextMoveId !== 'function' || !Array.isArray(moves)) {
            return undefined;
        }
        const nextId = nextMoveId(this.moveId);
        return moves.find((m) => m.moveId === nextId);
    }
    nextMoveList(){
        const m = this.nextMove();
        return m ? [m] : [];
    }

    include(card) {
        return this.moveCards.find((c) => c.isSame(card));
    }
}
