/**
 * VOTALUME — Authentication & User Profile Management
 * Integrates Firebase Auth + Cloud Firestore with seamless localStorage guest fallback.
 */

const VotalumeAuth = (function() {
  const STORAGE_KEYS = {
    GUEST_PROFILE: "votalume_guest_profile",
    USER_PREFS: "votalume_user_prefs"
  };

  let firebaseApp = null;
  let auth = null;
  let db = null;
  let currentUser = null;
  let userProfileData = {
    homeState: "",
    homeDistrict: "",
    congressMapEra: "119th", // "119th" or "120th"
    bookmarkedLawmakers: [],
    quizResponses: {}
  };

  // Listeners for auth state change
  const listeners = [];

  function init() {
    loadGuestData();

    // Check if Firebase SDK is available via CDN
    if (typeof firebase !== "undefined" && window.VOTALUME_CONFIG?.FIREBASE?.apiKey) {
      try {
        if (!firebase.apps.length) {
          firebaseApp = firebase.initializeApp(window.VOTALUME_CONFIG.FIREBASE);
        } else {
          firebaseApp = firebase.app();
        }
        auth = firebase.auth();
        db = firebase.firestore();

        // Listen for Auth changes
        auth.onAuthStateChanged(async (user) => {
          currentUser = user;
          if (user) {
            await syncUserProfileFromCloud(user.uid);
          } else {
            loadGuestData();
          }
          notifyListeners();
          updateHeaderAuthUI();
        });
      } catch (err) {
        console.warn("[Votalume Auth] Firebase init error, running in local guest mode:", err);
        notifyListeners();
        updateHeaderAuthUI();
      }
    } else {
      console.info("[Votalume Auth] Firebase CDN not loaded. Operating in guest localStorage mode.");
      notifyListeners();
      updateHeaderAuthUI();
    }
  }

  function loadGuestData() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.GUEST_PROFILE);
      if (stored) {
        userProfileData = JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Could not read localStorage profile:", e);
    }
  }

  function saveGuestData() {
    try {
      localStorage.setItem(STORAGE_KEYS.GUEST_PROFILE, JSON.stringify(userProfileData));
    } catch (e) {
      console.warn("Could not save to localStorage:", e);
    }
  }

  async function syncUserProfileFromCloud(uid) {
    if (!db) return;
    try {
      const docRef = db.collection("users").doc(uid);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        const cloudData = docSnap.data();
        // Merge cloud data with any local guest responses
        userProfileData = {
          homeState: cloudData.homeState || userProfileData.homeState || "",
          homeDistrict: cloudData.homeDistrict || userProfileData.homeDistrict || "",
          congressMapEra: cloudData.congressMapEra || userProfileData.congressMapEra || "119th",
          bookmarkedLawmakers: Array.from(new Set([...(cloudData.bookmarkedLawmakers || []), ...(userProfileData.bookmarkedLawmakers || [])])),
          quizResponses: { ...(cloudData.quizResponses || {}), ...(userProfileData.quizResponses || {}) }
        };
        // Save back merged state
        await docRef.set(userProfileData, { merge: true });
      } else {
        // Create initial cloud document with guest data
        await docRef.set(userProfileData);
      }
      saveGuestData();
    } catch (err) {
      console.warn("[Votalume Auth] Firestore profile sync failed:", err);
    }
  }

  async function persistUserProfile() {
    saveGuestData();
    if (currentUser && db) {
      try {
        await db.collection("users").doc(currentUser.uid).set(userProfileData, { merge: true });
      } catch (err) {
        console.warn("[Votalume Auth] Firestore save error:", err);
      }
    }
    notifyListeners();
  }

  // --- Auth Actions ---

  async function signInWithGoogle() {
    if (!auth) throw new Error("Firebase Auth is not initialized.");
    const provider = new firebase.auth.GoogleAuthProvider();
    return await auth.signInWithPopup(provider);
  }

  async function signInWithEmailPassword(email, password) {
    if (!auth) throw new Error("Firebase Auth is not initialized.");
    return await auth.signInWithEmailAndPassword(email, password);
  }

  async function signUpWithEmailPassword(email, password) {
    if (!auth) throw new Error("Firebase Auth is not initialized.");
    return await auth.createUserWithEmailAndPassword(email, password);
  }

  async function signOut() {
    if (auth && currentUser) {
      await auth.signOut();
    }
    currentUser = null;
    loadGuestData();
    notifyListeners();
    updateHeaderAuthUI();
  }

  // --- Profile / Preferences Setters ---

  async function setHomeDistrict(stateCode, districtNumber, mapEra = "119th") {
    userProfileData.homeState = stateCode ? stateCode.toUpperCase() : "";
    userProfileData.homeDistrict = districtNumber !== undefined ? String(districtNumber) : "";
    userProfileData.congressMapEra = mapEra;
    await persistUserProfile();
  }

  function getHomeDistrict() {
    return {
      state: userProfileData.homeState || "",
      district: userProfileData.homeDistrict || "",
      era: userProfileData.congressMapEra || "119th"
    };
  }

  async function toggleBookmark(memberId) {
    if (!memberId) return false;
    let list = userProfileData.bookmarkedLawmakers || [];
    const index = list.indexOf(memberId);
    let isBookmarked = false;
    if (index > -1) {
      list.splice(index, 1);
      isBookmarked = false;
    } else {
      list.push(memberId);
      isBookmarked = true;
    }
    userProfileData.bookmarkedLawmakers = list;
    await persistUserProfile();
    return isBookmarked;
  }

  function isBookmarked(memberId) {
    return (userProfileData.bookmarkedLawmakers || []).includes(memberId);
  }

  function getBookmarks() {
    return [...(userProfileData.bookmarkedLawmakers || [])];
  }

  // Quiz Response handling: key is [Question_ID]__[Calendar_Quarter]
  async function recordQuizVote(questionId, quarter, voteAnswer, weight = 1.0) {
    const key = `${questionId}__${quarter}`;
    if (!userProfileData.quizResponses) userProfileData.quizResponses = {};
    userProfileData.quizResponses[key] = {
      questionId,
      quarter,
      answer: voteAnswer, // "Yea" | "Nay"
      weight: weight,
      timestamp: new Date().toISOString()
    };
    await persistUserProfile();
  }

  function getQuizResponses() {
    return { ...(userProfileData.quizResponses || {}) };
  }

  function onAuthStateChanged(cb) {
    listeners.push(cb);
  }

  function notifyListeners() {
    listeners.forEach((fn) => {
      try {
        fn({
          user: currentUser,
          profile: userProfileData,
          isGuest: !currentUser
        });
      } catch (e) {
        console.error("Error in auth listener:", e);
      }
    });
  }

  function updateHeaderAuthUI() {
    const authBtn = document.getElementById("header-user-auth-btn");
    if (!authBtn) return;
    if (currentUser) {
      const displayName = currentUser.displayName || currentUser.email?.split("@")[0] || "Citizen";
      authBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
        <span>${escapeHtml(displayName)}</span>
      `;
      authBtn.title = `Signed in as ${currentUser.email}. Click for Profile & District.`;
    } else {
      authBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <span>Sign In / Profile</span>
      `;
      authBtn.title = "Sign in to save your district, bookmarks, and quarterly alignment";
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
    init,
    signInWithGoogle,
    signInWithEmailPassword,
    signUpWithEmailPassword,
    signOut,
    getUser: () => currentUser,
    getProfile: () => ({ ...userProfileData }),
    setHomeDistrict,
    getHomeDistrict,
    toggleBookmark,
    isBookmarked,
    getBookmarks,
    recordQuizVote,
    getQuizResponses,
    onAuthStateChanged
  };
})();

if (typeof window !== "undefined") {
  window.VotalumeAuth = VotalumeAuth;
}
