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
restartBtn.addEventListener("click", () => startGame(currentGameType));
backToMenuBtn.addEventListener("click", resetGame);

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

// init
fetchAndRender();
startAutoRefresh();

window.addEventListener("unload", () => {
  stopAutoRefresh();
});
