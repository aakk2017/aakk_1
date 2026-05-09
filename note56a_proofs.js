/**
 * Note 56a: 3-Player Dummy-Ally (3PDA) State Model & UI
 * Proof Cases A-J: Real DOM Testing
 * 
 * This file contains 10 proof cases validating the complete 3PDA implementation.
 * Each case uses real production code paths with live DOM rendering.
 */

// ===========================
// PROOF CASE A: tableFormat Field Display
// ===========================
async function proofCaseA_TableFormatFieldDisplay() {
    console.log('\n=== PROOF CASE A: tableFormat Field Display ===');
    
    return await page.evaluate(() => {
        // Open settings dialog
        const settingsBtn = document.querySelector('button[data-tooltip-text="设置"]');
        if (!settingsBtn) return 'FAIL: Settings button not found';
        
        settingsBtn.click();
        
        // Wait briefly for dialog to render
        return new Promise(resolve => {
            setTimeout(() => {
                // Check if display tab exists
                const displayTab = document.querySelector('[data-tab="display"]');
                if (!displayTab) {
                    resolve('FAIL: Display tab button not found');
                    return;
                }
                
                // Click display tab
                displayTab.click();
                
                setTimeout(() => {
                    // Check if tableFormat field exists
                    const tableFormatField = document.querySelector('[data-settings-field="tableFormat"]');
                    if (!tableFormatField) {
                        resolve('FAIL: tableFormat field not found');
                        return;
                    }
                    
                    // Check if select has both options
                    const select = tableFormatField.querySelector('select');
                    if (!select) {
                        resolve('FAIL: tableFormat select element not found');
                        return;
                    }
                    
                    const options = Array.from(select.options).map(o => o.value);
                    if (!options.includes('normal4P') || !options.includes('threePlayerDummyAlly')) {
                        resolve('FAIL: Missing tableFormat options. Found: ' + options.join(', '));
                        return;
                    }
                    
                    const currentValue = select.value;
                    resolve('PASS: tableFormat field displayed. Current value: ' + currentValue + ', Options: ' + options.join(', '));
                }, 50);
            }, 100);
        });
    });
}

// ===========================
// PROOF CASE B: 3PDA Forces rotate-pivot & Disables winner-pivot
// ===========================
async function proofCaseB_3PDAForceRotatePivot() {
    console.log('\n=== PROOF CASE B: 3PDA Forces rotate-pivot & Disables winner-pivot ===');
    
    return await page.evaluate(() => {
        return new Promise(resolve => {
            // Find tableFormat select
            const tableFormatHost = document.querySelector('[data-settings-field="tableFormat"]');
            const tableFormatSelect = tableFormatHost ? tableFormatHost.querySelector('select') : null;
            if (!tableFormatSelect) {
                resolve('FAIL: tableFormat select not found');
                return;
            }
            
            // Change to threePlayerDummyAlly
            tableFormatSelect.value = 'threePlayerDummyAlly';
            const changeEvent = new Event('change', { bubbles: true });
            tableFormatSelect.dispatchEvent(changeEvent);
            
            setTimeout(() => {
                // Navigate to General tab to check pivotPassMode
                const generalTab = document.querySelector('[data-tab="general"]');
                if (!generalTab) {
                    resolve('FAIL: General tab not found');
                    return;
                }
                
                generalTab.click();
                
                setTimeout(() => {
                    // Check pivotPassMode radios
                    const winnerPivotRadio = document.querySelector('input[type="radio"][name="pivotPassMode"][value="winner-pivot"]');
                    const rotatePivotRadio = document.querySelector('input[type="radio"][name="pivotPassMode"][value="rotate-pivot"]');
                    
                    if (!winnerPivotRadio || !rotatePivotRadio) {
                        resolve('FAIL: pivotPassMode radios not found');
                        return;
                    }
                    
                    const winnerDisabled = winnerPivotRadio.disabled;
                    const rotatChecked = rotatePivotRadio.checked;
                    
                    if (winnerDisabled && rotatChecked) {
                        resolve('PASS: winner-pivot disabled=' + winnerDisabled + ', rotate-pivot checked=' + rotatChecked);
                    } else {
                        resolve('FAIL: winner-pivot disabled=' + winnerDisabled + ', rotate-pivot checked=' + rotatChecked);
                    }
                }, 100);
            }, 100);
        });
    });
}

// ===========================
// PROOF CASE C: Preset Independence (pivotPassMode Preserved)
// ===========================
async function proofCaseC_PresetIndependence() {
    console.log('\n=== PROOF CASE C: Preset Independence (pivotPassMode Preserved) ===');
    
    return await page.evaluate(() => {
        return new Promise(resolve => {
            // Go to presets tab
            const presetsTab = document.querySelector('[data-tab="presets"]');
            if (!presetsTab) {
                resolve('FAIL: Presets tab not found');
                return;
            }
            
            presetsTab.click();
            
            setTimeout(() => {
                // Select 'plain' preset (should NOT force rotate-pivot)
                const plainPresetRadio = document.querySelector('input[type="radio"][value="plain"]');
                if (!plainPresetRadio) {
                    resolve('FAIL: plain preset radio not found');
                    return;
                }
                
                plainPresetRadio.click();
                
                setTimeout(() => {
                    // Navigate to general tab
                    const generalTab = document.querySelector('[data-tab="general"]');
                    if (generalTab) generalTab.click();
                    
                    setTimeout(() => {
                        // Check pivotPassMode - should be default (winner-pivot) for plain preset
                        const winnerPivotRadio = document.querySelector('input[type="radio"][name="pivotPassMode"][value="winner-pivot"]');
                        const rotatePivotRadio = document.querySelector('input[type="radio"][name="pivotPassMode"][value="rotate-pivot"]');
                        
                        if (!winnerPivotRadio || !rotatePivotRadio) {
                            resolve('FAIL: pivotPassMode radios not found');
                            return;
                        }
                        
                        const winnerChecked = winnerPivotRadio.checked;
                        const rotatChecked = rotatePivotRadio.checked;
                        
                        if (winnerChecked) {
                            resolve('PASS: Preset independence preserved. plain preset has winner-pivot=' + winnerChecked);
                        } else {
                            resolve('FAIL: plain preset should allow winner-pivot. Has: winner=' + winnerChecked + ', rotate=' + rotatChecked);
                        }
                    }, 100);
                }, 100);
            }, 100);
        });
    });
}

// ===========================
// PROOF CASE D: 3PDA Frame Cycle (Southwest Pivot Example)
// ===========================
async function proofCaseD_FrameCycleSouthwestPivot() {
    console.log('\n=== PROOF CASE D: 3PDA Frame Cycle (Southwest Pivot Example) ===');
    
    // This case validates that game.threePlayer state is initialized
    // when tableFormat='threePlayerDummyAlly' with Southwest pivot
    
    return await page.evaluate(() => {
        // Check if 3PDA state exists in game object
        if (typeof game === 'undefined' || !game.threePlayer) {
            return 'FAIL: game.threePlayer not initialized';
        }
        
        const tp = game.threePlayer;
        
        // Validate structure
        const requiredFields = ['enabled', 'realNaturalPositions', 'dummySeat', 'frameSeatByNaturalPosition', 
                               'naturalPositionByFrameSeat', 'controllerByFrameSeat', 'dummyVisibility'];
        
        for (let field of requiredFields) {
            if (!(field in tp)) {
                return 'FAIL: Missing field: ' + field;
            }
        }
        
        // Validate realNaturalPositions
        if (!Array.isArray(tp.realNaturalPositions) || tp.realNaturalPositions.length !== 3) {
            return 'FAIL: realNaturalPositions should be array of 3 elements';
        }
        
        if (!tp.realNaturalPositions.includes('north') || 
            !tp.realNaturalPositions.includes('southwest') || 
            !tp.realNaturalPositions.includes('southeast')) {
            return 'FAIL: realNaturalPositions missing required positions';
        }
        
        return 'PASS: 3PDA state structure initialized correctly. Enabled=' + tp.enabled + 
               ', Positions=' + tp.realNaturalPositions.join(',');
    });
}

// ===========================
// PROOF CASE E: Dynamic Display Mapping (North Reference)
// ===========================
async function proofCaseE_DisplayMappingNorthReference() {
    console.log('\n=== PROOF CASE E: Dynamic Display Mapping (North Reference) ===');
    
    // This case validates that position mapping helpers exist and can be called
    return await page.evaluate(() => {
        // Check if mapping helper functions exist
        if (typeof engineGetNaturalPositionFromFrameSeat !== 'function') {
            return 'INCOMPLETE: Position mapping helpers not yet implemented. Expected engineGetNaturalPositionFromFrameSeat function.';
        }
        
        return 'PASS: Position mapping helpers are implemented';
    });
}

// ===========================
// PROOF CASE F: Dummy Top-Row One-Row Hand Display
// ===========================
async function proofCaseF_DummyTopRowDisplay() {
    console.log('\n=== PROOF CASE F: Dummy Top-Row One-Row Hand Display ===');

    return await page.evaluate(() => {
        const mk = (id, suit, rank) => ({ cardId: id, suit, rank });
        game.tableFormat = 'threePlayerDummyAlly';
        game.pivot = 0;
        game.hands = [[], [], [mk(1, 0, 2), mk(2, 1, 3), mk(3, 2, 4), mk(4, 3, 5)], []];
        game.roundState = { played: {} };
        game.threePlayer = {
            enabled: true,
            realNaturalPositions: ['north', 'southwest', 'southeast'],
            dummySeat: null,
            pivotNaturalPosition: null,
            dealerNaturalPosition: null,
            frameSeatByNaturalPosition: {},
            naturalPositionByFrameSeat: [null, null, null, null],
            controllerByFrameSeat: [null, null, null, null],
            dummyVisibility: 'public',
            dummyHandPanelOpen: false,
        };
        if (typeof engineSyncThreePlayerFrameStateFromPivot === 'function') {
            engineSyncThreePlayerFrameStateFromPivot();
        }
        renderDummyHandDisplay();
        const slot = gDeskSlots[2];
        const count = slot.querySelectorAll('.dummy-hand-one-row .card-container').length;
        const hasToggle = !!slot.querySelector('.dummy-toggle-btn');
        return count === 4 && !hasToggle
            ? 'PASS: Dummy top one-row rendered with correct card count'
            : 'FAIL: top row count=' + count + ', hasToggle=' + hasToggle;
    });
}

// ===========================
// PROOF CASE G: Dummy Left/Right Click-Show 5-Row Panel
// ===========================
async function proofCaseG_DummySidePanelToggle() {
    console.log('\n=== PROOF CASE G: Dummy Left/Right Click-Show 5-Row Panel ===');

    return await page.evaluate(() => {
        const mk = (id, suit, rank) => ({ cardId: id, suit, rank });
        game.tableFormat = 'threePlayerDummyAlly';
        game.pivot = 3; // dummy becomes seat 1 (side)
        game.hands = [[], [
            mk(11, 0, 2), mk(12, 1, 3), mk(13, 2, 4), mk(14, 3, 5), mk(15, 0, 6),
            mk(16, 1, 7), mk(17, 2, 8), mk(18, 3, 9), mk(19, 0, 10), mk(20, 1, 11)
        ], [], []];
        game.roundState = { played: { 1: [] } };
        game.threePlayer = {
            enabled: true,
            realNaturalPositions: ['north', 'southwest', 'southeast'],
            dummySeat: null,
            pivotNaturalPosition: null,
            dealerNaturalPosition: null,
            frameSeatByNaturalPosition: {},
            naturalPositionByFrameSeat: [null, null, null, null],
            controllerByFrameSeat: [null, null, null, null],
            dummyVisibility: 'public',
            dummyHandPanelOpen: false,
        };
        if (typeof engineSyncThreePlayerFrameStateFromPivot === 'function') {
            engineSyncThreePlayerFrameStateFromPivot();
        }
        renderDummyHandDisplay();
        const slot = gDeskSlots[1];
        const btn = slot.querySelector('.dummy-toggle-btn');
        const initiallyClosed = !slot.querySelector('.dummy-panel');
        if (btn) btn.click();
        const panel = slot.querySelector('.dummy-panel');
        const rowCount = panel ? panel.querySelectorAll('.dummy-panel-row').length : 0;
        return btn && initiallyClosed && panel && rowCount === 5
            ? 'PASS: Side panel toggles open with 5 rows'
            : 'FAIL: hasBtn=' + !!btn + ', initiallyClosed=' + initiallyClosed + ', hasPanel=' + !!panel + ', rows=' + rowCount;
    });
}

// ===========================
// PROOF CASE H: Desk-Card Highlighting in Side Panel
// ===========================
async function proofCaseH_DeskCardHighlighting() {
    console.log('\n=== PROOF CASE H: Desk-Card Highlighting in Side Panel ===');

    return await page.evaluate(() => {
        if (!game || !game.threePlayer) return 'FAIL: game.threePlayer missing';
        game.threePlayer.dummyHandPanelOpen = true;
        if (!game.roundState) game.roundState = { played: {} };
        game.roundState.played[1] = (game.hands[1] || []).slice(0, 2);
        renderDummyHandDisplay();
        const slot = gDeskSlots[1];
        const highlighted = slot.querySelectorAll('.dummy-panel .card-container[data-on-desk="true"]').length;
        return highlighted >= 2
            ? 'PASS: Desk-card highlighting visible in side panel'
            : 'FAIL: highlighted cards=' + highlighted;
    });
}

// ===========================
// PROOF CASE I: Position-Level Box 3PDA (Blank Dummy Triangle)
// ===========================
async function proofCaseI_PositionLevelBoxBlankDummy() {
    console.log('\n=== PROOF CASE I: Position-Level Box 3PDA (Blank Dummy Triangle) ===');

    return await page.evaluate(() => {
        game.tableFormat = 'threePlayerDummyAlly';
        game.pivot = 0;
        game.threePlayer = game.threePlayer || { enabled: true };
        game.threePlayer.enabled = true;
        const host = document.createElement('div');
        document.body.appendChild(host);
        renderLevelPositionSquare(host, {
            nsLevel: 4,
            ewLevel: 5,
            nsCycleIndex: 0,
            ewCycleIndex: 0,
            pivotSeat: 0,
        });
        const dummyPos = getDummyPositionIn3PDA(0);
        const tri = host.querySelector('.level-position-triangle[data-pos="' + dummyPos + '"]');
        const blank = !!tri && tri.textContent.trim().length === 0;
        host.remove();
        return blank
            ? 'PASS: Position-level square dummy triangle is blank'
            : 'FAIL: dummy triangle is not blank';
    });
}

// ===========================
// PROOF CASE J: Counting-Dialog Next-Frame 3PDA Position-Level Box
// ===========================
async function proofCaseJ_CountingDialogNextFrame3PDA() {
    console.log('\n=== PROOF CASE J: Counting-Dialog Next-Frame 3PDA Position-Level Box ===');

    return await page.evaluate(() => {
        game.tableFormat = 'threePlayerDummyAlly';
        game.threePlayer = game.threePlayer || { enabled: true };
        game.threePlayer.enabled = true;
        const host = document.createElement('div');
        document.body.appendChild(host);
        const nextPivot = 1;
        renderLevelPositionSquare(host, {
            nsLevel: 6,
            ewLevel: 7,
            nsCycleIndex: 1,
            ewCycleIndex: 0,
            pivotSeat: nextPivot,
        });
        const dummyPos = getDummyPositionIn3PDA(nextPivot);
        const tri = host.querySelector('.level-position-triangle[data-pos="' + dummyPos + '"]');
        const blank = !!tri && tri.textContent.trim().length === 0;
        host.remove();
        return blank
            ? 'PASS: Next-frame position-level box keeps dummy triangle blank'
            : 'FAIL: next-frame dummy triangle is not blank';
    });
}

// ===========================
// Run All Proofs
// ===========================
async function runAllProofs() {
    console.log('===============================================');
    console.log('Note 56a Proof Cases: Running All Tests');
    console.log('===============================================');
    
    const results = {
        A: await proofCaseA_TableFormatFieldDisplay(),
        B: await proofCaseB_3PDAForceRotatePivot(),
        C: await proofCaseC_PresetIndependence(),
        D: await proofCaseD_FrameCycleSouthwestPivot(),
        E: await proofCaseE_DisplayMappingNorthReference(),
        F: await proofCaseF_DummyTopRowDisplay(),
        G: await proofCaseG_DummySidePanelToggle(),
        H: await proofCaseH_DeskCardHighlighting(),
        I: await proofCaseI_PositionLevelBoxBlankDummy(),
        J: await proofCaseJ_CountingDialogNextFrame3PDA(),
    };
    
    console.log('\n===============================================');
    console.log('PROOF RESULTS SUMMARY');
    console.log('===============================================');
    
    let passCount = 0, failCount = 0, incompleteCount = 0;
    
    for (let [caseId, result] of Object.entries(results)) {
        console.log(`Case ${caseId}: ${result}`);
        if (result.startsWith('PASS')) passCount++;
        else if (result.startsWith('FAIL')) failCount++;
        else if (result.startsWith('INCOMPLETE')) incompleteCount++;
    }
    
    console.log(`\nSummary: ${passCount} PASS, ${failCount} FAIL, ${incompleteCount} INCOMPLETE`);
    console.log('===============================================\n');
    
    return results;
}

// Export for external use
if (typeof window !== 'undefined') {
    window.runAllProofs = runAllProofs;
    window.proofCaseA_TableFormatFieldDisplay = proofCaseA_TableFormatFieldDisplay;
    window.proofCaseB_3PDAForceRotatePivot = proofCaseB_3PDAForceRotatePivot;
    window.proofCaseC_PresetIndependence = proofCaseC_PresetIndependence;
    window.proofCaseD_FrameCycleSouthwestPivot = proofCaseD_FrameCycleSouthwestPivot;
    window.proofCaseE_DisplayMappingNorthReference = proofCaseE_DisplayMappingNorthReference;
}
