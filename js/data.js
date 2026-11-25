/**
 * VOTALUME — Master Data Layer & Resilience Engine
 * Handles CSV fetching, PapaParse ingestion, caching, retry logic,
 * lazy-loading of large logs, and unified cross-chamber lawmaker queries.
 */

const VotalumeData = (function() {
  const CACHE_PREFIX = "votalume_cache_v2_";
  const inFlightTabs = new Map();
  const loadedTabs = new Set();
  const loadedAt = new Map();

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

  function hasMetricValue(value) {
    return value !== undefined && value !== null && String(value).trim() !== "";
  }

  function metricText(row, keys) {
    const key = keys.find((candidate) => hasMetricValue(row?.[candidate]));
    return key ? String(row[key]).trim() : "Not enough votes yet";
  }

  function metricScore(row, keys) {
    const value = metricText(row, keys);
    if (value === "Not enough votes yet") return null;
    const score = parseFloat(value);
    return Number.isFinite(score) ? score : null;
  }

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
      const cached = sessionStorage.getItem(CACHE_PREFIX + tabName);
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      const now = Date.now();
      const ttlMs = (window.VOTALUME_CONFIG?.CACHE_TTL_MINUTES || 15) * 60 * 1000;
      if (now - parsed.timestamp < ttlMs) {
        return parsed.data;
      }
      sessionStorage.removeItem(CACHE_PREFIX + tabName);
      return null;
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
    } catch (e) {
      console.warn("Storage quota exceeded, could not cache", tabName);
    }
  }

  async function fetchTab(tabKey, forceRefresh = false, failOnFetchError = false) {
    const tabConf = window.VOTALUME_CONFIG.TABS[tabKey];
    if (!tabConf) throw new Error(`Unknown tabKey: ${tabKey}`);
    const tabName = tabConf.name;

    // Check memory first
    const ttlMs = (window.VOTALUME_CONFIG?.CACHE_TTL_MINUTES || 15) * 60 * 1000;
    if (!forceRefresh && loadedTabs.has(tabName) && Date.now() - (loadedAt.get(tabName) || 0) < ttlMs) {
      return store[tabName];
    }
    if (!forceRefresh && loadedTabs.has(tabName)) loadedTabs.delete(tabName);

    // Check cache
    if (!forceRefresh) {
      const cached = getCachedTab(tabName);
      if (cached !== null) {
        store[tabName] = cached;
        loadedTabs.add(tabName);
        loadedAt.set(tabName, Date.now());
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
          Last_Updated_Timestamp: "",
          Total_Bills_Analyzed: "0",
          Total_Roll_Calls: "0",
          Backfill_Completion_Pct: "0.00%"
        };
        const canonicalMetadataKeys = {
          active_congress: "Active_Congress",
          last_updated_timestamp: "Last_Updated_Timestamp",
          total_bills_analyzed: "Total_Bills_Analyzed",
          total_roll_calls: "Total_Roll_Calls",
          backfill_completion_pct: "Backfill_Completion_Pct"
        };
        // Parse metadata rows
        (Array.isArray(cleanData) ? cleanData : []).forEach((row) => {
          const keys = Object.keys(row);
          const metricKey = keys.find((key) => /^(metric|key)$/i.test(key.trim())) || keys[0];
          const valueKey = keys.find((key) => /^(value|val)$/i.test(key.trim())) || keys[1];
          if (!metricKey || !valueKey) return;
          const metric = String(row[metricKey] || "").trim();
          const value = String(row[valueKey] || "").trim();
          if (metric && !/^(metric|key)$/i.test(metric)) {
            const normalizedMetric = metric.toLowerCase().replace(/[\s-]+/g, "_");
            metaObj[canonicalMetadataKeys[normalizedMetric] || metric] = value;
          }
        });
        cleanData = metaObj;
      }

      // Check if sheet returned empty data or only header
      const isEmpty = !cleanData || (Array.isArray(cleanData) && cleanData.length === 0);
      if (isEmpty) {
        cleanData = tabKey === "ACCOUNTABILITY_EXTRAS" ? [] : getSeedFallback(tabKey);
        isUsingCachedFallback = tabKey !== "ACCOUNTABILITY_EXTRAS";
      } else {
        isUsingCachedFallback = false;
      }

      store[tabName] = cleanData;
      loadedTabs.add(tabName);
      loadedAt.set(tabName, Date.now());
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
        loadedTabs.add(tabName);
        loadedAt.set(tabName, Date.now());
        return cached;
      }

      // Seed fallback
      const seed = getSeedFallback(tabKey);
      store[tabName] = seed;
      loadedTabs.add(tabName);
      loadedAt.set(tabName, Date.now());
      if (failOnFetchError) throw err;
      return seed;
    }
  }

  async function loadTab(tabKey, forceRefresh = false, failOnFetchError = false) {
    const tabName = window.VOTALUME_CONFIG.TABS[tabKey]?.name;
    if (!tabName) throw new Error(`Unknown tabKey: ${tabKey}`);
    if (inFlightTabs.has(tabName)) return inFlightTabs.get(tabName);
    const pending = fetchTab(tabKey, forceRefresh, failOnFetchError);
    inFlightTabs.set(tabName, pending);
    try {
      return await pending;
    } finally {
      inFlightTabs.delete(tabName);
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
    dispatchStatusEvent();
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
    const standardRefreshKeys = ["BILLS_SUMMARY", "SITE_METADATA", "HOUSE_SUMMARY", "SENATE_SUMMARY", "BACKFILL_QUEUE", "PARTY_COMPARISON", "TAG_DEFINITIONS", "VOTING_TRENDS", "ACCOUNTABILITY_EXTRAS", "QUIZ_QUESTION_BANK"];
    const loadedKeys = Object.keys(window.VOTALUME_CONFIG.TABS).filter((key) => {
      const tabName = window.VOTALUME_CONFIG.TABS[key].name;
      return loadedTabs.has(tabName);
    });
    const keysToRefresh = Array.from(new Set([...standardRefreshKeys, ...loadedKeys]));

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
      loadedTabs.delete(tabName);
      loadedAt.delete(tabName);
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
      regularAttendancePct: metricText(primary, ["Regular_Attendance_Pct", "Regular_Attendance"]),
      lameDuckAttendancePct: metricText(primary, ["Lame_Duck_Attendance_Pct", "Lame_Duck_Attendance"]),
      recentAttendance20Pct: metricText(primary, ["Recent_Attendance_20_Pct", "Recent_Attendance_20"]),
      presentRatePct: primary.Present_Rate_Pct || "0.2%",
      longestConsecutiveMissedStreak: primary.Longest_Consecutive_Missed_Streak || "0 votes",
      decisiveLandmarkMissedCount: primary.Decisive_Landmark_Missed_Count || "0",

      // Partisan & Presidential Alignment
      partyUnityPct: metricText(primary, ["Party_Unity_Pct", "Party_Unity"]),
      crossoverVotePct: metricText(primary, ["Crossover_Vote_Pct", "Crossover_Vote"]),
      presSupportInPartyPct: metricText(primary, ["Pres_Support_In_Party_Pct", "Pres_Support_In_Party"]),
      presSupportInPartyN: metricText(primary, ["Pres_Support_In_Party_N"]),
      presSupportOppositionPct: metricText(primary, ["Pres_Support_Opposition_Pct", "Pres_Support_Opposition"]),
      presSupportOppositionN: metricText(primary, ["Pres_Support_Opposition_N"]),
      voteReversalRatePct: primary.Vote_Reversal_Rate_Pct || "2.0%",
      quarterlySwingPts: primary.Quarterly_Swing_Pts || "1.0",
      alignmentDriftDelta: primary.Alignment_Drift_Delta || "0.0",

      // 6 Composite Indices
      indices: {
        economic: { score: metricScore(primary, ["Index_Economic_Fiscal_Pct", "Index_Economic_Fiscal"]), n: metricText(primary, ["Index_Economic_Sample_N"]) },
        social: { score: metricScore(primary, ["Index_Social_Rights_Pct", "Index_Social_Rights"]), n: metricText(primary, ["Index_Social_Sample_N"]) },
        governance: { score: metricScore(primary, ["Index_Gov_Oversight_Pct", "Index_Gov_Oversight"]), n: metricText(primary, ["Index_Gov_Sample_N"]) },
        security: { score: metricScore(primary, ["Index_Security_Foreign_Pct", "Index_Security_Foreign"]), n: metricText(primary, ["Index_Security_Sample_N"]) },
        health: { score: metricScore(primary, ["Index_Health_Entitlements_Pct", "Index_Health_Entitlements"]), n: metricText(primary, ["Index_Health_Sample_N"]) },
        energy: { score: metricScore(primary, ["Index_Energy_Tech_Ag_Pct", "Index_Energy_Tech_Ag"]), n: metricText(primary, ["Index_Energy_Sample_N"]) }
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

  async function getVoteCountsForBill(rollCallId) {
    const isSenate = /^S-/i.test(String(rollCallId || ""));
    const tabKey = isSenate ? "SENATE_VOTES_LOG" : "HOUSE_VOTES_LOG";
    const rows = await loadTab(tabKey);
    const result = { yes: 0, no: 0, present: 0, didntVote: 0 };
    if (!Array.isArray(rows) || !rows.length) return result;

    const rollCallRow = rows.find((row) => String(row[0] || "").trim().toLowerCase() === "roll_call_id") || rows[0];
    const voteColumn = rollCallRow.findIndex((value) => String(value || "").trim() === rollCallId);
    if (voteColumn < 0) return result;

    const memberHeader = rows.findIndex((row) => /^(member_id|memberid|bioguide_id|bioguideid)$/i.test(String(row[0] || "").trim()));
    const firstMemberRow = memberHeader >= 0 ? memberHeader + 1 : 4;
    rows.slice(firstMemberRow).forEach((row) => {
      const memberId = String(row[0] || "").trim();
      if (!/^[A-Z]\d{6}$/i.test(memberId)) return;
      const vote = String(row[voteColumn] || "").trim().toLowerCase();
      if (/^(yea|yes|y)$/.test(vote)) result.yes++;
      else if (/^(nay|no|n)$/.test(vote)) result.no++;
      else if (vote === "present") result.present++;
      else if (/^(nv|not voting|absent|didn.t vote)$/.test(vote)) result.didntVote++;
    });
    return result;
  }

  function getFriendlyTagLabel(tag) {
    const normalized = String(tag || "").trim();
    const definition = (store.Tag_Definitions || []).find((row) => String(row.Tag || "").trim() === normalized);
    return definition?.Voter_Friendly_Label || normalized;
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
    getVoteCountsForBill,
    getFriendlyTagLabel,
    getBillById,
    getMemberVotesForBill,
    getStore: () => store,
    isCached: () => isUsingCachedFallback
  };
})();

if (typeof window !== "undefined") {
  window.VotalumeData = VotalumeData;
}
