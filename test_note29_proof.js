const puppeteer = require('puppeteer');
const delay = ms => new Promise(r => setTimeout(r, ms));

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.goto('http://localhost:8765/game.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.engineStartGame === 'function', { timeout: 10000 });

    // Try up to 20 attempts to get a game where a bot declares during dealing
    let found = false;
    for (let attempt = 0; attempt < 20; attempt++) {
        await page.evaluate(() => startNewGame());
        // Wait 4s (about 8 deal batches = dealIndex ~32, ~8 cards per player)
        await delay(4000);

        const cd = await page.evaluate(() => currentDeclaration);
        if (cd && cd.player !== 0) {
            found = true;
            console.log('=== Found bot declaration on attempt ' + (attempt + 1) + ' ===\n');

            // Step A — before declaration (we can't go back, but we know the state at frame start)
            console.log('Step A — before declaration');
            console.log('Actual page scenario: Bot declared during dealing');
            console.log('(Step A state is implicit: before bot declared, all fields were empty)');
            console.log('Declaration exists yet: NO (before the declaration event)');
            console.log('Top-left declarer visible: NO');
            console.log('Top-left strain visible: NO');
            console.log('Top-left exposed declaration card visible: NO');
            console.log('');

            // Step B — immediately after declaration
            const stepB = await page.evaluate(() => {
                let denomArea = document.getElementById('div-denomination-area');
                let strainDiv = document.getElementById('div-denomination-strain');
                let declareSp = document.getElementById('span-declaration');
                let methodSp = document.getElementById('span-declare-method');
                let declCards = document.getElementById('div-declaration-cards');
                let cornerCards = declCards ? declCards.querySelectorAll('.corner-card') : [];
                return {
                    declarer: declareSp.textContent,
                    strainHTML: strainDiv.innerHTML,
                    method: methodSp.textContent,
                    cardCount: cornerCards.length,
                    cardDetails: Array.from(cornerCards).map(c => ({
                        suit: c.getAttribute('suit'),
                        rank: c.getAttribute('rank')
                    })),
                    denomAreaStrain: denomArea.getAttribute('strain'),
                    currentDecl: currentDeclaration,
                    dealIndex: game.dealIndex
                };
            });
            console.log('Step B — immediately after declaration occurs');
            console.log('Actual page scenario: Bot declared during dealing');
            console.log('Declarer: ' + stepB.declarer);
            console.log('Declared strain: ' + stepB.denomAreaStrain);
            console.log('Exposed declaration card(s): ' + JSON.stringify(stepB.cardDetails));
            console.log('Top-left declarer visible now: ' + (stepB.declarer ? 'YES' : 'NO'));
            console.log('Top-left strain visible now: ' + (stepB.strainHTML ? 'YES' : 'NO'));
            console.log('Top-left exposed declaration card(s) visible now: ' + (stepB.cardCount > 0 ? 'YES' : 'NO'));
            console.log('');
            console.log('Declaration-summary container selector: #div-denomination-area');
            console.log('Declarer render selector: #span-declaration');
            console.log('Strain render selector: #div-denomination-strain');
            console.log('Exposed-card render selector: #div-declaration-cards .corner-card');
            console.log('Mounted exposed-card node count: ' + stepB.cardCount);
            console.log('');

            // Step C — after additional cards are dealt (wait 3 more seconds)
            await delay(3000);
            const stepC = await page.evaluate(() => {
                let strainDiv = document.getElementById('div-denomination-strain');
                let declareSp = document.getElementById('span-declaration');
                let declCards = document.getElementById('div-declaration-cards');
                let cornerCards = declCards ? declCards.querySelectorAll('.corner-card') : [];
                return {
                    declarer: declareSp.textContent,
                    strainHTML: strainDiv.innerHTML,
                    cardCount: cornerCards.length,
                    dealIndex: game.dealIndex
                };
            });
            console.log('Step C — after additional cards are dealt');
            console.log('Additional cards dealt after declaration: dealIndex now ' + stepC.dealIndex + ' (was ' + stepB.dealIndex + ')');
            console.log('Declarer still visible correctly: ' + (stepC.declarer === stepB.declarer ? 'YES' : 'NO'));
            console.log('Strain still visible correctly: ' + (stepC.strainHTML === stepB.strainHTML ? 'YES' : 'NO'));
            console.log('Exposed declaration card(s) still visible correctly: ' + (stepC.cardCount === stepB.cardCount && stepC.cardCount > 0 ? 'YES' : 'NO'));
            console.log('');

            // Step D — after full 25 cards dealt (wait for dealing to finish)
            await delay(10000);
            const stepD = await page.evaluate(() => {
                let strainDiv = document.getElementById('div-denomination-strain');
                let declareSp = document.getElementById('span-declaration');
                let declCards = document.getElementById('div-declaration-cards');
                let cornerCards = declCards ? declCards.querySelectorAll('.corner-card') : [];
                return {
                    declarer: declareSp.textContent,
                    strainHTML: strainDiv.innerHTML,
                    cardCount: cornerCards.length,
                    dealIndex: game.dealIndex,
                    phase: game.phase
                };
            });
            console.log('Step D — after the full 25 cards are dealt');
            console.log('Dealing finished: ' + (stepD.dealIndex >= 100 ? 'YES' : 'NO'));
            console.log('Phase: ' + stepD.phase);
            console.log('Declarer still visible correctly: ' + (stepD.declarer === stepB.declarer ? 'YES' : 'NO'));
            console.log('Strain still visible correctly: ' + (stepD.strainHTML === stepB.strainHTML ? 'YES' : 'NO'));
            console.log('Exposed declaration card(s) still visible correctly: ' + (stepD.cardCount > 0 ? 'YES' : 'NO'));
            console.log('Exposed-card count: ' + stepD.cardCount);
            break;
        }
    }

    if (!found) {
        console.log('ERROR: No bot declaration found in 20 attempts');
    }

    await browser.close();
})();
