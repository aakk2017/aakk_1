# Bot Logic Instruction — Multiplay Activation Rule

This note exists to correct a specific problem in the current bot behavior:

> the bot almost never multiplays

That behavior is wrong.

The bot must actively consider multiplay when the required structural conditions are present.

---

## 1. Core rule

When the bot is on lead, and it holds a **structured element** that is **not worse than 4th-grade**, the bot should consider multiplay.

A structured element is eligible for multiplay if it is accompanied in the **same division** by either:

1. one or more **top / established single cards**
2. one or more **other structured elements** that are also **not worse than 4th-grade**

If either condition is satisfied, the bot should play a multiplay.

---

## 2. Composition of the multiplay

The multiplay should consist of:

- all eligible **top / established singles** in that division
- all eligible **structured elements** in that division that are **not worse than 4th-grade**

In short:

> multiplay = top/established singles + 4th-grade-and-up structured elements

This should be treated as the default bot construction rule for multiplay on lead.

---

## 3. Grade threshold

“Not worse than 4th-grade” means:

- grade <= 4

This applies to every structured element included by this instruction.

Do not include a structured element worse than 4th-grade under this rule.

---

## 4. Same-division requirement

Only cards / elements in the **same division** may be grouped into this multiplay.

Do not mix divisions.

The bot must still satisfy the normal single-division requirement of a lead.

---

## 5. Eligible companions

### 5.1 Top / established singles

The bot should include all same-division single cards that are:

- top singles, or
- established singles

if they accompany an eligible structured element.

### 5.2 Other structured elements

The bot should also include other same-division structured elements if those structured elements are:

- in the same division
- not worse than 4th-grade

This means the bot must not stop at “one best structured element + singles only”.

It should also combine multiple eligible structured elements in the same division into one multiplay.

---

## 6. Priority correction

The coding AI must not implement the bot as:

- “lead exactly one best structured element”
- or “only multiplay when singles are present”

That is too weak.

The correct behavior is:

- if there exists an eligible structured element,
- and it is accompanied by top/established singles and/or other eligible structured elements in the same division,
- then the bot should build the multiplay from **all such eligible components** in that division.

---

## 7. Suggested implementation procedure

A good implementation pattern is:

```text
1. enumerate all structured elements in hand
2. compute each structured element's grade
3. group eligible structured elements by division, keeping only those with grade <= 4
4. find top / established singles in each division
5. for each division:
       if there is at least one eligible structured element and
          (there is at least one top/established single OR
           there is more than one eligible structured element):
             build multiplay from:
                 all eligible structured elements in that division
                 + all top/established singles in that division
6. choose among candidate divisions according to the bot's lead priority rules
```

---

## 8. Important correction to previous under-behavior

If the bot holds:

- one 4th-grade-or-better structured element
- plus another 4th-grade-or-better structured element in the same division

then that alone is already enough reason to multiplay, even if there are no top/established singles.

Likewise, if the bot holds:

- one 4th-grade-or-better structured element
- plus top/established single(s) in the same division

that is also enough reason to multiplay.

Either condition is sufficient.

---

## 9. Bot behavior requirement

The coding AI must implement this as an affirmative multiplay rule, not merely as an optional heuristic that is almost never triggered.

If the stated condition is met, the bot should normally multiplay.

Do not let the bot silently fall back to “single structured lead only” in these cases.

---

## 10. Summary

When on lead:

- identify structured elements with grade <= 4
- stay within one division
- if such an element is accompanied by:
  - top/established singles, or
  - other structured elements with grade <= 4,
  then build a multiplay

Final construction rule:

> multiplay = top/established singles + 4th-grade-and-up structured elements
