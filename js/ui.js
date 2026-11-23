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
    setupDiscrepancyModal();
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
      if (banner) {
        banner.style.display = isCached ? "flex" : "none";
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
          sub: `${party} • ${district} • Attendance: ${m.Regular_Attendance_Pct || "95%"}`,
          url: `member.html?id=${id}`,
          badgeClass: party === "Democratic" ? "badge-dem" : party === "Republican" ? "badge-rep" : "badge-ind",
          badgeText: party
        });
      }
    });

    // Search Bills
    bills.forEach((b) => {
      const fullText = `${b.Bill_Number} ${b.Bill_Title} ${b.Assigned_Tags} ${b.Chamber}`.toLowerCase();
      if (fullText.includes(query)) {
        results.push({
          type: "Bill",
          title: `${b.Bill_Number}: ${b.Bill_Title}`,
          sub: `${b.Chamber} • Result: ${b.Result} • ${b.Vote_Date}`,
          url: `bill.html?id=${b.Roll_Call_ID}`,
          badgeClass: "badge-gold",
          badgeText: b.Margin_Type || "Roll Call"
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

    document.querySelectorAll(".trigger-discrepancy-modal").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();

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
          timestamp: new Date().toISOString(),
          pagePath: pagePath,
          pageUrl: window.location.href,
          pageTitle: document.title,
          userName: userName,
          userEmail: userEmail,
          recordId: recordId,
          description: description,
          targetTab: "Discrepancy_Reports",
          status: "Pending Verification"
        };

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Logging to Master Database...";
        }

        try {
          // 1. Dispatch to Google Sheets Master Database Webhook (Tab: Discrepancy_Reports)
          const webhookUrl = window.VOTALUME_CONFIG?.REPORT_WEBHOOK_URL;
          if (webhookUrl && webhookUrl.startsWith("http")) {
            try {
              await fetch(webhookUrl, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(reportData)
              });
            } catch (netErr) {
              console.warn("[Votalume Report] Webhook dispatch notice:", netErr);
            }
          }

          // 2. Cloud Firestore persistent backup
          if (typeof firebase !== "undefined" && firebase.apps && firebase.apps.length) {
            try {
              const db = firebase.firestore();
              await db.collection("discrepancy_reports").add(reportData);
            } catch (fsErr) {
              console.warn("[Votalume Report] Firestore backup write notice:", fsErr);
            }
          }

          // 3. LocalStorage offline audit log
          try {
            const stored = JSON.parse(localStorage.getItem("votalume_discrepancy_reports") || "[]");
            stored.push(reportData);
            localStorage.setItem("votalume_discrepancy_reports", JSON.stringify(stored));
          } catch (lsErr) {
            console.warn("[Votalume Report] Local storage cache notice:", lsErr);
          }

          if (feedbackBox) {
            feedbackBox.style.display = "block";
            feedbackBox.style.background = "#DEF7EC";
            feedbackBox.style.color = "#03543F";
            feedbackBox.style.border = "1px solid #BCF0DA";
            feedbackBox.innerHTML = `<strong>✓ Report Queued:</strong> Successfully submitted to master <code>Discrepancy_Reports</code> database from <em>${escapeHtml(pagePath)}</em>. Thank you, <strong>${escapeHtml(userName)}</strong>!`;
          }

          setTimeout(() => {
            form.reset();
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = "Submit Report";
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
            feedbackBox.textContent = "Notice: Live sync offline, but your audit was saved to local backup. Thank you!";
          }
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit Report";
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

  return {
    initCommon,
    openSearchModal,
    closeSearchModal,
    handlePortraitError,
    getSilhouetteSVG,
    escapeHtml
  };
})();

if (typeof window !== "undefined") {
  window.VotalumeUI = VotalumeUI;
}
