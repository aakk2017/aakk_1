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
    toCross:        'to cross',
    toCrossBack:    'cross back',
    noCrossing:     'no crossing',
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
    botDeclarationMode: 'Bot declaration',
    botDeclarationModeNormal: 'normal',
    botDeclarationModePassive: 'passive',
    showBase:       'Show Base',
    pause:          'Pause',
    agree:          'agree',
    disagree:       'disagree',
    ready:          'Ready',
    quit:           'quit',
    cancel:         'Cancel',
    confirmQuit:    'Confirm quit',
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
    crossingClaim:'Crossing Claim Window',
    crossingPending:'Crossing Pending',
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
    crossingClaim:'Resolve crossing claims for all four seats',
    crossingPending:'Trick play is blocked until all active crossing processes are done',
    yourLead:     'Your lead',
    follow:       'Follow {division} {leadType} ({volume} cards)',
    botThinking:  '{playerName} thinking…',
    forehandControl: 'Mark exposed cards of {targetName} in led division (or skip)',
    gameOver:     'Game Over',
    paused:       'Game paused',
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
    nobodyDeclared: 'nobody declared',
    crossingClaimAccepted: '{playerName} claims crossing',
    crossingClaimIgnored: '{playerName} tried to claim crossing, but that team already has an accepted claim',
    crossingTimedOutNoClaim: '{playerName} timed out — recorded as no crossing',
    crossingMoveDone: '{playerName} crossed 5 cards to {partnerName}',
    crossingCrossbackDone: '{playerName} crossed back 5 cards to {partnerName}',
    crossingAllDone: 'All crossing processes are complete',
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
    pauseRequested: '{playerName} requested a pause',
    pauseRejected:  '{playerName} rejected the pause request',
    pauseTimeout:   'Pause request timed out, game resumed',
    pauseEntered:   'All players agreed, game paused',
    pauseResumed:   'All players are ready, game resumed',
    quitDuringPause:'{playerName} quit during pause. Game over.',
  },

  // ── Labels ──
  labels: {
    pivotMark:       'P',
    declareMethod:   'Declared: ',
    autoNts:         'auto NTS',
    thirdBase:       '3rd base',
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

  // ── Player ownership labels (ownership only — no natural position encoded) ──
  players: {
    youShort: 'You',
    botShort: 'Bot',
  },

  // ── 4P natural-position labels (canonical, merged from positions + natural) ──
  naturalPositions4P: {
    south: 'S',
    east:  'E',
    north: 'N',
    west:  'W',
  },

  // ── 3PDA real natural-position labels (real players only; Ay/dummy excluded) ──
  naturalPositions3PDA: {
    N:  'N',
    Sw: 'Sw',
    Se: 'Se',
  },

  // ── Dummy / Ay role label ──
  dummyRoles: {
    Ay: 'Ay',
  },

  // ── Frame-role labels (game-relative; renamed from seats) ──
  frameRoles: {
    pivot:       'Pivot',
    successor:   'Successor',
    ally:        'Ally',
    predecessor: 'Predecessor',
  },

  // ── Reference-position labels (renamed from relative; self -> reference) ──
  referencePositions: {
    reference: 'Self',
    afterhand: 'Afterhand',
    opposite:  'Opposite',
    forehand:  'Forehand',
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
    crossingSelectFive:      'Select exactly 5 cards for crossing.',
    crossingRequireAllTrumps:'Crossing requires including all trumps in your hand.',
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
    threePDANotImplemented: '3P dummy-ally is not yet implemented. Please select normal 4P.',
    threePDAPreview: {
      title:             '3PDA frame preview',
      pivotSelector:     'Preview pivot',
      referenceSelector: 'Preview reference',
      actionCycle:       'Action cycle',
      nextPivot:         'Next pivot',
      notPlayable:       'Preview only — 3PDA gameplay is not implemented yet.',
    },
    threePDAShell: {
      title:            '3PDA shell',
      subtitle:         'Frame model preview only — dealing/play not implemented yet.',
      frameIndex:       'Frame',
      currentPivot:     'Current pivot',
      nextPivot:        'Next pivot',
      actionCycle:      'Action cycle',
      referencePreview: 'Reference preview',
      nextShellFrame:   'Next shell frame',
      expandDetails:         'Expand details',
      collapseDetails:        'Collapse details',
      phaseLabel:             'Status',
      phaseFrameStartShell:   'Frame-start shell',
      cardStateStatus:            'Card state',
      cardStateActiveManifestIds: 'Active manifest IDs',
      cardStatePayload:           'Payload',
      cardStateZones:             'Zones',
      cardStateAssigned:          'Assigned',
      baseZone:                   'base',
      cardZoneContainers:         'Card-zone containers',
      slotReference:              'Reference',
      slotAfterhand:              'Afterhand',
      slotOpposite:               'Opposite',
      slotForehand:               'Forehand',
      slotBase:                   'Base',
      zoneCount:                  'Count',
      zoneCardsShort:             'cards',
      refHandDiagTitle:             'Reference hand diagnostics',
      refHandDiagActor:             'Reference actor/zone',
      refHandDiagExpected:          'Expected count',
      refHandDiagRendered:          'Rendered faces',
      refHandDiagVisibleNote:       'Visible faces (note)',
      refHandDiagVisibleNoteVal:    '25 (browser-measured only)',
      refHandDiagDisplayOrder:      'Display order',
      refHandDiagDisplayOrderVal:   'read-only sorted',
      refHandDiagDirection:         'Display direction',
      refHandDiagDirectionVal:      'high-left (matches 4P convention)',
      refHandDiagMutation:          'State mutation',
      refHandDiagMutationVal:       'none; display-only',
      refHandDiagDeterministic:     'Deterministic scaffold',
      refHandDiagDeterministicVal:  'enabled',
      refHandDiagNonRef:            'Non-reference placeholders',
    },
    threePDABoardShell: {
      realActor:  'Real',
      dummyActor: 'Dummy',
      shellOnly:  'Shell only',
    },
    displayPlaceholder: 'Display settings (reserved): structure ready, in-game editable options can be added later.',
    tabs: {
      table: 'Table',
      general: 'General',
      scoring: 'Scoring',
      levels: 'Levels',
      timing: 'Timing',
    },
    topLevelTabs: {
      game: 'Game Settings',
      seat: 'Seat',
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
      presetName: 'Preset rules',
      tableFormat: 'Table format',
      deckCount: 'deck count',
      autoStrain: 'strain when nobody declared',
      pivotPassMode: 'pivot-pass mode',
      allowOverbase: 'overbase',
      overbaseRestrictions: 'no cross-overbase',
      failedMultiplayHandling: 'when multiplay fails',
      multiplayCompensationAmount: 'compensation amount',
      allowCrossings: 'crossing',
      scoringPreset: 'preset scoring scheme',
      endingCompensation: 'ending compensation',
      endingCompensationUnit: 'points per round',
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
      userNaturalPosition: 'Your seat',
      userNaturalPosition3PDA: 'Your 3PDA seat',
      knockBackCondition: 'knock-back condition',
      gameMode: 'level cycle mode',
      timingPreset: 'preset timing scheme',
      timingMode: 'timing mode',
      playShotClock: 'shot clock',
      baseShotClock: 'base shot clock',
      bankTime: 'bank time',
      baseTimeIncrement: 'base time increment',
    },
    presetRuleLabels: {
      custom: 'custom',
      default: 'default (must stop 5XK)',
      highSchool: 'high-school (overbase, must defend starting level and knock-back JA)',
      berkeley: 'Berkeley (overbase, crossing, must stop 5XK)',
      experimental: 'experimental (7-3-5 scoring, ending compensation)',
      plain: 'plain (no additional rules)',
      shortLevelRotatePivot: 'short-level rotate-pivot (rotate-pivot, level threshold 20, end.comp.)',
    },
    options: {
      yes: 'Yes',
      no: 'No',
      nts: 'NTS',
      thirdInitBase: '3rd init. base',
      winnerPivot: 'winner-pivot',
      rotatePivot: 'rotate-pivot',
      unlimited: 'Unlimited',
      none: 'None',
      default: 'Default',
      failedMultiplayNormal: '3rd-seat-low, Fh-control',
      failedMultiplayCompensation: 'multiplay compensation',
      failedMultiplayLianZhongCompensation: 'Lian Zhong mp.comp.',
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
      normalFourPlayer: 'normal 4P',
      threePDA: '3P dummy-ally',
      // levels presets
      slow: 'Slow',
      short: 'Short',
      singleT: 'single T',
      takeStageRequired: 'take-stage required',
      nonSingleKnockBackTwoSteps: 'non-single 2 steps back',
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
    presetRuleHints: {
      custom: '',
      default: 'must stop 5XK',
      highSchool: 'overbase, must defend starting level and knock-back JA',
      berkeley: 'overbase, crossing, must stop 5XK',
      experimental: '7-3-5 scoring, ending compensation',
      shortLevelRotatePivot: 'rotate-pivot, level threshold 20, end.comp.',
      plain: 'no additional rules',
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

  pause: {
    waitingTitle: 'Waiting for agreement...',
    waitingMessage: '{playerName} requested a pause',
    pausedTitle: 'Paused',
    pausedMessage: 'Waiting for everyone to click ready',
    quitConfirm: 'Confirm quitting this game?',
    quitReason: 'Player {playerName} quit during pause.',
    countdown: '{seconds}s remaining',
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
    deskScore:       'Desk Score',
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
