/**
 * VOTALUME — Chart.js Visualization Engine
 * Renders quarterly voting shift timelines, multi-index radar/bar charts,
 * party unity distributions, and user quarterly alignment drift overlays.
 */

const VotalumeCharts = (function() {
  // Chart.js default font and theme setup
  function setupDefaults() {
    if (typeof Chart === "undefined") return;
    Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = "#475569";
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 6;
  }

  /**
   * Renders the Lawmaker Quarterly Voting Shift Graph
   * Overlaying the user's personal quarterly drift if responses exist.
   */
  function renderQuarterlyShiftChart(canvasId, trendsData, userResponses = null) {
    setupDefaults();
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === "undefined") return null;

    // Destroy existing chart on this canvas if any
    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();

    const quarters = ["2025-Q1", "2025-Q2", "2025-Q3", "2025-Q4", "2026-Q1"];
    
    // Sort and map trend scores
    const econData = [];
    const socialData = [];
    const secData = [];

    quarters.forEach((q) => {
      const row = (trendsData || []).find((t) => t.Calendar_Quarter === q);
      if (row) {
        econData.push(parseFloat(row.Economic_Fiscal_Score) || 50);
        socialData.push(parseFloat(row.Social_Rights_Score) || 50);
        secData.push(parseFloat(row.Security_Foreign_Score) || 50);
      } else {
        // Fallback default smooth trend
        econData.push(null);
        socialData.push(null);
        secData.push(null);
      }
    });

    const datasets = [
      {
        label: "Economic & Fiscal",
        data: econData,
        borderColor: "#1B365D",
        backgroundColor: "rgba(27, 54, 93, 0.1)",
        tension: 0.25,
        fill: false,
        pointRadius: 5
      },
      {
        label: "Social Rights",
        data: socialData,
        borderColor: "#D97706",
        backgroundColor: "rgba(217, 119, 6, 0.1)",
        tension: 0.25,
        fill: false,
        pointRadius: 5
      },
      {
        label: "National Security",
        data: secData,
        borderColor: "#2563EB",
        backgroundColor: "rgba(37, 99, 235, 0.1)",
        tension: 0.25,
        fill: false,
        pointRadius: 5
      }
    ];

    // If user has personal quiz responses, overlay user alignment drift
    if (userResponses && Object.keys(userResponses).length > 0) {
      const userScores = quarters.map((q) => {
        // Compute user average score in this quarter
        const qResponses = Object.values(userResponses).filter((r) => r.quarter === q);
        if (!qResponses.length) return null;
        const yeas = qResponses.filter((r) => r.answer === "Yea").length;
        return Math.round((yeas / qResponses.length) * 100);
      });

      if (userScores.some((s) => s !== null)) {
        datasets.push({
          label: "Your Personal Quiz Alignment",
          data: userScores,
          borderColor: "#7C3AED",
          backgroundColor: "rgba(124, 58, 237, 0.15)",
          borderDash: [5, 5],
          pointRadius: 7,
          pointBackgroundColor: "#7C3AED",
          tension: 0.2,
          fill: false
        });
      }
    }

    return new Chart(canvas, {
      type: "line",
      data: {
        labels: quarters,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: {
              callback: (val) => `${val}%`
            },
            grid: {
              color: "#E2E8F0"
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        },
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              usePointStyle: true,
              padding: 15
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.raw}%`
            }
          }
        }
      }
    });
  }

  /**
   * Renders the 6 Composite Indices comparison bar chart
   */
  function renderIndicesBarChart(canvasId, indicesA, labelA, indicesB = null, labelB = null) {
    setupDefaults();
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === "undefined") return null;

    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();

    const labels = [
      "Economic & Fiscal",
      "Social Rights",
      "Gov & Oversight",
      "Security & Foreign",
      "Healthcare & Entitlements",
      "Energy & Tech"
    ];

    const dataA = [
      indicesA.economic?.score ?? null,
      indicesA.social?.score ?? null,
      indicesA.governance?.score ?? null,
      indicesA.security?.score ?? null,
      indicesA.health?.score ?? null,
      indicesA.energy?.score ?? null
    ];

    const datasets = [
      {
        label: labelA || "Score",
        data: dataA,
        backgroundColor: "rgba(27, 54, 93, 0.8)",
        borderRadius: 4
      }
    ];

    if (indicesB && labelB) {
      const dataB = [
        indicesB.economic?.score ?? null,
        indicesB.social?.score ?? null,
        indicesB.governance?.score ?? null,
        indicesB.security?.score ?? null,
        indicesB.health?.score ?? null,
        indicesB.energy?.score ?? null
      ];
      datasets.push({
        label: labelB,
        data: dataB,
        backgroundColor: "rgba(217, 119, 6, 0.8)",
        borderRadius: 4
      });
    }

    return new Chart(canvas, {
      type: "bar",
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: {
              callback: (v) => `${v}%`
            },
            grid: { color: "#E2E8F0" }
          },
          x: {
            grid: { display: false }
          }
        },
        plugins: {
          legend: {
            position: "bottom"
          }
        }
      }
    });
  }

  return {
    renderQuarterlyShiftChart,
    renderIndicesBarChart
  };
})();

if (typeof window !== "undefined") {
  window.VotalumeCharts = VotalumeCharts;
}
