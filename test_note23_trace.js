/**
 * Note 23 Runtime Trace Script
 * 
 * Run this in the browser console after game.html loads.
 * It sets up a deterministic scenario, instruments all state checkpoints,
 * and outputs the complete trace required by note 23.
 *
 * Scenario:
 * - Level 0 (trump rank = 2), strain = 0 (diamonds trump), pivot = 2 (North)
 * - Players: 0=South(human), 1=East, 2=North(pivot/defender), 3=West
 * - Defenders: North(2) + South(0); Attackers: East(1) + West(3)
 * - North leads a failed multiplay in hearts (division 2):
 *   attempts to lead A♥ + K♥ (two singles = multiplay), but East has a higher heart,
 *   so it's blocked → failed multiplay, A♥ is the actual lead, K♥ is revoked/exposed
 * - Later, North follows in a hearts-led round → FC triggers for West (North's forehand)
 */

// ===================== UTILITY =====================
function stateSnapshot(label) {
    let s = `\n========== ${label} ==========\n`;
    s += `game.failedMultiplay: ${JSON.stringify(game.failedMultiplay, cardReplacer, 2)}\n`;
    s += `game.exposedCards: ${JSON.stringify(game.exposedCards, cardReplacer, 2)}\n`;
    s += `game.fcChances: ${JSON.stringify(game.fcChances)}\n`;
    s += `game.fcPending: ${JSON.stringify(game.fcPending, cardReplacer, 2)}\n`;
    s += `game.forehandControl: ${JSON.stringify(game.forehandControl, cardReplacer, 2)}\n`;
    s += `gFCInteraction: ${JSON.stringify(gFCInteraction, setReplacer, 2)}\n`;
    return s;
}

function cardReplacer(key, val) {
    if (val && typeof val === 'object' && 'cardId' in val && 'suitName' in val) {
        return `Card(${val.suitName}${val.rankName}, id=${val.cardId}, div=${val.division}, ord=${val.order})`;
    }
    if (val instanceof Set) return [...val];
    return val;
}

function setReplacer(key, val) {
    if (val instanceof Set) return [...val];
    if (val && typeof val === 'object' && 'cardId' in val && 'suitName' in val) {
        return `Card(${val.suitName}${val.rankName}, id=${val.cardId}, div=${val.division}, ord=${val.order})`;
    }
    return val;
}

function domProof(label) {
    let s = `\n---------- DOM Proof: ${label} ----------\n`;
    // Check exposed-preview in each desk slot
    for (let p = 0; p < 4; p++) {
        let slotId = ['desk-south', 'desk-east', 'desk-north', 'desk-west'][p];
        let slot = document.getElementById(slotId);
        let nb = slot ? slot.querySelector('.desk-namebar') : null;
        let preview = nb ? nb.querySelector('.exposed-preview') : null;
        let corners = preview ? preview.querySelectorAll('.corner-card') : [];
        let hasExposed = preview ? preview.classList.contains('has-exposed') : false;
        let dataHasExposed = slot ? slot.hasAttribute('data-has-exposed') : false;
        s += `  ${slotId}: preview=${!!preview}, has-exposed=${hasExposed}, corner-count=${corners.length}, data-has-exposed=${dataHasExposed}\n`;
    }
    // Check shand for exposed-card highlighting
    let shand = document.getElementById('shand');
    let exposedInHand = shand ? shand.querySelectorAll('[data-exposed="true"]') : [];
    s += `  shand: exposed-highlighted-cards=${exposedInHand.length}\n`;
    // Check for FC buttons
    let fcBtns = document.querySelectorAll('.fc-action-btn');
    s += `  fc-action-buttons: count=${fcBtns.length}\n`;
    fcBtns.forEach((btn, i) => {
        s += `    btn[${i}]: text="${btn.textContent}", mounted=${document.body.contains(btn)}\n`;
    });
    // Check fc-active preview
    let fcActive = document.querySelectorAll('.exposed-preview.fc-active');
    s += `  fc-active-previews: count=${fcActive.length}\n`;
    // Check play button state
    let btnPlay = document.getElementById('btn-play');
    s += `  btn-play: disabled=${btnPlay?.disabled}, text="${btnPlay?.textContent}"\n`;
    // Check for 确认标记 text
    s += `  btn-play-is-confirmMarks: ${btnPlay?.textContent?.includes('确认') || btnPlay?.textContent?.includes('Confirm')}\n`;
    return s;
}

function layoutProof() {
    let s = '\n---------- Layout Proof ----------\n';
    let northSlot = document.getElementById('desk-north');
    if (northSlot) {
        let style = getComputedStyle(northSlot);
        s += `  #desk-north transform: ${style.transform}\n`;
        s += `  #desk-north data-has-exposed: ${northSlot.hasAttribute('data-has-exposed')}\n`;
    }
    return s;
}

// ===================== SETUP =====================
async function runTrace() {
    let log = '';
    const print = (msg) => { log += msg + '\n'; console.log(msg); };

    print('=== Note 23 Runtime Trace ===');
    print('');
    print('Authoritative state mapping:');
    print('FailedMultiplayState -> game.failedMultiplay');
    print('ExposedCardState -> game.exposedCards');
    print('ForehandControlChanceState -> game.fcChances');
    print('ForehandControlPendingTriggerState -> game.fcPending');
    print('ForehandControlInteractionState -> gFCInteraction');
    print('');

    // Step 0: Set up deterministic game state
    print('--- Step 0: Setup ---');

    // Start a game with known parameters
    engineStartGame(0, 2, [0,0,0,0], false); // level=0(rank 2), pivot=2(North)

    // Fast-deal all cards
    while (engineDealNextBatch() !== null) {}

    // Set strain to 0 (diamonds = trump)
    engineSetStrain(0);

    // Pick up base for pivot (player 2 = North)
    enginePickUpBase();

    // Now set up specific hands. We need:
    // - North (player 2, leader/pivot) has: A♥(h12), K♥(h11), plus other cards
    //   North will try to lead A♥ + K♥ as multiplay
    // - East (player 1) has a card that beats one of those singles (e.g., owns the other A♥)
    //   So East "could beat" the K♥ single → failed multiplay
    // - The second copy of A♥ would beat K♥, so East blocks K♥
    //
    // Actually for a cleaner scenario:
    // North leads two hearts singles: K♥ + J♥ as a multiplay attempt
    // East has Q♥ which beats J♥ → blocked → actual lead is J♥, K♥ revoked
    //
    // Division for hearts (suit=2): when strain=0(diamonds), hearts division = 2
    // Level=0 means rank 2 is trump. So all rank-0 (="2") cards are trump.
    // Hearts A: suit=2, rank=12 → not trump rank, not trump suit → division=2, order=11
    // Hearts K: suit=2, rank=11 → division=2, order=10
    // Hearts Q: suit=2, rank=10 → division=2, order=9
    // Hearts J: suit=2, rank=9 → division=2, order=8
    // Hearts 10: suit=2, rank=8 → division=2, order=7
    // Hearts 9: suit=2, rank=7 → division=2, order=6
    
    // Build specific cards with correct properties
    function makeCard(suit, rank, id) {
        let c = new ShengjiCard(suit, rank, 0, 0); // level=0, strain=0(diamonds)
        c.cardId = id;
        return c;
    }

    // Use card IDs from the deck: suit*13+rank for first copy, 54+suit*13+rank for second copy
    // Suit 0=diamonds, 1=clubs, 2=hearts, 3=spades
    // Hearts cards: suit=2, so base offset = 26
    // h3(rank=1,id=27), h4(rank=2→trump!), h5(rank=3,id=29), h6(rank=4,id=30), h7(rank=5,id=31)
    // h8(rank=6,id=32), h9(rank=7,id=33), h10(rank=8,id=34), hJ(rank=9,id=35), hQ(rank=10,id=36)
    // hK(rank=11,id=37), hA(rank=12,id=38)
    // Wait - rank 0 is "2", which at level=0 becomes trump. So h2 (suit=2,rank=0) is trump.
    // Hearts: rank 1="3",2="4",3="5",4="6",5="7",6="8",7="9",8="10",9="J",10="Q",11="K",12="A"
    
    // North's hand (player 2): will lead K♥ + J♥ multiplay
    // K♥ = suit 2, rank 11 → order 10, division 2
    // J♥ = suit 2, rank 9 → order 8, division 2
    // Also needs other cards to fill out (25 cards after basing)
    // For simplicity: give North plenty of spade fillers plus the two hearts
    
    // East's hand (player 1): needs Q♥ to block J♥
    // Q♥ = suit 2, rank 10 → order 9 > J♥ order 8 → can beat the J♥ single
    // East also needs other cards
    
    // Create hands manually:
    let idCounter = 200; // Use IDs above deck range to avoid collision
    
    function nextId() { return idCounter++; }
    
    // North (player 2) - 25 cards: K♥, J♥, + 23 spade fillers
    let northHand = [
        makeCard(2, 11, nextId()), // K♥ id=200
        makeCard(2, 9, nextId()),  // J♥ id=201
    ];
    // Fill with spades (division 3, non-trump)
    // Spade ranks: 1=3, 3=5, 4=6, 5=7, 6=8, 7=9, 8=10, 9=J, 10=Q, 11=K, 12=A
    // Skip rank 0 (spade 2 = trump at level 0)
    for (let r = 1; r <= 12; r++) {
        northHand.push(makeCard(3, r, nextId())); // 12 spades
    }
    for (let r = 1; r <= 11; r++) {
        northHand.push(makeCard(1, r, nextId())); // 11 clubs
    }
    // Total: 2 + 12 + 11 = 25

    // East (player 1) - 25 cards: Q♥, A♥, + 23 club fillers
    let eastHand = [
        makeCard(2, 10, nextId()), // Q♥ 
        makeCard(2, 12, nextId()), // A♥
    ];
    for (let r = 1; r <= 12; r++) {
        eastHand.push(makeCard(1, r, nextId())); // 12 clubs
    }
    for (let r = 1; r <= 11; r++) {
        eastHand.push(makeCard(3, r, nextId())); // 11 spades
    }
    // Total: 2 + 12 + 11 = 25
    
    // South (player 0) - 25 cards: some hearts + fillers
    // South needs hearts for the later follow round
    let southHand = [
        makeCard(2, 1, nextId()),  // 3♥
        makeCard(2, 3, nextId()),  // 5♥
        makeCard(2, 4, nextId()),  // 6♥
    ];
    for (let r = 1; r <= 12; r++) {
        southHand.push(makeCard(0, r, nextId())); // 12 diamonds → these are TRUMP at strain=0!
    }
    // Need non-trump fillers. Use clubs.
    for (let r = 1; r <= 10; r++) {
        southHand.push(makeCard(1, r, nextId())); // 10 clubs
    }
    // Total: 3 + 12 + 10 = 25
    // Wait, diamonds at strain=0 are trump. South leads hearts to trigger FC later.
    // Actually: South won't lead. The leader is North (pivot).
    // For the FC trigger, we need a LATER round where someone leads hearts and North follows.
    // Let's make South able to win a trick and then lead hearts.

    // West (player 3) - 25 cards: fillers
    let westHand = [];
    for (let r = 1; r <= 12; r++) {
        westHand.push(makeCard(3, r, nextId())); // 12 spades
    }
    for (let r = 1; r <= 12; r++) {
        westHand.push(makeCard(1, r, nextId())); // 12 clubs
    }
    westHand.push(makeCard(2, 5, nextId())); // 7♥ - one heart
    // Total: 12 + 12 + 1 = 25

    // Set hands
    game.hands[0] = southHand;
    game.hands[1] = eastHand;
    game.hands[2] = northHand;
    game.hands[3] = westHand;
    
    // Set base (8 cards, doesn't matter much)
    let baseCards = [];
    for (let r = 1; r <= 8; r++) {
        baseCards.push(makeCard(0, r, nextId()));
    }
    game.base = baseCards;

    // Sort hands
    for (let h of game.hands) engineSortHand(h);

    // Set teams: pivot=2(North), defenders=North+South, attackers=East+West
    engineSetTeams();
    
    // Set game to PLAYING phase
    game.currentLeader = 2; // North leads
    game.currentRound = 1;
    game.currentTurnIndex = 0;
    game.roundPlayed = [null, null, null, null];
    game.leadInfo = null;
    game.phase = GamePhase.PLAYING;

    // Init UI
    initPersistentNamebars();
    initDeskLabels();
    clearDesk();
    renderAllHands();

    print(`Hands set. North has ${game.hands[2].length} cards, East has ${game.hands[1].length} cards.`);
    print(`North hearts: ${game.hands[2].filter(c => c.division === 2).map(c => c.suitName + c.rankName).join(', ')}`);
    print(`East hearts: ${game.hands[1].filter(c => c.division === 2).map(c => c.suitName + c.rankName).join(', ')}`);
    print(`Current leader: player ${game.currentLeader} (North)`);
    print(`Phase: ${game.phase}`);

    // ===================== STEP 1: FAILED MULTIPLAY =====================
    print('\n=== STEP 1: Failed Multiplay Resolution ===');
    
    // North (player 2) leads K♥ + J♥ as multiplay attempt
    let northHearts = game.hands[2].filter(c => c.division === 2);
    print(`North's hearts for multiplay: ${northHearts.map(c => c.suitName + c.rankName + '(ord=' + c.order + ',id=' + c.cardId + ')').join(', ')}`);
    
    // Verify East can block
    let eastHearts = game.hands[1].filter(c => c.division === 2);
    print(`East's hearts: ${eastHearts.map(c => c.suitName + c.rankName + '(ord=' + c.order + ')').join(', ')}`);
    
    // Lead the multiplay
    let leadCards = northHearts; // K♥ + J♥
    print(`North attempts multiplay: ${leadCards.map(c => c.suitName + c.rankName).join(' + ')}`);
    
    let result = enginePlayCards(2, leadCards);
    print(`enginePlayCards result: success=${result.success}, failedMultiplay=${!!result.failedMultiplay}`);
    
    if (result.failedMultiplay) {
        let fm = result.failedMultiplay;
        print(`Actual element: ${fm.actualElement.cards.map(c => c.suitName + c.rankName).join(', ')}`);
        print(`Blocker: player ${fm.blockerSeat}`);
        print(`Revoked: ${fm.revokedCards.map(c => c.suitName + c.rankName + '(id=' + c.cardId + ')').join(', ')}`);
    }

    // === 3.1 State dump immediately after resolution ===
    print(stateSnapshot('Step 1 — After failed-multiplay resolution'));
    
    // === 3.2 Expected UI ===
    print('Expected UI: Intended lead (K♥+J♥) shown on desk for 1 second, revoked card(s) highlighted with show-revoked.');
    
    // Simulate UI handling (handleFailedMultiplay)
    // This triggers the 1-second hold. We need to call it and wait.
    if (result.failedMultiplay) {
        let fm = result.failedMultiplay;
        
        // Render the desk for the lead
        handleFailedMultiplay(2, fm, leadCards, result, () => {
            print('\n=== 1-second hold callback fired ===');
            continueAfterHold(result);
        });
        
        // === 3.3 DOM proof during hold ===
        print(domProof('Step 1 — During 1-second hold'));
    }

    // Wait for the 1-second hold to complete
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // The continuation is handled in continueAfterHold
    // Wait a bit more for any async rendering
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // === STEP 2: After 1-second hold ===
    print('\n=== STEP 2: After 1-second revoke transition ===');
    print(stateSnapshot('Step 2 — After hold completes'));
    print(domProof('Step 2 — After hold'));
    print(layoutProof());
    
    // === 3.5 Desk proof ===
    let northSlot = document.getElementById('desk-north');
    let cardsOnDesk = northSlot ? northSlot.querySelectorAll('.card-container') : [];
    print(`Cards on North's desk: ${cardsOnDesk.length}`);
    cardsOnDesk.forEach(cc => {
        print(`  card: suit=${cc.getAttribute('suit')}, rank=${cc.getAttribute('rank')}, show=${cc.getAttribute('card-show')}`);
    });
    
    // Exposed preview on East (to verify other views)
    let eastNb = document.getElementById('desk-east')?.querySelector('.desk-namebar');
    let eastPreview = eastNb?.querySelector('.exposed-preview');
    let eastCorners = eastPreview?.querySelectorAll('.corner-card') || [];
    print(`East view exposed corners: ${eastCorners.length}`);
    
    // Now we need to continue the round: East, South, West need to follow
    // But first, the round needs to complete so we can start a new round where FC triggers
    
    // Current state: North led (turnIndex should be 1 now)
    print(`\nCurrent turn index: ${game.currentTurnIndex}, current leader: ${game.currentLeader}`);
    print(`Current player: ${engineGetCurrentPlayer()}`);
    
    // East (player 1) follows - play one heart
    let eastFollow = [game.hands[1].filter(c => c.division === 2)[0]]; // Pick first heart
    if (!eastFollow[0]) eastFollow = [game.hands[1][0]]; // fallback
    print(`East follows with: ${eastFollow.map(c => c.suitName + c.rankName).join(', ')}`);
    let r1 = enginePlayCards(1, eastFollow);
    print(`East play result: success=${r1.success}`);
    if (r1.success) renderDeskCards(1, eastFollow);
    
    // South (player 0) follows
    let southFollow = [game.hands[0].filter(c => c.division === 2)[0]]; // Pick first heart
    if (!southFollow[0]) southFollow = [game.hands[0][0]];
    print(`South follows with: ${southFollow.map(c => c.suitName + c.rankName).join(', ')}`);
    let r2 = enginePlayCards(0, southFollow);
    print(`South play result: success=${r2.success}`);
    if (r2.success) renderDeskCards(0, southFollow);

    // West (player 3) follows
    let westFollow = [game.hands[3].filter(c => c.division === 2)[0]]; // Pick first heart
    if (!westFollow[0]) westFollow = [game.hands[3][0]];
    print(`West follows with: ${westFollow.map(c => c.suitName + c.rankName).join(', ')}`);
    let r3 = enginePlayCards(3, westFollow);
    print(`West play result: success=${r3.success}`);
    if (r3.success) renderDeskCards(3, westFollow);

    // End the round
    if (r3.success && r3.roundComplete) {
        let roundResult = engineEndRound();
        print(`Round 1 ended. Winner: player ${roundResult.winner}`);
        highlightActivePlayer(-1);
        
        // Update exposed previews after round
        for (let p = 0; p < 4; p++) {
            if (p !== 0) updateExposedPreview(p);
        }
        renderAllHands();
    }

    // === STEP 3: Later qualifying round for FC trigger ===
    print('\n=== STEP 3: Later qualifying round ===');
    
    // Now we need someone to lead hearts so North (the failer) follows in hearts division
    // Let's check who the leader is now
    print(`Round 2 leader: player ${game.currentLeader}`);
    print(`North still has exposed cards? ${JSON.stringify(game.exposedCards, cardReplacer)}`);
    print(`FC chances: ${JSON.stringify(game.fcChances)}`);
    
    // We need to make the round winner lead hearts
    // If the winner doesn't have hearts, we'll need to arrange things differently
    // Let's just manually set up round 2 with a hearts lead
    
    // For simplicity: if the leader is not who we want, manually override
    // We want someone ELSE to lead hearts, then North follows
    // Best: East won round 1 (played Q♥ or A♥ which is highest), so East leads round 2
    
    let r2Leader = game.currentLeader;
    print(`Round 2 leader: player ${r2Leader}`);
    
    // The leader leads a heart
    let leaderHearts = game.hands[r2Leader].filter(c => c.division === 2);
    print(`Leader (player ${r2Leader}) hearts: ${leaderHearts.map(c => c.suitName + c.rankName).join(', ')}`);
    
    if (leaderHearts.length > 0) {
        clearDesk();
        let leadCard = [leaderHearts[0]];
        print(`Leader plays: ${leadCard[0].suitName}${leadCard[0].rankName}`);
        let lr = enginePlayCards(r2Leader, leadCard);
        print(`Lead result: success=${lr.success}`);
        if (lr.success) renderDeskCards(r2Leader, leadCard);
        
        // Now players follow in order. We need to get to the point where North (player 2) 
        // is about to follow and FC should trigger.
        // Play order from leader: leader+1, leader+2, leader+3 
        
        let followOrder = [];
        for (let i = 1; i < 4; i++) {
            followOrder.push((r2Leader + i) % 4);
        }
        print(`Follow order: ${followOrder.join(', ')}`);
        
        // Play followers until we reach North (player 2)
        for (let fp of followOrder) {
            if (fp === 2) {
                // This is North - FC should trigger here!
                print('\n--- About to prompt North (failer) to follow ---');
                
                // === 3.8 Trigger condition proof ===
                let cp = engineGetCurrentPlayer();
                print(`Current player: ${cp}`);
                print(`Failer is acting: ${cp === 2 ? 'YES' : 'NO'}`);
                print(`Failer is following: ${game.currentTurnIndex > 0 ? 'YES' : 'NO'}`);
                
                let ledDiv = game.leadInfo ? game.leadInfo.division : -1;
                let northExposed = game.exposedCards[2];
                let hasExposedInLedDiv = northExposed && northExposed[ledDiv] && northExposed[ledDiv].length > 0;
                print(`Led division: ${ledDiv} (hearts=2)`);
                print(`Led division still exposed: ${hasExposedInLedDiv ? 'YES' : 'NO'}`);
                print(`Exposed in led div: ${hasExposedInLedDiv ? northExposed[ledDiv].map(c => c.suitName + c.rankName).join(',') : 'none'}`);
                
                let hasFCChance = game.fcChances[2] && game.fcChances[2].count > 0;
                print(`Forehand has unused chance: ${hasFCChance ? 'YES' : 'NO'}`);
                
                // === 3.9 State dump before forehand plays ===
                // (North's forehand is West = player 3)
                // Actually the forehand of North is (2-1+4)%4 = player 1 (East)? 
                // No: forehand = (failer + NUM_PLAYERS - 1) % NUM_PLAYERS = (2+4-1)%4 = 1 (East)
                // Wait let me check: the "forehand" in Shengji is the player who plays right BEFORE the failer
                // (failer + NUM_PLAYERS - 1) % NUM_PLAYERS = player 1 (East)
                
                print(`North's forehand (controller): player ${game.fcChances[2]?.forehand}`);

                // Now call promptCurrentPlayer to trigger FC
                print('\n--- Calling promptCurrentPlayer() to trigger FC ---');
                
                // Before calling, check the trigger manually
                let fcTrigger = engineCheckFCTrigger(2);
                print(`engineCheckFCTrigger result: ${JSON.stringify(fcTrigger, cardReplacer)}`);
                
                print(stateSnapshot('Step 3 — Before FC trigger'));
                
                // === STEP 4: FC interaction ===
                // promptCurrentPlayer will call exerciseForehandControl
                // Since the controller might be a bot, it will auto-commit
                // Or if the controller is human-controlled, it will mount UI
                
                // Check if controller is human
                let controller = fcTrigger.controller;
                print(`Controller player ${controller} is human: ${isHumanControlled(controller)}`);
                
                // If controller is a bot, FC will auto-exercise. Let's make controller human-controlled for the trace.
                let wasHumanPlayers = new Set(HUMAN_PLAYERS);
                HUMAN_PLAYERS.add(controller);
                
                promptCurrentPlayer();
                
                print('\n=== STEP 4: FC Interaction Active ===');
                print(stateSnapshot('Step 4 — FC interaction active'));
                print(domProof('Step 4 — FC interaction'));
                
                // === 3.11 Active actor proof ===
                print(`Current interaction owner: player ${gFCInteraction?.controller}`);
                print(`Reason: This player is the forehand of the failer (North), gets to decide must-play/must-hold`);
                
                // === 3.12 Selection surface proof ===
                let fcPreview = document.querySelector('.exposed-preview.fc-active');
                let selectableCorners = fcPreview ? fcPreview.querySelectorAll('.corner-card') : [];
                let fcSelectedCorners = fcPreview ? fcPreview.querySelectorAll('[data-fc-selected]') : [];
                print(`Selectable corners selector: .exposed-preview.fc-active .corner-card`);
                print(`Selectable corner count: ${selectableCorners.length}`);
                print(`Selected (highlighted) count: ${fcSelectedCorners.length}`);
                
                // === 3.13 Commit control proof ===
                let mustPlayBtn = document.querySelector('.fc-action-btn');
                let mustHoldBtn = document.querySelectorAll('.fc-action-btn')[1];
                print(`must-play button mounted: ${mustPlayBtn ? 'YES' : 'NO'}`);
                print(`must-play selector: .fc-action-btn:first-child`);
                print(`must-play text: "${mustPlayBtn?.textContent}"`);
                print(`must-hold button mounted: ${mustHoldBtn ? 'YES' : 'NO'}`);
                print(`must-hold selector: .fc-action-btn:nth-child(2)`);
                print(`must-hold text: "${mustHoldBtn?.textContent}"`);
                
                // Click a corner to select it, then commit
                if (selectableCorners.length > 0) {
                    selectableCorners[0].click();
                    print('\nClicked first corner card to select it.');
                    let updatedSelected = fcPreview ? fcPreview.querySelectorAll('[data-fc-selected]') : [];
                    print(`After click — selected count: ${updatedSelected.length}`);
                }
                
                // === STEP 5: Commit FC ===
                print('\n=== STEP 5: FC Commit ===');
                print(`Committing with must-play...`);
                let chancesBefore = game.fcChances[2] ? game.fcChances[2].count : 0;
                
                commitForehandControl('must-play');
                
                let chancesAfter = game.fcChances[2] ? game.fcChances[2].count : 0;
                print(`Chances before: ${chancesBefore}, after: ${chancesAfter}`);
                print(`Exactly one consumed: ${chancesBefore - chancesAfter === 1 || (chancesBefore === 1 && !game.fcChances[2]) ? 'YES' : 'NO'}`);
                
                print(stateSnapshot('Step 5 — After FC commit'));
                print(domProof('Step 5 — After commit'));
                
                // === 3.16 Continuation proof ===
                print(`Pending trigger cleared: ${game.fcPending === null ? 'YES' : 'NO'}`);
                print(`Interaction state cleared: ${gFCInteraction === null ? 'YES' : 'NO'}`);
                
                // Check if North (failer) can now follow
                let cpAfter = engineGetCurrentPlayer();
                print(`Current player after commit: ${cpAfter} (should be 2=North)`);
                print(`Failer follow now enabled: ${cpAfter === 2 ? 'YES' : 'NO'}`);
                
                // Check FC markings visible
                let fcMarkings = game.forehandControl;
                print(`FC constraint active: ${JSON.stringify(fcMarkings, cardReplacer)}`);
                
                // Check own-view marking
                let fcMarkersInHand = document.querySelectorAll('.fc-marker');
                print(`Own-view FC markers: ${fcMarkersInHand.length}`);
                let otherViewMarkers = 0;
                for (let p = 1; p < 4; p++) {
                    let nb = document.getElementById(['desk-south','desk-east','desk-north','desk-west'][p])?.querySelector('.desk-namebar .exposed-preview');
                    if (nb) {
                        let marked = nb.querySelectorAll('[data-fc]');
                        otherViewMarkers += marked.length;
                    }
                }
                print(`Other-view FC markings: ${otherViewMarkers}`);
                print(`Own-view marking visible: ${fcMarkersInHand.length > 0 ? 'YES' : 'NO'}`);
                print(`Other-view marking visible: ${otherViewMarkers > 0 ? 'YES' : 'NO'}`);
                
                // North follows with a card
                // Need to handle that North is bot-controlled for play (restore HUMAN_PLAYERS)
                HUMAN_PLAYERS = wasHumanPlayers;
                
                // North plays a follow card
                let northFollowCards = game.hands[2].filter(c => c.division === 2);
                if (northFollowCards.length === 0) northFollowCards = [game.hands[2][0]];
                let nFollow = [northFollowCards[0]];
                print(`\nNorth follows with: ${nFollow[0].suitName}${nFollow[0].rankName}`);
                let nr = enginePlayCards(2, nFollow);
                print(`North follow result: success=${nr.success}${nr.error ? ', error=' + nr.error : ''}`);
                if (nr.success) {
                    renderDeskCards(2, nFollow);
                    renderHand(0); // refresh own view
                    for (let p = 0; p < 4; p++) {
                        if (p !== 0) updateExposedPreview(p);
                    }
                }
                
                // Complete remaining follows for this round
                for (let i = followOrder.indexOf(2) + 1; i < followOrder.length; i++) {
                    let pp = followOrder[i];
                    let followC = [game.hands[pp][0]]; // just play first card
                    let rr = enginePlayCards(pp, followC);
                    if (rr.success) renderDeskCards(pp, followC);
                }
                
                if (game.currentTurnIndex >= 4) {
                    engineEndRound();
                }
                
                break; // Done with this follow order
            } else {
                // Other player follows normally
                let followCards = [game.hands[fp][0]]; // Play first card
                // If they have hearts, prefer that
                let fpHearts = game.hands[fp].filter(c => c.division === 2);
                if (fpHearts.length > 0) followCards = [fpHearts[0]];
                
                let fr = enginePlayCards(fp, followCards);
                print(`Player ${fp} follows with ${followCards[0].suitName}${followCards[0].rankName}: success=${fr.success}`);
                if (fr.success) renderDeskCards(fp, followCards);
            }
        }
    } else {
        print('ERROR: Leader has no hearts for round 2. Scenario setup issue.');
    }
    
    // === STEP 6: New game reset ===
    print('\n=== STEP 6: New game reset ===');
    startNewGame();
    
    // Fast-deal
    while (game.phase === GamePhase.DEALING) {
        engineDealNextBatch();
    }
    
    print(stateSnapshot('Step 6 — After new game'));
    
    // Check for leaks
    let strayConfirmBtn = document.getElementById('btn-play');
    let hasStrayConfirm = strayConfirmBtn && (strayConfirmBtn.textContent.includes('确认') || strayConfirmBtn.textContent.includes('Confirm'));
    
    print('After new game:');
    print(`FailedMultiplayState cleared: ${game.failedMultiplay === null ? 'YES' : 'NO'}`);
    print(`ExposedCardState cleared: ${Object.keys(game.exposedCards).length === 0 ? 'YES' : 'NO'}`);
    print(`ForehandControlChanceState cleared: ${Object.keys(game.fcChances).length === 0 ? 'YES' : 'NO'}`);
    print(`ForehandControlPendingTriggerState cleared: ${game.fcPending === null ? 'YES' : 'NO'}`);
    print(`ForehandControlInteractionState cleared: ${gFCInteraction === null ? 'YES' : 'NO'}`);
    print(`Stray 确认标记 button present: ${hasStrayConfirm ? 'YES' : 'NO'}`);
    
    // Check no exposed-preview remnants
    let anyHasExposed = document.querySelectorAll('.has-exposed');
    let anyFcActive = document.querySelectorAll('.fc-active');
    print(`Stale has-exposed elements: ${anyHasExposed.length}`);
    print(`Stale fc-active elements: ${anyFcActive.length}`);

    // === Section 4: Contradiction check ===
    print('\n=== Section 4: Contradiction check ===');
    print('Was any earlier YES/COMPLETE statement incorrect? To be determined by trace evidence above.');
    
    // === Section 5: File/function mapping ===
    print('\n=== Section 5: File/Function Mapping ===');
    print(`
Transition: Failed-multiplay resolution
File: static/js/games/shengji/shengji_engine.js
Function: enginePlayCards → engineRegisterFailedMultiplay
Condition: engineIsLegalLead returns failedMultiplay object (blockedEvents non-empty)
State changes: game.failedMultiplay set, game.exposedCards updated, game.fcChances incremented

Transition: 1-second hold completion
File: static/js/pages/game/index.js
Function: handleFailedMultiplay (setTimeout callback at 1000ms)
Condition: setTimeout fires after 1 second
State changes: game.failedMultiplay.holdInProgress→false, revocationApplied→true; desk re-rendered with actual element; exposed previews updated

Transition: Later forehand-control trigger activation
File: static/js/games/shengji/shengji_engine.js
Function: engineCheckFCTrigger (called from promptCurrentPlayer in index.js)
Condition: failer is following, led division has exposed cards, fcChances[failer].count > 0
State changes: game.fcPending set with all trigger details

Transition: Forehand-control commit
File: static/js/pages/game/index.js → static/js/games/shengji/shengji_engine.js
Function: commitForehandControl → engineExerciseFC
Condition: Human clicks must-play or must-hold button (or main play button as fallback)
State changes: game.fcChances decremented, game.forehandControl set, game.fcPending cleared, gFCInteraction cleared

Transition: Exposed-card removal after later play
File: static/js/games/shengji/shengji_engine.js
Function: engineDecayExposedCards (called from enginePlayCards after any player plays)
Condition: played cards include cards in game.exposedCards
State changes: matching cards removed from game.exposedCards[player][division]; empty divisions/players cleaned up

Transition: New-frame reset
File: static/js/games/shengji/shengji_engine.js + static/js/pages/game/index.js
Function: engineStartGame (clears engine state) + startNewGame (clears gFCInteraction)
Condition: new frame starts
State changes: game.failedMultiplay=null, game.exposedCards={}, game.fcChances={}, game.fcPending=null, game.forehandControl=null, gFCInteraction=null

Transition: New-game reset
File: static/js/games/shengji/shengji_engine.js + static/js/pages/game/index.js
Function: engineStartGame + startNewGame + initPersistentNamebars + clearDesk + resetAllNamebars
Condition: new game starts
State changes: All engine state cleared + all UI state cleared + DOM namebars recreated fresh
`);

    print('\n=== TRACE COMPLETE ===');
    print('\nFull log available in window._note23Log');
    window._note23Log = log;
    
    // Copy to clipboard
    try {
        await navigator.clipboard.writeText(log);
        print('(Log copied to clipboard)');
    } catch(e) {
        print('(Could not copy to clipboard. Access window._note23Log)');
    }
}

function continueAfterHold(result) {
    // This is called by handleFailedMultiplay's setTimeout callback
    // State should already be updated inside the callback
}

// Run the trace
runTrace();
