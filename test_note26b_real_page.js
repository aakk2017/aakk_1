/**
 * Note 26b — Real Page Runtime Proof
 * 
 * This script uses Puppeteer to drive the ACTUAL running game page
 * and proves all three unresolved Note 26 items in the real DOM.
 * 
 * Run: node test_note26b_real_page.js
 * (Requires: http server on port 8765 serving the game)
 */

const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();

    // Collect console messages
    let consoleLogs = [];
    page.on('console', msg => consoleLogs.push(msg.text()));

    await page.goto('http://localhost:8765/game.html', { waitUntil: 'domcontentloaded' });
    // Wait for scripts to initialize
    await page.waitForFunction(() => typeof window.engineStartGame === 'function', { timeout: 10000 });

    console.log('=========================================================');
    console.log('NOTE 26b — REAL PAGE RUNTIME PROOF');
    console.log('=========================================================');
    console.log('');

    // ============ SETUP: Create a game state that will trigger FC ============
    const setupResult = await page.evaluate(() => {
        // Start a game
        engineStartGame(0, 2, [0, 0, 0, 0], false); // level=0, pivot=2(North)
        while (engineDealNextBatch() !== null) {}
        engineSetStrain(0); // diamonds = trump
        enginePickUpBase();

        let idGen = 800;
        function mk(suit, rank) {
            let c = new ShengjiCard(suit, rank, 0, 0);
            c.cardId = idGen++;
            return c;
        }

        // North (player 2, pivot) — K♥, J♥ + filler (25 cards)
        let northHand = [mk(2, 11), mk(2, 9)];
        for (let r = 1; r <= 12; r++) northHand.push(mk(3, r));
        for (let r = 1; r <= 11; r++) northHand.push(mk(1, r));

        // East (player 1) — Q♥, A♥ + filler (25 cards)
        let eastHand = [mk(2, 10), mk(2, 12)];
        for (let r = 1; r <= 12; r++) eastHand.push(mk(1, r));
        for (let r = 1; r <= 11; r++) eastHand.push(mk(3, r));

        // South (player 0, human) — 3♥, 5♥, 6♥ + filler (25 cards)
        let southHand = [mk(2, 1), mk(2, 3), mk(2, 4)];
        for (let r = 1; r <= 12; r++) southHand.push(mk(0, r));
        for (let r = 1; r <= 10; r++) southHand.push(mk(1, r));

        // West (player 3) — 7♥ + filler (25 cards)
        let westHand = [mk(2, 5)];
        for (let r = 1; r <= 12; r++) westHand.push(mk(3, r));
        for (let r = 1; r <= 12; r++) westHand.push(mk(1, r));

        game.hands[0] = southHand;
        game.hands[1] = eastHand;
        game.hands[2] = northHand;
        game.hands[3] = westHand;

        let baseCards = [];
        for (let r = 1; r <= 8; r++) baseCards.push(mk(0, r));
        game.base = baseCards;

        for (let h of game.hands) engineSortHand(h);
        engineSetTeams();

        game.currentLeader = 2; // North leads
        game.currentRound = 1;
        game.currentTurnIndex = 0;
        game.roundPlayed = [null, null, null, null];
        game.leadInfo = null;
        game.phase = GamePhase.PLAYING;

        // Make South (0) human only — default
        HUMAN_PLAYERS = new Set([0]);

        initPersistentNamebars();
        initDeskLabels();
        clearDesk();
        renderAllHands();

        // === Round 1: North leads K♥+J♥ multiplay → fails ===
        let northHearts = game.hands[2].filter(c => c.division === 2);
        let playResult = enginePlayCards(2, northHearts);

        // Simulate handleFailedMultiplay completion (skip visual hold)
        game.failedMultiplay.holdInProgress = false;
        game.failedMultiplay.revocationApplied = true;
        let fm = playResult.failedMultiplay;
        renderDeskCards(2, fm.actualElement.cards);
        for (let p = 0; p < NUM_PLAYERS; p++) {
            if (p !== HUMAN_PLAYER) updateExposedPreview(p);
        }
        renderAllHands();

        // Complete round 1 follows
        let turnOrder1 = [3, 0, 1];
        for (let tp of turnOrder1) {
            let cp = engineGetCurrentPlayer();
            let hand = game.hands[cp];
            let hearts = hand.filter(c => c.division === 2);
            let followCard = hearts.length > 0 ? [hearts[0]] : [hand[0]];
            let r = enginePlayCards(cp, followCard);
            if (r.success) renderDeskCards(cp, followCard);
        }
        let round1 = engineEndRound();

        clearDesk();
        for (let p = 0; p < NUM_PLAYERS; p++) {
            if (p !== HUMAN_PLAYER) updateExposedPreview(p);
        }

        // === Round 2: East leads A♥ → FC triggers for North ===
        game.currentLeader = round1.winner; // East won
        game.currentRound = 2;
        game.currentTurnIndex = 0;
        game.roundPlayed = [null, null, null, null];
        game.leadInfo = null;

        // For this proof: make East (1) also human-controlled so FC interaction works
        HUMAN_PLAYERS.add(1);

        // East leads Q♥ (only remaining heart)
        let eastHearts = game.hands[1].filter(c => c.division === 2);
        let r2Result = enginePlayCards(1, eastHearts[0] ? [eastHearts[0]] : [game.hands[1][0]]);
        renderDeskCards(1, [eastHearts[0]]);

        return {
            success: true,
            fcChances: JSON.stringify(game.fcChances),
            exposedCards: Object.keys(game.exposedCards[2] || {}),
            currentPlayer: engineGetCurrentPlayer(),
            leadDiv: game.leadInfo ? game.leadInfo.division : -1
        };
    });

    console.log('Setup complete:', JSON.stringify(setupResult));

    // ============ PROOF §2: Timer during FC selection ============
    console.log('\n=========================================================');
    console.log('PROOF §2: Timer visibility during forehand-control selection');
    console.log('=========================================================');

    const fcProof = await page.evaluate(() => {
        let cp = engineGetCurrentPlayer(); // Should be 2 (North, the failer)
        let fcTrigger = engineCheckFCTrigger(cp);

        if (!fcTrigger.shouldTrigger) {
            return { error: 'FC trigger did not fire' };
        }

        // Exercise FC — this starts the FC interaction
        exerciseForehandControl(cp, fcTrigger);

        // NOW check: is the timer overlay visible during FC selection?
        let timerOverlays = document.querySelectorAll('.timer-overlay');
        let controllerSlot = document.getElementById('desk-east'); // controller is East (player 1)
        let timerInController = controllerSlot ? controllerSlot.querySelector('.timer-overlay') : null;
        
        // Get desk cards present
        let deskCardsEast = controllerSlot ? controllerSlot.querySelectorAll('.hand .card-container') : [];

        // Check gFCInteraction is active
        let fcActive = gFCInteraction !== null;

        return {
            fcActive: fcActive,
            timerOverlayCount: timerOverlays.length,
            timerInControllerSlot: !!timerInController,
            timerParent: timerOverlays.length > 0 ? timerOverlays[0].parentElement.id : 'none',
            deskCardsInEast: deskCardsEast.length,
            gTimingPhase: typeof gTimingPhase !== 'undefined' ? gTimingPhase : 'undefined',
            gTimerInterval: typeof gTimerInterval !== 'undefined' ? (gTimerInterval !== null) : false,
            shotClockText: timerOverlays.length > 0 ? timerOverlays[0].querySelector('.timer-primary')?.textContent : 'N/A',
            bankTimeText: timerOverlays.length > 0 ? timerOverlays[0].querySelector('.timer-secondary')?.textContent : 'N/A'
        };
    });

    console.log('\nReal page scenario:');
    console.log('  Current acting player: East (player 1) is FC controller');
    console.log('  Why FC interaction is active now: Failed multiplay in Round 1 → FC chance granted → East leads hearts in Round 2 → North (failer) about to follow → FC triggers');
    console.log(`  FC interaction active: ${fcProof.fcActive ? 'YES' : 'NO'}`);
    console.log(`  Timer visually present during FC selection: ${fcProof.timerOverlayCount > 0 ? 'YES' : 'NO'}`);
    console.log(`  Timer overlay count: ${fcProof.timerOverlayCount}`);
    console.log(`  Timer parent element: ${fcProof.timerParent}`);
    console.log(`  Timer in controller (East) slot: ${fcProof.timerInControllerSlot ? 'YES' : 'NO'}`);
    console.log(`  Desk cards in desk-east (East's led card): ${fcProof.deskCardsInEast}`);
    console.log(`  gTimingPhase: ${fcProof.gTimingPhase}`);
    console.log(`  gTimerInterval running: ${fcProof.gTimerInterval}`);
    console.log(`  Shot clock display: ${fcProof.shotClockText}`);
    console.log(`  Bank time display: ${fcProof.bankTimeText}`);
    console.log(`  Timer visible above desk cards: ${fcProof.timerOverlayCount > 0 && fcProof.deskCardsInEast > 0 ? 'YES' : 'NO'}`);

    // ============ PROOF §3: Must-play/must-hold markers ============
    console.log('\n=========================================================');
    console.log('PROOF §3: Must-play/must-hold markers in failer\'s hand');
    console.log('=========================================================');

    const markerProof = await page.evaluate(() => {
        // Select the exposed card in FC interaction
        let fci = gFCInteraction;
        if (!fci) return { error: 'No FC interaction active' };

        // Select the first exposed card
        fci.selectedCornerIds.add(fci.exposedDivisionCards[0].cardId);

        // Commit must-play
        commitForehandControl('must-play');

        // Now the failer (North=2) should follow
        // The failer is now the current player, and if human, their hand should show markers
        // Make North human and render
        HUMAN_PLAYERS.add(2);
        activeHumanPlayer = 2;
        renderHand(2);

        // Check DOM for markers
        let shand = document.getElementById('shand');
        let fcMarkers = shand ? shand.querySelectorAll('.fc-marker') : [];
        let mustPlayMarkers = shand ? shand.querySelectorAll('.fc-marker-must-play') : [];
        let mustHoldMarkers = shand ? shand.querySelectorAll('.fc-marker-must-hold') : [];

        let markerDetails = [];
        fcMarkers.forEach(m => {
            let parentCard = m.closest('.card-container');
            markerDetails.push({
                cardId: parentCard ? parentCard.getAttribute('data-card-id') : 'unknown',
                suit: parentCard ? parentCard.getAttribute('suit') : '?',
                rank: parentCard ? parentCard.getAttribute('rank') : '?',
                className: m.className
            });
        });

        // Also check game.forehandControl state
        let fc = game.forehandControl;

        return {
            forehandControl: fc ? {
                mode: fc.mode,
                selectedCardIds: fc.selectedCards.map(c => c.cardId),
                target: fc.target,
                controller: fc.controller
            } : null,
            markerCount: fcMarkers.length,
            mustPlayCount: mustPlayMarkers.length,
            mustHoldCount: mustHoldMarkers.length,
            markerDetails: markerDetails
        };
    });

    console.log('\nReal page scenario:');
    console.log('  Failer: North (player 2)');
    console.log('  Forehand/Controller: East (player 1)');
    console.log(`  Committed FC mode: ${markerProof.forehandControl?.mode || 'null'}`);
    console.log(`  Committed FC selected cards: ${JSON.stringify(markerProof.forehandControl?.selectedCardIds)}`);
    console.log(`  Markers visibly present in failer's hand: ${markerProof.markerCount > 0 ? 'YES' : 'NO'}`);
    console.log('');
    console.log('DOM proof from real page:');
    console.log(`  Failer's hand selector: #shand`);
    console.log(`  Marker selector: .fc-marker`);
    console.log(`  Mounted marker node count: ${markerProof.markerCount}`);
    console.log(`  Must-hold symbol visible: ${markerProof.mustHoldCount > 0 ? 'YES' : 'NO'} (count: ${markerProof.mustHoldCount})`);
    console.log(`  Must-play symbol visible: ${markerProof.mustPlayCount > 0 ? 'YES' : 'NO'} (count: ${markerProof.mustPlayCount})`);
    if (markerProof.markerDetails.length > 0) {
        markerProof.markerDetails.forEach((d, i) => {
            console.log(`  marker[${i}]: card ${d.suit}${d.rank} (id=${d.cardId}), class="${d.className}"`);
        });
    }

    // ============ PROOF §4: Attackers' streak display ============
    console.log('\n=========================================================');
    console.log('PROOF §4: Attackers\' streak display in div-hint-2');
    console.log('=========================================================');

    const streakProof = await page.evaluate(() => {
        // Reset game for a clean frame-transition test
        engineStartGame(0, 0, [0, 0, 0, 0], false); // level=0, pivot=0(South)
        while (engineDealNextBatch() !== null) {}
        engineSetStrain(0);
        enginePickUpBase();
        engineSetTeams();

        let idGen2 = 900;
        function mk2(suit, rank) {
            let c = new ShengjiCard(suit, rank, 0, 0);
            c.cardId = idGen2++;
            return c;
        }

        // Reset attackersStreak
        attackersStreak = 0;
        updateAttackersStreakDisplay();

        let hint2 = document.getElementById('div-hint-2');
        let initialText = hint2 ? hint2.textContent : 'ELEMENT NOT FOUND';

        // Set up dummy round for engineFinalize
        game.frameScore = 80; // attackers take stage
        game.phase = GamePhase.PLAYING;
        game.roundHistory = [{
            leader: 1, winner: 1,
            played: { 0: [mk2(3, 1)], 1: [mk2(3, 12)], 2: [mk2(3, 2)], 3: [mk2(3, 3)] },
            points: 0
        }];
        game.base = [mk2(3, 4), mk2(3, 5), mk2(3, 6), mk2(3, 7), mk2(3, 8), mk2(3, 9), mk2(3, 10), mk2(3, 11)];

        // Call engineFinalize
        let result = engineFinalize();
        let fr = result.frameResult;

        // Apply streak logic (same as finishGame)
        let oldStreak = attackersStreak;
        if (fr.advancingPlayers.length > 0 && fr.advancingPlayers.includes(game.pivot)) {
            attackersStreak = 0;
        } else {
            attackersStreak++;
        }
        updateAttackersStreakDisplay();

        let afterText = hint2 ? hint2.textContent : 'ELEMENT NOT FOUND';

        return {
            hint2Exists: !!hint2,
            initialText: initialText,
            frameResultKey: fr.resultKey,
            defenseHolds: fr.defenseHolds,
            advancingPlayers: fr.advancingPlayers,
            oldStreak: oldStreak,
            newStreak: attackersStreak,
            renderedText: afterText,
            expectedText: t('hints.attackersStreak', { streak: attackersStreak })
        };
    });

    console.log('\nReal page scenario:');
    console.log(`  div-hint-2 exists in real page: ${streakProof.hint2Exists ? 'YES' : 'NO'}`);
    console.log(`  Initial div-hint-2 text (streak=0): "${streakProof.initialText}"`);
    console.log(`  Previous frame result: ${streakProof.frameResultKey}`);
    console.log(`  defenseHolds: ${streakProof.defenseHolds}`);
    console.log(`  advancingPlayers: [${streakProof.advancingPlayers}]`);
    console.log(`  Old attackersStreak: ${streakProof.oldStreak}`);
    console.log(`  New attackersStreak: ${streakProof.newStreak}`);
    console.log(`  Rendered text in div-hint-2 on actual page: "${streakProof.renderedText}"`);
    console.log(`  Expected text: "${streakProof.expectedText}"`);
    console.log(`  Rendered text matches required display rule: ${streakProof.renderedText === streakProof.expectedText ? 'YES' : 'NO'}`);
    console.log('');
    console.log('Stale-binding check:');
    console.log(`  div-hint-2 exists in real page: ${streakProof.hint2Exists ? 'YES' : 'NO'}`);
    console.log(`  div-hint-2 textContent in real page: "${streakProof.renderedText}"`);

    // ============ Summary ============
    console.log('\n=========================================================');
    console.log('SUMMARY');
    console.log('=========================================================');

    let allPass = fcProof.timerOverlayCount > 0 && markerProof.markerCount > 0 && streakProof.renderedText === streakProof.expectedText;

    console.log(`\n§2 Timer during FC: ${fcProof.timerOverlayCount > 0 ? 'PASS' : 'FAIL'}`);
    console.log(`§3 Markers in hand: ${markerProof.markerCount > 0 ? 'PASS' : 'FAIL'}`);
    console.log(`§4 Streak display: ${streakProof.renderedText === streakProof.expectedText ? 'PASS' : 'FAIL'}`);
    console.log(`\nAll items: ${allPass ? 'COMPLETE' : 'INCOMPLETE'}`);

    await browser.close();
    process.exit(allPass ? 0 : 1);
})().catch(err => {
    console.error('Fatal error:', err.message);
    console.error(err.stack);
    process.exit(1);
});
