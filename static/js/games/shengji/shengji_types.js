/**
 * games/shengji/shengji_types.js
 * Shengji-specific constants, types, and enumerations
 * Game-specific domain model for Shengji
 */

// Shengji game-specific constants
const numberToDivisionName = ["d", "c", "h", "s", "t"];
const divisonNameToNumber = {d: 0, c: 1, h: 2, s: 3, t: 4};
const numberToLevel = ["2", "3", "4", "5", "6", "7", "8", "9", "X", "J", "Q", "K", "A"];
const ntsHtml = t('labels.noTrumpHtml');

// Shengji position names (absolute positions)
const numberToPositionInGameShengji = [t('seats.pivot'), t('seats.successor'), t('seats.ally'), t('seats.predecessor')];

// Cardinal directions (natural player positions)
const numberToNaturalPositionText4 = [t('natural.east'), t('natural.north'), t('natural.west'), t('natural.south')];

// Relative position names from reference player's perspective
const numberToRelativePositionText4 = [t('relative.self'), t('relative.afterhand'), t('relative.opposite'), t('relative.forehand')];

/**
 * ShengjiType enumeration for move classifications
 * Describes the type of action or move in Shengji
 */
const ShengjiMoveType = {
    PLAY: 'play',
    FOLLOW: 'follow',
    TRUMP: 'trump',
    BASE: 'base',
    DECLARATION: 'declaration',
    UNKNOWN: 'unknown'
};

/**
 * Shengji variation/rule set
 * Different variations may have different scoring or trump rules
 */
const ShengjiVariation = {
    STANDARD: 0,
    ADVANCED: 1,
    CUSTOM: 2
};

/**
 * Game stage in a Shengji frame
 * Tracks which phase of play we're in
 */
const ShengjiStage = {
    DEALING: 'dealing',
    DECLARING: 'declaring',
    BASING: 'basing',
    PLAYING: 'playing',
    COUNTING: 'counting',
    COMPLETE: 'complete'
};

/**
 * Declaration result or state
 */
const DeclarationState = {
    UNDECLARED: 'undeclared',
    DECLARED: 'declared',
    CONTESTED: 'contested',
    RESOLVED: 'resolved'
};
