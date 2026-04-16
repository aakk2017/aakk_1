/**
 * i18n/index.js — Central message lookup
 *
 * Usage:
 *   t('errors.selectCards')
 *   t('phase.follow', { volume: 3 })
 *   t('log.declare', { playerName: '东 (Bot)', strain: 'S' })
 *
 * Language switching:
 *   setLocale('en')        // switches to English
 *   setLocale('zh-CN')     // switches to Chinese (default)
 */

const _i18nLocales = {
    'zh-CN': messages_zhCN,
    'en':    messages_en,
};

let _i18nCurrent = 'zh-CN';

function setLocale(locale) {
    if (_i18nLocales[locale]) {
        _i18nCurrent = locale;
    }
}

function getLocale() {
    return _i18nCurrent;
}

/**
 * Look up a message by dot-separated key, with optional interpolation.
 *
 * @param {string} key  – e.g. 'errors.selectCards'
 * @param {Object} [params] – e.g. { volume: 3 }
 * @returns {string}
 */
function t(key, params) {
    let dict = _i18nLocales[_i18nCurrent];
    let val = _resolveKey(dict, key);

    // Fallback to zh-CN if current locale is missing the key
    if (val === undefined && _i18nCurrent !== 'zh-CN') {
        val = _resolveKey(_i18nLocales['zh-CN'], key);
    }

    if (val === undefined) {
        console.warn('[i18n] Missing key: ' + key);
        return '{' + key + '}';
    }

    if (params) {
        for (let k in params) {
            val = val.split('{' + k + '}').join(String(params[k]));
        }
    }

    return val;
}

function _resolveKey(dict, key) {
    let parts = key.split('.');
    let obj = dict;
    for (let i = 0; i < parts.length; i++) {
        if (obj == null) return undefined;
        obj = obj[parts[i]];
    }
    return (typeof obj === 'string') ? obj : undefined;
}

/**
 * Apply i18n to all elements with data-i18n or data-i18n-title attributes.
 * Call after DOM is ready or after locale change.
 */
function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        let key = el.getAttribute('data-i18n');
        let val = t(key);
        if (el.tagName === 'TITLE') {
            document.title = val;
        } else {
            el.textContent = val;
        }
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        let key = el.getAttribute('data-i18n-title');
        el.title = t(key);
    });
}
