/**
 * VOTALUME — Bills & Roll Calls Directory Controller
 */

document.addEventListener("DOMContentLoaded", async () => {
  VotalumeUI.initCommon();
  VotalumeAuth.init();
  await VotalumeData.initCoreData();

  setupFilterListeners();
  window.addEventListener("votalume:data-refreshed", renderBills);
  renderBills();
});

let allBills = [];

function setupFilterListeners() {
  const searchInput = document.getElementById("bill-search-input");
  const chamberSelect = document.getElementById("bill-chamber-select");
  const quarterSelect = document.getElementById("bill-quarter-select");
  const categorySelect = document.getElementById("bill-category-select");
  const topicSelect = document.getElementById("bill-topic-select");
  const tagSelect = document.getElementById("bill-tag-select");
  const outcomeSelect = document.getElementById("bill-outcome-select");
  const specialSelect = document.getElementById("bill-special-select");
  const resetBtn = document.getElementById("btn-reset-bill-filters");

  [searchInput, chamberSelect, quarterSelect, categorySelect, topicSelect, tagSelect, outcomeSelect, specialSelect].forEach((el) => {
    el?.addEventListener("input", renderBills);
    el?.addEventListener("change", renderBills);
  });

  resetBtn?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    if (chamberSelect) chamberSelect.value = "ALL";
    if (quarterSelect) quarterSelect.value = "ALL";
    if (categorySelect) categorySelect.value = "ALL";
    if (topicSelect) topicSelect.value = "ALL";
    if (tagSelect) tagSelect.value = "ALL";
    if (outcomeSelect) outcomeSelect.value = "ALL";
    if (specialSelect) specialSelect.value = "ALL";
    renderBills();
  });
}

async function renderBills() {
  const bills = await VotalumeData.getAllBills();
  await VotalumeData.loadVoteLogsIfNeeded();
  await VotalumeData.loadAccountabilityExtras();
  const accountabilityExtras = VotalumeData.getStore().Accountability_Extras || [];
  allBills = bills.map((bill) => ({
    ...bill,
    Tags: VotalumeData.getTagsForRollCall(bill.Roll_Call_ID).join("; "),
    Topic_Plain_English: String(bill.Topic_Plain_English || "").trim() || "General Legislation"
  }));
  populateTopicFilter(allBills);
  populateIssueTagFilter(allBills);
  const requestedTag = new URLSearchParams(window.location.search).get("tag");
  const tagSelect = document.getElementById("bill-tag-select");
  if (requestedTag && tagSelect && tagSelect.value === "ALL" &&
      [...tagSelect.options].some((option) => option.value === requestedTag)) {
    tagSelect.value = requestedTag;
  }

  const searchQuery = (document.getElementById("bill-search-input")?.value || "").toLowerCase().trim();
  const chamberVal = document.getElementById("bill-chamber-select")?.value || "ALL";
  const quarterVal = document.getElementById("bill-quarter-select")?.value || "ALL";
  const categoryVal = document.getElementById("bill-category-select")?.value || "ALL";
  const topicVal = document.getElementById("bill-topic-select")?.value || "ALL";
  const tagVal = document.getElementById("bill-tag-select")?.value || "ALL";
  const outcomeVal = document.getElementById("bill-outcome-select")?.value || "ALL";
  const specialVal = document.getElementById("bill-special-select")?.value || "ALL";

  const container = document.getElementById("bills-grid");
  const countBadge = document.getElementById("bills-count-badge");
  const emptyState = document.getElementById("empty-bills-state");

  if (!container) return;

  const filtered = allBills.filter((b) => {
    if (!b || typeof b !== "object") return false;
    if (searchQuery) {
      const match = `${b.Plain_English_Title || ""} ${b.Bill_Number || ""} ${b.Tags || b.Assigned_Tags || ""} ${b.Why_It_Matters || b.Description || ""}`.toLowerCase();
      if (!match.includes(searchQuery)) return false;
    }

    if (chamberVal !== "ALL" && b.Chamber !== chamberVal) return false;
    if (quarterVal !== "ALL" && b.Calendar_Quarter !== quarterVal) return false;
    const category = String(b.Vote_Category || "").trim().toLowerCase();
    if (categoryVal !== "ALL" && category !== String(categoryVal).toLowerCase()) return false;
    if (topicVal !== "ALL" && b.Topic_Plain_English !== topicVal) return false;
    if (tagVal !== "ALL" && !String(b.Tags || b.Assigned_Tags || "").includes(tagVal)) return false;

    const outcome = String(b.Outcome || b.Result || "").trim().toLowerCase();
    if (outcomeVal === "PASSED" && !outcome.startsWith("passed") && !outcome.startsWith("confirmed")) return false;
    if (outcomeVal === "FAILED" && !outcome.startsWith("failed")) return false;
    if (specialVal === "DECISIVE" && b.Margin_Type !== "Decisive") return false;
    if (specialVal === "LANDMARK" && b.Landmark_Vote !== "Yes") return false;

    return true;
  });

  if (countBadge) {
    countBadge.textContent = `Showing ${filtered.length} of ${allBills.length} recorded votes`;
  }

  if (filtered.length === 0) {
    container.innerHTML = "";
    if (emptyState) emptyState.style.display = "block";
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  const voteCounts = await Promise.all(filtered.map((bill) => VotalumeData.getVoteCountsForBill(bill.Roll_Call_ID)));
  const sectorBreakdowns = await Promise.all(filtered.map((bill) => renderSectorBreakdown(bill, accountabilityExtras)));
  container.innerHTML = filtered.map((b, index) => {
    const rollCallId = String(b.Roll_Call_ID || "");
    const billUrl = `bill.html?id=${encodeURIComponent(rollCallId)}`;
    const officialUrl = /^https?:\/\//i.test(String(b.Official_Bill_Link || b.Congress_Gov_URL || "")) ? String(b.Official_Bill_Link || b.Congress_Gov_URL) : "";
    const plainTitle = b.Plain_English_Title || b.Bill_Title || b.Bill_Number || "Bill details unavailable";
    const categoryLabel = b.Vote_Category === "Consensus_Minor" ? "Bipartisan / Unanimous" : b.Vote_Category;
    const metadata = [b.Bill_Number, rollCallId, categoryLabel, b.Topic_Plain_English].filter(Boolean).join(" • ");
    const outcome = String(b.Outcome || b.Result || "");
    const outcomeClass = outcome.toLowerCase().startsWith("passed") || outcome.toLowerCase().startsWith("confirmed")
      ? "badge-yea"
      : outcome.toLowerCase().startsWith("failed") ? "badge-nay" : "badge-neutral";

    return `
      <article class="card bill-summary-card" style="padding:1.35rem;">
        <div style="display:flex;gap:0.6rem;align-items:center;flex-wrap:wrap;">
          <span class="badge badge-neutral">${VotalumeUI.escapeHtml(b.Chamber || "Congress")}</span>
          <span class="badge ${outcomeClass}">${VotalumeUI.escapeHtml(outcome || "Outcome not listed")}</span>
        </div>
        <h2 style="font-size:1.35rem;margin:0.6rem 0 0.15rem;"><a href="${billUrl}">${VotalumeUI.escapeHtml(plainTitle)}</a></h2>
        <p style="margin:0;color:var(--color-text-muted);font-size:0.85rem;">${VotalumeUI.escapeHtml(metadata)}</p>
        <p style="margin:0.55rem 0;color:var(--color-text-secondary);">${VotalumeUI.escapeHtml(b.Why_It_Matters || "")}</p>
        ${VotalumeUI.renderBillCardDetails(b, voteCounts[index])}
        ${sectorBreakdowns[index]}
        <div style="display:flex;gap:0.6rem;flex-wrap:wrap;">
          <a href="${billUrl}" class="btn btn-primary btn-sm">See Lawmaker Votes</a>
          ${officialUrl ? `<a href="${officialUrl}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">Official Record ↗</a>` : ""}
        </div>
      </article>
    `;
  }).join("");
}

async function renderSectorBreakdown(bill, extrasRows) {
  const votes = await VotalumeData.getMemberVotesForBill(bill.Roll_Call_ID);
  let yes = 0;
  let no = 0;
  const matchedTags = new Set();
  const sourceLinks = new Map();
  (Array.isArray(extrasRows) ? extrasRows : []).forEach((extras) => {
    const memberId = String(extras.Member_ID || "").trim().toUpperCase();
    const tags = VotalumeData.getSectorTagMatches(extras, bill);
    if (!memberId || !tags.length) return;
    const vote = String(votes[memberId] || votes[memberId.toLowerCase()] || "").trim().toLowerCase();
    if (vote === "yea" || vote === "yes") yes++;
    else if (vote === "nay" || vote === "no") no++;
    else return;
    tags.forEach((tag) => matchedTags.add(tag));
    VotalumeData.getDisclosureSourceLinks(extras).forEach(({ url, label }) => sourceLinks.set(url, label));
  });
  if (!yes && !no) return "";
  const notices = VotalumeData.getFinancialDisclosureNotices();
  const escape = VotalumeUI.escapeHtml;
  const tagList = [...matchedTags].map((tag) =>
    `<a class="tag-pill" href="bills.html?tag=${encodeURIComponent(tag)}">${escape(VotalumeData.getFriendlyTagLabel(tag))}</a>`
  ).join(" ");
  const sources = [...sourceLinks.entries()].map(([url, label]) =>
    `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)} ↗</a>`
  ).join(" · ");
  return `
    <details class="card" style="padding:0.85rem;margin:0.75rem 0;">
      <summary style="cursor:pointer;font-weight:700;">Donor &amp; Portfolio Sector Breakdown</summary>
      <p style="margin:0.65rem 0;">Among audited members with an overlapping disclosed sector: <strong>${yes}</strong> Voted Yes · <strong>${no}</strong> Voted No.</p>
      <p style="margin:0.5rem 0;"><strong>Matched sector tags:</strong> ${tagList}</p>
      ${sources ? `<p style="margin:0.5rem 0;"><strong>Public disclosure sources:</strong> ${sources}</p>` : ""}
      <p style="margin:0.5rem 0;font-size:0.82rem;"><strong>Correlation &amp; Non-Partisan Notice:</strong> ${VotalumeUI.escapeHtml(notices.correlation)}</p>
      <p style="margin:0;font-size:0.82rem;"><strong>FEC Compliance Notice (52 U.S.C. § 30111(a)(4)):</strong> ${VotalumeUI.escapeHtml(notices.fec)}</p>
    </details>
  `;
}

function populateIssueTagFilter() {
  const categoryGroup = document.getElementById("bill-category-select")?.closest(".form-group");
  if (!categoryGroup) return;
  let tagSelect = document.getElementById("bill-tag-select");
  if (!tagSelect) {
    const group = document.createElement("div");
    group.className = "form-group";
    group.innerHTML = '<label class="form-label" for="bill-tag-select">Topic</label><select id="bill-tag-select" class="form-select"><option value="ALL">All Topics</option></select>';
    categoryGroup.insertAdjacentElement("afterend", group);
    tagSelect = group.querySelector("select");
    tagSelect.addEventListener("change", renderBills);
  }

  const selected = tagSelect.value;
  VotalumeUI.populateActiveTagFilter(tagSelect, "All Topics");
  if ([...tagSelect.options].some((option) => option.value === selected)) tagSelect.value = selected;
}

function populateTopicFilter(bills) {
  const select = document.getElementById("bill-topic-select");
  if (!select) return;
  const selected = select.value;
  const topics = [...new Set(bills.map((bill) => bill.Topic_Plain_English))].filter(Boolean).sort((a, b) => a.localeCompare(b));
  select.innerHTML = '<option value="ALL">All Topics</option>' + topics
    .map((topic) => `<option value="${VotalumeUI.escapeHtml(topic)}">${VotalumeUI.escapeHtml(topic)}</option>`)
    .join("");
  if (topics.includes(selected)) select.value = selected;
}
