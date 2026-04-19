# Strict Correction Note — Multiplay Timing, Seat Marks, Declaration UI, and Counter-Drawer Alignment

This note is mandatory.

Its purpose is to correct specific observed mismatches.
Do not reinterpret it loosely.
Do not partially apply it.
Do not report success unless the runtime behavior matches the required behavior exactly.

---

## 0. Non-negotiable rule

The following observed behaviors are wrong and must be corrected exactly as specified here.

A change is incomplete if:

- the target issue is only partly fixed
- a previous correct behavior becomes wrong
- the visible runtime flow still differs from the required flow
- the coding agent answers with a summary instead of exact closure

For every item below, the coding agent must report:

```text
Item:
Observed old behavior:
Required behavior:
Files changed:
Invariant rechecked:
Status: COMPLETE / INCOMPLETE
```

Do not omit this report structure.

---

## 1. Multiplay check — wrong timing and wrong criterion

### 1.1 Observed wrong behavior

The current implementation refuses an intended multiplay because:

- “there are potential cases that others have higher elements than yours”

This is absolutely wrong.

That reasoning is not a legality check.
It must not block the intended lead from being laid down.

### 1.2 Required behavior

For an intended lead, do the following in the exact order below.

#### Step A — local mechanical check only

Before the lead is laid down, only mechanical/format errors may block the action.

Allowed local blocking reasons:

- intended lead mixes divisions
- selected cards are not in hand
- other true mechanical format errors

Not allowed as local blocking reasons:

- other players may have higher elements
- the multiplay may fail
- there exist potential blockers
- uncertainty about survival

#### Step B — lay down the intended lead

If the intended lead is from one division, lay it down on the desk.

This is required even if the lead may later fail.

#### Step C — run lead-resolution pipeline

Only after the intended lead is laid down and enters the authoritative lead-resolution pipeline may the engine:

1. resolve the lead canonically
2. detect failed multiplay
3. determine blockers / actual blocker / actual led element
4. continue the failed-multiplay protocol

### 1.3 Mandatory invariant

The implementation is wrong unless this invariant holds exactly:

> Any single-division intended lead is laid down first. Failed-multiplay checking happens only afterward, inside authoritative lead resolution.

### 1.4 Forbidden implementation

Do not implement any pre-submit logic that rejects a single-division intended lead merely because:

- higher same-type elements may exist in others' hands
- the intended multiplay may not survive
- the lead may later fail

That is forbidden.

---

## 2. Seat marks in the left-top corner

### 2.1 Observed wrong behavior

At the beginning of the second frame, the seat mark starts from pivot-undetermined state.

This is wrong.

### 2.2 Required behavior

In each game:

- only the first frame is a qiangzhuang frame
- every later frame already has a determined pivot from the previous frame's result

Therefore:

- at the beginning of frame 2 and later, seat marks must already be initialized to the correct pivot-relative state
- the UI must explicitly show who the pivot is immediately
- do not pass through a temporary pivot-undetermined display state if the pivot is already known

### 2.3 Mandatory invariant

At frame initialization:

- frame 1 of a game:
  - pivot may be undetermined before declaration resolution
- frame 2 and later:
  - pivot must be initialized immediately from the previous-frame result
  - seat marks must reflect that immediately

Any other behavior is wrong.

---

## 3. Declaration buttons missing in later frames

### 3.1 Observed wrong behavior

Observed behavior:

- declaration buttons are missing in the second frame
- no declarations are visibly made during the declaration/dealing stage
- but at the beginning of the playing phase, the UI says someone declared double clubs

This is inconsistent and wrong.

### 3.2 Required behavior

Declaration controls and declaration results must belong to the same visible flow.

Therefore:

- if declaration is part of the frame-start process, declaration controls must be visible in that stage
- if declaration is not part of the frame-start process, then the implementation must not silently synthesize a declaration result later as if a visible declaration had happened

### 3.3 Strict prohibition

Do not hide declaration controls while still allowing the code to invent a declaration outcome later.

That is forbidden.

### 3.4 Mandatory invariant

The implementation is wrong unless both are true:

1. declaration controls appear whenever declaration is part of the visible frame-start flow
2. no hidden declaration result appears without visible declaration-stage handling

---

## 4. Wrong display of declaration area

### 4.1 Observed wrong behavior

In the second frame, the `div-declaration` area shows only the declarer.

That is insufficient.

### 4.2 Required behavior

The declaration display must keep both of these sub-elements:

- `span-declare-method`
- `span-declaration`

Do not collapse the declaration area to only the declarer.

### 4.3 Mandatory invariant

The declaration display is wrong unless both fields are present and updated correctly.

---

## 5. Counter-drawer alignment still wrong

### 5.1 Observed wrong behavior

The counter area is not aligned with the score area.

### 5.2 Required behavior

When the score area is hovered:

- the counter drawer must open to the right of the score area
- the score area must remain visible
- the left edge of the counter drawer must align with the right edge of `div-score-container`

This is the exact required geometry.

### 5.3 Forbidden implementation

Do not:

- overlay the counter drawer on top of the score area
- align the counter drawer to the left edge of the score container
- let the score area become covered by the drawer

### 5.4 Mandatory invariant

The implementation is wrong unless all are true:

- score area remains visible
- drawer opens to the right
- drawer left edge aligns with the right edge of `div-score-container`

---

## 6. Required closure checklist

The coding agent must not report completion unless every answer below is YES.

### Multiplay timing
- Are single-division intended leads always laid down first?
- Is failed-multiplay detection only post-submit lead resolution?
- Is “others may have higher elements” fully removed as a pre-submit blocker?

### Seat marks
- Are seat marks initialized immediately at the beginning of frame 2 and later?
- Is the pivot shown immediately when already determined?

### Declaration UI
- Are declaration controls visible whenever declaration is part of the frame-start flow?
- Is hidden unsurfaced declaration-result synthesis removed?

### Declaration display
- Does `div-declaration` keep both `span-declare-method` and `span-declaration`?

### Counter drawer
- Does the counter drawer open to the right of the score area?
- Does its left edge align with the right edge of `div-score-container`?
- Does the score area remain visible while the drawer is open?

If any answer is NO, the implementation is incomplete.

---

## 7. Final instruction

Do not answer with:
- “I changed several files”
- “the logic was updated”
- “it should now work”

Instead, fix the runtime behavior exactly and report closure item by item.

This note is satisfied only when the actual runtime behavior matches the required behavior exactly.
