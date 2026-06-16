/**
 * Keka Mobile Service Helper
 * 
 * This service mimics the background.js logic of the browser extension but is refactored 
 * for React Native / Expo. It handles fetching from Keka APIs, parsing completed punches, 
 * calculating live ticks, and determining target completion (Stay Till).
 */

const TARGET_HOURS = 8.25; // 8h 15m

/**
 * Fetch attendance summary and calculate worked hours, gross hours, and target stay time.
 * @param {string} token - The access token extracted from the WebView.
 * @returns {Promise<object>} Parsed attendance details.
 */
export async function fetchKekaMobileData(token) {
  if (!token) throw new Error("No token provided");

  const url = "https://niruthi.keka.com/k/attendance/api/mytime/attendance/summary";
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1"
    }
  });

  if (!resp.ok) {
    throw new Error(`Keka API returned status ${resp.status}`);
  }

  const json = await resp.json();
  const records = json?.data || [];
  if (!records.length) {
    throw new Error("No attendance records found");
  }

  const lastRecord = records[records.length - 1];

  // Filter out any entries with invalid timestamps
  const entries = (lastRecord.originalTimeEntries || []).filter(e => {
    const t = new Date(e.timestamp || e.actualTimestamp);
    return !isNaN(t.getTime());
  });

  // Determine if currently punched in (0 = IN, 1 = OUT)
  const lastEntry = entries.length ? entries[entries.length - 1] : null;
  const isCurrentlyIn = lastEntry ? lastEntry.punchStatus === 0 : false;

  // Find last punch-IN time
  let lastPunchIn = null;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].punchStatus === 0) {
      lastPunchIn = new Date(entries[i].timestamp || entries[i].actualTimestamp);
      break;
    }
  }

  // Find first punch-IN of the day (for gross hours)
  const firstIn = entries.length ? new Date(entries[0].timestamp || entries[0].actualTimestamp) : null;

  // Base effective hours from API summary
  let baseHours = parseFloat(lastRecord.totalEffectiveHours || 0);
  let liveEffectiveHours = baseHours;

  const now = new Date();
  if (isCurrentlyIn && lastPunchIn && !isNaN(lastPunchIn.getTime())) {
    const liveDiff = (now - lastPunchIn) / 3600000; // milliseconds to hours
    if (liveDiff > 0) {
      liveEffectiveHours += liveDiff;
    }
  }

  // Calculate gross hours (from first punch of day until now, or last punch if checked out)
  let grossHours = 0;
  if (firstIn && !isNaN(firstIn.getTime())) {
    const endForGross = isCurrentlyIn ? now : new Date(entries[entries.length - 1].timestamp || entries[entries.length - 1].actualTimestamp);
    grossHours = (endForGross - firstIn) / 3600000;
  }

  // Calculate Stay Till time
  let stayTill = "Not clocked in";
  let stayTillTimeMs = null;
  if (isCurrentlyIn) {
    const remaining = TARGET_HOURS - liveEffectiveHours;
    if (remaining > 0) {
      stayTillTimeMs = Date.now() + remaining * 3600000;
      stayTill = new Date(stayTillTimeMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else {
      stayTill = "Done ✅";
    }
  }

  return {
    isCurrentlyIn,
    baseHours,
    liveEffectiveHours: Number(liveEffectiveHours.toFixed(3)),
    grossHours: Number(grossHours.toFixed(3)),
    stayTill,
    stayTillTimeMs,
    lastPunchInMs: isCurrentlyIn && lastPunchIn ? lastPunchIn.getTime() : null,
    prettyEffective: toHHMM(liveEffectiveHours),
    prettyGross: toHHMM(grossHours)
  };
}

/**
 * Fetch profile details for the user.
 * @param {string} token - The access token.
 */
export async function fetchKekaMobileProfile(token) {
  if (!token) throw new Error("No token provided");

  const url = "https://niruthi.keka.com/k/default/api/me/publicprofile";
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1"
    }
  });

  if (!resp.ok) {
    throw new Error(`Profile API error status ${resp.status}`);
  }

  const json = await resp.json();
  const d = json.data;

  return {
    displayName: d.displayName,
    jobTitle: d.jobTitle,
    gender: d.gender,
    dateOfBirth: d.dateOfBirth,
    avatarUrl: d.profileImageUrl ? `https://niruthi.keka.com/${d.profileImageUrl}` : null
  };
}

/**
 * Format decimal hours to HHh MMm format.
 * @param {number} decimal 
 */
export function toHHMM(decimal) {
  const h = Math.floor(decimal);
  const m = Math.round((decimal - h) * 60);
  return `${h}h ${m}m`;
}
