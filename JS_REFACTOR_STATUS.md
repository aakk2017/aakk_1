# JavaScript Refactoring Status

## Summary
Successfully refactored JavaScript codebase into a two-layer modular architecture:
- **Generic replay layer** (core/) for reusable game mechanics
- **Shengji-specific layer** (games/shengji/) for Shengji rules

## Completed Modules

### Core Layer (Generic) ✅
- `core/cards.js` - Base Card and Move classes  
- `core/dom_refs.js` - Centralized DOM references
- `core/replay_state.js` - State management
- `core/recap_view.js` - Generic rendering helpers
- `core/events.js` - Event handling

### Shengji Layer ✅ 
- `games/shengji/shengji_types.js` - Game constants and types
- `games/shengji/shengji_cards.js` - Shengji card evaluation model

### Entry Point ⚠️
- `pages/recap/index.js` - Orchestrator (created, needs full migration)

## Directory Structure Created

```
static/js/
├── core/                    (Generic replay - reusable)
├── games/                   (Game-specific code)
│   └── shengji/             (Shengji layer)
└── pages/
    └── recap/               (Page-specific entry point)
```

## Next Phase: Extract Shengji Logic

Remaining tasks to fully migrate shengji_recap.js:
1. shengji_rules.js - Card evaluation, trump logic
2. shengji_replay_parser.js - .upg file parsing
3. shengji_recap_view.js - Hand rendering
4. shengji_formatters.js - Text formatting
5. shengji_recap_controller.js - Move navigation

Old files (recap.js, shengji_recap.js) kept for reference during migration.

See REFACTORING_GUIDE.md for detailed migration instructions.
