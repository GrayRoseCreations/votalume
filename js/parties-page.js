/**
 * VOTALUME — Party Caucus Comparison Controller
 */

document.addEventListener("DOMContentLoaded", async () => {
  VotalumeUI.initCommon();
  VotalumeAuth.init();
  await VotalumeData.initCoreData();
  await VotalumeData.loadVoteLogsIfNeeded();

  const scopeSelect = document.getElementById("party-chamber-scope");
  if (scopeSelect) scopeSelect.value = "Both";
  VotalumeUI.populateActiveTagFilter(document.getElementById("party-tag-filter"), "All Active Tags");
  setupScopeListener();
  document.getElementById("party-tag-filter")?.addEventListener("change", () => renderCrossoverTags());
  window.addEventListener("votalume:data-refreshed", () => renderParties(scopeSelect?.value || "Both"));
  await renderParties("Both");
});

function setupScopeListener() {
  document.getElementById("party-chamber-scope")?.addEventListener("change", (event) => {
    renderParties(event.target.value);
  });
}

function displayPartyMetric(value) {
  return value !== undefined && value !== null && String(value).trim() !== ""
    ? String(value).trim()
    : "Not enough votes yet";
}

function scorePartyMetric(value) {
  const parsed = Number.parseFloat(String(value || "").replace("%", "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function partyName(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "d" || normalized.includes("dem")) return "Democratic";
  if (normalized === "r" || normalized.includes("rep")) return "Republican";
  if (normalized === "i" || normalized.includes("ind")) return "Independent";
  return String(value || "Party unavailable");
}

function chamberMatches(value, scope) {
  const chamber = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  if (scope === "Both") return ["both", "combined", "house/senate", "houseandsenate"].includes(chamber);
  return chamber === String(scope).toLowerCase();
}

async function renderParties(scope = "Both") {
  await Promise.all([
    VotalumeData.loadTab("PARTY_COMPARISON"),
    VotalumeData.loadTab("HOUSE_SUMMARY"),
    VotalumeData.loadTab("SENATE_SUMMARY"),
    VotalumeData.loadVoteLogsIfNeeded()
  ]);
  const store = VotalumeData.getStore();
  const comparisonData = store.Party_Comparison || [];
  const house = store.House_Summary || [];
  const senate = store.Senate_Summary || [];

  const comparisonRowsFor = (party) => {
    const partyRows = comparisonData.filter((row) => partyName(row.Party_Caucus || row.Party) === party);
    const exactRows = partyRows.filter((row) => chamberMatches(row.Chamber, scope));
    if (exactRows.length) return exactRows[0];
    if (scope === "Both") {
      const chamberRows = partyRows.filter((row) =>
        ["house", "senate"].includes(String(row.Chamber || "").trim().toLowerCase())
      );
      if (chamberRows.length) return aggregatePartyRows(chamberRows);
    }
    return {};
  };

  const demData = comparisonRowsFor("Democratic");
  const repData = comparisonRowsFor("Republican");
  renderPartyCard("dem", demData);
  renderPartyCard("rep", repData);

  const demIndices = {
    economic: { score: scorePartyMetric(demData.Index_Economic_Fiscal_Pct) },
    social: { score: scorePartyMetric(demData.Index_Social_Rights_Pct) },
    governance: { score: scorePartyMetric(demData.Index_Gov_Oversight_Pct) },
    security: { score: scorePartyMetric(demData.Index_Security_Foreign_Pct) },
    health: { score: scorePartyMetric(demData.Index_Health_Entitlements_Pct) },
    energy: { score: scorePartyMetric(demData.Index_Energy_Tech_Ag_Pct) }
  };
  const repIndices = {
    economic: { score: scorePartyMetric(repData.Index_Economic_Fiscal_Pct) },
    social: { score: scorePartyMetric(repData.Index_Social_Rights_Pct) },
    governance: { score: scorePartyMetric(repData.Index_Gov_Oversight_Pct) },
    security: { score: scorePartyMetric(repData.Index_Security_Foreign_Pct) },
    health: { score: scorePartyMetric(repData.Index_Health_Entitlements_Pct) },
    energy: { score: scorePartyMetric(repData.Index_Energy_Tech_Ag_Pct) }
  };
  VotalumeCharts.renderIndicesBarChart("parties-indices-chart", demIndices, "Democratic Caucus", repIndices, "Republican Caucus");

  const scopedMembers = [
    ...(scope === "Senate" ? [] : house.map((member) => ({ ...member, Chamber: "House" }))),
    ...(scope === "House" ? [] : senate.map((member) => ({ ...member, Chamber: "Senate" })))
  ];
  const membersById = new Map();
  scopedMembers.forEach((member) => {
    if (member.Member_ID) membersById.set(String(member.Member_ID).toUpperCase(), member);
  });
  const members = [...membersById.values()];
  const memberVoteCounts = buildMemberVoteCounts(store);
  const caucusMembers = (party) => members.filter((member) => {
    const caucus = String(member.Caucus || "").trim();
    return partyName(caucus || member.Party) === party;
  });
  const demMembers = caucusMembers("Democratic");
  const repMembers = caucusMembers("Republican");
  renderLeaderList("dem-top-independent-list", demMembers, "Crossover_Vote_Pct", "crossover", memberVoteCounts);
  renderLeaderList("dem-top-loyal-list", demMembers, "Party_Unity_Pct", "unity", memberVoteCounts);
  renderLeaderList("rep-top-independent-list", repMembers, "Crossover_Vote_Pct", "crossover", memberVoteCounts);
  renderLeaderList("rep-top-loyal-list", repMembers, "Party_Unity_Pct", "unity", memberVoteCounts);
  await renderCrossoverTags(scope);
}

function aggregatePartyRows(rows) {
  const memberCount = (row) => Number.parseInt(String(row.Active_Member_Count || "").replace(/[^\d]/g, ""), 10) || 0;
  const totalMembers = rows.reduce((sum, row) => sum + memberCount(row), 0);
  const aggregated = { Active_Member_Count: String(totalMembers) };
  const fields = new Set(rows.flatMap((row) => Object.keys(row).filter((key) => /_Pct$/.test(key))));
  fields.forEach((field) => {
    const available = rows.map((row) => ({
      value: scorePartyMetric(row[field]),
      weight: memberCount(row)
    })).filter((item) => item.value !== null);
    if (!available.length) return;
    const weightTotal = available.reduce((sum, item) => sum + item.weight, 0);
    const average = weightTotal
      ? available.reduce((sum, item) => sum + item.value * item.weight, 0) / weightTotal
      : available.reduce((sum, item) => sum + item.value, 0) / available.length;
    aggregated[field] = `${average.toFixed(1)}%`;
  });
  return aggregated;
}

function renderPartyCard(prefix, data) {
  const setText = (suffix, value) => {
    const element = document.getElementById(`${prefix}-${suffix}`);
    if (element) element.textContent = displayPartyMetric(value);
  };
  const count = document.getElementById(`${prefix}-active-count`);
  if (count) {
    const members = Number.parseInt(String(data.Active_Member_Count || "").replace(/[^\d]/g, ""), 10);
    count.textContent = Number.isFinite(members) && members > 0 ? `${members} Members` : "Not enough votes yet";
  }
  [
    ["unity-val", data.Party_Unity_Pct],
    ["crossover-val", data.Crossover_Vote_Pct],
    ["voted-val", data.Voted_Pct],
    ["present-val", data.Present_Pct],
    ["nv-val", data.Not_Voting_Pct],
    ["reg-att-val", data.Regular_Attendance_Pct],
    ["pres-own-val", data.Pres_Support_In_Party_Pct],
    ["pres-opp-val", data.Pres_Support_Opposition_Pct],
    ["lost-att-val", data.Lame_Duck_Attendance_Lost_Pct],
    ["ret-att-val", data.Lame_Duck_Attendance_Retired_Pct]
  ].forEach(([suffix, value]) => setText(suffix, value));
  const bar = document.getElementById(`${prefix}-unity-bar`);
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, scorePartyMetric(data.Party_Unity_Pct) || 0))}%`;
}

function parsePercent(value) {
  const parsed = Number.parseFloat(String(value || "").replace("%", "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function isUsableLeader(member, field) {
  const score = parsePercent(member[field]);
  if (score === null || score <= 0) return false;
  const voteCountKey = ["Vote_Count", "Votes_Cast", "Total_Votes", "Roll_Calls_Voted", "Eligible_Votes"]
    .find((key) => member[key] !== undefined && String(member[key]).trim() !== "");
  if (voteCountKey && (!Number.isFinite(Number(member[voteCountKey])) || Number(member[voteCountKey]) <= 0)) return false;
  return true;
}

function buildMemberVoteCounts(store) {
  const votesByRollCall = new Map();
  const tagsByRollCall = new Map();
  collectLogVotes(store.House_Votes_Log, votesByRollCall, tagsByRollCall);
  collectLogVotes(store.Senate_Votes_Log, votesByRollCall, tagsByRollCall);
  const counts = new Map();
  votesByRollCall.forEach((votes) => votes.forEach((vote, memberId) => {
    if (vote === "YES" || vote === "NO" || vote === "PRESENT") {
      counts.set(memberId, (counts.get(memberId) || 0) + 1);
    }
  }));
  return counts;
}

function renderLeaderList(containerId, members, fieldKey, type, memberVoteCounts) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const color = type === "crossover" ? "var(--color-crossover)" : "var(--color-civic-navy)";
  const leaders = members.filter((member) => member.Member_ID &&
    memberVoteCounts.get(String(member.Member_ID).toUpperCase()) > 0 &&
    isUsableLeader(member, fieldKey))
    .sort((a, b) => parsePercent(b[fieldKey]) - parsePercent(a[fieldKey]))
    .slice(0, 5);
  if (!leaders.length) {
    container.innerHTML = '<p style="color:var(--color-text-muted);">No scored members available for this chamber.</p>';
    return;
  }
  container.innerHTML = leaders.map((member, index) => {
    const pct = parsePercent(member[fieldKey]);
    const party = partyName(member.Party);
    const location = member.Chamber === "House"
      ? `${member.State || "State unavailable"}-${member.District || "District unavailable"}`
      : member.State || "State unavailable";
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;padding:0.45rem 0;border-bottom:1px solid var(--color-border);">
        <div>
          <span style="font-weight:700;color:var(--color-text-muted);margin-right:0.35rem;">#${index + 1}</span>
          <a href="member.html?id=${encodeURIComponent(member.Member_ID)}" style="font-weight:600;">${VotalumeUI.escapeHtml(member.Member_Name || "Lawmaker")}</a>
          <div style="font-size:0.75rem;color:var(--color-text-muted);">${VotalumeUI.escapeHtml(member.Chamber)} • ${VotalumeUI.escapeHtml(party)} • ${VotalumeUI.escapeHtml(location)}</div>
        </div>
        <strong style="color:${color};white-space:nowrap;">${pct.toFixed(1)}%</strong>
      </div>
    `;
  }).join("");
}

function normalizeVote(value) {
  const vote = String(value || "").trim().toLowerCase();
  if (["yea", "yes", "y"].includes(vote)) return "YES";
  if (["nay", "no", "n"].includes(vote)) return "NO";
  if (vote === "present") return "PRESENT";
  if (["nv", "not voting", "absent", "didn't vote", "did not vote"].includes(vote)) return "ABSENT";
  if (vote === "not in office" || vote === "not in office (excluded from attendance)") return "NOT_IN_OFFICE";
  return "";
}

function isRollCallId(value) {
  return /^[HS]-\d{3}-\d{1,2}-\d+/i.test(String(value || "").trim());
}

function isMemberId(value) {
  return /^[A-Z]\d{6}$/i.test(String(value || "").trim());
}

function addLogVote(votesByRollCall, rollCallId, memberId, vote) {
  if (!isRollCallId(rollCallId) || !isMemberId(memberId)) return;
  const normalizedVote = normalizeVote(vote);
  if (!normalizedVote) return;
  const id = String(rollCallId).trim().toUpperCase();
  if (!votesByRollCall.has(id)) votesByRollCall.set(id, new Map());
  votesByRollCall.get(id).set(String(memberId).trim().toUpperCase(), normalizedVote);
}

function collectLogVotes(rows, votesByRollCall, tagsByRollCall) {
  if (!Array.isArray(rows) || !rows.length) return;
  const header = (rows[0] || []).map((value) => String(value || "").trim());
  const normalized = header.map((value) => value.toLowerCase().replace(/[^a-z]/g, ""));
  const rollCallColumn = normalized.findIndex((key) => ["rollcallid", "rollcall", "voteid"].includes(key));
  const memberColumn = normalized.findIndex((key) => ["memberid", "bioguideid", "bioguide"].includes(key));
  const voteColumn = normalized.findIndex((key) => ["vote", "voteposition", "membervote"].includes(key));
  const tagsColumn = normalized.findIndex((key) => ["assignedtags", "tags"].includes(key));

  if (rollCallColumn >= 0 && memberColumn >= 0 && voteColumn >= 0) {
    rows.slice(1).forEach((row) => {
      const rollCallId = String(row[rollCallColumn] || "").trim().toUpperCase();
      addLogVote(votesByRollCall, rollCallId, row[memberColumn], row[voteColumn]);
      if (tagsColumn >= 0 && isRollCallId(rollCallId)) {
        const values = parseLogTags(row[tagsColumn]);
        if (values.length) tagsByRollCall.set(rollCallId, [...(tagsByRollCall.get(rollCallId) || []), ...values]);
      }
    });
    return;
  }

  const rollCallColumns = header.map((value, index) => isRollCallId(value) ? index : -1).filter((index) => index >= 0);
  const memberColumns = header.map((value, index) => isMemberId(value) ? index : -1).filter((index) => index >= 0);
  rows.slice(1).forEach((row) => {
    const firstCell = String(row?.[0] || "").trim();
    if (/^(assigned_tags|tags)$/i.test(firstCell)) {
      rollCallColumns.forEach((column) => {
        const rollCallId = header[column].toUpperCase();
        const tags = parseLogTags(row[column]);
        if (tags.length) tagsByRollCall.set(rollCallId, [...(tagsByRollCall.get(rollCallId) || []), ...tags]);
      });
      return;
    }
    if (isMemberId(firstCell)) {
      rollCallColumns.forEach((column) => addLogVote(votesByRollCall, header[column], firstCell, row[column]));
      return;
    }
    if (isRollCallId(firstCell)) {
      memberColumns.forEach((column) => addLogVote(votesByRollCall, firstCell, header[column], row[column]));
      if (tagsColumn >= 0) {
        const tags = parseLogTags(row[tagsColumn]);
        if (tags.length) tagsByRollCall.set(firstCell.toUpperCase(), [...(tagsByRollCall.get(firstCell.toUpperCase()) || []), ...tags]);
      }
    }
  });
}

function parseLogTags(value) {
  const text = String(value || "");
  return (text.match(/\[[^\]]+\]/g) || text.split(/[;,]/)).map((tag) => tag.trim()).filter(Boolean);
}

function renderCrossoverTags(scope = document.getElementById("party-chamber-scope")?.value || "Both") {
  const store = VotalumeData.getStore();
  const billByRollCall = new Map((store.Bills_Summary || []).map((bill) =>
    [String(bill.Roll_Call_ID || "").trim().toUpperCase(), bill]
  ));
  const membersById = new Map();
  (store.House_Summary || []).forEach((member) => {
    if (scope !== "Senate") membersById.set(String(member.Member_ID || "").trim().toUpperCase(), member);
  });
  (store.Senate_Summary || []).forEach((member) => {
    if (scope !== "House") membersById.set(String(member.Member_ID || "").trim().toUpperCase(), member);
  });

  const votesByRollCall = new Map();
  const tagsByRollCall = new Map();
  collectLogVotes(store.House_Votes_Log, votesByRollCall, tagsByRollCall);
  collectLogVotes(store.Senate_Votes_Log, votesByRollCall, tagsByRollCall);
  const tally = { Democratic: { total: 0, tags: new Map() }, Republican: { total: 0, tags: new Map() } };
  const selectedTag = document.getElementById("party-tag-filter")?.value || "ALL";

  votesByRollCall.forEach((votes, rollCallId) => {
    const bill = billByRollCall.get(rollCallId) || {};
    const billChamber = String(bill.Chamber || (/^S-/i.test(rollCallId) ? "Senate" : "House")).toLowerCase();
    if (scope !== "Both" && billChamber !== scope.toLowerCase()) return;

    const caucusVotes = {
      Democratic: { YES: 0, NO: 0 },
      Republican: { YES: 0, NO: 0 }
    };
    const classifiedVotes = [];
    votes.forEach((vote, memberId) => {
      const member = membersById.get(memberId);
      if (!member || (vote !== "YES" && vote !== "NO")) return;
      const caucus = partyName(member.Caucus || member.Party);
      if (!caucusVotes[caucus]) return;
      caucusVotes[caucus][vote]++;
      classifiedVotes.push({ caucus, vote });
    });

    const majority = {};
    Object.keys(caucusVotes).forEach((caucus) => {
      const positions = caucusVotes[caucus];
      if (positions.YES !== positions.NO) majority[caucus] = positions.YES > positions.NO ? "YES" : "NO";
    });
    const rollCallTags = [
      ...parseLogTags(bill.Tags),
      ...parseLogTags(bill.Assigned_Tags),
      ...(tagsByRollCall.get(rollCallId) || [])
    ];
    const substantiveTags = [...new Set(rollCallTags)].filter((tag) =>
      !/^\[(?:Party-Line:|Coalition:|Faction:)/i.test(tag)
    );

    classifiedVotes.forEach(({ caucus, vote }) => {
      if (!majority[caucus] || vote === majority[caucus]) return;
      const partyTally = tally[caucus];
      partyTally.total++;
      substantiveTags.forEach((tag) => partyTally.tags.set(tag, (partyTally.tags.get(tag) || 0) + 1));
    });
  });

  renderCrossoverTagCard("dem-crossover-tags", tally.Democratic, selectedTag);
  renderCrossoverTagCard("rep-crossover-tags", tally.Republican, selectedTag);
}

function renderCrossoverTagCard(containerId, tally, selectedTag) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const rows = [...tally.tags.entries()]
    .filter(([tag]) => selectedTag === "ALL" || selectedTag === tag)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10);
  if (!rows.length) {
    container.innerHTML = '<p style="color:var(--color-text-muted);">No crossover-tag counts are available for this chamber and selection.</p>';
    return;
  }
  container.innerHTML = `
    <p style="font-size:0.85rem;color:var(--color-text-secondary);">Crossover votes: <strong>${tally.total}</strong></p>
    <ol style="padding-left:1.35rem;margin:0;">
      ${rows.map(([tag, count]) => {
        const share = tally.total ? (count / tally.total) * 100 : 0;
        const label = VotalumeData.getFriendlyTagLabel(tag);
        return `<li style="padding:0.45rem 0;border-bottom:1px solid var(--color-border);">
          <a href="bills.html?tag=${encodeURIComponent(tag)}">${VotalumeUI.escapeHtml(label)}</a>
          <div style="font-size:0.8rem;color:var(--color-text-secondary);">${count} crossover vote${count === 1 ? "" : "s"} • ${share.toFixed(1)}%</div>
        </li>`;
      }).join("")}
    </ol>
  `;
}
