// popup.js
const workedElem = document.getElementById("worked");
const remainingElem = document.getElementById("remaining");
const stayTillElem = document.getElementById("stayTill");
const progressFill = document.getElementById("progressFill");
const progressLabel = document.getElementById("progressLabel");
const debugElem = document.getElementById("debug");
const grossElem = document.getElementById("gross");
const kekaBtn = document.getElementById("kekaLogs");

// PROFILE UI Elements
const profilePic = document.getElementById("profilePic");
const profileName = document.getElementById("profileName");
const profileRole = document.getElementById("profileRole");

// GAME UI Elements
const playGameBtn = document.getElementById("playGame");
const gameOverlay = document.getElementById("gameOverlay");
const closeGameBtn = document.getElementById("closeGame");
const startG1Btn = document.getElementById("startG1");
const startG2Btn = document.getElementById("startG2");
const startG3Btn = document.getElementById("startG3");
const gameScoreElem = document.getElementById("gameScore");
const gameTimerElem = document.getElementById("gameTimer");
const gameArea = document.getElementById("gameArea");
const gameTarget = document.getElementById("gameTarget");
const gamePaddle = document.getElementById("gamePaddle");
const gameStartScreen = document.getElementById("gameStartScreen");
const gameHeader = document.getElementById("gameHeader");
const gameOverScreen = document.getElementById("gameOverScreen");
const finalScoreElem = document.getElementById("finalScore");
const restartBtn = document.getElementById("restartGame");
const backToMenuBtn = document.getElementById("backToMenu");

// TANGO UI Elements
const tangoScreen = document.getElementById("tangoScreen");
const tangoGridElem = document.getElementById("tangoGrid");
const tangoTimerElem = document.getElementById("tangoTimer");
const tangoStatusElem = document.getElementById("tangoStatus");
const tangoNewBtn = document.getElementById("tangoNew");
const tangoBackBtn = document.getElementById("tangoBack");

const TARGET_HOURS = 8.25; // 8h 15m
let autoInterval = null;

if (kekaBtn) {
  kekaBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://niruthi.keka.com/#/me/attendance/logs" });
  });
}

playGameBtn.addEventListener("click", () => {
  gameOverlay.style.display = "flex";
  resetGame();
});

closeGameBtn.addEventListener("click", () => {
  gameOverlay.style.display = "none";
  stopGame();
  fetchAndRender(); // Ensure logs are fresh
});

startG1Btn.addEventListener("click", () => startGame(1));
startG2Btn.addEventListener("click", () => startGame(2));
startG3Btn.addEventListener("click", () => tangoStart());
restartBtn.addEventListener("click", () => startGame(currentGameType));
backToMenuBtn.addEventListener("click", resetGame);
tangoNewBtn.addEventListener("click", () => tangoStart());
tangoBackBtn.addEventListener("click", () => { tangoStop(); resetGame(); });

gameTarget.addEventListener("click", () => {
  if (currentGameType === 1) {
    score++;
    gameScoreElem.textContent = `Score: ${score}`;
    moveTarget();
  }
});

let score = 0;
let timeLeft = 23;
let gameInterval = null;
let currentGameType = 1;
let balls = [];
let paddleX = 130;
let lastSpeedIncrease = 7;

function resetGame() {
  score = 0;
  timeLeft = 30;
  gameScoreElem.textContent = `Score: 0`;
  gameTimerElem.textContent = `Time: 30s`;
  gameStartScreen.style.display = "block";
  gameTarget.style.display = "none";
  gamePaddle.style.display = "none";
  gameHeader.style.display = "none";
  gameOverScreen.style.display = "none";
  tangoScreen.style.display = "none";
  tangoStop();
  clearBalls();
  stopGame();
}

function clearBalls() {
  balls.forEach(b => {
    if (b.elem && b.elem.parentNode) b.elem.parentNode.removeChild(b.elem);
  });
  balls = [];
}

function addBall(speedMult = 1) {
  const elem = document.createElement("div");
  elem.className = "game-target";
  elem.textContent = "⏰";
  gameArea.appendChild(elem);

  const ball = {
    x: Math.random() * (gameArea.clientWidth - 40),
    y: 20 + Math.random() * 40,
    dx: (Math.random() > 0.5 ? 2 : -2) * speedMult,
    dy: 2 * speedMult,
    elem: elem
  };
  balls.push(ball);
}

function startGame(type) {
  currentGameType = type;
  gameStartScreen.style.display = "none";
  gameOverScreen.style.display = "none";
  gameHeader.style.display = "flex";
  score = 0;
  timeLeft = 30;
  lastSpeedIncrease = 12;
  clearBalls();

  if (type === 1) {
    gameTarget.style.display = "flex";
    gamePaddle.style.display = "none";
    moveTarget();
    gameInterval = setInterval(() => {
      timeLeft--;
      gameTimerElem.textContent = `Time: ${timeLeft}s`;
      if (timeLeft <= 0) {
        endGame();
      }
    }, 1000);
  } else {
    gameTarget.style.display = "none";
    gamePaddle.style.display = "block";
    gameTimerElem.textContent = "Lives: 1";

    addBall(); // First ball

    gameArea.addEventListener("mousemove", movePaddle);
    gameInterval = setInterval(updateGame2, 16);
  }
}

function endGame() {
  stopGame();
  finalScoreElem.textContent = `Score: ${score}`;
  gameOverScreen.style.display = "block";
  // Keep game header hidden or visible? Let's hide it.
  gameHeader.style.display = "none";
}

function stopGame() {
  if (gameInterval) clearInterval(gameInterval);
  gameInterval = null;
  gameArea.removeEventListener("mousemove", movePaddle);
}

function movePaddle(e) {
  const rect = gameArea.getBoundingClientRect();
  paddleX = e.clientX - rect.left - 30; // 30 is half paddle width
  if (paddleX < 0) paddleX = 0;
  if (paddleX > gameArea.clientWidth - 60) paddleX = gameArea.clientWidth - 60;
  gamePaddle.style.left = `${paddleX + 30}px`;
}

function updateGame2() {
  let gameOver = false;

  balls.forEach(ball => {
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Wall collisions
    if (ball.x <= 0 || ball.x >= gameArea.clientWidth - 30) ball.dx *= -1;
    if (ball.y <= 0) ball.dy *= -1;

    // Paddle collision
    if (ball.y >= gameArea.clientHeight - 60 && ball.y <= gameArea.clientHeight - 40) {
      if (ball.x + 20 >= paddleX && ball.x <= paddleX + 60) {
        ball.dy *= -1;
        ball.y = gameArea.clientHeight - 61; // Prevent sticking
        score++;
        gameScoreElem.textContent = `Score: ${score}`;

        // Difficulty Scaling
        if (score === 7) {
          addBall(1.1); // Add a second ball
        } else if (score === 12) {
          balls.forEach(b => { b.dx *= 1.3; b.dy *= 1.3; }); // Speed up
        } else if (score > 12 && score % 5 === 0 && score !== lastSpeedIncrease) {
          balls.forEach(b => { b.dx *= 1.1; b.dy *= 1.1; });
          lastSpeedIncrease = score;
        }
      }
    }

    // Fall off
    if (ball.y > gameArea.clientHeight) {
      gameOver = true;
    }

    ball.elem.style.left = `${ball.x}px`;
    ball.elem.style.top = `${ball.y}px`;
    ball.elem.style.display = "flex";
  });

  if (gameOver) {
    endGame();
  }
}

function moveTarget() {
  const areaWidth = gameArea.clientWidth - 40;
  const areaHeight = gameArea.clientHeight - 40;
  const x = Math.random() * areaWidth;
  const y = Math.random() * areaHeight;
  gameTarget.style.left = `${x}px`;
  gameTarget.style.top = `${y}px`;
}

function showDebug(text) {
  // set to display debug by toggling style if needed
  // debugElem.style.display = 'block';
  // debugElem.textContent = text;
  // For now keep it hidden by default
}

let liveTimer = null;

function toHHMM(decimal) {
  const h = Math.floor(decimal);
  const m = Math.round((decimal - h) * 60);
  return `${h}h ${m}m`;
}

function startLiveTick(baseHours, lastPunchInMs) {
  if (liveTimer) clearInterval(liveTimer);

  function update() {
    const now = Date.now();
    const liveDiff = (now - lastPunchInMs) / 3_600_000;
    const total = baseHours + liveDiff;

    workedElem.innerHTML = `<span>🕓</span> <b>Effective:</b> ${toHHMM(total)}`;

    const remaining = Math.max(0, TARGET_HOURS - total);
    remainingElem.innerHTML = `<span>🎯</span> <b>Remaining:</b> ${remaining > 0 ? `${toHHMM(remaining)} left` : `✅ Target reached!`
      }`;

    const pct = Math.min(100, (total / TARGET_HOURS) * 100).toFixed(1);
    progressFill.style.width = `${pct}%`;
    progressLabel.textContent = `${pct}%`;

    const stayTillTime = new Date(lastPunchInMs + (TARGET_HOURS - baseHours) * 3_600_000);
    if (remaining > 0) {
      stayTillElem.innerHTML = `<span>🏢</span> <b>Stay Till:</b> ${stayTillTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      })}`;
    } else {
      stayTillElem.innerHTML = `<span>🏢</span> <b>Stay Till:</b> Done ✅`;
    }

    if (total >= TARGET_HOURS) {
      progressFill.classList.add("complete");
    } else {
      progressFill.classList.remove("complete");
    }
  }

  update(); // run immediately
  liveTimer = setInterval(update, 1000); // then every second
}

function renderData(data) {
  if (!data || data.error) {
    workedElem.textContent = `⚠️ ${data?.error || "Error"}`;
    return;
  }

  const { hours, profile } = data;
  if (profile) renderProfile(profile);

  if (!hours) return;

  // Static fields
  grossElem.innerHTML = `<span>🧩</span> <b>Gross:</b> ${hours.grossPretty}`;

  if (hours.isCurrentlyIn && hours.lastPunchInMs) {
    startLiveTick(hours.baseHours, hours.lastPunchInMs);
  } else {
    if (liveTimer) clearInterval(liveTimer);
    workedElem.innerHTML = `<span>🕓</span> <b>Effective:</b> ${hours.pretty}`;
    remainingElem.innerHTML = `<span>🎯</span> <b>Remaining:</b> —`;
    stayTillElem.innerHTML = `<span>🏢</span> <b>Stay Till:</b> ${hours.stayTill}`;

    const pct = Math.min(100, (hours.hours / TARGET_HOURS) * 100).toFixed(1);
    progressFill.style.width = `${pct}%`;
    progressLabel.textContent = `${pct}%`;

    if (hours.hours >= TARGET_HOURS) {
      progressFill.classList.add("complete");
    } else {
      progressFill.classList.remove("complete");
    }
  }
}

function renderProfile(profile) {
  if (!profile) return;

  profileName.textContent = `Hi, ${profile.displayName}`;
  profileRole.textContent = profile.jobTitle || "Team Member";

  const gender = profile.gender; // 1 = male, 2 = female
  const dob = profile.dateOfBirth;
  const initials = profile.displayName ? profile.displayName.split(' ').map(n => n[0]).join('').toUpperCase() : "?";

  let avatarPath = "";

  // Calculate age
  let age = 30; // default
  if (dob) {
    const birthDate = new Date(dob);
    const today = new Date();
    age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
  }

  // Pick avatar based on gender + age
  if (profile.displayName && profile.displayName.toLowerCase().includes("ganesh")) {
    avatarPath = "icons/ganesh.png";
  } else if (profile.displayName && profile.displayName.toLowerCase().includes("surendra")) {
    avatarPath = "icons/surendra.jpeg";
  } else if (profile.displayName && profile.displayName.toLowerCase().includes("dinesh")) {
    avatarPath = "icons/dinesh.jpeg";
  } else if (profile.displayName && profile.displayName.toLowerCase().includes("shobana")) {
    avatarPath = "icons/shobana.jpeg";
  } else if (profile.displayName && profile.displayName.toLowerCase().includes("lovish")) {
    avatarPath = "icons/lovish.jpeg";
  } else if (profile.displayName && profile.displayName.toLowerCase().includes("ramya")) {
    avatarPath = "icons/ramya.jpeg";
  } else if (profile.displayName && profile.displayName.toLowerCase().includes("gurleen")) {
    avatarPath = "icons/gurleen.jpeg";
  } else if (profile.displayName && profile.displayName.toLowerCase().includes("maneesh")) {
    avatarPath = "icons/maneesh.jpeg";
  } else if (gender === 2) {
    avatarPath = age > 25 ? "icons/female_adult.jpeg" : "icons/female_teen.jpg";
  } else if (gender === 1) {
    avatarPath = age > 25 ? "icons/male_smart.jpeg" : "icons/male_cool.png";
  }

  if (avatarPath) {
    const fullUrl = chrome.runtime.getURL(avatarPath);
    profilePic.style.backgroundImage = `url("${fullUrl}")`;
    profilePic.style.backgroundSize = "cover";
    profilePic.style.backgroundPosition = "center";
    profilePic.style.border = "2px solid var(--accent)";
    profilePic.textContent = "";
  } else {
    profilePic.style.backgroundImage = "none";
    profilePic.style.border = "none";
    profilePic.textContent = initials;
  }
}

// fetch and render once
function fetchAndRender() {
  chrome.runtime.sendMessage({ type: "GET_DATA" }, (res) => {
    if (chrome.runtime.lastError) {
      renderData({ error: chrome.runtime.lastError.message });
      return;
    }
    renderData(res);
  });
}

// UI auto-sync: refresh every 1 minute to stay synced with background
function startAutoRefresh() {
  if (autoInterval) clearInterval(autoInterval);
  autoInterval = setInterval(fetchAndRender, 60000);
}

function stopAutoRefresh() {
  if (autoInterval) clearInterval(autoInterval);
  autoInterval = null;
  if (liveTimer) clearInterval(liveTimer);
}

// ========== TANGO GAME ENGINE ==========
const TANGO_SZ = 6;
const T_EMPTY = 0, T_SUN = 1, T_MOON = 2;
const T_CELL = 34, T_GAP = 4, T_STEP = T_CELL + T_GAP;
const T_PAD = 6; // grid padding

let tGrid = [], tSolution = [], tGiven = [], tConstraints = [];
let tTimer = null, tSeconds = 0, tActive = false, tWon = false;

// init
fetchAndRender();
startAutoRefresh();

window.addEventListener("unload", () => {
  stopAutoRefresh();
  tangoStop();
});

function tangoShuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

// Generate valid 6×6 solution via backtracking
function tangoGenSolution() {
  const g = Array.from({ length: 6 }, () => Array(6).fill(0));
  function ok(r, c, v) {
    let rc = 0, cc = 0;
    for (let i = 0; i < 6; i++) {
      if (g[r][i] === v) rc++;
      if (g[i][c] === v) cc++;
    }
    if (rc >= 3 || cc >= 3) return false;
    if (c >= 2 && g[r][c - 1] === v && g[r][c - 2] === v) return false;
    if (r >= 2 && g[r - 1][c] === v && g[r - 2][c] === v) return false;
    return true;
  }
  function solve(p) {
    if (p === 36) return true;
    const r = (p / 6) | 0, c = p % 6;
    const vs = Math.random() > 0.5 ? [1, 2] : [2, 1];
    for (const v of vs) {
      if (ok(r, c, v)) { g[r][c] = v; if (solve(p + 1)) return true; g[r][c] = 0; }
    }
    return false;
  }
  solve(0);
  return g;
}

// Generate constraint markers from solution
function tangoGenConstraints(sol) {
  const cands = [];
  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 5; c++)
      cands.push({ r1: r, c1: c, r2: r, c2: c + 1, dir: 'h' });
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 6; c++)
      cands.push({ r1: r, c1: c, r2: r + 1, c2: c, dir: 'v' });
  tangoShuffle(cands);
  const cnt = 5 + Math.floor(Math.random() * 4);
  const out = [];
  for (let i = 0; i < Math.min(cnt, cands.length); i++) {
    const { r1, c1, r2, c2, dir } = cands[i];
    out.push({ r1, c1, r2, c2, dir, type: sol[r1][c1] === sol[r2][c2] ? '=' : '×' });
  }
  return out;
}

// Create puzzle (remove cells, keep some as given)
function tangoCreatePuzzle(sol) {
  const given = Array.from({ length: 6 }, () => Array(6).fill(false));
  const pos = [];
  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 6; c++) pos.push([r, c]);
  tangoShuffle(pos);
  const n = 8 + Math.floor(Math.random() * 5);
  for (let i = 0; i < n; i++) given[pos[i][0]][pos[i][1]] = true;
  const grid = Array.from({ length: 6 }, () => Array(6).fill(0));
  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 6; c++)
      if (given[r][c]) grid[r][c] = sol[r][c];
  return { grid, given };
}

// Validate current grid, return set of error cell keys "r,c"
function tangoValidate() {
  const err = new Set();
  for (let i = 0; i < 6; i++) {
    let rs = 0, rm = 0, cs = 0, cm = 0;
    for (let j = 0; j < 6; j++) {
      if (tGrid[i][j] === T_SUN) rs++; if (tGrid[i][j] === T_MOON) rm++;
      if (tGrid[j][i] === T_SUN) cs++; if (tGrid[j][i] === T_MOON) cm++;
    }
    if (rs > 3) for (let j = 0; j < 6; j++) if (tGrid[i][j] === T_SUN) err.add(`${i},${j}`);
    if (rm > 3) for (let j = 0; j < 6; j++) if (tGrid[i][j] === T_MOON) err.add(`${i},${j}`);
    if (cs > 3) for (let j = 0; j < 6; j++) if (tGrid[j][i] === T_SUN) err.add(`${j},${i}`);
    if (cm > 3) for (let j = 0; j < 6; j++) if (tGrid[j][i] === T_MOON) err.add(`${j},${i}`);
  }
  // No 3 in a row
  for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) {
    if (tGrid[r][c] && tGrid[r][c] === tGrid[r][c + 1] && tGrid[r][c] === tGrid[r][c + 2]) {
      err.add(`${r},${c}`); err.add(`${r},${c + 1}`); err.add(`${r},${c + 2}`);
    }
  }
  for (let c = 0; c < 6; c++) for (let r = 0; r < 4; r++) {
    if (tGrid[r][c] && tGrid[r][c] === tGrid[r + 1][c] && tGrid[r][c] === tGrid[r + 2][c]) {
      err.add(`${r},${c}`); err.add(`${r + 1},${c}`); err.add(`${r + 2},${c}`);
    }
  }
  // Constraints
  tConstraints.forEach(({ r1, c1, r2, c2, type }) => {
    if (tGrid[r1][c1] && tGrid[r2][c2]) {
      if (type === '=' && tGrid[r1][c1] !== tGrid[r2][c2]) { err.add(`${r1},${c1}`); err.add(`${r2},${c2}`); }
      if (type === '×' && tGrid[r1][c1] === tGrid[r2][c2]) { err.add(`${r1},${c1}`); err.add(`${r2},${c2}`); }
    }
  });
  return err;
}

function tangoCheckWin() {
  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 6; c++)
      if (tGrid[r][c] === 0) return false;
  return tangoValidate().size === 0;
}

// Render the grid
function tangoRender() {
  tangoGridElem.innerHTML = '';
  const errors = tangoValidate();
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      const cell = document.createElement('div');
      cell.className = 'tango-cell';
      if (tGiven[r][c]) cell.classList.add('given');
      if (tGrid[r][c] === T_SUN) { cell.textContent = '☀️'; cell.classList.add('sun'); }
      else if (tGrid[r][c] === T_MOON) { cell.textContent = '🌙'; cell.classList.add('moon'); }
      if (!tWon && errors.has(`${r},${c}`)) cell.classList.add('error');
      if (tWon) cell.classList.add('win');
      if (!tGiven[r][c] && !tWon) {
        const rr = r, cc = c;
        cell.addEventListener('click', () => tangoCellClick(rr, cc));
      }
      tangoGridElem.appendChild(cell);
    }
  }
  // Render constraint markers
  tConstraints.forEach(({ r1, c1, r2, c2, dir, type }) => {
    const m = document.createElement('div');
    m.className = 'tango-marker' + (type === '×' ? ' marker-x' : '');
    m.textContent = type;
    if (dir === 'h') {
      m.style.left = `${T_PAD + c1 * T_STEP + T_CELL + T_GAP / 2}px`;
      m.style.top = `${T_PAD + r1 * T_STEP + T_CELL / 2}px`;
    } else {
      m.style.left = `${T_PAD + c1 * T_STEP + T_CELL / 2}px`;
      m.style.top = `${T_PAD + r1 * T_STEP + T_CELL + T_GAP / 2}px`;
    }
    tangoGridElem.appendChild(m);
  });
  // Status
  const filled = tGrid.flat().filter(v => v !== 0).length;
  if (tWon) {
    tangoStatusElem.textContent = `🎉 Solved in ${tangoFmtTime(tSeconds)}!`;
    tangoStatusElem.className = 'tango-status win-status';
  } else if (errors.size > 0) {
    tangoStatusElem.textContent = `⚠️ ${errors.size} conflict${errors.size > 1 ? 's' : ''}`;
    tangoStatusElem.className = 'tango-status error-status';
  } else {
    tangoStatusElem.textContent = `${filled}/36 filled`;
    tangoStatusElem.className = 'tango-status';
  }
}

function tangoCellClick(r, c) {
  if (tWon || tGiven[r][c]) return;
  tGrid[r][c] = (tGrid[r][c] + 1) % 3; // 0→1→2→0
  tangoRender();
  if (tangoCheckWin()) {
    tWon = true;
    tangoStopTimer();
    tangoRender();
  }
}

function tangoFmtTime(s) {
  return `${(s / 60) | 0}:${String(s % 60).padStart(2, '0')}`;
}

function tangoStartTimer() {
  tangoStopTimer();
  tSeconds = 0;
  tangoTimerElem.textContent = '0:00';
  tTimer = setInterval(() => {
    tSeconds++;
    tangoTimerElem.textContent = tangoFmtTime(tSeconds);
  }, 1000);
}

function tangoStopTimer() {
  if (tTimer) { clearInterval(tTimer); tTimer = null; }
}

function tangoStart() {
  tWon = false;
  tSolution = tangoGenSolution();
  tConstraints = tangoGenConstraints(tSolution);
  const { grid, given } = tangoCreatePuzzle(tSolution);
  tGrid = grid;
  tGiven = given;
  tActive = true;
  // Hide other game elements
  gameStartScreen.style.display = 'none';
  gameHeader.style.display = 'none';
  gameTarget.style.display = 'none';
  gamePaddle.style.display = 'none';
  gameOverScreen.style.display = 'none';
  tangoScreen.style.display = 'block';
  tangoStartTimer();
  tangoRender();
}

function tangoStop() {
  tActive = false;
  tangoStopTimer();
  tangoScreen.style.display = 'none';
}
