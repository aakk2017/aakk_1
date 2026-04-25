/**
 * zh-CN.js — Simplified Chinese message dictionary
 */
const messages_zhCN = {

  // ── Page titles ──
  page: {
    recapTitle: '青云谱 - 升级',
    gameTitle:  '升级 - 人机对局',
  },

  // ── Buttons ──
  buttons: {
    play:           '出牌',
    newGame:        '新对局',
    gameSettings:   '设置',
    gotoRecap:      '\u21A9 牌谱',       // ↩ 牌谱
    gotoGame:       '开始对局',
    openFile:       '选择牌谱(.upg)',
    saveUpg:        '保存为.upg',
    baseProgress:   '埋底 ({current}/{total})',
    confirmMarks:   '确认标记',
    nextFrame:      '下一局',
    testModeOn:     '测试模式: 开',
    testModeOff:    '测试模式: 关',
    showBase:       '查看底牌',
    ready:          '准备',
    leave:          '离开',
  },

  // ── Menu bar (recap page) ──
  menus: {
    open:     '打开',
    save:     '保存',
    settings: '设置',
    display:  '显示',
    play:     '行牌',
    edit:     '打谱',
    help:     '指南',
  },

  // ── Toolbar tooltips (recap page) ──
  tooltips: {
    toStart:             '回到开始',
    previousOfReference: '本家上一手',
    previousMove:        '上一步',
    nextMove:            '下一步',
    nextOfReference:     '本家下一手',
  },

  // ── Table headers (recap page) ──
  table: {
    pivot:       '庄',
    successor:   '右',
    ally:        '前',
    predecessor: '左',
  },

  // ── Phase display ──
  phase: {
    dealing:      '发牌中…',
    declaring:    '亮牌阶段',
    basing:       '定底阶段',
    selectBase:   '请选择 {n} 张底牌',
    playing:      '行牌阶段',
    lead:         '请出牌',
    follow:       '请跟牌 ({volume} 张)',
    botPlaying:   '{playerName} 出牌中…',
    roundWinner:  '{playerName} 赢得本轮',
    forehandControl: '{controllerName} 对 {targetName} 行使上控门跟 — 请选择标记牌',
    gameOver:     '对局结束',
    gameWon:      '通关！',
    initial:      '点击「新对局」开始',
  },

  // ── Status bar ──
  status: {
    ready:        '准备开始',
    barDefault:   '状态栏',
    dealingHint:  '发牌中，持有目标花色可亮牌',
    declaring:    '亮牌中…',
    selectBase:   '选择 {n} 张牌埋底',
    yourLead:     '你的出牌',
    follow:       '跟{division}{leadType} ({volume}张)',
    botThinking:  '{playerName} 思考中…',
    forehandControl: '选择 {targetName} 的标记牌（仅限当前门曝光牌，可不选）',
    gameOver:     '对局结束',
  },

  // ── Desk / round info ──
  desk: {
    roundInfo: '第 {round} 轮<br>{playerName}{action}',
    leadAction: ' 出牌',
    followAction: ' 跟牌',
  },

  // ── Game log messages ──
  log: {
    declare:        '{playerName} 亮主 {strain}',
    noDeclaration:  '无人亮牌，无主',
    baseDone:       '{playerName} 埋好底牌',
    humanBaseDone:  '你埋好了底牌',
    botError:       'Bot 错误: {error}',
    multiplayFailed: '{playerName} 甩牌失败 — {allBlockerNames} 有更大的牌，{blockerName} 为实际阻止者，改出{actualVolume}张',
    forehandControlActivated: '{controllerName} 获得对 {targetName} 的一次上控门跟机会',
    forehandControlBotExercised: '{controllerName} (bot) 行使上控门跟: 必跟(无标记)',
    forehandControlMarked: '{controllerName} 标记了 {count} 张牌 ({mode})',
    forehandControlNoMarks: '{controllerName} 未标记任何牌',
    roundResult:    '第 {round} 轮: {playerName} 赢{score}',
    trickPoints:    ' (+{points}分)',
    finalScore:     '最终得分: {totalScore} 分',
    baseScoreBonus: ' (底分 +{baseScore})',
    levelAdvance:   '{players} 升 {delta} 级',
    gameWon:        '{players} 通关！',
  },

  // ── Labels ──
  labels: {
    pivotMark:       '庄',
    declareMethod:   '亮主：',
    qiangzhuang:    '抢庄',
    noTrump:         '无主',
    noTrumpHtml:     '<div class="div-denomination-nts-text">无主</div>',
    baseMultiplier:  '底×{baseMultiplier}={baseScore}',
  },

  // ── Strain / suit ──
  strain: {
    noTrump: '无主',
  },

  // ── Division display names ──
  division: {
    d: '♦',
    c: '♣',
    h: '♥',
    s: '♠',
    t: '主',
  },

  // ── Lead type display names ──
  leadType: {
    single:   '单张',
    pair:     '对子',
    tractor:  '拖拉机',
    multiplay:'甩牌',
  },

  // ── Player names ──
  players: {
    south: '南 (你)',
    east:  '东 (Bot)',
    north: '北 (Bot)',
    west:  '西 (Bot)',
  },

  // ── Position labels ──
  positions: {
    south: '南',
    east:  '东',
    north: '北',
    west:  '西',
  },

  // ── Seat labels (game-relative) ──
  seats: {
    pivot:       '庄家',
    successor:   '右家',
    ally:        '前家',
    predecessor: '左家',
  },

  // ── Relative positions ──
  relative: {
    self:      '本家',
    afterhand: '下家',
    opposite:  '对家',
    forehand:  '上家',
  },

  // ── Natural positions (for recap) ──
  natural: {
    east:  '东',
    north: '北',
    west:  '西',
    south: '南',
  },

  // ── Error messages ──
  errors: {
    selectCards:             '请选择要出的牌',
    sameDivision:            '出牌必须来自同一花色(同为主牌或同为某一副牌)',
    resolveFailed:          '解析牡型失败',
    multiplayFailed:         '甩牌失败: 其他玩家有更大的{shapeType}',
    pairTractor:             '对子/拖拉机',
    single:                  '单牌',
    followCount:             '请跟 {volume} 张牌',
    cardNotInHand:           '选中的牌不在手牌中',
    mustPlayAllShort:        '短套时必须出完该门所有牌',
    mustFollowDivision:      '必须全部跟出领出门的牌',
    mustFollowPairs:         '你有对子必须跟对子 (需跟 {requiredPairs} 对)',
    mustFollowTractor:       '必须跟出拖拉机 (需跟长度 {K} 的拖拉机)',
    mustFollowStructure:     '必须跟出相应的型部结构',
    fakeMultiplay:           '甩牌不成立：存在可能被大过的组合',
    forehandControlFillers:  '上控门跟: 标记牌数量不符',
    notPlayingPhase:         '当前不在行牌阶段',
    notYourTurn:             '还没轮到你',
    selectBaseCount:         '请选择 {n} 张牌',
    baseFailed:              '底牌设置失败',
    openBeforeSave:          '请先打开牌谱，再保存。',
  },

  // ── Forehand control ──
  fc: {
    mustPlay: '必跟',
    mustHold: '禁跟',
  },

  // ── 对局设置弹窗 (note 34) ──
  settingsDialog: {
    createTitle: '新对局设置',
    inspectTitle: '当前对局设置',
    readOnlySubtitle: '对局进行中规则设置为只读。',
    editableSubtitle: '开始新对局前可编辑规则设置。',
    cancel: '取消',
    close: '关闭',
    confirm: '开始对局',
    displayPlaceholder: '显示设置（预留）：结构已保留，后续可加入局内可编辑显示项。',
    tabs: {
      presets: '预设',
      general: '总体',
      scoring: '计分',
      levels: '级设',
      timing: '计时',
    },
    topLevelTabs: {
      game: '游戏设置',
      display: '显示',
      file: '文件',
      accounts: '账号',
    },
    placeholders: {
      display: '预留：后续实现。',
      file: '预留：后续实现。',
      accounts: '预留：后续实现。',
    },
    fields: {
      presetName: '规则预设',
      deckCount: '副数',
      autoStrain: '无人亮主时的名目',
      allowOverbase: '炒底',
      overbaseRestrictions: '炒底限制',
      failedMultiplayHandling: '甩牌失败时',
      multiplayCompensationAmount: '补分量',
      allowCrossings: '过河',
      scoringPreset: '预设计分方案',
      endingCompensation: '终盘补分',
      stageThreshold: '台限',
      levelThreshold: '级限',
      levelUpLimitPerFrame: '每局升级上限',
      baseMultiplierScheme: '抠底倍数方案',
      attackersSelfBaseHalfMultiplier: '攻方定底时倍数折半',
      levelsPreset: '预设特殊级方案',
      startLevel: '初级',
      mustDefendLevels: '必打',
      mustStopLevels: '必停',
      knockBackLevels: '勾级',
      knockBackCondition: '勾回条件',
      gameMode: '循环方式',
      timingPreset: '预设计时方案',
      timingMode: '计时方式',
      playShotClock: '步时',
      baseShotClock: '扣底步时',
      bankTime: '局时',
      baseTimeIncrement: '扣底加时',
    },
    options: {
      yes: '是',
      no: '否',
      nts: '无主',
      thirdInitBase: '第三张底牌',
      unlimited: '无限',
      none: '无',
      default: '默认',
      failedMultiplayNormal: '三位禁盖，上控门跟',
      failedMultiplayCompensation: '甩牌补分',
      experimental: '实验',
      plain: '平打',
      highSchool: '校园',
      berkeley: '伯克利',
      endless: '无尽',
      passA: '过A',
      normal: '5/45/60',
      shotPlusBank: '步时 + 局时',
      bankTimeOnly: '包干',
      timing180Plus30: '180 + 30',
      // 计分预设
      traditional: '传统',
      traditionalPower: '传统幂底',
      sevenThreeFive: '7-3-5',
      eightFourFour: '8-4-4',
      noPreset: '(无)',
      // 级别预设
      slow: '慢打',
      short: '短打',
      singleT: '单T抠底',
      takeStageRequired: '需要上台',
      // 底分倍率方案
      limited: '三分（单/双/多）',
      singleOrNot: '两分（单/非单）',
      exponential: '指数',
      power: '幂',
    },
    timingPresetHints: {
      normal: '步时5秒，扣底步时45秒，局时60秒',
      timing180Plus30: '180秒包干，每次扣底加30秒',
      custom: '自定义计时',
    },
    baseMultiplierSchemeHints: {
      limited:      '单抠2倍，双抠4倍，更高牌型8倍',
      singleOrNot:  '单抠2倍，非单一律4倍',
      exponential:  '2的(叠秩 + 连秩 - 1)次方',
      power:        '2 * 叠秩 ^ 连秩',
    },
    scoringPresetHint: '上台 ≥ {stage} | 升级 +{level} | 每局升级上限: {limit}',
    levelsPresetHint: '初级: {start} | 必打: {defend} | 必停: {stop} | 勾级: {knockBack}',
    gameModeHints: {
      endless: '循环升级。',
      passA: '打过A后结束。',
    },
    generalHints: {
      autoStrain: '自动名目不能反',
      overbaseRestriction: '定底者对家只能反主，不能炒底',
      crossing: '有主局不到5张主可以与对家交换5张牌',
      multiplayCompensationAmount: '每张收回的牌的补分值',
    },
  },

  // ── Timing (note 24) ──
  timing: {
    intermittentNormal: '{position}家打{level}',
    intermittentQiangzhuang: '抢庄',
    noDeclaration: '不亮',
    basingPass: 'PASS',
    bankTimeLabel: '局时',
    shotClockLabel: '步时',
  },

  // ── Dealing phase (note 25) ──
  dealing: {
    dealtCount: '{count}张',
  },

  // ── Hints (note 25) ──
  hints: {
    attackersStreak: '连攻: {streak}',
    multiplayFailedShort: '甩牌失败',
  },

  // ── Counting dialog ──
  counting: {
    baseLabel:       '底牌',
    scoreLabel:      '得分明细',
    deskScore:       '分牌',
    baseScore:       '底分',
    endingCompensation: '终盘补分',
    multiplayCompensation: '甩牌补分',
    totalScore:      '总分',
    resultLabel:     '结果',
    levelChange:     '升级 +{delta}',
    noLevelChange:   '不升级',
    teamLevels:      '南北: {nsLevel} / 东西: {ewLevel}',
  },

  // ── Game result messages ──
  results: {
    grandSlam:    '大光 (庄家升3级)',
    smallSlam:    '小光 (庄家升2级)',
    retainStage:  '连庄 (庄家升1级)',
    defendUpN:    '守方升{n}级',
    takeStage:    '上台 (攻方上台)',
    upOne:        '上一 (攻方升1级)',
    upTwo:        '上二 (攻方升2级)',
    upN:          '上{n} (攻方升{n}级)',
  },
};
