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
  const tagSelect = document.getElementById("bill-tag-select");
  const specialSelect = document.getElementById("bill-special-select");
  const resetBtn = document.getElementById("btn-reset-bill-filters");

  [searchInput, chamberSelect, quarterSelect, categorySelect, tagSelect, specialSelect].forEach((el) => {
    el?.addEventListener("input", renderBills);
    el?.addEventListener("change", renderBills);
  });

  resetBtn?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    if (chamberSelect) chamberSelect.value = "ALL";
    if (quarterSelect) quarterSelect.value = "ALL";
    if (categorySelect) categorySelect.value = "ALL";
    if (tagSelect) tagSelect.value = "ALL";
    if (specialSelect) specialSelect.value = "ALL";
    renderBills();
  });
}

async function renderBills() {
  allBills = await VotalumeData.getAllBills();
  populateIssueTagFilter(allBills);

  const searchQuery = (document.getElementById("bill-search-input")?.value || "").toLowerCase().trim();
  const chamberVal = document.getElementById("bill-chamber-select")?.value || "ALL";
  const quarterVal = document.getElementById("bill-quarter-select")?.value || "ALL";
  const categoryVal = document.getElementById("bill-category-select")?.value || "ALL";
  const tagVal = document.getElementById("bill-tag-select")?.value || "ALL";
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
    if (categoryVal !== "ALL" && b.Vote_Category !== categoryVal) return false;
    if (tagVal !== "ALL" && !String(b.Tags || b.Assigned_Tags || "").includes(tagVal)) return false;

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
  container.innerHTML = filtered.map((b, index) => {
    const rollCallId = String(b.Roll_Call_ID || "");
    const billUrl = `bill.html?id=${encodeURIComponent(rollCallId)}`;
    const officialUrl = /^https?:\/\//i.test(String(b.Official_Bill_Link || b.Congress_Gov_URL || "")) ? String(b.Official_Bill_Link || b.Congress_Gov_URL) : "";
    const plainTitle = b.Plain_English_Title || b.Bill_Title || b.Bill_Number || "Bill details unavailable";
    const metadata = [b.Bill_Number, rollCallId, b.Vote_Category].filter(Boolean).join(" • ");

    return `
      <article class="card bill-summary-card" style="padding:1.35rem;">
        <div style="display:flex;gap:0.6rem;align-items:center;flex-wrap:wrap;">
          <span class="badge badge-neutral">${VotalumeUI.escapeHtml(b.Chamber || "Congress")}</span>
          <span class="badge badge-neutral">${VotalumeUI.escapeHtml(b.Outcome || "Outcome not listed")}</span>
        </div>
        <h2 style="font-size:1.35rem;margin:0.6rem 0 0.15rem;"><a href="${billUrl}">${VotalumeUI.escapeHtml(plainTitle)}</a></h2>
        <p style="margin:0;color:var(--color-text-muted);font-size:0.85rem;">${VotalumeUI.escapeHtml(metadata)}</p>
        <p style="margin:0.55rem 0;color:var(--color-text-secondary);">${VotalumeUI.escapeHtml(b.Why_It_Matters || "")}</p>
        ${VotalumeUI.renderBillCardDetails(b, voteCounts[index])}
        <div style="display:flex;gap:0.6rem;flex-wrap:wrap;">
          <a href="${billUrl}" class="btn btn-primary btn-sm">See Lawmaker Votes</a>
          ${officialUrl ? `<a href="${officialUrl}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">Official Record ↗</a>` : ""}
        </div>
      </article>
    `;
  }).join("");
}

function populateIssueTagFilter(bills) {
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
  const counts = new Map();
  bills.forEach((bill) => {
    const rawTags = String(bill.Tags || bill.Assigned_Tags || "");
    const tags = rawTags.match(/\[[^\]]+\]/g) || rawTags.split(/[;,]/).map((tag) => tag.trim()).filter(Boolean);
    tags.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
  });
  tagSelect.innerHTML = '<option value="ALL">All Topics</option>' + [...counts.entries()]
    .filter(([, count]) => count > 0)
    .map(([tag]) => `<option value="${VotalumeUI.escapeHtml(tag)}">${VotalumeUI.escapeHtml(VotalumeData.getFriendlyTagLabel(tag))}</option>`)
    .join("");
  if ([...counts.keys()].includes(selected)) tagSelect.value = selected;
}
