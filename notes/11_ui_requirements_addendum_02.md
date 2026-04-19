# UI Requirements Addendum 02 — Advanced Table Widgets and Counting-Phase UI

This addendum extends the base UI requirements file and the first UI addendum.

Status of items in this addendum:
- mandatory unless later overridden by a newer addendum

Precedence:
- if this addendum conflicts with an earlier UI requirements file or addendum, this addendum takes priority
- otherwise, earlier UI requirements still apply

This addendum focuses on:
- compact corner-card rendering
- top-right score-hover drawer
- persistent name bars
- exposed-card display
- base preview button
- auto sorting of played cards
- counting-phase dialog window

---

## 1. New reusable UI component: index-only card corner object

Add a compact card-like DOM object for index/corner display only.

This is **not** the normal full card component.
It is a separate lightweight visual object.

### 1.1 Main usage

This object is used for:

- counters won by attackers
- exposed cards shown in other players' hand areas
- base cards shown in compact display areas such as the counting-phase window

### 1.2 Shared style with `.card`

This object should inherit or visually match the following properties of `.card`:

- fonts
- suit/rank colors
- border color
- default background color

### 1.3 Differences from `.card`

Compared with `.card`, this compact object must have the following differences:

- bordered on all 4 edges
- independent width and height
- only the top-left corner has radius
- it is not a full normal-card box

Initial size guideline:

- width = `cardWidth / 3`
- height = `cardHeight / 2`

This may be refined later, but this is the starting requirement.

### 1.4 Forehand-control color states for exposed cards

When exposed cards are shown for forehand-control interaction:

- use different background colors to indicate `mustPlay` vs `mustHold`
- these background colors apply only in the control-selection context
- they must remain visually distinct from the default idle exposed-card appearance

---

## 2. Top-right corner score-hover drawer

The top-right corner area should support a hover drawer showing counters won by attackers.

### 2.1 Trigger

When the cursor hovers on the score container, display a drawer area containing the counters won by attackers.

### 2.2 Content

Render the counters using the compact corner-card object defined in Section 1.

Layout rule:

- render counters in temporal order
- do not sort by suit/rank/value
- the earliest won counter appears first
- every 5 counters form one row

This counter list initializes at the beginning of each new frame.

### 2.3 Animation

This area should appear like a drawer.

Animation requirements:

- drawer expands from left to right
- short animation duration: about `0.1s` to `0.2s`
- if the full content height is larger than the height of the top-right corner area:
  1. first draw out horizontally with the same height as the top-right area
  2. then expand downward
- reverse this behavior when folding/closing

The effect should remain quick and utility-oriented, not decorative.

---

## 3. Name bars

Name bars of the other players must always remain visible during the game page.

### 3.1 Visibility

In real game mode:

- other players' name bars are always visible
- they are part of the persistent table structure

### 3.2 Default width

Default width of a name bar:

- `2 * cardWidth`

This should match the display width of 4 cards.

### 3.3 Dynamic width expansion

When the corresponding move contains more than 4 displayed cards:

- extend the name bar width to match the total width of displayed cards

Maximum width rules:

- maximum width of forehand name bar = `4 * cardWidth`
- maximum width of afterhand name bar = `4 * cardWidth`
- maximum width of opposite name bar = same as the reference player's maximum width

Also apply this same width cap to the corresponding move's card container when card count is at least 4.

In other words:

- when `cardCount >= 4`, the card container width should match the name bar width
- both should respect the same maximum width rule

### 3.4 Background color states

When the corresponding player is idle:

- use the default name-bar background color from the recap page style baseline

When the corresponding player is to play:

- use a breathing color instead of changing the desk-slot background

This breathing color is the primary on-play indicator for player identity.

### 3.5 Exposed-card preview on hover

When hovering on a player's name bar:

- render that player's exposed cards just below the name bar
- align the left edge with `.name-area`

Use the compact corner-card object for these exposed cards unless later overridden.

### 3.6 User-name truncation

The width of the name bar is **not** determined by the length of the user name.

If the user name is too long to fit:

- truncate it
- show `...` at the end

Do not let long names resize the layout.

---

## 4. Desk-slot background color

Do **not** change the background color of `.desk-slot` as an on-play signal.

Requirements:

- keep `.desk-slot` background color unchanged
- use the name bar's breathing color as the on-play signal instead
- a separate winner mark on desk-slot is not necessary

This requirement overrides earlier tendencies to mark the desk area itself as active.

---

## 5. Show-base button in the left-bottom corner

If the reference player is the final baser, the player may view the base during the playing phase.

### 5.1 Button placement

Add a **show base** button in the left-bottom corner.

### 5.2 Trigger behavior

When hovering on the show-base button:

- transform the left-bottom corner area into a base-display area
- show the base cards in normal card size

When the cursor leaves the left-bottom corner:

- restore that corner to its normal state

This is a hover preview, not a permanent toggle.

### 5.3 Visibility condition

This button should appear only if the reference player is the final baser and is therefore allowed to know the base.

---

## 6. Auto sort of played cards

Cards played in each move should be auto sorted before display.

This applies to:

- current-round table display
- recap/history display
- counting-phase compact displays when a move is shown there

Sorting should use the current Shengji sorting logic, not raw input order.

This requirement exists for readability and debugging.

---

## 7. Counting-phase window

When everyone has played all cards in hand, show a counting-phase dialog window.

### 7.1 Trigger

Open the counting-phase dialog when the playing phase ends because all players have no cards left in hand.

### 7.2 Window size

Required dimensions:

- width = same as `#desk-south`
- height = `2 * #desk-south`

### 7.3 Layout: first row

#### Left column
Base area:

- render base cards using compact corner-card objects

#### Right column
Score summary area:

Display:

- final frame score
- score breakdown, including:
  - score of won counters
  - base score
  - ending compensation, only if that rule is active
  - multiplay compensation, only if that rule is active

If a related rule is not active, do not show that row.

### 7.4 Layout: second row

#### Left column
Result summary:

- result name
- level change
- updated levels of both teams

A terminology appendix may later refine the displayed wording, but the fields must already exist structurally.

#### Right column
Two buttons:

- left: **Ready**
- right: **Leave**

### 7.5 Button behavior

**Ready** button:
- starts the next frame

**Leave** button:
- temporarily clears everything
- initializes the page

This current leave behavior is temporary and may change later.

---

## 8. Component and state expectations

### 8.1 Compact corner-card object

The coding AI should treat the compact corner-card object as a reusable component, not a one-off hack.

It should be usable in at least:

- attackers' won-counter drawer
- exposed-card preview areas
- compact base display in counting phase

### 8.2 State-driven rendering

The following states must be visually supported:

- idle name bar
- active/to-play name bar with breathing color
- exposed-card preview
- mustPlay exposed-card marking
- mustHold exposed-card marking
- score drawer open / closed
- counting-phase dialog visible / hidden

### 8.3 No hidden coupling

Do not couple:
- desk-slot active state
- name-bar active state
- score drawer state
- show-base hover state

These should be controlled independently by explicit UI state.

---

## 9. Summary of new mandatory requirements

This addendum adds the following requirements:

1. add a compact index-only card-corner DOM object
2. use it for attackers' won counters and exposed-card display
3. add a top-right score-hover drawer showing attackers' counters, 5 per row, in temporal order
4. animate the drawer quickly, left-to-right first, then downward if needed
5. keep other players' name bars always visible in game
6. let name bars expand with move width, subject to the stated caps
7. use breathing color on name bars to indicate the player to act
8. show exposed cards below a hovered name bar
9. truncate long user names with `...`
10. do not use `.desk-slot` background color as the on-play signal
11. add a left-bottom show-base hover button for the final baser
12. auto sort every displayed move
13. show a counting-phase dialog when all hands are empty
14. include score breakdown, base area, result summary, and Ready/Leave buttons in that dialog
