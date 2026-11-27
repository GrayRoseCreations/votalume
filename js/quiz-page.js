/**
 * VOTALUME — Civic Alignment Quiz Controller
 * Loads policy questions from the master sheet and reveals their recorded roll calls.
 */

document.addEventListener("DOMContentLoaded", async () => {
  VotalumeUI.initCommon();
  VotalumeAuth.init();
  await VotalumeData.initCoreData();
  setupQuizControls();
  await initQuiz();
  window.addEventListener("votalume:data-refreshed", async () => {
    await initQuiz({ preserveSession: true });
  });
});

let policyQuestions = [];
let quizQuestions = [];
let currentIndex = 0;
let userSessionAnswers = [];
let selectedMode = "latest";
let lawmakersById = new Map();

async function initQuiz({ preserveSession = false } = {}) {
  const previousQuestions = quizQuestions;
  const previousAnswers = userSessionAnswers;
  const previousIndex = currentIndex;
  const revealIsOpen = document.getElementById("quiz-reveal-box").style.display !== "none";
  const resultsAreOpen = document.getElementById("quiz-results-container").style.display !== "none";
  const [allBank, bills, benchmarkRows] = await Promise.all([
    VotalumeData.loadQuizQuestions(),
    VotalumeData.getAllBills(),
    VotalumeData.loadQuizBenchmarks()
  ]);
  const communityBenchmarks = buildCommunityBenchmarks(benchmarkRows);
  const validQuestions = (Array.isArray(allBank) ? allBank : []).filter((question) =>
    question && question.Question_ID && question.Neutral_Question
  );
  const billByRollCall = new Map();
  (Array.isArray(bills) ? bills : []).forEach((bill) => {
    const rollCallId = String(bill.Roll_Call_ID || bill.House_Roll_Call_ID || bill.Senate_Roll_Call_ID || "").trim();
    if (rollCallId) billByRollCall.set(rollCallId.toUpperCase(), bill);
  });

  const linkedQuestions = validQuestions.map((question) => {
    const rollCallId = String(question.House_Roll_Call_ID || question.Senate_Roll_Call_ID || "").trim();
    const bill = billByRollCall.get(rollCallId.toUpperCase()) || null;
    const voteDate = String(bill?.Vote_Date || question.Vote_Date || "").trim();
    return {
      ...question,
      Roll_Call_ID: rollCallId,
      Linked_Bill: bill,
      Vote_Category: String(bill?.Vote_Category || bill?.Category || bill?.Vote_Type || "").trim(),
      Tags: String(bill?.Tags || bill?.Assigned_Tags || ""),
      Plain_English_Title: String(bill?.Plain_English_Title || bill?.Bill_Title || bill?.Bill_Number || ""),
      Vote_Date: voteDate,
      Linked_Vote_Date: voteDate,
      Vote_Type_Plain_English: String(bill?.Vote_Type_Plain_English || "").trim(),
      Community_Benchmark: communityBenchmarks.get(String(question.Question_ID).trim()) || { yes: 0, no: 0, voters: 0 }
    };
  }).filter((question) =>
    question.Linked_Bill &&
    question.Vote_Category.toLowerCase() === "policy" &&
    !isProceduralVote(question)
  );

  await VotalumeData.loadVoteLogsIfNeeded();
  const summaries = VotalumeData.getStore();
  lawmakersById = new Map(
    [...(summaries.House_Summary || []), ...(summaries.Senate_Summary || [])]
      .filter((member) => member.Member_ID)
      .map((member) => [String(member.Member_ID).toUpperCase(), member])
  );

  policyQuestions = await Promise.all(linkedQuestions.map(async (question) => {
    const [counts, votes] = await Promise.all([
      VotalumeData.getVoteCountsForBill(question.Roll_Call_ID),
      VotalumeData.getMemberVotesForBill(question.Roll_Call_ID)
    ]);
    const yes = Number(counts.yes) || 0;
    const no = Number(counts.no) || 0;
    const summaryCounts = extractResultCounts(question.Bill_Reveal_Summary);
    const resultCounts = extractResultCounts(`${question.Linked_Bill?.Result || ""} ${question.Linked_Bill?.Outcome || ""}`);
    const totalYes = summaryCounts.yes || resultCounts.yes || numericField(question.Linked_Bill, ["Yea_Count", "Yes_Count"]) || yes;
    const totalNo = summaryCounts.no || resultCounts.no || numericField(question.Linked_Bill, ["Nay_Count", "No_Count"]) || no;
    return {
      ...question,
      Vote_Counts: { yes: totalYes, no: totalNo },
      Vote_Margin: totalYes || totalNo ? Math.abs(totalYes - totalNo) : null,
      Member_Votes: votes || {},
      Is_Landmark: isLandmarkQuestion(question, totalYes, totalNo, totalYes || totalNo ? Math.abs(totalYes - totalNo) : null)
    };
  }));

  const count = document.getElementById("landmark-question-count");
  if (count) count.textContent = `Landmark & Controversial Showdowns: ${policyQuestions.filter((q) => q.Is_Landmark).length} questions`;
  updateFullQuizLength();
  if (preserveSession && previousQuestions.length) {
    const refreshedById = new Map(policyQuestions.map((question) => [question.Question_ID, question]));
    quizQuestions = previousQuestions.map((question) => refreshedById.get(question.Question_ID)).filter(Boolean);
    userSessionAnswers = previousAnswers.map((answer) => ({
      ...answer,
      question: refreshedById.get(answer.question.Question_ID) || answer.question
    }));
    const currentQuestionId = previousQuestions[previousIndex]?.Question_ID;
    const refreshedIndex = quizQuestions.findIndex((question) => question.Question_ID === currentQuestionId);
    currentIndex = refreshedIndex >= 0 ? refreshedIndex : Math.min(previousIndex, Math.max(0, quizQuestions.length - 1));
    if (!quizQuestions.length) {
      showQuizEmptyState();
    } else if (resultsAreOpen) {
      await showQuizResults();
    } else if (!revealIsOpen) {
      renderCurrentQuestion();
    }
    return;
  }
  startQuiz(selectedMode);
}

function isProceduralVote(question) {
  const bill = question.Linked_Bill || {};
  const category = `${question.Vote_Category} ${bill.Vote_Type || ""} ${question.Vote_Type_Plain_English}`.toLowerCase();
  return /procedural|nomination|cloture|motion to proceed|rules vote/.test(category);
}

function numericField(record, keys) {
  for (const key of keys) {
    const value = Number(record?.[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

function extractResultCounts(result) {
  const match = String(result || "").match(/(\d+)\s*[-–]\s*(\d+)/);
  return match ? { yes: Number(match[1]), no: Number(match[2]) } : { yes: 0, no: 0 };
}

function isLandmarkQuestion(question, yes, no, margin) {
  const bill = question.Linked_Bill || {};
  const chamber = String(bill.Chamber || (/^S-/i.test(question.Roll_Call_ID) ? "Senate" : "House")).toLowerCase();
  const threshold = chamber === "senate" ? 6 : 15;
  const tags = String(question.Tags || "");
  const highImpactTag = /\[(?:Faction|Party-Line|Exec):/i.test(tags);
  return question.Vote_Category.toLowerCase() === "policy" &&
    ((margin !== null && margin <= threshold && (yes + no) > 0) ||
      highImpactTag ||
      question.Vote_Type_Plain_English.toLowerCase() === "major policy vote");
}

function setupQuizControls() {
  updateQuizSignInPrompt();
  VotalumeAuth.onAuthStateChanged(updateQuizSignInPrompt);
  document.querySelectorAll('input[name="quiz-mode"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      selectedMode = input.value;
      const fullOptions = document.getElementById("full-quiz-options");
      if (fullOptions) fullOptions.hidden = selectedMode !== "full";
      const button = document.getElementById("btn-start-quiz");
      if (button) button.textContent = startLabel(selectedMode);
    });
  });
  document.getElementById("quiz-length-select")?.addEventListener("change", updateFullQuizLength);
  document.getElementById("btn-start-quiz")?.addEventListener("click", () => startQuiz(selectedMode));
  document.getElementById("btn-quiz-yea")?.addEventListener("click", () => handleUserVote("Yea"));
  document.getElementById("btn-quiz-nay")?.addEventListener("click", () => handleUserVote("Nay"));
  document.getElementById("btn-quiz-skip")?.addEventListener("click", () => handleUserVote("Skip"));
  document.getElementById("btn-quiz-next")?.addEventListener("click", () => {
    currentIndex++;
    renderCurrentQuestion();
  });
  document.getElementById("btn-retake-quiz")?.addEventListener("click", () => startQuiz(selectedMode));
}

function updateFullQuizLength() {
  const selector = document.getElementById("quiz-length-select");
  if (!selector) return;
  const allOption = selector.querySelector('option[value="all"]');
  if (allOption) allOption.textContent = `All ${policyQuestions.length} Questions`;
}

function startLabel(mode) {
  if (mode === "landmark") return "Start Landmark Showdowns";
  if (mode === "full") return "Start Full Policy Quiz";
  return "Start Latest Votes";
}

function startQuiz(mode) {
  selectedMode = mode;
  const ordered = [...policyQuestions].sort((a, b) => dateValue(b.Linked_Vote_Date) - dateValue(a.Linked_Vote_Date));
  if (mode === "landmark") {
    quizQuestions = ordered.filter((question) => question.Is_Landmark);
  } else if (mode === "full") {
    if (document.getElementById("quiz-shuffle-toggle")?.checked) shuffleArray(ordered);
    const length = document.getElementById("quiz-length-select")?.value || "10";
    quizQuestions = length === "all" ? ordered : ordered.slice(0, Number(length));
  } else {
    quizQuestions = ordered.slice(0, 5);
  }

  currentIndex = 0;
  userSessionAnswers = [];
  const stage = document.getElementById("quiz-card-stage");
  const results = document.getElementById("quiz-results-container");
  stage.style.display = quizQuestions.length ? "block" : "none";
  results.style.display = "none";
  if (!quizQuestions.length) {
    showQuizEmptyState();
    return;
  }
  renderCurrentQuestion();
}

function dateValue(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function shuffleArray(items) {
  for (let index = items.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}

function showQuizEmptyState() {
  const stage = document.getElementById("quiz-card-stage");
  stage.style.display = "block";
  document.getElementById("quiz-results-container").style.display = "none";
  document.getElementById("quiz-progress-badge").textContent = "No questions available";
  document.getElementById("quiz-question-text").textContent = "No matching policy questions are available right now.";
  document.getElementById("quiz-issue-domain-badge").textContent = "Try another quiz mode";
  document.getElementById("quiz-question-date").textContent = "";
  document.getElementById("quiz-buttons-row").style.display = "none";
  document.getElementById("quiz-reveal-box").style.display = "none";
}

function buildCommunityBenchmarks(rows) {
  const benchmarks = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const questionId = String(row.Question_ID || row.question_id || "").trim();
    if (!questionId) return;
    const yes = Number(row.Yes_Count ?? row.yes_count);
    const no = Number(row.No_Count ?? row.no_count);
    const voters = Number(row.Verified_Voters ?? row.verified_voters);
    benchmarks.set(questionId, {
      yes: Number.isFinite(yes) && yes > 0 ? yes : 0,
      no: Number.isFinite(no) && no > 0 ? no : 0,
      voters: Number.isFinite(voters) && voters > 0 ? voters : 0
    });
  });
  return benchmarks;
}

function updateQuizSignInPrompt() {
  const prompt = document.getElementById("quiz-signin-prompt");
  if (!prompt) return;
  const user = VotalumeAuth.getUser();
  prompt.hidden = Boolean(user?.email);
}

function renderCurrentQuestion() {
  if (currentIndex >= quizQuestions.length) {
    showQuizResults();
    return;
  }
  const question = quizQuestions[currentIndex];
  document.getElementById("quiz-progress-badge").textContent = `Question ${currentIndex + 1} of ${quizQuestions.length}`;
  document.getElementById("quiz-issue-domain-badge").textContent = question.Issue_Domain || "Federal Policy";
  document.getElementById("quiz-question-text").textContent = question.Neutral_Question;
  document.getElementById("quiz-question-date").textContent = `Bill vote date: ${formatVoteDate(question.Linked_Vote_Date)}`;
  document.getElementById("quiz-landmark-badge").hidden = selectedMode !== "landmark";
  document.getElementById("quiz-buttons-row").style.display = "flex";
  document.getElementById("quiz-reveal-box").style.display = "none";
  const saveStatus = document.getElementById("quiz-save-status");
  if (saveStatus) saveStatus.textContent = "";
}

async function handleUserVote(voteAnswer) {
  const question = quizQuestions[currentIndex];
  userSessionAnswers.push({ question, userVote: voteAnswer });
  saveQuizAnswer(question, voteAnswer);

  document.getElementById("quiz-buttons-row").style.display = "none";
  const revealBox = document.getElementById("quiz-reveal-box");
  const revealVoteBadge = document.getElementById("reveal-user-vote");
  const summary = question.Bill_Reveal_Summary || question.Linked_Bill?.Why_It_Matters || question.Linked_Bill?.Description || "Bill summary is not available.";
  const displayAnswer = voteAnswer === "Yea" ? "Yes" : voteAnswer === "Nay" ? "No" : "Skip";
  revealVoteBadge.textContent = `Your Answer: ${displayAnswer}`;
  revealVoteBadge.className = `badge ${voteAnswer === "Yea" ? "badge-yea" : voteAnswer === "Nay" ? "badge-nay" : "badge-neutral"}`;
  document.getElementById("reveal-bill-title").textContent = question.Plain_English_Title || "Congressional policy vote";
  document.getElementById("reveal-bill-summary").textContent = summary;
  document.getElementById("reveal-bill-date").textContent = `Vote date: ${formatVoteDate(question.Linked_Vote_Date)}${question.Vote_Margin !== null ? ` • Margin: ${question.Vote_Margin} vote${question.Vote_Margin === 1 ? "" : "s"}` : ""}`;
  renderCommunityBenchmark(question);
  renderRevealLawmakers(question);

  const relevantTags = voteAnswer === "Yea" ? question.Yes_Tags : voteAnswer === "Nay" ? question.No_Tags : "";
  const tags = String(relevantTags || question.Tags || "").match(/\[[^\]]+\]/g) || String(relevantTags || "").split(/[;,]/);
  document.getElementById("reveal-tags-list").innerHTML = tags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => `<span class="tag-pill">${VotalumeUI.escapeHtml(tag)}</span>`)
    .join("");
  revealBox.style.display = "block";
}

async function saveQuizAnswer(question, voteAnswer) {
  const status = document.getElementById("quiz-save-status");
  const user = VotalumeAuth.getUser();
  if (!user?.email) {
    if (status) status.textContent = "Your answer is saved only in this browser.";
    return;
  }
  if (user.emailVerified !== true) {
    if (status) status.textContent = "Verify your account email to contribute to community benchmarks.";
    return;
  }
  const webhookUrl = window.VOTALUME_CONFIG?.REPORT_WEBHOOK_URL;
  if (!webhookUrl || !/^https:\/\//i.test(webhookUrl)) {
    if (status) status.textContent = "Your answer is saved locally, but the response endpoint is not configured.";
    console.error("[Votalume Quiz] Quiz response endpoint is not configured.");
    return;
  }
  const answer = voteAnswer === "Yea" ? "Yes" : voteAnswer === "Nay" ? "No" : "Skip";
  let idToken;
  try {
    if (typeof user.getIdToken !== "function") throw new Error("Signed-in account token is unavailable.");
    idToken = await user.getIdToken();
  } catch (error) {
    console.error("[Votalume Quiz] Could not obtain a sign-in token.", error);
    if (status) status.textContent = "Your answer remains available locally; sign-in verification failed.";
    return;
  }
  const payload = {
    action: "submit_quiz_response",
    id_token: idToken,
    user_email: user.email,
    quiz_mode: selectedMode,
    question_id: question.Question_ID,
    user_answer: answer,
    timestamp: new Date().toISOString()
  };
  try {
    await fetch(webhookUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    if (status) status.textContent = "Your answer was sent to the response endpoint. Sheet processing cannot be confirmed here.";
  } catch (error) {
    console.error("[Votalume Quiz] Could not submit the response.", error);
    if (status) status.textContent = "Your answer remains available locally; saving it to the community benchmark failed.";
  }
}

function renderCommunityBenchmark(question) {
  const container = document.getElementById("quiz-community-benchmark");
  if (!container) return;
  const { yes, no, voters } = question.Community_Benchmark || { yes: 0, no: 0, voters: 0 };
  const total = yes + no;
  if (!total) {
    container.innerHTML = `
      <p style="margin:0 0 0.4rem;">Community Benchmark: No verified answers yet (0 verified voters).</p>
      <div role="img" aria-label="No verified community answers yet" style="height:0.65rem;overflow:hidden;border-radius:4px;background:#E2E8F0;"></div>
    `;
    return;
  }
  const yesPct = Math.round((yes / total) * 100);
  const noPct = 100 - yesPct;
  container.innerHTML = `
    <p style="margin:0 0 0.4rem;">Community Benchmark: ${yesPct}% Yes • ${noPct}% No (${voters} verified voter${voters === 1 ? "" : "s"})</p>
    <div role="img" aria-label="Community answers: ${yesPct}% Yes and ${noPct}% No" style="height:0.65rem;display:flex;overflow:hidden;border-radius:4px;background:#E2E8F0;">
      <span style="width:${yesPct}%;background:#15803D;"></span><span style="width:${noPct}%;background:#B91C1C;"></span>
    </div>
  `;
}

function getPinnedLawmakers() {
  const pinnedIds = VotalumeAuth.getBookmarks().map((id) => String(id).toUpperCase());
  return pinnedIds.map((id) => lawmakersById.get(id)).filter(Boolean);
}

function renderRevealLawmakers(question) {
  const container = document.getElementById("reveal-lawmakers-votes");
  const pinned = getPinnedLawmakers();
  if (!pinned.length) {
    container.innerHTML = '<p>Pin lawmakers in their profiles to see their recorded votes here.</p>';
    return;
  }
  const rows = pinned.map((member) => {
    const vote = question.Member_Votes[String(member.Member_ID).toUpperCase()] || "Not recorded";
    const display = VotalumeUI.getVoteDisplay(vote);
    return `<li><strong>${VotalumeUI.escapeHtml(member.Member_Name || "Lawmaker")}</strong>: ${VotalumeUI.escapeHtml(display.label)}</li>`;
  });
  container.innerHTML = `<h4>Your pinned lawmakers on this roll call</h4><ul>${rows.join("")}</ul>`;
}

function formatVoteDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

async function showQuizResults() {
  document.getElementById("quiz-card-stage").style.display = "none";
  document.getElementById("quiz-results-container").style.display = "block";

  const partyScores = calculatePartyAlignment();
  document.getElementById("match-dem-pct").textContent = partyScores.Democratic === null ? "Not enough data" : `${partyScores.Democratic}%`;
  document.getElementById("match-rep-pct").textContent = partyScores.Republican === null ? "Not enough data" : `${partyScores.Republican}%`;
  renderPinnedAlignment();
  renderUserDriftGraph();
  await renderLocalRepComparison();
}

function calculatePartyAlignment() {
  const totals = { Democratic: { matched: 0, possible: 0 }, Republican: { matched: 0, possible: 0 } };
  userSessionAnswers.forEach(({ question, userVote }) => {
    if (userVote === "Skip") return;
    const partyVotes = { Democratic: { Yea: 0, Nay: 0 }, Republican: { Yea: 0, Nay: 0 } };
    Object.entries(question.Member_Votes || {}).forEach(([memberId, vote]) => {
      const member = lawmakersById.get(memberId.toUpperCase());
      const partyLabel = String(member?.Party || "").toLowerCase();
      const party = partyLabel.includes("dem") ? "Democratic" : partyLabel.includes("rep") ? "Republican" : "";
      if (partyVotes[party] && (vote === "Yea" || vote === "Nay")) partyVotes[party][vote]++;
    });
    const weight = questionWeight(question);
    Object.keys(partyVotes).forEach((party) => {
      const votes = partyVotes[party];
      const officialPosition = billPartyPosition(question.Linked_Bill, party);
      const position = officialPosition || (votes.Yea === votes.Nay ? null : votes.Yea > votes.Nay ? "Yea" : "Nay");
      if (!position) return;
      totals[party].possible += weight;
      if (position === userVote) totals[party].matched += weight;
    });
  });
  return Object.fromEntries(Object.entries(totals).map(([party, score]) => [
    party,
    score.possible ? Math.round((score.matched / score.possible) * 100) : null
  ]));
}

function billPartyPosition(bill, party) {
  const keys = party === "Democratic"
    ? [["Dem_Yea", "Democratic_Yea"], ["Dem_Nay", "Democratic_Nay"]]
    : [["GOP_Yea", "Rep_Yea", "Republican_Yea"], ["GOP_Nay", "Rep_Nay", "Republican_Nay"]];
  const readCount = (candidates) => {
    for (const key of candidates) {
      if (bill?.[key] === null || bill?.[key] === undefined || String(bill[key]).trim() === "") continue;
      const count = Number(bill[key]);
      if (Number.isFinite(count) && count >= 0) return count;
    }
    return null;
  };
  const yea = readCount(keys[0]);
  const nay = readCount(keys[1]);
  if (yea === null || nay === null || yea === nay) return null;
  return yea > nay ? "Yea" : "Nay";
}

function questionWeight(question) {
  const raw = question.Provision_Weight;
  if (raw === null || raw === undefined || String(raw).trim() === "") return 1;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : 1;
}

function responseWeight(response) {
  if (response.weight === null || response.weight === undefined || String(response.weight).trim() === "") return 1;
  const value = Number(response.weight);
  return Number.isFinite(value) && value >= 0 ? value : 1;
}

function renderPinnedAlignment() {
  const container = document.getElementById("pinned-lawmakers-alignment");
  const pinned = getPinnedLawmakers();
  if (!pinned.length) {
    container.innerHTML = "<h3>Pinned lawmaker alignment</h3><p>Pin lawmakers in their profiles to see how often their recorded votes matched your answers.</p>";
    return;
  }
  const rows = pinned.map((member) => {
    let matched = 0;
    let total = 0;
    userSessionAnswers.forEach(({ question, userVote }) => {
      if (userVote === "Skip") return;
      const vote = question.Member_Votes[String(member.Member_ID).toUpperCase()];
      if (vote !== "Yea" && vote !== "Nay") return;
      const weight = questionWeight(question);
      total += weight;
      if (vote === userVote) matched += weight;
    });
    const percent = total ? Math.round((matched / total) * 100) : null;
    return `<li><span>${VotalumeUI.escapeHtml(member.Member_Name || "Lawmaker")}</span><strong>${percent === null ? "No recorded votes" : `${percent}% alignment`}</strong></li>`;
  });
  container.innerHTML = `<h3>Alignment with your pinned lawmakers</h3><p>Scores use provision weights and only recorded Yes/No votes.</p><ul>${rows.join("")}</ul>`;
}

function renderUserDriftGraph() {
  const canvas = document.getElementById("user-drift-chart");
  if (!canvas || typeof Chart === "undefined") return;
  const existingChart = Chart.getChart(canvas);
  if (existingChart) existingChart.destroy();
  const responses = VotalumeAuth.getQuizResponses();
  const quarters = [...new Set(Object.values(responses).map((response) => response.quarter))].sort();
  if (!quarters.length) return;
  const scores = quarters.map((quarter) => {
    const quarterAnswers = Object.values(responses).filter((response) =>
      response.quarter === quarter && (response.answer === "Yea" || response.answer === "Nay")
    );
    const total = quarterAnswers.reduce((sum, response) => sum + responseWeight(response), 0);
    const yeaWeight = quarterAnswers.reduce((sum, response) =>
      sum + (response.answer === "Yea" ? responseWeight(response) : 0), 0);
    return total ? Math.round((yeaWeight / total) * 100) : 0;
  });
  new Chart(canvas, {
    type: "line",
    data: {
      labels: quarters,
      datasets: [{
        label: "Your Yes answers by quarter",
        data: scores,
        borderColor: "#7C3AED",
        backgroundColor: "rgba(124, 58, 237, 0.15)",
        fill: true,
        pointRadius: 6,
        pointBackgroundColor: "#7C3AED",
        tension: 0.25
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { min: 0, max: 100, ticks: { callback: (value) => `${value}%` }, grid: { color: "#E2E8F0" } },
        x: { grid: { display: false } }
      },
      plugins: { legend: { position: "bottom" } }
    }
  });
}

async function renderLocalRepComparison() {
  const tbody = document.getElementById("bill-by-bill-comparison-tbody");
  if (!tbody) return;
  const district = VotalumeAuth.getHomeDistrict();
  if (!district.state) {
    document.getElementById("delegation-match-badge").textContent = "Set a home district in your profile";
    tbody.innerHTML = '<tr><td colspan="6">Add your state and district in your profile to compare your local delegation.</td></tr>';
    return;
  }
  const delegation = await VotalumeData.getDelegation(district.state, district.district);
  const representative = delegation.representative;
  const senators = delegation.senators || [];
  const members = [representative, senators[0], senators[1]];
  const headers = [
    ["th-rep-vote", representative],
    ["th-sen1-vote", senators[0]],
    ["th-sen2-vote", senators[1]]
  ];
  headers.forEach(([id, member]) => {
    const header = document.getElementById(id);
    header.textContent = member?.Member_Name || "No lawmaker found";
  });
  document.getElementById("delegation-match-badge").textContent = `${district.state.toUpperCase()} Delegation`;

  tbody.innerHTML = userSessionAnswers.map(({ question, userVote }) => {
    const votes = members.map((member) => member
      ? question.Member_Votes[String(member.Member_ID).toUpperCase()] || "Not recorded"
      : "Not available");
    const title = question.Plain_English_Title || question.Roll_Call_ID;
    const questionText = question.Neutral_Question.length > 85
      ? `${question.Neutral_Question.slice(0, 85)}…`
      : question.Neutral_Question;
    const voteCell = (vote) => {
      const display = VotalumeUI.getVoteDisplay(vote);
      return `<span class="badge ${display.badgeClass}">${VotalumeUI.escapeHtml(display.label)}</span>`;
    };
    return `<tr>
      <td class="table-sticky-col"><strong>${VotalumeUI.escapeHtml(title)}</strong><div>${VotalumeUI.escapeHtml(questionText)}</div><div>Vote date: ${VotalumeUI.escapeHtml(formatVoteDate(question.Linked_Vote_Date))}</div></td>
      <td>${voteCell(userVote)}</td>
      ${votes.map((vote) => `<td>${voteCell(vote)}${userVote === "Skip" || vote === "Not recorded" || vote === "Not available" ? "" : `<div>${vote === userVote ? "Aligned with you" : "Different from your answer"}</div>`}</td>`).join("")}
      <td><a href="bill.html?id=${encodeURIComponent(question.Roll_Call_ID)}" class="btn btn-secondary btn-sm">Full Roll Call</a></td>
    </tr>`;
  }).join("");
}
