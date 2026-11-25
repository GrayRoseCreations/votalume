/**
 * VOTALUME — Shared UI Components & Interactivity
 * Manages persistent header/footer, global search modal, auth dialogs,
 * district finder widgets, and fallback portrait rendering.
 */

const VotalumeUI = (function() {
  function initCommon() {
    setupMobileNav();
    setupGlobalSearch();
    setupAuthModal();
    setupCacheNoticeListener();
    highlightActiveNavLink();
    setupPlainEnglishNavigation();
    setupGlobalSupportActions();
    setupDiscrepancyModal();
    setupLiveDataRefresh();
  }

  function setupPlainEnglishNavigation() {
    const guideLink = document.querySelector('.primary-nav a[href="guide.html"]');
    if (guideLink) {
      guideLink.innerHTML = '<span class="plain-label-stack"><span class="plain-label-main">Topic & Issue Guide</span><small class="plain-label-subtitle">73-Tag Legislative Taxonomy</small></span>';
    }
    const footer = document.querySelector(".site-footer");
    footer?.querySelectorAll('a[href="guide.html"], a[href="guide.html#indices"], a[href="guide.html#attendance"], a[href="guide.html#chamber-switchers"]').forEach((link) => {
      const href = link.getAttribute("href");
      const content = href.endsWith("#indices")
        ? ["How We Score Lawmakers", "6 Composite Accountability Indices"]
        : href.endsWith("#attendance")
          ? ["Attendance After Elections", "Post-Election Lame-Duck Rules"]
          : href.endsWith("#chamber-switchers")
            ? ["Served in House & Senate", "Cross-Chamber Career Record"]
            : ["Topic & Issue Guide", "73-Tag Legislative Taxonomy"];
      link.innerHTML = `<span class="plain-label-stack"><span class="plain-label-main">${content[0]}</span><small class="plain-label-subtitle">${content[1]}</small></span>`;
    });
  }

  function setupGlobalSupportActions() {
    const config = window.VOTALUME_CONFIG || {};
    const nav = document.querySelector(".primary-nav");
    if (nav && !nav.querySelector('a[href="donate.html"]')) {
      const supportLink = document.createElement("a");
      supportLink.href = "donate.html";
      supportLink.className = "nav-link";
      supportLink.setAttribute("aria-label", "Support Votalume / Donate");
      supportLink.innerHTML = '<span class="plain-label-stack"><span class="plain-label-main">Support Votalume</span><small class="plain-label-subtitle">Donate</small></span>';
      if ((window.location.pathname.split("/").pop() || "index.html") === "donate.html") supportLink.classList.add("active");
      nav.appendChild(supportLink);
    }

    const footer = document.querySelector(".site-footer");
    const reportButton = footer?.querySelector(".trigger-discrepancy-modal");
    if (footer && reportButton && !footer.querySelector("#footer-core-actions")) {
      const actions = document.createElement("div");
      actions.id = "footer-core-actions";
      actions.style.cssText = "display:grid;gap:0.5rem;margin-top:0.5rem";
      actions.innerHTML = `
        <button class="btn btn-secondary btn-sm trigger-suggestion-modal" type="button" style="width:100%">Send a Suggestion</button>
        <a class="btn btn-secondary btn-sm" href="donate.html" style="text-align:center">Support Votalume / Donate</a>
        <div id="footer-kofi-widget" style="margin-top:0.25rem"></div>
        <button class="btn btn-secondary btn-sm refresh-live-data" type="button" style="width:100%">Refresh Live Data</button>
        <span class="live-data-refresh-feedback" role="status" aria-live="polite"></span>
        <p style="font-size:0.8rem;margin:0.35rem 0 0">AI transparency: Gemini assisted with code, summaries, and automated pipelines; outputs are checked against official records.</p>
      `;
      reportButton.insertAdjacentElement("afterend", actions);
    }

    const widgetHost = document.querySelector("#donate-kofi-widget") || document.querySelector("#footer-kofi-widget");
    const fallbackUrl = config.KOFI_URL || "https://ko-fi.com/C8M02B83R2";
    if (widgetHost) {
      const fallback = document.createElement("a");
      fallback.href = fallbackUrl;
      fallback.target = "_blank";
      fallback.rel = "noopener";
      fallback.textContent = "Open Ko-fi support page";
      widgetHost.appendChild(fallback);
    }
  }

  function setupLiveDataRefresh() {
    document.querySelectorAll(".refresh-live-data").forEach((button) => {
      button.addEventListener("click", async () => {
        const feedback = button.parentElement?.querySelector(".live-data-refresh-feedback") || document.getElementById("coverage-refresh-feedback");
        button.disabled = true;
        if (feedback) feedback.textContent = "Refreshing live data...";
        try {
          const refreshed = await window.VotalumeData?.refreshLiveData();
          if (!refreshed) throw new Error("Some sheet data could not be refreshed.");
          if (feedback) feedback.textContent = "Data refreshed just now.";
          window.dispatchEvent(new CustomEvent("votalume:data-refreshed"));
        } catch (error) {
          console.error("[Votalume Data] Refresh failed:", error);
          if (feedback) feedback.textContent = "Refresh incomplete. Showing available data.";
        } finally {
          button.disabled = false;
        }
      });
    });
  }

  function highlightActiveNavLink() {
    const currentPath = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".primary-nav .nav-link").forEach((link) => {
      const href = link.getAttribute("href");
      if (href === currentPath || (currentPath === "" && href === "index.html")) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  }

  function setupMobileNav() {
    const toggle = document.querySelector(".mobile-nav-toggle");
    const nav = document.querySelector(".primary-nav");
    if (toggle && nav) {
      toggle.addEventListener("click", () => {
        nav.classList.toggle("open");
        const isOpen = nav.classList.contains("open");
        toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      });
    }
  }

  function setupCacheNoticeListener() {
    const banner = document.getElementById("cache-notice-banner");
    const liveBadge = document.getElementById("header-live-sync-badge");

    window.addEventListener("votalume:cache-status", (e) => {
      const isCached = e.detail?.isCached;
      updateTagTaxonomyLabels();
      if (banner) {
        banner.style.display = "flex";
        banner.querySelector("span:last-child")?.replaceChildren(document.createTextNode(
          isCached
            ? "Showing cached civic database. Master Google Sheet sync in progress."
            : "Live Civic Database Connected • Official Congressional Records"
        ));
      }
      if (liveBadge) {
        if (isCached) {
          liveBadge.innerHTML = `<span class="sync-pulse" style="background:#F59E0B;box-shadow:0 0 6px #F59E0B"></span> Cached Data`;
          liveBadge.style.color = "#FCD34D";
          liveBadge.style.borderColor = "rgba(252, 211, 77, 0.3)";
        } else {
          liveBadge.innerHTML = `<span class="sync-pulse"></span> Live Sync`;
          liveBadge.style.color = "#86EFAC";
          liveBadge.style.borderColor = "rgba(134, 239, 172, 0.3)";
        }
      }
    });
  }

  function updateTagTaxonomyLabels() {
    const definitions = window.VotalumeData?.getStore().Tag_Definitions || [];
    if (!definitions.length) return;
    const activeCount = definitions.filter((row) => /active/i.test(`${row.House_Status || ""} ${row.Senate_Status || ""}`)).length;
    document.querySelectorAll(".plain-label-subtitle").forEach((label) => {
      if (/^\d+-Tag Legislative Taxonomy$/.test(label.textContent.trim())) {
        label.textContent = `${activeCount}-Tag Legislative Taxonomy`;
      }
    });
  }

  // --- Global Search ---

  function setupGlobalSearch() {
    const searchInputs = document.querySelectorAll(".input-search-global");
    const searchModal = document.getElementById("global-search-modal");
    const searchModalInput = document.getElementById("modal-search-input");
    const searchModalResults = document.getElementById("modal-search-results");

    // Keyboard shortcut (Cmd+K or Ctrl+K)
    window.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        openSearchModal();
      }
      if (e.key === "Escape" && searchModal?.classList.contains("active")) {
        closeSearchModal();
      }
    });

    const headerSearchBtn = document.getElementById("header-search-btn");
    if (headerSearchBtn) {
      headerSearchBtn.addEventListener("click", openSearchModal);
    }

    if (searchModal) {
      searchModal.querySelector(".modal-close-btn")?.addEventListener("click", closeSearchModal);
      searchModal.addEventListener("click", (e) => {
        if (e.target === searchModal) closeSearchModal();
      });
    }

    if (searchModalInput) {
      searchModalInput.addEventListener("input", async (e) => {
        const query = e.target.value.trim().toLowerCase();
        await renderSearchResults(query, searchModalResults);
      });
    }

    // In-page search inputs (e.g. on index.html)
    searchInputs.forEach((inp) => {
      if (inp.id === "modal-search-input") return;
      const dropdown = inp.parentElement.querySelector(".search-results-dropdown");
      inp.addEventListener("input", async (e) => {
        const query = e.target.value.trim().toLowerCase();
        if (dropdown) {
          if (query.length < 2) {
            dropdown.style.display = "none";
            return;
          }
          await renderSearchResults(query, dropdown);
          dropdown.style.display = "block";
        }
      });

      document.addEventListener("click", (e) => {
        if (dropdown && !inp.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.style.display = "none";
        }
      });
    });
  }

  function openSearchModal() {
    const searchModal = document.getElementById("global-search-modal");
    const searchModalInput = document.getElementById("modal-search-input");
    if (searchModal) {
      searchModal.classList.add("active");
      if (searchModalInput) {
        searchModalInput.value = "";
        searchModalInput.focus();
        renderSearchResults("", document.getElementById("modal-search-results"));
      }
    }
  }

  function closeSearchModal() {
    const searchModal = document.getElementById("global-search-modal");
    if (searchModal) searchModal.classList.remove("active");
  }

  async function renderSearchResults(query, container) {
    if (!container) return;
    if (!query || query.length < 1) {
      container.innerHTML = `
        <div style="padding: 1.5rem; text-align: center; color: var(--color-text-muted); font-size: 0.85rem;">
          Type a lawmaker's name, state, bill number (e.g. <em>H.R. 1</em>), or civic tag...
        </div>
      `;
      return;
    }

    // Ensure core data
    await VotalumeData.loadTab("HOUSE_SUMMARY");
    await VotalumeData.loadTab("SENATE_SUMMARY");
    const bills = await VotalumeData.getAllBills();
    const house = VotalumeData.getStore().House_Summary || [];
    const senate = VotalumeData.getStore().Senate_Summary || [];

    const results = [];

    // Search Lawmakers (Disambiguated format: Member_Name (Party – State/District, Years))
    const seenIds = new Set();
    [...senate, ...house].forEach((m) => {
      const id = String(m.Member_ID).toUpperCase();
      if (seenIds.has(id)) return;
      seenIds.add(id);

      const name = m.Member_Name || "";
      const state = m.State || "";
      const party = m.Party || "";
      const district = m.District ? `${state}-${m.District}` : state;
      const term = m.Term_Window || "";
      const fullText = `${name} ${state} ${party} ${district} ${term}`.toLowerCase();

      if (fullText.includes(query)) {
        results.push({
          type: "Lawmaker",
          title: `${name} (${party.charAt(0)} – ${district}, ${term})`,
          sub: `${party} • ${district} • Attendance: ${m.Regular_Attendance_Pct || "Not enough votes yet"}`,
          url: `member.html?id=${id}`,
          badgeClass: party === "Democratic" ? "badge-dem" : party === "Republican" ? "badge-rep" : "badge-ind",
          badgeText: party
        });
      }
    });

    // Search Bills
    bills.forEach((b) => {
      const fullText = `${b.Bill_Number || ""} ${b.Plain_English_Title || b.Bill_Title || ""} ${b.Tags || b.Assigned_Tags || ""} ${b.Chamber || ""}`.toLowerCase();
      if (fullText.includes(query)) {
        results.push({
          type: "Bill",
          title: `${b.Bill_Number || "Bill"}: ${b.Plain_English_Title || b.Bill_Title || "Title unavailable"}`,
          sub: `${b.Chamber || "Congress"} • ${b.Vote_Category || "Category unavailable"} • ${b.Outcome || b.Result || "Outcome unavailable"} • ${b.Vote_Date || "Date unavailable"}`,
          url: `bill.html?id=${b.Roll_Call_ID}`,
          badgeClass: "badge-gold",
          badgeText: b.Vote_Category || "Roll Call"
        });
      }
    });

    if (results.length === 0) {
      container.innerHTML = `
        <div style="padding: 1.5rem; text-align: center; color: var(--color-text-muted); font-size: 0.85rem;">
          No matching lawmakers, bills, or tags found for "<strong>${escapeHtml(query)}</strong>".
        </div>
      `;
      return;
    }

    container.innerHTML = results.slice(0, 8).map((r) => `
      <a href="${r.url}" class="search-result-item">
        <div>
          <div style="font-weight: 600; font-size: 0.95rem; color: var(--color-civic-navy);">${escapeHtml(r.title)}</div>
          <div style="font-size: 0.775rem; color: var(--color-text-muted); margin-top: 0.2rem;">${escapeHtml(r.sub)}</div>
        </div>
        <span class="badge ${r.badgeClass}">${escapeHtml(r.badgeText)}</span>
      </a>
    `).join("");
  }

  // --- Auth Modal & User Profile ---

  function setupAuthModal() {
    const authBtn = document.getElementById("header-user-auth-btn");
    const modal = document.getElementById("auth-profile-modal");
    if (!modal) return;

    const closeBtn = modal.querySelector(".modal-close-btn");
    closeBtn?.addEventListener("click", () => modal.classList.remove("active"));
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.remove("active");
    });

    if (authBtn) {
      authBtn.addEventListener("click", () => {
        renderAuthModalContent();
        modal.classList.add("active");
      });
    }
  }

  function renderAuthModalContent() {
    const modalBody = document.getElementById("auth-modal-body");
    const modalTitle = document.getElementById("auth-modal-title");
    if (!modalBody || !modalTitle) return;

    const user = VotalumeAuth.getUser();
    const profile = VotalumeAuth.getProfile();

    if (user) {
      modalTitle.textContent = "My Civic Profile";
      modalBody.innerHTML = `
        <div style="display:flex; align-items:center; gap: 1rem; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--color-border);">
          <div style="width: 48px; height: 48px; border-radius: 50%; background-color: var(--color-civic-navy); color:#FFF; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:1.25rem;">
            ${(user.email || "C").charAt(0).toUpperCase()}
          </div>
          <div>
            <div style="font-weight:700; font-size:1.05rem;">${escapeHtml(user.displayName || user.email)}</div>
            <div style="font-size:0.8rem; color:var(--color-text-muted);">${escapeHtml(user.email)}</div>
          </div>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem;">Saved Home Congressional District</h4>
          <div style="display:flex; gap: 0.75rem; align-items:center;">
            <select id="modal-profile-state" class="form-select" style="flex: 2;">
              <option value="">Select State</option>
              ${window.VOTALUME_STATES.map((s) => `<option value="${s.code}" ${profile.homeState === s.code ? "selected" : ""}>${s.name} (${s.code})</option>`).join("")}
            </select>
            <input type="text" id="modal-profile-district" class="form-input" style="flex: 1;" placeholder="Dist #" value="${escapeHtml(profile.homeDistrict || "")}" />
            <button id="modal-save-district-btn" class="btn btn-primary btn-sm">Save</button>
          </div>
          <div style="font-size:0.75rem; color:var(--color-text-muted); margin-top:0.35rem;">
            Used to show your 2 Senators and House Rep across bill and quiz comparisons.
          </div>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem;">Bookmarked Lawmakers (${(profile.bookmarkedLawmakers || []).length})</h4>
          <div id="modal-bookmarks-list" style="max-height: 120px; overflow-y:auto; font-size:0.85rem; color:var(--color-text-secondary);">
            ${(profile.bookmarkedLawmakers || []).length ? profile.bookmarkedLawmakers.map((id) => `<div style="padding:0.25rem 0;"><a href="member.html?id=${id}">Lawmaker Bioguide ID: ${id}</a></div>`).join("") : "<em>No lawmakers bookmarked yet. Click the bookmark icon on any lawmaker profile.</em>"}
          </div>
        </div>

        <div style="margin-top: 2rem; display:flex; justify-content:space-between; align-items:center;">
          <button id="modal-signout-btn" class="btn btn-secondary btn-sm" style="color:#B91C1C;">Sign Out</button>
          <span style="font-size:0.75rem; color:#059669;">✓ Synced with Firebase Cloud</span>
        </div>
      `;

      document.getElementById("modal-save-district-btn")?.addEventListener("click", async () => {
        const st = document.getElementById("modal-profile-state").value;
        const dist = document.getElementById("modal-profile-district").value;
        await VotalumeAuth.setHomeDistrict(st, dist);
        alert("Home District saved successfully!");
      });

      document.getElementById("modal-signout-btn")?.addEventListener("click", async () => {
        await VotalumeAuth.signOut();
        renderAuthModalContent();
      });
    } else {
      modalTitle.textContent = "Sign In / Join Votalume";
      modalBody.innerHTML = `
        <p style="font-size: 0.85rem; color: var(--color-text-secondary); margin-bottom: 1.25rem;">
          Sign in or continue as a guest to save your Home District, bookmark lawmakers, and track your quarterly political alignment shift over time.
        </p>

        <button id="modal-google-signin-btn" class="btn btn-secondary" style="width: 100%; margin-bottom: 1.25rem; border-color: #CBD5E1; display:flex; align-items:center; justify-content:center; gap:0.5rem;">
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          Continue with Google
        </button>

        <div style="display:flex; align-items:center; gap: 0.5rem; margin-bottom: 1.25rem;">
          <div style="flex:1; height:1px; background:var(--color-border);"></div>
          <span style="font-size:0.75rem; color:var(--color-text-muted); text-transform:uppercase;">or with email</span>
          <div style="flex:1; height:1px; background:var(--color-border);"></div>
        </div>

        <form id="auth-email-form" style="display:flex; flex-direction:column; gap:0.75rem;">
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input type="email" id="auth-input-email" class="form-input" required placeholder="you@domain.com" />
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" id="auth-input-password" class="form-input" required placeholder="••••••••" minlength="6" />
          </div>
          <div style="display:flex; gap:0.75rem; margin-top:0.5rem;">
            <button type="submit" id="auth-btn-signin" class="btn btn-primary" style="flex:1;">Sign In</button>
            <button type="button" id="auth-btn-signup" class="btn btn-secondary" style="flex:1;">Create Account</button>
          </div>
        </form>

        <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--color-border); text-align:center;">
          <button id="modal-continue-guest-btn" class="btn btn-sm btn-secondary" style="font-size:0.8rem;">
            Continue as Guest (Save to this device only)
          </button>
        </div>
      `;

      document.getElementById("modal-google-signin-btn")?.addEventListener("click", async () => {
        try {
          await VotalumeAuth.signInWithGoogle();
          renderAuthModalContent();
        } catch (err) {
          alert("Sign In with Google error: " + err.message);
        }
      });

      document.getElementById("auth-email-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const em = document.getElementById("auth-input-email").value;
        const pw = document.getElementById("auth-input-password").value;
        try {
          await VotalumeAuth.signInWithEmailPassword(em, pw);
          renderAuthModalContent();
        } catch (err) {
          alert("Sign In error: " + err.message);
        }
      });

      document.getElementById("auth-btn-signup")?.addEventListener("click", async () => {
        const em = document.getElementById("auth-input-email").value;
        const pw = document.getElementById("auth-input-password").value;
        if (!em || !pw) {
          alert("Please enter an email and password to create an account.");
          return;
        }
        try {
          await VotalumeAuth.signUpWithEmailPassword(em, pw);
          renderAuthModalContent();
        } catch (err) {
          alert("Account creation error: " + err.message);
        }
      });

      document.getElementById("modal-continue-guest-btn")?.addEventListener("click", () => {
        document.getElementById("auth-profile-modal")?.classList.remove("active");
      });
    }
  }

  // --- Discrepancy Reporting Modal ---

  function setupDiscrepancyModal() {
    const modal = document.getElementById("discrepancy-modal");
    if (!modal) return;
    const closeBtn = modal.querySelector(".modal-close-btn");
    closeBtn?.addEventListener("click", () => modal.classList.remove("active"));
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.remove("active");
    });

    const pageBadge = document.getElementById("discrepancy-current-page");
    const nameInput = document.getElementById("discrepancy-user-name");
    const emailInput = document.getElementById("discrepancy-user-email");
    const recordIdInput = document.getElementById("discrepancy-record-id");
    const descInput = document.getElementById("discrepancy-description");
    const feedbackBox = document.getElementById("discrepancy-submit-feedback");
    const submitBtn = document.getElementById("discrepancy-submit-btn");
    const recordGroup = recordIdInput?.closest(".form-group");
    const nameGroup = nameInput?.closest(".form-group");
    const emailGroup = emailInput?.closest(".form-group");
    const descriptionLabel = modal.querySelector('label[for="discrepancy-description"]');
    let submissionType = "discrepancy";

    let reportFields = modal.querySelector("#report-entity-fields");
    if (!reportFields && recordGroup) {
      reportFields = document.createElement("div");
      reportFields.id = "report-entity-fields";
      reportFields.innerHTML = `
        <div class="form-group" style="margin-bottom:0.75rem;">
          <label class="form-label" for="report-entity-type">Entity Type</label>
          <select id="report-entity-type" name="Entity_Type" class="form-select"><option>Bill</option><option>Roll Call</option><option>Lawmaker</option><option>Other</option></select>
        </div>
        <div class="form-group" style="margin-bottom:0.75rem;">
          <label class="form-label" for="report-entity-name">Entity Name (Optional)</label>
          <input id="report-entity-name" name="Entity_Name" class="form-input" />
        </div>
        <div class="form-group" style="margin-bottom:0.75rem;">
          <label class="form-label" for="report-issue-category">Issue Category</label>
          <select id="report-issue-category" name="Issue_Category" class="form-select"><option>Incorrect vote count</option><option>Missing record</option><option>Incorrect bill or lawmaker details</option><option>Other</option></select>
        </div>
        <div class="form-group" style="margin-bottom:0.75rem;">
          <label class="form-label" for="report-official-source-url">Official Source URL</label>
          <input id="report-official-source-url" name="Official_Source_URL" type="url" class="form-input" placeholder="https://" />
        </div>
      `;
      recordGroup.insertAdjacentElement("beforebegin", reportFields);
    }
    const entityTypeInput = modal.querySelector("#report-entity-type");
    const entityNameInput = modal.querySelector("#report-entity-name");
    const issueCategoryInput = modal.querySelector("#report-issue-category");
    const sourceUrlInput = modal.querySelector("#report-official-source-url");
    const recordIdLabel = modal.querySelector('label[for="discrepancy-record-id"]');
    if (recordIdInput) {
      recordIdInput.name = "Entity_ID";
      recordIdInput.placeholder = "e.g. H-119-1-5 or B001323";
    }
    if (recordIdLabel) recordIdLabel.textContent = "Entity ID";
    if (descInput) descInput.name = "Description";
    if (emailInput) emailInput.name = "Reporter_Email";
    const emailLabel = modal.querySelector('label[for="discrepancy-user-email"]');
    if (emailLabel) emailLabel.textContent = "Reporter Email (Optional)";

    let categoryGroup = modal.querySelector("#suggestion-category-group");
    if (!categoryGroup && recordGroup) {
      categoryGroup = document.createElement("div");
      categoryGroup.id = "suggestion-category-group";
      categoryGroup.className = "form-group";
      categoryGroup.style.marginBottom = "0.75rem";
      categoryGroup.innerHTML = `
        <label class="form-label" for="suggestion-category">Category</label>
        <select id="suggestion-category" class="form-select">
          <option value="Feature">Feature</option>
          <option value="Data">Data</option>
          <option value="Accessibility">Accessibility</option>
          <option value="Other">Other</option>
        </select>
      `;
      recordGroup.insertAdjacentElement("beforebegin", categoryGroup);
    }

    function setSubmissionMode(type) {
      submissionType = type;
      const isSuggestion = type === "suggestion";
      const title = modal.querySelector("#discrepancy-modal-title");
      if (title) title.textContent = isSuggestion ? "Send a Suggestion" : "Report a Data Discrepancy";
      if (categoryGroup) categoryGroup.style.display = isSuggestion ? "block" : "none";
      if (reportFields) reportFields.style.display = isSuggestion ? "none" : "block";
      if (recordGroup) recordGroup.style.display = isSuggestion ? "none" : "block";
      if (recordIdInput) recordIdInput.required = !isSuggestion;
      if (nameGroup) nameGroup.style.display = "none";
      if (emailGroup) emailGroup.style.display = "block";
      if (descriptionLabel) descriptionLabel.textContent = isSuggestion ? "Suggestion" : "Description";
      if (descInput) {
        descInput.placeholder = isSuggestion
          ? "What would you like Votalume to improve or add?"
          : "Describe the discrepancy and paste the official government link (Congress.gov or clerk roll call)...";
      }
      if (submitBtn) submitBtn.textContent = isSuggestion ? "Submit Suggestion" : "Submit Report";
      form?.setAttribute("data-submission-type", type);
      if (feedbackBox) {
        feedbackBox.style.display = "none";
        feedbackBox.textContent = "";
      }
    }

    document.querySelectorAll(".trigger-discrepancy-modal, .trigger-suggestion-modal").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        setSubmissionMode(el.classList.contains("trigger-suggestion-modal") ? "suggestion" : "discrepancy");

        // 1. Capture dynamic page context
        const pagePath = window.location.pathname.split("/").pop() || "index.html";
        const cleanTitle = document.title.split("—")[0].trim();
        if (pageBadge) {
          pageBadge.textContent = `${pagePath} (${cleanTitle})`;
        }

        // 2. Pre-fill active authenticated user credentials if available
        if (window.VotalumeAuth && typeof window.VotalumeAuth.getUser === "function") {
          const authUser = window.VotalumeAuth.getUser();
          if (authUser) {
            if (nameInput && !nameInput.value) {
              nameInput.value = authUser.displayName || authUser.email?.split("@")[0] || "";
            }
            if (emailInput && !emailInput.value) {
              emailInput.value = authUser.email || "";
            }
          }
        }

        if (feedbackBox) {
          feedbackBox.style.display = "none";
          feedbackBox.textContent = "";
        }

        modal.classList.add("active");
      });
    });

    const form = document.getElementById("discrepancy-form");
    setSubmissionMode("discrepancy");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const recordId = recordIdInput?.value.trim() || "";
        const description = descInput?.value.trim() || "";
        let userName = nameInput?.value.trim() || "";
        let userEmail = emailInput?.value.trim() || "";

        // Automatic fallback to authenticated citizen identity
        if (!userName && window.VotalumeAuth && typeof window.VotalumeAuth.getUser === "function") {
          const authUser = window.VotalumeAuth.getUser();
          if (authUser) {
            userName = authUser.displayName || authUser.email?.split("@")[0] || "Authenticated Citizen";
            if (!userEmail) userEmail = authUser.email || "";
          }
        }
        if (!userName) userName = "Anonymous Citizen";

        const pagePath = window.location.pathname.split("/").pop() || "index.html";
        const reportData = {
          submission_type: submissionType,
          timestamp: new Date().toISOString(),
          Page_Path: pagePath,
          Page_URL: window.location.href,
          Page_Title: document.title,
          Entity_Type: submissionType === "suggestion" ? "Suggestion" : entityTypeInput?.value || "Other",
          Entity_ID: submissionType === "suggestion" ? "" : recordId,
          Entity_Name: submissionType === "suggestion" ? "" : entityNameInput?.value.trim() || "",
          Issue_Category: submissionType === "suggestion" ? "Suggestion" : issueCategoryInput?.value || "Other",
          Description: description,
          Official_Source_URL: submissionType === "suggestion" ? "" : sourceUrlInput?.value.trim() || "",
          Reporter_Email: userEmail,
          pagePath: pagePath,
          pageUrl: window.location.href,
          pageTitle: document.title,
          userEmail: userEmail,
          recordId: submissionType === "suggestion" ? "" : recordId,
          description: description,
          Category: submissionType === "suggestion" ? modal.querySelector("#suggestion-category")?.value || "Other" : "",
          Suggestion_Text: submissionType === "suggestion" ? description : "",
          Submitter_Email: submissionType === "suggestion" ? userEmail : "",
          targetTab: submissionType === "suggestion" ? "Suggestions" : "Discrepancy_Reports",
          status: "Pending Verification"
        };

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Logging to Master Database...";
        }

        try {
          // Apps Script accepts text/plain JSON without triggering a CORS preflight.
          const webhookUrl = window.VOTALUME_CONFIG?.REPORT_WEBHOOK_URL;
          if (!webhookUrl || !/^https:\/\//i.test(webhookUrl)) {
            throw new Error("The reporting endpoint is not configured. Please try again later.");
          }
          await fetch(webhookUrl, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(reportData)
          });

          // Google Apps Script's no-cors response is opaque; a resolved request confirms dispatch, not sheet-side processing.
          if (typeof firebase !== "undefined" && firebase.apps && firebase.apps.length) {
            try {
              const db = firebase.firestore();
              await db.collection(submissionType === "suggestion" ? "suggestions" : "discrepancy_reports").add(reportData);
            } catch (fsErr) {
              console.warn("[Votalume Report] Firestore backup write notice:", fsErr);
            }
          }

          // 3. LocalStorage offline audit log
          try {
            const storageKey = submissionType === "suggestion" ? "votalume_suggestions" : "votalume_discrepancy_reports";
            const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
            stored.push(reportData);
            localStorage.setItem(storageKey, JSON.stringify(stored));
          } catch (lsErr) {
            console.warn("[Votalume Report] Local storage cache notice:", lsErr);
          }

          if (feedbackBox) {
            feedbackBox.style.display = "block";
            feedbackBox.style.background = "#DEF7EC";
            feedbackBox.style.color = "#03543F";
            feedbackBox.style.border = "1px solid #BCF0DA";
            const submissionLabel = submissionType === "suggestion" ? "Suggestion" : "Report";
            const targetLabel = submissionType === "suggestion" ? "Suggestions" : "Discrepancy_Reports";
            feedbackBox.innerHTML = `<strong>${submissionLabel} sent:</strong> Your submission was dispatched to the master <code>${targetLabel}</code> endpoint. Google Apps Script does not provide a browser-readable receipt.`;
          }

          setTimeout(() => {
            form.reset();
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = submissionType === "suggestion" ? "Submit Suggestion" : "Submit Report";
            }
            modal.classList.remove("active");
            if (feedbackBox) feedbackBox.style.display = "none";
          }, 2400);

        } catch (error) {
          console.error("[Votalume Report] Submission error:", error);
          if (feedbackBox) {
            feedbackBox.style.display = "block";
            feedbackBox.style.background = "#FDE8E8";
            feedbackBox.style.color = "#9B1C1C";
            feedbackBox.style.border = "1px solid #F8B4B4";
            feedbackBox.textContent = error.message || "Submission could not be sent. Please try again later.";
          }
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = submissionType === "suggestion" ? "Submit Suggestion" : "Submit Report";
          }
        }
      });
    }
  }

  // --- SVG Silhouette Fallback Portrait ---

  function getSilhouetteSVG() {
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="%2394A3B8"><circle cx="50" cy="38" r="22"/><path d="M12 94c0-20.987 17.013-38 38-38s38 17.013 38 38z"/></svg>`;
  }

  function handlePortraitError(imgElement) {
    if (imgElement) {
      imgElement.onerror = null;
      imgElement.src = getSilhouetteSVG();
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[m]));
  }

  function renderBillCardDetails(bill, voteCounts, includeTags = true) {
    const yes = Number(voteCounts?.yes) || 0;
    const no = Number(voteCounts?.no) || 0;
    const present = Number(voteCounts?.present) || 0;
    const didntVote = Number(voteCounts?.didntVote) || 0;
    const total = yes + no + present + didntVote || 1;
    const tagsText = String(bill.Tags || bill.Assigned_Tags || "");
    const tags = tagsText.match(/\[[^\]]+\]/g) || tagsText.split(/[;,]/).map((tag) => tag.trim()).filter(Boolean);
    const tagMarkup = tags.map((tag) => {
      const label = window.VotalumeData?.getFriendlyTagLabel?.(tag) || tag;
      return `<span class="tag-pill">${escapeHtml(label)}</span>`;
    }).join("");
    const voteSummary = bill.Plain_Vote_Summary || "Vote summary not available.";
    const voteMeaning = [
      ["Yes", bill.Vote_Yes_Means],
      ["No", bill.Vote_No_Means],
      ["Didn't Vote", bill.Vote_Absent_Means]
    ];
    const impact = [
      ["Who it affects", bill.Who_It_Affects],
      ["What you gain", bill.What_You_Gain],
      ["What you may lose or pay", bill.What_You_Lose_Or_Pay]
    ];

    return `
      <div class="vote-count-panel" style="margin:1rem 0 0.75rem;background:#F8FAFC;border:1px solid var(--color-border);padding:0.85rem 1rem;border-radius:4px;">
        <div style="display:flex;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;font-size:0.9rem;font-weight:600;margin-bottom:0.5rem;">
          <span style="color:#15803D">Yes: ${yes}</span><span style="color:#B91C1C">No: ${no}</span><span>Present: ${present}</span><span>Didn't Vote: ${didntVote}</span>
        </div>
        <div role="img" aria-label="Vote counts: ${yes} yes, ${no} no, ${present} present, ${didntVote} didn't vote" style="height:10px;background:#E2E8F0;overflow:hidden;display:flex;border-radius:2px;">
          <span style="width:${yes / total * 100}%;background:#15803D"></span><span style="width:${no / total * 100}%;background:#B91C1C"></span><span style="width:${present / total * 100}%;background:#D97706"></span><span style="width:${didntVote / total * 100}%;background:#64748B"></span>
        </div>
        <p style="margin:0.65rem 0 0;color:var(--color-text-secondary);font-size:0.9rem;line-height:1.5;">${escapeHtml(voteSummary)}</p>
      </div>
      <section aria-label="What a vote means" style="margin:0.75rem 0;">
        <h3 class="plain-label-main" style="margin:0 0 0.4rem;">What a Vote Means</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:0.6rem;">
        ${voteMeaning.map(([label, text]) => `<div style="padding:0.65rem;border-left:3px solid var(--color-border);background:#FAFAFA;"><strong>${label}</strong><div style="font-size:0.9rem;color:var(--color-text-secondary);margin-top:0.2rem;">${escapeHtml(text || "Not available")}</div></div>`).join("")}
        </div>
      </section>
      <section aria-label="How it affects me" style="padding:0.8rem;border:1px solid var(--color-border);margin:0.75rem 0;background:#FFF;">
        <h3 style="font-size:1rem;margin:0 0 0.4rem;">How It Affects Me</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:0.55rem;">
          ${impact.map(([label, text]) => `<div><strong style="font-size:0.85rem;">${label}</strong><div style="font-size:0.9rem;color:var(--color-text-secondary);">${escapeHtml(text || "Not available")}</div></div>`).join("")}
        </div>
      </section>
      ${includeTags && tagMarkup ? `<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin:0.75rem 0 1rem;">${tagMarkup}</div>` : ""}
    `;
  }

  return {
    initCommon,
    openSearchModal,
    closeSearchModal,
    handlePortraitError,
    getSilhouetteSVG,
    escapeHtml,
    renderBillCardDetails,
    updateTagTaxonomyLabels
  };
})();

if (typeof window !== "undefined") {
  window.VotalumeUI = VotalumeUI;
}
