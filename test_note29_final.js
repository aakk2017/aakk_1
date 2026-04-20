const puppeteer = require('puppeteer');
const fs = require('fs');
const delay = ms => new Promise(r => setTimeout(r, ms));
let out = '';
function log(s) { out += s + '\n'; process.stdout.write(s + '\n'); }

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('pageerror', e => log('PAGE_ERROR: ' + e.message));
    await page.goto('http://localhost:8765/game.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.engineStartGame === 'function', { timeout: 10000 });

    for (let attempt = 0; attempt < 30; attempt++) {
        await page.evaluate(() => startNewGame());
        await delay(3500);
        const cd = await page.evaluate(() => currentDeclaration);
        if (!cd || cd.player === 0) continue;

        log('=== Bot declared on attempt ' + (attempt + 1) + ' ===');

        // Step B
        const stepB = await page.evaluate(() => {
            let dc = document.getElementById('div-declaration-cards');
            let cc = dc ? dc.querySelectorAll('.corner-card') : [];
            return {
                declarer: document.getElementById('span-declaration').textContent,
                strainHTML: document.getElementById('div-denomination-strain').innerHTML,
                cardCount: cc.length,
                cards: Array.from(cc).map(c => c.getAttribute('suit') + c.getAttribute('rank')),
                dealIndex: game.dealIndex,
                denomStrain: document.getElementById('div-denomination-area').getAttribute('strain')
            };
        });
        log('\nStep B — immediately after declaration:');
        log('Declarer: ' + stepB.declarer);
        log('Strain attr: ' + stepB.denomStrain);
        log('Strain HTML: ' + stepB.strainHTML);
        log('Exposed cards: ' + stepB.cards.join(', '));
        log('Card count: ' + stepB.cardCount);
        log('Deal index: ' + stepB.dealIndex);

        // Step C — wait 3s more
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
        log('\nStep C — after more cards dealt (dealIndex ' + stepB.dealIndex + ' -> ' + stepC.dealIndex + '):');
        log('Declarer still correct: ' + (stepC.declarer === stepB.declarer ? 'YES' : 'NO'));
        log('Strain still correct: ' + (stepC.strainHTML === stepB.strainHTML ? 'YES' : 'NO'));
        log('Cards still present: ' + (stepC.cardCount === stepB.cardCount ? 'YES' : 'NO') + ' (count=' + stepC.cardCount + ')');

        // Step D — wait for dealing to finish (need ~12.5s total from start, we've used ~6.5s)
        await delay(8000);
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
        log('\nStep D — after dealing finishes:');
        log('Deal index: ' + stepD.dealIndex + ' (100=all dealt)');
        log('Phase: ' + stepD.phase);
        log('Declarer still correct: ' + (stepD.declarer === stepB.declarer ? 'YES' : 'NO'));
        log('Strain still correct: ' + (stepD.strainHTML === stepB.strainHTML ? 'YES' : 'NO'));
        log('Cards still present: ' + (stepD.cardCount > 0 ? 'YES' : 'NO') + ' (count=' + stepD.cardCount + ')');

        break;
    }

    fs.writeFileSync('note29_proof_output.txt', out);
    await browser.close();
})();
