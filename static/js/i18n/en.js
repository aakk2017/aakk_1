/**
 * en.js — English message dictionary
 */
const messages_en = {

  // ── Page titles ──
  page: {
    recapTitle: 'Qingyunpu - Shengji',
    gameTitle:  'Qingyunpu - Shengji - Game',
  },

  // ── Buttons ──
  buttons: {
    play:           'Play',
    newGame:        'New Game',
    gotoRecap:      '\u21A9 Recap',
    gotoGame:       'Start Game',
    openFile:       'Open recap (.upg)',
    saveUpg:        'Save as .upg',
    baseProgress:   'Set Base ({current}/{total})',
    confirmMarks:   'Confirm Marks',
    nextFrame:      'Next Frame',
    testModeOn:     'Test Mode: ON',
    testModeOff:    'Test Mode: OFF',
    showBase:       'Show Base',
    ready:          'Ready',
    leave:          'Leave',
  },

  // ── Menu bar (recap page) ──
  menus: {
    open:     'Open',
    save:     'Save',
    settings: 'Settings',
    display:  'Display',
    play:     'Play',
    edit:     'Edit',
    help:     'Help',
  },

  // ── Toolbar tooltips (recap page) ──
  tooltips: {
    toStart:             'Go to start',
    previousOfReference: 'Previous of self',
    previousMove:        'Previous move',
    nextMove:            'Next move',
    nextOfReference:     'Next of self',
  },

  // ── Table headers (recap page) ──
  table: {
    pivot:       'P',
    successor:   'Suc',
    ally:        'Ally',
    predecessor: 'Pre',
  },

  // ── Phase display ──
  phase: {
    dealing:      'Dealing…',
    declaring:    'Declaration Phase',
    basing:       'Base Phase',
    selectBase:   'Select {n} cards for base',
    playing:      'Playing Phase',
    lead:         'Your lead',
    follow:       'Follow ({volume} cards)',
    botPlaying:   '{playerName} playing…',
    roundWinner:  '{playerName} wins this round',
    forehandControl: '{controllerName} exercises forehand control on {targetName} — select cards to mark',
    gameOver:     'Game Over',
    gameWon:      'Game Won!',
    initial:      'Click "New Game" to start',
  },

  // ── Status bar ──
  status: {
    ready:        'Ready',
    barDefault:   'Status',
    dealingHint:  'Dealing — declare if you hold the level card',
    declaring:    'Declaring…',
    selectBase:   'Select {n} cards for the base',
    yourLead:     'Your lead',
    follow:       'Follow the led division',
    botThinking:  '{playerName} thinking…',
    forehandControl: 'Mark exposed cards of {targetName} in led division (or skip)',
    gameOver:     'Game Over',
  },

  // ── Desk / round info ──
  desk: {
    roundInfo:    'Round {round}<br>{playerName}{action}',
    leadAction:   ' leads',
    followAction: ' follows',
  },

  // ── Game log messages ──
  log: {
    declare:        '{playerName} declares {strain}',
    noDeclaration:  'No declaration — No Trump',
    baseDone:       '{playerName} set the base',
    humanBaseDone:  'You set the base',
    botError:       'Bot error: {error}',
    multiplayFailed: '{playerName} multiplay failed — blocked by {allBlockerNames} (actual blocker: {blockerName}); forced to lead {actualVolume} card(s)',
    forehandControlActivated: '{controllerName} gains one forehand control on {targetName}',
    forehandControlBotExercised: '{controllerName} (bot) exercises forehand control: must-play (no marks)',
    forehandControlMarked: '{controllerName} marked {count} card(s) ({mode})',
    forehandControlNoMarks: '{controllerName} marked no cards',
    roundResult:    'Round {round}: {playerName} wins{score}',
    trickPoints:    ' (+{points})',
    finalScore:     'Final score: {totalScore}',
    baseScoreBonus: ' (base +{baseScore})',
    levelAdvance:   '{players} advance {delta} level(s)',
    gameWon:        '{players} won the game!',
  },

  // ── Labels ──
  labels: {
    pivotMark:       'P',
    declareMethod:   'Declared: ',
    qiangzhuang:    'Competitive',
    noTrump:         'No Trump',
    noTrumpHtml:     '<div class="div-denomination-nts-text">NT</div>',
    endgameFactor:  'Base×{endgameFactor}={baseScore}',
  },

  // ── Strain / suit ──
  strain: {
    noTrump: 'No Trump',
  },

  // ── Player names ──
  players: {
    south: 'South (You)',
    east:  'East (Bot)',
    north: 'North (Bot)',
    west:  'West (Bot)',
  },

  // ── Position labels ──
  positions: {
    south: 'S',
    east:  'E',
    north: 'N',
    west:  'W',
  },

  // ── Seat labels (game-relative) ──
  seats: {
    pivot:       'Pivot',
    successor:   'Successor',
    ally:        'Ally',
    predecessor: 'Predecessor',
  },

  // ── Relative positions ──
  relative: {
    self:      'Self',
    afterhand: 'Afterhand',
    opposite:  'Opposite',
    forehand:  'Forehand',
  },

  // ── Natural positions (for recap) ──
  natural: {
    east:  'E',
    north: 'N',
    west:  'W',
    south: 'S',
  },

  // ── Error messages ──
  errors: {
    selectCards:             'Please select cards to play.',
    sameDivision:            'All cards in a lead must be from the same division.',
    resolveFailed:          'Failed to resolve lead.',
    multiplayFailed:         'Multiplay failed: another player has a stronger {shapeType}.',
    pairTractor:             'pair/tractor',
    single:                  'single',
    followCount:             'Please follow with {volume} cards.',
    cardNotInHand:           'Selected card is not in your hand.',
    mustPlayAllShort:        'You must play all cards from this short division.',
    mustFollowDivision:      'You must follow the led division.',
    mustFollowPairs:         'You must follow with pairs ({requiredPairs} required).',
    mustFollowTractor:       'You must follow with a tractor (length {K} required).',
    mustFollowStructure:     'You must follow the required structure.',
    fakeMultiplay:           'Multiplay blocked: a higher combination may exist.',
    forehandControlFillers:  'Forehand control: marked card count mismatch.',
    notPlayingPhase:         'Not in playing phase.',
    notYourTurn:             'It is not your turn.',
    selectBaseCount:         'Please select {n} cards.',
    baseFailed:              'Failed to set base.',
    openBeforeSave:          'Please open a recap file before saving.',
  },

  // ── Forehand control ──
  fc: {
    mustPlay: 'Must Play',
    mustHold: 'Must Hold',
  },

  // ── Counting dialog ──
  counting: {
    baseLabel:       'Base',
    scoreLabel:      'Score Breakdown',
    deskScore:       'Counter cards',
    baseScore:       'Base Score',
    endingCompensation: 'Ending Compensation',
    multiplayCompensation: 'Multiplay Compensation',
    totalScore:      'Total',
    resultLabel:     'Result',
    levelChange:     'Level +{delta}',
    noLevelChange:   'No level change',
    teamLevels:      'N-S: {nsLevel} / E-W: {ewLevel}',
  },

  // ── Game result messages ──
  results: {
    grandSlam:    'Grand Slam (pivot +3 levels)',
    smallSlam:    'Small Slam (pivot +2 levels)',
    retainStage:  'Retain Stage (pivot +1 level)',
    takeStage:    'Take Stage (attackers on stage)',
    upOne:        'Up One (attackers +1 level)',
    upTwo:        'Up Two (attackers +2 levels)',
    upN:          'Up {n} (attackers +{n} levels)',
  },
};
