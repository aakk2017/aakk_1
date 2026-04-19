# Note to Coding Agent — Naming Normalization and Terminology Consistency

The current implementation introduced inconsistent new variable names.

This must be corrected.

## IMPORTANT !! ##

never claim one language is already correct unless it has been checked concept-by-concept against the terminology map and localization keys.

## 1. Authority order

When naming anything in the project, use these sources in this order:

1. **terminology map**  
   authoritative for internal concept naming
2. **localization/message files**  
   authoritative for displayed text
3. existing code style  
   only after the terminology map and message files are respected

Do **not** invent near-synonyms for new concepts.

---

## 2. Current naming error to fix

The coding agent introduced names such as:

- `endingBonus`
- `multiplayPenalty`

These are not consistent with the project terminology.

They must be normalized to:

- `endingCompensation`
- `multiplayCompensation`

Reason:

- **bonus** is not the chosen project term
- **penalty** is semantically wrong here, because the intended concept is **补分 / compensation**, not a punishment

---

## 3. Required normalization rule

For all newly introduced concepts:

- internal variable names
- config field names
- state keys
- message keys
- UI labels

must follow the terminology map unless there is an explicit override.

Do **not** create alternative names like:
- bonus vs compensation
- penalty vs compensation
- follower vs follow
- dealer vs pivot
- bid vs declaration

unless the terminology map explicitly allows it.

---

## 4. Specific required replacements

Please normalize the following everywhere in code:

- `endingBonus` → `endingCompensation`
- `multiplayPenalty` → `multiplayCompensation`

And check related places such as:

- state objects
- result breakdown objects
- counting-phase dialog fields
- localization keys
- config fields
- logs / debug output
- saved schema if applicable

---

## 5. Internal name vs display text

Keep these separate:

- **internal name** should follow the terminology map
- **display text** should come from the localization/message file

Example:

- internal: `endingCompensation`
- display: `"Ending compensation"` or its Chinese translation from the message file

Do not use ad hoc display wording as the basis for internal variable naming.

---

## 6. General rule for future additions

Before introducing any new variable or label for a game concept:

1. check whether the concept already exists in the terminology map
2. if yes, use that exact recommended code name
3. if no, add it to the terminology map first, then implement it

Do not silently invent a new synonym in code.

---

## 7. Final instruction

Please treat the terminology map as binding for concept naming.

The project must not drift into multiple near-synonymous internal names for the same rule concept.
