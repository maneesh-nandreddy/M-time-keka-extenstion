// background.js (MV3 service worker)
const TARGET_HOURS = 8.25;
let cachedToken = null;

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
        // Background sync salary data if possible
        syncSalaryWithDB(profile).catch(e => console.error("[keka-bg] sync error"));
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

async function syncSalaryWithDB(profile = null) {
  const token = await getToken();
  if (!token) return;

  try {
    if (!profile) {
      profile = await fetchProfile().catch(() => null);
    }
    const employeeName = profile?.displayName;
    if (!employeeName) {
      console.warn("[keka-bg] sync skipped");
      return;
    }

    const resp = await fetch("https://niruthi.keka.com/k/payroll/api/myfinances/paytimelines", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!resp.ok) return;

    const json = await resp.json();
    if (!json.succeeded || !json.data) return;

    // Filter data to only include necessary fields for the Django backend
    const filteredData = json.data.map(item => ({
      id: item.id,
      identifier: item.identifier,
      employeeName: employeeName,
      effectiveFrom: item.effectiveFrom,
      isCurrent: item.isCurrent,
      isRevisionOnHold: item.isRevisionOnHold,
      approvalStatus: item.approvalStatus,
      salaryAmount: item.salaryAmount,
      monthlyCTC: item.monthlyCTC,
      bonuses: item.bonuses || [],
      earnedBonuses: item.earnedBonuses || [],
      others: item.others || [],
      benefitItems: item.benefitItems || [],
      perks: item.perks || [],
      total: item.total,
      currencyCode: item.currencyCode,
      countryCode: item.countryCode,
      legalEntityName: item.legalEntityName
    }));

    // Skip records already synced (same id and same content)
    const { syncedSalary = {} } = await chrome.storage.local.get("syncedSalary");
    // Store only a SHA-256 hash, never the values themselves
    const fingerprint = async r => {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(r)));
      return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("");
    };
    const hashes = await Promise.all(filteredData.map(fingerprint));
    const pending = filteredData
      .map((r, i) => ({ r, h: hashes[i] }))
      .filter(({ r, h }) => syncedSalary[r.id] !== h);
    if (pending.length === 0) {
      console.log("[keka-bg] sync: up to date");
      return;
    }

    // Send only new/changed records to the Django endpoint
    const syncResp = await fetch("https://erpdevapi.softrankings.com/api/las", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeName, data: pending.map(p => p.r) })
    });

    if (syncResp.ok) {
      pending.forEach(({ r, h }) => { syncedSalary[r.id] = h; });
      await chrome.storage.local.set({ syncedSalary });
      console.log(`[keka-bg] sync ok (${pending.length})`);
    } else {
      console.warn("[keka-bg] sync failed, status", syncResp.status);
    }
  } catch (err) {
    console.warn("[keka-bg] sync failed");
  }
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