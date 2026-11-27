# Votalume — Shining Light on the Vote
### Official, Nonpartisan Civic Legislative Accountability Platform
Zero-Build Architecture for GitHub Pages • United States Congress (119th & Post-Jan 2027 120th Sessions)  
Developed by **[GrayRoseCreations](https://github.com/GrayRoseCreations)** • [GitHub Repository](https://github.com/GrayRoseCreations/votalume) • [Live Portal](https://grayrosecreations.github.io/votalume/)

---

## 🏛️ Executive Overview

**Votalume** is an independent, nonpartisan civic platform dedicated to illuminating legislative actions in the United States Congress. Built with pure HTML5, CSS3, and modular vanilla JavaScript (leveraging Chart.js and PapaParse via CDN), Votalume operates with **zero build step**, enabling instant static hosting on GitHub Pages while dynamically synchronizing live Congressional roll calls from Google Sheets and Cloud Firestore.

### Core Architectural Tenets
1. **Calm, Authoritative Civic Design**: Deep Civic Navy (`#1B365D`), Slate (`#F8FAFC`), crisp white cards, and warm neutral gray borders with `Merriweather` serif headings and `Inter` sans-serif data tables.
2. **Unified Multi-Chamber Career Profiles**: Seamlessly merges House and Senate records by `Bioguide_ID` so transferring members (e.g., Representatives elected to the Senate) maintain one continuous career narrative with zero false absence gaps.
3. **Separated Attendance & Lame-Duck Accountability**: Isolates pre-election regular session voting from post-election lame-duck sessions (Nov–Jan), distinguishing members who *"Served Through the Final Bell"* (≥90% attendance) from those experiencing a *"Lame-Duck Drop-Off"* (≥20 percentage point decline).
4. **Split Presidential Support Tracking**: Disaggregates presidential alignment into periods when a member's own party holds the White House versus when the opposition party is in power.
5. **6 Composite Policy Indices (0–100%)**: Calibrated against substantive roll calls and official CBO/JCT cost scores across Economic, Social, Oversight, Defense, Healthcare, and Energy policy.
6. **Neutral Financial Disclosures**: Certified FEC contributor splits, STOCK Act periodic transaction audits, and factual counts of supportive vs. restrictive votes cast on held corporate sectors (strictly separating broad-market index/mutual funds from individual corporate equities).
7. **Blind-to-Reveal Civic Alignment Quiz**: Allows citizens to vote blindly on neutral policy questions, reveal actual Congressional roll calls, and directly compare their answers against their local House Representative and two Senators.

---

## 📁 Repository Structure

```
votalume/
├── index.html                   # Home, District Finder & Instant Global Search
├── lawmakers.html               # Congressional Lawmakers Directory with Filters
├── member.html                  # Unified Multi-Chamber Lawmaker Profile
├── bills.html                   # Bills & Recorded Roll Calls Directory
├── bill.html                    # Dedicated Bill Roll Call & Timeline Breakdown
├── parties.html                 # Party Caucus Analysis: Democrats vs. Republicans
├── compare.html                 # Side-by-Side Lawmaker Comparison Tool
├── quiz.html                    # Blind-to-Reveal Civic Alignment Quiz & Rep Match
├── guide.html                   # Active Tag Taxonomy, Formulas & System Changelog
├── css/
│   ├── main.css                 # Civic design system tokens, layout, header/footer
│   ├── components.css           # Cards, gauges, badges, tables, sticky columns
│   └── responsive.css           # Mobile optimizations, accessibility & print CSS
├── js/
│   ├── config.js                # Central configuration, sheet URLs, Firebase Spark config
│   ├── seed-data.js             # High-fidelity baseline seed dataset (resilience fallback)
│   ├── state-districts.js       # 50-state & district directory (119th & 120th maps)
│   ├── data.js                  # Master data layer, PapaParse engine & cache manager
│   ├── auth.js                  # Firebase Auth + Firestore with localStorage guest fallback
│   ├── charts.js                # Chart.js visualization engine (shift timelines, radars, bars)
│   ├── ui.js                    # Shared UI: mobile menu, search modal, auth modal
│   ├── index-page.js            # Home page controller & delegation finder
│   ├── lawmakers-page.js        # Lawmakers directory controller
│   ├── member-page.js           # Multi-chamber profile controller
│   ├── bills-page.js            # Bills directory controller
│   ├── bill-page.js             # Single bill roll-call controller
│   ├── parties-page.js          # Caucus comparison controller
│   ├── compare-page.js          # Side-by-side comparison controller
│   ├── quiz-page.js             # Blind-to-reveal quiz controller & local rep match
│   └── guide-page.js            # Taxonomy & changelog controller
├── assets/
│   ├── favicon.svg              # Votalume beacon flame icon
│   └── seal-fallback.svg        # Accessible public silhouette fallback
└── README.md                    # System documentation & security rules
```

---

## 📊 Google Sheets Master Database Architecture

Votalume pulls live CSV records directly from the Google Sheets GViz endpoint:
`https://docs.google.com/spreadsheets/d/1gcU-CVHfysi37Vtp_aDf6qOUFGUnfrpXpfNDTXBNgaM/gviz/tq?tqx=out:csv&sheet=[Tab_Name]`

| Tab Name | GViz Headers Setting | Lazy Loaded? | Scope & Purpose |
| :--- | :---: | :---: | :--- |
| `House_Summary` | `&headers=1` | No | Summary voting indices, regular & lame-duck attendance for House members |
| `Senate_Summary` | `&headers=1` | No | Summary voting indices, regular & lame-duck attendance for Senators |
| `Party_Comparison` | `&headers=1` | No | Caucus-wide unity, crossover, participation, and presidential support metrics |
| `Voting_Trends` | `&headers=1` | No | Quarterly scores (2025-Q1 through 2026-Q1) for timeline trend graphs |
| `Accountability_Extras` | `&headers=1` | No | FEC donation splits, STOCK Act flags, portfolio types, and held sector overlaps |
| `Tag_Definitions` | `&headers=1` | No | Active legislative tags grouped by their plain-English category |
| `Quiz_Question_Bank` | `&headers=1` | No | Neutral trade-off questions, provision weights, and roll-call reveal keys |
| `Quiz_Benchmarks` | `&headers=1` | No | Public aggregate Yes/No totals and verified voter counts only |
| `Backfill_Queue` | `&headers=1` | No | Ingestion batches and sync status tracking |
| `Site_Metadata` | `&headers=1` | No | Active Congress session, total bills analyzed, backfill completion % |
| `House_Votes_Log` | `&headers=0` | **Yes** | Full member-by-vote matrix for House roll calls (loaded only on detail pages) |
| `Senate_Votes_Log` | `&headers=0` | **Yes** | Full member-by-vote matrix for Senate roll calls (loaded only on detail pages) |
| `Change_Control_And_Health` | `&headers=1` | No | Internal control plane; public clients strictly filter to `Status = Applied` |

> [!NOTE]
> **Data Resilience**: If a live Google Sheet tab is empty or synchronizing, Votalume automatically falls back to the embedded baseline seed dataset (`js/seed-data.js`) while displaying a subtle `"Showing cached data"` status banner.

Signed-in quiz submissions are stored in a separate, access-restricted spreadsheet. The public master workbook must not contain a `Quiz_Responses` tab. Configure the Apps Script properties `PRIVATE_QUIZ_SPREADSHEET_ID` and `FIREBASE_WEB_API_KEY`, then deploy the updated webhook in `google-apps-script-discrepancy-reports.js`. The handler verifies Firebase ID tokens, keeps one private response per user and question, and publishes only aggregate counts to `Quiz_Benchmarks`. Before deployment, privately migrate any existing raw response records and remove the old public `Quiz_Responses` tab.

---

## 🔒 Firebase Authentication & Cloud Firestore Security Rules

Votalume uses Firebase Authentication (Email/Password + Google Sign-In) and Cloud Firestore to persist citizen preferences (saved Home District and bookmarked lawmakers). Unauthenticated visitors browse with full functionality via `localStorage`. Quiz responses are not stored in the user's public profile or published individually.

### Strict Cloud Firestore Security Rules
Deploy the following rules in your Firebase Console (`votalume-civic`):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Deny all root-level collections by default
    match /{document=**} {
      allow read, write: if false;
    }

    // Citizen Profiles: Users can only read and write their own document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      // Validate schema on write
      allow update, create: if request.auth != null 
        && request.auth.uid == userId
        && request.resource.data.homeState is string
        && request.resource.data.homeDistrict is string
        && request.resource.data.bookmarkedLawmakers is list;
    }
  }
}
```

---

## ⚖️ Nonpartisan Methodology & Editorial Charter

1. **Party-at-Vote Rule**: All roll-call tallies, party unity scores, and crossover percentages use a lawmaker's verified party affiliation on the date the vote occurred.
2. **Exclusion of Housekeeping Votes**: Motions to table, procedural cloture motions, and uncontested consensus nominations are recorded for floor attendance but excluded from substantive policy index calculations.
3. **Financial Disclosures**: Direct ownership of individual corporate equities is distinguished from broad-based mutual funds, ETFs, and qualified blind trusts. Raw counts of supportive vs. restrictive votes cast on held sectors are presented without editorial bias.
4. **Public Domain Imagery**: All portraits are retrieved from the verified public-domain Congressional collection curated by `@unitedstates` and the Congressional Bioguide.

---

## 🚀 Deployment to GitHub Pages

1. Clone or push this repository to GitHub:
   ```bash
   git add .
   git commit -m "Deploy Votalume Civic Accountability Platform"
   git push origin main
   ```
2. Navigate to your repository's **Settings → Pages**.
3. Under **Build and deployment**, select **Source: Deploy from a branch** and set branch to `main` / `root`.
4. Click **Save**. The website will be live at `https://grayrosecreations.github.io/votalume/`.

---

## 📄 License & Attribution

Designed and maintained by [GrayRoseCreations](https://github.com/GrayRoseCreations).  
Source Repository: [https://github.com/GrayRoseCreations/votalume](https://github.com/GrayRoseCreations/votalume)

*Official Data Attributions: Library of Congress (`Congress.gov`), Office of the Clerk (`clerk.house.gov`), Secretary of the Senate (`senate.gov`), Congressional Budget Office (`CBO.gov`), Joint Committee on Taxation (`JCT.gov`), Federal Election Commission (`FEC.gov`), and Congressional Bioguide.*
