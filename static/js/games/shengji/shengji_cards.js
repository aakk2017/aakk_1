/**
 * games/shengji/shengji_cards.js
 * Shengji-specific card evaluation and move classes
 * Extends generic Card and Move with Shengji semantics
 */

/**
 * ShengjiCard - Card with Shengji-specific properties
 * Includes trump evaluation, scoring, and card division/order under level/strain
 * 
 * Shengji concepts:
 * - division: which "suit" or division for ranking (0-4 representing d,c,h,s,trump)
 * - order: the rank within a division
 * - trump: cards that are part of the trump division
 */
class ShengjiCard extends Card {
    /**
     * Create a ShengjiCard with full Shengji evaluation
     * @param {number} suit - Base suit (0-3=suits, 4=joker)
     * @param {number} rank - Rank number
     * @param {number} level - The level trump
     * @param {number} strain - The suit trump (0-3, 4=no-trump)
     */
    constructor(suit, rank, level, strain) {
        super(suit, rank);
        
        // Evaluate card based on level and strain
        this.orderName = this.rankName;
        
        // Determine division (trump or regular suit)
        if(this.isJoker() || this.suit === strain || this.rank === level) {
            this.division = 4;  // Trump division
        } else {
            this.division = this.suit;
        }
        
        // Determine order within division (ranking)
        if(this.isJoker()) {
            this.order = this.rank;  // Jokers ordered by their rank
        } else if(this.rank === level) {
            this.order = 13;  // Level cards are highest
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
        
        // Evaluate scoring potential
        switch(this.rank) {
            case 8:   // 10 - 1 = 9
            case 11:  // K = 11
                this.score = 10;
                break;
            case 3:   // 5
                this.score = 5;
                break;
            default:
                this.score = 0;
        }
        
        this.divisionName = numberToDivisionName[this.division];
    }

    /**
     * Update division and order based on new level and strain
     * Used when level/strain might change during replay
     * @param {number} l - New level
     * @param {number} s - New strain
     */
    fillDivisionAndOrder(l, s) {
        if(this.isJoker() || this.suit === s || this.rank === l) {
            this.division = 4;
        } else {
            this.division = this.suit;
        }
        
        if(this.isJoker()) {
            this.order = this.rank;
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

    setCardByString(cardString) {
        // Placeholder for parsing card strings
    }

    /**
     * Check if this card is part of the trump division
     */
    isTrump() {
        return this.division === 4;
    }

    /**
     * Check if this card counts toward the base score
     */
    isCounter() {
        return this.score > 0;
    }

    /**
     * Check if two cards are in the same division
     */
    isSameDivision(card) {
        return this.division === card.division;
    }

    /**
     * Check if two cards are consecutive in the same division
     */
    isConsecutive(card) {
        let delta = this.order - card.order;
        return this.division === card.division && (delta === 1 || delta === -1);
    }

    /**
     * Check if this card is the next lower card to another
     */
    isNextLower(card) {
        return this.division === card.division && card.order - this.order === 1;
    }

    isHigherThan(card) {
        // Placeholder for comparison logic
    }

    isLowerThan(card) {
        // Placeholder for comparison logic
    }
}

/**
 * ShengjiMove - Move with Shengji-specific properties
 * Includes base designation, lead/follow semantics
 */
class ShengjiMove extends Move {
    constructor(player, id, cards, isBase, isLead){
        super(player, id, cards);
        this.isBase = isBase;           // Is this the base area?
        this.isLead = isLead;           // Did this player lead?
        this.revokedCards = [];         // Cards that were revoked/uncalled
        this.moveText = '';             // Formatted display text
    }

    setId(newId) {
        this.moveId = newId;
    }

    setMoveText(isLead, leadType) {
        // Placeholder for formatting move text
    }
}
