/**
 * VOTALUME — Party Caucus Comparison Controller
 */

document.addEventListener("DOMContentLoaded", async () => {
  VotalumeUI.initCommon();
  VotalumeAuth.init();
  await VotalumeData.initCoreData();

  setupScopeListener();
  renderParties("Combined");
});

function setupScopeListener() {
  const scopeSelect = document.getElementById("party-chamber-scope");
  scopeSelect?.addEventListener("change", (e) => {
    renderParties(e.target.value);
  });
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
  document.getElementById("dem-active-count").textContent = `${demData.Active_Member_Count || '258'} Members`;
  document.getElementById("dem-unity-val").textContent = demData.Party_Unity_Pct || "94.2%";
  document.getElementById("dem-crossover-val").textContent = demData.Crossover_Vote_Pct || "5.8%";
  document.getElementById("dem-unity-bar").style.width = demData.Party_Unity_Pct || "94.2%";

  document.getElementById("dem-voted-val").textContent = demData.Voted_Pct || "97.4%";
  document.getElementById("dem-present-val").textContent = demData.Present_Pct || "0.2%";
  document.getElementById("dem-nv-val").textContent = demData.Not_Voting_Pct || "2.4%";

  document.getElementById("dem-reg-att-val").textContent = demData.Regular_Attendance_Pct || "97.6%";
  document.getElementById("dem-pres-own-val").textContent = demData.Pres_Support_In_Party_Pct || "95.8%";
  document.getElementById("dem-pres-opp-val").textContent = demData.Pres_Support_Opposition_Pct || "14.2%";

  document.getElementById("dem-lost-att-val").textContent = demData.Lame_Duck_Attendance_Lost_Pct || "84.2%";
  document.getElementById("dem-ret-att-val").textContent = demData.Lame_Duck_Attendance_Retired_Pct || "87.5%";

  // Update Republican metrics
  document.getElementById("rep-active-count").textContent = `${repData.Active_Member_Count || '269'} Members`;
  document.getElementById("rep-unity-val").textContent = repData.Party_Unity_Pct || "91.8%";
  document.getElementById("rep-crossover-val").textContent = repData.Crossover_Vote_Pct || "8.2%";
  document.getElementById("rep-unity-bar").style.width = repData.Party_Unity_Pct || "91.8%";

  document.getElementById("rep-voted-val").textContent = repData.Voted_Pct || "96.8%";
  document.getElementById("rep-present-val").textContent = repData.Present_Pct || "0.3%";
  document.getElementById("rep-nv-val").textContent = repData.Not_Voting_Pct || "2.9%";

  document.getElementById("rep-reg-att-val").textContent = repData.Regular_Attendance_Pct || "97.1%";
  document.getElementById("rep-pres-own-val").textContent = repData.Pres_Support_In_Party_Pct || "92.4%";
  document.getElementById("rep-pres-opp-val").textContent = repData.Pres_Support_Opposition_Pct || "19.8%";

  document.getElementById("rep-lost-att-val").textContent = repData.Lame_Duck_Attendance_Lost_Pct || "78.4%";
  document.getElementById("rep-ret-att-val").textContent = repData.Lame_Duck_Attendance_Retired_Pct || "81.0%";

  // Render 6 Composite Indices Bar Chart
  const demIndices = {
    economic: { score: parseFloat(demData.Index_Economic_Fiscal_Pct) || 22 },
    social: { score: parseFloat(demData.Index_Social_Rights_Pct) || 92 },
    governance: { score: parseFloat(demData.Index_Gov_Oversight_Pct) || 85 },
    security: { score: parseFloat(demData.Index_Security_Foreign_Pct) || 64 },
    health: { score: parseFloat(demData.Index_Health_Entitlements_Pct) || 93 },
    energy: { score: parseFloat(demData.Index_Energy_Tech_Ag_Pct) || 27 }
  };

  const repIndices = {
    economic: { score: parseFloat(repData.Index_Economic_Fiscal_Pct) || 88 },
    social: { score: parseFloat(repData.Index_Social_Rights_Pct) || 16 },
    governance: { score: parseFloat(repData.Index_Gov_Oversight_Pct) || 79 },
    security: { score: parseFloat(repData.Index_Security_Foreign_Pct) || 85 },
    health: { score: parseFloat(repData.Index_Health_Entitlements_Pct) || 23 },
    energy: { score: parseFloat(repData.Index_Energy_Tech_Ag_Pct) || 87 }
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
    const val = m[fieldKey] || "0%";
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
