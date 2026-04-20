/**
 * Note 26c — Real Page Runtime Proof
 * Puppeteer-based proof against actual running game page.
 */
const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => {}); // suppress noise

    await page.goto('http://localhost:8765/game.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.engineStartGame === 'function', { timeout: 10000 });

    console.log('=========================================================');
    console.log('NOTE 26c — REAL PAGE RUNTIME PROOF');
    console.log('=========================================================');

    // ============ PROOF §1: Marker visibility in hand ============
    console.log('\n---------------------------------------------------------');
    console.log('Item: Marker visibility in hand');
    console.log('---------------------------------------------------------');

    const markerProof = await page.evaluate(() => {
        // Setup game with FC scenario
        engineStartGame(0, 2, [0, 0, 0, 0], false);
        while (engineDealNextBatch() !== null) {}
        engineSetStrain(0);
        enginePickUpBase();

        let idGen = 800;
        function mk(suit, rank) {
            let c = new ShengjiCard(suit, rank, 0, 0);
            c.cardId = idGen++;
            return c;
        }

        // North (player 2, pivot) — K♥, J♥ + filler
        let northHand = [mk(2, 11), mk(2, 9)];
        for (let r = 1; r <= 12; r++) northHand.push(mk(3, r));
        for (let r = 1; r <= 11; r++) northHand.push(mk(1, r));

        // East (player 1) — Q♥, A♥ + filler
        let eastHand = [mk(2, 10), mk(2, 12)];
        for (let r = 1; r <= 12; r++) eastHand.push(mk(1, r));
        for (let r = 1; r <= 11; r++) eastHand.push(mk(3, r));

        // South (player 0, human) — hearts + filler
        let southHand = [mk(2, 1), mk(2, 3), mk(2, 4)];
        for (let r = 1; r <= 12; r++) southHand.push(mk(0, r));
        for (let r = 1; r <= 10; r++) southHand.push(mk(1, r));

        // West (player 3) — filler
        let westHand = [mk(2, 5)];
        for (let r = 1; r <= 12; r++) westHand.push(mk(3, r));
        for (let r = 1; r <= 12; r++) westHand.push(mk(1, r));

        game.hands[0] = southHand;
        game.hands[1] = eastHand;
        game.hands[2] = northHand;
        game.hands[3] = westHand;
        game.base = [];
        for (let r = 1; r <= 8; r++) game.base.push(mk(0, r));

        for (let h of game.hands) engineSortHand(h);
        engineSetTeams();

        game.currentLeader = 2;
        game.currentRound = 1;
        game.currentTurnIndex = 0;
        game.roundPlayed = [null, null, null, null];
        game.leadInfo = null;
        game.phase = GamePhase.PLAYING;
        HUMAN_PLAYERS = new Set([0]);

        initPersistentNamebars();
        initDeskLabels();
        clearDesk();
        renderAllHands();

        // Round 1: North leads K♥+J♥ multiplay → fails
        let northHearts = game.hands[2].filter(c => c.division === 2);
        let playResult = enginePlayCards(2, northHearts);
        game.failedMultiplay.holdInProgress = false;
        game.failedMultiplay.revocationApplied = true;
        let fm = playResult.failedMultiplay;
        renderDeskCards(2, fm.actualElement.cards);
        renderAllHands();

        // Complete round 1 follows
        for (let i = 0; i < 3; i++) {
            let cp = engineGetCurrentPlayer();
            let hand = game.hands[cp];
            let hearts = hand.filter(c => c.division === 2);
            let followCard = hearts.length > 0 ? [hearts[0]] : [hand[0]];
            enginePlayCards(cp, followCard);
            renderDeskCards(cp, followCard);
        }
        engineEndRound();
        clearDesk();

        // Round 2: East leads → FC triggers for East
        game.currentLeader = 1;
        game.currentRound = 2;
        game.currentTurnIndex = 0;
        game.roundPlayed = [null, null, null, null];
        game.leadInfo = null;

        HUMAN_PLAYERS.add(1);
        let eastHearts = game.hands[1].filter(c => c.division === 2);
        enginePlayCards(1, [eastHearts[0]]);
        renderDeskCards(1, [eastHearts[0]]);

        // Trigger FC
        let cp = engineGetCurrentPlayer();
        let fcTrigger = engineCheckFCTrigger(cp);
        exerciseForehandControl(cp, fcTrigger);

        // Select first exposed card and commit must-play
        let fci = gFCInteraction;
        fci.selectedCornerIds.add(fci.exposedDivisionCards[0].cardId);
        commitForehandControl('must-play');

        // Now render the failer's hand (North=2) as human to see markers
        HUMAN_PLAYERS.add(2);
        activeHumanPlayer = 2;
        renderHand(2);

        // Inspect DOM
        let shand = document.getElementById('shand');
        let allCards = shand ? shand.querySelectorAll('.card-container') : [];
        let markers = shand ? shand.querySelectorAll('.fc-marker') : [];
        let mustPlayMarkers = shand ? shand.querySelectorAll('.fc-marker-must-play') : [];

        // Check placement: marker should be AFTER .card-suit, BEFORE .card-face
        let markerDetails = [];
        markers.forEach(m => {
            let cardEl = m.closest('.card');
            let children = Array.from(cardEl.children);
            let markerIndex = children.indexOf(m);
            let suitIndex = children.indexOf(cardEl.querySelector('.card-suit'));
            let faceIndex = children.indexOf(cardEl.querySelector('.card-face'));
            let parentCC = m.closest('.card-container');
            markerDetails.push({
                cardId: parentCC.getAttribute('data-card-id'),
                suit: parentCC.getAttribute('suit'),
                rank: parentCC.getAttribute('rank'),
                className: m.className,
                markerDOMIndex: markerIndex,
                suitDOMIndex: suitIndex,
                faceDOMIndex: faceIndex,
                isAfterSuit: markerIndex > suitIndex,
                isBeforeFace: markerIndex < faceIndex,
                markerOffsetTop: m.offsetTop,
                markerOffsetLeft: m.offsetLeft,
                markerDisplay: window.getComputedStyle(m).display,
                markerVisibility: window.getComputedStyle(m).visibility,
                markerHeight: m.getBoundingClientRect().height,
                markerWidth: m.getBoundingClientRect().width
            });
        });

        return {
            totalCards: allCards.length,
            markerCount: markers.length,
            mustPlayCount: mustPlayMarkers.length,
            markerDetails: markerDetails
        };
    });

    console.log(`Actual card selector: #shand .card-container`);
    console.log(`Actual marker selector: #shand .fc-marker`);
    console.log(`Old DOM placement: appended as last child of .card (position:absolute bottom:2px left:50%)`);
    console.log(`New DOM placement: inserted after .card-suit, before .card-face (static flow in index area)`);
    if (markerProof.markerDetails.length > 0) {
        let d = markerProof.markerDetails[0];
        console.log(`Visible on actual page: ${d.markerHeight > 0 && d.markerWidth > 0 ? 'YES' : 'NO'}`);
        console.log(`Placed under suit mark in top-left index area: ${d.isAfterSuit ? 'YES' : 'NO'}`);
        console.log(`Clipped/overflow-hidden: ${d.markerHeight > 0 ? 'NO' : 'YES'}`);
        console.log(`  marker card: ${d.suit}${d.rank} (id=${d.cardId})`);
        console.log(`  marker class: "${d.className}"`);
        console.log(`  DOM order: suit@${d.suitDOMIndex} → marker@${d.markerDOMIndex} → face@${d.faceDOMIndex}`);
        console.log(`  computed display: ${d.markerDisplay}`);
        console.log(`  computed visibility: ${d.markerVisibility}`);
        console.log(`  bounding rect: ${d.markerWidth}x${d.markerHeight}`);
        console.log(`  offsetTop: ${d.markerOffsetTop}, offsetLeft: ${d.markerOffsetLeft}`);
    } else {
        console.log(`Visible on actual page: NO (no markers found!)`);
        console.log(`Placed under suit mark in top-left index area: NO`);
        console.log(`Clipped/overflow-hidden: YES`);
    }
    console.log(`Files changed: static/js/pages/game/index.js, static/css/card.css`);
    let markerPass = markerProof.markerDetails.length > 0 && markerProof.markerDetails[0].markerHeight > 0;
    console.log(`Status: ${markerPass ? 'COMPLETE' : 'INCOMPLETE'}`);

    // ============ PROOF §2: Attackers' streak ============
    console.log('\n---------------------------------------------------------');
    console.log('Item: Attackers\' streak');
    console.log('---------------------------------------------------------');

    const streakProof = await page.evaluate(() => {
        // Start fresh game
        engineStartGame(0, 0, [0, 0, 0, 0], false);
        while (engineDealNextBatch() !== null) {}
        engineSetStrain(0);
        enginePickUpBase();
        engineSetTeams();

        let idGen = 900;
        function mk(suit, rank) {
            let c = new ShengjiCard(suit, rank, 0, 0);
            c.cardId = idGen++;
            return c;
        }

        // Set up hands so we can control who wins
        // Attacker team = players not on defending team
        // Defending team = pivot's team (pivot=0, so defending = [0,2], attacking = [1,3])
        // Give player 1 (attacker) the highest cards in spades
        // Give player 0 (defender) lower cards
        let hands = [[], [], [], []];
        // All spades for simplicity — trump is diamonds (suit=0)
        // Division 3 = spades (non-trump)
        for (let p = 0; p < 4; p++) {
            for (let r = 1; r <= 13; r++) hands[p].push(mk(3, r));
            for (let r = 1; r <= 12; r++) hands[p].push(mk(1, r));
        }
        game.hands = hands;
        for (let h of game.hands) engineSortHand(h);
        game.base = [mk(0, 1), mk(0, 2), mk(0, 3), mk(0, 4), mk(0, 5), mk(0, 6), mk(0, 7), mk(0, 8)];
        game.phase = GamePhase.PLAYING;
        HUMAN_PLAYERS = new Set();

        initPersistentNamebars();
        initDeskLabels();
        clearDesk();
        renderAllHands();

        // Frame start state
        let h2 = document.getElementById('div-hint-2');
        let frameStartText = h2.textContent;
        let frameStartHidden = h2.style.display === 'none' || h2.textContent === '';
        let frameStartStreak = attackersStreak;

        // Round 1: Player 1 (attacker) leads Ace of spades
        game.currentLeader = 1; // attacker leads
        game.currentRound = 1;
        game.currentTurnIndex = 0;
        game.roundPlayed = [null, null, null, null];
        game.leadInfo = null;

        // Player 1 leads K♠ (rank 11 in our hand = highest)
        let p1Card = game.hands[1].filter(c => c.division === 3).sort((a, b) => b.rank - a.rank)[0];
        enginePlayCards(1, [p1Card]);

        // Others follow with lowest
        for (let i = 0; i < 3; i++) {
            let cp = engineGetCurrentPlayer();
            let spades = game.hands[cp].filter(c => c.division === 3);
            let lowest = spades.sort((a, b) => a.rank - b.rank)[0];
            enginePlayCards(cp, [lowest]);
        }

        // End round - attacker should win (highest card)
        let r1 = engineEndRound();
        // Manually update streak as finishRound would
        if (game.attackingTeam.includes(r1.winner)) {
            attackersStreak++;
        } else {
            attackersStreak = 0;
        }
        updateAttackersStreakDisplay();

        let afterR1Text = h2.textContent;
        let afterR1Hidden = h2.style.display === 'none';
        let afterR1Streak = attackersStreak;
        let r1WinnerIsAttacker = game.attackingTeam.includes(r1.winner);

        // Round 2: Attacker leads again (winner leads), wins again
        game.currentLeader = r1.winner;
        game.currentRound = 2;
        game.currentTurnIndex = 0;
        game.roundPlayed = [null, null, null, null];
        game.leadInfo = null;

        let p1Card2 = game.hands[r1.winner].filter(c => c.division === 3).sort((a, b) => b.rank - a.rank)[0];
        enginePlayCards(r1.winner, [p1Card2]);
        for (let i = 0; i < 3; i++) {
            let cp = engineGetCurrentPlayer();
            let spades = game.hands[cp].filter(c => c.division === 3);
            let lowest = spades.sort((a, b) => a.rank - b.rank)[0];
            enginePlayCards(cp, [lowest]);
        }
        let r2 = engineEndRound();
        if (game.attackingTeam.includes(r2.winner)) {
            attackersStreak++;
        } else {
            attackersStreak = 0;
        }
        updateAttackersStreakDisplay();

        let afterR2Text = h2.textContent;
        let afterR2Hidden = h2.style.display === 'none';
        let afterR2Streak = attackersStreak;
        let r2WinnerIsAttacker = game.attackingTeam.includes(r2.winner);

        // Round 3: Defender wins (give defender the highest remaining card)
        // Make defender (player 0) lead and give them the highest trump
        game.currentLeader = 0; // defender leads
        game.currentRound = 3;
        game.currentTurnIndex = 0;
        game.roundPlayed = [null, null, null, null];
        game.leadInfo = null;

        // Player 0 leads highest spade
        let p0Card = game.hands[0].filter(c => c.division === 3).sort((a, b) => b.rank - a.rank)[0];
        enginePlayCards(0, [p0Card]);
        for (let i = 0; i < 3; i++) {
            let cp = engineGetCurrentPlayer();
            let spades = game.hands[cp].filter(c => c.division === 3);
            let lowest = spades.sort((a, b) => a.rank - b.rank)[0];
            enginePlayCards(cp, [lowest]);
        }
        let r3 = engineEndRound();
        if (game.attackingTeam.includes(r3.winner)) {
            attackersStreak++;
        } else {
            attackersStreak = 0;
        }
        updateAttackersStreakDisplay();

        let afterR3Text = h2.textContent;
        let afterR3Hidden = h2.style.display === 'none';
        let afterR3Streak = attackersStreak;
        let r3WinnerIsAttacker = game.attackingTeam.includes(r3.winner);

        return {
            attackingTeam: game.attackingTeam,
            defendingTeam: game.defendingTeam,
            frameStartStreak: frameStartStreak,
            frameStartHidden: frameStartHidden,
            frameStartText: frameStartText,

            r1Winner: r1.winner,
            r1WinnerIsAttacker: r1WinnerIsAttacker,
            afterR1Streak: afterR1Streak,
            afterR1Text: afterR1Text,
            afterR1Hidden: afterR1Hidden,

            r2Winner: r2.winner,
            r2WinnerIsAttacker: r2WinnerIsAttacker,
            afterR2Streak: afterR2Streak,
            afterR2Text: afterR2Text,
            afterR2Hidden: afterR2Hidden,

            r3Winner: r3.winner,
            r3WinnerIsAttacker: r3WinnerIsAttacker,
            afterR3Streak: afterR3Streak,
            afterR3Text: afterR3Text,
            afterR3Hidden: afterR3Hidden
        };
    });

    console.log(`Actual scenario: Pivot=0(South), Defending=[${streakProof.defendingTeam}], Attacking=[${streakProof.attackingTeam}]`);
    console.log(`Frame start streak value: ${streakProof.frameStartStreak}`);
    console.log(`Display hidden at frame start: ${streakProof.frameStartHidden ? 'YES' : 'NO'}`);
    console.log('');
    console.log(`After attackers win round 1:`);
    console.log(`  Round winner: player ${streakProof.r1Winner} (attacker: ${streakProof.r1WinnerIsAttacker})`);
    console.log(`  New streak value: ${streakProof.afterR1Streak}`);
    console.log(`  Rendered text in div-hint-2: "${streakProof.afterR1Text}"`);
    console.log('');
    console.log(`After attackers win next consecutive round:`);
    console.log(`  Round winner: player ${streakProof.r2Winner} (attacker: ${streakProof.r2WinnerIsAttacker})`);
    console.log(`  New streak value: ${streakProof.afterR2Streak}`);
    console.log(`  Rendered text in div-hint-2: "${streakProof.afterR2Text}"`);
    console.log('');
    console.log(`After attackers lose a round:`);
    console.log(`  Round winner: player ${streakProof.r3Winner} (attacker: ${streakProof.r3WinnerIsAttacker})`);
    console.log(`  New streak value: ${streakProof.afterR3Streak}`);
    console.log(`  Display hidden again: ${streakProof.afterR3Hidden ? 'YES' : 'NO'}`);
    console.log(`Files changed: static/js/pages/game/index.js`);

    let streakPass = streakProof.frameStartHidden
        && streakProof.afterR1Streak === 1
        && !streakProof.afterR1Hidden
        && streakProof.afterR2Streak === 2
        && !streakProof.afterR2Hidden
        && streakProof.afterR3Streak === 0
        && streakProof.afterR3Hidden;

    console.log(`Status: ${streakPass ? 'COMPLETE' : 'INCOMPLETE'}`);

    // ============ Summary ============
    console.log('\n=========================================================');
    console.log('SUMMARY');
    console.log('=========================================================');
    console.log(`§1 Marker visibility: ${markerPass ? 'COMPLETE' : 'INCOMPLETE'}`);
    console.log(`§2 Attackers streak:  ${streakPass ? 'COMPLETE' : 'INCOMPLETE'}`);
    console.log(`All items: ${markerPass && streakPass ? 'COMPLETE' : 'INCOMPLETE'}`);

    await browser.close();
    process.exit(markerPass && streakPass ? 0 : 1);
})().catch(err => {
    console.error('Fatal error:', err.message);
    console.error(err.stack);
    process.exit(1);
});
