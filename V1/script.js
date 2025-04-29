// --- ค่าคงที่และตัวแปรสถานะ ---
const GRID_ROWS = 6;
const GRID_COLS = 12;
const MIN_RESULTS_FOR_PREDICTION = 8;
const MAX_CONSECUTIVE_LOSSES = 5;
const MAX_STREAK_DISPLAY = 6;

// อ้างอิงไปยัง Element ในหน้าเว็บ
const gridElement = document.getElementById("baccarat-grid");
const predictionOutput = document.getElementById("prediction-output");
const btnBanker = document.getElementById("btn-banker");
const btnPlayer = document.getElementById("btn-player");
const btnTie = document.getElementById("btn-tie");
const btnUndo = document.getElementById("btn-undo");
const btnResetNormal = document.getElementById("btn-reset-normal");
const btnResetSave = document.getElementById("btn-reset-save");
const chartCanvas = document.getElementById("winChart");
const textInputSequence = document.getElementById("text-input-sequence");
const btnSubmitSequence = document.getElementById("btn-submit-sequence");
const textInputStatus = document.getElementById("text-input-status");
const statTotalPredictions = document.getElementById("stat-total-predictions");
const winStreakStatsDiv = document.getElementById("win-streak-stats");
const lossStreakStatsDiv = document.getElementById("loss-streak-stats");
const statLastOutcome = document.getElementById("stat-last-outcome");
const statTotalWins = document.getElementById("stat-total-wins");
const statTotalLosses = document.getElementById("stat-total-losses");


// ตัวแปรสถานะของแอปพลิเคชัน
let results = [];
let currentFillRow = 0;
let currentFillCol = 0;
let tieWins = 0;
let rounds = 0;
let chartInstance = null;
let isProcessingTextInput = false;

// ตัวแปรสถานะสำหรับการทำนายและคะแนนในกราฟ
let predictionScore = 0;
let consecutiveLosses = 0;
let lastPrediction = '-'; // Prediction for the *next* round
let predictionAttemptNumber = 0; // Counts completed prediction attempts
let consecutiveWins = 0;
let lastPredictionOutcome = null; // 'win', 'loss', or null for the *last completed* attempt
let totalPredictionWins = 0;
let totalPredictionLosses = 0;


// ตัวแปรเก็บประวัติคะแนนและสถานะสำหรับการ Undo
// Each index corresponds to the state *after* prediction attempt 'index+1' was completed
let scoreHistory = [];
let predictionAttemptHistory = []; // Stores the attempt number (1, 2, 3...)
let lastPredictionHistory = []; // Stores the prediction that *was evaluated* in that attempt
let winStreakCounts = {};
let lossStreakCounts = {};
let winStreakCountsHistory = [];
let lossStreakCountsHistory = [];
let consecutiveWinsHistory = []; // History of consecutiveWins *after* the attempt
let consecutiveLossesHistory = []; // History of consecutiveLosses *after* the attempt
let lastPredictionOutcomeHistory = []; // History of the outcome ('win'/'loss')
let totalWinsHistory = [];
let totalLossesHistory = [];


// --- รูปแบบการทำนาย ---
const predictionPatterns = {
    'PPPP': 'P', 'PPPB': 'B', 'PPBP': 'P', 'PPBB': 'P',
    'PBPP': 'P', 'PBBP': 'P', 'PBBB': 'B', 'BBBB': 'B',
    'BBBP': 'P', 'BBPB': 'B', 'BBPP': 'B', 'BPBB': 'B',
    'BPPB': 'B', 'BPPP': 'P', 'BPBP': 'B', 'PBPB': 'P',
};

// --- ฟังก์ชันเริ่มต้น ---
function initializeGrid() {
    gridElement.innerHTML = "";
    currentFillRow = 0;
    currentFillCol = 0;
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            const cell = document.createElement("div");
            cell.classList.add("grid-cell");
            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.id = `cell-${r}-${c}`;
            gridElement.appendChild(cell);
        }
    }
}

function initializeChart() {
    if (chartInstance) { chartInstance.destroy(); }
    const ctx = chartCanvas.getContext("2d");
    chartInstance = new Chart(ctx, {
        type: "line",
        data: { labels: [], datasets: [ { label: "คะแนนสูตร", data: [], borderColor: "#ef4444", backgroundColor: "rgba(239, 68, 68, 0.3)", fill: true, tension: 0.1, } ], },
        options: {
            responsive: true, maintainAspectRatio: false,
            animation: { duration: 0 },
            scales: {
                x: { title: { display: true, text: "รอบการทำนาย", font: { family: "'Sarabun', sans-serif" } }, ticks: { stepSize: 1 }, grid: { display: true, color: 'rgba(0, 0, 0, 0.1)' }, min: 1 },
                y: { title: { display: true, text: "คะแนน", font: { family: "'Sarabun', sans-serif" } }, ticks: { stepSize: 1 }, grid: { display: true, color: 'rgba(0, 0, 0, 0.1)' } },
            },
            plugins: { legend: { labels: { font: { family: "'Sarabun', sans-serif" } } } },
            interaction: { intersect: false, mode: "index" },
        },
    });
}

// --- ตรรกะการอัปเดตตาราง ---
function drawCell(row, col, result) {
    const cellId = `cell-${row}-${col}`;
    const cell = document.getElementById(cellId);
    if (cell) {
        cell.classList.remove("banker", "player", "tie");
        cell.innerHTML = "";
        if (result === "B") cell.classList.add("banker");
        else if (result === "P") cell.classList.add("player");
        else if (result === "T") cell.classList.add("tie");
    } else { console.error(`Cell not found: ${cellId}`); }
}

// --- ตรรกะการอัปเดตกราฟ ---
function rebuildChartFromHistory() {
    if (isProcessingTextInput) return;
    if (!chartInstance) { initializeChart(); return; }
    const labels = [...predictionAttemptHistory];
    const data = [...scoreHistory];
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = data;
    chartInstance.update();
}

// --- ฟังก์ชันอัปเดตสถิติสรุป ---
function updateSummaryStats() {
    statTotalPredictions.textContent = predictionAttemptNumber;
    statTotalWins.textContent = totalPredictionWins;
    statTotalLosses.textContent = totalPredictionLosses;

    if (lastPredictionOutcome === 'win') {
        statLastOutcome.textContent = '(ชนะ)';
        statLastOutcome.className = 'text-xs ml-1 text-green-600';
    } else if (lastPredictionOutcome === 'loss') {
        statLastOutcome.textContent = '(แพ้)';
        statLastOutcome.className = 'text-xs ml-1 text-red-600';
    } else {
        statLastOutcome.textContent = '';
        statLastOutcome.className = 'text-xs ml-1';
    }

    winStreakStatsDiv.innerHTML = '';
    let hasWinStreaks = false;
    const sortedWinKeys = Object.keys(winStreakCounts).map(Number).sort((a, b) => a - b);
    sortedWinKeys.forEach(streakLength => {
        const count = winStreakCounts[streakLength];
        if (count > 0) {
            hasWinStreaks = true;
            const p = document.createElement('p');
            p.innerHTML = `ชนะติดต่อ ${streakLength} ครั้ง : <span class="font-medium text-green-600">${count}</span> รอบ`;
            winStreakStatsDiv.appendChild(p);
        }
    });
    if (consecutiveWins > 0) {
        hasWinStreaks = true;
        const p = document.createElement('p');
        p.innerHTML = `<i>(กำลังชนะติดต่อ ${consecutiveWins} ครั้ง)</i>`;
        p.classList.add('text-gray-500', 'italic');
        winStreakStatsDiv.appendChild(p);
    }
    if (!hasWinStreaks) { winStreakStatsDiv.innerHTML = '<p class="text-xs text-gray-500">ยังไม่มีข้อมูล</p>'; }

    lossStreakStatsDiv.innerHTML = '';
    let hasLossStreaks = false;
    const sortedLossKeys = Object.keys(lossStreakCounts).map(Number).sort((a, b) => a - b);
    sortedLossKeys.forEach(streakLength => {
        const count = lossStreakCounts[streakLength];
        if (count > 0) {
            hasLossStreaks = true;
            const p = document.createElement('p');
            p.innerHTML = `แพ้ติดต่อ ${streakLength} ครั้ง : <span class="font-medium text-red-600">${count}</span> รอบ`;
            lossStreakStatsDiv.appendChild(p);
        }
    });
    if (consecutiveLosses > 0) {
        hasLossStreaks = true;
        const p = document.createElement('p');
        p.innerHTML = `<i>(กำลังแพ้ติดต่อ ${consecutiveLosses} ครั้ง)</i>`;
        p.classList.add('text-gray-500','italic');
        lossStreakStatsDiv.appendChild(p);
    }
    if (!hasLossStreaks) { lossStreakStatsDiv.innerHTML = '<p class="text-xs text-gray-500">ยังไม่มีข้อมูล</p>'; }
}

// --- ตรรกะการทำนายผล ---
function predictNext() {
    const nonTieResults = results.filter((r) => r !== "T");
    const nonTieLen = nonTieResults.length;
    if (nonTieLen < MIN_RESULTS_FOR_PREDICTION || nonTieLen < 4) return '-';
    const lastFour = nonTieResults.slice(-4).join('');
    const prediction = predictionPatterns[lastFour];
    return prediction !== undefined ? prediction : '-';
}

function displayPrediction(prediction) {
    let predictionText = "-";
    if (prediction === "B") predictionText = '<span class="text-red-600">เจ้ามือ (Banker)</span>';
    else if (prediction === "P") predictionText = '<span class="text-blue-600">ผู้เล่น (Player)</span>';
    predictionOutput.innerHTML = `ผลคาดเดา: ${predictionText}`;
}


// --- ตัวจัดการเหตุการณ์ ---

function handleResult(actualResult) {
    if (currentFillCol >= GRID_COLS) {
        console.warn("ตารางเต็มแล้ว ไม่สามารถเพิ่มข้อมูลได้");
        return false;
    }

    const predictionForThisRound = lastPrediction;
    const winsBefore = consecutiveWins;
    const lossesBefore = consecutiveLosses;
    const winCountsBefore = { ...winStreakCounts };
    const lossCountsBefore = { ...lossStreakCounts };
    const totalWinsBefore = totalPredictionWins; // เก็บค่ารวมก่อน
    const totalLossesBefore = totalPredictionLosses; // เก็บค่ารวมก่อน

    results.push(actualResult);
    rounds++;

    let currentRoundOutcome = null;
    let attemptNumberForHistory = predictionAttemptNumber; // ใช้ค่าปัจจุบันก่อน ถ้าไม่มีการประเมินผล
    let predictionAttemptedThisRound = false;

    if (actualResult === 'T') {
        tieWins++;
        currentRoundOutcome = null;
    } else {
        const nonTieResults = results.filter((r) => r !== "T");
        const nonTieLen = nonTieResults.length;

        if (predictionForThisRound !== '-') {
            if ((nonTieLen - 1) >= MIN_RESULTS_FOR_PREDICTION) {
                 // *** เพิ่ม predictionAttemptNumber ที่นี่ ก่อนบันทึก history ***
                 predictionAttemptNumber++;
                 attemptNumberForHistory = predictionAttemptNumber; // อัปเดตค่าสำหรับ history
                 predictionAttemptedThisRound = true;

                let predictionCorrect = (actualResult === predictionForThisRound);
                currentRoundOutcome = predictionCorrect ? 'win' : 'loss';

                if (predictionCorrect) {
                    predictionScore++; totalPredictionWins++; consecutiveWins++;
                    if (lossesBefore > 0) { lossStreakCounts[lossesBefore] = (lossStreakCounts[lossesBefore] || 0) + 1; }
                    consecutiveLosses = 0;
                } else {
                    totalPredictionLosses++; consecutiveLosses++;
                    if (winsBefore > 0) { winStreakCounts[winsBefore] = (winStreakCounts[winsBefore] || 0) + 1; }
                    consecutiveWins = 0;
                    if (consecutiveLosses > MAX_CONSECUTIVE_LOSSES) {
                        predictionScore--;
                        lossStreakCounts[consecutiveLosses] = (lossStreakCounts[consecutiveLosses] || 0) + 1;
                        consecutiveLosses = 0;
                    }
                }
            } else { currentRoundOutcome = null; }
        } else { currentRoundOutcome = null; }
    }

     lastPredictionOutcome = currentRoundOutcome; // อัปเดตสถานะ global

    // --- Push state to history *only if* a prediction attempt was evaluated ---
    if (predictionAttemptedThisRound) {
        scoreHistory.push(predictionScore);
        winStreakCountsHistory.push(winCountsBefore); // Store counts *before* modification
        lossStreakCountsHistory.push(lossCountsBefore);
        consecutiveWinsHistory.push(winsBefore); // Store streak *before* modification
        consecutiveLossesHistory.push(lossesBefore);
        predictionAttemptHistory.push(attemptNumberForHistory); // Store the incremented attempt number
        lastPredictionHistory.push(predictionForThisRound);
        lastPredictionOutcomeHistory.push(currentRoundOutcome);
        totalWinsHistory.push(totalWinsBefore); // Store total *before* modification
        totalLossesHistory.push(totalLossesBefore);
    }

    // Update chart only if a prediction attempt happened
    if (predictionAttemptedThisRound) {
       rebuildChartFromHistory();
    }

    updateSummaryStats();
    drawCell(currentFillRow, currentFillCol, actualResult);
    currentFillRow++;
    if (currentFillRow >= GRID_ROWS) { currentFillRow = 0; currentFillCol++; }
    const nextPrediction = predictNext();
    lastPrediction = nextPrediction;
    displayPrediction(nextPrediction);
    return true;
}


function handleUndo() {
    if (results.length === 0) { console.log("ไม่มีข้อมูลให้ย้อนกลับ"); return; }

    const undoneResult = results.pop();
    rounds--;
    if (undoneResult === 'T') tieWins--;

    // Calculate previous cell position
    if (currentFillRow === 0) {
        if (currentFillCol > 0) { currentFillCol--; currentFillRow = GRID_ROWS - 1; }
        else { console.warn("Undo on first element or empty grid state."); }
    } else { currentFillRow--; }

    // Clear the cell
    drawCell(currentFillRow, currentFillCol, null);

    // *** ตรวจสอบว่ารอบที่ Undo มีการบันทึก History หรือไม่ ***
    // โดยดูว่า predictionAttemptNumber ปัจจุบัน (ซึ่งยังไม่ได้ลดค่า)
    // ตรงกับค่าสุดท้ายใน predictionAttemptHistory หรือไม่
    let needsHistoryPop = false;
    if (predictionAttemptHistory.length > 0 &&
        predictionAttemptHistory[predictionAttemptHistory.length - 1] === predictionAttemptNumber)
    {
         needsHistoryPop = true;
    }

    if (needsHistoryPop) {
        // *** ลด predictionAttemptNumber *ก่อน* กู้คืนค่าอื่น ***
        predictionAttemptNumber--;

        // Pop all history arrays
        scoreHistory.pop();
        winStreakCountsHistory.pop();
        lossStreakCountsHistory.pop();
        consecutiveWinsHistory.pop();
        consecutiveLossesHistory.pop();
        predictionAttemptHistory.pop(); // Pop attempt number last
        lastPredictionHistory.pop();
        lastPredictionOutcomeHistory.pop();
        totalWinsHistory.pop();
        totalLossesHistory.pop();

        // Restore state from the *new* end of the history arrays (or initial state if empty)
        if (scoreHistory.length > 0) {
            // Restore values from the state *before* the undone round
            predictionScore = scoreHistory[scoreHistory.length - 1];
            winStreakCounts = { ...(winStreakCountsHistory[winStreakCountsHistory.length - 1] || {}) };
            lossStreakCounts = { ...(lossStreakCountsHistory[lossStreakCountsHistory.length - 1] || {}) };
            consecutiveWins = consecutiveWinsHistory[consecutiveWinsHistory.length - 1];
            consecutiveLosses = consecutiveLossesHistory[consecutiveLossesHistory.length - 1];
            // predictionAttemptNumber ถูกลดค่าไปแล้ว
            lastPrediction = lastPredictionHistory[lastPredictionHistory.length - 1]; // Prediction evaluated in the *restored* state
            lastPredictionOutcome = lastPredictionOutcomeHistory[lastPredictionOutcomeHistory.length - 1];
            totalPredictionWins = totalWinsHistory[totalWinsHistory.length - 1];
            totalPredictionLosses = totalLossesHistory[totalLossesHistory.length - 1];
        } else {
            // Reset to initial state if history is now empty
            predictionScore = 0; winStreakCounts = {}; lossStreakCounts = {};
            consecutiveWins = 0; consecutiveLosses = 0; // predictionAttemptNumber = 0 แล้ว
            lastPrediction = '-'; lastPredictionOutcome = null;
            totalPredictionWins = 0; totalPredictionLosses = 0;
        }
    } else {
        // If the undone round didn't involve a prediction attempt
        // Restore the prediction that *would have been* made for the current state
        // The other state variables (score, counts, streaks, attemptNumber) remain as they were.
        if (lastPredictionHistory.length > 0) {
             // This is the prediction made *before* the undone non-prediction round
             lastPrediction = lastPredictionHistory[lastPredictionHistory.length - 1];
        } else {
             lastPrediction = '-';
        }
        // The outcome of the *restored* state is unknown or null
        lastPredictionOutcome = null;
    }

    // Update UI elements
    updateSummaryStats(); // Update stats based on restored state
    rebuildChartFromHistory(); // Redraw chart based on restored history

    // Determine and display the prediction for the *next* round based on the restored state
    const nextPredictionAfterUndo = predictNext();
    displayPrediction(nextPredictionAfterUndo);

    // *** Crucial: Set lastPrediction correctly for the *next* handleResult call ***
    lastPrediction = nextPredictionAfterUndo;


    console.log("Undo successful. Last result:", undoneResult);
}


function downloadLogFile() {
    if (results.length === 0) {
        alert("ยังไม่มีข้อมูลสำหรับสร้าง Log");
        return false;
    }
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const filename = `log_${year}${month}${day}_${hours}${minutes}${seconds}.txt`;
    const logContent = results.join('');
    const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    console.log(`Log file download initiated: ${filename}`);
    return true;
}

function performReset() {
    results = []; tieWins = 0; rounds = 0;
    predictionScore = 0; consecutiveLosses = 0; consecutiveWins = 0;
    lastPrediction = '-'; predictionAttemptNumber = 0; lastPredictionOutcome = null;
    totalPredictionWins = 0; totalPredictionLosses = 0;
    scoreHistory = []; winStreakCounts = {}; lossStreakCounts = {};
    consecutiveWinsHistory = []; consecutiveLossesHistory = [];
    winStreakCountsHistory = []; lossStreakCountsHistory = [];
    predictionAttemptHistory = []; lastPredictionHistory = [];
    lastPredictionOutcomeHistory = [];
    totalWinsHistory = []; totalLossesHistory = [];

    initializeGrid();
    rebuildChartFromHistory();
    displayPrediction('-');
    textInputSequence.value = '';
    textInputStatus.textContent = '';
    updateSummaryStats();
}

function handleResetNormal() {
    performReset();
    console.log("Grid, stats, and score reset (Normal).");
}

function handleResetSave() {
    if (downloadLogFile()) {
        performReset();
        console.log("Grid, stats, and score reset (Saved Log).");
    } else {
        console.log("Reset cancelled because log could not be generated or download failed.");
    }
}

function handleTextInput() {
    const sequence = textInputSequence.value.toUpperCase();
    if (!sequence) { textInputStatus.textContent = 'กรุณาป้อนลำดับตัวอักษร'; return; }
    isProcessingTextInput = true;
    textInputStatus.textContent = 'กำลังเพิ่มข้อมูล...';
    let addedCount = 0;
    let invalidChars = [];
    let chartNeedsUpdate = false;

    for (let i = 0; i < sequence.length; i++) {
        const char = sequence[i];
        if (['B', 'P', 'T'].includes(char)) {
             const nonTieLenBefore = results.filter(r => r !== 'T').length;
             const shouldAttemptPrediction = (char !== 'T' && lastPrediction !== '-' && nonTieLenBefore >= MIN_RESULTS_FOR_PREDICTION);
            if (!handleResult(char)) { textInputStatus.textContent = `เพิ่มข้อมูลได้ ${addedCount} ตัว (ตารางเต็ม)`; break; }
            addedCount++;
            if (shouldAttemptPrediction) { chartNeedsUpdate = true; }
        } else { invalidChars.push(char); }
    }

    isProcessingTextInput = false;
    if (chartNeedsUpdate) { rebuildChartFromHistory(); }

    if (invalidChars.length > 0) { textInputStatus.textContent = `เพิ่ม ${addedCount} ตัวสำเร็จ. ไม่รู้จัก: ${invalidChars.join(', ')}`; }
    else if (textInputStatus.textContent === 'กำลังเพิ่มข้อมูล...') { textInputStatus.textContent = `เพิ่ม ${addedCount} ตัวสำเร็จ`; }
    textInputSequence.value = '';
    setTimeout(() => { textInputStatus.textContent = ''; }, 3000);
}
btnSubmitSequence.addEventListener('click', handleTextInput);
textInputSequence.addEventListener('keypress', function (e) { if (e.key === 'Enter') handleTextInput(); });

// --- ผูกตัวจัดการเหตุการณ์อื่นๆ ---
btnBanker.addEventListener("click", () => handleResult("B"));
btnPlayer.addEventListener("click", () => handleResult("P"));
btnTie.addEventListener("click", () => handleResult("T"));
btnUndo.addEventListener("click", handleUndo);
btnResetNormal.addEventListener("click", handleResetNormal);
btnResetSave.addEventListener("click", handleResetSave);

// --- การตั้งค่าเริ่มต้นเมื่อโหลดหน้าเว็บ ---
window.onload = () => {
    initializeGrid();
    initializeChart();
    displayPrediction('-');
    updateSummaryStats();
    console.log("Baccarat tracker initialized.");
};
