/**
 * VOTALUME — Bills & Roll Calls Directory Controller
 */

document.addEventListener("DOMContentLoaded", async () => {
  VotalumeUI.initCommon();
  VotalumeAuth.init();
  await VotalumeData.initCoreData();

  setupFilterListeners();
  renderBills();
});

let allBills = [];

function setupFilterListeners() {
  const searchInput = document.getElementById("bill-search-input");
  const chamberSelect = document.getElementById("bill-chamber-select");
  const quarterSelect = document.getElementById("bill-quarter-select");
  const categorySelect = document.getElementById("bill-category-select");
  const specialSelect = document.getElementById("bill-special-select");
  const resetBtn = document.getElementById("btn-reset-bill-filters");

  [searchInput, chamberSelect, quarterSelect, categorySelect, specialSelect].forEach((el) => {
    el?.addEventListener("input", renderBills);
    el?.addEventListener("change", renderBills);
  });

  resetBtn?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    if (chamberSelect) chamberSelect.value = "ALL";
    if (quarterSelect) quarterSelect.value = "ALL";
    if (categorySelect) categorySelect.value = "ALL";
    if (specialSelect) specialSelect.value = "ALL";
    renderBills();
  });
}

async function renderBills() {
  allBills = await VotalumeData.getAllBills();

  const searchQuery = (document.getElementById("bill-search-input")?.value || "").toLowerCase().trim();
  const chamberVal = document.getElementById("bill-chamber-select")?.value || "ALL";
  const quarterVal = document.getElementById("bill-quarter-select")?.value || "ALL";
  const categoryVal = document.getElementById("bill-category-select")?.value || "ALL";
  const specialVal = document.getElementById("bill-special-select")?.value || "ALL";

  const container = document.getElementById("bills-grid");
  const countBadge = document.getElementById("bills-count-badge");
  const emptyState = document.getElementById("empty-bills-state");

  if (!container) return;

  const filtered = allBills.filter((b) => {
    if (searchQuery) {
      const match = `${b.Bill_Number} ${b.Bill_Title} ${b.Assigned_Tags} ${b.Description}`.toLowerCase();
      if (!match.includes(searchQuery)) return false;
    }

    if (chamberVal !== "ALL" && b.Chamber !== chamberVal) return false;
    if (quarterVal !== "ALL" && b.Calendar_Quarter !== quarterVal) return false;
    if (categoryVal !== "ALL" && b.Vote_Category !== categoryVal) return false;

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

  container.innerHTML = filtered.map((b) => {
    const tags = (b.Assigned_Tags || "").split(";").map((t) => t.trim()).filter(Boolean);
    const isPassed = b.Result?.toLowerCase().includes("passed") || b.Result?.toLowerCase().includes("agreed");

    return `
      <div class="card" style="padding: 1.75rem;">
        <div class="card-header">
          <div>
            <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.35rem; flex-wrap: wrap;">
              <span class="badge badge-neutral">${b.Chamber} • Roll Call #${b.Roll_Call_ID.split("-").pop()}</span>
              <span class="badge ${isPassed ? 'badge-yea' : 'badge-nay'}">${b.Result}</span>
              ${b.Margin_Type === 'Decisive' ? '<span class="badge badge-alert">Decisive Margin</span>' : ''}
              ${b.Landmark_Vote === 'Yes' ? '<span class="badge badge-gold">★ Landmark Vote</span>' : ''}
            </div>
            <h2 style="font-size: 1.4rem; margin: 0;">
              <a href="bill.html?id=${b.Roll_Call_ID}">${b.Bill_Number}: ${VotalumeUI.escapeHtml(b.Bill_Title)}</a>
            </h2>
            <div class="card-subtitle">
              Voted on <strong>${b.Vote_Date}</strong> (${b.Calendar_Quarter}) • Majority Party: <strong>${b.Majority_Party_At_Vote}</strong>
            </div>
          </div>
        </div>

        <p style="font-size: 0.9rem; color: var(--color-text-secondary); line-height: 1.6; margin-bottom: 1.25rem;">
          ${VotalumeUI.escapeHtml(b.Description)}
        </p>

        <!-- Vote Breakdown Bar -->
        <div style="margin-bottom: 1.25rem; background-color: #F8FAFC; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 0.85rem 1rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.35rem; font-weight: 600;">
            <span style="color: #15803D;">Yea: ${b.Yea_Count} (GOP: ${b.GOP_Yea}, Dem: ${b.Dem_Yea})</span>
            <span style="color: #B91C1C;">Nay: ${b.Nay_Count} (GOP: ${b.GOP_Nay}, Dem: ${b.Dem_Nay})</span>
          </div>
          <div style="height: 8px; background-color: #E2E8F0; border-radius: 9999px; overflow: hidden; display: flex;">
            <div style="background-color: #15803D; width: ${(b.Yea_Count / (b.Yea_Count + b.Nay_Count || 1)) * 100}%;"></div>
            <div style="background-color: #B91C1C; width: ${(b.Nay_Count / (b.Yea_Count + b.Nay_Count || 1)) * 100}%;"></div>
          </div>
        </div>

        <!-- Tags -->
        <div style="display: flex; gap: 0.35rem; flex-wrap: wrap; margin-bottom: 1.5rem;">
          ${tags.map((t) => `<span class="tag-pill">${VotalumeUI.escapeHtml(t)}</span>`).join("")}
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <a href="bill.html?id=${b.Roll_Call_ID}" class="btn btn-primary btn-sm">Member Roll-Call Breakdown →</a>
          <a href="${b.Doc_Reference}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">Read Neutral Analysis (Google Doc) ↗</a>
          <a href="${b.Congress_Gov_URL}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">Congress.gov Text ↗</a>
        </div>
      </div>
    `;
  }).join("");
}
