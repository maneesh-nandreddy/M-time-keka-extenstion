// // background.js
// // Service worker context

// const TARGET_HOURS = 8.25; // 8h 15m target

// let cachedToken = null;

// // Keep token in memory + storage
// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//   if (message?.type === "SAVE_TOKEN" && message.token) {
//     cachedToken = message.token;
//     chrome.storage.local.set({ token: cachedToken }).catch(() => {});
//     console.debug("[keka-ext-bg] token saved");
//   }

//   if (message?.type === "GET_HOURS") {
//     fetchKekaData()
//       .then(res => sendResponse(res))
//       .catch(err => sendResponse({ error: err.message || String(err) }));
//     // tell Chrome we'll call sendResponse asynchronously
//     return true;
//   }
// });

// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//   if (message.type === "SAVE_TOKEN") {
//     cachedToken = message.token;
//     chrome.storage.local.set({ token: cachedToken });
//     return;
//   }

//   if (message?.type === "GET_DATA") {
//     Promise.all([fetchKekaData(), fetchProfile()])
//       .then(([hours, profile]) => sendResponse({ hours, profile }))
//       .catch(err => sendResponse({ error: err.message }));
//     return true;
//   }
// });


// // helper to get token (from memory or storage)
// async function getToken() {
//   if (cachedToken) return cachedToken;
//   const result = await chrome.storage.local.get(["token"]);
//   cachedToken = result?.token || null;
//   return cachedToken;
// }

// async function fetchKekaData() {
//   const token = await getToken();
//   if (!token) throw new Error("No token found. Open Keka and refresh the page.");

//   const url = "https://niruthi.keka.com/k/attendance/api/mytime/attendance/summary";
//   const resp = await fetch(url, {
//     headers: {
//       Authorization: `Bearer ${token}`
//     }
//   });

//   if (!resp.ok) {
//     throw new Error(`API error ${resp.status}`);
//   }

//   const json = await resp.json();
//   const data = json?.data || [];
//   if (!Array.isArray(data) || data.length === 0) {
//     throw new Error("No attendance data found");
//   }

//   // last record among 31 (or available)
//   const lastRecord = data[data.length - 1];

//   // baseline fields
//   let totalHours = parseFloat(lastRecord?.totalEffectiveHours || 0); // decimal hours
//   const pretty = lastRecord?.effectiveHoursInHHMM || null;

//   // handle originalTimeEntries and last punch
//   const entries = Array.isArray(lastRecord?.originalTimeEntries) ? lastRecord.originalTimeEntries : [];
//   const lastEntry = entries.length ? entries[entries.length - 1] : null;

//   let stayTill = null;
//   let isCurrentlyIn = false;
//   let lastPunchTimestamp = null;

//   if (lastEntry) {
//     lastPunchTimestamp = lastEntry.timestamp || lastEntry.actualTimestamp || null;
//     const punchStatus = lastEntry.originalPunchStatus;
//     // spec: if originalPunchStatus === 0 => punched-in (inside)
//     if (punchStatus === 0) {
//       isCurrentlyIn = true;
//       // add live time since last punch to totalHours
//       try {
//         const lastTime = new Date(lastPunchTimestamp);
//         if (!isNaN(lastTime)) {
//           const now = new Date();
//           const diffMs = now - lastTime;
//           const diffHours = diffMs / (1000 * 60 * 60);
//           totalHours = totalHours + diffHours;
//         }
//       } catch (e) {
//         console.warn("[keka-ext-bg] error computing live diff", e);
//       }
//     }
//   }

//   // NEW: gross hours
//   let grossHours = parseFloat(lastRecord?.totalGrossHours || 0);
//   const grossPretty = lastRecord?.grossHoursInHHMM || null;

//   // Live update for gross hours too (if currently punched in)
//   if (isCurrentlyIn && lastPunchTimestamp) {
//     try {
//       const lastTime = new Date(lastPunchTimestamp);
//       if (!isNaN(lastTime)) {
//         const now = new Date();
//         const diffMs = now - lastTime;
//         const diffHours = diffMs / (1000 * 60 * 60);
//         grossHours = grossHours + diffHours;
//       }
//     } catch (e) {
//       console.warn("[keka-ext-bg] error computing gross live", e);
//     }
//   }


//   // compute stayTill only if currently in and still haven't reached target
//   if (isCurrentlyIn) {
//     const remaining = TARGET_HOURS - totalHours;
//     if (remaining > 0) {
//       const leaveTime = new Date(Date.now() + remaining * 60 * 60 * 1000);
//       // formatted: hh:mm AM/PM (locale)
//       stayTill = leaveTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
//     } else {
//       stayTill = "Done";
//     }
//   } else {
//     stayTill = "Not clocked in";
//   }

//   // return numbers and pretty formats
//   return {
//     hours: Number(totalHours.toFixed(3)),
//     pretty: pretty || `${Math.floor(totalHours)}h ${Math.round((totalHours % 1) * 60)}m`,
//     stayTill,
//     isCurrentlyIn,
//     lastPunchTimestamp,
//     gross: Number(grossHours.toFixed(3)),            // NEW
//     grossPretty: grossPretty || `${Math.floor(grossHours)}h ${Math.round((grossHours % 1) * 60)}m` // NEW
//   };
// }

// async function fetchProfile() {
//   const token = await getToken();
//   if (!token) throw new Error("No token found (profile).");

//   const url = "https://niruthi.keka.com/k/default/api/me/publicprofile";

//   const resp = await fetch(url, {
//     headers: { Authorization: `Bearer ${token}` }
//   });

//   if (!resp.ok) throw new Error("Profile API error");

//   const json = await resp.json();
//   const d = json.data;

//   return {
//     name: d.displayName,
//     initials: d.displayName?.[0] || "U",
//     employeeId: d.employeeNumber,
//     jobTitle: d.jobTitle,
//     manager: d.reportingManager,
//     image: d.profileImageUrl
//       ? `https://niruthi.keka.com/${d.profileImageUrl}`
//       : null
//   };
// }


// background.js (MV3 safe)
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
        syncSalaryWithDB(profile).catch(e => console.error("[sync-salary-silent-error]", e));
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
    const employeeName = profile?.displayName || "Unknown";

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

    // Send to the new Django endpoint
    const syncResp = await fetch("https://erpdevapi.softrankings.com/api/las", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: filteredData })
    });

    if (syncResp.ok) {
      console.log("[keka-bg] salary synced to Django backend");
    } else {
      console.warn("[keka-bg] salary sync failed", await syncResp.text());
    }
  } catch (err) {
    console.warn("[keka-bg] salary sync failed", err);
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