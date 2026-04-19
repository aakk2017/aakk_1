# Note to Coding Agent — End-to-End Feature-Chain Verification

This note exists because visible features were reported as "implemented" but did not appear on the webpage.

That is not acceptable.

A feature is **not implemented** unless it is complete along the full chain:

1. trigger
2. state update
3. render path
4. DOM presence
5. visual visibility
6. interaction behavior

Do not report completion based only on code changes, helper functions, placeholder components, CSS classes, or state variables.

---

## 1. Mandatory completion rule

For every required feature, the coding agent must verify all of the following:

### 1.1 Trigger
- What exact event causes the feature to activate?
- In which file/function is that trigger handled?

### 1.2 State
- What exact state variable(s) change?
- Where are they stored?
- What values do they take before and after activation?

### 1.3 Render path
- Which component / DOM builder / template reads that state?
- In which file is the feature actually rendered?

### 1.4 DOM presence
- What exact DOM element should appear?
- Under what selector / component name / container?

### 1.5 Visual visibility
- Why is it visible?
- What size, position, z-index, display mode, and overflow behavior allow it to appear?

### 1.6 Interaction behavior
- If hover / click / dialog / drawer behavior is required, where is it bound?
- What user action should visibly prove that it works?

If any one of these is missing, the feature is incomplete.

---

## 2. Features currently requiring this full verification

At minimum, apply this protocol to:

1. exposed cards
2. top-right counter drawer
3. compact card-corner component
4. show-base hover area
5. counting-phase transition
6. counting-phase dialog
7. final score breakdown inside counting-phase dialog
8. ready / leave button behavior

Do not skip any of them.

---

## 3. Required output format for each feature

For each feature, the coding agent must provide a structured verification block like this:

```text
Feature: [name]

Trigger:
State:
Render path:
DOM location:
Visibility conditions:
Interaction proof:
Files changed:
Expected visible effect:
Status: COMPLETE / INCOMPLETE
```

Do not replace this with vague statements like:
- "added support"
- "wired up"
- "should work now"
- "implemented UI"

Those are not verification.

---

## 4. Example: counting-phase dialog

A valid completion check for the counting-phase dialog must explicitly answer:

- What exact condition detects "everyone has played all cards in hand"?
- What exact state variable enters counting phase?
- What component opens the dialog?
- What DOM subtree is rendered?
- Why is it visible on screen?
- What exact score breakdown object feeds the dialog?
- What visible result should appear when the condition is reached?

If these cannot be answered concretely, the dialog is not implemented.

---

## 5. Example: top-right counter drawer

A valid completion check for the counter drawer must explicitly answer:

- What element is the hover trigger?
- What state opens the drawer?
- Where are attackers' won counters stored?
- What component renders the counter corners?
- What container is positioned so that:
  - its left edge touches the outer edge of the score container
  - its default height equals the top-right corner area
- What exact visible animation should happen?

If these cannot be answered concretely, the drawer is not implemented.

---

## 6. Forbidden completion behavior

Do not mark a feature as complete when only one of the following exists:

- a state variable
- a helper function
- a CSS block
- a component file that is never mounted
- a TODO or comment
- a placeholder DOM node
- a non-triggered code path

A feature is complete only if the user can actually observe the intended effect on the page.

---

## 7. Required debugging mindset

If the webpage does not visibly change, assume the feature is still incomplete.

Do not defend the implementation by saying that code was added.

Instead, locate the broken link in the chain:

- trigger missing
- state not updated
- render path not connected
- DOM not mounted
- element hidden
- interaction not bound

Then fix that broken link.

---

## 8. Final instruction

From now on, treat every required UI feature as an end-to-end chain.

Do not report success unless the final visual effect and interaction can be observed on the actual webpage.
