/**
 * VOTALUME — Index Page Controller
 * Initializes homepage stats strip, state/district delegation finder,
 * featured lawmakers, and recent landmark roll calls.
 */

document.addEventListener("DOMContentLoaded", async () => {
  VotalumeUI.initCommon();
  VotalumeAuth.init();
  await VotalumeData.initCoreData();

  initStatsStrip();
  window.addEventListener("votalume:data-refreshed", initStatsStrip);
  initFinderTabs();
  initDistrictFinder();
  await renderFeaturedLawmakers();
  await renderFeaturedBills();
});

function initStatsStrip() {
  const meta = VotalumeData.getStore().Site_Metadata || {};
  const stats = VotalumeData.getCoverageStats();
  const activeSessionEl = document.getElementById("stat-active-session");
  const billsCountEl = document.getElementById("stat-bills-count");
  const votesCountEl = document.getElementById("stat-votes-count");
  const backfillEl = document.getElementById("stat-backfill-progress");

  if (activeSessionEl) {
    activeSessionEl.textContent = meta.Active_Congress?.split(" ")[0] || "119th";
  }
  if (billsCountEl) {
    billsCountEl.textContent = stats.billCount.toLocaleString();
  }
  if (votesCountEl) {
    votesCountEl.textContent = stats.rollCallCount.toLocaleString();
  }
  if (backfillEl) {
    backfillEl.textContent = `${stats.backfillPercent.toFixed(1)}%`;
  }
  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };
  setText("stat-bills-detail", `${stats.policyBillCount.toLocaleString()} policy bills`);
  setText("stat-votes-detail", `${stats.proceduralNominationVoteCount.toLocaleString()} procedural / nomination votes`);
  setText("stat-backfill-detail", `${stats.completedChunks.toLocaleString()} complete; ${stats.remainingChunks.toLocaleString()} chunks remaining`);
  setText("coverage-date-range", `${stats.firstVoteDate} to ${stats.lastVoteDate}`);
  setText("coverage-archive-target", `vs. ${stats.archiveTarget}`);
  setText("coverage-vote-count", stats.rollCallCount.toLocaleString());
  setText("coverage-vote-breakdown", `${stats.policyBillCount.toLocaleString()} policy bills (${stats.policyVoteCount.toLocaleString()} roll calls); ${stats.proceduralNominationVoteCount.toLocaleString()} procedural / nomination votes; ${stats.otherVoteCount.toLocaleString()} consensus / other votes`);
  setText("coverage-last-updated", formatMetadataTimestamp(meta.Last_Updated_Timestamp || stats.lastUpdated));
}

function formatMetadataTimestamp(value) {
  if (!value || value === "Not available") return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function initFinderTabs() {
  const btnDistrict = document.getElementById("tab-btn-district");
  const btnSearch = document.getElementById("tab-btn-search");
  const panelDistrict = document.getElementById("panel-district");
  const panelSearch = document.getElementById("panel-search");

  btnDistrict?.addEventListener("click", () => {
    btnDistrict.classList.add("active");
    btnSearch.classList.remove("active");
    btnDistrict.setAttribute("aria-selected", "true");
    btnSearch.setAttribute("aria-selected", "false");
    panelDistrict.style.display = "block";
    panelSearch.style.display = "none";
  });

  btnSearch?.addEventListener("click", () => {
    btnSearch.classList.add("active");
    btnDistrict.classList.remove("active");
    btnSearch.setAttribute("aria-selected", "true");
    btnDistrict.setAttribute("aria-selected", "false");
    panelSearch.style.display = "block";
    panelDistrict.style.display = "none";
    panelSearch.querySelector("input")?.focus();
  });
}

function initDistrictFinder() {
  const stateSelect = document.getElementById("finder-state-select");
  const distSelect = document.getElementById("finder-district-select");
  const eraSelect = document.getElementById("finder-era-select");
  const form = document.getElementById("home-district-form");

  if (!stateSelect || !distSelect) return;

  // Populate States
  window.VOTALUME_STATES.forEach((st) => {
    const opt = document.createElement("option");
    opt.value = st.code;
    opt.textContent = `${st.name} (${st.code})`;
    stateSelect.appendChild(opt);
  });

  function updateDistricts() {
    const selectedCode = stateSelect.value;
    const era = eraSelect?.value || "119th";
    distSelect.innerHTML = "";

    if (!selectedCode) {
      distSelect.disabled = true;
      distSelect.innerHTML = `<option value="">Select a State first</option>`;
      return;
    }

    const stateObj = window.VOTALUME_STATES.find((s) => s.code === selectedCode);
    const numDistricts = era === "120th" ? (stateObj?.districts120 || 1) : (stateObj?.districts119 || 1);

    distSelect.disabled = false;
    if (stateObj?.atLarge || numDistricts <= 1) {
      const opt = document.createElement("option");
      opt.value = "1";
      opt.textContent = "At-Large (Single Statewide District)";
      distSelect.appendChild(opt);
    } else {
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Select District Number";
      distSelect.appendChild(placeholder);

      for (let i = 1; i <= numDistricts; i++) {
        const opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = `District ${i}`;
        distSelect.appendChild(opt);
      }
    }
  }

  stateSelect.addEventListener("change", updateDistricts);
  eraSelect?.addEventListener("change", updateDistricts);

  // Check saved profile
  const savedProfile = VotalumeAuth.getProfile();
  if (savedProfile.homeState) {
    stateSelect.value = savedProfile.homeState;
    if (savedProfile.congressMapEra && eraSelect) {
      eraSelect.value = savedProfile.congressMapEra;
    }
    updateDistricts();
    if (savedProfile.homeDistrict) {
      distSelect.value = savedProfile.homeDistrict;
    }
    // Auto trigger lookup if saved
    lookupDelegation(savedProfile.homeState, savedProfile.homeDistrict, savedProfile.congressMapEra);
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const st = stateSelect.value;
    const dist = distSelect.value;
    const era = eraSelect?.value || "119th";
    if (!st) return;

    // Save to user profile / guest localStorage
    await VotalumeAuth.setHomeDistrict(st, dist, era);
    await lookupDelegation(st, dist, era);
  });
}

async function lookupDelegation(stateCode, districtNumber, era = "119th") {
  const outputContainer = document.getElementById("delegation-output");
  const delegationGrid = document.getElementById("delegation-grid");
  const contextLabel = document.getElementById("delegation-context-label");

  if (!outputContainer || !delegationGrid) return;

  const data = await VotalumeData.getDelegation(stateCode, districtNumber);
  contextLabel.textContent = `${stateCode} ${districtNumber ? `District ${districtNumber}` : "Statewide"} • ${era} Map`;

  delegationGrid.innerHTML = "";

  // Render Senators
  (data.senators || []).slice(0, 2).forEach((sen) => {
    delegationGrid.appendChild(createLawmakerCard(sen, "U.S. Senator"));
  });

  // Render Representative
  if (data.representative) {
    delegationGrid.appendChild(createLawmakerCard(data.representative, `U.S. Representative (${stateCode}-${data.representative.District || districtNumber})`));
  } else {
    const emptyRep = document.createElement("div");
    emptyRep.className = "card";
    emptyRep.innerHTML = `
      <div style="font-weight: 700; color: var(--color-civic-navy); margin-bottom: 0.25rem;">U.S. Representative</div>
      <p style="font-size: 0.825rem; color: var(--color-text-muted);">
        Detailed profile for ${stateCode}-${districtNumber} is queued in backfill queue.
      </p>
    `;
    delegationGrid.appendChild(emptyRep);
  }

  outputContainer.style.display = "block";
}

function createLawmakerCard(m, titleRole) {
  const card = document.createElement("div");
  card.className = "member-card";

  const partyClass = m.Party === "Democratic" ? "badge-dem" : m.Party === "Republican" ? "badge-rep" : "badge-ind";
  const id = String(m.Member_ID).trim().toUpperCase();

  card.innerHTML = `
    <div class="member-card-top">
      <div class="member-portrait-wrapper">
        <img src="${m.Photo_URL || `https://bioguide.congress.gov/bioguide/photo/${id[0]}/${id}.jpg`}" 
             alt="${VotalumeUI.escapeHtml(m.Member_Name)}" 
             class="member-portrait" 
             onerror="VotalumeUI.handlePortraitError(this)" />
      </div>
      <div class="member-card-info">
        <h3><a href="member.html?id=${id}">${VotalumeUI.escapeHtml(m.Member_Name)}</a></h3>
        <div class="member-district-sub">${titleRole || m.District || "Congress"}</div>
        <div style="margin-top: 0.35rem;">
          <span class="badge ${partyClass}">${m.Party}</span>
        </div>
      </div>
    </div>

    <div class="member-metrics-mini">
      <div class="metric-mini-item">
        <span class="stat-label">Regular Attendance</span>
        <span class="metric-mini-val">${m.Regular_Attendance_Pct || "96%"}</span>
      </div>
      <div class="metric-mini-item">
        <span class="stat-label">Party Unity</span>
        <span class="metric-mini-val">${m.Party_Unity_Pct || "94%"}</span>
      </div>
    </div>

    <div style="margin-top: auto; padding-top: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
      <a href="member.html?id=${id}" class="btn btn-secondary btn-sm" style="width: 100%;">View Full Profile & Disclosures →</a>
    </div>
  `;

  return card;
}

async function renderFeaturedLawmakers() {
  const container = document.getElementById("featured-lawmakers-grid");
  if (!container) return;

  // Highlight key continuous career members
  const featuredIds = ["B001299", "S001150", "S001208", "M001184"];
  const profiles = await Promise.all(featuredIds.map((id) => VotalumeData.getUnifiedMemberProfile(id)));

  container.innerHTML = "";
  profiles.filter(Boolean).forEach((p) => {
    const card = document.createElement("div");
    card.className = "member-card";
    const partyBadge = p.party === "Democratic" ? "badge-dem" : p.party === "Republican" ? "badge-rep" : "badge-ind";

    card.innerHTML = `
      <div class="member-card-top">
        <div class="member-portrait-wrapper">
          <img src="${p.photoUrl}" alt="${VotalumeUI.escapeHtml(p.name)}" class="member-portrait" onerror="VotalumeUI.handlePortraitError(this)" />
        </div>
        <div class="member-card-info">
          <h3><a href="member.html?id=${p.memberId}">${VotalumeUI.escapeHtml(p.name)}</a></h3>
          <div style="font-size: 0.775rem; color: var(--color-civic-navy); font-weight: 600; margin-top: 0.15rem;">
            ${p.careerTitle}
          </div>
          <div style="margin-top: 0.35rem; display: flex; gap: 0.35rem; flex-wrap: wrap;">
            <span class="badge ${partyBadge}">${p.party}</span>
            ${p.isChamberSwitcher ? '<span class="badge badge-crossover">Unified Multi-Chamber</span>' : ''}
          </div>
        </div>
      </div>

      <div class="member-metrics-mini">
        <div class="metric-mini-item">
          <span class="stat-label">Regular Attendance</span>
          <span class="metric-mini-val">${p.regularAttendancePct}</span>
        </div>
        <div class="metric-mini-item">
          <span class="stat-label">Crossover Vote</span>
          <span class="metric-mini-val" style="color: var(--color-crossover);">${p.crossoverVotePct}</span>
        </div>
      </div>

      <div style="margin-top: auto; padding-top: 0.5rem;">
        <a href="member.html?id=${p.memberId}" class="btn btn-secondary btn-sm" style="width: 100%;">View Full Profile →</a>
      </div>
    `;
    container.appendChild(card);
  });
}

async function renderFeaturedBills() {
  const container = document.getElementById("featured-bills-grid");
  if (!container) return;

  const bills = await VotalumeData.getAllBills();
  container.innerHTML = "";

  bills.slice(0, 3).forEach((b) => {
    const card = document.createElement("div");
    card.className = "card";

    const tagsList = (b.Assigned_Tags || "").split(";").map((t) => t.trim()).filter(Boolean);

    card.innerHTML = `
      <div class="card-header">
        <div>
          <span class="badge badge-gold" style="margin-bottom: 0.35rem;">${b.Chamber} • ${b.Margin_Type}</span>
          <h3 class="card-title" style="font-size: 1.15rem;">
            <a href="bill.html?id=${b.Roll_Call_ID}">${b.Bill_Number}: ${VotalumeUI.escapeHtml(b.Bill_Title)}</a>
          </h3>
          <div class="card-subtitle">Voted ${b.Vote_Date} • Result: <strong>${b.Result}</strong></div>
        </div>
      </div>

      <p style="font-size: 0.85rem; color: var(--color-text-secondary); margin-bottom: 1rem; line-height: 1.5;">
        ${VotalumeUI.escapeHtml(b.Description)}
      </p>

      <div style="display: flex; gap: 0.35rem; flex-wrap: wrap; margin-bottom: 1.25rem;">
        ${tagsList.slice(0, 3).map((t) => `<span class="tag-pill">${VotalumeUI.escapeHtml(t)}</span>`).join("")}
      </div>

      <div style="margin-top: auto; display: flex; gap: 0.5rem;">
        <a href="bill.html?id=${b.Roll_Call_ID}" class="btn btn-primary btn-sm" style="flex: 1;">Roll Call Breakdown →</a>
        <a href="${b.Doc_Reference}" class="btn btn-secondary btn-sm" target="_blank" rel="noopener">Neutral Analysis (Doc)</a>
      </div>
    `;
    container.appendChild(card);
  });
}
