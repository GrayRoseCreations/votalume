/**
 * VOTALUME — Central Configuration Module
 * "Shining Light on the Vote"
 */

const VOTALUME_CONFIG = {
  // Brand & Version
  SITE_NAME: "Votalume",
  SITE_TAGLINE: "Shining Light on the Vote",
  VERSION: "3.4.0",
  AUTHOR: "GrayRoseCreations",
  GITHUB_REPO: "https://github.com/GrayRoseCreations/votalume",
  GITHUB_PROFILE: "https://github.com/GrayRoseCreations",

  // Google Sheets Master Database
  SPREADSHEET_ID: "1gcU-CVHfysi37Vtp_aDf6qOUFGUnfrpXpfNDTXBNgaM",
  SHEETS_BASE_URL: "https://docs.google.com/spreadsheets/d/1gcU-CVHfysi37Vtp_aDf6qOUFGUnfrpXpfNDTXBNgaM/gviz/tq?tqx=out:csv",

  // Tab definitions & header handling
  TABS: {
    BILLS_SUMMARY: { name: "Bills_Summary", headers: 1 },
    HOUSE_SUMMARY: { name: "House_Summary", headers: 1 },
    SENATE_SUMMARY: { name: "Senate_Summary", headers: 1 },
    PARTY_COMPARISON: { name: "Party_Comparison", headers: 1 },
    VOTING_TRENDS: { name: "Voting_Trends", headers: 1 },
    ACCOUNTABILITY_EXTRAS: { name: "Accountability_Extras", headers: 1 },
    TAG_DEFINITIONS: { name: "Tag_Definitions", headers: 1 },
    QUIZ_QUESTION_BANK: { name: "Quiz_Question_Bank", headers: 1 },
    BACKFILL_QUEUE: { name: "Backfill_Queue", headers: 1 },
    DISCREPANCY_REPORTS: { name: "Discrepancy_Reports", headers: 1 },
    SITE_METADATA: { name: "Site_Metadata", headers: 1 },
    // Large Vote Logs: Lazy loaded with headers=0
    HOUSE_VOTES_LOG: { name: "House_Votes_Log", headers: 0, lazy: true },
    SENATE_VOTES_LOG: { name: "Senate_Votes_Log", headers: 0, lazy: true },
    // Public audit log: Tab 12 is internal control plane; only public Applied records rendered
    CHANGE_CONTROL_AND_HEALTH: { name: "Change_Control_And_Health", headers: 1, publicFiltered: true }
  },

  // Google Doc Neutral Impact Analysis Viewers
  DOCS: {
    HOUSE_ANALYSIS: "https://docs.google.com/document/d/1ERY8G6DMIQHtsaCcmlSMSkvKCuQizuQado4uoC2bE0w/edit?tab=t.0#heading=h.m1ocict6ti1c",
    SENATE_ANALYSIS: "https://docs.google.com/document/d/1MBkvNt09esmncivhz-RUKUJqHWXsPYprw2IIDs1rV-Y/edit?tab=t.0#heading=h.eny4xpj6ephe"
  },

  // Firebase Spark Configuration
  FIREBASE: {
    apiKey: "AIzaSyCUwv-NFJhTQaiaYG5qwg51ad5-d3OyUGU",
    authDomain: "votalume-civic.firebaseapp.com",
    projectId: "votalume-civic",
    storageBucket: "votalume-civic.firebasestorage.app",
    messagingSenderId: "1025598488849",
    appId: "1:1025598488849:web:1692f1f5d8192cd3268cb0"
  },

  // Cache & Storage Settings
  CACHE_TTL_MINUTES: 15,
  MAX_FETCH_RETRIES: 2,
  RETRY_DELAY_MS: 800,

  // Google Apps Script Webhook Endpoint (Master Database Discrepancy_Reports Tab)
  REPORT_WEBHOOK_URL: "https://script.google.com/macros/s/AKfycbxvYWowL0Vi8eLLKwjFZP_TtAImfTrBVf-PrVcFABd9GeLBQaBCbzcS-i3yc594-i5RvQ/exec",

  // Ko-fi Support
  KOFI_URL: "https://ko-fi.com/C8M02B83R2",

  // External Reference URLs
  EXTERNAL_SOURCES: {
    CONGRESS_GOV: "https://www.congress.gov",
    HOUSE_CLERK: "https://clerk.house.gov",
    SENATE_VOTES: "https://www.senate.gov",
    BIOGUIDE: "https://bioguide.congress.gov",
    CBO: "https://www.cbo.gov",
    JCT: "https://www.jct.gov",
    FEC: "https://www.fec.gov"
  },

  // Helper to generate the exact CSV fetch URL
  getSheetCsvUrl: function(tabKey, cacheBust = false) {
    const tab = this.TABS[tabKey];
    if (!tab) throw new Error(`Unknown tabKey: ${tabKey}`);
    const url = `${this.SHEETS_BASE_URL}&sheet=${encodeURIComponent(tab.name)}&headers=${tab.headers}`;
    return cacheBust ? `${url}&t=${Date.now()}` : url;
  }
};

if (typeof window !== "undefined") {
  window.VOTALUME_CONFIG = VOTALUME_CONFIG;
}
