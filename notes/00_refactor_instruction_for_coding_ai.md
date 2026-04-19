# Refactor Instruction for Coding AI — Replay Core + Shengji Layer

This document instructs a coding AI how to reorganize the existing recap-page JavaScript codebase.

The current code already hints at a two-layer design:

- a **generic replay layer** for arbitrary games
- a **Shengji-specific layer**

That design should be preserved and made explicit.

This document is not a final architecture manifesto. It is a practical refactor brief.

---

## 1. Main objective

Reorganize the existing code so that:

1. the **generic replay layer** is reusable by other games
2. the **Shengji layer** contains only Shengji-specific rule logic, parsing, formatting, and evaluation
3. the recap page keeps working during refactor
4. rule logic is easier to reuse later for:
   - the game page
   - testing
   - file import/export
   - bot logic
   - replay stepping
   - future server/client synchronization

Do **not** rewrite everything at once. Refactor in small safe steps.

---

## 2. Core design principle

The codebase should have two explicit layers.

### 2.1 Generic replay layer

This layer is game-agnostic.

It should handle concepts like:

- cards as physical objects
- moves as replay nodes / timeline nodes
- recap navigation
- move stepping
- comments
- keyboard navigation
- generic rendering helpers
- generic file-loading shell
- generic event wiring

This layer must not depend on Shengji rules.

### 2.2 Shengji-specific layer

This layer contains:

- card evaluation under `(level, strain)`
- Shengji-specific move parsing
- declaration / strain / level logic
- resolving leads and follows
- scoring semantics
- replay annotations specific to Shengji
- Shengji-specific text formatting
- future legality / evaluation logic

This layer may depend on the generic layer.  
The generic layer must not depend on this layer.

---

## 3. Existing pairing pattern to preserve

The current code already uses paired concepts:

- `Card` and `ShengjiCard`
- `Move` and `ShengjiMove`
- `recap.js` and `shengji_recap.js`

That idea is correct.

However, the separation is currently incomplete because DOM, replay state, parsing, and rule logic are still mixed.

Do **not** remove the two-layer idea.  
Instead, make it more explicit and stricter.

---

## 4. Refactor target structure

A suggested target file structure:

```text
src/
  core/
    cards.js
    moves.js
    replay_state.js
    replay_navigation.js
    recap_controller.js
    recap_view.js
    dom_refs.js
    events.js

  games/
    shengji/
      shengji_cards.js
      shengji_types.js
      shengji_rules.js
      shengji_replay_parser.js
      shengji_recap_view.js
      shengji_formatters.js

  pages/
    recap/
      index.js
```

Alternative naming is acceptable, but the layer split must remain clear.

---

## 5. What belongs in the generic replay layer

The generic replay layer should contain only code that can be reused by a non-Shengji game.

### 5.1 Generic card model

Keep a minimal base card model.

Recommended shape:

```text
Card:
    suit
    rank
    suitName
    rankName
    cardId
    played
```

This base card should **not** know Shengji-only concepts such as:

- trump
- division
- order under level/strain
- Shengji score value
- Shengji follow or lead semantics

Those belong in the Shengji layer.

### 5.2 Generic move model

Keep a minimal replay move model.

A generic move may contain:

- player
- moveId
- moveCards
- comment
- replay navigation helpers

It should **not** contain Shengji-specific semantics like:

- type follow
- ruff
- highest
- illegal multiplay
- Shengji move text

Those belong in the Shengji layer.

### 5.3 Generic replay state

Move these generic states out of the Shengji file:

- current move pointer
- current round id
- current branch id
- keyboard mode
- selected cards for recap UI
- hand DOM containers
- generic replay arrays and maps
- stepping state

### 5.4 Generic recap rendering

Keep generic DOM helpers here if they are not Shengji-specific, for example:

- creating hand row containers
- generic recap stepping hooks
- generic toolbar / menu handlers
- generic highlight update
- generic keyboard navigation

---

## 6. What belongs in the Shengji layer

### 6.1 Shengji card evaluation

Do not mutate the base `Card` object globally in multiple places.

Instead, create one Shengji-specific evaluation pathway.

Preferred pattern:

```text
evaluateShengjiCard(card, frameContext) -> evaluatedCard
```

where `frameContext` contains at least:

- level
- strain
- variation / preset if needed later

The evaluated result may include:

- division
- order
- orderName
- divisionName
- score
- isTrump

This can be implemented either as:

- a pure function returning a derived object, or
- a `ShengjiCard` wrapper / derived class

Either is acceptable, but avoid duplicated truth.

### 6.2 Shengji move semantics

Move Shengji-specific methods into `ShengjiMove` or Shengji rule modules, for example:

- `resolveLead`
- `resolveFollow`
- `isRuff`
- `isTypeFollow`
- `isHighest`
- `score`
- `type`
- formatting move text

### 6.3 Shengji replay parser

All `.upg` parsing and Shengji-specific record interpretation should live in the Shengji layer.

This includes:

- declaration blocks
- pivot / level data
- moves
- base
- score / penalty
- generation of Shengji replay move objects
- generation of initial hands from parsed moves

### 6.4 Shengji formatting

Move display text logic here, including:

- move text strings
- seat labels
- declaration text
- denomination rendering values

---

## 7. Important cleanup rules

### 7.1 One source of truth for Shengji card evaluation

Currently the code derives Shengji properties in multiple ways, for example through:

- `ShengjiCard` constructor
- `fillDivisionAndOrder(...)`
- `setLevel(...)`
- `setStrain(...)`
- direct mutation of `theDeck`

This must be unified.

Choose one of these approaches:

#### Option A — preferred
Keep base cards immutable and derive Shengji-evaluated card info from pure functions.

#### Option B
Use `ShengjiCard` objects, but ensure all Shengji evaluation is done in one place only.

Do not keep both active evaluation paths.

### 7.2 Separate plain objects from class instances

Currently `createDeck()` creates plain objects, while move parsing creates `ShengjiCard` instances.

This inconsistency must be removed.

Use one consistent card representation at runtime, or a very explicit conversion boundary.

### 7.3 Keep DOM out of rule helpers

Functions that compute rules should not directly touch DOM.

Bad pattern:

- a rule function mutates DOM or reads UI state

Preferred pattern:

- rule function returns data
- controller updates state
- view layer renders DOM

### 7.4 Reduce global mutable state

The current files contain many globals. Some are acceptable for a page script, but major state should be grouped.

At minimum, introduce state objects such as:

```text
ReplayState
ShengjiReplayState
ViewState
```

Do not keep extending the global namespace with unrelated variables.

---

## 8. Concrete migration plan

Perform refactor in this order.

### Step 1 — freeze behavior

Before moving code, preserve current page behavior as much as possible.

- Do not attempt a full redesign
- Move code with thin wrappers if needed
- Keep the recap webpage working after each step

### Step 2 — isolate DOM references

Create one module/file containing DOM references and page elements.

Move things like:

- hand container references
- status bar
- score widgets
- table record body
- toolbar buttons

out of the rule / parsing logic.

### Step 3 — isolate generic classes

Move `Card` and `Move` into generic core files.

Only keep generic methods there.

Remove Shengji-specific placeholders from the generic classes.

### Step 4 — isolate Shengji classes and helpers

Move `ShengjiCard`, `ShengjiMove`, `ShengjiType`, and Shengji-specific constants into the Shengji folder.

Examples:

- `numberToDivisionName`
- `numberToLevel`
- seat name mapping for Shengji
- denomination logic

### Step 5 — isolate parser

Move `.upg` parsing from mixed page code into `shengji_replay_parser.js`.

That parser should output a structured replay model, not directly render DOM.

### Step 6 — isolate rendering

Split rendering into:

- generic rendering helpers
- Shengji-specific recap rendering helpers

For example:
- generic card container creation may stay generic if it is truly generic
- Shengji-specific hand grouping and sort groups should move to the Shengji recap view layer

### Step 7 — isolate navigation/controller logic

Move keyboard handling, stepping, move navigation, and action handlers into controller modules.

These controller modules may call:

- replay-state helpers
- view rendering helpers
- Shengji parsing helpers

but should not contain rule logic themselves.

### Step 8 — unify Shengji card evaluation

After structural separation is done, fix the duplicated-truth issue for:

- division
- order
- trump
- score

This is the most important semantic cleanup.

---

## 9. Specific advice on `ShengjiCard`

### 9.1 Is a separate `ShengjiCard` necessary?

Yes, a separate Shengji-specific layer is necessary.

But it does **not** have to be a heavyweight mutable class.

You may choose either:

#### Model 1 — class wrapper
`ShengjiCard extends Card`

Use this only if:
- it is treated as a derived Shengji view of a base card
- all evaluation logic is centralized
- you avoid duplicated mutable truth

#### Model 2 — evaluated-card object
Use a pure function:

```text
evaluateShengjiCard(card, frameContext)
```

This returns a derived object with Shengji-specific fields.

This model is often simpler and safer.

### 9.2 Recommendation

For long-term maintainability, prefer:

- immutable base `Card`
- Shengji evaluation via pure functions
- optional lightweight evaluated-card objects

This makes:
- replay parsing
- rule testing
- future game engine
- bot logic

much easier to reason about.

---

## 10. Specific advice on `ShengjiMove`

`ShengjiMove` is appropriate, but it should contain only Shengji semantics or Shengji annotations.

Do not mix these two roles:

1. replay timeline node
2. Shengji rule result container

A practical split is:

- generic `Move`
- Shengji-specific helper functions or a `ShengjiMoveMeta` object attached to a move

For example:

```text
Move:
    player
    moveId
    moveCards
    comment

ShengjiMoveMeta:
    isLead
    isBase
    moveInfo
    revokedCards
    deskScore
    penalty
    moveText
```

This is often cleaner than pushing all semantics into inheritance.

---

## 11. What to do with the current paired files

### `recap.js`
Keep only:
- generic recap state
- generic replay stepping
- generic keyboard / menu / toolbar logic
- generic DOM helpers

### `shengji_recap.js`
Keep only:
- Shengji constants
- Shengji card evaluation
- Shengji replay parser
- Shengji sorting / resolving / formatting
- Shengji-specific recap rendering decisions

If a function can be reused by another game, it should move out of `shengji_recap.js`.

---

## 12. Known problem patterns to fix during refactor

These are warning signs in the current codebase.

### 12.1 Inconsistent card representations

Avoid mixing:
- plain card objects
- `Card` instances
- `ShengjiCard` instances

without an explicit boundary.

### 12.2 Rule state duplicated in multiple places

Do not update:
- level
- strain
- division
- order

through several unrelated pathways.

### 12.3 Rendering coupled to parsing

Do not let parsing immediately mutate the DOM.

Instead:
- parse file
- build replay state
- render from replay state

### 12.4 Navigation coupled to rule logic

Do not let keyboard handlers or replay stepping functions contain Shengji evaluation logic directly.

---

## 13. Minimal acceptable result of the refactor

A coding AI may consider this refactor successful if:

1. the recap page still loads and works
2. generic replay code no longer imports Shengji rule logic directly
3. Shengji-specific code is isolated in a dedicated module/folder
4. card evaluation under `(level, strain)` has one clear source of truth
5. parsing, rule logic, rendering, and controller code are less entangled than before

---

## 14. What not to do

Do **not**:

- rewrite the whole app into a framework immediately
- replace everything with giant classes
- delete the two-layer idea
- hide rule logic inside DOM code
- keep both old and new evaluation pathways active indefinitely

---

## 15. Deliverables expected from coding AI

When carrying out this reorganization, produce:

1. the new file/module structure
2. moved code with imports/exports wired correctly
3. a short migration note explaining:
   - what moved where
   - what remains intentionally unchanged
   - what semantic cleanups were made
4. temporary compatibility wrappers if needed
5. no silent behavior changes unless explicitly documented

---

## 16. Final instruction

Preserve the current two-layer intent.

Do not simplify it into one flat codebase.

The right refactor is:

- generic replay layer underneath
- Shengji-specific layer above it
- recap page as one consumer
- future game page as another consumer
