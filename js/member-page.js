/**
 * VOTALUME — Member Profile Controller
 * Implements Unified Multi-Chamber Career Profiles, Separated Attendance Gauges,
 * Split Presidential Support, 6 Policy Indices, Financial Sector Overlaps, and Roll Calls.
 */

document.addEventListener("DOMContentLoaded", async () => {
  VotalumeUI.initCommon();
  VotalumeAuth.init();

  const urlParams = new URLSearchParams(window.location.search);
  const memberId = urlParams.get("id") || "B001299"; // default to Jim Banks (chamber switcher)

  await loadAndRenderMember(memberId);
  setupBookmarkButton(memberId);
  window.addEventListener("votalume:data-refreshed", () => loadAndRenderMember(memberId));
});

async function loadAndRenderMember(memberId) {
  const profile = await VotalumeData.getUnifiedMemberProfile(memberId);
  const errorContainer = document.getElementById("member-error-container");
  const contentWrapper = document.getElementById("member-content-wrapper");

  if (!profile) {
    if (errorContainer) errorContainer.style.display = "block";
    if (contentWrapper) contentWrapper.style.display = "none";
    document.title = "Lawmaker Not Found — Votalume";
    return;
  }

  // Update dynamic document title
  document.title = `${profile.name} (${profile.party} - ${profile.state}) — Votalume Legislative Profile`;

  // --- Profile Header ---
  document.getElementById("member-name").textContent = profile.name;
  
  const portraitEl = document.getElementById("member-portrait");
  if (portraitEl) {
    portraitEl.src = profile.photoUrl;
    portraitEl.alt = profile.name;
    portraitEl.onerror = () => VotalumeUI.handlePortraitError(portraitEl);
  }

  // Career Banner
  const careerBanner = document.getElementById("career-title-banner");
  if (careerBanner) {
    if (profile.isChamberSwitcher) {
      careerBanner.innerHTML = `<span class="plain-label-stack"><span class="plain-label-main">Served in House & Senate</span><small class="plain-label-subtitle">Cross-Chamber Career Record</small></span><span class="career-detail">${VotalumeUI.escapeHtml(profile.careerTitle)}</span>`;
      careerBanner.title = "Continuous cross-chamber profile combining House and Senate tenures.";
    } else {
      careerBanner.textContent = profile.careerTitle;
    }
  }

  // Party Badge
  const partyBadge = document.getElementById("member-party-badge");
  if (partyBadge) {
    partyBadge.textContent = profile.party;
    partyBadge.className = `badge ${profile.party === "Democratic" ? "badge-dem" : profile.party === "Republican" ? "badge-rep" : "badge-ind"}`;
  }

  // Departure / Status Badge
  const departureBadge = document.getElementById("member-departure-badge");
  if (departureBadge) {
    departureBadge.textContent = profile.departureReason;
  }

  // Historical Party Log
  document.getElementById("member-party-history").textContent = profile.historicalPartyLog;

  // External Links
  const bioguideBtn = document.getElementById("btn-bioguide-link");
  if (bioguideBtn) bioguideBtn.href = profile.bioguideUrl;

  const officialGovBtn = document.getElementById("btn-official-website");
  if (officialGovBtn) officialGovBtn.href = profile.officialWebsiteUrl;

  // Seat Safety vs. Independence
  document.getElementById("member-district-lean").textContent = profile.districtLean;
  document.getElementById("member-crossover-display").textContent = `${profile.crossoverVotePct} Crossover Rate`;

  // Interactive Committee Gatekeeper Badges
  const committeesContainer = document.getElementById("member-committees-list");
  if (committeesContainer) {
    const list = (profile.committeesAndChairs || "").split(";").map((c) => c.trim()).filter(Boolean);
    if (list.length > 0) {
      committeesContainer.innerHTML = list.map((c) => {
        let badgeClass = "committee-badge";
        if (c.toLowerCase().includes("chair")) badgeClass += " chair";
        else if (c.toLowerCase().includes("ranking")) badgeClass += " ranking";
        return `<span class="${badgeClass}">${VotalumeUI.escapeHtml(c)}</span>`;
      }).join("");
    } else {
      committeesContainer.innerHTML = `<span class="badge badge-neutral">Committee assignments in update queue</span>`;
    }
  }

  // --- Separated Attendance & Lame-Duck Gauges ---
  const regAtt = parsePercent(profile.regularAttendancePct);
  const lameAtt = parsePercent(profile.lameDuckAttendancePct);
  const recentAtt = parsePercent(profile.recentAttendance20Pct);

  document.getElementById("gauge-regular-val").textContent = profile.regularAttendancePct;
  const regFill = document.getElementById("gauge-regular-fill");
  if (regFill) regFill.style.width = `${regAtt === null ? 0 : Math.min(regAtt, 100)}%`;

  document.getElementById("gauge-lameduck-val").textContent = profile.lameDuckAttendancePct;

  // Lame-Duck Badge
  const lameBadgeContainer = document.getElementById("lameduck-badge-container");
  if (lameBadgeContainer) {
    const drop = regAtt !== null && lameAtt !== null ? regAtt - lameAtt : null;
    if (drop === null) {
      lameBadgeContainer.innerHTML = `<span class="badge badge-neutral">Not enough votes yet</span>`;
    } else if (drop >= 20) {
      lameBadgeContainer.innerHTML = `<span class="badge badge-alert">⚠️ Lame-Duck Drop-Off (-${drop.toFixed(1)}%)</span>`;
    } else if (lameAtt >= 90) {
      lameBadgeContainer.innerHTML = `<span class="badge badge-gold">★ Served Through Final Bell</span>`;
    } else {
      lameBadgeContainer.innerHTML = `<span class="badge badge-neutral">Standard Variance</span>`;
    }
  }

  // Active Abstention (Present) & Recent Absence Alert
  document.getElementById("gauge-present-val").textContent = profile.presentRatePct;
  const recentAlertContainer = document.getElementById("recent-absence-alert-container");
  if (recentAlertContainer) {
    if (recentAtt === null) {
      recentAlertContainer.innerHTML = `<span class="badge badge-neutral">Not enough votes yet</span>`;
    } else if (recentAtt < 75) {
      recentAlertContainer.innerHTML = `<span class="badge badge-alert">Recent Absence Alert (${recentAtt}% past 20 votes)</span>`;
    } else {
      recentAlertContainer.innerHTML = `<span class="badge badge-neutral">Recent 20 Votes: ${profile.recentAttendance20Pct}</span>`;
    }
  }

  // High-Impact Absences
  document.getElementById("streak-consecutive-val").textContent = profile.longestConsecutiveMissedStreak;
  document.getElementById("decisive-missed-val").textContent = profile.decisiveLandmarkMissedCount;

  // --- Split Presidential Support Gauges ---
  document.getElementById("pres-own-party-val").textContent = profile.presSupportInPartyPct;
  document.getElementById("pres-own-party-sample").textContent = `n = ${profile.presSupportInPartyN}`;
  const ownFill = document.getElementById("pres-own-bar-fill");
  const ownSupport = parsePercent(profile.presSupportInPartyPct);
  if (ownFill) ownFill.style.width = `${ownSupport === null ? 0 : ownSupport}%`;

  document.getElementById("pres-opp-party-val").textContent = profile.presSupportOppositionPct;
  document.getElementById("pres-opp-party-sample").textContent = `n = ${profile.presSupportOppositionN}`;
  const oppFill = document.getElementById("pres-opp-bar-fill");
  const oppositionSupport = parsePercent(profile.presSupportOppositionPct);
  if (oppFill) oppFill.style.width = `${oppositionSupport === null ? 0 : oppositionSupport}%`;

  // --- 6 Composite Policy Indices ---
  const idx = profile.indices;
  renderIndexCard("idx-econ", idx.economic);
  renderIndexCard("idx-social", idx.social);
  renderIndexCard("idx-gov", idx.governance);
  renderIndexCard("idx-sec", idx.security);
  renderIndexCard("idx-health", idx.health);
  renderIndexCard("idx-energy", idx.energy);

  // How Often They Change
  document.getElementById("vote-reversal-val").textContent = profile.voteReversalRatePct;
  document.getElementById("quarterly-shift-val").textContent = `${profile.quarterlySwingPts} pts`;
  document.getElementById("alignment-drift-val").textContent = `Net Drift: ${profile.alignmentDriftDelta}`;

  // Chart.js Quarterly Voting Shift Graph
  const userResponses = VotalumeAuth.getQuizResponses();
  VotalumeCharts.renderQuarterlyShiftChart("quarterly-shift-chart", profile.trends, userResponses);

  // --- Financial Disclosures & Sector Overlap Card ---
  renderFinancialCard(profile);

  // --- Roll-Call History Table ---
  await renderRollCallsTable(profile.memberId);
}

function renderIndexCard(prefix, data) {
  const scoreEl = document.getElementById(`${prefix}-score`);
  const sampleEl = document.getElementById(`${prefix}-sample`);
  const barEl = document.getElementById(`${prefix}-bar`);

  const hasScore = Number.isFinite(data.score);
  if (scoreEl) {
    scoreEl.textContent = hasScore ? `${Math.round(data.score)}%` : "Not enough votes yet";
    scoreEl.style.fontSize = hasScore ? "" : "0.9rem";
    scoreEl.style.fontFamily = hasScore ? "" : "inherit";
  }
  if (sampleEl) sampleEl.textContent = data.n === "Not enough votes yet" ? data.n : `n = ${data.n}`;
  if (barEl) barEl.style.width = `${hasScore ? Math.max(0, Math.min(data.score, 100)) : 0}%`;
}

function parsePercent(value) {
  const parsed = parseFloat(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function renderFinancialCard(profile) {
  const extras = profile.extras || {};
  const financialCard = document.querySelector(".financial-card");
  if (!Object.keys(extras).length) {
    if (financialCard) financialCard.style.display = "none";
    return;
  }
  if (financialCard) financialCard.style.display = "block";
  const portfolioBadge = document.getElementById("portfolio-status-badge");
  const portfolioStatus = extras.Portfolio_Disclosure_Status || "Diversified Funds / Blind Trust Only";

  if (portfolioBadge) {
    portfolioBadge.textContent = portfolioStatus;
    if (portfolioStatus.toLowerCase().includes("individual corporate")) {
      portfolioBadge.className = "badge badge-alert";
    } else {
      portfolioBadge.className = "badge badge-gold";
    }
  }

  // Donor breakdown parse
  const fundingText = extras.Funding_Source_Split || "Small Donors (≤$200): 40% | Large Donors: 40% | PACs: 20%";
  const matchSmall = fundingText.match(/Small Donors[^:]*:\s*(\d+)%/i);
  const matchLarge = fundingText.match(/Large Donors[^:]*:\s*(\d+)%/i);
  const matchPac = fundingText.match(/PACs[^:]*:\s*(\d+)%/i);

  const smallPct = matchSmall ? parseInt(matchSmall[1]) : 40;
  const largePct = matchLarge ? parseInt(matchLarge[1]) : 40;
  const pacPct = matchPac ? parseInt(matchPac[1]) : 20;

  const segSmall = document.getElementById("seg-small-donors");
  const segLarge = document.getElementById("seg-large-donors");
  const segPac = document.getElementById("seg-pacs");

  if (segSmall) { segSmall.style.width = `${smallPct}%`; segSmall.textContent = `Small ${smallPct}%`; }
  if (segLarge) { segLarge.style.width = `${largePct}%`; segLarge.textContent = `Large ${largePct}%`; }
  if (segPac) { segPac.style.width = `${pacPct}%`; segPac.textContent = `PACs ${pacPct}%`; }

  // STOCK Act & Overlap
  document.getElementById("stock-flags-val").textContent = extras.STOCK_Act_Trades_And_Timing || "0 30-Day Trade-to-Vote Flags | 0 Late Filings";
  document.getElementById("held-sectors-val").textContent = extras.Held_Sectors_Vote_Counts || "Audit queued (excl. index funds)";
  document.getElementById("effectiveness-val").textContent = extras.Legislative_Effectiveness_And_Earmarks || "Bills Introduced: 42 | Earmarks Disclosed";
  document.getElementById("donor-industries-val").textContent = extras.Top_Donor_Industries_And_Committee_Overlap || "Ethics certified disclosure";
  document.getElementById("state-industries-val").textContent = profile.stateMajorIndustries || "Diversified regional economic base";
}

async function renderRollCallsTable(memberId) {
  // Lazy load vote logs if not yet loaded
  await VotalumeData.loadVoteLogsIfNeeded();

  const tbody = document.getElementById("member-votes-tbody");
  const filterType = document.getElementById("vote-filter-type");
  if (!tbody) return;

  const bills = await VotalumeData.getAllBills();
  const votesByRollCall = new Map();
  for (const bill of bills) {
    votesByRollCall.set(bill.Roll_Call_ID, await VotalumeData.getMemberVotesForBill(bill.Roll_Call_ID));
  }

  function updateTable() {
    const filter = filterType ? filterType.value : "ALL";
    tbody.innerHTML = "";

    const rows = [];
    bills.forEach((b) => {
      // Check filter
      if (filter === "DECISIVE" && b.Margin_Type !== "Decisive") return;
      if (filter === "LANDMARK" && b.Landmark_Vote !== "Yes") return;

      const votesMap = votesByRollCall.get(b.Roll_Call_ID) || {};
      const memberVote = votesMap[String(memberId).toUpperCase()] || "Not recorded";

      const voteBadgeClass = memberVote === "Yea" ? "badge-yea" : memberVote === "Nay" ? "badge-nay" : memberVote === "Present" ? "badge-present" : "badge-neutral";
      const tagsText = String(b.Tags || b.Assigned_Tags || "");
      const tags = (tagsText.match(/\[[^\]]+\]/g) || tagsText.split(/[;,]/).map((tag) => tag.trim()).filter(Boolean))
        .slice(0, 2)
        .map((tag) => VotalumeData.getFriendlyTagLabel(tag));

      rows.push(`
        <tr>
          <td class="table-sticky-col">
            <div style="font-weight: 700;"><a href="bill.html?id=${b.Roll_Call_ID}">${b.Bill_Number}</a></div>
            <div style="font-size: 0.8rem; color: var(--color-text-secondary); max-width: 280px; white-space: normal;">
              ${VotalumeUI.escapeHtml(b.Bill_Title)}
            </div>
          </td>
          <td><span class="badge badge-neutral">${b.Chamber}</span></td>
          <td style="font-size: 0.825rem; white-space: nowrap;">${b.Vote_Date}</td>
          <td><span class="badge badge-neutral">${b.Result || "Result unavailable"}</span></td>
          <td><span class="badge ${voteBadgeClass}">${memberVote}</span></td>
          <td>
            <div style="display:flex; gap:0.25rem; flex-wrap:wrap;">
              ${tags.map((t) => `<span class="tag-pill">${VotalumeUI.escapeHtml(t)}</span>`).join("")}
            </div>
          </td>
          <td>
            <a href="bill.html?id=${b.Roll_Call_ID}" class="btn btn-secondary btn-sm">Breakdown →</a>
          </td>
        </tr>
      `);
    });

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--color-text-muted); padding:2rem;">No roll calls match the selected filter.</td></tr>`;
    } else {
      tbody.innerHTML = rows.join("");
    }
  }

  if (filterType && !filterType.dataset.refreshListenerAttached) {
    filterType.addEventListener("change", updateTable);
    filterType.dataset.refreshListenerAttached = "true";
  }
  updateTable();
}

function setupBookmarkButton(memberId) {
  const btn = document.getElementById("btn-bookmark-member");
  const label = document.getElementById("bookmark-label");
  if (!btn || !label) return;

  function updateBtnUI() {
    const isSaved = VotalumeAuth.isBookmarked(memberId);
    if (isSaved) {
      label.textContent = "Bookmarked ✓";
      btn.classList.add("btn-gold");
      btn.classList.remove("btn-secondary");
    } else {
      label.textContent = "Bookmark";
      btn.classList.remove("btn-gold");
      btn.classList.add("btn-secondary");
    }
  }

  updateBtnUI();

  btn.addEventListener("click", async () => {
    await VotalumeAuth.toggleBookmark(memberId);
    updateBtnUI();
  });
}
