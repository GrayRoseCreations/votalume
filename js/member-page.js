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
  document.getElementById("quarterly-shift-val").textContent = profile.quarterlySwingPts === "Pending Backfill"
    ? "Pending Backfill"
    : `${profile.quarterlySwingPts} pts`;
  document.getElementById("alignment-drift-val").textContent = `Net Drift: ${profile.alignmentDriftDelta}`;

  // Chart.js Quarterly Voting Shift Graph
  const userResponses = VotalumeAuth.getQuizResponses();
  VotalumeCharts.renderQuarterlyShiftChart("quarterly-shift-chart", profile.trends, userResponses);

  // --- Financial Disclosures & Sector Overlap Card ---
  await renderFinancialCard(profile);

  // --- Roll-Call History Table ---
  await renderRollCallsTable(profile.memberId);
}

function renderIndexCard(prefix, data) {
  const scoreEl = document.getElementById(`${prefix}-score`);
  const sampleEl = document.getElementById(`${prefix}-sample`);
  const barEl = document.getElementById(`${prefix}-bar`);

  const hasScore = Number.isFinite(data.score);
  if (scoreEl) {
    scoreEl.textContent = hasScore ? `${Math.round(data.score)}%` : "Pending Backfill";
    scoreEl.style.fontSize = hasScore ? "" : "0.9rem";
    scoreEl.style.fontFamily = hasScore ? "" : "inherit";
  }
  if (sampleEl) sampleEl.textContent = data.n === "Pending Backfill" ? data.n : `n = ${data.n}`;
  if (barEl) barEl.style.width = `${hasScore ? Math.max(0, Math.min(data.score, 100)) : 0}%`;
}

function parsePercent(value) {
  const parsed = parseFloat(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

async function renderFinancialCard(profile) {
  const extras = profile.extras || {};
  const content = document.getElementById("financial-card-content");
  if (!Object.keys(extras).length) {
    if (content) {
      content.innerHTML = `
        <h2 id="financial-card-heading" style="font-size:1.35rem;margin:0 0 0.75rem;">Financial Disclosures &amp; Sector Overlap</h2>
        <p style="margin:0;">Financial &amp; FEC sector audit queued for upcoming update.</p>
      `;
    }
    return;
  }
  await VotalumeData.loadVoteLogsIfNeeded();
  const bills = await VotalumeData.getAllBills();
  const voteMaps = await Promise.all(bills.map((bill) => VotalumeData.getMemberVotesForBill(bill.Roll_Call_ID)));
  const memberId = String(profile.memberId || "").toUpperCase();
  const alignedVotes = bills.map((bill, index) => {
    const matches = VotalumeData.getSectorTagMatches(extras, bill);
    const votes = voteMaps[index] || {};
    const vote = votes[memberId] || votes[memberId.toLowerCase()];
    const normalizedVote = String(vote || "").trim().toLowerCase();
    if (!matches.length || (normalizedVote !== "yea" && normalizedVote !== "yes" && normalizedVote !== "nay" && normalizedVote !== "no")) return null;
    return { bill, tags: matches, vote: normalizedVote === "yea" || normalizedVote === "yes" ? "Voted Yes" : "Voted No" };
  }).filter(Boolean);

  const escape = VotalumeUI.escapeHtml;
  const field = (value) => escape(String(value || "").trim() || "Not provided");
  const auditDate = String(extras.Last_Accountability_Audit || "").trim();
  const parsedAuditDate = auditDate ? new Date(auditDate) : null;
  const auditLabel = parsedAuditDate && Number.isFinite(parsedAuditDate.getTime())
    ? `Audited ${parsedAuditDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
    : auditDate ? `Audit date: ${auditDate}` : "Audit date not provided";
  const sources = VotalumeData.getDisclosureSourceLinks(extras);
  const sourceLinks = sources.length
    ? `<p style="margin:0.6rem 0 0;"><strong>Public sources:</strong> ${sources.map(({ url, label }) => `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)} ↗</a>`).join(" · ")}</p>`
    : "";
  const lateFlag = VotalumeData.hasLateFilingFlag(extras)
    ? '<span class="badge" style="background:#FEF3C7;color:#92400E;">Disclosed After 45-Day STOCK Act Reporting Window</span>'
    : "";
  const voteCards = alignedVotes.length ? alignedVotes.map(({ bill, tags, vote }) => {
    const tagLinks = tags.map((tag) =>
      `<a class="tag-pill" href="bills.html?tag=${encodeURIComponent(tag)}">${escape(VotalumeData.getFriendlyTagLabel(tag))}</a>`
    ).join(" ");
    const proximity = VotalumeData.hasStockActTradeProximity(extras, bill, tags)
      ? '<span class="badge badge-neutral">Sector Trade Proximity (±45 Days)</span>' : "";
    return `
      <article class="card" style="padding:1rem;margin:0.75rem 0;">
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
          <strong>${escape(bill.Bill_Number || bill.Roll_Call_ID || "Roll call")}</strong>
          <span>${escape(bill.Vote_Date || "Date not provided")}</span>
          <span class="badge ${vote === "Voted Yes" ? "badge-yea" : "badge-nay"}">${vote}</span>
          ${proximity}
        </div>
        <h3 style="margin:0.5rem 0;">${escape(bill.Plain_English_Title || bill.Bill_Title || "Bill title not provided")}</h3>
        <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">${tagLinks}</div>
        <section aria-label="Citizen impact and trade-off" style="margin-top:0.75rem;padding:0.85rem;background:#F8FAFC;border-radius:0.5rem;">
          <h4 style="margin:0 0 0.65rem;">Citizen Impact &amp; Trade-Off</h4>
          <p style="margin:0 0 0.6rem;"><strong>${field(bill.Who_It_Affects)}</strong> • ${field(bill.Income_Impact_Direction)}</p>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0.75rem;">
            <p style="margin:0;"><strong>Potential Benefit (What You Gain):</strong><br>${field(bill.What_You_Gain)}</p>
            <p style="margin:0;"><strong>Potential Cost / Trade-Off to Citizens:</strong><br>${field(bill.What_You_Lose_Or_Pay)}</p>
          </div>
        </section>
      </article>
    `;
  }).join("") : "<p>No sector-aligned Yes/No votes are available for this member in the loaded roll-call records.</p>";

  if (content) {
    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.75rem;flex-wrap:wrap;margin-bottom:1rem;">
        <div>
          <h2 id="financial-card-heading" style="font-size:1.35rem;margin:0;">Financial Disclosures &amp; Sector Overlap</h2>
          <p style="margin:0.3rem 0 0;color:var(--color-text-muted);">${escape(auditLabel)}</p>
        </div>
        <span class="badge badge-neutral">${field(extras.Portfolio_Disclosure_Status)}</span>
        ${lateFlag}
      </div>
      <div class="stock-act-grid">
        <div class="stock-stat-box"><strong>Funding Source Split (Individual vs. PAC)</strong><p>${field(extras.Funding_Source_Split)}</p></div>
        <div class="stock-stat-box"><strong>Top Donor Sectors</strong><p>${field(extras.Top_Donor_Sectors_Display)}</p></div>
        <div class="stock-stat-box"><strong>Sponsored Travel &amp; Outside Roles</strong><p>${field(extras.Sponsored_Travel_And_Outside_Roles)}</p></div>
      </div>
      <div class="card" style="margin-top:0.75rem;padding:1rem;">
        <h3 style="margin:0 0 0.5rem;">STOCK Act &amp; Asset Attribution</h3>
        <p style="margin:0 0 0.65rem;"><strong>Held sectors and related roll-call counts:</strong><br>${field(extras.Held_Sectors_Vote_Counts)}</p>
        <p style="margin:0;"><strong>STOCK Act trades and timing:</strong><br>${field(extras.STOCK_Act_Trades_And_Timing)}</p>
        ${sourceLinks}
      </div>
      <h3 style="margin:1.25rem 0 0.5rem;">Sector-Aligned Votes &amp; Citizen Trade-Off Ledger</h3>
      <p style="margin:0;color:var(--color-text-secondary);">Sector labels match disclosure text to substantive bill tags; vote overlap alone does not establish a relationship.</p>
      ${voteCards}
    `;
  }
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

      const voteDisplay = VotalumeUI.getVoteDisplay(memberVote);
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
          <td><span class="badge ${voteDisplay.badgeClass}">${VotalumeUI.escapeHtml(voteDisplay.label)}</span></td>
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
