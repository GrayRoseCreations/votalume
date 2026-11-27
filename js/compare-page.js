/**
 * VOTALUME — Side-by-Side Lawmaker Comparison Controller
 */

document.addEventListener("DOMContentLoaded", async () => {
  VotalumeUI.initCommon();
  VotalumeAuth.init();
  await VotalumeData.initCoreData();

  await populateLawmakerSelects();
  setupEventListeners();

  // Load defaults (Jim Banks vs. Adam Schiff)
  await updateComparison("B001299", "S001150");
});

let lawmakersList = [];

async function populateLawmakerSelects() {
  const house = VotalumeData.getStore().House_Summary || [];
  const senate = VotalumeData.getStore().Senate_Summary || [];

  const seen = new Set();
  lawmakersList = [];

  [...senate, ...house].forEach((m) => {
    const id = String(m.Member_ID).toUpperCase();
    if (seen.has(id)) return;
    seen.add(id);
    lawmakersList.push({
      id: id,
      name: m.Member_Name,
      party: m.Party,
      state: m.State,
      district: m.District ? `${m.State}-${m.District}` : m.State
    });
  });

  lawmakersList.sort((a, b) => a.name.localeCompare(b.name));

  const selectA = document.getElementById("select-lawmaker-a");
  const selectB = document.getElementById("select-lawmaker-b");

  if (!selectA || !selectB) return;

  lawmakersList.forEach((m) => {
    const optA = document.createElement("option");
    optA.value = m.id;
    optA.textContent = `${m.name} (${m.party.charAt(0)} - ${m.district})`;
    selectA.appendChild(optA);

    const optB = document.createElement("option");
    optB.value = m.id;
    optB.textContent = `${m.name} (${m.party.charAt(0)} - ${m.district})`;
    selectB.appendChild(optB);
  });
}

function setupEventListeners() {
  const selectA = document.getElementById("select-lawmaker-a");
  const selectB = document.getElementById("select-lawmaker-b");

  selectA?.addEventListener("change", () => {
    updateComparison(selectA.value, selectB.value);
  });

  selectB?.addEventListener("change", () => {
    updateComparison(selectA.value, selectB.value);
  });

  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idA = btn.getAttribute("data-a");
      const idB = btn.getAttribute("data-b");
      if (selectA) selectA.value = idA;
      if (selectB) selectB.value = idB;
      updateComparison(idA, idB);
    });
  });

  window.addEventListener("votalume:data-refreshed", () => updateComparison(selectA?.value, selectB?.value));
}

async function updateComparison(idA, idB) {
  const profileA = await VotalumeData.getUnifiedMemberProfile(idA);
  const profileB = await VotalumeData.getUnifiedMemberProfile(idB);

  if (!profileA || !profileB) return;

  // Header Cards
  renderLawmakerHeader("a", profileA);
  renderLawmakerHeader("b", profileB);

  // Table Headers
  document.getElementById("th-name-a").textContent = profileA.name;
  document.getElementById("th-name-b").textContent = profileB.name;
  document.getElementById("disagree-th-a").textContent = `${profileA.name} Vote`;
  document.getElementById("disagree-th-b").textContent = `${profileB.name} Vote`;

  // Render Metrics Table
  renderMetricsTable(profileA, profileB);

  // Render 6 Indices Bar Chart
  VotalumeCharts.renderIndicesBarChart("compare-indices-chart", profileA.indices, profileA.name, profileB.indices, profileB.name);

  // Render Disagreements
  await renderDisagreements(profileA, profileB);
}

function renderLawmakerHeader(prefix, p) {
  const nameEl = document.getElementById(`${prefix}-name`);
  const careerEl = document.getElementById(`${prefix}-career`);
  const partyEl = document.getElementById(`${prefix}-party-badge`);
  const stateEl = document.getElementById(`${prefix}-state-badge`);
  const leanEl = document.getElementById(`${prefix}-lean`);
  const commEl = document.getElementById(`${prefix}-committees`);
  const photoEl = document.getElementById(`${prefix}-photo`);

  if (nameEl) nameEl.textContent = p.name;
  if (careerEl) careerEl.textContent = p.careerTitle;
  if (partyEl) {
    partyEl.textContent = p.party;
    partyEl.className = `badge ${p.party === "Democratic" ? "badge-dem" : p.party === "Republican" ? "badge-rep" : "badge-ind"}`;
  }
  if (stateEl) stateEl.textContent = `${p.state} ${p.district}`;
  if (leanEl) leanEl.textContent = p.districtLean;
  if (commEl) commEl.textContent = p.committeesAndChairs || "Assignments on record";
  if (photoEl) {
    photoEl.src = p.photoUrl;
    photoEl.onerror = () => VotalumeUI.handlePortraitError(photoEl);
  }
}

function renderMetricsTable(a, b) {
  const tbody = document.getElementById("metrics-compare-tbody");
  if (!tbody) return;

  const rows = [
    {
      metric: "Regular-Term Attendance",
      valA: a.regularAttendancePct,
      valB: b.regularAttendancePct,
      note: "Pre-election regular session"
    },
    {
      metric: "Lame-Duck Attendance (Nov–Jan)",
      valA: a.lameDuckAttendancePct,
      valB: b.lameDuckAttendancePct,
      note: "Post-election accountability"
    },
    {
      metric: "Voted With Their Party",
      subtitle: "Party Unity Score",
      valA: a.partyUnityPct,
      valB: b.partyUnityPct,
      note: "Votes with party majority"
    },
    {
      metric: "Voted Across the Aisle",
      subtitle: "Bipartisan Crossover Rate",
      valA: `<span style="font-weight:700; color:var(--color-crossover);">${a.crossoverVotePct}</span>`,
      valB: `<span style="font-weight:700; color:var(--color-crossover);">${b.crossoverVotePct}</span>`,
      note: "Votes breaking with caucus"
    },
    {
      metric: "Presidential Support (In-Party White House)",
      valA: a.presSupportInPartyPct,
      valB: b.presSupportInPartyPct,
      note: "White House concurrence"
    },
    {
      metric: "Presidential Support (Opposition White House)",
      valA: a.presSupportOppositionPct,
      valB: b.presSupportOppositionPct,
      note: "Cross-aisle administration concurrence"
    },
    {
      metric: "Portfolio Disclosure Status",
      valA: a.extras?.Portfolio_Disclosure_Status || "Diversified / Trust",
      valB: b.extras?.Portfolio_Disclosure_Status || "Diversified / Trust",
      note: "STOCK Act certified status"
    },
    {
      metric: "STOCK Act 30-Day Flags",
      valA: a.extras?.STOCK_Act_Trades_And_Timing?.split("|")[0]?.trim() || "0 Flags",
      valB: b.extras?.STOCK_Act_Trades_And_Timing?.split("|")[0]?.trim() || "0 Flags",
      note: "Timely transaction disclosures"
    }
  ];

  tbody.innerHTML = rows.map((r) => `
    <tr>
      <td class="table-sticky-col"><span class="plain-label-stack"><strong class="plain-label-main">${r.metric}</strong>${r.subtitle ? `<small class="plain-label-subtitle">${r.subtitle}</small>` : ""}</span></td>
      <td>${r.valA}</td>
      <td>${r.valB}</td>
      <td style="font-size:0.8rem; color:var(--color-text-muted);">${r.note}</td>
    </tr>
  `).join("");
}

async function renderDisagreements(a, b) {
  const tbody = document.getElementById("disagreements-tbody");
  if (!tbody) return;

  await VotalumeData.loadVoteLogsIfNeeded();
  const bills = await VotalumeData.getAllBills();
  const disagreeRows = [];

  for (const bill of bills) {
    const votesMap = await VotalumeData.getMemberVotesForBill(bill.Roll_Call_ID);
    const voteA = votesMap[String(a.memberId).toUpperCase()] || "Not recorded";
    const voteB = votesMap[String(b.memberId).toUpperCase()] || "Not recorded";

    // Check if they differed (e.g. Yea vs Nay)
    if (voteA !== voteB && ["Yea", "Nay"].includes(voteA) && ["Yea", "Nay"].includes(voteB)) {
      const displayVoteA = VotalumeUI.getVoteDisplay(voteA);
      const displayVoteB = VotalumeUI.getVoteDisplay(voteB);
      const tagsText = String(bill.Tags || bill.Assigned_Tags || "");
      const tags = (tagsText.match(/\[[^\]]+\]/g) || tagsText.split(/[;,]/).map((tag) => tag.trim()).filter(Boolean))
        .slice(0, 2)
        .map((tag) => VotalumeData.getFriendlyTagLabel(tag));

      disagreeRows.push(`
        <tr>
          <td class="table-sticky-col">
            <div style="font-weight:700;"><a href="bill.html?id=${bill.Roll_Call_ID}">${bill.Bill_Number}</a></div>
            <div style="font-size:0.8rem; color:var(--color-text-secondary); max-width:260px;">${VotalumeUI.escapeHtml(bill.Bill_Title)}</div>
          </td>
          <td style="white-space:nowrap; font-size:0.825rem;">${bill.Vote_Date}</td>
          <td><span class="badge badge-neutral">${bill.Result || "Result unavailable"}</span></td>
          <td><span class="badge ${displayVoteA.badgeClass}">${VotalumeUI.escapeHtml(displayVoteA.label)}</span></td>
          <td><span class="badge ${displayVoteB.badgeClass}">${VotalumeUI.escapeHtml(displayVoteB.label)}</span></td>
          <td>
            <div style="display:flex; gap:0.25rem; flex-wrap:wrap;">
              ${tags.map((t) => `<span class="tag-pill">${VotalumeUI.escapeHtml(t)}</span>`).join("")}
            </div>
          </td>
          <td>
            <a href="bill.html?id=${bill.Roll_Call_ID}" class="btn btn-secondary btn-sm">Breakdown →</a>
          </td>
        </tr>
      `);
    }
  }

  tbody.innerHTML = disagreeRows.length > 0 ? disagreeRows.join("") : `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--color-text-muted);">No recorded roll-call disagreements in the current sample session.</td></tr>`;
}
