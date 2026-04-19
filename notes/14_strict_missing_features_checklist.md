# Strict Implementation Checklist — Missing Exposed Cards, Counter Drawer, and Counting-Phase Dialog

This note exists because several required features are still missing in the implementation.

These features are **not optional polish**.
They are required parts of the game UI/state flow.

The task must be treated as **incomplete** until all items in this note are implemented.

---

## 1. Completion rule

The implementation is **not complete** if any of the following are missing:

1. exposed-card state tracking
2. exposed-card rendering in game UI
3. counter drawer in the top-right corner
4. counting-phase transition
5. counting-phase dialog
6. final score breakdown display
7. ready / leave controls in the counting-phase dialog

Do not mark the task as complete while any of these are absent.

---

## 2. Exposed cards — mandatory implementation

### 2.1 Required state

The implementation must track exposed cards explicitly.

At minimum, there must be state equivalent to:

```text
ExposedState[player][division] = remaining exposed cards
```

This state must be updated when:

- a failed multiplay exposes cards
- exposed cards are later played
- exposed cards are discarded
- a new frame initializes

### 2.2 Required visibility behavior

Exposed cards must be visible in game UI through the required interaction path.

Minimum requirement:

- when hovering on a player's name bar, render that player's exposed cards below the name bar
- align the left edge of the exposed-card area with `.name-area`

This is mandatory for other players in game mode.

### 2.3 Required rendering component

Exposed cards must use the compact index-only card-corner DOM object.

Do not substitute:
- plain text labels
- full normal cards
- missing placeholder boxes

unless there is an explicit temporary fallback clearly marked in code.

### 2.4 Forehand-control relation

When forehand control is active:

- the exposed cards of the **currently led exposed division** must be available for the forehand to choose from
- different background colors must distinguish:
  - `mustPlay`
  - `mustHold`

This must be rendered correctly and not left as future work.

---

## 3. Counter drawer — mandatory implementation

### 3.1 Trigger

When hovering on the score container, a counter drawer must appear.

This drawer shows the attackers' won counters in temporal order.

### 3.2 Content rules

Use the compact card-corner component.

Requirements:

- render counters in temporal order
- do not sort them
- 5 counters per row
- initialize empty at the start of each frame

### 3.3 Geometry rules

The drawer geometry must satisfy all of the following:

1. the **left edge of the counter area must touch the outer edge of the score container**
2. the drawer's **default height** must be the same as the **top-right corner area**
3. if content exceeds that height:
   - first draw out horizontally with the same height
   - then expand downward
4. reverse the animation when folding

### 3.4 Animation rules

Animation should be short:

- about `0.1s` to `0.2s`

The effect should look like a utility drawer, not a decorative panel.

---

## 4. Compact card-corner component — mandatory rendering details

The compact index-only card-corner DOM object must exist as a reusable component.

It is required for:

- exposed cards
- attackers' won counters
- compact base display in the counting-phase dialog

### 4.1 Visual requirements

It must:

- share fonts with normal cards
- share suit/rank colors with normal cards
- share border color with normal cards
- share default background color with normal cards
- be bordered on all four edges
- have only the top-left corner rounded
- allow independent width and height

Initial size target:

- width = `cardWidth / 3`
- height = `cardHeight / 2`

### 4.2 White-space requirement

The white space between the card index and the border in the card-corner component must be **very small**.

Do not leave large internal padding that makes the index float loosely inside the box.

This is a mandatory visual requirement.

---

## 5. Counting-phase transition — mandatory implementation

The implementation must explicitly detect when the playing phase ends.

Trigger condition:

- everyone has played all cards in hand

At that moment, the UI must enter counting phase.

Do not silently stop at the end of card play without opening the counting-phase UI.

---

## 6. Counting-phase dialog — mandatory implementation

### 6.1 Dialog opening

When the counting phase begins, open a counting-phase dialog window.

### 6.2 Required size

The dialog must have:

- width = same as `#desk-south`
- height = `2 * #desk-south`

### 6.3 Required content — first row

#### Left column
Base area:

- render base cards using the compact card-corner component

#### Right column
Score summary:

Must show:

- final frame score
- score of won counters
- base score
- ending compensation, if active
- multiplay compensation, if active

Do not omit inactive-rule rows silently from the data model; just hide their display rows.

### 6.4 Required content — second row

#### Left column
Result summary:

- result name
- level change
- updated levels of both teams

#### Right column
Buttons:

- Ready
- Leave

### 6.5 Required button behavior

Ready:
- start next frame

Leave:
- temporarily clear everything
- initialize the page

This temporary leave behavior is acceptable for now but the buttons themselves must exist and function.

---

## 7. Data prerequisites for counting phase

The counting-phase dialog is not just a visual shell.

The implementation must produce the underlying data model for:

- final frame score
- won-counter score
- base score
- ending compensation
- multiplay compensation
- result name
- level change
- updated team levels

If the dialog is missing because these values were never assembled, that still counts as incomplete implementation.

---

## 8. Auto-sort requirement still applies

The cards shown in:

- move displays
- exposed-card preview
- counting-phase compact areas

must still be auto-sorted according to the current Shengji sorting logic where sorting is required.

Do not leave newly added areas unsorted just because they were added later.

---

## 9. What the coding agent must not do

Do **not** treat these items as:

- future enhancement
- optional polish
- secondary UI refinement
- placeholder-only work

Do **not** respond with “main gameplay works” while these stateful required features are absent.

---

## 10. Explicit acceptance checklist

The task is complete only if all answers below are “yes”:

### Exposed cards
- Is exposed-card state tracked explicitly?  
- Are exposed cards rendered on name-bar hover?  
- Are exposed cards rendered using the compact card-corner component?  
- Are forehand-control colors for exposed cards implemented?  

### Counter drawer
- Does the score hover open the counter drawer?  
- Are counters shown in temporal order, 5 per row?  
- Does the drawer's left edge touch the score container's outer edge?  
- Is the default drawer height the same as the top-right corner area?  
- Is the drawer animation implemented correctly?  

### Card-corner component
- Does the compact card-corner component exist?  
- Is the internal white space around the index very small?  

### Counting phase
- Is there an explicit transition into counting phase?  
- Does the counting-phase dialog open automatically when all hands are empty?  
- Does it show base cards, final score, score breakdown, result summary, and Ready/Leave buttons?  
- Do Ready and Leave actually work?  

If any answer is “no”, the implementation is incomplete.

---

## 11. Final instruction

Please implement these as required, state-backed features.

Do not stop at partial UI scaffolding.
Do not omit the underlying state flow.
Do not mark the task as done until all checklist items are satisfied.
