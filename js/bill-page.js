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
  window.addEventListener("votalume:data-refreshed", () => loadAndRenderBill(rollCallId));
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

  const billRollCallId = String(bill.Roll_Call_ID || "");
  const plainTitle = bill.Plain_English_Title || bill.Bill_Title || bill.Bill_Number || "Congressional vote";
  const result = bill.Outcome || bill.Result || "Outcome unavailable";
  const quarter = bill.Calendar_Quarter || getCalendarQuarter(bill.Vote_Date);

  document.title = `${plainTitle} (${bill.Bill_Number || billRollCallId}) — Votalume`;

  // Header Details
  document.getElementById("bill-chamber-badge").textContent = `${bill.Chamber || "Congress"} Roll Call`;
  document.getElementById("bill-rollcall-id-badge").textContent = billRollCallId;

  const isPassed = /passed|agreed/i.test(result);
  const resultBadge = document.getElementById("bill-result-badge");
  resultBadge.textContent = result;
  resultBadge.className = `badge ${isPassed ? 'badge-yea' : /failed|rejected/i.test(result) ? 'badge-nay' : 'badge-neutral'}`;

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

  document.getElementById("bill-title-header").textContent = plainTitle;
  document.getElementById("bill-date-val").textContent = bill.Vote_Date || "Date unavailable";
  document.getElementById("bill-quarter-val").textContent = quarter;
  document.getElementById("bill-majority-val").textContent = bill.Majority_Party_At_Vote || "Not enough votes yet";
  document.getElementById("bill-desc-val").textContent = bill.Why_It_Matters || bill.Description || "";

  const detailsContainer = document.getElementById("bill-plain-english-details");
  if (detailsContainer) {
    const counts = await VotalumeData.getVoteCountsForBill(billRollCallId);
    detailsContainer.innerHTML = VotalumeUI.renderBillCardDetails(bill, counts, false);
  }

  // Committees
  const commList = document.getElementById("bill-committees-list");
  if (commList) {
    const comms = (bill.Committees_Referred || "").split(";").map((c) => c.trim()).filter(Boolean);
    commList.innerHTML = comms.map((c) => `<span class="badge badge-neutral">${VotalumeUI.escapeHtml(c)}</span>`).join("");
  }

  // Tags
  const tagList = document.getElementById("bill-tags-list");
  if (tagList) {
    const rawTags = String(bill.Tags || bill.Assigned_Tags || "");
    const tags = rawTags.match(/\[[^\]]+\]/g) || rawTags.split(/[;,]/).map((tag) => tag.trim()).filter(Boolean);
    tagList.innerHTML = tags.map((tag) => `<a href="bills.html?tag=${encodeURIComponent(tag)}" class="tag-pill">${VotalumeUI.escapeHtml(VotalumeData.getFriendlyTagLabel(tag))}</a>`).join("");
  }

  // Action Buttons
  const docBtn = document.getElementById("btn-read-doc-analysis");
  if (docBtn) {
    const docUrl = /^https?:\/\//i.test(String(bill.Doc_Reference || "")) ? bill.Doc_Reference : "";
    docBtn.href = docUrl || "#";
    docBtn.style.display = docUrl ? "inline-flex" : "none";
  }

  const congBtn = document.getElementById("btn-official-congress-gov");
  if (congBtn) {
    const officialUrl = bill.Official_Bill_Link || bill.Congress_Gov_URL || "";
    congBtn.href = /^https?:\/\//i.test(String(officialUrl)) ? officialUrl : "#";
    congBtn.style.display = congBtn.href === "#" ? "none" : "inline-flex";
  }

  // Party subtotals are not included in Bills_Summary; never print missing sheet fields.
  const partyBreakdown = document.getElementById("bill-party-breakdown-card");
  const hasPartyTotals = ["GOP_Yea", "GOP_Nay", "GOP_Present", "GOP_Not_Voting", "Dem_Yea", "Dem_Nay", "Dem_Present", "Dem_Not_Voting"].every((key) => Number.isFinite(Number(bill[key])));
  if (partyBreakdown && !hasPartyTotals) partyBreakdown.style.display = "none";

  if (hasPartyTotals) {
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
  }

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
      <div style="font-size:0.8rem; color:var(--color-text-muted);">Result: ${currentBill.Outcome || currentBill.Result || "Outcome unavailable"} on ${currentBill.Vote_Date || "Date unavailable"}</div>
    </div>
  `;
}

function getCalendarQuarter(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Quarter unavailable";
  return `${date.getFullYear()}-Q${Math.ceil((date.getMonth() + 1) / 3)}`;
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
      const recordedVote = votesMap[id] || "Not recorded";

      if (partyVal !== "ALL" && m.Party !== partyVal) return;
      if (voteVal !== "ALL" && recordedVote !== voteVal) return;
      if (searchVal) {
        const text = `${m.Member_Name} ${m.State} ${m.District} ${id}`.toLowerCase();
        if (!text.includes(searchVal)) return;
      }

      const partyBadge = m.Party === "Democratic" ? "badge-dem" : m.Party === "Republican" ? "badge-rep" : "badge-ind";
      const voteBadge = recordedVote === "Yea" ? "badge-yea" : recordedVote === "Nay" ? "badge-nay" : recordedVote === "Present" ? "badge-present" : "badge-neutral";
      
      const hasResult = Boolean(bill.Result);
      const alignsWithMajority = hasResult && ((recordedVote === "Yea" && bill.Result.includes("Passed")) || (recordedVote === "Nay" && !bill.Result.includes("Passed")));
      const majorityLabel = !hasResult || !["Yea", "Nay"].includes(recordedVote)
        ? "Not classified"
        : alignsWithMajority ? "Aligns with Majority" : "Minority Position";

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
          <td>${majorityLabel}</td>
          <td><a href="member.html?id=${id}" class="btn btn-secondary btn-sm">Profile →</a></td>
        </tr>
      `);
    });

    tbody.innerHTML = rows.length > 0 ? rows.join("") : `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--color-text-muted);">No member votes match filter criteria.</td></tr>`;
  }

  [searchInput, partySelect, voteSelect].forEach((el) => {
    if (!el || el.dataset.refreshListenerAttached) return;
    el.addEventListener("input", update);
    el.addEventListener("change", update);
    el.dataset.refreshListenerAttached = "true";
  });

  update();
}
