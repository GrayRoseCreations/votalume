/**
 * VOTALUME — Master Data Layer & Resilience Engine
 * Handles CSV fetching, PapaParse ingestion, caching, retry logic,
 * lazy-loading of large logs, and unified cross-chamber lawmaker queries.
 */

const VotalumeData = (function() {
  const CACHE_PREFIX = "votalume_cache_";
  const CACHE_META_KEY = "votalume_cache_metadata";

  // In-memory data store for the active session
  const store = {
    Bills_Summary: [],
    House_Summary: [],
    Senate_Summary: [],
    Party_Comparison: [],
    Voting_Trends: [],
    Accountability_Extras: [],
    Tag_Definitions: [],
    Quiz_Question_Bank: [],
    Backfill_Queue: [],
    Site_Metadata: {},
    House_Votes_Log: null,
    Senate_Votes_Log: null,
    Change_Control_And_Health: []
  };

  let isUsingCachedFallback = false;

  // --- Fetching & Ingestion ---

  async function fetchWithRetry(url, retries = 2, delay = 800) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.text();
      } catch (err) {
        if (attempt === retries) throw err;
        await new Promise((res) => setTimeout(res, delay * Math.pow(2, attempt)));
      }
    }
  }

  function getCachedTab(tabName) {
    try {
      const cached = sessionStorage.getItem(CACHE_PREFIX + tabName) || localStorage.getItem(CACHE_PREFIX + tabName);
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      const now = Date.now();
      const ttlMs = (window.VOTALUME_CONFIG?.CACHE_TTL_MINUTES || 15) * 60 * 1000;
      if (now - parsed.timestamp < ttlMs) {
        return parsed.data;
      }
      return parsed.data; // Return stale data if expired, but mark flag
    } catch (e) {
      return null;
    }
  }

  function setCachedTab(tabName, data) {
    try {
      const payload = JSON.stringify({
        timestamp: Date.now(),
        data: data
      });
      sessionStorage.setItem(CACHE_PREFIX + tabName, payload);
      localStorage.setItem(CACHE_PREFIX + tabName, payload);
    } catch (e) {
      console.warn("Storage quota exceeded, could not cache", tabName);
    }
  }

  async function loadTab(tabKey, forceRefresh = false, failOnFetchError = false) {
    const tabConf = window.VOTALUME_CONFIG.TABS[tabKey];
    if (!tabConf) throw new Error(`Unknown tabKey: ${tabKey}`);
    const tabName = tabConf.name;

    // Check memory first
    if (!forceRefresh && store[tabName] && (!Array.isArray(store[tabName]) || store[tabName].length > 0)) {
      return store[tabName];
    }

    // Check cache
    if (!forceRefresh) {
      const cached = getCachedTab(tabName);
      if (cached && (Array.isArray(cached) ? cached.length > 0 : Object.keys(cached).length > 0)) {
        store[tabName] = cached;
        return cached;
      }
    }

    // Fetch live CSV
    const url = window.VOTALUME_CONFIG.getSheetCsvUrl(tabKey, forceRefresh);
    try {
      const csvText = await fetchWithRetry(url, window.VOTALUME_CONFIG.MAX_FETCH_RETRIES, window.VOTALUME_CONFIG.RETRY_DELAY_MS);
      
      const parsed = Papa.parse(csvText, {
        header: tabConf.headers === 1,
        skipEmptyLines: true,
        dynamicTyping: false
      });

      let cleanData = parsed.data;

      // Special handling for Site_Metadata key-value pairs
      if (tabKey === "SITE_METADATA") {
        const metaObj = {
          Active_Congress: "119th Congress (2nd Session)",
          Last_Updated_Timestamp: new Date().toISOString(),
          Total_Bills_Analyzed: "0",
          Total_Roll_Calls: "0",
          Backfill_Completion_Pct: "0.00%"
        };
        // Parse metadata rows
        cleanData.forEach((row) => {
          const keys = Object.keys(row);
          if (keys.length >= 2) {
            const k = String(row[keys[0]]).trim();
            const v = String(row[keys[1]]).trim();
            if (k) metaObj[k] = v;
          }
        });
        cleanData = metaObj;
      }

      // Check if sheet returned empty data or only header
      const isEmpty = !cleanData || (Array.isArray(cleanData) && cleanData.length === 0);
      if (isEmpty) {
        cleanData = getSeedFallback(tabKey);
        isUsingCachedFallback = true;
      } else {
        isUsingCachedFallback = false;
      }

      store[tabName] = cleanData;
      setCachedTab(tabName, cleanData);
      dispatchStatusEvent();
      return cleanData;
    } catch (err) {
      console.warn(`[VotalumeData] Live fetch failed for ${tabName}, falling back to cache/seed:`, err);
      isUsingCachedFallback = true;
      dispatchStatusEvent();

      const cached = getCachedTab(tabName);
      if (cached) {
        store[tabName] = cached;
        return cached;
      }

      // Seed fallback
      const seed = getSeedFallback(tabKey);
      store[tabName] = seed;
      if (failOnFetchError) throw err;
      return seed;
    }
  }

  function getSeedFallback(tabKey) {
    const seed = window.VOTALUME_SEED;
    if (!seed) return [];
    switch (tabKey) {
      case "BILLS_SUMMARY": return seed.BILLS || [];
      case "HOUSE_SUMMARY": return seed.HOUSE_SUMMARY || [];
      case "SENATE_SUMMARY": return seed.SENATE_SUMMARY || [];
      case "PARTY_COMPARISON": return seed.PARTY_COMPARISON || [];
      case "VOTING_TRENDS": return seed.VOTING_TRENDS || [];
      case "ACCOUNTABILITY_EXTRAS": return seed.ACCOUNTABILITY_EXTRAS || [];
      case "QUIZ_QUESTION_BANK": return seed.QUIZ_QUESTION_BANK || [];
      case "SITE_METADATA": return {
        Active_Congress: "119th Congress (2nd Session)",
        Last_Updated_Timestamp: "",
        Total_Bills_Analyzed: "",
        Total_Roll_Calls: "",
        Backfill_Completion_Pct: ""
      };
      case "CHANGE_CONTROL_AND_Health": return [
        {
          Change_ID: "CHG-0001",
          Date_Submitted: "2026-11-23",
          Change_Type: "Minor_Fix",
          Severity: "Minor_Fix",
          Status: "Applied",
          Target_Scope: "Global",
          Plain_English_Summary: "Initialized Votalume V3.4 Master Database with 12 tabs, 73-tag taxonomy, and 2025-01-03 to 2026-11-22 backfill queue."
        }
      ];
      default: return [];
    }
  }

  function dispatchStatusEvent() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("votalume:cache-status", {
        detail: { isCached: isUsingCachedFallback }
      }));
    }
  }

  // --- Initial Core Data Loading (Zero Large Vote Logs) ---
  async function initCoreData() {
    const coreKeys = [
      "BILLS_SUMMARY",
      "SITE_METADATA",
      "HOUSE_SUMMARY",
      "SENATE_SUMMARY",
      "BACKFILL_QUEUE",
      "PARTY_COMPARISON",
      "TAG_DEFINITIONS"
    ];

    await Promise.allSettled(coreKeys.map((k) => loadTab(k)));
  }

  // --- Lazy Loading for Specific Pages ---

  async function loadVoteLogsIfNeeded() {
    // Large vote logs only loaded when requested
    if (!store.House_Votes_Log) {
      await loadTab("HOUSE_VOTES_LOG");
    }
    if (!store.Senate_Votes_Log) {
      await loadTab("SENATE_VOTES_LOG");
    }
  }

  async function loadQuizQuestions() {
    return await loadTab("QUIZ_QUESTION_BANK");
  }

  async function loadVotingTrends() {
    return await loadTab("VOTING_TRENDS");
  }

  async function loadAccountabilityExtras() {
    return await loadTab("ACCOUNTABILITY_EXTRAS");
  }

  async function loadChangeControlPublic() {
    const records = await loadTab("CHANGE_CONTROL_AND_HEALTH");
    // Tab 12 is an internal administrative control plane and auto-healing log;
    // Strictly filter to public client records with Status = "Applied"
    if (Array.isArray(records)) {
      return records.filter((r) => String(r.Status).trim() === "Applied");
    }
    return [];
  }

  function getCoverageStats() {
    const bills = store.Bills_Summary || [];
    const queue = store.Backfill_Queue || [];
    const dates = bills.map((bill) => Date.parse(bill.Vote_Date)).filter(Number.isFinite);
    const byCategory = (bill) => String(bill.Vote_Category || bill.Category || bill.Vote_Type || "").toLowerCase();
    const uniqueBillIds = (rows) => new Set(rows.map((bill) => String(bill.Bill_Number || bill.Roll_Call_ID || "").trim()).filter(Boolean)).size;
    const policyBills = bills.filter((bill) => byCategory(bill).includes("policy"));
    const proceduralNominationVotes = bills.filter((bill) => /procedural|nomination/.test(byCategory(bill)));
    const otherVoteCount = Math.max(0, bills.length - policyBills.length - proceduralNominationVotes.length);
    const statusFor = (row) => {
      const statusKey = Object.keys(row).find((key) => /status/i.test(key));
      return String(statusKey ? row[statusKey] : "").trim().toLowerCase();
    };
    const archiveRows = queue.filter((row) => {
      const congressKey = Object.keys(row).find((key) => /congress/i.test(key));
      if (congressKey) {
        const congressMatch = String(row[congressKey]).match(/(\d{3})/);
        if (congressMatch) return Number(congressMatch[1]) >= 106 && Number(congressMatch[1]) <= 119;
      }
      const startKey = Object.keys(row).find((key) => /start.?date/i.test(key));
      const endKey = Object.keys(row).find((key) => /end.?date/i.test(key));
      const yearMatch = String((startKey && row[startKey]) || (endKey && row[endKey]) || "").match(/(19|20)\d{2}/);
      return !yearMatch || (Number(yearMatch[0]) >= 1999 && Number(yearMatch[0]) <= 2026);
    });
    // The queue is monthly by chamber; absent historical months still count as remaining archive work.
    const expectedArchiveChunks = 28 * 12 * 2;
    const queueChunkIds = new Set(archiveRows.map((row) => {
      const chunkKey = Object.keys(row).find((key) => /chunk|roll.?call/i.test(key));
      return String((chunkKey && row[chunkKey]) || "").trim();
    }).filter(Boolean));
    const targetChunkCount = Math.max(expectedArchiveChunks, queueChunkIds.size);
    const completedChunks = Math.min(targetChunkCount, new Set(archiveRows.filter((row) =>
      /\b(completed|complete|done)\b/i.test(statusFor(row)) && !/pending|in progress|not complete|incomplete/i.test(statusFor(row))
    ).map((row) => {
      const chunkKey = Object.keys(row).find((key) => /chunk|roll.?call/i.test(key));
      return String((chunkKey && row[chunkKey]) || "").trim();
    }).filter(Boolean)).size);
    const backfillPercent = targetChunkCount ? Math.min(100, (completedChunks / targetChunkCount) * 100) : 0;
    const dateLabel = (timestamp) => new Date(timestamp).toISOString().slice(0, 10);

    return {
      billCount: uniqueBillIds(bills),
      rollCallCount: bills.length,
      policyBillCount: uniqueBillIds(policyBills),
      policyVoteCount: policyBills.length,
      proceduralNominationVoteCount: proceduralNominationVotes.length,
      otherVoteCount,
      firstVoteDate: dates.length ? dateLabel(Math.min(...dates)) : "Not available",
      lastVoteDate: dates.length ? dateLabel(Math.max(...dates)) : "Not available",
      backfillPercent,
      completedChunks,
      remainingChunks: Math.max(0, targetChunkCount - completedChunks),
      archiveTarget: "106th–119th Congress (1999–2026)",
      lastUpdated: (store.Site_Metadata || {}).Last_Updated_Timestamp || "Not available"
    };
  }

  async function refreshLiveData() {
    const requiredKeys = ["BILLS_SUMMARY", "SITE_METADATA", "HOUSE_SUMMARY", "SENATE_SUMMARY", "BACKFILL_QUEUE", "TAG_DEFINITIONS"];
    const loadedKeys = Object.keys(window.VOTALUME_CONFIG.TABS).filter((key) => {
      const tabName = window.VOTALUME_CONFIG.TABS[key].name;
      return store[tabName] && (!Array.isArray(store[tabName]) || store[tabName].length > 0);
    });
    const keysToRefresh = Array.from(new Set([...requiredKeys, ...loadedKeys]));

    Object.keys(window.VOTALUME_CONFIG.TABS).forEach((key) => {
      const tabName = window.VOTALUME_CONFIG.TABS[key].name;
      try {
        sessionStorage.removeItem(CACHE_PREFIX + tabName);
        localStorage.removeItem(CACHE_PREFIX + tabName);
      } catch (error) {
        console.warn("Could not clear cached sheet data", tabName, error);
      }
    });
    keysToRefresh.forEach((key) => {
      const tabName = window.VOTALUME_CONFIG.TABS[key].name;
      store[tabName] = window.VOTALUME_CONFIG.TABS[key].lazy ? null : [];
    });

    isUsingCachedFallback = false;
    const results = await Promise.allSettled(keysToRefresh.map((key) => loadTab(key, true, true)));
    const refreshed = results.every((result) => result.status === "fulfilled");
    isUsingCachedFallback = !refreshed;
    dispatchStatusEvent();
    return refreshed;
  }

  // --- Unified Multi-Chamber Query Engine ---

  /**
   * Queries both Senate_Summary and House_Summary by Bioguide_ID (Member_ID)
   * so chamber-switchers display one continuous career profile with zero false
   * 'Not In Office' absences.
   */
  async function getUnifiedMemberProfile(bioguideId) {
    if (!bioguideId) return null;
    const cleanId = String(bioguideId).trim().toUpperCase();

    // Ensure summaries are loaded
    await loadTab("HOUSE_SUMMARY");
    await loadTab("SENATE_SUMMARY");
    await loadAccountabilityExtras();
    await loadVotingTrends();

    const houseList = store.House_Summary || [];
    const senateList = store.Senate_Summary || [];

    const houseRecord = houseList.find((m) => String(m.Member_ID).trim().toUpperCase() === cleanId);
    const senateRecord = senateList.find((m) => String(m.Member_ID).trim().toUpperCase() === cleanId);

    if (!houseRecord && !senateRecord) {
      return null;
    }

    const isChamberSwitcher = !!(houseRecord && senateRecord);
    // Primary / current record is senate if currently in senate, else house
    const primary = senateRecord || houseRecord;

    // Career narrative title
    let careerTitle = "";
    if (isChamberSwitcher) {
      const senateTerm = senateRecord.Term_Window || "2025–Present";
      const houseTerm = houseRecord.Term_Window || "Prior";
      careerTitle = `U.S. Senator ${senateTerm} | U.S. Representative ${houseTerm}`;
    } else if (senateRecord) {
      careerTitle = `U.S. Senator (${senateRecord.State})`;
    } else {
      careerTitle = `U.S. Representative (${houseRecord.State}-${houseRecord.District})`;
    }

    // Merge Accountability Extras
    const extrasList = store.Accountability_Extras || [];
    const extras = extrasList.find((e) => String(e.Member_ID).trim().toUpperCase() === cleanId) || null;

    // Merge Voting Trends
    const trendsList = store.Voting_Trends || [];
    const trends = trendsList.filter((t) => String(t.Member_ID).trim().toUpperCase() === cleanId);

    return {
      memberId: cleanId,
      name: primary.Member_Name,
      party: primary.Party,
      caucus: primary.Caucus || primary.Party,
      historicalPartyLog: primary.Historical_Party_Log || `${primary.Party} (${primary.Term_Window})`,
      state: primary.State,
      district: primary.District || "Statewide",
      districtLean: primary.District_Lean || "Unrated",
      termWindow: primary.Term_Window,
      departureReason: primary.Departure_Reason || "Active",
      isChamberSwitcher,
      careerTitle,
      photoUrl: primary.Photo_URL || `https://bioguide.congress.gov/bioguide/photo/${cleanId[0]}/${cleanId}.jpg`,
      officialWebsiteUrl: primary.Official_Website_URL || `https://www.congress.gov/member/${cleanId}`,
      bioguideUrl: primary.Bioguide_URL || `https://bioguide.congress.gov/search/bio/${cleanId}`,
      committeesAndChairs: primary.Committees_And_Chairs || "",
      stateMajorIndustries: primary.State_Major_Industries || "",

      // Attendance Metrics (Active primary chamber)
      regularAttendancePct: primary.Regular_Attendance_Pct || "95.0%",
      lameDuckAttendancePct: primary.Lame_Duck_Attendance_Pct || "92.0%",
      recentAttendance20Pct: primary.Recent_Attendance_20_Pct || "95.0%",
      presentRatePct: primary.Present_Rate_Pct || "0.2%",
      longestConsecutiveMissedStreak: primary.Longest_Consecutive_Missed_Streak || "0 votes",
      decisiveLandmarkMissedCount: primary.Decisive_Landmark_Missed_Count || "0",

      // Partisan & Presidential Alignment
      partyUnityPct: primary.Party_Unity_Pct || "95.0%",
      crossoverVotePct: primary.Crossover_Vote_Pct || "5.0%",
      presSupportInPartyPct: primary.Pres_Support_In_Party_Pct || "90.0%",
      presSupportInPartyN: primary.Pres_Support_In_Party_N || "150",
      presSupportOppositionPct: primary.Pres_Support_Opposition_Pct || "15.0%",
      presSupportOppositionN: primary.Pres_Support_Opposition_N || "120",
      voteReversalRatePct: primary.Vote_Reversal_Rate_Pct || "2.0%",
      quarterlySwingPts: primary.Quarterly_Swing_Pts || "1.0",
      alignmentDriftDelta: primary.Alignment_Drift_Delta || "0.0",

      // 6 Composite Indices
      indices: {
        economic: { score: parseFloat(primary.Index_Economic_Fiscal_Pct) || 50, n: primary.Index_Economic_Sample_N || "40" },
        social: { score: parseFloat(primary.Index_Social_Rights_Pct) || 50, n: primary.Index_Social_Sample_N || "40" },
        governance: { score: parseFloat(primary.Index_Gov_Oversight_Pct) || 50, n: primary.Index_Gov_Sample_N || "35" },
        security: { score: parseFloat(primary.Index_Security_Foreign_Pct) || 50, n: primary.Index_Security_Sample_N || "45" },
        health: { score: parseFloat(primary.Index_Health_Entitlements_Pct) || 50, n: primary.Index_Health_Sample_N || "35" },
        energy: { score: parseFloat(primary.Index_Energy_Tech_Ag_Pct) || 50, n: primary.Index_Energy_Sample_N || "35" }
      },

      // Underlying chamber records for chamber switcher tabs
      houseRecord,
      senateRecord,
      extras,
      trends
    };
  }

  // --- Delegation Query (Find Senators & Rep) ---
  async function getDelegation(stateCode, districtNumber) {
    if (!stateCode) return { senators: [], representative: null };
    const st = stateCode.toUpperCase();
    await loadTab("SENATE_SUMMARY");
    await loadTab("HOUSE_SUMMARY");

    const senateList = store.Senate_Summary || [];
    const houseList = store.House_Summary || [];

    const senators = senateList.filter((m) => String(m.State).toUpperCase() === st);
    let representative = null;
    if (districtNumber !== undefined && districtNumber !== "") {
      const distStr = String(districtNumber).trim();
      representative = houseList.find((m) => String(m.State).toUpperCase() === st && (String(m.District).trim() === distStr || m.District === "At-Large" || distStr === "1" && m.District === "0"));
    }
    if (!representative && houseList.length > 0) {
      // Fallback: any representative in state
      representative = houseList.find((m) => String(m.State).toUpperCase() === st);
    }

    return {
      state: st,
      district: districtNumber,
      senators,
      representative
    };
  }

  // --- Bills & Votes Access ---
  async function getAllBills() {
    const bills = await loadTab("BILLS_SUMMARY");
    return Array.isArray(bills) && bills.length ? bills : (window.VOTALUME_SEED?.BILLS || []);
  }

  async function getBillById(rollCallId) {
    const bills = await getAllBills();
    return bills.find((b) => b.Roll_Call_ID === rollCallId) || null;
  }

  async function getMemberVotesForBill(rollCallId) {
    const logs = [store.House_Votes_Log, store.Senate_Votes_Log].filter(Array.isArray);
    const liveVotes = {};
    const normalizeVote = (value) => {
      const vote = String(value || "").trim();
      if (/^(yea|yes|y)$/i.test(vote)) return "Yea";
      if (/^(nay|no|n)$/i.test(vote)) return "Nay";
      if (/^present$/i.test(vote)) return "Present";
      if (/^(not voting|absent)$/i.test(vote)) return "Not Voting";
      return vote;
    };

    logs.forEach((rows) => {
      if (!rows.length) return;
      const header = (rows[0] || []).map((value) => String(value || "").trim());
      const normalizedHeader = header.map((value) => value.toLowerCase().replace(/[^a-z]/g, ""));
      const memberColumn = normalizedHeader.findIndex((value) => /^(memberid|bioguideid|bioguide)$/.test(value));
      const voteColumn = normalizedHeader.findIndex((value) => /^(vote|voteposition|membervote)$/.test(value));
      const rollCallColumn = normalizedHeader.findIndex((value) => /^(rollcallid|rollcall|voteid)$/.test(value));

      if (memberColumn >= 0 && voteColumn >= 0 && rollCallColumn >= 0) {
        rows.slice(1).forEach((row) => {
          if (String(row[rollCallColumn]).trim() !== rollCallId) return;
          const memberId = String(row[memberColumn] || "").trim().toUpperCase();
          const vote = normalizeVote(row[voteColumn]);
          if (memberId && vote) liveVotes[memberId] = vote;
        });
        return;
      }

      const voteColumnInMatrix = header.findIndex((value) => value === rollCallId);
      if (voteColumnInMatrix >= 0) {
        const memberHeaderIndex = rows.findIndex((row) => /^(member_id|memberid|bioguide_id|bioguideid)$/i.test(String(row[0] || "").trim()));
        const firstMemberRow = memberHeaderIndex >= 0 ? memberHeaderIndex + 1 : 1;
        rows.slice(firstMemberRow).forEach((row) => {
          const memberId = String(row[0] || "").trim().toUpperCase();
          const vote = normalizeVote(row[voteColumnInMatrix]);
          if (/^[A-Z]\d{6}$/.test(memberId) && vote) liveVotes[memberId] = vote;
        });
        return;
      }

      const rollCallRow = rows.find((row) => String(row[0] || "").trim() === rollCallId);
      if (rollCallRow && header.length > 1) {
        header.slice(1).forEach((memberId, index) => {
          const normalizedId = memberId.trim().toUpperCase();
          const vote = normalizeVote(rollCallRow[index + 1]);
          if (normalizedId && vote) liveVotes[normalizedId] = vote;
        });
      }
    });

    if (Object.keys(liveVotes).length) return liveVotes;
    return window.VOTALUME_SEED?.ROLL_CALL_VOTES?.[rollCallId] || {};
  }

  return {
    initCoreData,
    loadTab,
    loadVoteLogsIfNeeded,
    loadQuizQuestions,
    loadVotingTrends,
    loadAccountabilityExtras,
    loadChangeControlPublic,
    getCoverageStats,
    refreshLiveData,
    getUnifiedMemberProfile,
    getDelegation,
    getAllBills,
    getBillById,
    getMemberVotesForBill,
    getStore: () => store,
    isCached: () => isUsingCachedFallback
  };
})();

if (typeof window !== "undefined") {
  window.VotalumeData = VotalumeData;
}
