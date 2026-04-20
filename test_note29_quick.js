const puppeteer = require('puppeteer');
const delay = ms => new Promise(r => setTimeout(r, ms));

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    let pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));

    await page.goto('http://localhost:8765/game.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.engineStartGame === 'function', { timeout: 10000 });
    console.log('Page loaded');

    await page.evaluate(() => startNewGame());
    console.log('Game started');

    // Wait for intermittent + some dealing
    await delay(4000);

    // Check dealing state
    const state1 = await page.evaluate(() => ({
        phase: game.phase,
        dealIdx: game.dealIndex,
        handSize: game.hands[0].length,
        levelCards: game.hands[0].filter(c => c.rank === game.level).map(c => c.suit)
    }));
    console.log('State after 4s:', JSON.stringify(state1));

    // Force declaration
    const declSuit = state1.levelCards.length > 0 ? state1.levelCards[0] : 0;
    await page.evaluate((s) => executeDeclaration(s, 1), declSuit);
    console.log('Declared suit:', declSuit);

    // Immediate check
    const state2 = await page.evaluate(() => ({
        strainHTML: document.getElementById('div-denomination-strain').innerHTML,
        declarer: document.getElementById('span-declaration').textContent,
        method: document.getElementById('span-declare-method').textContent,
        deskCards: document.querySelectorAll('.desk-card').length
    }));
    console.log('After declaration:', JSON.stringify(state2));

    // Wait 2 more ticks
    await delay(1500);
    const state3 = await page.evaluate(() => ({
        dealIdx: game.dealIndex,
        strainHTML: document.getElementById('div-denomination-strain').innerHTML,
        declarer: document.getElementById('span-declaration').textContent,
        method: document.getElementById('span-declare-method').textContent,
        deskCards: document.querySelectorAll('.desk-card').length
    }));
    console.log('After 2 more ticks:', JSON.stringify(state3));

    // The exposed declaration card — is it displayed?
    const deskState = await page.evaluate(() => {
        let deskArea = document.getElementById('desk');
        let cards = deskArea ? deskArea.querySelectorAll('.card') : [];
        return {
            deskHTML: deskArea ? deskArea.innerHTML.substring(0, 500) : 'NO DESK',
            cardCount: cards.length,
            cardClasses: Array.from(cards).map(c => c.className).slice(0, 5)
        };
    });
    console.log('Desk state:', JSON.stringify(deskState));

    if (pageErrors.length > 0) {
        console.log('Page errors:', pageErrors.slice(0, 3));
    }

    await browser.close();
    console.log('Done');
})().catch(e => {
    console.error('FATAL:', e.message);
    process.exit(1);
});
