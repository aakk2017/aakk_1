/**
 * games/shengji/shengji_settings.js
 * Authoritative settings/config framework for Shengji game creation and inspection.
 */

(function () {
    const DEFAULT_TIMING = {
        frameIntermittent: 2,
        finalDeclareWindow: 5,
        overbaseWindow: 10,
        playShotClock: 5,
        baseShotClock: 45,
        bankTime: 60,
        baseTimeIncrement: 30,
    };

    // Timing sub-presets: select within Timing tab to bulk-update timing fields.
    const TIMING_PRESETS = {
        'normal': {
            timingMode: 'shot + bank',
            playShotClock: 5,
            baseShotClock: 45,
            bankTime: 60,
        },
        '180+30': {
            timingMode: 'bank-time-only',
            bankTime: 180,
            baseTimeIncrement: 30,
        },
    };

    // Scoring sub-presets: select within Scoring tab to bulk-update all related scoring fields.
    // Each entry must include ALL scoring fields so bidirectional sync is lossless.
    const SCORING_PRESETS = {
        'traditional': {
            endingCompensation: false,
            stageThreshold: 80,
            levelThreshold: 40,
            levelUpLimitPerFrame: null,
            baseMultiplierScheme: 'limited',
            attackersSelfBaseHalfMultiplier: false,
        },
        'traditional-power': {
            endingCompensation: false,
            stageThreshold: 80,
            levelThreshold: 40,
            levelUpLimitPerFrame: null,
            baseMultiplierScheme: 'power',
            attackersSelfBaseHalfMultiplier: false,
        },
        '7-3-5': {
            endingCompensation: true,
            stageThreshold: 76,
            levelThreshold: 38,
            levelUpLimitPerFrame: 5,
            baseMultiplierScheme: 'limited',
            attackersSelfBaseHalfMultiplier: true,
        },
        '8-4-4': {
            endingCompensation: false,
            stageThreshold: 80,
            levelThreshold: 40,
            levelUpLimitPerFrame: 4,
            baseMultiplierScheme: 'limited',
            attackersSelfBaseHalfMultiplier: true,
        },
    };

    // Levels sub-presets: select within Levels tab to bulk-update all related levels fields.
    // Each entry must include ALL levels fields so bidirectional sync is lossless.
    const LEVELS_PRESETS = {
        'default': {
            startLevel: 0,
            mustDefendStartMarker: false,
            mustDefendLevels: [],
            mustStopStartMarker: false,
            mustStopLevels: [3, 8, 11],
            knockBackLevels: [],
            knockBackConditionMode: 'unlimited',
            knockBackTakeStageRequired: false,
            gameMode: 'endless',
        },
        'high-school': {
            startLevel: 0,
            mustDefendStartMarker: true,
            mustDefendLevels: [9, 12],
            mustStopStartMarker: false,
            mustStopLevels: [],
            knockBackLevels: [9, 12],
            knockBackConditionMode: 'unlimited',
            knockBackTakeStageRequired: false,
            gameMode: 'endless',
        },
        'slow': {
            startLevel: 0,
            mustDefendStartMarker: false,
            mustDefendLevels: [9, 12],
            mustStopStartMarker: true,
            mustStopLevels: [3, 8, 11],
            knockBackLevels: [9, 12],
            knockBackConditionMode: 'unlimited',
            knockBackTakeStageRequired: false,
            gameMode: 'endless',
        },
        'plain': {
            startLevel: 0,
            mustDefendStartMarker: false,
            mustDefendLevels: [],
            mustStopStartMarker: false,
            mustStopLevels: [],
            knockBackLevels: [],
            knockBackConditionMode: 'unlimited',
            knockBackTakeStageRequired: false,
            gameMode: 'endless',
        },
        'short': {
            startLevel: 5,
            mustDefendStartMarker: false,
            mustDefendLevels: [],
            mustStopStartMarker: false,
            mustStopLevels: [3, 8, 11],
            knockBackLevels: [],
            knockBackConditionMode: 'unlimited',
            knockBackTakeStageRequired: false,
            gameMode: 'endless',
        },
    };

    const PRESETS = {
        'default': {
            deckCount: 2,
            autoStrain: false,
            allowOverbase: false,
            overbaseRestrictions: 'none',
            failedMultiplayHandling: 'default',
            multiplayCompensationAmount: 5,
            multiplayCompensation: false,
            allowCrossings: false,

            scoringPreset: 'traditional',
            countingSystem: 'default',
            endingCompensation: false,
            stageThreshold: 80,
            levelThreshold: 40,
            levelUpLimitPerFrame: null,
            baseMultiplierScheme: 'limited',
            attackersSelfBaseHalfMultiplier: false,
            baseMultiplierLimit: 4,

            levelsPreset: 'default',
            startLevel: 0,
            mustDefendStartMarker: false,
            mustDefendLevels: [],
            mustStopStartMarker: false,
            mustStopLevels: [3, 8, 11],
            knockBackLevels: [],
            knockBackConditionMode: 'unlimited',
            knockBackTakeStageRequired: false,
            gameMode: 'endless',
            levelConfiguration: 'default',

            timingPreset: 'normal',
            timingMode: 'shot + bank',
            timing: { ...DEFAULT_TIMING },

            doubleDeclarationOrdering: null,
        },
        'plain': {
            mustStopLevels: [],
            levelsPreset: 'plain',
            levelConfiguration: 'plain',
        },
        'high-school': {
            allowOverbase: true,
            overbaseRestrictions: 'none',
            doubleDeclarationOrdering: 's-h-c-d',
            levelConfiguration: 'high-school',
            baseMultiplierScheme: 'exponential',
            baseMultiplierLimit: Infinity,
            levelsPreset: 'high-school',
            startLevel: 0,
            mustDefendStartMarker: true,
            mustDefendLevels: [9, 12],
            mustStopStartMarker: false,
            mustStopLevels: [],
            knockBackLevels: [9, 12],
            knockBackConditionMode: 'unlimited',
            knockBackTakeStageRequired: false,
            gameMode: 'endless',
        },
        'experimental': {
            endingCompensation: true,
            countingSystem: '7-3-5',
        },
    };

    const SCHEMA = {
        tabs: {
            presets: ['presetName'],
            general: ['deckCount', 'autoStrain', 'allowOverbase', 'overbaseRestrictions', 'failedMultiplayHandling', 'multiplayCompensationAmount', 'allowCrossings'],
            scoring: ['scoringPreset', 'endingCompensation', 'stageThreshold', 'levelThreshold', 'levelUpLimitPerFrame', 'baseMultiplierScheme', 'attackersSelfBaseHalfMultiplier'],
            levels: ['levelsPreset', 'startLevel', 'mustDefendLevels', 'mustStopLevels', 'knockBackLevels', 'knockBackConditionMode', 'knockBackTakeStageRequired', 'gameMode'],
            timing: ['timingPreset', 'timingMode', 'playShotClock', 'baseShotClock', 'bankTime', 'baseTimeIncrement'],
        },
    };

    function clampInt(v, fallback, min, max) {
        let n = Number(v);
        if (!Number.isFinite(n)) return fallback;
        n = Math.floor(n);
        if (Number.isFinite(min) && n < min) n = min;
        if (Number.isFinite(max) && n > max) n = max;
        return n;
    }

    function normalizeLevelList(v) {
        if (!Array.isArray(v)) return [];
        let vals = v
            .map(x => clampInt(x, null, 0, 12))
            .filter(x => x !== null);
        let dedup = [...new Set(vals)];
        dedup.sort((a, b) => a - b);
        return dedup;
    }

    function normalizeRuleConfig(cfg) {
        let out = { ...cfg };
        out.deckCount = clampInt(out.deckCount, 2, 1, 4);
        out.autoStrain = !!out.autoStrain;
        out.allowOverbase = !!out.allowOverbase;
        out.doubleDeclarationOrdering = out.allowOverbase ? 's-h-c-d' : 'all-suits-equal';
        out.allowCrossings = !!out.allowCrossings;
        out.endingCompensation = !!out.endingCompensation;
        out.attackersSelfBaseHalfMultiplier = !!out.attackersSelfBaseHalfMultiplier;

        out.multiplayCompensationAmount = clampInt(out.multiplayCompensationAmount, 5, 1, 10);
        // General-tab skeleton policy: compensation mode is config-selectable,
        // but deep runtime semantics are implemented in later dedicated notes.
        out.multiplayCompensation = (out.failedMultiplayHandling === 'compensation');
        let dcMax = 100 * (out.deckCount || 2);
        out.stageThreshold = clampInt(out.stageThreshold, 80, 1, dcMax);
        out.levelThreshold = clampInt(out.levelThreshold, 40, 2, dcMax);

        // Force attackersSelfBaseHalfMultiplier off when overbase is disabled
        if (!out.allowOverbase) out.attackersSelfBaseHalfMultiplier = false;

        const VALID_LEVEL_LIMITS = [3, 4, 5, 6];
        if (out.levelUpLimitPerFrame === null || out.levelUpLimitPerFrame === undefined || out.levelUpLimitPerFrame === '') {
            out.levelUpLimitPerFrame = null;
        } else {
            let lim = Number(out.levelUpLimitPerFrame);
            out.levelUpLimitPerFrame = VALID_LEVEL_LIMITS.includes(lim) ? lim : null;
        }

        out.startLevel = clampInt(out.startLevel, 0, 0, 12);
        out.mustDefendStartMarker = !!out.mustDefendStartMarker;
        out.mustStopStartMarker = !!out.mustStopStartMarker;
        out.knockBackTakeStageRequired = !!out.knockBackTakeStageRequired;

        // Backward compatibility for old single-value key.
        if (!Array.isArray(out.mustDefendLevels) && out.mustDefendLevel !== undefined && out.mustDefendLevel !== null && out.mustDefendLevel !== '') {
            out.mustDefendLevels = [clampInt(out.mustDefendLevel, 0, 0, 12)];
        }
        out.mustDefendLevels = normalizeLevelList(out.mustDefendLevels);
        out.mustStopLevels = normalizeLevelList(out.mustStopLevels);
        out.knockBackLevels = normalizeLevelList(out.knockBackLevels);

        if (!out.knockBackConditionMode) out.knockBackConditionMode = 'unlimited';

        // Legacy migration: if old config encoded semantic start as a literal start-level member,
        // treat it as semantic marker when explicit marker fields are absent.
        if (!('mustDefendStartMarker' in cfg) && out.mustDefendLevels.includes(out.startLevel)) {
            out.mustDefendStartMarker = true;
            out.mustDefendLevels = out.mustDefendLevels.filter(x => x !== out.startLevel);
        }
        if (!('mustStopStartMarker' in cfg) && out.mustStopLevels.includes(out.startLevel)) {
            out.mustStopStartMarker = true;
            out.mustStopLevels = out.mustStopLevels.filter(x => x !== out.startLevel);
        }

        // Mutual exclusion: must-defend and must-stop cannot contain the same level.
        let defendSet = new Set(out.mustDefendLevels);
        out.mustStopLevels = out.mustStopLevels.filter(x => !defendSet.has(x));

        if (out.baseMultiplierScheme === 'unlimited') {
            out.baseMultiplierLimit = Infinity;
        } else if (out.baseMultiplierLimit === Infinity || out.baseMultiplierLimit === 'Infinity') {
            out.baseMultiplierLimit = Infinity;
        } else {
            out.baseMultiplierLimit = clampInt(out.baseMultiplierLimit, 4, 1, 12);
        }

        let timingIn = out.timing || {};
        let timingPresetCfg = TIMING_PRESETS[out.timingPreset] || null;
        if (timingPresetCfg) {
            if (timingPresetCfg.timingMode !== undefined) out.timingMode = timingPresetCfg.timingMode;
            if (timingPresetCfg.playShotClock !== undefined) timingIn.playShotClock = timingPresetCfg.playShotClock;
            if (timingPresetCfg.baseShotClock !== undefined) timingIn.baseShotClock = timingPresetCfg.baseShotClock;
            if (timingPresetCfg.bankTime !== undefined) timingIn.bankTime = timingPresetCfg.bankTime;
            if (timingPresetCfg.baseTimeIncrement !== undefined) timingIn.baseTimeIncrement = timingPresetCfg.baseTimeIncrement;
        }
        out.timing = {
            frameIntermittent: clampInt(timingIn.frameIntermittent, DEFAULT_TIMING.frameIntermittent, 1, 10),
            finalDeclareWindow: clampInt(timingIn.finalDeclareWindow, DEFAULT_TIMING.finalDeclareWindow, 1, 30),
            overbaseWindow: clampInt(timingIn.overbaseWindow, DEFAULT_TIMING.overbaseWindow, 1, 30),
            playShotClock: clampInt(timingIn.playShotClock, DEFAULT_TIMING.playShotClock, 1, 10),
            baseShotClock: clampInt(timingIn.baseShotClock, DEFAULT_TIMING.baseShotClock, 1, 60),
            bankTime: clampInt(timingIn.bankTime, DEFAULT_TIMING.bankTime, 10, 300),
            baseTimeIncrement: clampInt(timingIn.baseTimeIncrement, DEFAULT_TIMING.baseTimeIncrement, 1, 60),
        };

        const enumFields = {
            overbaseRestrictions: ['none', 'default'],
            failedMultiplayHandling: ['default', 'compensation'],
            scoringPreset: ['', 'traditional', 'traditional-power', '7-3-5', '8-4-4'],
            countingSystem: ['default', '7-3-5'],
            baseMultiplierScheme: ['limited', 'single-or-not', 'exponential', 'power'],
            levelsPreset: ['', 'default', 'high-school', 'slow', 'plain', 'short'],
            knockBackConditionMode: ['unlimited', 'singleT'],
            gameMode: ['endless', 'pass-A'],
            timingPreset: ['', 'normal', '180+30'],
            timingMode: ['shot + bank', 'bank-time-only'],
            levelConfiguration: ['default', 'plain', 'high-school'],
        };
        for (let key in enumFields) {
            if (!enumFields[key].includes(out[key])) {
                out[key] = enumFields[key][0];
            }
        }

        return out;
    }

    function resolveRuleConfig(input) {
        let presetName = (input && input.presetName && PRESETS[input.presetName]) ? input.presetName : 'default';
        let base = { ...PRESETS['default'], timing: { ...PRESETS['default'].timing } };
        if (presetName !== 'default') {
            let p = PRESETS[presetName];
            base = { ...base, ...p, timing: { ...base.timing, ...(p.timing || {}) } };
        }

        let overrides = (input && input.overrides) ? input.overrides : {};
        let merged = { ...base, ...overrides };
        merged.timing = { ...base.timing, ...(overrides.timing || {}) };

        let normalized = normalizeRuleConfig(merged);
        normalized.presetName = presetName;
        return normalized;
    }

    function resolveGameSettings(input) {
        let ruleConfig = resolveRuleConfig(input || {});
        let displaySettings = {
            placeholder: true,
            theme: 'default',
            cardSize: 'default',
        };
        if (input && input.displayOverrides) {
            displaySettings = { ...displaySettings, ...input.displayOverrides };
        }
        return {
            presetName: ruleConfig.presetName,
            ruleConfig,
            displaySettings,
        };
    }

    window.shengjiSettingsSchema = SCHEMA;
    window.shengjiSettingsPresets = PRESETS;
    window.shengjiScoringPresets = SCORING_PRESETS;
    window.shengjiLevelsPresets = LEVELS_PRESETS;
    window.shengjiTimingPresets = TIMING_PRESETS;
    
    // Helper: determine which levels preset (if any) matches the current config
    window.shengjiDetectLevelsPreset = function(cfg) {
        if (!cfg) return '';
        for (let presetName in LEVELS_PRESETS) {
            let preset = LEVELS_PRESETS[presetName];
            let matches = true;
            matches = matches && cfg.startLevel === preset.startLevel;
            matches = matches && cfg.gameMode === preset.gameMode;
            matches = matches && !!cfg.mustDefendStartMarker === !!preset.mustDefendStartMarker;
            matches = matches && !!cfg.mustStopStartMarker === !!preset.mustStopStartMarker;
            matches = matches && (cfg.knockBackConditionMode || 'unlimited') === (preset.knockBackConditionMode || 'unlimited');
            matches = matches && !!cfg.knockBackTakeStageRequired === !!preset.knockBackTakeStageRequired;
            // Compare level lists as sets so ordering differences do not affect equality.
            if (matches) {
                let sameSet = function(a, b) {
                    let aa = Array.isArray(a) ? a : [];
                    let bb = Array.isArray(b) ? b : [];
                    if (aa.length !== bb.length) return false;
                    let setA = new Set(aa);
                    return bb.every(x => setA.has(x));
                };
                matches = sameSet(cfg.mustDefendLevels, preset.mustDefendLevels)
                    && sameSet(cfg.mustStopLevels, preset.mustStopLevels)
                    && sameSet(cfg.knockBackLevels, preset.knockBackLevels);
            }
            if (matches) return presetName;
        }
        return '';  // (none) - custom/no preset
    };

    // Helper: determine which timing preset (if any) matches the current config.
    // Matching is mode-aware: hidden fields do not affect equality for a preset.
    window.shengjiDetectTimingPreset = function(cfg) {
        if (!cfg || !cfg.timing) return '';
        let timing = cfg.timing;

        // normal: shot+bank mode, compare visible shot/base/bank fields.
        if ((cfg.timingMode || '') === 'shot + bank') {
            if (
                timing.playShotClock === 5
                && timing.baseShotClock === 45
                && timing.bankTime === 60
            ) {
                return 'normal';
            }
        }

        // 180+30: bank-time-only mode, compare visible bank/increment fields.
        if ((cfg.timingMode || '') === 'bank-time-only') {
            if (
                timing.bankTime === 180
                && timing.baseTimeIncrement === 30
            ) {
                return '180+30';
            }
        }

        return '';
    };
    
    window.shengjiResolveGameRuleConfig = resolveRuleConfig;
    window.shengjiResolveGameSettings = resolveGameSettings;
})();
