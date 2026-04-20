const puppeteer = require('puppeteer');
const delay = ms => new Promise(r => setTimeout(r, ms));

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('pageerror', e => process.stdout.write('PAGE_ERR: ' + e.message + '\n'));

    await page.goto('http://localhost:8765/game.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.engineStartGame === 'function', { timeout: 10000 });
    process.stdout.write('Page loaded\n');

    await page.evaluate(() => startNewGame());
    process.stdout.write('Game started\n');

    // Wait for intermittent (2s) + some dealing ticks
    await delay(4000);
    process.stdout.write('4s elapsed\n');

    // Force a declaration mid-dealing
    const preDecl = await page.evaluate(() => {
        let hand = game.hands[0];
        let level = game.level;
        let levelCards = hand.filter(c => c.rank === level);
        return { dealIdx: game.dealIndex, phase: game.phase, levelCardsCount: levelCards.length, levelCardSuit: levelCards.length > 0 ? levelCards[0].suit : -1 };
    });
    process.stdout.write('Pre-decl: ' + JSON.stringify(preDecl) + '\n');

    if (preDecl.levelCardSuit >= 0) {
        await page.evaluate((suit) => executeDeclaration(suit, 1), preDecl.levelCardSuit);
    } else {
        // Force — just use suit 0
        await page.evaluate(() => executeDeclaration(0, 1));
    }
    process.stdout.write('Declaration executed\n');

    // Check immediately
    const postDecl = await page.evaluate(() => ({
        cd: currentDeclaration,
        strainHTML: document.getElementById('div-denomination-strain').innerHTML,
        declarer: document.getElementById('span-declaration').textContent,
        method: document.getElementById('span-declare-method').textContent,
        denomStrain: document.getElementById('div-denomination-area').getAttribute('strain')
    }));
    process.stdout.write('Post-decl: ' + JSON.stringify(postDecl) + '\n');

    // Wait for dealing to finish (25 batches × 500ms = 12.5s from deal start)
    // We're currently ~4s into the game, so need ~11s more
    await delay(12000);
    process.stdout.write('12s more elapsed\n');

    const afterDealPhase = await page.evaluate(() => game.phase);
    process.stdout.write('Phase now: ' + afterDealPhase + '\n');

    const afterDeal = await page.evaluate(() => ({
        phase: game.phase,
        dealIdx: game.dealIndex,
        strainHTML: document.getElementById('div-denomination-strain').innerHTML,
        declarer: document.getElementById('span-declaration').textContent,
        method: document.getElementById('span-declare-method').textContent,
        denomStrain: document.getElementById('div-denomination-area').getAttribute('strain')
    }));
    process.stdout.write('After deal finish: ' + JSON.stringify(afterDeal) + '\n');

    await browser.close();
    process.stdout.write('Done\n');
})().catch(e => {
    process.stderr.write('FATAL: ' + e.message + '\n');
    process.exit(1);
});
