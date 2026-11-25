/**
 * VOTALUME — Party Caucus Comparison Controller
 */

document.addEventListener("DOMContentLoaded", async () => {
  VotalumeUI.initCommon();
  VotalumeAuth.init();
  await VotalumeData.initCoreData();

  setupScopeListener();
  window.addEventListener("votalume:data-refreshed", () => renderParties(document.getElementById("party-chamber-scope")?.value || "Combined"));
  renderParties("Combined");
});

function setupScopeListener() {
  const scopeSelect = document.getElementById("party-chamber-scope");
  scopeSelect?.addEventListener("change", (e) => {
    renderParties(e.target.value);
  });
}

function displayPartyMetric(value) {
  return value !== undefined && value !== null && String(value).trim() !== "" ? String(value).trim() : "Not enough votes yet";
}

function scorePartyMetric(value) {
  const parsed = parseFloat(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

async function renderParties(scope = "Combined") {
  await VotalumeData.loadTab("PARTY_COMPARISON");
  await VotalumeData.loadTab("HOUSE_SUMMARY");
  await VotalumeData.loadTab("SENATE_SUMMARY");

  const comparisonData = VotalumeData.getStore().Party_Comparison || [];
  const house = VotalumeData.getStore().House_Summary || [];
  const senate = VotalumeData.getStore().Senate_Summary || [];

  const demData = comparisonData.find((p) => p.Party_Caucus === "Democratic") || {};
  const repData = comparisonData.find((p) => p.Party_Caucus === "Republican") || {};

  // Update Democratic metrics
  document.getElementById("dem-active-count").textContent = demData.Active_Member_Count ? `${demData.Active_Member_Count} Members` : "Not enough votes yet";
  document.getElementById("dem-unity-val").textContent = displayPartyMetric(demData.Party_Unity_Pct);
  document.getElementById("dem-crossover-val").textContent = displayPartyMetric(demData.Crossover_Vote_Pct);
  document.getElementById("dem-unity-bar").style.width = `${scorePartyMetric(demData.Party_Unity_Pct) ?? 0}%`;

  document.getElementById("dem-voted-val").textContent = displayPartyMetric(demData.Voted_Pct);
  document.getElementById("dem-present-val").textContent = displayPartyMetric(demData.Present_Pct);
  document.getElementById("dem-nv-val").textContent = displayPartyMetric(demData.Not_Voting_Pct);

  document.getElementById("dem-reg-att-val").textContent = displayPartyMetric(demData.Regular_Attendance_Pct);
  document.getElementById("dem-pres-own-val").textContent = displayPartyMetric(demData.Pres_Support_In_Party_Pct);
  document.getElementById("dem-pres-opp-val").textContent = displayPartyMetric(demData.Pres_Support_Opposition_Pct);

  document.getElementById("dem-lost-att-val").textContent = displayPartyMetric(demData.Lame_Duck_Attendance_Lost_Pct);
  document.getElementById("dem-ret-att-val").textContent = displayPartyMetric(demData.Lame_Duck_Attendance_Retired_Pct);

  // Update Republican metrics
  document.getElementById("rep-active-count").textContent = repData.Active_Member_Count ? `${repData.Active_Member_Count} Members` : "Not enough votes yet";
  document.getElementById("rep-unity-val").textContent = displayPartyMetric(repData.Party_Unity_Pct);
  document.getElementById("rep-crossover-val").textContent = displayPartyMetric(repData.Crossover_Vote_Pct);
  document.getElementById("rep-unity-bar").style.width = `${scorePartyMetric(repData.Party_Unity_Pct) ?? 0}%`;

  document.getElementById("rep-voted-val").textContent = displayPartyMetric(repData.Voted_Pct);
  document.getElementById("rep-present-val").textContent = displayPartyMetric(repData.Present_Pct);
  document.getElementById("rep-nv-val").textContent = displayPartyMetric(repData.Not_Voting_Pct);

  document.getElementById("rep-reg-att-val").textContent = displayPartyMetric(repData.Regular_Attendance_Pct);
  document.getElementById("rep-pres-own-val").textContent = displayPartyMetric(repData.Pres_Support_In_Party_Pct);
  document.getElementById("rep-pres-opp-val").textContent = displayPartyMetric(repData.Pres_Support_Opposition_Pct);

  document.getElementById("rep-lost-att-val").textContent = displayPartyMetric(repData.Lame_Duck_Attendance_Lost_Pct);
  document.getElementById("rep-ret-att-val").textContent = displayPartyMetric(repData.Lame_Duck_Attendance_Retired_Pct);

  // Render 6 Composite Indices Bar Chart
  const demIndices = {
    economic: { score: scorePartyMetric(demData.Index_Economic_Fiscal_Pct) },
    social: { score: scorePartyMetric(demData.Index_Social_Rights_Pct) },
    governance: { score: scorePartyMetric(demData.Index_Gov_Oversight_Pct) },
    security: { score: scorePartyMetric(demData.Index_Security_Foreign_Pct) },
    health: { score: scorePartyMetric(demData.Index_Health_Entitlements_Pct) },
    energy: { score: scorePartyMetric(demData.Index_Energy_Tech_Ag_Pct) }
  };

  const repIndices = {
    economic: { score: scorePartyMetric(repData.Index_Economic_Fiscal_Pct) },
    social: { score: scorePartyMetric(repData.Index_Social_Rights_Pct) },
    governance: { score: scorePartyMetric(repData.Index_Gov_Oversight_Pct) },
    security: { score: scorePartyMetric(repData.Index_Security_Foreign_Pct) },
    health: { score: scorePartyMetric(repData.Index_Health_Entitlements_Pct) },
    energy: { score: scorePartyMetric(repData.Index_Energy_Tech_Ag_Pct) }
  };

  VotalumeCharts.renderIndicesBarChart("parties-indices-chart", demIndices, "Democratic Caucus", repIndices, "Republican Caucus");

  // Top 5 Loyal & Independent lists
  const allMembers = [...senate, ...house];
  const demMembers = allMembers.filter((m) => m.Party === "Democratic");
  const repMembers = allMembers.filter((m) => m.Party === "Republican");

  // Dem Independents (highest crossover)
  demMembers.sort((a, b) => (parseFloat(b.Crossover_Vote_Pct) || 0) - (parseFloat(a.Crossover_Vote_Pct) || 0));
  renderLeaderList("dem-top-independent-list", demMembers.slice(0, 5), "Crossover_Vote_Pct", "crossover");

  // Dem Loyalists (highest unity)
  demMembers.sort((a, b) => (parseFloat(b.Party_Unity_Pct) || 0) - (parseFloat(a.Party_Unity_Pct) || 0));
  renderLeaderList("dem-top-loyal-list", demMembers.slice(0, 5), "Party_Unity_Pct", "unity");

  // Rep Independents (highest crossover)
  repMembers.sort((a, b) => (parseFloat(b.Crossover_Vote_Pct) || 0) - (parseFloat(a.Crossover_Vote_Pct) || 0));
  renderLeaderList("rep-top-independent-list", repMembers.slice(0, 5), "Crossover_Vote_Pct", "crossover");

  // Rep Loyalists (highest unity)
  repMembers.sort((a, b) => (parseFloat(b.Party_Unity_Pct) || 0) - (parseFloat(a.Party_Unity_Pct) || 0));
  renderLeaderList("rep-top-loyal-list", repMembers.slice(0, 5), "Party_Unity_Pct", "unity");
}

function renderLeaderList(containerId, list, fieldKey, type) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = list.map((m, idx) => {
    const val = displayPartyMetric(m[fieldKey]);
    const color = type === "crossover" ? "var(--color-crossover)" : "var(--color-civic-navy)";
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding: 0.35rem 0; border-bottom: 1px solid var(--color-border);">
        <div>
          <span style="font-weight:700; color:var(--color-text-muted); margin-right:0.35rem;">#${idx + 1}</span>
          <a href="member.html?id=${m.Member_ID}" style="font-weight:600;">${VotalumeUI.escapeHtml(m.Member_Name)}</a>
          <span style="font-size:0.75rem; color:var(--color-text-muted); margin-left:0.25rem;">(${m.State})</span>
        </div>
        <strong style="color: ${color};">${val}</strong>
      </div>
    `;
  }).join("");
}
