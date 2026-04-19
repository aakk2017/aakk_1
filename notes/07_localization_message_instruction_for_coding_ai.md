# Localization and Message Organization Instruction for Coding AI

This document instructs a coding AI how to organize all user-facing text in the Shengji project.

The goal is to move all display text into dedicated message files so that:

1. messages are easy to find and edit
2. hardcoded UI text is avoided
3. future multilingual support is straightforward
4. rule/engine logic stays separate from presentation wording

This document applies to:

- game page
- recap page
- menus
- buttons
- tooltips
- status bars
- error messages
- announcements
- labels
- preset descriptions
- future spectator/replay UI

---

## 1. Core rule

Do **not** hardcode user-facing strings inside:

- UI components
- page scripts
- controllers
- rule/engine modules
- event handlers
- parsers
- bot logic

All user-visible text must come from a dedicated message dictionary.

This includes even short labels such as:

- "Play"
- "Clear"
- "Score"
- "Lead"
- "Ruff"
- "Error"

---

## 2. Scope of text that must be externalized

The message file(s) should contain at least:

- button labels
- menu labels
- toolbar labels
- status messages
- error messages
- warnings
- confirmations
- prompts
- announcements
- phase names
- preset names and descriptions shown to users
- seat/position labels shown to users
- replay labels
- declaration labels
- score-area labels
- base/dipai labels
- tooltips
- empty-state / placeholder text

This should also include texts that may seem “obvious” or short.

---

## 3. What should NOT be stored in the message file

Do not mix user-facing display text with internal engine constants.

Examples of internal constants that should stay separate:

- event names such as `FAILED_MULTIPLAY_DETECTED`
- enum values
- internal state keys
- rule identifiers
- CSS class names
- DOM IDs
- parser opcodes
- network protocol fields

The message layer is for **display text only**.

---

## 4. Preferred key structure

Do not use one giant flat namespace if avoidable.

Prefer grouped keys such as:

```text
buttons.play
buttons.clearSelection
buttons.declare
buttons.setBase

errors.illegalLeadMixedDivisions
errors.followVolumeMismatch
errors.multiplayFailed
errors.fakeMultiplay
errors.actionRejected

status.waitingForLead
status.waitingForFollow
status.roundRuffed
status.roundEnded
status.replayMode

labels.score
labels.penalty
labels.baseScore
labels.strain
labels.level
labels.pivot

menus.file
menus.open
menus.save
menus.settings

announcements.coverOccurred
announcements.ruffOccurred
announcements.roundWinner
announcements.frameEnded
```

This grouped structure scales much better than a long flat list.

---

## 5. File organization recommendation

Use one message file per language.

Suggested structure:

```text
src/
  i18n/
    en.js
    zh-CN.js
    index.js
```

Alternative naming is acceptable, for example:

```text
src/
  texts/
    en.js
    zh-CN.js
    index.js
```

The important part is:

- one file per language
- one common access method
- no hardcoded display strings elsewhere

---

## 6. Recommended initial language setup

Even if only one language is actively used now, set up the structure as multilingual from the beginning.

Recommended initial languages:

- `en`
- `zh-CN`

If the project initially ships with only one complete language, the other file may be partial, but the structure should still exist.

This makes later multilingual expansion much easier.

---

## 7. Message access pattern

Use one centralized message lookup function.

Example pattern:

```text
t("buttons.play")
t("errors.multiplayFailed")
t("status.waitingForFollow")
```

If interpolation is needed:

```text
t("announcements.roundWinner", { playerName: "North" })
t("status.turnOf", { playerName: "South" })
```

Do not access raw dictionaries everywhere in ad hoc ways if a central helper can be used.

---

## 8. String formatting and interpolation

Some messages must support variable insertion.

Examples:

- current player name
- round number
- score values
- preset name
- seat label
- action rejection reason

Use parameterized templates instead of string concatenation spread across the codebase.

Preferred style:

```text
"Turn: {playerName}"
"Round {roundNumber}"
"{playerName} wins the round."
"Action rejected: {reason}"
```

Avoid this style inside random components:

```text
"Turn: " + playerName
```

A central message formatter is better.

---

## 9. UI text vs rule terminology

Some technical rule terms may need two forms:

1. **internal strict term**
2. **player-facing display term**

For example:

- internal: `potentialRuff`
- display: "Potential ruff"
- internal: `failedMultiplay`
- display: "Multiplay failed."

Do not force the internal engine naming to be identical to the displayed wording.

This separation is important because:
- player-facing wording may change
- translation may not map 1:1
- internal naming should stay stable

---

## 10. Error message policy

All user-visible errors should come from the message file.

Examples:

- illegal lead
- illegal follow
- mixed-division lead
- follow volume mismatch
- action rejected
- replay load failure
- unsupported file
- parse error
- connection issue

If the engine returns structured error codes, the UI layer should map those codes to localized messages using the message file.

Example:

```text
engine error code: ILLEGAL_LEAD_MIXED_DIVISIONS
display text: t("errors.illegalLeadMixedDivisions")
```

This is preferred over returning raw display text from the engine.

---

## 11. Announcement and status message policy

Announcements and transient status text should also use the same message system.

Examples:

- round ended
- cover occurred
- ruff occurred
- declaration accepted
- lead accepted
- follow rejected
- replay mode
- waiting for other players
- counting phase started

Do not hardcode these in event handlers.

---

## 12. Seat labels and position names

Seat / position labels shown to users should also be externalized.

Examples:

- East / North / West / South
- reference / afterhand / opposite / forehand
- 本家 / 下家 / 对家 / 上家
- pivot / attackers / defenders

Different pages or language settings may want different display wording, so these should not be embedded into rule code.

---

## 13. Preset names and descriptions

If preset names or descriptions are shown in the UI, they should also come from the message file.

Examples:

- Default
- Plain
- High-school
- Berkeley
- Experimental

Descriptions shown in settings/help text should also be localized.

---

## 14. Migration rule for existing code

When refactoring existing code:

1. find hardcoded display strings
2. move them into the message file
3. replace them with message keys
4. leave internal constants untouched
5. do not silently mix internal constants and display text

This migration should be incremental and safe.

---

## 15. Example file shape

A language file may look like this:

```text
export default {
  buttons: {
    play: "Play",
    clearSelection: "Clear",
    declare: "Declare",
    setBase: "Set Base"
  },
  errors: {
    illegalLeadMixedDivisions: "Lead must be from a single division.",
    followVolumeMismatch: "Follow volume does not match the lead.",
    multiplayFailed: "Multiplay failed.",
    fakeMultiplay: "Fake multiplay.",
    actionRejected: "Action rejected."
  },
  status: {
    waitingForLead: "Waiting for lead.",
    waitingForFollow: "Waiting for follow.",
    roundRuffed: "Round has been ruffed."
  },
  labels: {
    score: "Score",
    penalty: "Penalty",
    baseScore: "Base score",
    strain: "Strain",
    level: "Level"
  }
}
```

This is only an example. Exact structure may vary, but grouping should be preserved.

---

## 16. Minimum implementation requirements

A coding AI should consider the localization/message organization task incomplete unless:

1. all major user-facing strings are moved out of code
2. there is at least one dedicated message file
3. a central lookup function exists
4. UI code no longer hardcodes new display strings
5. internal engine constants are kept separate from display text

---

## 17. Final instruction

Treat all user-facing text as content, not logic.

The coding AI must:

- keep display text centralized
- keep rule logic language-independent
- make it easy for the human developer to edit wording later
- make multilingual support possible without restructuring the whole codebase
