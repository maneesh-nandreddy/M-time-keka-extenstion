// popup.js
const workedElem = document.getElementById("worked");
const remainingElem = document.getElementById("remaining");
const stayTillElem = document.getElementById("stayTill");
const progressFill = document.getElementById("progressFill");
const progressLabel = document.getElementById("progressLabel");
const refreshBtn = document.getElementById("refresh");
const openKekaBtn = document.getElementById("openKeka");
const debugElem = document.getElementById("debug");
const grossElem = document.getElementById("gross");

// PROFILE UI Elements
const profilePic = document.getElementById("profilePic");
const profileName = document.getElementById("profileName");
const profileRole = document.getElementById("profileRole");

const TARGET_HOURS = 8.25; // 8h 15m
let autoInterval = null;

refreshBtn.addEventListener("click", fetchAndRender);
openKekaBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: "https://niruthi.keka.com" });
});

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
    remainingElem.innerHTML = `<span>🎯</span> <b>Remaining:</b> ${
      remaining > 0 ? `${toHHMM(remaining)} left` : `✅ Target reached!`
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
  if (gender === 2) {
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
