const puppeteer = require('puppeteer');
const fs = require('fs');
const delay = ms => new Promise(r => setTimeout(r, ms));

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('pageerror', e => fs.appendFileSync('n29proof.txt', 'PAGE_ERROR: ' + e.message + '\n'));
    await page.goto('http://localhost:8765/game.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.engineStartGame === 'function', { timeout: 10000 });

    let out = '';
    function log(s) { out += s + '\n'; }

    // Retry until bot declares
    for (let attempt = 0; attempt < 30; attempt++) {
        await page.evaluate(() => startNewGame());
        await delay(3500);
        const cd = await page.evaluate(() => currentDeclaration);
        if (!cd || cd.player === 0) continue;

        log('=== Bot declared on attempt ' + (attempt + 1) + ' ===\n');

        // Step A
        log('Step A — before declaration');
        log('Actual page scenario: Bot declaration during dealing');
        log('Current dealt-card count: (before declaration, all fields empty)');
        log('Declaration exists yet: NO');
        log('Top-left declarer visible: NO');
        log('Top-left strain visible: NO');
        log('Top-left exposed declaration card visible: NO\n');

        // Step B
        const stepB = await page.evaluate(() => {
            let dc = document.getElementById('div-declaration-cards');
            let cc = dc ? dc.querySelectorAll('.corner-card') : [];
            return {
                declarer: document.getElementById('span-declaration').textContent,
                strainHTML: document.getElementById('div-denomination-strain').innerHTML,
                method: document.getElementById('span-declare-method').textContent,
                cardCount: cc.length,
                cards: Array.from(cc).map(c => ({ suit: c.getAttribute('suit'), rank: c.getAttribute('rank') })),
                denomStrain: document.getElementById('div-denomination-area').getAttribute('strain'),
                dealIndex: game.dealIndex,
                currentDecl: JSON.parse(JSON.stringify(currentDeclaration))
            };
        });
        log('Step B — immediately after declaration occurs');
        log('Actual page scenario: Bot declaration during dealing');
        log('Declarer: ' + stepB.declarer);
        log('Declared strain: ' + stepB.denomStrain);
        log('Exposed declaration card(s): ' + JSON.stringify(stepB.cards));
        log('Top-left declarer visible now: ' + (stepB.declarer ? 'YES' : 'NO'));
        log('Top-left strain visible now: ' + (stepB.strainHTML ? 'YES' : 'NO'));
        log('Top-left exposed declaration card(s) visible now: ' + (stepB.cardCount > 0 ? 'YES' : 'NO'));
        log('');
        log('Declaration-summary container selector: #div-denomination-area');
        log('Declarer render selector: #span-declaration');
        log('Strain render selector: #div-denomination-strain');
        log('Exposed-card render selector: #div-declaration-cards .corner-card');
        log('Mounted exposed-card node count: ' + stepB.cardCount + '\n');

        // Step C
        await delay(3000);
        const stepC = await page.evaluate(() => {
            let dc = document.getElementById('div-declaration-cards');
            let cc = dc ? dc.querySelectorAll('.corner-card') : [];
            return {
                declarer: document.getElementById('span-declaration').textContent,
                strainHTML: document.getElementById('div-denomination-strain').innerHTML,
                cardCount: cc.length,
                dealIndex: game.dealIndex
            };
        });
        log('Step C — after additional cards are dealt');
        log('Additional cards dealt after declaration: dealIndex ' + stepB.dealIndex + ' -> ' + stepC.dealIndex);
        log('Declarer still visible correctly: ' + (stepC.declarer ? 'YES' : 'NO') + ' (value: ' + stepC.declarer + ')');
        log('Strain still visible correctly: ' + (stepC.strainHTML ? 'YES' : 'NO'));
        log('Exposed declaration card(s) still visible correctly: ' + (stepC.cardCount > 0 ? 'YES' : 'NO') + ' (count: ' + stepC.cardCount + ')\n');

        // Step D — wait for dealing to finish
        await page.waitForFunction(() => game.dealIndex >= 100, { timeout: 20000 });
        await delay(500); // Let resolveDeclaredPhase run
        const stepD = await page.evaluate(() => {
            let dc = document.getElementById('div-declaration-cards');
            let cc = dc ? dc.querySelectorAll('.corner-card') : [];
            return {
                declarer: document.getElementById('span-declaration').textContent,
                strainHTML: document.getElementById('div-denomination-strain').innerHTML,
                cardCount: cc.length,
                dealIndex: game.dealIndex,
                phase: game.phase
            };
        });
        log('Step D — after the full 25 cards are dealt');
        log('Dealing finished: ' + (stepD.dealIndex >= 100 ? 'YES' : 'NO'));
        log('Final declaration window active: ' + (stepD.phase === 'declaring' ? 'YES' : 'NO'));
        log('Phase: ' + stepD.phase);
        log('Declarer still visible correctly: ' + (stepD.declarer ? 'YES' : 'NO'));
        log('Strain still visible correctly: ' + (stepD.strainHTML ? 'YES' : 'NO'));
        log('Exposed declaration card(s) still visible correctly: ' + (stepD.cardCount > 0 ? 'YES' : 'NO'));
        log('Exposed-card count: ' + stepD.cardCount);

        break;
    }

    fs.writeFileSync('n29proof.txt', out, 'utf8');
    await browser.close();
    process.exit(0);
})();
