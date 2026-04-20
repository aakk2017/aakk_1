/**
 * Note 29 — Declaration Display Bug — Diagnostic
 */
const puppeteer = require('puppeteer');
const delay = ms => new Promise(r => setTimeout(r, ms));

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => {});
    page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

    await page.goto('http://localhost:8765/game.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.engineStartGame === 'function', { timeout: 10000 });

    // Step A: Before declaration — check initial state
    const stepA = await page.evaluate(() => {
        return {
            levelText: document.getElementById('div-denomination-level').textContent,
            strainHTML: document.getElementById('div-denomination-strain').innerHTML,
            declarerText: document.getElementById('span-declaration').textContent,
            methodText: document.getElementById('span-declare-method').textContent,
            denomAreaStrain: document.getElementById('div-denomination-area').getAttribute('strain'),
            phase: typeof game !== 'undefined' ? game.phase : 'N/A'
        };
    });
    console.log('=== Step A: Before any game starts ===');
    console.log(JSON.stringify(stepA, null, 2));

    // Start a game
    await page.evaluate(() => {
        startNewGame();
    });

    // Wait for dealing to begin (the frame intermittent is 2s)
    await delay(2500);

    const stepA2 = await page.evaluate(() => {
        return {
            phase: game.phase,
            dealIndex: game.dealIndex,
            levelText: document.getElementById('div-denomination-level').textContent,
            strainHTML: document.getElementById('div-denomination-strain').innerHTML,
            declarerText: document.getElementById('span-declaration').textContent,
            methodText: document.getElementById('span-declare-method').textContent,
            denomAreaStrain: document.getElementById('div-denomination-area').getAttribute('strain'),
            currentDeclaration: typeof currentDeclaration !== 'undefined' ? currentDeclaration : 'N/A'
        };
    });
    console.log('\n=== Step A2: During dealing, before any declaration ===');
    console.log(JSON.stringify(stepA2, null, 2));

    // Wait for a bot to declare (keep polling)
    let declFound = false;
    for (let i = 0; i < 30; i++) {
        await delay(600);
        const check = await page.evaluate(() => {
            return {
                currentDeclaration: typeof currentDeclaration !== 'undefined' ? currentDeclaration : null,
                phase: game.phase,
                dealIndex: game.dealIndex
            };
        });
        if (check.currentDeclaration) {
            declFound = true;
            break;
        }
        if (check.phase !== 1) { // GamePhase.DEALING = 1
            break;
        }
    }

    if (!declFound) {
        // Force a declaration by calling executeDeclaration from page context
        console.log('\nNo bot declared naturally, forcing human declaration...');
        await page.evaluate(() => {
            // Check if human has a level card to declare
            let level = game.level;
            let hand = game.hands[0]; // human player
            let levelCards = hand.filter(c => c.rank === level);
            if (levelCards.length > 0) {
                executeDeclaration(levelCards[0].suit, 1);
            } else {
                // Just force a declaration for testing
                executeDeclaration(0, 1); // diamonds single
            }
        });
    }

    // Step B: Immediately after declaration
    const stepB = await page.evaluate(() => {
        return {
            phase: game.phase,
            dealIndex: game.dealIndex,
            currentDeclaration: typeof currentDeclaration !== 'undefined' ? currentDeclaration : null,
            levelText: document.getElementById('div-denomination-level').textContent,
            strainHTML: document.getElementById('div-denomination-strain').innerHTML,
            declarerText: document.getElementById('span-declaration').textContent,
            methodText: document.getElementById('span-declare-method').textContent,
            denomAreaStrain: document.getElementById('div-denomination-area').getAttribute('strain'),
            strainVisible: document.getElementById('div-denomination-strain').innerHTML.length > 0,
            declarerVisible: document.getElementById('span-declaration').textContent.length > 0
        };
    });
    console.log('\n=== Step B: Immediately after declaration ===');
    console.log(JSON.stringify(stepB, null, 2));

    // Step C: Wait for more cards to be dealt
    await delay(3000);
    const stepC = await page.evaluate(() => {
        return {
            phase: game.phase,
            dealIndex: game.dealIndex,
            currentDeclaration: typeof currentDeclaration !== 'undefined' ? currentDeclaration : null,
            levelText: document.getElementById('div-denomination-level').textContent,
            strainHTML: document.getElementById('div-denomination-strain').innerHTML,
            declarerText: document.getElementById('span-declaration').textContent,
            methodText: document.getElementById('span-declare-method').textContent,
            denomAreaStrain: document.getElementById('div-denomination-area').getAttribute('strain'),
            strainVisible: document.getElementById('div-denomination-strain').innerHTML.length > 0,
            declarerVisible: document.getElementById('span-declaration').textContent.length > 0
        };
    });
    console.log('\n=== Step C: After additional cards dealt ===');
    console.log(JSON.stringify(stepC, null, 2));

    // Step D: After dealing finishes
    await delay(15000);
    const stepD = await page.evaluate(() => {
        return {
            phase: game.phase,
            dealIndex: game.dealIndex,
            currentDeclaration: typeof currentDeclaration !== 'undefined' ? currentDeclaration : null,
            levelText: document.getElementById('div-denomination-level').textContent,
            strainHTML: document.getElementById('div-denomination-strain').innerHTML,
            declarerText: document.getElementById('span-declaration').textContent,
            methodText: document.getElementById('span-declare-method').textContent,
            denomAreaStrain: document.getElementById('div-denomination-area').getAttribute('strain'),
            strainVisible: document.getElementById('div-denomination-strain').innerHTML.length > 0,
            declarerVisible: document.getElementById('span-declaration').textContent.length > 0
        };
    });
    console.log('\n=== Step D: After dealing finished ===');
    console.log(JSON.stringify(stepD, null, 2));

    await browser.close();
    console.log('\nDiagnostic complete.');
})();
