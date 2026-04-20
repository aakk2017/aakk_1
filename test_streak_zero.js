const puppeteer = require('puppeteer');
(async () => {
    const b = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const p = await b.newPage();
    await p.goto('http://localhost:8765/game.html', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof window.engineStartGame === 'function', { timeout: 10000 });
    const r = await p.evaluate(() => {
        engineStartGame(0, 0, [0, 0, 0, 0], false);
        while (engineDealNextBatch() !== null) {}
        engineSetStrain(0);
        enginePickUpBase();
        engineSetTeams();
        attackersStreak = 0;
        updateAttackersStreakDisplay();
        let h2 = document.getElementById('div-hint-2');
        return { text: h2.textContent, isEmpty: h2.textContent === '' || h2.textContent.trim() === '' };
    });
    console.log('streak=0 display: "' + r.text + '"');
    console.log('is blank/empty: ' + r.isEmpty);
    console.log(r.isEmpty ? 'FAIL: blank when zero' : 'PASS: shows streak=0 text');
    await b.close();
    process.exit(r.isEmpty ? 1 : 0);
})();
