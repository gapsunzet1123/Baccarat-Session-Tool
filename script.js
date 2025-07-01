// --- ค่าคงที่และตัวแปรสถานะ ---
const GRID_ROWS = 6;
const GRID_COLS = 12;
const MIN_RESULTS_FOR_PREDICTION = 8;
const MAX_CONSECUTIVE_LOSSES = 5;
const MAX_STREAK_DISPLAY = 6;
const LOCAL_STORAGE_KEY = 'baccaratSessions'; // Key for storing sessions
const THEME_STORAGE_KEY = 'baccaratTheme'; // Key for storing theme preference

// --- อ้างอิงไปยัง Element ในหน้าเว็บ ---
const gridElement = document.getElementById("baccarat-grid");
const predictionOutput = document.getElementById("prediction-output");
const btnBanker = document.getElementById("btn-banker");
const btnPlayer = document.getElementById("btn-player");
const btnTie = document.getElementById("btn-tie");
const btnUndo = document.getElementById("btn-undo");
const btnClearCurrent = document.getElementById("btn-clear-current");
const btnSaveLogClear = document.getElementById("btn-save-log-clear");
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

// Session Management Elements
const sessionNameInput = document.getElementById("session-name");
const sessionStatus = document.getElementById("session-status");
const btnSaveSession = document.getElementById("btn-save-session");
const savedSessionsSelect = document.getElementById("saved-sessions");
const btnLoadSession = document.getElementById("btn-load-session");
const btnDeleteSession = document.getElementById("btn-delete-session");
const btnNewSession = document.getElementById("btn-new-session");
const currentSessionNameSpan = document.getElementById("current-session-name");

// Theme Toggle Element
const themeToggleButton = document.getElementById("theme-toggle");
const themeToggleIcon = themeToggleButton.querySelector('i');

// --- ตัวแปรสถานะของแอปพลิเคชัน ---
let activeSessionName = "Default";
let results = [];
let currentFillRow = 0;
let currentFillCol = 0;
let tieWins = 0;
let rounds = 0;
let chartInstance = null;
let isProcessingTextInput = false;

// Prediction and Score State
let predictionScore = 1;
let consecutiveLosses = 0;
let lastPrediction = '-';
let predictionAttemptNumber = 0;
let consecutiveWins = 0;
let lastPredictionOutcome = null;
let totalPredictionWins = 0;
let totalPredictionLosses = 0;

// History for Undo and Charting
let scoreHistory = [];
let predictionAttemptHistory = [];
let lastPredictionHistory = [];
let winStreakCounts = {};
let lossStreakCounts = {};
let winStreakCountsHistory = [];
let lossStreakCountsHistory = [];
let consecutiveWinsHistory = [];
let consecutiveLossesHistory = [];
let lastPredictionOutcomeHistory = [];
let totalWinsHistory = [];
let totalLossesHistory = [];

// --- รูปแบบการทำนาย ---
const predictionPatterns = {
    'PPPP': 'P', 'PPPB': 'B', 'PPBP': 'P', 'PPBB': 'P',
    'PBPP': 'P', 'PBBP': 'P', 'PBBB': 'B', 'BBBB': 'B',
    'BBBP': 'P', 'BBPB': 'B', 'BBPP': 'B', 'BPBB': 'B',
    'BPPB': 'B', 'BPPP': 'P', 'BPBP': 'B', 'PBPB': 'P',
};

// --- Theme Functions ---

function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark');
        themeToggleIcon.classList.remove('fa-sun');
        themeToggleIcon.classList.add('fa-moon');
        themeToggleButton.setAttribute('aria-label', 'Switch to light theme');
    } else {
        document.body.classList.remove('dark');
        themeToggleIcon.classList.remove('fa-moon');
        themeToggleIcon.classList.add('fa-sun');
        themeToggleButton.setAttribute('aria-label', 'Switch to dark theme');
    }
    updateChartTheme();
}

function toggleTheme() {
    const newTheme = document.body.classList.contains('dark') ? 'light' : 'dark';
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    applyTheme(newTheme);
}

function loadTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'light';
    applyTheme(savedTheme);
}

// --- Chart Functions ---

function updateChartTheme() {
    if (!chartInstance) return;

    const gridColor = getComputedStyle(document.body).getPropertyValue('--chart-grid-color').trim();
    const labelColor = getComputedStyle(document.body).getPropertyValue('--chart-label-color').trim();
    const lineColor = getComputedStyle(document.body).getPropertyValue('--chart-line-color').trim();
    const fillColor = getComputedStyle(document.body).getPropertyValue('--chart-fill-color').trim();

    chartInstance.options.scales.x.grid.color = gridColor;
    chartInstance.options.scales.y.grid.color = gridColor;
    chartInstance.options.scales.x.ticks.color = labelColor;
    chartInstance.options.scales.y.ticks.color = labelColor;
    chartInstance.options.scales.x.title.color = labelColor;
    chartInstance.options.scales.y.title.color = labelColor;
    chartInstance.options.plugins.legend.labels.color = labelColor;

    chartInstance.data.datasets[0].borderColor = lineColor;
    chartInstance.data.datasets[0].backgroundColor = fillColor;

    chartInstance.update();
}

function initializeChart() {
    if (chartInstance) {
        chartInstance.destroy();
    }
    const ctx = chartCanvas.getContext("2d");

    const initialLabelColor = getComputedStyle(document.body).getPropertyValue('--chart-label-color').trim();
    const initialGridColor = getComputedStyle(document.body).getPropertyValue('--chart-grid-color').trim();
    const initialLineColor = getComputedStyle(document.body).getPropertyValue('--chart-line-color').trim();
    const initialFillColor = getComputedStyle(document.body).getPropertyValue('--chart-fill-color').trim();

    chartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: [],
            datasets: [{
                label: "คะแนนสูตร",
                data: [],
                borderColor: initialLineColor,
                backgroundColor: initialFillColor,
                fill: true,
                tension: 0.1,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 0 },
            scales: {
                x: {
                    title: { display: true, text: "รอบการทำนาย", font: { family: "'Sarabun', sans-serif" }, color: initialLabelColor },
                    ticks: { stepSize: 1, color: initialLabelColor },
                    grid: { display: true, color: initialGridColor },
                    min: 1
                },
                y: {
                    title: { display: true, text: "คะแนน", font: { family: "'Sarabun', sans-serif" }, color: initialLabelColor },
                    ticks: { stepSize: 1, color: initialLabelColor },
                    grid: { display: true, color: initialGridColor }
                },
            },
            plugins: {
                legend: { labels: { font: { family: "'Sarabun', sans-serif" }, color: initialLabelColor } }
            },
            interaction: {
                intersect: false,
                mode: "index"
            },
        },
    });
}

// --- Grid Functions ---

function initializeGrid() {
    gridElement.innerHTML = "";
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

function redrawGrid() {
    initializeGrid();
    let tempRow = 0;
    let tempCol = 0;
    results.forEach(result => {
        if (tempCol < GRID_COLS) {
            drawCell(tempRow, tempCol, result);
            tempRow++;
            if (tempRow >= GRID_ROWS) {
                tempRow = 0;
                tempCol++;
            }
        }
    });
    currentFillRow = tempRow;
    currentFillCol = tempCol;
}

// --- Chart Update ---
function rebuildChartFromHistory() {
    if (isProcessingTextInput) return;
    if (!chartInstance) {
        initializeChart();
        return;
    }
    const labels = [...predictionAttemptHistory];
    const data = [...scoreHistory];
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = data;
    updateChartTheme();
}

// --- Summary Stats Update ---
function updateSummaryStats() {
    statTotalPredictions.textContent = predictionAttemptNumber;
    statTotalWins.textContent = totalPredictionWins;
    statTotalLosses.textContent = totalPredictionLosses;
    currentSessionNameSpan.textContent = activeSessionName;

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
    sortedWinKeys.slice(-MAX_STREAK_DISPLAY).forEach(streakLength => {
        const count = winStreakCounts[streakLength];
        if (count > 0) {
            hasWinStreaks = true;
            const p = document.createElement('p');
            p.className = 'text-xs';
            p.innerHTML = `ชนะติดต่อ ${streakLength} ครั้ง : <span class="font-medium text-green-600">${count}</span> รอบ`;
            winStreakStatsDiv.appendChild(p);
        }
    });
    if (consecutiveWins > 0) {
        hasWinStreaks = true;
        const p = document.createElement('p');
        p.className = 'text-xs text-gray-500 italic';
        p.innerHTML = `<i>(กำลังชนะติดต่อ ${consecutiveWins} ครั้ง)</i>`;
        winStreakStatsDiv.appendChild(p);
    }
    if (!hasWinStreaks) {
        winStreakStatsDiv.innerHTML = '<p class="text-xs text-gray-500">ยังไม่มีข้อมูล</p>';
    }

    lossStreakStatsDiv.innerHTML = '';
    let hasLossStreaks = false;
    const sortedLossKeys = Object.keys(lossStreakCounts).map(Number).sort((a, b) => a - b);
    sortedLossKeys.slice(-MAX_STREAK_DISPLAY).forEach(streakLength => {
        const count = lossStreakCounts[streakLength];
        if (count > 0) {
            hasLossStreaks = true;
            const p = document.createElement('p');
            p.className = 'text-xs';
            p.innerHTML = `แพ้ติดต่อ ${streakLength} ครั้ง : <span class="font-medium text-red-600">${count}</span> รอบ`;
            lossStreakStatsDiv.appendChild(p);
        }
    });
    if (consecutiveLosses > 0) {
        hasLossStreaks = true;
        const p = document.createElement('p');
        p.className = 'text-xs text-gray-500 italic';
        p.innerHTML = `<i>(กำลังแพ้ติดต่อ ${consecutiveLosses} ครั้ง)</i>`;
        lossStreakStatsDiv.appendChild(p);
    }
    if (!hasLossStreaks) {
        lossStreakStatsDiv.innerHTML = '<p class="text-xs text-gray-500">ยังไม่มีข้อมูล</p>';
    }
}

// --- Prediction Logic ---
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
    if (prediction === "B") {
        predictionText = '<span class="text-red-600">เจ้ามือ (Banker)</span>';
    } else if (prediction === "P") {
        predictionText = '<span class="text-blue-600">ผู้เล่น (Player)</span>';
    }
    predictionOutput.innerHTML = `ผลคาดเดา: ${predictionText}`;
}

// --- Event Handlers ---
function handleResult(actualResult) {
    if (currentFillCol >= GRID_COLS) {
        setStatusMessage("ตารางเต็มแล้ว", "text-red-500", textInputStatus);
        return false;
    }

    const predictionForThisRound = lastPrediction;
    const winsBefore = consecutiveWins;
    const lossesBefore = consecutiveLosses;
    const winCountsBefore = { ...winStreakCounts };
    const lossCountsBefore = { ...lossStreakCounts };
    const totalWinsBefore = totalPredictionWins;
    const totalLossesBefore = totalPredictionLosses;

    results.push(actualResult);
    rounds++;

    let currentRoundOutcome = null;
    let attemptNumberForHistory = predictionAttemptNumber;
    let predictionAttemptedThisRound = false;

    if (actualResult === 'T') {
        tieWins++;
        currentRoundOutcome = null;
        lastPredictionOutcome = null;
    } else {
        const nonTieResults = results.filter((r) => r !== "T");
        const nonTieLen = nonTieResults.length;

        if (predictionForThisRound !== '-') {
            if ((nonTieLen - 1) >= MIN_RESULTS_FOR_PREDICTION) {
                predictionAttemptNumber++;
                attemptNumberForHistory = predictionAttemptNumber;
                predictionAttemptedThisRound = true;

                let predictionCorrect = (actualResult === predictionForThisRound);
                currentRoundOutcome = predictionCorrect ? 'win' : 'loss';
                lastPredictionOutcome = currentRoundOutcome;

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
            } else { currentRoundOutcome = null; lastPredictionOutcome = null; }
        } else { currentRoundOutcome = null; lastPredictionOutcome = null; }
    }

    if (predictionAttemptedThisRound) {
        scoreHistory.push(predictionScore);
        winStreakCountsHistory.push(winCountsBefore);
        lossStreakCountsHistory.push(lossCountsBefore);
        consecutiveWinsHistory.push(winsBefore);
        consecutiveLossesHistory.push(lossesBefore);
        predictionAttemptHistory.push(attemptNumberForHistory);
        lastPredictionHistory.push(predictionForThisRound);
        lastPredictionOutcomeHistory.push(currentRoundOutcome);
        totalWinsHistory.push(totalWinsBefore);
        totalLossesHistory.push(totalLossesBefore);
    }

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
    if (results.length === 0) {
        setStatusMessage("ไม่มีข้อมูลให้ย้อนกลับ", "text-yellow-600", textInputStatus);
        return;
    }

    const undoneResult = results.pop();
    rounds--;
    if (undoneResult === 'T') tieWins--;

    // Recalculate the position of the cell to clear and set the new cursor position
    let previousRow, previousCol;
    if (currentFillRow === 0) {
        if (currentFillCol > 0) {
            previousCol = currentFillCol - 1;
            previousRow = GRID_ROWS - 1;
        } else {
            // This case should ideally not be hit if results.length > 0
            previousCol = 0;
            previousRow = 0;
        }
    } else {
        previousCol = currentFillCol;
        previousRow = currentFillRow - 1;
    }

    currentFillRow = previousRow;
    currentFillCol = previousCol;

    // Clear the cell at the new cursor position (which was the last filled cell)
    drawCell(currentFillRow, currentFillCol, null);

    // Check if the undone action corresponds to a prediction attempt
    let needsHistoryPop = false;
    if (predictionAttemptHistory.length > 0 &&
        predictionAttemptHistory[predictionAttemptHistory.length - 1] === predictionAttemptNumber) {
        needsHistoryPop = true;
    }

    if (needsHistoryPop) {
        predictionAttemptNumber--;
        scoreHistory.pop(); winStreakCountsHistory.pop(); lossStreakCountsHistory.pop();
        consecutiveWinsHistory.pop(); consecutiveLossesHistory.pop();
        predictionAttemptHistory.pop(); lastPredictionHistory.pop();
        lastPredictionOutcomeHistory.pop(); totalWinsHistory.pop(); totalLossesHistory.pop();

        if (scoreHistory.length > 0) {
            // Restore state from the previous point in history
            predictionScore = scoreHistory[scoreHistory.length - 1];
            winStreakCounts = { ...(winStreakCountsHistory[winStreakCountsHistory.length - 1] || {}) };
            lossStreakCounts = { ...(lossStreakCountsHistory[lossStreakCountsHistory.length - 1] || {}) };
            consecutiveWins = consecutiveWinsHistory[consecutiveWinsHistory.length - 1];
            consecutiveLosses = consecutiveLossesHistory[consecutiveLossesHistory.length - 1];
            lastPrediction = lastPredictionHistory[lastPredictionHistory.length - 1];
            lastPredictionOutcome = lastPredictionOutcomeHistory[lastPredictionOutcomeHistory.length - 1];
            totalPredictionWins = totalWinsHistory[totalWinsHistory.length - 1];
            totalPredictionLosses = totalLossesHistory[totalLossesHistory.length - 1];
        } else {
            // ***** BUG FIX START *****
            // This is the fix: Instead of calling clearAppState(), which resets the grid cursor,
            // we only reset the prediction-related variables to their initial state.
            // The grid cursor (currentFillRow, currentFillCol) remains untouched.
            predictionScore = 1;
            consecutiveLosses = 0;
            consecutiveWins = 0;
            lastPrediction = '-';
            predictionAttemptNumber = 0;
            lastPredictionOutcome = null;
            totalPredictionWins = 0;
            totalPredictionLosses = 0;
            winStreakCounts = {};
            lossStreakCounts = {};
            // History arrays are already empty from being popped.
            // ***** BUG FIX END *****
        }
    } else {
        // If no prediction history was popped, just update the last prediction outcome
        if (lastPredictionHistory.length > 0) {
            lastPrediction = lastPredictionHistory[lastPredictionHistory.length - 1];
        } else {
            lastPrediction = predictNext();
        }
        lastPredictionOutcome = null;
    }

    updateSummaryStats();
    rebuildChartFromHistory();

    // Recalculate what the next prediction should be based on the new state
    const nextPredictionAfterUndo = predictNext();
    lastPrediction = nextPredictionAfterUndo;
    displayPrediction(lastPrediction);

    setStatusMessage("ย้อนกลับสำเร็จ", "text-green-600", textInputStatus);
}


// --- Log File Function ---
function downloadLogFile() {
    if (results.length === 0) {
        alert("ยังไม่มีข้อมูลสำหรับสร้าง Log");
        return false;
    }
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const sessionPart = activeSessionName !== "Default" ? `_${activeSessionName.replace(/[^a-zA-Z0-9]/g, '_')}` : "";
    const filename = `baccarat_log${sessionPart}_${timestamp}.txt`;
    const logContent = results.join('');
    const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);
    console.log(`Log file download initiated: ${filename}`);
    return true;
}

// --- Reset and Clear Functions ---
function clearAppState(resetNameToDefault = true) {
    results = []; tieWins = 0; rounds = 0; currentFillRow = 0; currentFillCol = 0;
    predictionScore = 1; consecutiveLosses = 0; consecutiveWins = 0; lastPrediction = '-';
    predictionAttemptNumber = 0; lastPredictionOutcome = null; totalPredictionWins = 0; totalPredictionLosses = 0;
    scoreHistory = []; winStreakCounts = {}; lossStreakCounts = {}; consecutiveWinsHistory = [];
    consecutiveLossesHistory = []; winStreakCountsHistory = []; lossStreakCountsHistory = [];
    predictionAttemptHistory = []; lastPredictionHistory = []; lastPredictionOutcomeHistory = [];
    totalWinsHistory = []; totalLossesHistory = [];
    if (resetNameToDefault) {
        activeSessionName = "Default";
        sessionNameInput.value = "";
    }
    textInputSequence.value = '';
}

function clearCurrentSession() {
    clearAppState(true);
    initializeGrid();
    rebuildChartFromHistory();
    displayPrediction('-');
    updateSummaryStats();
    console.log("Current session cleared.");
    setStatusMessage("ล้าง Session ปัจจุบันแล้ว", "text-green-600", sessionStatus);
}

function handleClearCurrent() {
    clearCurrentSession();
}

function handleSaveLogClear() {
    if (downloadLogFile()) {
        clearCurrentSession();
        setStatusMessage("บันทึก Log และล้าง Session แล้ว", "text-green-600", sessionStatus);
    }
}

// --- Text Input Handling ---
function handleTextInput() {
    const sequence = textInputSequence.value.toUpperCase().trim();
    if (!sequence) {
        setStatusMessage('กรุณาป้อนลำดับตัวอักษร', "text-yellow-600", textInputStatus); return;
    }
    isProcessingTextInput = true;
    setStatusMessage('กำลังเพิ่มข้อมูล...', "text-blue-500", textInputStatus);
    let addedCount = 0; let invalidChars = []; let chartNeedsUpdate = false;

    for (let i = 0; i < sequence.length; i++) {
        const char = sequence[i];
        if (['B', 'P', 'T'].includes(char)) {
            const nonTieLenBefore = results.filter(r => r !== 'T').length;
            const willAttemptPrediction = (char !== 'T' && lastPrediction !== '-' && nonTieLenBefore >= MIN_RESULTS_FOR_PREDICTION);
            if (!handleResult(char)) {
                setStatusMessage(`เพิ่มข้อมูลได้ ${addedCount} ตัว (ตารางเต็ม)`, "text-red-500", textInputStatus); break;
            }
            addedCount++;
            if (willAttemptPrediction) { chartNeedsUpdate = true; }
        } else { invalidChars.push(char); }
    }
    isProcessingTextInput = false;
    if (chartNeedsUpdate) { rebuildChartFromHistory(); }

    let finalStatus = `เพิ่ม ${addedCount} ตัวสำเร็จ`;
    if (invalidChars.length > 0) { finalStatus += `. ไม่รู้จัก: ${invalidChars.join(', ')}`; }
    setStatusMessage(finalStatus, "text-green-600", textInputStatus);
    textInputSequence.value = '';
}

// --- Session Management Functions ---
function getCurrentState() {
    return {
        name: activeSessionName, results: [...results], currentFillRow, currentFillCol, tieWins, rounds,
        predictionScore, consecutiveLosses, lastPrediction, predictionAttemptNumber, consecutiveWins,
        lastPredictionOutcome, totalPredictionWins, totalPredictionLosses, scoreHistory: [...scoreHistory],
        predictionAttemptHistory: [...predictionAttemptHistory], lastPredictionHistory: [...lastPredictionHistory],
        winStreakCounts: { ...winStreakCounts }, lossStreakCounts: { ...lossStreakCounts },
        winStreakCountsHistory: JSON.parse(JSON.stringify(winStreakCountsHistory)),
        lossStreakCountsHistory: JSON.parse(JSON.stringify(lossStreakCountsHistory)),
        consecutiveWinsHistory: [...consecutiveWinsHistory], consecutiveLossesHistory: [...consecutiveLossesHistory],
        lastPredictionOutcomeHistory: [...lastPredictionOutcomeHistory], totalWinsHistory: [...totalWinsHistory],
        totalLossesHistory: [...totalLossesHistory],
    };
}

function restoreState(stateToRestore) {
    if (!stateToRestore) return;
    activeSessionName = stateToRestore.name || "Loaded Session"; results = [...stateToRestore.results];
    currentFillRow = stateToRestore.currentFillRow; currentFillCol = stateToRestore.currentFillCol;
    tieWins = stateToRestore.tieWins; rounds = stateToRestore.rounds; predictionScore = stateToRestore.predictionScore;
    consecutiveLosses = stateToRestore.consecutiveLosses; lastPrediction = stateToRestore.lastPrediction;
    predictionAttemptNumber = stateToRestore.predictionAttemptNumber; consecutiveWins = stateToRestore.consecutiveWins;
    lastPredictionOutcome = stateToRestore.lastPredictionOutcome; totalPredictionWins = stateToRestore.totalPredictionWins;
    totalPredictionLosses = stateToRestore.totalPredictionLosses; scoreHistory = [...stateToRestore.scoreHistory];
    predictionAttemptHistory = [...stateToRestore.predictionAttemptHistory]; lastPredictionHistory = [...stateToRestore.lastPredictionHistory];
    winStreakCounts = { ...stateToRestore.winStreakCounts }; lossStreakCounts = { ...stateToRestore.lossStreakCounts };
    winStreakCountsHistory = stateToRestore.winStreakCountsHistory ? JSON.parse(JSON.stringify(stateToRestore.winStreakCountsHistory)) : [];
    lossStreakCountsHistory = stateToRestore.lossStreakCountsHistory ? JSON.parse(JSON.stringify(stateToRestore.lossStreakCountsHistory)) : [];
    consecutiveWinsHistory = [...stateToRestore.consecutiveWinsHistory]; consecutiveLossesHistory = [...stateToRestore.consecutiveLossesHistory];
    lastPredictionOutcomeHistory = [...stateToRestore.lastPredictionOutcomeHistory]; totalWinsHistory = [...stateToRestore.totalWinsHistory];
    totalLossesHistory = [...stateToRestore.totalLossesHistory];

    sessionNameInput.value = activeSessionName === "Default" ? "" : activeSessionName;
    redrawGrid(); rebuildChartFromHistory(); displayPrediction(lastPrediction); updateSummaryStats();
    console.log(`Session "${activeSessionName}" loaded successfully.`);
}

function getSavedSessions() {
    try {
        const sessionsJson = localStorage.getItem(LOCAL_STORAGE_KEY); return sessionsJson ? JSON.parse(sessionsJson) : {};
    } catch (error) { console.error("Error reading sessions:", error); setStatusMessage("เกิดข้อผิดพลาดในการอ่าน Session", "text-red-500", sessionStatus); return {}; }
}

function saveSessionsToStorage(sessions) {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sessions)); return true;
    } catch (error) {
        console.error("Error saving sessions:", error);
        const message = error.name === 'QuotaExceededError' ? "พื้นที่จัดเก็บเต็ม ไม่สามารถบันทึก Session ได้" : "เกิดข้อผิดพลาดในการบันทึก Session";
        setStatusMessage(message, "text-red-500", sessionStatus); return false;
    }
}

function populateSessionList() {
    const sessions = getSavedSessions(); const sessionNames = Object.keys(sessions);
    savedSessionsSelect.innerHTML = '<option value="">-- เลือก Session --</option>';
    const hasSessions = sessionNames.length > 0;
    btnLoadSession.disabled = !hasSessions; btnDeleteSession.disabled = !hasSessions;
    if (!hasSessions) return;
    sessionNames.sort().forEach(name => {
        const option = document.createElement('option'); option.value = name; option.textContent = name;
        savedSessionsSelect.appendChild(option);
    });
}

function handleSaveSession() {
    const name = sessionNameInput.value.trim();
    if (!name) { setStatusMessage("กรุณาตั้งชื่อ Session ก่อนบันทึก", "text-yellow-600", sessionStatus); return; }
    if (name === "Default") { setStatusMessage("ไม่สามารถใช้ชื่อ 'Default' ได้", "text-yellow-600", sessionStatus); return; }
    const sessions = getSavedSessions();
    if (sessions[name] && !confirm(`Session ชื่อ "${name}" มีอยู่แล้ว ต้องการบันทึกทับหรือไม่?`)) {
        setStatusMessage("ยกเลิกการบันทึกทับ", "text-gray-500", sessionStatus); return;
    }
    activeSessionName = name; sessions[name] = getCurrentState();
    if (saveSessionsToStorage(sessions)) {
        populateSessionList(); savedSessionsSelect.value = name; updateSummaryStats();
        setStatusMessage(`Session "${name}" บันทึกสำเร็จ`, "text-green-600", sessionStatus);
    }
}

function handleLoadSession() {
    const name = savedSessionsSelect.value;
    if (!name) { setStatusMessage("กรุณาเลือก Session ที่ต้องการโหลด", "text-yellow-600", sessionStatus); return; }
    const sessions = getSavedSessions(); const stateToLoad = sessions[name];
    if (stateToLoad) { restoreState(stateToLoad); setStatusMessage(`Session "${name}" โหลดสำเร็จ`, "text-green-600", sessionStatus); }
    else { setStatusMessage(`ไม่พบ Session "${name}"`, "text-red-500", sessionStatus); populateSessionList(); }
}

function handleDeleteSession() {
    const name = savedSessionsSelect.value;
    if (!name) { setStatusMessage("กรุณาเลือก Session ที่ต้องการลบ", "text-yellow-600", sessionStatus); return; }
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบ Session "${name}" ? การกระทำนี้ไม่สามารถย้อนกลับได้`)) {
        setStatusMessage("ยกเลิกการลบ", "text-gray-500", sessionStatus); return;
    }
    const sessions = getSavedSessions();
    if (sessions[name]) {
        delete sessions[name];
        if (saveSessionsToStorage(sessions)) {
            setStatusMessage(`Session "${name}" ถูกลบแล้ว`, "text-green-600", sessionStatus);
            populateSessionList();
            if (activeSessionName === name) { clearCurrentSession(); }
        }
    } else { setStatusMessage(`ไม่พบ Session "${name}" ที่จะลบ`, "text-red-500", sessionStatus); populateSessionList(); }
}

function handleNewSession() {
    clearCurrentSession();
    setStatusMessage("สร้าง Session ใหม่แล้ว (Default)", "text-blue-500", sessionStatus);
}

// --- Helper Functions ---
function setStatusMessage(message, cssClass, element, duration = 3000) {
    const baseTextColorClass = document.body.classList.contains('dark') ? 'text-gray-400' : 'text-gray-500';
    element.textContent = message;
    element.className = `text-xs mt-1 h-4 ${cssClass || baseTextColorClass}`;

    if (message && duration > 0) {
        setTimeout(() => {
            if (element.textContent === message) {
                element.textContent = '';
                element.className = `text-xs mt-1 h-4 ${baseTextColorClass}`;
            }
        }, duration);
    } else if (!message) {
        element.className = `text-xs mt-1 h-4 ${baseTextColorClass}`;
    }
}

// --- Event Listeners ---
btnBanker.addEventListener("click", () => handleResult("B"));
btnPlayer.addEventListener("click", () => handleResult("P"));
btnTie.addEventListener("click", () => handleResult("T"));
btnUndo.addEventListener("click", handleUndo);
btnClearCurrent.addEventListener("click", handleClearCurrent);
btnSaveLogClear.addEventListener("click", handleSaveLogClear);
btnSubmitSequence.addEventListener('click', handleTextInput);
textInputSequence.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleTextInput(); });

// Session Listeners
btnSaveSession.addEventListener("click", handleSaveSession);
btnLoadSession.addEventListener("click", handleLoadSession);
btnDeleteSession.addEventListener("click", handleDeleteSession);
btnNewSession.addEventListener("click", handleNewSession);

// Theme Listener
themeToggleButton.addEventListener("click", toggleTheme);

// --- Initial Setup ---
window.onload = () => {
    loadTheme();
    initializeGrid();
    initializeChart();
    populateSessionList();
    clearCurrentSession();
    console.log("Baccarat tracker with session and theme management initialized.");
};
