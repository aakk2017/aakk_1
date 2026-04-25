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
    gameSettings:   'Settings',
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
    follow:       'Follow {division} {leadType} ({volume} cards)',
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
    baseMultiplier:  'Base×{baseMultiplier}={baseScore}',
  },

  // ── Strain / suit ──
  strain: {
    noTrump: 'No Trump',
  },

  // ── Division display names ──
  division: {
    d: '♦',
    c: '♣',
    h: '♥',
    s: '♠',
    t: 'Trump',
  },

  // ── Lead type display names ──
  leadType: {
    single:   'single',
    pair:     'pair',
    tractor:  'tractor',
    multiplay:'multiplay',
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

  // ── Game settings dialog (note 34) ──
  settingsDialog: {
    createTitle: 'New Game Settings',
    inspectTitle: 'Current Game Settings',
    readOnlySubtitle: 'Rule settings are read-only during an active game.',
    editableSubtitle: 'Choose rule settings before starting a new game.',
    cancel: 'Cancel',
    close: 'Close',
    confirm: 'Start Game',
    displayPlaceholder: 'Display settings (reserved): structure ready, in-game editable options can be added later.',
    tabs: {
      presets: 'Presets',
      general: 'General',
      scoring: 'Scoring',
      levels: 'Levels',
      timing: 'Timing',
    },
    topLevelTabs: {
      game: 'Game Settings',
      display: 'Display',
      file: 'File',
      accounts: 'Accounts',
    },
    placeholders: {
      display: 'Reserved for future implementation.',
      file: 'Reserved for future implementation.',
      accounts: 'Reserved for future implementation.',
    },
    fields: {
      presetName: 'Preset Rules',
      deckCount: 'deck count',
      autoStrain: 'strain when nobody declared',
      allowOverbase: 'overbase',
      overbaseRestrictions: 'restriction',
      failedMultiplayHandling: 'when multiplay fails',
      multiplayCompensationAmount: 'compensation amount',
      allowCrossings: 'crossing',
      scoringPreset: 'preset scoring scheme',
      endingCompensation: 'ending compensation',
      stageThreshold: 'stage threshold',
      levelThreshold: 'level threshold',
      levelUpLimitPerFrame: 'level-up limit per frame',
      baseMultiplierScheme: 'base multiplier scheme',
      attackersSelfBaseHalfMultiplier: 'half the multiplier when attackers set base',
      levelsPreset: 'preset level scheme',
      startLevel: 'start level',
      mustDefendLevels: 'must-defend',
      mustStopLevels: 'must-stop',
      knockBackLevels: 'knock-back',
      knockBackCondition: 'knock-back condition',
      gameMode: 'level cycle mode',
      timingPreset: 'preset timing scheme',
      timingMode: 'timing mode',
      playShotClock: 'shot clock',
      baseShotClock: 'base shot clock',
      bankTime: 'bank time',
      baseTimeIncrement: 'base time increment',
    },
    options: {
      yes: 'Yes',
      no: 'No',
      nts: 'NTS',
      thirdInitBase: '3rd init. base',
      unlimited: 'Unlimited',
      none: 'None',
      default: 'Default',
      failedMultiplayNormal: '3rd-seat-low, Fh-control',
      failedMultiplayCompensation: 'multiplay compensation',
      experimental: 'Experimental',
      plain: 'Plain',
      highSchool: 'High-school',
      berkeley: 'Berkeley',
      endless: 'Endless',
      passA: 'Pass-A',
      normal: '5/45/60',
      shotPlusBank: 'shot + bank',
      bankTimeOnly: 'bank-time-only',
      timing180Plus30: '180 + 30',
      // scoring presets
      traditional: 'Traditional',
      traditionalPower: 'power base',
      sevenThreeFive: '7-3-5',
      eightFourFour: '8-4-4',
      noPreset: '(none)',
      // levels presets
      slow: 'Slow',
      short: 'Short',
      singleT: 'single T',
      takeStageRequired: 'take-stage required',
      // base multiplier schemes
      limited: 'single/pair/more',
      singleOrNot: 'single-or-not',
      exponential: 'exponential',
      power: 'power',
    },
    timingPresetHints: {
      normal: '5s shot clock, 45s basing shot clock, 60s bank time',
      timing180Plus30: '180s bank time only, add 30s for every set-base move',
      custom: 'Custom timing values',
    },
    baseMultiplierSchemeHints: {
      limited:      '2 for single, 4 for pair, 8 for higher types',
      singleOrNot:  '2 for single, 4 for all structures',
      exponential:  '2 ^ (copy + span - 1) for structures',
      power:        '2 * copy ^ span',
    },
    scoringPresetHint: 'Stage ≥ {stage} | Level +{level} | Limit: {limit}',
    levelsPresetHint: 'Start: {start} | Defend: {defend} | Stop: {stop} | Knock-back: {knockBack}',
    gameModeHints: {
      endless: 'Endless: levels continue cycling.',
      passA: 'Pass-A: stop when A is reached.',
    },
    generalHints: {
      autoStrain: 'Auto strain can\'t be overcalled',
      overbaseRestriction: 'the last baser\'s opposite can\'t overbase',
      crossing: 'exchange 5 cards with opposite when trump count <= 5 in suited frame',
      multiplayCompensationAmount: 'points for each revoked card',
    },
  },

  // ── Timing (note 24) ──
  timing: {
    intermittentNormal: '{position} to defend {level}',
    intermittentQiangzhuang: 'Compete for pivot',
    noDeclaration: 'No declaration',
    basingPass: 'PASS',
    bankTimeLabel: 'Bank',
    shotClockLabel: 'Clock',
  },

  // ── Dealing phase (note 25) ──
  dealing: {
    dealtCount: '{count} dealt',
  },

  // ── Hints (note 25) ──
  hints: {
    attackersStreak: 'Atk. streak: {streak}',
    multiplayFailedShort: 'Multiplay failed',
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
    defendUpN:    'Defenders +{n} levels',
    takeStage:    'Take Stage (attackers on stage)',
    upOne:        'Up One (attackers +1 level)',
    upTwo:        'Up Two (attackers +2 levels)',
    upN:          'Up {n} (attackers +{n} levels)',
  },
};
