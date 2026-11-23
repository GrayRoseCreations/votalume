/**
 * VOTALUME — Methodology & Taxonomy Guide Controller
 */

document.addEventListener("DOMContentLoaded", async () => {
  VotalumeUI.initCommon();
  VotalumeAuth.init();
  await VotalumeData.initCoreData();

  await renderTaxonomy();
  await renderPublicChangelog();
});

async function renderTaxonomy() {
  const container = document.getElementById("taxonomy-categories-container");
  const countBadge = document.getElementById("tags-count-badge");
  if (!container) return;

  const rawTags = await VotalumeData.loadTab("TAG_DEFINITIONS");
  
  if (countBadge && Array.isArray(rawTags)) {
    countBadge.textContent = `${rawTags.length} Active Tags`;
  }

  // Group tags by Category
  const categories = {};
  rawTags.forEach((row) => {
    const cat = row.Category || "General Legislative Alignment";
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(row);
  });

  container.innerHTML = Object.entries(categories).map(([catName, tags]) => `
    <div style="border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 1.25rem; background-color: #FFFFFF;">
      <h3 style="font-size: 1.1rem; color: var(--color-civic-navy); margin-bottom: 0.75rem; border-bottom: 1px solid var(--color-border); padding-bottom: 0.5rem;">
        ${VotalumeUI.escapeHtml(catName)} (${tags.length})
      </h3>
      <div style="display: flex; gap: 0.45rem; flex-wrap: wrap;">
        ${tags.map((t) => `
          <div class="tag-pill" style="font-size: 0.8rem; padding: 0.3rem 0.65rem;" title="House: ${t.House_Status || 'Active'} | Senate: ${t.Senate_Status || 'Active'}">
            <strong>${VotalumeUI.escapeHtml(t.Tag)}</strong>
          </div>
        `).join("")}
      </div>
    </div>
  `).join("");
}

async function renderPublicChangelog() {
  const tbody = document.getElementById("changelog-tbody");
  if (!tbody) return;

  const records = await VotalumeData.loadChangeControlPublic();

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--color-text-muted);">Database operational. Baseline initialization complete.</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map((r) => `
    <tr>
      <td class="table-sticky-col"><strong>${r.Change_ID}</strong></td>
      <td style="white-space:nowrap; font-size:0.825rem;">${r.Date_Submitted}</td>
      <td><span class="badge badge-neutral">${r.Change_Type}</span></td>
      <td><span class="badge badge-neutral">${r.Target_Scope}</span></td>
      <td style="font-size:0.85rem; max-width:340px;">${VotalumeUI.escapeHtml(r.Plain_English_Summary)}</td>
      <td><span class="badge badge-yea">✓ ${r.Status}</span></td>
    </tr>
  `).join("");
}
