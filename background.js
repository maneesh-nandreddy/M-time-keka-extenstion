// background.js (MV3 service worker)
const TARGET_HOURS = 8.25;
let cachedToken = null;

// Periodic background check so the celebration fires even if the popup
// is never opened right at the 8h15m mark.
chrome.alarms.create("keka-hours-check", { periodInMinutes: 2 });
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name !== "keka-hours-check") return;
  (async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const hours = await fetchKekaData();
      await maybeCelebrate(hours);
    } catch (err) {
      // silent: token may just not be set yet
    }
  })();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === "SAVE_TOKEN") {
        cachedToken = message.token;
        await chrome.storage.local.set({ token: cachedToken });
        sendResponse({ success: true });
        return;
      }

      if (message.type === "GET_DATA") {
        const [hours, profile] = await Promise.all([
          fetchKekaData(),
          fetchProfile()
        ]);
        maybeCelebrate(hours).catch(e => console.warn("[keka-bg] celebrate error", e));
        sendResponse({ hours, profile });
        return;
      }

      sendResponse({ error: "Unknown message type" });
    } catch (err) {
      console.error("[keka-bg-error]", err);
      sendResponse({ error: err.message || String(err) });
    }
  })();

  return true;
});

async function getToken() {
  if (cachedToken) return cachedToken;
  const res = await chrome.storage.local.get("token");
  cachedToken = res.token || null;
  return cachedToken;
}

async function fetchKekaData() {
  const token = await getToken();
  if (!token) throw new Error("No token found. Open Keka once.");

  const resp = await fetch(
    "https://niruthi.keka.com/k/attendance/api/mytime/attendance/summary",
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!resp.ok) throw new Error(`Attendance API ${resp.status}`);

  const json = await resp.json();
  const records = json?.data || [];
  if (!records.length) throw new Error("No attendance data");

  const last = records[records.length - 1];

  // ✅ Use originalTimeEntries to determine actual punch status
  const entries = (last.originalTimeEntries || []).filter(e => {
    const t = new Date(e.timestamp || e.actualTimestamp);
    return !isNaN(t.getTime());
  });

  // ✅ Last valid entry's punchStatus: 0 = IN, 1 = OUT
  const lastEntry = entries.length ? entries[entries.length - 1] : null;
  const isIn = lastEntry ? lastEntry.punchStatus === 0 : false;

  // ✅ Last punch-IN time (for live effective hours calculation)
  let lastPunchIn = null;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].punchStatus === 0) {
      lastPunchIn = new Date(entries[i].timestamp || entries[i].actualTimestamp);
      break;
    }
  }

  // ✅ First IN time of the day (for gross hours)
  const firstIn = entries.length ? new Date(entries[0].timestamp || entries[0].actualTimestamp) : null;

  // ✅ Base effective hours from API summary (already-completed pairs)
  let total = parseFloat(last.totalEffectiveHours || 0);

  // ✅ KEY FIX: If currently IN, add live time since last punch-in
  const now = new Date();
  if (isIn && lastPunchIn && !isNaN(lastPunchIn.getTime())) {
    const liveDiff = (now - lastPunchIn) / 3_600_000;
    if (liveDiff > 0) {
      total += liveDiff;
    }
  }

  // ✅ Gross = first punch of day → now (if in) or last valid punch (if out)
  let gross = 0;
  if (firstIn && !isNaN(firstIn.getTime())) {
    let endForGross = now;
    if (!isIn && entries.length) {
      endForGross = new Date(entries[entries.length - 1].timestamp || entries[entries.length - 1].actualTimestamp);
    }
    gross = (endForGross - firstIn) / 3_600_000;
  }

  // ✅ Stay till calculation
  let stayTill = "Not clocked in";
  if (isIn) {
    const remaining = TARGET_HOURS - total;
    stayTill =
      remaining > 0
        ? new Date(Date.now() + remaining * 3_600_000)
          .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "Done ✅";
  }

  return {
    hours: +total.toFixed(3),
    gross: +gross.toFixed(3),
    pretty: toHHMM(total),
    grossPretty: toHHMM(gross),
    stayTill,
    isCurrentlyIn: isIn,
    lastPunchIn: lastPunchIn?.toISOString() || null,
    // ✅ Pass the base (completed) hours separately so popup can show live tick
    baseHours: parseFloat(last.totalEffectiveHours || 0),
    lastPunchInMs: isIn && lastPunchIn ? lastPunchIn.getTime() : null
  };
}

// ---- Target-reached celebration (confetti blast on whichever tab is active) ----

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

async function maybeCelebrate(hours) {
  if (!hours || typeof hours.hours !== "number") return;
  if (hours.hours < TARGET_HOURS) return;

  const { celebratedOn } = await chrome.storage.local.get("celebratedOn");
  const today = todayKey();
  if (celebratedOn === today) return; // already blasted today

  await chrome.storage.local.set({ celebratedOn: today });
  await blastConfettiOnActiveTab();
}

async function blastConfettiOnActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab || !tab.id || !/^https?:/.test(tab.url || "")) return;

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: confettiBlastInPage
    });
  } catch (err) {
    console.warn("[keka-bg] confetti injection failed", err);
  }
}

// Injected into the page. Must be self-contained (no outside references).
function confettiBlastInPage() {
  if (document.getElementById("__keka_confetti_root")) return; // avoid double-fire

  const COLORS = ["#ff4d6d", "#ffd23f", "#06d6a0", "#118ab2", "#a06cd5", "#ff8c42"];
  const COUNT = 140;
  const DURATION_MS = 3800;

  const canvas = document.createElement("canvas");
  canvas.id = "__keka_confetti_root";
  canvas.style.cssText =
    "position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483647;pointer-events:none;";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.documentElement.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;

  const pieces = Array.from({ length: COUNT }, () => {
    const fromLeft = Math.random() < 0.5;
    return {
      x: fromLeft ? -10 : W + 10,
      y: H * (0.35 + Math.random() * 0.4),
      vx: (fromLeft ? 1 : -1) * (6 + Math.random() * 10),
      vy: -(8 + Math.random() * 10),
      g: 0.28 + Math.random() * 0.12,
      size: 5 + Math.random() * 6,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      shape: Math.random() < 0.5 ? "rect" : "circle"
    };
  });

  const start = performance.now();
  let rafId = null;

  function frame(now) {
    const elapsed = now - start;
    ctx.clearRect(0, 0, W, H);

    const fadeStart = DURATION_MS - 800;
    const alpha = elapsed > fadeStart ? Math.max(0, 1 - (elapsed - fadeStart) / 800) : 1;

    for (const p of pieces) {
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === "rect") {
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (elapsed < DURATION_MS) {
      rafId = requestAnimationFrame(frame);
    } else {
      cleanup();
    }
  }

  function cleanup() {
    if (rafId) cancelAnimationFrame(rafId);
    canvas.remove();
    window.removeEventListener("resize", onResize);
  }

  function onResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", onResize);

  rafId = requestAnimationFrame(frame);
  // Safety net in case rAF stalls on a backgrounded tab
  setTimeout(cleanup, DURATION_MS + 1000);
}

function toHHMM(decimal) {
  const h = Math.floor(decimal);
  const m = Math.round((decimal - h) * 60);
  return `${h}h ${m}m`;
}

async function fetchProfile() {
  const token = await getToken();
  if (!token) throw new Error("No token found (profile)");

  const resp = await fetch(
    "https://niruthi.keka.com/k/default/api/me/publicprofile",
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!resp.ok) throw new Error("Profile API error");

  const d = (await resp.json()).data;

  return {
    displayName: d.displayName,
    jobTitle: d.jobTitle,
    gender: d.gender,
    dateOfBirth: d.dateOfBirth
  };
}