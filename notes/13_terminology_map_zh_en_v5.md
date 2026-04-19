# Shengji Terminology Map — Chinese / English / Code Naming

This file is a bilingual terminology map for the Shengji project.

Purpose:
1. help coding AI choose correct variable names and function names
2. keep displayed English/Chinese wording consistent
3. separate internal code naming from user-facing wording
4. make future additions easy to append in the same format

This file is **not** a localization message file.
It is a glossary / naming guide.

---

## 1. How to use this file

Each item contains:

- **Chinese**
- **English display**
- **Recommended code name**
- **Definition / usage note**
- **Avoid / less preferred**

Rules:

1. Prefer the recommended code name for variables, functions, and comments.
2. Prefer the English display term for user-facing English UI unless a more natural UI phrase is explicitly needed.
3. If a later rule file or UI file needs a wording choice, use this map as the default reference.
4. When adding new terms, keep the same format.

---

## 2. Naming conventions

### 2.1 Code naming

Recommended code naming style:

- variables: `camelCase`
- functions: `camelCase`
- classes/types: `PascalCase`
- constants / event names: `UPPER_SNAKE_CASE` only when appropriate

### 2.2 English display vs code name

The **English display** term and the **recommended code name** do not need to be identical.

Example:

- English display: `Potential ruff`
- Code name: `potentialRuff`

Example:

- English display: `Multiplay failed`
- Code name: `failedMultiplay`

---

## 3. Card and deck terms

### 3.1 Card
- Chinese: 牌
- English display: card
- Recommended code name: `card`
- Definition / usage note: a single physical card object
- Avoid / less preferred: tile, piece

### 3.2 Deck
- Chinese: 牌堆 / 一副牌
- English display: deck
- Recommended code name: `deck`
- Definition / usage note: the full set of cards used in the frame/game
- Avoid / less preferred: pack (unless intentionally used)

### 3.3 Suit
- Chinese: 花色
- English display: suit
- Recommended code name: `suit`
- Definition / usage note: spade / heart / club / diamond / joker-suit marker
- Avoid / less preferred: color

### 3.4 Rank
- Chinese: 点数
- English display: rank
- Recommended code name: `rank`
- Definition / usage note: natural printed rank such as 2, 7, Q, A, V, W
- Avoid / less preferred: number (too vague)

### 3.5 Value
- Chinese: 牌名
- English display: value
- Recommended code name: `value`
- Definition / usage note: physical value identity `(suit, rank)`
- Avoid / less preferred: order (different concept)

### 3.6 Order
- Chinese: 阶 / 点位
- English display: order
- Recommended code name: `order`
- Definition / usage note: Shengji order under current level/strain
- Avoid / less preferred: rank (already used for printed rank)

### 3.7 Division
- Chinese: 门
- English display: division
- Recommended code name: `division`
- Definition / usage note: effective suit-classification under current frame, including trump division
- Avoid / less preferred: suit (not always the same as division)

### 3.8 Trump
- Chinese: 主 / 主牌
- English display: trump
- Recommended code name: `trump`
- Definition / usage note: trump division or trump card(s) depending on context
- Avoid / less preferred: major suit

### 3.9 Plain division
- Chinese: 副门
- English display: plain division
- Recommended code name: `plainDivision`
- Definition / usage note: any non-trump division
- Avoid / less preferred: side suit (acceptable in prose, but less precise)

### 3.10 Level card / leveler
- Chinese: 级牌
- English display: level card
- Recommended code name: `levelCard`
- Definition / usage note: cards whose rank equals the current level
- Avoid / less preferred: score card (wrong), trump card (not always enough)

### 3.11 Plain leveler
- Chinese: 副级牌
- English display: plain leveler
- Recommended code name: `plainLeveler`
- Definition / usage note: level card not in the strain suit, but still in trump division
- Avoid / less preferred: off-suit level card (acceptable explanatory phrase, but not preferred code name)

### 3.12 Big joker
- Chinese: 大王
- English display: big joker
- Recommended code name: `bigJoker`
- Definition / usage note: W
- Avoid / less preferred: red joker unless intentionally mapping to physical deck style

### 3.13 Small joker
- Chinese: 小王
- English display: small joker
- Recommended code name: `smallJoker`
- Definition / usage note: V
- Avoid / less preferred: black joker unless intentionally mapping to physical deck style

---

## 4. Seat and player-position terms

## 4A. Position systems

The project uses several different position systems. They must be kept distinct.

### 4A.1 Natural position
- Chinese: 自然方位 / 方位
- English display: natural position
- Recommended code name: `naturalPosition`
- Definition / usage note: absolute table orientation such as East / North / West / South
- Avoid / less preferred: seat if absolute orientation is specifically meant

### 4A.2 Reference position
- Chinese: 参照位置 / 本位
- English display: reference position
- Recommended code name: `referencePosition`
- Definition / usage note: position relative to the current viewpoint player, such as self / afterhand / opposite / forehand
- Avoid / less preferred: relative position if ambiguity exists with other relative systems

### 4A.3 Frame position
- Chinese: 局内位置 / 局位
- English display: frame position
- Recommended code name: `framePosition`
- Definition / usage note: position relative to the pivot in the current frame, such as pivot / predecessor / ally / successor
- Avoid / less preferred: seat if the pivot-relative role is specifically meant

### 4A.4 Round position
- Chinese: 轮内位置 / 轮位
- English display: round position
- Recommended code name: `roundPosition`
- Definition / usage note: position relative to the current round order, such as leader / second seat / third seat / fourth seat
- Avoid / less preferred: play order if you need the specific per-round seat-role term

### 4A.5 Natural positions
- Chinese: 东 / 北 / 西 / 南
- English display: East / North / West / South
- Recommended code name: `east`, `north`, `west`, `south`
- Definition / usage note: absolute table directions in a 4-player table
- Avoid / less preferred: top / right / bottom / left as formal terminology

### 4A.6 Reference positions
- Chinese: 本家 / 下家 / 对家 / 上家
- English display: reference / afterhand / opposite / forehand
- Recommended code name: `reference`, `afterhand`, `opposite`, `forehand`
- Definition / usage note: symmetric position system centered on the current viewpoint player
- Avoid / less preferred: predecessor / successor when symmetric self-reference is meant

### 4A.7 Frame positions
- Chinese: 庄家 / 左家 / 前家 / 右家
- English display: pivot / predecessor / ally / successor
- Recommended code name: `pivot`, `predecessor`, `ally`, `successor`
- Definition / usage note: asymmetric position system centered on the pivot for the current frame; Chinese terms for predecessor / ally / successor are temporary placeholders
- Avoid / less preferred: 左家 / 前家 / 右家 as formal long-term terminology, because they depend too much on a visual / advancing orientation

### 4A.8 Round positions
- Chinese: 领家 / 二位 / 三位 / 四位
- English display: leader / second seat / third seat / fourth seat
- Recommended code name: `leader`, `secondSeat`, `thirdSeat`, `fourthSeat`
- Definition / usage note: order within the current round only
- Avoid / less preferred: forehand / afterhand when exact round order is meant

---


### 4.1 Player
- Chinese: 玩家
- English display: player
- Recommended code name: `player`
- Definition / usage note: one participant
- Avoid / less preferred: user when game-logic context is meant

### 4.2 Seat
- Chinese: 座位
- English display: seat
- Recommended code name: `seat`
- Definition / usage note: positional place at the table
- Avoid / less preferred: side (too vague)

### 4.3 Self / observed player
- Chinese: 本家
- English display: self / reference
- Recommended code name: `selfPlayer` or `referencePlayer`
- Definition / usage note: the current viewpoint player
- Avoid / less preferred: me (too informal for code)

### 4.4 Forehand
- Chinese: 上家
- English display: forehand
- Recommended code name: `forehand`
- Definition / usage note: previous player relative to self in symmetric context
- Avoid / less preferred: predecessor in symmetric UI wording

### 4.5 Afterhand
- Chinese: 下家
- English display: afterhand
- Recommended code name: `afterhand`
- Definition / usage note: next player relative to self in symmetric context
- Avoid / less preferred: successor in symmetric UI wording

### 4.6 Opposite
- Chinese: 对家
- English display: opposite
- Recommended code name: `opposite`
- Definition / usage note: the seat opposite to self in 4-player context
- Avoid / less preferred: forehand's forehand (not stable)

### 4.7 Predecessor
- Chinese: 左家
- English display: predecessor
- Recommended code name: `predecessor`
- Definition / usage note: pivot-referenced asymmetric relation; temporary Chinese term, preferred over left/right-oriented wording
- Avoid / less preferred: 左家, 前家, forehand when pivot-reference meaning is intended

### 4.8 Ally
- Chinese: 前家
- English display: ally
- Recommended code name: `ally`
- Definition / usage note: pivot's teammate / opposite seat in the pivot-referenced frame-position system; temporary Chinese term
- Avoid / less preferred: 对家 when pivot-reference meaning rather than self-reference meaning is intended

### 4.9 Successor
- Chinese: 右家
- English display: successor
- Recommended code name: `successor`
- Definition / usage note: pivot-referenced asymmetric relation; temporary Chinese term, preferred over left/right-oriented wording
- Avoid / less preferred: 右家, 后家, afterhand when pivot-reference meaning is intended

### 4.10 Pivot
- Chinese: 庄家
- English display: pivot
- Recommended code name: `pivot`
- Definition / usage note: the special asymmetry-breaking side / leading role across frame logic
- Avoid / less preferred: dealer if the game meaning is not exactly dealer

### 4.11 Defender
- Chinese: 守方
- English display: defender
- Recommended code name: `defender`
- Definition / usage note: pivot side in the current frame
- Avoid / less preferred: landlord / banker unless intentionally using traditional terminology in UI

### 4.12 Attacker
- Chinese: 攻方
- English display: attacker
- Recommended code name: `attacker`
- Definition / usage note: non-pivot side in the current frame
- Avoid / less preferred: farmer / challenger unless intentionally using another game’s jargon

---

## 5. Declaration and basing terms

### 5.1 Declaration
- Chinese: 亮主
- English display: declaration
- Recommended code name: `declaration`
- Definition / usage note: act of declaring strain / claim
- Avoid / less preferred: bid unless the system is explicitly described as bidding

### 5.1.1 Qiangzhuang
- Chinese: 抢庄
- English display: competitive declaration
- Recommended code name: `qiangzhuang`
- Definition / usage note: declaration mode in which players compete for the pivot position by successive declarations / overcalls
- Avoid / less preferred: dealer bidding, banker bidding, grab-the-dealer

### 5.2 Overcall
- Chinese: 反主
- English display: overcall
- Recommended code name: `overcall`
- Definition / usage note: a later declaration overriding an earlier declaration
- Avoid / less preferred: raise (too specific to some bidding systems)

### 5.3 Single declaration
- Chinese: 单亮
- English display: single declaration
- Recommended code name: `singleDeclaration`
- Definition / usage note: one-card or one-level declaration strength
- Avoid / less preferred: normal declaration if strength distinction matters

### 5.4 Double declaration
- Chinese: 双亮
- English display: double declaration
- Recommended code name: `doubleDeclaration`
- Definition / usage note: stronger declaration than single
- Avoid / less preferred: pair declaration unless the rule literally uses a pair

### 5.5 Strain
- Chinese: 名目
- English display: strain
- Recommended code name: `strain`
- Definition / usage note: chosen trump suit / no-trump state
- Avoid / less preferred: trump suit when no-trump is also included in the same variable

### 5.5.1 Denomination
- Chinese: 级目
- English display: denomination
- Recommended code name: `denomination`
- Definition / usage note: the combination of `(level, strain)` that defines the context of a frame
- Avoid / less preferred: contract, trump context, frame context

### 5.6 No-trump suit / NTS
- Chinese: 无主
- English display: no-trump-suit / NTS
- Recommended code name: `nts`
- Definition / usage note: strain with no suit as trump suit, while jokers/levelers still behave accordingly
- Avoid / less preferred: neutral suit

### 5.7 Base / dipai
- Chinese: 底牌
- English display: base
- Recommended code name: `base`
- Definition / usage note: the hidden bottom cards
- Avoid / less preferred: kitty unless intentionally using that vocabulary

### 5.8 Pick up the base
- Chinese: 起底
- English display: pick up the base
- Recommended code name: `pickUpBase`
- Definition / usage note: pivot takes base into hand before setting final base
- Avoid / less preferred: draw the base if ambiguity exists

### 5.9 Set the base
- Chinese: 扣底 / 埋底
- English display: set the base
- Recommended code name: `setBase`
- Definition / usage note: choose cards to return to the base
- Avoid / less preferred: bury cards if neutral wording is preferred

### 5.10 Overbase
- Chinese: 反底 / 抄底
- English display: overbase
- Recommended code name: `overbase`
- Definition / usage note: additional base-taking / base-stealing mechanism depending on preset
- Avoid / less preferred: steal base unless UI wording specifically wants that phrase

---

## 6. Playing-phase structure terms

### 6.1 Lead
- Chinese: 领出
- English display: lead
- Recommended code name: `lead`
- Definition / usage note: first hand played in a round
- Avoid / less preferred: attack if exact round-leading meaning is intended

### 6.2 Follow
- Chinese: 跟牌
- English display: follow
- Recommended code name: `follow`
- Definition / usage note: response hand in the round
- Avoid / less preferred: respond if exact game term is needed

### 6.3 Round
- Chinese: 一轮 / 一墩
- English display: round
- Recommended code name: `round`
- Definition / usage note: one lead plus all follows
- Avoid / less preferred: trick unless you want to emphasize traditional trick-taking language

### 6.4 Element
- Chinese: 元素
- English display: element
- Recommended code name: `element`
- Definition / usage note: indivisible evaluation object; either a single or duplicates of a consecutive run
- Avoid / less preferred: combo unit unless informal explanation is needed

### 6.5 Volume
- Chinese: 秩
- English display: volume
- Recommended code name: `volume`
- Definition / usage note: number of cards in an element or play
- Avoid / less preferred: size if ambiguity with type complexity exists

### 6.6 Copy
- Chinese: 叠秩
- English display: copy
- Recommended code name: `copy`
- Definition / usage note: number of duplicates per order in an element
- Avoid / less preferred: multiplicity for primary display wording

### 6.7 Span
- Chinese: 连秩
- English display: span
- Recommended code name: `span`
- Definition / usage note: number of consecutive orders in an element
- Avoid / less preferred: length if ambiguity with card count exists

### 6.8 Type
- Chinese: 牌型
- English display: type
- Recommended code name: `type`
- Definition / usage note: `(copy, span)` pair for an element, or multiset of element types for a lead
- Avoid / less preferred: pattern when exact formal meaning is intended

### 6.9 Potential element
- Chinese: 可成元素 / 潜在元素
- English display: potential element
- Recommended code name: `potentialElement`
- Definition / usage note: an element that can be formed from the current card set
- Avoid / less preferred: candidate combo unless informal explanation is needed

### 6.10 Resolved lead
- Chinese: 领出分解
- English display: resolved lead
- Recommended code name: `resolvedLead`
- Definition / usage note: canonical decomposition of a lead into elements
- Avoid / less preferred: parsed lead if “resolved” is already used elsewhere

### 6.11 Core element
- Chinese: 核元素
- English display: core element
- Recommended code name: `coreElement`
- Definition / usage note: highest-priority element after sorting resolved elements
- Avoid / less preferred: main element if a stricter term is available

### 6.12 Core type
- Chinese: 核牌型
- English display: core type
- Recommended code name: `coreType`
- Definition / usage note: type of the core element
- Avoid / less preferred: main type

### 6.13 Multiplay
- Chinese: 甩牌
- English display: multiplay
- Recommended code name: `multiplay`
- Definition / usage note: a lead whose resolved lead contains more than one element
- Avoid / less preferred: throw unless informal UI wording is wanted

### 6.14 Structured part
- Chinese: 型部
- English display: structured part
- Recommended code name: `structuredPart`
- Definition / usage note: non-single portion produced by DFP/SFP when following
- Avoid / less preferred: matched part if you need exact rule term

### 6.15 Filler
- Chinese: 填充牌 / 补足牌
- English display: filler
- Recommended code name: `filler`
- Definition / usage note: cards used to fill remaining required volume after structured obligations
- Avoid / less preferred: junk cards (too informal and misleading)

---

## 7. Follow-procedure and legality terms

### 7.1 Structural Follow Procedure
- Chinese: 型跟流程
- English display: Structural Follow Procedure
- Recommended code name: `structuralFollowProcedure` / `SFP`
- Definition / usage note: rule procedure for following one led non-single element
- Avoid / less preferred: pair-follow logic (too narrow)

### 7.2 Division Follow Procedure
- Chinese: 门跟流程
- English display: Division Follow Procedure
- Recommended code name: `divisionFollowProcedure` / `DFP`
- Definition / usage note: rule procedure for following the whole lead
- Avoid / less preferred: global follow procedure if “division” matters

### 7.3 Existential legality
- Chinese: 存在式合法性
- English display: existential legality
- Recommended code name: `existentialLegality`
- Definition / usage note: a follow is legal if some valid decomposition exists
- Avoid / less preferred: loose legality

### 7.4 Canonical decomposition
- Chinese: 规范分解
- English display: canonical decomposition
- Recommended code name: `canonicalDecomposition`
- Definition / usage note: deterministic greedy decomposition used for leads
- Avoid / less preferred: natural decomposition unless you intentionally mean that exact concept

### 7.5 Short-division follow
- Chinese: 短门跟牌
- English display: short-division follow
- Recommended code name: `shortDivisionFollow`
- Definition / usage note: forced case where all cards in the led division must be played because they are not more than lead volume
- Avoid / less preferred: void follow (not the same thing)

### 7.6 Forehand control
- Chinese: 上控门跟
- English display: forehand control
- Recommended code name: `forehandControl`
- Definition / usage note: must-play / must-hold marked-card priority constraint
- Avoid / less preferred: predecessor control unless the asymmetric pivot system is meant

### 7.7 Must-play
- Chinese: 必跟
- English display: must-play
- Recommended code name: `mustPlay`
- Definition / usage note: marked cards should be included as much as possible
- Avoid / less preferred: force-play if “must-play” is already established

### 7.8 Must-hold
- Chinese: 禁跟
- English display: must-hold
- Recommended code name: `mustHold`
- Definition / usage note: marked cards should be preserved as much as possible
- Avoid / less preferred: force-hold if “must-hold” is already established

---

## 8. Evaluation and outcome terms

### 8.1 Discard
- Chinese: 贴 / 贴牌
- English display: discard
- Recommended code name: `discard`
- Definition / usage note: a follow evaluated below division-followers and ruffs
- Avoid / less preferred: throwaway unless informal prose is intended

### 8.2 Ruff
- Chinese: 杀 / 将吃
- English display: ruff
- Recommended code name: `ruff`
- Definition / usage note: trump takeover in a plain-division round
- Avoid / less preferred: trump in as a primary code name

### 8.3 Potential ruff
- Chinese: 形式将吃
- English display: potential ruff
- Recommended code name: `potentialRuff`
- Definition / usage note: all-trump follow that admits a type-preserving decomposition against the lead
- Avoid / less preferred: formal ruff unless the code specifically distinguishes that term

### 8.4 Division follow
- Chinese: 门跟
- English display: division follow
- Recommended code name: `divisionFollow`
- Definition / usage note: a legal follow that fully follows the led division; use this term instead of “division follower” to avoid confusion with a player who follows
- Avoid / less preferred: division-follower, same-suit follow

### 8.5 Cover
- Chinese: 盖
- English display: cover
- Recommended code name: `cover`
- Definition / usage note: a hand higher than all earlier hands in the round
- Avoid / less preferred: beat if you want the exact project term

### 8.6 Winner of the round
- Chinese: 本轮赢家
- English display: winner of the round
- Recommended code name: `roundWinner`
- Definition / usage note: player currently winning the round after evaluation
- Avoid / less preferred: trick winner if “round” is the chosen project term

### 8.7 Failed multiplay
- Chinese: 甩牌失败
- English display: failed multiplay
- Recommended code name: `failedMultiplay`
- Definition / usage note: actual current hands can block at least one led element
- Avoid / less preferred: illegal multiplay (not the same concept)

### 8.8 Fake multiplay
- Chinese: 假甩
- English display: fake multiplay
- Recommended code name: `fakeMultiplay`
- Definition / usage note: impossible to survive under leader-known information
- Avoid / less preferred: wrong multiplay unless that phrase is intentionally used in UI

### 8.9 Blocker
- Chinese: 挡家
- English display: blocker
- Recommended code name: `blocker`
- Definition / usage note: follower who can block a led element
- Avoid / less preferred: killer unless UI intentionally wants colorful wording

### 8.10 Blocked element
- Chinese: 被挡元素
- English display: blocked element
- Recommended code name: `blockedElement`
- Definition / usage note: led element that can be beaten by a follower
- Avoid / less preferred: failed element unless ambiguity is acceptable

### 8.11 3rd-seat low
- Chinese: 三位禁盖
- English display: 3rd-seat low
- Recommended code name: `thirdSeatLow`
- Definition / usage note: special rule or convention that constrains the third seat from covering in the specified situation
- Avoid / less preferred: third-seat low cover unless the exact meaning is to allow only low cover

### 9.7 Multiplay compensation
- Chinese: 甩牌补分
- English display: multiplay compensation
- Recommended code name: `multiplayCompensation`
- Definition / usage note: additional score/compensation rule associated with multiplay under the relevant rule set or preset
- Avoid / less preferred: multiplay bonus if the rule is formal compensation rather than an informal bonus


---

## 9. Counting and result terms

### 9.1 Counter card
- Chinese: 分牌
- English display: counter card
- Recommended code name: `counterCard`
- Definition / usage note: 5, X, K in the default counting system
- Avoid / less preferred: scoring card if “counter” is the chosen project term

### 9.2 Trick points / round points
- Chinese: 本轮分
- English display: trick points
- Recommended code name: `trickPoints`
- Definition / usage note: counters won in one round
- Avoid / less preferred: round score if that conflicts with frame score

### 9.3 Frame score
- Chinese: 局分
- English display: frame score
- Recommended code name: `frameScore`
- Definition / usage note: attackers’ accumulated score in the current frame
- Avoid / less preferred: game score if “frame” is the chosen term

### 9.4 Base score
- Chinese: 底分
- English display: base score
- Recommended code name: `baseScore`
- Definition / usage note: counted score from the base after base-winning conditions are satisfied
- Avoid / less preferred: dipai points unless the project wants pinyin borrowing

### 9.5 Endgame factor
- Chinese: 抠底倍率
- English display: endgame factor
- Recommended code name: `endgameFactor`
- Definition / usage note: multiplier or special factor applied at frame end
- Avoid / less preferred: final multiplier unless the exact rule term is broader

### 9.6 Ending compensation
- Chinese: 终盘补分
- English display: ending compensation
- Recommended code name: `endingCompensation`
- Definition / usage note: compensation rule enabled in some presets
- Avoid / less preferred: end bonus unless semantics differ

### 9.8 Must-defend level
- Chinese: 必打级
- English display: must-defend level
- Recommended code name: `mustDefendLevel`
- Definition / usage note: a level at which the defending side must defend / hold rather than being allowed to bypass it under the relevant rule set
- Avoid / less preferred: must-play level if that could be confused with must-play card control

### 9.9 Knock-back
- Chinese: 勾回
- English display: knock-back
- Recommended code name: `knockBack`
- Definition / usage note: level-result reversal/penalty rule depending on preset
- Avoid / less preferred: rollback unless strictly technical context

### 9.10 Must-stop level
- Chinese: 必停级
- English display: must-stop level
- Recommended code name: `mustStopLevel`
- Definition / usage note: levels that cannot be jumped over under some presets
- Avoid / less preferred: checkpoint level unless project explicitly adopts that term

### 9.11 Level threshold
- Chinese: 级限
- English display: level threshold
- Recommended code name: `levelThreshold`
- Definition / usage note: threshold or cutoff expressed in levels under the relevant rule or preset
- Avoid / less preferred: level limit if “threshold” is the formal project term

### 9.12 Stage threshold
- Chinese: 台限
- English display: stage threshold
- Recommended code name: `stageThreshold`
- Definition / usage note: threshold or cutoff expressed in stage / on-stage progression terms under the relevant rule or preset
- Avoid / less preferred: stage limit if “threshold” is the formal project term

---

## 10. Bot and test terms

### 10.1 Test bot
- Chinese: 测试机器人
- English display: test bot
- Recommended code name: `testBot`
- Definition / usage note: non-optimal bot used to generate legal scenarios
- Avoid / less preferred: AI player if it suggests strong strategy

### 10.2 Structure-preserving
- Chinese: 尽量保留结构
- English display: structure-preserving
- Recommended code name: `structurePreserving`
- Definition / usage note: tendency to avoid breaking existing non-single potential elements
- Avoid / less preferred: optimal preservation (too strong)

### 10.3 Grade
- Chinese: 等
- English display: grade
- Recommended code name: `grade`
- Definition / usage note: 1 + number of different higher same-type elements still possible from player-known information
- Avoid / less preferred: highness / nth-high as primary formal term

### 10.4 Top single
- Chinese: 顶张单牌
- English display: top single
- Recommended code name: `topSingle`
- Definition / usage note: highest possible single in the current division by frame definition
- Avoid / less preferred: absolute single unless you explicitly want that phrase

### 10.5 Established single
- Chinese: 已立单牌
- English display: established single
- Recommended code name: `establishedSingle`
- Definition / usage note: currently known highest remaining single in the division from player-known information
- Avoid / less preferred: secure single unless that wording is intentionally preferred in UI

---

## 11. UI and replay terms

### 11.1 Recap
- Chinese: 复盘
- English display: recap
- Recommended code name: `recap`
- Definition / usage note: replay/analysis page
- Avoid / less preferred: review if “recap” is the chosen project word

### 11.2 Replay
- Chinese: 回放
- English display: replay
- Recommended code name: `replay`
- Definition / usage note: move-by-move navigation mode
- Avoid / less preferred: playback unless multimedia-like wording is intended

### 11.3 Current-round table
- Chinese: 当前轮牌桌区
- English display: current-round table
- Recommended code name: `currentRoundTable`
- Definition / usage note: live center area showing what is currently on desk
- Avoid / less preferred: desk only, if ambiguity with whole table exists

### 11.4 Table record
- Chinese: 直谱
- English display: table record
- Recommended code name: `tableRecord`
- Definition / usage note: central replay table in recap mode
- Avoid / less preferred: matrix if player-facing wording is needed

### 11.5 To-play event
- Chinese: 出牌意图事件 / 提交出牌事件
- English display: to-play event
- Recommended code name: `toPlayEvent` or `playIntent`
- Definition / usage note: local commit attempt from Play button or double click
- Avoid / less preferred: play event if you need to distinguish intent vs acceptance

### 11.6 Selected cards
- Chinese: 已选牌
- English display: selected cards
- Recommended code name: `selectedCards`
- Definition / usage note: locally selected cards before commit
- Avoid / less preferred: picked cards unless UI intentionally wants simpler wording

### 11.7 Error message
- Chinese: 错误信息
- English display: error message
- Recommended code name: `errorMessage`
- Definition / usage note: user-facing error text
- Avoid / less preferred: exception unless internal programming context

### 11.8 Status message
- Chinese: 状态信息
- English display: status message
- Recommended code name: `statusMessage`
- Definition / usage note: transient or persistent UI state text
- Avoid / less preferred: log unless it is actual logging

### 11.9 Declaration button matrix
- Chinese: 亮主按钮矩阵
- English display: declaration button matrix
- Recommended code name: `declarationButtonMatrix`
- Definition / usage note: legality-driven grid of declaration controls
- Avoid / less preferred: declaration panel if the matrix structure matters

---

## 12. Preset names

### 12.1 Default
- Chinese: 默认
- English display: Default
- Recommended code name: `defaultPreset`
- Definition / usage note: default two-deck configuration
- Avoid / less preferred: standard if “default” is the chosen preset name

### 12.2 Plain
- Chinese: 平打
- English display: Plain
- Recommended code name: `plainPreset`
- Definition / usage note: preset with no must-stop levels
- Avoid / less preferred: simple preset unless formal preset name is needed

### 12.3 High-school
- Chinese: 校园规则
- English display: High-school
- Recommended code name: `highSchoolPreset`
- Definition / usage note: preset with overbase, ordering, high-school level config, unlimited knock-back, unlimited endgame factor
- Avoid / less preferred: school preset

### 12.4 Berkeley
- Chinese: 伯克利规则
- English display: Berkeley
- Recommended code name: `berkeleyPreset`
- Definition / usage note: preset with overbase, crossings, and unlimited endgame factor
- Avoid / less preferred: berkeleyRules if preset object name already includes preset

### 12.5 Experimental
- Chinese: 实验规则
- English display: Experimental
- Recommended code name: `experimentalPreset`
- Definition / usage note: preset with ending compensation and 7-3-5 counting
- Avoid / less preferred: test preset if that clashes with bot/testing language

---

## 13. Additions template

When adding a new term, use this template:

### [Term name]
- Chinese:
- English display:
- Recommended code name:
- Definition / usage note:
- Avoid / less preferred:

---

## 14. Final instruction

When there is a choice among:
- natural English prose
- internal variable naming
- displayed UI wording

use this file to keep them consistent, but do not force them to be identical.

This file exists to keep:
- code names stable
- UI wording editable
- bilingual terminology consistent


---

## 15. Additional result terms and abbreviations

### 15.1 Desk score
- Chinese: 桌面分
- English display: desk score
- English abbreviation: `Desk`
- Recommended code name: `deskScore`
- Definition / usage note: score of counters already won by the attackers on the table / in tricks before adding base-related adjustments
- Avoid / less preferred: trick score if the project needs to distinguish one-round score from accumulated attackers' won-counter score

### 15.2 Grand slam
- Chinese: 大光
- English display: grand slam
- English abbreviation: `GS`
- Recommended code name: `grandSlam`
- Definition / usage note: final frame score = 0; defenders level +3
- Avoid / less preferred: big slam, full shutout unless the project intentionally changes the result wording

### 15.3 Small slam
- Chinese: 小光
- English display: small slam
- English abbreviation: `SS`
- Recommended code name: `smallSlam`
- Definition / usage note: `0 < finalFrameScore < stageThreshold - levelThreshold`; defenders level +2
- Avoid / less preferred: little slam, near shutout unless the project intentionally changes the result wording

### 15.4 Retain stage
- Chinese: 连庄
- English display: retain stage
- English abbreviation: `RS`
- Recommended code name: `retainStage`
- Definition / usage note: `stageThreshold - levelThreshold <= finalFrameScore < stageThreshold`; defenders level +1 and remain on stage
- Avoid / less preferred: keep dealer, keep pivot, consecutive pivot unless the UI explicitly wants dealer/pivot wording

### 15.5 Take stage
- Chinese: 上台
- English display: take stage
- English abbreviation: `TS`
- Recommended code name: `takeStage`
- Definition / usage note: `stageThreshold <= finalFrameScore < stageThreshold + levelThreshold`; attackers get on stage, no level change
- Avoid / less preferred: go on stage, stage up, take over dealer unless the project intentionally uses those phrases

### 15.6 Up one
- Chinese: 上一
- English display: up one
- English abbreviation: `+1`
- Recommended code name: `upOne`
- Definition / usage note: attackers level +1
- Avoid / less preferred: one up if the rest of the result names already use the “up N” family

### 15.7 Up two
- Chinese: 上二
- English display: up two
- English abbreviation: `+2`
- Recommended code name: `upTwo`
- Definition / usage note: attackers level +2
- Avoid / less preferred: two up if the rest of the result names already use the “up N” family

### 15.8 Up N
- Chinese: 上三 / 上四 / etc.
- English display: up N
- English abbreviation: `+N`
- Recommended code name: `upN`
- Definition / usage note: generic result family where attackers level increases by N
- Avoid / less preferred: advance N if the UI already uses the “up N” family for consistency

### 15.9 Ending compensation
- Chinese: 终盘补分
- English display: ending compensation
- English abbreviation: `End. Comp.`
- Recommended code name: `endingCompensation`
- Definition / usage note: compensation rule applied at frame end when the related preset/rule is active
- Avoid / less preferred: ending bonus, end bonus

### 15.10 Multiplay compensation
- Chinese: 甩牌补分
- English display: multiplay compensation
- English abbreviation: `MP. Comp.`
- Recommended code name: `multiplayCompensation`
- Definition / usage note: compensation rule associated with multiplay when the related rule/preset is active
- Avoid / less preferred: multiplay penalty, multiplay bonus

---

## 16. Player-position abbreviations for display

These abbreviations are intended for compact UI display where space is limited.

### 16.1 Pivot abbreviation
- Chinese: 庄
- English display: Zh
- Recommended code name: `pivotAbbr`
- Definition / usage note: compact display abbreviation for pivot / 庄家
- Avoid / less preferred: P if that would collide with player / predecessor / points

### 16.2 Successor abbreviation
- Chinese: 右
- English display: Sc
- Recommended code name: `successorAbbr`
- Definition / usage note: compact display abbreviation for successor / 右家（暂）
- Avoid / less preferred: S if it would collide with South / score / self

### 16.3 Ally abbreviation
- Chinese: 前
- English display: Ay
- Recommended code name: `allyAbbr`
- Definition / usage note: compact display abbreviation for ally / 前家（暂）
- Avoid / less preferred: A if it would collide with attacker / ace

### 16.4 Predecessor abbreviation
- Chinese: 左
- English display: Pc
- Recommended code name: `predecessorAbbr`
- Definition / usage note: compact display abbreviation for predecessor / 左家（暂）
- Avoid / less preferred: P if it would collide with pivot / player / points

### 16.5 Reference abbreviation
- Chinese: 本
- English display: Rf
- Recommended code name: `referenceAbbr`
- Definition / usage note: compact display abbreviation for reference / 本家
- Avoid / less preferred: R if it would collide with round / replay / result

### 16.6 Afterhand abbreviation
- Chinese: 下
- English display: Ah
- Recommended code name: `afterhandAbbr`
- Definition / usage note: compact display abbreviation for afterhand / 下家
- Avoid / less preferred: A if it would collide with ally / attacker / ace

### 16.7 Opposite abbreviation
- Chinese: 对
- English display: Op
- Recommended code name: `oppositeAbbr`
- Definition / usage note: compact display abbreviation for opposite / 对家
- Avoid / less preferred: O if it would collide with order / open

### 16.8 Forehand abbreviation
- Chinese: 上
- English display: Fh
- Recommended code name: `forehandAbbr`
- Definition / usage note: compact display abbreviation for forehand / 上家
- Avoid / less preferred: F if it would collide with frame / follow
