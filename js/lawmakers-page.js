/**
 * VOTALUME — Lawmakers Directory Controller
 * Manages search, filtering, sorting, and table rendering for Congressional Lawmakers.
 */

document.addEventListener("DOMContentLoaded", async () => {
  VotalumeUI.initCommon();
  VotalumeAuth.init();

  await VotalumeData.initCoreData();

  initStateFilter();
  VotalumeUI.populateActiveTagFilter(document.getElementById("filter-tag-select"), "All Topics");
  setupFilterListeners();
  window.addEventListener("votalume:data-refreshed", renderLawmakers);
  renderLawmakers();
});

let allLawmakers = [];

function displayMetric(value) {
  return value !== undefined && value !== null && String(value).trim() !== "" ? String(value).trim() : "Pending Backfill";
}

function numericMetric(value) {
  const parsed = parseFloat(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function initStateFilter() {
  const stateSelect = document.getElementById("filter-state-select");
  if (!stateSelect) return;
  window.VOTALUME_STATES.forEach((st) => {
    const opt = document.createElement("option");
    opt.value = st.code;
    opt.textContent = `${st.name} (${st.code})`;
    stateSelect.appendChild(opt);
  });
}

function setupFilterListeners() {
  const searchInput = document.getElementById("filter-search-input");
  const chamberSelect = document.getElementById("filter-chamber-select");
  const stateSelect = document.getElementById("filter-state-select");
  const partySelect = document.getElementById("filter-party-select");
  const caucusSelect = document.getElementById("filter-caucus-select");
  const tagSelect = document.getElementById("filter-tag-select");
  const statusSelect = document.getElementById("filter-status-select");
  const sortSelect = document.getElementById("sort-select");
  const resetBtn = document.getElementById("btn-reset-filters");

  [searchInput, chamberSelect, stateSelect, partySelect, caucusSelect, tagSelect, statusSelect, sortSelect].forEach((el) => {
    el?.addEventListener("input", renderLawmakers);
    el?.addEventListener("change", renderLawmakers);
  });

  resetBtn?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    if (chamberSelect) chamberSelect.value = "ALL";
    if (stateSelect) stateSelect.value = "ALL";
    if (partySelect) partySelect.value = "ALL";
    if (caucusSelect) caucusSelect.value = "ALL";
    if (tagSelect) tagSelect.value = "ALL";
    if (statusSelect) statusSelect.value = "ALL";
    if (sortSelect) sortSelect.value = "name";
    renderLawmakers();
  });
}

async function prepareLawmakersList() {
  const house = VotalumeData.getStore().House_Summary || [];
  const senate = VotalumeData.getStore().Senate_Summary || [];

  // Group by Member_ID to identify chamber-switchers
  const map = new Map();

  // First process Senate
  senate.forEach((m) => {
    const id = String(m.Member_ID || "").trim().toUpperCase();
    if (!id) return;
    map.set(id, {
      id,
      name: m.Member_Name,
      party: m.Party,
      caucus: caucusLabel(m, "Senate"),
      tags: `${m.Tags || ""}; ${m.Yes_Tags || ""}; ${m.No_Tags || ""}`,
      state: m.State,
      district: m.District || "Statewide",
      districtLean: m.District_Lean || "Unrated",
      termWindow: m.Term_Window,
      departureReason: m.Departure_Reason || "Active",
      chamber: "Senate",
      isChamberSwitcher: VotalumeData.hasChamberSwitchBadge(m.Chamber_Switch_Badge),
      careerTitle: VotalumeData.hasChamberSwitchBadge(m.Chamber_Switch_Badge)
        ? `U.S. Senator ${m.Term_Window || ""} | U.S. Representative (prior service)`
        : `U.S. Senator (${m.State})`,
      photoUrl: m.Photo_URL || `https://bioguide.congress.gov/bioguide/photo/${id[0]}/${id}.jpg`,
      regularAttendance: numericMetric(m.Regular_Attendance_Pct),
      regularAttendancePct: displayMetric(m.Regular_Attendance_Pct),
      lameDuckAttendance: numericMetric(m.Lame_Duck_Attendance_Pct || m.Lame_Duck_Attendance),
      lameDuckAttendancePct: displayMetric(m.Lame_Duck_Attendance_Pct || m.Lame_Duck_Attendance),
      partyUnity: numericMetric(m.Party_Unity_Pct || m.Party_Unity),
      partyUnityPct: displayMetric(m.Party_Unity_Pct || m.Party_Unity),
      crossoverVote: numericMetric(m.Crossover_Vote_Pct || m.Crossover_Vote),
      crossoverVotePct: displayMetric(m.Crossover_Vote_Pct || m.Crossover_Vote)
    });
  });

  // Then process House
  house.forEach((m) => {
    const id = String(m.Member_ID || "").trim().toUpperCase();
    if (!id) return;
    if (map.has(id)) {
      // Chamber switcher!
      const existing = map.get(id);
      existing.isChamberSwitcher = true;
      existing.careerTitle = `U.S. Senator ${existing.termWindow} | U.S. Rep ${m.Term_Window}`;
      existing.departureReason = "Chamber Switch";
      existing.tags += `; ${m.Tags || ""}; ${m.Yes_Tags || ""}; ${m.No_Tags || ""}`;
    } else {
      map.set(id, {
        id,
        name: m.Member_Name,
        party: m.Party,
        caucus: caucusLabel(m, "House"),
        tags: `${m.Tags || ""}; ${m.Yes_Tags || ""}; ${m.No_Tags || ""}`,
        state: m.State,
        district: `${m.State}-${m.District}`,
        districtLean: m.District_Lean || "Unrated",
        termWindow: m.Term_Window,
        departureReason: m.Departure_Reason || "Active",
        chamber: "House",
        isChamberSwitcher: m.Departure_Reason === "Chamber Switch" || VotalumeData.hasChamberSwitchBadge(m.Chamber_Switch_Badge),
        careerTitle: VotalumeData.hasChamberSwitchBadge(m.Chamber_Switch_Badge)
          ? `U.S. Representative ${m.Term_Window || ""} | U.S. Senator (prior service)`
          : `U.S. Representative (${m.State}-${m.District})`,
        photoUrl: m.Photo_URL || `https://bioguide.congress.gov/bioguide/photo/${id[0]}/${id}.jpg`,
        regularAttendance: numericMetric(m.Regular_Attendance_Pct),
        regularAttendancePct: displayMetric(m.Regular_Attendance_Pct),
        lameDuckAttendance: numericMetric(m.Lame_Duck_Attendance_Pct || m.Lame_Duck_Attendance),
        lameDuckAttendancePct: displayMetric(m.Lame_Duck_Attendance_Pct || m.Lame_Duck_Attendance),
        partyUnity: numericMetric(m.Party_Unity_Pct || m.Party_Unity),
        partyUnityPct: displayMetric(m.Party_Unity_Pct || m.Party_Unity),
        crossoverVote: numericMetric(m.Crossover_Vote_Pct || m.Crossover_Vote),
        crossoverVotePct: displayMetric(m.Crossover_Vote_Pct || m.Crossover_Vote)
      });
    }
  });

  return Array.from(map.values());
}

function partyLabel(value) {
  const party = String(value || "").trim().toLowerCase();
  if (party === "i" || party.includes("ind")) return "Independent";
  if (party === "d" || party.includes("dem")) return "Democratic";
  if (party === "r" || party.includes("rep")) return "Republican";
  return String(value || "Independent");
}

function caucusLabel(member, chamber) {
  const caucus = String(member.Caucus || "").trim().toLowerCase();
  if (caucus === "d" || caucus.includes("dem")) return "Democratic";
  if (caucus === "r" || caucus.includes("rep")) return "Republican";
  if (caucus === "i" || caucus.includes("ind")) return "Independent";
  if (partyLabel(member.Party) === "Independent") return chamber === "Senate" ? "Democratic" : "Independent";
  return partyLabel(member.Party);
}

async function renderLawmakers() {
  allLawmakers = await prepareLawmakersList();

  const searchQuery = (document.getElementById("filter-search-input")?.value || "").toLowerCase().trim();
  const chamberVal = document.getElementById("filter-chamber-select")?.value || "ALL";
  const stateVal = document.getElementById("filter-state-select")?.value || "ALL";
  const partyVal = document.getElementById("filter-party-select")?.value || "ALL";
  const caucusVal = document.getElementById("filter-caucus-select")?.value || "ALL";
  const tagVal = document.getElementById("filter-tag-select")?.value || "ALL";
  const statusVal = document.getElementById("filter-status-select")?.value || "ALL";
  const sortVal = document.getElementById("sort-select")?.value || "name";

  const tbody = document.getElementById("lawmakers-tbody");
  const countBadge = document.getElementById("results-count-badge");
  const emptyState = document.getElementById("empty-lawmakers-state");
  const table = document.getElementById("lawmakers-table");

  if (!tbody) return;

  // Filter
  const filtered = allLawmakers.filter((m) => {
    // Search
    if (searchQuery) {
      const match = `${m.name} ${m.state} ${m.district} ${m.id} ${m.careerTitle}`.toLowerCase();
      if (!match.includes(searchQuery)) return false;
    }

    // Chamber
    if (chamberVal === "SENATE" && m.chamber !== "Senate" && !m.isChamberSwitcher) return false;
    if (chamberVal === "HOUSE" && m.chamber !== "House" && !m.isChamberSwitcher) return false;

    // State
    if (stateVal !== "ALL" && m.state !== stateVal) return false;

    // Party
    if (partyVal !== "ALL" && partyLabel(m.party) !== partyVal) return false;
    if (caucusVal !== "ALL" && m.caucus !== caucusVal) return false;
    if (tagVal !== "ALL" && !m.tags.includes(tagVal)) return false;

    // Status & Lame duck badges
    if (statusVal === "LAME_DROP") {
      // Drop of >= 20 pts
      const drop = m.regularAttendance - m.lameDuckAttendance;
      if (drop < 20) return false;
    } else if (statusVal === "LAME_BELL") {
      // >= 90% lame duck attendance
      if (m.lameDuckAttendance < 90) return false;
    } else if (statusVal !== "ALL") {
      if (m.departureReason !== statusVal) return false;
    }

    return true;
  });

  // Sort
  filtered.sort((a, b) => {
    if (sortVal === "attendance") return (b.regularAttendance ?? -Infinity) - (a.regularAttendance ?? -Infinity);
    if (sortVal === "unity") return (b.partyUnity ?? -Infinity) - (a.partyUnity ?? -Infinity);
    if (sortVal === "crossover") return (b.crossoverVote ?? -Infinity) - (a.crossoverVote ?? -Infinity);
    return a.name.localeCompare(b.name);
  });

  // Update Count
  if (countBadge) {
    countBadge.textContent = `Showing ${filtered.length} of ${allLawmakers.length} lawmakers`;
  }

  if (filtered.length === 0) {
    table.style.display = "none";
    if (emptyState) emptyState.style.display = "block";
    tbody.innerHTML = "";
    return;
  }

  table.style.display = "table";
  if (emptyState) emptyState.style.display = "none";

  tbody.innerHTML = filtered.map((m) => {
    const displayParty = partyLabel(m.party);
    const partyBadge = displayParty === "Democratic" ? "badge-dem" : displayParty === "Republican" ? "badge-rep" : "badge-ind";
    const drop = m.regularAttendance !== null && m.lameDuckAttendance !== null
      ? m.regularAttendance - m.lameDuckAttendance
      : null;
    let lameDuckBadge = "";
    if (drop !== null && drop >= 20) {
      lameDuckBadge = `<span class="badge badge-alert" title="Attendance dropped ≥20% during post-election lame-duck session">Lame-Duck Drop-Off</span>`;
    } else if (m.lameDuckAttendance !== null && m.lameDuckAttendance >= 90) {
      lameDuckBadge = `<span class="badge badge-gold" title="Maintained ≥90% attendance through final bell">Served Through Final Bell</span>`;
    }

    return `
      <tr>
        <td class="table-sticky-col">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <div class="member-portrait-wrapper" style="width:40px; height:40px;">
              <img src="${m.photoUrl}" alt="${VotalumeUI.escapeHtml(m.name)}" class="member-portrait" onerror="VotalumeUI.handlePortraitError(this)" />
            </div>
            <div>
              <div style="font-weight:700;"><a href="member.html?id=${m.id}">${VotalumeUI.escapeHtml(m.name)}</a></div>
              <div style="font-size:0.75rem; color:var(--color-text-muted);">${m.id}</div>
            </div>
          </div>
        </td>
        <td>
          <div style="font-weight:600; font-size:0.85rem; color:var(--color-civic-navy);">${m.careerTitle}</div>
          <div style="font-size:0.75rem; color:var(--color-text-muted); margin-top:0.15rem;">
            ${m.isChamberSwitcher ? '<span class="badge badge-crossover">Chamber Switch</span>' : `<span class="badge badge-neutral">${m.departureReason}</span>`}
          </div>
        </td>
        <td>
          <span class="badge ${partyBadge}">${displayParty}</span>
          <div style="font-size:0.8rem; color:var(--color-text-secondary); margin-top:0.25rem;">${m.district} • ${m.caucus} Caucus</div>
        </td>
        <td>
          <span style="font-size:0.825rem; font-weight:500;">${m.districtLean}</span>
        </td>
        <td>
          <strong style="color:var(--color-civic-navy);">${m.regularAttendancePct}</strong>
        </td>
        <td>
          <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <span>${m.lameDuckAttendancePct}</span>
            ${lameDuckBadge}
          </div>
        </td>
        <td>
          <span style="font-weight:600;">${m.partyUnityPct}</span>
        </td>
        <td>
          <span style="font-weight:700; color:var(--color-crossover);">${m.crossoverVotePct}</span>
        </td>
        <td>
          <a href="member.html?id=${m.id}" class="btn btn-secondary btn-sm">Full Profile →</a>
        </td>
      </tr>
    `;
  }).join("");
}
