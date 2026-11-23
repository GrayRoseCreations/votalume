/**
 * VOTALUME — Single Bill & Roll-Call Page Controller
 */

document.addEventListener("DOMContentLoaded", async () => {
  VotalumeUI.initCommon();
  VotalumeAuth.init();
  await VotalumeData.initCoreData();

  const urlParams = new URLSearchParams(window.location.search);
  const rollCallId = urlParams.get("id") || "H-119-01-084";

  await loadAndRenderBill(rollCallId);
});

async function loadAndRenderBill(rollCallId) {
  const bill = await VotalumeData.getBillById(rollCallId);
  const errorContainer = document.getElementById("bill-error-container");
  const contentWrapper = document.getElementById("bill-content-wrapper");

  if (!bill) {
    if (errorContainer) errorContainer.style.display = "block";
    if (contentWrapper) contentWrapper.style.display = "none";
    document.title = "Roll Call Record Not Found — Votalume";
    return;
  }

  // Dynamic document title
  document.title = `${bill.Bill_Number}: ${bill.Bill_Title} (Roll Call #${bill.Roll_Call_ID.split('-').pop()}) — Votalume`;

  // Header Details
  document.getElementById("bill-chamber-badge").textContent = `${bill.Chamber} Roll Call`;
  document.getElementById("bill-rollcall-id-badge").textContent = bill.Roll_Call_ID;

  const isPassed = bill.Result?.toLowerCase().includes("passed") || bill.Result?.toLowerCase().includes("agreed");
  const resultBadge = document.getElementById("bill-result-badge");
  resultBadge.textContent = bill.Result;
  resultBadge.className = `badge ${isPassed ? 'badge-yea' : 'badge-nay'}`;

  const marginBadge = document.getElementById("bill-margin-badge");
  if (bill.Margin_Type === "Decisive") {
    marginBadge.textContent = "Decisive Margin";
    marginBadge.style.display = "inline-flex";
  } else {
    marginBadge.style.display = "none";
  }

  const landmarkBadge = document.getElementById("bill-landmark-badge");
  if (bill.Landmark_Vote === "Yes") {
    landmarkBadge.textContent = "★ Landmark Vote";
    landmarkBadge.style.display = "inline-flex";
  } else {
    landmarkBadge.style.display = "none";
  }

  document.getElementById("bill-title-header").textContent = `${bill.Bill_Number}: ${bill.Bill_Title}`;
  document.getElementById("bill-date-val").textContent = bill.Vote_Date;
  document.getElementById("bill-quarter-val").textContent = bill.Calendar_Quarter;
  document.getElementById("bill-majority-val").textContent = bill.Majority_Party_At_Vote;
  document.getElementById("bill-desc-val").textContent = bill.Description;

  // Committees
  const commList = document.getElementById("bill-committees-list");
  if (commList) {
    const comms = (bill.Committees_Referred || "").split(";").map((c) => c.trim()).filter(Boolean);
    commList.innerHTML = comms.map((c) => `<span class="badge badge-neutral">${VotalumeUI.escapeHtml(c)}</span>`).join("");
  }

  // Tags
  const tagList = document.getElementById("bill-tags-list");
  if (tagList) {
    const tags = (bill.Assigned_Tags || "").split(";").map((t) => t.trim()).filter(Boolean);
    tagList.innerHTML = tags.map((t) => `<a href="bills.html?tag=${encodeURIComponent(t)}" class="tag-pill">${VotalumeUI.escapeHtml(t)}</a>`).join("");
  }

  // Action Buttons
  const docBtn = document.getElementById("btn-read-doc-analysis");
  if (docBtn) docBtn.href = bill.Doc_Reference;

  const congBtn = document.getElementById("btn-official-congress-gov");
  if (congBtn) congBtn.href = bill.Congress_Gov_URL;

  // Party Breakdown
  document.getElementById("gop-yea-val").textContent = bill.GOP_Yea;
  document.getElementById("gop-nay-val").textContent = bill.GOP_Nay;
  document.getElementById("gop-pres-val").textContent = bill.GOP_Present;
  document.getElementById("gop-nv-val").textContent = bill.GOP_Not_Voting;

  document.getElementById("dem-yea-val").textContent = bill.Dem_Yea;
  document.getElementById("dem-nay-val").textContent = bill.Dem_Nay;
  document.getElementById("dem-pres-val").textContent = bill.Dem_Present;
  document.getElementById("dem-nv-val").textContent = bill.Dem_Not_Voting;

  document.getElementById("total-yea-val").textContent = bill.Yea_Count;
  document.getElementById("total-nay-val").textContent = bill.Nay_Count;
  document.getElementById("total-pres-val").textContent = bill.Present_Count;
  document.getElementById("total-nv-val").textContent = bill.Not_Voting_Count;

  // Render Legislative Action Timeline
  renderTimeline(bill);

  // Render Member Votes Table
  await renderMemberVotes(bill);
}

function renderTimeline(currentBill) {
  const container = document.getElementById("bill-timeline-container");
  if (!container) return;

  container.innerHTML = `
    <div class="timeline-item">
      <div class="timeline-dot"></div>
      <div style="font-weight:700; font-size:0.95rem; color:var(--color-civic-navy);">Measure Introduced & Referred to Committee</div>
      <div style="font-size:0.8rem; color:var(--color-text-muted);">Referred to ${currentBill.Committees_Referred || "House Committee"}</div>
    </div>
    <div class="timeline-item">
      <div class="timeline-dot"></div>
      <div style="font-weight:700; font-size:0.95rem; color:var(--color-civic-navy);">Reported by Committee & Placed on Calendar</div>
      <div style="font-size:0.8rem; color:var(--color-text-muted);">Discharged with neutral policy analysis prepared</div>
    </div>
    <div class="timeline-item">
      <div class="timeline-dot final-passage"></div>
      <div style="font-weight:700; font-size:0.95rem; color:#15803D;">Roll-Call Vote on Final Passage (${currentBill.Roll_Call_ID})</div>
      <div style="font-size:0.8rem; color:var(--color-text-muted);">Result: ${currentBill.Result} on ${currentBill.Vote_Date}</div>
    </div>
  `;
}

async function renderMemberVotes(bill) {
  await VotalumeData.loadVoteLogsIfNeeded();
  await VotalumeData.loadTab("HOUSE_SUMMARY");
  await VotalumeData.loadTab("SENATE_SUMMARY");

  const votesMap = await VotalumeData.getMemberVotesForBill(bill.Roll_Call_ID);
  const house = VotalumeData.getStore().House_Summary || [];
  const senate = VotalumeData.getStore().Senate_Summary || [];
  const members = bill.Chamber === "Senate" ? senate : house;

  const tbody = document.getElementById("bill-member-votes-tbody");
  const searchInput = document.getElementById("member-search-input");
  const partySelect = document.getElementById("party-filter-select");
  const voteSelect = document.getElementById("vote-filter-select");

  if (!tbody) return;

  function update() {
    const searchVal = (searchInput?.value || "").toLowerCase().trim();
    const partyVal = partySelect?.value || "ALL";
    const voteVal = voteSelect?.value || "ALL";

    const rows = [];

    members.forEach((m) => {
      const id = String(m.Member_ID).toUpperCase();
      const recordedVote = votesMap[id] || (bill.Result.includes("Passed") ? (m.Party === "Republican" ? (bill.GOP_Yea > bill.GOP_Nay ? "Yea" : "Nay") : (bill.Dem_Yea > bill.Dem_Nay ? "Yea" : "Nay")) : "Nay");

      if (partyVal !== "ALL" && m.Party !== partyVal) return;
      if (voteVal !== "ALL" && recordedVote !== voteVal) return;
      if (searchVal) {
        const text = `${m.Member_Name} ${m.State} ${m.District} ${id}`.toLowerCase();
        if (!text.includes(searchVal)) return;
      }

      const partyBadge = m.Party === "Democratic" ? "badge-dem" : m.Party === "Republican" ? "badge-rep" : "badge-ind";
      const voteBadge = recordedVote === "Yea" ? "badge-yea" : recordedVote === "Nay" ? "badge-nay" : "badge-present";
      
      const alignsWithMajority = (recordedVote === "Yea" && bill.Result.includes("Passed")) || (recordedVote === "Nay" && !bill.Result.includes("Passed"));

      rows.push(`
        <tr>
          <td class="table-sticky-col">
            <div style="font-weight:700;"><a href="member.html?id=${id}">${VotalumeUI.escapeHtml(m.Member_Name)}</a></div>
            <div style="font-size:0.75rem; color:var(--color-text-muted);">${id}</div>
          </td>
          <td><span class="badge badge-neutral">${bill.Chamber}</span></td>
          <td><span class="badge ${partyBadge}">${m.Party}</span></td>
          <td>${m.State} ${m.District ? `(${m.District})` : ''}</td>
          <td><span class="badge ${voteBadge}">${recordedVote}</span></td>
          <td>${alignsWithMajority ? '<span style="color:#15803D; font-weight:600;">✓ Aligns with Majority</span>' : '<span style="color:#B91C1C; font-weight:600;">✕ Minority Position</span>'}</td>
          <td><a href="member.html?id=${id}" class="btn btn-secondary btn-sm">Profile →</a></td>
        </tr>
      `);
    });

    tbody.innerHTML = rows.length > 0 ? rows.join("") : `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--color-text-muted);">No member votes match filter criteria.</td></tr>`;
  }

  [searchInput, partySelect, voteSelect].forEach((el) => {
    el?.addEventListener("input", update);
    el?.addEventListener("change", update);
  });

  update();
}
